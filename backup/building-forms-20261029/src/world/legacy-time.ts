import type {World,GameState,GameCommand,Result,GameEvent,Stock,Genes,Companion,Trip,Slime,Crop,Placement,Juvenile} from './types.ts';
import {BUILDINGS,DECORATIONS,PLANTS,ZONES,RECIPES,ELEMENTS,PERSONALITIES,BABY_EVENTS,BABY_PERSONAL_EVENTS} from './content.ts';
import {EVENTS,CHARACTERS,PERSONAL_CHAINS,PAIR_EVENTS} from './narratives.ts';
import {environment,level,bounds,refreshVisitors,day} from './ecology.ts';
import {random,reward,companion} from './engine.ts';
const produce=(w:World,s:Stock)=>{if(Object.entries(s).every(([k,v])=>(w.stock[k]??0)+v<=9999))reward(w,s);};
const discover=(w:World,id:string)=>{if(!w.discoveries.includes(id))w.discoveries.push(id);};
function friends(w:World,slimes:Slime[],a:number,b:number,amount:number):void {const x=slimes.find(s=>s.id===a),y=slimes.find(s=>s.id===b);if(!x||!y)return;const cx=companion(w,x),cy=companion(w,y);cx.friends[b]=Math.min(100,(cx.friends[b]??0)+amount);cy.friends[a]=Math.min(100,(cy.friends[a]??0)+amount);}
function finishNode(w:World,t:Trip):void {t.node++;t.pending=null;t.nextAt=w.clock+t.duration/4;if(t.node>=4)t.ready=true;}
function visitNode(w:World,t:Trip):void {
 if(t.ready||t.pending)return;const ev=EVENTS.find(e=>e.id===t.events[t.node])!;
 if(t.mode==='active'||['救助','谜题','伙伴','故事','挑战'].includes(ev.kind)){t.pending=ev.id;return;}
 t.log.push(`${ev.title}：队伍完成${t.route===0?'采集':'调查'}。`);t.bag.wood=(t.bag.wood??0)+4+t.region;t.bag.stone=(t.bag.stone??0)+3+t.region;
 if(t.route===1)discover(w,ev.id);finishNode(w,t);
}
function growDuration(w:World,c:Crop):number {const v=w.cultivars.find(v=>v.id===c.cultivar)!,d=PLANTS.find(p=>p.id===v.species)!;return(d.family===3&&c.harvests>0?30:d.minutes)*60;}
export function advanceLegacy(w:World,seconds:number,slimes:Slime[]):void {
 if(!Number.isFinite(seconds)||seconds<=0)return;const end=w.clock+Math.min(seconds,43200);
 while(w.clock<end){
  const dueTrips=w.trips.filter(t=>t.mode==='offline'&&!t.ready&&!t.pending);
  const boundary=Math.min(end,(Math.floor(w.clock/60)+1)*60,...dueTrips.map(t=>Math.max(w.clock,t.nextAt)));
  const dt=boundary-w.clock;
  for(const crop of w.crops){
   if(boundary%60!==0)continue;
   const cropDt=boundary-crop.lastSim;crop.lastSim=boundary;
   if(crop.progress>=1)continue;
   const cultivar=w.cultivars.find(c=>c.id===crop.cultivar)!,def=PLANTS.find(p=>p.id===cultivar.species)!,e=environment(w,crop.zone,crop.x,crop.y,slimes);
   const auto=w.weather===1||w.placements.some(p=>!p.stored&&p.zone===crop.zone&&((['bed','channel'].includes(p.def)&&p.level>=2)||['pond','waterbed'].includes(p.def))&&Math.abs(p.x-crop.x)+Math.abs(p.y-crop.y)<=(p.level===3?3:2))||w.workers.some(j=>w.placements.some(p=>p.id===j.building&&!p.stored&&p.zone===crop.zone&&['bed','channel'].includes(p.def)));
   if(auto)crop.water=180;
   const available=Math.min(cropDt,crop.water*60),mismatch=(Math.abs(e.light-def.light)+Math.abs(e.moisture-def.moisture)+Math.abs(e.temperature-def.temp)*2)/(180+cultivar.genes.adapt*10);
   const rate=Math.max(.25,1-mismatch+(w.visitors['visitor-3']?.08:0))*(1+(cultivar.genes.speed-2)*.08)*(1+e.fertility/250)*(def.family===5&&w.visitors['visitor-10']?1.15:1)*(def.family===5&&w.placements.some(p=>p.zone===crop.zone&&p.def==='waterbed'&&!p.stored&&p.level>=2)?1.12:1)*(level(w,'insects')===3&&Object.values(w.visitors).some(Boolean)?1.05:1);
   crop.progress=Math.min(1,crop.progress+available/growDuration(w,crop)*rate);crop.water=auto?180:Math.max(0,crop.water-cropDt/60);
  }
  for(const b of w.placements.filter(p=>!p.stored)){let left=dt;for(const task of w.crafts.filter(t=>t.building===b.id&&!t.ready)){const used=Math.min(left,task.remaining);task.remaining-=used;left-=used;if(task.remaining<=0)task.ready=true;if(left<=0)break;}}
  w.clock=boundary;
  if(w.clock%3600===0){w.flags=w.flags.filter(f=>!f.startsWith('meal:')||f.startsWith(`meal:${day(w)}:`));w.miniRewards=Object.fromEntries(Object.entries(w.miniRewards).filter(([k])=>k.startsWith(`${day(w)}:`)));}
  if(w.clock>=w.weatherAt){w.weather=Math.floor(random(w)*4);w.weatherAt+=3600;}
  if(dt>0&&w.clock%300===0){
   for(const p of w.placements.filter(p=>!p.stored)){const service=BUILDINGS.find(b=>b.id===p.def)?.service;const bonus=w.workers.filter(j=>j.building===p.id).length;
    if(service==='wood')produce(w,{wood:4*p.level+bonus+(w.visitors['visitor-8']?2:0)});if(service==='stone')produce(w,{stone:3*p.level+bonus});if(service==='water')produce(w,{dew:3*p.level+bonus});if(service==='stars')produce(w,{stardust:p.level+(w.visitors['visitor-17']?1:0)+(p.level===3&&w.weather===2?1:0)});
   }
   refreshVisitors(w,slimes);
   if(w.visitors['visitor-11'])reward(w,{notes:1});if(w.visitors['visitor-12'])reward(w,{fruit:1});if(w.visitors['visitor-13'])reward(w,{herb:1});
   if(w.visitors['visitor-16']){const seed=w.cultivars.find(c=>c.species==='plant-3-4');if(seed)seed.seeds=Math.min(9999,seed.seeds+1);}
   const rest=level(w,'spa');if(rest)for(const s of slimes.filter(s=>!w.trips.some(t=>t.team.includes(s.id)))){s.mood=Math.min(100,s.mood+rest);}
   for(let i=0;i<w.workers.length;i++)for(let j=i+1;j<w.workers.length;j++)if(w.workers[i].building===w.workers[j].building)friends(w,slimes,w.workers[i].slimeId,w.workers[j].slimeId,1);
  }
  for(const t of w.trips)if(t.mode==='offline'&&!t.pending&&!t.ready&&w.clock>=t.nextAt)visitNode(w,t);
 }
}

