/* global cv, ort, importScripts, OffscreenCanvas, ImageData */

const DEFAULTS = {
  manifestUrl: "/scansavy-relocalization-runtime/manifest.json",
  ortWebGpuUrl: "/scansavy-relocalization-runtime/ort/ort.webgpu.min.js",
  ortWasmUrl: "/scansavy-relocalization-runtime/ort/ort.wasm.min.js",
  ortWasmPaths: "/scansavy-relocalization-runtime/ort/",
  xfeatUrl: "/scansavy-relocalization-runtime/models/xfeat_2048_dynamic.onnx",
  lighterGlueUrl: "/scansavy-relocalization-runtime/models/lighterglue_L3.onnx",
  opencvJsUrl: "/scansavy-relocalization-runtime/scansavy-opencv-geometry.js",
  fallbackOpenCvJsUrl: "/scansavy-relocalization-runtime/scansavy-opencv.js",
  providers: ["webgpu", "wasm"],
  maxModelSide: 640,
  padMultiple: 32,
  topK: 2048,
  candidateLimit: 4,
  lighterGlueScoreThreshold: 0.2,
  minMatches: 8,
  minInliers: 5,
  minConfidence: 0.2,
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
  keyframes: [],
  ortScriptsLoaded: new Set(),
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
    });
  }
};

function reply(id, type, payload) {
  self.postMessage({ id, type, payload });
}

async function initRuntime(payload) {
  const started = performance.now();
  state.options = { ...DEFAULTS, ...(payload.options || payload) };
  state.manifest = await maybeFetchJson(state.options.manifestUrl);
  state.ort = await loadOrt(state.options);
  state.opencv = await loadOpenCv(state.options.opencvJsUrl, state.options.fallbackOpenCvJsUrl);

  const providers = Array.isArray(state.options.providers) && state.options.providers.length
    ? state.options.providers
    : DEFAULTS.providers;
  const sessionResult = await createSessions(providers);

  return {
    status: "ready",
    packageName: state.manifest?.packageName || "scansavy-browser-relocalization-runtime",
    provider: state.provider,
    providerAttempts: sessionResult.providerAttempts,
    hasOpenCvGeometry: Boolean(state.opencv?.solvePnPRansac && state.opencv?.projectPoints),
    hasXFeat: Boolean(state.xfeatSession),
    hasLighterGlue: Boolean(state.lighterGlueSession),
    elapsedMs: roundMs(performance.now() - started),
  };
}

async function loadOrt(options) {
  if (state.ort?.InferenceSession) return state.ort;
  const providerOrder = Array.isArray(options.providers) ? options.providers : ["webgpu", "wasm"];
  const firstProvider = providerOrder[0] || "wasm";
  loadOrtScript(firstProvider, options);
  const runtime = getOrtGlobal();
  if (!runtime?.InferenceSession) throw new Error("ONNX Runtime Web did not initialize.");
  runtime.env.wasm.wasmPaths = options.ortWasmPaths;
  return runtime;
}

async function createSessions(providers) {
  const attempts = [];
  for (const provider of providers) {
    try {
      loadOrtScript(provider, state.options);
      const sessionOptions = {
        executionProviders: [provider],
        graphOptimizationLevel: "all",
      };
      state.xfeatSession = await state.ort.InferenceSession.create(state.options.xfeatUrl, sessionOptions);
      state.lighterGlueSession = await state.ort.InferenceSession.create(state.options.lighterGlueUrl, sessionOptions);
      state.provider = provider;
      attempts.push({ provider, status: "ready" });
      return { providerAttempts: attempts };
    } catch (error) {
      attempts.push({ provider, status: "failed", error: String(error?.message || error) });
    }
  }
  throw new Error(`Unable to create ONNX sessions with providers: ${providers.join(", ")}`);
}

function loadOrtScript(provider, options) {
  const scriptUrl = provider === "webgpu" ? options.ortWebGpuUrl : options.ortWasmUrl;
  if (state.ortScriptsLoaded.has(scriptUrl)) return;
  importScripts(scriptUrl);
  state.ortScriptsLoaded.add(scriptUrl);
  const runtime = getOrtGlobal();
  if (runtime?.env?.wasm) runtime.env.wasm.wasmPaths = options.ortWasmPaths;
}

