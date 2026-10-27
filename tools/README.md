# 测试与诊断脚本

在项目根目录执行下列命令。浏览器脚本使用本机 Chrome 和独立的临时浏览器配置，不读取玩家日常浏览器的存档；Node.js 需要提供全局 `WebSocket`。

Windows、macOS、Linux 都可以运行。浏览器路径由 `tools/out/lib/cdp.js` 自动查找：Windows 查 Chrome / Edge 的安装目录，macOS 查 `/Applications`，Linux 在 `PATH` 中查 `google-chrome`、`chromium` 等。装在其他位置时，用环境变量指定，例如 `CHROME_PATH=/opt/chrome/chrome node tools/out/selftest.js`。

## 当前验收入口

| 用途 | 命令 |
|---|---|
| 游戏规则回归 | `node tests/review-tests.cjs` |
| 合体与成长 | `node tests/merge-growth.cjs` |
| 浏览器原生自检 | `node tools/out/selftest.js` |
| 美术布局、主题与召唤流程 | `node tests/art-direction.cjs` |
| 抚摸、拖动、玩具等触控行为 | `node tools/out/touch-check.js` |
| 存档迁移与坏档保护 | `node tools/out/migration-check.js` |
| 伙伴详情、合体、教学等界面截图 | `node tools/out/upgrade-shots.js final` |
| 战斗特效开关的帧率对照 | `node tools/out/fps.js 3` |
| 角色画廊截图 | `node tools/out/gallery.js [tag]` |

`selftest.js` 在出现失败、超时或没有完整结果时返回非零退出码。截图和帧率脚本还需要查看生成的图片、报告，不能只凭程序正常退出判定效果正确。

## 保留的战斗画面诊断

| 用途 | 命令 |
|---|---|
| 当前版本：逐回合、选目标、自动战斗截图与尺寸 | `node tools/out/look.js new current` |
| 旧打击版：自动战斗截图与尺寸 | `node tools/out/look.js old reference` |
| 点选流程和行动、目标、选中标记 | `node tools/out/probe-battle.js` |
| 行动标记与血条、护盾条的位置 | `node tools/out/probe-label.js` |
| 名字、生命值和行动预告是否被裁切 | `node tools/out/probe-text.js` |
| 护盾教学提示的画面与位置 | `node tools/out/probe-train.js` |
| 放大检查己方选中和敌方目标区域 | `node tools/out/probe-zoom.js` |

这些诊断脚本输出截图或测量数据，供人工检查。`look.js old` 使用根目录中的 `史莱姆（打击版）.html`，其余使用当前游戏。

## 生成文件与历史工具

- `tools/out/shots/`：验收截图。`art-*`、`touch-*`、`up-final-*` 分别对应美术、触控、升级界面验收。
- `tools/out/look/`：战斗诊断截图与尺寸数据，可重新生成，已加入 Git 忽略规则。
- `tools/out/*-report*.json`、`fps-result.json`、`selftest.txt`：本地验收结果。
- `tools/out/cleanup-report.json`：本次清理清单，包含原路径、大小和 SHA-256 校验值。清走的文件可从 Windows 回收站恢复。

`tools/selftest.ps1` 是 Windows 专用的旧入口，功能已由 `selftest.js` 和 `gallery.js` 覆盖。`auto-harness.js`、`bisect.ps1`、`r-auto.ps1`、`review-run.ps1` 和 `shots.js` 保留作历史排障参考。它们依赖旧快照或旧页面行为，当前版本验收使用上面的入口。

脚本源码继续保留在现有路径。生成的截图、报告和临时页面由 `.gitignore` 排除，不随代码提交。
