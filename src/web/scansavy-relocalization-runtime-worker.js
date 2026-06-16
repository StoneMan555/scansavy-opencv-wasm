/* global cv, ort, importScripts, OffscreenCanvas, ImageData */

const RUNTIME_ADAPTER_DIAGNOSTICS_VERSION = "webgpu-adapter-sweep-v2";

function postFatalWorkerError(kind, event) {
  try {
    const reason = kind === "unhandledrejection" ? event?.reason : event?.error;
    self.postMessage({
      type: "fatal",
      payload: {
        kind,
        message: event?.message || reason?.message || String(reason || "Runtime worker failed."),
        filename: event?.filename || "",
        lineno: Number(event?.lineno || 0),
        colno: Number(event?.colno || 0),
        stack: reason?.stack || "",
      },
    });
  } catch {
    // Best-effort diagnostics only.
  }
}

self.addEventListener?.("error", (event) => postFatalWorkerError("error", event));
self.addEventListener?.("unhandledrejection", (event) => postFatalWorkerError("unhandledrejection", event));

const DEFAULTS = {
  assetBaseUrl: "",
  runtimeAssetBaseUrl: "",
  manifestUrl: "/scansavy-relocalization-runtime/manifest.json",
  ortAllUrl: "/scansavy-relocalization-runtime/ort/ort.all.min.js",
  ortWebGpuUrl: "/scansavy-relocalization-runtime/ort/ort.webgpu.min.js",
  ortWasmUrl: "/scansavy-relocalization-runtime/ort/ort.wasm.min.js",
  ortWasmPaths: "/scansavy-relocalization-runtime/ort/",
  ortWasmFile: "/scansavy-relocalization-runtime/ort/ort-wasm-simd-threaded.wasm",
  ortJsepWasmFile: "/scansavy-relocalization-runtime/ort/ort-wasm-simd-threaded.jsep.wasm",
  xfeatUrl: "/scansavy-relocalization-runtime/models/xfeat_2048_dynamic.onnx",
  lighterGlueUrl: "/scansavy-relocalization-runtime/models/lighterglue_L3.onnx",
  fusedPairUrl: "/scansavy-relocalization-runtime/models/xfeat_lighterglue_pair_L3_384_640x640.onnx",
  opencvJsUrl: "/scansavy-relocalization-runtime/scansavy-opencv-geometry.js",
  fallbackOpenCvJsUrl: "/scansavy-relocalization-runtime/scansavy-opencv.js",
  providers: ["webgpu", "wasm"],
  onnxArchitecture: "split",
  maxModelSide: 640,
  fixedInputWidth: 0,
  fixedInputHeight: 0,
  padMultiple: 32,
  topK: 512,
  maxQueryFeatures: 512,
  candidateLimit: 2,
  fallbackCandidateLimit: 2,
  maxCandidateLimit: 4,
  adaptiveCandidateEscalation: true,
  retrievalConfidenceThreshold: 0.12,
  lighterGlueScoreThreshold: 0.2,
  fusedPairScoreThreshold: 0,
  fusedPairKeyframeMaxLinkDistancePx: 10,
  minMatches: 8,
  minInliers: 5,
  minConfidence: 0.2,
  stopAfterAcceptedCandidate: true,
  stopBurstAfterAcceptedCandidate: true,
  fuseBurstCandidates: true,
  burstFrameOrder: "center-first",
  parallelBurstExtraction: false,
  burstFrameExtractionConcurrency: 2,
  parallelBurstFrameLimit: 5,
  parallelBurstCandidatesPerFrame: 1,
  minFusedGeometryMatches: 8,
  maxFusedMatches: 128,
  maxLighterGluePairsPerBurst: 4,
  warmupOnLoadMapPack: false,
  warmupFrames: 1,
  warmupMaxQueryFeatures: 256,
  warmupMaxKeyframeFeatures: 256,
  warmupCandidateLimit: 1,
  warmupMaxLighterGluePairs: 1,
  wasmNumThreads: "auto",
  webgpuWasmNumThreads: 8,
  wasmAutoThreadMax: 8,
  wasmAutoThreadDivisor: 2,
  wasmProxy: false,
  deviceBaseline: "samsung-s23-plus",
  deviceCpuCoreTarget: 8,
  webgpuBurstFrameConcurrency: 4,
  webgpuCandidateHydrationConcurrency: 8,
  candidateHydrationConcurrency: 8,
  wasmCandidateHydrationConcurrency: 8,
  maxAssetBufferCacheEntries: 256,
  maxAssetBufferCacheBytes: 192 * 1024 * 1024,
  prefetchNeighborKeyframes: 200,
  localNeighborhoodHotRadiusMeters: 8,
  localNeighborhoodWarmRadiusMeters: 20,
  keyframeTensorCacheMaxEntries: 200,
  precacheKeyframeTensorConcurrency: 8,
  precacheNeighborKeyframeTensors: false,
  webgpuPreflight: true,
  webnnPreflight: true,
  webgpuPreflightTimeoutMs: 8000,
  webnnPreflightTimeoutMs: 8000,
  webgpuSessionCreateTimeoutMs: 45000,
  webnnSessionCreateTimeoutMs: 60000,
  wasmSessionCreateTimeoutMs: 90000,
  xfeatInferenceTimeoutMs: 30000,
  lighterGlueInferenceTimeoutMs: 30000,
  fusedPairInferenceTimeoutMs: 30000,
  webnnInferenceTimeoutMs: 8000,
  webgpuPowerPreference: "high-performance",
  webgpuAdapterPowerPreferences: ["high-performance", "default", "low-power"],
  webgpuAdapterFeatureLevels: ["core", "compatibility"],
  webgpuTryFallbackAdapter: true,
  webnnDeviceType: "npu",
  webnnPowerPreference: "high-performance",
  webnnUseWebGpuDevice: false,
  webgpuPreferredLayout: "NCHW",
  graphOptimizationLevel: "auto",
  webgpuGraphCapture: false,
  webgpuUsePreflightDevice: false,
  webgpuForceFallbackAdapter: false,
  webgpuProfiling: false,
  lazyMapPack: true,
  maxHydratedKeyframes: 200,
};

const RUNTIME_PROFILES = {
  "phone-webgpu": {
    providers: ["webgpu", "wasm"],
    wasmNumThreads: 8,
    webgpuWasmNumThreads: 8,
    wasmAutoThreadMax: 8,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus",
    deviceCpuCoreTarget: 8,
    webgpuBurstFrameConcurrency: 4,
    parallelBurstExtraction: false,
    burstFrameExtractionConcurrency: 4,
    parallelBurstFrameLimit: 5,
    parallelBurstCandidatesPerFrame: 1,
    webgpuCandidateHydrationConcurrency: 8,
    candidateHydrationConcurrency: 8,
    wasmCandidateHydrationConcurrency: 8,
    maxHydratedKeyframes: 200,
    prefetchNeighborKeyframes: 200,
    webgpuPreflightTimeoutMs: 10000,
    webgpuSessionCreateTimeoutMs: 60000,
    webgpuAdapterPowerPreferences: ["high-performance", "default", "low-power"],
    webgpuAdapterFeatureLevels: ["core"],
    webgpuTryFallbackAdapter: true,
    maxModelSide: 640,
    maxQueryFeatures: 512,
    maxKeyframeFeatures: 384,
    candidateLimit: 2,
    webgpuPreferredLayout: "NCHW",
    webgpuGraphCapture: false,
  },
  "phone-webnn-npu": {
    providers: ["webnn", "webgpu", "wasm"],
    wasmNumThreads: 8,
    webgpuWasmNumThreads: 8,
    wasmAutoThreadMax: 8,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus",
    deviceCpuCoreTarget: 8,
    webnnDeviceType: "npu",
    webnnPowerPreference: "high-performance",
    webnnPreflightTimeoutMs: 10000,
    webnnSessionCreateTimeoutMs: 60000,
    webgpuAdapterPowerPreferences: ["high-performance", "default", "low-power"],
    webgpuAdapterFeatureLevels: ["core"],
    webgpuTryFallbackAdapter: true,
    webgpuBurstFrameConcurrency: 4,
    parallelBurstExtraction: false,
    burstFrameExtractionConcurrency: 4,
    parallelBurstFrameLimit: 5,
    parallelBurstCandidatesPerFrame: 1,
    webgpuCandidateHydrationConcurrency: 8,
    candidateHydrationConcurrency: 8,
    wasmCandidateHydrationConcurrency: 8,
    maxHydratedKeyframes: 200,
    prefetchNeighborKeyframes: 200,
    webgpuPreflightTimeoutMs: 10000,
    webgpuSessionCreateTimeoutMs: 60000,
    xfeatUrl: "/scansavy-relocalization-runtime/models/xfeat_512_fixed.onnx",
    fallbackXFeatUrl: "/scansavy-relocalization-runtime/models/xfeat_2048_dynamic.onnx",
    maxModelSide: 640,
    fixedInputWidth: 640,
    fixedInputHeight: 640,
    maxQueryFeatures: 512,
    maxKeyframeFeatures: 512,
    candidateLimit: 2,
    fallbackCandidateLimit: 2,
    maxCandidateLimit: 4,
    maxLighterGluePairsPerBurst: 2,
    adaptiveCandidateEscalation: true,
    webgpuPreferredLayout: "NCHW",
    webgpuGraphCapture: false,
  },
  "phone-s23-plus-max": {
    providers: ["webnn", "webgpu", "wasm"],
    wasmNumThreads: 8,
    webgpuWasmNumThreads: 8,
    wasmAutoThreadMax: 8,
    wasmAutoThreadDivisor: 1,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus-max",
    deviceCpuCoreTarget: 8,
    webnnDeviceType: "npu",
    webnnPowerPreference: "high-performance",
    webnnPreflightTimeoutMs: 10000,
    webnnSessionCreateTimeoutMs: 60000,
    webgpuAdapterPowerPreferences: ["high-performance", "default", "low-power"],
    webgpuAdapterFeatureLevels: ["core"],
    webgpuTryFallbackAdapter: true,
    webgpuBurstFrameConcurrency: 4,
    parallelBurstExtraction: false,
    burstFrameExtractionConcurrency: 4,
    parallelBurstFrameLimit: 5,
    parallelBurstCandidatesPerFrame: 1,
    webgpuCandidateHydrationConcurrency: 8,
    candidateHydrationConcurrency: 8,
    wasmCandidateHydrationConcurrency: 8,
    maxAssetBufferCacheEntries: 256,
    maxAssetBufferCacheBytes: 192 * 1024 * 1024,
    maxHydratedKeyframes: 200,
    prefetchNeighborKeyframes: 200,
    webgpuPreflightTimeoutMs: 10000,
    webgpuSessionCreateTimeoutMs: 60000,
    xfeatUrl: "/scansavy-relocalization-runtime/models/xfeat_384_fixed.onnx",
    fallbackXFeatUrl: "/scansavy-relocalization-runtime/models/xfeat_2048_dynamic.onnx",
    maxModelSide: 640,
    fixedInputWidth: 640,
    fixedInputHeight: 640,
    maxQueryFeatures: 384,
    maxKeyframeFeatures: 384,
    candidateLimit: 1,
    fallbackCandidateLimit: 2,
    maxCandidateLimit: 4,
    maxLighterGluePairsPerBurst: 2,
    adaptiveCandidateEscalation: true,
    burstFrameOrder: "center-first",
    webgpuPowerPreference: "high-performance",
    webgpuPreferredLayout: "NCHW",
    webgpuGraphCapture: false,
    webgpuUsePreflightDevice: false,
  },
  "phone-webgpu-fast": {
    providers: ["webgpu", "wasm"],
    wasmNumThreads: 8,
    webgpuWasmNumThreads: 8,
    wasmAutoThreadMax: 8,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus",
    deviceCpuCoreTarget: 8,
    webgpuBurstFrameConcurrency: 4,
    parallelBurstExtraction: false,
    burstFrameExtractionConcurrency: 4,
    parallelBurstFrameLimit: 5,
    parallelBurstCandidatesPerFrame: 1,
    webgpuCandidateHydrationConcurrency: 8,
    candidateHydrationConcurrency: 8,
    wasmCandidateHydrationConcurrency: 8,
    maxHydratedKeyframes: 200,
    prefetchNeighborKeyframes: 200,
    webgpuPreflightTimeoutMs: 10000,
    webgpuSessionCreateTimeoutMs: 60000,
    webgpuAdapterPowerPreferences: ["high-performance", "default", "low-power"],
    webgpuAdapterFeatureLevels: ["core"],
    webgpuTryFallbackAdapter: true,
    xfeatUrl: "/scansavy-relocalization-runtime/models/xfeat_384_fixed.onnx",
    fallbackXFeatUrl: "/scansavy-relocalization-runtime/models/xfeat_2048_dynamic.onnx",
    maxModelSide: 640,
    fixedInputWidth: 640,
    fixedInputHeight: 640,
    maxQueryFeatures: 384,
    maxKeyframeFeatures: 384,
    candidateLimit: 1,
    fallbackCandidateLimit: 2,
    maxCandidateLimit: 4,
    maxLighterGluePairsPerBurst: 2,
    adaptiveCandidateEscalation: true,
    webgpuPreferredLayout: "NCHW",
    webgpuGraphCapture: false,
  },
  "phone-webgpu-quality": {
    providers: ["webgpu", "wasm"],
    wasmNumThreads: 8,
    webgpuWasmNumThreads: 8,
    wasmAutoThreadMax: 8,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus",
    deviceCpuCoreTarget: 8,
    webgpuBurstFrameConcurrency: 4,
    parallelBurstExtraction: true,
    burstFrameExtractionConcurrency: 4,
    parallelBurstFrameLimit: 5,
    parallelBurstCandidatesPerFrame: 1,
    webgpuCandidateHydrationConcurrency: 8,
    candidateHydrationConcurrency: 8,
    wasmCandidateHydrationConcurrency: 8,
    maxHydratedKeyframes: 200,
    prefetchNeighborKeyframes: 200,
    webgpuPreflightTimeoutMs: 10000,
    webgpuSessionCreateTimeoutMs: 60000,
    webgpuAdapterPowerPreferences: ["high-performance", "default", "low-power"],
    webgpuAdapterFeatureLevels: ["core"],
    webgpuTryFallbackAdapter: true,
    xfeatUrl: "/scansavy-relocalization-runtime/models/xfeat_512_fixed.onnx",
    fallbackXFeatUrl: "/scansavy-relocalization-runtime/models/xfeat_2048_dynamic.onnx",
    maxModelSide: 640,
    fixedInputWidth: 640,
    fixedInputHeight: 640,
    maxQueryFeatures: 512,
    maxKeyframeFeatures: 512,
    candidateLimit: 2,
    fallbackCandidateLimit: 2,
    maxCandidateLimit: 4,
    maxLighterGluePairsPerBurst: 2,
    adaptiveCandidateEscalation: true,
    webgpuPreferredLayout: "NCHW",
    webgpuGraphCapture: false,
  },
  "phone-wasm": {
    providers: ["wasm"],
    wasmNumThreads: 8,
    wasmAutoThreadMax: 8,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus",
    deviceCpuCoreTarget: 8,
    candidateHydrationConcurrency: 8,
    wasmCandidateHydrationConcurrency: 8,
    maxHydratedKeyframes: 200,
    prefetchNeighborKeyframes: 200,
    maxModelSide: 640,
    maxQueryFeatures: 384,
    maxKeyframeFeatures: 384,
    candidateLimit: 1,
  },
  "phone-wasm-safe": {
    providers: ["wasm"],
    wasmNumThreads: 8,
    wasmAutoThreadMax: 8,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus",
    deviceCpuCoreTarget: 8,
    candidateHydrationConcurrency: 8,
    wasmCandidateHydrationConcurrency: 8,
    maxHydratedKeyframes: 200,
    prefetchNeighborKeyframes: 200,
    maxModelSide: 640,
    maxQueryFeatures: 384,
    maxKeyframeFeatures: 384,
    candidateLimit: 2,
    fallbackCandidateLimit: 2,
    maxCandidateLimit: 2,
    maxLighterGluePairsPerBurst: 2,
    adaptiveCandidateEscalation: true,
  },
  "emulator-safe": {
    providers: ["webgpu", "wasm"],
    wasmNumThreads: 8,
    webgpuWasmNumThreads: 8,
    wasmAutoThreadMax: 8,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus",
    deviceCpuCoreTarget: 8,
    webgpuBurstFrameConcurrency: 4,
    parallelBurstExtraction: false,
    burstFrameExtractionConcurrency: 4,
    parallelBurstFrameLimit: 5,
    parallelBurstCandidatesPerFrame: 1,
    webgpuCandidateHydrationConcurrency: 8,
    candidateHydrationConcurrency: 8,
    wasmCandidateHydrationConcurrency: 8,
    maxHydratedKeyframes: 200,
    prefetchNeighborKeyframes: 200,
    webgpuPreflightTimeoutMs: 8000,
    webgpuSessionCreateTimeoutMs: 45000,
    webgpuAdapterPowerPreferences: ["high-performance", "default", "low-power"],
    webgpuAdapterFeatureLevels: ["core", "compatibility"],
    webgpuTryFallbackAdapter: true,
    xfeatUrl: "/scansavy-relocalization-runtime/models/xfeat_512_fixed.onnx",
    fallbackXFeatUrl: "/scansavy-relocalization-runtime/models/xfeat_2048_dynamic.onnx",
    maxModelSide: 640,
    fixedInputWidth: 640,
    fixedInputHeight: 640,
    maxQueryFeatures: 512,
    maxKeyframeFeatures: 512,
    candidateLimit: 2,
    fallbackCandidateLimit: 2,
    maxCandidateLimit: 4,
    maxLighterGluePairsPerBurst: 4,
    adaptiveCandidateEscalation: true,
    webgpuPreferredLayout: "NCHW",
    webgpuGraphCapture: false,
  },
  "emulator-webnn-gpu": {
    providers: ["webnn", "webgpu", "wasm"],
    wasmNumThreads: 8,
    webgpuWasmNumThreads: 8,
    wasmAutoThreadMax: 8,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus-emulator-webnn-probe",
    deviceCpuCoreTarget: 8,
    webnnDeviceType: "gpu",
    webnnPowerPreference: "high-performance",
    webnnPreflightTimeoutMs: 10000,
    webnnSessionCreateTimeoutMs: 60000,
    webnnUseWebGpuDevice: true,
    webgpuBurstFrameConcurrency: 4,
    parallelBurstExtraction: false,
    burstFrameExtractionConcurrency: 4,
    parallelBurstFrameLimit: 5,
    parallelBurstCandidatesPerFrame: 1,
    webgpuCandidateHydrationConcurrency: 8,
    candidateHydrationConcurrency: 8,
    wasmCandidateHydrationConcurrency: 8,
    maxHydratedKeyframes: 200,
    prefetchNeighborKeyframes: 200,
    webgpuPreflightTimeoutMs: 8000,
    webgpuSessionCreateTimeoutMs: 45000,
    webgpuAdapterPowerPreferences: ["high-performance", "default", "low-power"],
    webgpuAdapterFeatureLevels: ["core", "compatibility"],
    webgpuTryFallbackAdapter: true,
    xfeatUrl: "/scansavy-relocalization-runtime/models/xfeat_384_fixed.onnx",
    fallbackXFeatUrl: "/scansavy-relocalization-runtime/models/xfeat_2048_dynamic.onnx",
    maxModelSide: 640,
    fixedInputWidth: 640,
    fixedInputHeight: 640,
    maxQueryFeatures: 384,
    maxKeyframeFeatures: 384,
    candidateLimit: 1,
    fallbackCandidateLimit: 2,
    maxCandidateLimit: 4,
    maxLighterGluePairsPerBurst: 1,
    adaptiveCandidateEscalation: true,
    webgpuPreferredLayout: "NCHW",
    webgpuGraphCapture: false,
  },
  "emulator-conservative": {
    providers: ["wasm"],
    wasmNumThreads: 1,
    wasmProxy: false,
    maxModelSide: 640,
    maxQueryFeatures: 384,
    maxKeyframeFeatures: 384,
    candidateLimit: 2,
    maxLighterGluePairsPerBurst: 2,
  },
  "wasm-fast": {
    providers: ["wasm"],
    wasmNumThreads: 8,
    wasmAutoThreadMax: 8,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    candidateHydrationConcurrency: 8,
    wasmCandidateHydrationConcurrency: 8,
    maxHydratedKeyframes: 200,
    prefetchNeighborKeyframes: 200,
    maxModelSide: 640,
    maxQueryFeatures: 384,
    maxKeyframeFeatures: 384,
    candidateLimit: 1,
  },
};

