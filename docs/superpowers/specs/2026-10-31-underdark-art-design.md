# 幽暗地域美术改造设计（2026-10-31）

> 一句话：把家园从「林间绘本」重画为「冷光菌洞」，并以它为全游戏唯一的画风基准；同时把 `地形纹理.html` 的程序化纹理接成地图细节层。

## 1. 背景与目标

### 1.1 现状

游戏是单文件离线网页游戏，界面分两套互不相干的视觉体系：

| 层 | 当前实现 | 性质 |
| --- | --- | --- |
| 家园地图 | 手绘绘本素材：连续水彩草地 `ground-*.webp`、`paths` 路面图集、177 件透明物件 | 暖色、日光、奶油纸 + 苔绿 |
| 六个页面 + 战斗 | 深紫魔法风：`--bgTop/--accent/--panel` 等 6 套主题变量 | 暗色、冷光、玻璃质感 |
| 家园面板 | `--surface-solid` 7 组色值 + 毛玻璃 | 奶油纸不透明底 |

两套体系并存，是"画风不统一"的结构原因：玩家从家园切到召唤页，材质、光源方向、色彩温度全部跳变。

### 1.2 目标

1. 以**幽暗地域（冷光菌洞）**为新画风基准：青蓝岩壁、紫色荧光菌、冷白晶簇，无日光，照明全部来自生物与矿物。
2. **全部手绘素材重画**（用户明确选择方案 2），使家园成为全游戏画风的定义者。
3. 把 `地形纹理.html` 的四个程序化生成器（草坪/土地/石板/水面）接成地图**细节层**，与手绘底层两层合成。
4. 六个页面、战斗界面、家园面板统一到同一套色板 token，四套主题统一为菌洞同族。
5. 交付仍是单文件 `史莱姆.html`，离线可用、无外部资源、无运行时依赖。

### 1.3 非目标

- 不改玩法、数值、存档结构、`saveVersion`（保持 5）。
- 不改布局、交互路径、导航结构、视口适配策略。
- 不改史莱姆形体、表情、元素造型（以 `史莱姆-参考.html` 为基线冻结）。
- 不改 `史莱姆-参考.html`、`tests/baseline-original.html`（后者有 SHA-256 断言 `60a7b01f…`）。
- 不引入 Playwright / Puppeteer / sharp 作为产品依赖；不引入网络请求。

## 2. 现状证据（实测）

### 2.1 素材清点

由 `src/assets/storybook/manifest.json` 统计，共 **231 项**：

| 图集 | 图块 | 内容 |
| --- | --- | --- |
| facilities-a | 16 | 基础经营设施 |
| facilities-b | 16 | 10 设施 + 6 自然物（树/果树/丛/石/花/芦苇） |
| facilities-c / d / e | 16 每张 = 48 | 24 设施 × 2、3 级形态 |
| facilities-f / g | 9 每张 = 18 | 6 资源建筑 × 3 级 |
| decor-a / b / c | 16 每张 = 48 | 42 件装饰 |
| plants-a / b / c | 16 + 17 + 16 = 49 | 36 基础植物 + 发光花 + 生长阶段 |
| items-a | 16 | 物料、科技分支、等级旗、开垦牌 |
| paths | 6 | 6 种路面平铺纹理 |
| clouds-handpainted | 6 | 战争迷雾云朵 |
| nature-winter | 3 | 冬季树木 |
| ground + ground-spring/summer/autumn/winter | 5 | 整幅无缝地面（1536×1024） |

图集统一 1254×1254（16 格 4×4 或 9 格 3×3），整幅地面 1536×1024（3:2）。云图集 1920×1280，冬树 2832×944。

### 2.2 渲染链路

