# 浏览器测试底座与 smoke

面向维护者的操作手册：浏览器测试分几层、四模块各负责什么、机型与存档夹具怎么加、smoke 的断言口径、失败后从哪里读证据、白名单如何维护。

所有浏览器产物都写在被忽略的 `tools/out/magic-ui/` 下，不会进入提交。

## 分层

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 传输层 | `tools/out/lib/cdp.js` | 启动 headless Chrome、连接页面、CDP 求值、截图、触摸、写 JSON 报告。仍然只做这些，不认识设备档案、夹具和布局规则。 |
| 底座 | `tests/lib/browser/` | 四个模块：`session.cjs` 唯一持有 CDP 连接；`profiles.cjs`、`layout.cjs`、`fixtures.cjs` 是纯数据或纯函数，可脱离浏览器单测。 |
| 套件 | `tests/*-browser.cjs` | 各套件保留自己的检查名、条数与业务断言；只共享会话、设备指标、几何断言和夹具读取。 |
| smoke | `tests/smoke-browser.cjs` | 跨套件的集成自检：设备矩阵、六页几何、弹层、旧玩法交互、安全区探针、夹具读档与断言活力。 |

底座自身单测：`npm run test:harness`，即 `node --test tests/lib/browser/*.test.cjs`。

## 四模块接口

### session.cjs

`start(options) → Promise<session>`，启动浏览器、应用设备指标、注入夹具并导航。

| 选项/成员 | 说明 |
| --- | --- |
| `profile` | 必填，档案名或档案对象，交给 `profiles.resolve`。 |
| `url` | 必填，相对仓库根的本地路径（如 `史莱姆.html`）或 `file:`/`http:`/`data:` 地址。相对地址按仓库根解析。 |
| `seed` | 可选夹具名；用 `Page.addScriptToEvaluateOnNewDocument` 在导航前写入存档键。 |
| `gpu` | 默认 `true`，启用 GPU 合成，帧率类断言需要。 |
| `outDir` | 截图目录，默认 `tools/out/magic-ui/smoke`；相对路径按仓库根解析。 |
| `session.profile` | 当前生效档案，含 `name/width/height/dpr/mobile/touch/safeArea`。 |
| `session.ev(expression)` | 在页面求值并等待 Promise。 |
| `session.frame()` | 连续两帧 `requestAnimationFrame` 后返回，供布局稳定。 |
| `session.tap(selector)` | 鼠标点按元素中心；先展开祖先 `<details>`，再 `scrollIntoView`。 |
| `session.tapPoint(point, holdMs)` | 真实触摸点按。 |
| `session.touch` | 底层触摸：`start/move/end/tap/pan`。 |
| `session.metrics(profileOrName, overrides)` | 切换视口/DPR/移动标记/安全区，显式传四键 safeArea；返回新档案。 |
| `session.visit(target, { seed })` | 导航并等待 `S`、`readyState` 和新文档标记就绪。 |
| `session.shot(name)` | 截图到 `outDir`；带 `.png` 时按原样，否则补后缀。 |
| `session.consoleErrors` | 页面异常、`console.error/assert`、`Log.entryAdded(error)` 的收集数组。 |
| `session.close()` | 幂等关闭；启动/导航失败时 `start` 会先关闭再抛错。 |
| `session.client/userDir/port` | 逃生口，个别套件需要 `setEmulatedMedia`、`Network`、`Page.reload` 等原始命令。 |

会话内部持有唯一的 CDP 连接。套件不应再调用 `cdp.launch`；需要原始能力时用 `session.client`。

### profiles.cjs

`devices` 是按声明顺序排列的档案表，`groups` 把名字分组，`matrix({ group })` 返回按声明顺序过滤后的名字数组，`resolve(nameOrObject)` 补齐 `name/mobile/touch/safeArea`。

