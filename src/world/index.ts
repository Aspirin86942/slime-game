import type {Host,GameCommand,GameState,Slime,World} from './types.ts';
import {createWorld,execute,advance,companion,occupied,random} from './engine.ts';
import {render as view,mount as mountView,handleClick as click,navigate as navigateView,paintResidents,recentlyInteracted} from './view.ts';
export {createWorld,execute,advance,occupied} from './engine.ts';
export {validWorld} from './storage.ts';
export {comboFor,COMBOS} from './combat.ts';
export {BUILDINGS,PLANTS,VISITORS} from './content.ts';
import {prepareWorld,upgradeWorld} from './migration.ts';
import {attachLegacyInventory} from './inventory.ts';
import {activity,resident,record} from './life.ts';
import {advanceLegacy} from './legacy-time.ts';
export {advanceLegacy,upgradeWorld,attachLegacyInventory};
export {activity} from './life.ts';
export {paintResidents} from './view.ts';
let host:Host|null=null;
export function connect(h:Host):void {host=h;}
export function ensure(s:GameState):World {s.world??=createWorld();prepareWorld(s.world);if(s.saveVersion>=4)attachLegacyInventory(s as unknown as Record<string,any>);return s.world;}
export function isBusy(s:GameState,id:number):boolean{return s.world?(s.saveVersion<4?s.world.workers.some(j=>j.slimeId===id)||s.world.trips.some(t=>t.team.includes(id)):occupied(s.world,id)):false;}
export function tick(s:GameState,seconds:number):{coins:number;treasure:number;actions:number;exp:number;changed:boolean} {
 const gains={coins:0,treasure:0,actions:0,exp:0,changed:false};if(!s.started||!Number.isFinite(seconds)||seconds<=0)return gains;
 const w=ensure(s),coins=w.trips.reduce((n,t)=>n+(t.coins??0),0),treasure=(w.stock.treasure??0)+w.trips.reduce((n,t)=>n+(t.bag.treasure??0),0);
 const progress=(events:import('./types.ts').GameEvent[])=>{for(const e of events){if(e.type==='income')gains.coins+=e.amount??0;if(e.type==='collection')gains.actions+=e.amount??0;if(e.type==='experience')for(const id of e.participants??[])gains.exp+=Math.round((e.amount??0)*(1+(s.slimes.find(p=>p.id===id)?.wit??0)*.02));}host?.progress?.(events);};
 if(w.payments.length)progress(w.payments.splice(0));advance(w,seconds,s.slimes,progress);
 gains.coins+=w.trips.reduce((n,t)=>n+(t.coins??0),0)-coins;gains.treasure=(w.stock.treasure??0)+w.trips.reduce((n,t)=>n+(t.bag.treasure??0),0)-treasure;gains.changed=true;return gains;
}
export function render():string {if(!host)return '';const s=host.state(),w=ensure(s);for(const pet of s.slimes)resident(w,pet);return view(host,dispatch);}
export function mount():void {mountView();}
export function refresh():void {
 if(!host||document.getElementById('gameOverlay')||!document.getElementById('livingWorld')||recentlyInteracted())return;
 const container=document.getElementById('content')!,scroll=container.scrollTop;
 const controls=[...container.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select')].map(e=>({id:e.id,name:e.getAttribute('name'),value:e.value,checked:e instanceof HTMLInputElement?e.checked:false}));
 const disclosures=[...container.querySelectorAll('details')].map(d=>d.open);
 host.render();container.scrollTop=scroll;
 for(const c of controls){const el=c.id?document.getElementById(c.id) as HTMLInputElement|HTMLSelectElement|null:[...container.querySelectorAll<HTMLInputElement>('input')].find(e=>e.name===c.name&&e.value===c.value);if(el){el.value=c.value;if(el instanceof HTMLInputElement)el.checked=c.checked;}}
 [...container.querySelectorAll('details')].forEach((d,i)=>d.open=disclosures[i]??false);
}
export function handleClick(e:Event):boolean {return host?click(e):false;}
export function dispatch(c:GameCommand):void {
 if(!host)return;if(!host.writable()){host.toast('存档处于保护状态，请先处理顶部提示。');return;}const s=host.state(),res=execute(s,c,host.available);
 if(!res.ok){host.toast(res.message);return;}
 for(const event of res.events){
  if(event.type==='recruit'&&event.character){const ch=event.character,slime=host.create(ch.element,ch.name,ch.personality);slime.locked=true;s.world!.recruited[ch.id]=slime.id;const profile=companion(s.world!,slime);profile.memories.push({id:`${ch.id}-0`,title:ch.chapters[0].title,text:res.message,at:s.world!.clock});}
  if(event.type==='adopt'&&event.juvenile){const j=event.juvenile,slime=host.create(j.element,j.name,j.personality),profile=companion(s.world!,slime);profile.mentor=j.mentor;profile.interest=j.traits.includes('一起试一试，培养好奇心')?'旅行':'花草';profile.memories.push({id:`childhood-${j.id}`,title:'在家园长大的日子',text:`${j.care.join('、')}；${j.traits.join('；')}`,at:s.world!.clock});if(j.mentor){profile.friends[j.mentor]=10;const mentor=s.slimes.find(s=>s.id===j.mentor);if(mentor)companion(s.world!,mentor).friends[slime.id]=10;}}
 }
 host.progress?.(res.events);const saved=host.save();host.render();host.toast(saved?(res.message.length>36?'这段回忆已保存，可以在旅行册回看。':res.message):'进度暂存在本页，存储失败。请留在页面并检查存档提示。');
}
/** Called only after intentional roster changes such as merging. */
export function reconcile(s:GameState):void {
 if(!s.world)return;const w=s.world,ids=new Set(s.slimes.map(s=>s.id));
 for(const [key,c] of Object.entries(w.companions))if(!ids.has(Number(key))){w.archives[key]??={name:w.residents[key]?.pose?.startsWith('姓名:')?w.residents[key].pose.slice(3):'曾经的伙伴',profile:c};for(const i of Object.values(w.stories))if(i.participants.includes(Number(key))&&i.status==='active')i.status='archived';delete w.residents[key];delete w.activities[key];delete w.companions[key];}
 for(const c of Object.values(w.companions)){for(const id of Object.keys(c.friends))if(!ids.has(Number(id))&&!w.archives[id])delete c.friends[id];if(c.mentor&&!ids.has(c.mentor)&&!w.archives[c.mentor])c.mentor=null;}
 for(const j of w.juveniles)if(j.mentor&&!ids.has(j.mentor))j.mentor=null;
 for(const key of Object.keys(w.recruited))if(!ids.has(w.recruited[key]))delete w.recruited[key];w.workers=w.workers.filter(j=>ids.has(j.slimeId));w.journals=w.journals.slice(0,100);
}

export function reserve(s:GameState,ids:number[],kind:'battle'|'play'):boolean {
 if(host&&host.state()===s&&!host.writable())return false;const w=ensure(s);if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!s.slimes.some(x=>x.id===id)||activity(w,id).kind!=='home'))return false;
 for(const id of ids)w.activities[id]={kind};return true;
}
export function release(s:GameState,kind:'battle'|'play',completed=false):void {
 const w=ensure(s),ids=Object.keys(w.activities).filter(id=>w.activities[id].kind===kind).map(Number);
 for(const id of ids)delete w.activities[id];if(completed)record(w,s.slimes,kind,ids);
}
export function archiveCompanion(s:GameState,id:number):void {const w=ensure(s),slime=s.slimes.find(x=>x.id===id);if(slime)w.archives[id]={name:slime.name,profile:companion(w,slime)};}
export function tickLegacy(s:GameState,seconds:number):void {if(s.started&&s.world)advanceLegacy(s.world,seconds,s.slimes);}
export function navigate(tab:string):void {navigateView(tab);}

