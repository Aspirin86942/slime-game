import {writeFile} from 'node:fs/promises';
import {BUILDINGS,DECORATIONS,PATH_STYLES,PLANTS,VISITORS,RECIPES,FAMILIES,MATERIALS,TECHS,BRANCHES,TIER_LEVEL,STARTER_BUILDINGS,AFFINITY,BIOME_BONUS,ZONES,PROSPERITY,DECOR_LEVEL,BRIDGE_CAPS,MARKET_CAP,ORDER_CAP} from '../src/world/content.ts';
const cost=x=>Object.entries(x).map(([k,v])=>`${MATERIALS[k]??k} ${v}`).join('、');
const time=s=>s<3600?`${s/60}分钟`:`${s/3600}小时`;
const facilities=BUILDINGS.filter(b=>!['expedition','resonance'].includes(b.id)),decor=DECORATIONS.filter(d=>d.group!==0);
const lines=['# 家园内容目录 · V5 家园经营','','由 npm run docs:content 从当前内容表生成。', '',
`${facilities.length}种经营设施、${TECHS.length}个科技节点、${decor.length}件装饰、${PATH_STYLES.length}种路面、${PLANTS.length}种植物、${RECIPES.length}条配方、${VISITORS.length}种生态访客。`, '',`开局可建：${STARTER_BUILDINGS.map(id=>BUILDINGS.find(b=>b.id===id).name).join('、')}；其余设施由科技解锁。`,'', '## 经营设施',''];
for(const b of facilities)lines.push(`### ${b.name}`,'',`${b.desc}。造价：${cost(b.cost)}。占地${b.forms.map(f=>f.join('×')).join(' → ')}（1、2、3 级形态）。`,'',`二级：${b.upgrades[0]}；三级：${b.upgrades[1]}。升级费用为基础造价乘目标等级；升级时原地扩建，空间不足则无法升级。`,'');
lines.push('## 科技树','',`研究消耗研究笔记和材料，离线时继续推进。第 1–4 层分别在家园 ${TIER_LEVEL.slice(1).join('、')} 级开放。`,'');
for(const [i,name] of BRANCHES.entries()){lines.push(`### ${name}`,'');for(const t of TECHS.filter(t=>t.branch===i))lines.push(`- 第${t.tier}层 ${t.name}：${t.desc}。${cost(t.cost)}；${time(t.seconds)}${t.requires.length?`；前置 ${t.requires.map(r=>TECHS.find(x=>x.id===r).name).join('、')}`:''}。`);lines.push('');}
lines.push('## 家园等级与驻场','',`繁荣度来自设施等级×10、装饰（每件 2，同组三件相邻另加）、图鉴（访客 5、杂交品种 3）与开垦（每块 5）。2–10 级所需繁荣度：${PROSPERITY.slice(1).join('、')}。`,'',`装饰组开放等级：${DECOR_LEVEL.slice(1).map((l,g)=>`${['围栏','灯具','休闲','花架','标识','生态','纪念'][g]} ${l} 级`).join('、')}。同时驻场人数为 2 + 家园等级。`,'',
 `元素对口：${Object.entries(AFFINITY).map(([el,defs])=>`${el}—${defs.map(d=>BUILDINGS.find(b=>b.id===d).name).join('、')}`).join('；')}。对口伙伴产出 +25%，研究「元素专精」后 +50%。`,'',
 `地形加成 +25%：${Object.entries(BIOME_BONUS).map(([d,z])=>`${BUILDINGS.find(b=>b.id===d).name}在${ZONES[z].name}`).join('、')}。`,'',
 `桥接物品每 12 小时上限：${Object.entries(BRIDGE_CAPS).map(([k,n])=>`${MATERIALS[k]} ${n}`).join('、')}。集市每轮可换晶币：${MARKET_CAP.slice(1).join(' / ')}（1–3 级）。委托每轮最多完成 ${ORDER_CAP} 份。`,'');
lines.push('## 装饰与路面','',`连续铺设的路面：${PATH_STYLES.join('、')}。`,'');
for(const d of decor)lines.push(`- ${d.name}：${d.effect}；${cost(d.cost)}。`);
lines.push('','## 植物品种','');for(const p of PLANTS)lines.push(`- ${p.name}（${FAMILIES[p.family]}）：${p.minutes}分钟成熟，喜光${p.light}、湿度${p.moisture}、${p.temp}°。用途：${p.use}。${p.parents?'亲本：'+p.parents.map(id=>PLANTS.find(p=>p.id===id).name).join(' × ')+'。':''}`);
lines.push('','## 配方','');for(const r of RECIPES)lines.push(`- ${r.name}：${BUILDINGS.find(b=>b.id===r.building).name}${r.level}级${r.tech?`，研究「${TECHS.find(t=>t.id===r.tech).name}」`:''}；${cost(r.cost)} → ${cost(r.output)}；${r.seconds/60}分钟。`);
lines.push('','## 生态访客','');for(const v of VISITORS)lines.push(`- ${v.name}：${v.need}；${v.service}。`);
lines.push('','## 历史收藏','', '已有远征站与共鸣石作为纪念装饰保留。撤回的旅行、故事、关系、幼体和新增小游戏数据归档，保留旧记录与资产。原接球和叠叠乐继续开放。','');
await writeFile('docs/living-world/CONTENT.md',lines.join('\n'),'utf8');
console.log(`Catalog: ${facilities.length} facilities, ${TECHS.length} techs, ${decor.length} decorations, ${PATH_STYLES.length} roads, ${PLANTS.length} plants, ${RECIPES.length} recipes, ${VISITORS.length} visitors.`);
