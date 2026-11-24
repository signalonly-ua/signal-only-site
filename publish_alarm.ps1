# Оновлює дані статичного додатка тривог (app\) і публікує лише data\alarm (завдання SiteAlarmAppPublish, кожні 10 хв; 24.11.2026).
# Лише читає дані бота (alarm-bot\data\web, alarm.db ro) через alarm-app\tools\export_static.py. Нічого не чіпає в alert-bot.
$ErrorActionPreference = 'Stop'
$site = $PSScriptRoot
$log = 'C:\Users\Maxig\projects\_logs\site-alarm-app.log'
function Log($m) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m" | Out-File $log -Append -Encoding utf8 }
$py = 'C:\Users\Maxig\AppData\Local\Python\pythoncore-3.13-64\python.exe'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
Set-Location $site
try {
    if (Test-Path "$site\.git\index.lock") { Log 'git зайнятий (index.lock): пропуск'; exit 0 }
    & $py 'C:\Users\Maxig\projects\alarm-app\tools\export_static.py' | Out-Null
    git add -A -- data/alarm
    $ch = git diff --cached --name-only -- data/alarm
    if (-not $ch) { exit 0 }
    git commit -q -m "auto: тривоги $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -- data/alarm
    git push -q 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Log "push не вдався ($LASTEXITCODE)"; exit 1 }
} catch { Log "помилка: $_"; exit 1 }
