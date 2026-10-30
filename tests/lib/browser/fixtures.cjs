// 存档夹具读取与导航前注入脚本生成；读模式只依赖 fs，不启动浏览器。
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SAVE_KEY = 'slimeSummonerSave';
const DEFAULT_DIR = path.join(__dirname, '..', '..', 'fixtures', 'saves');

function dirOf(options = {}) {
  return options.dir || DEFAULT_DIR;
}

// 返回夹具名（去掉 .json），按文件名排序；缺目录时视为空清单。
function list({ dir } = {}) {
  const root = dirOf({ dir });
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => entry.name.slice(0, -'.json'.length))
    .sort();
}

function assertKnown(name, dir) {
  const names = list({ dir });
  if (!names.includes(name)) {
    throw new Error(`未知夹具: ${name}；可用夹具: ${names.join(', ') || '（无）'}`);
  }
}

// 原文读取，保留文件里的字节，便于审查与稳定重生成。
function raw(name, { dir } = {}) {
  assertKnown(name, dir);
  return fs.readFileSync(path.join(dirOf({ dir }), `${name}.json`), 'utf8');
}

// 返回可在 Page.addScriptToEvaluateOnNewDocument 执行的源码：
// 只写正式存档键，不碰 slimeSummonerSave_v* 备份键。
function seedSource(name, { dir } = {}) {
  const json = raw(name, { dir });
  return `try{ localStorage.setItem('${SAVE_KEY}', ${JSON.stringify(json)}); }catch(e){ window.__seedError = String(e); }`;
}

module.exports = { SAVE_KEY, list, raw, seedSource };
