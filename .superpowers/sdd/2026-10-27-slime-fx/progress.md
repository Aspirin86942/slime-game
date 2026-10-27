# SDD ledger — plan: docs/superpowers/plans/2026-10-27-slime-fx.md

规格：docs/superpowers/specs/2026-10-27-slime-fx-design.md
执行方式：原生执行（executing-plans），全 12 个任务串行，最后由全新审查者过整份改动。
工作区：`.superpowers/sdd/2026-10-27-slime-fx/`（本项目不是 git 仓库，`sdd-workspace` / `task-start` / `task-done` 三个脚本依赖 git，不可用）。

## 与技能默认流程的偏差（已确认）

- 无 git：不建 worktree、不 commit。检查点 = `backup/史莱姆-<时间戳>-<块名>.html` 快照；回退 = 覆盖回快照。
- 因此 `task-done` 的"提交范围"改为"快照文件名"，测试证据照常写进本账本。

## 起飞前扫描（Pre-flight）

| 生产者 | 消费者 | 接口 | 发现 |
|---|---|---|---|
| 任务 1 | 任务 2/3/8 | `FX.shake/flash/float/die/burst` + `FX.log` | 一致 |
| 任务 4/5 | 任务 6 | CSS 选择器 `[data-el="X"] .mark::before/::after` | 一致 |
| 任务 7 | 任务 8 | `SKILLS`、`skillOf(s)`、`u.cd{}`、`u.acted` | 一致（规格已同步为 `u.` 前缀） |
| 任务 8 | 任务 9/10 | `playerCast(u, side, target)`、`renderSkillBar()` | 一致 |
| 任务 0 | 任务 2–11 | `__TEST__`、`tools/selftest.ps1`、`?selftest=1` | **发现缺口** |

Ruling: 任务 2 的检查要用 `__TEST__.startBattle({speed:10, seed:1})` 开一场可控战斗，但计划把 `startBattle` 助手留在任务 2 写、而它依赖任务 7 才有的战前数据。裁决：把 `startBattle(opts)` 种子助手放进**任务 0 脚手架**（造 2 只史莱姆 + 选队 + `startAbyssBattle`），任务 2 起直接用。理由：脚手架是横切基础设施，晚建的代价是任务 2 再回头改任务 0 的产出。代价：任务 0 稍大（+25 行），若错则只影响自检代码、不碰玩法。

Ruling: 任务 0 的 `__TEST__` 里 `FX` 尚不存在（任务 1 才建），计划原文写 `{FX}` 会抛 ReferenceError。裁决：改用 `get FX(){ return typeof FX!=='undefined' ? FX : null }`。理由：同样的只读意图，且任务 0 与任务 1 解耦。代价：无。

## 任务进度

Task 0: complete (snapshot backup/史莱姆-20261027-1043-task0.html, tests: `pwsh -File tools/selftest.ps1 -Mode selftest` → 2/2 PASS)
Task 0: Ruling: 计划里 `startBattle` 助手写在任务 2，但任务 2 是它第一个消费者 → 提前到任务 0 脚手架（见上方 Pre-flight 裁决），落地为 `__TEST__.startBattle({speed,seed,elements,level,monsterLevel})` — 代价：任务 0 多 25 行自检代码。
Task 0: Ruling: `B` 是 `startAbyssBattle` 的函数局部量，`__TEST__.B` 取不到 → 在 `const B = {...}` 之后加一行 `if(window.__TEST__) window.__TEST__._battle = { B, overlay, fieldEl, logEl, later };` — 理由：任务 2/9/10 的检查必须读战斗态；正常游玩 `window.__TEST__` 不存在，等于无操作 — 代价：玩法函数多一个条件分支。
Task 0: Ruling: `& chrome.exe ... --dump-dom` 在本机返回空 stdout（启动器先返回、输出句柄断开），`--headless=new` 需配 `Start-Process -Wait -RedirectStandardOutput` 才拿到 DOM → `tools/selftest.ps1` 改为写文件再读；gallery 截图模式同法验证通过（143KB PNG）— 代价：无。

