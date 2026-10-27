/* 手机视口截图 + 布局体检：用 CDP 把页面按 390x844 / DPR3 渲染，逐个界面截图，
   同时抓「横向溢出 / 内容溢出容器 / 文字被裁」三类布局问题。
   用法：node tools/out/shots.js [tag]   → tools/out/shots/<tag>-<screen>.png */
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

/* 造一个「中期玩家」的存档：五只史莱姆 + 资源 + 深渊层数，靠测试钩子生成真实对象 */
const SETUP_JS = `(() => {
  const T = window.__TEST__;
  if(!T) return 'no __TEST__';
  const S = T.S;
  T.startBattle({ elements:['岩','火','水','风','草'], level:20, monsterLevel:20, speed:1 });
  const names = ['小石头','赤焰','涌泉','疾风','青藤'];
  S.slimes.forEach((s,i) => { s.name = names[i] || s.name; s.level = 20 + i; s.mood = 'happy'; s.intimacy = 30 + i*7; });
  /* 资源要在 closeBattle 之前写好：closeBattle 会 save()，之后改的字段不会入库 */
  S.level = 30;
  S.summonerExp = 46;
  S.coins = 28640;
  S.points = 1260;
  S.abyssLevel = 14;
  S.bag = { food:12, treasure:3, ticket:5, expPotion:2, net:4 };
  try { if(T._battle && T._battle.closeBattle) T._battle.closeBattle(); } catch(e) {}
  document.querySelectorAll('#gameOverlay').forEach(o => o.remove());
  document.querySelector('.tabbar button[data-tab="status"]').click();
  return 'ok overlayGone=' + !document.querySelector('#gameOverlay');
})()`;

const RENAME_JS = `(() => {
  const T = window.__TEST__;
  const names = ['小石头','赤焰','涌泉','疾风','青藤'];
  if(T && T.S && T.S.slimes) T.S.slimes.forEach((s,i) => { s.name = names[i] || s.name; s.mood = 'happy'; s.intimacy = 30 + i*7; });
  document.querySelectorAll('#gameOverlay').forEach(o => o.remove());
  return 'slimes=' + (T && T.S && T.S.slimes ? T.S.slimes.length : 0);
})()`;

