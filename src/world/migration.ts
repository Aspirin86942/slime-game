import type {World,Slime,StoryInstance} from './types.ts';
import {bindInventory} from './inventory.ts';
import {BUILDINGS} from './content.ts';
import {CHARACTERS} from './narratives.ts';
import {blockedCells,entranceCells,resident} from './life.ts';

export function prepareWorld(w:World):World {
 w.residents??={};w.stories??={};w.activities??={};w.archives??={};w.familiar??=[];w.evidence??=[];w.payments??=[];w.memorials??=[];return bindInventory(w);
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
