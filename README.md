# ScanSavvy Browser Relocalization Runtime

Lean browser-side relocalization runtime for ScanSavvy Walkable UX shopper relocalization.

This repo packages the browser runtime pieces ScanSavvy needs for phone-local visual positioning:

- XFeat ONNX for learned keypoints and compact 64D descriptors
- LighterGlue ONNX for cleaner learned correspondences
- OpenCV.js/WebAssembly geometry for `solvePnPRansac`, `solvePnPRefineLM`, and `projectPoints`
- an ORB/AKAZE OpenCV fallback bundle for low-dependency route checks

The goal is to replace the dev-only Python/OpenCV tunnel with a phone-local Web Worker that can run inside Android Chrome alongside WebXR and `getUserMedia`.

## Why This Exists

`nihui/opencv-mobile` is excellent as a lean-build reference, but its stock WebAssembly package intentionally excludes `opencv_calib3d` and `opencv_js`. ScanSavvy needs `calib3d` for PnP/RANSAC, so this repo follows the opencv-mobile minimal-build philosophy while using OpenCV's JS build system and ScanSavvy-specific whitelists.

XFeat + LighterGlue is the high-quality lane. OpenCV still owns camera geometry because learned matchers produce correspondences, not a metric camera pose.

## Runtime Architecture

The fast path intentionally uses two execution systems in one worker:

- XFeat and LighterGlue run through ONNX Runtime Web. The preferred provider is `webgpu` on physical Android Chrome, with `webnn` available as a physical-device NPU probe and `wasm` as the reliable fallback.
- OpenCV geometry runs through OpenCV.js/WebAssembly. This layer is for `solvePnPRansac`, `solvePnPRefineLM`, `Rodrigues`, and `projectPoints`; it does not need WebGPU.

That split is expected. WebGPU accelerates the learned feature and matching networks, while the smaller OpenCV geometry solve stays in WASM. If WebGPU is unavailable, the same worker falls back to ONNX Runtime WASM for XFeat/LighterGlue and still uses OpenCV WASM for geometry.

For best phone performance, serve the runtime with cross-origin isolation headers so ONNX Runtime WASM can use `SharedArrayBuffer` and multiple threads when it falls back from WebGPU:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

Static export hosts must add those headers outside Next.js. The ScanSavvy dev static server and tunnel harness do this explicitly.

## Runtime Profiles

`config/runtime-assets.json` declares the supported runtime profiles, and `scansavy-relocalization-runtime-worker.js` applies them when the app passes `runtimeProfile`:

| Profile | Use | Providers | WASM threads |
| --- | --- | --- | --- |
| `phone-webgpu` | Default physical Android Chrome test, tuned to the Samsung S23+ baseline | `webgpu`, then `wasm` | `6` when cross-origin isolated |
| `phone-webnn-npu` | Physical Android Chrome NPU probe for S23+-class phones | `webnn`, then `webgpu`, then `wasm` | `6` when it falls back to WASM |
| `phone-webgpu-fast` | Physical phone speed lane | `webgpu`, then `wasm` | `6` when it falls back to WASM |
| `phone-webgpu-quality` | Physical phone quality lane | `webgpu`, then `wasm` | `6` when it falls back to WASM |
| `phone-wasm-safe` | Physical phone fallback when WebGPU/WebNN are disabled or unstable | `wasm` | `6` when cross-origin isolated |
| `emulator-safe` | Android emulator route QA that mirrors the S23+ phone baseline on the RTX workstation | `webgpu`, then `wasm` | `6` when cross-origin isolated and exposed by the AVD |
| `emulator-webnn-gpu` | Android emulator WebNN acceleration probe under Chrome WebNN flags | `webnn`, then `webgpu`, then `wasm` | `6` when it falls back to WASM |
| `emulator-conservative` | Legacy emulator fallback for debugging browser/GPU instability only | `wasm` | `1` |
| `wasm-fast` | Experimental speed profile for WASM-only browser runs | `wasm` | up to `6` when cross-origin isolated |

`emulator-safe` intentionally mirrors the S23+ phone baseline so emulator runs return phone-shaped runtime evidence. It still has bounded WebGPU startup budgets (8s preflight, 45s session creation) so a broken emulator GPU path falls back to the same multi-thread WASM baseline with provider-attempt diagnostics instead of hanging. If the emulator/browser GPU path itself is being debugged, switch explicitly to `emulator-conservative`; do not use that conservative profile for performance comparisons.

`phone-webnn-npu` is intentionally a physical-device probe. Android emulators may expose `navigator.gpu` without a usable adapter and generally do not expose `navigator.ml.createContext`; in that case the worker records the failed provider attempts and falls back to the same WASM lane. `emulator-webnn-gpu` exists only to test whether an emulator Chrome build exposes WebNN when started with WebNN feature flags. Treat a fallback result as useful evidence, not a failure of the relocalizer.

