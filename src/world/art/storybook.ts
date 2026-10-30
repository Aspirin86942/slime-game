import type {PlantDef} from '../types.ts';

type Frame = [number,number,number,number];
type Atlas = {image?:string;images?:string[];width:number;height:number;frames:Frame[]};
declare const __HOME_ART__:Record<string,Atlas>;
const atlases = typeof __HOME_ART__ === 'undefined' ? {} : __HOME_ART__;
const urls = new Map<string,string>();

function rasterArt(key:string,svg:string,width:number,height:number):string {
 if(urls.has(key))return urls.get(key)!;
 if(typeof document==='undefined')return `data:image/svg+xml,${encodeURIComponent(svg)}`;
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));urls.set(key,url);
 const image=new Image();image.onload=()=>{
  try{
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const context=canvas.getContext('2d');if(!context)return;context.drawImage(image,0,0,width,height);
   canvas.toBlob(blob=>{if(!blob)return;const ready=URL.createObjectURL(blob);urls.set(key,ready);for(const node of document.querySelectorAll<SVGImageElement>('image'))if(node.getAttribute('href')===url)node.setAttribute('href',ready);},'image/png');
  }catch{/* 不支持导出时继续显示 SVG；缓存规模仅由有限的季节素材决定。 */}
 };image.src=url;return url;
}