- `src/world/home-art.ts:39-42`：`ground-<season>.webp` 用 `<pattern>` 铺满 36×24 格并外扩 3 倍覆盖镜头边距；同位置再叠一层 `groundTint` 色矩形（`opacity: .46`，雪季 `.12`，夜间 `.2`）。
- `src/world/home-art.ts:52-59`：道路为逐格 `<rect fill="url(#home-road-N)">`，`src/world/art/storybook.ts:236-245` 生成 6 种 104×104 pattern。
- `src/world/ecology.ts:5-11`：`season()` 每 25200 clock 单位换季（4 档），`dayPhase()` 每 3600 内分 dawn/day/dusk/night，`night()` 判定 2400 之后。
- `src/world/art/kit.ts:43-52`：共享色板 `PAL`（木/石/灰泥/叶/水/光/星/屋顶 6 色/墨/高光）。
- `src/world/art/storybook.ts:191-201`：`seasonFilters()` 生成 4 组 `feColorMatrix` 叶色滤镜 + 雪帽滤镜 + 16 组云色滤镜。
- `src/world/home.css:1-8`：`--surface-solid` 定义 7 组（`id` 默认 + 6 主题 + `sky`），`src/shell.html:14-18` 与主题块定义 `--bgTop/--bgMid/--bgBot/--accent/--panel/--border/--text`。
- `src/legacy/01-tools-content.js:10`：`THEMES` 6 项，`id` 为 `sunset/dark/light/peach/mint/lavender`，默认 `S.theme='sunset'`（`src/legacy/02-state-stats.js:1`）。

### 2.3 关键性能与既有断言

| 断言位置 | 内容 |
| --- | --- |
| `tests/home-browser.cjs:103` | 夜间 `.home-tools` 背景 `rgb(20, 26, 42)`、`.home-season`/`.tabbar button` 颜色 `rgb(126, 138, 168)` |
| `tests/theme-browser.cjs:65` | `S.theme='sunset'` 且夜间时 `.home-tools` 为 `rgb(22, 17, 41)` |
| `tests/theme-browser.cjs:80` | `S.theme='mint'` 重载后 `.home-tools` 为 `rgb(240, 255, 249)` |
| `tests/seasons-browser.cjs:26` | 冬季 `.home-meadow` 像素白雪比例 `snow > .9` |
| `tests/seasons-browser.cjs:57` | 春季 `.home-thaw` 透明度随时钟递减 |
| `tests/home-browser.cjs:106` | 普通家园 ≥ 55 FPS |
| `tests/seasons-browser.cjs:32` | 云层 + 季节粒子 ≥ 55 FPS |
| `tests/estate-browser.cjs:42,98` | 森林满屏与满产出家园 ≥ 55 FPS |
| `tests/world-performance.cjs:20` | 普通庭院中位 ≥ 55 FPS，满庭院 ≥ 30 FPS |

### 2.4 生图能力探针（已验证，非假设）

2026-10-31 实测：`codex exec` + `imagegen` 内置 `image_gen` 生成 512×512 水晶簇，产物校验结果：

- `mode=RGBA`，`alpha` 极值 `(0, 255)`；
- 四角 alpha 全为 `0`；
- 完全透明像素 182417 / 262144（69.6%）。

结论：**真实透明通道可用**，可直接进入现有 `repack-atlas.mjs` → `prepare-home-art.mjs` 管线，无需额外抠图。

## 3. 设计

### 3.1 视觉基线：冷光菌洞

**光源**：无太阳。照明全部来自发光菌的菌褶、晶体内部折射、地脉的青色裂纹、水面磷光。全场景单一主光，方向**上方偏左**，与现有 `kit.ts:17 faces()` 的单光源三面体系一致，可直接复用。

**材料**：

| 类别 | 旧 | 新 |
| --- | --- | --- |
| 地面 | 水彩苔绿草地 | 湿岩 + 洞穴苔藓 + 菌毯 |
| 建筑墙体 | 奶油灰泥 + 蜂蜜木 | 湿岩砌块 + 地底木（灰褐、干裂） |
| 屋顶 | 陶土红瓦 | 石板瓦或菌盖 |
| 植被 | 绿树、白雏菊 | 发光菌、晶簇、地藓、蕨、真菌林 |
| 水面 | 灰绿池塘 | 磷光暗水 |
| 光 | 暖窗灯、日光 | 紫色荧菌光、冷白晶光、琥珀地脉 |

**色板**（8 组，供 `PAL` 与 `--lw-*` 共用）：

