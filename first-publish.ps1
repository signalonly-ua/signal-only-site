# Одноразово: створює репозиторій signalonly-ua/signal-only-site, пушить і вмикає GitHub Pages.
# Перед запуском: gh auth login --web (вхід як signalonly-ua).
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
Set-Location $PSScriptRoot

$user = gh api user --jq .login
if ($user -ne 'signalonly-ua') { Write-Host "Вхід виконано як '$user', а треба signalonly-ua. Зупиняюсь."; exit 1 }
gh auth setup-git
gh repo create signalonly-ua/signal-only-site --public --source . --remote origin --push
gh api -X POST repos/signalonly-ua/signal-only-site/pages -f "source[branch]=main" -f "source[path]=/"
Write-Host 'Готово. Сайт з''явиться за 1-2 хв: https://signalonly-ua.github.io/signal-only-site/'
