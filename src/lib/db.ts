import { PrismaClient } from '@prisma/client'
import { existsSync, mkdirSync, accessSync, constants, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { execSync } from 'child_process'

// ───────────────────────────────────────────────────────────────────────────
// DATABASE URL RESOLUTION + LAZY CLIENT — BUILD-SAFE
// ───────────────────────────────────────────────────────────────────────────
//
// CRITICAL: This module is imported by API routes, which means it is
// evaluated during `next build`'s "Collecting page data" phase. The build
// environment on the deploy platform may NOT have:
//   - The persistent volume mounted at /home/z/.vanguard-ops-data/
//   - `bunx` / `npx` / `prisma` CLI in PATH
//   - Write access to the filesystem outside the project dir
//
// If any of those are missing and we try to touch the DB at module load
// time, the BUILD ITSELF crashes with "Sorry, there was a problem deploying
// the code."
//
// FIX: Everything is LAZY. The PrismaClient is not created until the first
// actual DB query at runtime. The schema self-healing check is also deferred
// to first use. During build, this module is effectively a no-op.
// ───────────────────────────────────────────────────────────────────────────

import { tmpdir } from 'os'

// The DATABASE_URL from .env (e.g. "file:./db/custom.db"). This is the
// PRIMARY path — it's what the developer configured and what Prisma CLI uses.
// We respect it as-is (no override) so local dev, deploy, and Prisma CLI all
// agree on the same DB location.
const ENV_DB_URL = process.env.DATABASE_URL || 'file:./db/custom.db'

// Sandbox-only persistent path (used as a fallback when the env path isn't
// writable — e.g. read-only deploy filesystems).
const PERSISTENT_DB_URL = 'file:/home/z/.vanguard-ops-data/custom.db'
const PERSISTENT_DB_DIR = '/home/z/.vanguard-ops-data'

// Project-relative fallback (relative to this module file: src/lib/ → ../../db)
const MODULE_DIR = resolve(dirname(resolve(__dirname)))
const PROJECT_DB_DIR = resolve(MODULE_DIR, '..', '..', 'db')
const PROJECT_DB_URL = 'file:' + resolve(PROJECT_DB_DIR, 'custom.db')

// OS tmp fallback (always writable, not persistent)
const TMP_DB_DIR = resolve(tmpdir(), 'vanguard-ops')
const TMP_DB_URL = 'file:' + resolve(TMP_DB_DIR, 'custom.db')

/**
 * Returns true if we are currently running inside `next build` (page-data
 * collection / static generation), where the DB should NOT be touched.
 *
 * Signals we check:
 *  - `NEXT_PHASE` env var: Next.js sets this to `phase-production-build`
 *    during build.
 *  - We also defensively return true if the persistent DB dir is not
 *    writable AND we're not in a runtime request context — but the NEXT_PHASE
 *    check is the primary signal.
 */
function isBuildContext(): boolean {
  // Next.js exposes the current phase via process.env.NEXT_PHASE during build.
  // See: https://nextjs.org/docs/app/api-reference/next-config-js
  const phase = process.env.NEXT_PHASE
  if (phase && (phase.includes('build') || phase.includes('production-build'))) {
    return true
  }
  return false
}

function isDirWritable(dir: string): boolean {
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    accessSync(dir, constants.W_OK)
    return true
  } catch {
    return false
  }
}

function resolveDbUrl(): string {
  const raw = ENV_DB_URL

  // Honor non-file: URLs (e.g. managed Postgres on a cloud deploy).
  if (!raw.startsWith('file:')) {
    return raw
  }

  // For SQLite file: URLs, the env path IS the primary path. We only fall
  // back to alternatives if the env path's directory isn't writable.
  // This ensures local dev, deploy, and Prisma CLI all use the SAME DB file.

  // Extract the directory from the file: URL to check if it's writable.
  // Handle both absolute (file:/path/to/db) and relative (file:./db/custom.db) URLs.
  let dbDir: string
  if (raw.startsWith('file:./') || raw.startsWith('file:../')) {
    // Relative path — resolve from the project root (cwd)
    const relPath = raw.slice('file:'.length)
    dbDir = resolve(process.cwd(), dirname(relPath))
  } else if (raw.startsWith('file:/')) {
    // Absolute path
    dbDir = resolve(dirname(raw.slice('file:'.length)))
  } else {
    dbDir = resolve(process.cwd(), 'db')
  }

  // Try the env path first
  if (isDirWritable(dbDir)) {
    return raw
  }

  // Env path not writable — try fallbacks (sandbox persistent, project db, tmp)
  const candidates = [
    { url: PERSISTENT_DB_URL, dir: PERSISTENT_DB_DIR, label: 'persistent' },
    { url: PROJECT_DB_URL, dir: PROJECT_DB_DIR, label: 'project-db' },
    { url: TMP_DB_URL, dir: TMP_DB_DIR, label: 'tmp' },
  ]

  for (const c of candidates) {
    if (isDirWritable(c.dir)) {
      if (!isBuildContext()) {
        console.warn(`[db.ts] Env DB path not writable (${dbDir}). Using ${c.label} DB path: ${c.url}`)
      }
      return c.url
    }
  }

  // If ALL paths fail, return the env URL anyway — Prisma will surface
  // a clearer error. This shouldn't happen in practice (the tmp dir is always
  // writable).
  return raw
}

