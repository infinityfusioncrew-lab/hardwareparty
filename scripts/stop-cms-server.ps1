$ErrorActionPreference = "SilentlyContinue"

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root ".mobile-server.pid"

if (Test-Path $pidFile) {
    $procId = Get-Content $pidFile | Select-Object -First 1
    if ($procId) {
        try { Stop-Process -Id $procId -Force -ErrorAction Stop; "stopped:$procId" } catch { "not-running:$procId" }
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
} else {
    "no-pid-file"
}
