# Promoting a clean Vanguard Ops release to `main`

`dev` is the complete engineering branch. `main` is a **curated source release**, not a force-pushed copy of `dev`. Do not delete the tests or developer notes from `dev`: they are required for future features, QA and bug fixes.

## What the release keeps

The helper `scripts/prepare-main-release.sh` creates a **new branch based on `main`** and copies the following files directly from a selected `dev` commit:

- Runtime and game source: `src/`, `public/`, `mini-services/`
- SQLite schema: `prisma/schema.prisma` (never copies the database itself)
- Dependency and build configuration: `package.json`, `bun.lock`, `next.config.ts`, `tsconfig.json`, PostCSS/ESLint/shadcn config, `.gitignore`
- Hosting and validation: `Caddyfile`, `scripts/validate-content.ts`, `.github/workflows/dev-validation.yml` (shared validation workflow)
- `LICENSE` (MIT) and the **player-facing** `README.md` sourced from `release/README.md`

The candidate deliberately **excludes** `tests/`, `docs/`, `AGENTS.md`, historical notes, the dev-only map CI workflow, the release script itself, and the duplicate `package-lock.json`. It also removes old tracked files in `main` that no longer belong to this release. No generated `.next/`, `node_modules/`, secrets or SQLite files are copied.

The browser build is still controlled by Next.js, not GitHub tree contents: development-only files are not bundled merely because they exist on `dev`. This release policy is specifically to keep the **visible `main` source tree** tidy.

## Create a candidate (does not modify `main`)

1. Check that `dev` is the intended feature set, including whether pending Map Studio changes should be released.
2. Ensure the **exact source `dev` commit** has green catalog, full Bun regression, TypeScript and build checks. Run the manual browser, multiplayer, map and progression checks in [dev-test-checklist.md](../docs/dev-test-checklist.md). Review and back up any existing production SQLite data before schema changes.
3. In a normal local clone, run:

```bash
git fetch origin main dev
git switch dev
git pull --ff-only origin dev
bash scripts/prepare-main-release.sh origin/dev origin/main release/main-20261029
```

4. The command prints the new candidate commit and its source `dev` and base `main` SHAs. It uses a temporary Git worktree, stages only the approved files, creates a new candidate commit, removes the temporary worktree, and leaves your working branch and `main` untouched.
5. Inspect the resulting candidate:

```bash
git diff --stat origin/main...release/main-20261029
git diff --name-status origin/main...release/main-20261029
git ls-tree -r --name-only release/main-20261029
```

6. When it looks correct, push **without force** and create a PR:

```bash
git push origin release/main-20261029
gh pr create --base main --head release/main-20261029 --title "Release: Vanguard Ops" --body "Curated production tree from validated dev. Review source SHA, data migration, QA and CI before merging."
```

GitHub Actions runs catalog validation, TypeScript and the production build on `release/main-*` pushes and PRs targeting `main`. Map and gameplay tests run on `dev`; they are intentionally **not present** in the release candidate. The workflow only permits missing tests on `main` and release candidates, never on a normal `dev` push.

## Merge and rollback safety

- **Never `git push --force` to `main`** and do not move its ref to `dev` directly. Such a ref replacement can discard main-only history and make future integrations hard to reason about.
- Merging the reviewed release PR creates a main-line commit with the curated tree. A regular commit/PR can revert it if necessary.
- Use the release **source SHA** from the commit message to trace changes to their tested `dev` origin. The release tree contains the same production source blobs, while omitting development-only files and using a player-facing README.
- Existing main-only changes are **not implicitly preserved** if the curated production tree replaces them. Review the candidate diff for anything `main` must retain, and explicitly bring it into `dev` before regenerating.
- A successful candidate build does **not** migrate databases, confirm server compatibility, or prove gameplay quality. Do not merge without the data backup/migration plan and manual release sign-off.
- Subsequent releases must repeat this procedure **from the latest `main`**, not merge `dev` history directly. Otherwise development files would be reintroduced.
