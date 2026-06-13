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
import torch

_torch_onnx_export = torch.onnx.export

def _legacy_onnx_export(*args, **kwargs):
    kwargs.setdefault("dynamo", False)
    return _torch_onnx_export(*args, **kwargs)

torch.onnx.export = _legacy_onnx_export

from export import export_onnx

exports = [
    {
        "label": "fixed-384",
        "input_shape": (1, 3, 640, 640),
        "dynamic": False,
        "top_k": 384,
    },
    {
        "label": "fixed-512",
        "input_shape": (1, 3, 640, 640),
        "dynamic": False,
        "top_k": 512,
    },
    {
        "label": "dynamic-2048-final-matcher",
        "input_shape": (1, 3, 640, 640),
        "dynamic": True,
        "top_k": 2048,
    },
]

for config in exports:
    print(f"Exporting {config['label']}")
    export_onnx(
        xfeat_path="weights/xfeat.pt",
        output_folder="onnx",
        input_shape=config["input_shape"],
        ligherglue_n_layers=3,
        dynamic=config["dynamic"],
        dense=False,
        top_k=config["top_k"],
    )
"@

Push-Location $WorkPath
try {
  $exportScript | & $Python -
  if ($LASTEXITCODE -ne 0) {
    throw "Canonical XFeat/LighterGlue ONNX export failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

New-Item -ItemType Directory -Force -Path $DistModels | Out-Null
Copy-Item -Force (Join-Path $WorkPath "onnx\xfeat.onnx") (Join-Path $DistModels "xfeat_2048_dynamic.onnx")
Copy-Item -Force (Join-Path $WorkPath "onnx\xfeat_384_640x640.onnx") (Join-Path $DistModels "xfeat_384_fixed.onnx")
Copy-Item -Force (Join-Path $WorkPath "onnx\xfeat_512_640x640.onnx") (Join-Path $DistModels "xfeat_512_fixed.onnx")
Copy-Item -Force (Join-Path $WorkPath "onnx\lighterglue_L3.onnx") (Join-Path $DistModels "lighterglue_L3.onnx")

Write-Host "Exported canonical noahzhy XFeat/LighterGlue ONNX assets to $DistModels"
