/* 帧率测试驱动：用 Chrome DevTools 协议在真实时间里跑战斗，对比「开特效 / 关特效」同一场景。
   页面侧实现见 史莱姆.html 自检段里的 `?fps=1`（关特效加 `&fx=off`）。
   用法：node tools/out/fps.js [每配置重复次数，默认 3] */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, '史莱姆.html');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const REPEAT = Math.max(1, parseInt(process.argv[2] || '3', 10));

const CONFIGS = [
  { label: 'fx-on',  qs: 'fps=1' },
  { label: 'fx-off', qs: 'fps=1&fx=off' }
];

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
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', () => reject(new Error('ws error')));
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

async function measure(qs) {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slime-fps-'));
  const proc = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    '--user-data-dir=' + userDir,
    '--window-size=480,900',
    'about:blank'
  ], { stdio: 'ignore' });

  let client = null;
  try {
    const portFile = path.join(userDir, 'DevToolsActivePort');
    const port = await waitFor(() => fs.existsSync(portFile) ? fs.readFileSync(portFile, 'utf8').split('\n')[0].trim() : null, 20000, 100);
    if (!port) throw new Error('没有拿到 DevToolsActivePort');

    const url = 'file:///' + GAME.replace(/\\/g, '/') + '?' + qs;
    const res = await fetch('http://127.0.0.1:' + port + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
    const target = await res.json();
    if (!target.webSocketDebuggerUrl) throw new Error('新标签没有 ws 地址');

    client = cdpClient(target.webSocketDebuggerUrl);
    await client.ready;
    await client.send('Runtime.enable');

    const ready = await waitFor(async () => {
      const r = await client.send('Runtime.evaluate', { expression: 'typeof window.__FPS__', returnByValue: true });
      return r.result && r.result.value === 'object';
    }, 20000, 100);
    if (!ready) throw new Error('页面没有挂上 __FPS__');

    const r = await client.send('Runtime.evaluate', {
      expression: 'window.__FPS__.then(function(x){ return JSON.stringify(x); })',
      awaitPromise: true,
      returnByValue: true
    });
    if (!r.result || typeof r.result.value !== 'string') throw new Error('采样结果不是字符串');
    const data = JSON.parse(r.result.value);
    if (data.error) throw new Error('页面报错: ' + data.error);
    return data;
  } finally {
    if (client) client.close();
    try { proc.kill(); } catch {}
    await sleep(300);
    try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {}
  }
}

function median(list) {
  const s = list.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : +((s[m - 1] + s[m]) / 2).toFixed(1);
}

(async () => {
  const out = {};
  for (const cfg of CONFIGS) {
    const runs = [];
    for (let i = 0; i < REPEAT; i++) {
      process.stdout.write(`  ${cfg.label} 第 ${i + 1}/${REPEAT} 轮…\n`);
      try { runs.push(await measure(cfg.qs)); }
      catch (e) { console.log(`  ${cfg.label} 第 ${i + 1} 轮失败: ${e.message}`); }
    }
    if (!runs.length) { out[cfg.label] = null; continue; }
    const stressRuns = runs.map(r => r.stress).filter(Boolean);
    out[cfg.label] = {
      runs,
      fps: median(runs.map(r => r.battle.fps)),
      avgMs: median(runs.map(r => r.battle.avgMs)),
      p95Ms: median(runs.map(r => r.battle.p95Ms)),
      maxMs: Math.max(...runs.map(r => r.battle.maxMs)),
      longPct: median(runs.map(r => r.battle.longPct)),
      frames: median(runs.map(r => r.battle.frames)),
      fxLog: runs[0].fxLog,
      units: runs[0].units,
      nodes: runs[0].nodes,
      stressFps: stressRuns.length ? median(stressRuns.map(s => s.fps)) : null,
      stressP95: stressRuns.length ? median(stressRuns.map(s => s.p95Ms)) : null,
      stressFloatNodes: stressRuns.length ? Math.max(...stressRuns.map(s => s.floatNodes)) : null,
      stressPartNodes: stressRuns.length ? Math.max(...stressRuns.map(s => s.partNodes)) : null
    };
  }

  console.log('\n===== 帧率测试（480x900 headless，实际时间，10 倍速自动战斗，6 秒采样，取中位数）=====');
  for (const cfg of CONFIGS) {
    const s = out[cfg.label];
    if (!s) { console.log(`${cfg.label.padEnd(7)} 无数据`); continue; }
    console.log(`${cfg.label.padEnd(7)} 战斗 fps=${String(s.fps).padStart(5)}  avg=${String(s.avgMs).padStart(6)}ms  p95=${String(s.p95Ms).padStart(6)}ms  max=${String(s.maxMs).padStart(7)}ms  长帧(>33ms)=${s.longPct}%  帧数=${s.frames}  单位=${s.units}  FX日志=${s.fxLog}`);
    if (s.stressFps) console.log(`${''.padEnd(7)} 压力 fps=${s.stressFps}  p95=${s.stressP95}ms（每帧 12 条飘字 + 闪白 + 爆散 + 震屏，飘字节点峰值 ${s.stressFloatNodes}，粒子峰值 ${s.stressPartNodes}）`);
  }

  const on = out['fx-on'], off = out['fx-off'];
  if (on && off) {
    const cost = ((off.fps - on.fps) / off.fps) * 100;
    console.log(`\n特效开销：关特效 ${off.fps} fps → 开特效 ${on.fps} fps（${cost >= 0 ? '下降' : '提升'} ${Math.abs(cost).toFixed(1)}%）`);
    console.log(`p95 帧耗时：${off.p95Ms}ms → ${on.p95Ms}ms`);
  }
  const ok = !!(on && off && on.fps >= 50 && off.fps >= 50 && (!on.stressFps || on.stressFps >= 30));
  console.log(`判定：${ok ? 'PASS' : 'FAIL'}（要求开/关特效都 ≥50fps，压力场景 ≥30fps）`);
  fs.writeFileSync(path.join(__dirname, 'fps-result.json'), JSON.stringify({ when: new Date().toISOString(), out }, null, 2), 'utf8');
  process.exit(ok ? 0 : 1);
})();
