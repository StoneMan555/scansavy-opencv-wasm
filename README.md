# ScanSavvy OpenCV WASM

Lean browser-side OpenCV runtime for ScanSavvy Walkable UX shopper relocalization.

This repo builds a small OpenCV.js/WebAssembly bundle with the modules ScanSavvy needs for phone-local visual positioning:

- feature detection and binary matching
- optical flow for short-window tracking
- 3D-to-2D `solvePnPRansac` pose recovery
- pose refinement with `solvePnPRefineLM`
- `projectPoints` for AR card projection

The goal is to replace the dev-only Python/OpenCV tunnel with a phone-local Web Worker that can run inside Android Chrome alongside WebXR and `getUserMedia`.

## Why This Exists

`nihui/opencv-mobile` is excellent as a lean-build reference, but its stock WebAssembly package intentionally excludes `opencv_calib3d` and `opencv_js`. ScanSavvy needs `calib3d` for PnP/RANSAC, so this repo follows the opencv-mobile minimal-build philosophy while using OpenCV's JS build system and a ScanSavvy-specific whitelist.

## Outputs

The build produces:

```text
dist/
  scansavy-opencv.js
  scansavy-opencv.wasm
  scansavy-opencv-loader.js
  scansavy-relocalization-worker.js
  scansavy-opencv.d.ts
  manifest.json
```

The ScanSavvy app should treat this as a versioned runtime artifact, not as source code copied into the app by hand.

## Development Tracks

1. `compact-brief-v1`: compatible with the current browser feature MapPack. Matching stays aligned with the existing compact descriptor contract, while PnP/RANSAC moves into OpenCV.js.
2. `orb-32`: target production mode. Offline MapPack generation emits OpenCV ORB/AKAZE descriptors for stable phone-side matching and OpenCV solves the entire relocalization burst.

## Quick Start

Validate the repo scaffold:

```powershell
npm test
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
```

Or from a shell with Emscripten active:

```bash
./scripts/build-opencv-js.sh
```

## Integration

See [docs/SCAN_SAVVY_INTEGRATION.md](docs/SCAN_SAVVY_INTEGRATION.md).
