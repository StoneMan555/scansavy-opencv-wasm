export async function loadScanSavvyOpenCv(options = {}) {
  const globalScope = typeof self !== "undefined" ? self : window;
  const existing = globalScope.cv;
  if (existing && existing.Mat) return existing;

  const url = options.opencvJsUrl || "/scansavy-opencv/scansavy-opencv.js";

  if (typeof importScripts === "function") {
    importScripts(url);
    return await waitForOpenCv(globalScope);
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(script);
  });

  return await waitForOpenCv(globalScope);
}

async function waitForOpenCv(globalScope) {
  const cv = globalScope.cv;
  if (!cv) throw new Error("OpenCV.js loaded without exposing global cv.");
  if (typeof cv.then === "function") return await cv;
  if (cv.Mat) return cv;

  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for OpenCV runtime initialization.")), 15000);
    cv.onRuntimeInitialized = () => {
      clearTimeout(timeout);
      resolve(cv);
    };
  });
}

