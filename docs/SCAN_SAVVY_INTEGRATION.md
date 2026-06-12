# ScanSavvy Integration Plan

## Target Runtime

```text
Android Chrome
  getUserMedia / WebXR camera frame source
  WebXR pose tracking
  ScanSavvy browser relocalization runtime worker
    XFeat ONNX feature extraction
    LighterGlue ONNX matching
    OpenCV WASM solvePnPRansac / solvePnPRefineLM / projectPoints
  React projection layer
    ScanSavvy batch cards
```

## App Integration Steps

1. Build this repo and copy `dist/` into the ScanSavvy app under `public/scansavy-relocalization-runtime/`.
2. Add an XFeat + LighterGlue lane to the existing phone route beside the current browser worker and Python oracle.
3. Load the worker:

```js
const worker = new Worker("/scansavy-relocalization-runtime/scansavy-relocalization-runtime-worker.js");
```

4. Send `init`, then `loadMapPack`.
5. During initial pose discovery, feed a few seconds of camera frames into `localizeBurst`.
6. During live use, send 5-frame native-cadence bursts every cadence window.
7. Use accepted PnP pose to update the WebXR-to-MapPack correction transform.
8. Project ScanSavvy 3D anchors/cards through `projectPoints` or the existing JS projection layer using the accepted camera pose.

## How This Replaces the Tunnel

The Python/OpenCV helper remains useful as a QA oracle. The phone route should prefer this browser WASM worker for normal development:

```text
Primary: browser XFeat + LighterGlue + OpenCV geometry worker
QA oracle: local Python/OpenCV PnP endpoint
Fallback: existing compact JS/OpenCV matcher
```

This keeps raw shopper frames local to the phone and reduces the moving parts required for physical-device testing.

## Serving Requirements

The app should serve generated runtime assets with normal static-file URLs, not a single ZIP. Prefer precompressed files:

```text
*.br -> Content-Encoding: br
*.gz -> Content-Encoding: gzip
*.wasm -> Content-Type: application/wasm
*.onnx -> Content-Type: application/octet-stream
Cache-Control: public, max-age=31536000, immutable
```

Do not cache `manifest.json` immutably. The phone route should read it to learn the package version and artifact hashes.

## Provider Policy

Use `webgpu` first when Android Chrome supports it, falling back to `wasm`. The worker reports the selected provider and all failed provider attempts in the `init` response so the phone evidence panel can distinguish unsupported APIs from localization failures.
