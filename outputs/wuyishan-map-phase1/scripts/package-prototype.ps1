$ErrorActionPreference='Stop'
$project=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputDirectory=[System.IO.Path]::GetFullPath((Join-Path $project 'outputs'))
$zipPath=[System.IO.Path]::GetFullPath((Join-Path $outputDirectory '第三阶段游客端低保真原型_交付包.zip'))
if(!$zipPath.StartsWith($outputDirectory,[System.StringComparison]::OrdinalIgnoreCase)){throw '交付包路径越界'}
[System.IO.Directory]::CreateDirectory($outputDirectory)|Out-Null
if([System.IO.File]::Exists($zipPath)){[System.IO.File]::Delete($zipPath)}
Add-Type -AssemblyName System.IO.Compression
$archive=[System.IO.Compression.ZipFile]::Open($zipPath,[System.IO.Compression.ZipArchiveMode]::Create)
try{
  $directories=@('prototype','prototype-server','admin','backend','shared','database/migrations','scripts','tests','reports/prototype-v0.1')
  $rootFiles=@('.env.example','.gitignore','compose.yaml','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','README.md','tsconfig.json','第二阶段_最终独立审查报告.md','第三阶段游客端低保真原型_验收报告.md','reports/prototype-v0.1-db-unchanged.json')
  $files=@()
  foreach($directory in $directories){
    $source=[System.IO.Path]::GetFullPath((Join-Path $project $directory))
    if($source.StartsWith($project,[System.StringComparison]::OrdinalIgnoreCase)-and [System.IO.Directory]::Exists($source)){$files+=Get-ChildItem -LiteralPath $source -Recurse -File}
  }
  foreach($file in $rootFiles){$source=Join-Path $project $file;if(Test-Path -LiteralPath $source){$files+=Get-Item -LiteralPath $source}}
  foreach($file in $files|Sort-Object FullName -Unique){
    if($file.FullName -match '\\(?:node_modules|dist|\.git|seed)\\'){continue}
    if($file.Name -eq '.env' -or $file.Extension -in @('.key','.pem','.crt','.sql')){continue}
    $entry=$file.FullName.Substring($project.Length).TrimStart([char]'\',[char]'/').Replace('\','/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$file.FullName,$entry,[System.IO.Compression.CompressionLevel]::Optimal)|Out-Null
  }
}finally{$archive.Dispose()}
$item=Get-Item -LiteralPath $zipPath
Write-Output ([pscustomobject]@{Path=$item.FullName;Bytes=$item.Length})