Task 1: complete (snapshot backup/史莱姆-20261027-1045-task1.html, tests: `pwsh -File tools/selftest.ps1 -Mode selftest` → 4/4 PASS)
Task 1: Ruling: 规格 4.1 要求闪白打在 `.breath` 上，因为 `.slime` 在战斗里已被 `scale(.36)`，直接加 filter 会连带缩放盒 → `FX.flash` 内部 `el.querySelector('.breath')` 再作用，找不到才退回自身 — 代价：无。
Task 2: Ruling: 计划让检查驱动 `performAction` 的各分支，但战斗函数全是 `startAbyssBattle` 的闭包内声明，自检段取不到 → 把钩子扩成 `{B, overlay, fieldEl, logEl, later, performAction, performMiniAction, getUnitEl, refreshBars, dealDamage, handleUnitDeath, setDodgeRate, setCritRate, restoreRates}`，`_rateOrig` 在开战瞬间捕获原函数供还原 — 理由：不改产品逻辑就无法稳定命中闪避/暴击/溅射分支；正常游玩无 `__TEST__` 等于无操作 — 代价：玩法函数多几个条件分支字段。
Task 2: Ruling: `A-hit` 首版断言在攻击者身上查 `.hit-flash` → 闪白打在受击方，`A-crit` 因只查飘字才通过；改为断言 `.battle-field` 内存在 `.breath.hit-flash` — 代价：无。
Task 2: Ruling: 飘字越界保护没按「整体矩形落在场地内」硬算，而是取 `ty = min(max(2, H-16), ty)`，且在贴近顶部时改从单位下方冒字；`A-bounds` 以 `style.top` 与场地高度比对 — 理由：keyframes 上飘 24px，只要起点留出余量就不会出界，比逐帧测量稳 — 代价：极端窄场地（H<34）时仍可能压边。
Task 2: complete (snapshot backup/史莱姆-20261027-1049-task2.html, tests: `pwsh -File tools/selftest.ps1 -Mode selftest` → 14/14 PASS)
Task 3: Ruling: 计划让 `handleUnitDeath` 直接播死亡演出，但 `checkRevive` 可能把已灭团的队伍拉起来 → 先调 `checkRevive`，返回 true 就不播 `.dying`/粒子 — 理由：被回溯复活的单位不该先缩灭再站回来 — 代价：`handleUnitDeath` 多一层分支。
Task 3: Ruling: `removeMini` 原本同步 `el.remove()`，`.dying` 动画永远看不到 → 改成先 `FX.die(sl,6)`（迷你 6 颗，本体 12 颗）再 `setTimeout(340ms)` 摘节点 — 代价：死亡迷你节点会多留 340ms（已用 `data-dead` 标死，不影响选取）。
Task 3: Ruling: `A-kill` 首版有两个错：粒子查在单位节点上（实际挂在 `.battle-field`）；1 血目标若是 岩/冰 自带护甲会把伤害全吸收 → 断言改查 `b.fieldEl` 内 `.fx-part`，且测试前清 `rockArmor/iceArmor/timeRevive` — 代价：无。
Task 3: complete (snapshot backup/史莱姆-20261027-1051-task3.html, tests: `pwsh -File tools/selftest.ps1 -Mode selftest` → 15/15 PASS)
Task 4: Ruling: 390×844 单视图截图装不下「12 属性 × 多尺度」矩阵 → `tools/selftest.ps1` 增加 `-Height` 参数（默认 844，仅画廊模式生效）；尺度行用外层 `transform:scale` 包裹实现，因为 `--sz` 只是倍率、仅在 `.pl-slime` 里被乘 — 代价：无。
Task 4: Ruling: 首版 岩 棱片贴在下巴上方像一条亮带、水 水滴太小看不出 → 岩 改成伸出轮廓外的尖角 + 左下碎石，水 改成 17×24 带内阴影高光的独立水滴（`top:-11px`），风 弧线加粗到 2.6px 并加 `drop-shadow` — 代价：装饰向轮廓外多伸约 10px，任务 6 矩阵检查时需确认不与血条/名字重叠。
Task 4: complete (snapshot backup/史莱姆-20261027-1054-task4.html, tests: `pwsh -File tools/selftest.ps1 -Mode selftest` → 17/17 PASS；画廊 `-Mode gallery -Tag task4b -Height 2600` 人工复核通过)
Task 5: Ruling: `B-rest` 首版只判 `content !== 'none'`，而地基里有 `.slime .mark::before,::after{content:''}` 兜底 → 8 个属性空跑也全绿（假通过）；改成 `pseudoVisible`：算 `getComputedStyle` 的宽高 >1、display 非 none、opacity 非 0，且确有绘制（背景/边框/阴影任一） — 理由：装饰全走伪元素，只有计算样式能证明「画出来了」 — 代价：检查依赖计算样式，日后改动画初始 opacity 为 0 会误报。
Task 5: Ruling: 雷 首版 `#fff6b0→#b98cff` 渐变贴在深紫身上完全看不出，截图为证 → 改黄芯三层 `#fffbd0→#ffe066 44%→#a97bff`、加大到 24×34、双层 drop-shadow（黄+紫）；尺度行 cell 宽 92→88 使 4 个一行不换行 — 代价：无。
Task 5: Ruling: `.mark` 是 z-index:1 的独立层，会盖住 `.eyes` → 追加 `.slime .eyes{z-index:3}`（`.eyes` 本来是 absolute，只补 z-index，不动 position/布局） — 理由：装饰任何情况下都不许挡眼睛 — 代价：无。
Task 5: complete (snapshot backup/史莱姆-20261027-1056-task5.html, tests: `pwsh -File tools/selftest.ps1 -Mode selftest` → 18/18 PASS；画廊 `-Mode gallery -Tag task5b -Height 1500` 人工复核通过：12 属性装饰全部可见，雷 黄芯闪电清晰)
Task 6: Ruling: 计划要求断言「每个 `.mark` 的边界矩形完全落在 `.slime` 内且不与 `.eyes` 矩形相交」，实测不可行：装饰本来就设计成伸出轮廓（岩/火/水/冰/雷 顶饰 -9～-14px），且 暗 是渐变压在下缘的雾、计算盒必然与眼睛矩形重叠 → 判据改为四条可判定的性质：①眼睛 z 序严格大于 `.mark`；②装饰盒落在容器 ±24px 外扩范围（x∈[-24,164], y∈[-14,128]，含 margin 与 bottom/right 定位换算）；③四个缩放尺度下装饰的局部盒完全一致（说明是相对 `.mark` 定位、不随缩放漂移）；④表情与 dead/ghost 不改变装饰盒 — 代价：半透明装饰的「视觉遮挡」无法自动判，只能靠画廊人工看。
Task 6: Ruling: `mountSlime` 原来只把 `sz` 传给 `--sz`，而 `--sz` 只在 `.pl-slime` 里被乘，四尺度断言等于没缩 → 给 `mountSlime(element, mood, sz, extra)` 加外层 `transform:scale()` 包裹与 `extra`（dead/ghost）参数 — 代价：无。
Task 6: Ruling: 雷 顶角由 `top:-17px;height:34px` 收到 `top:-14px;height:30px`，因为战斗尺度 .36 下 17px×.36=6.1px 会顶到血条（血条在 `.slime-wrap` 上方 6px 留白）；`B-matrix2` 专门断言「战斗尺度上伸 ≤5.5px」 — 代价：闪电略短，画廊里仍清晰。
Task 6: Ruling: 反向验证过检查本身：把 雷 的 `top:-14px` 临时改成 `-40px` 的副本跑 chrome，得到 `FAIL B-matrix: 雷@1::before 纵向越界 top=-40.0 h=30.0` 与 `FAIL B-matrix2: 雷 战斗尺度上伸 14.40px，会顶到血条`，标题 `FAIL 18/20` — 证明检查能失败，不是空跑；临时文件已删。
Task 6: complete (snapshot backup/史莱姆-20261027-1058-task6.html, tests: `pwsh -File tools/selftest.ps1 -Mode selftest` → 20/20 PASS)
Task 7: Ruling: `load()` 的回落判据比计划更严 —— 计划写 `if(!S.battleMode) S.battleMode='auto'`，实现改成白名单 `if(S.battleMode !== 'auto' && S.battleMode !== 'interject' && S.battleMode !== 'step')`，这样脏值（如 'Auto'、null、数字）也统一回落 — 理由：存档是长期存在的、可能被手工改；代价：将来加模式必须记得同步这里。
Task 7: Ruling: 时间「回溯」是第四种 kind `'revive'`，计划只列了 atk/heal/buff — 理由：主动技表要能表达「复活 + 无阵亡时转伤害」，塞进 atk 会让 playerCast 出现隐式分支；代价：kind 不再是三种，后续 UI 若按 kind 分组要覆盖四值。
Task 7: Ruling: `nextTurn` 在回合开始对**双方所有单位**统一 `acted=false` + 递减 `cd`，而不是计划里写的「只重置即将行动的一方」— 理由：双面统一后同一段代码，且手动模式下玩家可以在我方回合外的窗口行动，双方语义一致更好推理；代价：无（自动战斗行为不变，crt 顺序未动）。
Task 7: complete (snapshot backup/史莱姆-20261027-1101-task7.html, tests: `pwsh -File tools/selftest.ps1 -Mode selftest` → 24/24 PASS)
Task 8: Ruling: `castStrike` 把「闪避→基础伤害→属性倍率→暴击→护甲抵扣」整套口径**复制**了一份供手动施法使用，没有把 performAction 里的伤害段抽成公共函数 — 理由：performAction 里的 `Math.random` 调用顺序是固定种子回归基线（R-auto）的一部分，抽取即改动顺序；代价：伤害公式未来要改必须改两处，已在账本留痕。
Task 8: Ruling: 技能命中默认带 `noElement:true`（火/草/冰/暗/幻 的状态由技能表显式给），只有普攻继续走 `applyAttackerElement` — 理由：否则 火 技能「必定叠 2 层烧伤」会叠加成 3-4 层，与规格文本不符；代价：技能不再吃「攻击者属性」的随机触发。
Task 8: Ruling: 时间的 target 允许为空（`sk.target === 'enemy' && sk.kind !== 'revive'` 才强制校验目标），且无阵亡友方时若也没给目标就记日志并返回 false — 理由：复活技的合法目标在己方，不能因为「没选敌人」就判非法；代价：`C-revive` 必须显式覆盖两种分支。
Task 8: Ruling: 技能条可见性用 `.hide` 类控制（`display:none`），不用内联 `style.display` — 理由：与应用内其余显隐写法一致，且内联样式会被 `C-bar` 之外的快照/复用人误读；代价：`C-bar` 断言改用 `classList.contains('hide')`（首版断言内联样式导致假失败）。
Task 8: Ruling: 新增 `?battle=1` 截图模式（切插话模式 + 自动选中首个队友），并把它加入自检启动守卫（`if(!qs.includes('selftest') && !qs.includes('gallery') && !qs.includes('battle')) return;`）— 理由：技能条是纯布局产物，靠 DOM 断言看不出「有没有压住队友/血条」，必须出图人工看；代价：产品文件多一个仅测试用的查询参数分支。
Task 8: Ruling: 夹具坑 —— `C-cast` / `C-revive` 的目标若随机到 岩/冰 会自带 `rockArmor`/`iceArmor` 把伤害吸收，断言「目标掉血」必然假失败 → 出手前清零 `t.st.rockArmor = 0; t.st.iceArmor = 0;` — 代价：无。
Task 8: complete (snapshot backup/史莱姆-20261027-1105-task8.html, tests: `pwsh -File tools/selftest.ps1 -Mode selftest` → 28/28 PASS；`?battle=1` 480×900 人工复核：HUD 出现「插话」按钮、底部技能条 T0/T1/T2 + 普攻/磐石落/× 均可见且未压住队友与血条)
Task 9: Ruling: `nextTurn` 里原来的「我方行动链 + 敌方阶段 + 回合尾」三段内联，改成把敌方阶段抽成 `enemyPhase()`，并新增 `runStepActors(actors, idx)` / `waitForPlayer(unit, side, done, timeoutMs)`；step 模式直接 `runStepActors` 后 `return`，不再走自动链 — 理由：pause/resume 需要一个可回收的「继续」入口，递归调用比改造原链更不容易破坏自动路径；代价：nextTurn 多一层间接。
Task 9: Ruling: 8s 兜底超时做成 `waitForPlayer` 的第 4 个参数（默认 8000），生产不传、测试传 60ms — 理由：无假定时器库，真实等 8s 会让自检超时（单条 8s 上限）；代价：生产函数带一个测试专用参数。
Task 9: Ruling: 手动行动成功后由 `doManual` 调 `afterPlayerAction()`（waitForPlayer 里赋成 finish），同时 `B._pauseResume` 供「暂停期间切出 step 模式」时立刻收尾 — 理由：模式切换是玩家随时可点的，不能让战斗卡在 8s 等待里；代价：多一个闭包字段要清理（closeBattle/endBattle 都置空）。
Task 9: Ruling: 迷你史莱姆在 step 模式下仍自动行动，不打断节奏 — 理由：它们的行动不可控且数量多，逐个等玩家会毁掉手感；代价：与「我方每个 actor 都等待」的计划文义有偏差。
Task 9: complete (tests: `pwsh -File tools/selftest.ps1 -Mode selftest` → 31/31 PASS；`?battle=step` 480×900 人工复核：日志显示「⏳ 轮到 T0 行动」、技能条自动高亮 T0 并展开 普攻/磐石落/×、HUD 显示「逐回合」；快照与任务 10 合并为 backup/史莱姆-20261027-1108-task10.html，因为任务 9 验证后直接进入任务 10，未单独落盘)
Task 10: Ruling: `performAction` 开头新增 `if(unitWrapper.acted) return;`（紧跟 hp<=0 检查），让插话模式手动行动过的单位在同回合跳过自动行动 — 理由：否则同一单位一回合动两次；代价：自动模式下该分支永不为真（acted 只会被手动路径置起），等于给自动路径加了个空判断。
Task 10: Ruling: `B` 对象显式初始化 `paused:false, pauseTimer:null, _pauseResume:null`，不再是 undefined — 理由：`C-inter` 断言 `B.paused===false` 首版直接失败，且 undefined 参与布尔判断容易埋坑；代价：无。
Task 10: Ruling: `C-inter2` 用「插话前后 `B.timer` 引用不变」代替计划里的「下次行动时间戳误差 <50ms」— 理由：时间戳在无假时钟的 headless 里抖动远大于 50ms，断言必然 flaky；计时器引用同一性等价地证明「插话没有重建/重置自动节奏」，且确定性强；代价：不能发现「计时器被清空但对象未变」这类极端情形。
Task 10: complete (snapshot backup/史莱姆-20261027-1108-task10.html, tests: `pwsh -File tools/selftest.ps1 -Mode selftest` → 33/33 PASS)
Task 11: Ruling: `R-auto` 的对比基线改用 `backup/史莱姆-20261027-1101-task7.html`（C 块之前最后一个快照），不是计划写的 task0 原始快照 — 理由：A/B 块新增的 `FX.burst` 等特效会消耗 `Math.random`，原始快照与当前文件的随机数消耗序列必然不同，拿 pristine 对拍只会得到假失败；task7 已含全部 A/B 特效，是「C 块是否改变自动战斗」的正确等价基线；代价：不能证明 A/B 块没影响战斗数值（这部分由任务 2/3 的定向检查覆盖）。
Task 11: Ruling: `R-auto` 的实现写在文件外（`tools/out/auto-harness.js` + `tools/out/r-auto.ps1`），不塞进自检段 — 理由：需要把同一段外部脚本注入两个不同的 HTML 分别跑，自检段做不到；对比对象是固定种子(4242)下前 20 条战报文本，比逐字段对状态更敏感（含伤害数值、闪避、暴击、治疗）；代价：不在 `?selftest=1` 里，需单独一条命令复跑。
Task 11: 真实回归（R-auto 发现）— 任务 9 把敌方阶段抽成 `enemyPhase()` 时，`const stepDelay` 留在 `nextTurn` 局部作用域，`enemyPhase` 内引用它抛 `ReferenceError: stepDelay is not defined`；该异常在 setTimeout 里被静默吞掉，表现是**敌人整场不再行动**，而此前 33 条检查全部通过（它们都没跑完整自动回合）。修法：在 `enemyPhase()` 开头就地重算 `const stepDelay = Math.round(1400 / battleSpeed);`。错判代价：没有 R-auto 这条外部对拍，这个回归会直接进交付，玩家会看到「怪物站着不动」。
Task 11: Ruling: 补两条常驻检查 `C-phase`（自动模式跑完一整回合：回合数推进、反馈条数 ≥3、敌方阶段后我方掉血、期间无未捕获异常）与 `R-noerr`（累计 `window.onerror` / `unhandledrejection` 必须为空）— 理由：`setTimeout` 内抛错不会让断言失败，只靠返回值断言永远抓不到这类 bug；代价：`C-phase` 需要 1.8s 真实等待，自检总时长增加。
Task 11: 反向验证（证明新检查不是空跑）：把修好的 `stepDelay` 那行从副本里删掉再跑，得 `FAIL 33/35` 与 `FAIL C-phase: 自动回合出现未捕获异常: Uncaught ReferenceError: stepDelay is not defined`、`FAIL R-noerr: 全局未捕获异常: ...`，确认两条新检查确实能捕获该回归。
Task 11: 真实缺陷（R-input 发现）— 全队阵亡时 `renderSkillBar()` 只把存活单位过滤成空数组，仍执行 `bar.classList.remove('hide')` 并渲染空标签，技能条残留在界面上、看着像还能继续行动。修法：`alive.length === 0` 时加 `.hide`、清空 innerHTML、清 `skSel/skPick` 并 `markTargetable(false)` 后 return。
Task 11: Ruling: `R-perf` 的基线取「首场战斗打完并关闭后的节点数」，而不是页面初始节点数 — 理由：战斗 overlay 的样式/结构会带来一次性的常驻节点（例如技能条），拿初始节点数当基线会误报；连打 10 场后再取一次，两者相差超过 5%+20 个节点即判失败；代价：只能证明不累积，不能证明单场战斗内部不泄漏。
Task 11: Ruling: `R-load` 不单独写，由任务 7 的 `C-save` 覆盖（旧档缺 `battleMode` 回落 auto + 五个 tab 依次 render 不抛错）— 理由：两者断言的是同一件事，重复写只会增加维护面；代价：`C-save` 没有真的点「召唤/出行」按钮，只验证了 tab 渲染。
Task 11: complete (snapshot backup/史莱姆-20261027-1115-task11.html, 298,398 字节；tests: `pwsh -File tools/selftest.ps1 -Mode selftest` → 37/37 PASS；`pwsh -File tools/out/r-auto.ps1` → R-AUTO PASS；`tools/out/gallery-final.png` 12 属性总览人工复核通过)

