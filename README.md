# 史莱姆 · 共同生活

双击 [史莱姆.html](史莱姆.html)，召唤并命名自己的伙伴，一起经营会留下共同回忆的家。游戏可完整离线运行。

底部三个入口：

- **家园**：同一张地图上陪伴、种植、制作和布置。点击伙伴可以抚摸、喂食、聊天和邀请玩耍；点击设施展开操作。
- **远行**：六个地区的一起出游、熟悉路线后的委托采集，以及原有深渊、教学挑战和扫荡。
- **伙伴**：召唤、成长与合体、关系、愿望和回忆。召唤师任务和魔物照料也在这里。

右上角可打开背包和设置。家园保留六个 12×12 分区，包含 26 种设施、48 件装饰、55 种植物、16 条配方和 18 种生态访客。所有伙伴继续使用原来的史莱姆造型。

可以从这段共同生活开始：召唤命名 → 种植并照料甜萝卜 → 和伙伴聊天 → 收获后在一级厨房制作饲料、家常便当 → 一起探索草甸与森林 → 带回发光种子 → 种下等它开花。故事记住实际参与者和你的选择；改名后回忆仍属于同一只伙伴。

基础饲料和烹饪食材分别记账。近家采集每五分钟补充材料、饲料，并在无种子时提供甜萝卜种子；初次出游无需食物门票。成熟植物不会腐烂，重要选择会等待你。

## 存档

V1、V2、V3 存档自动迁移为 V4。迁移先保存原始字节备份，再按旧规则结清最多 12 小时离线收益。旧自动派遣伙伴回家，队伍预设保留；已有家园远征继续。原 ID、名字、成长、珍爱锁、库存、布局、制作队列和已完成故事保留。

出现存储失败时，顶部会保留“重试保存”按钮，已发生的结果暂存在本页；请完成保存后再关闭。坏档、未知版本和其他页面更新存档时会停止写入。战斗中刷新会安全中断，不补发胜利奖励。

存档属于当前浏览器和文件地址。换浏览器或移动 HTML 路径可能打开不同存档。恢复旧程序时须配合迁移前备份，不能让旧程序直接写入 V4 存档。测试始终使用合成存档和独立浏览器配置。

## 开发

使用 Node.js 24。依赖只用于开发和构建，交付 HTML 没有联网服务或外部运行时依赖。

```bash
npm ci
npm test
npm run test:browser
node tests/common-life-touch.cjs
node tests/gameplay-browser.cjs
node tests/art-direction.cjs
node tests/balance-sim.cjs --check --checkpoint=tools/out/balance-checkpoint.json --json=tools/out/balance-v4.json
node tests/world-performance.cjs
node tools/out/selftest.js
node tools/out/fps.js 3
npm run docs:content
```

`npm run build` 从源码生成根目录的 `史莱姆.html`，请勿直接编辑生成文件。

- `src/world/`：严格 TypeScript；统一库存、活动、场景、故事、远行和迁移规则。
- `src/legacy/`：原召唤、成长、战斗与角色动画的 JavaScript 兼容模块。
- `src/shell.html`：页面结构和原角色样式。
- `tests/`：规则、迁移、回归、浏览器和性能检查；`tests/fixtures/save-v3.json` 是合成迁移夹具。

核心接口的处理方式：例如制作便当，规则先在内存副本中检查厨房等级、食材和伙伴状态，全部满足后一次提交；领取产物时记录开工时绑定的伙伴。这样不会因切换查看对象转移经历，也不会在失败或重试时重复扣费。

## 文档

- [SPEC：产品规则与数据约定](docs/living-world/SPEC.md)
- [PLAN：实施顺序与验收对应](docs/living-world/PLAN.md)
- [CONTENT：从源码生成的完整内容目录](docs/living-world/CONTENT.md)
- [QA：实际验收结果与运行边界](docs/living-world/QA.md)
- [旧玩法数值基线](docs/gameplay-2026-10-27/数值设计.md)
