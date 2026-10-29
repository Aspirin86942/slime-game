# 项目开发约定

## 当前产品

单文件离线网页游戏「最强召唤师」。V5保留完整家园，其他玩法以只读文件史莱姆-参考.html为准，包括手动／自动战斗和待领取的探索收益。家园是一张全屏36×24格的正交地图；建筑立面和遮挡产生立体感。六个导航入口为陪伴、家园、召唤、探索、背包、成长。

史莱姆.html是构建产物。修改src/后运行npm run build，不要只编辑生成文件。无外部图片、字体、网络服务或运行时依赖。

## 结构

- src/legacy/01..09*.js按编号合并，保持原召唤、成长、合体、战斗和角色动画。08-world-clock.js负责统一在线与离线时钟。
- src/world/使用严格TypeScript。home-view.ts、home-art.ts、home.css为当前界面；旧view.ts、style.css不进入当前家园界面。
- map.ts统一尺寸、坐标与镜头约束，禁止给V5路径写死12格。保留的V3/V4源格式仍使用12×12坐标。
- engine.execute先在副本校验，再整体提交；失败不能扣材料或消耗序号。advance推进植物、制作和生态。
- life.ts提供寻路与伙伴占用。V5基础体力恢复和饲料结算只走旧核心时钟，家园不会再重复结算。
- src/shell.html保存原界面和角色基础样式；全屏家园样式限制在.home-mode / .home-world范围内。
- home.css继承参考版主题，仅补充对应弹窗底色的--surface-solid变量。顶部栏和导航使用原版几何尺寸；home-view.ts测量实际栏位高度，ResizeObserver随地图退出一起释放。
- 地图镜头使用测得的无遮挡区域；地图边缘预留树冠和屋顶空间。栏位观察器使用 border-box，避免漏掉安全区引起的内边距变化。手机回归入口为 tests/mobile-home-browser.cjs。
- src/world/art/ui-icons.ts提供共用操作图标，通过LivingWorld.uiIcon导出；原uiIcon函数保留包装。地图及物品缩略图继续使用绘本素材。

## 存档和迁移

根状态S为同一个对象，存档键是slimeSummonerSave，当前saveVersion:5。先校验后迁移，原始数据保存在slimeSummonerSave_vN_backup；已有不同备份时使用新后缀，不能覆盖旧备份。

bag.food对应统一库存的feed，旧家园的stock.food对应ingredient。这些兼容属性不可枚举，序列化只有一份余额。不得在读档时重复添加默认背包。原旅行物资归库，收益只结清一次；撤回玩法的记录写入world.retired，旧故事转为归档。

advanceWorld在线按秒交织参考版恢复、12秒派遣与家园规则，正常派遣后刷新收益领取按钮。settleOffline只推进家园，最多12小时；不补算原玩法体力、饲料或探索。静默补算不进行中途保存。lastActive、planClock随存档保存。

存储失败、跨标签冲突和坏档均保护原数据。重试保存只持久化当前结果，不重新执行操作。战斗内的延迟动作在保存恢复后继续。新增状态字段要同步检查默认值、校验、迁移与恢复路径。

## 验证入口

- npm test：类型检查、构建、75项世界/迁移/素材规则、48项原玩法回归、合体成长专项和10项参考版对照。
- npm run test:browser：真实Chromium输入、五种视口、六种主题、三种安全区、原版逐页对照、昼夜、旧小游戏、离线重载、冲突保护和帧率。输出在忽略目录tools/out/magic-ui/；原接入验收保留在tools/out/reference-home/。
- npm run docs:content：生成当前家园内容目录。
- tests/lib/vm-harness.cjs执行真实游戏代码，DOM为模拟对象，可推进时钟；不代表浏览器渲染验收。
- 浏览器脚本统一复用tools/out/lib/cdp.js。它自动寻找Chrome，使用独立临时配置。不得用用户真实存档做测试。
- ?battle=ui仅开放诊断钩子；?selftest=1 / ?gallery=1 / ?fps=1也属于诊断模式。诊断模式不会自动写玩家存档。
- 战斗局部函数通过window.__TEST__._battle暴露。merge-growth.cjs使用同一套虚拟运行环境执行真实游戏代码，验证合体与成长行为。

## 修改边界

- 史莱姆-参考.html及tests/baseline-original.html禁止改写。本次角色形体、表情、元素造型和原玩法界面以史莱姆-参考.html为准。
- 重大改动前在backup/保存程序快照；本次源码与成品快照在backup/reference-home-20261029-implementation/，snapshot.json记录文件哈希。
- 魔法风统一前的成套快照在backup/magic-ui-20261029/，包含225个文件及逐文件哈希。
- 地图绘制遵循docs/art-2026-10-27/美术规范.md，画面使用正交地面和纵向遮挡。
- 检查320×568、390×844、844×390、1440×900、1920×1080。实际截图和帧率必须据实记录。
- 存档导入/导出入口已按用户要求移除，不自动加回。不自动提交、推送或发布。