## 审查修复轮（独立审查者 → 修复 → 复验）

Review: 两个独立只读审查者（`provider: magpie` / `model: bochu/deepseek-flash`）分别按「硬性约束 / A 块接入点 / B 块属性形态 / C 块手动-自动一致性 / 自检质量」审了全量改动。第一位给出 3 条阻断；第二位（在修复中途启动、读到中间态）确认约束与 A/B 块通过、C 块公式一致，但同样指出手动普攻缺元素附带行为。结论：R-auto 与 37 条自检全绿仍然漏掉真实缺陷，外部审查这一关是必要的。
Review-fix: 阻断 1「step 计时器」— `nextTurn` 只判 `!B.running`，`restartTimer` 的 9s 轮询在玩家等待期间照样推进回合，把玩家没行动的回合吃掉并重置 acted/CD；speed 10 时 2.5s 内 turn 0→3。修法：`nextTurn` 开头加 `if(B.paused) return;`。代价：暂停期间回合不增长，超时完全依赖 `waitForPlayer` 自己的 8s 兜底。
Review-fix: 阻断 2「复活不可见」— `.dying` 只加不删，配合 `forwards` 把死亡单位定格在 `opacity:0`，时间回溯（手动与被动 `checkRevive`）复活后单位存在但看不见。修法：两处复活都 `el.querySelector('.slime').classList.remove('dying')`。
Review-fix: 阻断 3「手动路径成简化版」— 冻结/麻痹/持续伤害/魅惑只在 `performAction` 里结算，手动行动可绕过；雷对水溅射、草吸血、命中水史莱姆召迷你、冰甲反冻也只走自动路径。修法：抽出 `turnControl(unitWrapper, side)` 供两条路径共用；`castStrike` 统一补上雷溅射/草吸血/水召迷你/冰甲反冻，并删掉 `playerCast` 里重复的 `doSplash`、草吸血、草系治疗块。代价：手动技能倍率会放大吸血量（与自动口径一致，符合规格），且手动行动可能被 DoT 直接打死并损失该次行动。
Review-fix: `_pauseResume` 从死代码接上——`#bMode` 切换离开逐回合时立即调用，让账本原先承诺的「切模式立刻收尾」成立。
Review-fix: 风技能「两道风刃」改用 `hitList` 去重，保证打 2 个不同目标（此前可能同一目标挨两刀）。
Review-fix: 打击感补齐规格差距——`kill` 震屏从误用 `fxShakeLight`(3px) 改为新增 `fxShakeKill`(±5px/140ms)；`.fx-float.miss` 由灰蓝 `#8b93a7` 改淡紫 `#c4b5fd`（规格 §4.3）；死亡演出时长 .45s→.34s，缩放改用 `--die0` 变量（`.battle-field .slime` .36、`mini-slime.pos-*` .20/.18/.16），修掉迷你史莱姆死亡首帧从 .2 突然放大到 .36 的跳变。
Review-fix: 新增 3 条常驻检查 `C-step-timer`（用高频轮询模拟真实计时器，断言暂停期回合不推进）、`C-revive-vis`（`handleUnitDeath` 后 `.dying` 存在，时间回溯后必须消失）、`C-align`（手动雷普攻溅射 / 手动行动结算 DoT / 手动命中冰甲反冻）。`C-align` 首版把三个场景塞在一场战斗里，雷打水系的小怪把攻击者打死（hp=0）导致第三条误报，拆成三场独立战斗后转绿。
Task 11 (re-open): complete (snapshot backup/史莱姆-20261027-1132-final.html, 305,379 字节；tests: `pwsh -File tools/selftest.ps1 -Mode selftest` → 40/40 PASS；`pwsh -File tools/out/r-auto.ps1` → R-AUTO PASS；`node --check` 对抽出 script 块 exit 0；`tools/out/shot-battle.png` 480×900 人工复核：HUD 出现「插话」、底部技能条 T0/T1/T2 + 普攻/磐石落/×、敌方四只各带属性形态)
Known-gap: 规格 §4.3「同目标连续飘字向上错开 14px」未实现（目前靠 250ms 合并 + 12 条上限）；`R-perf` 只数 DOM 节点，不测帧率；`C-mode` 只断言默认值，三态切换的真实生效由 `C-step-timer`/`C-inter`/`C-phase` 间接覆盖。