| 档案 | 尺寸 | DPR | ratio | 安全区 top/right/bottom/left | 组 |
| --- | --- | --- | --- | --- | --- |
| `se` | 320×568 | 2 | 16:9 | 0/0/0/0 | phones |
| `android-s` | 360×640 | 3 | 16:9 | 0/0/0/0 | phones |
| `iphone-se` | 375×667 | 2 | 16:9 | 0/0/0/0 | phones |
| `iphone-14` | 390×844 | 3 | 19.5:9 | 47/0/34/0 | phones |
| `pixel` | 412×915 | 2.625 | 20:9 | 0/0/0/0 | phones |
| `iphone-max` | 430×932 | 3 | 19.5:9 | 59/0/34/0 | phones |
| `fold` | 1080×2520 | 2.5 | 21:9 | 0/0/0/0 | phones |
| `land-568` | 568×320 | 2 | 16:9 | 0/0/0/0 | landscape |
| `land-844` | 844×390 | 3 | 19.5:9 | 0/47/21/47 | landscape |
| `land-932` | 932×430 | 3 | 19.5:9 | 0/0/0/0 | landscape |
| `tablet` | 768×1024 | 2 | 4:3 | 0/0/0/0 | tablets |
| `desktop-s` | 1440×900 | 1 | 16:10 | 0/0/0/0 | desktop |
| `desktop-m` | 1920×1080 | 1 | 16:9 | 0/0/0/0 | desktop |

- `ratio` 是给人看和报告用的屏幕比例标签，不参与计算；仍按实际宽高填写。
- `safeArea` 必须是四键对象，单位是 CSS px；无内缩也要显式写 `zero()`。`session.metrics` 会把它转成 `Emulation.setSafeAreaInsetsOverride`，smoke 再用页面侧 `env()` 探针核对，两者必须一致。
- `mobile` 由 `width < 1000` 推导，不在档案里手写；`touch` 缺省为 `true`，桌面档案显式 `false`。

### layout.cjs

`measure(session, selectors)` 把 DOM 量成纯数据快照；`assertAll(session, spec)` 组合全部断言并在失败时抛出带快照的错误。纯函数可单独测试，也方便套件按“固定 HUD / 滚动内容”拆开喂。

| 纯函数 | 判据 | 参数 |
| --- | --- | --- |
| `noOverflow(snapshot)` | 文档 `scrollWidth > 视口宽 + 1`；元素矩形非有限值、零面积或超出视口 1px 以上 | — |
| `noOverlap(snapshot, opts)` | 任意两元素矩形相交且两轴都大于 `minOverlap`；跳过同一路径父子关系和白名单 | `whitelist`、`ignore`、`minOverlap=1` |
| `aspectPreserved(snapshot, opts)` | 用元素 `naturalWidth/naturalHeight` 比渲染矩形宽高比，偏差超过容差即失败；缺失固有尺寸的元素跳过 | `tolerance=0.02` |
| `hitTargets(snapshot, opts)` | 渲染矩形的宽或高小于阈值即失败；零面积元素跳过 | `min=40` |
| `safeAreaFailures(snapshot)` | 元素矩形越过 `safeArea` 内缩边界即失败；使用 `measure` 写入快照的档案安全区 | — |
| `occlusionFailures(snapshot)` | 元素中心 `elementFromPoint` 命中的不是自身或后代即失败；`hitSelector` 为空时跳过 | — |

`measure` 快照字段：`viewport`（`width/height/scrollWidth/scrollHeight`）、`dpr`、`safeArea`、`elements[]`（`selector/tag/path/rect/naturalWidth/naturalHeight/scrollHeight/clientHeight/hitSelector/hitTag/hitPath`）。缺失的选择器会被**静默跳过**，所以 smoke 额外用页面侧计数核对 required selector。

`assertAll` 的 `spec` 支持 `selectors`、`whitelist`、`ignore`、`min`、`tolerance`，以及 `overlap/aspect/hit/occlusion/safeArea` 的开关（传 `false` 关闭）。失败错误带 `error.failures` 与 `error.snapshot`。

