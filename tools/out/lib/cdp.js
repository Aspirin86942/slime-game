/* 极简 CDP 工具：启动 headless Chrome、连接页面、事件订阅、求值、截图、触摸。 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

/* 浏览器路径：环境变量 CHROME_PATH 优先；否则按系统查常见安装位置，Linux/macOS 再到 PATH 里找 */
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const winRoots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const fixed = {
    win32: [
      ...winRoots.map(d => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe')),
      ...winRoots.map(d => path.join(d, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    ]
  }[process.platform] || [];
  const hit = fixed.find(p => fs.existsSync(p));
  if (hit) return hit;
  if (process.platform !== 'win32') {
    const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      const found = dirs.map(d => path.join(d, name)).find(p => fs.existsSync(p));
      if (found) return found;
    }
  }
  throw new Error('找不到 Chrome / Edge / Chromium，请安装浏览器或用环境变量 CHROME_PATH 指定可执行文件路径');
}
const CHROME = findChrome();

/* 本地文件 → file:// 地址。pathToFileURL 在 Windows 和 Linux 上都给出合法地址（盘符、斜杠、中文都会正确转写） */
const fileUrl = (file, query = '') => pathToFileURL(file).href + query;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(fn, timeoutMs, stepMs) {
  const t0 = Date.now();
  for (;;) {
    let v;
    try { v = await fn(); } catch { v = null; }
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) return null;
    await sleep(stepMs || 100);
  }
}

function makeClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  const handlers = new Map();
  ws.addEventListener('message', ev => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      return;
    }
    if (msg.method) {
      const list = handlers.get(msg.method) || [];
      list.forEach(h => { try { h(msg.params); } catch {} });
    }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', () => res()); ws.addEventListener('error', () => rej(new Error('ws error'))); }),
    send(method, params) {
      const id = ++seq;
      return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params: params || {} })); });
    },
    on(method, handler) { const list = handlers.get(method) || []; list.push(handler); handlers.set(method, list); },
    close() { try { ws.close(); } catch {} }
  };
}

async function launch({ url, width = 390, height = 844, dpr = 3, touchEnabled = false, downloadDir = null, downloadEvents = false, gpu = false }) {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slime-cdp-'));
  const proc = spawn(CHROME, ['--headless=new', ...(gpu ? [] : ['--disable-gpu']), '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--user-data-dir=' + userDir, `--window-size=${width},${height}`, 'about:blank'], { stdio: 'ignore' });
  const portFile = path.join(userDir, 'DevToolsActivePort');
  const port = await waitFor(() => fs.existsSync(portFile) ? fs.readFileSync(portFile, 'utf8').split('\n')[0].trim() : null, 20000);
  if (!port) throw new Error('没有拿到 DevToolsActivePort');
  const target = await (await fetch('http://127.0.0.1:' + port + '/json/new?' + encodeURIComponent(url), { method: 'PUT' })).json();
  const client = makeClient(target.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Runtime.enable');
  await client.send('Page.enable');
  await client.send('DOM.enable');
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: true, screenWidth: width, screenHeight: height });
  if (touchEnabled) await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  if (downloadDir) {
    try { await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: !!downloadEvents }); }
    catch { await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir }); }
  }

  const ev = async expr => {
    const r = await client.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      const d = (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text || '';
      throw new Error('eval: ' + d.split('\n')[0] + '  <<' + expr.replace(/\s+/g, ' ').slice(0, 90) + '>>');
    }
    return r.result.value;
  };
  const shot = async file => {
    const r = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  };
  const touch = {
    async start(x, y) { await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 3, radiusY: 3, force: 1 }] }); },
    async move(x, y) { await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1, radiusX: 3, radiusY: 3, force: 1 }] }); },
    async end() { await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); },
    async tap(x, y, holdMs) {
      await touch.start(x, y);
      await sleep(holdMs || 40);
      await touch.end();
    },
    async drag(from, to, steps) {
      const n = steps || 12;
      await touch.start(from.x, from.y);
      await sleep(30);
      for (let i = 1; i <= n; i++) {
        await touch.move(from.x + (to.x - from.x) * i / n, from.y + (to.y - from.y) * i / n);
        await sleep(16);
      }
      await sleep(30);
      await touch.end();
    }
  };
  const close = async () => {
    client.close();
    try { proc.kill(); } catch {}
    await sleep(300);
    try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {}
  };
  return { client, ev, shot, touch, close, userDir, port };
}

function center(rect) { return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; }

function report(dir, name, data) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  return file;
}

function makeChecker(list) {
  return (name, ok, detail) => {
    list.push({ name, status: ok ? 'PASS' : 'FAIL', detail: detail === undefined ? '' : detail });
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  → ' + (typeof detail === 'string' ? detail : JSON.stringify(detail))));
    return ok;
  };
}

module.exports = { launch, sleep, waitFor, center, report, makeChecker, CHROME, fileUrl };
