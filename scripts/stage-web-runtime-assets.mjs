import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
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
  staged.push({ path: toRelative, bytes: statSync(to).size });
}

console.log(JSON.stringify({
  status: "ready",
  artifactDownload: existsSync(artifactDownload),
  staged,
  missingOptional,
}, null, 2));