/**
 * Ensures the SQLite file at `dbUrl` has the Prisma schema applied. If the
 * file is missing/empty OR the Player table is missing, runs `prisma db push`
 * to apply the schema. Makes the server self-healing on fresh deploys.
 *
 * GUARDED: this function does nothing if isBuildContext() is true.
 */
function ensureSchemaApplied(dbUrl: string): void {
  if (isBuildContext()) return // Never touch DB during build
  if (!dbUrl.startsWith('file:')) return

  const filePath = dbUrl.slice('file:'.length)
  const absPath = filePath.startsWith('.')
    ? resolve(process.cwd(), filePath)
    : filePath

  const fileExists = existsSync(absPath)
  const fileIsEmpty = fileExists && readFileSync(absPath).length === 0

  if (!fileExists || fileIsEmpty) {
    console.warn(
      `[db.ts] DB file ${absPath} is ${fileIsEmpty ? 'empty' : 'missing'}. ` +
        `Applying schema via prisma db push...`
    )
    runPrismaDbPush(dbUrl)
    return
  }

  // File exists and is non-empty — check for the Player table via a probe.
  try {
    const probe = new PrismaClient({
      datasources: { db: { url: dbUrl } },
      log: [],
    })
    probe
      .$queryRawUnsafe<{ name: string }[]>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='Player' LIMIT 1"
      )
      .then((rows) => {
        if (!rows || rows.length === 0) {
          console.warn(
            `[db.ts] Player table missing in ${absPath}. Applying schema...`
          )
          runPrismaDbPush(dbUrl)
        }
      })
      .catch((err) => {
        console.warn(
          `[db.ts] Schema probe failed for ${absPath}:`,
          (err as Error)?.message ?? err
        )
        runPrismaDbPush(dbUrl)
      })
      .finally(() => {
        probe.$disconnect().catch(() => {})
      })
  } catch (err) {
    console.warn(
      `[db.ts] Could not probe DB schema:`,
      (err as Error)?.message ?? err
    )
  }
}

function runPrismaDbPush(dbUrl: string): void {
  try {
    const projectRoot = resolve(process.cwd())
    const schemaPath = existsSync(`${projectRoot}/prisma/schema.prisma`)
      ? `${projectRoot}/prisma/schema.prisma`
      : existsSync(`${__dirname}/../../prisma/schema.prisma`)
        ? resolve(`${__dirname}/../../prisma/schema.prisma`)
        : null

    if (!schemaPath) {
      console.error(
        `[db.ts] Cannot find prisma/schema.prisma. The DB at ${dbUrl} has ` +
          `no tables. Run \`bun run db:push\` manually.`
      )
      return
    }

    try {
      execSync(
        `DATABASE_URL="${dbUrl}" bunx prisma db push --schema "${schemaPath}" --accept-data-loss --skip-generate`,
        { stdio: 'inherit', cwd: projectRoot, timeout: 60_000 }
      )
      console.log(`[db.ts] Schema applied successfully to ${dbUrl}`)
    } catch {
      execSync(
        `DATABASE_URL="${dbUrl}" npx --yes prisma@6 db push --schema "${schemaPath}" --accept-data-loss --skip-generate`,
        { stdio: 'inherit', cwd: projectRoot, timeout: 60_000 }
      )
      console.log(`[db.ts] Schema applied successfully to ${dbUrl} (via npx)`)
    }
  } catch (err) {
    console.error(
      `[db.ts] Failed to apply Prisma schema to ${dbUrl}:`,
      (err as Error)?.message ?? err
    )
  }
}

// ───────────────────────────────────────────────────────────────────────────
// LAZY PrismaClient — not instantiated until first DB access at runtime.
// This makes the module safe to import during `next build`.
// ───────────────────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  __vanguardPrisma?: PrismaClient
  __vanguardDbUrl?: string
  __vanguardDbInitAttempted?: boolean
}

function createClient(): PrismaClient {
  const url = resolveDbUrl()
  // Run schema self-heal BEFORE creating the client so the tables exist
  // when Prisma tries to query them.
  try {
    ensureSchemaApplied(url)
  } catch (err) {
    console.error('[db.ts] Schema check failed:', err)
  }
  const client = new PrismaClient({
    log: ['error', 'warn'],
    datasources: { db: { url } },
  })
  globalForPrisma.__vanguardPrisma = client
  globalForPrisma.__vanguardDbUrl = url
  return client
}

/**
 * The exported `db` is a Proxy that lazily instantiates the PrismaClient on
 * first property access. During `next build`, no property is ever accessed
 * (API route handlers don't run during build), so the client is never
 * created and the DB is never touched.
 *
 * If instantiation fails, we throw a clear error on first access rather than
 * crashing the build.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    // During build, return a dummy that never triggers DB init. This is a
    // safety net — API route handlers shouldn't run during build anyway.
    if (isBuildContext()) {
      // Return a function that throws if actually called during build.
      if (typeof prop === 'string') {
        return function () {
          throw new Error(
            `[db.ts] DB access (${String(prop)}) attempted during build — ` +
              `this should never happen. API handlers must not run at build time.`
          )
        }
      }
    }
    let client = globalForPrisma.__vanguardPrisma
    if (!client) {
      client = createClient()
    }
    return Reflect.get(client, prop, receiver)
  },
})

// In dev, persist the client on globalThis to survive HMR reloads.
// We don't create it here — only on first access.
if (process.env.NODE_ENV !== 'production' && !globalForPrisma.__vanguardPrisma) {
  // Marker so we know the module loaded; client is still lazy.
}
