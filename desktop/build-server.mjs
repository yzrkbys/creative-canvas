import { build } from "esbuild";
import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(here, "..", "server", "src", "index.ts");
const webDist = path.join(here, "..", "web", "dist");
const outDir = path.join(here, "build");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// 1) Bundle the Node server (TS + deps) into one CJS file Electron's Node runs.
await build({
  entryPoints: [serverEntry],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  outfile: path.join(outDir, "server.cjs"),
  // ws's optional native speedups are required lazily inside try/catch.
  external: ["bufferutil", "utf-8-validate"],
  logLevel: "info",
});

// 2) Copy the built web UI so the server can serve it statically.
if (!existsSync(webDist)) {
  console.error(`web build not found at ${webDist} — run "npm -w web run build" first`);
  process.exit(1);
}
cpSync(webDist, path.join(outDir, "web"), { recursive: true });

console.log("desktop/build ready: server.cjs + web/");
