$ErrorActionPreference = "Stop"

$owner = "JOKER120YL"
$repo = "ClueVault"
$tag = "v0.2.0"
$releaseName = "ClueVault v0.2.0"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$zipPath = Join-Path $root "dist\ClueVault-v0.2.0-win-x64.zip"
$shaPath = Join-Path $root "dist\ClueVault-v0.2.0-win-x64.zip.sha256"
$notesPath = Join-Path $root "docs\release-v0.2.0.md"

if (-not (Test-Path $zipPath)) { throw "Missing release zip: $zipPath" }
if (-not (Test-Path $shaPath)) { throw "Missing sha256 file: $shaPath" }
if (-not (Test-Path $notesPath)) { throw "Missing release notes: $notesPath" }

$clientId = "Iv1.b507a08c87ecfe98"

Write-Host "正在向 GitHub 申请一次性设备验证码..." -ForegroundColor Cyan

$device = Invoke-RestMethod `
    -Method Post `
    -Uri "https://github.com/login/device/code" `
    -Headers @{ Accept = "application/json" } `
    -Body @{
        client_id = $clientId
        scope = "repo"
    }

Set-Clipboard $device.user_code

Write-Host ""
Write-Host "GitHub 一次性验证码已复制到剪贴板：" -ForegroundColor Green
Write-Host $device.user_code -ForegroundColor Yellow
Write-Host ""
Write-Host "浏览器会打开 GitHub 授权页。请粘贴验证码并点击授权。" -ForegroundColor Cyan
Write-Host "授权完成前不要关闭这个窗口。" -ForegroundColor Cyan

Start-Process $device.verification_uri

$token = $null

while (-not $token) {
    Start-Sleep -Seconds ([int]$device.interval)

    $poll = Invoke-RestMethod `
        -Method Post `
        -Uri "https://github.com/login/oauth/access_token" `
        -Headers @{ Accept = "application/json" } `
        -Body @{
            client_id = $clientId
            device_code = $device.device_code
            grant_type = "urn:ietf:params:oauth:grant-type:device_code"
        }

    if ($poll.access_token) {
        $token = $poll.access_token
        break
    }

    if ($poll.error -and $poll.error -ne "authorization_pending") {
        throw "$($poll.error): $($poll.error_description)"
    }

    Write-Host "等待浏览器授权中..." -ForegroundColor DarkGray
}

$headers = @{
    Accept = "application/vnd.github+json"
    Authorization = "Bearer $token"
    "X-GitHub-Api-Version" = "2022-11-28"
}

Write-Host ""
Write-Host "授权成功，正在验证 GitHub API 权限..." -ForegroundColor Green
$me = Invoke-RestMethod -Method Get -Uri "https://api.github.com/user" -Headers $headers
Write-Host "已授权账号：$($me.login)" -ForegroundColor Green

$notes = Get-Content -LiteralPath $notesPath -Raw -Encoding UTF8
$releaseUri = "https://api.github.com/repos/$owner/$repo/releases/tags/$tag"
$release = $null

try {
    $release = Invoke-RestMethod -Method Get -Uri $releaseUri -Headers $headers
    Write-Host "Release 已存在，将更新说明并替换附件：$tag" -ForegroundColor Cyan

    $body = @{
        tag_name = $tag
        name = $releaseName
        body = $notes
        draft = $false
        prerelease = $false
    } | ConvertTo-Json -Depth 10

    $release = Invoke-RestMethod -Method Patch -Uri "https://api.github.com/repos/$owner/$repo/releases/$($release.id)" -Headers $headers -Body $body -ContentType "application/json; charset=utf-8"
}
catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 404) { throw }

    Write-Host "Release 不存在，正在创建：$tag" -ForegroundColor Cyan

    $body = @{
        tag_name = $tag
        name = $releaseName
        body = $notes
        draft = $false
        prerelease = $false
    } | ConvertTo-Json -Depth 10

    $release = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$owner/$repo/releases" -Headers $headers -Body $body -ContentType "application/json; charset=utf-8"
}

function Remove-ExistingAsset {
    param(
        [Parameter(Mandatory = $true)] $Release,
        [Parameter(Mandatory = $true)] [string] $Name
    )

    $asset = $Release.assets | Where-Object { $_.name -eq $Name } | Select-Object -First 1
    if ($asset) {
        Write-Host "删除旧附件：$Name" -ForegroundColor DarkGray
        Invoke-RestMethod -Method Delete -Uri "https://api.github.com/repos/$owner/$repo/releases/assets/$($asset.id)" -Headers $headers | Out-Null
    }
}

function Upload-Asset {
    param(
        [Parameter(Mandatory = $true)] $Release,
        [Parameter(Mandatory = $true)] [string] $Path,
        [Parameter(Mandatory = $true)] [string] $ContentType
    )

    $name = Split-Path -Leaf $Path
    Remove-ExistingAsset -Release $Release -Name $name

    $uploadUrl = $Release.upload_url -replace "\{\?name,label\}", ""
    $uri = "$uploadUrl?name=$([uri]::EscapeDataString($name))"

    Write-Host "上传附件：$name" -ForegroundColor Cyan
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $bytes -ContentType $ContentType | Out-Null
}

Upload-Asset -Release $release -Path $zipPath -ContentType "application/zip"
Upload-Asset -Release $release -Path $shaPath -ContentType "text/plain"

Write-Host ""
Write-Host "发布完成：" -ForegroundColor Green
Write-Host $release.html_url -ForegroundColor Yellow
Read-Host "按回车关闭"
