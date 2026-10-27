/* 升级版界面截图 + 布局体检：专门拍这次升级新增/改动的界面。
   用法：node tools/out/upgrade-shots.js [tag]  → tools/out/shots/up-<tag>-<screen>.png
   注意：新版本在诊断模式下禁止写存档（保护玩家真实进度），所以这里全部用内存夹具，
   不再像 shots.js 那样靠 reload 让顶栏重新渲染——顶栏用 renderTop() 直接刷新。 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, '史莱姆.html');
const { CHROME, fileUrl } = require('./lib/cdp.js');
const TAG = process.argv[2] || 'shot';
const OUT_DIR = path.join(__dirname, 'shots');
const VW = 390, VH = 844, DPR = 3;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(fn, timeoutMs, stepMs) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) return null;
    await sleep(stepMs || 100);
  }
}

function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', ev => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', () => res());
    ws.addEventListener('error', () => rej(new Error('ws error')));
  });
  return {
    ready,
    send(method, params) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
      });
    },
    close() { try { ws.close(); } catch {} }
  };
}

/* 中期玩家夹具：5 只伙伴（亲密度跨 4 个里程碑）、2 只派遣中、目标进度不完整 */
const SETUP_JS = `(() => {
  const T = window.__TEST__;
  if(!T) return 'no __TEST__';
  const S = T.S;
  T.startBattle({ elements:['岩','火','水','风','草'], level:20, monsterLevel:20, speed:1 });
  const names = ['小石头','赤焰','涌泉','疾风','青藤'];
  const bond   = [34, 17, 6, 32, 2];
  S.slimes.forEach((s,i) => {
    s.name = names[i] || s.name;
    s.level = 20 + i;
    s.mood = 82;
    s.intimacy = bond[i] || 0;
    s.locked = i === 2;
  });
  S.monsters = [];
  S.started = true;
  S.name = '星野';
  S.level = 30;
  S.summonerExp = 46;
  S.coins = 28640;
  S.points = 1260;
  S.abyssLevel = 14;
  S.abyssUnlocked = 14;
  S.bag = { food:12, treasure:3, ticket:5, expPotion:2, net:4 };
  S.progress = {
    abyssClears: { '3':true, '7':true, '14':true },
    challengeClears: { shield:true },
    regions: { grass:3, dusk:1 },
    collected: {},
    claimed: {}
  };
  /* 两只伙伴派遣中，一只正在休息，验证陪伴首页的派遣摘要与恢复进度 */
  S.globalPlan = 'explore';
  S.slimes[1].resting = true;
  S.slimes[1].stamina = 12;
  S.slimes[1].mood = 44;
  try { if(T._battle && T._battle.closeBattle) T._battle.closeBattle(); } catch(e) {}
  document.querySelectorAll('#gameOverlay').forEach(o => o.remove());
  document.querySelector('#storyScreen').classList.add('hidden');
  document.querySelector('#gameScreen').classList.remove('hidden');
  renderTop(); renderTab();
  return 'ok slimes=' + S.slimes.length;
})()`;

const METRICS_JS = `(() => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const scrollable = el => {
    let p = el.parentElement;
    while(p && p !== document.body){
      const cs = getComputedStyle(p);
      if(/auto|scroll/.test(cs.overflowX) || /auto|scroll/.test(cs.overflow)) return true;
      p = p.parentElement;
    }
    return false;
  };
  const bad = [];
  const skipClass = /(^|\\s)(fx-part|fx-float|mark|halo|shadow|blob|eye|eyes|breath|anim|orb|ring|part|bg-star|pl-slime|sys-bubble|bond-badge)(\\s|$)/;
  document.querySelectorAll('#app *').forEach(el => {
    const cs = getComputedStyle(el);
    if(cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
    if(skipClass.test(el.className || '')) return;
    const r = el.getBoundingClientRect();
    if(r.width < 1 || r.height < 1) return;
    if(r.right > vw + 1.5 || r.left < -1.5){
      if(scrollable(el)) return;
      bad.push({ cls: (el.className || el.tagName).toString().slice(0, 40), left: Math.round(r.left), right: Math.round(r.right) });
    }
  });
  const textClip = [];
  document.querySelectorAll('#content *, .game-hud *, .topbar *, #modalBox *').forEach(el => {
    if(el.children.length) return;
    const t = (el.textContent || '').trim();
    if(!t) return;
    /* 纯 emoji / 纯符号图标不算文字被裁（字形高度天然超出行盒 1~2px） */
    if(!/[\\u3400-\\u9fffA-Za-z0-9]/.test(t)) return;
    /* 行高为小数时行盒会取整，scrollHeight 常比 clientHeight 大 1~2px，不算真实裁切 */
    /* 用文字自身的外接盒判断是否被裁：scrollHeight 会把装饰性 ::after 箭头（绝对定位在盒外）也算进去 */
    if(/auto|scroll/.test(getComputedStyle(el).overflowX) || /auto|scroll/.test(getComputedStyle(el.parentElement || el).overflowX)) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const tb = range.getBoundingClientRect(), eb = el.getBoundingClientRect();
    if(tb.width > 0 && (tb.right > eb.right + 1.5 || tb.bottom > eb.bottom + 1.5 || tb.left < eb.left - 1.5 || tb.top < eb.top - 1.5)){
      textClip.push({ cls: (el.className || el.tagName).toString().slice(0, 30), text: t.slice(0, 18), sw: el.scrollWidth, cw: el.clientWidth });
    }
  });
  const cs = getComputedStyle(document.querySelector('#content'));
  return JSON.stringify({
    vw, vh,
    docOverflowX: document.documentElement.scrollWidth - vw,
    docOverflowY: document.documentElement.scrollHeight - vh,
    contentScrollable: /auto|scroll/.test(cs.overflowY),
    bad: bad.slice(0, 14),
    textClip: textClip.slice(0, 14)
  });
})()`;

