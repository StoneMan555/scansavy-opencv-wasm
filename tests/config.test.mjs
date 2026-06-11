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

test("Build script keeps module list lean", () => {
  const script = readFileSync(join(root, "scripts", "build-opencv-js.sh"), "utf8");
  assert.match(script, /BUILD_LIST=core,imgproc,features2d,calib3d,video,js/);
  assert.doesNotMatch(script, /BUILD_LIST=.*dnn/);
  assert.doesNotMatch(script, /BUILD_LIST=.*objdetect/);
});

test("MapPack sidecar converter is explicit about transitional descriptor mode", () => {
  const script = readFileSync(join(root, "scripts", "convert-browser-feature-map.mjs"), "utf8");
  assert.match(script, /compact-brief-v1/);
  assert.match(script, /scansavy\.opencv-wasm\.mappack-sidecar\.v0/);
});
