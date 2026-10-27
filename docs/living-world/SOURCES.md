# 参考与原创内容

本次新增 TypeScript 规则、SVG 绘制、CSS 界面和中文剧情均在本仓库原创实现。下列项目用于机制和表现研究，没有复制其源码、美术、音频或剧情。各项目许可证只约束各自仓库，不能据此推断所有第三方素材可复用。

| 参考 | 吸收的思路 | 本项目落点 |
|---|---|---|
| [Sandspiel](https://github.com/MaxBittker/sandspiel) | 简单局部互动形成环境变化 | 树荫、水草、湿度、肥力、访客与元素伙伴 |
| [A Dark Room](https://github.com/doublespeakgames/adarkroom) | 条件事件与逐步发现 | 路线节点、选择后果、区域故事 |
| [Bounce Back](https://github.com/KilledByAPixel/BounceBack) | 轻量小游戏的弹道、阴影与命中反馈 | 果冻变形、攻击粒子与共用绘制层 |
| [Gridland](https://github.com/doublespeakgames/gridland) | 资源小游戏与日夜变化 | 白天采集、夜晚防守的资源三消 |
| [Hexa Battle](https://github.com/itajaja/hb) | 类型化行动与结果分离 | GameCommand、GameEvent、BattleActionResult |
| [Jelly Colosseum](https://github.com/SamG-Coder/Jelly-Colosseum) | 软体角色、高光、弹性反馈 | 原创 SVG 果冻与原角色材质层，不引入 Three.js |
| [Kiss The Sky](https://github.com/matthewmain/kiss_the_sky) | 授粉、遗传、可见性状 | 双亲继承、少量变异、品系收藏与留种 |
| [Level 13](https://github.com/nroutasuo/level13) | 探索、营地、资源与世界发现 | 六区域、十八路线、营地修复与旅行日志 |
| [Kittens Game](https://github.com/nuclear-unicorn/kittensgame) | 主动经营与自动生产并存 | 设施生产、制作队列、伙伴工作、材料替代入口 |

开发依赖为 TypeScript 5.9.3 与 esbuild 0.25.12；确切依赖树在 package-lock.json。运行时无需安装依赖，也不会向这些网站发送请求。
