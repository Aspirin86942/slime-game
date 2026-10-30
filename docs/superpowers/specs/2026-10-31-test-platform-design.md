# 浏览器测试平台与手机端 smoke 设计（2026-10-31）

## 1. 背景与目标

游戏主要服务手机端用户。现有浏览器验收覆盖了五种视口、六种主题、三种安全区，但存在三个结构问题：

1. **没有共享底座**。8 个 `tests/*-browser.cjs` 共约 136 KB，每个文件都各自复制 `check`、`tap`、`frame`、`metrics`、几何测量与控制台错误收集；公共模块 `tools/out/lib/cdp.js` 只有 161 行，仅负责启动、求值、截图、触摸，没有布局断言、没有设备档案、没有夹具加载。
2. **视口口径分散**。`home-browser.cjs` 手写 5 个视口，`theme-browser.cjs` 手写 5×3×6，`mobile-home-browser.cjs` 另写 5×3 加 4 种设备安全区，比例（16:9 / 19.5:9 / 20:9 / 21:9）没有任何地方被当作一等概念，长屏机型与超宽机型的“底栏被顶掉”“地图留白”问题没有稳定的自动判红手段。
3. **没有夹具体系**。仓库只有 `tests/fixtures/save-v3.json`（供 VM 测试使用）；所有浏览器测试都是启动后在页内直接改 `S` 再造状态，因此「读档 → 校验 → 迁移」这条真实路径在浏览器层从未被覆盖。另外缺少一个几十秒级的快速入口：全量浏览器回归需要约 2 分 46 秒。

目标：

- 建立可分层的浏览器测试底座（设备档案、几何断言、夹具加载），让手机端比例 / 显示 / 覆盖问题能被自动判红，而不是靠人看截图。
- 建立可重复生成的存档夹具，让浏览器测试走真实读档路径，并覆盖 V5 迁移。
- 新增覆盖全应用与旧玩法的手机 smoke，目标时长 ≤ 90 秒。
- 把 8 个既有浏览器脚本迁移到底座上，检查条数不降、名称不变。

## 2. 非目标

- 不改产品代码（`src/`、`史莱姆.html` 不在本次范围内）。
- 不做像素基线对比。判定只做几何 / 布局断言，截图仅存档供人工复核。
- 不引入 Playwright、Puppeteer 或任何新依赖，继续使用 Node 内置能力与自研 CDP。
- 不覆盖非 Chromium 内核。iOS Safari 只通过 CDP 的设备尺寸、DPR、安全区模拟来近似，不宣称真实 Safari 验证。
- 不改 `史莱姆-参考.html`、`tests/baseline-original.html`。

## 3. 现状证据

| 项 | 现状 |
| --- | --- |
| 浏览器脚本 | 8 个 `*-browser.cjs`，共约 136 KB，助手代码重复 8 份 |
| 公共底座 | `tools/out/lib/cdp.js`（161 行，已跟踪）：`launch` / `ev` / `shot` / `touch` / `center` / `report` / `makeChecker` |
| 视口矩阵 | 分散在各脚本，最小 5 视口，最大 5×3×6 组合 |
| 夹具 | 仅 `tests/fixtures/save-v3.json`，只被 VM 测试使用 |
| 浏览器层读档覆盖 | 无（状态一律页内构造） |
| 全量时长 | 约 2 分 46 秒（841 项检查） |

可行性探针（2026-10-31，在 `%TEMP%\slime-probe\` 执行，产物不入仓）：

1. `file://` 下 `Page.addScriptToEvaluateOnNewDocument` 能在页面脚本执行前写入 `localStorage`（探针键写入并回读成功，无异常）。
2. 由真实会话导出的合法 v5 存档作为夹具注入后，游戏按真实 `load()` 路径读入，特征值精确匹配（`coins` 3000、`estate.plots` 4），未产生迁移备份。
3. 结构不完整的存档会被校验拒绝并重置为默认状态。结论：夹具必须由游戏自身产出，手写 JSON 不可行。

## 4. 架构

### 4.1 目录

