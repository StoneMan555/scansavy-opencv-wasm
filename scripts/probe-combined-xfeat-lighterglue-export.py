#!/usr/bin/env python
"""Probe whether a fused XFeat + LighterGlue ONNX model is exportable.

The current ScanSavvy browser runtime intentionally uses two warm ONNX sessions:
XFeat extracts image features, then LighterGlue matches query descriptors against
cached MapPack keyframe descriptors. The upstream xfeat-lighterglue.pt file is
the LighterGlue matcher checkpoint trained for XFeat descriptors, not a complete
image-pair checkpoint by itself.

This probe records that fact, verifies the split ONNX matcher, and tries a
best-effort fused image-pair export only when PyTorch is installed.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def has_module(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def sha256_file(path: Path) -> str | None:
    if not path.exists():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def file_record(path: Path) -> dict[str, Any]:
    return {
        "path": str(path),
        "exists": path.exists(),
        "bytes": path.stat().st_size if path.exists() else 0,
        "sha256": sha256_file(path),
    }


def summarize_onnx(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"status": "missing", "path": str(path)}
    if not has_module("onnx"):
        return {"status": "blocked", "reason": "onnx is not installed", "path": str(path)}
    import onnx

    model = onnx.load(str(path))
    return {
        "status": "ready",
        "path": str(path),
        "irVersion": model.ir_version,
        "opsets": [{"domain": item.domain, "version": item.version} for item in model.opset_import],
        "inputs": [
            {
                "name": value.name,
                "elemType": value.type.tensor_type.elem_type,
                "shape": [
                    dim.dim_param or dim.dim_value or None
                    for dim in value.type.tensor_type.shape.dim
                ],
            }
            for value in model.graph.input
        ],
        "outputs": [
            {
                "name": value.name,
                "elemType": value.type.tensor_type.elem_type,
                "shape": [
                    dim.dim_param or dim.dim_value or None
                    for dim in value.type.tensor_type.shape.dim
                ],
            }
            for value in model.graph.output
        ],
        "nodeCount": len(model.graph.node),
    }


def normalize_kpts_torch(kpts: Any, height: int, width: int) -> Any:
    import torch

    size = torch.tensor([float(width), float(height)], dtype=kpts.dtype, device=kpts.device)
    shift = size / 2.0
    scale = max(float(width), float(height)) / 2.0
    return (kpts - shift) / scale


def try_fused_export(args: argparse.Namespace, upstream: Path, output_dir: Path) -> dict[str, Any]:
    if not has_module("torch"):
        return {
            "status": "blocked",
            "reason": "PyTorch is not installed in this Python environment.",
            "installHint": "Install a CPU or CUDA PyTorch build, then rerun npm run probe:combined-xfeat-lighterglue.",
        }
    if not has_module("onnx"):
        return {"status": "blocked", "reason": "onnx is not installed in this Python environment."}

    import torch
    from torch import nn

    sys.path.insert(0, str(upstream))
    from modules.lighterglue import LighterGlue  # type: ignore
    from modules.xfeat import XFeat  # type: ignore

    class XFeatLighterGluePair(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.xfeat0 = XFeat(
                weights=str(upstream / "weights" / "xfeat.pt"),
                top_k=args.top_k,
                detection_threshold=args.detection_threshold,
            ).eval()
            self.xfeat1 = XFeat(
                weights=str(upstream / "weights" / "xfeat.pt"),
                top_k=args.top_k,
                detection_threshold=args.detection_threshold,
            ).eval()
            self.matcher = LighterGlue(
                n_layers=args.lighterglue_layers,
                weights=str(upstream / "weights" / "xfeat-lighterglue.pt"),
            ).eval()

        def forward(self, image0: Any, image1: Any) -> tuple[Any, Any, Any, Any, Any, Any, Any, Any]:
            out0 = self.xfeat0.detectAndCompute(image0)
            out1 = self.xfeat1.detectAndCompute(image1)
            kpts0 = out0["keypoints"]
            kpts1 = out1["keypoints"]
            desc0 = out0["descriptors"]
            desc1 = out1["descriptors"]
            norm0 = normalize_kpts_torch(kpts0, args.height, args.width).unsqueeze(0)
            norm1 = normalize_kpts_torch(kpts1, args.height, args.width).unsqueeze(0)
            matches, scores = self.matcher(norm0, norm1, desc0.unsqueeze(0), desc1.unsqueeze(0))
            return kpts0, kpts1, desc0, desc1, out0["scores"], out1["scores"], matches, scores

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"xfeat_lighterglue_pair_L{args.lighterglue_layers}_{args.top_k}_{args.width}x{args.height}.onnx"
    model = XFeatLighterGluePair().eval()
    image0 = torch.randn(1, 3, args.height, args.width, dtype=torch.float32)
    image1 = torch.randn(1, 3, args.height, args.width, dtype=torch.float32)
    started = datetime.now(timezone.utc)
    try:
        torch.onnx.export(
            model,
            (image0, image1),
            str(output_path),
            verbose=False,
            do_constant_folding=True,
            input_names=["image0", "image1"],
            output_names=[
                "keypoints0",
                "keypoints1",
                "descriptors0",
                "descriptors1",
                "scores0",
                "scores1",
                "matches",
                "match_scores",
            ],
            opset_version=args.opset,
            dynamic_axes=None,
            dynamo=bool(args.dynamo_export),
        )
    except Exception as exc:
        return {
            "status": "failed",
            "reason": str(exc),
            "traceback": traceback.format_exc(limit=8),
            "outputPath": str(output_path),
        }

    elapsed_ms = (datetime.now(timezone.utc) - started).total_seconds() * 1000.0
    return {
        "status": "ready",
        "outputPath": str(output_path),
        "elapsedMs": round(elapsed_ms, 3),
        "artifact": file_record(output_path),
        "onnx": summarize_onnx(output_path),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--upstream", default=".cache/xfeat_lightglue_onnx")
    parser.add_argument("--output-dir", default=".local-run/combined-xfeat-lighterglue")
    parser.add_argument("--top-k", type=int, default=384)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=640)
    parser.add_argument("--lighterglue-layers", type=int, default=3)
    parser.add_argument("--opset", type=int, default=17)
    parser.add_argument("--detection-threshold", type=float, default=0.05)
    parser.add_argument("--dynamo-export", action="store_true")
    parser.add_argument("--skip-export", action="store_true")
    args = parser.parse_args()

    root = Path.cwd()
    upstream = (root / args.upstream).resolve()
    output_dir = (root / args.output_dir).resolve()
    report_path = output_dir / "combined-xfeat-lighterglue-export-report.json"
    output_dir.mkdir(parents=True, exist_ok=True)

    xfeat_weights = upstream / "weights" / "xfeat.pt"
    lighterglue_weights = upstream / "weights" / "xfeat-lighterglue.pt"
    split_lighterglue_onnx = upstream / "onnx" / "lighterglue_L3.onnx"

    report: dict[str, Any] = {
        "schemaVersion": "scansavy.browser-relocalization.combined-xfeat-lighterglue-probe.v0",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "upstream": str(upstream),
        "settings": {
            "topK": args.top_k,
            "width": args.width,
            "height": args.height,
            "lighterGlueLayers": args.lighterglue_layers,
            "opset": args.opset,
            "dynamoExport": bool(args.dynamo_export),
        },
        "interpretation": {
            "currentRuntime": "split-warm-sessions",
            "xfeatLighterGluePtMeaning": "Matcher weights for LighterGlue trained on XFeat descriptors, not a complete image-pair checkpoint.",
            "existingOnnxUsage": "The current lighterglue_L3.onnx is the browser-runnable conversion of xfeat-lighterglue.pt and pairs with cached XFeat MapPack descriptors.",
            "fusedExportTradeoff": "A true fused image-pair ONNX would reduce session orchestration but would not directly use cached MapPack keyframe descriptors unless it also exposes intermediate descriptors.",
        },
        "dependencies": {
            "torch": has_module("torch"),
            "onnx": has_module("onnx"),
            "onnxsim": has_module("onnxsim"),
            "onnxruntime": has_module("onnxruntime"),
            "numpy": has_module("numpy"),
        },
        "artifacts": {
            "xfeatWeights": file_record(xfeat_weights),
            "lighterGlueWeights": file_record(lighterglue_weights),
            "splitLighterGlueOnnx": file_record(split_lighterglue_onnx),
        },
        "splitLighterGlueOnnx": summarize_onnx(split_lighterglue_onnx),
    }

    if args.skip_export:
        report["fusedExport"] = {"status": "skipped"}
    else:
        report["fusedExport"] = try_fused_export(args, upstream, output_dir)

    report["status"] = "ready" if report["fusedExport"].get("status") == "ready" else "analysis-ready"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"status": report["status"], "reportPath": str(report_path), "fusedExport": report["fusedExport"].get("status")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