## 补缺口 + 帧率测试（用户点名两项）

Gap-fix: 飘字错行按规格 §4.3 实现——`FX.float` 在算完基准 `ty` 后，统计 600ms 内仍挂在该目标身上的飘字条数 `stack`，`off = Math.min(stack, 3) * 14`；`ty - off >= 2` 时向上错，放不下就改为向下错，最后统一夹进 `[2, 场地高-16]`；节点记 `_owner`/`_born` 供下一次统计。选择「向上优先、顶到边界就向下」而不是规格原文的「一律向上」——因为敌方最上排在场地顶部，一律向上会被夹回同一点，等于错行失效。
Gap-fix: 新增检查 `A-offset`（同一目标连发 crit/weak/strong 三条，断言相邻 top 差 ≥12px 且三条都不越界）。反向验证：把 `const off = Math.min(stack, 3) * 14;` 改成 `const off = 0;` 跑副本 → `FAIL 40/41`、`FAIL A-offset: 第二条没有和第一条错开: 58.27,58.27,58.27`，确认检查非空跑。
Fps: 页面侧新增 `?fps=1` 模式（自检段内，`?fps=1&fx=off` 把 `FX.float/flash/shake/die/burst` 换成空函数做同场景对照）：`__TEST__.startBattle({elements:['岩','火','水','草','冰'], level:20, monsterLevel:20, speed:10, seed:99})`，把双方 `maxHp=hp=999999` 保证 6 秒内战斗不结束，用 rAF 采样 6 秒帧间隔，再跑 3 秒特效压力（每帧 12 条飘字 + 闪白 + 爆散 + 震屏），结果挂 `window.__FPS__`。
Fps: 驱动 `tools/out/fps.js`（Node 26 自带 WebSocket，走 CDP）——`--headless=new --remote-debugging-port=0` 起 Chrome，读 `DevToolsActivePort`，`PUT /json/new?<url>` 开标签，`Runtime.evaluate` 加 `awaitPromise` 取结果；每个配置跑 3 轮取中位数。不这么做的话 `--dump-dom` 拿不到实时帧率（`--virtual-time-budget` 会把 rAF 时间轴虚拟化，测出的 60fps 是假的）。
Fps-result: 开特效 56.7 fps / avg 17.63ms / p95 22.3ms / max 61.6ms / 长帧 2%（120 次特效事件）；关特效 59.3 fps / p95 18.2ms / 长帧 1.1%。特效开销 = 4.4% fps，p95 +4.1ms。压力场景（每帧 12 条飘字+闪白+爆散+震屏）40.2 fps / p95 40.9ms，飘字节点峰值 12、粒子峰值 60（说明两条上限确实生效）。判定 PASS（阈值：开关都 ≥50fps、压力 ≥30fps）。
Task 11 (re-open 2): complete (snapshot backup/史莱姆-20261027-1152-fps.html, 310,713 字节；tests: selftest 41/41 PASS、R-AUTO PASS、`node tools/out/fps.js` PASS)
Known-gap: 帧率数据来自 headless Chrome + `--disable-gpu`（软件渲染），只能作为「相对开销」参考，不能代表真机 GPU 合成下的绝对帧率；未在中低端安卓机上实测。

