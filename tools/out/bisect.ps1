# 二分定位：哪个快照开始让自动战斗战报偏离 task7 基线
$ErrorActionPreference = 'Stop'
$root = 'D:\python_program\game'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$harness = [System.IO.File]::ReadAllText("$root\tools\out\auto-harness.js")
$enc = New-Object System.Text.UTF8Encoding($false)

function Get-Logs([string]$src, [string]$tag) {
  $html = [System.IO.File]::ReadAllText($src)
  $i = $html.LastIndexOf('</body>')
  $dst = "$root\tools\out\b-$tag.html"
  [System.IO.File]::WriteAllText($dst, $html.Substring(0, $i) + "<script>`n$harness`n</script>`n" + $html.Substring($i), $enc)
  $dom = "$root\tools\out\dom-b-$tag.html"
  if (Test-Path $dom) { Remove-Item $dom -Force }
  $uri = 'file:///' + ($dst -replace '\\', '/')
  Start-Process -FilePath $chrome -Wait -ArgumentList @(
    '--headless=new', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=30000', '--dump-dom', $uri
  ) -RedirectStandardOutput $dom | Out-Null
  $h = [System.IO.File]::ReadAllText($dom)
  $m = [regex]::Match($h, '<title>(.*?)</title>', 'Singleline')
  return $m.Groups[1].Value
}

$files = [ordered]@{
  t7  = 'backup\史莱姆-20261027-1101-task7.html'
  t8  = 'backup\史莱姆-20261027-1105-task8.html'
  t10 = 'backup\史莱姆-20261027-1108-task10.html'
}
$out = [ordered]@{}
foreach ($k in $files.Keys) {
  $out[$k] = Get-Logs "$root\$($files[$k])" $k
  "$k len=$($out[$k].Length)"
}
't7 == t8 : ' + ($out.t7 -eq $out.t8)
't8 == t10: ' + ($out.t8 -eq $out.t10)
't7 == t10: ' + ($out.t7 -eq $out.t10)
$out.t8
$out.t10
