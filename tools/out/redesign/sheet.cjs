// 把一组截图拼成一张对照图。用法：node tools/out/redesign/sheet.cjs <dir> <out.png> name1,name2,...
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { launch, sleep, fileUrl } = require('../lib/cdp.js');
const [dir, out, list] = process.argv.slice(2);
const names = list.split(',');
const cols = Math.min(4, names.length);
const html = `<!doctype html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},390px);gap:6px;padding:6px;font:12px sans-serif;color:#ccc">${names.map(n => `<figure style="margin:0"><img src="${fileUrl(path.resolve(dir, n + '.png'))}" style="width:390px;display:block"><figcaption>${n}</figcaption></figure>`).join('')}</body>`;
const tmp = path.join(__dirname, '_sheet.html');
fs.writeFileSync(tmp, html);
(async () => {
  const rows = Math.ceil(names.length / cols);
  const p = await launch({ url: fileUrl(tmp), width: cols * 396 + 6, height: rows * 870 + 6, dpr: 1 });
  await sleep(800);
  await p.shot(path.resolve(out));
  await p.close();
  console.log(out);
})();
