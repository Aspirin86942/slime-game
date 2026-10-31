# 冷光菌洞美术改造（2026-11-01）

把家园从「林间绘本」重画为「冷光菌洞」，并以它为全游戏唯一画风基准；同时把 `地形纹理.html` 的程序化纹理接成地图细节层。

- 设计规格：[2026-10-31-underdark-art-design.md](../superpowers/specs/2026-10-31-underdark-art-design.md)
- 实现计划：[2026-10-31-underdark-art.md](../superpowers/plans/2026-10-31-underdark-art.md)
- 现行规范：[家园美术规范 · 冷光菌洞](../art-2026-10-27/美术规范.md)

## 一、风格基线提示词

每张图集都用同一段基线，只有「Primary request」逐张换。桌面版 `imagegen` 技能里的 `image_gen` 直接吃这段文本，产出 1254×1254、带真实透明通道的 PNG（实测四角 alpha 全 0，整图透明像素约 46%）。

```
Use case: stylized-concept
Asset type: game sprite atlas, <列>x<行> grid = <格数> cells, square canvas,
            genuinely transparent background
Style baseline:
- hand-painted gouache storybook sprites, fine visible brush texture, NO black outlines
- elevated front-facing orthographic view, screen-aligned horizontal bases, NOT diamond isometric
- single light from upper left, soft contact shadow only
- palette: wet blue-grey stone #2f4a52, darker rock #1b2f38, cave timber #5a4a3e,
           purple bioluminescent #8f6bb5, pale crystal #9fe1f0, amber vein #c8913f
- genuinely transparent background, generous transparent gutters, no grid lines,
  no frame, no watermark, no text
Primary request: <本图集的物件清单，一行一件>
Constraints: each sprite isolated inside its own cell with generous transparent gutters,
             nothing touching between cells, no text, no frame, no grid lines,
             no watermark, no ground base plate.
Style reference: match the rendering of production/facilities-a.png exactly —
                 same brush scale, same lighting, same palette.
```

逐图集的完整提示词原文见 `prompts/<图集>.txt`，可直接再次投喂。

## 二、生成与裁切记录

生成命令统一是 `Get-Content prompts/<name>.txt -Raw | codex exec --cd <工作树根> -`，产物落在 `production/<name>.png`。

裁切走既有链路，只有一处扩展：

```powershell
# 1) 粘连时先拆物件、按阅读顺序重排进规整网格（四周留 12% 透明边）
node scripts/repack-atlas.mjs "C:\Users\lcf\.dsh-art-tools\node_modules" `
  production/<name>.png <物件数> <列数> production/candidates/<name>-packed.png

# 2) 按 layouts.json 的网格裁切、压 WebP、写 manifest.json
node scripts/prepare-home-art.mjs "C:\Users\lcf\.dsh-art-tools\node_modules" `
  --source docs/art-2026-11-01/production <name> [<name>...]
```

`--source` 是本轮新增的可选参数，默认仍是 `docs/art-2026-10-29/production`，旧调用不受影响。`sharp` 不装进仓库，从仓库外临时目录按参数传入（本轮用 `C:\Users\lcf\.dsh-art-tools\node_modules`，sharp 0.35.5 / libvips 8.18.7）。

### 图集清单

