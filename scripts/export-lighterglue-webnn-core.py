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


ASSIGNMENT_OUTPUT_NAME = "/net/log_assignment.2/Add_2_output_0"
SIMILARITY_OUTPUT_NAME = "/net/log_assignment.2/MatMul_output_0"
MATCHABILITY0_OUTPUT_NAME = "/net/log_assignment.2/matchability/Add_output_0"
MATCHABILITY1_OUTPUT_NAME = "/net/log_assignment.2/matchability_1/Add_output_0"


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
    parser.add_argument(
        "--mode",
        choices=("assignment", "logits"),
        default="assignment",
        help="assignment keeps the log-assignment head; logits moves log-softmax/match extraction to JavaScript.",
    )
    args = parser.parse_args()

    source = Path(args.input)
    target = Path(args.output)
    feature_count = int(args.feature_count)
    if feature_count <= 0:
        raise ValueError("--feature-count must be positive")
    if not source.exists():
        raise FileNotFoundError(source)

    model = onnx.load(source)
    output_node_indices: dict[str, int] = {}
    wanted_outputs = (
        [ASSIGNMENT_OUTPUT_NAME]
        if args.mode == "assignment"
        else [SIMILARITY_OUTPUT_NAME, MATCHABILITY0_OUTPUT_NAME, MATCHABILITY1_OUTPUT_NAME]
    )
    for index, node in enumerate(model.graph.node):
        for output_name in wanted_outputs:
            if output_name in node.output:
                output_node_indices[output_name] = index
    missing_outputs = [name for name in wanted_outputs if name not in output_node_indices]
    if missing_outputs:
        raise RuntimeError(f"Could not find core output(s) {missing_outputs!r}")

    last_output_node_index = max(output_node_indices.values())
    del model.graph.node[last_output_node_index + 1 :]
    for value_info in model.graph.input:
        if value_info.name in {"kpts0", "kpts1"}:
            set_dim(value_info, [1, feature_count, 2])
        elif value_info.name in {"desc0", "desc1"}:
            set_dim(value_info, [1, feature_count, 64])

    del model.graph.output[:]
    if args.mode == "assignment":
        model.graph.output.append(
            helper.make_tensor_value_info(
                "assignment_scores",
                TensorProto.FLOAT,
                [1, feature_count, feature_count],
            )
        )
        model.graph.node[output_node_indices[ASSIGNMENT_OUTPUT_NAME]].output[0] = "assignment_scores"
    else:
        model.graph.output.append(
            helper.make_tensor_value_info(
                "similarity_scores",
                TensorProto.FLOAT,
                [1, feature_count, feature_count],
            )
        )
        model.graph.output.append(
            helper.make_tensor_value_info(
                "matchability_logits0",
                TensorProto.FLOAT,
                [1, feature_count, 1],
            )
        )
        model.graph.output.append(
            helper.make_tensor_value_info(
                "matchability_logits1",
                TensorProto.FLOAT,
                [1, feature_count, 1],
            )
        )
        model.graph.node[output_node_indices[SIMILARITY_OUTPUT_NAME]].output[0] = "similarity_scores"
        model.graph.node[output_node_indices[MATCHABILITY0_OUTPUT_NAME]].output[0] = "matchability_logits0"
        model.graph.node[output_node_indices[MATCHABILITY1_OUTPUT_NAME]].output[0] = "matchability_logits1"
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
            "mode": args.mode,
            "featureCount": feature_count,
            "keptNodes": last_output_node_index + 1,
        }
    )


if __name__ == "__main__":
    main()
