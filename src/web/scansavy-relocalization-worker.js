/* global cv */

const BRIEF_PAIRS = [
  [-10, -6, 10, 6], [-8, 5, 9, -5], [-12, 0, 12, 0], [-4, -12, 4, 12],
  [-9, -9, 7, -7], [-7, 8, 8, 7], [-13, 4, 3, -11], [-3, 11, 12, -2],
  [-15, -1, -2, 15], [1, -15, 15, 1], [-11, 10, 11, -10], [-6, -3, 6, 3],
  [-14, 8, -4, -8], [4, 8, 14, -8], [-8, -14, 8, -4], [-8, 4, 8, 14],
  [-16, -12, -6, -2], [6, 2, 16, 12], [-16, 12, -6, 2], [6, -2, 16, -12],
  [-2, -16, 2, -6], [-2, 6, 2, 16], [-12, -16, -2, -6], [2, 6, 12, 16],
  [-12, 16, -2, 6], [2, -6, 12, -16], [-16, -6, 0, -6], [0, 6, 16, 6],
  [-6, -16, -6, 0], [6, 0, 6, 16], [-15, 0, 0, 15], [0, -15, 15, 0],
];

let opencv = null;
let sidecar = null;
let references = [];

self.onmessage = async (event) => {
  const { id, type, payload } = event.data || {};
  try {
    if (type === "init") {
      opencv = await loadOpenCv(payload?.opencvJsUrl || "/scansavy-opencv/scansavy-opencv.js");
      reply(id, type, { status: "ready", hasCalib3d: Boolean(opencv.solvePnPRansac), hasOrb: Boolean(opencv.ORB) });
      return;
    }
    if (type === "loadMapPack") {
      sidecar = payload?.sidecar;
      references = Array.isArray(sidecar?.references) ? sidecar.references : [];
      reply(id, type, {
        status: references.length > 0 ? "ready" : "failed",
        descriptorMode: sidecar?.descriptorMode || null,
        referenceCount: references.length,
      });
      return;
    }
    if (type === "localizeBurst") {
      if (!opencv) throw new Error("Worker has not loaded OpenCV.js.");
      if (!sidecar) throw new Error("Worker has not loaded a MapPack sidecar.");
      const result = localizeBurst(payload?.frames || [], payload?.options || {});
      reply(id, type, result);
      return;
    }
    reply(id, type || "unknown", { status: "failed", error: `Unknown message type: ${type}` });
  } catch (error) {
    reply(id, type || "unknown", { status: "failed", error: String(error?.message || error) });
  }
};

function reply(id, type, payload) {
  self.postMessage({ id, type, payload });
}

async function loadOpenCv(url) {
  if (opencv?.Mat) return opencv;
  importScripts(url);
  if (self.cv?.then) return await self.cv;
  if (self.cv?.Mat) return self.cv;
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for OpenCV.js runtime.")), 15000);
    self.cv.onRuntimeInitialized = () => {
      clearTimeout(timeout);
      resolve(self.cv);
    };
  });
}

function localizeBurst(frames, options) {
  const descriptorMode = sidecar.descriptorMode || "compact-brief-v1";
  const minMatches = Number(options.minMatches || 8);
  const minInliers = Number(options.minInliers || 5);
  const minConfidence = Number(options.minConfidence || 0.2);
  const frameResults = frames.map((frame) => localizeFrame(frame, descriptorMode, options));
  const candidates = frameResults.filter((result) => result.status === "ready");
  const best = candidates.sort((a, b) => scoreResult(b) - scoreResult(a))[0] || null;

  if (!best) {
    return {
      status: "rejected",
      descriptorMode,
      confidence: 0,
      inlierCount: 0,
      matchCount: Math.max(0, ...frameResults.map((result) => result.matchCount || 0)),
      reprojectionErrorPx: null,
      frameResults,
      notes: ["No burst frame produced a valid PnP solution."],
    };
  }

  const accepted = best.matchCount >= minMatches && best.inlierCount >= minInliers && best.confidence >= minConfidence;
  return {
    ...best,
    status: accepted ? "ready" : "rejected",
    frameResults,
    notes: [
      ...(best.notes || []),
      accepted ? "Accepted by development gate." : "Rejected by confidence/inlier/match gate.",
    ],
  };
}

