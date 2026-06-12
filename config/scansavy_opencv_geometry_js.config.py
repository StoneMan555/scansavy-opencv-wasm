# ScanSavvy geometry-only OpenCV.js export whitelist.
#
# This target is paired with XFeat + LighterGlue ONNX. Learned models own
# keypoint extraction and correspondence matching, so OpenCV only needs camera
# geometry, PnP/RANSAC, refinement, and projection helpers.

core = {
    "": [
        "add",
        "countNonZero",
        "gemm",
        "invert",
        "meanStdDev",
        "minMaxLoc",
        "norm",
        "normalize",
        "perspectiveTransform",
        "Rodrigues",
        "setIdentity",
        "solve",
        "transpose",
    ],
    "Algorithm": [],
}

calib3d = {
    "": [
        "Rodrigues",
        "getDefaultNewCameraMatrix",
        "projectPoints",
        "solvePnP",
        "solvePnPRansac",
        "solvePnPRefineLM",
        "undistort",
    ],
    "UsacParams": ["UsacParams"],
}

white_list = makeWhiteList([core, calib3d])
