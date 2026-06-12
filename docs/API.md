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
    opencvJsUrl: "/scansavy-relocalization-runtime/scansavy-opencv-geometry.js"
  }
});
```

Returns:

```json
{
  "status": "ready",
  "provider": "webgpu",
  "hasOpenCvGeometry": true,
  "hasXFeat": true,
  "hasLighterGlue": true
}
```

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