function localizeFrame(frame, descriptorMode, options) {
  if (descriptorMode === "compact-brief-v1") {
    const matches = matchCompactBrief(frame.imageData, options);
    return solvePnp(matches, descriptorMode, frame.frameIndex);
  }
  return localizeWithOpenCvDescriptors(frame, descriptorMode, options);
}

function localizeWithOpenCvDescriptors(frame, descriptorMode, options) {
  const imageData = frame.imageData;
  const src = opencv.matFromImageData(imageData);
  const gray = new opencv.Mat();
  const keypoints = new opencv.KeyPointVector();
  const descriptors = new opencv.Mat();
  const detector = descriptorMode === "akaze"
    ? opencv.AKAZE.create()
    : opencv.ORB.create(Number(options.maxFeatures || 800));

  try {
    opencv.cvtColor(src, gray, opencv.COLOR_RGBA2GRAY);
    detector.detectAndCompute(gray, new opencv.Mat(), keypoints, descriptors);
    if (descriptors.empty()) return failedFrame(descriptorMode, frame.frameIndex, "No OpenCV descriptors found.");
    return {
      ...failedFrame(descriptorMode, frame.frameIndex, "OpenCV descriptor matching requires an orb-32/akaze MapPack sidecar."),
      detectedKeypoints: keypoints.size(),
      descriptorRows: descriptors.rows,
    };
  } finally {
    src.delete();
    gray.delete();
    keypoints.delete();
    descriptors.delete();
    detector.delete?.();
  }
}

function matchCompactBrief(imageData, options) {
  const gray = rgbaToGray(imageData);
  const width = imageData.width;
  const height = imageData.height;
  const step = Math.max(6, Math.round(Math.min(width, height) / 32));
  const query = [];
  for (let y = 18; y < height - 18; y += step) {
    for (let x = 18; x < width - 18; x += step) {
      const score = cornerScore(gray, width, height, x, y);
      if (score >= Number(options.minCornerScore || 28)) {
        query.push({ x, y, score, descriptorHex: descriptorAt(gray, width, height, x, y) });
      }
    }
  }
  query.sort((a, b) => b.score - a.score);

  const maxQuery = Number(options.maxQueryFeatures || 320);
  const maxReferences = Number(options.maxReferences || references.length);
  const refSlice = references.slice(0, maxReferences);
  const matches = [];

  for (const q of query.slice(0, maxQuery)) {
    let best = null;
    let second = null;
    for (const ref of refSlice) {
      const distance = hammingHex(q.descriptorHex, ref.descriptorHex);
      if (!best || distance < best.distance) {
        second = best;
        best = { query: q, reference: ref, distance };
      } else if (!second || distance < second.distance) {
        second = { query: q, reference: ref, distance };
      }
    }
    if (!best) continue;
    const ratio = second ? best.distance / Math.max(1, second.distance) : 0;
    if (best.distance <= Number(options.maxHammingDistance || 14) && ratio <= Number(options.maxMatchRatio || 0.92)) {
      matches.push(best);
    }
  }

  return matches;
}