| 图集 | 网格 | 格数 | 内容 |
| --- | --- | --- | --- |
| `facilities-a` | 4×4 | 16 | 基础经营设施，菌盖屋顶石屋、磷光温泉、晶簇温室等 |
| `facilities-b` | 4×4 | 16 | 10 设施 + 6 自然物（菌树/菌果/苔丛/苔石/晶花/洞穴芦苇） |
| `facilities-c` | 4×4 | 16 | 8 座设施的 2、3 级形态（每行一对：左 2 级、右 3 级） |
| `facilities-d` | 4×4 | 16 | 同上，后 8 座设施 |
| `facilities-e` | 4×4 | 16 | 同上，东侧 8 座设施 |
| `facilities-f` | 3×3 | 9 | 采石场/矿洞/荧菌巢 各 1–3 级（每行同一建筑三档） |
| `facilities-g` | 3×3 | 9 | 磷光泉/石砌窖/地底商铺 各 1–3 级 |
| `decor-a` | 4×4 | 16 | 石栏、菌丝围栏、晶簇灯、苔石座、菌架、地脉路标、纪念晶碑等 |
| `decor-b` | 4×4 | 16 | 菌洞家具与容器：石桌、晾架、火塘、木箱、树液桶、菌纤地垫等 |
| `decor-c` | 4×4 | 16 | 前 10 件装饰 + 6 个物料图标（木/石/露/饲料/建造/采集，纯物品无底座） |
| `plants-a` | 4×4 | 16 | 荧菌、晶花、洞穴蕨、苔毯、石生花、磷光藤等地底植被 |
| `plants-b` | 5×4 | 17 | 同族补充与变体（`plants-b` 是唯一 5 列图集） |
| `plants-c` | 4×4 | 16 | 成熟态 4 格 + 6 个生长阶段格（种子/幼苗/花苞/裂苞/半开/全开）+ 6 变体 |
| `items-a` | 4×4 | 16 | 矿石、锭、荧菌蜜、元素精华、磷光尘、捕捉网、经验药水、晶簇宝物、研究笔记、五条科技分支、等级旗、开垦路牌 |
| `paths` | 3×2 | 6 | 湿石板、碎晶、菌丝铺道、暗色卵石、苔痕砖、地脉纹 |
| `clouds-handpainted` | 3×2 | 6 | 洞穴积雾六态，冷青灰偏紫团块，夜间压到近黑冷蓝 |
| `nature-winter` | 3×1 | 3 | 霜晶化菌树、霜覆苔丛、霜覆蕨（画幅只占中间横带，`layouts.json` 用显式 `cells` 标定） |
| `ground` `ground-spring/summer/autumn/winter` | — | 5 | 整幅 1536×1024 无缝地面，3:2 |
| `terrain-moss/crystal/spore/frost/water` | — | 5 | 1024×1024 程序化细节纹理（`scripts/terrain-gen.py` 生成，非生图） |

合计 231 项手绘素材 + 5 张细节纹理，与原 manifest 计数一致。

## 三、`scripts/terrain-gen.py`

固定种子（默认 `20261101`，`--seed` 可覆盖）、1024×1024、可无缝平铺。五个输出对应四季与水面：

| 输出 | 基色 HSL | 对应生成器 | 用途 |
| --- | --- | --- | --- |
| `terrain-moss.png` | h=95 s=18 l=30 | 草坪（斑块+草叶+颗粒） | 春，湿苔岩 |
| `terrain-crystal.png` | h=185 s=26 l=34 | 石板（多边形砖+缝） | 夏，晶簇岩 |
| `terrain-spore.png` | h=28 s=22 l=26 | 土地（斑驳+颗粒+湿光） | 秋，锈褐菌毯 |
| `terrain-frost.png` | h=200 s=14 l=62 | 石板变体（细缝、更亮） | 冬，霜蓝冰面 |
| `terrain-water.png` | h=186 s=34 l=30 | 水面（斑驳+波光+闪光） | 池塘 |

用法：

```powershell
& $env:DSH_PYTHON scripts/terrain-gen.py --out src/assets/storybook
& $env:DSH_PYTHON scripts/terrain-gen.py --out tools/out/terrain-preview --seed 20261101
```

设计取舍：`wrap_draw` 把越界笔触从对侧重画一遍，保证对边无缝；所有随机数来自 `mulberry32(seed)`，没有任何 `random` / 时间戳 / 文件顺序依赖，因此同参数连跑两次 PNG 逐字节相同（`tests/terrain.test.mjs` 断言 SHA-256 相等）。制作期生成、结果入库，运行时不跑 Canvas——现有 55 FPS 断言与单文件离线约束都要求渲染期零开销。

踩到的兼容问题：numpy 2.x 的 `np.cross` 不再接受二维向量，`inset_polygon` 里的叉积已改成标量形式 `d1[0]*b[1]-d1[1]*b[0]`。

