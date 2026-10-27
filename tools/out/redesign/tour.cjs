// 美术巡检：给每个主要页面拍一张 390x844 截图。用法：node tools/out/redesign/tour.cjs <tag>
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { launch, sleep, waitFor, fileUrl } = require('../lib/cdp.js');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const tag = process.argv[2] || 'before';
const OUT = path.join(__dirname, tag);
const only = process.argv[3] ? process.argv[3].split(',') : null;
const setup = `(() => {
  S.globalPlan=null;S.customPlans={};
  const T=window.__TEST__;
  T.startBattle({elements:['岩','水','草'],level:20,monsterLevel:14,speed:1,seed:7});
  T._battle.closeBattle();
  S.slimes.forEach((s,i)=>{s.name=['小石头','涌泉','青藤'][i];s.intimacy=34;s.mood=90;});
  S.name='星野';S.level=30;S.coins=28640;S.points=1260;
  S.bag={food:12,treasure:3,ticket:5,expPotion:2,net:4};
  S.theme='sunset';applyTheme();renderTop();switchTab('space');
  return true;
})()`;
const pages = [
  ['space', `switchTab('space')`],
  ['summon', `switchTab('summon')`],
  ['travel', `switchTab('travel')`],
  ['bag', `switchTab('bag')`],
  ['status', `switchTab('status')`],
  ['world-home', `switchTab('world')`],
  ['world-nursery', `document.querySelector('[data-lw="tab"][data-tab="nursery"]').click()`],
  ['world-ecology', `document.querySelector('[data-lw="tab"][data-tab="ecology"]').click()`],
  ['world-explore', `document.querySelector('[data-lw="tab"][data-tab="explore"]').click()`],
  ['world-stories', `document.querySelector('[data-lw="tab"][data-tab="stories"]').click()`],
  ['world-workshop', `document.querySelector('[data-lw="tab"][data-tab="workshop"]').click()`],
  ['world-games', `document.querySelector('[data-lw="tab"][data-tab="games"]').click()`],
  ['settings', `switchTab('space');document.querySelector('[data-act="settings"]').click()`],
  ['world-rich', `(()=>{const W=S.world;W.stock.wood=999;W.stock.stone=999;W.stock.dew=99;const L=LivingWorld;
    [['pond',7,2],['kitchen',2,8],['grove',8,7],['stars',5,1]].forEach(([d,x,y])=>L.dispatch({type:'build',def:d,zone:0,x,y}));
    L.dispatch({type:'sow',cultivar:W.cultivars[0].id,zone:0});L.dispatch({type:'sow',cultivar:W.cultivars[3].id,zone:0});
    W.crops.forEach((c,i)=>c.progress=[.3,.8,1][i%3]);
    switchTab('world');document.querySelector('[data-lw="tab"][data-tab="home"]').click();document.querySelector('.lw-scene-wrap').scrollIntoView({block:'center'})})()`],
  ['world-night', `(()=>{S.world.clock=Math.floor(S.world.clock/3600)*3600+3000;switchTab('world');document.querySelector('.lw-scene-wrap').scrollIntoView({block:'center'})})()`],
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const errors = [];
  // 开场：普通模式、空存档
  {
    const p = await launch({ url: fileUrl(path.join(ROOT, '史莱姆.html')), width: 390, height: 844, dpr: 2, touchEnabled: true });
    p.client.on('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails?.exception?.description || e.exceptionDetails?.text));
    try {
      await waitFor(() => p.ev('document.readyState==="complete"'), 15000);
      await p.ev('localStorage.clear();location.reload();true'); await sleep(1500);
      if (!only || only.includes('story')) { await p.shot(path.join(OUT, 'story-0.png')); }
      if (!only || only.includes('story')) {
        for (let i = 1; i <= 3; i++) { await p.ev('document.getElementById("storyScreen").click();true'); await sleep(900); }
        await p.shot(path.join(OUT, 'story-1.png'));
      }
    } finally { await p.close(); }
  }
  const p = await launch({ url: fileUrl(path.join(ROOT, '史莱姆.html'), '?battle=ui'), width: 390, height: 844, dpr: 2, touchEnabled: true });
  p.client.on('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails?.exception?.description || e.exceptionDetails?.text));
  try {
    if (!await waitFor(() => p.ev('!!window.__TEST__'), 15000)) throw new Error('no hooks');
    await p.ev(setup); await sleep(300);
    for (const [name, js] of pages) {
      if (only && !only.includes(name)) continue;
      await p.ev(`(()=>{document.querySelectorAll('#modalLayer').forEach(m=>m.classList.add('hidden'));${js};return true})()`);
      await sleep(500);
      await p.shot(path.join(OUT, name + '.png'));
    }
    if (!only || only.includes('battle')) {
      await p.ev(`(()=>{document.getElementById('modalLayer').classList.add('hidden');S.battleMode='auto';window.__TEST__.startBattle({elements:['岩','火','水','风','草'],level:20,monsterLevel:16,speed:1,seed:7});return true})()`);
      await sleep(2600); await p.shot(path.join(OUT, 'battle.png'));
    }
  } finally { await p.close(); }
  console.log(JSON.stringify({ out: OUT, errors }, null, 1));
})();
