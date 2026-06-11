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
