# ScanSavvy Integration Plan

## Target Runtime

```text
Android Chrome
  getUserMedia / WebXR camera frame source
  WebXR pose tracking
  ScanSavvy OpenCV WASM worker
    feature detection / matching
    solvePnPRansac
    solvePnPRefineLM
    projectPoints
  React projection layer
    ScanSavvy batch cards
```

## App Integration Steps

1. Build this repo and copy `dist/` into the ScanSavvy app under `public/scansavy-opencv/`.
2. Add an OpenCV lane to the existing phone route beside the current browser worker and Python oracle.
3. Load the worker:

```js
const worker = new Worker("/scansavy-opencv/scansavy-relocalization-worker.js");
```

4. Send `init`, then `loadMapPack`.
5. During initial pose discovery, feed a few seconds of camera frames into `localizeBurst`.
6. During live use, send 5-frame native-cadence bursts every cadence window.
7. Use accepted PnP pose to update the WebXR-to-MapPack correction transform.
8. Project ScanSavvy 3D anchors/cards through `projectPoints` or the existing JS projection layer using the accepted camera pose.

## How This Replaces the Tunnel

The Python/OpenCV helper remains useful as a QA oracle. The phone route should prefer this browser WASM worker for normal development:

```text
Primary: browser OpenCV WASM worker
QA oracle: local Python/OpenCV PnP endpoint
Fallback: existing compact JS matcher
```

This keeps raw shopper frames local to the phone and reduces the moving parts required for physical-device testing.

