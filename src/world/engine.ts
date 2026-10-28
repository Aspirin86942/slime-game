import {mapWidth,mapHeight,cell,inside,neighbours,biomeAt} from './map.ts';
import type {World,GameState,GameCommand,Result,GameEvent,Stock,Genes,Companion,Trip,Slime,Crop,Placement,Juvenile} from './types.ts';
import {BUILDINGS,DECORATIONS,PATH_STYLES,PLANTS,ZONES,RECIPES,ELEMENTS,PERSONALITIES,BABY_EVENTS,BABY_PERSONAL_EVENTS} from './content.ts';
import {EVENTS,CHARACTERS,PERSONAL_CHAINS,PAIR_EVENTS} from './narratives.ts';
import {environment,level,bounds,refreshVisitors,day} from './ecology.ts';
import {bindInventory,seedAccount,tripAccount} from './inventory.ts';
import {prepareWorld,installHomeFacilities,upgradeHome} from './migration.ts';
import {activity,atHome,resident,aim,record,lifeTick,staminaLimit,entranceCells,route,workerPresent} from './life.ts';
import {startStory,storyId,storyRequirement,storyScene,storyCasts,automaticChoice,finishStoryChoice,choiceProblem,tripScene,wishTravellers,rememberHollow} from './stories.ts';
import {collectionTick,settleTrip,returnTrip} from './travel.ts';
const copy=<T>(x:T):T=>JSON.parse(JSON.stringify(x)) as T;
const requireThat=(condition:unknown,message:string):void=>{if(!condition)throw new Error(message);};
export const random=(w:World):number=>{let x=w.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;w.rng=x>>>0||1;return w.rng/4294967296;};
const next=(w:World)=>w.seq++;
const genes=(color:number):Genes=>({color,form:2,yield:2,speed:2,adapt:2});
export function createWorld(seed=0x51a7,version:3|4|5=5):World {
 const w:World={version:4,inventory:{items:{wood:80,stone:60,dew:40,ingredient:12},pending:{},containers:{trough:{feed:0}}},residents:{},stories:{},activities:{},archives:{},familiar:[],evidence:[],payments:[],memorials:[],clock:0,rng:seed||1,seq:100,stock:{wood:80,stone:60,dew:40,ingredient:12},unlocked:[0],placements:[{id:1,def:'house',zone:0,x:2,y:1,rotation:0,level:1,stored:false},{id:2,def:'bed',zone:0,x:6,y:2,rotation:0,level:1,stored:false}],paths:{'0':[...Array.from({length:12},(_,i)=>i*12+5)]},cultivars:PLANTS.filter(p=>!p.parents&&p.id!=='glowflower').map((p,i)=>({id:10+i,species:p.id,name:p.name,genes:genes(p.color),parents:[],protected:false,seeds:2})),crops:[],juveniles:[],companions:{},workers:[],crafts:[],visitors:{},discoveries:[],trips:[],journals:[],chapters:{},recruited:{},flags:[],camps:[],regionStory:{},mini:null,miniRewards:{},lastGather:-300,lastResonance:-1800,weather:0,weatherAt:3600,reducedMotion:false,autoReplant:false,notices:['欢迎回家。种一片花，留一条路，和史莱姆一起照料这片土地。'],pending:{}};
 prepareWorld(w);installHomeFacilities(w);
 if(version!==5)return w;
 upgradeHome(w,[]);
 const positions:Record<string,[number,number]>={house:[14,8],bed:[19,9],trough:[14,12],toys:[18,13]};
 for(const p of w.placements)[p.x,p.y]=positions[p.def];
 w.paths={'0':[...Array.from({length:12},(_,i)=>cell(w,17,i+6)),...Array.from({length:8},(_,i)=>cell(w,i+13,11))]};
 w.paths[0]=[...new Set(w.paths[0])];return w;
}
export function companion(w:World,s:Slime):Companion {
 return w.companions[s.id]??=( {slimeId:s.id,role:'园丁',interest:['花草','美食','星空','旅行'][s.id%4],memories:[],friends:{},story:{},mentor:null,daily:0,day:0});
}
function remember(w:World,s:Slime,id:string,title:string,text:string):void {
 const c=companion(w,s);if(c.memories.some(m=>m.id===id))return;
 c.memories.push({id,title,text,at:w.clock});
 if(c.day!==day(w)){c.day=day(w);c.daily=0;}if(c.daily<10){s.intimacy+=2;c.daily+=2;}
}
function discover(w:World,id:string):void {if(!w.discoveries.includes(id))w.discoveries.push(id);}
export function afford(w:World,cost:Stock):boolean{return Object.entries(cost).every(([k,v])=>(w.stock[k]??0)>=v);}
function pay(w:World,cost:Stock):void {requireThat(afford(w,cost),'材料不足，请先采集、收获或探索。');for(const[k,v]of Object.entries(cost))w.stock[k]-=v;}
export function reward(w:World,stock:Stock):void {for(const[k,v]of Object.entries(stock)){const space=Math.max(0,9999-(w.stock[k]??0)),n=Math.min(space,v);w.stock[k]=(w.stock[k]??0)+n;if(v>n)w.pending[k]=(w.pending[k]??0)+v-n;}}
function produce(w:World,stock:Stock):void {if(Object.entries(stock).every(([k,v])=>(w.stock[k]??0)+v<=9999))reward(w,stock);}
export function occupied(w:World,id:number):boolean{return activity(w,id).kind!=='home';}
export function footprint(p:Placement,w:World):number[]{const[a,b]=bounds(p);return Array.from({length:a*b},(_,i)=>cell(w,p.x+i%a,p.y+Math.floor(i/a)));}
function passable(w:World,zone:number):Set<number>{
 const blocked=new Set(w.placements.filter(p=>p.zone===zone&&!p.stored&&!p.def.startsWith('decor-0-')).flatMap(p=>footprint(p,w)));
 const seen=new Set<number>(),queue:number[]=[];
 const width=mapWidth(w),height=mapHeight(w);
 for(let x=0;x<width;x++)queue.push(x,(height-1)*width+x);
 for(let y=0;y<height;y++)queue.push(y*width,y*width+width-1);
 while(queue.length){const n=queue.pop()!;if(seen.has(n)||blocked.has(n))continue;seen.add(n);queue.push(...neighbours(w,n));}
 return seen;
}
export function placementError(w:World,p:Placement):string|null {
 if(!Number.isInteger(p.rotation)||p.rotation<0||p.rotation>3)return '旋转方向无效。';
 if(w.version===5?p.zone!==0:!w.unlocked.includes(p.zone))return '先解锁这个区域。';
 const[a,b]=bounds(p);if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x+a>mapWidth(w)||p.y+b>mapHeight(w))return '物件超出区域边界。';
 const cells=footprint(p,w),others=w.placements.filter(x=>x.id!==p.id&&x.zone===p.zone&&!x.stored);
 if(others.some(o=>footprint(o,w).some(c=>cells.includes(c)))||w.crops.some(c=>c.zone===p.zone&&cells.includes(cell(w,c.x,c.y))))return '这里已有设施或植物。';
 const draft={...w,placements:[...w.placements.filter(x=>x.id!==p.id),p]},reachable=passable(draft,p.zone);
 for(const b of draft.placements.filter(x=>x.zone===p.zone&&!x.stored&&BUILDINGS.some(d=>d.id===x.def))){const[width,height]=bounds(b);let access=false;for(let xx=b.x;xx<b.x+width;xx++)access ||=reachable.has((b.y-1)*mapWidth(w)+xx)||reachable.has((b.y+height)*mapWidth(w)+xx);for(let yy=b.y;yy<b.y+height;yy++)access ||= (b.x>0&&reachable.has(yy*mapWidth(w)+b.x-1))||(b.x+width<mapWidth(w)&&reachable.has(yy*mapWidth(w)+b.x+width));if(!access)return '请给设施留出通往区域边缘的入口。';}
 return null;
}
function plant(w:World,id:number,zone:number,x:number,y:number,explicit=false):void {
 const c=w.cultivars.find(c=>c.id===id);requireThat(c,'没有这个品系。');if(!c)return;
 requireThat(explicit||!c.protected,'这个品系已收藏，请单独选择种植。');requireThat(c.seeds>0,'种子不足，可收获或复制留种。');requireThat(w.version===5?zone===0:w.unlocked.includes(zone),'区域尚未解锁。');
 requireThat(inside(w,x,y),'地块超出范围。');
 requireThat(!w.crops.some(c=>c.zone===zone&&c.x===x&&c.y===y)&&!w.placements.some(p=>!p.stored&&p.zone===zone&&footprint(p,w).includes(cell(w,x,y))),'这里已有植物或设施。');
 const d=PLANTS.find(p=>p.id===c.species)!;requireThat(d.family!==5||w.placements.some(p=>!p.stored&&p.zone===zone&&['pond','waterbed'].includes(p.def)),'水生植物需要本区的水塘或水生种植台。');
 c.seeds--;w.crops.push({id:next(w),cultivar:id,zone,x,y,progress:0,water:180,care:0,harvests:0,lastSim:w.clock});
}
function harvest(w:World,c:Crop):void {
 requireThat(c.progress>=1,'植物还没有成熟。');const v=w.cultivars.find(v=>v.id===c.cultivar)!,d=PLANTS.find(p=>p.id===v.species)!;requireThat(d.id!=='glowflower','这株纪念花会一直开放，可移回种子库重新安放。');
 reward(w,{[d.product]:2+v.genes.yield+(w.visitors['visitor-1']?1:0)});reward(w,{['seed:'+v.id]:1+(level(w,'seedbank')>=3?1:0)+(w.visitors['visitor-0']?1:0)+(w.visitors['visitor-14']?1:0)+(d.family===5&&w.placements.some(p=>p.zone===c.zone&&p.def==='waterbed'&&!p.stored&&p.level===3)?1:0)});discover(w,d.id);if(w.version===5&&!w.flags.includes('home:glow-seed')){w.flags.push('home:glow-seed');let glow=w.cultivars.find(v=>v.species==='glowflower');if(!glow){const def=PLANTS.find(p=>p.id==='glowflower')!;glow={id:next(w),species:def.id,name:def.name,genes:genes(def.color),parents:[],protected:false,seeds:0};w.cultivars.push(glow);seedAccount(w,glow);}reward(w,{['seed:'+glow.id]:1});}w.flags.includes('harvest')||w.flags.push('harvest');c.harvests++;
 if(d.family===3){c.progress=0;c.water=180;c.care=0;}
 else{w.crops=w.crops.filter(x=>x.id!==c.id);if(w.autoReplant&&!v.protected)plant(w,v.id,c.zone,c.x,c.y);}
}
function addJuvenile(w:World,element:Juvenile['element'],name?:string):void {
 w.juveniles.push({id:next(w),name:name??`${element}团子`,element,born:w.clock,stage:0,care:[],mentor:null,traits:[],choices:[],active:w.juveniles.filter(j=>j.active).length<(level(w,'house')||1)*2,personality:PERSONALITIES[Math.floor(random(w)*PERSONALITIES.length)]});
}
function friends(w:World,slimes:Slime[],a:number,b:number,amount:number):void {if(w.version===5)return;const x=slimes.find(s=>s.id===a),y=slimes.find(s=>s.id===b);if(!x||!y)return;const cx=companion(w,x),cy=companion(w,y);cx.friends[b]=Math.min(100,(cx.friends[b]??0)+amount);cy.friends[a]=Math.min(100,(cy.friends[a]??0)+amount);}
export function chapterReady(w:World,id:string):boolean {
 const n=w.chapters[id]??0;if(n>=6)return false;
 return [true,w.flags.includes('harvest'),w.discoveries.length>=3,w.discoveries.length>=6&&Object.keys(w.visitors).some(k=>w.discoveries.includes(k)),w.journals.length>0&&new Set(w.placements.filter(p=>!p.stored&&BUILDINGS.some(b=>b.id===p.def)).map(p=>p.def)).size>=4,w.discoveries.length>=10&&w.camps.length>0][n];
}
function finishNode(w:World,t:Trip):void {t.node++;t.pending=null;t.nextAt=w.clock+t.duration/4;if(t.node>=4){t.ready=true;t.resting=false;}}
function visitNode(w:World,t:Trip):void {
 if(t.ready||t.pending)return;const ev=EVENTS.find(e=>e.id===t.events[t.node])!;
 if(t.mode==='active'||['救助','谜题','伙伴','故事','挑战'].includes(ev.kind)){t.pending=ev.id;return;}
 t.log.push(`${ev.title}：队伍完成${t.route===0?'采集':'调查'}。`);t.bag.wood=(t.bag.wood??0)+4+t.region;t.bag.stone=(t.bag.stone??0)+3+t.region;
 if(t.route===1)discover(w,ev.id);finishNode(w,t);
}
function growDuration(w:World,c:Crop):number {const v=w.cultivars.find(v=>v.id===c.cultivar)!,d=PLANTS.find(p=>p.id===v.species)!;return(d.family===3&&c.harvests>0?30:d.minutes)*60;}
export function advance(w:World,seconds:number,slimes:Slime[],onEvents?:(events:GameEvent[])=>void,available:(id:number)=>boolean=()=>true):void {
 if(!Number.isFinite(seconds)||seconds<=0)return;prepareWorld(w);const end=w.clock+Math.min(Math.floor(seconds),43200);
 while(w.clock<end){
  const dueTrips=w.trips.filter(t=>t.mode==='offline'&&t.legacy&&!t.ready&&!t.pending);
  const boundary=Math.min(end,w.clock+1,...dueTrips.map(t=>Math.max(w.clock,t.nextAt)));
  const dt=boundary-w.clock;
  for(const crop of w.crops){
   if(boundary%60!==0)continue;
   const cropDt=boundary-crop.lastSim;crop.lastSim=boundary;
   if(crop.progress>=1)continue;
   const cultivar=w.cultivars.find(c=>c.id===crop.cultivar)!,def=PLANTS.find(p=>p.id===cultivar.species)!,e=environment(w,crop.zone,crop.x,crop.y,slimes);
   const auto=w.weather===1||w.placements.some(p=>!p.stored&&p.zone===crop.zone&&((['bed','channel'].includes(p.def)&&p.level>=2)||['pond','waterbed'].includes(p.def))&&Math.abs(p.x-crop.x)+Math.abs(p.y-crop.y)<=(p.level===3?3:2))||w.workers.some(j=>workerPresent(w,j.slimeId,j.building)&&w.placements.some(p=>p.id===j.building&&!p.stored&&p.zone===crop.zone&&['bed','channel'].includes(p.def)));
   if(auto)crop.water=180;
   const available=Math.min(cropDt,crop.water*60),mismatch=(Math.abs(e.light-def.light)+Math.abs(e.moisture-def.moisture)+Math.abs(e.temperature-def.temp)*2)/(180+cultivar.genes.adapt*10);
   const rate=Math.max(.25,1-mismatch+(w.visitors['visitor-3']?.08:0))*(1+(cultivar.genes.speed-2)*.08)*(1+e.fertility/250)*(def.family===5&&w.visitors['visitor-10']?1.15:1)*(def.family===5&&w.placements.some(p=>p.zone===crop.zone&&p.def==='waterbed'&&!p.stored&&p.level>=2)?1.12:1)*(level(w,'insects')===3&&Object.values(w.visitors).some(Boolean)?1.05:1);
   crop.progress=Math.min(1,crop.progress+available/growDuration(w,crop)*rate);crop.water=auto?180:Math.max(0,crop.water-cropDt/60);
  }
  for(const b of w.placements.filter(p=>!p.stored)){let left=dt;for(const task of w.crafts.filter(t=>t.building===b.id&&!t.ready)){const used=Math.min(left,task.remaining);task.remaining-=used;left-=used;if(task.remaining<=0)task.ready=true;if(left<=0)break;}}
  w.clock=boundary;lifeTick(w,slimes,available);if(w.version!==5)collectionTick(w,slimes);if(onEvents&&w.payments.length)onEvents(w.payments.splice(0));
  for(const t of w.trips)if(t.ready&&!t.returned)returnTrip(w,slimes,t);
  if(w.clock%3600===0){w.flags=w.flags.filter(f=>!f.startsWith('meal:')||f.startsWith(`meal:${day(w)}:`));w.miniRewards=Object.fromEntries(Object.entries(w.miniRewards).filter(([k])=>k.startsWith(`${day(w)}:`)));}
  if(w.clock>=w.weatherAt){w.weather=Math.floor(random(w)*4);w.weatherAt+=3600;}
  if(dt>0&&w.clock%300===0){
   for(const p of w.placements.filter(p=>!p.stored)){const service=BUILDINGS.find(b=>b.id===p.def)?.service;const bonus=w.workers.filter(j=>j.building===p.id&&workerPresent(w,j.slimeId,p.id)).length;
    if(service==='wood')produce(w,{wood:4*p.level+bonus+(w.visitors['visitor-8']?2:0)});if(service==='stone')produce(w,{stone:3*p.level+bonus});if(service==='water')produce(w,{dew:3*p.level+bonus});if(service==='stars')produce(w,{stardust:p.level+(w.visitors['visitor-17']?1:0)+(p.level===3&&w.weather===2?1:0)});
   }
   refreshVisitors(w,slimes);
   if(w.visitors['visitor-11'])reward(w,{notes:1});if(w.visitors['visitor-12'])reward(w,{fruit:1});if(w.visitors['visitor-13'])reward(w,{herb:1});
   if(w.visitors['visitor-16']){const seed=w.cultivars.find(c=>c.species==='plant-3-4');if(seed)reward(w,{['seed:'+seed.id]:1});}
   const rest=level(w,'spa');if(rest)for(const s of slimes.filter(s=>available(s.id)&&atHome(w,s.id)&&w.residents[s.id]?.arrived&&w.placements.some(p=>p.def==='spa'&&p.id===w.residents[s.id]?.target&&!p.stored))){s.mood=Math.min(100,s.mood+rest);}
   for(let i=0;i<w.workers.length;i++)for(let j=i+1;j<w.workers.length;j++)if(w.workers[i].building===w.workers[j].building&&workerPresent(w,w.workers[i].slimeId,w.workers[i].building)&&workerPresent(w,w.workers[j].slimeId,w.workers[j].building))friends(w,slimes,w.workers[i].slimeId,w.workers[j].slimeId,1);
  }
  for(const t of w.trips)if(t.mode==='offline'&&t.legacy&&!t.pending&&!t.ready&&w.clock>=t.nextAt)visitNode(w,t);
 }
}

