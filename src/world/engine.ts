import type {World,GameState,GameCommand,Result,GameEvent,Stock,Genes,Companion,Trip,Slime,Crop,Placement,Juvenile} from './types.ts';
import {BUILDINGS,DECORATIONS,PLANTS,ZONES,RECIPES,ELEMENTS,PERSONALITIES,BABY_EVENTS,BABY_PERSONAL_EVENTS} from './content.ts';
import {EVENTS,CHARACTERS,PERSONAL_CHAINS,PAIR_EVENTS} from './narratives.ts';
import {environment,level,bounds,refreshVisitors,day} from './ecology.ts';
const copy=<T>(x:T):T=>JSON.parse(JSON.stringify(x)) as T;
const requireThat=(condition:unknown,message:string):void=>{if(!condition)throw new Error(message);};
export const random=(w:World):number=>{let x=w.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;w.rng=x>>>0||1;return w.rng/4294967296;};
const next=(w:World)=>w.seq++;
const genes=(color:number):Genes=>({color,form:2,yield:2,speed:2,adapt:2});
export function createWorld(seed=0x51a7):World {
 const w:World={version:3,clock:0,rng:seed||1,seq:100,stock:{wood:80,stone:60,dew:40,food:12},unlocked:[0],placements:[{id:1,def:'house',zone:0,x:2,y:1,rotation:0,level:1,stored:false},{id:2,def:'bed',zone:0,x:6,y:2,rotation:0,level:1,stored:false}],paths:{'0':[...Array.from({length:12},(_,i)=>i*12+5)]},cultivars:PLANTS.filter(p=>!p.parents).map((p,i)=>({id:10+i,species:p.id,name:p.name,genes:genes(p.color),parents:[],protected:false,seeds:2})),crops:[],juveniles:[],companions:{},workers:[],crafts:[],visitors:{},discoveries:[],trips:[],journals:[],chapters:{},recruited:{},flags:[],camps:[],regionStory:{},mini:null,miniRewards:{},lastGather:-300,lastResonance:-1800,weather:0,weatherAt:3600,reducedMotion:false,autoReplant:false,notices:['欢迎回家。采集材料、种下第一株植物，或邀请伙伴去草甸看看。'],pending:{}};
 return w;
}
export function companion(w:World,s:Slime):Companion {
 return w.companions[s.id]??=( {slimeId:s.id,role:'园丁',interest:['花草','美食','星空','旅行'][s.id%4],memories:[],friends:{},story:{},mentor:null,daily:0,day:0});
}
function remember(w:World,s:Slime,id:string,title:string,text:string):void {
 const c=companion(w,s);if(c.memories.some(m=>m.id===id))return;
 c.memories.push({id,title,text,at:w.clock});if(c.memories.length>120)c.memories.splice(0,c.memories.length-120);
 if(c.day!==day(w)){c.day=day(w);c.daily=0;}if(c.daily<10){s.intimacy+=2;c.daily+=2;}
}
function discover(w:World,id:string):void {if(!w.discoveries.includes(id))w.discoveries.push(id);}
export function afford(w:World,cost:Stock):boolean{return Object.entries(cost).every(([k,v])=>(w.stock[k]??0)>=v);}
function pay(w:World,cost:Stock):void {requireThat(afford(w,cost),'材料不足，请先采集、收获或探索。');for(const[k,v]of Object.entries(cost))w.stock[k]-=v;}
export function reward(w:World,stock:Stock):void {for(const[k,v]of Object.entries(stock)){const space=9999-(w.stock[k]??0),n=Math.min(space,v);w.stock[k]=(w.stock[k]??0)+n;if(v>n)w.pending[k]=(w.pending[k]??0)+v-n;}}
function produce(w:World,stock:Stock):void {if(Object.entries(stock).every(([k,v])=>(w.stock[k]??0)+v<=9999))reward(w,stock);}
export function occupied(w:World,id:number):boolean{return w.workers.some(j=>j.slimeId===id)||w.trips.some(t=>t.team.includes(id));}
export function footprint(p:Placement):number[]{const[a,b]=bounds(p);return Array.from({length:a*b},(_,i)=>(p.y+Math.floor(i/a))*12+p.x+i%a);}
function passable(w:World,zone:number):Set<number>{
 const blocked=new Set(w.placements.filter(p=>p.zone===zone&&!p.stored&&!p.def.startsWith('decor-0-')).flatMap(footprint));
 const seen=new Set<number>(),queue:number[]=[];
 for(let x=0;x<12;x++){queue.push(x,132+x,x*12,x*12+11);} // Every region borders the shared walking path.
 while(queue.length){const n=queue.pop()!;if(seen.has(n)||blocked.has(n))continue;seen.add(n);const x=n%12,y=Math.floor(n/12);if(x)queue.push(n-1);if(x<11)queue.push(n+1);if(y)queue.push(n-12);if(y<11)queue.push(n+12);}
 return seen;
}
export function placementError(w:World,p:Placement):string|null {
 if(!w.unlocked.includes(p.zone))return '先解锁这个区域。';
 const[a,b]=bounds(p);if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x+a>12||p.y+b>12)return '物件超出区域边界。';
 const cells=footprint(p),others=w.placements.filter(x=>x.id!==p.id&&x.zone===p.zone&&!x.stored);
 if(others.some(o=>footprint(o).some(c=>cells.includes(c)))||w.crops.some(c=>c.zone===p.zone&&cells.includes(c.y*12+c.x)))return '这里已有设施或植物。';
 const draft={...w,placements:[...w.placements.filter(x=>x.id!==p.id),p]},reachable=passable(draft,p.zone);
 for(const b of draft.placements.filter(x=>x.zone===p.zone&&!x.stored&&BUILDINGS.some(d=>d.id===x.def))){const[width,height]=bounds(b);let access=false;for(let xx=b.x;xx<b.x+width;xx++)access ||=reachable.has((b.y-1)*12+xx)||reachable.has((b.y+height)*12+xx);for(let yy=b.y;yy<b.y+height;yy++)access ||= (b.x>0&&reachable.has(yy*12+b.x-1))||(b.x+width<12&&reachable.has(yy*12+b.x+width));if(!access)return '请给设施留出通往区域边缘的入口。';}
 return null;
}
function plant(w:World,id:number,zone:number,x:number,y:number,explicit=false):void {
 const c=w.cultivars.find(c=>c.id===id);requireThat(c,'没有这个品系。');if(!c)return;
 requireThat(explicit||!c.protected,'这个品系已收藏，请单独选择种植。');requireThat(c.seeds>0,'种子不足，可收获或复制留种。');requireThat(w.unlocked.includes(zone),'区域尚未解锁。');
 requireThat(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<12&&y<12,'地块超出范围。');
 requireThat(!w.crops.some(c=>c.zone===zone&&c.x===x&&c.y===y)&&!w.placements.some(p=>!p.stored&&p.zone===zone&&footprint(p).includes(y*12+x)),'这里已有植物或设施。');
 const d=PLANTS.find(p=>p.id===c.species)!;requireThat(d.family!==5||w.placements.some(p=>!p.stored&&p.zone===zone&&['pond','waterbed'].includes(p.def)),'水生植物需要本区的水塘或水生种植台。');
 c.seeds--;w.crops.push({id:next(w),cultivar:id,zone,x,y,progress:0,water:180,care:0,harvests:0,lastSim:w.clock});
}
function harvest(w:World,c:Crop):void {
 requireThat(c.progress>=1,'植物还没有成熟。');const v=w.cultivars.find(v=>v.id===c.cultivar)!,d=PLANTS.find(p=>p.id===v.species)!;
 reward(w,{[d.product]:2+v.genes.yield+(w.visitors['visitor-1']?1:0)});v.seeds+=1+(level(w,'seedbank')>=3?1:0)+(w.visitors['visitor-0']?1:0)+(w.visitors['visitor-14']?1:0)+(d.family===5&&w.placements.some(p=>p.zone===c.zone&&p.def==='waterbed'&&!p.stored&&p.level===3)?1:0);v.seeds=Math.min(9999,v.seeds);discover(w,d.id);w.flags.includes('harvest')||w.flags.push('harvest');c.harvests++;
 if(d.family===3){c.progress=0;c.water=180;c.care=0;}
 else{w.crops=w.crops.filter(x=>x.id!==c.id);if(w.autoReplant&&!v.protected)plant(w,v.id,c.zone,c.x,c.y);}
}
function addJuvenile(w:World,element:Juvenile['element'],name?:string):void {
 w.juveniles.push({id:next(w),name:name??`${element}团子`,element,born:w.clock,stage:0,care:[],mentor:null,traits:[],choices:[],active:w.juveniles.filter(j=>j.active).length<(level(w,'house')||1)*2,personality:PERSONALITIES[Math.floor(random(w)*PERSONALITIES.length)]});
}
function friends(w:World,slimes:Slime[],a:number,b:number,amount:number):void {const x=slimes.find(s=>s.id===a),y=slimes.find(s=>s.id===b);if(!x||!y)return;const cx=companion(w,x),cy=companion(w,y);cx.friends[b]=Math.min(100,(cx.friends[b]??0)+amount);cy.friends[a]=Math.min(100,(cy.friends[a]??0)+amount);}
export function chapterReady(w:World,id:string):boolean {
 const n=w.chapters[id]??0;if(n>=6)return false;
 return [true,w.flags.includes('harvest'),w.discoveries.length>=3,w.discoveries.length>=6&&Object.keys(w.visitors).some(k=>w.discoveries.includes(k)),w.journals.length>0&&new Set(w.placements.filter(p=>!p.stored&&BUILDINGS.some(b=>b.id===p.def)).map(p=>p.def)).size>=4,w.discoveries.length>=10&&w.camps.length>0][n];
}
function finishNode(w:World,t:Trip):void {t.node++;t.pending=null;t.nextAt=w.clock+t.duration/4;if(t.node>=4)t.ready=true;}
function visitNode(w:World,t:Trip):void {
 if(t.ready||t.pending)return;const ev=EVENTS.find(e=>e.id===t.events[t.node])!;
 if(t.mode==='active'||['救助','谜题','伙伴','故事','挑战'].includes(ev.kind)){t.pending=ev.id;return;}
 t.log.push(`${ev.title}：队伍完成${t.route===0?'采集':'调查'}。`);t.bag.wood=(t.bag.wood??0)+4+t.region;t.bag.stone=(t.bag.stone??0)+3+t.region;
 if(t.route===1)discover(w,ev.id);finishNode(w,t);
}
function growDuration(w:World,c:Crop):number {const v=w.cultivars.find(v=>v.id===c.cultivar)!,d=PLANTS.find(p=>p.id===v.species)!;return(d.family===3&&c.harvests>0?30:d.minutes)*60;}
export function advance(w:World,seconds:number,slimes:Slime[]):void {
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

export function execute(state:GameState,command:GameCommand,available:(id:number)=>boolean=()=>true):Result {
 const w=copy(state.world??createWorld()),slimes=copy(state.slimes),events:GameEvent[]=[];let message='已完成';
 const placement=(id:number)=>{const p=w.placements.find(p=>p.id===id);requireThat(p,'没有找到设施。');return p!;};
 const crop=(id:number)=>{const c=w.crops.find(c=>c.id===id);requireThat(c,'没有找到植物。');return c!;};
 const baby=(id:number)=>{const b=w.juveniles.find(b=>b.id===id);requireThat(b,'没有找到幼体。');return b!;};
 const trip=(id:number)=>{const t=w.trips.find(t=>t.id===id);requireThat(t,'没有找到旅程。');return t!;};
 const free=(id:number)=>{const s=slimes.find(s=>s.id===id);requireThat(s&&available(id)&&!occupied(w,id),'伙伴正在派遣、工作或战斗，请先让它休息。');return s!;};
 try{
 switch(command.type){
  case 'gather':requireThat(w.clock-w.lastGather>=300,'采集点正在恢复，请稍后再来。');reward(w,{wood:8,stone:6,dew:4,food:1});w.lastGather=w.clock;message='收集了木材、石材、露水和食材';break;
  case 'unlock':{const z=ZONES[command.zone];requireThat(z&&!w.unlocked.includes(z.id)&&w.discoveries.length>=z.threshold,'发现数量不足，或区域已经开放。');pay(w,{wood:10+10*z.id,stone:5+5*z.id});w.unlocked.push(z.id);w.paths[z.id]=Array.from({length:12},(_,i)=>i*12+5);message=`${z.name}已开放`;break;}
  case 'build':{const d=BUILDINGS.find(b=>b.id===command.def)??DECORATIONS.find(b=>b.id===command.def);requireThat(d,'未知的设施。');if(!d)break;requireThat(!BUILDINGS.some(b=>b.id===d.id)||!w.placements.some(p=>p.def===d.id),'每种功能设施保留一座，可从收纳中取回。');const p:Placement={id:next(w),def:d.id,zone:command.zone,x:command.x,y:command.y,rotation:command.rotation??0,level:1,stored:false};const err=placementError(w,p);requireThat(!err,err??'');pay(w,d.cost);w.placements.push(p);message=`${d.name}已建好`;break;}
  case 'move':{const p=placement(command.id),candidate={...p,zone:command.zone,x:command.x,y:command.y,rotation:command.rotation??p.rotation,stored:false};const err=placementError(w,candidate);requireThat(!err,err??'');Object.assign(p,candidate);message='位置已保存';break;}
  case 'store':{const p=placement(command.id);requireThat(!w.crafts.some(t=>t.building===p.id),'请先领取或完成设施中的制作队列。');p.stored=true;w.workers=w.workers.filter(j=>j.building!==p.id);message='已收纳，服务已暂停';break;}
  case 'upgrade':{const p=placement(command.id),d=BUILDINGS.find(d=>d.id===p.def);requireThat(d&&p.level<3&&!p.stored,'设施已满级或处于收纳中。');pay(w,Object.fromEntries(Object.entries(d!.cost).map(([k,v])=>[k,v*(p.level+1)])));p.level++;message=d!.upgrades[p.level-2];break;}
  case 'path':{requireThat(w.unlocked.includes(command.zone)&&command.x>=0&&command.x<12&&command.y>=0&&command.y<12,'路径位置无效。');const key=String(command.zone),n=command.y*12+command.x;w.paths[key]??=[];w.paths[key]=w.paths[key].includes(n)?w.paths[key].filter(v=>v!==n):[...w.paths[key],n];message='道路已更新';break;}
  case 'plant':plant(w,command.cultivar,command.zone,command.x,command.y,command.explicit);message='种子已经安家';break;
  case 'sow':{const v=w.cultivars.find(v=>v.id===command.cultivar);requireThat(v&&!v.protected,'请先选择未收藏的品系。');let count=0;for(let y=5;y<12;y++)for(let x=0;x<12;x++){if(count>=6||!v!.seeds)break;try{plant(w,command.cultivar,command.zone,x,y);count++;}catch{ /* Occupied plots are deliberately skipped. */ }}requireThat(count>0,'没有可用地块、种子或水生设施。');message=`已播种 ${count} 株`;break;}
  case 'care':{const c=crop(command.id);pay(w,{dew:1});c.water=180;const add=Math.min(.05,.2-c.care);c.progress=Math.min(1,c.progress+Math.max(0,add));c.care+=Math.max(0,add);message='已浇水并照料';break;}
  case 'careAll':{const list=w.crops.filter(c=>c.progress<1&&c.water<150);requireThat(list.length,'暂时没有需要补水的植物。');pay(w,{dew:list.length});for(const c of list)c.water=180;message=`已为 ${list.length} 株植物补水`;break;}
  case 'harvest':harvest(w,crop(command.id));message='已收获，种子已留存';break;
  case 'harvestAll':{const list=w.crops.filter(c=>c.progress>=1);requireThat(list.length,'还没有成熟的植物。');list.forEach(c=>harvest(w,c));message=`收获了 ${list.length} 株植物`;break;}
  case 'uproot':{const c=crop(command.id),v=w.cultivars.find(v=>v.id===c.cultivar)!;v.seeds++;w.crops=w.crops.filter(x=>x.id!==c.id);message='已移回种子库，品系保留';break;}
  case 'cultivar':{const v=w.cultivars.find(v=>v.id===command.id);requireThat(v,'品系不存在。');if(command.name!==undefined){requireThat(command.name.trim().length>0&&command.name.length<=24,'名称需要 1–24 个字。');v!.name=command.name.trim();}if(command.protect!==undefined)v!.protected=command.protect;message='品系档案已保存';break;}
  case 'clone':{const v=w.cultivars.find(v=>v.id===command.id);requireThat(v&&level(w,'seedbank')>0,'复制留种需要种子库。');pay(w,{dew:level(w,'pollen')>=2?2:4});v!.seeds=Math.min(9999,v!.seeds+(level(w,'seedbank')>=2?3:2));message='相同性状的种子已留存';break;}
  case 'breed':{const a=w.cultivars.find(v=>v.id===command.a),b=w.cultivars.find(v=>v.id===command.b);requireThat(a&&b&&a.id!==b.id&&level(w,'pollen')>0,'选择两个不同品系，并建造授粉棚。');const pa=PLANTS.find(p=>p.id===a!.species)!,pb=PLANTS.find(p=>p.id===b!.species)!;requireThat(pa.family===pb.family,'只有同类植物能够授粉。');requireThat([a!,b!].every(v=>w.crops.some(c=>c.cultivar===v.id&&c.progress>=.7)),'两株亲本需要达到开花阶段。');pay(w,{dew:3});const g={...a!.genes};for(const k of Object.keys(g) as (keyof Genes)[]){g[k]=random(w)<.5?a!.genes[k]:b!.genes[k];if(random(w)<.05)g[k]+=random(w)<.5?-1:1;if(k!=='color')g[k]=Math.max(1,Math.min(5,g[k]));else g[k]=(g[k]+360)%360;}if(level(w,'pollen')===3)g.yield=Math.max(g.yield,3);const hybrid=PLANTS.find(p=>p.parents?.includes(pa.id)&&p.parents?.includes(pb.id));const species=hybrid??(random(w)<.5?pa:pb);w.cultivars.push({id:next(w),species:species.id,name:`${species.name}·${w.seq}`,genes:g,parents:[a!.name,b!.name],protected:false,seeds:2+(w.visitors['visitor-2']?1:0)});discover(w,species.id);message=`育成了 ${species.name}，已留下亲本记录`;break;}
  case 'resonate':{const a=free(command.a),b=free(command.b);requireThat(a.id!==b.id,'请选择两位成年伙伴。');requireThat(w.clock-w.lastResonance>=(level(w,'resonance')>=2?900:1800),'共鸣需要一些休息时间。');pay(w,{dew:8,food:2});addJuvenile(w,random(w)<.5?a.element:b.element);w.lastResonance=w.clock;friends(w,slimes,a.id,b.id,3);message='新幼体诞生了，已安全安置';break;}
  case 'babyCare':{const b=baby(command.id);requireThat(b.active,'先将幼体安置到小屋。');requireThat(['喂食','游戏','安抚','环境','导师'].includes(command.kind),'未知的照料方式。');if(!b.care.includes(command.kind)){if(command.kind==='喂食')pay(w,{food:1});if(command.kind==='导师'){const s=free(command.mentor??0);b.mentor=s.id;}b.care.push(command.kind);}message='这次陪伴已经记下';break;}
  case 'babyChoice':{const b=baby(command.id);requireThat(b.active&&[0,1].includes(command.choice),'请安置幼体并选择回应。');const personal=`${b.stage}:personal`,element=`${b.stage}:element`;const key=b.choices.includes(element)?personal:element;requireThat(!b.choices.includes(key),'这个阶段的成长事件已经完成。');b.choices.push(key);const text=key===element?BABY_EVENTS.find(e=>e.element===b.element)!.choices[command.choice]:BABY_PERSONAL_EVENTS[b.id%24].choices[command.choice];b.traits.push(text);message=text;break;}
  case 'grow':{const b=baby(command.id);requireThat(b.active&&b.care.length>=(b.stage===0?3:5)&&w.clock-b.born>=(b.stage===0?900:3600)*(level(w,'resonance')===3?.8:1),'还需要成长时间与照料里程碑。');if(b.stage===0){b.stage=1;message='幼体进入幼年阶段';}else{events.push({type:'adopt',text:`${b.name}长大了`,juvenile:copy(b)});w.juveniles=w.juveniles.filter(j=>j.id!==b.id);message='已成年，童年与导师记录将随它保留';}break;}
  case 'adopt':{const b=baby(command.id);requireThat(!b.active&&w.juveniles.filter(j=>j.active).length<(level(w,'house')||1)*2,'小屋容量已满，请升级或陪伴在养幼体成年。');b.active=true;message='幼体已入住小屋';break;}
  case 'assign':{free(command.slime);const p=placement(command.building);requireThat(!p.stored&&BUILDINGS.some(b=>b.id===p.def),'设施不可用。');requireThat(w.workers.filter(j=>j.building===p.id).length<(p.level>=2?2:1),'这个设施的工作位已满。');w.workers.push({slimeId:command.slime,building:p.id});companion(w,slimes.find(s=>s.id===command.slime)!).role=(BUILDINGS.find(b=>b.id===p.def)?.name??'家园')+'帮手';message='工作已安排，可随时休息';break;}
  case 'unassign':w.workers=w.workers.filter(j=>j.slimeId!==command.slime);message='伙伴已休息';break;
  case 'craft':{const r=RECIPES.find(r=>r.id===command.recipe),p=placement(command.building);requireThat(r&&r.building===p.def&&!p.stored&&p.level>=r.level,'设施或等级不符合配方要求。');requireThat(w.crafts.filter(t=>t.building===p.id).length<p.level+1,'制作队列已满。');pay(w,r!.cost);w.crafts.push({id:next(w),recipe:r!.id,building:p.id,remaining:r!.seconds,ready:false});message='材料已预留，加入制作队列';break;}
  case 'claimCraft':{const c=w.crafts.find(t=>t.id===command.id);requireThat(c?.ready,'制作尚未完成或已经领取。');reward(w,RECIPES.find(r=>r.id===c!.recipe)!.output);if(c!.recipe==='fertilizer'&&w.visitors['visitor-7'])reward(w,{fertilizer:1});w.crafts=w.crafts.filter(t=>t.id!==command.id);message='制作产物已领取';break;}
  case 'useSupply':{const s=free(command.slime);requireThat(['meal','soup','potion'].includes(command.item),'补给不存在。');pay(w,{[command.item]:1});s.stamina=Math.max(s.stamina,Math.min(Math.round(80+(s.size||1)*40),s.stamina+(command.item==='potion'?30:15)));s.mood=Math.min(100,s.mood+(command.item==='soup'?15:8));remember(w,s,`supply:${command.item}:${day(w)}`,'为旅程准备的一餐',`${s.name}使用了家园制作的补给，准备迎接新的旅程。`);message='伙伴补充了体力与心情';break;}
  case 'fertilize':{const c=crop(command.id);requireThat(command.item==='fertilizer'||command.item==='soil','请选择肥料或沃土。');requireThat(c.care<.2,'本次生长周期的照料加速已达 20%。');pay(w,{[command.item]:1});const n=Math.min(.2-c.care,command.item==='soil'?.15:.1);c.care+=n;c.progress=Math.min(1,c.progress+n);message='植物吸收了养分，生长进度已增加';break;}
  case 'depart':{const z=ZONES[command.region];requireThat(z&&w.discoveries.length>=z.threshold,'还需要更多发现来打开这片区域。');requireThat(command.team.length>=1&&command.team.length<=3&&new Set(command.team).size===command.team.length,'队伍需要 1–3 位不同伙伴。');command.team.forEach(free);requireThat(w.trips.length<3,'最多同时安排三支队伍。');requireThat([0,1,2].includes(command.route)&&[300,1200,3600,10800].includes(command.duration),'路线或时长无效。');pay(w,{food:command.mode==='offline'?Math.max(1,command.duration/1200):1});const pool=EVENTS.filter(e=>e.region===z.id);const selected=Array.from({length:4},()=>pool.splice(Math.floor(random(w)*pool.length),1)[0].id);w.trips.push({id:next(w),region:z.id,route:command.route,team:command.team,mode:command.mode,duration:command.duration,nextAt:w.clock+command.duration/4,node:0,events:selected,pending:null,bag:{},log:[`${command.team.map(id=>slimes.find(s=>s.id===id)!.name).join('、')}从家园出发。`],ready:false});message=command.mode==='active'?'地图已展开，选择前进开始探索':'队伍已出发，重要选择会等待你';break;}
  case 'step':{const t=trip(command.id);requireThat(t.mode==='active'&&!t.pending&&!t.ready,'请先处理当前节点。');const team=slimes.filter(s=>t.team.includes(s.id));requireThat(team.every(s=>s.stamina>=3),'伙伴需要休整或返回。');team.forEach(s=>s.stamina-=3);visitNode(w,t);message='到达新的地图节点';break;}
  case 'restTrip':{const t=trip(command.id);pay(w,{food:1});slimes.filter(s=>t.team.includes(s.id)).forEach(s=>s.stamina=Math.max(s.stamina,Math.min(Math.round(80+(s.size||1)*40),s.stamina+10)));t.log.push('队伍分享食物，休整后继续前进。');message='队伍恢复了体力';break;}
  case 'tripChoice':{const t=trip(command.id),ev=EVENTS.find(e=>e.id===t.pending);requireThat(ev&&[0,1].includes(command.choice),'事件已完成或选项无效。');const ch=ev!.choices[command.choice];let won=true;if(ev!.kind==='挑战'){const power=t.team.reduce((n,id)=>n+(slimes.find(s=>s.id===id)?.level??1),0);won=command.choice===1||power>=t.region*3+1;}if(won){for(const[k,v]of Object.entries(ch.reward))t.bag[k]=(t.bag[k]??0)+Math.round(v*(1+t.duration/10800)*(1+level(w,'expedition')*.05));if(w.visitors['visitor-5'])t.bag.stardust=(t.bag.stardust??0)+1;if(w.visitors['visitor-4']||level(w,'observe')===3)t.bag.notes=(t.bag.notes??0)+1;}t.log.push(`${ev!.title} · ${ch.text}：${won?ch.result:'力道还不够。队伍选择安全返回，之前的发现已经保存。'}`);discover(w,ev!.id);if(ch.flag)discover(w,ch.flag);if(ev!.kind==='救助'&&!w.flags.includes(ev!.id)){addJuvenile(w,ELEMENTS[(t.region*2+command.choice)%12]);w.flags.push(ev!.id);t.log.push('一只幼体获救，已送回家园安全安置。');}if(t.route===1){const p=PLANTS.filter(p=>p.parents)[(t.region*3+t.node)%18];if(!w.cultivars.some(v=>v.species===p.id)){w.cultivars.push({id:next(w),species:p.id,name:p.name,genes:genes(p.color),parents:['野外调查'],protected:false,seeds:1+(level(w,'expedition')===3?1:0)});discover(w,p.id);}}for(const id of t.team){const s=slimes.find(s=>s.id===id)!;remember(w,s,ev!.id,ev!.title,ch.result);}finishNode(w,t);if(!won)t.ready=true;message=won?'选择与发现已保存':'队伍安全返程';break;}
  case 'recall':{const t=trip(command.id);t.ready=true;t.pending=null;t.log.push('选择提前返回，保留已完成的发现。');message='已召回，可以领取途中收获';break;}
  case 'claimTrip':{const t=trip(command.id);requireThat(t.ready,'队伍尚未返程。');reward(w,t.bag);if(w.camps.includes(t.region))reward(w,{food:2,notes:1});w.journals.unshift({id:t.id,title:`${ZONES[t.region].area} · ${['采集','调查','挑战'][t.route]}`,lines:t.log,at:w.clock});w.journals=w.journals.slice(0,100);for(let a=0;a<t.team.length;a++)for(let b=a+1;b<t.team.length;b++)friends(w,slimes,t.team[a],t.team[b],5);w.trips=w.trips.filter(x=>x.id!==t.id);message='旅行已入册，收获已领取';break;}
  case 'camp':{const z=ZONES[command.region];requireThat(z&&w.discoveries.length>=z.threshold&&!w.camps.includes(z.id),'营地尚不可修复，或已经修好。');pay(w,{wood:15+z.id*5,stone:10+z.id*3});w.camps.push(z.id);message='营地修复了，返程获得额外补给';break;}
  case 'regionStory':{const z=ZONES[command.region],n=w.regionStory[command.region]??0;requireThat(z&&w.camps.includes(z.id)&&n<3,'修好营地后可调查区域故事。');requireThat(w.discoveries.filter(d=>d.startsWith(`event-${z.id}-`)).length>=(n+1)*2,`需要本区 ${(n+1)*2} 个事件发现。`);w.regionStory[z.id]=n+1;reward(w,{notes:3,relic:n===2?2:0});w.journals.unshift({id:next(w),title:`${z.area} · ${['旧日线索','共同修复','新的归处'][n]}`,lines:[z.story,['从散落物品中找到了居民留下的路线和约定。','家园送来的植物与工具让修复开始有了结果。','营地再次有人来访。居民把修复记录交给你，请你带给下一位旅人。'][n]],at:w.clock});message='区域故事推进了';break;}
  case 'chapter':{const ch=CHARACTERS.find(c=>c.id===command.character);requireThat(ch&&[0,1].includes(command.choice)&&chapterReady(w,ch.id),'尚未满足本章条件，或已经读完。');const n=w.chapters[ch!.id]??0,scene=ch!.chapters[n],choice=scene.choices[command.choice];reward(w,choice.reward);if(ch!.id==='lantern'&&n===5&&command.choice===1)addJuvenile(w,'光','小灯');w.chapters[ch!.id]=n+1;w.flags.push(choice.flag!);if(n===0)events.push({type:'recruit',text:`${ch!.name}加入家园`,character:ch!});const s=slimes.find(s=>s.id===w.recruited[ch!.id]);if(s)remember(w,s,`${ch!.id}-${n}`,scene.title,choice.result);w.journals.unshift({id:next(w),title:`${ch!.name} · ${scene.title}`,lines:[scene.text,choice.text,choice.result],at:w.clock});message=choice.result;break;}
  case 'personal':{const s=slimes.find(s=>s.id===command.slime),chain=PERSONAL_CHAINS.find(c=>c.id===command.chain);requireThat(s&&chain&&chain.personality===s.personality&&[0,1].includes(command.choice),'故事不属于这个伙伴。');const c=companion(w,s!),n=c.story[chain!.id]??0;requireThat(n<3&&s!.intimacy>=n*2,'需要更多共同经历，或故事已完成。');remember(w,s!,`${chain!.id}-${n}`,chain!.title,`${chain!.chapters[n]} 你选择${chain!.choices[command.choice]}。`);c.story[chain!.id]=n+1;if(n===2)reward(w,{keepsake:1});message=chain!.chapters[n];break;}
  case 'pair':{const a=slimes.find(s=>s.id===command.a),b=slimes.find(s=>s.id===command.b),ev=PAIR_EVENTS.find(e=>e.id===command.event);requireThat(a&&b&&a.id!==b.id&&ev&&[0,1].includes(command.choice),'请选择两位不同伙伴。');const key=`pair:${Math.min(command.a,command.b)}:${Math.max(command.a,command.b)}:${ev!.id}`;requireThat(!w.flags.includes(key),'这次共同事件已经完成。');requireThat((companion(w,a!).friends[b!.id]??0)>=PAIR_EVENTS.indexOf(ev!)*2,'一起工作、旅行或聚餐可以增进关系。');friends(w,slimes,a!.id,b!.id,3);[a!,b!].forEach(s=>remember(w,s,key,ev!.title,`${ev!.text} ${ev!.choices[command.choice]}。`));w.flags.push(key);reward(w,{notes:1});message='两位伙伴留下了共同回忆';break;}
  case 'meal':{requireThat(level(w,'table')>0,'先建一张餐桌。');requireThat(new Set(command.ids).size===command.ids.length&&command.ids.length>=2&&command.ids.length<=level(w,'table')*2,'请选择符合餐桌容量的不同伙伴。');const list=command.ids.map(free);pay(w,{food:list.length});for(const s of list){s.mood=Math.min(100,s.mood+8);remember(w,s,`meal-${day(w)}`,'家园的一餐','你们在同一张桌边分享今天的发现。');}const key=`meal:${day(w)}:${command.ids.slice().sort((a,b)=>a-b).join(',')}`;if(!w.flags.includes(key)){for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)friends(w,slimes,list[i].id,list[j].id,3+level(w,'memorial')+Math.min(2,w.placements.filter(p=>!p.stored&&(p.def.startsWith('decor-3-')||p.def.startsWith('decor-7-'))).length));w.flags.push(key);}message='大家一起吃了一顿饭';break;}
  case 'miniStart':{requireThat(['match','pollination','observation'].includes(command.kind),'未知的小游戏。');requireThat(!w.mini||w.mini.claimed,'当前游戏尚未结束或领取，请先完成它。');const board=command.kind==='match'?Array.from({length:36},()=>Math.floor(random(w)*5)):command.kind==='pollination'?Array.from({length:12},(_,i)=>Math.floor(i/2)):Array.from({length:5},()=>Math.floor(random(w)*18));if(command.kind==='pollination')for(let i=board.length-1;i>0;i--){const j=Math.floor(random(w)*(i+1));[board[i],board[j]]=[board[j],board[i]];}w.mini={kind:command.kind,board,selected:-1,steps:20,score:0,hp:10,matches:[],done:false,claimed:false,round:0};message='游戏开始';break;}
  case 'miniCell':{const m=w.mini;requireThat(m&&!m.done&&Number.isInteger(command.index)&&command.index>=0&&command.index<(m.kind==='observation'?18:m.board.length),'游戏已经结束或位置无效。');if(!m)break;
   if(m.kind==='observation'){if(command.index===m.board[m.round])m.score++;m.round++;m.done=m.round>=5;}
   else if(m.kind==='pollination'){if(m.matches.includes(command.index))break;if(m.selected===-1)m.selected=command.index;else if(m.selected!==command.index){m.steps--;if(m.board[m.selected]===m.board[command.index]){m.matches.push(m.selected,command.index);m.score++;}m.selected=-1;m.done=m.matches.length===12||m.steps===0;}}
   else if(m.selected===-1)m.selected=command.index;
   else{const a=m.selected,b=command.index;m.selected=-1;requireThat((Math.floor(a/6)===Math.floor(b/6)&&Math.abs(a-b)===1)||Math.abs(a-b)===6,'选择相邻的两个方块。');[m.board[a],m.board[b]]=[m.board[b],m.board[a]];const hits=new Set<number>();for(let i=0;i<36;i++){if(i%6<=3&&m.board[i]===m.board[i+1]&&m.board[i]===m.board[i+2]){hits.add(i);hits.add(i+1);hits.add(i+2);}if(i<24&&m.board[i]===m.board[i+6]&&m.board[i]===m.board[i+12]){hits.add(i);hits.add(i+6);hits.add(i+12);}}m.steps--;m.score+=hits.size;if(m.steps<10)m.hp-=hits.size>=3?0:2;for(const i of hits)m.board[i]=Math.floor(random(w)*5);m.done=m.steps<=0||m.hp<=0;}
   message=m.done?'本局结束，可以领取结果':'已记录这一步';break;}
  case 'miniClaim':{const m=w.mini;requireThat(m?.done&&!m.claimed,'游戏尚未结束或已领取。');const key=`${day(w)}:${m!.kind}`,count=w.miniRewards[key]??0;if(count<3){reward(w,m!.kind==='match'?{wood:Math.min(20,m!.score),stone:Math.min(20,m!.score),dew:Math.min(10,m!.score)}:m!.kind==='pollination'?{petal:m!.score*2,dew:m!.score}:{notes:m!.score+(level(w,'observe')>=2?1:0),food:m!.score});w.miniRewards[key]=count+1;message='小游戏奖励已领取';}else message='练习完成，本日奖励次数已用完';m!.claimed=true;break;}
  case 'settings':if(command.reduced!==undefined)w.reducedMotion=command.reduced;if(command.replant!==undefined)w.autoReplant=command.replant;message='偏好已保存';break;
  case 'claimOverflow':{const pending=w.pending;w.pending={};reward(w,pending);message=Object.values(w.pending).some(v=>v>0)?'已领取能放下的部分，其余继续保留':'待领取物资已收好';break;}
 }
 w.notices.unshift(message);w.notices=w.notices.slice(0,20);w.journals=w.journals.slice(0,100);
 state.world=w;for(const s of slimes){const target=state.slimes.find(x=>x.id===s.id);if(target)Object.assign(target,s);}return{ok:true,message,events};
 }catch(e){return{ok:false,message:e instanceof Error?e.message:'操作未完成',events:[]};}
}
