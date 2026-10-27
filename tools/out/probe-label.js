/* 量 T0 标记文字与血条/护盾条的几何关系 */
'use strict';
const path = require('node:path');
const { launch, sleep, waitFor, fileUrl } = require('./lib/cdp.js');
const ROOT = path.resolve(__dirname, '..', '..');
const url = fileUrl(path.join(ROOT, '史莱姆.html')) + '?battle=ui';
const r2 = n => Math.round(n * 10) / 10;

(async () => {
  const c = await launch({ url, width: 390, height: 844, dpr: 3 });
  try {
    await waitFor(() => c.ev('document.readyState === "complete" && !!window.__TEST__'), 15000);
    await sleep(400);
    await c.ev(`window.__TEST__.startBattle({elements:['岩','火','水','风','草'],level:20,monsterLevel:16,speed:1,seed:5});`);
    await sleep(900);
    const info = await c.ev(`(()=>{
      const u=document.querySelector('.battle-row.ally .battle-unit');
      u.classList.add('is-acting');
      const g=s=>{const el=u.querySelector(s); if(!el) return null; const r=el.getBoundingClientRect(); return {top:r.top,bottom:r.bottom,h:r.height};};
      const ur=u.getBoundingClientRect();
      const cs=getComputedStyle(u.querySelector('.slime-wrap'),'::before');
      return {unit:{top:ur.top,bottom:ur.bottom,h:ur.height,hPadTop:getComputedStyle(u).paddingTop},
        wrap:g('.slime-wrap'), hpbar:g('.hpbar'), shieldbar:g('.shieldbar'),
        labelBottomCss:cs.bottom, labelFont:cs.fontSize, labelContent:cs.content};
    })()`);
    for (const k of Object.keys(info)) {
      const v = info[k];
      if (v && typeof v === 'object') for (const kk of Object.keys(v)) if (typeof v[kk] === 'number') v[kk] = r2(v[kk]);
    }
    console.log(JSON.stringify(info, null, 1));
  } catch (e) { console.log('ERR ' + (e && e.message || e)); process.exitCode = 1; }
  finally { await c.close(); }
})();
