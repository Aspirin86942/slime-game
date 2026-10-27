import type {World,Slime,Crop,Placement,Element} from './types.ts';
import {BUILDINGS,DECORATIONS,PLANTS,ZONES,VISITORS} from './content.ts';
import {bounds,environment,night} from './ecology.ts';
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
function building(p:Placement,selected:boolean,lit:boolean):string {
 const d=BUILDINGS.find(d=>d.id===p.def),dec=DECORATIONS.find(d=>d.id===p.def),point=xy(p.x,p.y),[a,b]=bounds(p),width=(a+b)*19;
 const n=(c:string)=>lit?mix(c,'#2a2c5e',.38):c,roof=n(['#c98a6a','#7fae8c','#6c9eae','#c99a6f','#86aac4','#a08fc9'][d?.zone??p.zone]);
 const base=`<ellipse cy="4" rx="${width*.6}" ry="14" fill="#1d2440" opacity=".22"/>`;
 const glow=lit?'<circle cx="16" cy="10" r="22" fill="url(#lw-window)"/>':'';
 let art='';
 if(!d)art=dec?.group===0?`<path d="M0 0l23 15-23 15-23-15Z" fill="${n('#e3d6b6')}"/><path d="M0 4l15 10-15 10-15-10Z" fill="${n('#cdbf9e')}" opacity=".6"/>`:`<path d="M-12 0v-17h24V0" fill="${roof}"/><path d="M-12-17h24" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/><path d="M0-17v-18" stroke="#d9bd92" stroke-width="3" stroke-linecap="round"/><text y="-20" text-anchor="middle" font-size="22" fill="#fff3ce">${esc(dec?.icon)}</text>`;
 else if(['pond','spa','filter','waterbed'].includes(d.id))art=`<ellipse cy="-4" rx="32" ry="20" fill="${n('#c9c4b4')}"/><ellipse cy="-6" rx="29" ry="17" fill="${n('#a49f90')}"/><ellipse cy="-8" rx="27" ry="15" fill="url(#lw-water)"/><path d="M-14-9q10-8 24 0M-10-2q12-5 22 0" fill="none" stroke="#effbf6" stroke-opacity=".8" stroke-width="2" stroke-linecap="round"/>${lit?'<ellipse cx="6" cy="-10" rx="9" ry="3" fill="#f6e3b0" opacity=".55"/>':''}`;
 else if(['bed','grove','compost','channel'].includes(d.id))art=`<path d="M-28-6L0-22 30-6 0 12Z" fill="${n('#b08766')}"/><path d="M-28-6v10L0 21V12Z" fill="${n('#8a6d55')}"/><path d="M0 21l30-16V-6L0 12Z" fill="${n('#735a47')}"/><path d="M-17-5L0-15 20-5 0 6Z" fill="#5d5340"/><path d="M-11-6v-15m20 19v-23" stroke="#7fb574" stroke-width="4" stroke-linecap="round"/><ellipse cx="-16" cy="-19" rx="7" ry="4" fill="#b6e0a4"/><ellipse cx="14" cy="-24" rx="8" ry="5" fill="#c4e19a"/><ellipse cx="-2" cy="-14" rx="5" ry="3" fill="#a6d48f"/>`;
 else if(['resonance','stars','insects'].includes(d.id))art=`<path d="M-18 0l18-45 20 39L0 8Z" fill="${roof}"/><path d="M0-45v53L20-6Z" fill="#f2ead8" opacity=".55"/><circle cy="-27" r="9" fill="url(#lw-window)" opacity="${lit?1:.5}"/><circle cy="-27" r="4.5" fill="#fff6d2"/>`;
 else art=`<path d="M-28-10v29L0 34V4Z" fill="${n('#efe2c6')}"/><path d="M0 4v30l30-16V-12Z" fill="${n('#c8b99d')}"/><path d="M-35-11L0-39 36-12 0 8Z" fill="${roof}"/><path d="M0-39V8l36-20Z" fill="#1b2140" opacity=".2"/><path d="M-33-11L0 8 34-12" fill="none" stroke="#fff3dc" stroke-opacity=".7" stroke-width="2" stroke-linejoin="round"/><path d="M-18 6v15l10 6V11Z" fill="${n('#6f6658')}"/><path d="M11 9v8l10-6V3Z" fill="${lit?'#ffd98a':'#fff0c4'}"/><path d="M22-27v-9h6v12" fill="${n('#b9a68a')}"/>${glow}`;
 return `<g class="lw-object ${selected?'lw-selected':''}" data-lw-object="${p.id}" role="button" tabindex="0" aria-label="${esc(d?.name??dec?.name)}，等级 ${p.level}" transform="translate(${point.x} ${point.y+10})"><rect x="-36" y="-44" width="72" height="88" fill="transparent"/>${base}${art}<title>${esc(d?.name??dec?.name)} · ${p.level} 级</title>${d?`<text y="47" text-anchor="middle" class="lw-map-label">${esc(d.name)}</text>`:''}</g>`;
}
function cropArt(w:World,c:Crop):string {
 const v=w.cultivars.find(v=>v.id===c.cultivar)!,d=PLANTS.find(p=>p.id===v.species)!,p=xy(c.x+.5,c.y+.5),s=(.45+Math.min(1,c.progress)*.7)*(.82+v.genes.form*.09),fill=`hsl(${v.genes.color} 62% 74%)`;
 let art=`<path d="M0 0v-25M0-10q-17-15-15-5 0 8 15 5M0-15q17-15 15-5 0 8-15 5" fill="#7cb98e" stroke="#4a8a6c" stroke-width="2" stroke-linejoin="round"/>`;
 if(c.progress>=.7)art+=d.family===4?`<path d="M-15-20q0-26 30 0Z" fill="${fill}"/><circle cx="-5" cy="-25" r="2" fill="#fff6df"/>`:d.family===3?`<circle cy="-30" r="17" fill="#6fa47c"/><circle cx="-5" cy="-36" r="7" fill="#8cc095" opacity=".7"/><circle cx="7" cy="-31" r="5" fill="${fill}"/><circle cx="-8" cy="-25" r="5" fill="${fill}"/>`:`<g transform="translate(0 -26)"><circle cx="-7" r="7" fill="${fill}"/><circle cx="7" r="7" fill="${fill}"/><circle cy="-7" r="7" fill="${fill}"/><circle cy="7" r="7" fill="${fill}"/><circle r="4" fill="#f9e3a4"/></g>`;
 return `<g class="lw-crop ${c.progress>=1?'lw-ripe':''}" data-lw-crop="${c.id}" role="button" tabindex="0" aria-label="${esc(v.name)}，${Math.round(c.progress*100)}%" transform="translate(${p.x} ${p.y+8})"><ellipse rx="13" ry="6" fill="#5a4636" opacity=".32"/><g transform="scale(${s})">${art}</g>${c.progress>=1?'<circle cy="-42" r="7" fill="url(#lw-window)"/><circle cy="-42" r="3.5" fill="#ffefb8"/>':''}${c.water<=0?'<text y="-40" text-anchor="middle" fill="#7fb6e3" font-size="12">水</text>':''}<title>${esc(v.name)} · ${Math.round(c.progress*100)}%</title></g>`;
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
export function scene(w:World,zone:number,slimes:Slime[],selected:number,overlay:string):string {
 const dark=night(w),tone=ZONES[zone].color,dusk=(c:string)=>dark?mix(c,'#1e3058',.5):c,tileA=dusk(mix(tone,'#ffffff',.12)),tileB=dusk(mix(tone,'#ffffff',.02)),pathTile=dark?'#8c86a8':'#e6d6b0';
 let cells='';for(let y=0;y<12;y++)for(let x=0;x<12;x++){const p=xy(x,y),path=(w.paths[zone]??[]).includes(y*12+x),e=overlay?environment(w,zone,x,y,slimes):null,val=e?e[overlay as 'light'|'moisture'|'fertility'|'quality']:0;
  const fill=overlay?`hsl(${Math.round(val*1.3)} 45% ${68-val*.18}%)`:path?pathTile:(x+y)%2===0?tileA:tileB;cells+=`<path data-lw-cell="${x},${y}" d="M${p.x} ${p.y}l23 15-23 15-23-15Z" fill="${fill}" stroke="${mix(tone,'#1f2a2a',.35)}" stroke-opacity=".22"/>`;
 }
 const moonlight=`<path d="M300 62L576 242 300 422 24 242Z" fill="url(#lw-moonlight)"/>`;
 const p=w.placements.filter(p=>p.zone===zone&&!p.stored).map(p=>({depth:p.x+p.y,art:building(p,selected===p.id,dark)}));
 const c=w.crops.filter(c=>c.zone===zone).map(c=>({depth:c.x+c.y+.6,art:cropArt(w,c)}));
 const visitors=VISITORS.filter(v=>v.zone===zone&&w.visitors[v.id]).map((v,i)=>{const p=xy(2+i*2%10,4+i%5);return `<g transform="translate(${p.x} ${p.y-30})"><g class="lw-wander" style="--wander:12px;--delay:${i}s"><ellipse cx="-4" rx="5" ry="3" fill="#fff0b2"/><ellipse cx="4" rx="5" ry="3" fill="#edd2a2"/><path d="M0-3v7" stroke="#667753" stroke-width="2"/><title>${v.name} · ${v.service}</title></g></g>`;}).join('');
 const creatures=slimes.filter(s=>!w.trips.some(t=>t.team.includes(s.id))&&(!w.workers.some(j=>j.slimeId===s.id)||w.workers.some(j=>j.slimeId===s.id&&w.placements.some(p=>p.id===j.building&&p.zone===zone)))).slice(0,12).map((s,i)=>{const job=w.workers.find(j=>j.slimeId===s.id),place=job?w.placements.find(p=>p.id===job.building):null;const a=place?xy(Math.min(11,place.x+1),Math.min(11,place.y+2)):xy(3+i%4+Math.floor(i/4),8-i%4+Math.floor(i/4));const activity=place?BUILDINGS.find(b=>b.id===place.def)?.name+'帮忙':(dark?['看月亮','打瞌睡','数星星','听虫鸣']:['散步','晒太阳','寻找朋友','看花'])[i%4];return `<g class="lw-resident" style="--delay:${i*.7}s;--wander:${16+i*3}px" transform="translate(${a.x} ${a.y})"><g class="lw-wander">${jelly(elementHue(s.element),s.name)}<text y="23" class="lw-map-label" text-anchor="middle">${esc(s.name)}</text><text y="34" class="lw-map-label lw-map-sub" text-anchor="middle">${activity}</text></g></g>`;}).join('');
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
 return `<svg class="lw-map ${dark?'is-night':'is-day'}" viewBox="0 0 ${MAP_W} ${MAP_H}" aria-label="${ZONES[zone].name}，12 乘 12 自由布置地图" role="img">${defs}${sky(dark)}${islandBody(dark,tone)}<g>${cells}</g>${overlay?'':moonlight}${[...p,...c].sort((a,b)=>a.depth-b.depth).map(o=>o.art).join('')}${creatures}${visitors}${fireflies}<text x="26" y="${MAP_H-18}" class="lw-map-hint">${overlay?'环境图层：数值越高，颜色越深':'点击物件查看，布置模式可拖动'}</text></svg>`;
}
