#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAMS="$ROOT/config/upstreams.json"
OPENCV_REF="${OPENCV_REF:-4.13.0}"
BUILD_FLAVOR="${BUILD_FLAVOR:-simd}"
BUILD_ROOT="${BUILD_ROOT:-$ROOT/.build}"
CACHE_ROOT="${CACHE_ROOT:-$ROOT/.cache}"
OPENCV_DIR="${OPENCV_DIR:-$CACHE_ROOT/opencv-$OPENCV_REF}"
BUILD_DIR="$BUILD_ROOT/opencv-js-$OPENCV_REF-$BUILD_FLAVOR"
DIST_DIR="$ROOT/dist"
CONFIG="$ROOT/config/scansavy_opencv_js.config.py"

mkdir -p "$CACHE_ROOT" "$BUILD_ROOT" "$DIST_DIR"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required." >&2
  exit 1
fi

if ! command -v emcmake >/dev/null 2>&1; then
  echo "Emscripten is not active. Run through scripts/build-opencv-js.ps1 or activate emsdk first." >&2
  exit 1
fi

if [ ! -d "$OPENCV_DIR/.git" ]; then
  git clone --depth 1 --branch "$OPENCV_REF" https://github.com/opencv/opencv.git "$OPENCV_DIR"
else
  git -C "$OPENCV_DIR" fetch --depth 1 origin "refs/tags/$OPENCV_REF:refs/tags/$OPENCV_REF" || true
  git -C "$OPENCV_DIR" checkout "$OPENCV_REF"
fi

args=(
  "$BUILD_DIR"
  "--opencv_dir" "$OPENCV_DIR"
  "--build_wasm"
  "--disable_single_file"
  "--config" "$CONFIG"
  "--cmake_option=-DBUILD_LIST=core,imgproc,features2d,calib3d,video"
  "--cmake_option=-DBUILD_opencv_world=OFF"
  "--cmake_option=-DBUILD_EXAMPLES=OFF"
  "--cmake_option=-DBUILD_TESTS=OFF"
  "--cmake_option=-DBUILD_PERF_TESTS=OFF"
  "--cmake_option=-DBUILD_opencv_apps=OFF"
)

case "$BUILD_FLAVOR" in
  basic)
    ;;
  simd)
    args+=("--simd")
    ;;
  threads)
    args+=("--threads")
    ;;
  simd-threads)
    args+=("--simd" "--threads")
    ;;
  *)
    echo "Unknown BUILD_FLAVOR=$BUILD_FLAVOR. Use basic, simd, threads, or simd-threads." >&2
    exit 1
    ;;
esac

python3 "$OPENCV_DIR/platforms/js/build_js.py" "${args[@]}"

js_file="$(find "$BUILD_DIR" -type f -name 'opencv.js' | head -n 1)"
wasm_file="$(find "$BUILD_DIR" -type f \( -name 'opencv_js.wasm' -o -name 'opencv.wasm' \) | head -n 1)"

if [ -z "$js_file" ] || [ ! -f "$js_file" ]; then
  echo "Build finished but opencv.js was not found in $BUILD_DIR." >&2
  exit 1
fi

cp "$js_file" "$DIST_DIR/scansavy-opencv.js"
if [ -n "$wasm_file" ] && [ -f "$wasm_file" ]; then
  cp "$wasm_file" "$DIST_DIR/scansavy-opencv.wasm"
fi
cp "$ROOT/src/web/scansavy-opencv-loader.js" "$DIST_DIR/scansavy-opencv-loader.js"
cp "$ROOT/src/web/scansavy-relocalization-worker.js" "$DIST_DIR/scansavy-relocalization-worker.js"
cp "$ROOT/src/web/scansavy-opencv.d.ts" "$DIST_DIR/scansavy-opencv.d.ts"

node "$ROOT/scripts/make-build-manifest.mjs"
node "$ROOT/scripts/validate-config.mjs"

echo "ScanSavvy OpenCV WASM build complete: $DIST_DIR"
