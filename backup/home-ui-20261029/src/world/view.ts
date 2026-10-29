import {activity,resident} from './life.ts';
import {storyTitle,storyScene,storyRequirement,storyId,storyCasts,tripScene} from './stories.ts';
import type {Host,World,GameCommand,Slime,Mini} from './types.ts';
import {BUILDINGS,DECORATIONS,PATH_STYLES,PLANTS,VISITORS,ZONES,MATERIALS,RECIPES,FAMILIES,BABY_EVENTS,BABY_PERSONAL_EVENTS} from './content.ts';
import {EVENTS} from './narratives.ts';
import {chapterReady,occupied,afford,companion,placementError} from './engine.ts';
import {environment,level,season,day,night,SEASONS,WEATHER} from './ecology.ts';
import {scene,esc,jelly,buildingPreview,roadPreview,roadMap,cellFromPoint,elementHue,MAP_W,MAP_H,PATH_TONES} from './art.ts';
import {COMBOS} from './combat.ts';
import {materialIcon} from './art/creatures.ts';
import {regionArt} from './art/regions.ts';
import {plantArt} from './art/plants.ts';
export const ui={tab:'home',zone:0,build:'',pathStyle:0,buildKind:'facilities',buildGroup:0,plant:0,selected:0,crop:0,overlay:'',zoom:1,rotate:0,edit:false,person:0,family:0,region:0};
let lastInteraction=0;
export const recentlyInteracted=()=>Date.now()-lastInteraction<2500;
let host:Host;let issue:(c:GameCommand)=>void;
const button=(label:string,action:string,attrs='',disabled=false)=>{const extra=attrs.match(/class="([^"]*)"/)?.[1]??'';return `<button class="lw-button ${extra}" data-lw="${action}" ${attrs.replace(/class="[^"]*"/,'')} ${disabled?'disabled':''}>${label}</button>`;};
const cmd=(label:string,c:GameCommand,disabled=false)=>button(label,'cmd',`data-command="${esc(JSON.stringify(c))}"`,disabled);
const cost=(c:Record<string,number>)=>Object.entries(c).filter(([,v])=>v>0).map(([k,v])=>`${MATERIALS[k]??k} ${Number(v.toFixed(1))}`).join(' · ');
const note=(t:string)=>`<p class="lw-note">${esc(t)}</p>`;
const heading=(title:string,text:string)=>`<header class="lw-section-head"><h2>${esc(title)}</h2><p>${esc(text)}</p></header>`;
const options=(values:{id:string|number;name:string}[],selected:string|number)=>values.map(v=>`<option value="${esc(v.id)}" ${v.id===selected?'selected':''}>${esc(v.name)}</option>`).join('');
const select=(id:string,label:string,values:{id:string|number;name:string}[],selected:string|number='')=>`<label class="lw-field">${label}<select id="${id}">${options(values,selected)}</select></label>`;
const freeSlimes=(w:World):Slime[]=>host.state().slimes.filter(s=>host.available(s.id)&&!occupied(w,s.id));
function resources(w:World):string {
 return `<div class="lw-stock" aria-label="家园材料">${['wood','stone','ingredient','feed'].map(k=>`<span data-mat="${k}">${materialIcon(k)}<small>${MATERIALS[k]}</small><b>${Math.floor(w.stock[k]??0)}</b></span>`).join('')}</div>`;
}
function buildCatalog(w:World):string {
 const stored=w.placements.filter(p=>p.stored),decor=ui.buildKind==='decor';
 const groups=decor?['小径','围栏','灯光','休憩','花艺','标识','自然','纪念']:['生活','种植','生态','水景','工坊','星空'];
 const defs=decor?DECORATIONS.filter(d=>d.group===ui.buildGroup):BUILDINGS.filter(d=>d.zone===ui.buildGroup);
 const items=ui.buildKind==='stored'?stored.map(p=>({p,d:BUILDINGS.find(d=>d.id===p.def)??DECORATIONS.find(d=>d.id===p.def)!})):defs.map(d=>({p:null,d}));
 const selected=BUILDINGS.find(d=>d.id===ui.build)??DECORATIONS.find(d=>d.id===ui.build),brushes=decor&&ui.buildGroup===0&&ui.buildKind!=='stored';
 return `<details class="lw-build-catalog" ${ui.edit?'open':''}><summary><span>布置小家<small>把喜欢的风景，放进生活里</small></span><span class="lw-catalog-toggle" aria-hidden="true">＋</span></summary>
 <div class="lw-build-tabs" aria-label="建造分类">${[['facilities','设施'],['decor','装饰'],['stored',`收纳 · ${stored.length}`]].map(([kind,label])=>button(label,'build-kind',`data-kind="${kind}" aria-pressed="${ui.buildKind===kind}" class="${ui.buildKind===kind?'is-active':''}"`)).join('')}</div>
 ${ui.buildKind!=='stored'?`<div class="lw-build-groups" aria-label="物件用途">${groups.map((name,index)=>button(name,'build-group',`data-group="${index}" aria-pressed="${ui.buildGroup===index}" class="${ui.buildGroup===index?'is-active':''}"`)).join('')}</div>`:''}
 <div class="lw-build-items">${brushes?PATH_STYLES.map((name,i)=>{const chosen=ui.build==='path'&&ui.pathStyle===i;return button(`<span class="lw-build-art">${roadPreview(i)}<span class="lw-build-check" aria-hidden="true">${chosen?'✓':'＋'}</span></span><span class="lw-build-title">${esc(name)}<small>拖动连续铺设</small></span><span class="lw-build-price">免费</span>`,'path-style',`data-style="${i}" class="lw-build-item ${chosen?'is-active':''}" aria-pressed="${chosen}" title="伙伴会优先走路面"`);}).join(''):items.map(({p,d})=>{const enough=!!p||afford(w,d.cost),chosen=p?ui.selected===p.id:ui.build===d.id,owned=w.placements.filter(p=>!p.stored&&p.def===d.id).length;
 return button(`<span class="lw-build-art">${buildingPreview(d.id)}<span class="lw-build-check" aria-hidden="true">${chosen?'✓':'＋'}</span></span><span class="lw-build-title">${esc(d.name)}<small>${p?'已收纳':'size' in d?d.size.join(' × '):'1 × 1'}</small></span><span class="lw-build-price ${enough?'':'is-short'}">${p?'取出摆放':cost(d.cost)}</span>${!enough?'<span class="lw-build-availability">材料不足</span>':owned&&!p?`<span class="lw-build-availability">已放置 ${owned}</span>`:''}`,p?'move':'prepare-build',`${p?`data-id="${p.id}"`:`data-def="${d.id}"`} class="lw-build-item ${chosen?'is-active':''}" aria-pressed="${chosen}" aria-disabled="${!enough}" title="${esc('desc' in d?d.desc:d.effect)}"`);
 }).join('')||`<div class="lw-storage-empty">${buildingPreview('house')}<b>喜欢的物件，随时放回来</b><p>点地图上的物件，就能把它收纳在这里。</p></div>`}</div>
 ${brushes?`<div class="lw-build-description"><b>小径</b><p>选好材质后在地图上拖动，连成一条路。伙伴会优先走路面。</p></div>`:''}${selected?`<div class="lw-build-description"><b>${esc(selected.name)}</b><p>${esc('desc' in selected?selected.desc:selected.effect)}</p></div>`:''}
 <div class="lw-build-footer"><span>木材 <b>${Math.floor(w.stock.wood??0)}</b> · 石材 <b>${Math.floor(w.stock.stone??0)}</b></span>${button(ui.build==='path'?'停止铺路':'铺设小路','path-mode',`aria-pressed="${ui.build==='path'}"`)}</div></details>`;
}
function placementHint(w:World):string {
 const d=BUILDINGS.find(d=>d.id===ui.build)??DECORATIONS.find(d=>d.id===ui.build),moving=ui.edit&&ui.selected?w.placements.find(p=>p.id===ui.selected):null;
 if(!d&&!moving&&ui.build!=='path')return '';
 if(ui.build==='path'){const swatch=(i:number,label:string)=>button(`<i aria-hidden="true" style="${i<0?'':`--road:${PATH_TONES[i].base};--rim:${PATH_TONES[i].edge}`}"></i>${label}`,'path-style',`data-style="${i}" aria-pressed="${ui.pathStyle===i}" class="${ui.pathStyle===i?'is-active':''} ${i<0?'is-eraser':''}"`);
  return `<div class="lw-placement-hint lw-road-hint" role="status"><div><b>${ui.pathStyle<0?'擦除路面':esc(PATH_STYLES[ui.pathStyle])}</b><span>${ui.pathStyle<0?'在地图上拖动，划过的路面会被擦掉':'拖动铺路，点同款路面可擦除'}</span></div>${button('完成','cancel-build')}<div class="lw-road-swatches">${PATH_STYLES.map((name,i)=>swatch(i,esc(name))).join('')}${swatch(-1,'擦除')}</div></div>`;}
 const name=d?.name??(moving?BUILDINGS.find(d=>d.id===moving.def)?.name??DECORATIONS.find(d=>d.id===moving.def)?.name:'小路');
 return `<div class="lw-placement-hint" role="status"><div><b>${esc(name)}</b><span>点地图空地放置</span></div>${button('取消','cancel-build')}</div>`;
}
function home(w:World):string {
 const s=host.state().slimes,locked=!w.unlocked.includes(ui.zone),e=environment(w,ui.zone,6,6,s);
 let selection='';const p=w.placements.find(p=>p.id===ui.selected);
 if(p){const d=BUILDINGS.find(d=>d.id===p.def),dec=DECORATIONS.find(d=>d.id===p.def),workers=w.workers.filter(j=>j.building===p.id),recipes=RECIPES.filter(r=>r.building===p.def);
  selection=`<section class="lw-detail"><div class="lw-line"><h3>${esc(d?.name??dec?.name)} <small>${p.level} 级${p.stored?' · 已收纳':''}</small></h3>${button('关闭','deselect')}</div>${note(d?.desc??dec?.effect??'')}${d&&p.level<3?note(`升级：${d.upgrades[p.level-1]} · ${cost(Object.fromEntries(Object.entries(d.cost).map(([k,v])=>[k,v*(p.level+1)])))}`):''}<div class="lw-actions">${d?cmd('升级',{type:'upgrade',id:p.id},p.level>=3||p.stored):''}${button(p.stored?'取出放置':'移动','move',`data-id="${p.id}"`)}${button('旋转后放置','rotate',`data-id="${p.id}"`)}${cmd('收纳',{type:'store',id:p.id},p.stored)}</div>${d?`<div class="lw-inline-form">${freeSlimes(w).map(s=>cmd(`邀请${esc(s.name)}帮忙`,{type:'assign',slime:s.id,building:p.id},p.stored)).join('')||note('伙伴都在忙，等它们回家再来帮忙。')}</div>${workers.map(j=>`<div class="lw-line">${esc(s.find(s=>s.id===j.slimeId)?.name)} 正在帮忙${cmd('休息',{type:'unassign',slime:j.slimeId})}</div>`).join('')}${recipes.map(r=>`<div class="lw-recipe"><div><b>${r.name}</b><small>${cost(r.cost)} → ${cost(r.output)} · ${r.seconds/60} 分钟${r.level>p.level?` · 需要 ${r.level} 级`:''}</small></div>${cmd('制作',{type:'craft',recipe:r.id,building:p.id},r.level>p.level||!afford(w,r.cost)||p.stored)}</div>`).join('')}`:''}</section>`;
 }
 if(p)selection+=facility(w,p.def);
 const c=w.crops.find(c=>c.id===ui.crop);if(c){const v=w.cultivars.find(v=>v.id===c.cultivar)!,d=PLANTS.find(p=>p.id===v.species)!,env=environment(w,c.zone,c.x,c.y,s);selection=`<section class="lw-detail"><div class="lw-line"><h3>${esc(v.name)}</h3>${button('关闭','deselect')}</div><p>${FAMILIES[d.family]} · ${Math.round(c.progress*100)}% · ${c.water<=0?'需要补水':`水分可维持 ${Math.ceil(c.water)} 分钟`}</p><progress max="1" value="${c.progress}"></progress><p>光照 ${Math.round(env.light)} · 湿度 ${Math.round(env.moisture)} · 肥力 ${Math.round(env.fertility)} · ${env.temperature}°</p>${note(d.use)}<div class="lw-actions">${cmd('照料 · 露水 1',{type:'care',id:c.id})}${cmd('收获',{type:'harvest',id:c.id},c.progress<1||d.id==='glowflower')}${cmd('施肥',{type:'fertilize',id:c.id,item:'fertilizer'},!(w.stock.fertilizer>0))}${cmd('使用沃土',{type:'fertilize',id:c.id,item:'soil'},!(w.stock.soil>0))}${cmd('移回种子库',{type:'uproot',id:c.id})}</div></section>`;}
 return `${ui.edit?'':companionBar(w)+wishCard(w)}<div class="lw-zone-nav">${ZONES.map(z=>button(z.name,'zone',`data-zone="${z.id}" class="${ui.zone===z.id?'is-active':''} ${w.unlocked.includes(z.id)?'':'is-locked'}"`)).join('')}</div>
 ${locked?`<div class="lw-empty"><h3>把家园延伸到这里</h3><p>需要 ${ZONES[ui.zone].threshold} 项发现，已有 ${w.discoveries.length} 项。</p>${note(cost({wood:10+ui.zone*10,stone:5+ui.zone*5}))}${cmd('开辟区域',{type:'unlock',zone:ui.zone},w.discoveries.length<ZONES[ui.zone].threshold)}</div>`:`<div class="lw-scene-wrap" style="--zoom:${ui.zoom}">${scene(w,ui.zone,s,ui.selected,ui.overlay,host.slimeHTML)}</div><div class="lw-map-tools">${button(ui.edit?'完成布置':'建造与装饰','edit')}${button('−','zoomout','aria-label="缩小地图"')}${button('+','zoomin','aria-label="放大地图"')}${button('复位','zoomreset')}<span>${ui.build==='path'?'拖动铺路，可以拐弯':ui.build?'选好了，点地图空地放置':ui.plant?'点击空地种植':ui.edit&&ui.selected?'拖动所选物件，或点击空地移动':'点击植物与设施查看'}</span></div>${placementHint(w)}${selection}
 <div class="lw-actions">${cmd(w.clock-w.lastGather>=300?'采集物资':`${Math.ceil((300-w.clock+w.lastGather)/60)} 分后可采集`,{type:'gather'},w.clock-w.lastGather<300)}${cmd('全部收获',{type:'harvestAll'},!w.crops.some(c=>c.progress>=1))}${cmd('批量补水',{type:'careAll'})}</div>
 ${buildCatalog(w)}
 <details><summary>这一片土地的环境</summary><div class="lw-environment-summary"><span>光照 ${Math.round(e.light)}</span><span>湿度 ${Math.round(e.moisture)}</span><span>肥力 ${Math.round(e.fertility)}</span><span>水质 ${Math.round(e.quality)}</span></div></details>`}
 <details class="lw-disclosure"><summary>物资仓库 · ${Object.keys(w.stock).length} 类</summary><div class="lw-inventory">${Object.entries(w.stock).map(([k,v])=>`<span>${materialIcon(k.startsWith('seed:')?'seed':k)}<em>${esc(k.startsWith('seed:')?(w.cultivars.find(c=>c.id===Number(k.slice(5)))?.name??'种子'):(MATERIALS[k]??k))}</em><b>${Math.floor(v)}</b></span>`).join('')}</div>${Object.values(w.pending).some(v=>v>0)?note(`仓满物资保留：${cost(w.pending)}`)+cmd('领取能放下的物资',{type:'claimOverflow'}):''}</details>`;
}
function nursery(w:World):string {
 const cv=w.cultivars.find(v=>v.id===ui.plant)??w.cultivars[0],d=PLANTS.find(p=>p.id===cv.species)!,plants=w.cultivars.filter(v=>PLANTS.find(p=>p.id===v.species)?.family===ui.family);
 return `${heading('苗圃','保存喜欢的品系，陪幼体长大。每次照料都会留下记录。')}
 <div class="lw-actions">${FAMILIES.map((f,i)=>button(f,'family',`data-family="${i}" class="${ui.family===i?'is-active':''}"`)).join('')}</div><div class="lw-inline-form">${select('lw-cultivar','选择品系',plants.map(v=>({id:v.id,name:`${v.protected?'♡ ':''}${v.name} · ${v.seeds} 粒`})),cv.id)}${button('查看品系','choose-cultivar')}</div>
 <section class="lw-plant-profile"><svg viewBox="${d.family===3?'-32 -68 64 78':'-24 -50 48 58'}" width="85" height="85" aria-hidden="true">${plantArt(d,cv.genes.color,cv.genes.form,1,false).replace(/url\(#lw-(water|window)\)/g,(_,k)=>k==='water'?'#8dcbd0':'#ffe6a3')}</svg><div><small>${FAMILIES[d.family]} · ${d.parents?'杂交品种':'基础植物'}</small><h3>${esc(cv.name)}</h3><p>${d.use}</p><small>成熟 ${d.minutes} 分钟 · 喜光 ${d.light} / 湿度 ${d.moisture} / ${d.temp}°</small></div></section>
 <div class="lw-gene-row">${(['form','yield','speed','adapt'] as const).map((k,i)=>`<span>${['株型','产量','速度','适应'][i]}<b>${cv.genes[k]}/5</b></span>`).join('')}</div>${note(cv.parents.length?`亲本：${cv.parents.join(' × ')}`:'基础品系；可以与同类开花植物交叉授粉。')}
 <div class="lw-actions">${button('选择地块播种','prepare-plant',`data-id="${cv.id}"`,cv.seeds<=0)}${cmd('批量播种 6 株',{type:'sow',cultivar:cv.id,zone:ui.zone},cv.seeds<=0||cv.protected)}${cmd(cv.protected?'取消收藏':'收藏品系',{type:'cultivar',id:cv.id,protect:!cv.protected})}${cmd('复制留种',{type:'clone',id:cv.id},!level(w,'seedbank'))}</div>
 <div class="lw-inline-form"><label class="lw-field">品系名称<input id="lw-cultivar-name" maxlength="24" value="${esc(cv.name)}"></label>${button('保存名字','name-cultivar',`data-id="${cv.id}"`)}</div>
 <details class="lw-disclosure"><summary>授粉与育种 · 18 个命名杂交组合</summary>${note('亲本需同类且已开花。后代继承双方的性状，少量变异带来新变化。刷新不会改变结果。')}${select('lw-parent-a','亲本一',w.cultivars.map(v=>({id:v.id,name:v.name})),cv.id)}${select('lw-parent-b','亲本二',w.cultivars.map(v=>({id:v.id,name:v.name})),w.cultivars.find(v=>v.id!==cv.id)?.id??0)}${button('授粉 · 露水 3','breed','',!level(w,'pollen'))}<div class="lw-catalog">${PLANTS.filter(p=>p.parents&&p.family===ui.family).map(p=>`<p><b>${p.name}</b><small>${p.parents!.map(id=>PLANTS.find(p=>p.id===id)!.name).join(' × ')}${w.cultivars.some(c=>c.species===p.id)?' · 已发现':''}</small></p>`).join('')}</div></details>
 <div class="lw-line"><h3>幼体的家</h3><small>${w.juveniles.filter(j=>j.active).length}/${(level(w,'house')||1)*2} 在养</small></div>
 ${w.juveniles.length?w.juveniles.map(j=>{const event=j.choices.includes(`${j.stage}:element`)?BABY_PERSONAL_EVENTS[j.id%24]:BABY_EVENTS.find(e=>e.element===j.element)!;return `<article class="lw-baby"><div class="lw-line"><svg viewBox="-30 -45 60 70" width="55" height="64" aria-hidden="true">${jelly(elementHue(j.element),j.name)}</svg><div><h3>${esc(j.name)}</h3><small>${j.element} · ${j.active?j.stage?'幼年':'幼体':'待安置'} · ${Math.floor((w.clock-j.born)/60)} 分钟</small></div></div><p>照料 ${j.care.length}/5 · ${j.care.join(' / ')||'等待第一次陪伴'}</p>${j.active?`<div class="lw-actions">${['喂食','游戏','安抚','环境'].map(kind=>cmd(kind,{type:'babyCare',id:j.id,kind},j.care.includes(kind))).join('')}</div>${select(`lw-mentor-${j.id}`,'导师',freeSlimes(w).map(s=>({id:s.id,name:s.name})))}${button('邀请导师','mentor',`data-id="${j.id}"`,j.care.includes('导师')||!freeSlimes(w).length)}${!j.choices.includes(`${j.stage}:personal`)?`<div class="lw-story"><b>${event.title}</b><p>${event.text}</p>${cmd('继续故事',{type:'babyContinue',id:j.id,stage:j.stage,chapter:j.choices.length})}</div>`:''}${note(j.traits.join('；'))}${cmd(j.stage?'确认成年':'进入幼年',{type:'grow',id:j.id})}${note(j.stage?'成年需要 60 分钟成长与 5 类照料。':'进入幼年需要 15 分钟成长与 3 类照料。')}`:cmd('安置到小屋',{type:'adopt',id:j.id})}</article>`;}).join(''):note('探索时可以救助幼体，也可以邀请两位成年伙伴共鸣。幼体会安全等待你安置。')}
 <details class="lw-disclosure"><summary>伙伴共鸣 · 新生命</summary>${select('lw-resonance-a','伙伴一',freeSlimes(w).map(s=>({id:s.id,name:s.name})))}${select('lw-resonance-b','伙伴二',freeSlimes(w).map(s=>({id:s.id,name:s.name})),freeSlimes(w)[1]?.id??0)}${note('露水 8 · 食材 2；成年伙伴保留。每 30 分钟可共鸣一次。')}${button('开始共鸣','resonate','',freeSlimes(w).length<2)}</details>`;
}
function ecology(w:World):string {
 const e=environment(w,ui.zone,6,6,host.state().slimes);
 return `${heading('生态观察','树荫、花粉、水流与小小访客，一起改变家园。')}<div class="lw-actions">${[['','外观'],['light','光照'],['moisture','湿度'],['fertility','肥力'],['quality','水质']].map(([value,name])=>button(name,'overlay',`data-overlay="${value}" class="${ui.overlay===value?'is-active':''}"`)).join('')}</div><div class="lw-scene-wrap">${scene(w,ui.zone,host.state().slimes,0,ui.overlay,host.slimeHTML)}</div>
 <div class="lw-actions">${ZONES.filter(z=>w.unlocked.includes(z.id)).map(z=>button(z.name,'zone',`data-zone="${z.id}" class="${ui.zone===z.id?'is-active':''}"`)).join('')}</div><section class="lw-detail"><h3>环境为什么这样变化</h3><p>光照 ${Math.round(e.light)} · 湿度 ${Math.round(e.moisture)} · 肥力 ${Math.round(e.fertility)} · 水质 ${Math.round(e.quality)} · ${e.temperature}°</p>${e.reasons.map(r=>`<p class="lw-note">${esc(r)}</p>`).join('')}${e.quality<60?note('恢复建议：在水塘附近种净水藻，或建造净水池。'):note('水质适宜，可以试着吸引更多水生访客。')}</section><h3>访客图鉴 <small>${VISITORS.filter(v=>w.discoveries.includes(v.id)).length}/18</small></h3><div class="lw-visitor-list">${VISITORS.map(v=>`<article><span class="lw-visitor-mark ${w.visitors[v.id]?'present':''}">${w.visitors[v.id]?'●':'○'}</span><div><b>${v.name}</b><small>${ZONES[v.zone].name} · ${w.visitors[v.id]?'正在来访':w.discoveries.includes(v.id)?'曾经来过':'等待发现'}</small><p>${v.need}</p><small>${v.service}</small></div></article>`).join('')}</div>`;
}
function exploration(w:World):string {
 const free=freeSlimes(w),z=ZONES[ui.region],preset=host.state().legacyTeamPreset??[];
 return `${heading('一起把发现带回家','选择地点，再决定这次怎样出发。')}
 <div class="lw-world-map">${ZONES.map(r=>button(`${regionArt(r.id,w.discoveries.length>=r.threshold,night(w))}<b>${r.area}</b><small>${w.discoveries.length>=r.threshold?'已发现路线入口':`还需${r.threshold-w.discoveries.length}项发现`}</small>`,'region',`data-region="${r.id}" class="${r.id===ui.region?'is-active':''}"`)).join('')}</div>
 <section class="lw-detail"><h3>${z.area}</h3><p>${z.story}</p>${note('能带回：木材、石材、食材、种子与研究笔记。同行伙伴会用自己的方式回应沿途的相遇。')}${note('同行机会：'+([...new Set(EVENTS.filter(e=>e.region===z.id).flatMap(e=>e.choices.map(c=>c.requires?.element).filter(Boolean)))].map(e=>e+'伙伴的能力').join('、')||'所有元素都能发现新线索'))}${ui.region===1?note('带有发光种子愿望的伙伴同行，可以把一束光带回家。'):''}
 <input type="hidden" id="lw-region" value="${ui.region}">${select('lw-route','路线',[{id:0,name:'采集小路'},{id:1,name:'调查小路'},{id:2,name:'挑战小路'}],0)}
 <div class="lw-team">${free.map((s,i)=>`<label><input type="checkbox" name="lw-team" value="${s.id}" ${(preset.length?preset.includes(s.id):i===0)?'checked':''}>${esc(s.name)} · ${s.element} · 体力${Math.floor(s.stamina)}</label>`).join('')||note('先让一位伙伴回家，或在伙伴页召唤。')}</div>
 ${button('一起出游 · 无食物门票','depart','data-mode="active"',!free.length||w.discoveries.length<z.threshold)}
 <details><summary>委托熟悉的路线</summary>${select('lw-duration','委托时长',[{id:300,name:'5分钟'},{id:1200,name:'20分钟'},{id:3600,name:'60分钟'},{id:10800,name:'180分钟'}],300)}${select('lw-supply','携带补给',[{id:'feed',name:'基础饲料'},{id:'meal',name:'便当'}],'feed')}<label><input type="checkbox" id="lw-repeat">连续委托（后续每次补充基础饲料）</label>${note('每20分钟1份便当或2份饲料，最少1档；先一起完成所选路线即可委托。补给在出发时使用，召回保留已获得的收获。')}${button('委托采集','depart','data-mode="offline"',!free.length||w.discoveries.length<z.threshold)}</details></section>
 ${w.trips.map(t=>{const e=tripScene(w,t,host.state().slimes),team=host.state().slimes.filter(s=>t.team.includes(s.id));return `<article class="lw-detail"><h3>${ZONES[t.region].area} · ${t.mode==='active'?'一起出游':'委托采集'}</h3><p>${team.map(s=>esc(s.name)).join('、')} · ${t.ready?'已回家':t.resting?'在家休息，仍保留本次安排':`${t.node}/4段`}</p>${e?`<div class="lw-story"><h4>${e.title}</h4><p>${e.text}</p>${cmd('继续旅途',{type:'tripContinue',id:t.id,event:e.id})}</div>`:''}<div class="lw-actions">${t.ready?cmd('收好旅行物资',{type:'claimTrip',id:t.id}):`${t.mode==='active'?cmd('继续前进',{type:'step',id:t.id},!!t.pending)+cmd('途中休整',{type:'restTrip',id:t.id}):''}${cmd('召回伙伴',{type:'recall',id:t.id})}`}</div><details><summary>沿途记录与收获</summary>${note(cost(t.bag))}${t.log.map(line=>note(line)).join('')}${note(`晶币${t.coins??0} · 已完成${t.actions??0}次采集行动`)}</details></article>`;}).join('')}
 <section class="lw-detail"><h3>挑战区域</h3>${button('进入深渊、教学与扫荡','legacy','data-page="challenges"')}${note('战斗保持原有成长规则，出战伙伴与家园、旅行共用活动状态。')}</section>
 <details class="lw-disclosure"><summary>营地与世界故事</summary>${ZONES.map(r=>`<article class="lw-camp"><b>${r.area}</b><p>${r.story}</p>${w.camps.includes(r.id)?storyCard(w,`region:${r.id}`,ui.person?[ui.person]:[]):cmd('修复营地 · '+cost({wood:15+r.id*5,stone:10+r.id*3}),{type:'camp',region:r.id},w.discoveries.length<r.threshold)}</article>`).join('')}</details>
 <details class="lw-disclosure"><summary>旅行册</summary>${w.journals.map(j=>`<article><h4>${esc(j.title)}</h4>${j.lines.map(line=>note(line)).join('')}</article>`).join('')||note('一起出发后，记录会留在这里。')}</details>`;
}
function storyCard(w:World,definition:string,ids:number[]):string {
 const i=w.stories[storyId(definition,ids)];
 if(!i||i.legacy&&i.status==='active'&&!i.participants.length)return cmd('翻开这段故事',{type:'storyStart',definition},!storyCasts(w,freeSlimes(w),definition).length);
 const team=host.state().slimes.filter(s=>i.participants.includes(s.id)),people=i.participants.map(id=>host.state().slimes.find(s=>s.id===id)?.name??w.archives[id]?.name??'历史参与者').join('、');
 const issue=storyRequirement(w,i),scene=storyScene(i,team,w),away=team.some(s=>activity(w,s.id).kind!=='home'),length=i.kind==='world'?6:i.kind==='pair'?1:3;
 return `<article class="lw-story" data-story="${esc(i.id)}"><div class="lw-story-byline"><span>${esc(people||'等待一位同行伙伴')}</span><small>${i.status==='completed'?'已珍藏':`${Math.min(i.stage+1,length)} / ${length}`}</small></div><h4>${esc(storyTitle(i))}</h4>${i.status==='active'?`<p>${esc(scene.text)}</p>${issue?note('接下来：'+issue):away?note('等同行伙伴回家，就能接着听。'):''}${cmd('继续故事',{type:'storyContinue',id:i.id,stage:i.stage},!!issue||away)}`:note(i.status==='completed'?'这段回忆已经留在家里。':'这段经历保存在伙伴的档案中。')}${i.choices.length?`<details><summary>已经发生的故事</summary>${i.choices.map(c=>note(c.result)).join('')}</details>`:''}</article>`;
}
function storyShelf(w:World,kind:'world'|'personal'|'pair'):string {
 const active=Object.values(w.stories).filter(i=>i.kind===kind&&i.status==='active'&&i.participants.length);
 const intro={world:'一位来访者，带来一段新的相遇。',personal:'伙伴有件小事，想慢慢讲给你听。',pair:'在同一个家里，两位伙伴渐渐熟悉。'}[kind];
 return active.length?storyCard(w,active[0].definition,active[0].participants)+(active.length>1?`<details class="lw-disclosure"><summary>还有 ${active.length-1} 段未读的故事</summary>${active.slice(1).map(i=>storyCard(w,i.definition,i.participants)).join('')}</details>`:''):`<div class="lw-story-invitation"><p>${intro}</p>${cmd('让故事开始',{type:'storyEncounter',kind},freeSlimes(w).length<(kind==='pair'?2:1))}</div>`;
}
function companionBar(w:World):string {
 const all=host.state().slimes;if(!all.length)return `<div class="lw-welcome"><h2>小家在等第一位伙伴</h2>${button('召唤一位伙伴','legacy','data-page="summon"')}</div>`;
 if(!all.some(s=>s.id===ui.person))ui.person=all[0].id;
 return `<div class="lw-companion-bar" aria-label="家里的伙伴">${all.map(s=>{const a=activity(w,s.id);return button(`<span class="lw-companion-portrait">${host.slimeHTML(s)}</span><span class="lw-companion-name"><b>${esc(s.name)}</b><small>${a.kind==='home'?'在家':a.kind==='work'?'帮忙中':a.kind==='trip'?'旅途中':a.kind==='battle'?'战斗中':'玩耍中'}</small></span>`,'person',`data-id="${s.id}" class="lw-companion-chip ${s.id===ui.person?'is-active':''}" aria-pressed="${s.id===ui.person}" aria-label="${esc(s.name)}"`);}).join('')}</div>`;
}
function wishCard(w:World):string {
 const i=w.stories[`wish:${ui.person}`];return i&&i.status==='active'?`<details class="lw-wish"><summary>小愿望 · ${storyRequirement(w,i)??'听听伙伴的想法'}</summary>${storyCard(w,'wish',[ui.person])}</details>`:'';
}
function facility(w:World,def:string):string {
 const selected=host.state().slimes.find(s=>s.id===ui.person),free=freeSlimes(w);
 if(def==='trough')return `<section class="lw-detail"><h3>一起吃饭</h3><p>槽内${w.inventory.containers.trough.feed??0}/99 · 仓库${w.stock.feed??0}</p>${cmd('补充基础饲料',{type:'refill'})}</section>`;
 if(def==='toys')return `<section class="lw-detail"><h3>一起玩</h3>${button('接球','play','data-kind="ball"',!selected||!free.some(s=>s.id===selected.id))}${button('叠叠乐','play','data-kind="stack"',!free.length)}${button('三消、授粉与生态观察','tab','data-tab="games"')}</section>`;
 if(def==='table')return `<section class="lw-detail"><h3>邀请聚餐</h3>${free.map(s=>`<label class="lw-meal-person"><input name="lw-meal" type="checkbox" value="${s.id}">${esc(s.name)}</label>`).join('')}${note('每两位伙伴分享一份便当；关系好的伙伴会坐在一起。')}${button('开饭','meal')}</section>`;
 if(['bed','greenhouse','house','seedbank','pollen'].includes(def))return button('种植、育种与幼体照料','tab','data-tab="nursery"');
 if(['kitchen','woodshop','alchemy','archive','compost'].includes(def))return button('制作队列与配方','tab','data-tab="workshop"');
 if(def==='memorial')return memorialGallery(w);
 if(def==='spa')return selected?cmd('邀请伙伴休息',{type:'interact',slime:selected.id,action:'rest'}):'';return '';
}
function interactions(w:World):string {
 const s=host.state().slimes.find(s=>s.id===ui.person);if(!s)return'';const available=activity(w,s.id).kind==='home';
 return `<section class="lw-detail lw-care" data-care-for="${s.id}"><div class="lw-line"><h3>${esc(s.name)}</h3>${button('成长与改名','detail',`data-id="${s.id}"`)}</div><p>${esc(s.personality)} · 体力${Math.floor(s.stamina)} · 心情${Math.floor(s.mood)} · 亲密${s.intimacy}</p><div class="lw-actions">${([['pet','抚摸'],['chat','聊天'],['feed','喂饲料'],['snack','分享小食'],['rest','休息']] as const).map(([action,text])=>cmd(text,{type:'interact',slime:s.id,action},!available)).join('')}${button('邀请玩耍','play',`data-kind="ball"`,!available)}${cmd('邀请到这个分区',{type:'relocate',slime:s.id,zone:ui.zone},!available)}</div></section>`;
}
function memorialGallery(w:World):string {return `<details class="lw-disclosure"><summary>纪念角 · ${w.memorials.length}份共同回忆</summary>${w.memorials.map(m=>`<article><h4>${esc(m.title)}</h4><p>${esc(m.participants.map(id=>host.state().slimes.find(s=>s.id===id)?.name??w.archives[id]?.name??'历史伙伴').join('、'))}</p>${note(m.text)}</article>`).join('')||note('故事留下的物件会出现在家园里。')}</details>`;}
function stories(w:World):string {
 const all=host.state().slimes,s=all.find(s=>s.id===ui.person)??all[0];if(s)ui.person=s.id;
 return `${heading('我们的伙伴','名字、经历和喜欢的角落，都属于这一只。')}<div class="lw-actions">${button('召唤伙伴','legacy','data-page="summon"')}${button('召唤师成长与任务','legacy','data-page="status"')}${button('魔物照料','legacy','data-page="monsters"')}</div>${companionBar(w)}${s?`${interactions(w)}${wishCard(w)}<details class="lw-disclosure"><summary>偏好、朋友和回忆</summary>${note('喜欢：'+companion(w,s).interest)}${Object.entries(companion(w,s).friends).map(([id,n])=>note((all.find(s=>s.id===Number(id))?.name??w.archives[id]?.name??'旧友')+' · '+n)).join('')}${companion(w,s).memories.map(m=>`<article><h4>${esc(m.title)}</h4>${note(m.text)}</article>`).join('')}</details>` :''}
 <details class="lw-disclosure"><summary>来访者的故事</summary>${storyShelf(w,'world')}</details>
 <details class="lw-disclosure"><summary>伙伴的心事</summary>${storyShelf(w,'personal')}</details>
 <details class="lw-disclosure"><summary>慢慢成为朋友</summary>${storyShelf(w,'pair')}</details>${memorialGallery(w)}
 ${Object.keys(w.archives).length?`<details class="lw-disclosure"><summary>伙伴留下的历史档案</summary>${Object.values(w.archives).map(a=>`<h4>${esc(a.name)}</h4>${a.profile.memories.map(m=>note(m.title+'：'+m.text)).join('')}`).join('')}</details>`:''}`;
}
function workshop(w:World):string {
 return `${heading('工坊与生活','制作料理、工具和纪念物，材料会在入队时预留。')}<h3>制作队列</h3>${w.crafts.map(c=>`<div class="lw-recipe"><div><b>${RECIPES.find(r=>r.id===c.recipe)?.name}</b><small>${c.ready?'可以领取':`还需 ${Math.ceil(c.remaining/60)} 分钟`}</small></div>${cmd('领取',{type:'claimCraft',id:c.id},!c.ready)}</div>`).join('')||note('在家园建造厨房、木工台或炼制台后，即可开始制作。')}
 <h3>配方目录</h3>${RECIPES.map(r=>{const p=w.placements.find(p=>p.def===r.building&&!p.stored);return `<article class="lw-recipe"><div><b>${r.name}</b><small>${BUILDINGS.find(b=>b.id===r.building)!.name} ${r.level} 级 · ${r.seconds/60} 分钟</small><p>${cost(r.cost)} → ${cost(r.output)}</p></div>${p?cmd('加入队列',{type:'craft',recipe:r.id,building:p.id},p.level<r.level||!afford(w,r.cost)):button('去建造','tab','data-tab="home"')}</article>`;}).join('')}
 <h3>使用家园补给</h3>${select('lw-supply-slime','选择伙伴',freeSlimes(w).map(s=>({id:s.id,name:s.name})))}<div class="lw-actions">${(['meal','soup','potion'] as const).map(item=>button(`${MATERIALS[item]} · ${w.stock[item]??0}`,'supply',`data-item="${item}"`,!(w.stock[item]>0)||!freeSlimes(w).length)).join('')}</div><h3>元素协作手册</h3>${COMBOS.map(c=>`<p class="lw-combo"><b>${c.elements.join(' + ')} · ${c.name}</b><span>${c.desc}</span></p>`).join('')}${note('同队两种元素均在场时触发，每队每轮一次。技能预览会显示可用协作。')}`;
}
function games(w:World):string {
 const m=w.mini;
 let play='';if(m&&!m.claimed){const heading=m.kind==='match'?'资源三消':m.kind==='pollination'?'授粉连线':'生态观察';play=`<section class="lw-detail"><div class="lw-line"><h3>${heading}</h3><b>${m.score} 分</b></div>`;
 if(m.kind==='match')play+=note(`剩余 ${m.steps} 步 · ${m.steps>10?'白天采集':'夜间防守'} · 生命 ${m.hp}/10。交换相邻方块，连成三个即可消除；夜间未消除会失去生命。`)+`<div class="lw-game-grid match">${m.board.map((v,i)=>button(['♧','◇','≈','❀','✦'][v],'mini-cell',`data-index="${i}" style="--tile:${['#89ab8d','#ad9d8c','#8bb8c8','#c995a8','#cdb36f'][v]}" aria-label="第 ${i+1} 格 ${['木材','石材','露水','花瓣','星光'][v]}" class="${m.selected===i?'chosen':''}"`,m.done)).join('')}</div>`;
 if(m.kind==='pollination')play+=note(`剩余 ${m.steps} 次连接。把相同花型连在一起，每对只授粉一次。`)+`<div class="lw-game-grid pollen">${m.board.map((v,i)=>button(['✿','❀','✾','✽','❋','✣'][v],'mini-cell',`data-index="${i}" style="--tile:hsl(${v*48} 35% 70%)" aria-label="${v+1} 号花型" class="${m.selected===i?'chosen':''}"`,m.done||m.matches.includes(i))).join('')}</div>`;
 if(m.kind==='observation'&&!m.done){const v=VISITORS[m.board[m.round]];play+=`<p>第 ${m.round+1}/5 题</p><blockquote>${v.need}；它会${v.service}。</blockquote><div class="lw-actions">${VISITORS.map((v,i)=>button(v.name,'mini-cell',`data-index="${i}"`)).join('')}</div>`;}
 if(m.done)play+=`<p>本局结束 · ${m.score} 分。每日前三局提供奖励，之后可继续练习。</p>${cmd('记录结果并领取',{type:'miniClaim'})}`;play+='</section>';}
 return `${heading('家园游乐场','每局进度自动保存，随时可以离开、回来继续。')}<div class="lw-game-options">${([['match','资源三消','白天收集，夜晚防守'],['pollination','授粉连线','寻找六对相同花型'],['observation','生态观察','根据栖地线索辨认访客']] as [Mini['kind'],string,string][]).map(([kind,title,desc])=>`<article><h3>${title}</h3><p>${desc}</p><small>今日奖励 ${Math.min(3,w.miniRewards[`${day(w)}:${kind}`]??0)}/3</small>${cmd('开始一局',{type:'miniStart',kind},!!m&&!m.claimed)}</article>`).join('')}</div>${play}${button('返回玩具区','tab','data-tab="home"')}`;
}
export function navigate(tab:string):void {ui.tab=({home:'home',journey:'explore',companions:'stories'} as Record<string,string>)[tab]??tab;ui.selected=0;ui.crop=0;ui.build='';ui.edit=false;}
export function redraw(renderPage:()=>void=()=>host.render()):void {
 const root=document.getElementById('livingWorld');
 const opened=new Set([...root?.querySelectorAll('details[open]')??[]].map(d=>d.querySelector(':scope > summary')?.textContent));
 const positions=['#content','.lw-build-items','.lw-build-groups','.lw-companion-bar'].map(selector=>{const el=document.querySelector(selector);return{selector,x:el?.scrollLeft??0,y:el?.scrollTop??0};});
 const focused=document.activeElement as HTMLElement|null,action=focused?.dataset.lw,data=focused?.dataset;
 renderPage();
 for(const d of document.querySelectorAll<HTMLDetailsElement>('#livingWorld details'))if(opened.has(d.querySelector(':scope > summary')?.textContent))d.open=true;
 for(const p of positions){const el=document.querySelector(p.selector);if(el){el.scrollLeft=p.x;el.scrollTop=p.y;}}
 if(action&&data){const command=data.command?JSON.parse(data.command) as GameCommand:null;const match=[...document.querySelectorAll<HTMLElement>('[data-lw]')].find(el=>{
  if(el.dataset.lw!==action||!['id','def','group','kind'].every(key=>el.dataset[key]===data[key]))return false;
  if(!command)return true;const next=el.dataset.command?JSON.parse(el.dataset.command):null;
  return next&&Object.entries(command).every(([key,value])=>key==='stage'||key==='chapter'||JSON.stringify(next[key])===JSON.stringify(value));
 });match?.focus({preventScroll:true});}
}
export function render(h:Host,dispatch:(c:GameCommand)=>void):string {
 host=h;issue=c=>dispatch({...c,actor:c.actor??(h.state().slimes.some(s=>s.id===ui.person)?ui.person:undefined)});const w=h.state().world!;
 if(!ui.person&&h.state().slimes.length)ui.person=h.state().slimes[0].id;
 const pages:Record<string,(w:World)=>string>={home,nursery,ecology,explore:exploration,stories,workshop,games};
 const sub=!['home','explore','stories'].includes(ui.tab);
 return `<div id="livingWorld" class="lw ${ui.edit?'lw-edit':''} ${w.reducedMotion?'lw-reduced':''}"><div class="lw-masthead"><b>${SEASONS[season(w)]}季 · 第${day(w)+1}日</b><small>${WEATHER[w.weather]} · ${night(w)?'夜晚':'白天'}</small></div>${sub?button('返回家园','tab','data-tab="home"'):''}${(pages[ui.tab]??home)(w)}${ui.tab==='home'?`${interactions(w)}<div class="lw-actions">${button('苗圃与幼体','tab','data-tab="nursery"')}${button('制作队列','tab','data-tab="workshop"')}${button('生态观察','tab','data-tab="ecology"')}</div>${memorialGallery(w)}`:''}<div class="lw-feedback" role="status">${esc(w.notices[0]??'欢迎回家')}</div><details class="lw-disclosure"><summary>生活物资与偏好</summary>${resources(w)}${cmd(w.reducedMotion?'启用动态':'减少动态',{type:'settings',reduced:!w.reducedMotion})}${cmd(w.autoReplant?'关闭自动补种':'开启自动补种',{type:'settings',replant:!w.autoReplant})}${note('离线最多推进12小时，植物不会死亡，未读的故事会等待你。')}</details></div>`;
}
const value=(id:string)=> (document.getElementById(id) as HTMLInputElement|HTMLSelectElement|null)?.value??'';
const number=(id:string)=>Number(value(id));
export function handleClick(event:Event):boolean {
 const el=(event.target as Element|null)?.closest<HTMLElement>('[data-lw]');if(!el)return false;
 lastInteraction=Date.now();const a=el.dataset.lw,w=host.state().world!;let repaint=true;
 switch(a){
 case 'region':ui.region=Number(el.dataset.region);break;
 case 'legacy':host.open?.(el.dataset.page!);return true;
 case 'detail':host.open?.('detail:'+el.dataset.id);return true;
 case 'play':host.play?.(el.dataset.kind!,ui.person);return true;

  case 'cmd':try{issue(JSON.parse(el.dataset.command!) as GameCommand);}catch{host.toast('操作数据无效');}return true;
  case 'tab':ui.tab=el.dataset.tab!;ui.build='';ui.edit=false;break;
  case 'zone':ui.zone=Number(el.dataset.zone);ui.selected=0;ui.crop=0;break;
  case 'edit':ui.edit=!ui.edit;ui.build='';ui.plant=0;break;
  case 'zoomout':ui.zoom=Math.max(.8,ui.zoom-.2);break;case 'zoomin':ui.zoom=Math.min(2,ui.zoom+.2);break;case 'zoomreset':ui.zoom=1;break;
  case 'deselect':ui.selected=0;ui.crop=0;break;
  case 'move':ui.selected=Number(el.dataset.id);ui.edit=true;ui.build='';ui.plant=0;break;
  case 'rotate':ui.selected=Number(el.dataset.id);ui.rotate=((w.placements.find(p=>p.id===ui.selected)?.rotation??0)+1)%4;ui.edit=true;ui.build='';ui.plant=0;break;
  case 'build-kind':ui.buildKind=el.dataset.kind!;ui.buildGroup=0;ui.edit=true;break;
  case 'build-group':ui.buildGroup=Number(el.dataset.group);ui.edit=true;break;
  case 'prepare-build':{const d=BUILDINGS.find(d=>d.id===el.dataset.def)??DECORATIONS.find(d=>d.id===el.dataset.def);if(!d)return true;if(!afford(w,d.cost)){host.toast('材料还不够，先采集一些木材和石材。');return true;}ui.build=d.id;ui.selected=0;ui.crop=0;ui.plant=0;ui.rotate=0;ui.edit=true;break;}
  case 'cancel-build':ui.build='';ui.selected=0;ui.crop=0;ui.plant=0;break;
  case 'path-mode':ui.build=ui.build==='path'?'':'path';ui.pathStyle=Math.max(0,ui.pathStyle);ui.edit=true;ui.selected=0;ui.plant=0;break;
  case 'path-style':ui.pathStyle=Number(el.dataset.style);ui.build='path';ui.edit=true;ui.selected=0;ui.crop=0;ui.plant=0;break;
  case 'prepare-plant':ui.plant=Number(el.dataset.id);ui.build='';ui.tab='home';ui.selected=0;ui.edit=false;host.toast('在地图上点击空地播种');break;
  case 'family':ui.family=Number(el.dataset.family);ui.plant=w.cultivars.find(v=>PLANTS.find(p=>p.id===v.species)?.family===ui.family)?.id??0;break;
  case 'choose-cultivar':ui.plant=number('lw-cultivar');break;
  case 'name-cultivar':issue({type:'cultivar',id:Number(el.dataset.id),name:value('lw-cultivar-name')});return true;
  case 'breed':issue({type:'breed',a:number('lw-parent-a'),b:number('lw-parent-b')});return true;
  case 'mentor':issue({type:'babyCare',id:Number(el.dataset.id),kind:'导师',mentor:number(`lw-mentor-${el.dataset.id}`)});return true;
  case 'resonate':issue({type:'resonate',a:number('lw-resonance-a'),b:number('lw-resonance-b')});return true;
  case 'supply':issue({type:'useSupply',item:el.dataset.item as 'meal'|'soup'|'potion',slime:number('lw-supply-slime')});return true;
  case 'assign':issue({type:'assign',slime:number('lw-worker'),building:Number(el.dataset.id)});return true;
  case 'overlay':ui.overlay=el.dataset.overlay!;break;
  case 'depart':issue({type:'depart',region:number('lw-region'),route:number('lw-route'),duration:number('lw-duration')||300,mode:el.dataset.mode as 'active'|'offline',supply:value('lw-supply') as 'feed'|'meal'||'feed',repeat:!!(document.getElementById('lw-repeat') as HTMLInputElement|null)?.checked,team:[...document.querySelectorAll<HTMLInputElement>('input[name="lw-team"]:checked')].map(e=>Number(e.value))});return true;
  case 'person':ui.person=Number(el.dataset.id);break;
  case 'meal':issue({type:'meal',ids:[...document.querySelectorAll<HTMLInputElement>('input[name="lw-meal"]:checked')].map(e=>Number(e.value))});return true;

  case 'mini-cell':issue({type:'miniCell',index:Number(el.dataset.index)});return true;
 }
 if(repaint){if(a==='tab'||a==='edit')host.render();else redraw();}
 if(a==='build-kind'||a==='build-group'){const list=document.querySelector('.lw-build-items');if(list)list.scrollTop=0;}
 if((['prepare-build','move','path-mode','edit'].includes(a??'')||a==='path-style'&&el.closest('.lw-build-catalog'))&&ui.edit)document.querySelector('.lw-scene-wrap')?.scrollIntoView({block:'start'});return true;
}
function mapAction(svg:SVGSVGElement,event:PointerEvent|MouseEvent,dragId?:number):void {
 const rect=svg.getBoundingClientRect(),[x,y]=cellFromPoint((event.clientX-rect.left)*MAP_W/rect.width,(event.clientY-rect.top)*MAP_H/rect.height);
 const person=(event.target as Element).closest<SVGElement>('[data-resident]');if(person&&!ui.edit){ui.person=Number(person.dataset.resident);host.render();return;}
 const object=(event.target as Element).closest<SVGElement>('[data-lw-object]'),crop=(event.target as Element).closest<SVGElement>('[data-lw-crop]');
 if(dragId){issue({type:'move',id:dragId,zone:ui.zone,x,y,rotation:ui.rotate});return;}
 if(object&&!ui.build){ui.plant=0;ui.selected=Number(object.dataset.lwObject);ui.crop=0;ui.rotate=host.state().world!.placements.find(p=>p.id===ui.selected)?.rotation??0;host.render();return;}
 if(crop&&!ui.build){ui.plant=0;ui.crop=Number(crop.dataset.lwCrop);ui.selected=0;host.render();return;}
 if(x<0||y<0||x>11||y>11)return;
 if(ui.build==='path')issue({type:'paint',zone:ui.zone,cells:[y*12+x],style:Math.max(0,ui.pathStyle),erase:ui.pathStyle<0||roadMap(host.state().world!,ui.zone).get(y*12+x)===ui.pathStyle});
 else if(ui.build)issue({type:'build',def:ui.build,zone:ui.zone,x,y,rotation:ui.rotate});
 else if(ui.plant)issue({type:'plant',cultivar:ui.plant,zone:ui.zone,x,y,explicit:true});
 else if(ui.edit&&ui.selected)issue({type:'move',id:ui.selected,zone:ui.zone,x,y,rotation:ui.rotate});
}
export function paintResidents():void {
 if(!host)return;const w=host.state().world!;for(const el of document.querySelectorAll<SVGElement>('[data-resident]')){const id=Number(el.dataset.resident),r=w.residents[id],a=activity(w,id);if(!r)continue;el.style.display=r.zone!==ui.zone||a.kind==='battle'||a.kind==='play'||a.kind==='trip'&&a.phase!=='resting'?'none':'';el.style.transform=`translate(${300+(r.x-r.y)*23}px,${62+(r.x+r.y)*15}px)`;const label=el.querySelector('.lw-map-sub');if(label)label.textContent=r.blocked?'道路暂时不通':r.pose;const slime=el.querySelector<HTMLElement>('.slime');if(slime)slime.dataset.mood=r.pose.includes('休息')?'sleep':r.pose==='吃饭'?'happy':'idle';}
}
export function mount():void {
 const svg=document.querySelector<SVGSVGElement>('#livingWorld .lw-map');if(!svg)return;
 let down:{x:number;y:number;id:number}|null=null,moved=false;
 /* 铺路笔画：按下时记住起点并判定铺设或擦除，移动时补齐跳过的格子，抬起时整条路只提交一次。 */
 let stroke:{cells:number[];erase:boolean;last:[number,number];layer:SVGGElement}|null=null;
 const cellAt=(e:PointerEvent):[number,number]=>{const rect=svg.getBoundingClientRect();return cellFromPoint((e.clientX-rect.left)*MAP_W/rect.width,(e.clientY-rect.top)*MAP_H/rect.height);};
 const inside=([x,y]:[number,number])=>x>=0&&y>=0&&x<12&&y<12;
 const mark=(x:number,y:number)=>{const n=y*12+x,cell=svg.querySelector(`[data-lw-cell="${x},${y}"]`);if(!stroke||stroke.cells.includes(n)||!cell)return;stroke.cells.push(n);
  const p=document.createElementNS('http://www.w3.org/2000/svg','path'),tone=PATH_TONES[Math.max(0,ui.pathStyle)];p.setAttribute('d',cell.getAttribute('d')!);
  for(const [k,v] of Object.entries(stroke.erase?{fill:'#f4c7c0','fill-opacity':'.6',stroke:'#c96f63','stroke-dasharray':'4 3'}:{fill:tone.base,'fill-opacity':'.9',stroke:tone.edge}))p.setAttribute(k,v);stroke.layer.append(p);};
 // 手指移动快时两次采样之间会跨过几格，这里沿网格一步一格补齐，保证路面不断开。
 const walk=(to:[number,number])=>{if(!stroke)return;let [x,y]=stroke.last;while(x!==to[0]||y!==to[1]){if(Math.abs(to[0]-x)>=Math.abs(to[1]-y))x+=Math.sign(to[0]-x);else y+=Math.sign(to[1]-y);if(inside([x,y]))mark(x,y);}stroke.last=to;};
 svg.addEventListener('pointerdown',e=>{lastInteraction=Date.now();
  if(ui.edit&&ui.build==='path'){const c=cellAt(e);if(!inside(c))return;const layer=document.createElementNS('http://www.w3.org/2000/svg','g');layer.setAttribute('pointer-events','none');svg.append(layer);
   stroke={cells:[],erase:ui.pathStyle<0||roadMap(host.state().world!,ui.zone).get(c[1]*12+c[0])===ui.pathStyle,last:c,layer};mark(...c);svg.setPointerCapture(e.pointerId);e.preventDefault();return;}
const p=(e.target as Element).closest<SVGElement>('[data-lw-object]');if(ui.edit&&p){down={x:e.clientX,y:e.clientY,id:Number(p.dataset.lwObject)};ui.selected=down.id;ui.rotate=host.state().world!.placements.find(p=>p.id===down!.id)?.rotation??0;svg.setPointerCapture(e.pointerId);e.preventDefault();}});
 svg.addEventListener('pointermove',e=>{if(stroke){lastInteraction=Date.now();walk(cellAt(e));return;}if(!down)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;moved=Math.hypot(dx,dy)>5;const p=svg.querySelector<SVGElement>(`[data-lw-object="${down.id}"]`);if(p){const rect=svg.getBoundingClientRect(),[x,y]=cellFromPoint((e.clientX-rect.left)*MAP_W/rect.width,(e.clientY-rect.top)*MAP_H/rect.height),old=host.state().world!.placements.find(p=>p.id===down!.id)!;p.style.opacity=placementError(host.state().world!,{...old,x,y})?'.35':'.85';}});
 svg.addEventListener('pointerup',e=>{if(stroke){const s=stroke;stroke=null;s.layer.remove();issue({type:'paint',zone:ui.zone,cells:s.cells,style:Math.max(0,ui.pathStyle),erase:s.erase});return;}if(down&&moved){mapAction(svg,e,down.id);moved=false;}else mapAction(svg,e);down=null;});
 svg.addEventListener('pointercancel',()=>{down=null;moved=false;stroke=null;host.render();});
 svg.addEventListener('keydown',e=>{const person=(e.target as Element).closest<SVGElement>('[data-resident]');if(person&&(e.key==='Enter'||e.key===' ')){ui.person=Number(person.dataset.resident);e.preventDefault();host.render();return;}if(e.key==='Enter'||e.key===' '){const p=(e.target as Element).closest<SVGElement>('[data-lw-object]'),c=(e.target as Element).closest<SVGElement>('[data-lw-crop]');if(p){ui.selected=Number(p.dataset.lwObject);ui.crop=0;}if(c){ui.crop=Number(c.dataset.lwCrop);ui.selected=0;}e.preventDefault();host.render();}});
}
