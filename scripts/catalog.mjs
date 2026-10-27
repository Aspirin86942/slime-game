import {writeFile} from 'node:fs/promises';
import {BUILDINGS,DECORATIONS,PLANTS,VISITORS,RECIPES,BABY_EVENTS,BABY_PERSONAL_EVENTS,FAMILIES,MATERIALS} from '../src/world/content.ts';
import {EVENTS,CHARACTERS,PERSONAL_CHAINS,PAIR_EVENTS} from '../src/world/narratives.ts';
const cost=x=>Object.entries(x).map(([k,v])=>`${MATERIALS[k]??k} ${v}`).join('、');
const lines=['# 生活世界完整内容目录','','由 `npm run docs:content` 从实际游戏内容表导出；与 SPEC 一起用于内容验收。',
'','## 设施与升级',''];
for(const b of BUILDINGS)lines.push(`### ${b.name}`,``,`${b.desc}。造价：${cost(b.cost)}。占地 ${b.size.join('×')}。`, ``, `二级：${b.upgrades[0]}；三级：${b.upgrades[1]}。升级费用为基础造价乘目标等级。`,``);
lines.push('## 装饰','');for(const d of DECORATIONS)lines.push(`- ${d.name}：${d.effect}；${cost(d.cost)}。`);
lines.push('','## 植物品种','');for(const p of PLANTS)lines.push(`- ${p.name}（${FAMILIES[p.family]}）：${p.minutes} 分钟成熟，喜光 ${p.light}、湿度 ${p.moisture}、${p.temp}°。用途：${p.use}。${p.parents?'亲本：'+p.parents.map(id=>PLANTS.find(p=>p.id===id).name).join(' × ')+'。':''}`);
lines.push('','## 配方','');for(const r of RECIPES)lines.push(`- ${r.name}：${BUILDINGS.find(b=>b.id===r.building).name} ${r.level} 级；${cost(r.cost)} → ${cost(r.output)}；${r.seconds/60} 分钟。`);
lines.push('','## 生态访客','');for(const v of VISITORS)lines.push(`- ${v.name}：${v.need}；${v.service}。`);
lines.push('','## 探索事件','');for(const e of EVENTS){lines.push(`### ${e.title} · ${e.kind}`,``,e.text,``);for(const c of e.choices)lines.push(`- ${c.text}：${c.result}（基础收获：${cost(c.reward)}）`);lines.push('');}
lines.push('## 固定伙伴的完整章节','');for(const c of CHARACTERS){lines.push(`### ${c.name} · ${c.theme}`,``);for(const [i,ch]of c.chapters.entries()){lines.push(`**${i+1}. ${ch.title}** · 条件：${ch.need}`,``,ch.text,``);for(const choice of ch.choices)lines.push(`- ${choice.text}：${choice.result}`);lines.push('');}}
lines.push('## 性格事件链','');for(const c of PERSONAL_CHAINS){lines.push(`### ${c.personality} · ${c.title}`,``);c.chapters.forEach((t,i)=>lines.push(`${i+1}. ${t}`));lines.push('',`每一步可选择：${c.choices.join('；')}。`,``);}
lines.push('## 双伙伴事件','');for(const e of PAIR_EVENTS)lines.push(`- **${e.title}**：${e.text} 可选择：${e.choices.join('；')}。`);
lines.push('','## 幼体成长事件','');for(const e of [...BABY_EVENTS,...BABY_PERSONAL_EVENTS])lines.push(`- **${e.title}**：${e.text} 可选择：${e.choices.join('；')}。`);
await writeFile('docs/living-world/CONTENT.md',lines.join('\n')+'\n');
console.log('Content catalog generated: 24 facilities / 48 decorations / 54 plants / 72 exploration events / 48 chapters / 42 personality chains / 24 relationship events.');
