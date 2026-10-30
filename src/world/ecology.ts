import {biomeAt,mapWidth} from './map.ts';
import {BUILDINGS,DECORATIONS,PLANTS,VISITORS} from './content.ts';
import {workerPresent} from './life.ts';
import type {World,Slime,Environment,Placement} from './types.ts';
export const season=(w:World)=>Math.floor(w.clock/25200)%4;
export const day=(w:World)=>Math.floor(w.clock/3600);
export const night=(w:World)=>w.clock%3600>=2400;
export const dayPhase=(w:World)=>{const t=w.clock%3600;return t<300?'dawn':t<2100?'day':t<2400?'dusk':'night';};
export const springThaw=(w:World)=>season(w)===0?Math.max(0,1-w.clock%25200/3600):0;
export const DAY_PHASES={dawn:'清晨',day:'白天',dusk:'黄昏',night:'夜晚'};
export const SEASONS=['春','夏','秋','冬'];
export const WEATHER=['晴','细雨','薄雾','微风'];
const cap=(v:number)=>Math.min(100,Math.max(0,v));
export function level(w:World,id:string):number {return Math.max(0,...w.placements.filter(p=>p.def===id&&!p.stored).map(p=>p.level));}
// 占地跟随形态 form，功能仍看 level；旧存档缺少 form 时保持 1 级占地，读档不会突然重叠。
export const formOf=(p:Placement):number=>p.form??1;
export function bounds(p:Placement,form=formOf(p)):[number,number] {const d=BUILDINGS.find(b=>b.id===p.def);const s=d?.forms[form-1]??d?.size??[1,1];return p.rotation%2?[s[1],s[0]]:[s[0],s[1]];}
export function environment(w:World,zone:number,x=6,y=6,slimes:Slime[]=[]):Environment {
 const s=season(w),e:Environment={light:60,moisture:45,fertility:45,quality:45,temperature:[22,29,18,8][s],reasons:[`${SEASONS[s]}季基础温度 ${[22,29,18,8][s]}°` ]};
 if((w.version===5?biomeAt(w,x,y):zone)===2){e.light-=15;e.moisture+=15;e.reasons.push('林间树冠：光照 −15，湿度 +15');}
 if((w.version===5?biomeAt(w,x,y):zone)===3){e.moisture+=25;e.quality+=10;e.reasons.push('湿地水网：湿度 +25，水质 +10');}
 if(w.weather===1){e.moisture+=20;e.quality+=5;e.reasons.push('细雨：湿度 +20，水质 +5');}
 if(w.weather===2){e.light-=10;e.moisture+=10;e.reasons.push('薄雾：光照 −10，湿度 +10');}
 if(w.weather===3){e.temperature-=2;e.reasons.push('微风：温度 −2°');}
 let shades=0,lights=0,comfort=0,sets=0;
 for(const p of w.placements.filter(p=>p.zone===zone&&!p.stored)){
  const d=BUILDINGS.find(b=>b.id===p.def),near=Math.abs(p.x-x)+Math.abs(p.y-y)<= (p.level===3?3:2);
  if(d?.id==='greenhouse'){e.temperature=22+(e.temperature-22)/(p.level+1);if(p.level===3)e.light=60;e.reasons.push('温室：稳定温度');}
  if(!near)continue;
  if(d?.service==='wood'){e.light-=8;e.reasons.push('林木园：树荫 −8 光照');}
  if(d?.service==='fertility'){e.fertility+=12*p.level;e.reasons.push(`堆肥箱：肥力 +${12*p.level}`);}
  if(d?.service==='water'||d?.service==='aquatic'){e.moisture+=10+4*p.level;e.reasons.push(`${d.name}：灌溉`);}
  if(d?.service==='quality'||d?.service==='aquatic'){e.quality+=10*p.level;e.reasons.push(`${d.name}：改善水质`);}
  const dec=DECORATIONS.find(d=>d.id===p.def);if(dec){const set=w.version===5&&w.placements.filter(o=>!o.stored&&o.id!==p.id&&o.def.startsWith(`decor-${dec.group}-`)&&Math.abs(o.x-p.x)+Math.abs(o.y-p.y)<=3).length>=2?1.5:1;if(set>1)sets++;if(dec.group===1)shades+=3*set;if(dec.group===2)lights+=4*set;if(dec.group===6||dec.group===4)comfort+=3*set;}
  for(const job of w.workers.filter(j=>j.building===p.id)){
   if(w.version>=4&&!workerPresent(w,job.slimeId,p.id))continue;
   const el=slimes.find(s=>s.id===job.slimeId)?.element;
   if(el==='水'){e.moisture+=10;e.reasons.push('水伙伴：湿度 +10');}
   if(el==='草'){e.fertility+=10;e.reasons.push('草伙伴：肥力 +10');}
   if(el==='火'){e.temperature+=3;e.reasons.push('火伙伴：保温 +3°');}
   if(el==='冰'){e.temperature-=3;e.reasons.push('冰伙伴：降温 −3°');}
  }
 }
 const limit=sets?18:12;if(sets)e.reasons.push('装饰套装：效果 ×1.5');
 e.light+=Math.min(limit,lights)-Math.min(limit,shades);e.moisture+=Math.min(limit,comfort);e.fertility+=Math.min(limit,comfort);
 for(const c of w.crops.filter(c=>c.zone===zone&&Math.abs(c.x-x)+Math.abs(c.y-y)<=2)){
  const p=PLANTS.find(p=>p.id===w.cultivars.find(v=>v.id===c.cultivar)?.species);if(!p)continue;
  if(p.family===3&&c.progress>=.4){e.light-=4;e.reasons.push(`${p.name}：局部树荫`);}
  if(p.family===5){e.quality+=5;e.reasons.push(`${p.name}：水草净化 +5`);}
  if(p.family===4){e.fertility+=3;e.reasons.push(`${p.name}：菌丝共生 +3`);}
 }
 if(w.visitors['visitor-6'])e.fertility+=8;if(w.visitors['visitor-15'])e.fertility+=10;if(w.visitors['visitor-9'])e.quality+=5;
 for(const k of ['light','moisture','fertility','quality'] as const)e[k]=cap(e[k]);
 e.temperature=Math.round(Math.max(-5,Math.min(40,e.temperature)));return e;
}
export function refreshVisitors(w:World,slimes:Slime[]):void {
 for(const v of VISITORS){
  const crops=w.crops.filter(c=>w.version===5?biomeAt(w,c.x,c.y)===v.zone:c.zone===v.zone), env=environment(w,w.version===5?0:v.zone,w.version===5?(v.zone%3)*12+6:6,w.version===5?Math.floor(v.zone/3)*12+6:6,slimes);
  const flower=crops.filter(c=>c.progress>=.7&&PLANTS.find(p=>p.id===w.cultivars.find(x=>x.id===c.cultivar)?.species)?.family===0).length;
  // 夜间生态科技：夜行访客少要求一株植物。
  const nocturnal=['visitor-2','visitor-5','visitor-17'].includes(v.id),plants=v.plants-(nocturnal&&w.estate?.tech.includes('eco-night')?1:0);
  let ok=w.unlocked.includes(v.zone)&&crops.length>=plants&&env.moisture>=v.humidity-level(w,'insects')*5-(level(w,'memorial')===3?3:0)&&env.quality>=v.quality;
  if(v.id==='visitor-0')ok=ok&&flower>=2;
  if(nocturnal)ok=ok&&night(w);
  if(v.id==='visitor-12')ok=ok&&crops.some(c=>PLANTS.find(p=>p.id===w.cultivars.find(x=>x.id===c.cultivar)?.species)?.family===3);
  if(v.id==='visitor-16')ok=ok&&(season(w)===3||slimes.some(s=>s.element==='冰'));
  w.visitors[v.id]=ok;
  if(ok&&!w.discoveries.includes(v.id)){w.discoveries.push(v.id);w.notices.unshift(`新访客：${v.name} · ${v.service}`);}
 }
 w.notices=w.notices.slice(0,20);
}
