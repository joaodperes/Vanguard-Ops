// Next.js instrumentation hook — runs once when the server starts.
// We start the VANGUARD socket.io game server (port 3003) here so it lives
// as long as the Next.js process. The sandbox reaps detached background
// processes, so running it in-process is the robust approach.
//
// CRITICAL BUILD-SAFETY RULES:
//   1. Do NOT use `process.on(...)` at the top level of this file.
//      Turbopack's Edge Runtime static analyzer will flag it as an error
//      ("A Node.js API is used which is not supported in the Edge Runtime"),
//      which can cause deploy platforms to reject the build. All Node-only
//      API usage must be inside a dynamically-imported module.
//
//   2. Do NOT start the game server during `next build`. The `register()`
//      function is called during BOTH build and runtime. During build,
//      NEXT_PHASE = "phase-production-build". Binding to port 3003 during
//      build keeps the event loop alive and prevents the build process from
//      exiting — this was a root cause of "Sorry, there was a problem
//      deploying the code."
//
//   3. Everything Node-specific is deferred to a dynamic import() so the
//      Edge Runtime never sees it in the bundle's static analysis.

function isBuildPhase(): boolean {
  const phase = process.env.NEXT_PHASE
  // Check both the standard phase-production-build and a generic "build" substring.
  // Also check NODE_ENV=production as a fallback (next build sets this).
  if (phase && (phase.includes("build") || phase.includes("production-build"))) {
    return true
  }
  // During `next dev`, NODE_ENV is "development" and NEXT_PHASE is "phase-development-server".
  // Only skip during build, not during dev.
  return false
}

export async function register() {
  // Only run in the Node.js runtime (not Edge).
  // On some platforms/versions, NEXT_RUNTIME may be undefined during `next dev`
  // — but instrumentation only runs in the Node.js runtime anyway, so we
  // proceed if it's "nodejs" OR undefined (to avoid skipping on local dev).
  const runtime = process.env.NEXT_RUNTIME;
  if (runtime && runtime !== "nodejs") {
    return
  }

  // CRITICAL: Do NOT start the game server during `next build`.
  if (isBuildPhase()) {
    return
  }

  // At runtime (next start / next dev), dynamically import the game server
  // module. The dynamic import ensures that all Node-only APIs (process.on,
  // http.createServer, socket.io) are only evaluated in the Node.js runtime
  // and never seen by the Edge Runtime's static analyzer during build.
  try {
    const { startGameServer } = await import("./lib/game-server");
    await startGameServer(3003);
  } catch (err) {
    console.warn(
      "[VANGUARD] Failed to start game server — multiplayer will be unavailable, " +
      "but the web UI and offline play continue to work:",
      err
    );
  }
}
