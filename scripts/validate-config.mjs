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
assert.ok(runtimeAssets.models.some((model) => model.id === "xfeat-384-fixed" && model.optional === true));
assert.ok(runtimeAssets.models.some((model) => model.id === "xfeat-512-fixed" && model.optional === true));
assert.ok(runtimeAssets.models.some((model) => model.id === "lighterglue-l3"));
assert.ok(runtimeAssets.models.some((model) => model.id === "xfeat-lighterglue-pair-l3-384-640" && model.optional === true));
assert.ok(runtimeAssets.onnxRuntime.assets.some((asset) => asset.path.includes("ort-wasm")));
assert.ok(runtimeAssets.onnxRuntime.assets.some((asset) => asset.path === "ort/ort.all.min.js"));
assert.deepEqual(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-webgpu"]?.providers, ["webgpu", "wasm"]);
assert.deepEqual(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-webnn-npu"]?.providers, ["webnn", "webgpu", "wasm"]);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-webnn-npu"]?.webnnDeviceType, "npu");
assert.deepEqual(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-s23-plus-max"]?.providers, ["webnn", "webgpu", "wasm"]);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-s23-plus-max"]?.webnnDeviceType, "npu");
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-s23-plus-max"]?.wasmNumThreads, 8);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-s23-plus-max"]?.webgpuWasmNumThreads, 8);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-s23-plus-max"]?.candidateHydrationConcurrency, 8);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-s23-plus-max"]?.parallelBurstExtraction, false);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-s23-plus-max"]?.burstFrameExtractionConcurrency, 4);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-webgpu-quality"]?.parallelBurstExtraction, true);
assert.deepEqual(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-webgpu-fast"]?.providers, ["webgpu", "wasm"]);
assert.deepEqual(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-webgpu-quality"]?.providers, ["webgpu", "wasm"]);
assert.deepEqual(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-wasm"]?.providers, ["wasm"]);
assert.deepEqual(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-wasm-safe"]?.providers, ["wasm"]);
assert.deepEqual(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.providers, ["webgpu", "wasm"]);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.deviceBaseline, "samsung-s23-plus");
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.wasmNumThreads, 8);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.webgpuWasmNumThreads, 8);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.webgpuBurstFrameConcurrency, 4);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.webgpuCandidateHydrationConcurrency, 8);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.candidateHydrationConcurrency, 8);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.maxHydratedKeyframes, 200);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.prefetchNeighborKeyframes, 200);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.keyframeTensorCacheMaxEntries, 200);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.localNeighborhoodHotRadiusMeters, 8);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.localNeighborhoodWarmRadiusMeters, 20);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.parallelBurstExtraction, false);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.candidateLimit, 2);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.webgpuPreflightTimeoutMs, 8000);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.webgpuSessionCreateTimeoutMs, 45000);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-safe"]?.webgpuUsePreflightDevice, false);
assert.deepEqual(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-conservative"]?.providers, ["wasm"]);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["emulator-conservative"]?.wasmNumThreads, 1);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-webgpu-fast"]?.candidateLimit, 1);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-webgpu-quality"]?.candidateLimit, 2);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-webgpu-fast"]?.webgpuUsePreflightDevice, false);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-webgpu-quality"]?.webgpuUsePreflightDevice, false);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-webgpu-fast"]?.webgpuWasmNumThreads, 8);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-webgpu-quality"]?.webgpuWasmNumThreads, 8);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-webgpu-fast"]?.fallbackXFeatUrl, "/scansavy-relocalization-runtime/models/xfeat_2048_dynamic.onnx");
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-wasm"]?.maxQueryFeatures, 384);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-wasm"]?.maxKeyframeFeatures, 384);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-wasm-safe"]?.candidateLimit, 2);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["phone-wasm-safe"]?.maxLighterGluePairsPerBurst, 2);
assert.equal(runtimeAssets.onnxRuntime.runtimeProfiles?.["wasm-fast"]?.candidateLimit, 1);

console.log("ScanSavvy OpenCV WASM config validation passed.");
