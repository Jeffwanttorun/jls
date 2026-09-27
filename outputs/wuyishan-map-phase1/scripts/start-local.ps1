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
if($DatabaseOnly){exit}
if(!(Test-Path -LiteralPath "$projectPath/.env")){throw '缺少 .env，请先按 README 配置'}
$taskNode=(Get-Command node -ErrorAction Stop).Source
$tsxCli=(Get-ChildItem -LiteralPath (Join-Path $projectPath 'node_modules/.pnpm') -Directory -Filter 'tsx@*'|ForEach-Object{Join-Path $_.FullName 'node_modules/tsx/dist/cli.mjs'}|Where-Object{Test-Path -LiteralPath $_}|Select-Object -First 1)
if(!$tsxCli){throw '缺少项目内 tsx 运行入口，请先恢复现有依赖'}
$processList=@()
foreach($server in @(@{name='api';port=3001;args=@($tsxCli,'backend/src/server.ts')},@{name='admin';port=5173;args=@('node_modules/vite/bin/vite.js','--config','admin/vite.config.ts')})){
 if(Get-NetTCPConnection -LocalPort $server.port -State Listen -ErrorAction SilentlyContinue){Write-Output "$($server.name) 的端口 $($server.port) 已在监听，保留现有进程";continue}
 $proc=Start-Process -FilePath $taskNode -ArgumentList $server.args -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput "$workPath/$($server.name).log" -RedirectStandardError "$workPath/$($server.name)-error.log" -PassThru
 $processList+=@{name=$server.name;pid=$proc.Id;startTicks=$proc.StartTime.Ticks;executable=$taskNode}
}
if($processList.Count){$processList|ConvertTo-Json|Set-Content -LiteralPath "$workPath/local-processes.json" -Encoding utf8}
$configText=[IO.File]::ReadAllText((Join-Path $projectPath '.env'))
$protocol=if($configText -match '(?m)^DEV_HTTPS_CERT=.+'){'https'}else{'http'}
Write-Output "管理端：${protocol}://127.0.0.1:5173/places"
Write-Output '当前为内部局域网无认证模式，仅供本地/家庭局域网使用。'
