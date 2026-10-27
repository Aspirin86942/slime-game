# CLAUDE.md

## 当前开发入口（生活世界扩展）

2026-10-27 已按负责人要求采用模块化源码和 TypeScript。`史莱姆.html` 是生成的单文件产品，修改源码后运行 `npm run build`；下文关于“没有构建”和“全部顶层脚本”的描述仅适用于旧版。

- 新系统：`src/world/`，strict TypeScript，规则/内容/存档/生态/绘制/界面分离；`src/legacy/` 保留旧玩法 JavaScript 兼容分区，按编号合并；`src/shell.html` 保留基础页面。
- 当前存档版本 3，旧数据额外备份到 `slimeSummonerSave_v2_backup`。保存前比较原始快照；其他标签页变更会停止本页推进。未知高版本与坏档禁止覆盖。
- 阅读 `docs/living-world/SPEC.md`、`PLAN.md`、`QA.md`。先 SPEC 后 PLAN 的顺序已经完成。
- `npm test`：类型检查、单文件构建、新规则与内容、原 68 项、合体成长、原生接口集成。
- `npm run test:browser`：新系统正常模式、触屏拖放、刷新、断网、迁移、失败保护。`node tests/world-performance.cjs`：家园密集场景帧率，报告会记录实际渲染器。
- 原始基线仍禁止修改。负责人已经授权果冻质感与攻击表现升级，新增材质层在 `src/world/style.css`；旧造型函数和基础 CSS 块保留。
- 本次详情见根目录 README；不自动提交、推送或发布。

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概况

手机端单文件网页游戏「最强召唤师系统」（史莱姆牧场）。零外部资源：没有构建、依赖、图片、音频或服务器，浏览器直接打开 `史莱姆.html` 即可玩。仓库目录名带 `python`，但项目里没有 Python 代码。

- `史莱姆.html` —— **唯一的产品文件**。约 8200 行，样式与脚本都内置在文件中。
- `史莱姆（打击版）.html` —— 旧的「打击版」变体，作为战斗观感的参照保留，不再维护。
- `backup/史莱姆-<时间戳>-<块名>.html` —— 历次改动前的快照，回退就是把快照覆盖回 `史莱姆.html`。
- `tests/baseline-original.html` —— 升级前的原稿，测试用它做「造型未改动」比对，并校验它自身的 SHA-256。**禁止修改**（`.gitattributes` 已对它和 `backup/*.html` 设置 `-text`，保留原始字节）。
- `docs/upgrade-2026-10-27/` —— 升级交付包的 SPEC / PLAN / QA 文档；`集成说明.md` 记录集成时的修正、被删除的功能和尚未覆盖的验证。`docs/superpowers/` 是打击感 / FX 改动的规格与计划。

## 命令

全部在项目根目录运行。

```sh
# 游戏逻辑回归（Node VM 执行真实游戏 JS，DOM/计时器是模拟的，不算浏览器验收）
node tests/review-tests.cjs            # 68 项，末行 RESULT 68/68
node tests/merge-growth.cjs            # 合体/成长专项，全部 assert 通过则打印一行 PASS
node tests/balance-sim.cjs --check      # 200 个种子/格，26,400 场战斗 + 经济/成长检查
node tests/gameplay-browser.cjs        # 独立 Chrome：召唤、离线重载、首领、扫荡与截图

# 浏览器内自检（页面自带 42 项检查，经 CDP 驱动 headless Chrome）
node tools/out/selftest.js             # 末行 TITLE: PASS 42/42；有失败或超时时退出码非零
```

`review-tests.cjs` 没有单项过滤参数；只想跑一项时，临时在脚本里注释掉其他 `check(...)`，或者直接读输出里对应的 `PASS`/`FAIL` 行。共享夹具在 `tests/lib/vm-harness.cjs`，一次编译、每场使用独立状态与可推进时钟。它可以传入别的 HTML 路径：`node tests/review-tests.cjs <file.html>`。

全部验收入口（美术布局、触控、存档迁移、截图、帧率）和战斗画面诊断脚本见 `tools/README.md`。其中 `auto-harness.js`、`bisect.ps1`、`r-auto.ps1`、`review-run.ps1`、`shots.js` 只作历史参考，不用于验收当前版本。截图和帧率脚本即使正常退出，也要查看生成的图片或报告，才能判定效果正确。

**跨平台**：所有浏览器脚本统一从 `tools/out/lib/cdp.js` 取 `CHROME`（按系统自动查找，环境变量 `CHROME_PATH` 可覆盖）和 `fileUrl(file, query)`（本地路径 → `file://` 地址）。新脚本不要写死浏览器路径，也不要手工拼 `'file:///' + path`，在 Linux 上会拼出四个斜杠。`tools/selftest.ps1` 依赖 PowerShell，是 Windows 专用的旧入口。脚本输出（截图、报告 JSON）写到 `tools/out/`，已在 gitignore 里。

## 诊断模式（URL 参数）

