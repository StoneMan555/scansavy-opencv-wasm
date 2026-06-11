# ScanSavvy OpenCV.js export whitelist.
#
# This file is loaded by OpenCV's platforms/js/build_js.py, which provides
# makeWhiteList in the config execution environment.

core = {
    "": [
        "add",
        "addWeighted",
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

imgproc = {
    "": [
        "Canny",
        "GaussianBlur",
        "Laplacian",
        "Sobel",
        "createCLAHE",
        "cvtColor",
        "equalizeHist",
        "goodFeaturesToTrack",
        "resize",
        "threshold",
        "undistort",
        "warpPerspective",
    ],
    "CLAHE": ["apply", "collectGarbage", "getClipLimit", "setClipLimit"],
}

features2d = {
    "Feature2D": [
        "detect",
        "compute",
        "detectAndCompute",
        "descriptorSize",
        "descriptorType",
        "defaultNorm",
        "empty",
        "getDefaultName",
    ],
    "ORB": [
        "create",
        "setMaxFeatures",
        "setScaleFactor",
        "setNLevels",
        "setEdgeThreshold",
        "setFastThreshold",
        "setPatchSize",
        "getDefaultName",
    ],
    "AKAZE": [
        "create",
        "setDescriptorType",
        "setDescriptorSize",
        "setDescriptorChannels",
        "setThreshold",
        "setNOctaves",
        "setNOctaveLayers",
        "getDefaultName",
    ],
    "FastFeatureDetector": ["create", "setThreshold", "getThreshold"],
    "GFTTDetector": ["create", "setMaxFeatures", "setQualityLevel", "setMinDistance"],
    "DescriptorMatcher": ["add", "clear", "empty", "isMaskSupported", "train", "match", "knnMatch", "clone", "create"],
    "BFMatcher": ["isMaskSupported", "create"],
}

video = {
    "": [
        "calcOpticalFlowPyrLK",
        "findTransformECC",
    ],
}

calib3d = {
    "": [
        "Rodrigues",
        "estimateAffine2D",
        "findHomography",
        "getDefaultNewCameraMatrix",
        "initUndistortRectifyMap",
        "projectPoints",
        "solvePnP",
        "solvePnPRansac",
        "solvePnPRefineLM",
        "undistort",
    ],
    "UsacParams": ["UsacParams"],
}

white_list = makeWhiteList([core, imgproc, features2d, video, calib3d])
