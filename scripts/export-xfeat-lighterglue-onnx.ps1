param(
  [string]$RepoRef = "155f5e1b6c9453162c286eacb0003fa4b8461a9c",
  [string]$RepoUrl = "https://github.com/noahzhy/xfeat_lightglue_onnx.git",
  [string]$WorkDir = ".cache\xfeat_lightglue_onnx",
  [string]$Python = "python",
  [switch]$InstallDeps
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$WorkPath = Join-Path $Root $WorkDir
$DistModels = Join-Path $Root "dist\models"

if (!(Test-Path $WorkPath)) {
  git clone $RepoUrl $WorkPath
}

git -C $WorkPath fetch --depth 1 origin $RepoRef
git -C $WorkPath checkout $RepoRef

if ($InstallDeps) {
  & $Python -m pip install --upgrade pip
  & $Python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
  & $Python -m pip install -r (Join-Path $WorkPath "requirements.txt")
  & $Python -m pip install onnx onnxsim
}

$exportScript = @"
from export import export_onnx

export_onnx(
    xfeat_path="weights/xfeat.pt",
    output_folder="onnx",
    input_shape=(1, 3, 640, 640),
    ligherglue_n_layers=3,
    dynamic=True,
    dense=False,
    top_k=2048,
)
"@

Push-Location $WorkPath
try {
  $exportScript | & $Python -
}
finally {
  Pop-Location
}

New-Item -ItemType Directory -Force -Path $DistModels | Out-Null
Copy-Item -Force (Join-Path $WorkPath "onnx\xfeat.onnx") (Join-Path $DistModels "xfeat_2048_dynamic.onnx")
Copy-Item -Force (Join-Path $WorkPath "onnx\lighterglue_L3.onnx") (Join-Path $DistModels "lighterglue_L3.onnx")

Write-Host "Exported canonical noahzhy XFeat/LighterGlue ONNX assets to $DistModels"
