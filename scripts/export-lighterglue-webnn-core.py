#!/usr/bin/env python
"""Export a WebNN-friendly LighterGlue core model.

The public LighterGlue ONNX model returns a variable-length match list. Its
tail uses dynamic match-extraction operators such as TopK, Range, NonZero and
GatherND. Chrome WebNN currently struggles to compile that full dynamic graph
on Android, so the browser runtime can instead run the fixed-shape dense score
core on WebNN and do mutual-nearest match extraction in JavaScript.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import onnx
from onnx import TensorProto, helper, shape_inference


CORE_OUTPUT_NAME = "/net/log_assignment.2/Add_2_output_0"


def set_dim(value_info: onnx.ValueInfoProto, dims: list[int]) -> None:
    shape = value_info.type.tensor_type.shape
    while len(shape.dim) < len(dims):
        shape.dim.add()
    del shape.dim[len(dims) :]
    for dim, value in zip(shape.dim, dims):
        dim.dim_param = ""
        dim.dim_value = int(value)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="dist/models/lighterglue_L3.onnx")
    parser.add_argument("--output", default="dist/models/lighterglue_L3_webnn_core_384.onnx")
    parser.add_argument("--feature-count", type=int, default=384)
    args = parser.parse_args()

    source = Path(args.input)
    target = Path(args.output)
    feature_count = int(args.feature_count)
    if feature_count <= 0:
        raise ValueError("--feature-count must be positive")
    if not source.exists():
        raise FileNotFoundError(source)

    model = onnx.load(source)
    output_node_index = None
    for index, node in enumerate(model.graph.node):
        if CORE_OUTPUT_NAME in node.output:
            output_node_index = index
            break
    if output_node_index is None:
        raise RuntimeError(f"Could not find core output {CORE_OUTPUT_NAME!r}")

    del model.graph.node[output_node_index + 1 :]
    for value_info in model.graph.input:
        if value_info.name in {"kpts0", "kpts1"}:
            set_dim(value_info, [1, feature_count, 2])
        elif value_info.name in {"desc0", "desc1"}:
            set_dim(value_info, [1, feature_count, 64])

    del model.graph.output[:]
    model.graph.output.append(
        helper.make_tensor_value_info(
            "assignment_scores",
            TensorProto.FLOAT,
            [1, feature_count, feature_count],
        )
    )
    model.graph.node[output_node_index].output[0] = "assignment_scores"
    model.producer_name = "scansavy-lighterglue-webnn-core-export"
    model.producer_version = "0.1.0"

    try:
        model = shape_inference.infer_shapes(model)
    except Exception:
        # Shape inference is helpful but not required; checker below validates
        # graph structure for the fixed-shape browser artifact.
        pass
    onnx.checker.check_model(model)

    target.parent.mkdir(parents=True, exist_ok=True)
    onnx.save(model, target)
    print(
        {
            "status": "ready",
            "input": str(source),
            "output": str(target),
            "featureCount": feature_count,
            "keptNodes": output_node_index + 1,
        }
    )


if __name__ == "__main__":
    main()
