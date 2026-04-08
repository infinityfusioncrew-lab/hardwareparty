$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root ".mobile-server.pid"

if (Test-Path $pidFile) {
    $oldPid = Get-Content $pidFile | Select-Object -First 1
    if ($oldPid) {
        try { Stop-Process -Id $oldPid -Force -ErrorAction Stop } catch {}
    }
}

$proc = Start-Process -FilePath "node" `
    -ArgumentList "local-cms-server.mjs" `
    -WorkingDirectory $root `
    -PassThru

Set-Content -Path $pidFile -Value $proc.Id -Encoding ascii
"server:$($proc.Id)"
"url:http://127.0.0.1:5500"
"url-lan:http://192.168.0.101:5500"
"admin-url:http://127.0.0.1:5500/cyber/"
"admin-url-lan:http://192.168.0.101:5500/cyber/"
