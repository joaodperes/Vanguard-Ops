import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Release checks should not regress silently when changing workflow path filters.
describe("merge-readiness configuration", () => {
  const root = join(import.meta.dir, "..");
  const read = (path: string) => readFileSync(join(root, path), "utf8");

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