const SCREENS = [
  { name: '01-home', expr: `(() => {
      document.querySelector('.tabbar button[data-tab="space"]').click();
      const c = document.getElementById('content'); c.scrollTop = 0;
      return 'home';
    })()`, wait: 1600 },
  { name: '02-travel-scene', expr: `(() => {
      document.querySelector('.tabbar button[data-tab="travel"]').click();
      const c = document.getElementById('content'); c.scrollTop = 0;
      return 'travel';
    })()`, wait: 900 },
  { name: '03-travel-goals', expr: `(() => {
      const c = document.getElementById('content');
      const goals = [...c.querySelectorAll('.panel h3')].find(h => h.textContent.includes('旅途目标'));
      if(goals) goals.closest('.panel').scrollIntoView({ block: 'start' });
      return goals ? 'scrolled' : 'no goals panel';
    })()`, wait: 700 },
  { name: '04-travel-classes', expr: `(() => {
      const c = document.getElementById('content');
      const cls = [...c.querySelectorAll('.panel h3')].find(h => h.textContent.includes('战斗课堂'));
      if(cls) cls.closest('.panel').scrollIntoView({ block: 'start' });
      return cls ? 'scrolled' : 'no class panel';
    })()`, wait: 700 },
  { name: '05-settings', expr: `(() => {
      document.querySelector('#gameScreen .settings-trigger').click();
      return 'settings';
    })()`, wait: 700 },
  { name: '06-detail-bond', expr: `(() => {
      document.querySelector('#modalLayer [data-act="close"]').click();
      const T = window.__TEST__;
      openDetail(T.S.slimes[0].id);
      return 'detail';
    })()`, wait: 700 },
  { name: '07-merge-preview', expr: `(() => {
      document.querySelectorAll('#modalLayer [data-act="close"]').forEach(b => b.click());
      const T = window.__TEST__;
      openMerge();
      toggleMergeSel(T.S.slimes[0].id);
      toggleMergeSel(T.S.slimes[3].id);
      const el = document.getElementById('mergePreview');
      if(el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
      return 'sel=' + mergeSel.join(',') + ' preview=' + (el ? el.textContent.slice(0, 60) : 'none');
    })()`, wait: 900 },
  { name: '08-merge-locked-block', expr: `(() => {
      document.querySelectorAll('#modalLayer [data-act="close"]').forEach(b => b.click());
      const T = window.__TEST__;
      openMerge();
      toggleMergeSel(T.S.slimes[0].id);
      const before = mergeSel.slice();
      toggleMergeSel(T.S.slimes[2].id);   /* 第 3 只是珍爱锁定的副宠，应被拒 */
      const toastText = (document.querySelector('.toast, #toast, .toast-wrap') || {}).textContent || '';
      const el = document.getElementById('mergePreview');
      if(el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
      return 'before=' + before.join(',') + ' after=' + mergeSel.join(',') + ' toast=' + toastText.slice(0, 30);
    })()`, wait: 800 },
  { name: '09-training-shield', expr: `(() => {
      document.querySelectorAll('#modalLayer [data-act="close"]').forEach(b => b.click());
      const T = window.__TEST__;
      openAbyssSetup && null;
      startTrainingChallenge('shield');
      const b = T._battle;
      if(b){ clearInterval(b.B.timer); b.nextTurn(); }
      return 'shield';
    })()`, wait: 2200 },
  { name: '10-training-control', expr: `(() => {
      const T = window.__TEST__;
      try { if(T._battle && T._battle.closeBattle) T._battle.closeBattle(); } catch(e) {}
      document.querySelectorAll('#gameOverlay').forEach(o => o.remove());
      startTrainingChallenge('control');
      const b = T._battle;
      if(b){ clearInterval(b.B.timer); b.nextTurn(); }
      return 'control';
    })()`, wait: 2200 },
  { name: '11-battle-intents', expr: `(() => {
      const T = window.__TEST__;
      try { if(T._battle && T._battle.closeBattle) T._battle.closeBattle(); } catch(e) {}
      document.querySelectorAll('#gameOverlay').forEach(o => o.remove());
      /* 派遣中的伙伴不能出战，先全部召回 */
      T.S.globalPlan = null;
      T.S.customPlans = {};
      T.S.slimes.forEach(s => { s.resting = false; s.stamina = 120; s.mood = 90; });
      renderTab();
      T.S.battleMode = 'interject';
      T.startBattle({ elements:['岩','火','水','风','草'], level:20, monsterLevel:20, speed:10 });
      const b = T._battle;
      if(!b) return 'no battle overlay';
      clearInterval(b.B.timer);
      b.nextTurn();
      const alive = T.S.slimes.filter(s=>s.hp>0).length;
      return 'overlay=' + !!document.getElementById('gameOverlay') + ' alive=' + alive + ' mode=' + T.S.battleMode;
    })()`, wait: 2400 },
  { name: '12-abyss-locked', expr: `(() => {
      const T = window.__TEST__;
      try { if(T._battle && T._battle.closeBattle) T._battle.closeBattle(); } catch(e) {}
      document.querySelectorAll('#gameOverlay').forEach(o => o.remove());
      /* 重新固定解锁进度：前面的战斗夹具会把 abyssLevel/abyssUnlocked 顶高 */
      T.S.abyssUnlocked = 14;
      T.S.abyssLevel = 14;
      document.querySelector('.tabbar button[data-tab="travel"]').click();
      const inp = document.getElementById('abyssLevelInput');
      if(inp){
        /* 点两次「下一层」，确认上界卡在已解锁层数 */
        const plus = document.querySelector('[data-act="abyssLevelPlus"]');
        if(plus){ plus.click(); plus.click(); }
      }
      const box = inp ? inp.closest('.panel') : null;
      if(box) box.scrollIntoView({ block: 'center' });
      const hint = box ? box.textContent.match(/已解锁\\s*\\d+\\/50\\s*层/) : null;
      return inp ? 'max=' + inp.max + ' value=' + inp.value + ' hint=' + (hint ? hint[0] : 'none') : 'no input';
    })()`, wait: 900 }
];

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slime-up-'));
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--user-data-dir=' + userDir, `--window-size=${VW},${VH}`, 'about:blank'
  ], { stdio: 'ignore' });

  let client = null;
  const report = { when: new Date().toISOString(), tag: TAG, game: GAME, viewport: { w: VW, h: VH, dpr: DPR }, screens: [] };
  try {
    const portFile = path.join(userDir, 'DevToolsActivePort');
    const port = await waitFor(() => fs.existsSync(portFile) ? fs.readFileSync(portFile, 'utf8').split('\n')[0].trim() : null, 20000, 100);
    if (!port) throw new Error('没有拿到 DevToolsActivePort');

    const url = fileUrl(GAME) + '?battle=ui';
    const res = await fetch('http://127.0.0.1:' + port + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
    const target = await res.json();
    client = cdpClient(target.webSocketDebuggerUrl);
    await client.ready;
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: VW, height: VH, deviceScaleFactor: DPR, mobile: true,
      screenWidth: VW, screenHeight: VH
    });
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

    const ready = await waitFor(async () => {
      const r = await client.send('Runtime.evaluate', { expression: 'typeof window.__TEST__', returnByValue: true });
      return r.result && r.result.value === 'object';
    }, 20000, 100);
    if (!ready) throw new Error('页面没有挂上 __TEST__');

    const setup = await client.send('Runtime.evaluate', { expression: SETUP_JS, returnByValue: true, awaitPromise: true });
    console.log('setup:', setup.result && setup.result.value);
    await sleep(500);

    for (const sc of SCREENS) {
      const r = await client.send('Runtime.evaluate', { expression: sc.expr, returnByValue: true, awaitPromise: true });
      let ret = (r.result && r.result.value) || '';
      if (r.exceptionDetails) {
        const d = (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text || '';
        ret = 'ERR ' + d.split('\n').slice(0, 4).join(' | ');
      }
      await sleep(sc.wait || 600);
      const shot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const file = path.join(OUT_DIR, `up-${TAG}-${sc.name}.png`);
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      const m = await client.send('Runtime.evaluate', { expression: METRICS_JS, returnByValue: true });
      let metrics = null;
      try { metrics = JSON.parse(m.result.value); } catch {}
      report.screens.push({ name: sc.name, file, returned: String(ret), metrics });
      const flag = metrics ? `溢出元素 ${metrics.bad.length}，被裁文字 ${metrics.textClip.length}，docX ${metrics.docOverflowX}` : '度量失败';
      console.log(`  ${sc.name.padEnd(22)} ${flag}  [${ret}]`);
      if (metrics && metrics.bad.length) console.log('    溢出:', JSON.stringify(metrics.bad));
      if (metrics && metrics.textClip.length) console.log('    被裁:', JSON.stringify(metrics.textClip));
    }
  } finally {
    if (client) client.close();
    try { proc.kill(); } catch {}
    await sleep(300);
    try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {}
  }
  fs.writeFileSync(path.join(__dirname, `upgrade-report-${TAG}.json`), JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n报告：tools/out/upgrade-report-${TAG}.json`);
})();
