#!/usr/bin/env node
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, "dist");
const manifestPath = join(distDir, "manifest.json");
const outputPath = join(root, "dist", "runtime-package-size-report.json");
const runtimeAssets = JSON.parse(readFileSync(join(root, "config", "runtime-assets.json"), "utf8"));
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : { files: [], runtimeProfiles: runtimeAssets.onnxRuntime.runtimeProfiles };

const files = new Map((manifest.files || []).map((file) => [file.path, file]));
if (existsSync(manifestPath)) {
  files.set("manifest.json", {
    path: "manifest.json",
    bytes: statSync(manifestPath).size,
    gzipBytes: null,
    brotliBytes: null,
  });
}
const profileReports = Object.entries(runtimeAssets.onnxRuntime.runtimeProfiles || {}).map(([id, profile]) => {
  const paths = requiredPathsForProfile(profile);
  const entries = paths.map((path) => files.get(path) || missingFile(path));
  const rawBytes = sum(entries, "bytes");
  const gzipBytes = sumCompressed(entries, "gzipBytes");
  const brotliBytes = sumCompressed(entries, "brotliBytes");
  return {
    id,
    providers: profile.providers || [],
    candidateLimit: profile.candidateLimit || null,
    maxQueryFeatures: profile.maxQueryFeatures || null,
    maxKeyframeFeatures: profile.maxKeyframeFeatures || null,
    firstLoad: {
      fileCount: entries.length,
      rawBytes,
      gzipBytes,
      brotliBytes,
      preferredCompressedBytes: brotliBytes || gzipBytes || rawBytes,
      missing: entries.filter((entry) => entry.missing).map((entry) => entry.path),
    },
    files: entries.map((entry) => ({
      path: entry.path,
      bytes: entry.bytes || 0,
      gzipBytes: entry.gzipBytes || null,
      brotliBytes: entry.brotliBytes || null,
      missing: Boolean(entry.missing),
    })),
  };
});

const report = {
  schemaVersion: "scansavy.browser-relocalization-runtime.package-size-report.v1",
  generatedAt: new Date().toISOString(),
  cachePolicy: manifest.cachePolicy || runtimeAssets.cachePolicy,
  note: "Sizes are browser transfer bytes for individual immutable assets. Brotli is preferred when served with Content-Encoding: br.",
  profiles: profileReports,
};

writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: "ready", outputPath, profiles: profileReports.map(({ id, firstLoad }) => ({ id, firstLoad })) }, null, 2));

function requiredPathsForProfile(profile) {
  const providers = Array.isArray(profile.providers) ? profile.providers : ["wasm"];
  const paths = new Set([
    "manifest.json",
    "scansavy-relocalization-runtime-worker.js",
    "scansavy-opencv-geometry.js",
    "scansavy-opencv-geometry.wasm",
    "models/lighterglue_L3.onnx",
    stripRoot(profile.xfeatUrl || "/scansavy-relocalization-runtime/models/xfeat_2048_dynamic.onnx"),
  ]);
  if (profile.fallbackXFeatUrl) paths.add(stripRoot(profile.fallbackXFeatUrl));
  if (providers.includes("webgpu")) {
    [
      "ort/ort.webgpu.min.js",
      "ort/ort-wasm-simd-threaded.jsep.wasm",
      "ort/ort-wasm-simd-threaded.jsep.mjs",
    ].forEach((path) => paths.add(path));
  }
  if (providers.includes("wasm")) {
    [
      "ort/ort.wasm.min.js",
      "ort/ort-wasm-simd-threaded.wasm",
      "ort/ort-wasm-simd-threaded.mjs",
    ].forEach((path) => paths.add(path));
  }
  return [...paths].filter(Boolean);
}

function stripRoot(path) {
  return String(path || "").replace(/^\/?scansavy-relocalization-runtime\//, "").replace(/^\/+/, "");
}

function missingFile(path) {
  return { path, bytes: 0, gzipBytes: null, brotliBytes: null, missing: true };
}

function sum(entries, key) {
  return entries.reduce((total, entry) => total + Number(entry[key] || 0), 0);
}

function sumCompressed(entries, key) {
  return entries.some((entry) => !Number.isFinite(Number(entry[key]))) ? null : sum(entries, key);
}
