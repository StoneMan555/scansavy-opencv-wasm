#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/convert-browser-feature-map.mjs <mappack-browser-feature-map.json> <out.json>");
  process.exit(1);
}

const source = JSON.parse(readFileSync(inputPath, "utf8"));
const references = (source.referenceFeatures || source.references || source.features || [])
  .filter((feature) => feature.world && feature.descriptor)
  .map((feature, index) => ({
    id: feature.id || `feature-${index}`,
    descriptorMode: "compact-brief-v1",
    descriptorHex: feature.descriptor,
    image: {
      x: Number(feature.x),
      y: Number(feature.y),
      frameId: feature.frameId || null,
      frameIndex: feature.keyframeIndex ?? feature.frameIndex ?? null,
    },
    world: {
      x: Number(feature.world.x),
      y: Number(feature.world.y),
      z: Number(feature.world.z),
    },
    quality: {
      score: Number(feature.score || 0),
      supportFrameCount: Number(feature.mapPoint?.supportFrameCount || 0),
      residualMeters: Number(feature.mapPoint?.meanPositionResidualMeters || 0),
    },
  }));

const converted = {
  schemaVersion: "scansavy.opencv-wasm.mappack-sidecar.v0",
  source: {
    file: basename(inputPath),
    schemaVersion: source.schemaVersion || "unknown",
    spaceId: source.spaceId || null,
  },
  descriptorMode: "compact-brief-v1",
  note: "Transitional sidecar. It is compatible with the current browser feature MapPack and should be replaced by orb-32 or akaze sidecars for production.",
  cameraModel: source.cameraModel || null,
  references,
};

writeFileSync(outputPath, `${JSON.stringify(converted, null, 2)}\n`);
console.log(`Wrote ${references.length} references to ${outputPath}`);
