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

