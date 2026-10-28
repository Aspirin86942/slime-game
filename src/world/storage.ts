import {prepareWorld} from './migration.ts';
import type {World} from './types.ts';
import {BUILDINGS,DECORATIONS,PLANTS,RECIPES,PERSONALITIES,ELEMENTS,VISITORS} from './content.ts';
import {EVENTS,CHARACTERS,PERSONAL_CHAINS,PAIR_EVENTS} from './narratives.ts';
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const num=(v:unknown,min=0,max=1e12):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const str=(v:unknown,max=4000):v is string=>typeof v==='string'&&v.length<=max;
const arr=(v:unknown,max=10000):v is unknown[]=>Array.isArray(v)&&v.length<=max;
const id=(v:unknown):v is number=>num(v,1,1e9)&&Number.isInteger(v);
const stock=(v:unknown)=>obj(v)&&Object.entries(v).every(([k,n])=>str(k,80)&&num(n));
const safe=(v:unknown,depth=0):boolean=>depth<35&&(v===null||typeof v==='boolean'||str(v)||num(v,-1e12,Number.MAX_SAFE_INTEGER)|| (Array.isArray(v)?v.length<30000&&v.every(x=>safe(x,depth+1)):obj(v)&&Object.entries(v).every(([k,x])=>!['constructor','prototype','__proto__'].includes(k)&&safe(x,depth+1))));
/** Validate before hydration. Never silently discard damaged gameplay fields. */
export function validWorld(value:unknown,slimeIds:number[]=[]):value is World {
 if(!obj(value)||!safe(value))return false;const modern=value.version===4;
 if(modern&&(!obj(value.inventory)||!stock(value.inventory.items)||!stock(value.inventory.pending)||!obj(value.inventory.containers)||!Object.values(value.inventory.containers).every(stock)))return false;
 if(modern){
  for(const k of ['residents','activities','stories','archives'])if(!obj(value[k]))return false;
  for(const k of ['familiar','evidence','payments','memorials'])if(!arr(value[k]))return false;
  const raw=value as unknown as World;
  if(!obj(raw.inventory.containers.trough)||!arr(raw.cultivars)||!arr(raw.trips))return false;
  if(Object.keys(raw).some(k=>['stock','pending'].includes(k)))return false;
  if(raw.cultivars.some(c=>Object.keys(c).includes('seeds')||!num(raw.inventory.items['seed:'+c.id])))return false;
  if(raw.trips.some(t=>Object.keys(t).includes('bag')||!stock(raw.inventory.containers['trip:'+t.id])))return false;
  if(Object.keys(raw.inventory.containers).some(k=>k!=='trough'&&!raw.trips.some(t=>k==='trip:'+t.id)))return false;
  value=JSON.parse(JSON.stringify(value));prepareWorld(value as World);
 }
 const w=value as Record<string,unknown>;
 if(![3,4].includes(Number(w.version))||!num(w.clock)||!num(w.rng,1,4294967295)||!id(w.seq)||!stock(w.stock)||!stock(w.pending)||!num(w.lastGather,-300)||!num(w.lastResonance,-1800)||!num(w.weather,0,3)||!num(w.weatherAt)||typeof w.reducedMotion!=='boolean'||typeof w.autoReplant!=='boolean')return false;
 const lists=['unlocked','placements','cultivars','crops','juveniles','workers','crafts','discoveries','trips','journals','flags','camps','notices'] as const;
 if(lists.some(k=>!arr(w[k])))return false;
 for(const k of ['paths','companions','visitors','chapters','recruited','regionStory','miniRewards'])if(!obj(w[k]))return false;
 const typed=value as unknown as World;
 try{
  const unique=(ns:number[])=>new Set(ns).size===ns.length;
  const allIds=[...typed.placements,...typed.cultivars,...typed.crops,...typed.juveniles,...typed.trips,...typed.crafts].map(p=>p.id);
  if(!allIds.every(id)||!unique(allIds)||typed.seq<=Math.max(0,...allIds))return false;
  if(!typed.unlocked.includes(0)||!unique(typed.unlocked)||!typed.unlocked.every(z=>Number.isInteger(z)&&z>=0&&z<6))return false;
  if(!typed.placements.every(p=>[...BUILDINGS,...DECORATIONS].some(d=>d.id===p.def)&&num(p.zone,0,5)&&num(p.x,0,11)&&num(p.y,0,11)&&num(p.rotation,0,3)&&num(p.level,1,3)&&typeof p.stored==='boolean'))return false;
  if(!typed.cultivars.every(c=>PLANTS.some(p=>p.id===c.species)&&str(c.name,80)&&num(c.seeds,0,9999)&&typeof c.protected==='boolean'&&arr(c.parents)&&c.parents.every(p=>str(p,80))&&obj(c.genes)&&num(c.genes.color,0,360)&&['form','yield','speed','adapt'].every(k=>num((c.genes as unknown as Record<string,unknown>)[k],1,5))))return false;
  if(!typed.crops.every(c=>typed.cultivars.some(v=>v.id===c.cultivar)&&num(c.zone,0,5)&&num(c.x,0,11)&&num(c.y,0,11)&&num(c.progress,0,1)&&num(c.water,0,180)&&num(c.care,0,.21)&&num(c.harvests)&&num(c.lastSim)))return false;
  if(!typed.juveniles.every(j=>str(j.name,80)&&ELEMENTS.includes(j.element)&&PERSONALITIES.includes(j.personality)&&num(j.born)&&num(j.stage,0,1)&&arr(j.care)&&arr(j.traits)&&arr(j.choices)&&typeof j.active==='boolean'&&(j.mentor===null||slimeIds.includes(j.mentor))))return false;
  if(!typed.workers.every(j=>slimeIds.includes(j.slimeId)&&typed.placements.some(p=>p.id===j.building)))return false;
  if(!typed.crafts.every(c=>RECIPES.some(r=>r.id===c.recipe)&&typed.placements.some(p=>p.id===c.building)&&num(c.remaining)&&typeof c.ready==='boolean'&&(c.participants===undefined||arr(c.participants,3)&&c.participants.every(id=>slimeIds.includes(id)||!!typed.archives?.[id]))))return false;
  if(!typed.trips.every(t=>num(t.region,0,5)&&num(t.route,0,2)&&['active','offline'].includes(t.mode)&&[300,1200,3600,10800].includes(t.duration)&&num(t.node,0,4)&&num(t.nextAt)&&arr(t.team,3)&&t.team.length>0&&unique(t.team)&&t.team.every(s=>slimeIds.includes(s)||(t.ready&&!!typed.archives?.[s]))&&arr(t.events,4)&&t.events.length===4&&t.events.every(e=>EVENTS.some(ev=>ev.id===e))&&(t.pending===null||t.events.includes(t.pending))&&stock(t.bag)&&arr(t.log)&&typeof t.ready==='boolean'))return false;
  if(!unique([...typed.workers.map(w=>w.slimeId),...typed.trips.filter(t=>!t.ready).flatMap(t=>t.team),...Object.keys(typed.activities??{}).map(Number)]))return false;
  if(!Object.entries(typed.chapters).every(([k,v])=>CHARACTERS.some(c=>c.id===k)&&num(v,0,6)))return false;
  if(!Object.entries(typed.companions).every(([k,c])=>slimeIds.includes(Number(k))&&obj(c)&&num(c.slimeId,1)&&str(c.role)&&str(c.interest)&&arr(c.memories,20000)&&c.memories.every(m=>obj(m)&&str(m.id)&&str(m.title)&&str(m.text)&&num(m.at))&&obj(c.friends)&&Object.entries(c.friends).every(([k,v])=>(slimeIds.includes(Number(k))||!!typed.archives?.[k])&&num(v,0,100))&&stock(c.story)&&(c.facts===undefined||stock(c.facts))&&num(c.day)&&num(c.daily)&& (c.mentor===null||slimeIds.includes(c.mentor)||!!typed.archives?.[c.mentor])))return false;
  if(!Object.entries(typed.visitors).every(([k,v])=>VISITORS.some(d=>d.id===k)&&typeof v==='boolean')||!Object.entries(typed.recruited).every(([k,v])=>CHARACTERS.some(d=>d.id===k)&&slimeIds.includes(v))||!Object.entries(typed.paths).every(([k,v])=>num(Number(k),0,5)&&arr(v)&&v.every(n=>num(n,0,143)&&Number.isInteger(n))))return false;
  if(!typed.camps.every(n=>Number.isInteger(n)&&n>=0&&n<6)||!Object.entries(typed.regionStory).every(([k,v])=>num(Number(k),0,5)&&Number.isInteger(v)&&num(v,0,3))||!stock(typed.miniRewards))return false;
  if(!typed.flags.every(v=>str(v,180))||!typed.discoveries.every(v=>str(v,180))||!typed.notices.every(v=>str(v)))return false;
  if(!typed.journals.every(j=>id(j.id)&&str(j.title)&&arr(j.lines)&&j.lines.every(x=>str(x))&&num(j.at)))return false;
  if(typed.mini!==null){const m=typed.mini;if(!obj(m)||!['match','pollination','observation'].includes(m.kind)||!arr(m.board,36)||m.board.length!==({match:36,pollination:12,observation:5}[m.kind])||!m.board.every(n=>Number.isInteger(n)&&num(n,0,m.kind==='match'?4:m.kind==='pollination'?5:17))||!arr(m.matches,12)||!m.matches.every(n=>num(n,0,11))||!num(m.selected,-1,35)||!num(m.steps,0,20)||!num(m.score)||!num(m.hp,0,10)||!num(m.round,0,5)||typeof m.done!=='boolean'||typeof m.claimed!=='boolean')return false;}
  if(modern){
   if(!obj(typed.residents)||!obj(typed.activities)||!obj(typed.stories)||!obj(typed.archives)||!arr(typed.familiar)||!arr(typed.evidence)||!arr(typed.payments)||!arr(typed.memorials))return false;
   if(!Object.entries(typed.residents).every(([k,r])=>slimeIds.includes(+k)&&obj(r)&&r.slimeId===+k&&Number.isInteger(r.zone)&&num(r.zone,0,5)&&Number.isInteger(r.x)&&Number.isInteger(r.y)&&num(r.x,0,11)&&num(r.y,0,11)&&str(r.pose)&&num(r.until)&&(r.target===null||Number.isInteger(r.target))))return false;
   if(!Object.entries(typed.activities).every(([k,a])=>slimeIds.includes(+k)&&obj(a)&&['battle','play'].includes(a.kind)))return false;
   if(!Object.entries(typed.archives).every(([key,a])=>id(+key)&&!slimeIds.includes(+key)&&obj(a)&&str(a.name,80)&&obj(a.profile)&&a.profile.slimeId===+key&&arr(a.profile.memories,20000)&&a.profile.memories.every(m=>obj(m)&&str(m.id)&&str(m.title)&&str(m.text)&&num(m.at))))return false;
   if(!Object.values(typed.stories).every(i=>obj(i)&&str(i.id)&&str(i.definition)&&['world','personal','pair','region','wish'].includes(i.kind)&&['active','completed','archived'].includes(i.status)&&Number.isInteger(i.stage)&&num(i.stage,0,6)&&arr(i.participants,3)&&unique(i.participants)&&i.participants.every(id=>slimeIds.includes(id)||!!typed.archives[id])&&stock(i.baseline)&&arr(i.choices)&&arr(i.effects)&&i.effects.every(e=>str(e,200))&&i.choices.every(c=>obj(c)&&Number.isInteger(c.stage)&&num(c.stage,0,5)&&Number.isInteger(c.choice)&&num(c.choice,0,1)&&str(c.text)&&str(c.result)&&num(c.at))&&(!i.participants.length?i.legacy:true)))return false;
   const known=(i:World['stories'][string])=>{const [kind,key]=i.definition.split(':');return kind===i.kind&&(kind==='wish'||kind==='world'&&CHARACTERS.some(c=>c.id===key)||kind==='personal'&&PERSONAL_CHAINS.some(c=>c.id===key)||kind==='pair'&&PAIR_EVENTS.some(c=>c.id===key)||kind==='region'&&/^[0-5]$/.test(key));};
   if(!Object.entries(typed.stories).every(([key,i])=>i.id===key&&known(i)&&i.stage<=(i.kind==='world'?6:i.kind==='pair'?1:3)))return false;
   if(!typed.familiar.every(f=>typeof f==='string'&&/^[0-5]:[0-2]$/.test(f)))return false;
   if(!typed.memorials.every(m=>obj(m)&&str(m.id)&&!!typed.stories[m.story]&&str(m.title)&&str(m.text)&&arr(m.participants,3)&&m.participants.every(n=>slimeIds.includes(n)||!!typed.archives[n])&&Number.isInteger(m.zone)&&num(m.zone,0,5)))return false;
   if(!typed.payments.every(p=>obj(p)&&['income','experience','feed','collection'].includes(p.type)&&num(p.amount)&&str(p.text)&&(p.participants===undefined||arr(p.participants)&&p.participants.every(n=>slimeIds.includes(n)||!!typed.archives[n]))))return false;
   if(!typed.trips.every(t=>[t.coins,t.phase,t.actions].every(n=>n===undefined||num(n))&&(t.experience===undefined||stock(t.experience))&&(t.repeat===undefined||typeof t.repeat==='boolean')&&(t.resting===undefined||typeof t.resting==='boolean')))return false;
   if(!Object.values(typed.inventory.containers).every(stock)||!num(typed.inventory.containers.trough?.feed,0,99))return false;
   if(!typed.evidence.every(e=>obj(e)&&id(e.id)&&str(e.type)&&arr(e.participants,20)&&e.participants.every(n=>slimeIds.includes(n)||!!typed.archives[n])&&num(e.at)))return false;
  }
  return true;
 }catch{return false;}
}
