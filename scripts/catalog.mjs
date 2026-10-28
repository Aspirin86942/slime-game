import {writeFile} from 'node:fs/promises';
import {BUILDINGS,DECORATIONS,PLANTS,VISITORS,RECIPES,BABY_EVENTS,BABY_PERSONAL_EVENTS,FAMILIES,MATERIALS,ZONES} from '../src/world/content.ts';
import {EVENTS,CHARACTERS,PERSONAL_CHAINS,PAIR_EVENTS} from '../src/world/narratives.ts';
const cost=x=>Object.entries(x).map(([k,v])=>`${MATERIALS[k]??k} ${v}`).join('、');
const conditions=c=>[c.requires?.element&&`同行${c.requires.element}伙伴`,c.requires?.personality&&`同行${c.requires.personality}伙伴`,c.requires?.companions&&`${c.requires.companions}位同行者`,c.requires?.building&&`家园设施${c.requires.building}`,c.requires?.cost&&cost(c.requires.cost)].filter(Boolean).join('、')||'所有队伍可选';
const actions=['绑定伙伴种下一株植物','绑定伙伴收获成熟植物','绑定伙伴完成旅行','绑定伙伴照料植物','绑定伙伴完成制作并领取产物','绑定伙伴参加聚餐'];
const lines=['# 共同生活完整内容目录 · V4','','由 `npm run docs:content` 从实际游戏内容表导出；与 SPEC 一起用于内容验收。',
`共 ${BUILDINGS.length} 种设施、${DECORATIONS.length} 件装饰、${PLANTS.length} 种植物、${RECIPES.length} 条配方、${EVENTS.length} 个探索事件、48 章世界故事、${PERSONAL_CHAINS.length} 条性格链、${PAIR_EVENTS.length} 个关系事件。`,
'','## 设施与升级',''];
for(const b of BUILDINGS)lines.push(`### ${b.name}`,``,`${b.desc}。造价：${cost(b.cost)}。占地 ${b.size.join('×')}。`, ``, `二级：${b.upgrades[0]}；三级：${b.upgrades[1]}。升级费用为基础造价乘目标等级。`,``);
lines.push('## 装饰','');for(const d of DECORATIONS)lines.push(`- ${d.name}：${d.effect}；${cost(d.cost)}。`);
lines.push('','## 植物品种','');for(const p of PLANTS)lines.push(`- ${p.name}（${FAMILIES[p.family]}）：${p.minutes} 分钟成熟，喜光 ${p.light}、湿度 ${p.moisture}、${p.temp}°。用途：${p.use}。${p.parents?'亲本：'+p.parents.map(id=>PLANTS.find(p=>p.id===id).name).join(' × ')+'。':''}`);
lines.push('','## 配方','');for(const r of RECIPES)lines.push(`- ${r.name}：${BUILDINGS.find(b=>b.id===r.building).name} ${r.level} 级；${cost(r.cost)} → ${cost(r.output)}；${r.seconds/60} 分钟。`);
lines.push('','## 生态访客','');for(const v of VISITORS)lines.push(`- ${v.name}：${v.need}；${v.service}。`);
lines.push('','## 探索事件','');for(const e of EVENTS){lines.push(`### ${e.title} · ${e.kind}`,``,e.text,``);for(const c of e.choices)lines.push(`- ${c.text}：${c.result}（条件：${conditions(c)}；基础收获：${cost(c.reward)}）`);lines.push('');}
lines.push('## 玩家伙伴参与的世界故事','', '开始时绑定自己选择的伙伴；下列名字是来访者。每章要求绑定伙伴完成新的实际行为，每个选择留下参与者回忆和家园纪念物。已有固定伙伴继续保留。','');for(const c of CHARACTERS){lines.push(`### ${c.name} · ${c.theme}`,``);for(const [i,ch]of c.chapters.entries()){lines.push(`**${i+1}. ${ch.title}** · 条件：${actions[i]}`,``,ch.text,``);for(const choice of ch.choices)lines.push(`- ${choice.text}：${choice.result.replace(c.name+'和你','同行伙伴与你')}（${cost(choice.reward)}；条件：${conditions(choice)}）`);lines.push('');}}
lines.push('## 区域故事','', '各区营地修复后，绑定伙伴依次完成旅行、制作和照料，选择保存路线或种植记录；每段留下纪念物。','');for(const z of ZONES)lines.push(`- **${z.area}**（发现 ${z.threshold} 项开放）：${z.story}`);
lines.push('', '## 发光花愿望','', '自己召唤的伙伴种植、照料并聊天后提出愿望。由同一伙伴制作便当，完成低语森林同行；末节点保证遇到树洞里的发光花。可陪它慢慢观察，或邀请实际同行的第二位伙伴协助。单人始终有可行选择。完成旅程带回种子，种下并等到开花后留下永久纪念，伙伴夜晚会到花边休息。胆小伙伴会记住支持并逐渐主动提议。', '', '基础饲料制作不计作便当，其他伙伴制作也不计入这只的愿望；改名、换查看对象和重复读档不改变绑定或奖励。','');
lines.push('## 性格事件链','', '每条绑定对应性格的一位伙伴，三段依次需要新的照料、旅行、聚餐记录；选择改变旅行或花草偏好，并保留纪念物。','');for(const c of PERSONAL_CHAINS){lines.push(`### ${c.personality} · ${c.title}`,``);c.chapters.forEach((t,i)=>lines.push(`${i+1}. ${t}`));lines.push('',`每一步可选择：${c.choices.join('；')}。`,``);}
lines.push('## 双伙伴事件','', '要求所选两位伙伴确实一起工作、旅行或聚餐；关系门槛依次为 0、2、4……46。只为这两位参与者记录结果。','');for(const e of PAIR_EVENTS)lines.push(`- **${e.title}**：${e.text} 可选择：${e.choices.join('；')}。`);
lines.push('','## 幼体成长事件','');for(const e of [...BABY_EVENTS,...BABY_PERSONAL_EVENTS])lines.push(`- **${e.title}**：${e.text} 可选择：${e.choices.join('；')}。`);
await writeFile('docs/living-world/CONTENT.md',lines.join('\n')+'\n');
console.log(`Content catalog generated: ${BUILDINGS.length} facilities / ${DECORATIONS.length} decorations / ${PLANTS.length} plants / ${RECIPES.length} recipes / ${EVENTS.length} events / 48 chapters / ${PERSONAL_CHAINS.length} personality chains / ${PAIR_EVENTS.length} relationship events.`);