// Repeated objects share one decoded image and one short URL in the standalone build.
export function artURL(name:string,index?:number,paint=''):string {
 const key=(index===undefined?name:`${name}/${index}`)+(paint?`/${paint}`:'');
 if(urls.has(key))return urls.get(key)!;
 const atlas=atlases[name],source=(index===undefined?atlas?.image:atlas?.images?.[index]??atlas?.image)??'';
 if(!source||typeof document==='undefined')return source;
 // 换季图片只处理一次；相同树木共用浏览器已解码的图片，拖动地图时不重复运行滤镜。
 const frame=index===undefined?null:atlas?.frames[index];
 if(paint&&frame){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${frame[2]}" height="${frame[3]}" viewBox="0 0 ${frame[2]} ${frame[3]}"><defs>${seasonFilters()}</defs><image width="100%" height="100%" href="${source}" filter="url(#${paint})"/></svg>`;
  return rasterArt(key,svg,frame[2],frame[3]);
 }
 const raw=atob(source.slice(source.indexOf(',')+1)),bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 const url=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));urls.set(key,url);return url;
}
export function sprite(sheet:string,index:number,x:number,y:number,width:number,height:number,dark=false,style='',paint=''):string {
 const atlas=atlases[sheet],f=atlas?.frames[index];if(!f)return '';
 return `<image class="painted-sprite" x="${x}" y="${y}" width="${width}" height="${height}" href="${artURL(sheet,index,paint)}" ${paint?`data-home-paint="${paint}"`:''} preserveAspectRatio="xMidYMax meet" style="${dark?'filter:brightness(.57) saturate(.78);':''}${style}" aria-hidden="true"/>`;
}
function grounded(sheet:string,index:number,cx:number,baseline:number,width:number,maxHeight:number,dark=false,style='',paint=''):string {
 const f=atlases[sheet]?.frames[index];if(!f)return '';
 const w=Math.min(width,maxHeight*f[2]/f[3]),h=w*f[3]/f[2];
 return sprite(sheet,index,cx-w/2,baseline-h,w,h,dark,style,paint);
}
export const cloudPalette=(season:number,dark:boolean)=>({
 base:(dark?['#162b43','#142940','#1a2c43','#182d46']:['#a2bdd0','#9fbcd1','#a3b9cb','#9ebacf'])[season],
 paint:`home-cloud-${season}-${dark?'night':'day'}`
});
function cloudFilter(season:number,dark:boolean):string {
 const r=dark?.18:[.84,.86,.82,.80][season],g=dark?.26:[.92,.94,.90,.92][season],b=dark?.39:1;
 return `<filter id="${cloudPalette(season,dark).paint}" color-interpolation-filters="sRGB"><feColorMatrix values="${r} 0 0 0 0 0 ${g} 0 0 ${dark?.005:0} 0 0 ${b} 0 ${dark?.015:0} 0 0 0 1 0"/></filter>`;
}
export function cloudArt(index:number,cx:number,cy:number,width:number,season:number,dark:boolean):string {
 return sprite('clouds-handpainted',index%6,cx-width/2,cy-width/3,width,width*2/3,false,'',cloudPalette(season,dark).paint);
}
/** 六朵原画错位叠成无缝纹理；昼夜与四季各合成一次，地图拖动只绘制缓存图片。 */
export function cloudTexture(season:number,dark:boolean):string {
 const key=`cloud-texture/${season}/${dark}`,cached=urls.get(key);if(cached)return cached;
 const {base,paint}=cloudPalette(season,dark),atlas=atlases['clouds-handpainted'];
 const images=Array.from({length:6},(_,i)=>`<image id="cloud-${i}" href="${atlas?.images?.[i]??''}" width="96" height="64" preserveAspectRatio="xMidYMid meet"/>`).join('');
 let clouds='';
 for(let row=-1;row<=6;row++)for(let col=-1;col<=6;col++){
  const r=(row+6)%6,c=(col+6)%6,n=r*6+c,variant=(r*7+c*11)%6;
  const scale=[.9,1,.94,.98][(n+season)%4],x=col*64+r%2*32+(n*7%13)-6,y=row*36+(n*11%9)-4;
  clouds+=`<use href="#cloud-${variant}" transform="translate(${x-48} ${y-32}) scale(${scale})"/>`;
 }
 return rasterArt(key,`<svg xmlns="http://www.w3.org/2000/svg" width="768" height="432" viewBox="0 0 384 216"><defs>${images}${cloudFilter(season,dark)}</defs><rect width="384" height="216" fill="${base}"/><g filter="url(#${paint})">${clouds}</g></svg>`,768,432);
}
const facilityNames=['house','kitchen','table','spa','bed','greenhouse','pollen','seedbank','grove','compost','insects','observe','channel','pond','filter','waterbed','woodshop','alchemy','expedition','training','archive','stars','resonance','memorial','trough','toys'];
// 可升级设施的 2、3 级形态：每张图集 8 座设施，每座的 2 级、3 级图并排，生成时同一建筑的外观更一致。
export const GROWN_FACILITIES=facilityNames.filter(id=>id!=='expedition'&&id!=='resonance');
export const GROWN_SHEETS=['facilities-c','facilities-d','facilities-e'];
// 资源建筑：每张图集三行，每行是同一建筑的 1、2、3 级，三档出自同一张图，外观一致。
const ESTATE_FACILITIES=['quarry','mine','apiary','spring','warehouse','market'];
function estateFrame(def:string,form:number):[string,number]|null {
 const k=ESTATE_FACILITIES.indexOf(def);if(k<0)return null;
 return [k<3?'facilities-f':'facilities-g',(k%3)*3+Math.max(1,Math.min(3,form))-1];
}
function baseFrame(def:string):[string,number]|null {
 const estate=estateFrame(def,1);if(estate)return estate;
 const index=facilityNames.indexOf(def);
 if(index>=0)return [index<16?'facilities-a':'facilities-b',index%16];
 const match=/^decor-([1-7])-([0-5])$/.exec(def);
 if(!match)return null;
 const i=(Number(match[1])-1)*6+Number(match[2]);
 return [['decor-a','decor-b','decor-c'][Math.floor(i/16)],i%16];
}
export function grownFrame(def:string,form:number):[string,number]|null {
 if(form>=2&&ESTATE_FACILITIES.includes(def))return estateFrame(def,form);
 const k=GROWN_FACILITIES.indexOf(def);if(k<0||form<2)return null;
 return [GROWN_SHEETS[Math.floor(k/8)],(k%8)*2+form-2];
}
// 新形态图未到位时退回 1 级图，按新占地等比例放大，游戏照常可玩。
export function objectFrame(def:string,form=1):[string,number]|null {
 const grown=grownFrame(def,form);
 return grown&&atlases[grown[0]]?.frames[grown[1]]?grown:baseFrame(def);
}
export function objectPreview(def:string,form=1):string {
 const frame=objectFrame(def,form);if(!frame||!atlases[frame[0]])return '';
 return `<svg viewBox="0 0 100 90" aria-hidden="true">${sprite(...frame,6,4,88,80)}</svg>`;
}
/* 夜间暖光位置：相对于实际绘制的图片，x 从左、y 从上按比例取值，图片放大或换形态时光点跟着窗户走。
   键为「设施:形态」；新形态图未到位时画面用的是 1 级图，光点也取 1 级位置。 */
