param([switch]$DatabaseOnly)
$ErrorActionPreference='Stop'
$projectPath=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$workPath=[System.IO.Path]::GetFullPath((Join-Path $projectPath '../../work'))
$pgBin=Join-Path $workPath 'runtime/pgsql/bin'
$pgData=Join-Path $workPath 'pgdata'
if(Test-Path -LiteralPath "$pgBin/pg_ctl.exe"){
 & "$pgBin/pg_ctl.exe" -D $pgData status
 if($LASTEXITCODE -ne 0){
  $starter=Start-Process -FilePath "$pgBin/pg_ctl.exe" -ArgumentList @('-D',('"'+$pgData+'"'),'-l',('"'+(Join-Path $workPath 'postgres.log')+'"'),'-w','start') -WindowStyle Hidden -PassThru
  if(!$starter.WaitForExit(30000)){throw '数据库启动超时，检查 work/postgres.log'}
 }
}else{Write-Output '未找到本机验证运行时。请按 README 使用 Docker 或已有 PostgreSQL/PostGIS。'}
if($DatabaseOnly){return}
& (Join-Path $PSScriptRoot 'stop-local.ps1') -KeepDatabase
& (Join-Path $PSScriptRoot 'configure-local.ps1')
if(!(Test-Path -LiteralPath "$projectPath/.env")){throw '缺少 .env，请先按 README 配置'}
$taskNode=(Get-Command node -ErrorAction Stop).Source
$tsxCli=(Get-ChildItem -LiteralPath (Join-Path $projectPath 'node_modules/.pnpm') -Directory -Filter 'tsx@*'|ForEach-Object{Join-Path $_.FullName 'node_modules/tsx/dist/cli.mjs'}|Where-Object{Test-Path -LiteralPath $_}|Select-Object -First 1)
if(!$tsxCli){throw '缺少项目内 tsx 运行入口，请先恢复现有依赖'}
Push-Location $projectPath
try{
 & $taskNode --import tsx scripts/local-migration-status.ts
 if($LASTEXITCODE -eq 10){
  $backup=Join-Path $workPath ('local-hardening/backups/pre-migration-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
  New-Item -ItemType Directory -Path (Split-Path $backup) -Force|Out-Null
  & $taskNode --import tsx scripts/backup-verify.ts --out "$backup.sql" --report "$backup.json"
  if($LASTEXITCODE -ne 0){throw '迁移前恢复验证失败，停止启动。'}
 }elseif($LASTEXITCODE -ne 0){throw '本地数据库检查失败，停止启动。'}
}finally{Pop-Location}
$processList=@()
$state=Join-Path $workPath 'local-processes.json'
foreach($server in @(@{name='api';port=3001;args=@('--import','tsx','backend/src/server.ts')},@{name='admin';port=5173;args=@('node_modules/vite/bin/vite.js','--config','admin/vite.config.ts')},@{name='certificate';port=8766;args=@('scripts/local-certificate-server.mjs')})){
 if(Get-NetTCPConnection -LocalPort $server.port -State Listen -ErrorAction SilentlyContinue){throw "$($server.name) 端口 $($server.port) 被未登记进程占用，停止启动。请检查进程归属。"}
 $proc=Start-Process -FilePath $taskNode -ArgumentList $server.args -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput "$workPath/$($server.name).log" -RedirectStandardError "$workPath/$($server.name)-error.log" -PassThru
 $processList+=@{name=$server.name;pid=$proc.Id;startTicks=$proc.StartTime.Ticks;executable=$taskNode}
 ConvertTo-Json -InputObject @($processList)|Set-Content -LiteralPath $state -Encoding utf8
}
if($processList.Count){ConvertTo-Json -InputObject @($processList)|Set-Content -LiteralPath "$workPath/local-processes.json" -Encoding utf8}
$configText=[IO.File]::ReadAllText((Join-Path $projectPath '.env'))
$protocol=if($configText -match '(?m)^DEV_HTTPS_CERT=.+'){'https'}else{'http'}
Write-Output "管理端：${protocol}://127.0.0.1:5173/studio"
Write-Output '当前为内部局域网无认证模式，仅供本地/家庭局域网使用。'
$ready=$false
for($i=0;$i -lt 30;$i++){
 try{$health=Invoke-RestMethod 'http://127.0.0.1:3001/health' -TimeoutSec 2;$studio=Invoke-RestMethod 'http://127.0.0.1:3001/api/admin/content-studio/state' -TimeoutSec 2;if($health.status -eq 'ok' -and $studio.localOnly){$ready=$true;break}}catch{}
 Start-Sleep -Milliseconds 500
}
if(!$ready){& (Join-Path $PSScriptRoot 'stop-local.ps1') -KeepDatabase;throw '本地 V6 API 未就绪，检查 work/api-error.log；未启动可用维护台。'}
Write-Output 'V6 API 与本地草稿模式检查通过。'