| 参数 | 作用 |
|---|---|
| `?selftest=1` | 运行页内 `CHECKS-START` … `CHECKS-END` 之间的检查，把结果写进 `<pre id="selftestOut">` |
| `?gallery=1` | 画廊样张，供截图 |
| `?battle=1` / `?battle=step` / `?battle=ui` | 直接开一场插话式 / 逐回合战斗 / 只挂钩子不开战 |
| `?fps=1`（可加 `&fx=off`） | 帧率采样 |

上面任一参数都会让 `DIAGNOSTIC_MODE` 为真，此时 `save()` 直接返回，不写 `localStorage`。所以浏览器测试的数据夹具要么在内存里改 `S`，要么先直接写 `localStorage` 再以普通模式重载页面。

## 架构（`史莱姆.html` 的 `<script>`）

全部是顶层脚本，没有模块。用 `/* ==== 标题 ==== */` 注释分区，按标题搜索比按行号定位可靠。

- **全局状态 `S`**（`const S = {...}`）：整个游戏状态都在这一个对象里，存档就是 `JSON.stringify(S)`。`SAVE_DEFAULTS` 在载入前对 `S` 做深拷贝。
- **游戏数值与闭环**：当前规则和模拟验收见 `docs/gameplay-2026-10-27/数值设计.md`。敌人使用 `makeAbyssMonster` 和共同成长公式；攻击用 `attackPower`，伤害经 `mitigation`，不再有魔物属性 ×2。首通/重复结算共用 `calculateBattleRewards`，扫荡单独限制每日 3 次。
- **派遣时间**：`advanceWorld` 统一在线恢复、派遣与离线补算；`settleOffline` 最多结算 12 小时。`planClock` 保存 12 秒行动周期的进度，`lastActive` 记录保存时间。静默补算不进行中途保存；场景拾取动画不再额外发奖。
- **存档**：键 `slimeSummonerSave`，当前 `saveVersion:2`。`load()` 先用 `validSaveData()` 校验（拒绝越界数字、重复 ID、`__proto__` 等键），校验失败就设置 `persistenceBlocked`，停止所有写入，并弹出「存档保护」弹窗（唯一出路是 `resetSave`）。首次从 v1 迁移时，把原始字节写进 `slimeSummonerSave_v1_backup`。游戏性字段 `summonPity`、`sweepUsed`、`lastActive`、`planClock` 均有默认值与校验。**新增 `S` 字段时**，要同时考虑 `SAVE_DEFAULTS` 的补齐和 `validSaveData` 的校验，避免旧档被判为坏档。存档导出/导入功能已按负责人要求删除，不要加回来。
- **界面**：`switchTab(t)` → `renderTab()` 按标签页重绘 `#content`。所有点击都走一个委托监听器：`document.addEventListener('click', ...)` 里按 `data-act` 分派的 `switch`（「事件委托」分区）。新按钮写 `data-act="xxx"` 并在这里加 `case`，不要单独绑监听器。
- **战斗**：`startAbyssBattle(options)` 是一个很大的闭包。战斗状态 `B`，以及 `nextTurn`、`playerCast`、`performAction`、`dealDamage`、`handleUnitDeath` 等函数都是它的局部变量，外部取不到。自检通过 `window.__TEST__._battle`（只在诊断模式下赋值）拿到这些内部函数。新增需要测试的战斗内部函数时，把它加进这个钩子对象。
- **FX 门面**（`const FX = {...}`）：震屏、闪白、飘字、死亡、粒子爆散。闪白作用在 `.breath` 上，因为战斗中的 `.slime` 已经被 `scale(.36)` 缩小过。
- **CSS 分层**：样式表靠后追加的规则覆盖前面的规则，没有就地改旧规则。最后一层是「双月浮岛」设计层：`--font-display`（标题、伙伴名、剧情旁白用宋体）、`--panel-edge`、导航新月标记、开场和深渊场景。夜空插画由 JS 函数 `skyArt(kind)`（开场 / 战斗共用）和 `arenaIsle()` 生成，SVG 渐变 id 用 `sceneArtId` 计数，保证同页不重复。
- **测试钩子 `window.__TEST__`**：在文件末尾的 `selftestBoot()` 里定义。`__TEST__.startBattle({elements, level, monsterLevel, speed, seed})` 会造出队伍并开一场可控战斗，Node 回归和浏览器脚本都依赖它。

## 修改约束

- **史莱姆造型 CSS 冻结**：`review-tests.cjs` 断言 `.slime{--sz:1;` 到 `\n.mon-badge{` 之间的 CSS 与基线原稿逐字一致。改史莱姆外观会让这项测试失败；需要改时先和用户确认。
- `merge-growth.cjs` 按源码中的锚点截取代码段：`function growthStat(` … `function buyItem(`，`let mergeSel = [];` … `function openPlan(`。重命名或挪动这些函数会让测试失效。
- 改动较大前，先在 `backup/` 存一份带时间戳的快照（项目一直这样做）。
- 目标设备是 390×844 的手机竖屏（`#app` 最大宽度 480px）。排版改动要检查窄屏下的横向溢出和文字被挤成多行。
