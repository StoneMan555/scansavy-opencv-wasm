# Build Notes

## Default Build

Use the Windows wrapper from this repo root:

```powershell
.\scripts\build-opencv-js.ps1
```

The wrapper runs:

```text
emscripten/emsdk:3.1.64
OpenCV 4.13.0
BUILD_LIST=core,imgproc,features2d,calib3d,video,js
BUILD_FLAVOR=simd
BUILD_TARGET=full
```

SIMD is the default because it improves mobile Chrome performance without requiring cross-origin isolation. Threaded builds are available, but they require COOP/COEP headers and are less convenient for Cloudflare tunnel phone tests.

## Build Flavors

```powershell
.\scripts\build-opencv-js.ps1 -BuildFlavor basic
.\scripts\build-opencv-js.ps1 -BuildFlavor simd
.\scripts\build-opencv-js.ps1 -BuildFlavor threads
.\scripts\build-opencv-js.ps1 -BuildFlavor simd-threads
```

Use `simd` for current ScanSavvy phone testing. Use `simd-threads` only after the app serves cross-origin isolation headers.

## Why Not Stock opencv-mobile WebAssembly?

The stock `opencv-mobile-4.13.0-webassembly.zip` contains static WebAssembly libraries for C/C++ consumers. It does not ship a browser `opencv.js` bundle, and the package omits `opencv_calib3d`. ScanSavvy needs `calib3d` for `solvePnPRansac`, `solvePnPRefineLM`, and `projectPoints`.

This repo keeps the opencv-mobile idea: small module set, small exported API surface, version-pinned reproducibility.

## Geometry-Only Build

The high-quality XFeat + LighterGlue lane does not need OpenCV feature extraction. Build the smaller geometry target with:

```powershell
.\scripts\build-opencv-js.ps1 -BuildTarget geometry
```

or:

```bash
BUILD_TARGET=geometry ./scripts/build-opencv-js.sh
```

This emits:

```text
dist/scansavy-opencv-geometry.js
dist/scansavy-opencv-geometry.wasm
```

The geometry target keeps `core,calib3d,js` and the exported API required for `Rodrigues`, `solvePnPRansac`, `solvePnPRefineLM`, and `projectPoints`. It intentionally excludes `features2d`, `video`, `ORB`, `AKAZE`, `BFMatcher`, and `calcOpticalFlowPyrLK`.

## Learned Matcher Assets

Stage browser model/runtime assets with:

```powershell
npm run package:runtime
```

The command downloads the locked XFeat/LighterGlue ONNX assets, downloads ONNX Runtime WebGPU/WASM assets, stages worker files and any already-built OpenCV artifacts, writes `.gz` and `.br` siblings, and refreshes `dist/manifest.json`.

Generated `.onnx`, `.wasm`, `.gz`, and `.br` files are ignored by git. The repo stores only source, scripts, docs, and reproducible asset URLs.

## Canonical XFeat/LighterGlue Export

The fast package path uses a prebuilt Apache-2.0 sparse XFeat ONNX export plus the `noahzhy/xfeat_lightglue_onnx` L3 matcher. To regenerate the matched pair from the noahzhy export path, run:

```powershell
.\scripts\export-xfeat-lighterglue-onnx.ps1 -InstallDeps
npm run compress
npm run manifest
```

The wrapper pins the upstream repo to `155f5e1b6c9453162c286eacb0003fa4b8461a9c`, uses opset 17, `top_k=2048`, `dynamic=True`, and copies `xfeat.onnx` to `dist/models/xfeat_2048_dynamic.onnx`.

## Cellular Delivery

Serve generated assets individually rather than zipping the runtime. Static hosts should prefer Brotli, fall back to gzip, and keep hashed runtime assets immutable:

```text
Content-Encoding: br
Cache-Control: public, max-age=31536000, immutable
```

Do not apply immutable caching to `manifest.json`; clients should be able to discover newer package versions.
