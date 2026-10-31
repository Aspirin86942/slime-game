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
// 生效 token = 基础块，被主题块同名声明覆写。
const effective = (theme) => ({...decls(baseBlock(home)), ...decls(themeBlock(home, theme)), ...decls(baseBlock(shell)), ...decls(themeBlock(shell, theme))});

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
  for (const [css, label] of [[home, 'home.css'], [shell, 'shell.html']]) {
    for (const m of css.matchAll(/#app\[data-theme="(\w+)"\]\{/g)) {
      assert.ok(THEMES.includes(m[1]), `${label} still defines unreachable theme "${m[1]}"`);
    }
  }
});