### fixtures.cjs

| 接口 | 说明 |
| --- | --- |
| `SAVE_KEY` | 正式存档键 `slimeSummonerSave`；夹具只写这个键，不碰 `_v5_backup` 等备份键。 |
| `list({ dir })` | 夹具名（去掉 `.json`），按文件名排序；目录不存在时视为空清单。 |
| `raw(name, { dir })` | 原文读取，保留文件字节，便于审查与稳定重生成。 |
| `seedSource(name, { dir })` | 生成可在 `Page.addScriptToEvaluateOnNewDocument` 执行的源码，只做 `localStorage.setItem`。 |

## 新增机型

只改 `tests/lib/browser/profiles.cjs` 一处：在 `devices` 末尾追加档案，再把名字追加到 `groups` 对应分组末尾。声明顺序就是 `matrix` 的顺序，追加可避免既有截图名和报告顺序漂移。

```js
// 2026-10-31 新增：393×852 竖屏，刘海 59 / Home 条 34
'iphone-15': { width: 393, height: 852, dpr: 3, ratio: '19.5:9', touch: true, safeArea: { top: 59, right: 0, bottom: 34, left: 0 } },
// groups.phones 末尾追加 'iphone-15'
```

约定：

- `ratio` 按实际宽高写，手机竖屏高度在前；它只用于阅读和报告。
- `safeArea` 四键齐全，顺序统一 `top/right/bottom/left`；无内缩写 `zero()`，不要省略。
- 不要手写 `mobile`；宽度阈值固定为 1000。触摸设备保留 `touch: true`。
- 八个浏览器套件各自维护固定视口清单，不会自动纳入新档案；`smoke` 用 `matrix({ group: 'all' })`，会自动多跑一档（启动、六页、覆盖、安全区、五交互，进入 `phones` 组还会多四个弹层态）。新增后同步更新本文与 `CLAUDE.md` 的条数和时长。

## 存档夹具

五份夹具在 `tests/fixtures/saves/`，由 `tests/fixtures/build.cjs` 生成。生成器用真实浏览器会话执行游戏内命令造状态，导出 `localStorage`，规范化后落盘，再反向读档校验；任何一步失败都会删掉刚写出的文件并以非零码退出，避免把不可用的夹具提交。

```powershell
node tests/fixtures/build.cjs                 # 五份全量重生成
node tests/fixtures/build.cjs mobile-orders   # 只重生成一份
```

生成流程：

1. 以 `iphone-14` 打开 `史莱姆.html`，用 `LivingWorld.execute` 造开局、设施、作物、研究、委托、出售等状态；所有材料都由命令真实扣除。
2. 固定身份与时间字段：`name=存档夹具`、`sysName=团子`、`sysLook`、`theme=sunset`、`taskDate=2026-01-01`、`planClock=0`；冻结档 `lastActive=0`，读档时游戏跳过离线补算。
3. `normalizeState` 把设施、品系、作物的实体 id 按出现顺序重排为递增序号，并同步种子库存键、暂存产出键、工作位、制作任务、居民目标和 `world.seq`；遇到尚未覆盖的 `trips/juveniles/crafts` 会直接报错，要求先扩展生成器。
4. 用 `canonical` 递归排序对象键后紧凑序列化，键顺序、缩进和空行不影响结果。
5. 反向校验：把新文件注入新会话读档，核对启动、存档版本、金币、地块数、无页内错误，以及每份夹具的特征值。

