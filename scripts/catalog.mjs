import {writeFile} from 'node:fs/promises';
import {BUILDINGS,DECORATIONS,PATH_STYLES,PLANTS,VISITORS,RECIPES,FAMILIES,MATERIALS} from '../src/world/content.ts';
const cost=x=>Object.entries(x).map(([k,v])=>`${MATERIALS[k]??k} ${v}`).join('、');
const facilities=BUILDINGS.filter(b=>!['expedition','resonance'].includes(b.id)),decor=DECORATIONS.filter(d=>d.group!==0);
const lines=['# 家园内容目录 · V5','','由 npm run docs:content 从当前内容表生成。', '',
`${facilities.length}种经营设施、${decor.length}件装饰、${PATH_STYLES.length}种路面、${PLANTS.length}种植物、${RECIPES.length}条配方、${VISITORS.length}种生态访客。`, '', '## 经营设施',''];
for(const b of facilities)lines.push(`### ${b.name}`,'',`${b.desc}。造价：${cost(b.cost)}。占地${b.forms.map(f=>f.join('×')).join(' → ')}（1、2、3 级形态）。`,'',`二级：${b.upgrades[0]}；三级：${b.upgrades[1]}。升级费用为基础造价乘目标等级；升级时原地扩建，空间不足则无法升级。`,'');
lines.push('## 装饰与路面','',`连续铺设的路面：${PATH_STYLES.join('、')}。`,'');
for(const d of decor)lines.push(`- ${d.name}：${d.effect}；${cost(d.cost)}。`);
lines.push('','## 植物品种','');for(const p of PLANTS)lines.push(`- ${p.name}（${FAMILIES[p.family]}）：${p.minutes}分钟成熟，喜光${p.light}、湿度${p.moisture}、${p.temp}°。用途：${p.use}。${p.parents?'亲本：'+p.parents.map(id=>PLANTS.find(p=>p.id===id).name).join(' × ')+'。':''}`);
lines.push('','## 配方','');for(const r of RECIPES)lines.push(`- ${r.name}：${BUILDINGS.find(b=>b.id===r.building).name}${r.level}级；${cost(r.cost)} → ${cost(r.output)}；${r.seconds/60}分钟。`);
lines.push('','## 生态访客','');for(const v of VISITORS)lines.push(`- ${v.name}：${v.need}；${v.service}。`);
lines.push('','## 历史收藏','', '已有远征站与共鸣石作为纪念装饰保留。撤回的旅行、故事、关系、幼体和新增小游戏数据归档，保留旧记录与资产。原接球和叠叠乐继续开放。','');
await writeFile('docs/living-world/CONTENT.md',lines.join('\n'),'utf8');
console.log(`Catalog: ${facilities.length} facilities, ${decor.length} decorations, ${PATH_STYLES.length} roads, ${PLANTS.length} plants, ${RECIPES.length} recipes, ${VISITORS.length} visitors.`);