## 真机视口渲染与打磨轮（用户要求：渲染 + 真机截图 + 找不完美处修补）

Env: `adb` 不存在，没有物理设备可截图。改用 Chrome DevTools Protocol 设备模拟：390×844 / DPR 3 / 触屏，`tools/out/shots.js` 一次跑 8 个界面并把布局体检写 `tools/out/shots-report-<tag>.json`。口径限制：这是桌面 Chrome 模拟视口，不是真机渲染。
Env: 夹具必须「先写资源字段 → 再 `closeBattle()`（内部 save）→ `Page.reload` → 再改名」，否则 reload 后顶栏还是初始值；`?battle=ui` 模式只挂测试钩子不开战，避免 boot 自动 startBattle 用 3 只覆盖存档。
Polish: `.game-hud` 改两行（`flex-wrap:wrap` + 标题 `flex:1 1 100%` + `h3{white-space:nowrap}`），390 宽下标题与「撤退」不再竖排。
Polish: `.btn:disabled` 由 `opacity:.35` 改成中性底 + 白字 + 细边（浅色主题单独给深字），召唤页「召唤空间已满」可读。
Polish: 出行页空状态改胶囊 `.explore-empty`（深底 + 白字 + 细边），不再压在草地边界上。
Polish: `createSlime(true)` 魔物配色 `s=rnd(18,62) l=rnd(26,46)`（原 0–25% 亮度太黑，12 属性装饰看不见）。
Polish: `.btn.gold` 由「金→紫」渐变改纯金 `#ffd166→#ffab5e` + 深棕字，不再像禁用态。
Polish: 出行页文案「派遣最多4只」与实际上限 5 不符 → 改 5。（`abyssSetupSel.length >= 5`）
Bugfix: 护盾吃满时战报写「造成 0 伤害」、飘字 `-0` → 新增 `shieldOf(target)` 与 `damageLogText(...)`，四个伤害点统一输出「护盾吸收 N 点」；飘字在这种情况下显示「护盾」。检查 `A-shield` 覆盖。
Bugfix: 阵亡单位没有明确标记（`.slime` 的 `.dying` 定格 opacity:0 后整块直接消失）→ 新增 `.battle-unit.dead`（`.uname` 红字、`.slime-wrap` opacity .45 + grayscale .7 + `::after{content:'💀'}` 半透明白、`.hpbar`/`.shieldbar` opacity .5），`.dead` 由 `refreshBars` 两处 `classList.toggle('dead', b.hp<=0)` 维护，时间回溯复活后自动恢复。检查 `A-dead-mark`、`A-revive-mark`。
Task 11 (re-open 3): complete (snapshot backup/史莱姆-20261027-1304-polish2.html, 315,711 字节；tests: selftest 44/44 PASS、R-AUTO PASS、8 界面布局体检 0 溢出)
Known-gap: 我方单位标签仍只显示名字（敌方是「名字 Lv.x」），刻意不改——70px 宽单位里加等级会挤成两行。
Known-gap: 战场中部留白较大（单位只占上下各 26%），是原设计给弹道特效留的空间，未压缩。

