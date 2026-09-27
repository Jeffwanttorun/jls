param()
$ErrorActionPreference='Stop'
$projectPath=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$workPath=[System.IO.Path]::GetFullPath((Join-Path $projectPath '../../work'))
if(!(Test-Path -LiteralPath "$projectPath/.env")){throw '缺少 .env'}
& (Join-Path $PSScriptRoot 'start-local.ps1') -DatabaseOnly
$nodePath=(Get-Command node -ErrorAction Stop).Source
$tsxCli=(Get-ChildItem -LiteralPath (Join-Path $projectPath 'node_modules/.pnpm') -Directory -Filter 'tsx@*'|ForEach-Object{Join-Path $_.FullName 'node_modules/tsx/dist/cli.mjs'}|Where-Object{Test-Path -LiteralPath $_}|Select-Object -First 1)
if(!$tsxCli){throw '缺少项目内 tsx 运行入口，请先恢复现有依赖'}
$statePath=Join-Path $workPath 'prototype-processes.json';$items=@()
foreach($server in @(@{name='prototype-api';port=3002;args=@($tsxCli,'prototype-server/server.ts')},@{name='prototype-web';port=5174;args=@('node_modules/vite/bin/vite.js','--config','prototype/vite.config.ts')})){
 if(Get-NetTCPConnection -LocalPort $server.port -State Listen -ErrorAction SilentlyContinue){Write-Output "$($server.name) 的端口 $($server.port) 已在监听，保留现有进程";continue}
 $proc=Start-Process -FilePath $nodePath -ArgumentList $server.args -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput "$workPath/$($server.name).log" -RedirectStandardError "$workPath/$($server.name)-error.log" -PassThru
 $items+=@{name=$server.name;pid=$proc.Id;startTicks=$proc.StartTime.Ticks;executable=$nodePath}
}
if($items.Count){$items|ConvertTo-Json|Set-Content -LiteralPath $statePath -Encoding utf8}
$ip=(Get-NetIPAddress -AddressFamily IPv4|Where-Object{$_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown'}|Sort-Object InterfaceMetric|Select-Object -First 1 -ExpandProperty IPAddress)
Write-Output '电脑：https://127.0.0.1:5174/'
if($ip){Write-Output "同一局域网手机：https://${ip}:5174/"}
Write-Output '仅限本机/家庭可信局域网低保真预览；不向公网部署。'