```
tests/lib/browser/
  session.cjs    唯一持有 CDP 连接的模块
  profiles.cjs   纯数据：设备档案、安全区预设、矩阵展开
  layout.cjs     纯函数 + 断言：测量、溢出、遮挡、比例、命中区、安全区
  fixtures.cjs   夹具读取与导航前注入
tests/fixtures/
  build.cjs      夹具生成器（从真实会话导出并规范化）
  saves/*.json   夹具本体
tests/smoke-browser.cjs   手机 smoke 套件
```

依赖方向单向：`layout` 与 `profiles` 不认识浏览器，只处理数据与表达式字符串；`session` 依赖 `tools/out/lib/cdp.js`；`fixtures` 在读模式下只依赖 `fs`，在生成模式下才依赖 `session`。`tools/out/lib/cdp.js` 保持现状，不扩充职责。

### 4.2 `session.cjs`

```js
const { start } = require('../tests/lib/browser/session.cjs');
const s = await start({
  profile: 'iphone-14',          // profiles 中的档案名或现成对象
  url: '史莱姆.html?battle=ui',   // 相对仓库根
  seed: 'mobile-developed',      // 可选夹具名：start 传入则对本会话后续所有导航生效
  gpu: true,
  outDir: 'tools/out/magic-ui/smoke'
});
```

方法：

| 方法 | 语义 |
| --- | --- |
| `ev(expr)` | 求值，异常带表达式上下文（沿用 `cdp.js` 的报错格式） |
| `frame()` | 等两帧（`requestAnimationFrame` × 2） |
| `tap(selector)` | 解析矩形后派发鼠标按下/抬起，失败时明确报“元素缺失” |
| `tapPoint({x,y})` / `touch` | 透传触摸原语 |
| `metrics(profile)` | 应用设备指标与安全区后等一帧 |
| `visit(url, { seed? })` | 导航并等待 `typeof S !== 'undefined'`；`seed` 在导航前注入夹具 |
| `shot(name)` | 截图到 `outDir/<name>.png` |
| `consoleErrors` | 已捕获的异常 / `console.error` / Log error 数组 |
| `close()` | 幂等关闭：断开连接、杀进程、删临时配置目录 |

约定：

- 启动即订阅 `Runtime.exceptionThrown`、`Runtime.consoleAPICalled`（error/assert）、`Log.entryAdded`，脚本不再各写一遍。
- 失败处理统一：套件 `catch` 中先 `shot('failure')` 再 `close()`，最后由断言层决定进程退出码。

### 4.3 `profiles.cjs`

```js
devices = {
  se:          { width: 320,  height: 568,  dpr: 2,    ratio: '16:9',    mobile: true, touch: true, safeArea: none },
  'android-s': { width: 360,  height: 640,  dpr: 3,    ratio: '16:9',    ... },
  'iphone-se': { width: 375,  height: 667,  dpr: 2,    ratio: '16:9',    ... },
  'iphone-14': { width: 390,  height: 844,  dpr: 3,    ratio: '19.5:9',  safeArea: { top: 47, bottom: 34 } },
  pixel:       { width: 412,  height: 915,  dpr: 2.625,ratio: '20:9',    ... },
  'iphone-max':{ width: 430,  height: 932,  dpr: 3,    ratio: '19.5:9',  safeArea: { top: 59, bottom: 34 } },
  fold:        { width: 1080, height: 2520, dpr: 2.5,  ratio: '21:9',    ... },
  'land-568':  { width: 568,  height: 320,  dpr: 2,    ratio: '16:9',    mobile: false, touch: true },
  'land-844':  { width: 844,  height: 390,  dpr: 3,    ratio: '19.5:9',  safeArea: { left: 47, right: 47, bottom: 21 } },
  'land-932':  { width: 932,  height: 430,  dpr: 3,    ratio: '19.5:9',  ... },
  tablet:      { width: 768,  height: 1024, dpr: 2,    ratio: '4:3',     mobile: false },
  'desktop-s': { width: 1440, height: 900,  dpr: 1,    ratio: '16:10',   mobile: false },
  'desktop-m': { width: 1920, height: 1080, dpr: 1,    ratio: '16:9',    mobile: false }
};
matrix({ group })  // 'phones' | 'landscape' | 'tablets' | 'desktop' | 'all'
resolve(nameOrObject)
```