### 打磨补丁 2：阵亡格显示成「空槽」

Bugfix: 首次截图的阵亡单位只剩一个 💀，原来的血条位置和身体全是空白，读起来像掉了一块。查证：`.battle-unit.dead .slime{opacity:.55}` 这条规则从来没生效过 —— `.slime` 上的 `.dying` 用的是 `animation ... forwards`，动画结束后定格在 `opacity:0`，动画填值优先级高于普通声明，`.dead` 的 55% 永远盖不上去。
修复: `handleUnitDeath` 里给 `setTimeout(..., 380)`，动画播完后若仍带 `.dead` 就撤掉 `.slime` 的 `.dying`，让半透明灰化的「尸体」接替显示（380ms 取死亡演出 0.34s 之后，避免截断动画）；被回溯复活时 `.dead` 已被 `refreshBars` 清掉，定时器自动跳过。
验证: selftest 44/44 PASS、R-AUTO PASS、截图复核（`tools/out/shots/probe-dead` 期间的裁剪图与 `final-08-battle-dead.png`）—— 阵亡格现在是「灰化半透明身体 + 💀 + 红名 + 血条淡出」，敌方阵亡格同样效果。
诊断成本: 用 CDP `Runtime.evaluate` 直接读 `getComputedStyle` 才定位到「inline `width:0%` 但 `computed:48px`」的假象是 300ms 宽度过渡还没跑完，不是缺陷；起初的肉眼判断（「血条还是满的」）是截图时机造成的误判。
Task 11 (re-open 4): complete (snapshot backup/史莱姆-20261027-1307-polish3.html, 316,043 字节)

