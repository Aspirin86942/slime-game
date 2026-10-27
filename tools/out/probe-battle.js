/* 验证战斗标记：真实点选流程 + 强制加类看光效/标注 */
'use strict';
const path = require('node:path');
const { launch, sleep, waitFor } = require('./lib/cdp.js');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'look');
const url = 'file:///' + path.join(ROOT, '史莱姆.html').replace(/\\/g, '/') + '?battle=ui';

(async () => {
  const c = await launch({ url, width: 390, height: 844, dpr: 3, touchEnabled: true });
  const out = {};
  try {
    await waitFor(() => c.ev('document.readyState === "complete" && !!window.__TEST__'), 15000);
    await sleep(500);
    await c.ev(`S.battleMode='step'; window.__TEST__.startBattle({elements:['岩','火','水','风','草'],level:20,monsterLevel:16,speed:1,seed:7});`);
    await waitFor(() => c.ev('!!document.querySelector("#skillBar:not(.hide) .sk-unit")'), 8000);
    await sleep(200);

    out.step = await c.ev(`(()=>{
      const u = document.querySelector('#skillBar [data-sk-unit]');
      u.click();
      const acts = [...document.querySelectorAll('#skillBar [data-sk-act]')].map(b => b.dataset.skAct + (b.disabled ? '(off)' : ''));
      const basic = document.querySelector('#skillBar [data-sk-act="basic"]');
      if(basic) basic.click();
      return { acts, selected: document.querySelectorAll('.selected-unit').length, targetable: document.querySelectorAll('.targetable').length };
    })()`);
    await sleep(250);
    out.afterBasic = await c.ev(`({ targetable: document.querySelectorAll('.targetable').length, log: (document.querySelector('#battleLog')||{}).textContent })`);
    await c.shot(path.join(OUT, 'debug-target.png'));

    /* 强制四种标记，检查光效与文字标注（纯视觉验证） */
    out.forced = await c.ev(`(()=>{
      const ally = document.querySelector('.battle-row.ally .battle-unit');
      const ally2 = document.querySelectorAll('.battle-row.ally .battle-unit')[1];
      const enemy = document.querySelector('.battle-row.enemy .battle-unit');
      ally.classList.add('is-acting');
      ally2.classList.add('selected-unit');
      enemy.classList.add('is-targeted');
      document.querySelectorAll('.battle-row.enemy .battle-unit')[1].classList.add('targetable');
      const wrap = ally.querySelector('.slime-wrap');
      const cs = getComputedStyle(wrap, '::before');
      const r = wrap.getBoundingClientRect();
      return {
        content: cs.content, color: cs.color, bottom: cs.bottom, fontSize: cs.fontSize,
        filter: getComputedStyle(wrap).filter,
        wrap: { y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width) },
        logY: Math.round(document.querySelector('.battle-log').getBoundingClientRect().y),
        hint: !!document.querySelector('.training-hint')
      };
    })()`);
    await sleep(200);
    await c.shot(path.join(OUT, 'debug-forced.png'));
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.log('ERR ' + (e && e.message || e));
    process.exitCode = 1;
  } finally { await c.close(); }
})();
