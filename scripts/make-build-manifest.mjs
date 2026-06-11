import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, "dist");
const upstreams = JSON.parse(readFileSync(join(root, "config", "upstreams.json"), "utf8"));
const files = ["scansavy-opencv.js", "scansavy-opencv.wasm", "scansavy-opencv-loader.js", "scansavy-relocalization-worker.js", "scansavy-opencv.d.ts"];

function digest(path) {
  const data = readFileSync(path);
  return createHash("sha256").update(data).digest("hex");
}

const manifest = {
  schemaVersion: "scansavy.opencv-wasm.manifest.v0",
  createdAt: new Date().toISOString(),
  upstreams,
  files: files.filter((file) => existsSync(join(distDir, file))).map((file) => {
    const path = join(distDir, file);
    return {
      name: basename(path),
      bytes: statSync(path).size,
      sha256: digest(path),
    };
  }),
  requiredExports: [
    "ORB.create",
    "AKAZE.create",
    "BFMatcher.create",
    "calcOpticalFlowPyrLK",
    "solvePnPRansac",
    "solvePnPRefineLM",
    "projectPoints",
  ],
};

writeFileSync(join(distDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${join(distDir, "manifest.json")}`);