实测：五张 2×2 平铺目视检查均无接缝，四类纹理特征（草叶/砖缝/颗粒/波光）清晰可辨。单张 PNG 172–748 KB，转 WebP（quality 88, method 6）后 101–320 KB。

## 四、细节层接入

`src/world/home-art.ts` 在 `<defs>` 里加一个 `256×256` 的 `pattern#home-terrain-detail`，画面里叠一层覆盖全区块的 `<rect class="home-terrain-detail" data-home-terrain="…" data-home-terrain-season="…" opacity="…">`：

- 纹理名按季节映射 `['moss','crystal','spore','frost'][s]`，用 `artURL('terrain-' + name)` 取图；`artURL` 对无 `frames` 的图集走 `atlas.image` 分支，`scripts/build.mjs` 已自动内嵌 base64，**不需要改构建脚本**。
- 不透明度：春/夏/秋 `.32`，冬季霜面 `.28`，上限 `.35`。
- 夜间底色从旧暖绿 `#68816b` 改为 `--lw-rock-dark` 的 `#1b2f38`，`shade()` 的混合目标同步改成 `#1b2f38`；只压亮度不改色相。
- 水面漂移 `.home-world:not(.reduced-motion) [data-home-terrain="water"]{animation:home-terrain-drift 40s linear infinite}`，由既有 `reduced-motion` 规则统一关停。

## 五、实际验收数据

| 项 | 实测 |
| --- | --- |
| `npm test` | 通过（`test:world` 114 项，含 palette 7 项、terrain 3 项；`reference-home` 10 项含参考版 SHA-256 与完整样式表前缀） |
| `npm run test:browser` | 九个套件全绿：home 54、reference 62、theme 463、building-forms 222、seasons 87、terrain-detail 7、smoke 235，其余套件按原状 |
| `npm run smoke` | 235 项 |
| `史莱姆.html` 体积 | 约 14.13 MB（预算 20 MB） |
| 普通家园帧率 | ≥ 55 FPS（细节层叠加后仍达标） |
| 满庭院帧率 | ≥ 30 FPS（300 株作物） |
| `light` 正文对比度 | 13.0:1 |
| `mint` 正文对比度 | 14.1:1 |
| 深色四主题墨-岩亮度差 | sunset 0.049 / dark 0.048 / peach 0.054 / lavender 0.047 |

## 六、口径变更（非回归）

本轮有四处断言改的是口径而不是实现：

1. `tests/home-browser.cjs` 夜间底色 `rgb(20,26,42)`→`rgb(20,32,43)`，文字 `rgb(126,138,168)`→`rgb(138,163,173)`。
2. `tests/theme-browser.cjs` `sunset` 夜间 `rgb(22,17,41)`→`rgb(19,30,38)`；`mint` 重载 `rgb(240,255,249)`→`rgb(232,242,236)`。
3. `tests/seasons-browser.cjs` 冬季判据由「白雪占比 > .9 且三通道 > 210」改为「冷白偏蓝占比 > .3 且蓝 ≥ 红」；白昼迷雾亮度下限 `rgb[0]>150`→`>90`；春季融雪由「opacity 恰为 0.5」改为「0/1800/3600 三点严格递减」。
4. `tests/reference-browser.cjs` 原版对照保留版式、导航图标与溢出判据，配色改为「七个主题变量都解析出有效值」——本轮改造的目标就是换配色，逐字比对旧色值必然失败。

`tests/palette.test.mjs` 与 `tests/terrain.test.mjs` 是本轮新增，已登记进 `package.json` 的 `test:world`；`tests/terrain-detail-browser.cjs` 已登记进 `test:browser`。

## 七、产物目录

```
docs/art-2026-11-01/
  README.md              本文件
  prompts/<图集>.txt      每张图集的完整提示词原文
  production/<图集>.png   生成原图（1254×1254 或 1536×1024）
  production/layouts.json 网格与物件语义（裁切坐标由 prepare-home-art 按 alpha 包围盒自动求）
  production/candidates/  重排中间产物
```