每个档案跑两组安全区组合：档案自带安全区、以及清零安全区。游戏自身顶栏高度（`S.notchHeight` 的 0 / 0.7 / 1.5）只在 smoke 中抽样三档，不进入完整矩阵，避免组合爆炸。

### 4.4 `layout.cjs`

纯函数负责测量与计算，`assert*` 负责抛错。

| 函数 | 判定口径 |
| --- | --- |
| `snapshot(s, selectors)` | 返回 `{ viewport, dpr, safeArea, overflowX, elements: [{ selector, rect, tag }] }` |
| `noOverflow(snap)` | `documentElement.scrollWidth ≤ innerWidth + 1`，且目标元素不越界，宽高不为 0 / NaN |
| `noOverlap(snap, { ignore })` | 「必须可见」元素两两相交超过 1px 即失败；忽略父子/祖孙关系与显式白名单 |
| `aspectPreserved(snap, imgSelectors, tolerance = 0.02)` | 图片 `naturalWidth/naturalHeight` 与渲染矩形比例误差 ≤ 2%；SVG 需 `preserveAspectRatio !== 'none'` 且 viewBox 比例误差 ≤ 2% |
| `occluders(snap)` | 对每个「必须可点」元素，`elementFromPoint`（矩形中心）必须命中自身或其子代；被遮罩、云霭或其它浮层挡住即失败 |
| `hitTargets(snap, { min })` | 触摸目标 ≥ 40×40 CSS px（手机档）、≥ 32（桌面档） |
| `withinSafeArea(snap)` | 控件矩形不进入档案安全区 |

白名单（允许重叠的浮层对、允许被遮挡的装饰层）集中声明在 `layout.cjs` 顶部常量，禁止各脚本内散写。

### 4.5 `fixtures.cjs` 与夹具

夹具清单：

| 文件 | 内容 | 用途 |
| --- | --- | --- |
| `mobile-baseline.json` | 走完开场、零建设、默认 4 块地 | 新档形态与首屏布局 |
| `mobile-developed.json` | 全地块 + 全科技 + 多座设施三档形态 + 作物带在长 | 家园密集态布局与遮挡 |
| `mobile-orders.json` | 研究队列 / 委托 / 集市进行中 | 进行态文案与进度条布局 |
| `mobile-offline.json` | `lastActive` 前移 12h+ | 离线结算展示 |
| `legacy-v5.json` | V5 旧档（旧地块、`form < level`） | 读档迁移与备份路径 |

生成（`tests/fixtures/build.cjs`）：

1. 用 `session` 启动游戏，执行开场与需要的游戏内命令（`finishStory`、`doSummon`、`LivingWorld.execute` 等）。
2. 导出 `localStorage.getItem(SAVE_KEY)`，规范化：固定 `name`、`lastActive`、`planClock`；伙伴与设施 id 改为递增序号；去除随机字段。
3. 写盘前反向校验：重新注入该 JSON 并断言 `S.started === true` 且特征值回读一致，否则生成失败。
4. 重跑生成器应产出逐字节相同的文件（时间字段已固定），便于审查 diff。

加载（`fixtures.cjs`）：

```js
await s.visit(fileUrl('史莱姆.html', '?battle=ui'), { seed: 'mobile-developed' });
// 内部：Page.addScriptToEvaluateOnNewDocument 写入 slimeSummonerSave，再 navigate
```

夹具体积约 10 KB/档，五档约 50 KB，可入仓。

## 5. smoke 套件

`tests/smoke-browser.cjs`：

- 单浏览器实例，按档案 `metrics()` 切换，不重启；顺序为手机竖屏组 → 横屏组 → 平板/桌面组。
- 每个档案覆盖：
  - 六个导航页：陪伴、家园、召唤、探索、背包、成长；
  - 家园四个弹层态：建造栏、设施环形按钮、植物面板、研究面板；
  - 旧玩法最小交互：接球点击、堆叠切换、战斗手动、战斗自动、战斗撤退。
