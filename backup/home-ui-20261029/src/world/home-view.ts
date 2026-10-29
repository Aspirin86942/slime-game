import type {World,Host,GameCommand,Placement} from './types.ts';
import {BUILDINGS,DECORATIONS,PLANTS,RECIPES,VISITORS,MATERIALS,PATH_STYLES,FAMILIES} from './content.ts';
import {afford,placementError,growth} from './engine.ts';
import {activity,resident} from './life.ts';
import {bounds,formOf,environment,season,day,night,SEASONS,WEATHER} from './ecology.ts';
import {scene,preview} from './home-art.ts';
import {artIcon,pathPreview,plantPreview} from './art/storybook.ts';
import {uiIcon} from './art/ui-icons.ts';
import {esc} from './art.ts';
import {HOME_WIDTH,HOME_HEIGHT,TILE,constrainCamera,screenToCell,type Camera,type CameraFrame} from './map.ts';

const camera:Camera={x:0,y:0,zoom:typeof innerWidth==='number'&&innerWidth>760?1.45:1.1,ready:false};
let viewport:{width:number;height:number;frame:CameraFrame}|null=null,houseFocused=true,preferredZoom=camera.zoom;
const ui={panel:'',category:'facilities',family:0,selected:0,crop:0,person:0,tool:'',def:'',cultivar:0,rotation:0,pathStyle:0,overlay:'',more:false};
let host:Host,issue:(command:GameCommand)=>void,lastInteraction=0,dispose:(()=>void)|null=null;
export const recentlyInteracted=()=>Date.now()-lastInteraction<2500||!!ui.tool||!!document.activeElement?.matches('.home-world input,.home-world select');
export function navigate(_tab?:string):void {dispose?.();dispose=null;ui.panel='';ui.tool='';ui.more=false;}
export function redraw(renderPage=()=>host.render()):void {const scroll=document.querySelector('.home-panel-body')?.scrollTop??0;renderPage();const body=document.querySelector('.home-panel-body');if(body)body.scrollTop=scroll;}
const btn=(text:string,action:string,attrs='',disabled=false,primary=false)=>`<button class="btn sm home-button${primary?'':' themed'}" data-lw="${action}" ${attrs} ${disabled?'disabled':''}>${text}</button>`;
const cmd=(text:string,c:GameCommand,disabled=false)=>btn(text,'cmd',`data-command="${esc(JSON.stringify(c))}"`,disabled,['craft','claimCraft','claimOverflow','harvest','harvestAll'].includes(c.type));
const name=(w:World,key:string)=>key.startsWith('seed:')?`${w.cultivars.find(v=>v.id===Number(key.slice(5)))?.name??'植物'}种子`:MATERIALS[key]??key;
const cost=(w:World,items:Record<string,number>)=>Object.entries(items).map(([k,n])=>`${esc(name(w,k))} ${Math.round(n*100)/100}`).join(' · ');
const materialCost=(w:World,items:Record<string,number>)=>`<span class="home-material-cost">${Object.entries(items).map(([k,n])=>`<span title="${esc(name(w,k))}" aria-label="${esc(name(w,k))} ${n}">${['wood','stone','dew','feed'].includes(k)?artIcon(k):esc(name(w,k))}<b>${n}</b></span>`).join('')}</span>`;
const options=(items:{id:string|number;name:string}[])=>items.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
const free=(w:World)=>host.state().slimes.filter(s=>host.available(s.id)&&activity(w,s.id).kind==='home');
function catalog(w:World):string {
 const tabs=[['facilities','设施'],['decor','装饰'],['paths','小径'],['stored','收纳']];
 let body='';
 if(ui.category==='paths')body=`<p>按住拖动即可连续铺路。双指移动地图，中键拖动也可以。</p><div class="home-catalog">${PATH_STYLES.map((n,i)=>btn(`${pathPreview(i)}<b>${esc(n)}</b>`,'path',`data-style="${i}"`)).join('')}${btn('擦除路面','path','data-style="-1"')}</div>`;
 else if(ui.category==='stored')body=`<div class="home-catalog">${w.placements.filter(p=>p.stored).map(p=>btn(`${preview(p.def,formOf(p))}<b>${esc(BUILDINGS.find(d=>d.id===p.def)?.name??DECORATIONS.find(d=>d.id===p.def)?.name??p.def)}</b><small>取出摆放</small>`,'move',`data-id="${p.id}"`)).join('')||'<p>收纳的物件会在这里等你。</p>'}</div>`;
 else{const defs=ui.category==='decor'?DECORATIONS.filter(d=>d.group!==0):BUILDINGS.filter(d=>!['expedition','resonance'].includes(d.id));body=`<div class="home-catalog">${defs.map(d=>{const owned=BUILDINGS.some(b=>b.id===d.id)&&w.placements.some(p=>p.def===d.id);return btn(`${preview(d.id)}<b>${esc(d.name)}</b><small>${owned?'已拥有':materialCost(w,d.cost)}</small>`,'build',`data-def="${d.id}"`,!!owned||!afford(w,d.cost));}).join('')}</div>`;}
 return `<nav class="home-segments">${tabs.map(([id,text])=>btn(text,'category',`data-category="${id}" aria-pressed="${ui.category===id}"`)).join('')}</nav>${body}`;
}
function plants(w:World):string {
 const cultivars=w.cultivars.filter(c=>PLANTS.find(p=>p.id===c.species)?.family===ui.family);
 return `<nav class="home-segments">${FAMILIES.map((f,i)=>btn(esc(f),'family',`data-family="${i}" aria-pressed="${ui.family===i}"`)).join('')}</nav><div class="home-plant-list">${cultivars.map(c=>`<article><div class="home-plant-heading">${plantPreview(PLANTS.find(p=>p.id===c.species)!,c.genes.color,c.genes.form)}<div><b>${esc(c.name)}</b><small>${c.seeds} 颗种子${c.protected?' · 已收藏':''}</small></div></div>${btn('播种','plant',`data-id="${c.id}"`,c.seeds<1)}${cmd('复制留种',{type:'clone',id:c.id})}${cmd(c.protected?'取消收藏':'收藏',{type:'cultivar',id:c.id,protect:!c.protected})}<details><summary>品系与命名</summary><p>亲本：${esc(c.parents.join('、')||'原生品系')} · 产量 ${c.genes.yield} · 适应 ${c.genes.adapt}</p><input aria-label="品系名称" maxlength="24" id="home-name-${c.id}" value="${esc(c.name)}">${btn('保存名称','rename',`data-id="${c.id}"`)}</details></article>`).join('')||'<p>通过同类植物授粉，可以育成新的品系。</p>'}</div><details class="home-section"><summary>授粉育种</summary><p>建好授粉棚，让两株同类植物长到开花阶段后，就能育种。</p><label>亲本一<select id="home-parent-a">${options(w.cultivars)}</select></label><label>亲本二<select id="home-parent-b">${options(w.cultivars)}</select></label>${btn('授粉 · 露水 3','breed')}</details><div class="home-actions">${cmd('全部收获',{type:'harvestAll'})}${cmd('批量补水',{type:'careAll'})}</div>`;
}
function workshop(w:World):string {
 return `<h3>制作中的物品</h3>${w.crafts.map(c=>`<div class="home-row"><span>${esc(RECIPES.find(r=>r.id===c.recipe)?.name??c.recipe)}<small>${c.ready?'可以领取':`${Math.ceil(c.remaining/60)} 分钟`}</small></span>${cmd('领取',{type:'claimCraft',id:c.id},!c.ready)}</div>`).join('')||'<p>材料会在开工时扣除，做好后可随时领取。</p>'}<h3>配方</h3>${RECIPES.map(r=>{const building=w.placements.find(p=>p.def===r.building&&!p.stored),ok=building&&building.level>=r.level;return `<article class="home-recipe"><b>${esc(r.name)}</b><p>${cost(w,r.cost)} → ${cost(w,r.output)}</p><small>${esc(BUILDINGS.find(b=>b.id===r.building)?.name??'')} · ${r.level} 级 · ${r.seconds/60} 分钟</small>${cmd('开始制作',{type:'craft',recipe:r.id,building:building?.id??0},!ok||!afford(w,r.cost))}</article>`;}).join('')}`;
}
function objectPanel(w:World):string {
 const p=w.placements.find(p=>p.id===ui.selected);if(!p)return '<p>点一下地图上的建筑或装饰。</p>';
 const d=BUILDINGS.find(d=>d.id===p.def),dec=DECORATIONS.find(d=>d.id===p.def),retired=['expedition','resonance'].includes(p.def);
 let extra='';
 if(p.def==='trough')extra=`<p>饲料槽 ${w.inventory.containers.trough.feed??0}/99，库存 ${w.stock.feed??0}</p>${cmd('补充饲料',{type:'refill'})}`;
 if(p.def==='toys')extra=`<label>一起玩的史莱姆<select id="home-play-person">${options(free(w))}</select></label><div class="home-actions">${btn('接球','play','data-kind="ball"',!free(w).length)}${btn('叠叠乐','play','data-kind="stack"',!free(w).length)}</div>`;
 if(p.def==='table')extra=`<p>每两位伙伴分享一份便当。</p>${free(w).map(s=>`<label class="home-check"><input type="checkbox" name="home-meal" value="${s.id}">${esc(s.name)}</label>`).join('')}${btn('一起用餐','meal')}`;
 if(p.def==='memorial')extra=w.memorials.map(m=>`<article><b>${esc(m.title)}</b><p>${esc(m.text)}</p></article>`).join('')||'<p>这里珍藏着一起生活的纪念。</p>';
 if(['bed','greenhouse','seedbank','pollen'].includes(p.def))extra+=btn('打开种子与育种','panel','data-panel="plants"');
 if(RECIPES.some(r=>r.building===p.def))extra+=btn('查看配方与队列','panel','data-panel="craft"');
 const upgrade=d?Object.fromEntries(Object.entries(d.cost).map(([k,v])=>[k,v*(p.level+1)])):{};
 const form=formOf(p),unfold=form<p.level,g=d&&!retired&&!p.stored&&(unfold||p.level<3)?growth(w,p):null,[a,b]=bounds(p);
 // 并排展示现在和升级后的形态与占地，空间不足时地图上的红色格子说明被谁挡住。
 const next=g?`<section class="home-growth"><div class="home-growth-forms"><figure>${preview(p.def,form)}<figcaption>现在 · ${a}×${b}</figcaption></figure><span aria-hidden="true">→</span><figure>${preview(p.def,form+1)}<figcaption>${form+1} 级形态 · ${g.size[0]}×${g.size[1]}</figcaption></figure></div>${g.placement?'':`<p class="home-growth-warning">扩建需要 ${g.size[0]}×${g.size[1]} 的空地，地图上红色格子被挡住了。可以先移开周围的物件或植物。</p>`}</section>`:'';
 const action=unfold?cmd('展开新形态',{type:'upgrade',id:p.id},!g?.placement):cmd('升级',{type:'upgrade',id:p.id},p.level>=3||!afford(w,upgrade)||!g?.placement);
 return `<div class="home-object-preview">${preview(p.def,form)}</div><h3>${esc(d?.name??dec?.name??'纪念装饰')} ${d&&!retired?`· ${p.level} 级`:''}</h3><p>${esc(retired?'这件纪念装饰可以自由摆放和收纳。':d?.desc??dec?.effect??'')}</p><div class="home-actions">${btn('移动','move',`data-id="${p.id}"`)}${cmd('收纳',{type:'store',id:p.id})}${d&&!retired?action:''}</div>${d&&!retired&&!unfold&&p.level<3?`<small>升级需要：${cost(w,upgrade)}</small>`:''}${unfold?'<small>这座设施已经升级，展开新形态不消耗材料。</small>':''}${next}${extra}${d&&!retired?`<section class="home-section"><h3>邀请伙伴帮忙</h3>${w.workers.filter(j=>j.building===p.id).map(j=>`<div class="home-row">${esc(host.state().slimes.find(s=>s.id===j.slimeId)?.name??'')}${cmd('休息',{type:'unassign',slime:j.slimeId})}</div>`).join('')}<label>空闲伙伴<select id="home-worker">${options(free(w))}</select></label>${btn('开始帮忙','assign',`data-id="${p.id}"`,!free(w).length)}</section>`:''}`;
}
function cropPanel(w:World):string {
 const c=w.crops.find(c=>c.id===ui.crop);if(!c)return '<p>植物已收好，空地可以再次种植。</p>';
 const v=w.cultivars.find(v=>v.id===c.cultivar)!,d=PLANTS.find(p=>p.id===v.species)!,e=environment(w,0,c.x,c.y,host.state().slimes);
 return `<h3>${esc(v.name)}</h3><p>${esc(d.use)}</p><progress value="${c.progress}" max="1"></progress><p>${Math.round(c.progress*100)}% · 水分可维持 ${Math.ceil(c.water)} 分钟</p><p>光照 ${Math.round(e.light)} · 湿度 ${Math.round(e.moisture)} · 肥力 ${Math.round(e.fertility)} · ${e.temperature}°</p><div class="home-actions">${cmd('照料 · 露水 1',{type:'care',id:c.id})}${cmd('收获',{type:'harvest',id:c.id},c.progress<1||d.id==='glowflower')}${cmd('施肥',{type:'fertilize',id:c.id,item:'fertilizer'},!w.stock.fertilizer)}${cmd('使用沃土',{type:'fertilize',id:c.id,item:'soil'},!w.stock.soil)}${cmd('移回种子库',{type:'uproot',id:c.id})}</div>`;
}
function companionPanel(w:World):string {
 const s=host.state().slimes.find(s=>s.id===ui.person);if(!s)return '<p>召唤伙伴后，它们会来到家园。</p>';const a=activity(w,s.id),busy=!host.available(s.id)||a.kind!=='home';
 const memories=w.companions[s.id]?.memories??[];
 return `<h3>${esc(s.name)}</h3><p>${esc(s.personality)} · ${a.kind==='work'?'正在帮忙':busy?'正在参加活动':'在家休息'}</p><p>体力 ${Math.floor(s.stamina)} · 心情 ${Math.floor(s.mood)} · 亲密 ${s.intimacy}</p><div class="home-actions">${(['pet','feed','chat','snack','rest'] as const).map((action,i)=>cmd(['抚摸','喂饲料','聊天','分享小食','休息'][i],{type:'interact',slime:s.id,action},busy)).join('')}${a.kind==='work'?cmd('结束工作',{type:'unassign',slime:s.id}):''}${btn('成长与改名','detail',`data-id="${s.id}"`)}</div><details><summary>分享制作的补给</summary><div class="home-actions">${(['meal','soup','potion'] as const).map(item=>cmd(MATERIALS[item],{type:'useSupply',slime:s.id,item},busy||!w.stock[item])).join('')}</div></details>${memories.length?`<details><summary>一起留下的回忆 · ${memories.length}</summary>${memories.slice(-50).reverse().map(m=>`<h4>${esc(m.title)}</h4><p>${esc(m.text)}</p>`).join('')}</details>`:''}`;
}
function storage(w:World):string {
 const retired=w.retired,juveniles=Array.isArray(retired?.juveniles)?retired.juveniles:[],trips=Array.isArray(retired?.trips)?retired.trips:[];
 const history=trips.map(t=>`<details><summary>旧旅行记录</summary><p>${(Array.isArray(t.log)?t.log:[]).map(esc).join('<br>')}</p></details>`).join('')+Object.values(w.stories).filter(s=>s.choices.length).map(s=>`<details><summary>故事收藏 · ${esc(s.choices[0].text)}</summary>${s.choices.map(c=>`<p>${esc(c.text)}<br>${esc(c.result)}</p>`).join('')}</details>`).join('')+Object.values(w.archives).map(a=>`<details><summary>${esc(a.name)}的回忆</summary>${a.profile.memories.map(m=>`<h4>${esc(m.title)}</h4><p>${esc(m.text)}</p>`).join('')}</details>`).join('');
 return `<div class="home-inventory">${Object.entries(w.stock).filter(([,v])=>v>0).map(([k,v])=>`<div><span>${esc(name(w,k))}</span><b>${Math.floor(v)}</b></div>`).join('')}</div>${Object.values(w.pending).some(v=>v>0)?`<p>待入库：${cost(w,w.pending)}</p>${cmd('领取可放入的物资',{type:'claimOverflow'})}`:''}<details class="home-section"><summary>历史收藏与记录</summary>${history}${juveniles.length?`<p>曾在家园照料的幼体：${juveniles.map(j=>esc(j.name)).join('、')}</p>`:''}${w.memorials.map(m=>`<h4>${esc(m.title)}</h4><p>${esc(m.text)}</p>`).join('')}${w.journals.slice(0,20).map(j=>`<details><summary>${esc(j.title)}</summary><p>${j.lines.map(esc).join('<br>')}</p></details>`).join('')}${!juveniles.length&&!w.memorials.length&&!w.journals.length?'<p>已有收藏会保存在这里。</p>':''}</details>`;
}
function ecology(w:World):string {
 return `<p>林地遮荫，湿地保水。植物、设施与伙伴会一起改变周围环境。</p><nav class="home-segments">${[['','景色'],['light','光照'],['moisture','湿度'],['fertility','肥力'],['quality','水质']].map(([id,label])=>btn(label,'overlay',`data-overlay="${id}" aria-pressed="${ui.overlay===id}"`)).join('')}</nav><h3>生态访客 · ${Object.values(w.visitors).filter(Boolean).length}/${VISITORS.length}</h3>${VISITORS.map(v=>`<article class="home-recipe"><b>${esc(v.name)}${w.visitors[v.id]?' · 已到访':''}</b><p>${esc(v.need)}</p><small>${esc(v.service)}</small></article>`).join('')}<div class="home-actions">${cmd(w.autoReplant?'关闭自动补种':'开启自动补种',{type:'settings',replant:!w.autoReplant})}${cmd(w.reducedMotion?'恢复场景动画':'减少场景动画',{type:'settings',reduced:!w.reducedMotion})}</div>`;
}
function stockHTML(w:World):string {
 return `<div class="home-stock">${['wood','stone','dew','feed'].map(k=>`<span title="${MATERIALS[k]}" aria-label="${MATERIALS[k]} ${Math.floor(w.stock[k]??0)}">${artIcon(k)}<b>${Math.floor(w.stock[k]??0)}</b></span>`).join('')}</div>`;
}
function toolsHTML(w:World):string {
 const label=(icon:string,text:string)=>`${uiIcon(icon)}<span>${text}</span>`;
 return `${ui.more?`<nav class="home-more" aria-label="更多家园工具">${[['craft','制作'],['storage','仓库'],['ecology','生态']].map(([id,text])=>btn(label(id,text),'panel',`data-panel="${id}"`)).join('')}</nav>`:''}<nav class="home-tools" aria-label="家园工具">${btn(label('build','建造'),'panel','data-panel="build"')}${btn(label('plants','种植'),'panel','data-panel="plants"')}${cmd(label('gather',w.clock-w.lastGather>=300?'采集':`${Math.ceil((300-w.clock+w.lastGather)/60)}分`),{type:'gather'},w.clock-w.lastGather<300)}${btn(label('more','更多'),'more',`aria-expanded="${ui.more}" aria-label="更多家园工具"`)}</nav>`;
}
// 物件面板打开时，在地图上画出下一档形态的占地：能用的格子为浅绿色，被挡住的为红色。
function growthPreview(w:World):string {
 const p=w.placements.find(p=>p.id===ui.selected);if(ui.panel!=='object'||ui.tool||!p||p.stored||!BUILDINGS.some(d=>d.id===p.def)||['expedition','resonance'].includes(p.def)||formOf(p)>=3)return '';
 return growth(w,p).cells.map(c=>`<rect class="home-growth-cell${c.free?'':' blocked'}" x="${c.x*TILE+3}" y="${c.y*TILE+3}" width="42" height="42" rx="5"/>`).join('');
}
export function render(h:Host,dispatch:(c:GameCommand)=>void):string {
 host=h;issue=dispatch;const w=h.state().world!;
 const panels:Record<string,{title:string;body:()=>string}>={build:{title:'布置小家',body:()=>catalog(w)},plants:{title:'种子与育种',body:()=>plants(w)},craft:{title:'家园工坊',body:()=>workshop(w)},object:{title:'物件详情',body:()=>objectPanel(w)},crop:{title:'照料植物',body:()=>cropPanel(w)},slime:{title:'一起生活',body:()=>companionPanel(w)},storage:{title:'家园仓库',body:()=>storage(w)},ecology:{title:'土地与访客',body:()=>ecology(w)}};
 const panel=panels[ui.panel],toolName=ui.tool==='path'?(ui.pathStyle<0?'拖动擦除路面':`拖动铺设${PATH_STYLES[ui.pathStyle]}`):ui.tool==='plant'?'点击空地播种':ui.tool?'点击空地放置，拖动物件也可以':'';
 return `<section id="livingWorld" class="home-world ${w.reducedMotion?'reduced-motion':''}" aria-label="家园"><div class="home-scene">${scene(w,h,camera,ui.selected,ui.crop,ui.person,!!ui.tool,ui.overlay,growthPreview(w))}</div><div class="home-season"><b>家园</b><span>${SEASONS[season(w)]}季 · 第 ${day(w)+1} 日</span><span>${WEATHER[w.weather]} · ${night(w)?'夜晚':'白天'}</span></div>${stockHTML(w)}<div class="home-camera">${btn(uiIcon('plus'),'zoom','data-factor="1.25" aria-label="放大地图"')}${btn(uiIcon('minus'),'zoom','data-factor="0.8" aria-label="缩小地图"')}${btn(uiIcon('home'),'center','aria-label="回到小屋"')}</div>${toolName?`<div class="home-tool-hint" role="status"><span>${esc(toolName)}</span>${ui.tool==='build'||ui.tool==='move'?btn(uiIcon('rotate')+'旋转','rotate'):''}${btn('完成','cancel')}</div>`:''}${panel?`<aside class="home-panel" aria-label="${panel.title}"><header><h2>${panel.title}</h2>${btn(uiIcon('close'),'close','aria-label="关闭面板"')}</header><div class="home-panel-body">${panel.body()}</div></aside>`:''}${toolsHTML(w)}</section>`;
}
const value=(id:string)=>(document.getElementById(id) as HTMLInputElement|HTMLSelectElement|null)?.value??'';
export function handleClick(event:Event):boolean {
 const target=(event.target as Element).closest<HTMLElement>('[data-lw]');if(!target||!target.closest('#livingWorld'))return false;event.preventDefault();lastInteraction=Date.now();
 const w=host.state().world!,ds=target.dataset;
 switch(ds.lw){
 case 'cmd':{const c=JSON.parse(ds.command!) as GameCommand,before=c.type==='upgrade'?w.placements.find(p=>p.id===c.id):undefined,form=before&&formOf(before);issue(c);
  // 形态真的变化了才播放一次长大动画；失败时存档不变，不播放。
  const after=before&&host.state().world!.placements.find(p=>p.id===before.id);if(after&&formOf(after)!==form)document.querySelector(`[data-home-object="${after.id}"]`)?.classList.add('grown');return true;}
 case 'panel':ui.panel=ui.panel===ds.panel?'':ds.panel!;ui.tool='';ui.more=false;break;
 case 'more':ui.more=!ui.more;break;
 case 'close':ui.panel='';break;
 case 'category':ui.category=ds.category!;break;
 case 'family':ui.family=Number(ds.family);break;
 case 'build':ui.def=ds.def!;ui.tool='build';ui.rotation=0;ui.panel='';break;
 case 'move':ui.selected=Number(ds.id);ui.rotation=w.placements.find(p=>p.id===ui.selected)?.rotation??0;ui.tool='move';ui.panel='';break;
 case 'plant':ui.cultivar=Number(ds.id);ui.tool='plant';ui.panel='';break;
 case 'path':ui.pathStyle=Number(ds.style);ui.tool='path';ui.panel='';break;
 case 'cancel':ui.tool='';break;
 case 'rotate':ui.rotation=(ui.rotation+1)%4;break;
 case 'zoom':zoomAt(Number(ds.factor));return true;
 case 'center':center();return true;
 case 'overlay':ui.overlay=ds.overlay!;break;
 case 'rename':issue({type:'cultivar',id:Number(ds.id),name:value(`home-name-${ds.id}`)});return true;
 case 'breed':issue({type:'breed',a:Number(value('home-parent-a')),b:Number(value('home-parent-b'))});return true;
 case 'assign':issue({type:'assign',slime:Number(value('home-worker')),building:Number(ds.id)});return true;
 case 'meal':issue({type:'meal',ids:[...document.querySelectorAll<HTMLInputElement>('input[name="home-meal"]:checked')].map(e=>Number(e.value))});return true;
 case 'play':host.play?.(ds.kind!,Number(value('home-play-person')));return true;
 case 'detail':host.open?.(`detail:${ds.id}`);return true;
 }
 redraw();return true;
}
function applyCamera():void {
 const svg=document.querySelector<SVGSVGElement>('.home-map');if(!svg)return;const rect=svg.getBoundingClientRect();constrainCamera(camera,rect.width,rect.height,viewport?.frame);svg.setAttribute('viewBox',`${camera.x} ${camera.y} ${rect.width/camera.zoom} ${rect.height/camera.zoom}`);
}
function center():void {
 if(!viewport)return;const {width,height,frame}=viewport,p=host.state().world!.placements.find(p=>p.def==='house'&&!p.stored),[a,b]=p?bounds(p):[2,2];
 // Include the roof, chimney and entrance when fitting the house into the clear area.
 camera.zoom=Math.min(preferredZoom,(frame.right-frame.left)/(a*TILE+24),(frame.bottom-frame.top)/(b*TILE+TILE*2));
 constrainCamera(camera,width,height,frame);
 camera.x=((p?.x??6)+a/2)*TILE-(frame.left+frame.right)/2/camera.zoom;
 camera.y=((p?.y??6)+b/2)*TILE-TILE/2-(frame.top+frame.bottom)/2/camera.zoom;
 camera.ready=true;houseFocused=true;applyCamera();updateObjects();
}
function zoomAt(factor:number,x?:number,y?:number):void {
 const svg=document.querySelector<SVGSVGElement>('.home-map');if(!svg)return;const r=svg.getBoundingClientRect(),f=viewport?.frame,px=x??(f?(f.left+f.right)/2:r.width/2),py=y??(f?(f.top+f.bottom)/2:r.height/2),wx=camera.x+px/camera.zoom,wy=camera.y+py/camera.zoom;houseFocused=false;camera.zoom*=factor;constrainCamera(camera,r.width,r.height,f);preferredZoom=camera.zoom;camera.x=wx-px/camera.zoom;camera.y=wy-py/camera.zoom;applyCamera();updateObjects();
}
let lastObjects=0;
function updateObjects():void {
 const svg=document.querySelector<SVGSVGElement>('.home-map'),group=svg?.querySelector('.home-objects');if(!group)return;
 const text=scene(host.state().world!,host,camera,ui.selected,ui.crop,ui.person,!!ui.tool,ui.overlay),doc=new DOMParser().parseFromString(text,'text/html'),next=doc.querySelector('.home-objects');if(next)group.replaceChildren(...next.childNodes);lastObjects=Date.now();
}
export function paintResidents():void {
 if(!host)return;const w=host.state().world!;
 for(const el of document.querySelectorAll<SVGElement>('[data-home-resident]')){const id=Number(el.dataset.homeResident),s=host.state().slimes.find(s=>s.id===id);if(!s)continue;const a=activity(w,id),r=resident(w,s);el.style.display=(a.kind==='home'&&host.available(id)||a.kind==='work')?'':'none';el.setAttribute('transform',`translate(${(r.x+.5)*TILE} ${(r.y+1)*TILE-5})`);el.dataset.depth=String(r.y+.85);}
 const group=document.querySelector('.home-objects');if(group){const children=[...group.children].sort((a,b)=>Number((a as SVGElement).dataset.depth??0)-Number((b as SVGElement).dataset.depth??0));for(const node of children)group.append(node);}
}
function selectAt(target:Element,x:number,y:number):void {
 const w=host.state().world!;if(x<0||y<0||x>=HOME_WIDTH||y>=HOME_HEIGHT)return;
 if(ui.tool==='build'||ui.tool==='move'){
  const old=w.placements.find(p=>p.id===ui.selected),p:Placement=ui.tool==='move'&&old?{...old,x,y,rotation:ui.rotation,stored:false}:{id:-1,def:ui.def,zone:0,x,y,rotation:ui.rotation,level:1,stored:false};
  const error=placementError(w,p);if(error){host.toast(error);return;}const tool=ui.tool;ui.tool='';issue(tool==='move'?{type:'move',id:p.id,zone:0,x,y,rotation:p.rotation}:{type:'build',def:p.def,zone:0,x,y,rotation:p.rotation});return;
 }
 if(ui.tool==='plant'){issue({type:'plant',cultivar:ui.cultivar,zone:0,x,y,explicit:true});return;}
 const object=target.closest<SVGElement>('[data-home-object]'),crop=target.closest<SVGElement>('[data-home-crop]'),slime=target.closest<SVGElement>('[data-home-resident]');
 if(object){ui.selected=Number(object.dataset.homeObject);ui.crop=0;ui.panel='object';}else if(crop){ui.crop=Number(crop.dataset.homeCrop);ui.selected=0;ui.panel='crop';}else if(slime){ui.person=Number(slime.dataset.homeResident);ui.panel='slime';}else{ui.panel='';ui.selected=0;ui.crop=0;}redraw();
}
export function mount():void {
 dispose?.();const svg=document.querySelector<SVGSVGElement>('.home-map');if(!svg)return;
 const controller=new AbortController(),opts={signal:controller.signal},pointers=new Map<number,{x:number;y:number}>();dispose=()=>controller.abort();
 // Controls and the camera use the same measured, unobstructed screen area.
 const world=svg.closest<HTMLElement>('.home-world')!;
 const top=document.querySelector<HTMLElement>('.topbar')!,nav=document.querySelector<HTMLElement>('.tabbar')!;
 const season=world.querySelector<HTMLElement>('.home-season')!,stock=world.querySelector<HTMLElement>('.home-stock')!,tools=world.querySelector<HTMLElement>('.home-tools')!,controls=world.querySelector<HTMLElement>('.home-camera')!;
 const measureBars=()=>{
  const r=world.getBoundingClientRect(),t=top.getBoundingClientRect(),n=nav.getBoundingClientRect();
  world.style.setProperty('--home-top',`${t.bottom-r.top}px`);world.style.setProperty('--home-bottom',`${r.bottom-n.top}px`);
  const s=season.getBoundingClientRect(),k=stock.getBoundingClientRect(),u=tools.getBoundingClientRect(),c=controls.getBoundingClientRect(),landscape=matchMedia('(max-height:500px) and (orientation:landscape)').matches;
  const frame:CameraFrame={left:landscape?Math.max(s.right,k.right,u.right)-r.left+12:12,top:(landscape?t.bottom:Math.max(t.bottom,s.bottom,k.bottom))-r.top+12,right:c.left-r.left-12,bottom:(landscape?n.top:u.top)-r.top-12};
  const previous=viewport,changed=!previous||previous.width!==r.width||previous.height!==r.height||Object.keys(frame).some(key=>frame[key as keyof CameraFrame]!==previous.frame[key as keyof CameraFrame]);
  const focus=previous?{x:camera.x+(previous.frame.left+previous.frame.right)/2/camera.zoom,y:camera.y+(previous.frame.top+previous.frame.bottom)/2/camera.zoom}:null;
  viewport={width:r.width,height:r.height,frame};
  if(!camera.ready||changed&&houseFocused){center();return;}
  if(changed&&focus){constrainCamera(camera,r.width,r.height,frame);camera.x=focus.x-(frame.left+frame.right)/2/camera.zoom;camera.y=focus.y-(frame.top+frame.bottom)/2/camera.zoom;}
  applyCamera();if(changed)updateObjects();
 };
 const observer=new ResizeObserver(measureBars);for(const el of [top,nav,world,season,stock,tools,controls])observer.observe(el,{box:'border-box'});
 controller.signal.addEventListener('abort',()=>observer.disconnect(),{once:true});measureBars();
 let start:{x:number;y:number;target:Element;pan:boolean}|null=null,moved=false,lastCell:[number,number]|null=null,stroke:Set<number>|null=null,erase=false;
 const position=(event:PointerEvent|WheelEvent)=>{const r=svg.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};};
 const clear=()=>{svg.querySelector('.home-preview')!.innerHTML='';};
 const drawCell=(x:number,y:number,valid=true)=>`<rect x="${x*TILE+1}" y="${y*TILE+1}" width="46" height="46" rx="4" fill="${valid?'#fff2b7':'#e77770'}" fill-opacity=".55" stroke="${valid?'#577545':'#a13636'}" stroke-width="2"/>`;
 const mark=(x:number,y:number)=>{if(!stroke||x<0||y<0||x>=HOME_WIDTH||y>=HOME_HEIGHT)return;stroke.add(y*HOME_WIDTH+x);};
 const walk=(x:number,y:number)=>{if(!lastCell)return;let [a,b]=lastCell;const tx=Math.max(0,Math.min(HOME_WIDTH-1,x)),ty=Math.max(0,Math.min(HOME_HEIGHT-1,y));while(a!==tx||b!==ty){if(Math.abs(tx-a)>=Math.abs(ty-b))a+=Math.sign(tx-a);else b+=Math.sign(ty-b);mark(a,b);}lastCell=[tx,ty];svg.querySelector('.home-preview')!.innerHTML=[...stroke!].map(n=>drawCell(n%HOME_WIDTH,Math.floor(n/HOME_WIDTH),!erase)).join('');};
 const previewAt=(x:number,y:number)=>{if(!['build','move','plant'].includes(ui.tool))return;const w=host.state().world!,p=w.placements.find(p=>p.id===ui.selected);if(ui.tool==='plant'){svg.querySelector('.home-preview')!.innerHTML=drawCell(x,y);return;}const next:Placement=ui.tool==='move'&&p?{...p,x,y,rotation:ui.rotation,stored:false}:{id:-1,def:ui.def,zone:0,x,y,rotation:ui.rotation,level:1,stored:false},[a,b]=bounds(next),valid=!placementError(w,next);svg.querySelector('.home-preview')!.innerHTML=Array.from({length:a*b},(_,n)=>drawCell(x+n%a,y+Math.floor(n/a),valid)).join('');};
 svg.addEventListener('contextmenu',e=>e.preventDefault(),opts);
 svg.addEventListener('pointerdown',e=>{
  lastInteraction=Date.now();const p=position(e);pointers.set(e.pointerId,p);svg.setPointerCapture(e.pointerId);e.preventDefault();
  if(pointers.size>1){stroke=null;lastCell=null;clear();moved=true;return;}
  const [x,y]=screenToCell(camera,p.x,p.y);moved=false;const pan=e.button===1||e.button===2;start={...p,target:e.target as Element,pan};
  if(ui.tool==='path'&&!pan){stroke=new Set();lastCell=[x,y];erase=ui.pathStyle<0||(host.state().world!.paths[0]??[]).includes(y*HOME_WIDTH+x)&&(host.state().world!.pathStyles?.[`0:${y*HOME_WIDTH+x}`]??0)===ui.pathStyle;mark(x,y);walk(x,y);}else previewAt(x,y);
 },opts);
 svg.addEventListener('pointermove',e=>{
  const p=position(e),old=pointers.get(e.pointerId);if(!old){previewAt(...screenToCell(camera,p.x,p.y));return;}lastInteraction=Date.now();
  if(pointers.size===2){houseFocused=false;const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)![1],before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(p.x-other.x,p.y-other.y);pointers.set(e.pointerId,p);camera.x-=(p.x-old.x)/2/camera.zoom;camera.y-=(p.y-old.y)/2/camera.zoom;if(before>5)zoomAt(after/before,(p.x+other.x)/2,(p.y+other.y)/2);else applyCamera();return;}
  pointers.set(e.pointerId,p);if(!start)return;moved ||=Math.hypot(p.x-start.x,p.y-start.y)>6;
  if(stroke){walk(...screenToCell(camera,p.x,p.y));return;}
  if(ui.tool==='move'&&!start.pan){previewAt(...screenToCell(camera,p.x,p.y));return;}
  if(moved){houseFocused=false;camera.x-=(p.x-old.x)/camera.zoom;camera.y-=(p.y-old.y)/camera.zoom;applyCamera();if(Date.now()-lastObjects>140)updateObjects();}
 },opts);
 svg.addEventListener('pointerup',e=>{
  lastInteraction=Date.now();pointers.delete(e.pointerId);if(pointers.size){start=null;stroke=null;return;}const p=position(e);
  if(stroke){const cells=[...stroke];stroke=null;start=null;clear();if(cells.length)issue({type:'paint',zone:0,cells,style:Math.max(0,ui.pathStyle),erase});return;}
  if(start&&(!moved||ui.tool==='move'&&!start.pan))selectAt(start.target,...screenToCell(camera,p.x,p.y));else updateObjects();start=null;clear();
 },opts);
 svg.addEventListener('pointercancel',()=>{pointers.clear();start=null;stroke=null;lastCell=null;clear();},opts);
 svg.addEventListener('wheel',e=>{e.preventDefault();lastInteraction=Date.now();const p=position(e);zoomAt(Math.exp(-e.deltaY*.0015),p.x,p.y);},{...opts,passive:false});
 svg.addEventListener('keydown',e=>{if(e.key==='Escape'){ui.tool='';ui.panel='';redraw();}if(e.key==='Enter'||e.key===' '){const target=e.target as Element;if(target.closest('[data-home-object],[data-home-crop],[data-home-resident]')){e.preventDefault();selectAt(target,0,0);}}},opts);
 window.addEventListener('resize',measureBars,opts);
 window.visualViewport?.addEventListener('resize',measureBars,opts);
}
