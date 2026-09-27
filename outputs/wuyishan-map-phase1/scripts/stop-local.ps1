$ErrorActionPreference='Stop'
$projectPath=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$workPath=[System.IO.Path]::GetFullPath((Join-Path $projectPath '../../work'))
$state=Join-Path $workPath 'local-processes.json'
if(Test-Path -LiteralPath $state){
 foreach($entry in @(Get-Content -LiteralPath $state -Raw|ConvertFrom-Json)){
  $proc=Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
  if($proc -and $proc.StartTime.Ticks -eq $entry.startTicks -and $proc.Path -eq $entry.executable){Stop-Process -Id $entry.pid}
 }
}
$pg=Join-Path $workPath 'runtime/pgsql/bin/pg_ctl.exe'
if(Test-Path -LiteralPath $pg){& $pg -D (Join-Path $workPath 'pgdata') -m fast stop}
Write-Output '已停止脚本登记的服务和本项目验证数据库；未删除数据。'