const state = {
  options: { ...DEFAULTS },
  manifest: null,
  ort: null,
  provider: null,
  activeProvider: null,
  xfeatSession: null,
  lighterGlueSession: null,
  fusedPairSession: null,
  opencv: null,
  sidecar: null,
  sidecarBaseUrl: null,
  keyframes: [],
  hydratedKeyframes: new Map(),
  hydratedOrder: [],
  covisibilityByKeyframe: new Map(),
  lastAcceptedKeyframeId: null,
  ortScriptsLoaded: new Set(),
  providerAttempts: [],
  wasmConfig: null,
  webgpuPreflightDiagnostics: null,
  webgpuDevice: null,
  webgpuDeviceLabel: "",
  webgpuDeviceLostReason: null,
  webnnPreflightDiagnostics: null,
  warmedUp: false,
  warmupSummary: null,
  assetBufferCache: new Map(),
  assetBufferCacheBytes: 0,
  keyframeImageDataCache: new Map(),
  keyframeTensorCache: new Map(),
  keyframeTensorOrder: [],
  keyframeTensorStats: {
    hits: 0,
    misses: 0,
    created: 0,
    evicted: 0,
    precacheRequests: 0,
    precacheKeyframes: 0,
    lastPrecacheElapsedMs: 0,
  },
  preprocessCanvas: null,
  preprocessSourceCanvas: null,
  initStage: "idle",
  initStartedAt: 0,
  initStageUpdatedAt: 0,
  initTimings: [],
  initError: null,
  lastInitRequest: null,
};

self.onmessage = async (event) => {
  const { id, type, payload } = event.data || {};
  try {
    if (type === "init") {
      const result = await initRuntime(payload || {});
      reply(id, type, result);
      return;
    }
    if (type === "ping") {
      reply(id, type, runtimeWorkerBuildInfo());
      return;
    }
    if (type === "loadMapPack") {
      const result = await loadMapPack(payload || {});
      reply(id, type, result);
      return;
    }
    if (type === "warmup") {
      const result = await warmupRuntime(payload || {});
      reply(id, type, result);
      return;
    }
    if (type === "precacheKeyframeTensors") {
      const result = await precacheKeyframeTensors(payload || {});
      reply(id, type, result);
      return;
    }
    if (type === "localizeBurst") {
      const result = await localizeBurst(payload || {});
      reply(id, type, result);
      return;
    }
    if (type === "projectAnchors") {
      const result = projectAnchors(payload || {});
      reply(id, type, result);
      return;
    }
    reply(id, type || "unknown", { status: "failed", error: `Unknown message type: ${type}` });
  } catch (error) {
    if (type === "init") {
      state.initError = String(error?.message || error);
      setInitStage("failed", { error: state.initError });
    }
    reply(id, type || "unknown", {
      status: "failed",
      error: String(error?.message || error),
      stack: error?.stack || null,
      providerAttempts: error?.providerAttempts || null,
      runtimeDiagnostics: runtimeDiagnostics(),
    });
  }
};

function reply(id, type, payload) {
  self.postMessage({ id, type, payload });
}

function postProgress(payload) {
  try {
    self.postMessage({ type: "progress", payload });
  } catch {
    // Diagnostics only; never block runtime work on progress delivery.
  }
}

function flushProgress() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function setInitStage(stage, detail = {}) {
  const now = performance.now();
  if (!state.initStartedAt) state.initStartedAt = now;
  const entry = {
    stage,
    elapsedMs: roundMs(now - state.initStartedAt),
    ...detail,
  };
  state.initStage = stage;
  state.initStageUpdatedAt = now;
  state.initTimings.push(entry);
  postProgress({ kind: "init", ...entry });
  return entry;
}

function runtimeWorkerBuildInfo() {
  return {
    status: "ready",
    adapterDiagnosticsVersion: RUNTIME_ADAPTER_DIAGNOSTICS_VERSION,
    workerLocation: String(self.location?.href || ""),
    crossOriginIsolated: Boolean(self.crossOriginIsolated),
    hasSharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    hasWebGpu: Boolean(self.navigator?.gpu),
    hasWebNn: Boolean(self.navigator?.ml),
    hardwareConcurrency: Number(self.navigator?.hardwareConcurrency || 0),
    initStage: state.initStage,
    initTimings: state.initTimings,
    initError: state.initError,
    runtimeProfile: state.options.runtimeProfile || state.options.profile || null,
    provider: state.provider || null,
    diagnostics: runtimeDiagnostics(),
  };
}

function runtimeDiagnostics() {
  return {
    runtimeProfile: state.options.runtimeProfile || state.options.profile || "phone-webgpu",
    provider: state.provider,
    providerAttempts: state.providerAttempts,
    adapterDiagnosticsVersion: RUNTIME_ADAPTER_DIAGNOSTICS_VERSION,
    crossOriginIsolated: Boolean(self.crossOriginIsolated),
    hasSharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    hasWebGpu: Boolean(self.navigator?.gpu),
    hasWebNn: Boolean(self.navigator?.ml),
    hardwareConcurrency: Number(self.navigator?.hardwareConcurrency || 0),
    initStage: state.initStage,
    initElapsedMs: state.initStartedAt ? roundMs(performance.now() - state.initStartedAt) : 0,
    initTimings: state.initTimings,
    initError: state.initError,
    lastInitRequest: state.lastInitRequest,
    maxModelSide: Number(state.options.maxModelSide || DEFAULTS.maxModelSide),
    onnxArchitecture: normalizedOnnxArchitecture(state.options),
    xfeatUrl: state.options.xfeatUrl || DEFAULTS.xfeatUrl,
    fusedPairUrl: state.options.fusedPairUrl || DEFAULTS.fusedPairUrl,
    hasFusedPairSession: Boolean(state.fusedPairSession),
    fixedInputWidth: Number(state.options.fixedInputWidth || 0),
    fixedInputHeight: Number(state.options.fixedInputHeight || 0),
    maxQueryFeatures: Number(state.options.maxQueryFeatures || state.options.topK || DEFAULTS.maxQueryFeatures),
    maxKeyframeFeatures: Number(state.options.maxKeyframeFeatures || 0),
    candidateLimit: Number(state.options.candidateLimit || DEFAULTS.candidateLimit),
    fallbackCandidateLimit: Number(state.options.fallbackCandidateLimit || DEFAULTS.fallbackCandidateLimit),
    maxCandidateLimit: Number(state.options.maxCandidateLimit || DEFAULTS.maxCandidateLimit),
    adaptiveCandidateEscalation: state.options.adaptiveCandidateEscalation !== false,
    retrievalConfidenceThreshold: Number(state.options.retrievalConfidenceThreshold || DEFAULTS.retrievalConfidenceThreshold),
    maxLighterGluePairsPerBurst: Number(state.options.maxLighterGluePairsPerBurst || DEFAULTS.maxLighterGluePairsPerBurst),
    hydratedKeyframes: state.hydratedKeyframes.size,
    loadedKeyframes: state.keyframes.length,
    warmedUp: Boolean(state.warmedUp),
    warmupSummary: state.warmupSummary,
    deviceBaseline: state.options.deviceBaseline || DEFAULTS.deviceBaseline,
    deviceCpuCoreTarget: Number(state.options.deviceCpuCoreTarget || DEFAULTS.deviceCpuCoreTarget),
    webgpuBurstFrameConcurrency: Number(state.options.webgpuBurstFrameConcurrency || DEFAULTS.webgpuBurstFrameConcurrency),
    parallelBurstExtraction: Boolean(state.options.parallelBurstExtraction),
    burstFrameExtractionConcurrency: Number(state.options.burstFrameExtractionConcurrency || DEFAULTS.burstFrameExtractionConcurrency),
    effectiveBurstFrameExtractionConcurrency: burstFrameExtractionConcurrencyForProvider(state.provider, state.options),
    parallelBurstFrameLimit: Number(state.options.parallelBurstFrameLimit || DEFAULTS.parallelBurstFrameLimit),
    parallelBurstCandidatesPerFrame: Number(state.options.parallelBurstCandidatesPerFrame || DEFAULTS.parallelBurstCandidatesPerFrame),
    webgpuCandidateHydrationConcurrency: Number(state.options.webgpuCandidateHydrationConcurrency || DEFAULTS.webgpuCandidateHydrationConcurrency),
    candidateHydrationConcurrency: Number(state.options.candidateHydrationConcurrency || DEFAULTS.candidateHydrationConcurrency),
    wasmCandidateHydrationConcurrency: Number(state.options.wasmCandidateHydrationConcurrency || DEFAULTS.wasmCandidateHydrationConcurrency),
    maxHydratedKeyframes: Number(state.options.maxHydratedKeyframes || DEFAULTS.maxHydratedKeyframes),
    hydratedAssetCacheEntries: state.assetBufferCache.size,
    hydratedAssetCacheBytes: state.assetBufferCacheBytes,
    keyframeTensorCacheEntries: state.keyframeTensorCache.size,
    keyframeTensorCacheMaxEntries: Number(state.options.keyframeTensorCacheMaxEntries || DEFAULTS.keyframeTensorCacheMaxEntries),
    keyframeTensorCacheStats: keyframeTensorCacheStats(),
    prefetchNeighborKeyframes: Number(state.options.prefetchNeighborKeyframes || DEFAULTS.prefetchNeighborKeyframes),
    localNeighborhoodHotRadiusMeters: Number(state.options.localNeighborhoodHotRadiusMeters || DEFAULTS.localNeighborhoodHotRadiusMeters),
    localNeighborhoodWarmRadiusMeters: Number(state.options.localNeighborhoodWarmRadiusMeters || DEFAULTS.localNeighborhoodWarmRadiusMeters),
    webgpuPowerPreference: state.options.webgpuPowerPreference || DEFAULTS.webgpuPowerPreference,
    webgpuAdapterPowerPreferences: normalizeList(
      state.options.webgpuAdapterPowerPreferences || DEFAULTS.webgpuAdapterPowerPreferences,
    ),
    webgpuAdapterFeatureLevels: normalizeList(
      state.options.webgpuAdapterFeatureLevels || DEFAULTS.webgpuAdapterFeatureLevels,
    ),
    webgpuTryFallbackAdapter: state.options.webgpuTryFallbackAdapter !== false,
    webgpuPreflightDiagnostics: state.webgpuPreflightDiagnostics,
    webnnDeviceType: state.options.webnnDeviceType || DEFAULTS.webnnDeviceType,
    webnnPowerPreference: state.options.webnnPowerPreference || DEFAULTS.webnnPowerPreference,
    webnnUseWebGpuDevice: Boolean(state.options.webnnUseWebGpuDevice),
    webnnPreflightDiagnostics: state.webnnPreflightDiagnostics,
    webgpuPreferredLayout: state.options.webgpuPreferredLayout || DEFAULTS.webgpuPreferredLayout,
    webgpuGraphCapture: Boolean(state.options.webgpuGraphCapture),
    webgpuUsePreflightDevice: Boolean(state.options.webgpuUsePreflightDevice),
    webgpuCustomDeviceReady: Boolean(state.webgpuDevice),
    webgpuDeviceLabel: state.webgpuDeviceLabel || "",
    webgpuDeviceLostReason: state.webgpuDeviceLostReason,
    webgpuPreflight: state.options.webgpuPreflight !== false,
    webnnPreflight: state.options.webnnPreflight !== false,
    webgpuPreflightTimeoutMs: Number(state.options.webgpuPreflightTimeoutMs || DEFAULTS.webgpuPreflightTimeoutMs),
    webnnPreflightTimeoutMs: Number(state.options.webnnPreflightTimeoutMs || DEFAULTS.webnnPreflightTimeoutMs),
    webgpuSessionCreateTimeoutMs: Number(state.options.webgpuSessionCreateTimeoutMs || DEFAULTS.webgpuSessionCreateTimeoutMs),
    webnnSessionCreateTimeoutMs: Number(state.options.webnnSessionCreateTimeoutMs || DEFAULTS.webnnSessionCreateTimeoutMs),
    wasmSessionCreateTimeoutMs: Number(state.options.wasmSessionCreateTimeoutMs || DEFAULTS.wasmSessionCreateTimeoutMs),
    xfeatInferenceTimeoutMs: Number(state.options.xfeatInferenceTimeoutMs || DEFAULTS.xfeatInferenceTimeoutMs),
    lighterGlueInferenceTimeoutMs: Number(state.options.lighterGlueInferenceTimeoutMs || DEFAULTS.lighterGlueInferenceTimeoutMs),
    fusedPairInferenceTimeoutMs: Number(state.options.fusedPairInferenceTimeoutMs || DEFAULTS.fusedPairInferenceTimeoutMs),
    webnnInferenceTimeoutMs: Number(state.options.webnnInferenceTimeoutMs || DEFAULTS.webnnInferenceTimeoutMs),
    activeProvider: state.activeProvider || null,
    webgpuWasmNumThreads: state.options.webgpuWasmNumThreads ?? DEFAULTS.webgpuWasmNumThreads,
    wasm: state.wasmConfig,
    ortVersion: state.ort?.version || null,
  };
}

async function initRuntime(payload) {
  const started = performance.now();
  state.initStartedAt = started;
  state.initStageUpdatedAt = started;
  state.initTimings = [];
  state.initError = null;
  setInitStage("start");
  const requestedOptions = payload.options || payload;
  state.lastInitRequest = {
    runtimeProfile: requestedOptions.runtimeProfile || requestedOptions.profile || null,
    providers: requestedOptions.providers || null,
    onnxArchitecture: requestedOptions.onnxArchitecture || requestedOptions.ortArchitecture || null,
    fusedPairUrl: requestedOptions.fusedPairUrl || null,
    profileOverrideKeys: Array.isArray(requestedOptions.profileOverrideKeys)
      ? requestedOptions.profileOverrideKeys.map(String)
      : [],
  };
  const profileName = requestedOptions.runtimeProfile || requestedOptions.profile || DEFAULTS.runtimeProfile || "phone-webgpu";
  state.options = { ...DEFAULTS, ...requestedOptions, runtimeProfile: profileName };
  setInitStage("manifest:start", {
    profileName,
    onnxArchitecture: state.lastInitRequest.onnxArchitecture,
    hasFusedPairUrl: Boolean(state.lastInitRequest.fusedPairUrl),
  });
  state.manifest = await maybeFetchJson(requestedOptions.manifestUrl || DEFAULTS.manifestUrl);
  setInitStage("manifest:ready", { hasManifest: Boolean(state.manifest) });
  const manifestProfiles = state.manifest?.runtimeProfiles || state.manifest?.onnxRuntime?.runtimeProfiles || {};
  const profileOptions =
    manifestProfiles[profileName] ||
    RUNTIME_PROFILES[profileName] ||
    manifestProfiles["phone-webgpu"] ||
    RUNTIME_PROFILES["phone-webgpu"];
  const profileOverrideKeys = Array.isArray(requestedOptions.profileOverrideKeys)
    ? requestedOptions.profileOverrideKeys.map(String)
    : [];
  const effectiveRequestedOptions = { ...requestedOptions };
  if (
    Array.isArray(profileOptions?.providers) &&
    !profileOverrideKeys.includes("providers") &&
    Object.prototype.hasOwnProperty.call(effectiveRequestedOptions, "providers")
  ) {
    delete effectiveRequestedOptions.providers;
  }
  state.options = { ...DEFAULTS, ...profileOptions, ...effectiveRequestedOptions, runtimeProfile: profileName };
  state.warmedUp = false;
  state.warmupSummary = null;
  applyProfileDefaults(profileOptions, profileOverrideKeys);
  for (const key of profileOverrideKeys) {
    if (Object.prototype.hasOwnProperty.call(effectiveRequestedOptions, key)) {
      state.options[key] = effectiveRequestedOptions[key];
    }
  }
  for (const key of [
    "onnxArchitecture",
    "ortArchitecture",
    "fusedPairUrl",
    "fusedPairScoreThreshold",
    "fusedPairKeyframeMaxLinkDistancePx",
  ]) {
    if (Object.prototype.hasOwnProperty.call(effectiveRequestedOptions, key)) {
      state.options[key] = effectiveRequestedOptions[key];
    }
  }
  if (state.lastInitRequest.onnxArchitecture) {
    state.options.onnxArchitecture = state.lastInitRequest.onnxArchitecture;
  }
  if (state.lastInitRequest.fusedPairUrl) {
    state.options.fusedPairUrl = state.lastInitRequest.fusedPairUrl;
  }
  applyModelShapeDefaults(state.options);
  setInitStage("ort:start", {
    providers: Array.isArray(state.options.providers) ? state.options.providers.join(",") : String(state.options.providers || ""),
  });
  state.ort = await loadOrt(state.options);
  setInitStage("ort:ready", { ortVersion: state.ort?.version || null });

  const providers =
    Array.isArray(profileOptions?.providers) && profileOptions.providers.length && !profileOverrideKeys.includes("providers")
      ? profileOptions.providers
      : Array.isArray(state.options.providers) && state.options.providers.length
        ? state.options.providers
        : DEFAULTS.providers;
  state.options.providers = providers;
  setInitStage("sessions:start", { providers: providers.join(",") });
  const sessionResult = await createSessions(providers);
  setInitStage("sessions:ready", { provider: state.provider || null });
  setInitStage("opencv:start", { opencvJsUrl: state.options.opencvJsUrl || DEFAULTS.opencvJsUrl });
  state.opencv = await loadOpenCv(state.options.opencvJsUrl, state.options.fallbackOpenCvJsUrl);
  setInitStage("opencv:ready", {
    hasGeometry: Boolean(state.opencv?.solvePnPRansac && state.opencv?.projectPoints),
  });
  setInitStage("ready", { provider: state.provider || null });

  return {
    status: "ready",
    packageName: state.manifest?.packageName || "scansavy-browser-relocalization-runtime",
    provider: state.provider,
    providerAttempts: sessionResult.providerAttempts,
    runtimeDiagnostics: runtimeDiagnostics(),
    hasOpenCvGeometry: Boolean(state.opencv?.solvePnPRansac && state.opencv?.projectPoints),
    hasXFeat: Boolean(state.xfeatSession),
    hasLighterGlue: Boolean(state.lighterGlueSession),
    hasFusedPair: Boolean(state.fusedPairSession),
    elapsedMs: roundMs(performance.now() - started),
  };
}

function applyProfileDefaults(profileOptions, overrideKeys = []) {
  const explicitOverrides = new Set(Array.isArray(overrideKeys) ? overrideKeys.map(String) : []);
  for (const key of [
    "providers",
    "onnxArchitecture",
    "wasmNumThreads",
    "webgpuWasmNumThreads",
    "wasmAutoThreadMax",
    "wasmAutoThreadDivisor",
    "wasmProxy",
    "deviceBaseline",
    "deviceCpuCoreTarget",
    "webgpuBurstFrameConcurrency",
    "webgpuCandidateHydrationConcurrency",
    "candidateHydrationConcurrency",
    "wasmCandidateHydrationConcurrency",
    "maxHydratedKeyframes",
    "maxAssetBufferCacheEntries",
    "maxAssetBufferCacheBytes",
    "prefetchNeighborKeyframes",
    "localNeighborhoodHotRadiusMeters",
    "localNeighborhoodWarmRadiusMeters",
    "keyframeTensorCacheMaxEntries",
    "maxModelSide",
    "fixedInputWidth",
    "fixedInputHeight",
    "maxQueryFeatures",
    "maxKeyframeFeatures",
    "candidateLimit",
    "fallbackCandidateLimit",
    "maxCandidateLimit",
    "adaptiveCandidateEscalation",
    "retrievalConfidenceThreshold",
    "maxLighterGluePairsPerBurst",
    "burstFrameOrder",
    "parallelBurstExtraction",
    "burstFrameExtractionConcurrency",
    "parallelBurstFrameLimit",
    "parallelBurstCandidatesPerFrame",
    "xfeatUrl",
    "fallbackXFeatUrl",
    "fusedPairUrl",
    "fusedPairScoreThreshold",
    "fusedPairKeyframeMaxLinkDistancePx",
    "webgpuPowerPreference",
    "webgpuAdapterPowerPreferences",
    "webgpuAdapterFeatureLevels",
    "webgpuTryFallbackAdapter",
    "webnnDeviceType",
    "webnnPowerPreference",
    "webnnUseWebGpuDevice",
    "webgpuPreferredLayout",
    "graphOptimizationLevel",
    "webgpuGraphCapture",
    "webgpuUsePreflightDevice",
    "webnnPreflightTimeoutMs",
    "webnnSessionCreateTimeoutMs",
    "webgpuPreflightTimeoutMs",
    "webgpuSessionCreateTimeoutMs",
    "wasmSessionCreateTimeoutMs",
    "webgpuForceFallbackAdapter",
    "webgpuProfiling",
  ]) {
    if (Object.prototype.hasOwnProperty.call(profileOptions, key) && !explicitOverrides.has(key)) {
      state.options[key] = profileOptions[key];
    }
  }
}

