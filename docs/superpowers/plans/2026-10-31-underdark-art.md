# 幽暗地域美术改造实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 subagent-driven-development（推荐）或 executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把家园从林间绘本重画为冷光菌洞，并以它为全游戏唯一画风基准；同时把 `地形纹理.html` 的程序化纹理接成地图细节层。

**架构：** 先落一层 `--lw-*` CSS 语义 token 作为唯一色源，六套既有主题改为别名消费它；再把季节地面与路面重画为地下景象，并用固定种子的 Python 生成器产出可无缝平铺的细节纹理（制作期生成、入库，运行时不跑 Canvas）；最后分 3 批重画 231 项手绘素材。玩法、存档、布局、交互一律不动。

**技术栈：** TypeScript（esbuild 打包）、原生 CSS 变量、SVG、Python 3 + Pillow（仅制作期）、Node 内置测试、自研 CDP 浏览器测试、`codex exec` + 内置 `image_gen`（仅制作期）。

**规格：** [2026-10-31-underdark-art-design.md](../specs/2026-10-31-underdark-art-design.md)

## 全局约束

- 禁止修改 `史莱姆-参考.html` 与 `tests/baseline-original.html`；后者 SHA-256 必须保持 `60a7b01f21ac6707a399bcb461b233016e9cbae5bfedff20aa36352bf864d6f4`。
- 不引入任何运行时依赖；`package.json` 的 `dependencies` 保持为空，构建只用 esbuild + typescript。
- 不新增网络请求、外部图片或字体内链；所有图片必须内嵌进 `史莱姆.html`。
- 存档结构不变：`saveVersion` 保持 `5`，`S.theme` 的 6 个 `id` 不变（`sunset/dark/light/peach/mint/lavender`），不新增存档字段。
- 玩法数值与判定不变：`season()`、`dayPhase()`、`night()`、`springThaw()` 的公式与阈值一字不改。
- 史莱姆形体、表情、元素造型不改；只允许对 `.home-slime` 叠加 CSS 滤镜。
- 素材主色每张图集不超过 4 组（规格 5.3）。
- 细节层不透明度上限 `0.35`（规格 3.3）。
- 只改 `src/` 后必须 `npm run build`；不手改 `史莱姆.html`。
- 图片体积预算：`史莱姆.html` 当前约 14.3 MB，改造后不得超过 20 MB。
- 不自动推送；每个任务结束 commit 到本地。

## 审查重点（Review Focus）

以下是规格隐含、但任何任务都不会自动覆盖的失败模式，最可能伤到玩家的排前面。每一条都在下方指定任务里有钉住它的测试。

1. **深夜可读性**：全冷色调下，`night()` 时段所有元素一起压蓝，玩家分不清道路、地块边界与建筑轮廓。期望：夜间仍能用亮度差辨认道路与建筑。→ 任务 4。
2. **浅色主题对比度**：`light`（浅岩）在强光户外使用时，若底太浅而文字沿用深主题的浅灰，正文对比度不足。期望：正文对比度 ≥ 4.5:1。→ 任务 4。
3. **程序化细节层拖低帧率**：细节层叠上来后，满庭院场景掉到 55 FPS 以下。期望：普通家园 ≥ 55、满庭院 ≥ 30。→ 任务 7。
4. **减少动画偏好未完全生效**：水面平移或季节粒子在 `reduced-motion` 下仍在动。期望：开启后地图内无任何动画。→ 任务 7。
5. **离线失效**：新增 WebP 未内嵌，断网后地图变空白。期望：断网双击 `史莱姆.html` 完整可玩。→ 任务 16。

---

## 文件结构

### 新建

| 文件 | 职责 |
| --- | --- |
| `tests/palette.test.mjs` | 静态解析 CSS，断言 6 套主题都定义了全部 `--lw-*` token，且旧变量是它们的别名 |
| `scripts/terrain-gen.py` | 固定种子生成 4 季地面细节纹理 + 1 张水面纹理，输出 PNG 与 WebP |
| `tests/terrain-detail-browser.cjs` | 浏览器断言：细节层存在、不透明度上限、reduced-motion、帧率 |
| `scripts/audit-palette.py` | 制作期检查：统计每张图集的主色簇数量 ≤ 4 |
| `docs/art-2026-11-01/` | 生图提示词、生产 PNG、`layouts.json`、生成记录 |

### 修改

| 文件 | 改动 |
| --- | --- |
| `src/world/home.css:1-8` | 新增 `--lw-*` token 层；`--surface-solid` 改为派生 |
| `src/shell.html:13-18,22-41,…` | 6 套主题块改为只覆写 `--lw-*`，旧变量加别名 |
| `src/world/art/kit.ts:43-52` | `PAL` 收敛到菌洞色板 |
| `src/world/home-art.ts:39-42` | 地面加细节层；夜间底色换冷岩 |
| `src/world/art/storybook.ts:47-50` | 云色板换菌洞冷调 |
| `src/assets/storybook/*` | 231 项素材替换 + 5 张细节纹理 + `manifest.json` |
| `tests/home-browser.cjs:103` | 夜间颜色断言改值 |
| `tests/theme-browser.cjs:65,80` | 两处颜色断言改值；新增 token 一致性检查 |
| `tests/seasons-browser.cjs:26,57` | 积雪判据改为冷白 + 色温；融雪判据 |
| `docs/art-2026-10-27/美术规范.md` | 改写为幽暗地域规范 |
| `CLAUDE.md` | 画风、素材数量、验证入口同步 |

---

## 任务 1：`--lw-*` token 层与六主题重配

**文件：**
- 创建：`tests/palette.test.mjs`
- 修改：`src/world/home.css:1-8`、`src/shell.html:13-18` 与六个主题块

- [ ] **步骤 1：编写失败的测试**

`tests/palette.test.mjs`：读取 `src/shell.html` 与 `src/world/home.css` 的文本，用正则抽出每个主题块里的自定义属性声明，断言下表全部成立。

```js
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --experimental-strip-types --test tests/palette.test.mjs`
预期：FAIL，`sunset resolves no --lw-rock` 之类。

- [ ] **步骤 3：在 `src/world/home.css` 写入 token 层并让 `--surface-solid` 派生**

把第 1-8 行替换为下面的结构。基础 `#app` 块给出全集默认值，六个主题块只覆写需要变化的 token，`--surface-solid` 在基础块里派生自 `--lw-ink` 一次。同时**删除死块** `#app[data-theme="sky"]`（`sky` 不在 `THEMES`，永不生效）。

