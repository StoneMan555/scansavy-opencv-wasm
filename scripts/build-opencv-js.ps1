param(
  [string]$OpenCvRef = "4.13.0",
  [ValidateSet("basic", "simd", "threads", "simd-threads")]
  [string]$BuildFlavor = "simd",
  [string]$DockerImage = "emscripten/emsdk:3.1.64",
  [switch]$NoDocker
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")

if ($NoDocker) {
  $env:OPENCV_REF = $OpenCvRef
  $env:BUILD_FLAVOR = $BuildFlavor
  bash "$Root\scripts\build-opencv-js.sh"
  exit $LASTEXITCODE
}

docker --version | Out-Null

$mount = ($Root.Path -replace "\\", "/")
docker run --rm `
  -e OPENCV_REF=$OpenCvRef `
  -e BUILD_FLAVOR=$BuildFlavor `
  -v "${mount}:/work" `
  -w /work `
  $DockerImage `
  bash scripts/build-opencv-js.sh

