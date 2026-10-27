/* 跑内建自检：史莱姆.html?selftest，等 document.title 出 PASS/FAIL 结果后输出全文 */
'use strict';
const path = require('node:path');
const { launch, sleep, waitFor, fileUrl } = require('./lib/cdp.js');
const ROOT = path.resolve(__dirname, '..', '..');
const file = process.argv[2] || '史莱姆.html';
const url = fileUrl(path.join(ROOT, file)) + '?selftest';

(async () => {
  const c = await launch({ url, width: 390, height: 844, dpr: 2 });
  try {
    if (!await waitFor(() => c.ev('document.readyState === "complete"'), 20000)) throw new Error('页面加载超时');
    if (!await waitFor(() => c.ev('(document.title||"").startsWith("PASS ")||(document.title||"").startsWith("FAIL ")'), 120000, 500)) throw new Error('自检超时，未收到完整结果');
    await sleep(200);
    const txt = await c.ev('document.querySelector("#selftestOut").textContent');
    console.log(txt);
    const title = await c.ev('document.title');
    console.log('TITLE: ' + title);
    const result = /^PASS (\d+)\/(\d+)$/.exec(title);
    if (!result || Number(result[1]) === 0 || result[1] !== result[2]) process.exitCode = 1;
  } catch (e) {
    const txt = await c.ev('document.querySelector("#selftestOut") ? document.querySelector("#selftestOut").textContent : "(no out)"').catch(() => '(err)');
    console.log(txt);
    console.log('ERR ' + (e && e.message || e));
    process.exitCode = 1;
  } finally { await c.close(); }
})();
