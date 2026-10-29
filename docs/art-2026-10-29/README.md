# 林间绘本家园

游戏入口为根目录的 [史莱姆.html](../../史莱姆.html)。家园界面、地图、设施、装饰和植物均已采用林间绘本风格。图片内嵌在游戏中，双击即可离线游玩。

## 画面与交互

- 界面使用奶油纸色、墨绿文字、暖色细边和手绘图标。主工具为建造、种植、采集、更多；制作、仓库和生态收在更多中。
- 地图使用连续的水彩草地、成片树林、花丛和苔石。环境植物会让出建筑、种植与道路空间，不占用可建造地块。
- 建筑与植物按照落地点排序。设施旋转时调整占地并保持画面比例；白天和夜晚共用同一套素材，夜间窗户、灯具和发光花保留暖光。
- 桌面目录位于右侧，手机目录从底部展开；打开目录时收起主工具栏。保留六个页面入口和原史莱姆造型。

## 素材范围

生产资源包含 177 个物件、植物和图标图块、6 种路面材质及 1 张连续草地。

- 26 个设施：24 个经营设施及 2 个已有纪念设施。
- 24 个经营设施各有 2 级「扩建」和 3 级「华丽」两种升级形态，占地逐级变大，共 48 张，已接入 [facilities-c.png](production/facilities-c.png)、[facilities-d.png](production/facilities-d.png)、[facilities-e.png](production/facilities-e.png)。每张按行排列 8 对建筑，左为 2 级，右为 3 级。收纳栏和升级面板显示对应形态；夜间窗灯随新图定位。
- 42 件装饰：围栏、灯具、休闲家具、花架、标识、生态摆件和纪念物。
- 36 种基础植物与发光花拥有各自的成熟素材；18 种杂交植物采用亲本素材与品系颜色、体型变化。
- 植物保留种子、幼苗、花苞和成熟阶段；植物颜色与体型仍由原有基因数据决定。
- 6 种路面为碎石、苔石、木板、白砂、落叶和星砂。连续道路共用纹理坐标。

## 文件与构建

| 文件 | 用途 |
|---|---|
| forest-storybook/ | 已选定的界面、地图与素材概念图，以及生成提示词 |
| production/ | 实际生产 PNG、生成提示词和裁切坐标 layouts.json |
| ../../src/assets/storybook/ | WebP 图集、独立透明素材与 manifest.json |
| ../../scripts/prepare-home-art.mjs | 从生产 PNG 裁切透明物件并压缩为 WebP |
| ../../src/world/art/storybook.ts | 物件映射、缩略图、植物阶段、图标和昼夜表现 |
| ../../src/world/home-art.ts | 地面、道路、植被和场景排序 |
| ../../src/world/home-view.ts、home.css | 家园面板与响应式布局 |

普通开发直接运行 `npm run build`。构建读取已保存的 WebP，将它们嵌入独立 HTML，无需图像服务或网络下载。

更新生产 PNG 时，先运行 `node scripts/prepare-home-art.mjs "<包含 Sharp 的 node_modules 目录>"`，再运行 `npm run build`。Sharp 仅用于离线制作素材；游戏与普通构建不依赖它。独立裁切保证物件点选范围与显示内容一致，重复物件共享图片解码和本地 Blob 地址。

只处理升级图集时运行 `node scripts/prepare-home-art.mjs "<包含 Sharp 的 node_modules 目录>" facilities-c facilities-d facilities-e`，该命令保留其他已生成素材。全部图集的裁切顺序和分隔坐标保存在 `production/layouts.json`。

升级图集由内置 image_gen 生成，实际源图均为 1254×1254、透明 RGBA PNG，按原生像素裁切。已检查全部行列分隔没有建筑像素跨越，48 张裁切图均保留透明通道。基础设计提示词见 [building-forms-prompts.md](production/building-forms-prompts.md)，实际生成及排布调整提示词见 [building-forms-generation.json](production/building-forms-generation.json)。

## 验收

运行 `npm test` 和 `npm run test:browser`。浏览器测试使用独立临时配置与测试存档，覆盖鼠标、触屏、五种窗口尺寸、昼夜、小游戏退出、离线资源与存档恢复。它不会修改玩家在日常浏览器中的存档。

当前测试数、帧率、渲染器和交付文件校验值见 [实际验收](../living-world/QA.md)。本轮实际游戏截图和检查明细保存在 `../../tools/out/home-storybook/`，概念图与实际截图分开保存。

升级形态的实际渲染对照：[小屋、厨房与园艺设施](../../tools/out/magic-ui/building-forms/forms-1.png)、[林木与水系设施](../../tools/out/magic-ui/building-forms/forms-2.png)、[工坊与生活设施](../../tools/out/magic-ui/building-forms/forms-3.png)。专项截图和 180 项检查明细在 `tools/out/magic-ui/building-forms/`。素材接入前快照在 `backup/building-form-art-20261029/`，161 个文件的哈希均已核对。
