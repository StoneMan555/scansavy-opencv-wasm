export type DescriptorMode = "compact-brief-v1" | "orb-32" | "akaze";

export interface ScanSavvyCameraModel {
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  width?: number;
  height?: number;
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

export interface ScanSavvyPoseResult {
  status: "ready" | "rejected" | "failed";
  descriptorMode: DescriptorMode;
  confidence: number;
  inlierCount: number;
  matchCount: number;
  reprojectionErrorPx: number | null;
  rvec?: [number, number, number];
  tvec?: [number, number, number];
  notes: string[];
}

export interface LoadScanSavvyOpenCvOptions {
  opencvJsUrl?: string;
}

export function loadScanSavvyOpenCv(options?: LoadScanSavvyOpenCvOptions): Promise<unknown>;

