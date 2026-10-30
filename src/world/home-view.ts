import type {World,Host,GameCommand,Placement} from './types.ts';
import {BUILDINGS,DECORATIONS,PLANTS,RECIPES,VISITORS,MATERIALS,PATH_STYLES,FAMILIES,TECHS,BRANCHES,TIER_LEVEL,PROSPERITY,VALUES,ZONES,AFFINITY,BIOME_BONUS,DECOR_LEVEL} from './content.ts';
import {afford,placementError,growth,yieldOf} from './engine.ts';
import {activity,resident,workerPresent} from './life.ts';
import {ordersLeft} from './estate.ts';
import {estate,homeLevel,prosperity,techProblem,researchQueue,researchSpeed,buildingOpen,familyOpen,recipeOpen,decorLevel,techFor,slots,workerCap,affine,biomeBonus,bufferHours,bridgeCap,marketCap,clearing,feature,craftQueue} from './estate.ts';
import {PLOT,PLOT_COUNT,plotOrigin,biomeAt} from './map.ts';
import {bounds,formOf,environment,season,day,night,dayPhase,springThaw,DAY_PHASES,SEASONS,WEATHER} from './ecology.ts';
import {scene,preview,objectArt} from './home-art.ts';
import {artIcon,pathPreview,plantPreview,hasArtIcon} from './art/storybook.ts';
import {uiIcon} from './art/ui-icons.ts';
import {esc} from './art.ts';
import {HOME_WIDTH,HOME_HEIGHT,TILE,constrainCamera,screenToCell,type Camera,type CameraFrame} from './map.ts';

