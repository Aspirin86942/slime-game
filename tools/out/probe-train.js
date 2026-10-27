/* 战斗课堂（固定挑战）截图：确认提示文字不再是方框 */
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
    await c.ev(`(()=>{ const ss=document.getElementById('storyScreen'); if(ss) ss.style.display='none'; startTrainingChallenge('shield'); })()`);
    await waitFor(() => c.ev('!!document.querySelector("#battleLog")'), 8000);
    await sleep(2500);
    const info = await c.ev(`(()=>{const h=document.querySelector('.training-hint');const r=h&&h.getBoundingClientRect();const cs=h&&getComputedStyle(h);return {text:h&&h.textContent, y:r&&Math.round(r.y), h:r&&Math.round(r.height), bg:cs&&cs.backgroundColor, border:cs&&cs.border};})()`);
    console.log(JSON.stringify(info));
    await c.shot(path.join(__dirname, 'look', 'after-training2.png'));
  } catch (e) { console.log('ERR ' + (e && e.message || e)); process.exitCode = 1; }
  finally { await c.close(); }
})();
