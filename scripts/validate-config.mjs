import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const config = readFileSync(join(root, "config", "scansavy_opencv_js.config.py"), "utf8");
const geometryConfig = readFileSync(join(root, "config", "scansavy_opencv_geometry_js.config.py"), "utf8");
const runtimeAssets = JSON.parse(readFileSync(join(root, "config", "runtime-assets.json"), "utf8"));

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
];

const buildScript = readFileSync(join(root, "scripts", "build-opencv-js.sh"), "utf8");

for (const token of required) {
  assert.ok(config.includes(token), `Missing required token: ${token}`);
}

assert.ok(buildScript.includes("core,imgproc,features2d,calib3d,video,js"), "Missing full OpenCV build list.");
assert.ok(buildScript.includes("core,calib3d,js"), "Missing geometry OpenCV build list.");

for (const token of ["core", "calib3d", "Rodrigues", "solvePnPRansac", "solvePnPRefineLM", "projectPoints"]) {
  assert.ok(geometryConfig.includes(token), `Missing geometry token: ${token}`);
}

for (const excluded of ["features2d", "video", "ORB", "AKAZE", "BFMatcher", "calcOpticalFlowPyrLK"]) {
  assert.ok(!geometryConfig.includes(excluded), `Geometry config should not include ${excluded}`);
}

assert.equal(runtimeAssets.packageName, "scansavy-browser-relocalization-runtime");
assert.equal(runtimeAssets.canonicalExport?.opset, 17);
assert.equal(runtimeAssets.canonicalExport?.topK, 2048);
assert.equal(runtimeAssets.canonicalExport?.dynamicImageDimensions, true);
assert.ok(runtimeAssets.models.some((model) => model.id === "xfeat-2048-dynamic"));
assert.ok(runtimeAssets.models.some((model) => model.id === "lighterglue-l3"));
assert.ok(runtimeAssets.onnxRuntime.assets.some((asset) => asset.path.includes("ort-wasm")));

console.log("ScanSavvy OpenCV WASM config validation passed.");
