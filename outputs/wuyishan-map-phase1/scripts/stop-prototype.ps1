$ErrorActionPreference='Stop';$projectPath=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'));$workPath=[System.IO.Path]::GetFullPath((Join-Path $projectPath '../../work'));$state=Join-Path $workPath 'prototype-processes.json'
if(Test-Path -LiteralPath $state){foreach($entry in @(Get-Content -LiteralPath $state -Raw|ConvertFrom-Json)){$proc=Get-Process -Id $entry.pid -ErrorAction SilentlyContinue;if($proc -and $proc.StartTime.Ticks -eq $entry.startTicks -and $proc.Path -eq $entry.executable){Stop-Process -Id $entry.pid}}}
Write-Output '已停止游客原型服务；数据库和第二阶段后台未停止、未修改。'
