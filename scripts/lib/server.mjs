// Starts this project's own Astro dev or preview server on a free port, so
// scripts never collide with another server (or another worktree) on 4321.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ASTRO_BIN = fileURLToPath(
  new URL("../../node_modules/astro/bin/astro.mjs", import.meta.url),
);

/** @returns {Promise<number>} a TCP port that was free a moment ago */
export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

/**
 * @param {{ mode?: "dev" | "preview", port?: number, timeoutMs?: number, quiet?: boolean }} [options]
 * @returns {Promise<{ base: string, stop: () => Promise<void> }>}
 */
export async function startServer({
  mode = "dev",
  port,
  timeoutMs = 120_000,
  quiet = true,
} = {}) {
  if (
    mode === "preview" &&
    !existsSync(new URL("../../dist/index.html", import.meta.url))
  ) {
    throw new Error(
      "No dist/ to preview. Run `npm run build` first, or use the dev server.",
    );
  }
  port ??= await freePort();
  const base = `http://127.0.0.1:${port}`;
  // --ignore-lock keeps the server in the foreground (Astro 7 backgrounds it
  // when it detects an agent) and skips the per-project lock file, so several
  // scripts can each run their own server.
  const args = [
    ASTRO_BIN,
    mode,
    "--port",
    String(port),
    "--host",
    "127.0.0.1",
    "--ignore-lock",
  ];
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    detached: true, // own process group, so stop() takes its children too
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", BROWSER: "none" },
  });
  let log = "";
  const collect = (/** @type {Buffer} */ chunk) => {
    log += chunk.toString();
    if (!quiet) process.stderr.write(chunk);
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);

  let exited = false;
  child.on("exit", () => (exited = true));

  const stop = async () => {
    if (exited) return;
    try {
      process.kill(-(child.pid ?? 0), "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        try {
          process.kill(-(child.pid ?? 0), "SIGKILL");
        } catch {}
        resolve(undefined);
      }, 5000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve(undefined);
      });
    });
  };
  const onExit = () => {
    try {
      process.kill(-(child.pid ?? 0), "SIGKILL");
    } catch {}
  };
  process.once("exit", onExit);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited) throw new Error(`astro ${mode} exited early:\n${log}`);
    try {
      const res = await fetch(base + "/");
      if (res.ok) return { base, stop };
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  await stop();
  throw new Error(
    `astro ${mode} did not answer on ${base} within ${timeoutMs / 1000} s:\n${log}`,
  );
}