function getOrtGlobal() {
  return self.ort || (typeof ort !== "undefined" ? ort : null);
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
  importScripts(url);
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
  const sidecarBaseUrl = payload.sidecarUrl || state.options.sidecarBaseUrl || self.location.href;
  if (sidecar.schemaVersion !== "scansavy.mappack.xfeat-lg.v0") {
    throw new Error(`Unsupported sidecar schemaVersion: ${sidecar.schemaVersion}`);
  }

  const keyframes = [];
  for (const keyframe of sidecar.keyframes || []) {
    keyframes.push(await hydrateKeyframe(keyframe, sidecarBaseUrl, sidecar));
  }
  state.sidecar = sidecar;
  state.keyframes = keyframes.filter((keyframe) => keyframe.descriptors?.length && keyframe.keypoints?.length && keyframe.landmarks?.length);

  return {
    status: state.keyframes.length > 0 ? "ready" : "failed",
    descriptorMode: sidecar.descriptorMode || "xfeat-lg-v0",
    keyframeCount: state.keyframes.length,
    descriptorDim: sidecar.descriptorDim || 64,
    elapsedMs: roundMs(performance.now() - started),
  };
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
  const count = Math.min(
    Math.floor(keypoints.length / 2),
    Math.floor(descriptors.length / descriptorDim),
    Math.floor(landmarks.length / 3),
  );

  return {
    id: keyframe.id,
    width: Number(keyframe.width || sidecar.cameraModel?.width || 0),
    height: Number(keyframe.height || sidecar.cameraModel?.height || 0),
    cameraModel: keyframe.cameraModel || sidecar.cameraModel || null,
    keypoints: keypoints.slice(0, count * 2),
    descriptors: descriptors.slice(0, count * descriptorDim),
    scores: scores?.length ? scores.slice(0, count) : null,
    landmarks: landmarks.slice(0, count * 3),
    landmarkIds: Array.isArray(landmarkIds) ? landmarkIds.slice(0, count) : null,
    descriptorDim,
    count,
  };
}

async function localizeBurst(payload) {
  requireReady();
  const started = performance.now();
  const frames = payload.frames || [];
  const options = { ...state.options, ...(payload.options || {}) };
  const frameResults = [];

  for (const frame of frames) {
    frameResults.push(await localizeFrame(frame, options));
  }

  const candidates = frameResults.filter((result) => result.status === "ready");
  const best = candidates.sort((a, b) => scoreLocalization(b) - scoreLocalization(a))[0] || null;
  const accepted = Boolean(best)
    && best.matchCount >= Number(options.minMatches)
    && best.inlierCount >= Number(options.minInliers)
    && best.confidence >= Number(options.minConfidence);

  return {
    status: accepted ? "ready" : "rejected",
    descriptorMode: "xfeat-lg-v0",
    provider: state.provider,
    frameCount: frames.length,
    best,
    confidence: best?.confidence || 0,
    matchCount: best?.matchCount || 0,
    inlierCount: best?.inlierCount || 0,
    reprojectionErrorPx: best?.reprojectionErrorPx ?? null,
    frameResults,
    elapsedMs: roundMs(performance.now() - started),
    reason: accepted ? "accepted" : rejectionReason(best, options),
  };
}

async function localizeFrame(frame, options) {
  const started = performance.now();
  const imageData = normalizeImageData(frame.imageData || frame);
  const extracted = await runXFeat(imageData, options);
  const keyframes = shortlistKeyframes(extracted, options);
  const candidateResults = [];

  for (const keyframe of keyframes) {
    const matched = await runLighterGlue(extracted, keyframe, options);
    candidateResults.push(solvePnpForMatches(matched, keyframe, extracted, frame.frameIndex ?? null, options));
  }

  const best = candidateResults
    .filter((result) => result.status === "ready")
    .sort((a, b) => scoreLocalization(b) - scoreLocalization(a))[0] || null;

  if (!best) {
    return {
      status: "failed",
      frameIndex: frame.frameIndex ?? null,
      detectedKeypoints: extracted.count,
      candidateKeyframes: keyframes.map((keyframe) => keyframe.id),
      candidateResults,
      elapsedMs: roundMs(performance.now() - started),
      reason: "No candidate keyframe produced a valid PnP solution.",
    };
  }

  return {
    ...best,
    detectedKeypoints: extracted.count,
    candidateKeyframes: keyframes.map((keyframe) => keyframe.id),
    candidateResults,
    elapsedMs: roundMs(performance.now() - started),
  };
}

async function runXFeat(imageData, options) {
  const prep = preprocessImage(imageData, options);
  const input = new state.ort.Tensor("float32", prep.tensor, [1, 3, prep.height, prep.width]);
  const inputName = state.xfeatSession.inputNames?.[0] || "images";
  const output = await state.xfeatSession.run({ [inputName]: input });
  const keypointsRaw = outputTensor(output, ["keypoints", "kpts", "mkpts"], 0);
  const descriptorsRaw = outputTensor(output, ["descriptors", "desc", "descs"], 1);
  const scoresRaw = outputTensor(output, ["scores", "score", "prob"], 2, false);
  const keypoints = mapKeypointsToSource(keypointsRaw.data, prep, keypointsRaw.dims);
  const descriptors = Float32Array.from(descriptorsRaw.data);
  const scores = scoresRaw ? Float32Array.from(scoresRaw.data) : null;
  const count = Math.min(Math.floor(keypoints.length / 2), Math.floor(descriptors.length / 64));
  return {
    keypoints: keypoints.slice(0, count * 2),
    descriptors: descriptors.slice(0, count * 64),
    scores: scores?.length ? scores.slice(0, count) : null,
    count,
    width: imageData.width,
    height: imageData.height,
    prep,
  };
}

