#!/usr/bin/env node
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, "dist");
const compressExts = new Set([".onnx", ".wasm"]);
const minJsBytes = 32 * 1024;

if (!statExists(distDir)) {
  console.log(JSON.stringify({ status: "skipped", reason: "dist directory does not exist" }, null, 2));
  process.exit(0);
}

const compressed = [];
for (const file of walk(distDir)) {
  if (file.endsWith(".br") || file.endsWith(".gz")) continue;
  const ext = extname(file);
  const size = statSync(file).size;
  if (!compressExts.has(ext) && !(ext === ".js" && size >= minJsBytes)) continue;
  const data = readFileSync(file);
  const gzip = gzipSync(data, { level: 9 });
  const brotli = brotliCompressSync(data, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_GENERIC,
    },
  });
  writeFileSync(`${file}.gz`, gzip);
  writeFileSync(`${file}.br`, brotli);
  compressed.push({
    file: relative(distDir, file).split("\\").join("/"),
    rawBytes: data.length,
    gzipBytes: gzip.length,
    brotliBytes: brotli.length,
  });
}

console.log(JSON.stringify({ status: "ready", compressed }, null, 2));

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function statExists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}