function applyModelShapeDefaults(options) {
  const shape = inferXFeatInputShape(options.xfeatUrl || DEFAULTS.xfeatUrl);
  if (!shape) return;
  if (!Number(options.fixedInputWidth)) options.fixedInputWidth = shape.width;
  if (!Number(options.fixedInputHeight)) options.fixedInputHeight = shape.height;
  options.maxModelSide = Math.max(Number(options.maxModelSide || 0), shape.width, shape.height);
}

function inferXFeatInputShape(url) {
  const value = String(url || "").toLowerCase();
  if (!value.includes("xfeat") || !value.includes("fixed")) return null;
  const explicit = value.match(/(\d{3,4})x(\d{3,4})/);
  if (explicit) {
    return { width: Number(explicit[1]), height: Number(explicit[2]) };
  }
  return { width: 640, height: 640 };
}

async function loadOrt(options) {
  if (state.ort?.InferenceSession) return state.ort;
  const providerOrder = Array.isArray(options.providers) ? options.providers : ["webgpu", "wasm"];
  const firstProvider = providerOrder[0] || "wasm";
  state.activeProvider = firstProvider;
  loadOrtScript(firstProvider, options);
  const runtime = getOrtGlobal();
  if (!runtime?.InferenceSession) throw new Error("ONNX Runtime Web did not initialize.");
  configureOrtWasmPaths(runtime, options);
  configureOrtWebGpu(runtime, options);
  return runtime;
}

async function createSessions(providers) {
  const attempts = [];
  state.webgpuDevice = null;
  state.webgpuDeviceLabel = "";
  state.webgpuDeviceLostReason = null;
  for (const provider of providers) {
    try {
      state.activeProvider = provider;
      setInitStage(`sessions:${provider}:start`);
      if (provider === "webgpu") {
        state.webgpuPreflightDiagnostics = {
          status: "pending",
          version: RUNTIME_ADAPTER_DIAGNOSTICS_VERSION,
          provider,
          requested: state.options.webgpuPreflight !== false,
        };
      }
      if (provider === "webnn" && state.options.webnnPreflight !== false) {
        await withTimeout(
          preflightWebNn(state.options),
          Number(state.options.webnnPreflightTimeoutMs || DEFAULTS.webnnPreflightTimeoutMs),
          "WebNN preflight",
        );
      }
      if (provider === "webgpu" && state.options.webgpuPreflight !== false) {
        const webgpuPreflight = await withTimeout(
          preflightWebGpu(state.options),
          Number(state.options.webgpuPreflightTimeoutMs || DEFAULTS.webgpuPreflightTimeoutMs),
          "WebGPU preflight",
        );
        if (webgpuPreflight?.diagnostics?.selectedRequestOptions?.forceFallbackAdapter) {
          state.options.webgpuForceFallbackAdapter = true;
        }
        if (state.options.webgpuUsePreflightDevice !== false) {
          await withTimeout(
            createWebGpuPreflightDevice(webgpuPreflight),
            Number(state.options.webgpuPreflightTimeoutMs || DEFAULTS.webgpuPreflightTimeoutMs),
            "WebGPU preflight device creation",
          );
        }
        configureOrtWebGpu(state.ort, state.options);
      }
      loadOrtScript(provider, state.options);
      const sessionStarted = performance.now();
      const sessionOptions = sessionOptionsFor(provider, state.options);
      const sessionTimeoutMs = sessionTimeoutForProvider(provider, state.options);
      state.xfeatSession = null;
      state.lighterGlueSession = null;
      state.fusedPairSession = null;
      setInitStage(`sessions:${provider}:xfeat:start`, {
        timeoutMs: sessionTimeoutMs,
        xfeatUrl: state.options.xfeatUrl || DEFAULTS.xfeatUrl,
      });
      const xfeatSessionResult = await withTimeout(
        createXFeatSession(sessionOptions),
        sessionTimeoutMs,
        `${provider} XFeat session creation`,
      );
      setInitStage(`sessions:${provider}:xfeat:ready`, {
        fallbackUsed: Boolean(xfeatSessionResult.fallbackUsed),
      });
      state.xfeatSession = xfeatSessionResult.session;
      const lighterGlueUrl = resolveUrl(state.options.lighterGlueUrl || DEFAULTS.lighterGlueUrl);
      setInitStage(`sessions:${provider}:lighterglue:start`, {
        lighterGlueUrl,
      });
      const lighterGlueSessionResult = await withTimeout(
        createOrtSessionFromUrl(lighterGlueUrl, sessionOptions, "LighterGlue model"),
        sessionTimeoutMs,
        `${provider} LighterGlue session creation`,
      );
      state.lighterGlueSession = lighterGlueSessionResult.session;
      setInitStage(`sessions:${provider}:lighterglue:ready`);
      if (usesFusedPairArchitecture(state.options)) {
        const fusedPairUrl = resolveUrl(state.options.fusedPairUrl || DEFAULTS.fusedPairUrl);
        setInitStage(`sessions:${provider}:fused-pair:start`, { fusedPairUrl });
        const fusedPairSessionResult = await withTimeout(
          createOrtSessionFromUrl(fusedPairUrl, sessionOptions, "Fused XFeat+LighterGlue image-pair model"),
          sessionTimeoutMs,
          `${provider} fused XFeat+LighterGlue session creation`,
        );
        state.fusedPairSession = fusedPairSessionResult.session;
        setInitStage(`sessions:${provider}:fused-pair:ready`);
      }
      state.provider = provider;
      attempts.push({
        provider,
        status: "ready",
        xfeatUrl: xfeatSessionResult.url,
        xfeatFallbackUsed: xfeatSessionResult.fallbackUsed,
        onnxArchitecture: normalizedOnnxArchitecture(state.options),
        hasFusedPairSession: Boolean(state.fusedPairSession),
        elapsedMs: roundMs(performance.now() - sessionStarted),
      });
      state.providerAttempts = attempts;
      return { providerAttempts: attempts };
    } catch (error) {
      if (provider === "webgpu") disposeWebGpuDevice();
      const errorText = String(error?.message || error);
      setInitStage(`sessions:${provider}:failed`, { error: errorText });
      attempts.push({
        provider,
        status: "failed",
        error:
          provider === "webgpu"
            ? `${errorText} adapterDiagnosticsVersion=${RUNTIME_ADAPTER_DIAGNOSTICS_VERSION} webgpuPreflightDiagnostics=${safeJsonStringify(
                state.webgpuPreflightDiagnostics,
              )}`
            : errorText,
      });
      state.providerAttempts = attempts;
    }
  }
  const error = new Error(`Unable to create ONNX sessions with providers: ${providers.join(", ")}`);
  error.providerAttempts = attempts;
  throw error;
}

function sessionTimeoutForProvider(provider, options) {
  if (provider === "webnn") return Number(options.webnnSessionCreateTimeoutMs || DEFAULTS.webnnSessionCreateTimeoutMs);
  if (provider === "webgpu") return Number(options.webgpuSessionCreateTimeoutMs || DEFAULTS.webgpuSessionCreateTimeoutMs);
  return Number(options.wasmSessionCreateTimeoutMs || DEFAULTS.wasmSessionCreateTimeoutMs);
}

function inferenceTimeoutMs(model, options) {
  if (state.provider === "webnn") return Number(options.webnnInferenceTimeoutMs || DEFAULTS.webnnInferenceTimeoutMs);
  if (model === "fused-pair") return Number(options.fusedPairInferenceTimeoutMs || DEFAULTS.fusedPairInferenceTimeoutMs);
  if (model === "lighterglue") return Number(options.lighterGlueInferenceTimeoutMs || DEFAULTS.lighterGlueInferenceTimeoutMs);
  return Number(options.xfeatInferenceTimeoutMs || DEFAULTS.xfeatInferenceTimeoutMs);
}

function normalizedOnnxArchitecture(options = state.options) {
  const value = String(options.onnxArchitecture || options.ortArchitecture || DEFAULTS.onnxArchitecture || "split").toLowerCase();
  if (
    value === "fused" ||
    value === "fusedpair" ||
    value === "fused-pair" ||
    value === "fused_pair" ||
    value === "image-pair" ||
    value === "image_pair"
  ) {
    return "fused-pair";
  }
  return "split";
}

function usesFusedPairArchitecture(options = state.options) {
  return normalizedOnnxArchitecture(options) === "fused-pair";
}

function withTimeout(promise, timeoutMs, label) {
  const ms = Math.max(0, Number(timeoutMs || 0));
  if (!ms) return promise;
  let timer = null;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms.`)), ms);
    }),
  ]);
}

async function createXFeatSession(sessionOptions) {
  const primaryUrl = resolveUrl(state.options.xfeatUrl || DEFAULTS.xfeatUrl);
  const fallbackUrl = resolveUrl(state.options.fallbackXFeatUrl || DEFAULTS.xfeatUrl);
  try {
    const result = await createOrtSessionFromUrl(primaryUrl, sessionOptions, "XFeat model");
    return {
      ...result,
      fallbackUsed: false,
    };
  } catch (primaryError) {
    if (!fallbackUrl || fallbackUrl === primaryUrl) throw primaryError;
    const fallbackSessionOptions = { ...sessionOptions };
    delete fallbackSessionOptions.enableGraphCapture;
    const fallbackResult = await createOrtSessionFromUrl(fallbackUrl, fallbackSessionOptions, "XFeat fallback model");
    return {
      ...fallbackResult,
      fallbackUsed: true,
      primaryError: String(primaryError?.message || primaryError),
    };
  }
}

async function createOrtSessionFromUrl(url, sessionOptions, label) {
  const resolvedUrl = resolveUrl(url);
  const buffer = await fetchArrayBufferCached(resolvedUrl, label || resolvedUrl);
  const modelBytes = new Uint8Array(buffer.slice(0));
  return {
    session: await state.ort.InferenceSession.create(modelBytes, sessionOptions),
    url: resolvedUrl,
    bytes: modelBytes.byteLength,
  };
}

async function preflightWebGpu(options) {
  state.webgpuPreflightDiagnostics = null;
  const gpu = self.navigator?.gpu;
  if (!gpu?.requestAdapter) {
    state.webgpuPreflightDiagnostics = {
      status: "failed",
      reason: "requestAdapter-unavailable",
      version: RUNTIME_ADAPTER_DIAGNOSTICS_VERSION,
      attempts: [],
    };
    throw new Error("WebGPU preflight failed: navigator.gpu.requestAdapter is unavailable.");
  }
  const result = await requestWebGpuAdapter(options);
  state.webgpuPreflightDiagnostics = result.diagnostics;
  if (!result.adapter) {
    throw new Error(
      `WebGPU adapter sweep ${RUNTIME_ADAPTER_DIAGNOSTICS_VERSION} failed: no GPU adapter returned. ${summarizeAdapterAttempts(result.diagnostics)}`,
    );
  }
  return result;
}

async function createWebGpuPreflightDevice(preflightResult) {
  if (!preflightResult || state.webgpuDevice) return state.webgpuDevice;
  const adapterResult = preflightResult.adapter ? preflightResult : await requestWebGpuAdapter(state.options);
  if (!adapterResult.adapter?.requestDevice) {
    state.webgpuPreflightDiagnostics = {
      ...(state.webgpuPreflightDiagnostics || preflightResult.diagnostics || {}),
      customDevice: {
        status: "failed",
        reason: "adapter-unavailable-for-device",
        attempts: adapterResult.diagnostics?.attempts || [],
      },
    };
    throw new Error(`WebGPU preflight device unavailable. ${summarizeAdapterAttempts(adapterResult.diagnostics)}`);
  }
  const started = performance.now();
  const device = await adapterResult.adapter.requestDevice();
  state.webgpuDevice = device;
  state.webgpuDeviceLabel = `scansavy-${state.options.runtimeProfile || "webgpu"}-${Date.now()}`;
  try {
    device.label = state.webgpuDeviceLabel;
  } catch {
    // GPUDevice.label is optional; diagnostics still carry our desired label.
  }
  if (device.lost?.then) {
    device.lost.then((info) => {
      state.webgpuDeviceLostReason = {
        reason: info?.reason || "unknown",
        message: info?.message || "",
      };
    }).catch((error) => {
      state.webgpuDeviceLostReason = {
        reason: "lost-promise-rejected",
        message: String(error?.message || error),
      };
    });
  }
  state.webgpuPreflightDiagnostics = {
    ...(state.webgpuPreflightDiagnostics || preflightResult.diagnostics || {}),
    customDevice: {
      status: "ready",
      elapsedMs: roundMs(performance.now() - started),
      label: state.webgpuDeviceLabel,
      selectedAdapterInfo: adapterResult.diagnostics?.selectedAdapterInfo || null,
    },
  };
  return device;
}

function disposeWebGpuDevice() {
  if (!state.webgpuDevice) return;
  try {
    if (typeof state.webgpuDevice.destroy === "function") state.webgpuDevice.destroy();
  } catch {
    // Best-effort cleanup only; failed providers immediately continue to fallback.
  }
  state.webgpuDevice = null;
  state.webgpuDeviceLabel = "";
}

async function preflightWebNn(options) {
  state.webnnPreflightDiagnostics = null;
  const ml = self.navigator?.ml;
  if (!ml?.createContext) {
    state.webnnPreflightDiagnostics = {
      status: "failed",
      reason: "createContext-unavailable",
      webgpuBridgeRequested: Boolean(options.webnnUseWebGpuDevice),
    };
    throw new Error("WebNN preflight failed: navigator.ml.createContext is unavailable.");
  }
  const contextOptions = {
    deviceType: options.webnnDeviceType || DEFAULTS.webnnDeviceType,
    powerPreference: options.webnnPowerPreference || DEFAULTS.webnnPowerPreference,
  };
  let context;
  let bridgeDiagnostics = null;
  if (options.webnnUseWebGpuDevice) {
    const adapterResult = await requestWebGpuAdapter(options);
    bridgeDiagnostics = adapterResult.diagnostics;
    if (!adapterResult.adapter?.requestDevice) {
      state.webnnPreflightDiagnostics = {
        status: "failed",
        reason: "webgpu-bridge-adapter-unavailable",
        contextOptions,
        webgpuBridge: bridgeDiagnostics,
      };
      throw new Error(`WebNN preflight failed: WebGPU bridge adapter unavailable. ${summarizeAdapterAttempts(bridgeDiagnostics)}`);
    }
    const device = await adapterResult.adapter.requestDevice();
    context = await ml.createContext(device);
  } else {
    context = await ml.createContext(contextOptions);
  }
  if (!context) {
    state.webnnPreflightDiagnostics = {
      status: "failed",
      reason: "no-context-returned",
      contextOptions,
      webgpuBridge: bridgeDiagnostics,
    };
    throw new Error("WebNN preflight failed: no ML context returned.");
  }
  state.webnnPreflightDiagnostics = {
    status: "ready",
    contextOptions,
    webgpuBridgeRequested: Boolean(options.webnnUseWebGpuDevice),
    webgpuBridge: bridgeDiagnostics,
  };
  if (typeof context.close === "function") context.close();
  return { deviceType: contextOptions.deviceType };
}

async function requestWebGpuAdapter(options) {
  const gpu = self.navigator?.gpu;
  const attempts = [];
  if (!gpu?.requestAdapter) {
    return {
      adapter: null,
      diagnostics: {
        status: "failed",
        reason: "requestAdapter-unavailable",
        version: RUNTIME_ADAPTER_DIAGNOSTICS_VERSION,
        attempts,
      },
    };
  }
  const powerPreferences = normalizeList(
    options.webgpuAdapterPowerPreferences || options.webgpuPowerPreference || DEFAULTS.webgpuAdapterPowerPreferences,
  );
  const featureLevels = normalizeList(options.webgpuAdapterFeatureLevels || DEFAULTS.webgpuAdapterFeatureLevels);
  const fallbackModes = options.webgpuTryFallbackAdapter === false ? [false] : [false, true];
  const seen = new Set();
  for (const featureLevel of featureLevels) {
    for (const powerPreference of powerPreferences) {
      for (const forceFallbackAdapter of fallbackModes) {
        const requestOptions = {};
        if (powerPreference && powerPreference !== "default") requestOptions.powerPreference = powerPreference;
        if (forceFallbackAdapter) requestOptions.forceFallbackAdapter = true;
        if (featureLevel && featureLevel !== "core" && featureLevel !== "default") requestOptions.featureLevel = featureLevel;
        const signature = JSON.stringify(requestOptions);
        if (seen.has(signature)) continue;
        seen.add(signature);
        const started = performance.now();
        try {
          const adapter = await gpu.requestAdapter(requestOptions);
          const attempt = {
            requestOptions,
            status: adapter ? "ready" : "null-adapter",
            elapsedMs: roundMs(performance.now() - started),
          };
          if (adapter) {
            attempt.adapterInfo = await readAdapterInfo(adapter);
            attempts.push(attempt);
            return {
              adapter,
              diagnostics: {
                status: "ready",
                version: RUNTIME_ADAPTER_DIAGNOSTICS_VERSION,
                selectedRequestOptions: requestOptions,
                selectedAdapterInfo: attempt.adapterInfo,
                attempts,
              },
            };
          }
          attempts.push(attempt);
        } catch (error) {
          attempts.push({
            requestOptions,
            status: "failed",
            error: String(error?.message || error),
            elapsedMs: roundMs(performance.now() - started),
          });
        }
      }
    }
  }
  return {
    adapter: null,
    diagnostics: {
      status: "failed",
      reason: "no-adapter-returned",
      version: RUNTIME_ADAPTER_DIAGNOSTICS_VERSION,
      attempts,
    },
  };
}

async function readAdapterInfo(adapter) {
  try {
    const info = typeof adapter.requestAdapterInfo === "function"
      ? await adapter.requestAdapterInfo()
      : adapter.info || null;
    if (!info) return null;
    return {
      vendor: info.vendor || "",
      architecture: info.architecture || "",
      device: info.device || "",
      description: info.description || "",
      subgroupMinSize: Number(info.subgroupMinSize || 0) || undefined,
      subgroupMaxSize: Number(info.subgroupMaxSize || 0) || undefined,
    };
  } catch (error) {
    return { error: String(error?.message || error) };
  }
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function summarizeAdapterAttempts(diagnostics) {
  const attempts = Array.isArray(diagnostics?.attempts) ? diagnostics.attempts : [];
  if (!attempts.length) return `adapterAttempts=${diagnostics?.reason || "none"}`;
  return `adapterAttempts=${attempts
    .slice(0, 8)
    .map((attempt) => {
      const options = JSON.stringify(attempt.requestOptions || {});
      return `${options}:${attempt.status}${attempt.error ? `:${attempt.error}` : ""}`;
    })
    .join(" | ")}`;
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value || null);
  } catch {
    return "null";
  }
}

function loadOrtScript(provider, options) {
  const configuredScriptUrl = provider === "webnn"
    ? options.ortAllUrl
    : provider === "webgpu"
      ? options.ortWebGpuUrl
      : options.ortWasmUrl;
  const scriptUrl = resolveUrl(configuredScriptUrl);
  if (state.ortScriptsLoaded.has(scriptUrl)) return;
  importScripts(scriptUrl);
  state.ortScriptsLoaded.add(scriptUrl);
  const runtime = getOrtGlobal();
  if (runtime?.env?.wasm) configureOrtWasmPaths(runtime, options);
  configureOrtWebGpu(runtime, options);
}

function getOrtGlobal() {
  return self.ort || (typeof ort !== "undefined" ? ort : null);
}

function configureOrtWasmPaths(runtime, options) {
  if (!runtime?.env?.wasm) return;
  const wasmFile = resolveUrl(options.ortWasmFile || "ort-wasm-simd-threaded.wasm", options.ortWasmPaths);
  const jsepFile = resolveUrl(options.ortJsepWasmFile || "ort-wasm-simd-threaded.jsep.wasm", options.ortWasmPaths);
  const files = [
    "ort-wasm-simd-threaded.wasm",
    "ort-wasm-simd-threaded.mjs",
    "ort-wasm-simd-threaded.jsep.wasm",
    "ort-wasm-simd-threaded.jsep.mjs",
    "ort-wasm-simd-threaded.asyncify.wasm",
    "ort-wasm-simd-threaded.asyncify.mjs",
    "ort-wasm-simd-threaded.jspi.wasm",
    "ort-wasm-simd-threaded.jspi.mjs",
  ];
  runtime.env.wasm.wasmPaths = Object.fromEntries(
    files.map((file) => [file, resolveUrl(file, options.ortWasmPaths)]),
  );
  runtime.env.wasm.wasmPaths["ort-wasm-simd-threaded.wasm"] = wasmFile;
  runtime.env.wasm.wasmPaths["ort-wasm-simd-threaded.jsep.wasm"] = jsepFile;
  const crossOriginReady = Boolean(self.crossOriginIsolated && typeof SharedArrayBuffer !== "undefined");
  const activeProvider = options.activeProvider || state.activeProvider || "";
  const providerThreadOverride = activeProvider === "webgpu"
    ? (options.webgpuWasmNumThreads ?? DEFAULTS.webgpuWasmNumThreads)
    : undefined;
  const requestedThreads = providerThreadOverride ?? options.wasmNumThreads ?? DEFAULTS.wasmNumThreads;
  const hardwareConcurrency = Number(self.navigator?.hardwareConcurrency || 0);
  const autoThreadMax = Math.max(1, Number(options.wasmAutoThreadMax || DEFAULTS.wasmAutoThreadMax || 4));
  const autoThreadDivisor = Math.max(1, Number(options.wasmAutoThreadDivisor || DEFAULTS.wasmAutoThreadDivisor || 2));
  const hardwareThreadCap = Math.max(1, hardwareConcurrency || autoThreadMax);
  let numThreads = 1;
  if (requestedThreads === "auto" || requestedThreads === 0) {
    numThreads = crossOriginReady
      ? Math.max(1, Math.min(autoThreadMax, Math.floor(hardwareThreadCap / autoThreadDivisor)))
      : 1;
  } else {
    numThreads = Math.min(hardwareThreadCap, Math.max(1, Number(requestedThreads) || 1));
    if (!crossOriginReady) numThreads = 1;
  }
  runtime.env.wasm.numThreads = numThreads;
  runtime.env.wasm.proxy = Boolean(options.wasmProxy) && numThreads > 1;
  state.wasmConfig = {
    wasmPaths: options.ortWasmPaths,
    activeProvider,
    requestedThreads,
    webgpuWasmNumThreads: options.webgpuWasmNumThreads ?? DEFAULTS.webgpuWasmNumThreads,
    crossOriginIsolated: Boolean(self.crossOriginIsolated),
    hasSharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    hardwareConcurrency,
    numThreads,
    autoThreadMax,
    autoThreadDivisor,
    proxy: Boolean(runtime.env.wasm.proxy),
  };
}

function configureOrtWebGpu(runtime, options) {
  if (!runtime?.env?.webgpu) return;
  const webgpu = runtime.env.webgpu;
  if ("powerPreference" in webgpu) {
    webgpu.powerPreference = options.webgpuPowerPreference || DEFAULTS.webgpuPowerPreference;
  }
  if ("forceFallbackAdapter" in webgpu) {
    webgpu.forceFallbackAdapter = Boolean(options.webgpuForceFallbackAdapter);
  }
  if ("profiling" in webgpu) {
    webgpu.profiling = Boolean(options.webgpuProfiling);
  }
}

function sessionOptionsFor(provider, options) {
  const executionProvider = executionProviderFor(provider, options);
  const requestedGraphOptimizationLevel = String(options.graphOptimizationLevel || "auto").toLowerCase();
  const graphOptimizationLevel =
    requestedGraphOptimizationLevel && requestedGraphOptimizationLevel !== "auto"
      ? requestedGraphOptimizationLevel
      : provider === "webgpu" || provider === "webnn"
        ? "disabled"
        : "all";
  const sessionOptions = {
    executionProviders: [executionProvider],
    graphOptimizationLevel,
    executionMode: "sequential",
    enableCpuMemArena: true,
    enableMemPattern: provider !== "webgpu",
  };
  const graphCaptureSafe =
    provider === "webgpu" &&
    options.webgpuGraphCapture &&
    !String(options.xfeatUrl || DEFAULTS.xfeatUrl).includes("2048_dynamic");
  if (graphCaptureSafe) {
    sessionOptions.enableGraphCapture = true;
  }
  return sessionOptions;
}

function executionProviderFor(provider, options) {
  if (provider === "webgpu") {
    const ep = {
      name: "webgpu",
      preferredLayout: options.webgpuPreferredLayout || DEFAULTS.webgpuPreferredLayout,
    };
    if (state.webgpuDevice) ep.device = state.webgpuDevice;
    return ep;
  }
  if (provider === "webnn") {
    return {
      name: "webnn",
      deviceType: options.webnnDeviceType || DEFAULTS.webnnDeviceType,
      powerPreference: options.webnnPowerPreference || DEFAULTS.webnnPowerPreference,
    };
  }
  return provider;
}

async function loadOpenCv(primaryUrl, fallbackUrl) {
  if (state.opencv?.Mat) return state.opencv;
  if (self.cv?.Mat) return self.cv;
  if (self.cv?.then) return await self.cv;
  try {
    return await loadOpenCvUrl(primaryUrl);
  } catch (primaryError) {
    if (self.cv?.Mat) return self.cv;
    if (self.cv?.then) return await self.cv;
    if (!fallbackUrl || fallbackUrl === primaryUrl) throw primaryError;
    self.cv = undefined;
    self.Module = undefined;
    return await loadOpenCvUrl(fallbackUrl);
  }
}

async function loadOpenCvUrl(url) {
  const scriptUrl = resolveUrl(url);
  const wasmUrl = scriptUrl.includes("scansavy-opencv-geometry.js")
    ? new URL("scansavy-opencv-geometry.wasm", scriptUrl).href
    : new URL("scansavy-opencv.wasm", scriptUrl).href;
  self.Module = {
    locateFile(path, prefix) {
      if (path === "opencv_js.wasm" || path.endsWith(".wasm")) return wasmUrl;
      return new URL(path, prefix || scriptUrl).href;
    },
  };
  importScripts(scriptUrl);
  if (self.cv?.then) return await self.cv;
  if (self.cv?.Mat) return self.cv;
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for OpenCV runtime from ${url}`)), 15000);
    self.cv.onRuntimeInitialized = () => {
      clearTimeout(timeout);
      resolve(self.cv);
    };
  });
}

