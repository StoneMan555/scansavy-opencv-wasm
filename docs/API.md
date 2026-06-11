# Runtime API

The worker protocol is deliberately small.

## `init`

```js
worker.postMessage({
  id: "init-1",
  type: "init",
  payload: {
    opencvJsUrl: "/scansavy-opencv/scansavy-opencv.js"
  }
});
```

Returns:

```json
{
  "status": "ready",
  "hasCalib3d": true,
  "hasOrb": true
}
```

## `loadMapPack`

```js
worker.postMessage({
  id: "map-1",
  type: "loadMapPack",
  payload: {
    "sidecar": {
      "schemaVersion": "scansavy.opencv-wasm.mappack-sidecar.v0",
      "descriptorMode": "compact-brief-v1",
      "cameraModel": { "fx": 259, "fy": 259, "cx": 140, "cy": 259 },
      "references": []
    }
  }
});
```

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

## Descriptor Modes

`compact-brief-v1` is the bridge mode for current ScanSavvy MapPacks.

`orb-32` and `akaze` are the production target modes. They require an offline MapPack sidecar generated with OpenCV descriptors from the reconstruction keyframes.

