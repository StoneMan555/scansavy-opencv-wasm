import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test("OpenCV.js config exports ScanSavvy relocalization primitives", () => {
  const config = readFileSync(join(root, "config", "scansavy_opencv_js.config.py"), "utf8");
  for (const token of ["features2d", "video", "calib3d", "ORB", "AKAZE", "BFMatcher", "solvePnPRansac", "solvePnPRefineLM", "projectPoints"]) {
    assert.match(config, new RegExp(token));
  }
});

test("Geometry-only OpenCV.js config keeps only camera geometry primitives", () => {
  const config = readFileSync(join(root, "config", "scansavy_opencv_geometry_js.config.py"), "utf8");
  for (const token of ["core", "calib3d", "Rodrigues", "solvePnPRansac", "solvePnPRefineLM", "projectPoints"]) {
    assert.match(config, new RegExp(token));
  }
  for (const token of ["features2d", "video", "ORB", "AKAZE", "BFMatcher", "calcOpticalFlowPyrLK"]) {
    assert.doesNotMatch(config, new RegExp(token));
  }
});

test("Build script keeps module list lean", () => {
  const script = readFileSync(join(root, "scripts", "build-opencv-js.sh"), "utf8");
  assert.match(script, /BUILD_LIST="core,imgproc,features2d,calib3d,video,js"/);
  assert.match(script, /BUILD_LIST="core,calib3d,js"/);
  assert.match(script, /BUILD_TARGET/);
  assert.doesNotMatch(script, /BUILD_LIST=.*dnn/);
  assert.doesNotMatch(script, /BUILD_LIST=.*objdetect/);
});

test("MapPack sidecar converter is explicit about transitional descriptor mode", () => {
  const script = readFileSync(join(root, "scripts", "convert-browser-feature-map.mjs"), "utf8");
  assert.match(script, /compact-brief-v1/);
  assert.match(script, /scansavy\.opencv-wasm\.mappack-sidecar\.v0/);
});

test("Runtime asset config locks XFeat, LighterGlue, and ONNX Runtime assets", () => {
  const config = JSON.parse(readFileSync(join(root, "config", "runtime-assets.json"), "utf8"));
  assert.equal(config.packageName, "scansavy-browser-relocalization-runtime");
  assert.equal(config.canonicalExport.opset, 17);
  assert.equal(config.canonicalExport.topK, 2048);
  assert.equal(config.canonicalExport.dynamicImageDimensions, true);
  assert.ok(config.models.some((model) => model.id === "xfeat-2048-dynamic" && model.path.endsWith(".onnx")));
  assert.ok(config.models.some((model) => model.id === "lighterglue-l3" && model.source.includes("noahzhy")));
  assert.ok(config.onnxRuntime.assets.some((asset) => asset.path === "ort/ort.wasm.min.js"));
  assert.ok(config.onnxRuntime.assets.some((asset) => asset.path === "ort/ort.webgpu.min.js"));
});

test("High-quality runtime worker exposes XFeat/LighterGlue and projection messages", () => {
  const worker = readFileSync(join(root, "src", "web", "scansavy-relocalization-runtime-worker.js"), "utf8");
  for (const token of ["init", "loadMapPack", "localizeBurst", "projectAnchors", "xfeat-lg-v0", "solvePnPRansac", "lighterGlueScoreThreshold"]) {
    assert.match(worker, new RegExp(token));
  }
});
