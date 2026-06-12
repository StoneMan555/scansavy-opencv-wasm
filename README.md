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