const LAMPS:Record<string,[number,number][]>={
 'house:1':[[.642,.73]],'kitchen:1':[[.5,.755]],
 'house:2':[[.61,.70],[.81,.70]],'house:3':[[.27,.48],[.76,.43],[.73,.76]],
 'kitchen:2':[[.72,.78],[.11,.55],[.86,.58]],'kitchen:3':[[.35,.72],[.72,.72]],
 'table:2':[[.25,.30],[.72,.30]],'table:3':[[.13,.49],[.5,.38],[.9,.5]],
 'spa:3':[[.45,.34],[.77,.34],[.15,.78]],'bed:3':[[.11,.57],[.89,.58]],
 'greenhouse:2':[[.46,.62],[.76,.59]],'greenhouse:3':[[.5,.7],[.1,.76],[.86,.73]],
 'pollen:2':[[.23,.45]],'pollen:3':[[.19,.59],[.85,.58]],
 'seedbank:2':[[.12,.47]],'seedbank:3':[[.67,.30],[.36,.29],[.72,.70]],
 'grove:3':[[.25,.57],[.88,.56],[.82,.68]],'compost:3':[[.9,.45]],
 'insects:3':[[.06,.65],[.94,.65]],'observe:2':[[.9,.29]],'observe:3':[[.18,.38],[.5,.40],[.11,.9]],
 'pond:3':[[.85,.39]],'waterbed:3':[[.83,.55],[.11,.72]],
 'woodshop:2':[[.2,.48],[.79,.40]],'woodshop:3':[[.14,.60],[.74,.65],[.48,.63]],
 'alchemy:2':[[.11,.44]],'alchemy:3':[[.51,.51],[.21,.78],[.67,.75]],
 'training:2':[[.28,.30],[.72,.22]],'training:3':[[.21,.43],[.76,.45],[.51,.36]],
 'archive:2':[[.18,.68],[.68,.70]],'archive:3':[[.30,.50],[.77,.51],[.3,.8],[.82,.81]],
 'stars:2':[[.21,.31],[.78,.61]],'stars:3':[[.13,.54],[.92,.53]],
 'memorial:2':[[.11,.53],[.87,.53],[.46,.63]],'memorial:3':[[.08,.56],[.93,.56],[.5,.67]],
 'trough:3':[[.19,.54]],
 'quarry:2':[[.14,.6]],'quarry:3':[[.47,.6]],'mine:1':[[.62,.48]],'mine:2':[[.12,.51],[.61,.49],[.39,.53]],'mine:3':[[.2,.66],[.71,.66],[.46,.65]],
 'apiary:2':[[.13,.33]],'apiary:3':[[.59,.54],[.86,.54],[.49,.23]],'spring:2':[[.31,.35]],'spring:3':[[.23,.44],[.77,.44],[.51,.44]],
 'warehouse:1':[[.82,.46]],'warehouse:2':[[.15,.58],[.6,.58],[.33,.25]],'warehouse:3':[[.61,.3],[.27,.72],[.61,.72],[.81,.77]],
 'market:2':[[.1,.37],[.86,.37]],'market:3':[[.05,.44],[.7,.44],[.55,.44]]
};
const lamps=(def:string,form:number,frame:[string,number])=>LAMPS[`${def}:${ESTATE_FACILITIES.includes(def)?form:frame[0]===grownFrame(def,form)?.[0]?form:1}`]??[];
export function paintedObject(def:string,a:number,b:number,dark:boolean,form=1,season=-1,lit=dark):string {
 const frame=objectFrame(def,form);if(!frame)return '';
 const decor=def.startsWith('decor-'),fence=def.startsWith('decor-1-');
 const base=fence?25:b*48-10,width=fence?53:decor?57:a*48+10,maxHeight=fence?40:decor?76:b*48+76;
 const f=atlases[frame[0]]?.frames[frame[1]];
 const w=f?Math.min(width,maxHeight*f[2]/f[3]):width,h=f?w*f[3]/f[2]:maxHeight;
 let art=grounded(...frame,a*24,base,width,maxHeight,false,'',season===3?'home-snowcap':'');
 art=`<g class="home-building-art" ${dark?'style="filter:brightness(.57) saturate(.78)"':''}>${art}</g>`;
 if(season>=0&&!decor){
  const left=a*24-w*.36,right=a*24+w*.38;
  let detail='';
  if(season===0)detail=grounded('facilities-b',14,left,base+2,w*.28,h*.25,dark,'','home-blossom')+grounded('facilities-b',14,right,base+2,w*.24,h*.22,dark);
  if(season===1)detail=grounded('facilities-b',12,left,base+2,w*.28,h*.22,dark)+grounded('facilities-b',14,right,base+2,w*.22,h*.2,dark);
  if(season===2)detail=Array.from({length:7},(_,i)=>{const x=a*24-w*.45+((i*37)%97)/100*w,y=base-3+(i*7%13);return `<g transform="translate(${x} ${y}) rotate(${i*79%230})"><path d="M-4 1Q-5-5 3-7Q7 0-4 1Z" fill="${['#ed8738','#e7b44c','#d96142'][i%3]}"/><path d="m-4 1 6-6" stroke="#a86a36" stroke-width=".5"/></g>`;}).join('');
  art+=`<g class="home-season-detail" data-season="${season}" pointer-events="none" ${dark?'style="filter:brightness(.76)"':''}>${detail}</g>`;
 }
 if(lit&&(def.startsWith('decor-2-')||lamps(def,form,frame).length))art=`<ellipse class="home-lamp-pool" cx="${a*24}" cy="${base+3}" rx="${Math.max(28,w*.55)}" ry="${Math.max(12,w*.19)}" fill="url(#lw-window)" opacity="${season===3?'.38':'.24'}" pointer-events="none"/>`+art;
 if(lit&&def.startsWith('decor-2-'))art+=`<ellipse class="home-lamplight" cx="${a*24}" cy="${base-26}" rx="23" ry="27" fill="url(#lw-window)" opacity=".6" pointer-events="none"/>`;
 else if(lit&&!decor){
  const f=atlases[frame[0]]?.frames[frame[1]];
  // 多窗建筑缩小每盏光晕，避免光点叠加盖住墙面和窗框细节。
  if(f){const w=Math.min(width,maxHeight*f[2]/f[3]),h=w*f[3]/f[2],r=Math.min(1.5,w/106)*(frame[0]===grownFrame(def,form)?.[0]||ESTATE_FACILITIES.includes(def) ? .6 : 1);
   art+=lamps(def,form,frame).map(([fx,fy])=>`<ellipse class="home-lamplight" cx="${(a*24-w/2+fx*w).toFixed(1)}" cy="${(base-h+fy*h).toFixed(1)}" rx="${(23*r).toFixed(1)}" ry="${(27*r).toFixed(1)}" fill="url(#lw-window)" opacity=".46" pointer-events="none"/>`).join('');}
 }
 return art;
}
export function plantFrame(def:PlantDef):[string,number] {
 if(def.id==='glowflower')return ['plants-c',3];
 const match=/^(?:plant|hybrid)-(\d)-(\d)$/.exec(def.parents?.[0]??def.id);
 const index=match?Number(match[1])*6+Number(match[2]):0;
 if(index===32)return ['plants-b',16];
 return index<16?['plants-a',index]:index<32?['plants-b',index-16]:['plants-c',index-33];
}
export function paintedPlant(def:PlantDef,hue:number,form:number,progress:number,dark:boolean,season=-1):string {
 const p=Math.max(0,Math.min(1,progress)),family=def.family;
 let frame=plantFrame(def),scale=.7+.3*p;
 if(p<.15){frame=['plants-c',9];scale=.55;}
 else if(p<.4){frame=['plants-c',family===3?6:family===4?7:family===5?8:4];scale=.55+(p-.15);}
 else if(p<.7){frame=['plants-c',family===3?6:family===4?7:family===5?8:5];scale=.65+(p-.4);}
 const size=(.85+Math.max(1,Math.min(5,form))*.05)*scale,tree=family===3&&p>=.4;
 const shift=((hue-def.color+540)%360)-180;
 const filters=[dark?'brightness(.57) saturate(.78)':'',p>=.7&&p<1?'saturate(.72)':'',shift?`hue-rotate(${shift}deg)`:''].filter(Boolean).join(' ');
 const filter=filters?`filter:${filters};`:'';
 const paint=tree?['home-blossom','','home-autumn','home-frost'][season]??'':'';
 let art=grounded(...frame,0,3,(tree?76:40)*size,(tree?90:49)*size,false,filter,paint);
 if(def.id==='glowflower'&&p>=.7&&dark)art+=`<ellipse cx="0" cy="-24" rx="23" ry="27" fill="url(#lw-window)" opacity=".36" pointer-events="none"/>`;
 return art;
}
export function plantPreview(def:PlantDef,hue=def.color,form=2):string {
 return `<svg viewBox="${def.family===3?'-45 -95 90 104':'-26 -54 52 62'}" aria-hidden="true">${paintedPlant(def,hue,form,1,false)}</svg>`;
}
export function natureArt(kind:'tree'|'fruit'|'bush'|'rock'|'flowers'|'reeds',size:number,dark:boolean,season=1,variant=0):string {
 const i=['tree','fruit','bush','rock','flowers','reeds'].indexOf(kind),tree=i<2;
 if(season===3&&i<=2&&atlases['nature-winter'])return grounded('nature-winter',i,0,4,(tree?103:63)*size,(tree?116:58)*size,dark);
 // 春季果树开花，秋季果树结果；四季共用原画的树干与轮廓。
 const index=kind==='fruit'&&season!==2?10:10+i;
 const filter=season===0&&kind!=='rock'?(variant%3===0||kind==='fruit'?'home-blossom':'home-spring'):season===2&&kind!=='rock'?'home-autumn':season===3?(tree||kind==='bush'?'home-frost':'home-snowcap'):'';
 return grounded('facilities-b',index,0,4,(tree?103:kind==='bush'?63:45)*size,(tree?116:58)*size,dark,'',filter);
}
/** 只给原画中偏绿的叶片换色，保留木头、石头和透明边缘。 */
export function seasonFilters():string {
 const palettes:Record<string,string>={
  spring:'.85 .15 0 0 .015 0 1.14 0 0 .02 0 .1 .9 0 0',
  blossom:'.25 .65 .1 0 .3 .12 .35 .08 0 .12 .2 .3 .25 0 .24',
  autumn:'.35 .8 .05 0 .09 .08 .55 .04 0 .035 .06 .12 .14 0 .015',
  frost:'.12 .25 .08 0 .32 .08 .3 .08 0 .38 .07 .26 .14 0 .44'
 };
 const foliage=Object.entries(palettes).map(([name,matrix])=>`<filter id="home-${name}" color-interpolation-filters="sRGB" x="-5%" y="-5%" width="110%" height="110%"><feColorMatrix in="SourceGraphic" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 -3 5 -1 0 -.5" result="green"/><feComposite in="green" in2="SourceAlpha" operator="in" result="foliage"/><feColorMatrix in="SourceGraphic" values="${matrix} 0 0 0 1 0" result="tint"/><feComposite in="tint" in2="foliage" operator="in" result="leaves"/><feComposite in="SourceGraphic" in2="foliage" operator="out" result="wood"/><feComposite in="wood" in2="leaves" operator="arithmetic" k2="1" k3="1" result="tree"/>${name==='frost'?'<feColorMatrix in="SourceGraphic" values="0 0 0 0 .92 0 0 0 0 .94 0 0 0 0 .95 2 3 1 0 -2.2"/><feComposite in2="foliage" operator="in" result="snow"/><feMerge><feMergeNode in="tree"/><feMergeNode in="snow"/></feMerge>':''}</filter>`).join('');
 // 沿原画实际轮廓向下取一条边，积雪会贴着不同形态的屋顶、栏杆和树叶。
 return foliage+Array.from({length:4},(_,s)=>cloudFilter(s,false)+cloudFilter(s,true)).join('')+`<filter id="home-snowcap" color-interpolation-filters="sRGB" primitiveUnits="objectBoundingBox" x="-5%" y="-10%" width="110%" height="120%"><feOffset in="SourceAlpha" dy=".035" result="lower"/><feComposite in="SourceAlpha" in2="lower" operator="out" result="edge"/><feColorMatrix in="SourceGraphic" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 3 -1.3 -1.1 0 -.6" result="warm"/><feFlood x="0" y="0" width="1" height=".55" flood-color="#fff" result="top"/><feGaussianBlur in="top" stdDeviation=".005 .035" result="softTop"/><feComposite in="warm" in2="softTop" operator="in" result="roof"/><feComposite in="roof" in2="SourceAlpha" operator="in" result="roofMask"/><feComposite in="edge" in2="roofMask" operator="arithmetic" k2="1" k3=".88" result="snowMask"/><feFlood flood-color="#a4b8cc"/><feComposite in2="snowMask" operator="in"/><feOffset dy=".009" result="snowShade"/><feFlood flood-color="#e8eeed"/><feComposite in2="snowMask" operator="in" result="snow"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="snowShade"/><feMergeNode in="snow"/></feMerge></filter>`;
}
/** items-a 图集：新物料、桥接物品、科技分支、家园等级旗与开垦路牌。 */
export const ITEM_ICONS:Record<string,number>={ore:0,ingot:1,honey:2,essence:3,stardust:4,net:5,expPotion:6,treasure:7,notes:8,'branch-0':9,'branch-1':10,'branch-2':11,'branch-3':12,'branch-4':13,prosperity:14,clearing:15};
const MATERIAL_ICONS:Record<string,number>={wood:10,stone:11,dew:12,feed:13,build:14,gather:15};
/** 有绘本图标的物品；其余物品在界面上用文字名。 */
export const hasArtIcon=(kind:string)=>kind in ITEM_ICONS||kind in MATERIAL_ICONS;
/** 地图上的产出气泡直接嵌入 32×32 的绘本图标。 */
export function artGlyph(kind:string):string {
 if(kind in ITEM_ICONS&&atlases['items-a'])return sprite('items-a',ITEM_ICONS[kind],0,0,32,32);
 return kind in MATERIAL_ICONS?sprite('decor-c',MATERIAL_ICONS[kind],0,0,32,32):'';
}
/** 设施图在占地内的顶边（相对放置原点），用于把气泡放在屋顶上方。 */
export function artTop(def:string,a:number,b:number,form=1):number {
 const frame=objectFrame(def,form),f=frame&&atlases[frame[0]]?.frames[frame[1]];if(!f)return -40;
 const base=b*48-10,width=a*48+10,maxHeight=b*48+76,w=Math.min(width,maxHeight*f[2]/f[3]);
 return base-w*f[3]/f[2];
}
export function artIcon(kind:string):string {
 const material=MATERIAL_ICONS;
 let art='';
 if(kind in ITEM_ICONS&&atlases['items-a'])art=sprite('items-a',ITEM_ICONS[kind],0,0,32,32);
 else if(kind in material)art=sprite('decor-c',material[kind],0,0,32,32);
 else if(kind==='home')art=sprite('facilities-a',0,0,0,32,32);
 else if(kind==='plants'||kind==='status')art=sprite('plants-c',4,0,0,32,32);
 else if(kind==='craft')art=sprite('facilities-b',0,0,0,32,32);
 else if(kind==='storage'||kind==='bag')art=sprite('decor-c',9,0,0,32,32);
 else if(kind==='ecology')art=sprite('decor-b',15,0,0,32,32);
 else if(kind==='space')art='<path d="M4 22C2 13 8 5 16 5s14 8 12 17c-2 8-22 8-24 0" fill="#e7c68a" stroke="#9c794c" stroke-width="1.4"/><ellipse cx="11" cy="17" rx="1.3" ry="2" fill="#493c28"/><ellipse cx="21" cy="17" rx="1.3" ry="2" fill="#493c28"/><ellipse cx="11" cy="10" rx="3" ry="1.8" fill="#fff6db"/>';
 else if(kind==='summon')art='<path d="m16 3 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" fill="#f5d98b" stroke="#8f733f" stroke-width="1.5"/>';
 else if(kind==='travel')art='<path d="m3 7 9-3 8 4 9-3v23l-9 3-8-4-9 3Z" fill="#c2d1a5" stroke="#526951" stroke-width="1.5"/><path d="M12 4v23m8-19v23" stroke="#6b8263"/><path d="m6 18 4-4 6 4 7-7" fill="none" stroke="#b18a52" stroke-width="2"/>';
 else if(kind==='more')art='<g fill="currentColor"><circle cx="6" cy="16" r="2"/><circle cx="16" cy="16" r="2"/><circle cx="26" cy="16" r="2"/></g>';
 return `<svg class="home-art-icon" viewBox="0 0 32 32" aria-hidden="true">${art}</svg>`;
}