```css
/* 冷光菌洞：唯一色源。所有主题只覆写 --lw-*，界面变量一律取别名。 */
#app{
 --lw-rock:#2f4a52;--lw-rock-dark:#1b2f38;--lw-rock-light:#4a6b73;
 --lw-moss:#4c6b4a;--lw-spore:#8f6bb5;--lw-crystal:#9fe3f0;
 --lw-vein:#c8913f;--lw-ink:#121c24;--lw-paper:#e6eef0;
 --lw-text:#dfeaee;--lw-muted:#8aa3ad;--lw-border:rgba(159,227,240,.16)}
#app{--surface-solid:var(--lw-ink)}
#app[data-theme="sunset"]{--lw-ink:#131e26}
#app[data-theme="dark"]{--lw-ink:#14202b;--lw-rock:#263b45;--lw-spore:#a678d8}
#app[data-theme="light"]{--lw-ink:#e8eef0;--lw-paper:#f4f8f9;--lw-rock:#b8c8ce;--lw-rock-dark:#8fa4ac;--lw-rock-light:#d5e1e5;--lw-text:#1a2730;--lw-muted:#4a5f68;--lw-border:rgba(26,39,48,.18);--lw-crystal:#2f7f93;--lw-spore:#6a4a92;--lw-vein:#8a5f1e}
#app[data-theme="peach"]{--lw-ink:#241b16;--lw-rock:#4a352a;--lw-vein:#d8a24a}
#app[data-theme="mint"]{--lw-ink:#e8f2ec;--lw-paper:#f2f8f4;--lw-rock:#a8bfb0;--lw-rock-dark:#7f9a89;--lw-rock-light:#c8dbcf;--lw-text:#16241c;--lw-muted:#456053;--lw-border:rgba(22,36,28,.18);--lw-moss:#4f7d55;--lw-spore:#5f7a9a;--lw-crystal:#2b7a7a;--lw-vein:#8a6a20}
#app[data-theme="lavender"]{--lw-ink:#16202b;--lw-rock:#2b4450;--lw-spore:#8f8fd8;--lw-crystal:#b8ecf5}
```

- [ ] **步骤 4：在 `src/shell.html` 把六个主题块改为覆写 `--lw-*` 并给旧变量加别名**

每个主题块保留原有变量名，但值改成 `var(--lw-*)`；`--bgTop/--bgMid/--bgBot` 用 `color-mix` 从 `--lw-ink` 与 `--lw-rock` 派生出三级景深。基础 `#app` 块（第 13-18 行）同样处理。

```css
background:radial-gradient(circle at 50% 0%,var(--bgTop) 0%,var(--bgMid) 55%,var(--bgBot) 100%);
--bgTop:color-mix(in srgb,var(--lw-ink) 82%,var(--lw-rock));--bgMid:var(--lw-ink);--bgBot:color-mix(in srgb,var(--lw-ink) 78%,#000);
--accent:var(--lw-spore);--accent2:var(--lw-crystal);--gold:var(--lw-vein);
--panel:color-mix(in srgb,var(--lw-rock) 22%,transparent);--border:var(--lw-border);
--text:var(--lw-text);--muted:var(--lw-muted);
--topbar:color-mix(in srgb,var(--lw-ink) 82%,transparent);--tabbar:color-mix(in srgb,var(--lw-ink) 94%,transparent);
```

- [ ] **步骤 5：运行测试验证通过**

运行：`node --experimental-strip-types --test tests/palette.test.mjs`
预期：PASS，5 个测试全绿。

- [ ] **步骤 6：把新测试登记进 `test:world`**

`package.json` 的 `test:world` 是显式文件清单，不登记就永远不会执行。把 `tests/palette.test.mjs` 加到链尾：

```json
"test:world": "node --experimental-strip-types --test tests/home.test.mjs tests/world.test.mjs tests/common-life.test.mjs tests/storybook.test.mjs tests/building-forms.test.mjs tests/estate.test.mjs tests/palette.test.mjs"
```

（`tests/terrain.test.mjs` 由任务 5 在同一条链上追加。）

- [ ] **步骤 7：构建并人工核对截图**

运行：`npm run build`，然后 `node tests/home-browser.cjs` 观察 `tools/out/magic-ui/` 下的新截图。
预期：构建成功；截图里家园与六个页面同为冷调，没有残留暖色。注意任务 3 会修复该脚本的颜色断言，此处允许它在颜色断言上失败。

- [ ] **步骤 8：Commit**

```bash
git add tests/palette.test.mjs src/world/home.css src/shell.html package.json 史莱姆.html
git commit -m "feat: 引入 --lw-* 语义 token 层并将六套主题重配为冷光菌洞同族"
```

---

## 任务 2：`PAL` 收敛到菌洞色板

**文件：**
- 修改：`src/world/art/kit.ts:43-52`
- 测试：`tests/palette.test.mjs`（追加）

- [ ] **步骤 1：编写失败的测试**

在 `tests/palette.test.mjs` 追加（需动态 import TS，参考 `tests/storybook.test.mjs:7` 的写法）：

```js
test('the shared art palette only uses underdark hues', async () => {
  const {PAL} = await import('../src/world/art/kit.ts');
  const flat = JSON.stringify(PAL).match(/#[0-9a-f]{6}/gi).map(h => h.toLowerCase());
  for (const hex of flat) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    // 冷光菌洞：蓝色通道不得明显低于红色通道（排除暖色残留）
    assert.ok(b >= r - 18, `${hex} is too warm for the underdark palette`);
  }
  assert.ok(flat.length >= 12, 'palette must keep its full spread');
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --experimental-strip-types --test tests/palette.test.mjs`
预期：FAIL，报某个暖色 hex（如 `#c98a6a`）too warm。

- [ ] **步骤 3：替换 `src/world/art/kit.ts:43-52` 的 `PAL`**

保持键名不变（`facilities.ts`、`decor.ts`、`plants.ts` 都按键取值），只换值；`roofs` 保住 6 个元素。

```ts
export const PAL={
 wood:'#5a4a3e',woodDark:'#3d322a',woodLight:'#7d6a56',
 stone:'#4a6b73',stoneDark:'#2f4a52',
 plaster:'#93a6ab',cream:'#c4d2d4',
 leaf:'#4c6b4a',leafLight:'#7fa07a',leafDark:'#334d38',
 water:'#5f9aa8',waterDeep:'#2f6472',foam:'#bfe6ea',
 glow:'#9fe3f0',glowWarm:'#c8913f',star:'#d8f4f8',
 roofs:['#3f5a63','#4c6b5a','#6b5a78','#2f4a52','#556f7a','#7a6a8f'],
 ink:'#121c24',highlight:'#d8ecf0'
};
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --experimental-strip-types --test tests/palette.test.mjs`
预期：PASS，全部 5 个测试通过。

- [ ] **步骤 5：类型检查与构建**

运行：`npm run typecheck && npm run build`
预期：无类型错误；构建成功。

- [ ] **步骤 6：Commit**

```bash
git add src/world/art/kit.ts tests/palette.test.mjs 史莱姆.html
git commit -m "feat: 把共享素材色板 PAL 收敛到冷光菌洞色系"
```

---

## 任务 3：同步三处颜色断言