let canvas:HTMLCanvasElement|null=null,raf=0,last=0,fxLeft=0,fxTop=0,fxRatio=1;
type Particle={x:number;y:number;vx:number;vy:number;age:number;life:number;color:string;size:number;};
let particles:Particle[]=[];
/** Bounded shared overlay; transform/opacity based character motion stays in CSS. */
export function impact(x:number,y:number,color:string,heavy=false):void {
 if(!host||host.state().world?.reducedMotion||(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;
 if(!canvas){
  const field=document.querySelector('.battle-field')?.getBoundingClientRect();fxLeft=Math.max(0,(field?.left??0)-48);fxTop=Math.max(0,(field?.top??0)-48);
  const width=Math.min(innerWidth,field?field.right+48:innerWidth)-fxLeft,height=Math.min(innerHeight,field?field.bottom+48:innerHeight)-fxTop;fxRatio=Math.min(2,devicePixelRatio||1);
  canvas=document.createElement('canvas');canvas.id='worldFX';canvas.setAttribute('aria-hidden','true');canvas.style.cssText=`position:fixed;left:${fxLeft}px;top:${fxTop}px;pointer-events:none;z-index:180;width:${width}px;height:${height}px`;canvas.width=Math.round(width*fxRatio);canvas.height=Math.round(height*fxRatio);document.body.append(canvas);
 }
 for(let i=0;i<(heavy?8:4)&&particles.length<80;i++){const a=Math.random()*Math.PI*2,speed=30+Math.random()*65;particles.push({x:x-fxLeft,y:y-fxTop,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-20,age:0,life:heavy?.5:.35,color,size:heavy?3:2});}
 if(!raf){last=performance.now();raf=requestAnimationFrame(draw);}
}
function draw(now:number):void {
 const c=canvas?.getContext('2d');if(!c){raf=0;particles=[];return;}const dt=Math.min(.05,(now-last)/1000),ratio=fxRatio;last=now;
 c.clearRect(0,0,canvas!.width,canvas!.height);c.setTransform(ratio,0,0,ratio,0,0);
 for(const p of particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=110*dt;c.globalAlpha=Math.max(0,1-p.age/p.life);c.fillStyle=p.color;c.beginPath();c.arc(p.x,p.y,p.size,0,Math.PI*2);c.fill();}
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;particles=particles.filter(p=>p.age<p.life);raf=particles.length?requestAnimationFrame(draw):0;
 if(!particles.length){canvas?.remove();canvas=null;}
}
export function clearFX():void {if(raf)cancelAnimationFrame(raf);raf=0;particles=[];canvas?.remove();canvas=null;}

export function finishBattle(s:GameState,ids:number[],won:boolean,title:string):void {
 const w=ensure(s),team=ids.filter(id=>s.slimes.some(s=>s.id===id));
 record(w,s.slimes,won?'battleWin':'battleLoss',team,title);
 for(const id of team){const pet=s.slimes.find(s=>s.id===id)!;companion(w,pet).memories.push({id:`battle:${w.seq}:${id}`,title,text:`${pet.name}参加${title}，${won?'取得胜利':'本次挑战未获胜'}。`,at:w.clock});}
 w.journals.unshift({id:w.seq++,title,lines:[won?'挑战胜利':'挑战未获胜',...team.map(id=>s.slimes.find(s=>s.id===id)!.name)],at:w.clock});
 release(s,'battle');
}

export function inventoryHTML(s:GameState):string {
 const w=ensure(s),name=(key:string)=>key.startsWith('seed:')?(w.cultivars.find(c=>c.id===Number(key.slice(5)))?.name??'种子'):MATERIALS[key]??key;
 return `<section class="lw lw-detail"><h3>共同的仓库</h3><div class="lw-inventory">${Object.entries(w.inventory.items).filter(([,n])=>n>0).map(([k,n])=>`<span>${esc(name(k))}<b>${Math.floor(n)}</b></span>`).join('')}</div><p>饲料槽 ${w.inventory.containers.trough.feed??0}/99 份；旅行物资保留在各自的旅行记录中。</p>${Object.values(w.pending).some(n=>n>0)?`<button class="btn" data-act="claimOverflow">领取仓库溢出物资</button>`:''}</section>`;
}
import {MATERIALS} from './content.ts';
import {esc} from './art.ts';

export function prepareLegacy(s:GameState):void {if(s.world)prepareWorld(s.world);}

export function gameRandom(s:GameState):number {return random(s.world??ensure(s));}