async function loadMapPack(payload) {
  const started = performance.now();
  const sidecar = payload.sidecar || await fetchJson(payload.sidecarUrl);
  const sidecarBaseUrl = resolveUrl(payload.sidecarUrl || state.options.sidecarBaseUrl || self.location.href);
  const supported = new Set(["scansavy.mappack.xfeat-lg.v0", "scansavy.mappack.xfeat-lg.v1"]);
  if (!supported.has(sidecar.schemaVersion)) {
    throw new Error(`Unsupported sidecar schemaVersion: ${sidecar.schemaVersion}`);
  }

  state.hydratedKeyframes = new Map();
  state.hydratedOrder = [];
  state.keyframeTensorCache = new Map();
  state.keyframeTensorOrder = [];
  state.keyframeTensorStats = {
    hits: 0,
    misses: 0,
    created: 0,
    evicted: 0,
    precacheRequests: 0,
    precacheKeyframes: 0,
    lastPrecacheElapsedMs: 0,
  };
  state.covisibilityByKeyframe = covisibilityMap(sidecar);
  state.sidecarBaseUrl = sidecarBaseUrl;
  const keyframes = [];
  const lazy = sidecar.schemaVersion === "scansavy.mappack.xfeat-lg.v1" && state.options.lazyMapPack !== false && payload.eagerLoad !== true;
  for (const keyframe of sidecar.keyframes || []) {
    keyframes.push(lazy ? keyframeMetadata(keyframe, sidecarBaseUrl, sidecar) : await hydrateKeyframe(keyframe, sidecarBaseUrl, sidecar));
  }
  state.sidecar = sidecar;
  state.keyframes = keyframes.filter((keyframe) =>
    keyframe.count > 0 &&
    keyframe.validLandmarkCount >= 4
  );

  return {
    status: state.keyframes.length > 0 ? "ready" : "failed",
    descriptorMode: sidecar.descriptorMode || "xfeat-lg-v0",
    schemaVersion: sidecar.schemaVersion,
    lazyMapPack: lazy,
    keyframeCount: state.keyframes.length,
    descriptorDim: sidecar.descriptorDim || 64,
    retrievalStrategy: sidecar.retrieval?.strategy || null,
    stableLandmarkCount: Number(sidecar.covisibility?.stableLandmarkCount || 0),
    elapsedMs: roundMs(performance.now() - started),
  };
}

function keyframeMetadata(keyframe, sidecarBaseUrl, sidecar) {
  const descriptorDim = Number(keyframe.descriptorDim || sidecar.descriptorDim || 64);
  const featureCount = Math.max(0, Number(keyframe.featureCount || 0));
  const validLandmarkCount = Math.max(0, Number(keyframe.geometryFeatureCount || keyframe.landmarkCount || 0));
  const retrieval = keyframe.retrieval || retrievalRowForKeyframe(sidecar, keyframe.id) || {};
  const descriptorCentroid = Array.isArray(retrieval.descriptorCentroid)
    ? Float32Array.from(retrieval.descriptorCentroid.map(Number))
    : null;
  return {
    id: keyframe.id,
    frameIndex: finiteOrNull(keyframe.frameIndex),
    sourceFrameIndex: finiteOrNull(keyframe.sourceFrameIndex ?? keyframe.frameIndex),
    posePosition: keyframePosePosition(keyframe, retrieval),
    retrieval,
    retrievalTags: Array.isArray(keyframe.retrievalTags) ? keyframe.retrievalTags : Array.isArray(retrieval.tokens) ? retrieval.tokens : [],
    width: Number(keyframe.width || sidecar.cameraModel?.width || 0),
    height: Number(keyframe.height || sidecar.cameraModel?.height || 0),
    cameraModel: keyframe.cameraModel || sidecar.cameraModel || null,
    descriptorDim,
    descriptorCentroid,
    validLandmarkCount,
    count: featureCount,
    assets: keyframe.assets || {},
    descriptorFormat: keyframe.descriptorFormat || sidecar.descriptorFormat || "float16",
    sidecarBaseUrl,
    sidecar,
    hydrated: false,
  };
}

function retrievalRowForKeyframe(sidecar, keyframeId) {
  return (sidecar.retrieval?.keyframes || []).find((row) => String(row.id) === String(keyframeId)) || null;
}

function keyframePosePosition(keyframe, retrieval = {}) {
  const candidates = [
    keyframe?.pose?.position,
    keyframe?.posePosition,
    keyframe?.cameraWorld,
    keyframe?.world,
    retrieval?.posePosition,
    retrieval?.position,
    retrieval?.cameraWorld,
  ];
  for (const value of candidates) {
    const position = vector3From(value);
    if (position) return position;
  }
  return null;
}

function vector3From(value) {
  if (Array.isArray(value) && value.length >= 3) {
    const out = value.slice(0, 3).map(Number);
    return out.every(Number.isFinite) ? out : null;
  }
  if (value && typeof value === "object") {
    const out = [value.x, value.y, value.z].map(Number);
    return out.every(Number.isFinite) ? out : null;
  }
  return null;
}

function distance3(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 3 || b.length < 3) return Number.POSITIVE_INFINITY;
  const dx = Number(a[0]) - Number(b[0]);
  const dy = Number(a[1]) - Number(b[1]);
  const dz = Number(a[2]) - Number(b[2]);
  return Number.isFinite(dx) && Number.isFinite(dy) && Number.isFinite(dz)
    ? Math.hypot(dx, dy, dz)
    : Number.POSITIVE_INFINITY;
}

function covisibilityMap(sidecar) {
  const map = new Map();
  for (const row of sidecar.covisibility?.keyframes || []) {
    map.set(String(row.id), row);
  }
  return map;
}

async function ensureHydratedKeyframe(keyframe) {
  if (keyframe.hydrated) return keyframe;
  const id = String(keyframe.id);
  const cached = state.hydratedKeyframes.get(id);
  if (cached) return cached;
  const hydrated = await hydrateKeyframe(keyframe, keyframe.sidecarBaseUrl || state.sidecarBaseUrl, keyframe.sidecar || state.sidecar);
  hydrated.retrieval = keyframe.retrieval || hydrated.retrieval;
  hydrated.covisibility = state.covisibilityByKeyframe.get(id) || null;
  hydrated.hydrated = true;
  state.hydratedKeyframes.set(id, hydrated);
  state.hydratedOrder.push(id);
  const maxHydrated = Math.max(1, Number(state.options.maxHydratedKeyframes || DEFAULTS.maxHydratedKeyframes));
  while (state.hydratedOrder.length > maxHydrated) {
    const evictId = state.hydratedOrder.shift();
    if (evictId && evictId !== state.lastAcceptedKeyframeId) {
      state.hydratedKeyframes.delete(evictId);
      evictTensorCacheForKeyframe(evictId);
    }
  }
  return hydrated;
}

async function precacheKeyframeTensors(payload = {}) {
  requireReady();
  const started = performance.now();
  const options = { ...state.options, ...(payload.options || {}) };
  const explicitIds = uniqueStrings([
    ...(Array.isArray(payload.keyframeIds) ? payload.keyframeIds : []),
    ...(Array.isArray(payload.candidateKeyframeIds) ? payload.candidateKeyframeIds : []),
  ]);
  const includeNeighbors = Boolean(payload.includeNeighbors ?? options.precacheNeighborKeyframeTensors);
  const selectedIds = uniqueStrings([
    ...explicitIds,
    ...(includeNeighbors ? explicitIds.flatMap((id) => neighborKeyframeIds(id)) : []),
  ]);
  const selected = selectedIds
    .map((id) => state.keyframes.find((candidate) => String(candidate.id) === String(id)))
    .filter(Boolean);
  const before = keyframeTensorCacheStats();
  const concurrency = Math.max(1, Number(options.precacheKeyframeTensorConcurrency || DEFAULTS.precacheKeyframeTensorConcurrency));
  const rows = await mapWithConcurrency(selected, Math.min(concurrency, Math.max(1, selected.length)), async (keyframe) => {
    const hydrated = await ensureHydratedKeyframe(keyframe);
    const bundle = ensureKeyframeTensorBundle(hydrated, options);
    return {
      keyframeId: String(hydrated.id),
      cacheKey: bundle.cacheKey,
      cacheHit: Boolean(bundle.cacheHit),
      featureCount: hydrated.count,
    };
  });
  const elapsedMs = roundMs(performance.now() - started);
  state.keyframeTensorStats.precacheRequests += 1;
  state.keyframeTensorStats.precacheKeyframes += rows.length;
  state.keyframeTensorStats.lastPrecacheElapsedMs = elapsedMs;
  return {
    status: "ready",
    requestedKeyframeCount: explicitIds.length,
    includeNeighbors,
    selectedKeyframeCount: selected.length,
    cachedKeyframeCount: rows.length,
    elapsedMs,
    before,
    after: keyframeTensorCacheStats(),
    rows,
    runtimeDiagnostics: runtimeDiagnostics(),
  };
}

function keyframeTensorCacheStats() {
  return {
    hits: Number(state.keyframeTensorStats.hits || 0),
    misses: Number(state.keyframeTensorStats.misses || 0),
    created: Number(state.keyframeTensorStats.created || 0),
    evicted: Number(state.keyframeTensorStats.evicted || 0),
    precacheRequests: Number(state.keyframeTensorStats.precacheRequests || 0),
    precacheKeyframes: Number(state.keyframeTensorStats.precacheKeyframes || 0),
    lastPrecacheElapsedMs: Number(state.keyframeTensorStats.lastPrecacheElapsedMs || 0),
    entries: state.keyframeTensorCache.size,
  };
}

function keyframeTensorCacheKey(keyframe, options = {}) {
  const provider = state.provider || state.activeProvider || "unknown";
  const profile = options.runtimeProfile || options.profile || state.options.runtimeProfile || state.options.profile || "default";
  const architecture = normalizedOnnxArchitecture(options);
  const count = Number(keyframe?.count || 0);
  const dim = Number(keyframe?.descriptorDim || 64);
  return [provider, profile, architecture, keyframe?.id || "unknown", count, dim].join("|");
}

function ensureKeyframeTensorBundle(keyframe, options = {}) {
  const cacheKey = keyframeTensorCacheKey(keyframe, options);
  const cached = state.keyframeTensorCache.get(cacheKey);
  if (cached) {
    state.keyframeTensorStats.hits += 1;
    touchKeyframeTensorCache(cacheKey);
    return { ...cached, cacheHit: true, cacheKey };
  }
  state.keyframeTensorStats.misses += 1;
  const count = Number(keyframe.count || 0);
  const descriptorDim = Number(keyframe.descriptorDim || 64);
  const bundle = {
    keypointTensor: keyframe.keypointTensor || new state.ort.Tensor(
      "float32",
      keyframe.normalizedKeypoints || normalizeKptsForGlue(keyframe.keypoints, keyframe.width || 0, keyframe.height || 0),
      [1, count, 2],
    ),
    descriptorTensor: keyframe.descriptorTensor || new state.ort.Tensor(
      "float32",
      keyframe.descriptors,
      [1, count, descriptorDim],
    ),
    count,
    descriptorDim,
    createdAt: Date.now(),
  };
  keyframe.keypointTensor = bundle.keypointTensor;
  keyframe.descriptorTensor = bundle.descriptorTensor;
  state.keyframeTensorStats.created += 1;
  state.keyframeTensorCache.set(cacheKey, bundle);
  state.keyframeTensorOrder.push(cacheKey);
  trimKeyframeTensorCache();
  return { ...bundle, cacheHit: false, cacheKey };
}

function touchKeyframeTensorCache(cacheKey) {
  const index = state.keyframeTensorOrder.indexOf(cacheKey);
  if (index >= 0) state.keyframeTensorOrder.splice(index, 1);
  state.keyframeTensorOrder.push(cacheKey);
}

function trimKeyframeTensorCache() {
  const maxEntries = Math.max(1, Number(state.options.keyframeTensorCacheMaxEntries || DEFAULTS.keyframeTensorCacheMaxEntries));
  while (state.keyframeTensorOrder.length > maxEntries) {
    const evictKey = state.keyframeTensorOrder.shift();
    if (!evictKey) continue;
    state.keyframeTensorCache.delete(evictKey);
    state.keyframeTensorStats.evicted += 1;
  }
}

function evictTensorCacheForKeyframe(keyframeId) {
  const needle = `|${String(keyframeId)}|`;
  for (const cacheKey of Array.from(state.keyframeTensorCache.keys())) {
    if (!cacheKey.includes(needle)) continue;
    state.keyframeTensorCache.delete(cacheKey);
    const index = state.keyframeTensorOrder.indexOf(cacheKey);
    if (index >= 0) state.keyframeTensorOrder.splice(index, 1);
    state.keyframeTensorStats.evicted += 1;
  }
}

function scheduleKeyframePrefetch(keyframeId) {
  const count = Math.max(0, Number(state.options.prefetchNeighborKeyframes || DEFAULTS.prefetchNeighborKeyframes));
  if (!count || !keyframeId) return;
  const neighbors = neighborKeyframeIds(keyframeId).slice(0, count);
  if (!neighbors.length) return;
  setTimeout(() => {
    const concurrency = Math.max(1, Math.min(Number(state.options.precacheKeyframeTensorConcurrency || DEFAULTS.precacheKeyframeTensorConcurrency), neighbors.length));
    void mapWithConcurrency(neighbors, concurrency, async (id) => {
      const keyframe = state.keyframes.find((candidate) => String(candidate.id) === String(id));
      if (!keyframe || keyframe.hydrated || state.hydratedKeyframes.has(String(keyframe.id))) return null;
      try {
        const hydrated = await ensureHydratedKeyframe(keyframe);
        if (normalizedOnnxArchitecture(state.options) === "split") ensureKeyframeTensorBundle(hydrated, state.options);
        return hydrated;
      } catch {
        return null;
      }
    });
  }, 0);
}

