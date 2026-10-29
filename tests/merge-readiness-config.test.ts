import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Release checks should not regress silently when changing workflow path filters.
describe("merge-readiness configuration", () => {
  const root = join(import.meta.dir, "..");
  const read = (path: string) => readFileSync(join(root, path), "utf8");

  test("both branches run the complete test suite without release-only bypasses", () => {
    const workflow = read(".github/workflows/dev-validation.yml");
    expect(workflow).toContain("        run: bun run test:smoke");
    expect(workflow).toContain("        run: bun test tests/map-blueprints.test.ts");
    expect(workflow).not.toContain("Curated release tree:");
    expect(workflow).not.toContain("release/main-*");
  });

  test("root README documents game modes, controls, installation and MIT licensing", () => {
    const readme = read("README.md");
    for (const phrase of ["How to play", "Game modes", "Capture the Flag", "Survival", "Controls", "Running locally", "MIT License"]) {
      expect(readme).toContain(phrase);
    }
    expect(readme).not.toContain("release/README.md");
    expect(read("LICENSE")).toContain("MIT License");
  });

  test("obsolete curated release files are absent, but test and QA guides remain", () => {
    for (const file of ["scripts/prepare-main-release.sh", "docs/release-promotion.md", "release/README.md", "package-lock.json"]) {
      expect(existsSync(join(root, file))).toBe(false);
    }
    expect(existsSync(join(root, "docs/dev-test-checklist.md"))).toBe(true);
    expect(existsSync(join(root, "tests/armory-challenges.test.ts"))).toBe(true);
  });

  test("production build does not opt out of TypeScript safety", () => {
    const nextConfig = read("next.config.ts");
    expect(nextConfig).not.toContain("ignoreBuildErrors: true");
    expect(nextConfig).toContain('output: "standalone"');
  });

  test("map CI watches and tests orbital CTF and Afterlight roof regressions", () => {
    const workflow = read(".github/workflows/afterlight-dev-validation.yml");
    for (const path of [
      "tests/afterlight-ridgefall-polish.test.ts",
      "tests/afterlight-performance-roof-bots.test.ts",
      "tests/ctf-rules.test.ts",
      "tests/ctf-feedback.test.ts",
      "src/lib/forest-warfare.ts",
      "src/data/map-themes/orbital_nexus.json",
    ]) {
      expect(workflow).toContain("      - " + path);
    }
    expect(workflow).not.toContain(
      "      - tests/afterlight-ridgefall-polish.test.ts tests/afterlight-performance-roof-bots.test.ts",
    );
    expect(workflow).toContain("tests/afterlight-performance-roof-bots.test.ts tests/afterlight-performance-and-elevation.test.ts");
  });
});
