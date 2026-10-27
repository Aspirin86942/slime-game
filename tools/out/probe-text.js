/* 量 intent-label / uname / hp-value 实际排版（是否被裁切） */
'use strict';
const path = require('node:path');
const { launch, sleep, waitFor, fileUrl } = require('./lib/cdp.js');
const ROOT = path.resolve(__dirname, '..', '..');
const url = fileUrl(path.join(ROOT, '史莱姆.html')) + '?battle=ui';

(async () => {
  const c = await launch({ url, width: 390, height: 844, dpr: 3 });
  try {
    await waitFor(() => c.ev('document.readyState === "complete" && !!window.__TEST__'), 15000);
    await sleep(400);
    await c.ev(`window.__TEST__.startBattle({elements:['岩','火','水','风','草'],level:20,monsterLevel:16,speed:1,seed:5});`);
    await sleep(900);
    const rows = await c.ev(`(()=>{
      const units=[...document.querySelectorAll('.battle-row.enemy .battle-unit, .battle-row.ally .battle-unit')];
      return units.map(u=>{
        const pick=s=>{const el=u.querySelector(s); if(!el) return null; const r=el.getBoundingClientRect(); return {cls:s, w:Math.round(r.width), txt:el.textContent.slice(0,24), clipped: el.scrollWidth>el.clientWidth+1};};
        const r=u.getBoundingClientRect();
        return { unitW:Math.round(r.width), unitH:Math.round(r.height), parts:[pick('.uname'),pick('.hp-value'),pick('.intent-label'),pick('.battle-statuses')].filter(Boolean) };
      });
    })()`);
    await c.shot(path.join(__dirname, 'look', 'after-longintent.png'));
    console.log(JSON.stringify(rows, null, 1));
  } catch (e) { console.log('ERR ' + (e && e.message || e)); process.exitCode = 1; }
  finally { await c.close(); }
})();
