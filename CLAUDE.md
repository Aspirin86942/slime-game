# 项目开发约定

## 当前产品

单文件离线网页游戏「最强召唤师」。V5保留完整家园，其他玩法以只读文件史莱姆-参考.html为准，包括手动／自动战斗和待领取的探索收益。家园是一张全屏36×24格的正交地图；建筑立面和遮挡产生立体感。六个导航入口为陪伴、家园、召唤、探索、背包、成长。

史莱姆.html是构建产物。修改src/后运行npm run build，不要只编辑生成文件。无外部图片、字体、网络服务或运行时依赖。

## 结构

- src/legacy/01..09*.js按编号合并，保持原召唤、成长、合体、战斗和角色动画。08-world-clock.js负责统一在线与离线时钟。
- src/world/使用严格TypeScript。home-view.ts、home-art.ts、home.css为当前界面；旧view.ts、style.css不进入当前家园界面。
- map.ts统一尺寸、坐标与镜头约束，禁止给V5路径写死12格。保留的V3/V4源格式仍使用12×12坐标。
- 设施占地看Placement.form（缺省为1），功能看level。升级通过engine.growth原地扩建，新占地包住旧占地；旧存档form<level时免费展开，读档不移动建筑。
- engine.execute先在副本校验，再整体提交；失败不能扣材料或消耗序号。advance推进植物、制作和生态。
- life.ts提供寻路与伙伴占用。V5基础体力恢复和饲料结算只走旧核心时钟，家园不会再重复结算。
- src/shell.html保存原界面和角色基础样式；全屏家园样式限制在.home-mode / .home-world范围内。
- home.css继承参考版主题，--surface-solid提供不透明基色，家园面板用color-mix和backdrop-filter形成毛玻璃；不支持虚化时回退到实色。顶部栏和导航使用原版几何尺寸；home-view.ts测量实际栏位高度，ResizeObserver随地图退出一起释放。
- home-view.ts中建造使用底部横向图卡，选中建筑先显示环形按钮，配方和升级按需打开小面板；环形按钮位置跟随实际建筑图，横屏调整到四角。命令dispatch返回执行是否成功，摆放成功后才结束工具。
- 地图镜头使用测得的无遮挡区域；地图边缘预留树冠和屋顶空间。栏位观察器使用 border-box，避免漏掉安全区引起的内边距变化。手机回归入口为 tests/mobile-home-browser.cjs。
- estate.ts负责家园经营：科技判定、繁荣度与家园等级、开垦条件、工作位、暂存时长、每12小时上限和旧档补齐。规则表（TECHS、AFFINITY、BIOME_BONUS、PROSPERITY、BRIDGE_CAPS、ORDER_CAP、VALUES）都在content.ts，engine读表执行，不在代码里逐项写特判。界面数字统一来自engine.yieldOf等同一函数。
- 新地块、建筑、植物、道路必须通过estate.plotOpen/footprintOpen；新设施要在techFor能查到的科技里解锁，或列入STARTER_BUILDINGS。原24座设施在BUILDINGS中的顺序不可改动，新设施追加在末尾（图集和测试按序号取图）。
- 捕捉网、经验药水、天材地宝由家园直接写入统一库存，即原版S.bag。这是唯一放宽参考版数值的地方，受每12小时上限约束；战斗、商店和探索数值仍以史莱姆-参考.html为准。委托积分通过points事件进入S.points。
- src/world/art/ui-icons.ts提供共用操作图标，通过LivingWorld.uiIcon导出；原uiIcon函数保留包装。地图及物品缩略图继续使用绘本素材。

## 存档和迁移

根状态S为同一个对象，存档键是slimeSummonerSave，当前saveVersion:5。家园经营状态在world.estate（rev:1）；旧V5档首次读入时先写slimeSummonerSave_v5_backup，再按migrateEstate补齐：全部地块开垦，已建设施对应科技完成，在长的作物带legacy按旧喜好成熟。先校验后迁移，原始数据保存在slimeSummonerSave_vN_backup；已有不同备份时使用新后缀，不能覆盖旧备份。

bag.food对应统一库存的feed，旧家园的stock.food对应ingredient。这些兼容属性不可枚举，序列化只有一份余额。不得在读档时重复添加默认背包。原旅行物资归库，收益只结清一次；撤回玩法的记录写入world.retired，旧故事转为归档。

