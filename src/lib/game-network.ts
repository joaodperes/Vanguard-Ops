// All multiplayer entry points use this resolver so the room browser, game
// engine and health check agree on the host of the Socket.IO server.
export interface GameBrowserLocation {
  protocol: string;
  hostname: string;
  port: string;
  search: string;
}

export interface GameServerEndpoint {
  socketUrl: string;
  socketPath: string;
  probeUrls: string[];
}

function isLocalNetworkHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "[::1]" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".ts.net")
  ) return true;

  const octets = host.split(".");
  if (octets.length !== 4 || octets.some((part) => !/^\d+$/.test(part))) return false;
  const [a, b, c, d] = octets.map(Number);
  if ([a, b, c, d].some((n) => n < 0 || n > 255)) return false;

  return a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127); // Tailscale CGNAT range
}

export function resolveGameServerConnection(
  location: GameBrowserLocation,
  gamePort = 3003,
): GameServerEndpoint {
  // Port 81 and XTransformPort are specific to the existing sandbox gateway.
  // Always preserve the proxy in that environment.
  const sandboxProxy = location.port === "81" ||
    new URLSearchParams(location.search).has("XTransformPort");

  // Clients visiting the dev app at http://HOST:3000 (including over
  // Tailscale) must use HOST:3003, not localhost or the sandbox proxy.
  // LAN / MagicDNS hosts also support a custom frontend port.
  const direct = !sandboxProxy && location.protocol === "http:" &&
    (location.port === "3000" || isLocalNetworkHost(location.hostname));

  if (direct) {
    const socketUrl = `http://${location.hostname}:${gamePort}`;
    return {
      socketUrl,
      socketPath: "/",
      probeUrls: [`${socketUrl}/?EIO=4&transport=polling`],
    };
  }

  // Deployed/sandbox builds retain the original gateway routing.
  return {
    socketUrl: `/?XTransformPort=${gamePort}`,
    socketPath: "/",
    probeUrls: [
      `/?XTransformPort=${gamePort}&EIO=4&transport=polling`,
      "/socket.io/?EIO=4&transport=polling",
    ],
  };
}
