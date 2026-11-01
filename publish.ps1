# Публікує зміни сайту на GitHub Pages: add, commit, push. Якщо змін немає, нічого не робить.
# Запуск: powershell -ExecutionPolicy Bypass -File C:\Users\Maxig\projects\signal-only-site\publish.ps1
# -DataOnly (завдання SiteDataPublish, раз на годину): публікує лише папку data\ і лише якщо вона змінилась.
param([switch]$DataOnly)
$ErrorActionPreference = 'Stop'
$site = $PSScriptRoot
$logDir = 'C:\Users\Maxig\projects\_logs'
$log = Join-Path $logDir 'site-publish.log'
New-Item -ItemType Directory -Force $logDir | Out-Null
function Log($msg) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg" | Out-File $log -Append -Encoding utf8 }

$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
Set-Location $site
try {
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
    if ($DataOnly) {
        git add -A -- data
        $changes = git diff --cached --name-only -- data
        if (-not $changes) { Log 'data: без змін'; exit 0 }
        git commit -q -m "auto: дані $stamp" -- data
    } else {
        git add -A
        $changes = git status --porcelain
        if (-not $changes) { Log 'без змін'; exit 0 }
        git commit -q -m "auto: оновлення $stamp"
    }
    git push -q origin main
    if ($LASTEXITCODE -ne 0) { throw "git push завершився з кодом $LASTEXITCODE" }
    Log "опубліковано: $(($changes | Measure-Object).Count) файл(ів)"
} catch {
    Log "ПОМИЛКА: $_"
    exit 1
}