function neighborKeyframeIds(keyframeId) {
  const id = String(keyframeId);
  const selected = [];
  const selectedSet = new Set();
  const add = (value) => {
    if (value == null) return;
    const normalized = String(value);
    if (normalized && normalized !== id && !selectedSet.has(normalized)) {
      selected.push(normalized);
      selectedSet.add(normalized);
    }
  };
  const row = state.covisibilityByKeyframe.get(id);
  for (const key of ["neighbors", "neighborIds", "covisibleKeyframes", "overlapKeyframes", "trajectoryNeighbors"]) {
    const values = row?.[key];
    if (Array.isArray(values)) {
      for (const value of values) add(typeof value === "object" ? value.id ?? value.keyframeId : value);
    }
  }
  const keyframe = state.keyframes.find((candidate) => String(candidate.id) === id);
  for (const key of ["neighbors", "neighborIds", "trajectoryNeighbors"]) {
    const values = keyframe?.retrieval?.[key] || keyframe?.[key];
    if (Array.isArray(values)) {
      for (const value of values) add(typeof value === "object" ? value.id ?? value.keyframeId : value);
    }
  }
  const hotRadius = Number(state.options.localNeighborhoodHotRadiusMeters || DEFAULTS.localNeighborhoodHotRadiusMeters);
  const warmRadius = Math.max(hotRadius, Number(state.options.localNeighborhoodWarmRadiusMeters || DEFAULTS.localNeighborhoodWarmRadiusMeters));
  const center = keyframe?.posePosition || keyframePosePosition(keyframe, keyframe?.retrieval || {});
  if (center && Number.isFinite(warmRadius) && warmRadius > 0) {
    const spatial = state.keyframes
      .map((candidate) => {
        const distanceMeters = distance3(center, candidate.posePosition || keyframePosePosition(candidate, candidate.retrieval || {}));
        return { id: String(candidate.id), distanceMeters };
      })
      .filter((candidate) => candidate.id !== id && Number.isFinite(candidate.distanceMeters) && candidate.distanceMeters <= warmRadius)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
    const hot = spatial.filter((candidate) => candidate.distanceMeters <= hotRadius);
    const warm = spatial.filter((candidate) => candidate.distanceMeters > hotRadius);
    for (const candidate of [...hot, ...warm]) add(candidate.id);
  }
  const index = state.keyframes.findIndex((candidate) => String(candidate.id) === id);
  if (index >= 0) {
    for (let offset = 1; offset <= 4; offset += 1) {
      add(state.keyframes[index - offset]?.id);
      add(state.keyframes[index + offset]?.id);
    }
  }
  return selected;
}

async function hydrateKeyframe(keyframe, sidecarBaseUrl, sidecar) {
  const descriptorDim = Number(keyframe.descriptorDim || sidecar.descriptorDim || 64);
  const descriptorFormat = keyframe.descriptorFormat || sidecar.descriptorFormat || "float16";
  const assets = keyframe.assets || {};
  const keypoints = keyframe.keypoints
    ? Float32Array.from(flatten(keyframe.keypoints))
    : await fetchFloatArray(assets.keypoints, sidecarBaseUrl, "float32");
  const descriptors = keyframe.descriptors
    ? Float32Array.from(flatten(keyframe.descriptors))
    : await fetchFloatArray(assets.descriptors, sidecarBaseUrl, descriptorFormat);
  const scores = keyframe.scores
    ? Float32Array.from(keyframe.scores)
    : await fetchFloatArray(assets.scores, sidecarBaseUrl, "float32", true);
  const landmarks = keyframe.landmarks
    ? Float32Array.from(flatten(keyframe.landmarks))
    : await fetchFloatArray(assets.landmarks, sidecarBaseUrl, "float32");
  const landmarkIds = keyframe.landmarkIds || await fetchJsonArray(assets.landmarkIds, sidecarBaseUrl, true);
  const rawFeatureCount = Math.min(
    Math.floor(keypoints.length / 2),
    Math.floor(descriptors.length / descriptorDim),
  );
  const maxKeyframeFeatures = Math.max(1, Number(state.options.maxKeyframeFeatures || rawFeatureCount));
  const featureCount = Math.min(rawFeatureCount, maxKeyframeFeatures);
  const landmarkCount = Math.min(Math.floor(landmarks.length / 3), featureCount);
  const normalizedKeypoints = normalizeKptsForGlue(keypoints.slice(0, featureCount * 2), Number(keyframe.width || sidecar.cameraModel?.width || 0), Number(keyframe.height || sidecar.cameraModel?.height || 0));
  const descriptorRows = descriptors.slice(0, featureCount * descriptorDim);
  const validLandmarkMask = new Uint8Array(featureCount);
  let validLandmarkCount = 0;
  for (let i = 0; i < featureCount; i += 1) {
    const base = i * 3;
    const valid = i < landmarkCount &&
      Number.isFinite(landmarks[base]) &&
      Number.isFinite(landmarks[base + 1]) &&
      Number.isFinite(landmarks[base + 2]);
    if (valid) {
      validLandmarkMask[i] = 1;
      validLandmarkCount += 1;
    }
  }

  return {
    id: keyframe.id,
    frameIndex: finiteOrNull(keyframe.frameIndex),
    sourceFrameIndex: finiteOrNull(keyframe.sourceFrameIndex ?? keyframe.frameIndex),
    retrievalTags: Array.isArray(keyframe.retrievalTags) ? keyframe.retrievalTags : [],
    width: Number(keyframe.width || sidecar.cameraModel?.width || 0),
    height: Number(keyframe.height || sidecar.cameraModel?.height || 0),
    cameraModel: keyframe.cameraModel || sidecar.cameraModel || null,
    assets,
    sidecarBaseUrl,
    sourceRgbPath: keyframe.sourceRgbPath || "",
    imageAsset: assets.image || assets.fusedPairImage || "",
    imageUrl: assets.image || assets.fusedPairImage ? resolveUrl(assets.image || assets.fusedPairImage, sidecarBaseUrl) : "",
    modelInputTransform: keyframe.modelInputTransform || null,
    keypoints: keypoints.slice(0, featureCount * 2),
    descriptors: descriptorRows,
    scores: scores?.length ? scores.slice(0, featureCount) : null,
    landmarks: landmarks.length ? landmarks.slice(0, featureCount * 3) : new Float32Array(featureCount * 3).fill(Number.NaN),
    landmarkIds: Array.isArray(landmarkIds) ? landmarkIds.slice(0, featureCount) : null,
    validLandmarkMask,
    validLandmarkCount,
    descriptorDim,
    retrieval: keyframe.retrieval || retrievalRowForKeyframe(sidecar, keyframe.id) || {},
    posePosition: keyframePosePosition(keyframe, keyframe.retrieval || retrievalRowForKeyframe(sidecar, keyframe.id) || {}),
    descriptorCentroid: descriptorCentroid(descriptors, featureCount, descriptorDim),
    normalizedKeypoints,
    keypointTensor: new state.ort.Tensor("float32", normalizedKeypoints, [1, featureCount, 2]),
    descriptorTensor: new state.ort.Tensor("float32", descriptorRows, [1, featureCount, descriptorDim]),
    count: featureCount,
  };
}

async function localizeBurst(payload) {
  requireReady();
  const started = performance.now();
  const frames = payload.frames || [];
  const options = { ...state.options, ...(payload.options || {}) };
  postProgress({
    kind: "localize",
    stage: "start",
    provider: state.provider,
    frameCount: frames.length,
    candidateLimit: Number(options.candidateLimit || DEFAULTS.candidateLimit),
    maxLighterGluePairsPerBurst: Number(options.maxLighterGluePairsPerBurst || DEFAULTS.maxLighterGluePairsPerBurst),
  });
  await flushProgress();
  const frameResults = [];
  const previousAcceptedKeyframeId = state.lastAcceptedKeyframeId;
  const matcherBudget = {
    max: Math.max(1, Number(options.maxLighterGluePairsPerBurst || DEFAULTS.maxLighterGluePairsPerBurst)),
    tried: 0,
    remaining: Math.max(1, Number(options.maxLighterGluePairsPerBurst || DEFAULTS.maxLighterGluePairsPerBurst)),
  };

  const orderedFrames = orderBurstFrames(frames, options);
  if (shouldUseParallelBurstExtraction(orderedFrames, options)) {
    frameResults.push(...await localizeBurstParallel(orderedFrames, options, matcherBudget));
  } else {
    for (const frame of orderedFrames) {
      if (matcherBudget.remaining <= 0) break;
      const frameResult = await localizeFrame(frame, options, matcherBudget);
      frameResults.push(frameResult);
      if (options.stopBurstAfterAcceptedCandidate !== false) {
        const acceptedFrame = frameResult.status === "ready"
          && frameResult.matchCount >= Number(options.minMatches)
          && frameResult.inlierCount >= Number(options.minInliers)
          && frameResult.confidence >= Number(options.minConfidence);
        if (acceptedFrame) break;
      }
    }
  }

  const candidates = frameResults.filter((result) => result.status === "ready");
  const frameBest = candidates.sort((a, b) => scoreLocalization(b) - scoreLocalization(a))[0] || null;
  const fusedBest = options.fuseBurstCandidates === false ? null : solveFusedBurstCandidate(frameResults, options);
  const best = [frameBest, fusedBest]
    .filter(Boolean)
    .sort((a, b) => scoreLocalization(b) - scoreLocalization(a))[0] || null;
  const accepted = Boolean(best)
    && best.matchCount >= Number(options.minMatches)
    && best.inlierCount >= Number(options.minInliers)
    && best.confidence >= Number(options.minConfidence);
  if (options.suppressStateUpdate) {
    state.lastAcceptedKeyframeId = previousAcceptedKeyframeId;
  } else if (accepted && best?.keyframeId) {
    state.lastAcceptedKeyframeId = String(best.keyframeId);
    scheduleKeyframePrefetch(best.keyframeId);
  }

  const response = {
    status: accepted ? "ready" : "rejected",
    isWarmup: Boolean(options.warmup),
    descriptorMode: state.sidecar?.descriptorMode || "xfeat-lg-v0",
    provider: state.provider,
    runtimeDiagnostics: runtimeDiagnostics(),
    frameCount: frames.length,
    processedFrameCount: frameResults.length,
    lighterGluePairsTried: matcherBudget.tried,
    lighterGluePairBudget: matcherBudget.max,
    burstFrameOrder: options.burstFrameOrder || DEFAULTS.burstFrameOrder,
    parallelBurstExtraction: Boolean(options.parallelBurstExtraction),
    burstFrameExtractionConcurrency: Number(options.burstFrameExtractionConcurrency || DEFAULTS.burstFrameExtractionConcurrency),
    effectiveBurstFrameExtractionConcurrency: burstFrameExtractionConcurrencyForProvider(state.provider, options),
    best,
    frameBest,
    fusedBest,
    confidence: best?.confidence || 0,
    matchCount: best?.matchCount || 0,
    rawMatchCount: best?.rawMatchCount || 0,
    geometryMatchCount: best?.geometryMatchCount || best?.matchCount || 0,
    inlierCount: best?.inlierCount || 0,
    reprojectionErrorPx: best?.reprojectionErrorPx ?? null,
    frameResults,
    elapsedMs: roundMs(performance.now() - started),
    reason: accepted ? "accepted" : rejectionReason(best, options),
  };
  postProgress({
    kind: "localize",
    stage: "done",
    provider: state.provider,
    status: response.status,
    elapsedMs: response.elapsedMs,
    confidence: response.confidence,
    inlierCount: response.inlierCount,
    matchCount: response.matchCount,
  });
  return response;
}

function shouldUseParallelBurstExtraction(frames, options) {
  return Boolean(options.parallelBurstExtraction)
    && Array.isArray(frames)
    && frames.length > 1
    && Number(options.maxLighterGluePairsPerBurst || DEFAULTS.maxLighterGluePairsPerBurst) > 0;
}

async function localizeBurstParallel(frames, options, matcherBudget) {
  const selectedFrames = frames.slice(0, Math.max(1, Number(options.parallelBurstFrameLimit || DEFAULTS.parallelBurstFrameLimit)));
  const extractionConcurrency = burstFrameExtractionConcurrencyForProvider(state.provider, options);
  const extractedFrames = await mapWithConcurrency(
    selectedFrames,
    extractionConcurrency,
    async (frame, frameOrderIndex) => {
      const started = performance.now();
      const imageData = normalizeImageData(frame.imageData || frame);
      const extracted = await runXFeat(imageData, options);
      const shortlist = shortlistKeyframes(extracted, options, frame);
      return {
        frame,
        frameOrderIndex,
        imageData,
        extracted,
        shortlist,
        elapsedMs: roundMs(performance.now() - started),
      };
    },
  );

  const keyframeLimitPerFrame = Math.max(1, Number(options.parallelBurstCandidatesPerFrame || options.candidateLimit || DEFAULTS.parallelBurstCandidatesPerFrame));
  const pairPool = [];
  for (const entry of extractedFrames) {
    const keyframes = (entry.shortlist.keyframes || []).slice(0, keyframeLimitPerFrame);
    keyframes.forEach((keyframe, rank) => {
      pairPool.push({
        entry,
        keyframe,
        rank,
        score: cheapBurstPairScore(entry, rank),
      });
    });
  }
  pairPool.sort((left, right) => left.score - right.score);

  const pairLimit = Math.max(1, matcherBudget ? matcherBudget.remaining : Number(options.maxLighterGluePairsPerBurst || DEFAULTS.maxLighterGluePairsPerBurst));
  const pairsToTry = pairPool.slice(0, pairLimit);
  const uniqueKeyframes = uniqueById(pairsToTry.map((pair) => pair.keyframe));
  const hydrationStarted = performance.now();
  const hydrated = await mapWithConcurrency(
    uniqueKeyframes,
    Math.max(1, Math.min(8, hydrationConcurrencyForProvider(state.provider, options))),
    (keyframe) => ensureHydratedKeyframe(keyframe),
  );
  const hydratedById = new Map(hydrated.map((keyframe) => [String(keyframe.id), keyframe]));
  const hydrationElapsedMs = roundMs(performance.now() - hydrationStarted);

  const perFrame = new Map(extractedFrames.map((entry) => [entry, {
    status: "failed",
    frameIndex: entry.frame.frameIndex ?? null,
    detectedKeypoints: entry.extracted.count,
    shortlistStrategy: entry.shortlist.strategy,
    shortlistConfidence: entry.shortlist.confidence,
    shortlistEscalated: entry.shortlist.escalated,
    candidateKeyframes: [],
    candidateResults: [],
    lighterGluePairsTried: 0,
    matcherBudgetRemaining: matcherBudget ? matcherBudget.remaining : null,
    timings: {
      xfeatElapsedMs: entry.extracted.elapsedMs,
      preprocessElapsedMs: entry.extracted.preprocessElapsedMs,
      xfeatInferenceElapsedMs: entry.extracted.inferenceElapsedMs,
      retrievalElapsedMs: entry.shortlist.elapsedMs,
      hydrationElapsedMs,
      lighterGlueElapsedMs: 0,
      pnpElapsedMs: 0,
    },
    elapsedMs: entry.elapsedMs,
    reason: "No candidate keyframe produced a valid PnP solution.",
  }]));

  for (const pair of pairsToTry) {
    if (matcherBudget && matcherBudget.remaining <= 0) break;
    const keyframe = hydratedById.get(String(pair.keyframe.id));
    if (!keyframe) continue;
    if (matcherBudget) {
      matcherBudget.tried += 1;
      matcherBudget.remaining -= 1;
    }
    const frameResult = perFrame.get(pair.entry);
    frameResult.candidateKeyframes.push(keyframe.id);
    const matched = await runMatcherForCandidate(pair.entry.imageData, pair.entry.extracted, keyframe, options);
    const candidate = solvePnpForMatches(matched, keyframe, matched.query || pair.entry.extracted, pair.entry.frame.frameIndex ?? null, options);
    candidate.parallelBurstExtraction = true;
    candidate.burstFrameOrderIndex = pair.entry.frameOrderIndex;
    candidate.shortlistRank = pair.rank;
    frameResult.candidateResults.push(candidate);
    frameResult.lighterGluePairsTried += 1;
    frameResult.matcherBudgetRemaining = matcherBudget ? matcherBudget.remaining : null;
    frameResult.timings.lighterGlueElapsedMs = roundMs(Number(frameResult.timings.lighterGlueElapsedMs || 0) + Number(candidate.matcherElapsedMs || 0));
    frameResult.timings.pnpElapsedMs = roundMs(Number(frameResult.timings.pnpElapsedMs || 0) + Number(candidate.pnpElapsedMs || 0));
    const meetsGate = candidate.status === "ready"
      && candidate.matchCount >= Number(options.minMatches)
      && candidate.inlierCount >= Number(options.minInliers)
      && candidate.confidence >= Number(options.minConfidence);
    if (options.stopBurstAfterAcceptedCandidate !== false && meetsGate) break;
  }

  return extractedFrames.map((entry) => finalizeParallelFrameResult(perFrame.get(entry), entry));
}

function cheapBurstPairScore(entry, rank) {
  const retrievalPenalty = Math.max(0, 1 - Number(entry.shortlist.confidence || 0)) * 0.1;
  const keypointPenalty = entry.extracted.count ? Math.max(0, 384 - entry.extracted.count) / 10000 : 1;
  return Number(rank || 0) + retrievalPenalty + keypointPenalty + Number(entry.frameOrderIndex || 0) * 0.01;
}