- 每屏四类断言：溢出、比例变形、遮挡、命中区；家园密集态额外跑安全区断言。
- 输出：`tools/out/magic-ui/smoke/<档案>/` 下截图与 `results.json`；失败时附几何快照；截图按档案抽样（每档案一屏）以控制时长。

规模预估：13 档案 × 约 10 屏 ≈ 130 屏 × 4 类断言，目标 ≤ 90 秒，实测后校准并在 `TEST-HARNESS.md` 记录实际数值。

## 6. 迁移策略与等价验收

顺序（每步单独验证，不一次性推平）：

1. 落地 `session` / `profiles` / `layout`（纯新增，旧脚本不动）。
2. `smoke-browser.cjs` 跑通。
3. 迁移 `home-browser.cjs`（54 项）。
4. 迁移 `theme-browser.cjs`（283 项，矩阵最密）。这两步通过即可认为底座接口够用。
5. 迁移其余 6 个：`mobile-home-browser.cjs`、`building-forms-browser.cjs`、`home-actions-browser.cjs`、`estate-browser.cjs`、`seasons-browser.cjs`、`reference-browser.cjs`。
6. 全量 `npm run test:browser` 回到 841 项 + smoke。

等价验收：

- 迁移前固化一份检查名称基线（当前 841 条），每迁一个脚本比对一次名称集合；条数不得减少，名称不得改变。
- 允许的 diff 仅三类：删除本地助手、替换为底座 import、把视口循环改为遍历 `profiles`。断言逻辑不得改变。
- 报告路径与文件名维持现状（`tools/out/magic-ui/<suite>/`），便于历史对照。

## 7. 运行入口与文档

| 入口 | 命令 | 内容 | 目标时长 |
| --- | --- | --- | --- |
| 快速 smoke | `npm run smoke` | 13 档案 × 6 导航页 + 家园弹层 + 旧玩法最小交互 | ≤ 90 秒 |
| 全量浏览器 | `npm run test:browser` | 8 个迁移后套件 + smoke 串联 | 约 4 分半（2:46 + smoke 实测） |
| 无头单测 | `npm test` | 不变：类型检查 + 构建 + 104 + 48 + 10 | 约 1 分钟 |

- 新增 `docs/living-world/TEST-HARNESS.md`：底座接口、如何新增机型、夹具生成与更新、失败定位步骤。
- 更新 `CLAUDE.md`「验证入口」段：记录 smoke 入口、底座与夹具位置、当前检查条数。
- 项目约定不自动提交，规格与后续改动由用户决定何时入库。

## 8. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 迁移期间基线与断言悄悄漂移 | 名称集合自动比对，diff 只允许三类改动 |
| 夹具生成依赖游戏内部命令，升级后失效 | 生成器带反向校验；命令集中在 `build.cjs` 一个文件，接口变化只改一处 |
| 遮挡白名单误报或漏报 | 白名单集中在 `layout.cjs` 常量，评审时逐条核对 |
| 90 秒目标被截图与长屏档案拖慢 | 截图按档案抽样；矩阵不重复截图；实测后记录真实时长 |
| 安全区模拟与真机差异 | 文档中明确：CDP 模拟只覆盖尺寸/DPR/insets，不宣称等同真机渲染 |

## 9. 完成标准

1. `npm run smoke` 全 PASS 且时长 ≤ 90 秒（以实测记录为准）。
2. `npm run test:browser` 全部通过，检查名称集合覆盖原 841 项且不减少。
3. `npm test` 保持通过。
4. 五份夹具入仓，`node tests/fixtures/build.cjs` 可重复生成且结果稳定。
5. 8 个浏览器脚本不再各自复制助手，视口矩阵统一来自 `profiles.cjs`。
6. `docs/living-world/TEST-HARNESS.md` 与 `CLAUDE.md` 更新完成。
7. 不新增依赖，运行时输出仍全部落在忽略目录，`git status` 保持干净。
