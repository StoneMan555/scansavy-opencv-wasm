# Runtime API

This repo exposes two workers:

- `scansavy-relocalization-worker.js`: compact/OpenCV fallback.
- `scansavy-relocalization-runtime-worker.js`: high-quality XFeat + LighterGlue + OpenCV geometry runtime.

The high-quality worker is the target for phone WebXR relocalization.

## `init`

```js
worker.postMessage({
  id: "init-1",
  type: "init",
  payload: {
    manifestUrl: "/scansavy-relocalization-runtime/manifest.json",
    providers: ["webgpu", "wasm"],
    xfeatUrl: "/scansavy-relocalization-runtime/models/xfeat_2048_dynamic.onnx",
    lighterGlueUrl: "/scansavy-relocalization-runtime/models/lighterglue_L3.onnx",
    opencvJsUrl: "/scansavy-relocalization-runtime/scansavy-opencv-geometry.js",
    runtimeProfile: "phone-webgpu",
    webgpuPowerPreference: "high-performance",
    webgpuPreferredLayout: "NCHW"
  }
});
```

Returns:

```json
{
  "status": "ready",
  "provider": "webgpu",
  "runtimeDiagnostics": {
    "runtimeProfile": "phone-webgpu",
    "crossOriginIsolated": true,
    "hasSharedArrayBuffer": true,
    "hasWebGpu": true,
    "webgpuPowerPreference": "high-performance",
    "webgpuPreferredLayout": "NCHW",
    "webgpuGraphCapture": false,
    "wasm": { "numThreads": 4 }
  },
  "hasOpenCvGeometry": true,
  "hasXFeat": true,
  "hasLighterGlue": true
}
```

Supported profiles:

- `phone-webgpu`: default physical Android Chrome profile. Attempts ONNX Runtime `webgpu`, then `wasm`, and keeps keyframe matching inside the depth-backed sidecar budget.
- `phone-wasm`: physical phone fallback. Forces ONNX Runtime `wasm`, with threaded WASM when cross-origin isolation allows it.
- `emulator-safe`: S23+-shaped emulator QA profile. It tries WebGPU first, then falls back to the 6-thread ORT WASM lane with bounded startup budgets and provider-attempt diagnostics.
- `wasm-fast`: experimental WASM speed profile. Uses fewer query/keyframe features and one candidate first.

`webgpuGraphCapture` is intentionally off in the default profile. Turn it on only for a fixed-shape phone profile after confirming the model input size and output readback path stay stable on the target device.

## `loadMapPack`

```js
worker.postMessage({
  id: "map-1",
  type: "loadMapPack",
  payload: {
    "sidecar": {
      "schemaVersion": "scansavy.mappack.xfeat-lg.v0",
      "descriptorMode": "xfeat-lg-v0",
      "descriptorDim": 64,
      "descriptorFormat": "float16",
      "cameraModel": { "fx": 259, "fy": 259, "cx": 140, "cy": 259 },
      "keyframes": []
    }
  }
});
```

`sidecarUrl` may be used instead of an inline sidecar. Relative binary asset URLs inside the sidecar resolve against `sidecarUrl`.

## `localizeBurst`

```js
worker.postMessage({
  id: "burst-1",
  type: "localizeBurst",
  payload: {
    frames: [
      { frameIndex: 0, timestampMs: 0, imageData }
    ],
    options: {
      minConfidence: 0.2,
      minInliers: 5,
      minMatches: 8
    }
  }
});
```

Returns a `ready`, `rejected`, or `failed` pose result with confidence, inliers, matches, and `rvec`/`tvec`.

The high-quality worker also returns provider, candidate keyframes, per-frame results, reprojection error, and elapsed stage timing where available.

## `projectAnchors`

```js
worker.postMessage({
  id: "project-1",
  type: "projectAnchors",
  payload: {
    rvec: [0, 0, 0],
    tvec: [0, 0, 1],
    cameraModel: { "fx": 259, "fy": 259, "cx": 140, "cy": 259 },
    anchors: [
      { id: "batch-4", world: { x: 1.2, y: 0.4, z: 3.8 } }
    ]
  }
});
```

Returns projected 2D points for ScanSavvy AR cards.

## Descriptor Modes

`compact-brief-v1` is the bridge mode for current ScanSavvy MapPacks.

`orb-32` and `akaze` are the production target modes. They require an offline MapPack sidecar generated with OpenCV descriptors from the reconstruction keyframes.

`xfeat-lg-v0` is the high-quality browser mode. It requires XFeat descriptors and MapPack 3D landmark sidecars. XFeat + LighterGlue creates correspondences; OpenCV geometry turns those correspondences into a camera pose.