function solvePnp(matches, descriptorMode, frameIndex) {
  if (matches.length < 6) return failedFrame(descriptorMode, frameIndex, `Only ${matches.length} matches; PnP needs at least 6.`);

  const objectArray = [];
  const imageArray = [];
  for (const match of matches) {
    const world = match.reference.world;
    objectArray.push(world.x, world.y, world.z);
    imageArray.push(match.query.x, match.query.y);
  }

  const camera = sidecar.cameraModel || {};
  const objectPoints = opencv.matFromArray(matches.length, 3, opencv.CV_64F, objectArray);
  const imagePoints = opencv.matFromArray(matches.length, 2, opencv.CV_64F, imageArray);
  const cameraMatrix = opencv.matFromArray(3, 3, opencv.CV_64F, [
    Number(camera.fx || 1), 0, Number(camera.cx || 0),
    0, Number(camera.fy || 1), Number(camera.cy || 0),
    0, 0, 1,
  ]);
  const distCoeffs = opencv.Mat.zeros(4, 1, opencv.CV_64F);
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
      80,
      6.0,
      0.98,
      inliers,
    );
    if (!ok || inliers.rows < 4) return failedFrame(descriptorMode, frameIndex, "solvePnPRansac did not find a stable solution.");

    try {
      opencv.solvePnPRefineLM(objectPoints, imagePoints, cameraMatrix, distCoeffs, rvec, tvec);
    } catch {
      // Refinement is best-effort; the RANSAC pose is still useful.
    }

    const inlierCount = inliers.rows || inliers.cols || 0;
    const confidence = Math.min(1, (inlierCount / Math.max(8, matches.length)) * Math.min(1, matches.length / 80));
    return {
      status: "ready",
      descriptorMode,
      frameIndex,
      confidence: Number(confidence.toFixed(6)),
      inlierCount,
      matchCount: matches.length,
      reprojectionErrorPx: null,
      rvec: mat3(rvec),
      tvec: mat3(tvec),
      notes: ["Solved with OpenCV solvePnPRansac."],
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

function failedFrame(descriptorMode, frameIndex, reason) {
  return {
    status: "failed",
    descriptorMode,
    frameIndex,
    confidence: 0,
    inlierCount: 0,
    matchCount: 0,
    reprojectionErrorPx: null,
    notes: [reason],
  };
}

function scoreResult(result) {
  return result.confidence * 1000 + result.inlierCount * 10 + result.matchCount;
}

function rgbaToGray(imageData) {
  const gray = new Uint8Array(imageData.width * imageData.height);
  const src = imageData.data;
  for (let i = 0, j = 0; i < src.length; i += 4, j += 1) {
    gray[j] = Math.round(src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114);
  }
  return gray;
}

function grayAt(gray, width, height, x, y) {
  const xx = Math.max(0, Math.min(width - 1, Math.round(x)));
  const yy = Math.max(0, Math.min(height - 1, Math.round(y)));
  return gray[yy * width + xx];
}

function descriptorAt(gray, width, height, x, y) {
  const bytes = [];
  for (let base = 0; base < BRIEF_PAIRS.length; base += 8) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      const [ax, ay, bx, by] = BRIEF_PAIRS[base + bit];
      if (grayAt(gray, width, height, x + ax, y + ay) > grayAt(gray, width, height, x + bx, y + by)) {
        value |= 1 << bit;
      }
    }
    bytes.push(value.toString(16).padStart(2, "0"));
  }
  return bytes.join("");
}

function cornerScore(gray, width, height, x, y) {
  const gx = Math.abs(grayAt(gray, width, height, x + 2, y) - grayAt(gray, width, height, x - 2, y));
  const gy = Math.abs(grayAt(gray, width, height, x, y + 2) - grayAt(gray, width, height, x, y - 2));
  const diag = Math.abs(grayAt(gray, width, height, x + 2, y + 2) - grayAt(gray, width, height, x - 2, y - 2));
  return gx + gy + diag;
}

function hammingHex(a, b) {
  const length = Math.min(a.length, b.length);
  let distance = Math.abs(a.length - b.length) * 4;
  for (let index = 0; index < length; index += 2) {
    const av = Number.parseInt(a.slice(index, index + 2) || "0", 16);
    const bv = Number.parseInt(b.slice(index, index + 2) || "0", 16);
    distance += popcount8(av ^ bv);
  }
  return distance;
}

function popcount8(value) {
  value -= (value >> 1) & 0x55;
  value = (value & 0x33) + ((value >> 2) & 0x33);
  return (value + (value >> 4)) & 0x0f;
}

function mat3(mat) {
  const data = mat.data64F || mat.data32F;
  return [Number(data[0] || 0), Number(data[1] || 0), Number(data[2] || 0)];
}

