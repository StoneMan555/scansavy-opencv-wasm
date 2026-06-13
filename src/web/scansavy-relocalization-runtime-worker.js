/* global cv, ort, importScripts, OffscreenCanvas, ImageData */

const DEFAULTS = {
  manifestUrl: "/scansavy-relocalization-runtime/manifest.json",
  ortAllUrl: "/scansavy-relocalization-runtime/ort/ort.all.min.js",
  ortWebGpuUrl: "/scansavy-relocalization-runtime/ort/ort.webgpu.min.js",
  ortWasmUrl: "/scansavy-relocalization-runtime/ort/ort.wasm.min.js",
  ortWasmPaths: "/scansavy-relocalization-runtime/ort/",
  ortWasmFile: "/scansavy-relocalization-runtime/ort/ort-wasm-simd-threaded.wasm",
  ortJsepWasmFile: "/scansavy-relocalization-runtime/ort/ort-wasm-simd-threaded.jsep.wasm",
  xfeatUrl: "/scansavy-relocalization-runtime/models/xfeat_2048_dynamic.onnx",
  lighterGlueUrl: "/scansavy-relocalization-runtime/models/lighterglue_L3.onnx",
  opencvJsUrl: "/scansavy-relocalization-runtime/scansavy-opencv-geometry.js",
  fallbackOpenCvJsUrl: "/scansavy-relocalization-runtime/scansavy-opencv.js",
  providers: ["webgpu", "wasm"],
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
  minMatches: 8,
  minInliers: 5,
  minConfidence: 0.2,
  stopAfterAcceptedCandidate: true,
  stopBurstAfterAcceptedCandidate: true,
  fuseBurstCandidates: true,
  burstFrameOrder: "center-first",
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
  wasmAutoThreadMax: 6,
  wasmAutoThreadDivisor: 2,
  wasmProxy: false,
  deviceBaseline: "samsung-s23-plus",
  deviceCpuCoreTarget: 8,
  webgpuBurstFrameConcurrency: 3,
  webgpuCandidateHydrationConcurrency: 6,
  candidateHydrationConcurrency: 6,
  wasmCandidateHydrationConcurrency: 6,
  maxAssetBufferCacheEntries: 192,
  maxAssetBufferCacheBytes: 128 * 1024 * 1024,
  prefetchNeighborKeyframes: 3,
  webgpuPreflight: true,
  webnnPreflight: true,
  webgpuPreflightTimeoutMs: 8000,
  webnnPreflightTimeoutMs: 8000,
  webgpuSessionCreateTimeoutMs: 45000,
  webnnSessionCreateTimeoutMs: 60000,
  wasmSessionCreateTimeoutMs: 90000,
  webgpuPowerPreference: "high-performance",
  webnnDeviceType: "npu",
  webnnPowerPreference: "high-performance",
  webgpuPreferredLayout: "NCHW",
  webgpuGraphCapture: false,
  webgpuForceFallbackAdapter: false,
  webgpuProfiling: false,
  lazyMapPack: true,
  maxHydratedKeyframes: 24,
};

