import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveGameServerConnection, type GameBrowserLocation } from "../src/lib/game-network";

const browser = (overrides: Partial<GameBrowserLocation> = {}): GameBrowserLocation => ({
  protocol: "http:",
  hostname: "localhost",
  port: "3000",
  search: "",
  ...overrides,
});

describe("LAN and Tailscale multiplayer endpoints", () => {
  for (const [label, hostname, port] of [
    ["localhost", "localhost", "3000"],
    ["LAN IPv4", "192.168.1.30", "3000"],
    ["LAN custom web port", "10.0.0.20", "3001"],
    ["Tailscale IPv4", "100.101.12.34", "3000"],
    ["Tailscale via port 80", "100.120.42.5", ""],
    ["Tailscale MagicDNS", "gaming-pc.example-tailnet.ts.net", "3000"],
    ["local hostname", "gaming-pc.local", "3001"],
    ["dev server public hostname", "example.com", "3000"],
  ] as const) {
    test(label, () => {
      const endpoint = resolveGameServerConnection(browser({ hostname, port }));
      expect(endpoint.socketUrl).toBe(`http://${hostname}:3003`);
      expect(endpoint.socketPath).toBe("/");
      expect(endpoint.probeUrls).toEqual([`http://${hostname}:3003/?EIO=4&transport=polling`]);
    });
  }

  test("sandbox port 81 continues to use the existing gateway", () => {
    const endpoint = resolveGameServerConnection(browser({ port: "81" }));
    expect(endpoint.socketUrl).toBe("/?XTransformPort=3003");
    expect(endpoint.probeUrls[0]).toContain("XTransformPort=3003");
  });

  test("explicit sandbox query overrides a private IP URL", () => {
    const endpoint = resolveGameServerConnection(browser({
      hostname: "192.168.1.20", search: "?XTransformPort=3003",
    }));
    expect(endpoint.socketUrl).toBe("/?XTransformPort=3003");
  });

  test("HTTPS deployments keep proxy routing to avoid mixed content", () => {
    const endpoint = resolveGameServerConnection(browser({
      protocol: "https:", hostname: "pc.tailnet.ts.net", port: "",
    }));
    expect(endpoint.socketUrl).toBe("/?XTransformPort=3003");
    expect(endpoint.probeUrls).toHaveLength(2);
  });

  test("gamePort is configurable", () => {
    const endpoint = resolveGameServerConnection(browser(), 4003);
    expect(endpoint.socketUrl).toBe("http://localhost:4003");
    expect(endpoint.probeUrls[0]).toContain(":4003/");
  });
});

describe("private party hosting instructions", () => {
  const read = (p: string) => readFileSync(join(import.meta.dir, "..", p), "utf8");

  test("one-command LAN launch uses the non-loopback web listener", () => {
    const packageJson = JSON.parse(read("package.json")) as {scripts: Record<string,string>};
    expect(packageJson.scripts.lan).toBe("next dev -H 0.0.0.0 -p 3000");
    const server = read("src/lib/game-server.ts");
    expect(server).toContain("httpServer.listen(port");
    expect(server).toContain("Game server listening on port");
    expect(read("src/instrumentation.ts")).toContain("startGameServer(3003)");
  });

  test("README links private hosting guide with both service ports and a test handshake", () => {
    expect(read("README.md")).toContain("docs/lan-and-tailscale.md");
    expect(read("README.md")).toContain("stable `main` branch");
    const guide = read("docs/lan-and-tailscale.md");
    expect(guide).toContain("git switch main");
    expect(guide).toContain("git pull --ff-only origin main");
    expect(guide).toContain("file:./vanguard-lan.db");
    expect(guide.indexOf("git switch main")).toBeLessThan(guide.indexOf("git switch dev"));
    expect(guide).toContain("separate, backed-up test database");
    for (const fragment of ["bun run db:setup", "bun run lan", "tailscale ip -4", "3000 and 3003", "EIO=4&transport=polling", "New-NetFirewallRule", "do not need `tailscale serve`"]) {
      expect(guide).toContain(fragment);
    }
  });
});
