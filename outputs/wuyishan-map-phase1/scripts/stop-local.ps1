param([switch]$KeepDatabase)
$ErrorActionPreference='Stop'
$projectPath=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$workPath=[System.IO.Path]::GetFullPath((Join-Path $projectPath '../../work'))
$state=Join-Path $workPath 'local-processes.json'
if(Test-Path -LiteralPath $state){
 $entries=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($state))
 foreach($entry in $entries){
  $proc=Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
  if($proc -and $proc.StartTime.Ticks -eq $entry.startTicks -and $proc.Path -eq $entry.executable){& taskkill.exe /PID $entry.pid /T /F | Out-Null}
 }
}
$pg=Join-Path $workPath 'runtime/pgsql/bin/pg_ctl.exe'
if((Test-Path -LiteralPath $pg) -and !$KeepDatabase){& $pg -D (Join-Path $workPath 'pgdata') -m fast stop}
Write-Output $(if($KeepDatabase){'已停止登记的维护台进程，保留本机数据库运行。'}else{'已停止登记的维护台与数据库；数据保留。'})
