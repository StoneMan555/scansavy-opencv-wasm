export type DescriptorMode = "compact-brief-v1" | "orb-32" | "akaze";
export type RelocalizationDescriptorMode = DescriptorMode | "xfeat-lg-v0";

export interface ScanSavvyCameraModel {
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  width?: number;
  height?: number;
  distortion?: number[];
  distCoeffs?: number[];
}

export interface ScanSavvyReferenceFeature {
  id: string;
  descriptorMode: DescriptorMode;
  descriptorHex: string;
  image?: {
    x: number;
    y: number;
    frameId?: string | null;
    frameIndex?: number | null;
  };
  world: {
    x: number;
    y: number;
    z: number;
  };
  quality?: {
    score?: number;
    supportFrameCount?: number;
    residualMeters?: number;
  };
}

export interface ScanSavvyMapPackSidecar {
  schemaVersion: "scansavy.opencv-wasm.mappack-sidecar.v0";
  descriptorMode: DescriptorMode;
  cameraModel: ScanSavvyCameraModel;
  references: ScanSavvyReferenceFeature[];
}

export interface ScanSavvyFrameInput {
  frameIndex?: number;
  timestampMs?: number;
  imageData: ImageData;
}

export interface ScanSavvyXFeatMapPackSidecar {
  schemaVersion: "scansavy.mappack.xfeat-lg.v0";
  descriptorMode: "xfeat-lg-v0";
  descriptorDim: 64;
  descriptorFormat?: "float16" | "float32" | "uint16-normalized";
  cameraModel: ScanSavvyCameraModel;
  keyframes: ScanSavvyXFeatMapPackKeyframe[];
}

export interface ScanSavvyXFeatMapPackKeyframe {
  id: string;
  width: number;
  height: number;
  cameraModel?: ScanSavvyCameraModel;
  descriptorDim?: 64;
  descriptorFormat?: "float16" | "float32" | "uint16-normalized";
  keypoints?: number[] | number[][];
  descriptors?: number[] | number[][];
  scores?: number[];
  landmarks?: number[] | number[][];
  landmarkIds?: Array<string | number>;
  assets?: {
    keypoints?: string;
    descriptors?: string;
    scores?: string;
    landmarks?: string;
    landmarkIds?: string;
  };
}

export interface ScanSavvyPoseResult {
  status: "ready" | "rejected" | "failed";
  descriptorMode: RelocalizationDescriptorMode;
  confidence: number;
  inlierCount: number;
  matchCount: number;
  reprojectionErrorPx: number | null;
  rvec?: [number, number, number];
  tvec?: [number, number, number];
  notes: string[];
}

export interface ScanSavvyRuntimeInitOptions {
  manifestUrl?: string;
  ortWebGpuUrl?: string;
  ortWasmUrl?: string;
  ortWasmPaths?: string;
  xfeatUrl?: string;
  lighterGlueUrl?: string;
  lighterGlueCoreUrl?: string;
  lighterGlueWebNnCore?: boolean;
  lighterGlueCoreFixedFeatureCount?: number;
  opencvJsUrl?: string;
  fallbackOpenCvJsUrl?: string;
  providers?: Array<"webnn" | "webgpu" | "wasm">;
  webgpuPowerPreference?: "high-performance" | "low-power" | "default";
  webgpuAdapterPowerPreferences?: Array<"high-performance" | "low-power" | "default">;
  webgpuAdapterFeatureLevels?: Array<"core" | "compatibility">;
  webgpuTryFallbackAdapter?: boolean;
  webgpuPreferredLayout?: "NCHW" | "NHWC";
  graphOptimizationLevel?: "disabled" | "basic" | "extended" | "all";
  webgpuGraphCapture?: boolean;
  webgpuUsePreflightDevice?: boolean;
  webgpuProfiling?: boolean;
  webgpuWasmNumThreads?: number | "auto";
  webnnDeviceType?: "cpu" | "gpu" | "npu";
  webnnPowerPreference?: "high-performance" | "low-power" | "default";
  webnnUseWebGpuDevice?: boolean;
  webnnFreeDimensionOverrides?: boolean;
  webnnLighterGlueFixedFeatureCount?: number;
  lighterGlueFixedFeatureCount?: number;
  maxModelSide?: number;
  fixedInputWidth?: number;
  fixedInputHeight?: number;
  padMultiple?: number;
  candidateLimit?: number;
  lighterGlueScoreThreshold?: number;
  minMatches?: number;
  minInliers?: number;
  minConfidence?: number;
  maxHydratedKeyframes?: number;
  prefetchNeighborKeyframes?: number;
  keyframeTensorCacheMaxEntries?: number;
  localNeighborhoodHotRadiusMeters?: number;
  localNeighborhoodWarmRadiusMeters?: number;
}

export interface LoadScanSavvyOpenCvOptions {
  opencvJsUrl?: string;
}

export function loadScanSavvyOpenCv(options?: LoadScanSavvyOpenCvOptions): Promise<unknown>;