advanceWorld在线按秒交织参考版恢复、12秒派遣与家园规则，正常派遣后刷新收益领取按钮。settleOffline只推进家园，最多12小时；不补算原玩法体力、饲料或探索。静默补算不进行中途保存。lastActive、planClock随存档保存。

存储失败、跨标签冲突和坏档均保护原数据。重试保存只持久化当前结果，不重新执行操作。战斗内的延迟动作在保存恢复后继续。新增状态字段要同步检查默认值、校验、迁移与恢复路径。

## 验证入口

- npm test：类型检查、构建、104项世界/迁移/素材/建筑形态/家园经营规则、48项原玩法回归、合体成长专项和10项参考版对照。家园经营专项在tests/estate.test.mjs；几何与旧规则测试用「完全发展的家园」夹具（全部地块与科技），开局进度单独测。tests/home.test.mjs覆盖委托上限引入前的V5存档迁移、原文备份及已有额度保留。
- npm run test:browser：真实Chromium输入、多档设备、六种主题、三种安全区、原版逐页对照、昼夜、旧小游戏、离线重载、冲突保护和帧率，末尾串联smoke。八个套件合计841项，smoke 222项；输出在忽略目录tools/out/magic-ui/；原接入验收保留在tools/out/reference-home/。
- npm run smoke：13档设备×六页几何断言（显示/比例/覆盖/命中区）、9档家园弹层态、旧玩法五交互、安全区页面探针、夹具读档与断言活力，共222项，约84秒。结构与排错见docs/living-world/TEST-HARNESS.md。
- 浏览器断言底座在tests/lib/browser/：session（唯一CDP会话）、profiles（13档设备档案）、layout（几何断言）、fixtures（夹具读取与注入），单测为npm run test:harness。tools/out/lib/cdp.js仍只负责启动/求值/截图/触摸。
- 存档夹具在tests/fixtures/saves/（mobile-baseline/mobile-developed/mobile-orders/mobile-offline/legacy-v5），由tests/fixtures/build.cjs在真实浏览器中生成并反向校验；更新用node tests/fixtures/build.cjs。
- npm run docs:content：生成当前家园内容目录。
- tests/lib/vm-harness.cjs执行真实游戏代码，DOM为模拟对象，可推进时钟；不代表浏览器渲染验收。
- tests/home-actions-browser.cjs覆盖家园直接操作、环形按钮、横滑建造栏、透明面板及键盘；工具只保存界面状态，不改变V5存档结构。
- 浏览器脚本统一复用tools/out/lib/cdp.js。它自动寻找Chrome，使用独立临时配置。不得用用户真实存档做测试。
- 资源建筑三档素材在facilities-f/g（3×3，layouts.json标grid:3），新物品与科技图标在items-a；生成后用scripts/repack-atlas.mjs拆开粘连物件再接入，记录在docs/art-2026-10-29/production/estate-art-generation.json。tests/estate-browser.cjs覆盖开垦、研究、气泡收取、委托、集市、桥接物品、五视口和帧率。
- 建筑形态素材已接入facilities-c/d/e，共48张独立WebP。tests/building-forms-browser.cjs覆盖222项形态验收，八个浏览器套件合计841项，连同smoke 222项共1063项浏览器检查。生成记录与实际裁切坐标在docs/art-2026-10-29/production/。
- ?battle=ui仅开放诊断钩子；?selftest=1 / ?gallery=1 / ?fps=1也属于诊断模式。诊断模式不会自动写玩家存档。
- 战斗局部函数通过window.__TEST__._battle暴露。merge-growth.cjs使用同一套虚拟运行环境执行真实游戏代码，验证合体与成长行为。

## 修改边界

- 史莱姆-参考.html及tests/baseline-original.html禁止改写。本次角色形体、表情、元素造型和原玩法界面以史莱姆-参考.html为准。
- 重大改动前在backup/保存程序快照；本次源码与成品快照在backup/reference-home-20261029-implementation/，snapshot.json记录文件哈希。
- 魔法风统一前的成套快照在backup/magic-ui-20261029/，包含225个文件及逐文件哈希。
- 家园经营改造前的快照在backup/home-v6-20261029/，324个文件，snapshot.json逐文件记录SHA-256。
- 地图绘制遵循docs/art-2026-10-27/美术规范.md，画面使用正交地面和纵向遮挡。
- 检查320×568、390×844、844×390、1440×900、1920×1080。实际截图和帧率必须据实记录。
- 存档导入/导出入口已按用户要求移除，不自动加回。不自动提交、推送或发布。
