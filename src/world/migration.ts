import type {World,Slime,StoryInstance} from './types.ts';
import {bindInventory,deposit} from './inventory.ts';
import {createMap,originalPoint,HOME_WIDTH} from './map.ts';
import {BUILDINGS} from './content.ts';
import {CHARACTERS} from './narratives.ts';
import {blockedCells,entranceCells,resident} from './life.ts';
import {estate} from './estate.ts';

export function prepareWorld(w:World):World {
 w.residents??={};w.stories??={};w.activities??={};w.archives??={};w.familiar??=[];w.evidence??=[];w.payments??=[];w.memorials??=[];bindInventory(w);if(w.version===5)estate(w);return w;
}
export function upgradeWorld(w:World,slimes:Slime[],from=3,at=0):World {
 prepareWorld(w);
 if(w.version===4)return w;
 w.version=4;w.migration={from,at};
 for(const [definition,n]of Object.entries(w.chapters)){
  if(!n)continue;const id=`world:${definition}`,participant=w.recruited[definition];
  w.stories[id]={id,kind:'world',definition:id,participants:participant?[participant]:[],stage:n,status:n>=6?'completed':'active',baseline:{},choices:[],effects:[],legacy:true};
 }
 for(const c of Object.values(w.companions)){for(const [definition,n]of Object.entries(c.story)){if(!n)continue;const id=`personal:${definition}:${c.slimeId}`;w.stories[id]={id,kind:'personal',definition:`personal:${definition}`,participants:[c.slimeId],stage:n,status:n>=3?'completed':'active',baseline:{},choices:[],effects:[],legacy:true};}}
 for(const flag of w.flags){const m=/^pair:(\d+):(\d+):(.+)$/.exec(flag);if(m){const id=`pair:${m[3]}:${m[1]}:${m[2]}`;w.stories[id]={id,kind:'pair',definition:`pair:${m[3]}`,participants:[+m[1],+m[2]],stage:1,status:'completed',baseline:{},choices:[],effects:[],legacy:true};}}
 for(const [key,n]of Object.entries(w.regionStory)){if(!n)continue;const id=`region:${key}`;w.stories[id]={id,kind:'region',definition:id,participants:[],stage:n,status:n>=3?'completed':'active',baseline:{},choices:[],effects:[],legacy:true};}
 for(const trip of w.trips){trip.legacy=true;trip.phase=0;trip.actions=0;trip.coins=0;trip.experience={};}
 for(const s of slimes)resident(w,s);
 installHomeFacilities(w);return w;
}
export function installHomeFacilities(w:World):void {
 for(const def of ['trough','toys']){
  if(w.placements.some(p=>p.def===def))continue;
  const p={id:w.seq++,def,zone:0,x:0,y:0,rotation:0,level:1,stored:true};
  const blocked=blockedCells(w,0);for(let n=132;n>=0;n--){if(blocked.has(n)||w.crops.some(c=>c.zone===0&&c.y*12+c.x===n))continue;p.x=n%12;p.y=Math.floor(n/12);if(entranceCells(w,p).length){p.stored=false;break;}}
  w.placements.push(p);
 }
}

/** Preserve identities and earned contents before retiring the six-map activities. */
export function upgradeHome(w:World,slimes:Slime[]):World {
 prepareWorld(w);if(w.version===5)return w;
 w.retired={version:w.version,trips:JSON.parse(JSON.stringify(w.trips.map(t=>({...t,bag:{...t.bag}})))),juveniles:w.juveniles,mini:w.mini,miniRewards:w.miniRewards,relationships:JSON.parse(JSON.stringify(w.companions))};
 const paths:number[]=[],styles:Record<string,number>={};
 for(const [zone,list] of Object.entries(w.paths))for(const n of list){const p=originalPoint(+zone,n%12,Math.floor(n/12)),key=p.y*HOME_WIDTH+p.x;paths.push(key);const style=w.pathStyles?.[`${zone}:${n}`];if(style)styles[`0:${key}`]=style;}
 for(const p of [...w.placements,...w.crops,...Object.values(w.residents)]){Object.assign(p,originalPoint(p.zone,p.x,p.y));p.zone=0;}
 for(const r of Object.values(w.residents)){r.target=null;r.arrived=false;r.blocked=false;delete r.goal;}
 for(const t of w.trips){deposit(w.inventory.items,t.bag,w.inventory.pending);if(t.coins)w.payments.push({type:'income',text:'旧远行已获得的收入',amount:t.coins});delete w.inventory.containers[`trip:${t.id}`];}
 for(const story of Object.values(w.stories))if(story.status==='active')story.status='archived';
 for(const c of Object.values(w.companions)){c.friends={};c.story={};}
 for(const m of w.memorials)m.zone=0;
 w.workers=w.workers.filter(j=>!w.placements.some(p=>p.id===j.building&&['expedition','resonance'].includes(p.def)));
 w.trips=[];w.juveniles=[];w.mini=null;w.miniRewards={};w.activities={};
 w.paths={'0':paths};w.pathStyles=styles;w.unlocked=[0,1,2,3,4,5];w.map=createMap();w.version=5;
 if(w.cultivars.some(c=>c.species==='glowflower')&&!w.flags.includes('home:glow-seed'))w.flags.push('home:glow-seed');
 for(const s of slimes)resident(w,s);
 // 迁移一次完成：家园扩展（科技、地块、委托）与 V5 布局同时建立，重复读入结果不变。
 estate(w);return w;
}
