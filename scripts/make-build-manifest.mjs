import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, "dist");
const upstreams = JSON.parse(readFileSync(join(root, "config", "upstreams.json"), "utf8"));
const runtimeAssets = JSON.parse(readFileSync(join(root, "config", "runtime-assets.json"), "utf8"));

const files = existsSync(distDir)
  ? walk(distDir)
      .filter((file) => !file.endsWith(".gz") && !file.endsWith(".br") && relative(distDir, file) !== "manifest.json")
      .map((file) => describeFile(file))
      .sort((a, b) => a.path.localeCompare(b.path))
  : [];

const manifest = {
  schemaVersion: "scansavy.browser-relocalization-runtime.manifest.v1",
  legacySchemaVersion: "scansavy.opencv-wasm.manifest.v0",
  packageName: "scansavy-browser-relocalization-runtime",
  createdAt: new Date().toISOString(),
  cachePolicy: runtimeAssets.cachePolicy,
  upstreams: {
    ...upstreams,
    xfeatLighterGlue: {
      repo: "https://github.com/noahzhy/xfeat_lightglue_onnx",
      ref: runtimeAssets.canonicalExport.ref,
      reason: "Apache-2.0 ONNX LighterGlue path and tensor convention for browser learned matching.",
    },
    xfeatOnnx: {
      repo: "https://github.com/DavideCatto/XFeat-ONNX",
      release: "V1.0.0",
      reason: "Prebuilt sparse XFeat ONNX extractor until the noahzhy export path is automated in CI.",
    },
    onnxRuntimeWeb: {
      package: "onnxruntime-web",
      version: runtimeAssets.onnxRuntime.version,
      reason: "Browser ONNX execution provider for WebGPU and WASM fallback.",
    },
  },
  canonicalExport: runtimeAssets.canonicalExport,
  providers: runtimeAssets.onnxRuntime.preferredProviders,
  runtimeProfiles: runtimeAssets.onnxRuntime.runtimeProfiles,
  models: runtimeAssets.models.map((model) => ({
    id: model.id,
    path: model.path,
    source: model.source,
    license: model.license,
  })),
  files,
  requiredExports: {
    fullFallbackOpenCv: [
      "ORB.create",
      "AKAZE.create",
      "BFMatcher.create",
      "calcOpticalFlowPyrLK",
      "solvePnPRansac",
      "solvePnPRefineLM",
      "projectPoints",
    ],
    geometryOpenCv: [
      "Rodrigues",
      "solvePnPRansac",
      "solvePnPRefineLM",
      "projectPoints",
    ],
    xfeatLighterGlue: [
      "XFeat keypoints/descriptors/scores",
      "LighterGlue matches/scores",
    ],
  },
};

if (existsSync(distDir)) {
  writeFileSync(join(distDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${join(distDir, "manifest.json")}`);
} else {
  console.log(JSON.stringify(manifest, null, 2));
}

function describeFile(path) {
  const rel = relative(distDir, path).split("\\").join("/");
  const gzipPath = `${path}.gz`;
  const brotliPath = `${path}.br`;
  return {
    path: rel,
    name: rel.split("/").pop(),
    bytes: statSync(path).size,
    gzipBytes: existsSync(gzipPath) ? statSync(gzipPath).size : null,
    brotliBytes: existsSync(brotliPath) ? statSync(brotliPath).size : null,
    sha256: digest(path),
    contentType: contentTypeFor(path),
    cachePolicy: isImmutableRuntimeAsset(path) ? runtimeAssets.cachePolicy : "no-cache",
  };
}

function digest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function contentTypeFor(path) {
  switch (extname(path)) {
    case ".onnx":
      return "application/octet-stream";
    case ".wasm":
      return "application/wasm";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".d.ts":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function isImmutableRuntimeAsset(path) {
  return [".onnx", ".wasm", ".js"].includes(extname(path));
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    if (entry.isFile()) files.push(full);
  }
  return files;
}