export function execute(state:GameState,command:GameCommand,available:(id:number)=>boolean=()=>true):Result {
 const w=prepareWorld(copy(state.world??createWorld())),slimes=copy(state.slimes),events:GameEvent[]=[];let craftParticipants:number[]|undefined,craftItem='';let message='已完成';
 const placement=(id:number)=>{const p=w.placements.find(p=>p.id===id);requireThat(p,'没有找到设施。');return p!;};
 const crop=(id:number)=>{const c=w.crops.find(c=>c.id===id);requireThat(c,'没有找到植物。');return c!;};
 const baby=(id:number)=>{const b=w.juveniles.find(b=>b.id===id);requireThat(b,'没有找到幼体。');return b!;};
 const trip=(id:number)=>{const t=w.trips.find(t=>t.id===id);requireThat(t,'没有找到旅程。');return t!;};
 const actor=()=>{const id=command.actor??slimes.find(s=>atHome(w,s.id)&&available(s.id))?.id;if(id===undefined)return [];requireThat(slimes.some(s=>s.id===id)&&available(id)&&atHome(w,id),'伙伴正在忙碌，无法参加这次互动。');return[id];};
 const free=(id:number)=>{const s=slimes.find(s=>s.id===id);requireThat(s&&available(id)&&!occupied(w,id),'伙伴正在派遣、工作或战斗，请先让它休息。');return s!;};
 try{
  if(w.version===5&&['storyStart','storyChoice','storyEncounter','storyContinue','depart','step','recall','claimTrip','restTrip','tripChoice','tripContinue','camp','regionStory','chapter','personal','pair','resonate','babyCare','babyChoice','babyContinue','grow','adopt','miniStart','miniCell','miniClaim','unlock','relocate'].includes(command.type))throw new Error('这个玩法已收录到历史记录');
 switch(command.type){
  case 'storyStart':{const casts=storyCasts(w,slimes.filter(s=>available(s.id)),command.definition),ids=command.participants??casts[Math.floor(random(w)*casts.length)];requireThat(ids?.length,'等一位合适的伙伴回家，就能开始故事');ids.forEach(free);const i=startStory(w,slimes,command.definition,ids);message=i.participants.map(id=>slimes.find(s=>s.id===id)!.name).join('、')+'走进了这段故事';break;}
  case 'storyEncounter':{
   requireThat(['world','personal','pair'].includes(command.kind),'故事类型无效');
   requireThat(!Object.values(w.stories).some(i=>i.kind===command.kind&&i.status==='active'&&i.participants.length),'先继续正在发生的故事');
   const definitions=command.kind==='world'?CHARACTERS.map(c=>'world:'+c.id):command.kind==='personal'?PERSONAL_CHAINS.map(c=>'personal:'+c.id):PAIR_EVENTS.map(c=>'pair:'+c.id);
   const pool=definitions.map(definition=>({definition,casts:storyCasts(w,slimes.filter(s=>available(s.id)),definition)})).filter(item=>item.casts.length);
   requireThat(pool.length,'等伙伴回家，或迎来新伙伴后，会有新的故事');const picked=pool[Math.floor(random(w)*pool.length)];
   const i=startStory(w,slimes,picked.definition,picked.casts[Math.floor(random(w)*picked.casts.length)]);message=i.participants.map(id=>slimes.find(s=>s.id===id)!.name).join('、')+'走进了这段故事';break;
  }
  case 'storyContinue':{const i=w.stories[command.id];requireThat(i&&i.status==='active'&&i.stage===command.stage,'这一段已经读过了');i.participants.forEach(free);message=finishStoryChoice(w,slimes,i,automaticChoice(w,slimes.filter(s=>i.participants.includes(s.id)),storyScene(i,slimes,w).choices));break;}
  case 'storyChoice':{const i=w.stories[command.id];requireThat(i,'故事不存在');message=finishStoryChoice(w,slimes,i,command.choice);break;}
  case 'refill':{requireThat(command.amount===undefined||Number.isInteger(command.amount)&&command.amount>0,'饲料份数需要正整数');const n=Math.min(command.amount??99,w.stock.feed??0,99-(w.inventory.containers.trough.feed??0));requireThat(Number.isFinite(n)&&n>0,'没有可补充的饲料，或槽已满');pay(w,{feed:n});w.inventory.containers.trough.feed+=n;message=`补充了${n}份饲料`;break;}
  case 'relocate':{const s=free(command.slime);requireThat(w.unlocked.includes(command.zone),'区域尚未开放');const r=resident(w,s);r.zone=command.zone;r.x=s.id%12;r.y=11;r.target=null;message=`${s.name}来到${ZONES[command.zone].name}`;break;}
  case 'interact':{const s=free(command.slime),c=companion(w,s),r=resident(w,s);requireThat(['pet','chat','feed','snack','rest'].includes(command.action),'互动无效');
   if(command.action==='pet'){requireThat(w.clock-(c.lastPet??-30)>=30,'伙伴正在回味刚才的抚摸');c.lastPet=w.clock;s.intimacy++;s.mood=Math.min(100,s.mood+3);record(w,slimes,'pet',[s.id]);events.push({type:'pet',text:'抚摸伙伴',participants:[s.id],amount:1});message=`${s.name}轻轻蹭了蹭你的手`;}
   if(command.action==='feed'){pay(w,{feed:1});s.stamina=Math.min(staminaLimit(s),s.stamina+30);s.mood=Math.min(100,s.mood+5);record(w,slimes,'feed',[s.id]);events.push({type:'feed',text:'喂食',participants:[s.id],amount:8});r.pose='吃饭';r.until=w.clock+8;message=`${s.name}吃好了`;}
   if(command.action==='snack'){pay(w,{snack:1});const key=`snack:${day(w)}`;c.facts??={};if(!c.facts[key]){c.facts[key]=1;s.intimacy++;s.mood=Math.min(100,s.mood+5);}message=`${s.name}喜欢${c.interest==='美食'?'这份果香':'与你分享的时刻'}`;}
   if(command.action==='rest'){const p=w.placements.find(p=>!p.stored&&['spa','house'].includes(p.def));requireThat(p&&aim(w,s,p,'休息'),'请留出通向小屋的道路');r.until=w.clock+30;message=`${s.name}去休息了`;}
   if(command.action==='chat'){if(w.version===5){message=`${s.name}说：今天也想和你一起照料这个家。`;}else if((c.facts?.plant??0)>0&&!w.stories[`wish:${s.id}`]){startStory(w,slimes,'wish',[s.id]);message=`${s.name}想和你一起找会发光的种子`;}else message=c.memories.at(-1)?.text??`${s.name}说：今天也想和你一起照料这个家。`;}
   break;}

  case 'gather':{requireThat(w.clock-w.lastGather>=300,'采集点正在恢复，请稍后再来。');reward(w,{wood:8,stone:6,dew:4,ingredient:1,feed:1});if(!w.cultivars.some(c=>c.seeds>0&&c.species!=='glowflower'))w.cultivars.find(c=>c.species==='plant-2-0')!.seeds++;w.lastGather=w.clock;message='带回材料、食材和基础饲料';break;}
  case 'unlock':{const z=ZONES[command.zone];requireThat(z&&!w.unlocked.includes(z.id)&&w.discoveries.length>=z.threshold,'发现数量不足，或区域已经开放。');pay(w,{wood:10+10*z.id,stone:5+5*z.id});w.unlocked.push(z.id);w.paths[z.id]=Array.from({length:12},(_,i)=>i*12+5);message=`${z.name}已开放`;break;}
  case 'build':{requireThat(w.version!==5||!['expedition','resonance'].includes(command.def),'该设施已作为纪念装饰保留');const d=BUILDINGS.find(b=>b.id===command.def)??DECORATIONS.find(b=>b.id===command.def);requireThat(d,'未知的设施。');if(!d)break;requireThat(!BUILDINGS.some(b=>b.id===d.id)||!w.placements.some(p=>p.def===d.id),'每种功能设施保留一座，可从收纳中取回。');const p:Placement={id:next(w),def:d.id,zone:command.zone,x:command.x,y:command.y,rotation:command.rotation??0,level:1,stored:false};const err=placementError(w,p);requireThat(!err,err??'');pay(w,d.cost);w.placements.push(p);for(const r of Object.values(w.residents))r.arrived=false;message=`${d.name}已建好`;break;}
  case 'move':{const p=placement(command.id),candidate={...p,zone:command.zone,x:command.x,y:command.y,rotation:command.rotation??p.rotation,stored:false};const err=placementError(w,candidate);requireThat(!err,err??'');Object.assign(p,candidate);for(const r of Object.values(w.residents)){r.arrived=false;delete r.goal;}message='位置已保存';break;}
  case 'store':{const p=placement(command.id);requireThat(!w.crafts.some(t=>t.building===p.id),'请先领取或完成设施中的制作队列。');p.stored=true;w.workers=w.workers.filter(j=>j.building!==p.id);message='已收纳，服务已暂停';break;}
  case 'upgrade':{const p=placement(command.id);requireThat(w.version!==5||!['expedition','resonance'].includes(p.def),'纪念装饰可移动或收纳');const d=BUILDINGS.find(d=>d.id===p.def);requireThat(d&&p.level<3&&!p.stored,'设施已满级或处于收纳中。');pay(w,Object.fromEntries(Object.entries(d!.cost).map(([k,v])=>[k,v*(p.level+1)])));p.level++;message=d!.upgrades[p.level-2];break;}
  case 'path':{requireThat((w.version===5?command.zone===0:w.unlocked.includes(command.zone))&&inside(w,command.x,command.y),'路径位置无效。');const key=String(command.zone),n=cell(w,command.x,command.y);w.paths[key]??=[];w.paths[key]=w.paths[key].includes(n)?w.paths[key].filter(v=>v!==n):[...w.paths[key],n];delete w.pathStyles?.[`${key}:${n}`];message='道路已更新';break;}
  case 'paint':{const cells=[...new Set(Array.isArray(command.cells)?command.cells:[])];requireThat((w.version===5?command.zone===0:w.unlocked.includes(command.zone))&&cells.length>0&&cells.length<=mapWidth(w)*mapHeight(w)&&cells.every(n=>Number.isInteger(n)&&n>=0&&n<mapWidth(w)*mapHeight(w))&&Number.isInteger(command.style)&&command.style>=0&&command.style<PATH_STYLES.length,'路面位置或材质无效。');
   // 一次拖动只提交一条命令：路面集合供寻路使用，材质只影响外观；碎石（0 号）是默认材质，不写入存档。
   const key=String(command.zone),styles=w.pathStyles??={},road=new Set(w.paths[key]??[]);
   for(const n of cells){if(command.erase)road.delete(n);else road.add(n);if(command.erase||!command.style)delete styles[`${key}:${n}`];else styles[`${key}:${n}`]=command.style;}
   w.paths[key]=[...road];message=command.erase?`擦除了 ${cells.length} 格路面`:`铺好 ${cells.length} 格${PATH_STYLES[command.style]}`;break;}
  case 'plant':plant(w,command.cultivar,command.zone,command.x,command.y,command.explicit);message='种子已经安家';break;
  case 'sow':{const v=w.cultivars.find(v=>v.id===command.cultivar);requireThat(v&&!v.protected,'请先选择未收藏的品系。');let count=0;for(let y=0;y<mapHeight(w);y++)for(let x=0;x<mapWidth(w);x++){if(count>=6||!v!.seeds)break;try{plant(w,command.cultivar,command.zone,x,y);count++;}catch{ /* Occupied plots are deliberately skipped. */ }}requireThat(count>0,'没有可用地块、种子或水生设施。');message=`已播种 ${count} 株`;break;}
  case 'care':{const c=crop(command.id);pay(w,{dew:1});c.water=180;const add=Math.min(.05,.2-c.care);c.progress=Math.min(1,c.progress+Math.max(0,add));c.care+=Math.max(0,add);message='已浇水并照料';break;}
  case 'careAll':{const list=w.crops.filter(c=>c.progress<1&&c.water<150);requireThat(list.length,'暂时没有需要补水的植物。');pay(w,{dew:list.length});for(const c of list)c.water=180;message=`已为 ${list.length} 株植物补水`;break;}
  case 'harvest':harvest(w,crop(command.id));message='已收获，种子已留存';break;
  case 'harvestAll':{const list=w.crops.filter(c=>c.progress>=1&&w.cultivars.find(v=>v.id===c.cultivar)?.species!=='glowflower');requireThat(list.length,'还没有成熟的植物。');list.forEach(c=>harvest(w,c));message=`收获了 ${list.length} 株植物`;break;}
  case 'uproot':{const c=crop(command.id),v=w.cultivars.find(v=>v.id===c.cultivar)!;reward(w,{['seed:'+v.id]:1});w.crops=w.crops.filter(x=>x.id!==c.id);message='已移回种子库，品系保留';break;}
  case 'cultivar':{const v=w.cultivars.find(v=>v.id===command.id);requireThat(v,'品系不存在。');if(command.name!==undefined){requireThat(command.name.trim().length>0&&command.name.length<=24,'名称需要 1–24 个字。');v!.name=command.name.trim();}if(command.protect!==undefined)v!.protected=command.protect;message='品系档案已保存';break;}
  case 'clone':{const v=w.cultivars.find(v=>v.id===command.id);requireThat(v&&level(w,'seedbank')>0,'复制留种需要种子库。');pay(w,{dew:level(w,'pollen')>=2?2:4});reward(w,{['seed:'+v!.id]:level(w,'seedbank')>=2?3:2});message='相同性状的种子已留存';break;}
  case 'breed':{const a=w.cultivars.find(v=>v.id===command.a),b=w.cultivars.find(v=>v.id===command.b);requireThat(a&&b&&a.id!==b.id&&level(w,'pollen')>0,'选择两个不同品系，并建造授粉棚。');const pa=PLANTS.find(p=>p.id===a!.species)!,pb=PLANTS.find(p=>p.id===b!.species)!;requireThat(pa.family===pb.family,'只有同类植物能够授粉。');requireThat([a!,b!].every(v=>w.crops.some(c=>c.cultivar===v.id&&c.progress>=.7)),'两株亲本需要达到开花阶段。');pay(w,{dew:3});const g={...a!.genes};for(const k of Object.keys(g) as (keyof Genes)[]){g[k]=random(w)<.5?a!.genes[k]:b!.genes[k];if(random(w)<.05)g[k]+=random(w)<.5?-1:1;if(k!=='color')g[k]=Math.max(1,Math.min(5,g[k]));else g[k]=(g[k]+360)%360;}if(level(w,'pollen')===3)g.yield=Math.max(g.yield,3);const hybrid=PLANTS.find(p=>p.parents?.includes(pa.id)&&p.parents?.includes(pb.id));const species=hybrid??(random(w)<.5?pa:pb);w.cultivars.push({id:next(w),species:species.id,name:`${species.name}·${w.seq}`,genes:g,parents:[a!.name,b!.name],protected:false,seeds:2+(w.visitors['visitor-2']?1:0)});discover(w,species.id);message=`育成了 ${species.name}，已留下亲本记录`;break;}
  case 'resonate':{const a=free(command.a),b=free(command.b);requireThat(a.id!==b.id,'请选择两位成年伙伴。');requireThat(w.clock-w.lastResonance>=(level(w,'resonance')>=2?900:1800),'共鸣需要一些休息时间。');pay(w,{dew:8,ingredient:2});addJuvenile(w,random(w)<.5?a.element:b.element);w.lastResonance=w.clock;friends(w,slimes,a.id,b.id,3);message='新幼体诞生了，已安全安置';break;}
  case 'babyCare':{const b=baby(command.id);requireThat(b.active,'先将幼体安置到小屋。');requireThat(['喂食','游戏','安抚','环境','导师'].includes(command.kind),'未知的照料方式。');if(!b.care.includes(command.kind)){if(command.kind==='喂食')pay(w,{ingredient:1});if(command.kind==='导师'){const s=free(command.mentor??0);b.mentor=s.id;}b.care.push(command.kind);}message='这次陪伴已经记下';break;}
  case 'babyContinue':
  case 'babyChoice':{const b=baby(command.id);if(command.type==='babyContinue')requireThat(b.stage===command.stage&&b.choices.length===command.chapter,'这一段已经读过了');const choice=command.type==='babyContinue'?Math.floor(random(w)*2):command.choice;requireThat(b.active&&[0,1].includes(choice),'请安置幼体并选择回应。');const personal=`${b.stage}:personal`,element=`${b.stage}:element`;const key=b.choices.includes(element)?personal:element;requireThat(!b.choices.includes(key),'这个阶段的成长事件已经完成。');b.choices.push(key);const text=key===element?BABY_EVENTS.find(e=>e.element===b.element)!.choices[choice]:BABY_PERSONAL_EVENTS[b.id%24].choices[choice];b.traits.push(text);message=text;break;}
  case 'grow':{const b=baby(command.id);requireThat(b.active&&b.care.length>=(b.stage===0?3:5)&&w.clock-b.born>=(b.stage===0?900:3600)*(level(w,'resonance')===3?.8:1),'还需要成长时间与照料里程碑。');if(b.stage===0){b.stage=1;message='幼体进入幼年阶段';}else{events.push({type:'adopt',text:`${b.name}长大了`,juvenile:copy(b)});w.juveniles=w.juveniles.filter(j=>j.id!==b.id);message='已成年，童年与导师记录将随它保留';}break;}
  case 'adopt':{const b=baby(command.id);requireThat(!b.active&&w.juveniles.filter(j=>j.active).length<(level(w,'house')||1)*2,'小屋容量已满，请升级或陪伴在养幼体成年。');b.active=true;message='幼体已入住小屋';break;}
  case 'assign':{free(command.slime);const p=placement(command.building);requireThat(!p.stored&&BUILDINGS.some(b=>b.id===p.def)&&(w.version!==5||!['expedition','resonance'].includes(p.def)),'设施不可用。');requireThat(w.workers.filter(j=>j.building===p.id).length<(p.level>=2?2:1),'这个设施的工作位已满。');w.workers.push({slimeId:command.slime,building:p.id});companion(w,slimes.find(s=>s.id===command.slime)!).role=(BUILDINGS.find(b=>b.id===p.def)?.name??'家园')+'帮手';message='工作已安排，可随时休息';break;}
  case 'unassign':w.workers=w.workers.filter(j=>j.slimeId!==command.slime);message='伙伴已休息';break;
  case 'craft':{const r=RECIPES.find(r=>r.id===command.recipe),p=placement(command.building);requireThat(r&&r.building===p.def&&!p.stored&&p.level>=r.level,'设施或等级不符合配方要求。');requireThat(w.crafts.filter(t=>t.building===p.id).length<p.level+1,'制作队列已满。');pay(w,r!.cost);w.crafts.push({participants:actor(),id:next(w),recipe:r!.id,building:p.id,remaining:r!.seconds,ready:false});message='材料已预留，加入制作队列';break;}
  case 'claimCraft':{const c=w.crafts.find(t=>t.id===command.id);requireThat(c?.ready,'制作尚未完成或已经领取。');craftParticipants=c!.participants??[];const output=RECIPES.find(r=>r.id===c!.recipe)!.output;craftItem=output.meal?'meal':'';reward(w,output);if(c!.recipe==='fertilizer'&&w.visitors['visitor-7'])reward(w,{fertilizer:1});w.crafts=w.crafts.filter(t=>t.id!==command.id);message='制作产物已领取';break;}
  case 'useSupply':{const s=free(command.slime);requireThat(['meal','soup','potion'].includes(command.item),'补给不存在。');pay(w,{[command.item]:1});s.stamina=Math.max(s.stamina,Math.min(staminaLimit(s),s.stamina+(command.item==='potion'?30:15)));s.mood=Math.min(100,s.mood+(command.item==='soup'?15:8));remember(w,s,`supply:${command.item}:${day(w)}`,'为旅程准备的一餐',`${s.name}使用了家园制作的补给，准备迎接新的旅程。`);message='伙伴补充了体力与心情';break;}
  case 'fertilize':{const c=crop(command.id);requireThat(command.item==='fertilizer'||command.item==='soil','请选择肥料或沃土。');requireThat(c.care<.2,'本次生长周期的照料加速已达 20%。');pay(w,{[command.item]:1});const n=Math.min(.2-c.care,command.item==='soil'?.15:.1);c.care+=n;c.progress=Math.min(1,c.progress+n);message='植物吸收了养分，生长进度已增加';break;}
  case 'depart':{const z=ZONES[command.region];requireThat(z&&w.discoveries.length>=z.threshold,'还需要更多发现来打开这片区域。');requireThat(['active','offline'].includes(command.mode),'出行方式无效');requireThat(command.team.length>=1&&command.team.length<=3&&new Set(command.team).size===command.team.length,'队伍需要1–3位不同伙伴。');command.team.forEach(free);requireThat(w.trips.filter(t=>!t.ready).length<3,'最多同时安排三支队伍。');requireThat([0,1,2].includes(command.route)&&[300,1200,3600,10800].includes(command.duration),'路线或时长无效。');if(command.mode==='offline'){requireThat(w.familiar.includes(`${z.id}:${command.route}`),'先一起完成这条路线，再委托伙伴采集。');const item=command.supply??'feed';requireThat(['feed','meal'].includes(item),'补给无效');pay(w,{[item]:Math.max(1,Math.ceil(command.duration/1200))*(item==='feed'?2:1)});}const hollow=command.mode==='active'&&z.id===1&&wishTravellers(w,command.team).length>0;const pool=EVENTS.filter(e=>e.region===z.id&&(!hollow||e.id!=='event-1-7')),selected=Array.from({length:hollow?3:4},()=>pool.splice(Math.floor(random(w)*pool.length),1)[0].id);if(hollow)selected.push('event-1-7');const t:Trip={id:next(w),region:z.id,route:command.route,team:command.team.slice(),mode:command.mode,duration:command.duration,nextAt:w.clock+command.duration/4,node:0,events:selected,pending:null,bag:{},log:[`${command.team.map(id=>slimes.find(s=>s.id===id)!.name).join('、')}从家园出发。`],ready:false,phase:0,repeat:!!command.repeat,coins:0,experience:{},actions:0};w.trips.push(t);tripAccount(w,t);message=command.mode==='active'?'一起出发，沿途的故事会等你翻阅':'委托已出发，沿熟悉的路线采集';break;}
  case 'step':{const t=trip(command.id);requireThat(t.mode==='active'&&!t.pending&&!t.ready,'请先处理当前节点。');const team=slimes.filter(s=>t.team.includes(s.id));requireThat(team.every(s=>s.stamina>=3),'伙伴需要休整或返回。');team.forEach(s=>s.stamina-=3);visitNode(w,t);message='到达新的地图节点';break;}
  case 'restTrip':{const t=trip(command.id);requireThat(!t.ready,'队伍已回家');const item=w.stock.meal>0?'meal':w.stock.feed>0?'feed':null;if(item)pay(w,{[item]:1});slimes.filter(s=>t.team.includes(s.id)).forEach(s=>s.stamina=Math.min(staminaLimit(s),s.stamina+(item?15:3)));t.log.push(item?'分享补给后继续前进。':'在安全处慢慢休息，恢复了少量体力。');message='队伍休整好了';break;}
  case 'tripContinue':
  case 'tripChoice':{const t=trip(command.id),ev=tripScene(w,t,slimes);requireThat(ev,'事件已完成');const team=slimes.filter(s=>t.team.includes(s.id));if(command.type==='tripContinue')requireThat(t.pending===command.event,'这一段已经读过了');const choice=command.type==='tripContinue'?(ev!.kind==='挑战'&&team.reduce((n,s)=>n+s.level,0)<t.region*3+1?1:automaticChoice(w,team,ev!.choices)):command.choice;requireThat([0,1].includes(choice),'事件已完成或选项无效。');const ch=ev!.choices[choice];const issue=choiceProblem(w,slimes.filter(s=>t.team.includes(s.id)),ch);requireThat(!issue,issue??'');if(ch.requires?.cost)pay(w,ch.requires.cost);let won=true;if(ev!.kind==='挑战'){const power=t.team.reduce((n,id)=>n+(slimes.find(s=>s.id===id)?.level??1),0);won=choice===1||power>=t.region*3+1;}if(won){rememberHollow(w,slimes,t,choice);for(const[k,v]of Object.entries(ch.reward))t.bag[k]=(t.bag[k]??0)+Math.round(v*(1+t.duration/10800)*(1+level(w,'expedition')*.05));if(w.visitors['visitor-5'])t.bag.stardust=(t.bag.stardust??0)+1;if(w.visitors['visitor-4']||level(w,'observe')===3)t.bag.notes=(t.bag.notes??0)+1;}t.log.push(`${ev!.title} · ${ch.text}：${won?ch.result:'力道还不够。队伍选择安全返回，之前的发现已经保存。'}`);discover(w,ev!.id);if(won&&ch.flag)discover(w,ch.flag);if(won&&ev!.kind==='救助'&&!w.flags.includes(ev!.id)){addJuvenile(w,ELEMENTS[(t.region*2+choice)%12]);w.flags.push(ev!.id);t.log.push('一只幼体获救，已送回家园安全安置。');}if(won&&t.route===1){const p=PLANTS.filter(p=>p.parents)[(t.region*3+t.node)%18];if(!w.cultivars.some(v=>v.species===p.id)){w.cultivars.push({id:next(w),species:p.id,name:p.name,genes:genes(p.color),parents:['野外调查'],protected:false,seeds:1+(level(w,'expedition')===3?1:0)});discover(w,p.id);}}for(const id of t.team){const s=slimes.find(s=>s.id===id)!;remember(w,s,`${t.id}:${ev!.id}`,ev!.title,won?ch.result:'队伍未能完成挑战，选择安全返回。');}finishNode(w,t);if(!won)t.ready=true;message=won?'旅途经历已记下':'队伍安全返程';break;}
  case 'recall':{const t=trip(command.id);requireThat(!t.ready,'伙伴已经回家，物资等待领取');t.ready=true;t.pending=null;t.log.push('选择提前返回，保留已完成的发现。');message='已召回，可以领取途中收获';break;}
  case 'claimTrip':{const t=trip(command.id);requireThat(t.ready,'队伍尚未返程。');events.push(...settleTrip(w,slimes,t));w.trips=w.trips.filter(x=>x.id!==t.id);message='收获与共同旅行已保存';break;}
  case 'camp':{const z=ZONES[command.region];requireThat(z&&w.discoveries.length>=z.threshold&&!w.camps.includes(z.id),'营地尚不可修复，或已经修好。');pay(w,{wood:15+z.id*5,stone:10+z.id*3});w.camps.push(z.id);message='营地修复了，返程获得额外补给';break;}
  case 'regionStory':{const id=`region:${command.region}`;const i=w.stories[id]??startStory(w,slimes,id,command.participants??actor());message=finishStoryChoice(w,slimes,i,0);break;}
  case 'chapter':{const id=`world:${command.character}`;const i=w.stories[id]??startStory(w,slimes,id,command.participants??actor());message=finishStoryChoice(w,slimes,i,command.choice);break;}
  case 'personal':{const definition=`personal:${command.chain}`,id=storyId(definition,[command.slime]);const i=w.stories[id]??startStory(w,slimes,definition,[command.slime]);message=finishStoryChoice(w,slimes,i,command.choice);break;}
  case 'pair':{const definition=`pair:${command.event}`,id=storyId(definition,[command.a,command.b]);const i=w.stories[id]??startStory(w,slimes,definition,[command.a,command.b]);message=finishStoryChoice(w,slimes,i,command.choice);break;}
  case 'meal':{requireThat(level(w,'table')>0,'先建一张餐桌。');requireThat(new Set(command.ids).size===command.ids.length&&command.ids.length>=2&&command.ids.length<=level(w,'table')*2,'请选择符合餐桌容量的不同伙伴。');const list=command.ids.map(free);pay(w,{meal:Math.ceil(list.length/2)});const table=w.placements.find(p=>p.def==='table'&&!p.stored)!;const seated=[list[0]],remaining=list.slice(1);while(remaining.length){remaining.sort((a,b)=>(companion(w,seated.at(-1)!).friends[b.id]??0)-(companion(w,seated.at(-1)!).friends[a.id]??0));seated.push(remaining.shift()!);}const seats=entranceCells(w,table);requireThat(seats.length>=list.length,'餐桌周围需要更多座位');seated.forEach((s,index)=>{requireThat(aim(w,s,table,'聚餐'),'餐桌暂时不可达');const r=resident(w,s);r.goal=seats[index];requireThat(route(w,r.zone,cell(w,r.x,r.y),[r.goal])!==null,'这位伙伴的座位暂时不可达');r.until=w.clock+40;});record(w,slimes,'meal',command.ids);record(w,slimes,'together',command.ids,'meal');for(const s of list){s.mood=Math.min(100,s.mood+8);remember(w,s,`meal-${day(w)}`,'家园的一餐','你们在同一张桌边分享今天的发现。');}const key=`meal:${day(w)}:${command.ids.slice().sort((a,b)=>a-b).join(',')}`;if(!w.flags.includes(key)){for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)friends(w,slimes,list[i].id,list[j].id,3+level(w,'memorial')+Math.min(2,w.placements.filter(p=>!p.stored&&(p.def.startsWith('decor-3-')||p.def.startsWith('decor-7-'))).length));w.flags.push(key);}message='大家一起吃了一顿饭';break;}
  case 'miniStart':{requireThat(['match','pollination','observation'].includes(command.kind),'未知的小游戏。');requireThat(!w.mini||w.mini.claimed,'当前游戏尚未结束或领取，请先完成它。');const board=command.kind==='match'?Array.from({length:36},()=>Math.floor(random(w)*5)):command.kind==='pollination'?Array.from({length:12},(_,i)=>Math.floor(i/2)):Array.from({length:5},()=>Math.floor(random(w)*18));if(command.kind==='pollination')for(let i=board.length-1;i>0;i--){const j=Math.floor(random(w)*(i+1));[board[i],board[j]]=[board[j],board[i]];}const participants=actor();requireThat(participants.length,'先邀请一位在家的伙伴');for(const id of participants)w.activities[id]={kind:'play',ref:'mini'};w.mini={participants,kind:command.kind,board,selected:-1,steps:20,score:0,hp:10,matches:[],done:false,claimed:false,round:0};message='游戏开始';break;}
  case 'miniCell':{const m=w.mini;requireThat(m&&!m.done&&Number.isInteger(command.index)&&command.index>=0&&command.index<(m.kind==='observation'?18:m.board.length),'游戏已经结束或位置无效。');if(!m)break;
   if(m.kind==='observation'){if(command.index===m.board[m.round])m.score++;m.round++;m.done=m.round>=5;}
   else if(m.kind==='pollination'){if(m.matches.includes(command.index))break;if(m.selected===-1)m.selected=command.index;else if(m.selected!==command.index){m.steps--;if(m.board[m.selected]===m.board[command.index]){m.matches.push(m.selected,command.index);m.score++;}m.selected=-1;m.done=m.matches.length===12||m.steps===0;}}
   else if(m.selected===-1)m.selected=command.index;
   else{const a=m.selected,b=command.index;m.selected=-1;requireThat((Math.floor(a/6)===Math.floor(b/6)&&Math.abs(a-b)===1)||Math.abs(a-b)===6,'选择相邻的两个方块。');[m.board[a],m.board[b]]=[m.board[b],m.board[a]];const hits=new Set<number>();for(let i=0;i<36;i++){if(i%6<=3&&m.board[i]===m.board[i+1]&&m.board[i]===m.board[i+2]){hits.add(i);hits.add(i+1);hits.add(i+2);}if(i<24&&m.board[i]===m.board[i+6]&&m.board[i]===m.board[i+12]){hits.add(i);hits.add(i+6);hits.add(i+12);}}m.steps--;m.score+=hits.size;if(m.steps<10)m.hp-=hits.size>=3?0:2;for(const i of hits)m.board[i]=Math.floor(random(w)*5);m.done=m.steps<=0||m.hp<=0;}
   if(m.done){for(const id of m.participants??[])if(w.activities[id]?.ref==='mini')delete w.activities[id];record(w,slimes,'play',m.participants??[],m.kind);}
   message=m.done?'本局结束，可以领取结果':'已记录这一步';break;}
  case 'miniClaim':{const m=w.mini;requireThat(m?.done&&!m.claimed,'游戏尚未结束或已领取。');const key=`${day(w)}:${m!.kind}`,count=w.miniRewards[key]??0;if(count<3){reward(w,m!.kind==='match'?{wood:Math.min(20,m!.score),stone:Math.min(20,m!.score),dew:Math.min(10,m!.score)}:m!.kind==='pollination'?{petal:m!.score*2,dew:m!.score}:{notes:m!.score+(level(w,'observe')>=2?1:0),ingredient:m!.score});w.miniRewards[key]=count+1;message='小游戏奖励已领取';}else message='练习完成，本日奖励次数已用完';m!.claimed=true;break;}
  case 'settings':if(command.reduced!==undefined)w.reducedMotion=command.reduced;if(command.replant!==undefined)w.autoReplant=command.replant;message='偏好已保存';break;
  case 'claimOverflow':{const pending=w.pending;w.pending={};reward(w,pending);message=Object.values(w.pending).some(v=>v>0)?'已领取能放下的部分，其余继续保留':'待领取物资已收好';break;}
 }
 if(['plant','sow','care','careAll','harvest','harvestAll','claimCraft'].includes(command.type)){
  const ids=command.type==='claimCraft'?(craftParticipants??[]):actor();const action=command.type.startsWith('harvest')?'harvest':command.type==='claimCraft'?'craft':command.type.startsWith('care')?'care':'plant';record(w,slimes,action,ids,craftItem);
  if(action==='plant')for(const id of ids){const c=w.crops.at(-1);if(c&&w.cultivars.find(v=>v.id===c.cultivar)?.species==='glowflower'&&w.stories[`wish:${id}`])w.stories[`wish:${id}`].effects.push(`crop:${c.id}`);}
 }
 for(const t of w.trips)if(t.ready&&!t.returned)returnTrip(w,slimes,t);
 bindInventory(w);w.notices.unshift(message);w.notices=w.notices.slice(0,20);w.journals=w.journals.slice(0,100);
 state.world=w;if(command.type==='depart')state.legacyTeamPreset=command.team.slice();for(const s of slimes){const target=state.slimes.find(x=>x.id===s.id);if(target)Object.assign(target,s);}return{ok:true,message,events};
 }catch(e){return{ok:false,message:e instanceof Error?e.message:'操作未完成',events:[]};}
}
