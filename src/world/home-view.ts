import type {World,Host,GameCommand,Placement} from './types.ts';
import {BUILDINGS,DECORATIONS,PLANTS,RECIPES,VISITORS,MATERIALS,PATH_STYLES,FAMILIES} from './content.ts';
import {afford,placementError,growth} from './engine.ts';
import {activity,resident} from './life.ts';
import {bounds,formOf,environment,season,day,night,SEASONS,WEATHER} from './ecology.ts';
import {scene,preview,objectArt} from './home-art.ts';
import {artIcon,pathPreview,plantPreview} from './art/storybook.ts';
import {uiIcon} from './art/ui-icons.ts';
import {esc} from './art.ts';
import {HOME_WIDTH,HOME_HEIGHT,TILE,constrainCamera,screenToCell,type Camera,type CameraFrame} from './map.ts';

const camera:Camera={x:0,y:0,zoom:typeof innerWidth==='number'&&innerWidth>760?1.45:1.1,ready:false};
let viewport:{width:number;height:number;frame:CameraFrame}|null=null,houseFocused=true,focusedId=0,focusPending=false,preferredZoom=camera.zoom;
const ui={panel:'',category:'facilities',group:'all',family:0,selected:0,crop:0,person:0,tool:'',def:'',cultivar:0,rotation:0,pathStyle:0,overlay:'',more:false,manage:false,meal:null as number[]|null,parents:null as number[]|null};
let previewCell:[number,number]|null=null;
let host:Host,issue:(command:GameCommand)=>boolean,lastInteraction=0,dispose:(()=>void)|null=null;
export const recentlyInteracted=()=>Date.now()-lastInteraction<2500||!!ui.tool||!!document.activeElement?.matches('.home-world input,.home-world select');
export function navigate(_tab?:string):void {dispose?.();dispose=null;ui.panel='';ui.tool='';ui.more=false;}
export function redraw(renderPage=()=>host.render()):void {
 const scroll=document.querySelector('.home-panel-body')?.scrollTop??0,active=document.activeElement as HTMLElement|null;
 const shelf=document.querySelector('.home-build-panel .home-catalog'),shelfKey=document.querySelector<HTMLElement>('.home-build-panel')?.dataset.catalog,shelfScroll=shelf?.scrollLeft??0;
 const data=active?.closest('.home-world')&&active.dataset.lw?{...active.dataset}:null;
 renderPage();const body=document.querySelector('.home-panel-body');if(body)body.scrollTop=scroll;
 const nextShelf=document.querySelector('.home-build-panel .home-catalog');if(nextShelf&&document.querySelector<HTMLElement>('.home-build-panel')?.dataset.catalog===shelfKey)nextShelf.scrollLeft=shelfScroll;
 if(data)[...document.querySelectorAll<HTMLElement>('.home-world [data-lw]')].find(el=>Object.entries(data).every(([k,v])=>el.dataset[k]===v))?.focus({preventScroll:true});
}
const btn=(text:string,action:string,attrs='',disabled=false,primary=false)=>`<button class="btn sm home-button${primary?'':' themed'}" data-lw="${action}" ${attrs} ${disabled?'disabled':''}>${text}</button>`;
const cmd=(text:string,c:GameCommand,disabled=false)=>btn(text,'cmd',`data-command="${esc(JSON.stringify(c))}"`,disabled,['upgrade','refill','craft','claimCraft','claimOverflow','harvest','harvestAll'].includes(c.type));
const name=(w:World,key:string)=>key.startsWith('seed:')?`${w.cultivars.find(v=>v.id===Number(key.slice(5)))?.name??'植物'}种子`:MATERIALS[key]??key;
const cost=(w:World,items:Record<string,number>)=>Object.entries(items).map(([k,n])=>`${esc(name(w,k))} ${Math.round(n*100)/100}`).join(' · ');
const materialCost=(w:World,items:Record<string,number>)=>`<span class="home-material-cost">${Object.entries(items).map(([k,n])=>`<span title="${esc(name(w,k))}" aria-label="${esc(name(w,k))} ${n}">${['wood','stone','dew','feed'].includes(k)?artIcon(k):esc(name(w,k))}<b>${n}</b></span>`).join('')}</span>`;
const free=(w:World)=>host.state().slimes.filter(s=>host.available(s.id)&&activity(w,s.id).kind==='home');
const mealGuests=(w:World,p:Placement)=>{const list=free(w);return (ui.meal??list.slice(0,p.level*2).map(s=>s.id)).filter(id=>list.some(s=>s.id===id));};
const purpose:Record<string,string>={house:'伙伴休息的小家',kitchen:'烹饪饲料与料理',table:'邀请伙伴一起吃饭',spa:'让伙伴舒舒服服休息',bed:'照料植物与补水',greenhouse:'调节植物生长环境',pollen:'授粉，培育新品系',seedbank:'收藏种子与复制留种',grove:'生产木材，提供树荫',compost:'制作肥料与沃土',insects:'吸引生态访客',observe:'观察家园里的访客',channel:'生产露水，灌溉植物',pond:'养育水生植物',filter:'改善附近水质',waterbed:'种植水生植物',woodshop:'制作木板与纪念物',alchemy:'炼制染料与药剂',training:'练习协作，积累笔记',archive:'制作笔记与纪念册',stars:'收集夜空中的星尘',memorial:'珍藏伙伴的共同回忆',trough:'为伙伴补充饲料',toys:'一起接球、叠叠乐'};
const buildingGroups=[{id:'all',name:'全部',defs:[]},{id:'life',name:'生活',defs:['house','kitchen','table','spa','trough','toys','memorial']},{id:'plants',name:'种植',defs:['bed','greenhouse','pollen','seedbank','channel','pond','waterbed']},{id:'craft',name:'生产',defs:['grove','compost','woodshop','alchemy','training','archive','stars']},{id:'nature',name:'生态',defs:['insects','observe','filter']}];
const shortage=(w:World,items:Record<string,number>)=>Object.entries(items).filter(([k,n])=>(w.stock[k]??0)<n).map(([k,n])=>`${name(w,k)} ${Math.ceil(n-(w.stock[k]??0))}`).join('、');
function catalog(w:World):string {
 const tabs=[['facilities','设施'],['decor','装饰'],['paths','小径'],['stored','收纳']];
 let body='';
 if(ui.category==='paths')body=`<p>按住拖动即可连续铺路。双指移动地图，中键拖动也可以。</p><div class="home-catalog">${PATH_STYLES.map((n,i)=>btn(`${pathPreview(i)}<b>${esc(n)}</b>`,'path',`data-style="${i}"`)).join('')}${btn('擦除路面','path','data-style="-1"')}</div>`;
 else if(ui.category==='stored')body=`<div class="home-catalog">${w.placements.filter(p=>p.stored).map(p=>btn(`${preview(p.def,formOf(p))}<b>${esc(BUILDINGS.find(d=>d.id===p.def)?.name??DECORATIONS.find(d=>d.id===p.def)?.name??p.def)}</b><small>取出摆放</small>`,'move',`data-id="${p.id}"`)).join('')||'<p>收纳的物件会在这里等你。</p>'}</div>`;
 else{
  const group=buildingGroups.find(g=>g.id===ui.group)??buildingGroups[0],defs=ui.category==='decor'?DECORATIONS.filter(d=>d.group!==0):BUILDINGS.filter(d=>!['expedition','resonance'].includes(d.id)&&(group.id==='all'||group.defs.includes(d.id)));
  body=`${ui.category==='facilities'?`<nav class="home-filters" aria-label="设施用途">${buildingGroups.map(g=>btn(g.name,'group',`data-group="${g.id}" aria-pressed="${ui.group===g.id}"`)).join('')}</nav>`:''}<div class="home-catalog">${defs.map(d=>{
   const owned=BUILDINGS.some(b=>b.id===d.id)?w.placements.find(p=>p.def===d.id):undefined,missing=shortage(w,d.cost);
   return btn(`${preview(d.id,owned?formOf(owned):1)}<b>${esc(d.name)}</b><span class="home-catalog-use">${esc(purpose[d.id]??('effect' in d?d.effect:''))}</span><small>${owned?`<span class="home-owned">${owned.stored?'已收纳 · 取出':`${owned.level} 级 · 查看`}</span>`:materialCost(w,d.cost)}${!owned&&missing?`<span class="home-shortage">缺 ${esc(missing)}</span>`:''}</small>`,owned?(owned.stored?'move':'inspect'):'build',`data-def="${d.id}"${owned?` data-id="${owned.id}"`:''}`,!owned&&!!missing);
  }).join('')}</div>`;
 }
 return `<nav class="home-segments">${tabs.map(([id,text])=>btn(text,'category',`data-category="${id}" aria-pressed="${ui.category===id}"`)).join('')}</nav>${body}`;
}
function breeding(w:World):string {
 const flowering=w.cultivars.filter(v=>w.crops.some(c=>c.cultivar===v.id&&c.progress>=.7));
 const family=(id:number)=>PLANTS.find(p=>p.id===w.cultivars.find(v=>v.id===id)?.species)?.family;
 if(ui.parents===null){const first=flowering.find(a=>flowering.some(b=>b.id!==a.id&&family(a.id)===family(b.id)));ui.parents=first?[first.id,flowering.find(b=>b.id!==first.id&&family(b.id)===family(first.id))!.id]:[];}
 ui.parents=ui.parents.filter(id=>flowering.some(v=>v.id===id));
 const ready=ui.parents.length===2,available=w.placements.some(p=>p.def==='pollen'&&!p.stored);
 return `<p>${available?'点选两株同类开花植物，培育新的品系。':'先建好授粉棚，再让两株同类植物开花。'}</p><div class="home-parents">${flowering.map(v=>{const d=PLANTS.find(p=>p.id===v.species)!;return btn(`${plantPreview(d,v.genes.color,v.genes.form)}<span>${esc(v.name)}</span>`,'parent',`data-id="${v.id}" aria-pressed="${ui.parents!.includes(v.id)}"`,!!ui.parents!.length&&family(ui.parents![0])!==d.family);}).join('')||'<p>还没有开花的植物，先种下喜欢的种子吧。</p>'}</div><div class="home-actions">${btn('授粉 · 露水 3','breed','',!ready||!available||(w.stock.dew??0)<3,true)}</div><small>${ui.parents.map(id=>esc(w.cultivars.find(v=>v.id===id)!.name)).join(' ＋ ')||'等待选择亲本'}</small>`;
}
function plants(w:World):string {
 const cultivars=w.cultivars.filter(c=>PLANTS.find(p=>p.id===c.species)?.family===ui.family),harvest=w.crops.filter(c=>c.progress>=1&&w.cultivars.find(v=>v.id===c.cultivar)?.species!=='glowflower').length,thirsty=w.crops.filter(c=>c.progress<1&&c.water<150).length,seedbank=w.placements.some(p=>p.def==='seedbank'&&!p.stored),cloneCost=w.placements.some(p=>p.def==='pollen'&&!p.stored&&p.level>=2)?2:4;
 return `<div class="home-actions home-garden-actions">${cmd(`收获${harvest?` · ${harvest} 株`:''}`,{type:'harvestAll'},!harvest)}${cmd(`补水${thirsty?` · 露水 ${thirsty}`:''}`,{type:'careAll'},!thirsty||(w.stock.dew??0)<thirsty)}</div><nav class="home-segments">${FAMILIES.map((f,i)=>btn(esc(f),'family',`data-family="${i}" aria-pressed="${ui.family===i}"`)).join('')}</nav><div class="home-plant-list">${cultivars.map(c=>`<article><div class="home-plant-heading">${plantPreview(PLANTS.find(p=>p.id===c.species)!,c.genes.color,c.genes.form)}<div><b>${esc(c.name)}</b><small>${c.seeds} 颗种子${c.protected?' · 已收藏':''}</small></div></div>${btn('播种','plant',`data-id="${c.id}"`,c.seeds<1,true)}<details><summary>留种与管理</summary><div class="home-actions">${cmd(`复制 · 露水 ${cloneCost}`,{type:'clone',id:c.id},!seedbank||(w.stock.dew??0)<cloneCost)}${cmd(c.protected?'取消收藏':'收藏',{type:'cultivar',id:c.id,protect:!c.protected})}</div>${!seedbank?'<small>建好种子库后可以复制留种。</small>':''}<small>亲本：${esc(c.parents.join('、')||'原生品系')} · 产量 ${c.genes.yield} · 适应 ${c.genes.adapt}</small><input aria-label="品系名称" maxlength="24" id="home-name-${c.id}" value="${esc(c.name)}">${btn('保存名称','rename',`data-id="${c.id}"`)}</details></article>`).join('')||'<p>通过同类植物授粉，可以育成新的品系。</p>'}</div><details class="home-section"><summary>授粉育种</summary>${breeding(w)}</details>`;
}
function workshop(w:World,p?:Placement):string {
 const queue=w.crafts.filter(c=>!p||c.building===p.id);
 const tasks=queue.map(c=>`<div class="home-row home-craft-task"><span><b>${esc(RECIPES.find(r=>r.id===c.recipe)?.name??c.recipe)}</b><small>${c.ready?'已做好，领取即可使用':`${Math.ceil(c.remaining/60)} 分钟后完成`}</small></span>${cmd('领取',{type:'claimCraft',id:c.id},!c.ready)}</div>`).join('');
 if(!p)return `${tasks?`<h3>制作队列</h3>${tasks}`:'<p>点一座设施，就能查看它的配方。</p>'}<div class="home-catalog">${w.placements.filter(b=>!b.stored&&RECIPES.some(r=>r.building===b.def)).map(b=>btn(`${preview(b.def,formOf(b))}<b>${esc(BUILDINGS.find(d=>d.id===b.def)!.name)}</b><small>${w.crafts.filter(c=>c.building===b.id).length} 项制作中</small>`,'inspect',`data-id="${b.id}"`)).join('')||'<p>建一间厨房或工坊，开始制作家园物资。</p>'}</div>${btn(uiIcon('build')+'建造设施','panel','data-panel="build"')}`;
 const recipes=RECIPES.filter(r=>r.building===p.def),locked=recipes.filter(r=>r.level>p.level),full=queue.length>=p.level+1;
 return `${tasks}<div class="home-section-heading"><b>做点什么</b><small>队列 ${queue.length}/${p.level+1}</small></div><div class="home-recipes">${recipes.filter(r=>r.level<=p.level).map(r=>{
  const missing=shortage(w,r.cost),why=full?'队列已满':missing?`缺 ${missing}`:'';
  return `<article class="home-recipe"><div><b>${esc(r.name)}</b><small>${cost(w,r.output)} · ${r.seconds/60} 分钟</small><small>${cost(w,r.cost)}</small></div>${cmd(why?esc(why):'制作',{type:'craft',recipe:r.id,building:p.id},!!why)}</article>`;
 }).join('')}</div>${locked.length?`<p class="home-unlock">${uiIcon('lock')}${locked.map(r=>`${r.level} 级：${esc(r.name)}`).join(' · ')}</p>`:''}`;
}
function people(w:World,action:string,selected:number[]=[],disabled=false):string {
 return `<div class="home-people">${free(w).map(s=>btn(`<span class="home-portrait" aria-hidden="true">${host.slimeHTML(s)}</span><span>${esc(s.name)}</span>`,action,`data-person="${s.id}" data-id="${ui.selected}"${['play-person','meal-person'].includes(action)?` aria-pressed="${selected.includes(s.id)}"`:''}`,disabled)).join('')||'<p>空闲伙伴回来后，就能一起活动。</p>'}</div>`;
}
function buildingManagement(w:World,p:Placement):string {
 const workers=w.workers.filter(j=>j.building===p.id),capacity=p.level>=2?2:1,facility=BUILDINGS.some(b=>b.id===p.def)&&!['expedition','resonance'].includes(p.def),busy=w.crafts.some(c=>c.building===p.id);
 return `${facility?`<div class="home-section-heading"><b>伙伴帮忙</b><small>${workers.length}/${capacity} 位</small></div>${workers.map(j=>`<div class="home-row"><span>${esc(host.state().slimes.find(s=>s.id===j.slimeId)?.name??'伙伴')}<small>正在这里帮忙</small></span>${cmd('休息',{type:'unassign',slime:j.slimeId})}</div>`).join('')}<p>${workers.length>=capacity?'工作位已满，可以先让伙伴休息。':'点一位空闲伙伴，就能开始帮忙。'}</p>${people(w,'assign',[],workers.length>=capacity)}`:''}<div class="home-section">${cmd(uiIcon('storage')+'收纳物件',{type:'store',id:p.id},busy)}<small>${busy?'完成并领取制作后可以收纳。':'放回建造栏的「收纳」，等级和形态都会保留。'}</small></div>`;
}
function objectPanel(w:World):string {
 const p=w.placements.find(p=>p.id===ui.selected);if(!p)return '<p>点一下地图上的建筑或装饰。</p>';
 if(ui.manage)return buildingManagement(w,p);
 if(RECIPES.some(r=>r.building===p.def))return workshop(w,p);
 if(p.def==='trough'){
  const n=w.inventory.containers.trough.feed??0,amount=Math.min(99-n,w.stock.feed??0);
  return `<div class="home-section-heading"><b>伙伴的自助餐</b><span>${n}<small class="home-inline"> / 99 份</small></span></div><progress value="${n}" max="99"></progress><div class="home-actions">${cmd(uiIcon('food')+(amount?`补满饲料 · ${amount} 份`:n>=99?'饲料槽已满':'库存没有饲料'),{type:'refill'},!amount)}</div><small>伙伴会自己过来吃饭 · 库存 ${w.stock.feed??0} 份</small>`;
 }
 if(p.def==='toys'){
  const list=free(w),person=list.find(s=>s.id===ui.person)??list[0];
  return `<div class="home-section-heading"><b>一起玩吧</b><small>点选伙伴</small></div>${people(w,'play-person',person?[person.id]:[])}<div class="home-actions home-play-actions">${btn(uiIcon('ball')+'接球','play',`data-kind="ball" data-person="${person?.id??0}"`,!person,true)}${btn(uiIcon('stack')+'叠叠乐','play',`data-kind="stack" data-person="${person?.id??0}"`,!person)}</div>`;
 }
 if(p.def==='table'){
  const ids=mealGuests(w,p),meals=Math.ceil(ids.length/2);
  return `<div class="home-section-heading"><b>今天一起吃饭</b><small>已选 ${ids.length}/${p.level*2} 位</small></div>${people(w,'meal-person',ids)}<div class="home-actions">${btn(uiIcon('food')+`一起用餐 · 便当 ${meals}`,'meal','',ids.length<2||ids.length>p.level*2||(w.stock.meal??0)<meals,true)}</div><small>${(w.stock.meal??0)<meals?'便当不足，可以在厨房制作。':'默认邀请空闲伙伴，点名字可调整。'}</small>`;
 }
 if(p.def==='memorial')return w.memorials.map(m=>`<article><b>${esc(m.title)}</b><p>${esc(m.text)}</p></article>`).join('')||'<p class="home-passive">一起生活的纪念，会珍藏在这里。</p>';
 if(p.def==='pollen')return breeding(w);
 if(['bed','greenhouse','seedbank','waterbed','pond','channel'].includes(p.def))return `<div class="home-actions">${btn(uiIcon('plants')+(p.def==='pollen'?'授粉育种':'选择种子'),'panel','data-panel="plants"',false,true)}${cmd(uiIcon('gather')+'收获',{type:'harvestAll'},!w.crops.some(c=>c.progress>=1&&w.cultivars.find(v=>v.id===c.cultivar)?.species!=='glowflower'))}</div><p class="home-passive">设施会自动照料周围的生长环境。</p>`;
 if(['house','spa'].includes(p.def))return `<div class="home-section-heading"><b>在家的伙伴</b><small>点选互动</small></div>${people(w,'resident')}`;
 if(['grove','stars'].includes(p.def))return `<p class="home-passive">家园会自动积累产物，也可以随时来看看可采集的物资。</p>${cmd(uiIcon('gather')+'采集物资',{type:'gather'},w.clock-w.lastGather<300)}`;
 if(['insects','observe','filter'].includes(p.def))return `<p class="home-passive">设施的生态效果已生效。</p>${btn(uiIcon('ecology')+'查看土地与访客','panel','data-panel="ecology"',false,true)}`;
 return `<p class="home-passive">${esc(DECORATIONS.find(d=>d.id===p.def)?.effect??'这件纪念装饰可以自由摆放。')}</p>`;
}
function objectHeader(w:World):string {
 const p=w.placements.find(p=>p.id===ui.selected);if(!p)return '';
 const d=BUILDINGS.find(b=>b.id===p.def)??DECORATIONS.find(b=>b.id===p.def),[a,b]=bounds(p);
 return `<div class="home-object-preview">${preview(p.def,formOf(p))}</div><div class="home-object-title"><h2>${esc(d?.name??'物件')} <span class="home-level">${'upgrades' in (d??{})&&!['expedition','resonance'].includes(p.def)?`${p.level} 级`:'装饰'}</span></h2><small>${esc(purpose[p.def]??'自由布置的小风景')} · ${a}×${b} 格</small></div>`;
}
function objectFooter(w:World):string {
 const p=w.placements.find(p=>p.id===ui.selected);if(!p)return '';
 const d=BUILDINGS.find(d=>d.id===p.def),form=formOf(p),unfold=form<p.level,canGrow=d&&!['expedition','resonance'].includes(p.def)&&(unfold||p.level<3);
 let upgrade='',note='';
 if(canGrow){
  const g=growth(w,p),items=unfold?{}:Object.fromEntries(Object.entries(d.cost).map(([k,v])=>[k,v*(p.level+1)])),missing=shortage(w,items);
  const unlocks=RECIPES.filter(r=>r.building===p.def&&r.level===p.level+1).map(r=>r.name).join('、');
  note=!g.placement?`需要 ${g.size[0]}×${g.size[1]} 空地，先移开周围物件或移动建筑。`:missing?`还缺 ${missing}`:`扩建为 ${g.size[0]}×${g.size[1]} 格${unfold?' · 免费展开':` · ${unlocks?`解锁${unlocks}`:p.level===1?'可安排 2 位伙伴帮忙':'更精致的新形态'}`}`;
  upgrade=`<div class="home-upgrade${!g.placement||missing?' unavailable':''}"><div class="home-next-form">${preview(p.def,form+1)}</div>${cmd(`<span><b>${unfold?'展开新形态':`升至 ${p.level+1} 级`}</b>${unfold?'<small>免费</small>':materialCost(w,items)}</span>`,{type:'upgrade',id:p.id},!g.placement||!!missing)}</div>`;
 }else upgrade=`<div class="home-max-level">${uiIcon(d?'spark':'leaf')}<span>${d&&!['expedition','resonance'].includes(p.def)?'已是最高等级':'装饰已摆好'}</span></div>`;
 return `<footer class="home-object-footer"><div class="home-object-actions">${upgrade}${btn(uiIcon('move')+'<span>移动</span>','move',`data-id="${p.id}"`)}${btn(uiIcon(ui.manage?'back':'more')+`<span>${ui.manage?'返回':'管理'}</span>`,'manage',`aria-pressed="${ui.manage}"`)}</div>${note?`<small class="home-upgrade-note" role="status">${esc(note)}</small>`:''}</footer>`;
}
function upgradePanel(w:World):string {
 const p=w.placements.find(p=>p.id===ui.selected);if(!p||formOf(p)>=3)return '<p>这座建筑已经是完整形态。</p>';
 const [a,b]=bounds(p),g=growth(w,p);
 return `<div class="home-form-comparison"><figure>${preview(p.def,formOf(p))}<figcaption>现在 · ${a}×${b} 格</figcaption></figure><span aria-hidden="true">→</span><figure>${preview(p.def,formOf(p)+1)}<figcaption>新形态 · ${g.size[0]}×${g.size[1]} 格</figcaption></figure></div>`;
}
function radialActions(w:World):string {
 const p=w.placements.find(p=>p.id===ui.selected);if(!p)return '';
 const d=BUILDINGS.find(b=>b.id===p.def)??DECORATIONS.find(b=>b.id===p.def),facility=BUILDINGS.some(b=>b.id===p.def)&&!['expedition','resonance'].includes(p.def);
 const primary=RECIPES.some(r=>r.building===p.def)?['craft','制作']:['toys','house','spa','table'].includes(p.def)?['heart',p.def==='toys'?'玩耍':p.def==='table'?'聚餐':'伙伴']:p.def==='trough'?['food','喂食']:['bed','greenhouse','seedbank','pollen','waterbed','pond','channel'].includes(p.def)?['plants',p.def==='pollen'?'育种':'种植']:['ecology','查看'];
 return `<nav class="home-orbit" aria-label="${esc(d?.name??'建筑')}操作">${btn(uiIcon(primary[0])+`<span>${primary[1]}</span>`,'use','data-orbit="top"',false,true)}${btn(uiIcon('spark')+`<span>${facility&&formOf(p)>=3?'满级':'升级'}</span>`,'upgrade-view','data-orbit="right"',!facility||formOf(p)>=3)}${btn(uiIcon('move')+'<span>移动</span>','move',`data-id="${p.id}" data-orbit="bottom"`)}${btn(uiIcon('more')+'<span>管理</span>','manage-open','data-orbit="left"')}<div class="home-selection-label"><b>${esc(d?.name??'物件')}</b><small>${facility?`${p.level} 级 · `:''}点按钮操作</small></div></nav><div class="home-selection-close">${btn(uiIcon('close')+'收起','close','aria-label="收起建筑操作"')}</div>`;
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
 return `${ui.more?`<nav class="home-more" aria-label="更多家园工具">${[['craft','制作总览'],['storage','仓库'],['ecology','生态']].map(([id,text])=>btn(label(id,text),'panel',`data-panel="${id}"`)).join('')}</nav>`:''}<nav class="home-tools" aria-label="家园工具">${btn(label('build','建造'),'panel','data-panel="build"')}${btn(label('plants','种植'),'panel','data-panel="plants"')}${cmd(label('gather',w.clock-w.lastGather>=300?'采集':`${Math.ceil((300-w.clock+w.lastGather)/60)}分`),{type:'gather'},w.clock-w.lastGather<300)}${btn(label('more','管理'),'more',`aria-expanded="${ui.more}" aria-label="更多家园工具"`)}</nav>`;
}
// 升级占地和按钮共用 growth 校验结果，让不能扩建的原因在地图上可见。
function growthPreview(w:World):string {
 const p=w.placements.find(p=>p.id===ui.selected);if(ui.panel!=='upgrade'||ui.tool||!p||p.stored||!BUILDINGS.some(d=>d.id===p.def)||['expedition','resonance'].includes(p.def)||formOf(p)>=3)return '';
 return growth(w,p).cells.map(c=>`<rect class="home-growth-cell${c.free?'':' blocked'}" x="${c.x*TILE+3}" y="${c.y*TILE+3}" width="42" height="42" rx="5"/>`).join('');
}
export function render(h:Host,dispatch:(c:GameCommand)=>boolean):string {
 host=h;issue=dispatch;const w=h.state().world!;
 const panels:Record<string,{title:string;body:()=>string}>={build:{title:'布置小家',body:()=>catalog(w)},plants:{title:'种子与育种',body:()=>plants(w)},craft:{title:'制作总览',body:()=>workshop(w)},object:{title:'建筑操作',body:()=>objectPanel(w)},upgrade:{title:'升级建筑',body:()=>upgradePanel(w)},crop:{title:'照料植物',body:()=>cropPanel(w)},slime:{title:'一起生活',body:()=>companionPanel(w)},storage:{title:'家园仓库',body:()=>storage(w)},ecology:{title:'土地与访客',body:()=>ecology(w)}};
 const objectPanelOpen=['object','upgrade'].includes(ui.panel),panel=panels[ui.panel],placing=ui.tool==='build'||ui.tool==='move',p=w.placements.find(p=>p.id===ui.selected),def=ui.tool==='move'?p?.def:ui.def;
 const toolName=ui.tool==='path'?(ui.pathStyle<0?'擦除路面':`铺设${PATH_STYLES[ui.pathStyle]}`):ui.tool==='plant'?'播种':(BUILDINGS.find(d=>d.id===def)??DECORATIONS.find(d=>d.id===def))?.name??'摆放';
 return `<section id="livingWorld" class="home-world ${w.reducedMotion?'reduced-motion':''} ${ui.tool?'home-editing':''} ${ui.panel==='actions'?'home-selecting':''}" aria-label="家园"><div class="home-scene">${scene(w,h,camera,ui.selected,ui.crop,ui.person,!!ui.tool,ui.overlay,growthPreview(w))}</div><div class="home-season"><b>家园</b><span>${SEASONS[season(w)]}季 · 第 ${day(w)+1} 日</span><span>${WEATHER[w.weather]} · ${night(w)?'夜晚':'白天'}</span></div>${stockHTML(w)}<div class="home-camera">${btn(uiIcon('plus'),'zoom','data-factor="1.25" aria-label="放大地图"')}${btn(uiIcon('minus'),'zoom','data-factor="0.8" aria-label="缩小地图"')}${btn(uiIcon('home'),'center','aria-label="回到小屋"')}</div>${ui.tool?`<div class="home-tool-hint">${placing?`<div class="home-tool-preview">${preview(def??'',p&&ui.tool==='move'?formOf(p):1)}</div>`:''}<div class="home-tool-copy"><b>${esc(toolName)}</b><span class="home-placement-status" role="status">${ui.tool==='path'?'按住拖动，连续铺设':ui.tool==='plant'?'点空地播种，可连续种植':'点空地放下，也可以按住拖动'}</span></div>${placing?btn(uiIcon('rotate')+'<span>旋转</span>','rotate'):''}${btn(uiIcon('close')+`<span>${placing?'取消':'完成'}</span>`,'cancel')}</div>`:''}${panel?`<aside class="home-panel ${objectPanelOpen?'home-object-panel':''} ${ui.panel==='build'?'home-build-panel':''}" aria-label="${panel.title}" ${ui.panel==='build'?`data-catalog="${ui.category}:${ui.group}"`:''}><header>${objectPanelOpen?objectHeader(w):`<h2>${panel.title}</h2>`}${ui.panel==='build'?`<div class="home-shelf-nav">${btn(uiIcon('left'),'shelf-scroll','data-dir="-1" aria-label="向左浏览建筑"')}${btn(uiIcon('right'),'shelf-scroll','data-dir="1" aria-label="向右浏览建筑"')}</div>`:''}${btn(uiIcon('close'),'close','aria-label="关闭面板"')}</header><div class="home-panel-body">${panel.body()}</div>${objectPanelOpen?objectFooter(w):''}</aside>`:''}${ui.panel==='actions'?radialActions(w):''}${toolsHTML(w)}</section>`;
}
const value=(id:string)=>(document.getElementById(id) as HTMLInputElement|HTMLSelectElement|null)?.value??'';
function inspect(id:number):void {
 ui.selected=id;ui.crop=0;ui.person=0;ui.panel='actions';ui.tool='';ui.more=false;ui.manage=false;ui.meal=null;ui.parents=null;focusedId=id;houseFocused=true;focusPending=true;redraw();
 const body=document.querySelector('.home-panel-body');if(body)body.scrollTop=0;
 document.querySelector<HTMLElement>('.home-orbit [data-lw="use"]')?.focus({preventScroll:true});
}
export function handleClick(event:Event):boolean {
 const target=(event.target as Element).closest<HTMLElement>('[data-lw]');if(!target||!target.closest('#livingWorld'))return false;event.preventDefault();lastInteraction=Date.now();
 if(target.matches(':disabled'))return true;
 const w=host.state().world!,ds=target.dataset;
 switch(ds.lw){
 case 'cmd':{const c=JSON.parse(ds.command!) as GameCommand,before=c.type==='upgrade'?w.placements.find(p=>p.id===c.id):undefined,form=before&&formOf(before);if(!issue(c))return true;
  // 形态真的变化了才播放一次长大动画；失败时存档不变，不播放。
  const after=before&&host.state().world!.placements.find(p=>p.id===before.id);if(after&&formOf(after)!==form)document.querySelector(`[data-home-object="${after.id}"]`)?.classList.add('grown');
  if(c.type==='store'){ui.panel='build';ui.category='stored';ui.selected=0;redraw();}return true;}
 case 'panel':ui.panel=ui.panel===ds.panel?'':ds.panel!;ui.tool='';ui.more=false;break;
 case 'more':ui.more=!ui.more;break;
 case 'close':ui.panel='';ui.selected=0;break;
 case 'use':ui.panel='object';ui.manage=false;break;
 case 'upgrade-view':ui.panel='upgrade';ui.manage=false;break;
 case 'manage-open':ui.panel='object';ui.manage=true;break;
 case 'shelf-scroll':{const shelf=document.querySelector('.home-build-panel .home-catalog');shelf?.scrollBy({left:Number(ds.dir)*shelf.clientWidth*.75,behavior:w.reducedMotion||matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});return true;}
 case 'category':ui.category=ds.category!;ui.group='all';break;
 case 'group':ui.group=ds.group!;break;
 case 'inspect':inspect(Number(ds.id));return true;
 case 'manage':ui.manage=!ui.manage;ui.panel='object';break;
 case 'family':ui.family=Number(ds.family);break;
 case 'build':ui.def=ds.def!;ui.tool='build';ui.rotation=0;ui.selected=0;ui.panel='';previewCell=null;houseFocused=false;break;
 case 'move':{ui.selected=Number(ds.id);const p=w.placements.find(p=>p.id===ui.selected);ui.rotation=p?.rotation??0;previewCell=p&&!p.stored?[p.x,p.y]:null;ui.tool='move';ui.panel='';houseFocused=false;break;}
 case 'plant':ui.cultivar=Number(ds.id);ui.tool='plant';ui.panel='';break;
 case 'path':ui.pathStyle=Number(ds.style);ui.tool='path';ui.panel='';break;
 case 'cancel':ui.tool='';previewCell=null;break;
 case 'rotate':ui.rotation=(ui.rotation+1)%4;break;
 case 'zoom':zoomAt(Number(ds.factor));return true;
 case 'center':center();return true;
 case 'overlay':ui.overlay=ds.overlay!;break;
 case 'rename':issue({type:'cultivar',id:Number(ds.id),name:value(`home-name-${ds.id}`)});return true;
 case 'parent':{const id=Number(ds.id);ui.parents??=[];ui.parents=ui.parents.includes(id)?ui.parents.filter(n=>n!==id):[...ui.parents.slice(-1),id];break;}
 case 'breed':issue({type:'breed',a:ui.parents?.[0]??0,b:ui.parents?.[1]??0});return true;
 case 'assign':issue({type:'assign',slime:Number(ds.person),building:Number(ds.id)});return true;
 case 'resident':ui.person=Number(ds.person);ui.selected=0;ui.panel='slime';break;
 case 'play-person':ui.person=Number(ds.person);break;
 case 'meal-person':{const p=w.placements.find(p=>p.id===ui.selected)!;ui.meal??=free(w).slice(0,p.level*2).map(s=>s.id);const id=Number(ds.person);if(ui.meal.includes(id))ui.meal=ui.meal.filter(n=>n!==id);else if(ui.meal.length<p.level*2)ui.meal.push(id);else host.toast(`这张餐桌可以邀请 ${p.level*2} 位伙伴`);break;}
 case 'meal':{const p=w.placements.find(p=>p.id===ui.selected)!;issue({type:'meal',ids:mealGuests(w,p)});return true;}
 case 'play':host.play?.(ds.kind!,Number(ds.person));return true;
 case 'detail':host.open?.(`detail:${ds.id}`);return true;
 }
 redraw();
 if(['category','group','manage','panel','family','use','upgrade-view','manage-open'].includes(ds.lw!)){const body=document.querySelector('.home-panel-body');if(body)body.scrollTop=0;}
 if(['build','move'].includes(ds.lw!))document.querySelector<SVGSVGElement>('.home-map')?.focus({preventScroll:true});
 return true;
}
function positionActions():void {
 const orbit=document.querySelector<HTMLElement>('.home-orbit'),world=document.querySelector<HTMLElement>('.home-world'),art=document.querySelector(`[data-home-object="${ui.selected}"] image`);
 if(!orbit||!world||!art||!viewport)return;
 const r=art.getBoundingClientRect(),base=world.getBoundingClientRect(),f=viewport.frame,width=Math.min(360,f.right-f.left),height=Math.min(330,f.bottom-f.top),x=(r.left+r.right)/2-base.left,y=(r.top+r.bottom)/2-base.top,landscape=matchMedia('(max-height:500px) and (orientation:landscape)').matches;
 orbit.style.width=`${width}px`;orbit.style.height=`${height}px`;orbit.style.left=`${x-width/2}px`;orbit.style.top=`${y-height/2}px`;
 orbit.style.setProperty('--home-label-top',`${Math.min(height-(landscape?38:100),height/2+r.height/2+5)}px`);
 // Hide the orbit while its building is panned off screen; selecting it fits the whole orbit again.
 orbit.style.visibility=x-width/2<0||x+width/2>base.width||y-height/2<0||y+height/2>base.height?'hidden':'visible';
}
function applyCamera():void {
 const svg=document.querySelector<SVGSVGElement>('.home-map');if(!svg)return;const rect=svg.getBoundingClientRect(),f=viewport?.frame;
 // 用圈内建筑区域约束镜头，地图边角也能留出整圈按钮的空间。
 const frame=f&&ui.panel==='actions'?{left:f.left+70,right:f.right-70,top:f.top+Math.min(70,(f.bottom-f.top)/4),bottom:f.bottom-Math.min(70,(f.bottom-f.top)/4)}:f;
 constrainCamera(camera,rect.width,rect.height,frame);svg.setAttribute('viewBox',`${camera.x} ${camera.y} ${rect.width/camera.zoom} ${rect.height/camera.zoom}`);positionActions();
}
function center(id=0):void {
 if(!viewport)return;const {width,height,frame}=viewport,placements=host.state().world!.placements,p=placements.find(p=>(id?p.id===id:p.def==='house')&&!p.stored)??placements.find(p=>p.def==='house'&&!p.stored),[a,b]=p?bounds(p):[2,2];
 // Include the roof, chimney and entrance when fitting the house into the clear area.
 const orbit=ui.panel==='actions';
 const orbitHeight=Math.min(330,frame.bottom-frame.top)-(matchMedia('(max-height:500px) and (orientation:landscape)').matches?50:170);
 camera.zoom=Math.min(preferredZoom,(orbit?Math.min(360,frame.right-frame.left)-140:frame.right-frame.left)/(a*TILE+24),(orbit?orbitHeight:frame.bottom-frame.top)/(b*TILE+TILE*2));
 constrainCamera(camera,width,height,frame);
 camera.x=((p?.x??6)+a/2)*TILE-(frame.left+frame.right)/2/camera.zoom;
 camera.y=((p?.y??6)+b/2)*TILE-TILE/2-(frame.top+frame.bottom)/2/camera.zoom;
 camera.ready=true;houseFocused=true;focusedId=id;applyCamera();updateObjects();
 if(ui.panel==='actions'){const image=document.querySelector(`[data-home-object="${p?.id}"] image`)?.getBoundingClientRect();if(image){camera.x+=((image.left+image.right)/2-(frame.left+frame.right)/2)/camera.zoom;camera.y+=((image.top+image.bottom)/2-(frame.top+frame.bottom)/2)/camera.zoom;applyCamera();}}
}
function zoomAt(factor:number,x?:number,y?:number):void {
 const svg=document.querySelector<SVGSVGElement>('.home-map');if(!svg)return;const r=svg.getBoundingClientRect(),f=viewport?.frame,px=x??(f?(f.left+f.right)/2:r.width/2),py=y??(f?(f.top+f.bottom)/2:r.height/2),wx=camera.x+px/camera.zoom,wy=camera.y+py/camera.zoom;houseFocused=false;camera.zoom*=factor;constrainCamera(camera,r.width,r.height,f);preferredZoom=camera.zoom;camera.x=wx-px/camera.zoom;camera.y=wy-py/camera.zoom;applyCamera();updateObjects();
}
let lastObjects=0;
function updateObjects():void {
 const svg=document.querySelector<SVGSVGElement>('.home-map'),group=svg?.querySelector('.home-objects');if(!group)return;
 const text=scene(host.state().world!,host,camera,ui.selected,ui.crop,ui.person,!!ui.tool,ui.overlay),doc=new DOMParser().parseFromString(text,'text/html'),next=doc.querySelector('.home-objects');
 if(next){
  // Camera fitting must not replace a building while its upgrade animation is running.
  const growing=new Map([...group.querySelectorAll<SVGElement>('.grown')].filter(el=>el.getAnimations().some(a=>a.playState==='running')).map(el=>[el.dataset.homeObject,el]));
  const nodes=[...next.children].map(el=>{const old=growing.get((el as SVGElement).dataset.homeObject);return old&&old.getAttribute('transform')===el.getAttribute('transform')?old:el;});
  group.replaceChildren(...nodes);
 }lastObjects=Date.now();positionActions();
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
  const error=placementError(w,p);if(error){host.toast(error);return;}const tool=ui.tool;
  if(issue(tool==='move'?{type:'move',id:p.id,zone:0,x,y,rotation:p.rotation}:{type:'build',def:p.def,zone:0,x,y,rotation:p.rotation})){previewCell=null;inspect(tool==='move'?p.id:host.state().world!.placements.at(-1)!.id);}return;
 }
 if(ui.tool==='plant'){issue({type:'plant',cultivar:ui.cultivar,zone:0,x,y,explicit:true});return;}
 const object=target.closest<SVGElement>('[data-home-object]'),crop=target.closest<SVGElement>('[data-home-crop]'),slime=target.closest<SVGElement>('[data-home-resident]');
 if(object){inspect(Number(object.dataset.homeObject));return;}else if(crop){ui.crop=Number(crop.dataset.homeCrop);ui.selected=0;ui.panel='crop';}else if(slime){ui.person=Number(slime.dataset.homeResident);ui.panel='slime';}else{ui.panel='';ui.selected=0;ui.crop=0;}redraw();
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
  const panel=world.querySelector('.home-object-panel')?.getBoundingClientRect();
  if(panel){if(panel.width>r.width*.6){frame.top=t.bottom-r.top+12;frame.bottom=panel.top-r.top-12;frame.right=r.width-12;}else{frame.left=12;frame.right=panel.left-r.left-12;frame.bottom=n.top-r.top-12;}}
  if(ui.panel==='actions'){
   const style=getComputedStyle(world),left=12+(parseFloat(style.paddingLeft)||0),right=r.width-12-(parseFloat(style.paddingRight)||0),width=Math.min(360,right-left),height=Math.min(330,n.top-t.bottom-24),cx=(left+right)/2,cy=(t.bottom+n.top)/2-r.top;
   frame.left=cx-width/2;frame.right=cx+width/2;frame.top=cy-height/2;frame.bottom=cy+height/2;
  }
  const previous=viewport,changed=!previous||previous.width!==r.width||previous.height!==r.height||Object.keys(frame).some(key=>frame[key as keyof CameraFrame]!==previous.frame[key as keyof CameraFrame]);
  const focus=previous?{x:camera.x+(previous.frame.left+previous.frame.right)/2/camera.zoom,y:camera.y+(previous.frame.top+previous.frame.bottom)/2/camera.zoom}:null;
  viewport={width:r.width,height:r.height,frame};
  if(!camera.ready||houseFocused&&(changed||focusPending)){focusPending=false;center(focusedId);return;}
  if(changed&&focus){constrainCamera(camera,r.width,r.height,frame);camera.x=focus.x-(frame.left+frame.right)/2/camera.zoom;camera.y=focus.y-(frame.top+frame.bottom)/2/camera.zoom;}
  applyCamera();if(changed)updateObjects();
 };
 const observer=new ResizeObserver(measureBars);for(const el of [top,nav,world,season,stock,tools,controls,world.querySelector('.home-object-panel')])if(el)observer.observe(el,{box:'border-box'});
 controller.signal.addEventListener('abort',()=>observer.disconnect(),{once:true});measureBars();
 const shelf=world.querySelector<HTMLElement>('.home-build-panel .home-catalog');
 if(shelf){
  let startX=0,scroll=0,dragging=false,pressed=false;
  shelf.addEventListener('pointerdown',e=>{lastInteraction=Date.now();if(e.pointerType!=='mouse'||e.button!==0)return;startX=e.clientX;scroll=shelf.scrollLeft;pressed=true;dragging=false;},opts);
  shelf.addEventListener('pointermove',e=>{if(!pressed)return;lastInteraction=Date.now();if(Math.abs(e.clientX-startX)>6){dragging=true;shelf.setPointerCapture(e.pointerId);}if(dragging){e.preventDefault();shelf.scrollLeft=scroll+startX-e.clientX;}},opts);
  shelf.addEventListener('scroll',()=>{lastInteraction=Date.now();},opts);
  shelf.addEventListener('pointerup',()=>{pressed=false;},opts);
  shelf.addEventListener('pointercancel',()=>{pressed=false;dragging=false;},opts);
  shelf.addEventListener('click',e=>{if(dragging){e.preventDefault();e.stopPropagation();dragging=false;}},{...opts,capture:true});
  shelf.addEventListener('dragstart',e=>e.preventDefault(),opts);
 }
 let start:{x:number;y:number;target:Element;pan:boolean}|null=null,moved=false,lastCell:[number,number]|null=null,stroke:Set<number>|null=null,erase=false;
 const position=(event:PointerEvent|WheelEvent)=>{const r=svg.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};};
 const clear=()=>{svg.querySelector('.home-preview')!.innerHTML='';};
 const drawCell=(x:number,y:number,valid=true)=>`<rect x="${x*TILE+1}" y="${y*TILE+1}" width="46" height="46" rx="4" fill="${valid?'#fff2b7':'#e77770'}" fill-opacity=".55" stroke="${valid?'#577545':'#a13636'}" stroke-width="2"/>`;
 const mark=(x:number,y:number)=>{if(!stroke||x<0||y<0||x>=HOME_WIDTH||y>=HOME_HEIGHT)return;stroke.add(y*HOME_WIDTH+x);};
 const walk=(x:number,y:number)=>{if(!lastCell)return;let [a,b]=lastCell;const tx=Math.max(0,Math.min(HOME_WIDTH-1,x)),ty=Math.max(0,Math.min(HOME_HEIGHT-1,y));while(a!==tx||b!==ty){if(Math.abs(tx-a)>=Math.abs(ty-b))a+=Math.sign(tx-a);else b+=Math.sign(ty-b);mark(a,b);}lastCell=[tx,ty];svg.querySelector('.home-preview')!.innerHTML=[...stroke!].map(n=>drawCell(n%HOME_WIDTH,Math.floor(n/HOME_WIDTH),!erase)).join('');};
 const previewAt=(x:number,y:number)=>{
  if(!['build','move','plant'].includes(ui.tool))return;const w=host.state().world!,p=w.placements.find(p=>p.id===ui.selected);
  if(ui.tool==='plant'){svg.querySelector('.home-preview')!.innerHTML=drawCell(x,y);return;}
  previewCell=[x,y];const next:Placement=ui.tool==='move'&&p?{...p,x,y,rotation:ui.rotation,stored:false}:{id:-1,def:ui.def,zone:0,x,y,rotation:ui.rotation,level:1,stored:false},[a,b]=bounds(next),error=placementError(w,next);
  svg.querySelector('.home-preview')!.innerHTML=Array.from({length:a*b},(_,n)=>drawCell(x+n%a,y+Math.floor(n/a),!error)).join('')+`<g class="home-placement-ghost" opacity=".78" transform="translate(${x*TILE} ${y*TILE+10})">${objectArt(next,night(w))}</g>`;
  const status=world.querySelector('.home-placement-status');if(status){status.textContent=error??`${a}×${b} 格 · 点空地放下，按住可拖动`;status.classList.toggle('invalid',!!error);}
 };
 if(['build','move'].includes(ui.tool)){const f=viewport!.frame;previewAt(...(previewCell??screenToCell(camera,(f.left+f.right)/2,(f.top+f.bottom)/2)));}
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
  if(['build','move'].includes(ui.tool)&&!start.pan){previewAt(...screenToCell(camera,p.x,p.y));return;}
  if(moved){houseFocused=false;camera.x-=(p.x-old.x)/camera.zoom;camera.y-=(p.y-old.y)/camera.zoom;applyCamera();if(Date.now()-lastObjects>140)updateObjects();}
 },opts);
 svg.addEventListener('pointerup',e=>{
  lastInteraction=Date.now();pointers.delete(e.pointerId);if(pointers.size){start=null;stroke=null;return;}const p=position(e);
  if(stroke){const cells=[...stroke];stroke=null;start=null;clear();if(cells.length)issue({type:'paint',zone:0,cells,style:Math.max(0,ui.pathStyle),erase});return;}
  if(start&&(!moved&&!start.pan||['build','move'].includes(ui.tool)&&!start.pan))selectAt(start.target,...screenToCell(camera,p.x,p.y));else updateObjects();start=null;if(!['build','move'].includes(ui.tool))clear();
 },opts);
 svg.addEventListener('pointercancel',()=>{pointers.clear();start=null;stroke=null;lastCell=null;clear();},opts);
 svg.addEventListener('wheel',e=>{e.preventDefault();lastInteraction=Date.now();const p=position(e);zoomAt(Math.exp(-e.deltaY*.0015),p.x,p.y);},{...opts,passive:false});
 world.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();ui.tool='';ui.panel='';ui.more=false;previewCell=null;redraw();document.querySelector<SVGElement>(`[data-home-object="${ui.selected}"]`)?.focus({preventScroll:true});}},opts);
 svg.setAttribute('tabindex','0');
 svg.addEventListener('keydown',e=>{
  if(['build','move'].includes(ui.tool)&&previewCell){
   const moves:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
   if(moves[e.key]){e.preventDefault();const [dx,dy]=moves[e.key];previewAt(Math.max(0,Math.min(HOME_WIDTH-1,previewCell[0]+dx)),Math.max(0,Math.min(HOME_HEIGHT-1,previewCell[1]+dy)));}
   if(e.key==='Enter'||e.key===' '){e.preventDefault();selectAt(svg,...previewCell);}return;
  }
  if(e.key==='Enter'||e.key===' '){const target=e.target as Element;if(target.closest('[data-home-object],[data-home-crop],[data-home-resident]')){e.preventDefault();selectAt(target,0,0);document.querySelector<HTMLElement>('.home-orbit [data-lw]:not(:disabled),.home-panel [data-lw]:not(:disabled)')?.focus({preventScroll:true});}}
 },opts);
 window.addEventListener('resize',measureBars,opts);
 window.visualViewport?.addEventListener('resize',measureBars,opts);
}
