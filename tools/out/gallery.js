/* 角色画廊截图：史莱姆.html?gallery=1，等 document.title 变成 GALLERY 后截图。跨平台替代 tools/selftest.ps1 -Mode gallery
   用法：node tools/out/gallery.js [tag] [宽] [高]
   产物：tools/out/gallery[-tag].png */
'use strict';
const path = require('node:path');
const { launch, sleep, waitFor, fileUrl } = require('./lib/cdp.js');

const ROOT = path.resolve(__dirname, '..', '..');
const tag = process.argv[2] || '';
// 画廊默认 780 宽，一行能排下 6 个格子，与 selftest.ps1 一致
const width = Number(process.argv[3]) || 780;
const height = Number(process.argv[4]) || 844;
const out = path.join(__dirname, 'gallery' + (tag ? '-' + tag : '') + '.png');

(async () => {
  const c = await launch({ url: fileUrl(path.join(ROOT, '史莱姆.html'), '?gallery=1'), width, height, dpr: 1 });
  try {
    if (!await waitFor(() => c.ev('document.title === "GALLERY"'), 20000)) throw new Error('画廊没有渲染完成（document.title 不是 GALLERY）');
    await sleep(800); // 让呼吸、浮动等入场动画走到稳定帧
    console.log('SCREENSHOT ' + await c.shot(out));
  } catch (e) {
    console.log('ERR ' + (e && e.message || e));
    process.exitCode = 1;
  } finally { await c.close(); }
})();
