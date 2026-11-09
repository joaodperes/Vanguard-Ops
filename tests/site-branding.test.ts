import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Vanguard Ops site branding", () => {
  test("browser title has no generic FPS suffix or third-party favicon", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('title: "VANGUARD OPS"');
    expect(layout).toContain('icon: "/logo.svg"');
    expect(layout).not.toContain("Browser FPS");
    expect(layout).not.toContain("z-cdn.chatglm.cn");
  });

  test("site and sign-in use the same local SVG", () => {
    const logo = read("public/logo.svg");
    expect(logo).toContain("<svg");
    expect(logo).toContain("Vanguard Ops emblem");
    for (const path of ["src/components/game/SiteNav.tsx", "src/components/screens/Auth.tsx"]) {
      expect(read(path)).toContain('src="/logo.svg"');
    }
  });
});
