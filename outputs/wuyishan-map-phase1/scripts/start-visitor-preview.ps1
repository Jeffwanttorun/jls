param()
$ErrorActionPreference='Stop'
$projectPath=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sitePath=[IO.Path]::GetFullPath((Join-Path $projectPath '../localdad-wuyishan-bilingual'))
$workPath=[IO.Path]::GetFullPath((Join-Path $projectPath '../../work'))
$nodePath='C:\Users\Acer\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if(!(Test-Path -LiteralPath $nodePath)){$nodePath=(Get-Command node -ErrorAction Stop).Source}
$statePath=Join-Path $workPath 'local-processes.json'
$entries=if(Test-Path -LiteralPath $statePath){@(Get-Content -LiteralPath $statePath -Raw|ConvertFrom-Json)}else{@()}
$lan=(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue|Where-Object{$_.InterfaceAlias -eq 'WLAN' -and $_.IPAddress -notlike '169.254.*'}|Select-Object -First 1).IPAddress
$certPath=Join-Path $workPath 'https/server.pem'
$keyPath=Join-Path $workPath 'https/server-key.pem'
if(!(Test-Path -LiteralPath $certPath) -or !(Test-Path -LiteralPath $keyPath)){throw '缺少现有本地 HTTPS 证书，请先运行已有维护台启动器。'}
if($lan){try{
 $ruleName='Wuyishan-V6-Visitor-Preview'
 $rule=Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
 if($rule){$rule|Set-NetFirewallRule -Enabled True -Profile Private -Action Allow -ErrorAction Stop;$rule|Get-NetFirewallAddressFilter|Set-NetFirewallAddressFilter -LocalAddress $lan -RemoteAddress LocalSubnet -ErrorAction Stop}
 else{New-NetFirewallRule -Name $ruleName -DisplayName 'Wuyishan visitor preview (home Wi-Fi only)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5175 -LocalAddress $lan -RemoteAddress LocalSubnet -InterfaceAlias WLAN -Profile Private -Program $nodePath -ErrorAction Stop|Out-Null}
}catch{Write-Warning '无法配置家庭 Wi-Fi 防火墙规则；若手机仍打不开，请以管理员身份运行游客预览启动器。'}}
$entry=$entries|Where-Object name -eq 'visitor-preview'
$listen=Get-NetTCPConnection -LocalPort 5175 -State Listen -ErrorAction SilentlyContinue
if($listen){
 $proc=if($entry){Get-Process -Id $entry.pid -ErrorAction SilentlyContinue}
 if($proc -and $proc.StartTime.Ticks -eq $entry.startTicks -and $proc.Path -eq $entry.executable -and @($listen.OwningProcess) -contains $proc.Id){Write-Output '游客本地预览已运行：https://127.0.0.1:5175/zh/map';if($lan){Write-Output "手机地址：https://${lan}:5175/zh/map"};return}
 throw '5175 已被未登记进程占用，请先核查。'
}
if(!(Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue)){throw '请先运行现有“启动本地维护台.cmd”。游客导航预览会复用本地地图配置。'}
$oldCert=$env:VISITOR_PREVIEW_CERT;$oldKey=$env:VISITOR_PREVIEW_KEY
try{
 $env:VISITOR_PREVIEW_CERT=$certPath;$env:VISITOR_PREVIEW_KEY=$keyPath
 $proc=Start-Process -FilePath $nodePath -ArgumentList @('node_modules/astro/astro.js','dev','--host','0.0.0.0','--port','5175') -WorkingDirectory $sitePath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $workPath 'visitor-preview.log') -RedirectStandardError (Join-Path $workPath 'visitor-preview-error.log') -PassThru
}finally{$env:VISITOR_PREVIEW_CERT=$oldCert;$env:VISITOR_PREVIEW_KEY=$oldKey}
$entries=@($entries|Where-Object name -ne 'visitor-preview')+@(@{name='visitor-preview';pid=$proc.Id;startTicks=$proc.StartTime.Ticks;executable=$nodePath})
ConvertTo-Json -InputObject $entries|Set-Content -LiteralPath $statePath -Encoding utf8
Write-Output '游客本地预览启动中：https://127.0.0.1:5175/zh/map（不是生产发布）'
if($lan){Write-Output "手机地址：https://${lan}:5175/zh/map（与电脑同一 Wi-Fi；使用已有本地证书）"}
