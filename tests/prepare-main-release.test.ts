import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

describe("curated main release branch", () => {
  test("copies production sources and MIT/README, excludes dev-only files, leaves main and dev intact", () => {
    const repo = mkdtempSync(join(tmpdir(), "vanguard-release-test-"));
    const write = (p: string, contents: string) => {
      const full = join(repo, p);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, contents);
    };
    const git = (...args: string[]) => {
      const r = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
      expect(r.status, [r.stdout, r.stderr].join("\n")).toBe(0);
      return r.stdout.trim();
    };
    try {
      git("init", "-q", "-b", "main");
      git("config", "user.email", "release-test@example.invalid");
      git("config", "user.name", "Release Test");
      write("README.md", "old main README");
      write("old-main-notes.md", "superseded");
      git("add", "-A"); git("commit", "-qm", "main base");
      const mainSha = git("rev-parse", "HEAD");
      git("switch", "-q", "-c", "dev");
      write("LICENSE", "MIT License");
      write("release/README.md", "# The Game\nPlayer instructions");
      write("README.md", "dev README with internal notes");
      write("src/app/page.tsx", "export default function Page() { return null; }");
      write("public/logo.svg", "<svg/>");
      write("prisma/schema.prisma", "model Player {}");
      write("bun.lock", "{}");
      write("package.json", '{"name":"vanguard-ops"}');
      write("Caddyfile", "example.invalid");
      write("scripts/validate-content.ts", "console.log('valid')");
      write("scripts/dev-only.ts", "console.log('internal')");
      write(".github/workflows/dev-validation.yml", "name: validate");
      write(".github/workflows/afterlight-dev-validation.yml", "name: dev-only");
      write("tests/armory.test.ts", "test('feature', () => {})");
      write("docs/dev-test-checklist.md", "internal release notes");
      write("AGENTS.md", "developer-only instructions");
      write("package-lock.json", "duplicate npm lockfile");
      git("add", "-A"); git("commit", "-qm", "dev source");
      const devSha = git("rev-parse", "HEAD");
      const script = join(import.meta.dir, "../scripts/prepare-main-release.sh");
      const candidate = spawnSync("bash", [script, "dev", "main", "release/main-test"], { cwd: repo, encoding: "utf8" });
      expect(candidate.status, candidate.stdout + candidate.stderr).toBe(0);
      expect(candidate.stdout).toContain("Main is unchanged");
      const branch = "release/main-test";
      expect(git("rev-parse", "main")).toBe(mainSha);
      expect(git("rev-parse", "dev")).toBe(devSha);
      expect(git("show", branch + ":LICENSE")).toContain("MIT License");
      expect(git("show", branch + ":README.md")).toContain("Player instructions");
      expect(git("show", branch + ":src/app/page.tsx")).toContain("function Page");
      expect(git("show", branch + ":scripts/validate-content.ts")).toContain("valid");
      expect(git("show", branch + ":.github/workflows/dev-validation.yml")).toContain("validate");
      const releaseFiles = git("ls-tree", "-r", "--name-only", branch).split("\n");
      for (const path of ["AGENTS.md", "old-main-notes.md", "package-lock.json",
        "scripts/dev-only.ts", "tests/armory.test.ts", "docs/dev-test-checklist.md",
        ".github/workflows/afterlight-dev-validation.yml", "release/README.md"]) {
        expect(releaseFiles).not.toContain(path);
      }
      expect(git("ls-tree", "-r", "--name-only", "dev")).toContain("tests/armory.test.ts");
      const repeat = spawnSync("bash", [script, "dev", "main", branch], { cwd: repo, encoding: "utf8" });
      expect(repeat.status).not.toBe(0);
      expect(repeat.stderr).toContain("already exists");
      const bogus = spawnSync("bash", [script, "dev", "main", "main"], { cwd: repo, encoding: "utf8" });
      expect(bogus.status).not.toBe(0);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