function uniqueById(items) {
  const out = [];
  const seen = new Set();
  for (const item of items || []) {
    const id = String(item?.id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

function finalizeParallelFrameResult(frameResult, entry) {
  const best = (frameResult.candidateResults || [])
    .filter((result) => result.status === "ready")
    .sort((a, b) => scoreLocalization(b) - scoreLocalization(a))[0] || null;
  const elapsedMs = roundMs(Number(entry.elapsedMs || 0) + Number(frameResult.timings.lighterGlueElapsedMs || 0) + Number(frameResult.timings.pnpElapsedMs || 0));
  if (!best) {
    return {
      ...frameResult,
      elapsedMs,
      reason: frameResult.candidateResults.length
        ? "Parallel burst candidates did not produce an accepted PnP solution."
        : "Parallel burst extraction found no candidate pairs within the LighterGlue budget.",
    };
  }
  return {
    ...best,
    detectedKeypoints: entry.extracted.count,
    shortlistStrategy: entry.shortlist.strategy,
    shortlistConfidence: entry.shortlist.confidence,
    shortlistEscalated: entry.shortlist.escalated,
    candidateKeyframes: frameResult.candidateKeyframes,
    candidateResults: frameResult.candidateResults,
    lighterGluePairsTried: frameResult.lighterGluePairsTried,
    matcherBudgetRemaining: frameResult.matcherBudgetRemaining,
    timings: frameResult.timings,
    elapsedMs,
  };
}

function burstFrameExtractionConcurrencyForProvider(provider, options) {
  const generic = Math.max(1, Number(options.burstFrameExtractionConcurrency || DEFAULTS.burstFrameExtractionConcurrency));
  // ONNX Runtime Web InferenceSession.run is not reentrant in the browser worker:
  // overlapping runs on one XFeat session fail with "Session already started".
  // Keep extraction planning burst-aware, but serialize model inference until a
  // deliberate multi-session pool is introduced and memory-profiled on device.
  return 1;
}

async function warmupRuntime(payload) {
  requireReady();
  const started = performance.now();
  const suppliedFrames = Array.isArray(payload.frames) ? payload.frames : [];
  const frames = suppliedFrames.length
    ? suppliedFrames.slice(0, Math.max(1, Number(payload.frameCount || DEFAULTS.warmupFrames)))
    : [syntheticWarmupFrame(payload)];
  const options = {
    ...state.options,
    ...(payload.options || {}),
    warmup: true,
    suppressStateUpdate: true,
    candidateLimit: Math.max(1, Number(payload.candidateLimit || DEFAULTS.warmupCandidateLimit)),
    fallbackCandidateLimit: Math.max(1, Number(payload.candidateLimit || DEFAULTS.warmupCandidateLimit)),
    maxCandidateLimit: Math.max(1, Number(payload.candidateLimit || DEFAULTS.warmupCandidateLimit)),
    maxQueryFeatures: Math.max(64, Number(payload.maxQueryFeatures || DEFAULTS.warmupMaxQueryFeatures)),
    maxKeyframeFeatures: Math.max(64, Number(payload.maxKeyframeFeatures || DEFAULTS.warmupMaxKeyframeFeatures)),
    maxLighterGluePairsPerBurst: Math.max(1, Number(payload.maxLighterGluePairsPerBurst || DEFAULTS.warmupMaxLighterGluePairs)),
    adaptiveCandidateEscalation: false,
    fuseBurstCandidates: false,
    stopAfterAcceptedCandidate: true,
    stopBurstAfterAcceptedCandidate: true,
  };
  try {
    const result = await localizeBurst({ frames, options });
    state.warmedUp = true;
    state.warmupSummary = {
      status: "ready",
      accepted: result.status === "ready",
      provider: state.provider,
      frameCount: result.frameCount,
      processedFrameCount: result.processedFrameCount,
      lighterGluePairsTried: result.lighterGluePairsTried,
      elapsedMs: roundMs(performance.now() - started),
      burstElapsedMs: result.elapsedMs,
      confidence: result.confidence,
      inlierCount: result.inlierCount,
      matchCount: result.matchCount,
      reason: result.reason,
      hydratedKeyframes: state.hydratedKeyframes.size,
    };
    return { ...state.warmupSummary, runtimeDiagnostics: runtimeDiagnostics(), result };
  } catch (error) {
    state.warmedUp = true;
    state.warmupSummary = {
      status: "warning",
      accepted: false,
      provider: state.provider,
      frameCount: frames.length,
      processedFrameCount: 0,
      lighterGluePairsTried: 0,
      elapsedMs: roundMs(performance.now() - started),
      reason: String(error?.message || error),
      hydratedKeyframes: state.hydratedKeyframes.size,
    };
    return { ...state.warmupSummary, runtimeDiagnostics: runtimeDiagnostics() };
  }
}

function syntheticWarmupFrame(payload = {}) {
  const width = Math.max(32, Number(payload.width || 320));
  const height = Math.max(32, Number(payload.height || 240));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = (x * 3 + y) % 256;
      data[offset + 1] = (x + y * 2) % 256;
      data[offset + 2] = (x ^ y) % 256;
      data[offset + 3] = 255;
    }
  }
  return {
    frameIndex: -1,
    runtimeIndex: -1,
    queryFrameIndex: -1,
    sourceFrameIndex: -1,
    burstIndex: -1,
    burstFrameIndex: 0,
    width,
    height,
    data,
  };
}

function orderBurstFrames(frames, options) {
  const input = Array.isArray(frames) ? frames : [];
  if (options.burstFrameOrder !== "center-first" || input.length <= 2) return input;
  return input
    .map((frame, index) => ({ frame, index }))
    .sort((left, right) => {
      const center = (input.length - 1) / 2;
      const leftOrder = finiteOrNull(left.frame.burstFrameIndex) ?? left.index;
      const rightOrder = finiteOrNull(right.frame.burstFrameIndex) ?? right.index;
      const distance = Math.abs(leftOrder - center) - Math.abs(rightOrder - center);
      if (distance !== 0) return distance;
      return leftOrder - rightOrder;
    })
    .map((entry) => entry.frame);
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const input = Array.isArray(items) ? items : [];
  const output = new Array(input.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, input.length || 1));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < input.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      output[currentIndex] = await mapper(input[currentIndex], currentIndex);
    }
  }));
  return output;
}

async function localizeFrame(frame, options, matcherBudget = null) {
  const started = performance.now();
  const imageData = normalizeImageData(frame.imageData || frame);
  const extracted = await runXFeat(imageData, options);
  const shortlist = shortlistKeyframes(extracted, options, frame);
  const hydrationStarted = performance.now();
  const keyframes = [];
  const remainingMatcherPairs = matcherBudget ? Math.max(0, matcherBudget.remaining) : shortlist.keyframes.length;
  const keyframesToMatch = shortlist.keyframes.slice(0, Math.max(0, remainingMatcherPairs));
  const hydrationConcurrency = hydrationConcurrencyForProvider(state.provider, options);
  keyframes.push(...await mapWithConcurrency(
    keyframesToMatch,
    Math.max(1, Math.min(8, hydrationConcurrency)),
    (keyframe) => ensureHydratedKeyframe(keyframe),
  ));
  const hydrationElapsedMs = roundMs(performance.now() - hydrationStarted);
  const candidateResults = [];

  for (const keyframe of keyframes) {
    if (matcherBudget && matcherBudget.remaining <= 0) break;
    if (matcherBudget) {
      matcherBudget.tried += 1;
      matcherBudget.remaining -= 1;
    }
    const matched = await runMatcherForCandidate(imageData, extracted, keyframe, options);
    const candidate = solvePnpForMatches(matched, keyframe, matched.query || extracted, frame.frameIndex ?? null, options);
    candidateResults.push(candidate);
    if (options.stopAfterAcceptedCandidate !== false && candidate.status === "ready") {
      const meetsGate = candidate.matchCount >= Number(options.minMatches)
        && candidate.inlierCount >= Number(options.minInliers)
        && candidate.confidence >= Number(options.minConfidence);
      if (meetsGate) break;
    }
  }

  const best = candidateResults
    .filter((result) => result.status === "ready")
    .sort((a, b) => scoreLocalization(b) - scoreLocalization(a))[0] || null;

  if (!best) {
    return {
      status: "failed",
      frameIndex: frame.frameIndex ?? null,
      detectedKeypoints: extracted.count,
      shortlistStrategy: shortlist.strategy,
      shortlistConfidence: shortlist.confidence,
      shortlistEscalated: shortlist.escalated,
      candidateKeyframes: keyframes.map((keyframe) => keyframe.id),
      candidateResults,
      lighterGluePairsTried: candidateResults.length,
      matcherBudgetRemaining: matcherBudget ? matcherBudget.remaining : null,
      timings: {
        xfeatElapsedMs: extracted.elapsedMs,
        preprocessElapsedMs: extracted.preprocessElapsedMs,
        xfeatInferenceElapsedMs: extracted.inferenceElapsedMs,
        retrievalElapsedMs: shortlist.elapsedMs,
        hydrationElapsedMs,
        lighterGlueElapsedMs: roundMs(candidateResults.reduce((total, candidate) => total + Number(candidate.matcherElapsedMs || 0), 0)),
        pnpElapsedMs: roundMs(candidateResults.reduce((total, candidate) => total + Number(candidate.pnpElapsedMs || 0), 0)),
      },
      elapsedMs: roundMs(performance.now() - started),
      reason: "No candidate keyframe produced a valid PnP solution.",
    };
  }

  return {
    ...best,
    detectedKeypoints: extracted.count,
    shortlistStrategy: shortlist.strategy,
    shortlistConfidence: shortlist.confidence,
    shortlistEscalated: shortlist.escalated,
    candidateKeyframes: keyframes.map((keyframe) => keyframe.id),
    candidateResults,
    lighterGluePairsTried: candidateResults.length,
    matcherBudgetRemaining: matcherBudget ? matcherBudget.remaining : null,
    timings: {
      xfeatElapsedMs: extracted.elapsedMs,
      preprocessElapsedMs: extracted.preprocessElapsedMs,
      xfeatInferenceElapsedMs: extracted.inferenceElapsedMs,
      retrievalElapsedMs: shortlist.elapsedMs,
      hydrationElapsedMs,
      lighterGlueElapsedMs: roundMs(candidateResults.reduce((total, candidate) => total + Number(candidate.matcherElapsedMs || 0), 0)),
      pnpElapsedMs: roundMs(candidateResults.reduce((total, candidate) => total + Number(candidate.pnpElapsedMs || 0), 0)),
    },
    elapsedMs: roundMs(performance.now() - started),
  };
}

function hydrationConcurrencyForProvider(provider, options) {
  const generic = Number(options.candidateHydrationConcurrency || DEFAULTS.candidateHydrationConcurrency);
  if (provider === "webgpu") {
    return Number(options.webgpuCandidateHydrationConcurrency || generic);
  }
  if (provider === "wasm") {
    return Number(options.wasmCandidateHydrationConcurrency || generic);
  }
  return generic;
}

async function runXFeat(imageData, options) {
  const started = performance.now();
  const frameIndex = imageData.frameIndex ?? imageData.runtimeIndex ?? null;
  postProgress({
    kind: "model-run",
    stage: "xfeat:start",
    provider: state.provider,
    frameIndex,
    width: imageData.width,
    height: imageData.height,
  });
  await flushProgress();
  const prep = preprocessImage(imageData, options);
  const preprocessElapsedMs = roundMs(performance.now() - started);
  const input = new state.ort.Tensor("float32", prep.tensor, [1, 3, prep.height, prep.width]);
  const inputName = state.xfeatSession.inputNames?.[0] || "images";
  const inferenceStarted = performance.now();
  const output = await withTimeout(
    state.xfeatSession.run({ [inputName]: input }),
    inferenceTimeoutMs("xfeat", options),
    `XFeat ${state.provider || "unknown"} inference`,
  );
  const inferenceElapsedMs = roundMs(performance.now() - inferenceStarted);
  const keypointsRaw = outputTensor(output, ["keypoints", "kpts", "mkpts"], 0);
  const descriptorsRaw = outputTensor(output, ["descriptors", "desc", "descs"], 1);
  const scoresRaw = outputTensor(output, ["scores", "score", "prob"], 2, false);
  const keypoints = mapKeypointsToSource(keypointsRaw.data, prep, keypointsRaw.dims);
  const descriptors = descriptorsRaw.data instanceof Float32Array ? descriptorsRaw.data : Float32Array.from(descriptorsRaw.data);
  const scores = scoresRaw ? (scoresRaw.data instanceof Float32Array ? scoresRaw.data : Float32Array.from(scoresRaw.data)) : null;
  const rawCount = Math.min(Math.floor(keypoints.length / 2), Math.floor(descriptors.length / 64));
  const bounded = filterFeatureRowsToSourceBounds(keypoints, descriptors, scores, rawCount, 64, imageData.width, imageData.height);
  const selected = selectFeatureRows(
    bounded.keypoints,
    bounded.descriptors,
    bounded.scores,
    bounded.count,
    64,
    Number(options.maxQueryFeatures || options.topK || DEFAULTS.maxQueryFeatures),
  );
  const glueKeypoints = normalizeKptsForGlue(selected.keypoints, imageData.width, imageData.height);
  const response = {
    keypoints: selected.keypoints,
    descriptors: selected.descriptors,
    scores: selected.scores,
    count: selected.count,
    rawCount,
    boundedCount: bounded.count,
    width: imageData.width,
    height: imageData.height,
    descriptorCentroid: descriptorCentroid(selected.descriptors, selected.count, 64),
    normalizedKeypoints: glueKeypoints,
    keypointTensor: new state.ort.Tensor("float32", glueKeypoints, [1, selected.count, 2]),
    descriptorTensor: new state.ort.Tensor("float32", selected.descriptors, [1, selected.count, 64]),
    prep,
    preprocessElapsedMs,
    inferenceElapsedMs,
    elapsedMs: roundMs(performance.now() - started),
  };
  postProgress({
    kind: "model-run",
    stage: "xfeat:done",
    provider: state.provider,
    frameIndex,
    detectedKeypoints: response.count,
    inferenceElapsedMs: response.inferenceElapsedMs,
    elapsedMs: response.elapsedMs,
  });
  return response;
}

async function runMatcherForCandidate(imageData, query, keyframe, options) {
  if (usesFusedPairArchitecture(options)) {
    return runFusedImagePair(query, imageData, keyframe, options);
  }
  return runLighterGlue(query, keyframe, options);
}

async function runFusedImagePair(retrievalQuery, imageData, keyframe, options) {
  if (!state.fusedPairSession) {
    throw new Error("Fused XFeat+LighterGlue image-pair session is not ready.");
  }
  const started = performance.now();
  postProgress({
    kind: "model-run",
    stage: "fused-pair:start",
    provider: state.provider,
    keyframeId: keyframe?.id || null,
    width: imageData.width,
    height: imageData.height,
  });
  await flushProgress();

  const keyframeImageData = await loadKeyframeImageData(keyframe);
  const queryPrep = preprocessImage(imageData, options);
  const keyframePrep = preprocessImage(keyframeImageData, {
    ...options,
    fixedInputWidth: Number(options.fixedInputWidth || DEFAULTS.fixedInputWidth || 640),
    fixedInputHeight: Number(options.fixedInputHeight || DEFAULTS.fixedInputHeight || 640),
  });
  const input0 = new state.ort.Tensor("float32", queryPrep.tensor, [1, 3, queryPrep.height, queryPrep.width]);
  const input1 = new state.ort.Tensor("float32", keyframePrep.tensor, [1, 3, keyframePrep.height, keyframePrep.width]);
  const inputNames = Array.isArray(state.fusedPairSession.inputNames) ? state.fusedPairSession.inputNames : [];
  const feeds = {
    [inputNames[0] || "image0"]: input0,
    [inputNames[1] || "image1"]: input1,
  };
  const inferenceStarted = performance.now();
  const output = await withTimeout(
    state.fusedPairSession.run(feeds),
    inferenceTimeoutMs("fused-pair", options),
    `Fused XFeat+LighterGlue ${state.provider || "unknown"} inference`,
  );
  const inferenceElapsedMs = roundMs(performance.now() - inferenceStarted);
  const keypoints0Raw = outputTensor(output, ["keypoints0", "kpts0", "mkpts0"], 0);
  const keypoints1Raw = outputTensor(output, ["keypoints1", "kpts1", "mkpts1"], 1);
  const matchesRaw = outputTensor(output, ["matches", "matches0", "indices"], 6);
  const scoresRaw = outputTensor(output, ["match_scores", "scores", "mscores", "matching_scores"], 7, false);
  const queryKeypoints = mapKeypointsToSource(keypoints0Raw.data, queryPrep);
  const keyframeModelKeypoints = mapKeypointsToSource(keypoints1Raw.data, keyframePrep);
  const queryCount = Math.floor(queryKeypoints.length / 2);
  const keyframePairCount = Math.floor(keyframeModelKeypoints.length / 2);
  const rawPairs = parseFusedPairMatches(matchesRaw, scoresRaw, queryCount, keyframePairCount, Number(options.fusedPairScoreThreshold ?? DEFAULTS.fusedPairScoreThreshold));
  const linkMaxDistancePx = Math.max(0.5, Number(options.fusedPairKeyframeMaxLinkDistancePx || DEFAULTS.fusedPairKeyframeMaxLinkDistancePx));
  const matches = [];
  const seenQuery = new Set();
  const seenMap = new Set();
  const linkDistances = [];
  for (const pair of rawPairs) {
    if (seenQuery.has(pair.queryIndex)) continue;
    const mapPoint = mapModelPointToKeyframeSource(
      keyframeModelKeypoints[pair.mapIndex * 2],
      keyframeModelKeypoints[pair.mapIndex * 2 + 1],
      keyframe,
    );
    const nearest = nearestKeyframeFeatureIndex(keyframe, mapPoint.x, mapPoint.y, linkMaxDistancePx);
    if (!nearest || seenMap.has(nearest.index)) continue;
    seenQuery.add(pair.queryIndex);
    seenMap.add(nearest.index);
    linkDistances.push(nearest.distancePx);
    matches.push({
      queryIndex: pair.queryIndex,
      mapIndex: nearest.index,
      score: pair.score,
      keyframePairIndex: pair.mapIndex,
      keyframeLinkDistancePx: round6(nearest.distancePx),
    });
  }
  const query = {
    ...retrievalQuery,
    keypoints: queryKeypoints,
    width: imageData.width,
    height: imageData.height,
    count: queryCount,
    descriptorCentroid: retrievalQuery?.descriptorCentroid || null,
    prep: queryPrep,
  };
  const elapsedMs = roundMs(performance.now() - started);
  const response = {
    keyframe,
    query,
    matches,
    rawMatchCount: rawPairs.length,
    geometryMatchCount: matches.length,
    candidateMode: "fused-image-pair",
    matcherArchitecture: "fused-pair",
    inferenceElapsedMs,
    keyframeImageUrl: keyframe.imageUrl || "",
    keyframePairCount,
    queryPairCount: queryCount,
    meanKeyframeLinkDistancePx: linkDistances.length ? round6(mean(linkDistances)) : null,
    elapsedMs,
  };
  postProgress({
    kind: "model-run",
    stage: "fused-pair:done",
    provider: state.provider,
    keyframeId: keyframe?.id || null,
    rawMatchCount: rawPairs.length,
    geometryMatchCount: matches.length,
    inferenceElapsedMs,
    elapsedMs,
  });
  return response;
}

async function runLighterGlue(query, keyframe, options) {
  const started = performance.now();
  const tensorStarted = performance.now();
  const keyframeTensorBundle = ensureKeyframeTensorBundle(keyframe, options);
  const keyframeTensorElapsedMs = roundMs(performance.now() - tensorStarted);
  postProgress({
    kind: "model-run",
    stage: "lighterglue:start",
    provider: state.provider,
    keyframeId: keyframe?.id || null,
    queryFeatures: query.count,
    keyframeFeatures: keyframe.count,
    keyframeTensorCacheHit: keyframeTensorBundle.cacheHit,
    keyframeTensorElapsedMs,
  });
  await flushProgress();
  const feeds = {
    kpts0: query.keypointTensor || new state.ort.Tensor("float32", normalizeKptsForGlue(query.keypoints, query.width, query.height), [1, query.count, 2]),
    kpts1: keyframeTensorBundle.keypointTensor,
    desc0: query.descriptorTensor || new state.ort.Tensor("float32", query.descriptors, [1, query.count, 64]),
    desc1: keyframeTensorBundle.descriptorTensor,
  };
  const output = await withTimeout(
    state.lighterGlueSession.run(feeds),
    inferenceTimeoutMs("lighterglue", options),
    `LighterGlue ${state.provider || "unknown"} inference`,
  );
  const matchesRaw = outputTensor(output, ["matches", "matches0", "indices"], 0);
  const scoresRaw = outputTensor(output, ["scores", "mscores", "matching_scores"], 1, false);
  const matches = [];
  const threshold = Number(options.lighterGlueScoreThreshold);
  for (let i = 0; i < matchesRaw.data.length; i += 2) {
    const score = Number(scoresRaw?.data?.[i / 2] ?? 1);
    if (score < threshold) continue;
    const queryIndex = Number(matchesRaw.data[i]);
    const mapIndex = Number(matchesRaw.data[i + 1]);
    if (queryIndex < 0 || mapIndex < 0 || queryIndex >= query.count || mapIndex >= keyframe.count) continue;
    matches.push({ queryIndex, mapIndex, score });
  }
  const response = {
    keyframe,
    query,
    matches,
    rawMatchCount: matches.length,
    geometryMatchCount: matches.length,
    candidateMode: "single-frame",
    matcherArchitecture: "split",
    keyframeTensorCacheHit: keyframeTensorBundle.cacheHit,
    keyframeTensorCacheKey: keyframeTensorBundle.cacheKey,
    keyframeTensorElapsedMs,
    elapsedMs: roundMs(performance.now() - started),
  };
  postProgress({
    kind: "model-run",
    stage: "lighterglue:done",
    provider: state.provider,
    keyframeId: keyframe?.id || null,
    matchCount: matches.length,
    keyframeTensorCacheHit: keyframeTensorBundle.cacheHit,
    keyframeTensorElapsedMs,
    elapsedMs: response.elapsedMs,
  });
  return response;
}