### 打磨补丁 3：去掉头顶装饰「尖刺」

Feedback: 用户拿真机截图（深渊冒险选人弹窗）指出史莱姆头顶的尖刺/角很难看，要求去掉。
Ruling: 删除 岩/火/水/草/冰/雷 六种属性的 `.mark::before` 头顶装饰（棱片、焰尖、水滴、双叶、六角结晶、闪电角），保留各自位于体内/底部/侧面的 `::after`（碎石、余烬、涟漪、根须、冷光描边、电弧）；顺带删掉只服务焰尖的 `markFlick`、只服务水滴的 `markBob` 两个 keyframes。理由：这六种都是向上伸出的「角」，在 `.scale-box`（scale .43）和战斗（scale .36）里会被读成畸形犄角；颜色色相本身已经承担主要属性区分。
Bugfix: 删掉焰尖后 `B-four`/`B-matrix`/`B-matrix2` 报「火 没有任何装饰」——火只剩一个 7px 余烬，且 `markEmber` 动画 0% 时 `opacity:0`，取样瞬间被判为不可见。补一条静态的底部热浪 `.slime[data-el="火"] .mark::before`（112×34、径向渐变、无动画），既补上可判定装饰，也让火在缩略图里不至于完全素净。
验证: selftest 44/44 PASS（B 块 6 条形态检查全绿）、R-AUTO PASS、画廊 `?gallery=1` 12 属性复核无头顶凸起、`?battle=ui` 新增第 9 屏 `09-abyss-setup`（弹窗场景）复核：选人弹窗里的史莱姆已是干净圆形，只剩底部/侧面小装饰。
Task 11 (re-open 5): complete (snapshot backup/史莱姆-20261027-1311-nospike.html, 314,308 字节)

### 打磨补丁 4：战败演出要留得住

Feedback: 用户要求「战败动画要从第一轮保留」（战败时己方倒下的演出不能被打断/盖掉）。
Root-cause: `endBattle(win)` 一进来就把 `B.allies` 全部 `a.hp = hpMax(a.ref)` 再 `refreshBars()`，于是最后一击刚倒下、`.dying` 还在播的单位立刻被刷成满血站好，战败演出只存在一帧。原来 else 分支只给己方设 `data-mood='fear'`，`data-dead` 还被强制写成 `'0'`。
Ruling: 战败分支改成「依次倒下」——进函数时先 `fallenIds = new Set(B.allies.filter(a=>a.hp<=0).map(a=>a.ref.id))` 记录谁已经死了；结算照旧发奖励、恢复 `ref.hp`、save；随之的 else 分支对每个己方 `later(..., i*140)` 错峰执行：已阵亡的重新挂 `.dead` + `data-dead=1`，还站着的补一次 `FX.die(el,10)`（战败时全员跟着倒），380ms 后再撤 `.dying` 让尸体定格；敌方存活单位保持 `mood='jump'`（它们赢了）。
Ruling: 战败自动关闭从 3000ms 延长到 4400ms（错峰倒下最慢约 1s，留出看演出的时间）。
Ruling: `.battle-unit.dead .slime` 加 `filter:grayscale(.55) saturate(.75)`，尸体读起来更像倒地而不是变色。
Test: 新增 `R-lose-anim`（打空全员 → `endBattle(false)` → `await sleep(900)` → 断言每个 `.battle-row.ally .battle-unit` 都带 `.dead` 且 `::after` 含 💀）。反向验证：把战败分支里的 `el.classList.add('dead')` 改成注释，副本跑出 `FAIL 44/45`、`FAIL R-lose-anim: 战败后仍有单位站着: T0`。
Test-env: 顺手修了 `tools/out/shots.js` 的一个长期 bug —— `__TEST__.startBattle()` 返回的是 `.battle-field` 元素而不是战斗对象，四处 `const b = T.startBattle(...)` 之后调 `b.refreshBars()`/`b.B` 全部抛错，导致 06/07/08 三屏的「布景动作」其实一直没执行（截图看着正常是因为真实战斗自己打出了阵亡）。统一改成 `T.startBattle(...); const b = T._battle;`；新增 `10-battle-lose` / `11-battle-lose-late` 两屏专门看战败中/后段。
Task 11 (re-open 6): complete (snapshot backup/史莱姆-20261027-1317-loseanim.html, 316,632 字节；tests: selftest 45/45 PASS、R-AUTO PASS、shots 11 屏 0 溢出)