| 夹具 | 用途 | 特征值 |
| --- | --- | --- |
| `mobile-baseline` | 标准新档 | 4 块初始地块、0 项科技、0 株作物、4 座初始设施；`lastActive=0` 冻结 |
| `mobile-developed` | 完全发展的家园 | 24 块地全开、38 项科技全完成、4 株在长作物（进度 0.5/0.35/0.65/0.2）、6 座设施三档（form=3）、材料库存 3000 |
| `mobile-orders` | 研究/委托/出售路径 | 少 `cra-compost` 一项科技（37 项）、1 项研究进行中、完成 1 份委托、当日出售额 40、剩余委托数量回读一致 |
| `mobile-offline` | 离线补算 | `lastActive` 为固定 UTC 时间的 13 小时前，读档补算到 12 小时上限（43200–43320 秒），暂存产出 > 0 |
| `legacy-v5` | V5 迁移 | 5 块旧地块、0 项科技、小屋 level 3 / form 1、育苗床 level 2 / 无 form、1 株 legacy 作物、产生 `_v5_backup` 备份、委托计数补齐为 0 |

确定性要求：同一份生成脚本在一台机器上重复运行应得到相同字节。固定字段、排序键和实体重排就是为了这个；若重生成后 `git diff` 出现无法解释的差异，先检查游戏是否新增了随机源或未覆盖的实体类型，不要直接提交。

## smoke 结构与断言口径

`npm run smoke` 跑 `tests/smoke-browser.cjs`。当前共 **222 项**：

- 13 档设备各 9 项：启动自检（视口/DPR/页内错误）、安全区页面探针、六页（陪伴 `space`、家园、召唤、探索、背包、成长）各一项、页面覆盖汇总一项，合计 117。
- 9 档（七个手机竖屏 + `land-844` + `desktop-m`）各 4 个家园弹层态：建造栏、设施环形、植物面板、研究面板，合计 36。每个弹层检查容器存在与视口内、滚动容器、安全区元素、可点控件、遮挡、关闭后无残留、console 无增量。
- 13 档各 5 个旧玩法交互：接球、叠叠乐切换、战斗手动普攻、切换自动、撤退结算，合计 65；每个交互都核对 console 无增量。
- 另 4 项：`mobile-developed` 夹具读档、`legacy-v5` 迁移备份、`tap` 展开/滚动辅助、断言活力。

每页比较两层元素：固定 HUD（`.topbar`、`.tabbar`、家园工具栏等）参与全部断言；滚动内容只查横向溢出和兄弟压盖，因为 `.content` 纵向滚动时子元素越过视口底部是正常行为。`page coverage` 再核对六页都执行到、required selector 数量、测量元素总数（100）与 required 总数（98）。

每项检查在控制台输出 `PASS`/`FAIL` 行；结束时输出 `TIME <毫秒> ms` 和 `RESULT <通过>/<总数> smoke checks`。有失败时退出码为 1。

### 四类断言

| 类别 | 口径 |
| --- | --- |
| 显示（溢出） | 文档无横向滚动；元素矩形有限、非零面积、完整在视口内。滚动内容只判横向越界，允许纵向滚动。 |
| 比例 | 产品没有 `<img>`。`#content img` 实际为空，比例输入来自内联 `<svg>` 的 `viewBox` 和家园 `<svg><image>` 的 `width/height.baseVal`（用户单位）与渲染盒的宽高比，容差 2%。旧玩法页因此用 UI 图标的 viewBox 作为图片式输入。每页还有 `artMin` 下限，防止比例断言因没有输入而空转。 |
| 覆盖 | 测量元素两两求交，跳过父子关系与背景层白名单；再用中心点 `elementFromPoint` 判断可点性，命中自身或后代才算通过。滚动内容只做兄弟压盖，不做中心点可点性。 |
| 命中区 | 手机与横屏 40×40，桌面 32×32，平板按手机口径。`.home-stock` 是只读库存条，内部没有可点按钮，明确排除；其余不放宽。 |

### 安全区页面探针

只比对几何矩形还不够：还需要证明 CDP 的 insets 真的落到了 CSS `env(safe-area-inset-*)`。smoke 在每档页面注入一个零尺寸固定定位元素，用 `env()` 设置四边 padding，再读 `getComputedStyle` 的解析值，与 `session.profile.safeArea` 逐键精确比较；无内缩档案必须解析为 0。探针失败说明模拟没有生效，后续安全区断言即使全绿也不可信。