| token | 值 | 用途 |
| --- | --- | --- |
| `rock` | `#2f4a52` | 岩体主色 |
| `rockDark` | `#1b2f38` | 岩体暗面、阴影 |
| `rockLight` | `#4a6b73` | 岩体受光面 |
| `moss` | `#4c6b4a` | 洞穴苔藓 |
| `spore` | `#8f6bb5` | 紫色荧菌 |
| `crystal` | `#9fe3f0` | 冷白晶簇、高光 |
| `vein` | `#c8913f` | 琥珀地脉、暖灯 |
| `ink` | `#121c24` | 最深底色、文字底 |

规则：同屏主色不超过 4 组；紫色荧菌用于"可交互/发光"语义，琥珀地脉用于"暖光/安全"语义，冷白晶簇用于"高价值/稀有"语义——语义稳定，不随季节翻转。

### 3.2 四季 = 四种地下景象

沿用 `ecology.ts` 的 `season()` 与 4 档切换，**不改任何数值与判定**，只换视觉：

| 季 | 名称 | 景象 | 地面主导 | 主导色 |
| --- | --- | --- | --- | --- |
| 0 | 潮生 | 渗水活跃、苔藓最盛、孢子萌发 | 湿苔岩面 | 苔绿 + 青蓝 |
| 1 | 晶盛 | 晶簇最高、地脉最亮、热气光雾 | 晶簇岩面 | 青蓝 + 冷白 |
| 2 | 孢散 | 陈旧孢子飘落、锈色真菌、菌伞 | 锈褐菌毯 | 锈褐 + 紫 |
| 3 | 霜凝 | 霜晶凝结、冰面反光 | 霜蓝冰岩 | 霜蓝白 |

**昼夜不改规则**：`dawn/day/dusk/night` 四段与界面文案全部保留（`DAY_PHASES` 不变），只是光照从"暖日光强弱"变为"发光生物的光潮强弱"——越晚越冷越紫。`night()` 仍按 `clock%3600>=2400` 判定。

**季节粒子沿用现有机制**：`.home-air i` 已按 `data-season` 切换形状/颜色（`home.css:36-42`），改色值与形状即可（春=孢子、夏=菌光浮尘、秋=飘落菌伞、冬=霜晶）。

### 3.3 地形两层结构

**第一层：手绘底层**（重画）

- `ground-spring/summer/autumn/winter.webp`：4 张 1536×1024、3:2、对边无缝；对应 3.2 的四种景象。
- `paths.webp`：6 种路面换成地下材质（湿石板、碎晶、菌丝铺道、暗色卵石、苔痕砖、地脉纹）。
- 保留现有 `home-art.ts` 的 pattern 铺设与 5px 内缩拼接逻辑，不改几何。

**第二层：程序化细节层**（从 `地形纹理.html` 移植）

- 移植 4 个生成器到 `scripts/terrain-gen.py`：草坪（斑块 + 草叶 + 颗粒）、土地（颗粒 + 裂纹）、石板（多边形砖 + 缝）、水面（斑驳 + 波光 + 闪光）。
- 用**固定种子**的伪随机数替代 `Math.random()`，保证每次生成结果逐字节一致，可视觉回归。
- 输出 1024×1024 可无缝平铺 PNG（`wrapDraw` 九宫格环绕绘制的逻辑保留），压成 WebP 入库。
- **制作期生成、结果入库，不在运行时跑 Canvas**。理由：现有 55 FPS 断言与单文件离线约束要求渲染期零开销；且 Canvas 生成依赖 `Math.random`，不可复现。
- 运行时：底层 `<image>`（手绘）+ `<pattern>` 贴细节 WebP + 季节/时段 tint。全部静态绘制，帧率不降。
- 细节层色相由季节参数驱动（生成 4 套对应 3.2 的苔绿/青蓝/锈褐/霜蓝），故不需四套几何，只需四套色调。
- 动态波光（水面平移）作为可选项：仅在 `reduced-motion` 关闭时启用，由现有 `.home-world.reduced-motion *{animation:none}` 规则自动关停。

**分工**：手绘负责"这是什么形状"，程序化负责"表面有多糙"。

