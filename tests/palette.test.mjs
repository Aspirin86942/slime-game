import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const shell = readFileSync(new URL('../src/shell.html', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/world/home.css', import.meta.url), 'utf8');
const THEMES = ['sunset', 'dark', 'light', 'peach', 'mint', 'lavender'];
const TOKENS = ['rock', 'rock-dark', 'rock-light', 'moss', 'spore', 'crystal', 'vein', 'ink', 'paper', 'text', 'muted', 'border'];

// CSS 级联语义：基础 `#app{}` 给全集，主题块只覆写差异。取「生效值」而不是单看主题块。
const baseBlock = (css) => { const m = /#app\{([^}]*)\}/.exec(css); return m ? m[1] : ''; };
const themeBlock = (css, theme) => {
  const m = new RegExp(`#app\\[data-theme="${theme}"\\]\\{([^}]*)\\}`).exec(css);
  return m ? m[1] : '';
};
const decls = text => Object.fromEntries([...text.matchAll(/--([\w-]+)\s*:\s*([^;]+)/g)].map(m => [m[1], m[2].trim()]));
// src/shell.html 的第一个 <style> 是逐字保留的参考版样式表，主题层不许写进去；
// 唯一的主题层在 home.css，构建时注入到 </head> 之前，同权重规则由它胜出。
const effective = (theme) => ({...decls(baseBlock(home)), ...decls(themeBlock(home, theme))});

test('every theme resolves the full --lw-* token set through the cascade', () => {
  for (const theme of THEMES) {
    const vars = effective(theme);
    for (const token of TOKENS) assert.ok(vars[`lw-${token}`], `${theme} resolves no --lw-${token}`);
  }
});

test('legacy theme variables are aliases of --lw-* tokens', () => {
  for (const theme of THEMES) {
    const vars = effective(theme);
    for (const [name, token] of [['accent', 'spore'], ['accent2', 'crystal'], ['text', 'text'], ['muted', 'muted'], ['border', 'border']]) {
      assert.match(vars[name] ?? '', new RegExp(`var\\(--lw-${token}\\)`), `${theme} --${name} must alias --lw-${token}`);
    }
  }
});

test('home surface colour derives from the ink token exactly once', () => {
  assert.match(decls(baseBlock(home))['surface-solid'] ?? '', /var\(--lw-ink\)/, 'base --surface-solid must derive from --lw-ink');
  for (const theme of THEMES) {
    assert.ok(!decls(themeBlock(home, theme))['surface-solid'], `${theme} must not redefine --surface-solid`);
  }
});

test('the six themes keep their ids so existing saves stay valid', () => {
  const ids = [...shell.matchAll(/#app\[data-theme="(\w+)"\]\{/g)].map(m => m[1]);
  for (const theme of THEMES) assert.ok(ids.includes(theme), `theme id ${theme} removed`);
});

test('no dead theme block survives outside the six selectable themes', () => {
  // 参考版样式表里有一份永不可达的 sky 主题块，它必须逐字保留，所以只约束主题层所在的 home.css。
  for (const m of home.matchAll(/#app\[data-theme="(\w+)"\]\{/g)) {
    assert.ok(THEMES.includes(m[1]), `home.css still defines unreachable theme "${m[1]}"`);
  }
});

test('the frozen reference stylesheet stays out of the token layer', () => {
  assert.ok(!/--lw-/.test(shell), 'src/shell.html must stay the verbatim reference; the --lw-* layer belongs in home.css');
});

test('the shared art palette only uses underdark hues', async () => {
  const {PAL} = await import('../src/world/art/kit.ts');
  const hexes = JSON.stringify(PAL).match(/#[0-9a-f]{6}/gi).map(h => h.toLowerCase());
  // 旧暖色板的采样值一个都不能残留。
  for (const warm of ['#b08a66', '#8a6a4f', '#d8b98e', '#efe2c6', '#f6e6bf', '#ffe4a0', '#f5c58d', '#fff6c8', '#c98a6a', '#7fae8c', '#c99a6f']) {
    assert.ok(!hexes.includes(warm), `warm legacy hue ${warm} survived`);
  }
  // 语义槽必须落在菌洞色板的区间：石/水/光偏冷，叶偏苔绿，地脉偏琥珀。
  for (const key of ['stone', 'stoneDark', 'water', 'waterDeep', 'glow', 'star']) {
    const [r, , b] = [1, 3, 5].map(i => parseInt(PAL[key].slice(i, i + 2), 16));
    assert.ok(b >= r, `${key} ${PAL[key]} must read cold, not warm`);
  }
  for (const key of ['leaf', 'leafDark']) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(PAL[key].slice(i, i + 2), 16));
    assert.ok(g > r && g > b, `${key} ${PAL[key]} must read as cave moss green`);
  }
  {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(PAL.glowWarm.slice(i, i + 2), 16));
    assert.ok(r > b && r > g, `glowWarm ${PAL.glowWarm} must stay the warm accent slot`);
  }
  assert.equal(PAL.roofs.length, 6, 'six roof variants are required');
  assert.ok(hexes.length >= 12, 'palette must keep its full spread');
  assert.deepEqual(Object.keys(PAL).sort(), ['cream', 'foam', 'glow', 'glowWarm', 'highlight', 'ink', 'leaf', 'leafDark', 'leafLight', 'plaster', 'roofs', 'star', 'stone', 'stoneDark', 'water', 'waterDeep', 'wood', 'woodDark', 'woodLight'].sort());
});
