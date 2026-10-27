/* 战斗画面观感对比：给新版 / 打击版各拍一组战斗截图，并输出关键尺寸。
   用法：node tools/out/look.js new|old [tag]
   产物：tools/out/look/<tag>-*.png 与 <tag>-metrics.json */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { launch, sleep, waitFor } = require('./lib/cdp.js');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'look');
const FILES = { new: '史莱姆.html', old: '史莱姆（打击版）.html' };
const ELEMENTS = ['岩', '火', '水', '风', '草'];
const NAMES = ['小石头', '赤焰', '涌泉', '疾风', '青藤'];

const which = process.argv[2] || 'new';
const tag = process.argv[3] || which;
const url = 'file:///' + path.join(ROOT, FILES[which]).replace(/\\/g, '/') + (which === 'new' ? '?battle=ui' : '');

/* 打击版：脚本是全局函数，直接用它的内部函数造一场 5v4 */
const FIX_OLD = `(()=>{
  localStorage.clear();
  S.started = true; S.name = '测试';
  S.slimes = [];
  ${JSON.stringify(ELEMENTS)}.forEach((el, i) => {
    const s = createSlime(false);
    s.element = el; s.name = ${JSON.stringify(NAMES)}[i];
    s.level = 20; s.skill = '元素弹'; s.hp = hpMax(s);
    S.slimes.push(s);
  });
  S.abyssLevel = 16; S.battleSpeed = 5;
  abyssSetupSel = S.slimes.map(s => s.id);
  document.getElementById('storyScreen').classList.add('hidden');
  document.getElementById('gameScreen').classList.remove('hidden');
  startAbyssBattle();
  return S.slimes.length;
})()`;

/* 新版：先切逐步模式，进入玩家回合时技能条会出现 */
const FIX_NEW = mode => `(()=>{
  S.battleMode = ${JSON.stringify(mode)};
  const field = window.__TEST__.startBattle({ elements: ${JSON.stringify(ELEMENTS)}, level: 20, monsterLevel: 16, speed: ${mode === 'auto' ? 5 : 1}, seed: 7 });
  return !!field;
})()`;

const METRICS = `(()=>{
  const px = n => Math.round(n * 10) / 10;
  const r = el => { const b = el.getBoundingClientRect(); return { x: px(b.x), y: px(b.y), w: px(b.width), h: px(b.height) }; };
  const slimes = [...document.querySelectorAll('.battle-row .slime-wrap > .slime')].map(r);
  const uniqW = [...new Set(slimes.map(s => s.w))];
  const boxes = ['battle-intents', 'intent-chip', 'status-chip', 'battle-key', 'skill-bar']
    .map(c => c + '=' + document.querySelectorAll('.battle-field .' + c).length).join(' ');
  const styled = sel => { const el = document.querySelector(sel); if(!el) return null; const cs = getComputedStyle(el); return { bg: cs.backgroundColor, border: cs.borderTopWidth, radius: cs.borderRadius }; };
  return {
    slimeWidths: uniqW,
    slimeCount: slimes.length,
    enemyRow: document.querySelector('.battle-row.enemy') ? r(document.querySelector('.battle-row.enemy')) : null,
    allyRow: document.querySelector('.battle-row.ally') ? r(document.querySelector('.battle-row.ally')) : null,
    unit: document.querySelector('.battle-unit') ? r(document.querySelector('.battle-unit')) : null,
    counts: boxes,
    intentChip: styled('.intent-chip'),
    trainingHint: styled('.training-hint'),
    statusChip: styled('.status-chip'),
    selectedUnit: styled('.battle-unit.selected-unit'),
    targetable: (()=>{ const el = document.querySelector('.battle-unit.targetable'); if(!el) return null; const cs = getComputedStyle(el); return { outline: cs.outlineStyle, before: getComputedStyle(el, '::before').content }; })()
  };
})()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const c = await launch({ url, width: 390, height: 844, dpr: 3, touchEnabled: true });
  const log = [];
  const shot = async name => { const f = path.join(OUT, tag + '-' + name + '.png'); await c.shot(f); log.push(f); return f; };
  try {
    await waitFor(() => c.ev('document.readyState === "complete" && !!document.querySelector("#app")'), 15000);
    await sleep(600);

    if (which === 'old') {
      const n = await c.ev(FIX_OLD);
      log.push('fixture slimes=' + n);
      await sleep(1800); await shot('auto-a');
      await sleep(1100); await shot('auto-b');
    } else {
      /* 1) 逐步模式：技能条 + 当前行动单位 */
      if (!await c.ev(FIX_NEW('step'))) throw new Error('startBattle 返回空');
      const bar = await waitFor(() => c.ev('!!document.querySelector("#skillBar:not(.hide) .sk-unit")'), 8000);
      if (!bar) throw new Error('技能条没出现');
      await sleep(300); await shot('step');
      /* 2) 选中己方 + 普攻 → 敌方进入可选目标状态 */
      await c.ev('document.querySelector("#skillBar [data-sk-unit]").click();');
      await sleep(150);
      await c.ev('(document.querySelector("#skillBar [data-sk-act=\\"basic\\"]")||{click(){}}).click();');
      await sleep(300); await shot('target');
      /* 3) 自动模式：交战中（打击特效可出现） */
      await c.ev('window.__TEST__._battle && window.__TEST__._battle.closeBattle && window.__TEST__._battle.closeBattle();');
      await sleep(200);
      await c.ev(FIX_NEW('auto'));
      await sleep(2200); await shot('auto-a');
      await sleep(900); await shot('auto-b');
    }

    const metrics = await c.ev(METRICS);
    fs.writeFileSync(path.join(OUT, tag + '-metrics.json'), JSON.stringify({ which, tag, metrics, shots: log }, null, 2), 'utf8');
    console.log(JSON.stringify({ ok: true, tag, metrics }, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, tag, error: String(e && e.message || e), shots: log }, null, 2));
    process.exitCode = 1;
  } finally {
    await c.close();
  }
})();
