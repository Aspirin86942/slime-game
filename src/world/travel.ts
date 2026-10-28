import type {World,Slime,Trip,GameEvent} from './types.ts';
import {random,reward,companion} from './engine.ts';
import {staminaLimit,record} from './life.ts';
import {grantGlowSeed} from './stories.ts';
import {tripAccount} from './inventory.ts';
import {ZONES} from './content.ts';

const bonus=(s:Slime,key:string)=>(s.traits??[]).filter(t=>t.k===key).reduce((n,t)=>n+t.v,0);
export function collectionTick(w:World,slimes:Slime[]):void {
 for(const t of w.trips.filter(t=>t.mode==='offline'&&!t.legacy&&!t.ready)){
  const team=slimes.filter(s=>t.team.includes(s.id));const limit=(s:Slime)=>Math.max(20,Math.ceil(staminaLimit(s)*.5));
  if(team.some(s=>s.stamina<20||s.mood<=0))t.resting=true;
  if(t.resting&&team.every(s=>s.stamina>=limit(s)&&s.mood>=50))t.resting=false;
  t.phase=(t.phase??0)+1;
  if(!t.resting&&t.phase%12===0){const tier=Math.floor(t.region/2),coinMul=[1,1.6,2.5][tier],expMul=[1,1.25,1.5][tier],treasureMul=[1,1.5,2][tier];
   for(const s of team){s.stamina-=20;const talent=(s.strPotential??10)+(s.agiPotential??10)+(s.magPotential??10)+(s.luck??0)+(s.wit??0)+Math.round(20*(s.size??1)),base=(15+2.5*s.level)*coinMul*(1+bonus(s,'all')+bonus(s,'explore'))*(1+Math.min(.5,talent/300));let gain=Math.round(base);const roll=random(w);if(roll<.02*treasureMul){gain+=Math.round(base*3);t.bag.treasure=(t.bag.treasure??0)+1;}else if(roll<.1)gain+=Math.round(base*3);else if(roll<.35)gain+=Math.round(base);if(random(w)<(s.luck??0)*.005)gain+=Math.round(gain*.5);t.coins=(t.coins??0)+gain;t.experience??={};const xp=Math.round((6+.8*s.level)*expMul);t.experience[s.id]=(t.experience[s.id]??0)+xp;w.payments.push({type:'experience',text:'旅行成长',participants:[s.id],amount:xp},{type:'collection',text:'委托采集',amount:1,object:String(t.region)});s.mood=Math.max(0,Math.min(100,s.mood+Math.floor(random(w)*14)-5));t.actions=(t.actions??0)+1;}
  }
  const n=Math.min(4,Math.floor(t.phase/t.duration*4));while(t.node<n){t.node++;t.bag.wood=(t.bag.wood??0)+4+t.region;t.bag.stone=(t.bag.stone??0)+3+t.region;t.log.push(`第${t.node}段采集：沿熟悉的道路收好材料。`);}
  if(t.phase>=t.duration){t.ready=true;t.resting=false;t.log.push('大家回到家园，收获等待领取。');returnTrip(w,slimes,t);
   if(t.repeat){const fee=Math.max(1,Math.ceil(t.duration/1200));if((w.stock.feed??0)>=fee*2){const events=settleTrip(w,slimes,t);w.payments.push(...events);w.stock.feed-=fee*2;Object.defineProperty(t,'bag',{value:{},writable:true,enumerable:true,configurable:true});t.id=w.seq++;t.ready=false;t.returned=false;t.phase=0;t.node=0;t.coins=0;t.experience={};t.actions=0;t.log=['连续委托：补充饲料后沿熟悉路线出发。'];tripAccount(w,t);}else{t.repeat=false;t.log.push('补给不足，连续委托已暂停；可在家园安排下一次旅程。');}}
  }
 }
}
export function settleTrip(w:World,slimes:Slime[],t:Trip):GameEvent[] {
 returnTrip(w,slimes,t);reward(w,t.bag);const events:GameEvent[]=[];
 if(t.coins)events.push({type:'income',text:'委托收入',amount:t.coins});
 delete w.inventory.containers[`trip:${t.id}`];return events;
}
export function returnTrip(w:World,slimes:Slime[],t:Trip):void {
 if(t.returned)return;t.returned=true;
 if(t.mode==='active'&&t.node>=4){const key=`${t.region}:${t.route}`;if(!w.familiar.includes(key))w.familiar.push(key);if(t.region===1)grantGlowSeed(w,slimes,t.team);}
 if(w.camps.includes(t.region)){t.bag.ingredient=(t.bag.ingredient??0)+2;t.bag.notes=(t.bag.notes??0)+1;}
 if(t.node>0||t.actions){record(w,slimes,'trip',t.team,String(t.region));if(t.team.length>1)record(w,slimes,'together',t.team,'trip');
  for(const a of t.team)for(const b of t.team)if(a!==b){const s=slimes.find(s=>s.id===a);if(s){const c=companion(w,s);c.friends[b]=Math.min(100,(c.friends[b]??0)+5);}}
 }
 w.journals.unshift({id:t.id,title:`${ZONES[t.region].area} · ${t.mode==='active'?'同行':'委托'}`,lines:t.log.slice(),at:w.clock});w.journals=w.journals.slice(0,100);
}
