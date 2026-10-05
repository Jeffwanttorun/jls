$ErrorActionPreference='Stop'
$projectPath=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$workPath=[IO.Path]::GetFullPath((Join-Path $projectPath '../../work'))
$envPath=Join-Path $projectPath '.env'
if(!(Test-Path -LiteralPath $envPath)){throw '缺少本地 .env，请按 LOCAL-HARDENING.md 配置本机数据库。'}
$text=[IO.File]::ReadAllText($envPath)
$dbLine=[regex]::Match($text,'(?m)^DATABASE_URL=([^\r\n]+)').Groups[1].Value.Trim('"',"'")
$dbUri=[Uri]$dbLine
if($dbUri.Host -notin @('localhost','127.0.0.1','::1')){throw '停止：本地模式不允许连接远程数据库。'}
$lan=(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue|Where-Object{$_.InterfaceAlias -eq 'WLAN' -and $_.IPAddress -notlike '169.254.*'}|Select-Object -First 1).IPAddress
if(!$lan){$lan='127.0.0.1'}
$https=Join-Path $workPath 'https'
$mkcert=Join-Path $https 'mkcert.exe'
if(!(Test-Path -LiteralPath $mkcert) -or !(Test-Path -LiteralPath "$https/ca/rootCA.pem")){throw '缺少已有本地 HTTPS 运行时，请恢复 work/https；不自动创建另一套 CA。'}
$env:CAROOT=Join-Path $https 'ca'
& $mkcert -cert-file "$https/server.pem" -key-file "$https/server-key.pem" localhost 127.0.0.1 $lan
if($LASTEXITCODE -ne 0){throw '本地 HTTPS 证书生成失败'}
$fields=@{LOCAL_CONTENT_ONLY='1';HOST='127.0.0.1';PORT='3001';ADMIN_HOST='0.0.0.0';ADMIN_BASE_PATH='/';API_PROXY_TARGET='http://127.0.0.1:3001';DEV_HTTPS_CERT=(Join-Path $https 'server.pem').Replace('\','/');DEV_HTTPS_KEY=(Join-Path $https 'server-key.pem').Replace('\','/');LOCAL_LAN_IP=$lan}
foreach($key in $fields.Keys){$value=$fields[$key];$pattern='(?m)^'+$key+'=[^\r\n]*';if([regex]::IsMatch($text,$pattern)){$text=[regex]::Replace($text,$pattern,[System.Text.RegularExpressions.MatchEvaluator]{param($m)$key+'='+$value})}else{$text+="`n${key}=${value}"}}
$text=[regex]::Replace($text,'(?m)^(SITE_PUBLISH_SCRIPT|SITE_PROJECT_DIR)=[^\r\n]*\r?\n?','')
[IO.File]::WriteAllText($envPath,$text.TrimEnd()+"`n")
foreach($key in $fields.Keys){[Environment]::SetEnvironmentVariable($key,$fields[$key],'Process')}
[Environment]::SetEnvironmentVariable('SITE_PUBLISH_SCRIPT',$null,'Process')
[Environment]::SetEnvironmentVariable('SITE_PROJECT_DIR',$null,'Process')
$env:PG_BIN=Join-Path $workPath 'runtime/pgsql/bin'
Write-Output "本地草稿维护台：https://${lan}:5173/studio"
Write-Output "手机证书下载：http://${lan}:8766/"
try{
 $ruleName='Wuyishan-V6-Local-Studio'
 $rule=Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
 if($rule){$rule|Set-NetFirewallRule -Enabled True -Profile Private -Action Allow -ErrorAction Stop; $rule|Get-NetFirewallAddressFilter|Set-NetFirewallAddressFilter -LocalAddress $lan -RemoteAddress LocalSubnet -ErrorAction Stop}
 else{New-NetFirewallRule -Name $ruleName -DisplayName 'Wuyishan V6 local studio (home Wi-Fi only)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173,8766 -LocalAddress $lan -RemoteAddress LocalSubnet -InterfaceAlias WLAN -Profile Private -Program (Get-Command node).Source -ErrorAction Stop|Out-Null}
 Write-Output '家庭 Wi-Fi 防火墙规则已配置。'
}catch{Write-Warning '当前权限不能配置防火墙。如手机无法访问，请以管理员身份运行 scripts/configure-local.ps1；不要关闭防火墙。'}
