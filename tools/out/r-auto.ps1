# R-auto 基线对拍：同一固定种子跑一场自动战斗，比较前 20 条战报
# 基线取「打磨后」快照：与 task7 相比只差战报措辞（护盾吸收披露），伤害数值与出手顺序必须逐字一致
$ErrorActionPreference = 'Stop'
$root = 'D:\python_program\game'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$harness = [System.IO.File]::ReadAllText("$root\tools\out\auto-harness.js")
$enc = New-Object System.Text.UTF8Encoding($false)

function Build-Host([string]$src, [string]$dst) {
  $html = [System.IO.File]::ReadAllText($src)
  $idx = $html.LastIndexOf('</body>')
  if ($idx -lt 0) { throw "no </body> in $src" }
  $inject = "<script>`n$harness`n</script>`n"
  $out = $html.Substring(0, $idx) + $inject + $html.Substring($idx)
  [System.IO.File]::WriteAllText($dst, $out, $enc)
}

function Get-Title([string]$file) {
  $dom = "$root\tools\out\dom-" + [System.IO.Path]::GetFileNameWithoutExtension($file) + '.html'
  if (Test-Path $dom) { Remove-Item $dom -Force }
  $uri = 'file:///' + ($file -replace '\\', '/')
  Start-Process -FilePath $chrome -Wait -ArgumentList @(
    '--headless=new', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=30000',
    '--dump-dom', $uri
  ) -RedirectStandardOutput $dom | Out-Null
  $html = [System.IO.File]::ReadAllText($dom)
  $m = [regex]::Match($html, '<title>(.*?)</title>', 'Singleline')
  if (-not $m.Success) { return '<no title>' }
  return $m.Groups[1].Value
}

$base = "$root\tools\out\base-auto.html"
$cur = "$root\tools\out\cur-auto.html"
Build-Host "$root\backup\史莱姆-20261027-1256-polish.html" $base
Build-Host "$root\史莱姆.html" $cur

$tBase = Get-Title $base
$tCur = Get-Title $cur

'baseline: ' + $tBase
'current : ' + $tCur

if ($tBase -eq $tCur) {
  'R-AUTO PASS: 基线(polish) 与当前前 20 条战报完全一致'
  exit 0
} else {
  'R-AUTO FAIL: 战报不一致'
  exit 1
}
