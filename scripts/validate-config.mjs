import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const config = readFileSync(join(root, "config", "scansavy_opencv_js.config.py"), "utf8");

const required = [
  "core",
  "imgproc",
  "features2d",
  "video",
  "calib3d",
  "ORB",
  "AKAZE",
  "BFMatcher",
  "calcOpticalFlowPyrLK",
  "solvePnPRansac",
  "solvePnPRefineLM",
  "projectPoints",
  "BUILD_LIST=core,imgproc,features2d,calib3d,video",
];

const buildScript = readFileSync(join(root, "scripts", "build-opencv-js.sh"), "utf8");

for (const token of required) {
  const haystack = token.startsWith("BUILD_LIST") ? buildScript : config;
  assert.ok(haystack.includes(token), `Missing required token: ${token}`);
}

console.log("ScanSavvy OpenCV WASM config validation passed.");