**贴图分辨率决策**：细节层 tile 取 256 CSS px（1024px @4x 覆盖高分屏），在地图 48px 格上约为 5.3 格一个循环，避免可识别的重复图案。

### 3.4 全游戏界面统一

**中间 token 层**：新增 `--lw-*` 变量组（`rock/spore/crystal/vein/ink/paper/text/border`），只在 `:root` 与各主题块定义一次；家园面板与六个页面均改为消费这层 token，不再直接写色值。

**六套主题重配为菌洞同族**：保留 `THEMES` 的 6 个 `id`（存档兼容，`S.theme` 字段不变），保留设置面板入口与 `data-theme` 机制，只改配色：

| id | 名称 | 定位 | 基色 |
| --- | --- | --- | --- |
| `sunset`（默认） | 深窟 | 青蓝岩 + 紫荧菌 | `rock` 系 |
| `dark` | 幽紫 | 紫调更深 | `spore` 系 |
| `light` | 浅岩 | 唯一浅色高对比，供强光环境 | 浅灰岩 + 深墨 |
| `peach` | 矿脉 | 琥珀地脉暖调 | `vein` 系 |
| `mint` | 苔沼 | 苔绿主导 | `moss` 系 |
| `lavender` | 霜洞 | 冷白霜调 | `crystal` 系 |

主题 `name` 字段文案随新配色更新（`01-tools-content.js:10`），`id` 一律不动。

**页面覆盖**：陪伴 / 家园 / 召唤 / 探索 / 背包 / 成长 + 战斗界面随 token 自动换色，布局与交互不动。

**`--surface-solid` 收敛**：`home.css:1-8` 现有 7 组（含未被 `THEMES` 使用的 `sky`）改为从 `--lw-*` 派生，消除重复定义。

### 3.5 史莱姆边界

史莱姆本体（`src/shell.html` 的 `.slime` 造型 + `07-combat-dispatch.js` 的战斗表现）**不重画**。只允许在家园范围内叠加一层冷色轮廓光（纯 CSS/滤镜，作用于 `.home-slime`），使其融入菌洞环境。基线 SHA-256 断言因此不受影响。

### 3.6 制作管线

```
codex exec + imagegen（内置 image_gen，透明背景）
  → docs/art-2026-11-01/production/*.png        生成原图（1254 或 1024 方图）
  → scripts/repack-atlas.mjs                       拆粘连物件、重排规整网格
  → scripts/prepare-home-art.mjs <sharp 目录>      裁切透明边界、压 WebP
  → src/assets/storybook/*.webp + manifest.json
  → npm run build                                   内嵌进 史莱姆.html
```

sharp 不在仓库 `node_modules`（现状如此，文档既有约定），安装到仓库外临时目录按参数传入，不新增产品依赖。

`scripts/terrain-gen.py` 用 DSH 自带 Python + Pillow（已验证可用），输出 `src/assets/storybook/terrain-*.webp`。

## 4. 分期

| 阶段 | 内容 | 项数 | 依赖 |
| --- | --- | --- | --- |
| P0 | `--lw-*` token 层、6 主题重配、`PAL` 收敛、家园面板改写、同步颜色断言 | 0 素材 | 无 |
| P1 | 5 张整幅地面（`ground` + 四季）+ 6 种路面 + `terrain-gen.py` 细节层 | 11 + 5 新增 | P0 |
| P2 | facilities-a/b/c/d/e/f/g 共 7 张图集（含 6 件自然物） | 98 | P0、P1 定稿的地面观感 |
| P3 | decor-a/b/c、plants-a/b/c、items-a、clouds-handpainted、nature-winter | 122 | P2 定稿的建筑观感 |
| P4 | 视觉回归、`美术规范.md` 与 `CLAUDE.md` 更新、`backup/` 快照与 SHA-256 | — | P1–P3 |

每期独立可交付、可回退；P0 完成即可看到全游戏统一，不必等素材。

**数量核对**（依据 2.1 实测）：11 + 98 + 122 = 231，与 manifest 统计完全一致。细节层纹理 5 张（苔绿/青蓝/锈褐/霜蓝四套色相，按实际取 5）为**新增**，不在 231 内。

## 5. 验收

