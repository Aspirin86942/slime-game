/* 放大截图指定区域，检查是否有残留方框 */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { launch, sleep, waitFor, fileUrl } = require('./lib/cdp.js');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'look');
const url = fileUrl(path.join(ROOT, '史莱姆.html')) + '?battle=ui';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const c = await launch({ url, width: 390, height: 844, dpr: 3 });
  try {
    await waitFor(() => c.ev('document.readyState === "complete" && !!window.__TEST__'), 15000);
    await sleep(400);
    await c.ev(`S.battleMode='step'; window.__TEST__.startBattle({elements:['岩','火','水','风','草'],level:20,monsterLevel:16,speed:1,seed:3});`);
    await waitFor(() => c.ev('!!document.querySelector("#skillBar:not(.hide) .sk-unit")'), 8000);
    await sleep(250);
    /* 选中 T0 + 普攻 → 敌方 targetable 状态，放大敌方区域 */
    await c.ev(`(()=>{document.querySelector('#skillBar [data-sk-unit]').click();document.querySelector('#skillBar [data-sk-act="basic"]').click();})()`);
    await sleep(300);
    const rect = await c.ev(`(()=>{const r=document.querySelector('.battle-row.enemy').getBoundingClientRect();return {x:r.x-8,y:r.y-26,width:r.width+16,height:r.height+40};})()`);
    const r = await c.client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, clip: { ...rect, scale: 2.6 } });
    fs.writeFileSync(path.join(OUT, 'zoom-enemy-targetable.png'), Buffer.from(r.data, 'base64'));
    /* 同时放大友方行（selected-unit 标记） */
    const rect2 = await c.ev(`(()=>{const r=document.querySelector('.battle-row.ally').getBoundingClientRect();return {x:r.x-8,y:r.y-30,width:r.width+16,height:r.height+44};})()`);
    const r2 = await c.client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, clip: { ...rect2, scale: 2.4 } });
    fs.writeFileSync(path.join(OUT, 'zoom-ally-selected.png'), Buffer.from(r2.data, 'base64'));
    console.log('ok');
  } catch (e) { console.log('ERR ' + (e && e.message || e)); process.exitCode = 1; }
  finally { await c.close(); }
})();
