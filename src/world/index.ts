import type {Host,GameCommand,GameState,Slime,World} from './types.ts';
import {createWorld,execute,advance,companion,occupied} from './engine.ts';
import {render as view,mount as mountView,handleClick as click} from './view.ts';
export {createWorld,execute,advance,occupied} from './engine.ts';
export {validWorld} from './storage.ts';
export {comboFor,COMBOS} from './combat.ts';
export {BUILDINGS,PLANTS,VISITORS} from './content.ts';
let host:Host|null=null;
export function connect(h:Host):void {host=h;}
export function ensure(s:GameState):World {s.world??=createWorld();return s.world;}
export function isBusy(s:GameState,id:number):boolean{return s.world?occupied(s.world,id):false;}
export function tick(s:GameState,seconds:number):void {if(!s.started)return;advance(ensure(s),seconds,s.slimes);}
export function render():string {if(!host)return '';ensure(host.state());return view(host,dispatch);}
export function mount():void {mountView();}
export function refresh():void {
 if(!host||!document.getElementById('livingWorld'))return;
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
 const saved=host.save();host.render();host.toast(saved?(res.message.length>36?'这段回忆已保存，可以在旅行册回看。':res.message):'进度暂存在本页，存储失败。请留在页面并检查存档提示。');
}
/** Called only after intentional roster changes such as merging. */
export function reconcile(s:GameState):void {
 if(!s.world)return;const w=s.world,ids=new Set(s.slimes.map(s=>s.id));
 for(const [key,c] of Object.entries(w.companions))if(!ids.has(Number(key))){w.journals.unshift({id:w.seq++,title:'伙伴留下的记忆',lines:c.memories.map(m=>m.title+'：'+m.text),at:w.clock});delete w.companions[key];}
 for(const c of Object.values(w.companions)){for(const id of Object.keys(c.friends))if(!ids.has(Number(id)))delete c.friends[id];if(c.mentor&&!ids.has(c.mentor))c.mentor=null;}
 for(const j of w.juveniles)if(j.mentor&&!ids.has(j.mentor))j.mentor=null;
 for(const key of Object.keys(w.recruited))if(!ids.has(w.recruited[key]))delete w.recruited[key];w.workers=w.workers.filter(j=>ids.has(j.slimeId));w.journals=w.journals.slice(0,100);
}

let canvas:HTMLCanvasElement|null=null,raf=0,last=0;
type Particle={x:number;y:number;vx:number;vy:number;age:number;life:number;color:string;size:number;};
let particles:Particle[]=[];
/** Bounded shared overlay; transform/opacity based character motion stays in CSS. */
export function impact(x:number,y:number,color:string,heavy=false):void {
 if(!host||host.state().world?.reducedMotion||(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;
 if(!canvas){canvas=document.createElement('canvas');canvas.id='worldFX';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:180;width:100%;height:100%';document.body.append(canvas);}
 const ratio=Math.min(2,devicePixelRatio||1);if(canvas.width!==Math.round(innerWidth*ratio)||canvas.height!==Math.round(innerHeight*ratio)){canvas.width=Math.round(innerWidth*ratio);canvas.height=Math.round(innerHeight*ratio);}
 for(let i=0;i<(heavy?16:8)&&particles.length<160;i++){const a=Math.random()*Math.PI*2,speed=30+Math.random()*65;particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-20,age:0,life:heavy?.5:.35,color,size:heavy?3:2});}
 if(!raf){last=performance.now();raf=requestAnimationFrame(draw);}
}
function draw(now:number):void {
 const c=canvas?.getContext('2d');if(!c){raf=0;particles=[];return;}const dt=Math.min(.05,(now-last)/1000),ratio=Math.min(2,devicePixelRatio||1);last=now;
 c.clearRect(0,0,canvas!.width,canvas!.height);c.setTransform(ratio,0,0,ratio,0,0);
 for(const p of particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=110*dt;c.globalAlpha=Math.max(0,1-p.age/p.life);c.fillStyle=p.color;c.beginPath();c.arc(p.x,p.y,p.size,0,Math.PI*2);c.fill();}
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;particles=particles.filter(p=>p.age<p.life);raf=particles.length?requestAnimationFrame(draw):0;
 if(!particles.length){canvas?.remove();canvas=null;}
}
export function clearFX():void {if(raf)cancelAnimationFrame(raf);raf=0;particles=[];canvas?.remove();canvas=null;}