### 5.1 继承闸门

- `npm test`：类型检查 + 构建 + 104 项世界/迁移/素材/建筑形态/经营规则 + 48 项原玩法回归 + 合体成长专项 + 10 项参考版对照 + 测试底座单测。
- `npm run test:browser`：8 套件 841 项。
- `npm run smoke`：235 项，约 85–88 秒。
- 五视口实拍：320×568、390×844、844×390、1440×900、1920×1080。
- 帧率：普通家园 ≥ 55 FPS，满庭院 ≥ 30 FPS（`world-performance.cjs` 口径）。
- 浏览器异常与 console error 为 0。
- 离线：断网后 `史莱姆.html` 完整可玩。

### 5.2 需同步修改的断言（口径变更，非回归）

| 文件 | 断言 | 处理 |
| --- | --- | --- |
| `tests/home-browser.cjs:103` | 夜间 `.home-tools` `rgb(20,26,42)`、文字 `rgb(126,138,168)` | 换成新主题下的实际色 |
| `tests/theme-browser.cjs:65` | `sunset` 夜间 `.home-tools` `rgb(22,17,41)` | 换成深窟实际色 |
| `tests/theme-browser.cjs:80` | `mint` 重载后 `rgb(240,255,249)` | 换成苔沼实际色 |
| `tests/seasons-browser.cjs:26` | 冬季 `.home-meadow` 白雪 `snow > .9` | 判据改为「冷白像素占比 > .8 且平均色温偏蓝」（`.home-meadow` 采样同区域），字段名沿用 `snow` 以免改动下游 |
| `tests/seasons-browser.cjs:57` | 春季 `.home-thaw` 透明度递减 | 机制保留，改判据或元素名 |

改动原则：**只换色值口径与元素语义，不减检查条数、不改检查名称结构**；每处改动在提交信息里注明原因。

### 5.3 新增验收

| 检查 | 判据 |
| --- | --- |
| 视觉一致性 | 同一主题下，六个页面与家园的 `--lw-*` 解析值一致（脚本化读取 `getComputedStyle` 比对，非人眼判断） |
| 纹理层可复现 | `terrain-gen.py` 连跑两次输出 SHA-256 相同 |
| 纹理不重复可见 | 细节层 tile 在地图可视范围内的循环次数 ≤ 8 |
| 色板约束 | 每张图集主色 ≤ 4 组（像素聚类抽样检查） |

### 5.4 交付物记录

- 生图提示词存 `docs/art-2026-11-01/`（含 style baseline、参考图、每张图集的行列语义）。
- 裁切坐标存 `production/layouts.json`。
- 改造前快照存 `backup/underdark-20261101/`，`snapshot.json` 逐文件 SHA-256。

## 6. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| 全冷色调导致夜间可读性下降 | 玩家看不清建筑与地块 | 保留"暖光/安全"语义槽（`vein` 琥珀色只用于灯与关键时刻）；夜间只压渐变不改色相；视觉回归必查昼夜两态 |
| 231 项重画周期长 | 中途无可交付成果 | 分期交付，P0/P1 后即可用；每期独立验收与快照 |
| 生图风格漂移 | 20 张图集出现画风断层 | 固定 style baseline 提示词 + 以已定稿图集作参考图逐张生成；每张图集验收"主色 ≤ 4 组" |
| 程序化细节层与手绘层打架 | 表面质感糊成一团 | 细节层不透明度上限 0.35，只做"加糙"不做"再画一遍"；在 P1 用 5 视口截图定稿 |
| 断言改动被当成回归 | 误判失败原因 | 断言变更集中在本规格 5.2 列表，commit message 标注"口径变更" |
| sharp 环境缺失 | 无法裁切 | 已验证 DSH 自带 Python + Pillow 可替代裁剪压缩路径，必要时先用 Pillow 兜底 |

## 7. 一句话总览

把 231 项手绘素材重画为冷光菌洞，四季变四种地下景象，程序化纹理作细节层叠在手绘底层上；用一层 `--lw-*` token 让六个页面、战斗和家园共用同一色板，六套主题重配为菌洞同族，史莱姆本体与全部玩法规则不动。