The WebGPU preflight now sweeps adapter request variants and reports the exact failure point. Phone profiles try the normal high-performance core adapter first. Emulator profiles also try compatibility-level and fallback adapter requests so ScanSavvy can distinguish "Chrome exposes `navigator.gpu`" from "Chrome can actually return a usable adapter for ONNX Runtime WebGPU." The WebNN probe can optionally request a WebNN context through a WebGPU device for diagnosing future WebNN/WebGPU interop.

The runtime also uses a center-first burst schedule by default. For a 5-frame relocalization burst it tries the middle frame first, then expands outward only when more evidence is needed. This keeps the native-cadence burst available for recovery without paying the XFeat/LighterGlue cost for every frame when the first representative frame already solves.

Performance policy follows the current browser-localization architecture:

- XFeat is the fast, hardware-agnostic feature extractor.
- LighterGlue is the learned matcher and should see bounded keypoint sets so adaptive matching stays cheap.
- OpenCV WASM is kept as the geometry layer only: `solvePnPRansac`, `solvePnPRefineLM`, and projection.
- MapPack sidecars should depth-back as many learned keypoints as possible offline. The default ScanSavvy profile compares against 384 keyframe features because the LongStream depth-projected sidecar stores 384 geometry-backed rows per keyframe; extra visual-only rows cost matcher time without helping PnP.
- Physical-phone WebGPU uses `powerPreference: "high-performance"` and ONNX Runtime WebGPU's NCHW-preferred layout. The fixed-shape phone profiles enable graph-capture-compatible model slots, while dynamic debug exports remain available for QA. Validate WebGPU/WebNN timing on the target phone before promoting it over the WASM-safe lane.
- The default emulator profile is no longer deliberately weak: `emulator-safe` uses the S23+ phone-shaped lane. Only `emulator-conservative` keeps the old single-thread WASM route/backend fallback.

## Outputs

The generated package produces:

```text
dist/
  models/
    xfeat_2048_dynamic.onnx
    lighterglue_L3.onnx
  ort/
    ort.webgpu.min.js
    ort.wasm.min.js
    *.wasm
  scansavy-opencv.js
  scansavy-opencv.wasm
  scansavy-opencv-geometry.js      # after -BuildTarget geometry
  scansavy-opencv-geometry.wasm    # after -BuildTarget geometry
  scansavy-opencv-loader.js
  scansavy-relocalization-worker.js
  scansavy-relocalization-runtime-worker.js
  scansavy-opencv.d.ts
  manifest.json
  *.br / *.gz
```

The ScanSavvy app should treat this as a versioned runtime artifact, not as source code copied into the app by hand.

## Development Tracks

1. `compact-brief-v1`: compatible with the current browser feature MapPack. Matching stays aligned with the existing compact descriptor contract, while PnP/RANSAC moves into OpenCV.js.
2. `orb-32`: target production mode. Offline MapPack generation emits OpenCV ORB/AKAZE descriptors for stable phone-side matching and OpenCV solves the entire relocalization burst.
3. `xfeat-lg-v0`: high-quality mode. Offline MapPack generation emits XFeat keypoints/descriptors tied to 3D landmarks; the browser runs XFeat + LighterGlue and OpenCV geometry.

## Quick Start

Validate the repo scaffold:

```powershell
npm test
```

Stage the learned matcher, ONNX Runtime assets, worker files, and any already-built OpenCV artifacts:

```powershell
npm run package:runtime
```

Regenerate the canonical XFeat/LighterGlue ONNX pair from `noahzhy/xfeat_lightglue_onnx` when you want to replace the prebuilt fallback asset:

```powershell
.\scripts\export-xfeat-lighterglue-onnx.ps1 -InstallDeps
npm run compress
npm run manifest
```

Convert the current house MapPack into the transitional OpenCV sidecar:

```powershell
node scripts\convert-browser-feature-map.mjs `
  "C:\Users\stone\Documents\Desktop\ScanSavvy Prototype\scansavy-walkable-ux\public\walkable-artifacts\spaces\house-2026-05-28\mappack-shopper-replay-demo-parity\mappack-browser-feature-map.json" `
  "$env:TEMP\house-2026-05-28-compact-brief-sidecar.json"
```

Build the WebAssembly runtime with Docker:

```powershell
.\scripts\build-opencv-js.ps1
.\scripts\build-opencv-js.ps1 -BuildTarget geometry
```

Or from a shell with Emscripten active:

```bash
./scripts/build-opencv-js.sh
BUILD_TARGET=geometry ./scripts/build-opencv-js.sh
```

## Integration

See [docs/SCAN_SAVVY_INTEGRATION.md](docs/SCAN_SAVVY_INTEGRATION.md).
