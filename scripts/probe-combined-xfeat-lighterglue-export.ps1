param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $ProbeArgs
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$VenvPython = Join-Path $RepoRoot ".venv-xfeat-export\Scripts\python.exe"
$SystemPython = "python"
$Python = if (Test-Path $VenvPython) { $VenvPython } else { $SystemPython }
$Script = Join-Path $RepoRoot "scripts\probe-combined-xfeat-lighterglue-export.py"

& $Python $Script @ProbeArgs
