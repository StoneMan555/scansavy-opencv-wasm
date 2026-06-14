import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
const artifactDownload = join(root, ".build", "artifact-download");

const copies = [
  ["src/web/scansavy-relocalization-runtime-worker.js", "scansavy-relocalization-runtime-worker.js", true],
  ["src/web/scansavy-relocalization-worker.js", "scansavy-relocalization-worker.js", true],
  ["src/web/scansavy-opencv.d.ts", "scansavy-opencv.d.ts", true],
  [".build/artifact-download/scansavy-opencv.js", "scansavy-opencv.js", false],
  [".build/artifact-download/scansavy-opencv.wasm", "scansavy-opencv.wasm", false],
  [".build/artifact-download/scansavy-opencv-loader.js", "scansavy-opencv-loader.js", false],
  [".build/artifact-download/scansavy-opencv-geometry.js", "scansavy-opencv-geometry.js", false],
  [".build/artifact-download/scansavy-opencv-geometry.wasm", "scansavy-opencv-geometry.wasm", false],
];

mkdirSync(dist, { recursive: true });

const staged = [];
const missingOptional = [];

for (const [fromRelative, toRelative, required] of copies) {
  const from = join(root, fromRelative);
  const to = join(dist, toRelative);
  if (!existsSync(from)) {
    if (existsSync(to)) {
      staged.push({ path: toRelative, bytes: statSync(to).size, source: "existing-dist" });
      continue;
    }
    if (required) {
      throw new Error(`Missing required runtime asset: ${fromRelative}`);
    }
    missingOptional.push(fromRelative);
    continue;
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  rmSync(`${to}.br`, { force: true });
  rmSync(`${to}.gz`, { force: true });
  staged.push({ path: toRelative, bytes: statSync(to).size });
}

const ortSidecars = [
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jspi.mjs",
  "ort-wasm-simd-threaded.jspi.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
];

for (const name of ortSidecars) {
  const from = join(dist, "ort", name);
  const to = join(dist, name);
  if (!existsSync(from)) continue;
  copyFileSync(from, to);
  rmSync(`${to}.br`, { force: true });
  rmSync(`${to}.gz`, { force: true });
  staged.push({ path: name, bytes: statSync(to).size, source: "ort-root-compat" });
}

console.log(JSON.stringify({
  status: "ready",
  artifactDownload: existsSync(artifactDownload),
  staged,
  missingOptional,
}, null, 2));
