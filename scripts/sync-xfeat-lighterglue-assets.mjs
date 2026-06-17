#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import http from "node:http";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(readFileSync(join(root, "config", "runtime-assets.json"), "utf8"));
const distDir = join(root, config.assetRoot || "dist");

await Promise.all((config.models || []).map((asset) => syncAsset(asset)));

async function syncAsset(asset) {
  const target = join(distDir, asset.path);
  mkdirSync(dirname(target), { recursive: true });
  if (!existsSync(target) || process.argv.includes("--force")) {
    if (!asset.url || String(asset.url).startsWith("generated:")) {
      if (String(asset.url).startsWith("generated:lighterglue-webnn-core")) {
        console.log(JSON.stringify({
          id: asset.id,
          path: asset.path,
          status: "deferred",
          source: asset.source,
          reason: "Generated after canonical LighterGlue is present by npm run export:lighterglue:webnn-core.",
        }));
        return;
      }
      throw new Error(
        `${asset.path} must be generated before packaging. Run npm run export:xfeat, then rerun npm run package:runtime.`,
      );
    }
    await download(asset.url, target);
  }
  const info = statSync(target);
  console.log(JSON.stringify({
    id: asset.id,
    path: asset.path,
    bytes: info.size,
    sha256: digest(target),
    source: asset.source,
  }));
}

function digest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function download(url, target, redirects = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const request = client.get(url, { headers: { "User-Agent": "scansavy-runtime-assets" } }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode || 0)) {
        response.resume();
        if (!response.headers.location || redirects > 5) {
          reject(new Error(`Too many redirects while downloading ${url}`));
          return;
        }
        download(new URL(response.headers.location, url).toString(), target, redirects + 1).then(resolve, reject);
        return;
      }
      if ((response.statusCode || 0) >= 400) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode} while downloading ${url}`));
        return;
      }
      const file = createWriteStream(target);
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", reject);
    });
    request.on("error", reject);
  });
}
