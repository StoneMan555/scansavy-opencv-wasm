# Combined XFeat + LighterGlue ONNX Probe

This repo's production browser lane remains the split, warm-session pipeline:

1. XFeat ONNX extracts query-frame features.
2. MapPack v1 provides cached XFeat keyframe descriptors and 3D landmark links.
3. LighterGlue L3 ONNX matches query descriptors to candidate keyframe descriptors.
4. OpenCV WASM solves PnP/RANSAC and projects anchors.

## What xfeat-lighterglue.pt Means

The upstream `xfeat-lighterglue.pt` file is the LighterGlue matcher checkpoint trained for XFeat descriptors. It is not a complete image-pair checkpoint by itself. The current `lighterglue_L3.onnx` asset is already the browser-runnable conversion of that matcher checkpoint.

That means the current split lane is not missing the `xfeat-lighterglue.pt` weights. It is already using their ONNX form.

## Fused Image-Pair Export

The probe script can attempt a true fused image-pair ONNX export:

```powershell
npm run probe:combined-xfeat-lighterglue
```

On this machine, the legacy TorchScript ONNX exporter produced:

- `xfeat_lighterglue_pair_L3_384_640x640.onnx`
- raw size: `5,096,738` bytes
- inputs: `image0`, `image1`, each `1x3x640x640`
- outputs: keypoints, descriptors, scores, matches, and match scores
- native ONNX Runtime CPU smoke: load about `290 ms`, random-pair inference about `56 ms`

The newer PyTorch dynamo exporter failed on data-dependent keypoint shapes inside LighterGlue attention, so the probe deliberately defaults to the legacy exporter.

## Why This Is Not Yet A Drop-In MapPack Runtime

The fused model takes two images. The ScanSavvy shopper route usually has one live query frame plus cached MapPack keyframe descriptors, not live keyframe images. Using the fused model in production would require either:

- storing and loading candidate keyframe images in the MapPack, then matching image-to-image in the browser, or
- exporting a different fused graph that accepts one query image plus cached keypoint/descriptor tensors.

The second option is closer to the current architecture and is the better future benchmark if we want to reduce JS/session overhead while keeping MapPack descriptor caching.

## Current Recommendation

Keep the split XFeat ONNX + LighterGlue ONNX lane as the production browser path. Treat the fused image-pair ONNX as an optional benchmark artifact for:

- validating parity against the upstream XFeat + LighterGlue workflow,
- testing browser provider support for a larger single graph,
- exploring whether a future query-image-plus-MapPack-descriptors fused graph is worth building.