const SCREENS = [
  { name: '01-status', expr: `document.querySelector('.tabbar button[data-tab="status"]').click()`, wait: 500 },
  { name: '02-summon', expr: `document.querySelector('.tabbar button[data-tab="summon"]').click()`, wait: 500 },
  { name: '03-travel', expr: `document.querySelector('.tabbar button[data-tab="travel"]').click()`, wait: 700 },
  { name: '04-space', expr: `document.querySelector('.tabbar button[data-tab="space"]').click()`, wait: 1400 },
  { name: '05-bag', expr: `document.querySelector('.tabbar button[data-tab="bag"]').click()`, wait: 500 },
  { name: '06-battle-interject', expr: `(() => {
      const T = window.__TEST__;
      try { if(T._battle && T._battle.closeBattle) T._battle.closeBattle(); } catch(e) {}
      document.querySelectorAll('#gameOverlay').forEach(o => o.remove());
      T.S.battleMode = 'interject';
      T.startBattle({ elements:['岩','火','水','风','草'], level:20, monsterLevel:20, speed:1 }); const b = T._battle;
      T.S.slimes.forEach((s,i) => { s.name = ['小石头','赤焰','涌泉','疾风','青藤'][i] || s.name; });
      b.refreshBars();
      b.renderSkillBar();
      const u = document.querySelector('#skillBar .sk-unit'); if(u) u.click();
      return 'ok';
    })()`, wait: 1500 },
  { name: '07-battle-step', expr: `(() => {
      const T = window.__TEST__;
      try { if(T._battle && T._battle.closeBattle) T._battle.closeBattle(); } catch(e) {}
      document.querySelectorAll('#gameOverlay').forEach(o => o.remove());
      T.S.battleMode = 'step';
      T.startBattle({ elements:['岩','火','水','风','草'], level:20, monsterLevel:20, speed:10 }); const b = T._battle;
      T.S.slimes.forEach((s,i) => { s.name = ['小石头','赤焰','涌泉','疾风','青藤'][i] || s.name; });
      b.refreshBars();
      clearInterval(b.B.timer);
      b.nextTurn();
      return 'ok';
    })()`, wait: 1500 },
  { name: '08-battle-dead', expr: `(() => {
      const T = window.__TEST__;
      try { if(T._battle && T._battle.closeBattle) T._battle.closeBattle(); } catch(e) {}
      document.querySelectorAll('#gameOverlay').forEach(o => o.remove());
      T.S.battleMode = 'interject';
      T.startBattle({ elements:['岩','火','水','风','草'], level:20, monsterLevel:20, speed:10 }); const b = T._battle;
      T.S.slimes.forEach((s,i) => { s.name = ['小石头','赤焰','涌泉','疾风','青藤'][i] || s.name; });
      b.refreshBars();
      clearInterval(b.B.timer);
      /* 让两只己方与一只敌方阵亡，检查阵亡标记是否清楚 */
      [1,3].forEach(i => { const u = b.B.allies[i]; if(!u) return; u.hp = 0; b.handleUnitDeath(u, 'ally'); });
      const m = b.B.monsters[0];
      if(m){ m.hp = 0; m.st.timeRevive = false; b.handleUnitDeath(m, 'enemy'); }
      b.refreshBars();
      b.renderSkillBar();
      return 'ok';
    })()`, wait: 1200 },
  { name: '09-abyss-setup', expr: `(() => {
      const T = window.__TEST__;
      try { if(T._battle && T._battle.closeBattle) T._battle.closeBattle(); } catch(e) {}
      document.querySelectorAll('#gameOverlay').forEach(o => o.remove());
      T.S.slimes.forEach((s,i) => { s.name = ['小石头','赤焰','涌泉','疾风','青藤'][i] || s.name; });
      T.S.lastAbyssSel = T.S.slimes.slice(0,2).map(s => s.id);
      openAbyssSetup();
      return 'ok';
    })()`, wait: 800 },
  { name: '10-battle-lose', expr: `(() => {
      const T = window.__TEST__;
      try { if(T._battle && T._battle.closeBattle) T._battle.closeBattle(); } catch(e) {}
      document.querySelectorAll('#gameOverlay').forEach(o => o.remove());
      T.S.battleMode = 'interject';
      T.startBattle({ elements:['岩','火','水','风','草'], level:20, monsterLevel:20, speed:10 }); const b = T._battle;
      T.S.slimes.forEach((s,i) => { s.name = ['小石头','赤焰','涌泉','疾风','青藤'][i] || s.name; });
      clearInterval(b.B.timer);
      const allies = b.B.allies;
      allies.forEach((u, i) => { if(i < allies.length - 1){ u.hp = 0; b.handleUnitDeath(u, 'ally'); } });
      b.refreshBars();
      const last = allies[allies.length - 1];
      last.hp = 0; b.handleUnitDeath(last, 'ally');
      b.endBattle(false);
      return 'ok';
    })()`, wait: 1100 },
  { name: '11-battle-lose-late', expr: `'ok'`, wait: 900 },
  { name: '12-battle-win', expr: `(() => {
      const T = window.__TEST__;
      try { if(T._battle && T._battle.closeBattle) T._battle.closeBattle(); } catch(e) {}
      document.querySelectorAll('#gameOverlay').forEach(o => o.remove());
      T.S.battleMode = 'interject';
      T.startBattle({ elements:['岩','火','水','风'], level:20, monsterLevel:20, speed:10 }); const b = T._battle;
      T.S.slimes.forEach((s,i) => { s.name = ['小石头','赤焰','涌泉','疾风','青藤'][i] || s.name; });
      clearInterval(b.B.timer);
      b.B.monsters.forEach(m => { m.hp = 0; m.st.rockArmor = 0; m.st.iceArmor = 0; m.st.timeRevive = false; b.handleUnitDeath(m, 'enemy'); });
      b.endBattle(true);
      return 'ok';
    })()`, wait: 1100 },
  { name: '13-battle-win-late', expr: `'ok'`, wait: 900 }
];

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
  const skipClass = /(^|\\s)(fx-part|fx-float|mark|halo|shadow|blob|eye|eyes|breath|anim|orb|ring|part)(\\s|$)/;
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
  document.querySelectorAll('#content *, .game-hud *, .topbar *').forEach(el => {
    if(el.children.length) return;
    const t = (el.textContent || '').trim();
    if(!t) return;
    if(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1){
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

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slime-shot-'));
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--user-data-dir=' + userDir, `--window-size=${VW},${VH}`, 'about:blank'
  ], { stdio: 'ignore' });

  let client = null;
  const report = { when: new Date().toISOString(), tag: TAG, viewport: { w: VW, h: VH, dpr: DPR }, screens: [] };
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

    /* 夹具写入后再刷新一次：让顶栏（晶币/积分/等级）从存档重新渲染，
       否则截出来的顶栏是初始值、和面板里显示的数字对不上。 */
    await client.send('Page.reload');
    await waitFor(async () => {
      const r = await client.send('Runtime.evaluate', { expression: 'typeof window.__TEST__', returnByValue: true });
      return r.result && r.result.value === 'object';
    }, 20000, 100);
    await sleep(600);
    const rename = await client.send('Runtime.evaluate', { expression: RENAME_JS, returnByValue: true });
    console.log('reload:', rename.result && rename.result.value);

    for (const sc of SCREENS) {
      await client.send('Runtime.evaluate', { expression: sc.expr, returnByValue: true, awaitPromise: true });
      await sleep(sc.wait || 600);
      const shot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const file = path.join(OUT_DIR, `${TAG}-${sc.name}.png`);
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      const m = await client.send('Runtime.evaluate', { expression: METRICS_JS, returnByValue: true });
      let metrics = null;
      try { metrics = JSON.parse(m.result.value); } catch {}
      report.screens.push({ name: sc.name, file, metrics });
      const flag = metrics ? `溢出元素 ${metrics.bad.length}，被裁文字 ${metrics.textClip.length}，docX ${metrics.docOverflowX}` : '度量失败';
      console.log(`  ${sc.name.padEnd(20)} ${flag}`);
      if(sc.name === '07-battle-step'){
        const dbg2 = await client.send('Runtime.evaluate', { expression: `(() => {
          const rows = [];
          document.querySelectorAll('#gameOverlay .battle-unit').forEach(u => {
            const w = u.querySelector('.slime-wrap');
            const cs = w ? getComputedStyle(w) : null;
            rows.push({ name: (u.querySelector('.uname') || {}).textContent, cls: u.className, wrapOutline: cs ? cs.outline : null, wrapShadow: cs ? cs.boxShadow : null, wrapBorder: cs ? cs.border : null });
          });
          const bar = document.querySelector('#skillBar');
          return JSON.stringify({ rows, barScroll: bar ? [bar.scrollLeft, bar.scrollWidth, bar.clientWidth] : null });
        })()`, returnByValue: true });
        console.log('  battle debug:', dbg2.result.value);
      }
      if(sc.name === '06-battle-interject'){
        const dbg3 = await client.send('Runtime.evaluate', { expression: `(() => {
          const bar = document.querySelector('#skillBar');
          return JSON.stringify({ barScroll: bar ? [bar.scrollLeft, bar.scrollWidth, bar.clientWidth] : null, acts: bar ? bar.querySelectorAll('.sk-act').length : 0 });
        })()`, returnByValue: true });
        console.log('  interject debug:', dbg3.result.value);
      }
      if(sc.name === '04-space'){
        const dbg = await client.send('Runtime.evaluate', { expression: `(() => {
          const out = [];
          document.querySelectorAll('#content .pl-slime').forEach(el => {
            const sl = el.querySelector('.slime');
            out.push({ el: sl ? sl.dataset.el : '?', left: el.style.left, top: el.style.top });
          });
          const bubble = document.querySelector('#content .sys-bubble');
          return JSON.stringify({ count: out.length, sprites: out, bubble: bubble ? bubble.textContent.trim() : null, bubbleCls: bubble ? bubble.className : null });
        })()`, returnByValue: true });
        console.log('  space debug:', dbg.result.value);
      }
    }
  } finally {
    if (client) client.close();
    try { proc.kill(); } catch {}
    await sleep(300);
    try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {}
  }
  fs.writeFileSync(path.join(__dirname, `shots-report-${TAG}.json`), JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n报告：tools/out/shots-report-${TAG}.json`);
})();
