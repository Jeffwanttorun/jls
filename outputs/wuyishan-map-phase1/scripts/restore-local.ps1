param([Parameter(Mandatory=$true)][string]$BackupPath)
$ErrorActionPreference='Stop'
$archive=[IO.Path]::GetFullPath($BackupPath)
if(!(Test-Path -LiteralPath $archive)){throw '备份文件不存在'}
$projectPath=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location $projectPath
try{
 & (Join-Path $PSScriptRoot 'stop-local.ps1') -KeepDatabase
 & (Join-Path $PSScriptRoot 'start-local.ps1') -DatabaseOnly
 & node --import tsx scripts/local-backup.ts
 if($LASTEXITCODE -ne 0){throw '恢复前备份失败，停止恢复'}
 & node --import tsx scripts/local-restore.ts $archive
 if($LASTEXITCODE -ne 0){throw '恢复校验失败，原数据库和原连接保持不变'}
}finally{Pop-Location; & (Join-Path $PSScriptRoot 'start-local.ps1')}