const camera:Camera={x:0,y:0,zoom:typeof innerWidth==='number'&&innerWidth>760?1.45:1.1,ready:false};
let viewport:{width:number;height:number;frame:CameraFrame}|null=null,houseFocused=true,focusedId=0,focusPending=false,preferredZoom=camera.zoom;
const ui={panel:'',category:'facilities',group:'all',family:0,selected:0,crop:0,person:0,tool:'',def:'',cultivar:0,rotation:0,pathStyle:0,overlay:'',more:false,manage:false,meal:null as number[]|null,parents:null as number[]|null,branch:0,focusTech:'',plot:-1,estateTab:'orders'};
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
const cmd=(text:string,c:GameCommand,disabled=false)=>btn(text,'cmd',`data-command="${esc(JSON.stringify(c))}"`,disabled,['upgrade','refill','craft','claimCraft','claimOverflow','harvest','harvestAll','research','clear','collect','collectAll','order'].includes(c.type));
const name=(w:World,key:string)=>key.startsWith('seed:')?`${w.cultivars.find(v=>v.id===Number(key.slice(5)))?.name??'植物'}种子`:MATERIALS[key]??key;
const cost=(w:World,items:Record<string,number>)=>Object.entries(items).map(([k,n])=>`${esc(name(w,k))} ${Math.round(n*100)/100}`).join(' · ');
const materialCost=(w:World,items:Record<string,number>)=>`<span class="home-material-cost">${Object.entries(items).map(([k,n])=>`<span title="${esc(name(w,k))}" aria-label="${esc(name(w,k))} ${n}">${hasArtIcon(k)?artIcon(k):esc(name(w,k))}<b>${n}</b></span>`).join('')}</span>`;
const itemIcon=(w:World,k:string)=>hasArtIcon(k)?artIcon(k):`<span class="home-item-word">${esc(name(w,k).slice(0,1))}</span>`;
const duration=(s:number)=>s<60?`${Math.max(1,Math.ceil(s))} 秒`:s<3600?`${Math.ceil(s/60)} 分钟`:`${(s/3600).toFixed(s<36000?1:0)} 小时`;
const techName=(id:string)=>TECHS.find(t=>t.id===id)?.name??id;
const free=(w:World)=>host.state().slimes.filter(s=>host.available(s.id)&&activity(w,s.id).kind==='home');
const mealGuests=(w:World,p:Placement)=>{const list=free(w);return (ui.meal??list.slice(0,p.level*2).map(s=>s.id)).filter(id=>list.some(s=>s.id===id));};
const purpose:Record<string,string>={house:'伙伴休息的小家',kitchen:'烹饪饲料与料理',table:'邀请伙伴一起吃饭',spa:'让伙伴舒舒服服休息',bed:'照料植物与补水',greenhouse:'调节植物生长环境',pollen:'授粉，培育新品系',seedbank:'收藏种子与复制留种',grove:'生产木材，提供树荫',compost:'制作肥料与沃土',insects:'吸引生态访客',observe:'观察家园里的访客',channel:'生产露水，灌溉植物',pond:'养育水生植物',filter:'改善附近水质',waterbed:'种植水生植物',woodshop:'制作木板与纪念物',alchemy:'炼制染料与药剂',training:'驻场伙伴练习，获得经验',archive:'研究科技，整理研究笔记',quarry:'开采石材',mine:'挖掘矿石与星尘',apiary:'酿造蜂蜜',spring:'伙伴驻场涌出元素精华',warehouse:'延长建筑暂存时间',market:'多余材料换晶币',stars:'收集夜空中的星尘',memorial:'珍藏伙伴的共同回忆',trough:'为伙伴补充饲料',toys:'一起接球、叠叠乐'};
const buildingGroups=[{id:'all',name:'全部',defs:[]},{id:'resource',name:'资源',defs:['grove','quarry','mine','apiary','spring','channel','stars','warehouse','market']},{id:'life',name:'生活',defs:['house','kitchen','table','spa','trough','toys','memorial','training']},{id:'plants',name:'种植',defs:['bed','greenhouse','pollen','seedbank','channel','pond','waterbed']},{id:'craft',name:'加工',defs:['compost','woodshop','alchemy','archive']},{id:'nature',name:'生态',defs:['insects','observe','filter']}];
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
   const tech=BUILDINGS.some(b=>b.id===d.id)&&!owned&&!buildingOpen(w,d.id)?techFor('building',d.id):undefined,decorNeed=!BUILDINGS.some(b=>b.id===d.id)&&homeLevel(w)<decorLevel(d.id)?decorLevel(d.id):0;
   if(tech)return btn(`${preview(d.id,1)}<b>${esc(d.name)}</b><span class="home-catalog-use">${esc(purpose[d.id]??'')}</span><small><span class="home-locked-note">${uiIcon('research')}研究「${esc(tech.name)}」</span></small>`,'tech-node',`data-tech="${tech.id}" data-def="${d.id}" data-locked="true"`);
   if(decorNeed)return btn(`${preview(d.id,1)}<b>${esc(d.name)}</b><span class="home-catalog-use">${esc('effect' in d?d.effect:'')}</span><small><span class="home-locked-note">${uiIcon('flag')}家园 ${decorNeed} 级开放</span></small>`,'panel',`data-panel="estate" data-tab="level" data-def="${d.id}" data-locked="true"`);
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
 return `<div class="home-actions home-garden-actions">${cmd(`收获${harvest?` · ${harvest} 株`:''}`,{type:'harvestAll'},!harvest)}${cmd(`补水${thirsty?` · 露水 ${thirsty}`:''}`,{type:'careAll'},!thirsty||(w.stock.dew??0)<thirsty)}</div><nav class="home-segments">${FAMILIES.map((f,i)=>btn((familyOpen(w,i)?'':uiIcon('lock'))+esc(f),'family',`data-family="${i}" aria-pressed="${ui.family===i}"`)).join('')}</nav>${familyOpen(w,ui.family)?'':`<div class="home-locked-family"><p>研究「${esc(techFor('family',ui.family)?.name??'')}」后可以种植${esc(FAMILIES[ui.family])}。</p>${btn(uiIcon('research')+'去研究','tech-node',`data-tech="${techFor('family',ui.family)?.id??''}"`,false,true)}</div>`}<div class="home-plant-list">${cultivars.map(c=>`<article><div class="home-plant-heading">${plantPreview(PLANTS.find(p=>p.id===c.species)!,c.genes.color,c.genes.form)}<div><b>${esc(c.name)}</b><small>${c.seeds} 颗种子${c.protected?' · 已收藏':''}</small></div></div>${btn('播种','plant',`data-id="${c.id}"`,c.seeds<1||!familyOpen(w,ui.family),true)}<details><summary>留种与管理</summary><div class="home-actions">${cmd(`复制 · 露水 ${cloneCost}`,{type:'clone',id:c.id},!seedbank||(w.stock.dew??0)<cloneCost)}${cmd(c.protected?'取消收藏':'收藏',{type:'cultivar',id:c.id,protect:!c.protected})}</div>${!seedbank?'<small>建好种子库后可以复制留种。</small>':''}<small>亲本：${esc(c.parents.join('、')||'原生品系')} · 产量 ${c.genes.yield} · 适应 ${c.genes.adapt}</small><input aria-label="品系名称" maxlength="24" id="home-name-${c.id}" value="${esc(c.name)}">${btn('保存名称','rename',`data-id="${c.id}"`)}</details></article>`).join('')||'<p>通过同类植物授粉，可以育成新的品系。</p>'}</div><details class="home-section"><summary>授粉育种</summary>${breeding(w)}</details>`;
}
function workshop(w:World,p?:Placement):string {
 const queue=w.crafts.filter(c=>!p||c.building===p.id);
 const tasks=queue.map(c=>`<div class="home-row home-craft-task"><span><b>${esc(RECIPES.find(r=>r.id===c.recipe)?.name??c.recipe)}</b><small>${c.ready?'已做好，领取即可使用':`${Math.ceil(c.remaining/60)} 分钟后完成`}</small></span>${cmd('领取',{type:'claimCraft',id:c.id},!c.ready)}</div>`).join('');
 if(!p)return `${tasks?`<h3>制作队列</h3>${tasks}`:'<p>点一座设施，就能查看它的配方。</p>'}<div class="home-catalog">${w.placements.filter(b=>!b.stored&&RECIPES.some(r=>r.building===b.def)).map(b=>btn(`${preview(b.def,formOf(b))}<b>${esc(BUILDINGS.find(d=>d.id===b.def)!.name)}</b><small>${w.crafts.filter(c=>c.building===b.id).length} 项制作中</small>`,'inspect',`data-id="${b.id}"`)).join('')||'<p>建一间厨房或工坊，开始制作家园物资。</p>'}</div>${btn(uiIcon('build')+'建造设施','panel','data-panel="build"')}`;
 const recipes=RECIPES.filter(r=>r.building===p.def),open=recipes.filter(r=>r.level<=p.level&&recipeOpen(w,r)),locked=recipes.filter(r=>!open.includes(r)),size=craftQueue(w,p),full=queue.length>=size,made=estate(w).daily.made;
 return `${tasks}<div class="home-section-heading"><b>做点什么</b><small>队列 ${queue.length}/${size}</small></div><div class="home-recipes">${open.map(r=>{
  // 桥接物品（捕捉网、经验药水、天材地宝）每 12 小时有上限，卡片上直接写明本轮用量。
  const bridge=Object.keys(r.output).find(k=>bridgeCap(w,k)!==Infinity),capped=bridge&&(made[bridge]??0)+r.output[bridge]>bridgeCap(w,bridge);
  const missing=shortage(w,r.cost),why=full?'队列已满':capped?'本轮已满':missing?`缺 ${missing}`:'';
  return `<article class="home-recipe${bridge?' home-bridge':''}"><div><b>${esc(r.name)}</b><small>${cost(w,r.output)} · ${duration(r.seconds)}${bridge?` · 进背包 · 本轮 ${made[bridge]??0}/${bridgeCap(w,bridge)}`:''}</small><small>${cost(w,r.cost)}</small></div>${cmd(why?esc(why):'制作',{type:'craft',recipe:r.id,building:p.id},!!why)}</article>`;
 }).join('')}</div>${locked.length?`<p class="home-unlock">${uiIcon('lock')}${locked.map(r=>r.tech&&!recipeOpen(w,r)?`研究「${esc(techName(r.tech))}」：${esc(r.name)}`:`${r.level} 级：${esc(r.name)}`).join(' · ')}</p>`:''}`;
}
function people(w:World,action:string,selected:number[]=[],disabled=false,def=''):string {
 const list=free(w).sort((a,b)=>Number(affine(b,def))-Number(affine(a,def)));
 return `<div class="home-people">${list.map(s=>btn(`<span class="home-portrait" aria-hidden="true">${host.slimeHTML(s)}</span><span>${esc(s.name)}${def?`<small>${esc(s.element)}${affine(s,def)?' · 对口':''}</small>`:''}</span>${affine(s,def)?'<span class="home-affinity" aria-label="元素对口">★</span>':''}`,action,`data-person="${s.id}" data-id="${ui.selected}"${['play-person','meal-person'].includes(action)?` aria-pressed="${selected.includes(s.id)}"`:''}`,disabled)).join('')||'<p>空闲伙伴回来后，就能一起活动。</p>'}</div>`;
}
function buildingManagement(w:World,p:Placement):string {
 const workers=w.workers.filter(j=>j.building===p.id),capacity=slots(w,p),facility=BUILDINGS.some(b=>b.id===p.def)&&!['expedition','resonance'].includes(p.def),busy=w.crafts.some(c=>c.building===p.id);
 return `${facility?`<div class="home-section-heading"><b>伙伴帮忙</b><small>${workers.length}/${capacity} 位</small></div>${workers.map(j=>`<div class="home-row"><span>${esc(host.state().slimes.find(s=>s.id===j.slimeId)?.name??'伙伴')}<small>正在这里帮忙</small></span>${cmd('休息',{type:'unassign',slime:j.slimeId})}</div>`).join('')}<p>${workers.length>=capacity?'工作位已满，可以先让伙伴休息。':w.workers.length>=workerCap(w)?`全家园已有 ${w.workers.length}/${workerCap(w)} 位伙伴驻场，提升家园等级可以增加。`:`点一位空闲伙伴开始帮忙。${affinityText(p.def)}`}</p>${people(w,'assign',[],workers.length>=capacity||w.workers.length>=workerCap(w),p.def)}`:''}<div class="home-section">${cmd(uiIcon('storage')+'收纳物件',{type:'store',id:p.id},busy)}<small>${busy?'完成并领取制作后可以收纳。':'放回建造栏的「收纳」，等级和形态都会保留。'}</small></div>`;
}
const affinityText=(def:string,short=false)=>{const els=Object.entries(AFFINITY).filter(([,defs])=>defs.includes(def)).map(([el])=>el);return els.length?short?`${els.join('、')}元素伙伴对口`:`${els.join('、')}元素伙伴对口，带 ★。`:'';};
/* 产出区块：每 5 分钟的产量、暂存的产物、地形与元素加成。数字都来自引擎的 yieldOf，界面不另算一遍。 */
function production(w:World,p:Placement):string {
 const service=BUILDINGS.find(b=>b.id===p.def)?.service??'',slimes=host.state().slimes,out=yieldOf(w,p,slimes),bag=estate(w).yields[p.id]??{},stored=Object.entries(bag).filter(([,n])=>n>0);
 const crew=w.workers.filter(j=>j.building===p.id&&workerPresent(w,j.slimeId,p.id)).length;
 if(service==='training')return `<p class="home-passive">驻场伙伴每 5 分钟获得 ${6*p.level} 经验，${affinityText(p.def)||''}对口伙伴翻倍。</p>`;
 if(service==='archive')return `<p class="home-passive">研究速度 ×${researchSpeed(w,slimes,(id,b)=>workerPresent(w,id,b)).toFixed(2)}。${crew?`伙伴每 10 分钟整理出 ${p.level} 份研究笔记。`:'安排伙伴驻场后，会持续整理研究笔记。'}</p>${btn(uiIcon('research')+'打开研究','panel','data-panel="tech"',false,true)}`;
 if(!['wood','quarry','water','stars','ore','honey','essence'].includes(service))return '';
 const biome=biomeAt(w,p.x,p.y),best=BIOME_BONUS[p.def],auto=feature(w,'auto');
 const notes=[best===undefined?'':biomeBonus(w,p)?`位于${ZONES[biome].name} · 产出 +25%`:`放在${ZONES[best].name}可 +25%`,affinityText(p.def,true),auto?'产出自动入库':`最多暂存 ${bufferHours(w)} 小时`].filter(Boolean);
 return `<div class="home-section-heading"><b>产出</b><small>${Object.keys(out).length?`每 5 分钟 ${esc(cost(w,out))}`:service==='essence'?'需要伙伴驻场':'暂停'}</small></div>${auto?'':`<div class="home-yield">${stored.map(([k,n])=>`<span>${itemIcon(w,k)}<b>${Math.floor(n)}</b><small>${esc(name(w,k))}</small></span>`).join('')||'<small>产出会先存放在这里，地图上冒出气泡时点一下就能收取。</small>'}${stored.length?cmd(uiIcon('gather')+'收取',{type:'collect',id:p.id}):''}</div>`}<small class="home-notes">${notes.map(esc).join(' · ')}</small>`;
}
function market(w:World):string {
 const e=estate(w),cap=marketCap(w),left=Math.max(0,cap-e.daily.sold),items=Object.keys(VALUES).filter(k=>Math.floor(w.stock[k]??0)>0);
 return `<div class="home-section-heading"><b>本轮还能换</b><span>${uiIcon('coin')} ${left} 晶币</span></div><progress value="${e.daily.sold}" max="${cap}"></progress><small>每 12 小时刷新；集市升级后额度更高。</small><div class="home-market">${items.map(k=>{
  const have=Math.floor(w.stock[k]??0),price=VALUES[k],max=Math.min(have,Math.floor(left/price)),some=Math.min(10,max);
  return `<div class="home-row"><span class="home-market-item">${itemIcon(w,k)}<span><b>${esc(name(w,k))}</b><small>库存 ${have} · 每份 ${price} 晶币</small></span></span><span class="home-market-actions">${cmd(`卖 ${some}`,{type:'sell',item:k,amount:Math.max(1,some)},some<1)}${cmd(`全部 ${max}`,{type:'sell',item:k,amount:Math.max(1,max)},max<1)}</span></div>`;
 }).join('')||'<p>仓库里还没有可以出售的材料。</p>'}</div>`;
}
function techCard(w:World,t:typeof TECHS[number]):string {
 const e=estate(w),done=e.tech.includes(t.id),running=e.research.some(r=>r.id===t.id),problem=done||running?'':techProblem(w,t),missing=shortage(w,t.cost),full=e.research.length>=researchQueue(w);
 const state=done?'done':running?'running':problem?'blocked':'ready',why=problem||(missing?`缺 ${missing}`:full?'研究队列已满':'');
 return `<article class="home-tech ${state}${ui.focusTech===t.id?' focus':''}" id="tech-${t.id}"><header>${artIcon('branch-'+t.branch)}<b>${esc(t.name)}</b>${done?`<span class="home-tech-badge">${uiIcon('spark')}已完成</span>`:''}</header><p>${esc(t.desc)}</p>${t.requires.length&&!done?`<small>前置：${t.requires.map(r=>`${e.tech.includes(r)?'✓':'·'}${esc(techName(r))}`).join(' ')}</small>`:''}${done?'':running?'<small class="home-tech-running">研究中…</small>':`<div class="home-tech-cost">${materialCost(w,t.cost)}<small>${duration(t.seconds)}</small></div>${cmd(why?esc(why):'开始研究',{type:'research',id:t.id},!!why)}`}</article>`;
}
function techPanel(w:World):string {
 const e=estate(w),lv=homeLevel(w),slimes=host.state().slimes,speed=researchSpeed(w,slimes,(id,b)=>workerPresent(w,id,b)),size=researchQueue(w);
 const queue=e.research.map((r,i)=>{const t=TECHS.find(t=>t.id===r.id)!;return `<div class="home-research">${artIcon('branch-'+t.branch)}<div><b>${esc(t.name)}</b><progress value="${t.seconds-r.remaining}" max="${t.seconds}"></progress><small>${i<size?`约 ${duration(r.remaining/speed)} 后完成`:'排队中'}</small></div>${cmd('取消',{type:'cancelResearch',id:t.id})}</div>`;}).join('');
 const branches=BRANCHES.map((b,i)=>{const all=TECHS.filter(t=>t.branch===i);return btn(`${artIcon('branch-'+i)}<span>${esc(b)}<small>${all.filter(t=>e.tech.includes(t.id)).length}/${all.length}</small></span>`,'branch',`data-branch="${i}" aria-pressed="${ui.branch===i}"`);}).join('');
 const tiers=[1,2,3,4].map(tier=>{const nodes=TECHS.filter(t=>t.branch===ui.branch&&t.tier===tier),open=lv>=TIER_LEVEL[tier];return `<section class="home-tier${open?'':' locked'}"><h3>第 ${tier} 层<small>${open?'已开放':`家园 ${TIER_LEVEL[tier]} 级开放`}</small></h3>${nodes.map(t=>techCard(w,t)).join('')}</section>`;}).join('');
 return `<div class="home-research-queue">${queue||`<p class="home-passive">${uiIcon('research')} 选一项开始研究，需要研究笔记和材料。研究在离线时也会继续。</p>`}<small>研究队列 ${e.research.length}/${size} · 速度 ×${speed.toFixed(2)} · 研究笔记 ${Math.floor(w.stock.notes??0)}</small></div><nav class="home-branches" aria-label="科技分支">${branches}</nav><div class="home-tiers">${tiers}</div>`;
}
function ordersPanel(w:World):string {
 const e=estate(w),slimes=host.state().slimes,wait=Math.ceil(Math.max(e.nextOrder,w.clock)/300)*300-w.clock,left=ordersLeft(w);
 return `<p>伙伴们的小请求。交付后获得晶币、积分和研究笔记，做不了的可以撤下换一份。</p><small>本轮已完成 ${e.daily.orders}/${e.daily.orders+left} 份，每 12 小时刷新。</small><div class="home-orders">${e.orders.map(o=>{
  const s=slimes.find(x=>x.id===o.slime),[item,n]=Object.entries(o.need)[0],have=Math.floor(w.stock[item]??0);
  return `<article class="home-order">${s?`<span class="home-portrait" aria-hidden="true">${host.slimeHTML(s)}</span>`:`<span class="home-order-home">${artIcon('home')}</span>`}<div class="home-order-copy"><b>${esc(s?.name??'家园')}想要</b><span class="home-order-need">${itemIcon(w,item)}${esc(name(w,item))} ×${n}<small>库存 ${have}</small></span><small class="home-order-reward">${uiIcon('coin')} ${o.coins} · 积分 ${o.points} · 笔记 ${o.notes}</small></div><div class="home-order-actions">${cmd(!left?'本轮已满':have>=n?'交付':`缺 ${n-have}`,{type:'order',id:o.id},have<n||!left)}${btn(uiIcon('close'),'cmd',`data-command="${esc(JSON.stringify({type:'dismissOrder',id:o.id}))}" aria-label="撤下委托"`)}</div></article>`;
 }).join('')||`<p>${left?'新的委托正在路上。':'本轮的委托都完成了，下一轮再来看看。'}</p>`}</div>${e.orders.length<3&&left>e.orders.length?`<small>下一份委托约 ${duration(Math.max(60,wait))} 后到达。</small>`:''}`;
}
function levelPanel(w:World):string {
 const lv=homeLevel(w),{score,parts}=prosperity(w),from=PROSPERITY[lv-1]??0,to=PROSPERITY[lv],e=estate(w);
 const next=to===undefined?[]:[...[1,2,3,4].filter(t=>TIER_LEVEL[t]===lv+1).map(t=>`第 ${t} 层科技`),...DECOR_LEVEL.map((l,g)=>l===lv+1&&g?`${['','围栏','灯具','休闲','花架','标识','生态','纪念'][g]}装饰`:'').filter(Boolean),`驻场上限 ${workerCap(w)+1} 位`,'更多可开垦林地'];
 return `<div class="home-level-card">${artIcon('prosperity')}<div><b>家园 ${lv} 级</b><small>繁荣度 ${score}${to===undefined?' · 已达最高等级':` / ${to}`}</small><progress value="${to===undefined?1:score-from}" max="${to===undefined?1:to-from}"></progress></div></div><div class="home-parts">${parts.map(p=>`<span><small>${esc(p.label)}</small><b>${p.value}</b></span>`).join('')}</div>${next.length?`<h3>${lv+1} 级开放</h3><p>${next.map(esc).join(' · ')}</p>`:''}<h3>提升繁荣度</h3><p>升级设施、摆放装饰（同组三件挨在一起有套装加成）、迎来新访客、育成杂交品种、开垦林地。</p><small>已开垦 ${e.plots.length}/${PLOT_COUNT} 块林地 · 驻场 ${w.workers.length}/${workerCap(w)} 位</small>`;
}
function estatePanel(w:World):string {
 return `<nav class="home-segments">${[['orders','委托'],['level','家园等级']].map(([id,text])=>btn(text,'estate-tab',`data-tab="${id}" aria-pressed="${ui.estateTab===id}"`)).join('')}</nav>${ui.estateTab==='level'?levelPanel(w):ordersPanel(w)}`;
}
function plotPanel(w:World):string {
 if(ui.plot<0)return '<p>点地图上林地边的路牌，选择要开垦的地块。</p>';
 const c=clearing(w,ui.plot),[x,y]=plotOrigin(ui.plot),biome=biomeAt(w,x,y),fits=Object.entries(BIOME_BONUS).filter(([,b])=>b===biome).map(([d])=>BUILDINGS.find(b=>b.id===d)?.name).filter(Boolean),missing=shortage(w,c.cost);
 return `<div class="home-plot-card">${artIcon('clearing')}<div><b>${esc(ZONES[biome].name)}的林地</b><small>6×6 格 · 开垦后可以建造、种植和铺路</small></div></div>${fits.length?`<p>这里的地形适合${fits.map(n=>esc(n!)).join('、')}，产出 +25%。</p>`:''}<div class="home-section-heading"><b>开垦需要</b>${materialCost(w,c.cost)}</div><small>砍下的树木返还木材 ${c.refund.wood}${c.level>1?` · 需要家园 ${c.level} 级`:''}</small><div class="home-actions">${cmd(uiIcon('axe')+(c.problem?esc(c.problem):missing?`缺 ${esc(missing)}`:'开垦这片林地'),{type:'clear',plot:ui.plot},!!c.problem||!!missing)}</div>`;
}
function objectPanel(w:World):string {
 const p=w.placements.find(p=>p.id===ui.selected);if(!p)return '<p>点一下地图上的建筑或装饰。</p>';
 if(ui.manage)return buildingManagement(w,p);
 if(p.def==='market')return market(w);
 if(p.def==='warehouse')return `<p class="home-passive">每座建筑最多暂存 ${bufferHours(w)} 小时的产出${feature(w,'auto')?'；已研究自动入库，产出直接进仓库':''}。仓库每升一级多存 2 小时。</p>${cmd(uiIcon('gather')+'收取全部产出',{type:'collectAll'},!Object.keys(estate(w).yields).length)}${btn(uiIcon('storage')+'查看仓库','panel','data-panel="storage"')}`;
 if(RECIPES.some(r=>r.building===p.def))return production(w,p)+workshop(w,p);
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
 if(['bed','greenhouse','seedbank','waterbed','pond','channel'].includes(p.def))return `${production(w,p)}<div class="home-actions">${btn(uiIcon('plants')+(p.def==='pollen'?'授粉育种':'选择种子'),'panel','data-panel="plants"',false,true)}${cmd(uiIcon('gather')+'收获',{type:'harvestAll'},!w.crops.some(c=>c.progress>=1&&w.cultivars.find(v=>v.id===c.cultivar)?.species!=='glowflower'))}</div><p class="home-passive">设施会自动照料周围的生长环境。</p>`;
 if(['house','spa'].includes(p.def))return `<div class="home-section-heading"><b>在家的伙伴</b><small>点选互动</small></div>${people(w,'resident')}`;
 if(['grove','stars','quarry','mine','apiary','spring'].includes(p.def))return `${production(w,p)}${btn(uiIcon('more')+'安排伙伴驻场','manage','')}`;
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
 const bag=estate(w).yields[p.id];
 const primary=bag&&Object.keys(bag).length?['gather','收取']:p.def==='market'?['coin','集市']:['grove','stars','quarry','mine','apiary','spring','warehouse'].includes(p.def)?['gather','产出']:RECIPES.some(r=>r.building===p.def)?['craft','制作']:['toys','house','spa','table'].includes(p.def)?['heart',p.def==='toys'?'玩耍':p.def==='table'?'聚餐':'伙伴']:p.def==='trough'?['food','喂食']:['bed','greenhouse','seedbank','pollen','waterbed','pond','channel'].includes(p.def)?['plants',p.def==='pollen'?'育种':'种植']:['ecology','查看'];
 const top=primary[1]==='收取'?btn(uiIcon('gather')+'<span>收取</span>','cmd',`data-command="${esc(JSON.stringify({type:'collect',id:p.id}))}" data-orbit="top"`,false,true):btn(uiIcon(primary[0])+`<span>${primary[1]}</span>`,'use','data-orbit="top"',false,true);
 return `<nav class="home-orbit" aria-label="${esc(d?.name??'建筑')}操作">${top}${btn(uiIcon('spark')+`<span>${facility&&formOf(p)>=3?'满级':'升级'}</span>`,'upgrade-view','data-orbit="right"',!facility||formOf(p)>=3)}${btn(uiIcon('move')+'<span>移动</span>','move',`data-id="${p.id}" data-orbit="bottom"`)}${btn(uiIcon('more')+'<span>管理</span>','manage-open','data-orbit="left"')}<div class="home-selection-label"><b>${esc(d?.name??'物件')}</b><small>${facility?`${p.level} 级 · `:''}点按钮操作</small></div></nav><div class="home-selection-close">${btn(uiIcon('close')+'收起','close','aria-label="收起建筑操作"')}</div>`;
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
 return `<div class="home-stock">${['wood','stone','dew','notes','feed'].map(k=>`<span title="${MATERIALS[k]}" aria-label="${MATERIALS[k]} ${Math.floor(w.stock[k]??0)}">${artIcon(k)}<b>${Math.floor(w.stock[k]??0)}</b></span>`).join('')}</div>`;
}
function toolsHTML(w:World):string {
 const label=(icon:string,text:string)=>`${uiIcon(icon)}<span>${text}</span>`,e=estate(w);
 // 研究空闲且有能研究的项目时，研究按钮亮一个小点提醒。
 const idle=!e.research.length&&TECHS.some(t=>!techProblem(w,t)&&!shortage(w,t.cost)),ready=e.orders.some(o=>Object.entries(o.need).every(([k,n])=>(w.stock[k]??0)>=n));
 const bags=Object.keys(e.yields).length;
 return `${ui.more?`<nav class="home-more" aria-label="更多家园工具">${btn(label('order','委托')+(ready?'<i class="home-dot" aria-label="有可交付的委托"></i>':''),'panel','data-panel="estate" data-tab="orders"')}${[['craft','制作总览'],['storage','仓库'],['ecology','生态']].map(([id,text])=>btn(label(id,text),'panel',`data-panel="${id}"`)).join('')}</nav>`:bags&&!ui.tool?`<div class="home-collect">${cmd(`${uiIcon('gather')}<span>收取产出 · ${bags} 座</span>`,{type:'collectAll'})}</div>`:''}<nav class="home-tools" aria-label="家园工具">${btn(label('build','建造'),'panel','data-panel="build"')}${btn(label('plants','种植'),'panel','data-panel="plants"')}${cmd(label('gather',w.clock-w.lastGather>=300?'采集':`${Math.ceil((300-w.clock+w.lastGather)/60)}分`),{type:'gather'},w.clock-w.lastGather<300)}${btn(label('research','研究')+(idle?'<i class="home-dot" aria-label="可以开始新的研究"></i>':''),'panel','data-panel="tech"')}${btn(label('more','更多')+(ready&&!ui.more?'<i class="home-dot" aria-label="有可交付的委托"></i>':''),'more',`aria-expanded="${ui.more}" aria-label="更多家园工具"`)}</nav>`;
}
// 升级占地和按钮共用 growth 校验结果，让不能扩建的原因在地图上可见。
function growthPreview(w:World):string {
 const p=w.placements.find(p=>p.id===ui.selected);if(ui.panel!=='upgrade'||ui.tool||!p||p.stored||!BUILDINGS.some(d=>d.id===p.def)||['expedition','resonance'].includes(p.def)||formOf(p)>=3)return '';
 return growth(w,p).cells.map(c=>`<rect class="home-growth-cell${c.free?'':' blocked'}" x="${c.x*TILE+3}" y="${c.y*TILE+3}" width="42" height="42" rx="5"/>`).join('');
}
export function render(h:Host,dispatch:(c:GameCommand)=>boolean):string {
 host=h;issue=dispatch;const w=h.state().world!;
 const panels:Record<string,{title:string;body:()=>string}>={build:{title:'布置小家',body:()=>catalog(w)},plants:{title:'种子与育种',body:()=>plants(w)},craft:{title:'制作总览',body:()=>workshop(w)},object:{title:'建筑操作',body:()=>objectPanel(w)},upgrade:{title:'升级建筑',body:()=>upgradePanel(w)},crop:{title:'照料植物',body:()=>cropPanel(w)},slime:{title:'一起生活',body:()=>companionPanel(w)},storage:{title:'家园仓库',body:()=>storage(w)},ecology:{title:'土地与访客',body:()=>ecology(w)},tech:{title:'研究',body:()=>techPanel(w)},estate:{title:'家园',body:()=>estatePanel(w)},plot:{title:'开垦林地',body:()=>plotPanel(w)}};
 const objectPanelOpen=['object','upgrade'].includes(ui.panel),panel=panels[ui.panel],placing=ui.tool==='build'||ui.tool==='move',p=w.placements.find(p=>p.id===ui.selected),def=ui.tool==='move'?p?.def:ui.def;
 const toolName=ui.tool==='path'?(ui.pathStyle<0?'擦除路面':`铺设${PATH_STYLES[ui.pathStyle]}`):ui.tool==='plant'?'播种':(BUILDINGS.find(d=>d.id===def)??DECORATIONS.find(d=>d.id===def))?.name??'摆放';
 return `<section id="livingWorld" class="home-world ${w.reducedMotion?'reduced-motion':''} ${ui.tool?'home-editing':''} ${ui.panel==='actions'?'home-selecting':''}" data-season="${season(w)}" data-phase="${dayPhase(w)}" aria-label="家园"><div class="home-scene">${scene(w,h,camera,ui.selected,ui.crop,ui.person,!!ui.tool,ui.overlay,growthPreview(w))}<div class="home-air" aria-hidden="true">${Array.from({length:2},(_,i)=>`<i style="--air-x:${(i*47+13)%100}%;--air-y:${(i*31+7)%100}%;--air-delay:${-i*1.7}s;--air-speed:${12+i%5*3}s;--air-size:${3+i%3}px"></i>`).join('')}</div></div><div class="home-season">${btn(`${artIcon('prosperity')}<b>${homeLevel(w)} 级</b>${estate(w).orders.length?`<span class="home-season-orders">${uiIcon('order')}${estate(w).orders.length}</span>`:''}`,'panel',`data-panel="estate" data-tab="orders" aria-label="家园 ${homeLevel(w)} 级，委托 ${estate(w).orders.length} 份"`)}<span data-home-calendar>${SEASONS[season(w)]}季 · 第 ${day(w)+1} 日</span><span data-home-time>${WEATHER[w.weather]} · ${DAY_PHASES[dayPhase(w)]}</span></div>${stockHTML(w)}<div class="home-camera">${btn(uiIcon('plus'),'zoom','data-factor="1.25" aria-label="放大地图"')}${btn(uiIcon('minus'),'zoom','data-factor="0.8" aria-label="缩小地图"')}${btn(uiIcon('home'),'center','aria-label="回到小屋"')}</div>${ui.tool?`<div class="home-tool-hint">${placing?`<div class="home-tool-preview">${preview(def??'',p&&ui.tool==='move'?formOf(p):1)}</div>`:''}<div class="home-tool-copy"><b>${esc(toolName)}</b><span class="home-placement-status" role="status">${ui.tool==='path'?'按住拖动，连续铺设':ui.tool==='plant'?'点空地播种，可连续种植':'点空地放下，也可以按住拖动'}</span></div>${placing?btn(uiIcon('rotate')+'<span>旋转</span>','rotate'):''}${btn(uiIcon('close')+`<span>${placing?'取消':'完成'}</span>`,'cancel')}</div>`:''}${panel?`<aside class="home-panel ${objectPanelOpen?'home-object-panel':''} ${ui.panel==='build'?'home-build-panel':''} ${ui.panel==='tech'?'home-tech-panel':''}" aria-label="${panel.title}" ${ui.panel==='build'?`data-catalog="${ui.category}:${ui.group}"`:''}><header>${objectPanelOpen?objectHeader(w):`<h2>${panel.title}</h2>`}${ui.panel==='build'?`<div class="home-shelf-nav">${btn(uiIcon('left'),'shelf-scroll','data-dir="-1" aria-label="向左浏览建筑"')}${btn(uiIcon('right'),'shelf-scroll','data-dir="1" aria-label="向右浏览建筑"')}</div>`:''}${btn(uiIcon('close'),'close','aria-label="关闭面板"')}</header><div class="home-panel-body">${panel.body()}</div>${objectPanelOpen?objectFooter(w):''}</aside>`:''}${ui.panel==='actions'?radialActions(w):''}${toolsHTML(w)}</section>`;
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
  if(c.type==='store'){ui.panel='build';ui.category='stored';ui.selected=0;redraw();}
  if(c.type==='clear'){
   ui.panel='';ui.plot=-1;redraw();
   if(!w.reducedMotion&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
    const svg=document.querySelector('.home-map'),[x,y]=plotOrigin(c.plot),cloud=document.createElementNS('http://www.w3.org/2000/svg','g');
    cloud.setAttribute('class','home-fog-reveal');cloud.setAttribute('pointer-events','none');cloud.setAttribute('aria-hidden','true');
    cloud.innerHTML=`<rect x="${x*TILE}" y="${y*TILE}" width="${PLOT*TILE}" height="${PLOT*TILE}" fill="url(#home-cloud-fill)"/>`;
    svg?.insertBefore(cloud,svg.querySelector('.home-plot-signs'));
    const animation=cloud.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-12px)'}],{duration:650,easing:'ease-out'});
    animation.finished.then(()=>cloud.remove(),()=>cloud.remove());
   }
  }return true;}
 case 'panel':ui.panel=ui.panel===ds.panel&&(!ds.tab||ui.estateTab===ds.tab)?'':ds.panel!;if(ds.tab)ui.estateTab=ds.tab;ui.tool='';ui.more=false;ui.focusTech='';break;
 case 'branch':ui.branch=Number(ds.branch);ui.focusTech='';break;
 case 'estate-tab':ui.estateTab=ds.tab!;break;
 case 'tech-node':{const t=TECHS.find(t=>t.id===ds.tech);if(!t)return true;ui.panel='tech';ui.branch=t.branch;ui.focusTech=t.id;ui.tool='';ui.more=false;redraw();document.getElementById(`tech-${t.id}`)?.scrollIntoView({block:'center'});return true;}
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
 if(['category','group','manage','panel','family','use','upgrade-view','manage-open','branch','estate-tab'].includes(ds.lw!)){const body=document.querySelector('.home-panel-body');if(body)body.scrollTop=0;}
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
 const svg=document.querySelector<SVGSVGElement>('.home-map'),phase=dayPhase(w),s=String(season(w));
 if(svg&&(svg.dataset.season!==s||svg.dataset.phase!==phase)){
  // 时段变化直接更新地图，建造中也会换季、亮灯，并保留镜头和放置预览。
  const next=new DOMParser().parseFromString(scene(w,host,camera,ui.selected,ui.crop,ui.person,!!ui.tool,ui.overlay),'text/html').querySelector('.home-map');
  if(next){for(const selector of [':scope>defs','.home-ground','.home-objects','.home-lighting','.home-fog','.home-plot-signs']){const old=svg.querySelector(selector),fresh=next.querySelector(selector);if(old&&fresh)old.replaceWith(fresh);}svg.dataset.season=s;svg.dataset.phase=phase;svg.classList.toggle('night',night(w));}
  const world=svg.closest<HTMLElement>('.home-world');if(world){world.dataset.season=s;world.dataset.phase=phase;}
  const calendar=world?.querySelector('[data-home-calendar]'),time=world?.querySelector('[data-home-time]');
  if(calendar)calendar.textContent=`${SEASONS[season(w)]}季 · 第 ${day(w)+1} 日`;
  if(time)time.textContent=`${WEATHER[w.weather]} · ${DAY_PHASES[phase]}`;
  const ghost=svg.querySelector('.home-placement-ghost'),old=w.placements.find(p=>p.id===ui.selected);
  if(ghost&&previewCell){const [x,y]=previewCell,p=ui.tool==='move'&&old?{...old,x,y,rotation:ui.rotation}:{id:0,def:ui.def,zone:0,x,y,rotation:ui.rotation,level:1,stored:false};ghost.innerHTML=objectArt(p,night(w),season(w),night(w)||phase==='dusk');}
 }
 svg?.querySelector('.home-thaw')?.setAttribute('opacity',String(springThaw(w)));
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
 // 气泡和路牌叠在建筑与林地上方，先判断它们。
 const bubble=target.closest<SVGElement>('[data-home-bubble]'),plot=target.closest<SVGElement>('[data-home-plot]');
 if(bubble){issue({type:'collect',id:Number(bubble.dataset.homeBubble)});return;}
 if(plot){ui.plot=Number(plot.dataset.homePlot);ui.panel='plot';ui.selected=0;ui.crop=0;redraw();return;}
 const object=target.closest<SVGElement>('[data-home-object]'),crop=target.closest<SVGElement>('[data-home-crop]'),slime=target.closest<SVGElement>('[data-home-resident]');
 if(object){inspect(Number(object.dataset.homeObject));return;}else if(crop){ui.crop=Number(crop.dataset.homeCrop);ui.selected=0;ui.panel='crop';}else if(slime){ui.person=Number(slime.dataset.homeResident);ui.panel='slime';}else{ui.panel='';ui.selected=0;ui.crop=0;}redraw();
}
export function mount():void {
 dispose?.();const svg=document.querySelector<SVGSVGElement>('.home-map');if(!svg)return;
 const controller=new AbortController(),opts={signal:controller.signal},pointers=new Map<number,{x:number;y:number}>();dispose=()=>controller.abort();
 // Controls and the camera use the same measured, unobstructed screen area.
 const world=svg.closest<HTMLElement>('.home-world')!;
 const top=document.querySelector<HTMLElement>('.topbar')!,nav=document.querySelector<HTMLElement>('.tabbar')!;
 const seasonBar=world.querySelector<HTMLElement>('.home-season')!,stock=world.querySelector<HTMLElement>('.home-stock')!,tools=world.querySelector<HTMLElement>('.home-tools')!,controls=world.querySelector<HTMLElement>('.home-camera')!;
 const measureBars=()=>{
  const r=world.getBoundingClientRect(),t=top.getBoundingClientRect(),n=nav.getBoundingClientRect();
  world.style.setProperty('--home-top',`${t.bottom-r.top}px`);world.style.setProperty('--home-bottom',`${r.bottom-n.top}px`);
  const s=seasonBar.getBoundingClientRect(),k=stock.getBoundingClientRect(),u=tools.getBoundingClientRect(),c=controls.getBoundingClientRect(),landscape=matchMedia('(max-height:500px) and (orientation:landscape)').matches;
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
 const observer=new ResizeObserver(measureBars);for(const el of [top,nav,world,seasonBar,stock,tools,controls,world.querySelector('.home-object-panel')])if(el)observer.observe(el,{box:'border-box'});
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
  svg.querySelector('.home-preview')!.innerHTML=Array.from({length:a*b},(_,n)=>drawCell(x+n%a,y+Math.floor(n/a),!error)).join('')+`<g class="home-placement-ghost" opacity=".78" transform="translate(${x*TILE} ${y*TILE+10})">${objectArt(next,night(w),season(w),night(w)||dayPhase(w)==='dusk')}</g>`;
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
  if(e.key==='Enter'||e.key===' '){const target=e.target as Element;if(target.closest('[data-home-object],[data-home-crop],[data-home-resident],[data-home-bubble],[data-home-plot]')){e.preventDefault();selectAt(target,0,0);document.querySelector<HTMLElement>('.home-orbit [data-lw]:not(:disabled),.home-panel [data-lw]:not(:disabled)')?.focus({preventScroll:true});}}
 },opts);
 window.addEventListener('resize',measureBars,opts);
 window.visualViewport?.addEventListener('resize',measureBars,opts);
}
