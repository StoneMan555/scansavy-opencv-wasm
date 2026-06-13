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

Recommended physical-phone init:

```js
worker.postMessage({
  id: "init-phone",
  type: "init",
  payload: {
    options: {
      runtimeProfile: "phone-webgpu",
      providers: ["webgpu", "wasm"],
      wasmNumThreads: "auto"
    }
  }
});
```

Recommended physical-phone NPU probe:

```js
worker.postMessage({
  id: "init-phone-npu-probe",
  type: "init",
  payload: {
    options: {
      runtimeProfile: "phone-webnn-npu"
    }
  }
});
```

Recommended emulator init:

```js
worker.postMessage({
  id: "init-emulator",
  type: "init",
  payload: {
    options: {
      runtimeProfile: "emulator-safe"
    }
  }
});
```

Recommended phone-shaped WASM fallback proof:

```js
worker.postMessage({
  id: "init-phone-wasm-safe",
  type: "init",
  payload: {
    options: {
      runtimeProfile: "phone-wasm-safe"
    }
  }
});
```

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

Use `webgpu` first when Android Chrome supports it, falling back to `wasm`. Use `phone-webnn-npu` as a bounded physical-device probe when testing whether Chrome exposes WebNN/NPU. The worker reports the selected provider and all failed provider attempts in the `init` response so the phone evidence panel can distinguish unsupported APIs from localization failures.

The execution split is deliberate:

```text
XFeat / LighterGlue: ONNX Runtime WebGPU preferred, ONNX Runtime WASM fallback
OpenCV geometry: OpenCV.js WASM for PnP/RANSAC/projection
```

OpenCV does not need to share the WebGPU provider. Its geometry calls are small and deterministic compared with the learned model inference. The important performance requirement is to run the whole relocalization runtime off the React/UI thread and to keep frame transfer costs low with transferable `ImageData` buffers.

## Cross-Origin Isolation

Threaded ONNX Runtime WASM needs `SharedArrayBuffer`, and Android Chrome only exposes it to cross-origin isolated pages. Serve the phone route and runtime assets with:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

When those headers are active, the worker should report:

```text
crossOriginIsolated: true
hasSharedArrayBuffer: true
wasm.numThreads: > 1
```

The Android emulator proof should use `runtimeProfile=phone-wasm-safe` for phone-shaped fallback performance evidence and `runtimeProfile=emulator-safe` when explicitly debugging the emulator WebGPU path. Physical-phone evidence should compare `phone-webgpu-quality`, `phone-webgpu-fast`, and `phone-webnn-npu` against `phone-wasm-safe`.

## Burst Scheduling

Send native-cadence bursts in chronological order and include `burstFrameIndex` for each frame. The worker defaults to `burstFrameOrder: "center-first"`:

```text
5-frame burst chronological order: 0, 1, 2, 3, 4
worker solve order: 2, 1, 3, 0, 4
```

This keeps all five frames available for hard cases while reducing average latency when the middle frame is sharp enough to solve. The worker reports `processedFrameCount` so QA can verify that early exit is actually reducing the number of expensive XFeat/LighterGlue passes.