**文件：**
- 修改：`tests/home-browser.cjs:103`、`tests/theme-browser.cjs:65,80`

这三处断言的旧值是旧主题的 `--surface-solid` 与 `--muted`；任务 1 已把它们改为新色，断言必须同步，否则测试会误报为回归。

- [ ] **步骤 1：先运行确认它们失败**

运行：`node tests/home-browser.cjs`
预期：FAIL，`night scenery retains the shared dark theme`，实际色与 `rgb(20, 26, 42)` 不符。

- [ ] **步骤 2：改 `tests/home-browser.cjs:103` 的两个色值**

该检查跑在 `dark` 主题下。`--surface-solid` 现为 `var(--lw-ink)` = `#14202b`，`--muted` = `#8aa3ad`。

```js
getComputedStyle(document.querySelector('.home-tools')).backgroundColor==='rgb(20, 32, 43)'&&getComputedStyle(document.querySelector('.home-season')).color==='rgb(138, 163, 173)'&&getComputedStyle(document.querySelector('.tabbar button')).color==='rgb(138, 163, 173)'
```

- [ ] **步骤 3：改 `tests/theme-browser.cjs:65` 与 `:80`**

`:65` 跑在 `sunset` 夜间，`--lw-ink` 为 `#131e26`；`:80` 跑在 `mint`，`--lw-ink` 为 `#e8f2ec`。

```js
// :65
getComputedStyle(document.querySelector('.home-tools')).backgroundColor==='rgb(19, 30, 38)'
// :80
getComputedStyle(document.querySelector('.home-tools')).backgroundColor==='rgb(232, 242, 236)'
```

- [ ] **步骤 4：运行验证通过**

运行：`node tests/theme-browser.cjs`
预期：PASS，全部 283 项通过（数量不变）。

- [ ] **步骤 5：Commit**

```bash
git add tests/home-browser.cjs tests/theme-browser.cjs
git commit -m "test: 同步主题底色断言到冷光菌洞色板（口径变更，非回归）"
```

---

## 任务 4：跨页 token 一致性、夜间可读性与浅色对比度

**文件：**
- 修改：`tests/theme-browser.cjs`（在每个主题的循环内追加检查）

覆盖审查重点 1（深夜可读性）与 2（浅色主题对比度）。

- [ ] **步骤 1：编写失败的检查**

在 `tests/theme-browser.cjs` 的 `for (const theme of themes)` 循环内、`catalog` 检查之后追加三段。第一段钉住一致性，第二段钉住夜间可读性，第三段钉住浅色对比度。

```js
const tokens = await ev(`(()=>{const app=getComputedStyle(document.querySelector('#app'));const keys=['lw-rock','lw-spore','lw-crystal','lw-vein','lw-ink','lw-text','lw-muted','lw-border'];const values=keys.map(k=>app.getPropertyValue('--'+k).trim());return {values,complete:values.every(v=>v.length>0),unique:new Set(values).size>=6};})()`);
check(label+' shares one token set across home and the six pages',tokens.complete&&tokens.unique,tokens);
```