export const ROAD_COLORS=[['#d0bb90','#ead8ac','#b09e79'],['#a4ab8d','#c5c7a9','#798b70'],['#bd9163','#d7af7d','#8b6b49'],['#e2d5b2','#f5e8ca','#c6b58e'],['#ac9669','#c8ac73','#8d7958'],['#819d9b','#b5c4af','#577a7c']];
export function pathPatterns():string {
 if(atlases.paths)return ROAD_COLORS.map((_,i)=>`<pattern id="home-road-${i}" width="104" height="104" patternUnits="userSpaceOnUse">${sprite('paths',i,0,0,104,104)}</pattern>`).join('');
 return ROAD_COLORS.map(([base,light,edge],i)=>{
  let detail='';
  if(i<2)detail=Array.from({length:16},(_,n)=>{const x=n%4*26+(Math.floor(n/4)%2?9:0)-8,y=Math.floor(n/4)*26-7;return `<path d="M${x+3} ${y+2}l17 -1 4 7 -3 16 -18 1 -3 -9Z" fill="${n%3===0?light:base}" stroke="${edge}" stroke-width="1.2"/><path d="M${x+5} ${y+4}h13" stroke="${light}" stroke-width="1.4" opacity=".7"/>`;}).join('');
  else if(i===2)detail=Array.from({length:6},(_,n)=>`<rect x="0" y="${n*17}" width="104" height="15.5" rx="1.4" fill="${n%2?base:light}"/><path d="M8 ${n*17+5}q18 -3 34 0t36 0" fill="none" stroke="${edge}" opacity=".48"/><circle cx="4" cy="${n*17+8}" r="1" fill="${edge}"/>`).join('');
  else detail=Array.from({length:45},(_,n)=>{const x=(n*37)%104,y=(n*61)%104;return i===4?`<path d="M${x} ${y}q8 -8 12 -2q-5 8-12 2Z" fill="${['#bc965f','#caa365','#96855b'][n%3]}"/>`:i===5&&n%6===0?`<path d="m${x} ${y} 1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5Z" fill="${light}" opacity=".8"/>`:`<ellipse cx="${x}" cy="${y}" rx="${n%3+.6}" ry=".7" fill="${n%2?light:edge}" opacity=".4"/>`;}).join('');
  return `<pattern id="home-road-${i}" width="104" height="104" patternUnits="userSpaceOnUse"><rect width="104" height="104" fill="${base}"/>${detail}</pattern>`;
 }).join('');
}
export function pathPreview(style:number):string {
 return `<svg class="road-swatch" viewBox="0 0 100 80" aria-hidden="true"><defs>${pathPatterns().replaceAll('home-road-','preview-road-')}</defs><rect width="100" height="80" rx="12" fill="#a6b887"/><path d="M-10 56H55V-10" fill="none" stroke="url(#preview-road-${style})" stroke-width="32" stroke-linejoin="round"/></svg>`;
}
