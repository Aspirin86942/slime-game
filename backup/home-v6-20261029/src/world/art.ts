import {activity,resident} from './life.ts';
import type {World,Slime,Crop,Placement,Element} from './types.ts';
import {BUILDINGS,DECORATIONS,PLANTS,ZONES,VISITORS} from './content.ts';
import {bounds,environment,night} from './ecology.ts';
import {facilityArt} from './art/facilities.ts';
import {decorArt} from './art/decor.ts';
import {plantArt} from './art/plants.ts';
import {visitorArt,FLYING_VISITORS} from './art/creatures.ts';
import {zoneDressing} from './art/regions.ts';
export const esc=(x:unknown):string=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const elementHue=(element:Element):number=>({岩:35,火:20,水:195,风:145,草:105,冰:180,雷:55,幻:280,光:45,暗:260,时间:245,空间:280}[element]);
/* 地图画布尺寸。界面把指针坐标换算成画布坐标时也用这两个值，改画布高度不会让拖放错位。 */
export const MAP_W=600,MAP_H=540;
const xy=(x:number,y:number)=>({x:300+(x-y)*23,y:62+(x+y)*15});
export function cellFromPoint(x:number,y:number):[number,number]{const dx=(x-300)/23,dy=(y-62)/15;return[Math.floor((dx+dy)/2),Math.floor((dy-dx)/2)];}
/* 把十六进制颜色向另一种颜色混合，用来从区域主色推出地砖的明暗两档。 */
function mix(a:string,b:string,t:number):string{const n=(h:string)=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const [x,y]=[n(a),n(b)];return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');}
/* 昼夜两套天色：白天是淡紫晴空、双月隐约可见；夜里双月发光，水母和萤火出现。 */
const SKY={day:['#a9b8e6','#d4cdef','#f2e2df'],night:['#15123a','#26205a','#3b3270']};
/* 旧版「小径」物件：现在小径改为拖动铺设，这里只为存档里已经摆放的旧物件保留原画法。 */
function legacySlab(variant:number,lit:boolean):string {
 const tone=['#bb9ca5','#98b3a1','#c4b38b','#a6b8cc','#b0a0c6','#d8a78c'][variant]??'#a6b8cc',accent=lit?mix(tone,'#292453',.35):tone;
 return `<ellipse cy="4" rx="23" ry="14" fill="#1d2440" opacity=".22"/><path d="M0-12l31 19L0 26-31-19Z" fill="${accent}"/><path d="M0-8l25 15L0 22-25-15ZM-12 0l25 15M12 0L-13 15" fill="none" stroke="#f6eed8" stroke-opacity=".45" stroke-width="2"/>`;
}
/* 六种路面材质的底色、路缘和纹理色，顺序与 PATH_STYLES 一致。 */
export const PATH_TONES=[
 {base:'#ddd0b0',edge:'#a8936e',dot:'#b4a07c'},
 {base:'#a9c196',edge:'#6f8f6a',dot:'#dcdccd'},
 {base:'#cfa77c',edge:'#8a6748',dot:'#9b7655'},
 {base:'#f3ebd6',edge:'#c4b28a',dot:'#d6c7a3'},
 {base:'#dcc093',edge:'#a07a4f',dot:'#d9875a'},
 {base:'#bdb8e6',edge:'#7a72b8',dot:'#fff6c8'}
];
/* 按格子编号生成固定的伪随机数，让石子、落叶每次重绘都落在同一位置。 */
const jitter=(n:number,k:number)=>{const v=Math.sin(n*127.1+k*311.7)*43758.5453;return v-Math.floor(v);};
const poly=(pts:[number,number][])=>pts.map(([u,v],i)=>{const p=xy(u,v);return `${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;}).join('')+'Z';
/* 路面自动拼接：与相邻路面贴齐；没有相邻路面的一侧向内收 0.14 格，露出草边，连起来就是一条完整的路。 */
function roadCells(roads:Map<number,number>,dark:boolean):string {
 const has=(x:number,y:number)=>x>=0&&x<12&&y>=0&&y<12&&roads.has(y*12+x),d=.14;
 let rims='',faces='',marks='';
 for(const [n,style] of roads){
  const x=n%12,y=Math.floor(n/12),t=PATH_TONES[style]??PATH_TONES[0],L=has(x-1,y),R=has(x+1,y),T=has(x,y-1),B=has(x,y+1);
  const u0=x+(L?0:d),u1=x+1-(R?0:d),v0=y+(T?0:d),v1=y+1-(B?0:d),shape=poly([[u0,v0],[u1,v0],[u1,v1],[u0,v1]]);
  const tone=(c:string)=>dark?mix(c,'#1e3058',style===5?.18:.42):c,base=tone(t.base),edge=tone(t.edge),dot=style===5?t.dot:tone(t.dot);
  // 路缘：同形状下移 2.5 像素并加粗圆角描边，让路面看起来有厚度、拐角圆润。
  rims+=`<path d="${shape}" transform="translate(0 2.5)" fill="${edge}" stroke="${edge}" stroke-width="3" stroke-linejoin="round"/>`;
  faces+=`<path data-lw-road="${n}" d="${shape}" fill="${base}" stroke="${base}" stroke-width="${L||R||T||B?1:3}" stroke-linejoin="round"/>`;
  const at=(k:number)=>xy(x+.22+jitter(n,k)*.56,y+.22+jitter(n,k+9)*.56);
  // 路线沿 x 方向延伸时木板横跨 x，否则横跨 y；白砂的耙痕与行进方向一致。
  const alongX=(L||R)&&!(T||B),line=(k:number,cross:boolean)=>{const [a,b]=cross===alongX?[xy(x+k,v0),xy(x+k,v1)]:[xy(u0,y+k),xy(u1,y+k)];return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;};
  if(style===0)marks+=[0,1,2,3].map(k=>{const p=at(k);return `<ellipse cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" rx="${(2+jitter(n,k+3)*1.6).toFixed(1)}" ry="${(1.2+jitter(n,k+5)).toFixed(1)}" fill="${k?dot:'#f7efdc'}" opacity="${k?.8:.7}"/>`;}).join('');
  if(style===1){const p=xy(x+.5,y+.5),q=at(1);marks+=`<ellipse cx="${p.x.toFixed(1)}" cy="${(p.y+.5).toFixed(1)}" rx="9" ry="5.2" fill="${edge}"/><ellipse cx="${p.x.toFixed(1)}" cy="${(p.y-.5).toFixed(1)}" rx="8.5" ry="4.6" fill="${dot}"/><ellipse cx="${(p.x-2.5).toFixed(1)}" cy="${(p.y-1.8).toFixed(1)}" rx="3.5" ry="1.4" fill="#fff" opacity=".45"/><circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="1.6" fill="${tone('#7fa86f')}"/>`;}
  if(style===2)marks+=`<path d="${line(1/3,true)}${line(2/3,true)}" stroke="${dot}" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;
  if(style===3)marks+=`<path d="${line(.35,false)}${line(.65,false)}" stroke="${dot}" stroke-width="1" stroke-linecap="round" fill="none" opacity=".9"/>`;
  if(style===4)marks+=[0,1,2].map(k=>{const p=at(k);return `<ellipse cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" rx="3.2" ry="1.6" fill="${tone(['#d9875a','#e2b25a','#c8664e'][k])}" transform="rotate(${Math.round(jitter(n,k+7)*180)} ${p.x.toFixed(1)} ${p.y.toFixed(1)})"/>`;}).join('');
  if(style===5)marks+=[0,1,2].map(k=>{const p=at(k),r=1.2+jitter(n,k+4)*1.4;return `<path d="M${p.x.toFixed(1)} ${(p.y-r*2).toFixed(1)}q${(r*.3).toFixed(1)} ${(r*1.7).toFixed(1)} ${(r*2).toFixed(1)} ${(r*2).toFixed(1)}q${(-r*1.7).toFixed(1)} ${(r*.3).toFixed(1)} ${(-r*2).toFixed(1)} ${(r*2).toFixed(1)}q${(-r*.3).toFixed(1)} ${(-r*1.7).toFixed(1)} ${(-r*2).toFixed(1)} ${(-r*2).toFixed(1)}q${(r*1.7).toFixed(1)} ${(-r*.3).toFixed(1)} ${(r*2).toFixed(1)} ${(-r*2).toFixed(1)}Z" fill="${dot}" opacity="${dark?.95:.8}"/>`;}).join('');
 }
 return `<g class="lw-roads" pointer-events="none">${rims}${faces}${marks}</g>`;
}
export function roadMap(w:World,zone:number):Map<number,number>{return new Map((w.paths[zone]??[]).map(n=>[n,w.pathStyles?.[`${zone}:${n}`]??0]));}
/* 目录里的材质样张：一段带拐角的四格小路，直接复用地图上的拼接画法。 */
export function roadPreview(style:number):string {
 return `<svg viewBox="244 54 136 92" aria-hidden="true" focusable="false"><path d="${poly([[-.15,-.15],[3.15,-.15],[3.15,2.15],[-.15,2.15]])}" fill="#a9c49c" opacity=".6"/>${roadCells(new Map([0,1,2,14].map(n=>[n,style])),false)}</svg>`;
}
/* 设施和装饰画在自己未旋转的占地上；旋转 90° 时左右镜像，正好落在交换长宽后的占地上（围栏因此能沿另一条边摆放）。 */
function building(p:Placement,selected:boolean,lit:boolean,preview=false):string {
 const d=BUILDINGS.find(d=>d.id===p.def),dec=DECORATIONS.find(d=>d.id===p.def),point=xy(p.x,p.y),[a,b]=bounds(p);
 const legacy=!d&&p.def.startsWith('decor-0-'),raw=d?facilityArt(d.id,lit,p.level):legacy?legacySlab(Number(p.def.split('-')[2])||0,lit):decorArt(p.def,lit);
 const art=p.rotation%2&&!legacy?`<g transform="scale(-1 1)">${raw}</g>`:raw;
 if(preview)return art;
 // 选中时在占地上铺一层金色菱形，比只给阴影换色更容易看清占了哪几格。
 // 点击区域只取占地菱形，画面本身也能点中；不再用高矩形，免得挡住身后格子的点击。
 const foot=`M0 -10L${23*a} ${15*a-10}L${23*(a-b)} ${15*(a+b)-10}L${-23*b} ${15*b-10}Z`,ring=selected?`<path d="${foot}" fill="#f3d485" fill-opacity=".45" stroke="#f3d485" stroke-width="2"/>`:'';
 const name=d?.name??dec?.name;
 return `<g class="lw-object ${selected?'lw-selected':''}" data-lw-object="${p.id}" role="button" tabindex="0" aria-label="${esc(name)}，等级 ${p.level}" transform="translate(${point.x} ${point.y+10})">${legacy?'<rect x="-36" y="-44" width="72" height="88" fill="transparent"/>':`<path d="${foot}" fill="transparent"/>`}${ring}${art}<title>${esc(name)} · ${p.level} 级</title>${d?`<text x="${11.5*(a-b)}" y="${15*(a+b)+3}" text-anchor="middle" class="lw-map-label">${esc(d.name)}</text>`:''}</g>`;
}
export function buildingPreview(def:string):string {
 const d=BUILDINGS.find(d=>d.id===def),[a,b]=d?.size??[1,1];
 const art=building({id:0,def,zone:0,x:0,y:0,rotation:0,level:1,stored:false},false,false,true).replace(/url\(#lw-water\)/g,'#8dcbd0').replace(/url\(#lw-window\)/g,'#ffe6a3');
 const box=def.startsWith('decor-0-')?'-65 -58 130 108':d?`${-23*b-8} -100 ${23*(a+b)+16} ${15*(a+b)+96}`:'-36 -86 72 110';
 return `<svg viewBox="${box}" aria-hidden="true" focusable="false">${art}</svg>`;
}
function cropArt(w:World,c:Crop,lit:boolean):string {
 const v=w.cultivars.find(v=>v.id===c.cultivar)!,d=PLANTS.find(p=>p.id===v.species)!,p=xy(c.x+.5,c.y+.5),top=d.family===3?-70:-58;
 // 原点就是格子中心的落地点；成熟标记和缺水提示放在植物最高处上方，果树更高。
 return `<g class="lw-crop ${c.progress>=1?'lw-ripe':''}" data-lw-crop="${c.id}" role="button" tabindex="0" aria-label="${esc(v.name)}，${Math.round(c.progress*100)}%" transform="translate(${p.x} ${p.y})"><rect x="-20" y="${top+18}" width="40" height="${-2-top}" fill="transparent"/>${plantArt(d,v.genes.color,v.genes.form,c.progress,lit)}${c.progress>=1?`<circle cy="${top+4}" r="7" fill="url(#lw-window)"/><circle cy="${top+4}" r="3.5" fill="#ffefb8"/>`:''}${c.water<=0?`<text y="${top+8}" text-anchor="middle" fill="#7fb6e3" font-size="12">水</text>`:''}<title>${esc(v.name)} · ${Math.round(c.progress*100)}%</title></g>`;
}
/* 果冻伙伴：保留原来的轮廓与表情，补上底部反光、第二个高光点和腮红，读起来更像半透明的软糖。 */
export function jelly(color:number,label:string):string {
 return `<ellipse cy="8" rx="16" ry="6" fill="#1c2340" opacity=".24"/><g class="lw-jelly-body"><path d="M-20 0C-24-10-13-32 0-32S25-11 20 0Q0 14-20 0" fill="hsl(${color} 58% 68%)" stroke="hsl(${color} 42% 52%)" stroke-width="1.2"/><path d="M-17-2Q-9 9 18 0Q0 14-17-2" fill="hsl(${color} 70% 88%)" opacity=".75"/><path d="M-19-4C-21-14-12-29 0-30" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2" stroke-linecap="round"/><ellipse cx="-8" cy="-21" rx="7" ry="3.5" fill="#fff" opacity=".72" transform="rotate(-30 -8 -21)"/><circle cx="-1" cy="-25" r="1.6" fill="#fff" opacity=".8"/><ellipse cx="-12" cy="-5" rx="3" ry="1.6" fill="hsl(${(color+330)%360} 80% 72%)" opacity=".55"/><ellipse cx="12" cy="-5" rx="3" ry="1.6" fill="hsl(${(color+330)%360} 80% 72%)" opacity=".55"/><ellipse cx="-7" cy="-10" rx="2" ry="3" fill="#2a3048"/><ellipse cx="7" cy="-10" rx="2" ry="3" fill="#2a3048"/><circle cx="-6.4" cy="-11.2" r=".7" fill="#fff"/><circle cx="7.6" cy="-11.2" r=".7" fill="#fff"/><path d="M-3-3q3 3 6 0" fill="none" stroke="#2a3048" stroke-width="1.4" stroke-linecap="round"/></g><title>${esc(label)}</title>`;
}
/* 天空：双月、远处的小浮岛；白天加薄云，夜里加星星、发光水母。坐标都在 600×540 画布内固定，不随数据变化。 */
function sky(dark:boolean):string {
 const [top,mid,bottom]=dark?SKY.night:SKY.day;
 const stars=dark?Array.from({length:34},(_,i)=>`<circle cx="${(i*137+41)%580+10}" cy="${(i*71+17)%230+8}" r="${i%5===0?1.6:.9}" fill="#efeaff" opacity="${.35+(i%4)*.15}"/>`).join(''):'';
 const jellies=dark?[[70,214,.9,0],[528,300,.7,2.2],[118,392,.6,3.6]].map(([x,y,s,d])=>`<g class="sky-jelly" style="--d:${d}"><g transform="translate(${x} ${y}) scale(${s})"><circle r="16" fill="url(#lw-glow)"/><path d="M-7 1C-7-8 7-8 7 1C5 3 3.5 1 1.8 3C0 1-1.8 3-3.5 1C-5 3-6 2.5-7 1Z" fill="#ebe3ff" fill-opacity=".9"/><path d="M-4 3q-2 6 0 12M0 3q1.5 6 0 13M4 3q2 5 0 11" stroke="#d8cbff" stroke-opacity=".6" stroke-width=".9" fill="none" stroke-linecap="round"/></g></g>`).join(''):'';
 const clouds=dark?'':`<g fill="#fff" opacity=".55"><ellipse cx="96" cy="118" rx="62" ry="13"/><ellipse cx="128" cy="108" rx="34" ry="12"/><ellipse cx="470" cy="176" rx="70" ry="12"/><ellipse cx="440" cy="168" rx="30" ry="10"/></g>`;
 const islet=(x:number,y:number,s:number,o:number)=>`<g transform="translate(${x} ${y}) scale(${s})" opacity="${o}"><path d="M0 14C8 6 22 3 36 5C48 1 64 2 76 6C88 4 97 9 100 14C93 22 83 27 76 35C68 47 59 59 51 70C44 58 37 47 28 39C18 31 7 24 0 14Z" fill="url(#lw-rock)"/><path d="M0 14C8 6 22 3 36 5C48 1 64 2 76 6C88 4 97 9 100 14C86 18 70 16 50 18C30 16 13 18 0 14Z" fill="${dark?'#5d8579':'#9cc4a2'}"/><path d="M24 8v-14m-6 6l6-6 6 6M70 7v-10" stroke="${dark?'#4d7569':'#86b48f'}" stroke-width="5" stroke-linecap="round"/></g>`;
 return `<rect width="${MAP_W}" height="${MAP_H}" rx="24" fill="url(#lw-sky)"/>${stars}${clouds}
 <circle cx="478" cy="80" r="${dark?96:70}" fill="url(#lw-halo)"/><circle cx="478" cy="80" r="30" fill="url(#lw-moonA)" opacity="${dark?1:.75}"/><circle cx="488" cy="74" r="5" fill="#b98d4f" opacity=".28"/><circle cx="470" cy="90" r="3.4" fill="#b98d4f" opacity=".22"/>
 <circle cx="410" cy="48" r="12" fill="url(#lw-moonB)" opacity="${dark?.95:.6}"/>
 ${islet(34,150,.62,dark?.75:.6)}${islet(500,236,.42,dark?.6:.5)}${jellies}`;
}
/* 浮岛岩体：地表侧面是一层泥土，下面是收窄的紫色岩石，垂根与晶石在底部发出微光。 */
function islandBody(dark:boolean,tone:string):string {
 const left=mix(tone,'#3b2f2a',dark?.62:.45),right=mix(tone,'#2c2430',dark?.7:.55);
 return `<path d="M24 260C70 330 150 400 222 444C262 470 290 496 314 522C334 494 370 452 420 400C480 344 540 306 576 260L300 440Z" fill="url(#lw-rock)"/>
 <path d="M150 382C190 420 240 452 270 486M430 372C400 404 360 440 336 476" stroke="#1b1730" stroke-opacity=".35" stroke-width="2" fill="none" stroke-linecap="round"/>
 <path d="M24 242L300 422V442L24 262Z" fill="${left}"/><path d="M300 422L576 242V262L300 442Z" fill="${right}"/>
 <path d="M24 242L300 422 576 242" fill="none" stroke="#fff" stroke-opacity="${dark?.18:.35}" stroke-width="1.5"/>
 <g stroke="#2a2442" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"><path d="M120 300q-4 18 3 34M210 360q-3 20 2 38M392 362q4 16-1 32M488 300q3 14 0 26"/></g>
 <g><circle cx="314" cy="512" r="22" fill="url(#lw-glow)"/><path d="M314 499l6 12-6 12-6-12Z" fill="#ddd1ff"/><circle cx="212" cy="404" r="12" fill="url(#lw-glow)"/><path d="M212 398l3 6-3 6-3-6Z" fill="#ddd1ff" opacity=".85"/><circle cx="420" cy="398" r="12" fill="url(#lw-glow)"/><path d="M420 392l3 6-3 6-3-6Z" fill="#ddd1ff" opacity=".85"/></g>`;
}
export function scene(w:World,zone:number,slimes:Slime[],selected:number,overlay:string,renderSlime?:(s:Slime)=>string):string {
 const dark=night(w),tone=ZONES[zone].color,dusk=(c:string)=>dark?mix(c,'#1e3058',.5):c,tileA=dusk(mix(tone,'#ffffff',.12)),tileB=dusk(mix(tone,'#ffffff',.02)),roads=roadMap(w,zone);
 let cells='';for(let y=0;y<12;y++)for(let x=0;x<12;x++){const p=xy(x,y),e=overlay?environment(w,zone,x,y,slimes):null,val=e?e[overlay as 'light'|'moisture'|'fertility'|'quality']:0;
  const fill=overlay?`hsl(${Math.round(val*1.3)} 45% ${68-val*.18}%)`:(x+y)%2===0?tileA:tileB;cells+=`<path data-lw-cell="${x},${y}" d="M${p.x} ${p.y}l23 15-23 15-23-15Z" fill="${fill}" stroke="${mix(tone,'#1f2a2a',.35)}" stroke-opacity=".22"/>`;
 }
 // 地面点缀只落在空格子：避开路面、物件占地和植物。
 const used=new Set([...roads.keys(),...w.placements.filter(p=>p.zone===zone&&!p.stored).flatMap(p=>{const[a,b]=bounds(p);return Array.from({length:a*b},(_,i)=>(p.y+Math.floor(i/a))*12+p.x+i%a);}),...w.crops.filter(c=>c.zone===zone).map(c=>c.y*12+c.x)]);
 const moonlight=`<path d="M300 62L576 242 300 422 24 242Z" fill="url(#lw-moonlight)"/>`;
 const p=w.placements.filter(p=>p.zone===zone&&!p.stored).map(p=>{const[a,b]=bounds(p);return{depth:p.x+p.y+(a+b)/2-1,art:building(p,selected===p.id,dark)};});
 const c=w.crops.filter(c=>c.zone===zone).map(c=>({depth:c.x+c.y+.6,art:cropArt(w,c,dark)}));
 const visitors=VISITORS.filter(v=>v.zone===zone&&w.visitors[v.id]).map((v,i)=>{const x=2+i*2%10,y=4+i%5,p=xy(x+.5,y+.5),art=visitorArt(v.id,dark);return{depth:x+y+.7,art:`<g transform="translate(${p.x} ${p.y})">${FLYING_VISITORS.has(v.id)?`<g class="lw-wander" style="--wander:12px;--delay:${i}s">${art}</g>`:art}<title>${v.name} · ${v.service}</title></g>`};});
 const creatures=slimes.filter(s=>{const a=activity(w,s.id);return(a.kind==='home'||a.kind==='work'||a.kind==='trip'&&a.phase==='resting')&&resident(w,s).zone===zone;}).map(s=>{const r=resident(w,s),a=xy(r.x,r.y);return{depth:r.x+r.y+.8,art:`<g class="lw-resident" data-resident="${s.id}" role="button" tabindex="0" aria-label="${esc(s.name)}，${esc(r.pose)}" style="transform:translate(${a.x}px,${a.y}px)"><foreignObject x="-36" y="-60" width="72" height="72"><div xmlns="http://www.w3.org/1999/xhtml" class="lw-original-slime">${renderSlime?renderSlime(s):''}</div></foreignObject><text y="21" class="lw-map-label" text-anchor="middle">${esc(s.name.length>8?s.name.slice(0,7)+'…':s.name)}</text><text y="34" class="lw-map-label lw-map-sub" text-anchor="middle">${r.blocked?'道路暂时不通':esc(r.pose)}</text></g>`};});
 const memorials=w.memorials.filter(m=>m.zone===zone).slice(-5).map((m,i)=>{const p=xy(i*2,11);return `<g data-memorial="${esc(m.id)}" transform="translate(${p.x} ${p.y-14})"><path d="M-8 8v-20h16V8" fill="#b397c9" stroke="#f5dba6"/><text y="2" text-anchor="middle" fill="#fff">♡</text><title>${esc(m.title+'：'+m.text)}</title></g>`;}).join('');
 const fireflies=dark?[[120,250],[210,300],[388,214],[450,330],[300,180],[256,372],[520,262],[74,276]].map(([x,y],i)=>`<circle class="lw-firefly" cx="${x}" cy="${y}" r="2.2" fill="#f7ec9f" style="--delay:${-i*.8}s"/>`).join(''):'';
 const defs=`<defs><linearGradient id="lw-sky" x2="0" y2="1"><stop stop-color="${(dark?SKY.night:SKY.day)[0]}"/><stop offset=".55" stop-color="${(dark?SKY.night:SKY.day)[1]}"/><stop offset="1" stop-color="${(dark?SKY.night:SKY.day)[2]}"/></linearGradient>
 <radialGradient id="lw-moonA" cx=".38" cy=".34" r=".78"><stop stop-color="#fffaf0"/><stop offset=".55" stop-color="#f3ddab"/><stop offset="1" stop-color="#d4aa68"/></radialGradient>
 <radialGradient id="lw-moonB" cx=".38" cy=".34" r=".78"><stop stop-color="#f5f8ff"/><stop offset=".6" stop-color="#c5d3f0"/><stop offset="1" stop-color="#8d9fcc"/></radialGradient>
 <radialGradient id="lw-halo"><stop stop-color="#f2d9a6" stop-opacity="${dark?.34:.4}"/><stop offset="1" stop-color="#f2d9a6" stop-opacity="0"/></radialGradient>
 <radialGradient id="lw-glow"><stop stop-color="#cbbaff" stop-opacity=".6"/><stop offset="1" stop-color="#cbbaff" stop-opacity="0"/></radialGradient>
 <radialGradient id="lw-window"><stop stop-color="#ffe3a0" stop-opacity=".75"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
 <radialGradient id="lw-moonlight" cx=".72" cy=".1" r=".9"><stop stop-color="#fff2cf" stop-opacity="${dark?.2:.28}"/><stop offset=".6" stop-color="#fff2cf" stop-opacity="0"/></radialGradient>
 <linearGradient id="lw-water" x2="0" y2="1"><stop stop-color="#9fdde0"/><stop offset="1" stop-color="#5aa6b4"/></linearGradient>
 <linearGradient id="lw-rock" x2="0" y2="1"><stop stop-color="${dark?'#3e3660':'#6e6496'}"/><stop offset=".6" stop-color="${dark?'#28224a':'#4d4578'}"/><stop offset="1" stop-color="${dark?'#1a172c':'#3b3462'}" stop-opacity="0"/></linearGradient></defs>`;
 return `<svg class="lw-map ${dark?'is-night':'is-day'}" viewBox="0 0 ${MAP_W} ${MAP_H}" aria-label="${ZONES[zone].name}，12 乘 12 自由布置地图" role="img">${defs}${sky(dark)}${islandBody(dark,tone)}<g>${cells}</g>${overlay?'':zoneDressing(zone,n=>!used.has(n),dark)+roadCells(roads,dark)+moonlight}${[...p,...c,...visitors,...creatures].sort((a,b)=>a.depth-b.depth).map(o=>o.art).join('')}${memorials}${fireflies}<text x="26" y="${MAP_H-18}" class="lw-map-hint">${overlay?'环境图层：数值越高，颜色越深':'点击物件查看，布置模式可拖动'}</text></svg>`;
}