const RUNTIME_PROFILES = {
  "phone-webgpu": {
    providers: ["webgpu", "wasm"],
    wasmNumThreads: 6,
    wasmAutoThreadMax: 6,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus",
    deviceCpuCoreTarget: 8,
    webgpuBurstFrameConcurrency: 3,
    webgpuCandidateHydrationConcurrency: 6,
    candidateHydrationConcurrency: 6,
    wasmCandidateHydrationConcurrency: 6,
    maxHydratedKeyframes: 64,
    prefetchNeighborKeyframes: 3,
    webgpuPreflightTimeoutMs: 10000,
    webgpuSessionCreateTimeoutMs: 60000,
    maxModelSide: 640,
    maxQueryFeatures: 512,
    maxKeyframeFeatures: 384,
    candidateLimit: 2,
    webgpuPreferredLayout: "NCHW",
    webgpuGraphCapture: true,
  },
  "phone-webnn-npu": {
    providers: ["webnn", "webgpu", "wasm"],
    wasmNumThreads: 6,
    wasmAutoThreadMax: 6,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus",
    deviceCpuCoreTarget: 8,
    webnnDeviceType: "npu",
    webnnPowerPreference: "high-performance",
    webnnPreflightTimeoutMs: 10000,
    webnnSessionCreateTimeoutMs: 60000,
    webgpuBurstFrameConcurrency: 3,
    webgpuCandidateHydrationConcurrency: 6,
    candidateHydrationConcurrency: 6,
    wasmCandidateHydrationConcurrency: 6,
    maxHydratedKeyframes: 64,
    prefetchNeighborKeyframes: 3,
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
    webgpuGraphCapture: true,
  },
  "phone-webgpu-fast": {
    providers: ["webgpu", "wasm"],
    wasmNumThreads: 6,
    wasmAutoThreadMax: 6,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus",
    deviceCpuCoreTarget: 8,
    webgpuBurstFrameConcurrency: 3,
    webgpuCandidateHydrationConcurrency: 6,
    candidateHydrationConcurrency: 6,
    wasmCandidateHydrationConcurrency: 6,
    maxHydratedKeyframes: 64,
    prefetchNeighborKeyframes: 3,
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
    webgpuPreferredLayout: "NCHW",
    webgpuGraphCapture: true,
  },
  "phone-webgpu-quality": {
    providers: ["webgpu", "wasm"],
    wasmNumThreads: 6,
    wasmAutoThreadMax: 6,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus",
    deviceCpuCoreTarget: 8,
    webgpuBurstFrameConcurrency: 3,
    webgpuCandidateHydrationConcurrency: 6,
    candidateHydrationConcurrency: 6,
    wasmCandidateHydrationConcurrency: 6,
    maxHydratedKeyframes: 64,
    prefetchNeighborKeyframes: 3,
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
    webgpuGraphCapture: true,
  },
  "phone-wasm": {
    providers: ["wasm"],
    wasmNumThreads: 6,
    wasmAutoThreadMax: 6,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus",
    deviceCpuCoreTarget: 8,
    candidateHydrationConcurrency: 6,
    wasmCandidateHydrationConcurrency: 6,
    maxHydratedKeyframes: 64,
    prefetchNeighborKeyframes: 3,
    maxModelSide: 640,
    maxQueryFeatures: 384,
    maxKeyframeFeatures: 384,
    candidateLimit: 1,
  },
  "phone-wasm-safe": {
    providers: ["wasm"],
    wasmNumThreads: 6,
    wasmAutoThreadMax: 6,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus",
    deviceCpuCoreTarget: 8,
    candidateHydrationConcurrency: 6,
    wasmCandidateHydrationConcurrency: 6,
    maxHydratedKeyframes: 64,
    prefetchNeighborKeyframes: 3,
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
    wasmNumThreads: 6,
    wasmAutoThreadMax: 6,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus",
    deviceCpuCoreTarget: 8,
    webgpuBurstFrameConcurrency: 3,
    webgpuCandidateHydrationConcurrency: 6,
    candidateHydrationConcurrency: 6,
    wasmCandidateHydrationConcurrency: 6,
    maxHydratedKeyframes: 64,
    prefetchNeighborKeyframes: 3,
    webgpuPreflightTimeoutMs: 8000,
    webgpuSessionCreateTimeoutMs: 45000,
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
    webgpuGraphCapture: true,
  },
  "emulator-webnn-gpu": {
    providers: ["webnn", "webgpu", "wasm"],
    wasmNumThreads: 6,
    wasmAutoThreadMax: 6,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    deviceBaseline: "samsung-s23-plus-emulator-webnn-probe",
    deviceCpuCoreTarget: 8,
    webnnDeviceType: "gpu",
    webnnPowerPreference: "high-performance",
    webnnPreflightTimeoutMs: 10000,
    webnnSessionCreateTimeoutMs: 60000,
    webgpuBurstFrameConcurrency: 3,
    webgpuCandidateHydrationConcurrency: 6,
    candidateHydrationConcurrency: 6,
    wasmCandidateHydrationConcurrency: 6,
    maxHydratedKeyframes: 64,
    prefetchNeighborKeyframes: 3,
    webgpuPreflightTimeoutMs: 8000,
    webgpuSessionCreateTimeoutMs: 45000,
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
    webgpuGraphCapture: true,
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
    wasmNumThreads: 6,
    wasmAutoThreadMax: 6,
    wasmAutoThreadDivisor: 2,
    wasmProxy: false,
    candidateHydrationConcurrency: 6,
    wasmCandidateHydrationConcurrency: 6,
    maxHydratedKeyframes: 64,
    prefetchNeighborKeyframes: 3,
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
  xfeatSession: null,
  lighterGlueSession: null,
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
  warmedUp: false,
  warmupSummary: null,
  assetBufferCache: new Map(),
  assetBufferCacheBytes: 0,
};

self.onmessage = async (event) => {
  const { id, type, payload } = event.data || {};
  try {
    if (type === "init") {
      const result = await initRuntime(payload || {});
      reply(id, type, result);
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
    reply(id, type || "unknown", {
      status: "failed",
      error: String(error?.message || error),
      stack: error?.stack || null,
      providerAttempts: error?.providerAttempts || null,
    });
  }
};

function reply(id, type, payload) {
  self.postMessage({ id, type, payload });
}

function runtimeDiagnostics() {
  return {
    runtimeProfile: state.options.runtimeProfile || state.options.profile || "phone-webgpu",
    provider: state.provider,
    providerAttempts: state.providerAttempts,
    crossOriginIsolated: Boolean(self.crossOriginIsolated),
    hasSharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    hasWebGpu: Boolean(self.navigator?.gpu),
    hasWebNn: Boolean(self.navigator?.ml),
    hardwareConcurrency: Number(self.navigator?.hardwareConcurrency || 0),
    maxModelSide: Number(state.options.maxModelSide || DEFAULTS.maxModelSide),
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
    webgpuCandidateHydrationConcurrency: Number(state.options.webgpuCandidateHydrationConcurrency || DEFAULTS.webgpuCandidateHydrationConcurrency),
    candidateHydrationConcurrency: Number(state.options.candidateHydrationConcurrency || DEFAULTS.candidateHydrationConcurrency),
    wasmCandidateHydrationConcurrency: Number(state.options.wasmCandidateHydrationConcurrency || DEFAULTS.wasmCandidateHydrationConcurrency),
    maxHydratedKeyframes: Number(state.options.maxHydratedKeyframes || DEFAULTS.maxHydratedKeyframes),
    hydratedAssetCacheEntries: state.assetBufferCache.size,
    hydratedAssetCacheBytes: state.assetBufferCacheBytes,
    prefetchNeighborKeyframes: Number(state.options.prefetchNeighborKeyframes || DEFAULTS.prefetchNeighborKeyframes),
    webgpuPowerPreference: state.options.webgpuPowerPreference || DEFAULTS.webgpuPowerPreference,
    webnnDeviceType: state.options.webnnDeviceType || DEFAULTS.webnnDeviceType,
    webnnPowerPreference: state.options.webnnPowerPreference || DEFAULTS.webnnPowerPreference,
    webgpuPreferredLayout: state.options.webgpuPreferredLayout || DEFAULTS.webgpuPreferredLayout,
    webgpuGraphCapture: Boolean(state.options.webgpuGraphCapture),
    webgpuPreflight: state.options.webgpuPreflight !== false,
    webnnPreflight: state.options.webnnPreflight !== false,
    webgpuPreflightTimeoutMs: Number(state.options.webgpuPreflightTimeoutMs || DEFAULTS.webgpuPreflightTimeoutMs),
    webnnPreflightTimeoutMs: Number(state.options.webnnPreflightTimeoutMs || DEFAULTS.webnnPreflightTimeoutMs),
    webgpuSessionCreateTimeoutMs: Number(state.options.webgpuSessionCreateTimeoutMs || DEFAULTS.webgpuSessionCreateTimeoutMs),
    webnnSessionCreateTimeoutMs: Number(state.options.webnnSessionCreateTimeoutMs || DEFAULTS.webnnSessionCreateTimeoutMs),
    wasmSessionCreateTimeoutMs: Number(state.options.wasmSessionCreateTimeoutMs || DEFAULTS.wasmSessionCreateTimeoutMs),
    wasm: state.wasmConfig,
    ortVersion: state.ort?.version || null,
  };
}

async function initRuntime(payload) {
  const started = performance.now();
  const requestedOptions = payload.options || payload;
  const profileName = requestedOptions.runtimeProfile || requestedOptions.profile || DEFAULTS.runtimeProfile || "phone-webgpu";
  state.manifest = await maybeFetchJson(requestedOptions.manifestUrl || DEFAULTS.manifestUrl);
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
  state.ort = await loadOrt(state.options);
  state.opencv = await loadOpenCv(state.options.opencvJsUrl, state.options.fallbackOpenCvJsUrl);

  const providers =
    Array.isArray(profileOptions?.providers) && profileOptions.providers.length && !profileOverrideKeys.includes("providers")
      ? profileOptions.providers
      : Array.isArray(state.options.providers) && state.options.providers.length
        ? state.options.providers
        : DEFAULTS.providers;
  state.options.providers = providers;
  const sessionResult = await createSessions(providers);

  return {
    status: "ready",
    packageName: state.manifest?.packageName || "scansavy-browser-relocalization-runtime",
    provider: state.provider,
    providerAttempts: sessionResult.providerAttempts,
    runtimeDiagnostics: runtimeDiagnostics(),
    hasOpenCvGeometry: Boolean(state.opencv?.solvePnPRansac && state.opencv?.projectPoints),
    hasXFeat: Boolean(state.xfeatSession),
    hasLighterGlue: Boolean(state.lighterGlueSession),
    elapsedMs: roundMs(performance.now() - started),
  };
}

function applyProfileDefaults(profileOptions, overrideKeys = []) {
  const explicitOverrides = new Set(Array.isArray(overrideKeys) ? overrideKeys.map(String) : []);
  for (const key of [
    "providers",
    "wasmNumThreads",
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
    "xfeatUrl",
    "fallbackXFeatUrl",
    "webgpuPowerPreference",
    "webnnDeviceType",
    "webnnPowerPreference",
    "webgpuPreferredLayout",
    "webgpuGraphCapture",
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

async function loadOrt(options) {
  if (state.ort?.InferenceSession) return state.ort;
  const providerOrder = Array.isArray(options.providers) ? options.providers : ["webgpu", "wasm"];
  const firstProvider = providerOrder[0] || "wasm";
  loadOrtScript(firstProvider, options);
  const runtime = getOrtGlobal();
  if (!runtime?.InferenceSession) throw new Error("ONNX Runtime Web did not initialize.");
  configureOrtWasmPaths(runtime, options);
  configureOrtWebGpu(runtime, options);
  return runtime;
}

async function createSessions(providers) {
  const attempts = [];
  for (const provider of providers) {
    try {
      if (provider === "webnn" && state.options.webnnPreflight !== false) {
        await withTimeout(
          preflightWebNn(state.options),
          Number(state.options.webnnPreflightTimeoutMs || DEFAULTS.webnnPreflightTimeoutMs),
          "WebNN preflight",
        );
      }
      if (provider === "webgpu" && state.options.webgpuPreflight !== false) {
        await withTimeout(
          preflightWebGpu(state.options),
          Number(state.options.webgpuPreflightTimeoutMs || DEFAULTS.webgpuPreflightTimeoutMs),
          "WebGPU preflight",
        );
      }
      loadOrtScript(provider, state.options);
      const sessionStarted = performance.now();
      const sessionOptions = sessionOptionsFor(provider, state.options);
      const sessionTimeoutMs = sessionTimeoutForProvider(provider, state.options);
      const xfeatSessionResult = await withTimeout(
        createXFeatSession(sessionOptions),
        sessionTimeoutMs,
        `${provider} XFeat session creation`,
      );
      state.xfeatSession = xfeatSessionResult.session;
      state.lighterGlueSession = await withTimeout(
        state.ort.InferenceSession.create(state.options.lighterGlueUrl, sessionOptions),
        sessionTimeoutMs,
        `${provider} LighterGlue session creation`,
      );
      state.provider = provider;
      attempts.push({
        provider,
        status: "ready",
        xfeatUrl: xfeatSessionResult.url,
        xfeatFallbackUsed: xfeatSessionResult.fallbackUsed,
        elapsedMs: roundMs(performance.now() - sessionStarted),
      });
      state.providerAttempts = attempts;
      return { providerAttempts: attempts };
    } catch (error) {
      attempts.push({ provider, status: "failed", error: String(error?.message || error) });
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
  const primaryUrl = state.options.xfeatUrl || DEFAULTS.xfeatUrl;
  const fallbackUrl = state.options.fallbackXFeatUrl || DEFAULTS.xfeatUrl;
  try {
    return {
      session: await state.ort.InferenceSession.create(primaryUrl, sessionOptions),
      url: primaryUrl,
      fallbackUsed: false,
    };
  } catch (primaryError) {
    if (!fallbackUrl || fallbackUrl === primaryUrl) throw primaryError;
    const fallbackSessionOptions = { ...sessionOptions };
    delete fallbackSessionOptions.enableGraphCapture;
    return {
      session: await state.ort.InferenceSession.create(fallbackUrl, fallbackSessionOptions),
      url: fallbackUrl,
      fallbackUsed: true,
      primaryError: String(primaryError?.message || primaryError),
    };
  }
}

async function preflightWebGpu(options) {
  const gpu = self.navigator?.gpu;
  if (!gpu?.requestAdapter) {
    throw new Error("WebGPU preflight failed: navigator.gpu.requestAdapter is unavailable.");
  }
  const adapter = await gpu.requestAdapter({
    powerPreference: options.webgpuPowerPreference || DEFAULTS.webgpuPowerPreference,
  });
  if (!adapter) {
    throw new Error("WebGPU preflight failed: no GPU adapter returned.");
  }
  return true;
}

async function preflightWebNn(options) {
  const ml = self.navigator?.ml;
  if (!ml?.createContext) {
    throw new Error("WebNN preflight failed: navigator.ml.createContext is unavailable.");
  }
  const contextOptions = {
    deviceType: options.webnnDeviceType || DEFAULTS.webnnDeviceType,
    powerPreference: options.webnnPowerPreference || DEFAULTS.webnnPowerPreference,
  };
  const context = await ml.createContext(contextOptions);
  if (!context) {
    throw new Error("WebNN preflight failed: no ML context returned.");
  }
  if (typeof context.close === "function") context.close();
  return { deviceType: contextOptions.deviceType };
}

function loadOrtScript(provider, options) {
  const scriptUrl = provider === "webnn"
    ? options.ortAllUrl
    : provider === "webgpu"
      ? options.ortWebGpuUrl
      : options.ortWasmUrl;
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
  const requestedThreads = options.wasmNumThreads ?? DEFAULTS.wasmNumThreads;
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
  const sessionOptions = {
    executionProviders: [executionProvider],
    graphOptimizationLevel: "all",
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
    return {
      name: "webgpu",
      preferredLayout: options.webgpuPreferredLayout || DEFAULTS.webgpuPreferredLayout,
    };
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
  try {
    return await loadOpenCvUrl(primaryUrl);
  } catch (primaryError) {
    if (!fallbackUrl || fallbackUrl === primaryUrl) throw primaryError;
    return await loadOpenCvUrl(fallbackUrl);
  }
}

async function loadOpenCvUrl(url) {
  const scriptUrl = resolveUrl(url);
  const wasmUrl = scriptUrl.includes("scansavy-opencv-geometry.js")
    ? new URL("scansavy-opencv-geometry.wasm", scriptUrl).href
    : new URL("scansavy-opencv.wasm", scriptUrl).href;
  const previousModule = self.Module && typeof self.Module === "object" ? self.Module : {};
  self.Module = {
    ...previousModule,
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
    if (evictId && evictId !== state.lastAcceptedKeyframeId) state.hydratedKeyframes.delete(evictId);
  }
  return hydrated;
}

function scheduleKeyframePrefetch(keyframeId) {
  const count = Math.max(0, Number(state.options.prefetchNeighborKeyframes || DEFAULTS.prefetchNeighborKeyframes));
  if (!count || !keyframeId) return;
  const neighbors = neighborKeyframeIds(keyframeId).slice(0, count);
  if (!neighbors.length) return;
  setTimeout(() => {
    void mapWithConcurrency(neighbors, Math.min(3, neighbors.length), async (id) => {
      const keyframe = state.keyframes.find((candidate) => String(candidate.id) === String(id));
      if (!keyframe || keyframe.hydrated || state.hydratedKeyframes.has(String(keyframe.id))) return null;
      try {
        return await ensureHydratedKeyframe(keyframe);
      } catch {
        return null;
      }
    });
  }, 0);
}

function neighborKeyframeIds(keyframeId) {
  const id = String(keyframeId);
  const selected = [];
  const add = (value) => {
    if (value == null) return;
    const normalized = String(value);
    if (normalized && normalized !== id && !selected.includes(normalized)) selected.push(normalized);
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
    keypoints: keypoints.slice(0, featureCount * 2),
    descriptors: descriptorRows,
    scores: scores?.length ? scores.slice(0, featureCount) : null,
    landmarks: landmarks.length ? landmarks.slice(0, featureCount * 3) : new Float32Array(featureCount * 3).fill(Number.NaN),
    landmarkIds: Array.isArray(landmarkIds) ? landmarkIds.slice(0, featureCount) : null,
    validLandmarkMask,
    validLandmarkCount,
    descriptorDim,
    retrieval: keyframe.retrieval || retrievalRowForKeyframe(sidecar, keyframe.id) || {},
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
  const frameResults = [];
  const previousAcceptedKeyframeId = state.lastAcceptedKeyframeId;
  const matcherBudget = {
    max: Math.max(1, Number(options.maxLighterGluePairsPerBurst || DEFAULTS.maxLighterGluePairsPerBurst)),
    tried: 0,
    remaining: Math.max(1, Number(options.maxLighterGluePairsPerBurst || DEFAULTS.maxLighterGluePairsPerBurst)),
  };

  for (const frame of orderBurstFrames(frames, options)) {
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

  return {
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
    const matched = await runLighterGlue(extracted, keyframe, options);
    const candidate = solvePnpForMatches(matched, keyframe, extracted, frame.frameIndex ?? null, options);
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
  const prep = preprocessImage(imageData, options);
  const preprocessElapsedMs = roundMs(performance.now() - started);
  const input = new state.ort.Tensor("float32", prep.tensor, [1, 3, prep.height, prep.width]);
  const inputName = state.xfeatSession.inputNames?.[0] || "images";
  const inferenceStarted = performance.now();
  const output = await state.xfeatSession.run({ [inputName]: input });
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
  return {
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
}

async function runLighterGlue(query, keyframe, options) {
  const started = performance.now();
  const feeds = {
    kpts0: query.keypointTensor || new state.ort.Tensor("float32", normalizeKptsForGlue(query.keypoints, query.width, query.height), [1, query.count, 2]),
    kpts1: keyframe.keypointTensor || new state.ort.Tensor("float32", keyframe.normalizedKeypoints || normalizeKptsForGlue(keyframe.keypoints, keyframe.width || query.width, keyframe.height || query.height), [1, keyframe.count, 2]),
    desc0: query.descriptorTensor || new state.ort.Tensor("float32", query.descriptors, [1, query.count, 64]),
    desc1: keyframe.descriptorTensor || new state.ort.Tensor("float32", keyframe.descriptors, [1, keyframe.count, 64]),
  };
  const output = await state.lighterGlueSession.run(feeds);
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
  return { keyframe, query, matches, elapsedMs: roundMs(performance.now() - started) };
}

function solvePnpForMatches(matched, keyframe, query, frameIndex, options) {
  const matches = matched.matches || [];
  if (matches.length < 6) {
    return failedCandidate(
      keyframe,
      frameIndex,
      `Only ${matches.length} XFeat/LighterGlue matches; PnP needs at least 6.`,
      { matcherElapsedMs: matched.elapsedMs, rawMatchCount: matches.length, geometryMatchCount: 0 },
    );
  }

  const pnpInput = pnpInputForMatches(matches, keyframe, query);
  if (pnpInput.matchCount < 6) {
    const failed = failedCandidate(
      keyframe,
      frameIndex,
      `Only ${pnpInput.matchCount} geometry-backed XFeat/LighterGlue matches from ${matches.length} visual matches; PnP needs at least 6.`,
      { matcherElapsedMs: matched.elapsedMs, rawMatchCount: matches.length, geometryMatchCount: pnpInput.matchCount },
    );
    attachPnpInput(failed, pnpInput);
    return failed;
  }

  const solved = solvePnpArrays({
    objectArray: pnpInput.objectArray,
    imageArray: pnpInput.imageArray,
    cameraModel: keyframe.cameraModel || state.sidecar.cameraModel,
    matchCount: pnpInput.matchCount,
    rawMatchCount: matches.length,
    geometryMatchCount: pnpInput.matchCount,
    matcherElapsedMs: matched.elapsedMs,
    keyframeId: keyframe.id,
    frameIndex,
    descriptorMode: state.sidecar?.descriptorMode || "xfeat-lg-v0",
    candidateMode: "single-frame",
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

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const sourceCanvas = new OffscreenCanvas(imageData.width, imageData.height);
  sourceCanvas.getContext("2d").putImageData(imageData, 0, 0);
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
  const ranked = state.keyframes
    .filter((keyframe) => !selected.includes(keyframe))
    .map((keyframe) => {
      const descriptorDistance = centroidDistance(query.descriptorCentroid, keyframe.descriptorCentroid);
      const temporalDistance = sourceFrame !== null && keyframe.sourceFrameIndex !== null
        ? Math.abs(sourceFrame - keyframe.sourceFrameIndex)
        : null;
      const retrieval = keyframe.retrieval || {};
      const covisibilityBoost = lastNeighbors.has(String(keyframe.id)) ? -0.1 : 0;
      const trajectoryBoost = Array.isArray(retrieval.trajectoryNeighbors) && state.lastAcceptedKeyframeId && retrieval.trajectoryNeighbors.includes(state.lastAcceptedKeyframeId) ? -0.05 : 0;
      const qualityBoost = -0.03 * Number(retrieval.qualityScore || 0);
      const temporalPenalty = temporalDistance !== null ? Math.min(0.25, temporalDistance / 2400) : 0;
      return {
        keyframe,
        descriptorDistance,
        temporalDistance,
        score: Number.isFinite(descriptorDistance)
          ? descriptorDistance + temporalPenalty + covisibilityBoost + trajectoryBoost + qualityBoost
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
    return new ImageData(new Uint8ClampedArray(frame.data), Number(frame.width), Number(frame.height));
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
  const response = await fetch(url, { cache: "force-cache" });
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

function resolveUrl(path, baseUrl = self.location.href) {
  if (!path) return self.location.href;
  const absoluteBaseUrl = /^https?:\/\//i.test(baseUrl)
    ? baseUrl
    : new URL(baseUrl, self.location.origin || self.location.href).href;
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
  if (!state.keyframes.length) throw new Error("Runtime has not loaded an xfeat-lg-v0 MapPack sidecar.");
  requireOpenCv();
}

function requireOpenCv() {
  if (!state.opencv?.solvePnPRansac || !state.opencv?.projectPoints) {
    throw new Error("OpenCV geometry runtime is not ready.");
  }
}
