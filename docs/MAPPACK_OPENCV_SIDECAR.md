# MapPack OpenCV Sidecar

The current ScanSavvy browser feature map uses compact 4-byte BRIEF-like descriptors. That was valuable for fast experiments, but production relocalization should use OpenCV-generated descriptors with a full 2D-to-3D landmark sidecar.

## Transitional Sidecar

Generate a bridge sidecar from the current app artifact:

```powershell
node scripts/convert-browser-feature-map.mjs `
  "C:\Users\stone\Documents\Desktop\ScanSavvy Prototype\scansavy-walkable-ux\public\walkable-artifacts\spaces\house-2026-05-28\mappack-shopper-replay-demo-parity\mappack-browser-feature-map.json" `
  ".\dist\house-2026-05-28-compact-brief-sidecar.json"
```

This gives the phone worker a compatible reference set immediately, but it is not the final production representation.

## Production Sidecar

The production sidecar should be generated from reconstruction keyframes and LongStream/MapPack global tracks:

```json
{
  "schemaVersion": "scansavy.opencv-wasm.mappack-sidecar.v0",
  "descriptorMode": "orb-32",
  "cameraModel": { "fx": 0, "fy": 0, "cx": 0, "cy": 0 },
  "references": [
    {
      "id": "track-123",
      "descriptorMode": "orb-32",
      "descriptorHex": "32-byte ORB descriptor as hex",
      "image": { "x": 120.5, "y": 210.2, "frameIndex": 144 },
      "world": { "x": 1.2, "y": 0.4, "z": 3.8 },
      "quality": {
        "score": 31.1,
        "supportFrameCount": 9,
        "residualMeters": 0.03
      }
    }
  ]
}
```

Recommended acceptance fields for production:

- descriptor family and extractor settings
- camera intrinsics used for the keyframe
- global track id
- track support count
- triangulation/depth residual
- scene-cell or spatial bucket id
- optional vocabulary/BoW cluster for fast lookup

## XFeat + LighterGlue Sidecar

The high-quality browser runtime uses a separate sidecar so it does not confuse ORB/AKAZE binary descriptors with learned XFeat descriptors:

```json
{
  "schemaVersion": "scansavy.mappack.xfeat-lg.v0",
  "descriptorMode": "xfeat-lg-v0",
  "descriptorDim": 64,
  "descriptorFormat": "float16",
  "cameraModel": { "fx": 0, "fy": 0, "cx": 0, "cy": 0, "width": 0, "height": 0 },
  "keyframes": [
    {
      "id": "kf-000144",
      "width": 640,
      "height": 360,
      "assets": {
        "keypoints": "xfeat/kf-000144.keypoints.f32",
        "descriptors": "xfeat/kf-000144.descriptors.f16",
        "scores": "xfeat/kf-000144.scores.f32",
        "landmarks": "xfeat/kf-000144.landmarks.f32",
        "landmarkIds": "xfeat/kf-000144.landmark-ids.json"
      }
    }
  ]
}
```

Binary payload conventions:

- `keypoints`: `Float32Array`, `[x, y]` pairs in keyframe pixel coordinates.
- `descriptors`: `Float16Array` on disk when possible, expanded to float32 before ONNX Runtime input.
- `scores`: optional `Float32Array`, one confidence per keypoint.
- `landmarks`: `Float32Array`, `[x, y, z]` MapPack coordinates aligned by index with descriptors.
- `landmarkIds`: optional JSON array aligned by index.

The sidecar may inline arrays for smoke tests, but production MapPacks should use binary payloads to avoid large JSON parse cost on Android Chrome.