```js
// 夜间可读性：只在深色主题上判，取 token 实际值而非硬编码
if(theme==='sunset'||theme==='dark'||theme==='peach'||theme==='lavender'){
 await ev(`S.world.clock=2800;renderTab()`);
 const legible = await ev(`(()=>{const lum=h=>{const v=h.replace('#','');const [r,g,b]=[0,2,4].map(i=>parseInt(v.slice(i,i+2),16)/255).map(c=>c<=.03928?c/12.92:((c+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};
  const css=getComputedStyle(document.querySelector('#app'));
  const ink=css.getPropertyValue('--lw-ink').trim(),rock=css.getPropertyValue('--lw-rock').trim(),light=css.getPropertyValue('--lw-rock-light').trim();
  return {ink,rock,light,inkVsRock:Math.abs(lum(ink)-lum(rock)),rockVsLight:Math.abs(lum(rock)-lum(light))};})()`);
 check(label+' keeps the road and building edges distinguishable at night',legible.inkVsRock>.04&&legible.rockVsLight>.05,legible);
 await ev(`S.world.clock=1200;renderTab()`);
}
```

```js
// 浅色主题对比度：正文与底色的对比度 ≥ 4.5
if(theme==='light'||theme==='mint'){
 const ratio=await ev(`(()=>{const parse=c=>c.match(/[\\d.]+/g).slice(0,3).map(Number);const lum=rgb=>{const [r,g,b]=rgb.map(v=>v/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};
  const s=getComputedStyle(document.querySelector('.home-tools'));const l1=lum(parse(s.backgroundColor)),l2=lum(parse(s.color));
  const [hi,lo]=[Math.max(l1,l2),Math.min(l1,l2)];return (hi+.05)/(lo+.05);})()`);
 check(label+' keeps body text readable in a light theme',ratio>=4.5,{ratio});
}
```

- [ ] **步骤 2：运行验证（部分应失败）**

运行：`node tests/theme-browser.cjs`
预期：一致性检查应 PASS；夜间可读性若 `--lw-ink` 与岩色亮度差不足会 FAIL，此时把输出里的实际对比度记下，回到任务 1 调整 `--lw-rock` 或 `--lw-ink` 直到通过。这是设计闭环，不是改测试迁就实现。

- [ ] **步骤 3：Commit**

```bash
git add tests/theme-browser.cjs
git commit -m "test: 覆盖跨页 token 一致性、夜间可读性与浅色主题对比度"
```

---

## 任务 5：`scripts/terrain-gen.py` 固定种子纹理生成器

**文件：**
- 创建：`scripts/terrain-gen.py`
- 创建：`tests/terrain.test.mjs`

- [ ] **步骤 1：编写失败的测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';

const PY = process.env.DSH_PYTHON;
const run = out => execFileSync(PY, ['scripts/terrain-gen.py', '--out', out], {encoding: 'utf8'});
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');

test('terrain detail textures are byte-identical across runs', () => {
  const a = 'src/assets/storybook/.terrain-a', b = 'src/assets/storybook/.terrain-b';
  run(a); run(b);
  for (const name of ['terrain-moss', 'terrain-crystal', 'terrain-spore', 'terrain-frost', 'terrain-water']) {
    assert.equal(sha(`${a}/${name}.png`), sha(`${b}/${name}.png`), `${name} is not reproducible`);
  }
  rmSync(a, {recursive: true, force: true}); rmSync(b, {recursive: true, force: true});
});

test('terrain tiles are square, 1024 and seamlessly tileable', () => {
  run('src/assets/storybook/.terrain-c');
  for (const name of ['terrain-moss', 'terrain-crystal', 'terrain-spore', 'terrain-frost', 'terrain-water']) {
    const buf = readFileSync(`src/assets/storybook/.terrain-c/${name}.png`);
    assert.equal(buf.toString('ascii', 1, 4), 'PNG');
    // IHDR 宽高位于字节 16..24
    assert.equal(buf.readUInt32BE(16), 1024); assert.equal(buf.readUInt32BE(20), 1024);
  }
  rmSync('src/assets/storybook/.terrain-c', {recursive: true, force: true});
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`$env:DSH_PYTHON='<python 绝对路径>'; node --test tests/terrain.test.mjs`
预期：FAIL，脚本不存在。

- [ ] **步骤 3：实现 `scripts/terrain-gen.py`**

要有三部分：`mulberry32` 固定种子伪随机（替换原页面的 `Math.random`）、九宫格环绕绘制 `wrap_draw`（移植 `地形纹理.html:293-304`，保证对边无缝）、四个生成函数（草坪/土地/石板/水面，移植 `地形纹理.html:319/412/547/904` 的逻辑）。色相参数按季节取菌洞色板：

| 输出 | 基色 HSL | 用途 |
| --- | --- | --- |
| `terrain-moss.png` | h=95 s=18 l=30（湿苔岩） | 春 |
| `terrain-crystal.png` | h=185 s=26 l=34（晶簇岩） | 夏 |
| `terrain-spore.png` | h=28 s=22 l=26（锈褐菌毯） | 秋 |
| `terrain-frost.png` | h=200 s=14 l=62（霜蓝冰面） | 冬 |
| `terrain-water.png` | h=186 s=34 l=30（磷光暗水） | 池塘 |

命令行：`--out <dir>` 指定输出目录（默认 `src/assets/storybook`），同时写 PNG 到该目录；`--seed` 可选，默认 `20261101`。用 Pillow `Image.fromarray` 从 numpy 数组出图，尺寸 1024×1024。

- [ ] **步骤 4：运行测试验证通过**

运行：`$env:DSH_PYTHON='C:\Users\lcf\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'; node --test tests/terrain.test.mjs`
预期：PASS，2 个测试通过。

- [ ] **步骤 5：人工确认无缝**

运行：`node -e "const {execFileSync}=require('child_process');execFileSync(process.env.DSH_PYTHON,['scripts/terrain-gen.py','--out','tools/out/terrain-preview'])"`，然后打开输出 PNG，把图水平与垂直各平铺一次，确认没有接缝。

- [ ] **步骤 6：把新测试登记进 `test:world`**

在任务 1 已追加 `tests/palette.test.mjs` 的基础上，再把 `tests/terrain.test.mjs` 加到 `package.json` 的 `test:world` 链尾：

```json
"test:world": "node --experimental-strip-types --test tests/home.test.mjs tests/world.test.mjs tests/common-life.test.mjs tests/storybook.test.mjs tests/building-forms.test.mjs tests/estate.test.mjs tests/palette.test.mjs tests/terrain.test.mjs"
```

- [ ] **步骤 7：Commit**

```bash
git add scripts/terrain-gen.py tests/terrain.test.mjs package.json
git commit -m "feat: 新增固定种子的地形细节纹理生成器"
```

---

## 任务 6：生成 4 季地面与细节纹理入库

**文件：**
- 修改：`src/assets/storybook/ground-{spring,summer,autumn,winter}.webp`、`src/assets/storybook/paths.webp`
- 创建：`src/assets/storybook/terrain-*.webp`、`docs/art-2026-11-01/`

- [ ] **步骤 1：先备份当前素材**

运行 `git rev-parse --short HEAD` 记下改造前提交号，确认 `git stash list` 为空。创建 `backup/underdark-20261101/`，把 `src/assets/storybook/` 整体复制进去（`Copy-Item -Recurse`）。重画过程中随时可从该目录取回旧图，不依赖 git 历史。

- [ ] **步骤 2：生成 4 季整幅地面**

用 `codex exec` 调内置 `image_gen`，每季一条提示，统一 style baseline（写进 `docs/art-2026-11-01/ground.json`）：

```
Use case: stylized-concept
Asset type: top-down game ground texture, seamless tile
Style/medium: hand-painted gouache, visible brush texture, no black outlines
Primary request: <季节专属描述，见下表>
Constraints: full-frame ground only, no objects, no text, no border, no vignette,
opposite edges must meet seamlessly, 3:2 aspect ratio, 1536x1024
Color palette: <对应 --lw-* 取值>
```

季节描述：

| 季 | 提示要点 |
| --- | --- |
| spring | wet dark cave moss carpet, faint teal seeps, tiny pale spore capsules, cold blue-grey stone showing through |
| summer | dense pale-blue crystal shards cracking the floor, cyan glow bleeding between them, warm amber veins |
| autumn | rust-brown fungal mat, fallen pale mushroom caps, drifting purple spores |
| winter | pale frost-blue ice crust over dark rock, crystalline rime, faint violet refractions |

产物存 `docs/art-2026-11-01/production/ground-<season>.png`，再运行 `node scripts/prepare-home-art.mjs "<sharp 目录>"`（或规格 6 章允许的 Pillow 兜底路径）转成 `src/assets/storybook/ground-<season>.webp`。

- [ ] **步骤 3：生成 6 种路面**

同法生成 `paths.png`（1536×1024，6 格），材质换成：湿石板、碎晶、菌丝铺道、暗色卵石、苔痕砖、地脉纹。存 `production/paths.png`，经 `prepare-home-art.mjs` 裁成 6 格。

- [ ] **步骤 4：生成 5 张细节纹理**

运行：`node scripts/terrain-gen.py --out src/assets/storybook`（默认即此目录），产出 `terrain-*.png`；再用下面一行转 WebP：

```powershell
& $env:DSH_PYTHON -c "from PIL import Image; import glob; [Image.open(p).save(p.replace('.png','.webp'),'WEBP',quality=88,method=6) for p in glob.glob('src/assets/storybook/terrain-*.png')]"
```

删掉中间 PNG，只留 WebP。

- [ ] **步骤 5：更新 `manifest.json`**

为 5 张细节纹理加条目（`frames` 为空数组，`build.mjs:5-6` 会走 `atlas.image` 分支自动内嵌）：

```json
"terrain-moss": {"width": 1024, "height": 1024, "frames": []}
```

其余 4 张同构。地面与路面条目由 `prepare-home-art.mjs` 自动重写，不要手改。

- [ ] **步骤 6：运行现有素材测试验证**

运行：`npm run test:world`
预期：PASS，含 `hand-painted clouds, snow-covered trees and four grounds are packaged offline`（断言 4 张地面互不相同且都是 RIFF/WEBP）。

- [ ] **步骤 7：调色板审计**

运行：`& $env:DSH_PYTHON scripts/audit-palette.py src/assets/storybook/ground-*.webp`
预期：每张图输出主色簇数量，全部 ≤ 4。若超标，调整提示词重新生成。

- [ ] **步骤 8：Commit**

```bash
git add src/assets/storybook docs/art-2026-11-01 scripts/audit-palette.py
git commit -m "feat: 重画四季地下地面与六种路面并新增五张细节纹理"
```

---

## 任务 7：细节层接入地图

**文件：**
- 修改：`src/world/home-art.ts:39-42`
- 创建：`tests/terrain-detail-browser.cjs`

覆盖审查重点 3（帧率）与 4（减少动画）。

- [ ] **步骤 1：编写失败的浏览器测试**

```js
'use strict';
const assert=require('node:assert/strict');
const {start}=require('./lib/browser/session.cjs');
const {waitFor,report}=require('../tools/out/lib/cdp.js');
const out='tools/out/magic-ui/terrain',checks=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});assert.ok(ok,name+': '+JSON.stringify(detail));console.log('PASS '+name);};
(async()=>{
 const session=await start({profile:'desktop-s',url:'史莱姆.html?battle=ui',gpu:true,outDir:out});
 const {ev}=session,errors=session.consoleErrors;
 try{
  assert.ok(await waitFor(()=>ev(`typeof S!=='undefined'&&S.started`),15000));
  await ev(`document.querySelector('#selftestOut')?.remove();switchTab('home');S.world.reducedMotion=false;renderTab();`);
  check('detail layer is present and above the hand-painted ground',await ev(`(()=>{const p=document.querySelector('#home-terrain-detail');const g=document.querySelector('.home-ground');return !!p&&p.nextElementSibling!==null&&g.querySelector('[data-home-terrain]')!==null;})()`));
  check('detail layer stays within the opacity budget',await ev(`+document.querySelector('[data-home-terrain]').getAttribute('opacity')<=.35`));
  check('detail layer follows the season',await ev(`[0,1,2,3].every(s=>{S.world.clock=s*25200+1200;renderTab();return document.querySelector('[data-home-terrain]').dataset.homeTerrain===['moss','crystal','spore','frost'][s];})`));
  await ev(`S.world.clock=1200;renderTab();`);
  const fps=await ev(`new Promise(resolve=>{const samples=[];let last=performance.now();function step(t){if(t>last)samples.push(t-last);last=t;if(samples.length<150)requestAnimationFrame(step);else resolve({fps:1000/(samples.reduce((a,b)=>a+b,0)/samples.length)});}requestAnimationFrame(step);})`);
  check('detail layer keeps the home above 55 FPS',fps.fps>=55,fps);
  await ev(`S.world.reducedMotion=true;renderTab()`);
  check('reduced motion stops every map animation including the detail layer',await ev(`document.querySelectorAll('.home-map *').length>0&&[...document.querySelectorAll('.home-world *')].every(n=>getComputedStyle(n).animationName==='none')`));
  check('no browser exceptions or console errors',errors.length===0,errors);
  report(out,'results.json',{checks,errors});
 }catch(e){await session.shot('failure.png').catch(()=>{});report(out,'results.json',{checks,errors,failure:String(e)});throw e;}
 finally{await session.close();}
 console.log(`RESULT ${checks.length}/${checks.length} terrain detail checks`);
})().catch(e=>{console.error(e);process.exitCode=1;});
```

- [ ] **步骤 2：运行验证失败**

运行：`node tests/terrain-detail-browser.cjs`
预期：FAIL，`#home-terrain-detail` 不存在。

- [ ] **步骤 3：在 `src/world/home-art.ts` 接入细节层**

在 `ground` 变量组装之后、`<g class="home-ground">` 输出之前，追加一个 `<pattern>` 与一个覆盖层。要点：

- 纹理名按季节映射 `['moss','crystal','spore','frost'][s]`，用 `artURL(\`terrain-${name}\`)` 取图（`artURL` 对无 frames 的图集走 `atlas.image` 分支，已内嵌 base64，**不需要改 `build.mjs`**）。
- pattern 尺寸 `256×256`，`patternUnits="userSpaceOnUse"`，让 48px 的地图上约 5.3 格一循环（规格 3.3 要求循环次数 ≤ 8）。
- 覆盖层 `<rect data-home-terrain="${name}" data-home-terrain-season="${s}" opacity=".32" pointer-events="none" fill="url(#home-terrain-detail)">`，`opacity` 必须在 `.28`–`.35` 之间。
- 夜间再叠一层冷色调整：把现有 `shade()` 的混合目标从 `'#243d53'` 改为 `'#1b2f38'`（`--lw-rock-dark`），并同步 `home.css:31` 的 `.home-map.night{background:#1b2f38}`。
- 水面动态只在文件级开关打开时启用：CSS 加 `.home-world:not(.reduced-motion) [data-home-terrain="water"]{animation:home-terrain-drift 40s linear infinite}`，`reduced-motion` 已由现有规则统一关停。

- [ ] **步骤 4：运行测试验证通过**

运行：`node tests/terrain-detail-browser.cjs`
预期：PASS，6 项全绿；帧率 ≥ 55。

- [ ] **步骤 5：回归既有家园测试**

运行：`node tests/home-browser.cjs && node tests/seasons-browser.cjs`
预期：`home-browser` 全绿；`seasons-browser` 允许在冬季积雪与春季融雪两处失败（任务 8 处理）。

- [ ] **步骤 6：把新套件登记进 `test:browser`**

`package.json` 的 `test:browser` 也是显式套件清单，不登记就不会在 `npm run test:browser` 里执行。把 `tests/terrain-detail-browser.cjs` 插在 `seasons-browser.cjs` 之后：

```json
"test:browser": "node tests/home-browser.cjs && node tests/reference-browser.cjs && node tests/theme-browser.cjs && node tests/mobile-home-browser.cjs && node tests/building-forms-browser.cjs && node tests/home-actions-browser.cjs && node tests/estate-browser.cjs && node tests/seasons-browser.cjs && node tests/terrain-detail-browser.cjs && node tests/smoke-browser.cjs"
```

- [ ] **步骤 7：Commit**

```bash
git add src/world/home-art.ts src/world/home.css tests/terrain-detail-browser.cjs package.json 史莱姆.html
git commit -m "feat: 把手绘底层与程序化细节层合成，夜间底色换冷岩"
```

---

## 任务 8：同步季节断言到地下判据

**文件：**
- 修改：`tests/seasons-browser.cjs:26,57`

- [ ] **步骤 1：改冬季积雪判据（第 26 行）**

原来判「白色占比 > .9 且三通道都 > 210」。霜凝季是冷白偏蓝的冰面，改为「冷白占比 > .8 且蓝通道 ≥ 红通道」。字段名 `snow` 保留，避免改动下游。

```js
if(s===3){const snow=await pixels('.home-meadow');check(`${phase}: winter ground is covered in cold frost`,snow.snow>.8&&snow.rgb[2]>=snow.rgb[0],snow);}
```

同时把 `pixels()` 里的 `snow` 统计阈值从 `>180` 放宽到 `>150`（霜蓝整体偏暗），这是同一处口径变更。

- [ ] **步骤 2：改春季融雪判据（第 57 行）**

`springThaw` 机制不变，元素名与语义改为「霜华消融」。测试断言从「透明度递减」改为「`.home-thaw` 的 `opacity` 在 clock=0 / 1800 / 3600 三点严格递减」。

```js
check('spring frost melts with the game clock during placement',await ev(`(()=>{const o=c=>{S.world.clock=c;renderTab();return +document.querySelector('.home-thaw').getAttribute('opacity');};const [a,b,c2]=[o(0),o(1800),o(3600)];return a>b&&b>c2;})()`));
```

- [ ] **步骤 3：运行验证通过**

运行：`node tests/seasons-browser.cjs`
预期：PASS，全部 87 项通过，检查条数不变。

- [ ] **步骤 4：Commit**

```bash
git add tests/seasons-browser.cjs
git commit -m "test: 季节断言改为地下霜晶判据（口径变更，非回归）"
```

---

## 任务 9：重画 facilities-a / facilities-b（32 项）

**文件：**
- 修改：`src/assets/storybook/facilities-a*.webp`、`facilities-b*.webp`、`manifest.json`
- 创建：`docs/art-2026-11-01/production/facilities-{a,b}.png`

- [ ] **步骤 1：备份**

`backup/underdark-20261101/facilities/` 下复制两张旧图集与裁切坐标。

- [ ] **步骤 2：生成**

`codex exec` + `image_gen`，一张图集一条提示，4×4 网格、透明背景、1254×1254：

```
Use case: stylized-concept
Asset type: game sprite atlas, 4x4 grid on genuinely transparent background
Style/medium: hand-painted gouache storybook sprites, fine visible brush texture,
             NO black outlines, elevated front-facing orthographic view, screen-aligned
             horizontal bases, NOT diamond isometric, light from upper left
Primary request: <16 个设施描述>
Color palette: wet blue-grey stone #2f4a52, dark cave timber #5a4a3e,
               purple bioluminescent accents #8f6bb5, pale crystal #9fe3f0, amber vein #c8913f
Constraints: each sprite isolated with generous transparent gutters, no touching,
             no text, no frame, no grid lines, no watermark, no grass base
```

`facilities-b.png` 的后 6 格是自然物，描述改为：真菌树、菌伞果丛、地藓丛、苔石、发光小菌、洞穴蕨。

- [ ] **步骤 3：拆粘与重排**

若相邻物件粘连，运行 `node scripts/repack-atlas.mjs "<sharp 目录>" <输入> 16 4 <输出>`，再缩放到 1254×1254。

- [ ] **步骤 4：裁切入库**

运行：`node scripts/prepare-home-art.mjs "<sharp 目录>" facilities-a facilities-b`
预期：输出 `facilities-a-0..15.webp`、`facilities-b-0..15.webp`，manifest 的 frames 更新为 16。

- [ ] **步骤 5：验证**

运行：`npm run test:world`
预期：PASS；`storybook.test.mjs` 的「32 个独立设施素材」与「42 件装饰」不变（数量不变，只换图）。

再运行 `& $env:DSH_PYTHON scripts/audit-palette.py src/assets/storybook/facilities-a-*.webp`
预期：每张主色簇 ≤ 4。

- [ ] **步骤 6：视觉核对**

运行：`npm run build && node tests/building-forms-browser.cjs`
预期：222 项通过；截图里建筑为湿岩与地底木。

- [ ] **步骤 7：Commit**

```bash
git add src/assets/storybook docs/art-2026-11-01 史莱姆.html
git commit -m "feat: 重画基础设施与自然物图集为幽暗地域风格"
```

---

## 任务 10：重画 facilities-c / d / e（48 项）

**文件：**
- 修改：`facilities-{c,d,e}*.webp`、`manifest.json`
- 创建：`docs/art-2026-11-01/production/facilities-{c,d,e}.png`

- [ ] **步骤 1：备份三张旧图集与 `production/layouts.json`**

- [ ] **步骤 2：逐张生成**

每张 4×4、16 格、每两个相邻格是同设施的 2 级与 3 级。**沿用任务 9 步骤 2 的完整 style baseline 提示文本**（Use case / Asset type / Style-medium / 调色板 / Constraints 五段原样照抄），只追加下面这段形态规则：

```
Each row pairs two buildings: the LEFT is upgrade level 2 (added wing, stone
foundation, carved eaves, lantern, planter), the RIGHT is level 3 (taller roof or
tower, gilded trim, banner, one softly glowing crystal). Both keep the same main
colour, material and signature silhouette as their level-1 form.
```

参考图传任务 9 产出的新 `facilities-a-0.webp` 作为 style reference，避免画风断层。

- [ ] **步骤 3：裁决与重排**

运行 `scripts/repack-atlas.mjs`（若粘连），再 `node scripts/prepare-home-art.mjs "<sharp 目录>" facilities-c facilities-d facilities-e`。

- [ ] **步骤 4：验证**

运行：`npm run test:world`
预期：PASS；`storybook.test.mjs` 的「48 个升级形态各自独立」不变。

- [ ] **步骤 5：夜间窗灯核对**

运行：`node tests/building-forms-browser.cjs`
预期：222 项通过。`storybook.ts:106-129` 的 `LAMPS` 坐标是按旧图比例标定的，若新图窗位偏移导致 `storybook.test.mjs` 的「window outside its sprite」失败，按新图调整对应 `LAMPS` 的 `[x,y]`（这只改元数据，不改逻辑）。

- [ ] **步骤 6：Commit**

```bash
git add src/assets/storybook src/world/art/storybook.ts docs/art-2026-11-01 史莱姆.html
git commit -m "feat: 重画 24 座设施的 2/3 级形态并校准夜间窗灯"
```

---

## 任务 11：重画 facilities-f / g（18 项）

**文件：**
- 修改：`facilities-{f,g}*.webp`、`manifest.json`
- 创建：`docs/art-2026-11-01/production/facilities-{f,g}.png`

- [ ] **步骤 1：备份两张旧图集**

- [ ] **步骤 2：生成**

3×3 网格（`grid:3`），每行同一资源建筑的 1、2、3 级。资源建筑换皮：采石场=湿岩採掘面、矿洞=晶体矿脉、蜂箱=荧菌巢、元素泉=磷光泉、仓库=石砌窖、集市=地底商铺。

提示追加：

```
Three rows of three. Each row is ONE building at levels 1, 2, 3, from left to right,
all three drawn from the same design with consistent main colour and sign silhouette.
```

- [ ] **步骤 3：裁切入库**

运行：`node scripts/prepare-home-art.mjs "<sharp 目录>" facilities-f facilities-g`
预期：各 9 格。

- [ ] **步骤 4：验证**

运行：`npm run test:world && node tests/estate-browser.cjs`
预期：`estate.test.mjs` 与 `storybook.test.mjs` 的「18 张资源建筑」通过；`estate-browser` 全绿。

- [ ] **步骤 5：Commit**

```bash
git add src/assets/storybook docs/art-2026-11-01 史莱姆.html
git commit -m "feat: 重画六座资源建筑三档形态"
```

---

## 任务 12：重画 decor-a / b / c（48 项）

**文件：**
- 修改：`decor-{a,b,c}*.webp`、`manifest.json`
- 创建：`docs/art-2026-11-01/production/decor-{a,b,c}.png`

- [ ] **步骤 1：备份**

- [ ] **步骤 2：生成**

三张 4×4、共 42 件装饰（另 6 格是物料图标），换皮为：石栏与菌丝围栏、晶簇灯、苔石座椅、菌架、地脉路标、纪念晶碑。沿用任务 9 的 style baseline。

**关键约束**：`decor-c` 的 `wood/stone/dew/feed/build/gather` 六个物料图标（`storybook.ts:204` 的 `MATERIAL_ICONS` 映射 `10/11/12/13/14/15`）必须保持"纯物品、无草地底座"，位置不得移动。

- [ ] **步骤 3：裁切入库**

运行：`node scripts/prepare-home-art.mjs "<sharp 目录>" decor-a decor-b decor-c`

- [ ] **步骤 4：验证**

运行：`npm run test:world`
预期：PASS；`storybook.test.mjs` 的「42 件装饰各有独立素材」不变。

- [ ] **步骤 5：夜间灯光核对**

运行：`node tests/home-actions-browser.cjs`
预期：42 项通过。`decor-2-*` 是灯具（`storybook.ts:147-148`），若新图灯罩位置移动，按新图调 `paintedObject` 里 `decor-2-` 的椭圆 `cy` 偏移。

- [ ] **步骤 6：Commit**

```bash
git add src/assets/storybook src/world/art/storybook.ts docs/art-2026-11-01 史莱姆.html
git commit -m "feat: 重画 42 件装饰与六个物料图标"
```

---

## 任务 13：重画 plants-a / b / c（49 项）

**文件：**
- 修改：`plants-{a,b,c}*.webp`、`manifest.json`
- 创建：`docs/art-2026-11-01/production/plants-{a,b,c}.png`

- [ ] **步骤 1：备份**

- [ ] **步骤 2：生成**

`plants-a` 16 格、`plants-b` 17 格、`plants-c` 16 格（含 6 个生长阶段格）。植被换皮为地底植物：发光菌、晶簇花、洞穴蕨、苔藓毯、石生花、磷光藤。

提示追加：

```
No flowering meadow plants, no daisies, no sunlight green. Every plant is adapted to
a lightless cave: bioluminescent caps, pale crystal petals, waxy dark leaves.
```

**关键约束**：`plants-c` 的 4/5/6/7/8/9 这 6 格被 `paintedPlant`（`storybook.ts:167-169`）用作生长阶段占位，语义必须保持「种子/幼苗/花苞」可辨识。

- [ ] **步骤 3：裁切入库**

运行：`node scripts/prepare-home-art.mjs "<sharp 目录>" plants-a plants-b plants-c`

- [ ] **步骤 4：验证**

运行：`npm run test:world`
预期：PASS；`storybook.test.mjs` 的「37 种基础植物各有素材」与「生长阶段五态互不相同」通过。

- [ ] **步骤 5：换季滤镜核对**

`storybook.ts:191-201` 的 `seasonFilters()` 是按"绿色叶片"检测的（`feColorMatrix` 的 `-3 5 -1` 系数），新植被若偏紫/青，滤镜可能匹配不到。运行 `node tests/seasons-browser.cjs`：
预期：PASS。若「四季植被互不相同」失败，按新主色调整该矩阵系数，保持"只染叶片不动主体"的意图。

- [ ] **步骤 6：Commit**

```bash
git add src/assets/storybook src/world/art/storybook.ts docs/art-2026-11-01 史莱姆.html
git commit -m "feat: 重画 36 种基础植物与发光花为地底植被"
```

---

## 任务 14：重画 items-a（16 项）

**文件：**
- 修改：`items-a*.webp`、`manifest.json`
- 创建：`docs/art-2026-11-01/production/items-a.png`

- [ ] **步骤 1：备份**

- [ ] **步骤 2：生成**

16 个图标：矿石、金属锭、蜂蜜（改荧菌蜜）、元素精华、星尘（改磷光尘）、捕捉网、经验药水、天材地宝（改晶体）、研究笔记、五条科技分支、家园等级旗、开垦路牌。透明背景、4×4、纯物品无底座。

提示追加：

```
Pure item icons on transparent background, no ground base, no grass.
Match the painting style of the decoration sheet: same brush scale, same palette.
```

- [ ] **步骤 3：裁切入库**

运行：`node scripts/prepare-home-art.mjs "<sharp 目录>" items-a`

- [ ] **步骤 4：验证**

运行：`npm run test:world && node tests/estate-browser.cjs`
预期：PASS；`ITEM_ICONS`（`storybook.ts:203`）16 个索引全部对应有效图块。

- [ ] **步骤 5：Commit**

```bash
git add src/assets/storybook docs/art-2026-11-01 史莱姆.html
git commit -m "feat: 重画 16 个物品与科技图标"
```

---

## 任务 15：重画 clouds-handpainted 与 nature-winter（9 项）

**文件：**
- 修改：`clouds-handpainted*.webp`、`nature-winter*.webp`
- 修改：`src/world/art/storybook.ts:47-50`（`cloudPalette`）
- 创建：`docs/art-2026-11-01/production/{clouds-handpainted,nature-winter}.png`

- [ ] **步骤 1：备份**

- [ ] **步骤 2：生成云**

6 朵，3 列 2 行，透明背景。换成菌洞迷雾：青灰偏紫的低层雾团，内部有不均匀的紫色微光。

```
Six distinct hand-painted cave mist masses, 3-column by 2-row grid, genuinely
transparent background. Cold blue-grey vapour with faint violet inner glow,
fully opaque painted centres. Generous transparent gutters, no touching.
```

- [ ] **步骤 3：生成冬树**

3 棵，透明背景。换成霜晶化的菌树：主干是白色晶体，菌盖结霜。

- [ ] **步骤 4：重排与裁切**

运行：`node scripts/repack-atlas.mjs "<sharp 目录>" ...`（若粘连），再 `node scripts/prepare-home-art.mjs "<sharp 目录>" clouds-handpainted nature-winter`

- [ ] **步骤 5：改 `cloudPalette` 基色**

`storybook.ts:47-50` 的 `base` 数组换成冷色：

```ts
export const cloudPalette=(season:number,dark:boolean)=>({
 base:(dark?['#101c26','#121a2b','#131c28','#101d2a']:['#6f8794','#6d8592','#708492','#6b8391'])[season],
 paint:`home-cloud-${season}-${dark?'night':'day'}`
});
```

- [ ] **步骤 6：同步白昼云亮度断言**

`tests/seasons-browser.cjs:37` 除 `rgb[2]>rgb[0]` 外还断言 `dayCloud.rgb[0]>150`——新冷雾基色 `#6f8794` 的红通道为 111，这条会失败。改为适配冷雾的下限，其余判据（`minAlpha===255`、`rgb[2]>rgb[0]`、6 种云变体、边缘图不超 96px、层级顺序）全部保留：

```js
check('day fog is opaque cold mist above the scenery',dayCloud.minAlpha===255&&dayCloud.rgb[2]>dayCloud.rgb[0]&&dayCloud.rgb[0]>90&&await ev(`document.querySelector('.home-cloud-texture').dataset.cloudPalette==='0-day'&&...`),dayCloud);
```

只改 `rgb[0]>150` → `rgb[0]>90` 这一处数值，检查名称里的 `blue-white hand-painted clouds` 相应改为 `cold mist`。

- [ ] **步骤 7：验证**

运行：`npm run test:world && node tests/seasons-browser.cjs`
预期：PASS。`storybook.test.mjs` 断言 6 朵云与 3 棵冬树各自独立，数量不变。

- [ ] **步骤 8：Commit**

```bash
git add src/assets/storybook src/world/art/storybook.ts tests/seasons-browser.cjs docs/art-2026-11-01 史莱姆.html
git commit -m "feat: 重画战争迷雾云与冬树，云色板换冷雾（同步云亮度断言）"
```

---

## 任务 16：全量回归与离线验证

**文件：** 无改动（只跑验证）

覆盖审查重点 5（离线）。

- [ ] **步骤 1：完整单元与世界测试**

运行：`npm test`
预期：全部通过。若 `typecheck` 失败，先修类型再继续。

- [ ] **步骤 2：八个浏览器套件**

运行：`npm run test:browser`
预期：841 项通过，浏览器异常 0。

- [ ] **步骤 3：smoke**

运行：`npm run smoke`
预期：235 项通过，耗时 85–88 秒区间。

- [ ] **步骤 4：五视口实拍**

运行 `node tests/home-browser.cjs` 与 `node tests/smoke-browser.cjs`，从 `tools/out/magic-ui/` 取 320×568、390×844、844×390、1440×900、1920×1080 五张家园截图，逐张看：棋盘感、路面接缝、建筑与地面是否同一套光、夜间能否分辨道路。

- [ ] **步骤 5：离线验证**

断开网络，双击 `史莱姆.html`，逐页切换六页 + 进家园 + 触发一次战斗。
预期：全部正常，无空白图、无请求失败。

- [ ] **步骤 6：体积核对**

运行：`(Get-Item 史莱姆.html).Length`
预期：≤ 20971520 字节（20 MB）。

- [ ] **步骤 7：帧率实测记录**

运行：`node tests/world-performance.cjs`
预期：普通庭院中位 ≥ 55 FPS，满庭院 ≥ 30 FPS；把实际数值记进任务 17 的文档。

- [ ] **步骤 8：Commit（若有修复）**

```bash
git add -A
git commit -m "fix: 全量回归中发现的幽暗地域适配问题"
```

---

## 任务 17：文档、快照与收尾

**文件：**
- 修改：`docs/art-2026-10-27/美术规范.md`、`CLAUDE.md`、`docs/art-2026-11-01/README.md`
- 创建：`backup/underdark-20261101/snapshot.json`

- [ ] **步骤 1：改写美术规范**

把 `docs/art-2026-10-27/美术规范.md` 整体改写：标题改为「家园美术规范 · 冷光菌洞」，色彩章节换成 8 个 `--lw-*` token 与语义约定，四季章节换成四种地下景象，新增「地形两层结构」一节（手绘底层 + 程序化细节层，含不透明度上限与会话 3.3 的分工说明）。

- [ ] **步骤 2：更新 `CLAUDE.md`**

改这几处：产品一句话描述（画风由"林间绘本"改"冷光菌洞"）、素材数量（231 项 + 5 张细节纹理）、验证入口（新增 `tests/terrain.test.mjs`、`tests/terrain-detail-browser.cjs`、`tests/palette.test.mjs`）、`src/world/art/storybook.ts` 与 `home-art.ts` 的职责描述、快照目录追加 `underdark-20261101`。

- [ ] **步骤 3：写 `docs/art-2026-11-01/README.md`**

记录：本次改造的 style baseline 提示词、19 张图集的生成记录与裁切坐标、`terrain-gen.py` 的使用方法与种子、实际验收数据（测试数、帧率、体积、渲染器）。

- [ ] **步骤 4：生成快照**

在 `backup/underdark-20261101/` 下保存改造前的 `src/world/`、`src/assets/storybook/`、`docs/art-2026-10-29/production/`，用脚本逐文件写 SHA-256 到 `snapshot.json`，并写 `README.md` 说明这是幽暗地域改造前的基线。

- [ ] **步骤 5：最终全量验证**

运行：`npm test && npm run test:browser && npm run smoke`
预期：全部通过。

- [ ] **步骤 6：Commit**

```bash
git add docs CLAUDE.md backup/underdark-20261101
git commit -m "docs: 美术规范改为冷光菌洞并归档改造前快照"
```

---

## 自检记录

**规格覆盖度**

| 规格章节 | 对应任务 |
| --- | --- |
| 3.1 视觉基线 / 色板 | 1、2 |
| 3.2 四季四景象 | 6、7、8 |
| 3.3 地形两层结构 | 5、6、7 |
| 3.4 全游戏界面统一 / 六主题 | 1、3、4 |
| 3.5 史莱姆边界 | 7（只加 CSS 滤镜，未改本体；任务 16 回归覆盖） |
| 3.6 制作管线 | 6、9–15 |
| 4 分期 | 任务 1–4=P0，5–8=P1，9–11=P2，12–15=P3，16–17=P4 |
| 5.1 继承闸门 | 16 |
| 5.2 断言口径变更 | 3、8 |
| 5.3 新增验收 | 4（一致性）、5（可复现）、7（不重复可见 + 帧率）、6 与 9（色板） |
| 5.4 交付物记录 | 6、9–15、17 |

**数量核对**：任务 9=32 项，10=48 项，11=18 项，12=48 项，13=49 项，14=16 项，15=9 项，加任务 6 的 11 项 = 231，与 manifest 实测一致。

**类型一致性**：`--lw-*` 的 12 个 token 名在任务 1、2、4 中拼写一致；`terrain-{moss,crystal,spore,frost,water}` 五个名称在任务 5、6、7 中一致；`data-home-terrain` 属性在任务 7 的测试与实现中一致。

**审查重点落实**：1→任务 4，2→任务 4，3→任务 7，4→任务 7，5→任务 16。