async function runLighterGlue(query, keyframe, options) {
  const queryKpts = normalizeKptsForGlue(query.keypoints, query.width, query.height);
  const mapKpts = normalizeKptsForGlue(keyframe.keypoints, keyframe.width || query.width, keyframe.height || query.height);
  const feeds = {
    kpts0: new state.ort.Tensor("float32", queryKpts, [1, query.count, 2]),
    kpts1: new state.ort.Tensor("float32", mapKpts, [1, keyframe.count, 2]),
    desc0: new state.ort.Tensor("float32", query.descriptors, [1, query.count, 64]),
    desc1: new state.ort.Tensor("float32", keyframe.descriptors, [1, keyframe.count, 64]),
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
  return { keyframe, query, matches };
}

function solvePnpForMatches(matched, keyframe, query, frameIndex, options) {
  const matches = matched.matches || [];
  if (matches.length < 6) {
    return failedCandidate(keyframe, frameIndex, `Only ${matches.length} XFeat/LighterGlue matches; PnP needs at least 6.`);
  }

  const objectArray = [];
  const imageArray = [];
  for (const match of matches) {
    const qi = match.queryIndex * 2;
    const mi3 = match.mapIndex * 3;
    imageArray.push(query.keypoints[qi], query.keypoints[qi + 1]);
    objectArray.push(keyframe.landmarks[mi3], keyframe.landmarks[mi3 + 1], keyframe.landmarks[mi3 + 2]);
  }

  return solvePnpArrays({
    objectArray,
    imageArray,
    cameraModel: keyframe.cameraModel || state.sidecar.cameraModel,
    matchCount: matches.length,
    keyframeId: keyframe.id,
    frameIndex,
    descriptorMode: "xfeat-lg-v0",
  });
}

function solvePnpArrays(input) {
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
      return failedCandidate({ id: input.keyframeId }, input.frameIndex, "solvePnPRansac did not find a stable solution.");
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
      inlierCount,
      inlierRatio: round6(inlierRatio),
      confidence: round6(confidence),
      reprojectionErrorPx: round6(reprojectionErrorPx),
      rvec: matToArray3(rvec),
      tvec: matToArray3(tvec),
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
  const scale = Math.min(1, maxSide / Math.max(imageData.width, imageData.height));
  const resizedWidth = Math.max(1, Math.round(imageData.width * scale));
  const resizedHeight = Math.max(1, Math.round(imageData.height * scale));
  const width = roundUp(resizedWidth, padMultiple);
  const height = roundUp(resizedHeight, padMultiple);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const sourceCanvas = new OffscreenCanvas(imageData.width, imageData.height);
  sourceCanvas.getContext("2d").putImageData(imageData, 0, 0);
  ctx.drawImage(sourceCanvas, 0, 0, resizedWidth, resizedHeight);
  const resized = ctx.getImageData(0, 0, width, height).data;
  const tensor = new Float32Array(3 * width * height);
  const plane = width * height;
  for (let i = 0, p = 0; i < resized.length; i += 4, p += 1) {
    tensor[p] = resized[i] / 255;
    tensor[plane + p] = resized[i + 1] / 255;
    tensor[plane * 2 + p] = resized[i + 2] / 255;
  }
  return { tensor, width, height, resizedWidth, resizedHeight, scale, sourceWidth: imageData.width, sourceHeight: imageData.height };
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

function shortlistKeyframes(_query, options) {
  return state.keyframes.slice(0, Number(options.candidateLimit || DEFAULTS.candidateLimit));
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
  const response = await fetch(new URL(path, baseUrl));
  if (!response.ok) throw new Error(`Failed to fetch sidecar asset ${path}: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  if (format === "float16") return float16ToFloat32(new Uint16Array(buffer));
  if (format === "uint16-normalized") return uint16NormalizedToFloat32(new Uint16Array(buffer));
  return new Float32Array(buffer);
}

async function fetchJsonArray(path, baseUrl, optional = false) {
  if (!path) return optional ? [] : null;
  const response = await fetch(new URL(path, baseUrl));
  if (!response.ok) throw new Error(`Failed to fetch sidecar JSON asset ${path}: HTTP ${response.status}`);
  return await response.json();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  return await response.json();
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

function failedCandidate(keyframe, frameIndex, reason) {
  return {
    status: "failed",
    descriptorMode: "xfeat-lg-v0",
    keyframeId: keyframe?.id || null,
    frameIndex,
    confidence: 0,
    matchCount: 0,
    inlierCount: 0,
    reprojectionErrorPx: null,
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
