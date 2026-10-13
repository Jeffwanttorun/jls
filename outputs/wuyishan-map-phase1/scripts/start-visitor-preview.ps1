param()
$ErrorActionPreference='Stop'
$projectPath=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sitePath=[IO.Path]::GetFullPath((Join-Path $projectPath '../localdad-wuyishan-bilingual'))
$workPath=[IO.Path]::GetFullPath((Join-Path $projectPath '../../work'))
$nodePath='C:\Users\Acer\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if(!(Test-Path -LiteralPath $nodePath)){$nodePath=(Get-Command node -ErrorAction Stop).Source}
$statePath=Join-Path $workPath 'local-processes.json'
$entries=if(Test-Path -LiteralPath $statePath){@(Get-Content -LiteralPath $statePath -Raw|ConvertFrom-Json)}else{@()}
$entry=$entries|Where-Object name -eq 'visitor-preview'
$listen=Get-NetTCPConnection -LocalPort 5175 -State Listen -ErrorAction SilentlyContinue
if($listen){
 $proc=if($entry){Get-Process -Id $entry.pid -ErrorAction SilentlyContinue}
 if($proc -and $proc.StartTime.Ticks -eq $entry.startTicks -and $proc.Path -eq $entry.executable -and @($listen.OwningProcess) -contains $proc.Id){Write-Output '游客本地预览已运行：http://127.0.0.1:5175/zh/map';return}
 throw '5175 已被未登记进程占用，请先核查。'
}
if(!(Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue)){throw '请先运行现有“启动本地维护台.cmd”。游客导航预览会复用本地地图配置。'}
$proc=Start-Process -FilePath $nodePath -ArgumentList @('node_modules/astro/astro.js','dev','--host','127.0.0.1','--port','5175') -WorkingDirectory $sitePath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $workPath 'visitor-preview.log') -RedirectStandardError (Join-Path $workPath 'visitor-preview-error.log') -PassThru
$entries=@($entries|Where-Object name -ne 'visitor-preview')+@(@{name='visitor-preview';pid=$proc.Id;startTicks=$proc.StartTime.Ticks;executable=$nodePath})
ConvertTo-Json -InputObject $entries|Set-Content -LiteralPath $statePath -Encoding utf8
Write-Output '游客本地预览启动中：http://127.0.0.1:5175/zh/map（不是生产发布）'
