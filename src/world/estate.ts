import type {World,Estate,Placement,Recipe,Slime,Stock,TechDef} from './types.ts';
import {BUILDINGS,DECORATIONS,TECHS,STARTER_BUILDINGS,STARTER_FAMILIES,AFFINITY,BIOME_BONUS,PROSPERITY,DECOR_LEVEL,BRIDGE_CAPS,MARKET_CAP,RECIPES,PLANTS,ORDER_POOL,TIER_LEVEL,ORDER_CAP} from './content.ts';
import {START_PLOTS,PLOT_COUNT,plotAt,plotNeighbours,biomeAt,inside} from './map.ts';
import {level,bounds} from './ecology.ts';

/** 12 小时为一轮：离线最多补算 12 小时，玩家回来时上限总是已经刷新。 */
export const ROUND=43200;
const blank=(w:World):Estate=>({rev:1,tech:[],research:[],plots:[...START_PLOTS],orders:[],nextOrder:w.clock,daily:{window:Math.floor(w.clock/ROUND),made:{},sold:0,orders:0},yields:{}});
export const freshEstate=(w:World):Estate=>blank(w);
const closure=(ids:Set<string>)=>{let grew=true;while(grew){grew=false;for(const id of [...ids])for(const r of TECHS.find(t=>t.id===id)?.requires??[])if(!ids.has(r)){ids.add(r);grew=true;}}return ids;};
/** 旧 V5 存档第一次读入：已经拥有的设施、地块和自动入库都保留，对应科技直接完成。 */
export function migrateEstate(w:World):Estate {
 const e=blank(w),built=new Set(w.placements.map(p=>p.def)),done=new Set<string>(['res-quarry','res-auto','agr-fruit','agr-fungi']);
 for(const t of TECHS)for(const fx of t.effects)if(fx.kind==='building'&&built.has(fx.id!))done.add(t.id);
 if(w.autoReplant)done.add('agr-rotation');
 e.tech=TECHS.map(t=>t.id).filter(id=>closure(done).has(id));
 // V5 原本整张地图都可建造，开垦状态全部保留为已开垦。
 e.plots=Array.from({length:PLOT_COUNT},(_,i)=>i);
 // 读档前已在生长的作物，本轮仍按旧喜好成熟，不会突然变慢。
 for(const c of w.crops)c.legacy=true;
 return e;
}
export function estate(w:World):Estate {
 const e=w.estate??=migrateEstate(w),round=Math.floor(w.clock/ROUND);
 // 增加委托上限前的 V5 家园没有此字段；保留已有制作与出售额度。
 if(e.daily.orders===undefined)e.daily.orders=0;
 if(e.daily.window!==round)e.daily={window:round,made:{},sold:0,orders:0};
 return e;
}
export const researched=(w:World,id:string)=>!!w.estate?.tech.includes(id);
const effects=(w:World)=>TECHS.filter(t=>researched(w,t.id)).flatMap(t=>t.effects);
export const feature=(w:World,id:string)=>effects(w).some(f=>f.kind==='feature'&&f.id===id);
const total=(w:World,kind:string,id?:string)=>effects(w).filter(f=>f.kind===kind&&(id===undefined||f.id===id)).reduce((n,f)=>n+(f.n??0),0);
export const techFor=(kind:'building'|'recipe'|'family',id:string|number):TechDef|undefined=>TECHS.find(t=>t.effects.some(f=>f.kind===kind&&(kind==='family'?f.n===id:f.id===id)));
export function buildingOpen(w:World,def:string):boolean {
 if(STARTER_BUILDINGS.includes(def)||w.placements.some(p=>p.def===def))return true;
 const t=techFor('building',def);return !!t&&researched(w,t.id);
}
export function familyOpen(w:World,family:number):boolean {const t=techFor('family',family);return STARTER_FAMILIES.includes(family)||!!t&&researched(w,t.id);}
export const recipeOpen=(w:World,r:Recipe)=>!r.tech||researched(w,r.tech);
export const decorLevel=(def:string)=>DECOR_LEVEL[DECORATIONS.find(d=>d.id===def)?.group??0]??0;
/** 工作位：1 级 1 位、2 级起 2 位，驻场科技每座再加一位；全家园同时驻场人数受家园等级限制。 */
export const slots=(w:World,p:Placement)=>(p.level>=2?2:1)+total(w,'slots');
export const workerCap=(w:World)=>2+homeLevel(w);
export const affinityBonus=(w:World)=>.25+total(w,'affinity')/100;
export const bufferHours=(w:World)=>4+2*level(w,'warehouse')+total(w,'buffer');
export const craftQueue=(w:World,p:Placement)=>p.level+1+total(w,'queue','craft');
export const researchQueue=(w:World)=>1+(level(w,'archive')>=2?1:0);
export const bridgeCap=(w:World,item:string)=>(BRIDGE_CAPS[item]??Infinity)+total(w,'cap',item);
export const marketCap=(w:World)=>MARKET_CAP[level(w,'market')]??0;
export const affine=(s:Slime|undefined,def:string)=>!!s&&(AFFINITY[s.element]??[]).includes(def);
export const biomeBonus=(w:World,p:Placement)=>BIOME_BONUS[p.def]!==undefined&&biomeAt(w,p.x,p.y)===BIOME_BONUS[p.def];
/** 研究速度：档案馆 1 级 +25%、3 级 +50%，时间元素伙伴驻场每位再 +25%。 */
export function researchSpeed(w:World,slimes:Slime[],present:(id:number,building:number)=>boolean):number {
 const archive=w.placements.find(p=>p.def==='archive'&&!p.stored),lv=archive?.level??0;
 const helpers=archive?w.workers.filter(j=>j.building===archive.id&&present(j.slimeId,archive.id)&&affine(slimes.find(s=>s.id===j.slimeId),'archive')).length:0;
 return 1+(lv>=3?.5:lv>=1?.25:0)+helpers*.25;
}
/* 繁荣度：设施等级、装饰、图鉴与开垦共同构成家园等级，等级再开放科技层级、开垦、驻场和装饰组。 */
export function prosperity(w:World):{score:number;parts:{label:string;value:number}[]} {
 const live=w.placements.filter(p=>!p.stored);
 const facilities=live.filter(p=>BUILDINGS.some(b=>b.id===p.def)&&!['expedition','resonance'].includes(p.def)).reduce((n,p)=>n+p.level*10,0);
 const decor=live.filter(p=>p.def.startsWith('decor-'));
 const sets=decor.filter(p=>decor.filter(o=>o.id!==p.id&&o.def.slice(0,7)===p.def.slice(0,7)&&Math.abs(o.x-p.x)+Math.abs(o.y-p.y)<=3).length>=2).length;
 const visitors=w.discoveries.filter(d=>d.startsWith('visitor-')).length*5,hybrids=w.discoveries.filter(d=>d.startsWith('hybrid-')).length*3;
 const land=Math.max(0,(w.estate?.plots.length??START_PLOTS.length)-START_PLOTS.length)*5;
 const parts=[{label:'设施',value:facilities},{label:'装饰',value:decor.length*2+sets},{label:'图鉴',value:visitors+hybrids},{label:'开垦',value:land}];
 return {score:parts.reduce((n,p)=>n+p.value,0),parts};
}
export function homeLevel(w:World):number {const score=prosperity(w).score;let n=1;while(n<PROSPERITY.length&&score>=PROSPERITY[n])n++;return n;}
export const tierOpen=(w:World,t:TechDef)=>homeLevel(w)>=TIER_LEVEL[t.tier];
/** 研究前置：已完成、正在研究、前置未完成或家园等级不足时返回原因。 */
export function techProblem(w:World,t:TechDef):string {
 const e=estate(w);
 if(e.tech.includes(t.id))return '已经完成';
 if(e.research.some(r=>r.id===t.id))return '正在研究';
 const missing=t.requires.filter(r=>!e.tech.includes(r)).map(r=>TECHS.find(x=>x.id===r)!.name);
 if(missing.length)return `先完成「${missing.join('」「')}」`;
 if(!tierOpen(w,t))return `家园 ${TIER_LEVEL[t.tier]} 级开放`;
 return '';
}
export const plotOpen=(w:World,x:number,y:number)=>w.version!==5||!w.estate||inside(w,x,y)&&w.estate.plots.includes(plotAt(x,y));
export function footprintOpen(w:World,p:Placement):boolean {const[a,b]=bounds(p);for(let y=p.y;y<p.y+b;y++)for(let x=p.x;x<p.x+a;x++)if(!plotOpen(w,x,y))return false;return true;}
/** 第 k 块额外地块（从 0 数起）的开垦条件：成本逐块上升，每两块需要更高一级家园。 */
export function clearing(w:World,plot:number):{cost:Stock;refund:Stock;level:number;problem:string} {
 const e=estate(w),k=Math.max(0,e.plots.length-START_PLOTS.length),cost={wood:20+8*k,stone:10+5*k},refund={wood:10+3*k},need=Math.min(10,1+Math.floor(k/2));
 const problem=!Number.isInteger(plot)||plot<0||plot>=PLOT_COUNT?'地块不存在':e.plots.includes(plot)?'这块地已经开垦':!plotNeighbours(plot).some(n=>e.plots.includes(n))?'先开垦相邻的地块':homeLevel(w)<need?`家园 ${need} 级可以开垦`:'';
 return {cost,refund,level:need,problem};
}
/** 某个物品现在能否在家园做出来：配方看设施等级与科技，原料看产出它的设施或科技。 */
export function canMake(w:World,item:string,requirement=''):boolean {
 const recipes=RECIPES.filter(r=>r.output[item]);
 if(recipes.length)return recipes.some(r=>recipeOpen(w,r)&&w.placements.some(p=>p.def===r.building&&!p.stored&&p.level>=r.level));
 if(!requirement)return true;
 return TECHS.some(t=>t.id===requirement)?researched(w,requirement):w.placements.some(p=>p.def===requirement&&!p.stored);
}
export const ordersLeft=(w:World)=>Math.max(0,ORDER_CAP-estate(w).daily.orders);
export const orderTemplates=(w:World)=>ORDER_POOL.filter(([item,,need])=>canMake(w,item,need)&&!w.estate?.orders.some(o=>o.need[item]));
export const plantFamily=(species:string)=>PLANTS.find(p=>p.id===species)?.family??0;
