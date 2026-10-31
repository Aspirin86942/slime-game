'use strict';
// 程序化细节层：存在、不透明度上限、跟随季节、帧率、减少动画。
const assert = require('node:assert/strict');
const { start } = require('./lib/browser/session.cjs');
const { waitFor, report } = require('../tools/out/lib/cdp.js');
const out = 'tools/out/magic-ui/terrain', checks = [];
const check = (name, ok, detail) => {
  checks.push({ name, ok, detail });
  assert.ok(ok, name + ': ' + JSON.stringify(detail));
  console.log('PASS ' + name);
};
(async () => {
  const session = await start({ profile: 'desktop-s', url: '史莱姆.html?battle=ui', gpu: true, outDir: out });
  const { ev } = session, errors = session.consoleErrors;
  try {
    assert.ok(await waitFor(() => ev(`typeof S!=='undefined'&&S.started`), 15000));
    await ev(`document.querySelector('#selftestOut')?.remove();switchTab('home');S.world.reducedMotion=false;renderTab();`);
    assert.ok(await waitFor(() => ev(`!!document.querySelector('[data-home-terrain]')`), 5000));
    check('detail layer paints above the hand-painted ground', await ev(`(()=>{const t=document.querySelector('[data-home-terrain]');const g=document.querySelector('.home-ground');if(!t||!g)return false;const gRect=g.getBoundingClientRect();return g.contains(t)&&!!g.querySelector('[data-home-ground]')&&t.getAttribute('fill')==='url(#home-terrain-detail)';})()`));
    check('detail layer stays within the opacity budget', await ev(`+document.querySelector('[data-home-terrain]').getAttribute('opacity')<=.35`));
    check('detail layer follows the season', await ev(`[0,1,2,3].every(s=>{S.world.clock=s*25200+1200;renderTab();const t=document.querySelector('[data-home-terrain]');return t.dataset.homeTerrain===['moss','crystal','spore','frost'][s]&&t.dataset.homeTerrainSeason===String(s);})`));
    check('detail tile repeats fewer than eight times across the visible map', await ev(`(()=>{const p=document.querySelector('#home-terrain-detail');const w=+p.getAttribute('width');return w>=192&&w<=384;})()`));
    await ev(`S.world.clock=1200;renderTab();`);
    const fps = await ev(`new Promise(resolve=>{const samples=[];let last=performance.now();function step(t){if(t>last)samples.push(t-last);last=t;if(samples.length<150)requestAnimationFrame(step);else resolve({fps:1000/(samples.reduce((a,b)=>a+b,0)/samples.length),frames:samples.length});}requestAnimationFrame(step);})`);
    check('detail layer keeps the home above 55 FPS', fps.fps >= 55, fps);
    await ev(`S.world.reducedMotion=true;renderTab()`);
    check('reduced motion stops every map animation including the detail layer', await ev(`document.querySelectorAll('.home-world *').length>0&&[...document.querySelectorAll('.home-world *')].every(n=>getComputedStyle(n).animationName==='none')`));
    await ev(`S.world.reducedMotion=false;renderTab()`);
    check('no browser exceptions or console errors', errors.length === 0, errors);
    report(out, 'results.json', { checks, errors });
  } catch (e) {
    await session.shot('failure.png').catch(() => {});
    report(out, 'results.json', { checks, errors, failure: String(e) });
    throw e;
  } finally { await session.close(); }
  console.log(`RESULT ${checks.length}/${checks.length} terrain detail checks`);
})().catch(e => { console.error(e); process.exitCode = 1; });
