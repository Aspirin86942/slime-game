/* 真实浏览器里的存档迁移与坏档保护验收（不打自检参数，走正常启动流程）。
   用法：node tools/out/migration-check.js
   1) 正常开局产生一份 v2 存档 → 2) 手工降级成旧版 v1 存档（无 saveVersion/progress）+ 标记金币
   3) 重载后检查：迁移到 v2、写入一次性升级前备份、金币/宠物数量原样保留
   4) 写入损坏 JSON → 重载后检查：弹出「存档保护」、坏档原始字节没有被覆盖
   报告：tools/out/migration-report.json */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, '史莱姆.html');
const { CHROME, fileUrl } = require('./lib/cdp.js');
const URL = fileUrl(GAME);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(fn, timeoutMs, stepMs) {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > timeoutMs) return null; await sleep(stepMs || 100); }
}

function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', ev => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', () => res()); ws.addEventListener('error', () => rej(new Error('ws error'))); }),
    send(method, params) { const id = ++seq; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params: params || {} })); }); },
    close() { try { ws.close(); } catch {} }
  };
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, status: ok ? 'PASS' : 'FAIL', detail: detail === undefined ? '' : detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  → ' + JSON.stringify(detail)));
}

(async () => {
  const report = { when: new Date().toISOString(), game: GAME, checks: results };
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slime-mig-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--user-data-dir=' + userDir, '--window-size=390,844', 'about:blank'], { stdio: 'ignore' });
  let client;
  try {
    const portFile = path.join(userDir, 'DevToolsActivePort');
    const port = await waitFor(() => fs.existsSync(portFile) ? fs.readFileSync(portFile, 'utf8').split('\n')[0].trim() : null, 20000);
    if (!port) throw new Error('没有 DevToolsActivePort');
    const target = await (await fetch('http://127.0.0.1:' + port + '/json/new?' + encodeURIComponent(URL), { method: 'PUT' })).json();
    client = cdpClient(target.webSocketDebuggerUrl);
    await client.ready;
    await client.send('Runtime.enable');
    await client.send('Page.enable');

    const ev = async expr => {
      const r = await client.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || '').split('\n')[0] + ' :: ' + expr.slice(0, 60));
      return r.result.value;
    };
    const reload = async () => {
      const previousOrigin=await ev('performance.timeOrigin');
      await client.send('Page.reload', { ignoreCache: true });
      await waitFor(async () => {
        try { return await ev(`performance.timeOrigin!==${previousOrigin} && document.readyState === "complete" && !!document.querySelector("#app")`); } catch { return false; }
      }, 20000);
      await sleep(700);
    };
    // 在新文档的游戏脚本执行前注入，避免离页保存覆盖待迁移/损坏夹具。
    const reloadWithStorage=async raw=>{
      const fixture=await client.send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('slimeSummonerSave',${JSON.stringify(raw)});localStorage.removeItem('slimeSummonerSave_v1_backup');`});
      try{await reload();}finally{await client.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});}
    };

    const pageReady = await waitFor(async () => ev('document.readyState === "complete" && !!document.querySelector("#storyScreen")').catch(() => false), 20000);
    check('页面正常加载（无诊断参数）', !!pageReady);
    await sleep(800);

    /* ① 正常开局 → 产生真实 v2 存档（走 finishStory → save 的真实路径，再召唤 3 只伙伴） */
    await ev('finishStory()');  /* 等价于走完开场剧本：同一 finishStory→save 路径 */
    await sleep(600);
    await ev('(() => { for(let i=0;i<3;i++){ doSummon(); closeModal(); } save(); return true; })()');
    await sleep(600);

    const fresh = await ev(`(() => { const raw = localStorage.getItem('slimeSummonerSave'); return raw; })()`);
    check('开局后浏览器写入存档', !!fresh, fresh ? fresh.length + ' 字节' : '空');
    const save1 = JSON.parse(fresh);
    const petCount = (save1.slimes || []).length;
    check('新档带 saveVersion=2、abyssUnlocked 且含已召唤伙伴', Number(save1.saveVersion) === 2 && save1.abyssUnlocked !== undefined && petCount >= 1,
      { saveVersion: save1.saveVersion, abyssUnlocked: save1.abyssUnlocked, slimes: petCount, coins: save1.coins });

    /* ② 手工降级为旧版存档：去掉 saveVersion / progress / abyssUnlocked，并打上标记金币 */
    const legacy = JSON.parse(fresh);
    delete legacy.saveVersion;
    delete legacy.progress;
    delete legacy.abyssUnlocked;
    for(const key of ['lastActive','planClock','summonPity','sweepUsed']) delete legacy[key];
    legacy.coins = 77777;
    legacy.points = 4321;
    await reloadWithStorage(JSON.stringify(legacy));

    /* 载入内存后不一定立刻回写：先看界面，再触发一次真实 save() 看落盘结果 */
    const hud = await ev(`document.querySelector('#cCrystal').textContent`);
    const backupRaw = await ev(`localStorage.getItem('slimeSummonerSave_v1_backup')`);
    const legacyBytes = JSON.stringify(legacy);
    await ev('save()');
    const after = JSON.parse(await ev(`localStorage.getItem('slimeSummonerSave')`));

    check('旧档被识别并迁移到 saveVersion=2', Number(after.saveVersion) === 2, { saveVersion: after.saveVersion });
    check('迁移补上 abyssUnlocked（深渊从第 1 层解锁）', after.abyssUnlocked === 1, { abyssUnlocked: after.abyssUnlocked });
    check('旧档原有金币/积分原样保留', after.coins === 77777 && after.points === 4321, { coins: after.coins, points: after.points });
    check('宠物数量未被迁移清空', (after.slimes || []).length === (legacy.slimes || []).length && (after.slimes || []).length === petCount, { before: (legacy.slimes || []).length, after: (after.slimes || []).length });
    /* progress 是懒创建：进一次「探索」页（旅途目标/战斗课堂会读它）后应补齐五个子表 */
    await ev(`document.querySelector('.tabbar button[data-tab="travel"]').click(); true`);
    await sleep(400);
    await ev('save()');
    const after2 = JSON.parse(await ev(`localStorage.getItem('slimeSummonerSave')`));
    const progressKeys = after2.progress ? Object.keys(after2.progress).sort().join(',') : '';
    check('旧档读入后 progress 五个子表可正常补齐', ['abyssClears','challengeClears','claimed','collected','regions'].every(k => after2.progress && after2.progress[k]), progressKeys);
    check('迁移写入一次性升级前备份', !!backupRaw, backupRaw ? backupRaw.length + ' 字节' : '缺失');
    check('升级前备份内容 = 迁移前的旧档原文', backupRaw === legacyBytes, { same: backupRaw === legacyBytes });
    check('顶栏显示迁移后的金币（界面已生效）', /77[\s,]?777/.test(hud || ''), hud);

    /* ③ 坏档：必须停写并提示，且不能覆盖原始字节 */
    await reloadWithStorage('{broken json');
    const protectText = await ev(`(() => { const b = document.body.innerText || ''; const i = b.indexOf('存档保护'); return i >= 0 ? b.slice(i, i + 120) : ''; })()`);
    const stillBroken = await ev(`localStorage.getItem('slimeSummonerSave')`);
    check('坏档触发「存档保护」弹窗并停写', protectText.includes('无法安全读取'), protectText);
    check('坏档原始字节未被空白进度覆盖', stillBroken === '{broken json', stillBroken);
    check('坏档时给出「清除损坏存档并重新开始」入口，且不再有导出/导入按钮', await ev(`(() => { const b = document.body.innerText || ''; return /清除损坏存档并重新开始/.test(b) && !!document.querySelector('[data-act="resetSave"]') && !document.querySelector('[data-act="exportSave"],[data-act="importSave"]'); })()`));

    /* ④ 自救入口：真点「清除损坏存档并重新开始」（confirm 会弹真弹窗，这里替换成总是同意，其余走真实点击） */
    await ev(`window.confirm = () => true; true`);
    await ev(`document.querySelector('[data-act="resetSave"]').click(); true`);
    await sleep(1500);
    const afterReset = await waitFor(() => ev(`localStorage.getItem('slimeSummonerSave') === null && !!(document.querySelector('#storyScreen') && !document.querySelector('#storyScreen').classList.contains('hidden'))`), 10000);
    check('点「清除损坏存档并重新开始」会清掉坏档并回到开场', !!afterReset, await ev(`({ key: localStorage.getItem('slimeSummonerSave'), storyShown: !!(document.querySelector('#storyScreen') && !document.querySelector('#storyScreen').classList.contains('hidden')) })`));

    /* ⑤ 清掉之后真实玩法可用：走完开场 → 重新写入 v2 存档 */
    await ev('finishStory()');  /* 等价于走完开场剧本：同一 finishStory→save 路径 */
    await sleep(1200);
    const recovered = await ev(`localStorage.getItem('slimeSummonerSave')`);
    check('清除坏档后可重新开局并恢复写入', !!recovered && Number(JSON.parse(recovered).saveVersion) === 2);
  } finally {
    if (client) client.close();
    try { proc.kill(); } catch {}
    await sleep(300);
    try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {}
  }
  const pass = results.filter(r => r.status === 'PASS').length;
  report.pass = pass; report.total = results.length;
  fs.writeFileSync(path.join(__dirname, 'migration-report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nRESULT ${pass}/${results.length} passed → tools/out/migration-report.json`);
  process.exitCode = pass === results.length ? 0 : 1;
})();
