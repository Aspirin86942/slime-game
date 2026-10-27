# 审查用临时脚本：复制产品文件，注入额外检查，用 headless Chrome 跑自检
$ErrorActionPreference = 'Stop'
$root = 'D:\python_program\game'
$outDir = Join-Path $root 'tools\out'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$src = Join-Path $root '史莱姆.html'
$dst = Join-Path $outDir 'review-harness.html'
Copy-Item -LiteralPath $src -Destination $dst -Force

$html = Get-Content -LiteralPath $dst -Raw -Encoding UTF8
$anchor = '  /* ===== CHECKS-END ===== */'
if(-not $html.Contains($anchor)){ throw '找不到 CHECKS-END 锚点' }

$extra = @'
  /* ===== 审查临时检查 ===== */
  check('X-step-timer', async () => {
    const b = freshBattle({ elements:['岩','火'], speed:10 });
    try{
      setMode('step');
      const before = b.B.turn;
      await sleep(2500);
      if(b.B.turn !== before) throw new Error('等待玩家期间回合从 ' + before + ' 自动推进到 ' + b.B.turn);
      return true;
    }finally{ killBattle(b); setMode('auto'); }
  });
  check('X-revive-visual', async () => {
    const b = freshBattle({ elements:['时间','火'] });
    try{
      setMode('interject');
      const u = b.B.allies.find(x => x.ref.element === '时间');
      const dead = b.B.allies.find(x => x !== u);
      const el = b.getUnitEl(dead, 'ally');
      const sl = el.querySelector('.slime');
      dead.hp = 0;
      b.handleUnitDeath(dead, 'ally');
      if(!sl.classList.contains('dying')) throw new Error('夹具：死亡演出未触发');
      if(b.playerCast(u, null) !== true) throw new Error('回溯未能释放');
      if(!(dead.hp > 0)) throw new Error('未复活');
      await sleep(700);
      const cs = getComputedStyle(sl);
      const op = cs.opacity;
      if(sl.classList.contains('dying') || Number(op) < 0.5) throw new Error('复活后仍保持死亡样式 .dying=' + sl.classList.contains('dying') + ' opacity=' + op + ' anim=' + cs.animationName + ' fill=' + cs.animationFillMode + ' match=' + sl.matches('.battle-field .slime.dying') + ' dur=' + cs.animationDuration);
      return true;
    }finally{ killBattle(b); setMode('auto'); }
  });
  check('X-manual-auto-ice', async () => {
    const b = freshBattle({ elements:['火','冰'] });
    try{
      setMode('interject');
      const u = b.B.allies.find(x => x.ref.element === '火');
      const t = b.B.monsters[0];
      t.ref.element = '冰';
      t.st.iceArmor = 999; t.st.rockArmor = 0;
      t.hp = t.maxHp = 999999;
      b.B.monsters.slice(1).forEach(m => { m.hp = 0; });
      u.st.frostbite = 0;
      if(b.playerBasic(u, t) !== true) throw new Error('手动普攻失败');
      const manual = u.st.frostbite;
      u.acted = false; u.st.frostbite = 0; t.hp = t.maxHp;
      await b.performAction(u, 'ally');
      const auto = u.st.frostbite;
      if(manual !== 0) throw new Error('手动路径也触发冰甲:' + manual);
      if(auto === 0) throw new Error('自动路径未触发冰甲');
      return true;
    }finally{ killBattle(b); setMode('auto'); }
  });
  check('X-manual-auto-water', async () => {
    const b = freshBattle({ elements:['火','冰'] });
    try{
      setMode('interject');
      const u = b.B.allies[0];
      const t = b.B.monsters[0];
      t.ref.element = '水';
      t.hp = t.maxHp = 999999;
      b.B.monsters.slice(1).forEach(m => { m.hp = 0; });
      t.minis = [];
      b.playerBasic(u, t);
      const manual = (t.minis || []).length;
      u.acted = false; t.hp = t.maxHp;
      await b.performAction(u, 'ally');
      const auto = (t.minis || []).length;
      if(manual === 0 && auto > 0) throw new Error('自动路径命中水属性目标后召唤了 ' + auto + ' 只迷你史莱姆，手动普攻不召唤');
      if(manual > 0) throw new Error('手动路径也召唤了:' + manual);
      return true;
    }finally{ killBattle(b); setMode('auto'); }
  });
  check('X-kill-shake', () => {
    const b = freshBattle();
    try{
      const el = b.fieldEl;
      el.setAttribute('data-k', 'kill');
      el.classList.add('field-shake');
      const name = getComputedStyle(el).animationName;
      if(name !== 'fxShakeKill') throw new Error('kill 档使用动画 ' + name + '（规格要求 ±5px 的 fxShakeKill）');
      return true;
    }finally{ killBattle(b); }
  });
  check('X-miss-color', () => {
    const b = freshBattle();
    try{
      FX.float(b.fieldEl, '闪避', { cls:'miss' });
      const el = b.fieldEl.querySelector('.fx-float.miss');
      if(!el) throw new Error('没有闪避飘字元素');
      const m = getComputedStyle(el).color.match(/\d+/g).map(Number);
      if(!(m[2] > 200 && m[0] > 150)) throw new Error('闪避飘字颜色 ' + getComputedStyle(el).color + '，规格要求淡紫');
      return true;
    }finally{ killBattle(b); }
  });
'@

$html = $html.Replace($anchor, $extra + "`r`n" + $anchor)
Set-Content -LiteralPath $dst -Value $html -Encoding UTF8 -NoNewline

$chromeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if(-not $chrome){ throw '找不到 Chrome/Edge' }

$profile = Join-Path $outDir ('chrome-profile-' + [guid]::NewGuid().ToString('N'))
$url = 'file:///' + ($dst -replace '\\','/') + '?selftest'
$domFile = Join-Path $outDir 'review-dom.html'
& $chrome --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files `
  --user-data-dir="$profile" --virtual-time-budget=25000 --dump-dom $url 2>$null |
  Out-File -LiteralPath $domFile -Encoding UTF8
Remove-Item -Recurse -Force -LiteralPath $profile -ErrorAction SilentlyContinue

$dom = Get-Content -LiteralPath $domFile -Raw -Encoding UTF8
$m = [regex]::Match($dom, '(?s)<pre id="selftestOut"[^>]*>(.*?)</pre>')
if(-not $m.Success){ Write-Output 'NO PRE FOUND'; return }
$text = $m.Groups[1].Value
$text = $text -replace '&lt;','<' -replace '&gt;','>' -replace '&amp;','&' -replace '&quot;','"'
$text
