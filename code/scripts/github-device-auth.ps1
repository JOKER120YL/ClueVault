$ErrorActionPreference = "Stop"

$clientId = "Iv1.b507a08c87ecfe98"
$gh = "C:\Program Files\GitHub CLI\gh.exe"

Write-Host "正在向 GitHub 申请一次性设备验证码..." -ForegroundColor Cyan

$device = Invoke-RestMethod `
    -Method Post `
    -Uri "https://github.com/login/device/code" `
    -Headers @{ Accept = "application/json" } `
    -Body @{
        client_id = $clientId
        scope = "repo read:org gist"
    }

Set-Clipboard $device.user_code

Write-Host ""
Write-Host "GitHub 一次性验证码已复制到剪贴板：" -ForegroundColor Green
Write-Host $device.user_code -ForegroundColor Yellow
Write-Host ""
Write-Host "浏览器会打开 GitHub 授权页。请粘贴验证码并点击授权。" -ForegroundColor Cyan
Write-Host "授权完成前不要关闭这个窗口，我会自动等待并写入 gh 登录状态。" -ForegroundColor Cyan

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

Write-Host ""
Write-Host "授权成功，正在写入 GitHub CLI 登录状态..." -ForegroundColor Green

$token | & $gh auth login --hostname github.com --with-token
& $gh auth status --hostname github.com

Write-Host ""
Write-Host "完成。看到 Logged in 或 ✓ Logged in 后，可以关闭这个窗口。" -ForegroundColor Green
Read-Host "按回车关闭"