## 失败定位

先看控制台最后一段：`FAIL <检查名>` 后面通常跟具体原因和 `failures=<n>`。然后按名字去 `tools/out/magic-ui/smoke/` 找证据：

| 文件 | 内容与读法 |
| --- | --- |
| `results.json` | 全量结果：`checks[]`（`name/status/detail`）、`errors`、`durationMs`、`passed`、`total`。按检查名找到 `detail`；页面检查的 `detail.snapshot` 是几何快照，`detail.artSnapshot` 是比例输入，`detail.consoleErrors` 是本页新增错误。 |
| `failure-<档案>.json` | 单档汇总，`failures[]` 里按 `kind` 区分 `boot/page/overlay/legacy-ball/legacy-stack/.../profile`；页面失败内嵌快照与证据。启动失败、页面失败和交互失败会汇总到这里。 |
| `failure-<档案>-<场景>.json` | 弹层或交互失败会立即单独写一份，如 `failure-iphone-14-overlay-build.json`、`failure-iphone-14-legacy-ball.json`，打开即可看到该场景的 `problems`。 |
| `failure-<档案>-<页面>.png` | 页面断言失败时的截图，如 `failure-iphone-14-home.png`。 |
| `failure-<档案>.png` | 启动阶段失败（视口、DPR 或页内错误）的截图。 |
| `failure-<档案>-overlay-<弹层>.png` | 弹层态失败截图。 |
| `failure-<档案>-legacy-<交互>.png` | 旧玩法交互失败截图，如 `failure-iphone-14-legacy-ball.png`。 |
| `failure-mobile-developed.png` / `failure-legacy-v5.png` | 夹具读档与迁移失败截图。 |
| `failure-liveness.json` / `failure-tap-assist.json` | 断言活力或 tap 辅助失败；这两项没有截图。 |

定位顺序：先读 `results.json` 中同名检查的 `detail.problems`/`detail.failures`，再对照 `snapshot.elements[].rect` 与 `viewport` 判断是真实越界还是断言口径问题；截图只用来确认视觉表现。失败 JSON 里的 `target`、`containerRect`、`controls`、`safe` 足以区分“没打开”“打开越界”“被遮挡”“关闭残留”。

正常运行的抽样截图在 `tools/out/magic-ui/smoke/<档案>/` 下，每档两张：家园页和轮换的一张旧玩法页。

## 白名单维护

白名单集中在 `tests/lib/browser/layout.cjs` 顶部的 `WHITELIST`，当前只有背景层：

```js
const WHITELIST = [
  ['.map', '*'],      // 地图是背景层，允许被任意 HUD 覆盖
  ['.home-map', '*'], // 家园地图同理
];
```

规则：

- 只在白名单里声明，禁止在套件脚本里散写 `a === ...` 特判或内联忽略列表。
- 每条必须带一行理由，说明为什么这个压盖是设计允许的；`['*', x]` 只用于背景层，HUD 之间的压盖仍要报出来。
- 套件如需临时追加，用 `assertAll({ whitelist })` 或 `noOverlap(snapshot, { whitelist })` 传入，并在同一处写理由；不要修改全局表来迁就单个页面。
- 布局调整后重新确认每条是否仍必要；能删就删。遮罩造成的不可点由 `occlusionFailures` 判定，不能用白名单掩盖。

## 实测时长

以下为本机（Windows，headless Chrome，GPU 合成）当前实测：

- `npm run smoke`：84.4 秒（`TIME 84399 ms`）。
- `npm run test:browser`（八个套件 + smoke）：247.6 秒，约 4 分 8 秒。
- 八个套件依次为 54、62、283、43、222、60、30、87 项，合计 841 项；加 smoke 222 项，共 1063 项浏览器检查。

时长随机器与加载情况波动，判断回归时以 `RESULT` 全通过和退出码 0 为准，不以固定秒数为门槛。