async function loadKeyframeImageData(keyframe) {
  const imageUrl = keyframe?.imageUrl || (keyframe?.imageAsset ? resolveUrl(keyframe.imageAsset, keyframe.sidecarBaseUrl || state.sidecarBaseUrl) : "");
  if (!imageUrl) {
    throw new Error(`Keyframe ${keyframe?.id || "unknown"} is missing a fused-pair image asset.`);
  }
  const cached = state.keyframeImageDataCache.get(imageUrl);
  if (cached?.imageData) return cached.imageData;
  if (cached?.promise) return cached.promise;
  const entry = {
    imageData: null,
    promise: fetch(imageUrl, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to fetch fused-pair keyframe image ${imageUrl}: HTTP ${response.status}`);
        const bitmap = await createImageBitmap(await response.blob());
        const width = bitmap.width;
        const height = bitmap.height;
        const canvas = reusableOffscreenCanvas("keyframeImageCanvas", width, height);
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(bitmap, 0, 0, width, height);
        bitmap.close?.();
        const imageData = context.getImageData(0, 0, width, height);
        entry.imageData = imageData;
        entry.promise = null;
        return imageData;
      })
      .catch((error) => {
        state.keyframeImageDataCache.delete(imageUrl);
        throw error;
      }),
  };
  state.keyframeImageDataCache.set(imageUrl, entry);
  return entry.promise;
}

function parseFusedPairMatches(matchesRaw, scoresRaw, queryCount, keyframeCount, threshold) {
  const matchesData = matchesRaw?.data || [];
  const scoresData = scoresRaw?.data || [];
  const pairs = [];
  const dims = Array.isArray(matchesRaw?.dims) ? matchesRaw.dims.map(Number) : [];
  const lastDim = dims.length ? dims[dims.length - 1] : null;
  const looksLikePairList = lastDim === 2 || matchesData.length % 2 === 0 && matchesData.length !== queryCount;
  if (looksLikePairList) {
    for (let i = 0; i + 1 < matchesData.length; i += 2) {
      const queryIndex = Number(matchesData[i]);
      const mapIndex = Number(matchesData[i + 1]);
      const score = Number(scoresData[Math.floor(i / 2)] ?? 1);
      if (score < threshold) continue;
      if (!Number.isInteger(queryIndex) || !Number.isInteger(mapIndex)) continue;
      if (queryIndex < 0 || mapIndex < 0 || queryIndex >= queryCount || mapIndex >= keyframeCount) continue;
      pairs.push({ queryIndex, mapIndex, score });
    }
    return pairs;
  }
  for (let queryIndex = 0; queryIndex < matchesData.length; queryIndex += 1) {
    const mapIndex = Number(matchesData[queryIndex]);
    const score = Number(scoresData[queryIndex] ?? 1);
    if (score < threshold) continue;
    if (!Number.isInteger(mapIndex)) continue;
    if (mapIndex < 0 || queryIndex >= queryCount || mapIndex >= keyframeCount) continue;
    pairs.push({ queryIndex, mapIndex, score });
  }
  return pairs;
}

function mapModelPointToKeyframeSource(x, y, keyframe) {
  const transform = keyframe?.modelInputTransform || {};
  const scale = Number(transform.scale || 1);
  const padX = Number(transform.padX || 0);
  const padY = Number(transform.padY || 0);
  if (!Number.isFinite(scale) || scale <= 0) return { x: Number(x || 0), y: Number(y || 0) };
  return {
    x: (Number(x || 0) - padX) / scale,
    y: (Number(y || 0) - padY) / scale,
  };
}

function nearestKeyframeFeatureIndex(keyframe, x, y, maxDistancePx) {
  if (!keyframe?.keypoints?.length) return null;
  const maxDistanceSq = maxDistancePx * maxDistancePx;
  let bestIndex = -1;
  let bestDistanceSq = maxDistanceSq;
  for (let index = 0; index < keyframe.count; index += 1) {
    if (!hasValidLandmark(keyframe, index)) continue;
    const dx = Number(keyframe.keypoints[index * 2]) - x;
    const dy = Number(keyframe.keypoints[index * 2 + 1]) - y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq <= bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestIndex = index;
    }
  }
  return bestIndex >= 0 ? { index: bestIndex, distancePx: Math.sqrt(bestDistanceSq) } : null;
}

function solvePnpForMatches(matched, keyframe, query, frameIndex, options) {
  const matches = matched.matches || [];
  if (matches.length < 6) {
    return failedCandidate(
      keyframe,
      frameIndex,
      `Only ${matches.length} XFeat/LighterGlue matches; PnP needs at least 6.`,
      {
        matcherElapsedMs: matched.elapsedMs,
        rawMatchCount: matched.rawMatchCount ?? matches.length,
        geometryMatchCount: matched.geometryMatchCount ?? 0,
        candidateMode: matched.candidateMode,
      },
    );
  }

  const pnpInput = pnpInputForMatches(matches, keyframe, query);
  if (pnpInput.matchCount < 6) {
    const failed = failedCandidate(
      keyframe,
      frameIndex,
      `Only ${pnpInput.matchCount} geometry-backed XFeat/LighterGlue matches from ${matches.length} visual matches; PnP needs at least 6.`,
      {
        matcherElapsedMs: matched.elapsedMs,
        rawMatchCount: matched.rawMatchCount ?? matches.length,
        geometryMatchCount: pnpInput.matchCount,
        candidateMode: matched.candidateMode,
      },
    );
    attachPnpInput(failed, pnpInput);
    return failed;
  }

  const solved = solvePnpArrays({
    objectArray: pnpInput.objectArray,
    imageArray: pnpInput.imageArray,
    cameraModel: cameraModelForQuery(keyframe.cameraModel || state.sidecar.cameraModel, query),
    matchCount: pnpInput.matchCount,
    rawMatchCount: matched.rawMatchCount ?? matches.length,
    geometryMatchCount: pnpInput.matchCount,
    matcherElapsedMs: matched.elapsedMs,
    keyframeId: keyframe.id,
    frameIndex,
    descriptorMode: state.sidecar?.descriptorMode || "xfeat-lg-v0",
    candidateMode: matched.candidateMode || "single-frame",
  });
  attachPnpInput(solved, pnpInput);
  return solved;
}

function pnpInputForMatches(matches, keyframe, query) {
  const sortedMatches = [...matches].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const objectArray = [];
  const imageArray = [];
  const matchScores = [];
  for (const match of sortedMatches) {
    if (!hasValidLandmark(keyframe, match.mapIndex)) continue;
    const qi = match.queryIndex * 2;
    const mi3 = match.mapIndex * 3;
    imageArray.push(query.keypoints[qi], query.keypoints[qi + 1]);
    objectArray.push(keyframe.landmarks[mi3], keyframe.landmarks[mi3 + 1], keyframe.landmarks[mi3 + 2]);
    matchScores.push(Number(match.score || 0));
  }
  return {
    objectArray,
    imageArray,
    matchScores,
    matchCount: Math.floor(Math.min(objectArray.length / 3, imageArray.length / 2)),
  };
}

function attachPnpInput(candidate, pnpInput) {
  Object.defineProperty(candidate, "_pnpInput", {
    value: pnpInput,
    enumerable: false,
    configurable: true,
  });
  return candidate;
}

function solveFusedBurstCandidate(frameResults, options) {
  const groups = new Map();
  for (const frameResult of frameResults || []) {
    for (const candidate of frameResult.candidateResults || []) {
      if (!candidate?._pnpInput?.matchCount || !candidate.keyframeId) continue;
      const entry = groups.get(candidate.keyframeId) || {
        keyframeId: candidate.keyframeId,
        frameIndex: candidate.frameIndex,
        objectArray: [],
        imageArray: [],
        rawMatchCount: 0,
        geometryMatchCount: 0,
        matcherElapsedMs: 0,
        candidateCount: 0,
        failedCandidateCount: 0,
        cameraModel: state.sidecar?.cameraModel,
      };
      const remaining = Math.max(0, Number(options.maxFusedMatches || DEFAULTS.maxFusedMatches) - entry.geometryMatchCount);
      const take = Math.min(remaining, candidate._pnpInput.matchCount);
      if (take <= 0) continue;
      entry.objectArray.push(...candidate._pnpInput.objectArray.slice(0, take * 3));
      entry.imageArray.push(...candidate._pnpInput.imageArray.slice(0, take * 2));
      entry.rawMatchCount += Number(candidate.rawMatchCount || 0);
      entry.geometryMatchCount += take;
      entry.matcherElapsedMs += Number(candidate.matcherElapsedMs || 0);
      entry.candidateCount += 1;
      if (candidate.status !== "ready") entry.failedCandidateCount += 1;
      groups.set(candidate.keyframeId, entry);
    }
  }

  const minFusedMatches = Math.max(6, Number(options.minFusedGeometryMatches || DEFAULTS.minFusedGeometryMatches));
  const solved = [];
  for (const entry of groups.values()) {
    if (entry.geometryMatchCount < minFusedMatches) continue;
    const result = solvePnpArrays({
      objectArray: entry.objectArray,
      imageArray: entry.imageArray,
      cameraModel: entry.cameraModel,
      matchCount: entry.geometryMatchCount,
      rawMatchCount: entry.rawMatchCount,
      geometryMatchCount: entry.geometryMatchCount,
      matcherElapsedMs: roundMs(entry.matcherElapsedMs),
      keyframeId: entry.keyframeId,
      frameIndex: entry.frameIndex,
      descriptorMode: state.sidecar?.descriptorMode || "xfeat-lg-v0",
      candidateMode: "burst-fused",
      fusedFrameCandidateCount: entry.candidateCount,
      fusedFailedCandidateCount: entry.failedCandidateCount,
    });
    solved.push(result);
  }
  return solved
    .filter((result) => result.status === "ready")
    .sort((a, b) => scoreLocalization(b) - scoreLocalization(a))[0] || null;
}

function solvePnpArrays(input) {
  const started = performance.now();
  const opencv = state.opencv;
  const matchCount = input.matchCount;
  const objectPoints = opencv.matFromArray(matchCount, 3, opencv.CV_64F, input.objectArray);
  const imagePoints = opencv.matFromArray(matchCount, 2, opencv.CV_64F, input.imageArray);
  const cameraMatrix = cameraMatrixFor(input.cameraModel);
  const distCoeffs = distortionFor(input.cameraModel);
  const rvec = new opencv.Mat();
  const tvec = new opencv.Mat();
  const inliers = new opencv.Mat();

  try {
    const ok = opencv.solvePnPRansac(
      objectPoints,
      imagePoints,
      cameraMatrix,
      distCoeffs,
      rvec,
      tvec,
      false,
      96,
      5.0,
      0.99,
      inliers,
    );
    if (!ok || inliers.rows < 4) {
      return failedCandidate(
        { id: input.keyframeId },
        input.frameIndex,
        "solvePnPRansac did not find a stable solution.",
        {
          rawMatchCount: input.rawMatchCount ?? matchCount,
          geometryMatchCount: input.geometryMatchCount ?? matchCount,
          matcherElapsedMs: input.matcherElapsedMs ?? null,
          pnpElapsedMs: roundMs(performance.now() - started),
          candidateMode: input.candidateMode,
          fusedFrameCandidateCount: input.fusedFrameCandidateCount,
          fusedFailedCandidateCount: input.fusedFailedCandidateCount,
        },
      );
    }

    try {
      opencv.solvePnPRefineLM(objectPoints, imagePoints, cameraMatrix, distCoeffs, rvec, tvec);
    } catch {
      // RefineLM is best-effort; RANSAC pose remains valid for diagnostics.
    }

    const reprojectionErrorPx = computeReprojectionError(objectPoints, imagePoints, cameraMatrix, distCoeffs, rvec, tvec);
    const inlierCount = inliers.rows || inliers.cols || 0;
    const inlierRatio = inlierCount / Math.max(1, matchCount);
    const errorScore = Math.max(0, 1 - reprojectionErrorPx / 12);
    const confidence = Math.min(1, inlierRatio * 0.75 + Math.min(1, inlierCount / 32) * 0.2 + errorScore * 0.05);

    return {
      status: "ready",
      descriptorMode: input.descriptorMode,
      keyframeId: input.keyframeId,
      frameIndex: input.frameIndex,
      matchCount,
      rawMatchCount: input.rawMatchCount ?? matchCount,
      geometryMatchCount: input.geometryMatchCount ?? matchCount,
      inlierCount,
      inlierRatio: round6(inlierRatio),
      confidence: round6(confidence),
      reprojectionErrorPx: round6(reprojectionErrorPx),
      rvec: matToArray3(rvec),
      tvec: matToArray3(tvec),
      matcherElapsedMs: input.matcherElapsedMs ?? null,
      pnpElapsedMs: roundMs(performance.now() - started),
      candidateMode: input.candidateMode || "single-frame",
      fusedFrameCandidateCount: input.fusedFrameCandidateCount ?? null,
      fusedFailedCandidateCount: input.fusedFailedCandidateCount ?? null,
      reason: "Solved with XFeat + LighterGlue matches and OpenCV solvePnPRansac.",
    };
  } finally {
    objectPoints.delete();
    imagePoints.delete();
    cameraMatrix.delete();
    distCoeffs.delete();
    rvec.delete();
    tvec.delete();
    inliers.delete();
  }
}

function projectAnchors(payload) {
  requireOpenCv();
  const anchors = payload.anchors || [];
  const cameraModel = payload.cameraModel || state.sidecar?.cameraModel;
  const rvec = vectorMat(payload.rvec || payload.pose?.rvec);
  const tvec = vectorMat(payload.tvec || payload.pose?.tvec);
  const cameraMatrix = cameraMatrixFor(cameraModel);
  const distCoeffs = distortionFor(cameraModel);
  const objectPoints = state.opencv.matFromArray(anchors.length, 3, state.opencv.CV_64F, anchors.flatMap((anchor) => [
    Number(anchor.world?.x ?? anchor.x ?? 0),
    Number(anchor.world?.y ?? anchor.y ?? 0),
    Number(anchor.world?.z ?? anchor.z ?? 0),
  ]));
  const imagePoints = new state.opencv.Mat();
  try {
    state.opencv.projectPoints(objectPoints, rvec, tvec, cameraMatrix, distCoeffs, imagePoints);
    const data = imagePoints.data64F || imagePoints.data32F;
    return {
      status: "ready",
      projected: anchors.map((anchor, index) => ({
        id: anchor.id || `anchor-${index}`,
        x: Number(data[index * 2] || 0),
        y: Number(data[index * 2 + 1] || 0),
      })),
    };
  } finally {
    objectPoints.delete();
    imagePoints.delete();
    cameraMatrix.delete();
    distCoeffs.delete();
    rvec.delete();
    tvec.delete();
  }
}

function preprocessImage(imageData, options) {
  const maxSide = Number(options.maxModelSide || DEFAULTS.maxModelSide);
  const padMultiple = Number(options.padMultiple || DEFAULTS.padMultiple);
  const fixedInputWidth = Math.max(0, Number(options.fixedInputWidth || DEFAULTS.fixedInputWidth || 0));
  const fixedInputHeight = Math.max(0, Number(options.fixedInputHeight || DEFAULTS.fixedInputHeight || 0));
  const fixedInput = fixedInputWidth > 0 && fixedInputHeight > 0;
  const targetMaxSide = fixedInput ? Math.max(fixedInputWidth, fixedInputHeight) : maxSide;
  const scale = fixedInput
    ? Math.min(fixedInputWidth / Math.max(1, imageData.width), fixedInputHeight / Math.max(1, imageData.height))
    : Math.min(1, targetMaxSide / Math.max(imageData.width, imageData.height));
  const resizedWidth = Math.max(1, Math.round(imageData.width * scale));
  const resizedHeight = Math.max(1, Math.round(imageData.height * scale));
  const width = fixedInput ? fixedInputWidth : roundUp(resizedWidth, padMultiple);
  const height = fixedInput ? fixedInputHeight : roundUp(resizedHeight, padMultiple);

  if (!fixedInput && scale === 1) {
    return preprocessImageDirect(imageData, width, height, scale);
  }

  const canvas = reusableOffscreenCanvas("preprocessCanvas", width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const sourceCanvas = reusableOffscreenCanvas("preprocessSourceCanvas", imageData.width, imageData.height);
  sourceCanvas.getContext("2d").putImageData(imageData, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";
  ctx.drawImage(sourceCanvas, 0, 0, resizedWidth, resizedHeight);
  const resized = ctx.getImageData(0, 0, width, height).data;
  const tensor = new Float32Array(3 * width * height);
  const plane = width * height;
  for (let i = 0, p = 0; i < resized.length; i += 4, p += 1) {
    tensor[p] = resized[i] / 255;
    tensor[plane + p] = resized[i + 1] / 255;
    tensor[plane * 2 + p] = resized[i + 2] / 255;
  }
  return {
    tensor,
    width,
    height,
    resizedWidth,
    resizedHeight,
    scale,
    sourceWidth: imageData.width,
    sourceHeight: imageData.height,
    fixedInput,
  };
}

function reusableOffscreenCanvas(slot, width, height) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  let canvas = state[slot];
  if (!canvas) {
    canvas = new OffscreenCanvas(safeWidth, safeHeight);
    state[slot] = canvas;
    return canvas;
  }
  if (canvas.width !== safeWidth) canvas.width = safeWidth;
  if (canvas.height !== safeHeight) canvas.height = safeHeight;
  return canvas;
}

function preprocessImageDirect(imageData, width, height, scale) {
  const tensor = new Float32Array(3 * width * height);
  const source = imageData.data;
  const sourceWidth = imageData.width;
  const sourceHeight = imageData.height;
  const plane = width * height;
  for (let y = 0; y < sourceHeight; y += 1) {
    const sourceRow = y * sourceWidth * 4;
    const targetRow = y * width;
    for (let x = 0; x < sourceWidth; x += 1) {
      const sourceIndex = sourceRow + x * 4;
      const targetIndex = targetRow + x;
      tensor[targetIndex] = source[sourceIndex] / 255;
      tensor[plane + targetIndex] = source[sourceIndex + 1] / 255;
      tensor[plane * 2 + targetIndex] = source[sourceIndex + 2] / 255;
    }
  }
  return {
    tensor,
    width,
    height,
    resizedWidth: sourceWidth,
    resizedHeight: sourceHeight,
    scale,
    sourceWidth,
    sourceHeight,
    directPadded: width !== sourceWidth || height !== sourceHeight,
  };
}

function mapKeypointsToSource(data, prep) {
  const mapped = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 2) {
    mapped[i] = Number(data[i]) / prep.scale;
    mapped[i + 1] = Number(data[i + 1]) / prep.scale;
  }
  return mapped;
}

function normalizeKptsForGlue(keypoints, width, height) {
  const size = Math.max(width || 1, height || 1) / 2;
  const shiftX = (width || 1) / 2;
  const shiftY = (height || 1) / 2;
  const out = new Float32Array(keypoints.length);
  for (let i = 0; i < keypoints.length; i += 2) {
    out[i] = (keypoints[i] - shiftX) / size;
    out[i + 1] = (keypoints[i + 1] - shiftY) / size;
  }
  return out;
}

function shortlistKeyframes(query, options, frame = {}) {
  const started = performance.now();
  const baseLimit = Math.max(1, Number(options.candidateLimit || DEFAULTS.candidateLimit));
  const fallbackLimit = Math.max(baseLimit, Number(options.fallbackCandidateLimit || DEFAULTS.fallbackCandidateLimit));
  const maxLimit = Math.max(fallbackLimit, Number(options.maxCandidateLimit || DEFAULTS.maxCandidateLimit));
  const byId = new Map(state.keyframes.map((keyframe) => [String(keyframe.id), keyframe]));
  const explicitIds = uniqueStrings([
    ...(Array.isArray(frame.candidateKeyframeIds) ? frame.candidateKeyframeIds : []),
    ...(Array.isArray(options.candidateKeyframeIds) ? options.candidateKeyframeIds : []),
  ]);
  const selected = [];
  for (const id of explicitIds) {
    const keyframe = byId.get(id);
    if (keyframe && !selected.includes(keyframe)) selected.push(keyframe);
    if (selected.length >= baseLimit) {
      return {
        strategy: "explicit-candidates",
        keyframes: selected,
        confidence: 1,
        escalated: false,
        elapsedMs: roundMs(performance.now() - started),
      };
    }
  }

  const sourceFrame = finiteOrNull(frame.sourceFrameIndex ?? frame.queryFrameIndex ?? frame.frameIndex);
  const lastNeighbors = state.lastAcceptedKeyframeId
    ? new Set((state.covisibilityByKeyframe.get(state.lastAcceptedKeyframeId)?.neighbors || []).map((neighbor) => String(neighbor.id)))
    : new Set();
  const lastAcceptedKeyframe = state.lastAcceptedKeyframeId
    ? state.keyframes.find((candidate) => String(candidate.id) === String(state.lastAcceptedKeyframeId))
    : null;
  const localCenter = lastAcceptedKeyframe?.posePosition || keyframePosePosition(lastAcceptedKeyframe, lastAcceptedKeyframe?.retrieval || {});
  const hotRadius = Number(options.localNeighborhoodHotRadiusMeters || DEFAULTS.localNeighborhoodHotRadiusMeters);
  const warmRadius = Math.max(hotRadius, Number(options.localNeighborhoodWarmRadiusMeters || DEFAULTS.localNeighborhoodWarmRadiusMeters));
  const ranked = state.keyframes
    .filter((keyframe) => !selected.includes(keyframe))
    .map((keyframe) => {
      const descriptorDistance = centroidDistance(query.descriptorCentroid, keyframe.descriptorCentroid);
      const temporalDistance = sourceFrame !== null && keyframe.sourceFrameIndex !== null
        ? Math.abs(sourceFrame - keyframe.sourceFrameIndex)
        : null;
      const retrieval = keyframe.retrieval || {};
      const localDistanceMeters = localCenter
        ? distance3(localCenter, keyframe.posePosition || keyframePosePosition(keyframe, retrieval))
        : Number.POSITIVE_INFINITY;
      const covisibilityBoost = lastNeighbors.has(String(keyframe.id)) ? -0.1 : 0;
      const trajectoryBoost = Array.isArray(retrieval.trajectoryNeighbors) && state.lastAcceptedKeyframeId && retrieval.trajectoryNeighbors.includes(state.lastAcceptedKeyframeId) ? -0.05 : 0;
      const qualityBoost = -0.03 * Number(retrieval.qualityScore || 0);
      const temporalPenalty = temporalDistance !== null ? Math.min(0.25, temporalDistance / 2400) : 0;
      const localNeighborhoodBoost = Number.isFinite(localDistanceMeters)
        ? localDistanceMeters <= hotRadius
          ? -0.16
          : localDistanceMeters <= warmRadius
            ? -0.06
            : Math.min(0.3, (localDistanceMeters - warmRadius) / Math.max(1, warmRadius) * 0.1)
        : 0;
      return {
        keyframe,
        descriptorDistance,
        temporalDistance,
        localDistanceMeters,
        score: Number.isFinite(descriptorDistance)
          ? descriptorDistance + temporalPenalty + covisibilityBoost + trajectoryBoost + qualityBoost + localNeighborhoodBoost
          : Number.POSITIVE_INFINITY,
      };
    });

  if (ranked.some((entry) => Number.isFinite(entry.descriptorDistance))) {
    ranked.sort((a, b) => a.score - b.score);
    const best = ranked[0]?.score ?? Number.POSITIVE_INFINITY;
    const second = ranked[1]?.score ?? Number.POSITIVE_INFINITY;
    const confidence = retrievalConfidence(best, second);
    const shouldEscalate =
      options.adaptiveCandidateEscalation !== false &&
      baseLimit < maxLimit &&
      confidence < Number(options.retrievalConfidenceThreshold || DEFAULTS.retrievalConfidenceThreshold);
    const limit = shouldEscalate ? Math.min(maxLimit, fallbackLimit) : baseLimit;
    return {
      strategy: selected.length
        ? shouldEscalate
          ? "explicit-plus-retrieval-escalated"
          : "explicit-plus-retrieval"
        : shouldEscalate
          ? "retrieval-escalated"
          : "retrieval",
      keyframes: [...selected, ...ranked.map((entry) => entry.keyframe)].slice(0, limit),
      confidence,
      escalated: shouldEscalate,
      elapsedMs: roundMs(performance.now() - started),
    };
  }

  if (sourceFrame !== null && ranked.some((entry) => entry.temporalDistance !== null)) {
    ranked.sort((a, b) => (a.temporalDistance ?? Number.POSITIVE_INFINITY) - (b.temporalDistance ?? Number.POSITIVE_INFINITY));
    return {
      strategy: selected.length ? "explicit-plus-temporal" : "temporal",
      keyframes: [...selected, ...ranked.map((entry) => entry.keyframe)].slice(0, baseLimit),
      confidence: 0,
      escalated: false,
      elapsedMs: roundMs(performance.now() - started),
    };
  }

  return {
    strategy: selected.length ? "explicit-plus-sequential" : "sequential",
    keyframes: [...selected, ...state.keyframes.filter((keyframe) => !selected.includes(keyframe))].slice(0, baseLimit),
    confidence: 0,
    escalated: false,
    elapsedMs: roundMs(performance.now() - started),
  };
}

function retrievalConfidence(bestScore, secondScore) {
  if (!Number.isFinite(bestScore) || !Number.isFinite(secondScore)) return 0;
  const margin = Math.max(0, secondScore - bestScore);
  return Math.max(0, Math.min(1, margin / Math.max(0.001, Math.abs(secondScore))));
}

function descriptorCentroid(descriptors, count, descriptorDim) {
  if (!count || !descriptorDim || !descriptors?.length) return null;
  const centroid = new Float32Array(descriptorDim);
  for (let row = 0; row < count; row += 1) {
    const base = row * descriptorDim;
    for (let col = 0; col < descriptorDim; col += 1) {
      centroid[col] += Number(descriptors[base + col] || 0);
    }
  }
  for (let col = 0; col < descriptorDim; col += 1) centroid[col] /= count;
  return centroid;
}

function filterFeatureRowsToSourceBounds(keypoints, descriptors, scores, count, descriptorDim, width, height) {
  const safeCount = Math.max(0, Math.min(Number(count) || 0, Math.floor(keypoints.length / 2), Math.floor(descriptors.length / descriptorDim)));
  const valid = [];
  for (let row = 0; row < safeCount; row += 1) {
    const x = Number(keypoints[row * 2]);
    const y = Number(keypoints[row * 2 + 1]);
    if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < width && y < height) {
      valid.push(row);
    }
  }
  if (valid.length === safeCount) {
    return {
      keypoints: keypoints.slice(0, safeCount * 2),
      descriptors: descriptors.slice(0, safeCount * descriptorDim),
      scores: scores?.length ? scores.slice(0, safeCount) : null,
      count: safeCount,
    };
  }

  const outKeypoints = new Float32Array(valid.length * 2);
  const outDescriptors = new Float32Array(valid.length * descriptorDim);
  const outScores = scores?.length ? new Float32Array(valid.length) : null;
  for (let row = 0; row < valid.length; row += 1) {
    const source = valid[row];
    outKeypoints[row * 2] = keypoints[source * 2];
    outKeypoints[row * 2 + 1] = keypoints[source * 2 + 1];
    outDescriptors.set(descriptors.subarray(source * descriptorDim, source * descriptorDim + descriptorDim), row * descriptorDim);
    if (outScores) outScores[row] = scores[source] || 0;
  }
  return {
    keypoints: outKeypoints,
    descriptors: outDescriptors,
    scores: outScores,
    count: valid.length,
  };
}

function selectFeatureRows(keypoints, descriptors, scores, count, descriptorDim, limit) {
  const safeCount = Math.max(0, Math.min(Number(count) || 0, Math.floor(keypoints.length / 2), Math.floor(descriptors.length / descriptorDim)));
  const safeLimit = Math.max(1, Math.min(safeCount, Number(limit) || safeCount));
  if (safeCount <= safeLimit) {
    return {
      keypoints: keypoints.slice(0, safeCount * 2),
      descriptors: descriptors.slice(0, safeCount * descriptorDim),
      scores: scores?.length ? scores.slice(0, safeCount) : null,
      count: safeCount,
    };
  }

  const indices = Array.from({ length: safeCount }, (_, index) => index);
  if (scores?.length >= safeCount) {
    indices.sort((a, b) => Number(scores[b] || 0) - Number(scores[a] || 0));
  }
  const selected = indices.slice(0, safeLimit);
  const outKeypoints = new Float32Array(safeLimit * 2);
  const outDescriptors = new Float32Array(safeLimit * descriptorDim);
  const outScores = scores?.length ? new Float32Array(safeLimit) : null;
  for (let row = 0; row < selected.length; row += 1) {
    const source = selected[row];
    outKeypoints[row * 2] = keypoints[source * 2];
    outKeypoints[row * 2 + 1] = keypoints[source * 2 + 1];
    outDescriptors.set(descriptors.subarray(source * descriptorDim, source * descriptorDim + descriptorDim), row * descriptorDim);
    if (outScores) outScores[row] = scores[source] || 0;
  }
  return {
    keypoints: outKeypoints,
    descriptors: outDescriptors,
    scores: outScores,
    count: safeLimit,
  };
}

function hasValidLandmark(keyframe, mapIndex) {
  const index = Number(mapIndex);
  if (!Number.isInteger(index) || index < 0 || index >= keyframe.count) return false;
  if (keyframe.validLandmarkMask?.length && !keyframe.validLandmarkMask[index]) return false;
  const base = index * 3;
  return Number.isFinite(keyframe.landmarks?.[base]) &&
    Number.isFinite(keyframe.landmarks?.[base + 1]) &&
    Number.isFinite(keyframe.landmarks?.[base + 2]);
}

function centroidDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    const delta = Number(a[i]) - Number(b[i]);
    total += delta * delta;
  }
  return Math.sqrt(total / Math.max(1, a.length));
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function cameraMatrixFor(camera = {}) {
  requireOpenCv();
  return state.opencv.matFromArray(3, 3, state.opencv.CV_64F, [
    Number(camera?.fx || 1), 0, Number(camera?.cx || 0),
    0, Number(camera?.fy || 1), Number(camera?.cy || 0),
    0, 0, 1,
  ]);
}

function cameraModelForQuery(baseCamera = {}, query = {}) {
  const explicit = query.cameraModel || query.intrinsics;
  if (explicit?.fx && explicit?.fy) {
    return {
      ...baseCamera,
      ...explicit,
      width: Number(explicit.width || query.width || baseCamera.width || 0),
      height: Number(explicit.height || query.height || baseCamera.height || 0),
    };
  }

  const baseWidth = Number(baseCamera?.width || state.sidecar?.cameraModel?.width || query.width || 1);
  const baseHeight = Number(baseCamera?.height || state.sidecar?.cameraModel?.height || query.height || 1);
  const queryWidth = Number(query?.width || baseWidth);
  const queryHeight = Number(query?.height || baseHeight);
  const sx = queryWidth / Math.max(1, baseWidth);
  const sy = queryHeight / Math.max(1, baseHeight);
  return {
    ...baseCamera,
    fx: Number(baseCamera?.fx || 1) * sx,
    fy: Number(baseCamera?.fy || baseCamera?.fx || 1) * sy,
    cx: Number(baseCamera?.cx || 0) * sx,
    cy: Number(baseCamera?.cy || 0) * sy,
    width: queryWidth,
    height: queryHeight,
    sourceWidth: baseWidth,
    sourceHeight: baseHeight,
    scaleFromSourceCamera: [sx, sy],
  };
}

function distortionFor(camera = {}) {
  const dist = camera?.distortion || camera?.distCoeffs || [0, 0, 0, 0];
  return state.opencv.matFromArray(dist.length || 4, 1, state.opencv.CV_64F, dist.length ? dist.map(Number) : [0, 0, 0, 0]);
}

function computeReprojectionError(objectPoints, imagePoints, cameraMatrix, distCoeffs, rvec, tvec) {
  const projected = new state.opencv.Mat();
  try {
    state.opencv.projectPoints(objectPoints, rvec, tvec, cameraMatrix, distCoeffs, projected);
    const actual = imagePoints.data64F || imagePoints.data32F;
    const pred = projected.data64F || projected.data32F;
    let total = 0;
    const count = Math.min(actual.length, pred.length) / 2;
    for (let i = 0; i < count; i += 1) {
      const dx = Number(actual[i * 2]) - Number(pred[i * 2]);
      const dy = Number(actual[i * 2 + 1]) - Number(pred[i * 2 + 1]);
      total += Math.hypot(dx, dy);
    }
    return count ? total / count : Infinity;
  } finally {
    projected.delete();
  }
}

function outputTensor(output, names, fallbackIndex, required = true) {
  for (const name of names) {
    if (output[name]) return output[name];
  }
  const values = Object.values(output);
  if (values[fallbackIndex]) return values[fallbackIndex];
  if (!required) return null;
  throw new Error(`Missing ONNX output: ${names.join(" or ")}`);
}

function normalizeImageData(frame) {
  if (frame instanceof ImageData) return frame;
  if (frame?.data && frame?.width && frame?.height) {
    const imageData = new ImageData(new Uint8ClampedArray(frame.data), Number(frame.width), Number(frame.height));
    if (frame.cameraModel) imageData.cameraModel = frame.cameraModel;
    if (frame.intrinsics) imageData.intrinsics = frame.intrinsics;
    return imageData;
  }
  throw new Error("Frame must be ImageData or a serializable { data, width, height } object.");
}

async function fetchFloatArray(path, baseUrl, format, optional = false) {
  if (!path) {
    if (optional) return new Float32Array();
    throw new Error("Missing binary asset path in XFeat MapPack sidecar.");
  }
  const url = resolveUrl(path, baseUrl);
  const buffer = await fetchArrayBufferCached(url, path);
  if (format === "float16") return float16ToFloat32(new Uint16Array(buffer));
  if (format === "uint16-normalized") return uint16NormalizedToFloat32(new Uint16Array(buffer));
  return new Float32Array(buffer);
}

async function fetchJsonArray(path, baseUrl, optional = false) {
  if (!path) return optional ? [] : null;
  const response = await fetch(resolveUrl(path, baseUrl), { cache: "force-cache" });
  if (!response.ok) throw new Error(`Failed to fetch sidecar JSON asset ${path}: HTTP ${response.status}`);
  return await response.json();
}

async function fetchJson(url) {
  const resolvedUrl = resolveUrl(url);
  const response = await fetch(resolvedUrl, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  return await response.json();
}

async function fetchArrayBufferCached(url, label = url) {
  const cached = state.assetBufferCache.get(url);
  if (cached) {
    cached.lastAccess = performance.now();
    return cached.promise || cached.buffer;
  }
  const entry = {
    promise: null,
    buffer: null,
    bytes: 0,
    lastAccess: performance.now(),
  };
  entry.promise = fetch(url, { cache: "force-cache" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Failed to fetch sidecar asset ${label}: HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      entry.buffer = buffer;
      entry.promise = null;
      entry.bytes = buffer.byteLength;
      entry.lastAccess = performance.now();
      state.assetBufferCacheBytes += entry.bytes;
      trimAssetBufferCache();
      return buffer;
    })
    .catch((error) => {
      state.assetBufferCache.delete(url);
      throw error;
    });
  state.assetBufferCache.set(url, entry);
  return entry.promise;
}

function trimAssetBufferCache() {
  const maxEntries = Math.max(1, Number(state.options.maxAssetBufferCacheEntries || DEFAULTS.maxAssetBufferCacheEntries));
  const maxBytes = Math.max(1024 * 1024, Number(state.options.maxAssetBufferCacheBytes || DEFAULTS.maxAssetBufferCacheBytes));
  const entries = Array.from(state.assetBufferCache.entries())
    .filter(([, value]) => !value.promise)
    .sort((left, right) => Number(left[1].lastAccess || 0) - Number(right[1].lastAccess || 0));
  while (
    state.assetBufferCache.size > maxEntries ||
    state.assetBufferCacheBytes > maxBytes
  ) {
    const next = entries.shift();
    if (!next) break;
    state.assetBufferCache.delete(next[0]);
    state.assetBufferCacheBytes = Math.max(0, state.assetBufferCacheBytes - Number(next[1].bytes || 0));
  }
}

function runtimeAssetOrigin() {
  const explicit =
    state.options?.assetBaseUrl ||
    state.options?.runtimeAssetBaseUrl ||
    DEFAULTS.assetBaseUrl ||
    DEFAULTS.runtimeAssetBaseUrl ||
    "";
  if (/^https?:\/\//i.test(explicit)) return explicit.replace(/\/+$/, "");
  const locationOrigin = self.location?.origin || "";
  if (locationOrigin && locationOrigin !== "null") return locationOrigin;
  return "";
}

function resolveUrl(path, baseUrl = self.location.href) {
  if (!path) return runtimeAssetOrigin() || self.location.href;
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  const origin = runtimeAssetOrigin();
  if (String(path).startsWith("/") && origin) return new URL(path, origin).href;
  const absoluteBaseUrl = /^https?:\/\//i.test(baseUrl)
    ? baseUrl
    : origin
      ? new URL(baseUrl || "/", origin).href
      : new URL(baseUrl, self.location.href).href;
  return new URL(path, absoluteBaseUrl).href;
}

async function maybeFetchJson(url) {
  try {
    return await fetchJson(url);
  } catch {
    return null;
  }
}

function float16ToFloat32(input) {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 1) out[i] = halfToFloat(input[i]);
  return out;
}

function uint16NormalizedToFloat32(input) {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 1) out[i] = input[i] / 65535;
  return out;
}

function halfToFloat(h) {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / Math.pow(2, 10));
  if (e === 0x1f) return f ? NaN : ((s ? -1 : 1) * Infinity);
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / Math.pow(2, 10));
}

function vectorMat(values = [0, 0, 0]) {
  return state.opencv.matFromArray(3, 1, state.opencv.CV_64F, [Number(values[0] || 0), Number(values[1] || 0), Number(values[2] || 0)]);
}

function matToArray3(mat) {
  const data = mat.data64F || mat.data32F;
  return [Number(data[0] || 0), Number(data[1] || 0), Number(data[2] || 0)];
}

function flatten(value) {
  return value.flat ? value.flat(Infinity) : value;
}

function roundUp(value, multiple) {
  return Math.ceil(value / multiple) * multiple;
}

function roundMs(value) {
  return Number(value.toFixed(3));
}

function round6(value) {
  return Number(Number(value || 0).toFixed(6));
}

function mean(values) {
  const finiteValues = (values || []).map(Number).filter((value) => Number.isFinite(value));
  return finiteValues.length
    ? finiteValues.reduce((total, value) => total + value, 0) / finiteValues.length
    : 0;
}

function scoreLocalization(result) {
  return (result.confidence || 0) * 1000 + (result.inlierCount || 0) * 10 + (result.matchCount || 0) - (result.reprojectionErrorPx || 0);
}

function failedCandidate(keyframe, frameIndex, reason, extra = {}) {
  return {
    status: "failed",
    descriptorMode: state.sidecar?.descriptorMode || "xfeat-lg-v0",
    keyframeId: keyframe?.id || null,
    frameIndex,
    confidence: 0,
    matchCount: 0,
    rawMatchCount: extra.rawMatchCount ?? 0,
    geometryMatchCount: extra.geometryMatchCount ?? 0,
    inlierCount: 0,
    reprojectionErrorPx: null,
    matcherElapsedMs: extra.matcherElapsedMs ?? null,
    pnpElapsedMs: extra.pnpElapsedMs ?? null,
    candidateMode: extra.candidateMode ?? null,
    fusedFrameCandidateCount: extra.fusedFrameCandidateCount ?? null,
    fusedFailedCandidateCount: extra.fusedFailedCandidateCount ?? null,
    reason,
  };
}

function rejectionReason(best, options) {
  if (!best) return "No frame produced a PnP candidate.";
  if (best.matchCount < Number(options.minMatches)) return `Match count ${best.matchCount} below ${options.minMatches}.`;
  if (best.inlierCount < Number(options.minInliers)) return `Inlier count ${best.inlierCount} below ${options.minInliers}.`;
  if (best.confidence < Number(options.minConfidence)) return `Confidence ${best.confidence} below ${options.minConfidence}.`;
  return "Rejected by quality gates.";
}

function requireReady() {
  if (!state.xfeatSession || !state.lighterGlueSession) throw new Error("Runtime has not loaded XFeat + LighterGlue sessions.");
  if (usesFusedPairArchitecture(state.options) && !state.fusedPairSession) {
    throw new Error("Runtime has not loaded the fused XFeat+LighterGlue image-pair session.");
  }
  if (!state.keyframes.length) throw new Error("Runtime has not loaded an xfeat-lg-v0 MapPack sidecar.");
  requireOpenCv();
}

function requireOpenCv() {
  if (!state.opencv?.solvePnPRansac || !state.opencv?.projectPoints) {
    throw new Error("OpenCV geometry runtime is not ready.");
  }
}