### 打磨补丁 5：装饰层整体移除（用户决定）

Feedback: 用户在看到「只保留贴着身体或往下走的装饰（岩半石/火热浪余烬/水涟漪/草根须/冰冷光/雷电弧）」的清单后，要求这些**也全部删除**。
Ruling: 整层装饰 CSS 全部删除——删掉 12 属性所有 `.slime[data-el="X"] .mark::before/::after` 规则与其专属 keyframes（`markEmber`/`markRipple`/`markArc`/`markGlow`/`markOrbit`/`spaceSpinA`/`spaceSpinB`/`clockHand`/`murkA`/`murkB`），属性差异回到只有色相（`--h/--s/--l`）。代价：12 属性的辨识度只剩颜色，原本"形态语言"这一层设计作废。
Ruling: 保留 `.mark` 空容器与 `.slime[data-el]` 属性——DOM 结构不变、B-dom 检查仍成立、将来要加装饰有位置；`.slime .eyes{z-index:3}` 一并保留（层叠约定不变）。
Test: 删除 4 条装饰检查（`B-four`/`B-rest`/`B-matrix`/`B-matrix2`）与只服务它们的 `pseudoVisible`/`pseudoOK`/`decoBoxes`/`ELS12`；改为把「无装饰」写成断言放进 `B-dom`——对 12 属性逐个检查 `.mark::before/::after` 的计算值 `content` 必须是 `none`，防止将来误加回来。selftest 由 45 条降为 **41 条，41/41 PASS**。
Test: `r-auto` → `R-AUTO PASS: 基线(polish)`；`shots.js nodeco` 11 屏 0 溢出；`gallery -Tag nodeco -Height 1500` 复核：12 属性为纯色相差异、无任何附加形状，四尺度/表情/生病灰化均正常。
Task 11 (re-open 7): complete (snapshot backup/史莱姆-20261027-1320-nodeco.html, 312,547 字节)
Tooling: `tools/selftest.ps1` 画廊分支新增 `-Width`（默认 780）——390 宽时每行只排得下 3 个 cell，第 4 个会被裁成一条，改成 780 后 12 属性 6 个/行、全部可见。

### 打磨补丁 6：战败演出回到第一版（闭眼 + 发抖）

Feedback: 用户给了第一版的 `史莱姆.html` 副本（微信临时目录），要求「战败，只是动作是闭眼加发抖 还原回第一版本……无论是对方战败还是友方战败」。即不要我上一轮做的「错峰倒下 + 灰化尸体 + 💀」。
Check: 读了第一版 `endBattle`（行 4689–4786）：输的一方只做 `sl.dataset.dead='0'; sl.dataset.mood='fear'`，赢的一方 `jump`，己方血量回满、血条隐藏——没有尸体、没有灰化。
Ruling: 把 `endBattle` 的演出改成「输的一方全体 `mood='fear'` + `data-dead='0'` + 撤掉 `.dying`」。判赢 = 魔物 fear、己方 jump（保留花雨）；判负 = 己方 fear、魔物 jump。代价：战败现场只有情绪表达、没有「倒下」的物理感。
Ruling: 顺带删掉我上一轮新增的 `.battle-unit.dead` 整套 CSS（灰化滤镜 + 💀 角标 + 红名 + 血条降透明），阵亡观感回到第一版的「身体留在原地 + `data-dead=1` 平眼」。原因：用户要的是第一版，留着两套并存会让阵亡格出现「灰尸体 + 结算时又站起来」的矛盾。
Ruling: 但保留死亡瞬间的 `FX.die` 缩灭动画，只是 0.34s 播完必须撤掉 `.dying`（否则 forwards 定格 opacity:0，身体永远不回来）。所以 `handleUnitDeath` 里改成「380ms 后若 `data-dead==='1'` 就摘 `.dying`」，不再依赖 `.dead` 类。
Bugfix: 顺着截图的空档发现战斗结束后技能条没收起（插话/逐回合模式下 T0–T3 芯片留在屏幕上）→ `endBattle` 里清 `skSel`/`skPick`、`markTargetable(false)`、给 `#skillBar` 加 `.hide` 并清空。
Test: 改检查——`A-dead-mark` 重写为「`data-dead=1` + `mood=sleep` + 无 `.dead` + 380ms 后 `.dying` 已撤 + opacity>0.9 + 无 💀」；`A-revive-mark` 改为断言复活后无 `.dying`、`data-dead` 不是 `1`；`R-lose-anim` 换成 `R-lose-look`（己方全员 `mood=fear`、`.anim` 的 `animation-name==='shake'`、`.eye::after` 的 `display==='none'` 即闭眼、无 `.dead`）+ 新增 `R-win-look`（魔物 fear+shake、己方全员 jump、技能条已收起）。selftest **42/42 PASS**。
Test: `r-auto` → `R-AUTO PASS: 基线(polish)`；`shots.js revenge2` 13 屏 0 溢出；逐图复核 `10/11-battle-lose`（己方 5 只 `> <` 眯眼 + 〰 发抖、站着、无 💀）、`12/13-battle-win`（魔物 fear + 捕捉按钮、己方 jump + 花雨、技能条已收起）。
Task 11 (re-open 8): complete (snapshot backup/史莱姆-20261027-1326-fearlose.html, 314,062 字节)

