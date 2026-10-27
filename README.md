# 史莱姆 · 生活世界

双击 [史莱姆.html](史莱姆.html)，在底部进入 **家园**。游戏完整离线，原存档自动迁移并保留原始备份。

家园包含六个可布置区域、24 种设施、48 件装饰、植物育种、幼体培养、生态访客、亲自探索、离线远征、伙伴故事和小游戏。原有召唤、深渊、派遣、合体与陪伴仍可使用。

建议从伙伴页认识芽芽，然后种花、探索草甸。成熟植物不腐烂，离线不会损坏家园，重要故事选择会等待你。

## 开发

需要 Node.js 24。只在开发时安装依赖：

```bash
npm ci
npm test
npm run test:browser
node tests/balance-sim.cjs --check
```

`npm run build` 把源码重新打包到原来的 `史莱姆.html`。不要直接修改生成 HTML。

- `src/world/`：严格类型检查的 TypeScript 规则、内容、存档、绘制和界面。
- `src/legacy/`：保留已有玩法的兼容模块，构建时按编号合并到同一个经典脚本作用域；这一部分仍为 JavaScript。
- `src/shell.html`：原有界面与基础样式。
- `tests/world.test.mjs`：规则、内容完整性、在线离线等价、重复领取与失败路径。
- `tests/world-browser.cjs`：独立浏览器配置中的真实控件、触屏拖放、刷新、迁移、断网和保护流程。

## 文档

- [SPEC：游戏规则与数值](docs/living-world/SPEC.md)
- [PLAN：实施顺序](docs/living-world/PLAN.md)
- [QA：实际验收结果](docs/living-world/QA.md)
- [参考来源](docs/living-world/SOURCES.md)
- [旧玩法数值与测试](docs/gameplay-2026-10-27/数值设计.md)

存档保存在当前浏览器、当前文件地址下。换浏览器或移动 HTML 路径可能使用不同的存储空间。不要在迁移后直接用旧版程序覆盖当前进度；需要恢复时应使用迁移前保存的原始备份。
