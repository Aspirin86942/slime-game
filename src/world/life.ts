import {mapWidth,mapHeight,cell,neighbours} from './map.ts';
import type {World,Slime,CompanionActivity,SceneResident,Placement} from './types.ts';
import {BUILDINGS,PLANTS} from './content.ts';
import {bounds,night} from './ecology.ts';
import {companion} from './engine.ts';

export const staminaLimit=(s:Slime)=>Math.round(80+(s.size||1)*40);
export function activity(w:World,id:number):CompanionActivity {
 const session=w.activities?.[id];if(session)return session;
 const trip=w.trips.find(t=>!t.ready&&t.team.includes(id));if(trip)return{kind:'trip',ref:trip.id,phase:trip.resting?'resting':'active'};
 const job=w.workers.find(j=>j.slimeId===id);return job?{kind:'work',ref:job.building}:{kind:'home'};
}
export const atHome=(w:World,id:number)=>activity(w,id).kind==='home';
export function record(w:World,slimes:Slime[],type:string,ids:number[],object=''):void {
 const participants=[...new Set(ids)].filter(id=>slimes.some(s=>s.id===id));if(!participants.length)return;
 for(const id of participants){const c=companion(w,slimes.find(s=>s.id===id)!);c.facts??={};c.facts[type]=(c.facts[type]??0)+1;if(object)c.facts[type+':'+object]=(c.facts[type+':'+object]??0)+1;if(type==='together')for(const other of participants)if(other!==id)c.facts['with:'+other]=(c.facts['with:'+other]??0)+1;}
 w.evidence.push({id:w.seq++,type,participants,object,at:w.clock});if(w.evidence.length>400)w.evidence.splice(0,w.evidence.length-400);
}
export function blockedCells(w:World,zone:number):Set<number> {
 return new Set(w.placements.filter(p=>!p.stored&&p.zone===zone&&!p.def.startsWith('decor-0-')).flatMap(p=>{const[a,b]=bounds(p);return Array.from({length:a*b},(_,i)=>cell(w,p.x+i%a,p.y+Math.floor(i/a)));}));
}
export function entranceCells(w:World,p:Placement):number[]{
 const[a,b]=bounds(p),blocked=blockedCells(w,p.zone),out:number[]=[];
 const add=(x:number,y:number)=>{if(x>=0&&x<mapWidth(w)&&y>=0&&y<mapHeight(w)&&!blocked.has(cell(w,x,y)))out.push(cell(w,x,y));};
 // Clockwise perimeter keeps neighbouring dinner guests next to one another.
 for(let x=p.x-1;x<=p.x+a;x++)add(x,p.y-1);
 for(let y=p.y;y<=p.y+b;y++)add(p.x+a,y);
 for(let x=p.x+a-1;x>=p.x-1;x--)add(x,p.y+b);
 for(let y=p.y+b-1;y>=p.y;y--)add(p.x-1,y);
 return out;
}
export function workerPresent(w:World,id:number,building:number):boolean {
 const r=w.residents[id],p=w.placements.find(p=>p.id===building&&!p.stored);
 return !!(r&&p&&r.target===building&&r.zone===p.zone&&r.arrived&&!r.blocked&&entranceCells(w,p).includes(cell(w,r.x,r.y)));
}
export function route(w:World,zone:number,from:number,targets:number[]):number[]|null {
 const blocked=blockedCells(w,zone),goal=new Set(targets.filter(n=>!blocked.has(n))),roads=new Set(w.paths[zone]??[]);
 if(goal.has(from))return[];const distances=new Map<number,number>([[from,0]]),previous=new Map<number,number>(),open=[from];
 while(open.length){open.sort((a,b)=>distances.get(b)!-distances.get(a)!);const n=open.pop()!;if(goal.has(n)){const result:number[]=[];let c=n;while(c!==from){result.unshift(c);c=previous.get(c)!;}return result;}
  for(const next of neighbours(w,n)){if(blocked.has(next))continue;const cost=distances.get(n)!+(roads.has(next)?1:2);if(cost<(distances.get(next)??Infinity)){distances.set(next,cost);previous.set(next,n);if(!open.includes(next))open.push(next);}}
 }return null;
}
export function resident(w:World,s:Slime):SceneResident {
 const house=w.placements.find(p=>p.def==='house'&&!p.stored);
 const r=w.residents[s.id]??={slimeId:s.id,zone:0,x:w.version===5?(house?.x??14)+s.id%3:s.id%12,y:w.version===5?(house?.y??8)+3:11,target:null,pose:'散步',until:0};
 r.x=Math.min(mapWidth(w)-1,r.x);r.y=Math.min(mapHeight(w)-1,r.y);
 if(!w.unlocked.includes(r.zone))r.zone=0;
 const blocked=blockedCells(w,r.zone);if(blocked.has(cell(w,r.x,r.y))){const cell=Array.from({length:mapWidth(w)*mapHeight(w)},(_,i)=>i).find(n=>!blocked.has(n));if(cell!==undefined){r.x=cell%mapWidth(w);r.y=Math.floor(cell/mapWidth(w));}}
 return r;
}
export function aim(w:World,s:Slime,p:Placement,pose:string):boolean {
 const r=resident(w,s);if(r.zone!==p.zone){r.zone=p.zone;r.x=s.id%12;r.y=11;}if(r.target!==p.id){delete r.goal;r.arrived=false;}r.target=p.id;r.pose=pose;r.blocked=route(w,r.zone,cell(w,r.x,r.y),entranceCells(w,p))===null;return !r.blocked;
}
export function lifeTick(w:World,slimes:Slime[],available:(id:number)=>boolean=()=>true):void {
 for(const s of slimes){const a=activity(w,s.id),r=resident(w,s);if(['battle','play'].includes(a.kind))continue;if(a.kind==='trip'&&a.phase!=='resting')continue;
  if(w.version===5&&a.kind==='home'&&!available(s.id))continue;
  if(a.kind==='work'){const p=w.placements.find(p=>p.id===a.ref&&!p.stored);if(p)aim(w,s,p,`${BUILDINGS.find(b=>b.id===p.def)?.name}帮忙`);}
  if(atHome(w,s.id)||a.phase==='resting'){
   if(w.version!==5){
   const boost=r.arrived&&w.placements.some(p=>p.id===r.target&&p.def==='spa'&&!p.stored)?1.5:1;
   s.stamina=Math.min(staminaLimit(s),s.stamina+.4*boost*(1+(s.traits??[]).filter(t=>t.k==='stam').reduce((n,t)=>n+t.v,0)));s.mood=Math.min(100,s.mood+.1*boost);
   }
   if(w.clock>=r.until){
    const trough=w.placements.find(p=>p.def==='trough'&&!p.stored&&p.zone===r.zone);
    const glow=w.crops.find(c=>c.zone===r.zone&&c.progress>=1&&w.cultivars.find(v=>v.id===c.cultivar)?.species==='glowflower'&&(w.version===5||w.stories[`wish:${s.id}`]?.status==='completed'&&w.stories[`wish:${s.id}`].effects.includes(`crop:${c.id}`)));
    if(trough&&(w.inventory.containers.trough.feed??0)>0&&s.stamina<staminaLimit(s)-5){aim(w,s,trough,'去吃饭');}
    else if(glow&&night(w)){r.target=-glow.id;r.pose='在发光花边休息';}
    else if(s.stamina<staminaLimit(s)*.5||night(w)){const p=w.placements.find(p=>!p.stored&&p.zone===r.zone&&p.def==='spa')??w.placements.find(p=>!p.stored&&p.zone===r.zone&&p.def==='house');if(p)aim(w,s,p,'休息');}
    else if(companion(w,s).interest==='花草'&&w.crops.some(c=>c.zone===r.zone)&&w.clock%30===s.id%30){const c=w.crops.find(c=>c.zone===r.zone)!;r.target=-c.id;r.pose='观察植物';r.until=w.clock+20;}
    else if(w.clock%12===s.id%12){r.target=null;delete r.goal;r.arrived=false;r.pose='散步';const n=neighbours(w,cell(w,r.x,r.y)).filter(n=>!blockedCells(w,r.zone).has(n));if(n.length){const cell=n[Math.floor(w.clock/12+s.id)%n.length];r.x=cell%mapWidth(w);r.y=Math.floor(cell/mapWidth(w));}}
   }
  }
  if(r.target!==null){const p=w.placements.find(p=>p.id===r.target&&!p.stored),crop=r.target<0?w.crops.find(c=>c.id===-r.target!):undefined;
   if(!p&&!crop){r.target=null;r.blocked=false;continue;}
   if(p&&p.zone!==r.zone){r.zone=p.zone;r.x=s.id%12;r.y=11;resident(w,s);}
   const entrances=p?entranceCells(w,p):[cell(w,crop!.x,crop!.y)];if(r.goal!==undefined&&!entrances.includes(r.goal))delete r.goal;const targets=r.goal!==undefined?[r.goal]:entrances;const path=route(w,r.zone,cell(w,r.x,r.y),targets);r.blocked=path===null;r.arrived=path?.length===0;
   if(path?.length){r.x=path[0]%mapWidth(w);r.y=Math.floor(path[0]/mapWidth(w));continue;}
   if(path===null)continue;
   if(w.version!==5&&p?.def==='trough'&&(w.inventory.containers.trough.feed??0)>0&&s.stamina<staminaLimit(s)-5&&w.clock>=r.until){w.inventory.containers.trough.feed--;s.stamina=Math.min(staminaLimit(s),s.stamina+30);s.mood=Math.min(100,s.mood+3);r.pose='吃饭';r.until=w.clock+8;record(w,slimes,'feed',[s.id],'trough');}
   if(a.kind==='work'&&w.clock%300===0){record(w,slimes,'work',[s.id],p!.def);if(['bed','channel','grove'].includes(p!.def)){for(const c of w.crops.filter(c=>c.zone===r.zone&&Math.abs(c.x-r.x)+Math.abs(c.y-r.y)<=3))c.water=180;record(w,slimes,'care',[s.id],p!.def);r.pose=s.element==='水'?'浇水':'照料植物';}}
  }
 }
 if(w.clock%300===0)for(const job of w.workers){const ids=w.workers.filter(j=>j.building===job.building&&workerPresent(w,j.slimeId,j.building)).map(j=>j.slimeId);if(ids.length>1&&ids[0]===job.slimeId)record(w,slimes,'together',ids,`work:${job.building}`);}
 for(const c of w.crops.filter(c=>c.progress>=1&&w.cultivars.find(v=>v.id===c.cultivar)?.species==='glowflower'))for(const story of Object.values(w.stories).filter(i=>i.kind==='wish'&&i.status==='active'&&i.effects.includes(`crop:${c.id}`))){if(!story.effects.includes('bloom')){record(w,slimes,'bloom',story.participants,String(c.id));story.effects.push('bloom');}}
}
