$ErrorActionPreference='Stop'
$projectPath=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location $projectPath
try{
 & (Join-Path $PSScriptRoot 'stop-local.ps1') -KeepDatabase
 & (Join-Path $PSScriptRoot 'start-local.ps1') -DatabaseOnly
 & node --import tsx scripts/local-backup.ts
 if($LASTEXITCODE -ne 0){throw '备份失败，未生成可用完整包。'}
}finally{Pop-Location; & (Join-Path $PSScriptRoot 'start-local.ps1')}
