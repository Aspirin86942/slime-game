# 史莱姆.html 自检 / 画廊跑测器
# 用法:
#   pwsh -File tools/selftest.ps1 -Mode selftest
#   pwsh -File tools/selftest.ps1 -Mode gallery [-Tag after-task5]
# 输出:
#   tools/out/dom.html      selftest 模式的整页 DOM
#   tools/out/selftest.txt  #selftestOut 的原文
#   tools/out/gallery.png   gallery 模式的截图
# 退出码: 0 = 至少一条 PASS 且无 FAIL; 1 = 有 FAIL 或没有任何 PASS
param(
  [ValidateSet('selftest','gallery')]
  [string]$Mode = 'selftest',
  [int]$Budget = 20000,
  [string]$Tag = '',
  [int]$Height = 844,
  [int]$Width = 0
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$game = Join-Path $root '史莱姆.html'
if(!(Test-Path $game)){ Write-Error "找不到游戏文件: $game"; exit 1 }

$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if(!(Test-Path $chrome)){
  $chrome = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
  if(!(Test-Path $chrome)){ Write-Error '找不到 Chrome 或 Edge'; exit 1 }
}

$outDir = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$profileDir = Join-Path $env:TEMP 'slime-selftest-profile'
$errFile = Join-Path $outDir 'chrome-stderr.txt'

$fileUrl = 'file:///' + ([uri]::EscapeUriString(($game -replace '\\','/')))
$query = if($Mode -eq 'gallery'){ '?gallery=1' } else { '?selftest=1' }
$url = $fileUrl + $query

$common = @(
  '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  '--hide-scrollbars','--window-size=390,844',"--user-data-dir=$profileDir",
  "--virtual-time-budget=$Budget"
)

# 注意：直接 `& chrome.exe` 在本机拿不到 stdout（启动器先返回、输出句柄断开），
# 必须用 Start-Process -Wait -RedirectStandardOutput 让子进程写文件。
if($Mode -eq 'gallery'){
  $shot = Join-Path $outDir ('gallery' + $(if($Tag){"-$Tag"}else{''}) + '.png')
  Remove-Item $shot -ErrorAction SilentlyContinue
  # 画廊是给人看的样张，默认放宽到 780 宽，一行能排下 6 个 cell，不会把第 4 个裁掉
  $gw = if($Width -gt 0){ $Width } else { 780 }
  $shotArgs = @(
    '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
    '--hide-scrollbars',"--window-size=$gw,$Height","--user-data-dir=$profileDir",
    "--virtual-time-budget=$Budget"
  )
  $pr = Start-Process -FilePath $chrome -Wait -PassThru -RedirectStandardError $errFile `
    -ArgumentList ($shotArgs + @("--screenshot=$shot", $url))
  if(!(Test-Path $shot)){ Write-Output "SCREENSHOT_FAIL: $shot ($(Get-Content $errFile -TotalCount 5))"; exit 1 }
  Write-Output "SCREENSHOT $shot"
  exit 0
}

$domPath = Join-Path $outDir 'dom.html'
Remove-Item $domPath -ErrorAction SilentlyContinue
$pr = Start-Process -FilePath $chrome -Wait -PassThru -RedirectStandardOutput $domPath -RedirectStandardError $errFile `
  -ArgumentList ($common + @('--dump-dom', $url))
$dom = Get-Content -Raw -Encoding UTF8 $domPath
if(!$dom){
  Write-Output "NO_DOM: chrome 无输出 (exit=$($pr.ExitCode))"
  Write-Output (Get-Content $errFile -TotalCount 10)
  exit 1
}

$m = [regex]::Match($dom, '(?s)<pre[^>]*id="selftestOut"[^>]*>(.*?)</pre>')
if(!$m.Success){
  Write-Output 'NO_HARNESS: 页面里没有 #selftestOut（自检段没执行或页面报错）'
  Write-Output "DOM 已保存: $domPath"
  exit 1
}
$text = $m.Groups[1].Value.Trim()
$txtPath = Join-Path $outDir 'selftest.txt'
Set-Content -Path $txtPath -Value $text -Encoding UTF8
Write-Output $text

$pass = ([regex]::Matches($text, '(?m)^PASS ')).Count
$fail = ([regex]::Matches($text, '(?m)^FAIL ')).Count
Write-Output ''
Write-Output "===== $pass PASS / $fail FAIL ($Mode) ====="
if($fail -gt 0 -or $pass -eq 0){ exit 1 }
exit 0
