import type {World,Host,Placement} from './types.ts';
import {BUILDINGS,DECORATIONS,PLANTS,VISITORS} from './content.ts';
import {bounds,night,environment} from './ecology.ts';
import {resident,activity} from './life.ts';
import {facilityArt} from './art/facilities.ts';
import {decorArt} from './art/decor.ts';
import {plantArt} from './art/plants.ts';
import {visitorArt} from './art/creatures.ts';
import {mix} from './art/kit.ts';
import {esc,PATH_TONES} from './art.ts';
import {HOME_WIDTH,HOME_HEIGHT,TILE,biomeAt,type Camera} from './map.ts';

export function objectArt(p:Placement,dark=false):string {
 const def=BUILDINGS.find(b=>b.id===p.def),[a,b]=bounds(p);
 const raw=p.def==='house'?cottage(dark,p.level):def?facilityArt(p.def,dark,p.level):decorArt(p.def,dark);
 const rotation=p.rotation%2?`translate(${a*TILE} 0) scale(${-a/(def?.size[0]??1)} ${b/(def?.size[1]??1)})`:p.rotation===2?`translate(${a*TILE} 0) scale(-1 1)`:'';
 return `<g transform="${rotation}">${raw}</g>`;
}
function cottage(dark:boolean,level:number):string {
 const c=(v:string)=>dark?mix(v,'#293c52',.43):v,window=dark?'#ffe5a2':'#fff0bb';
 return `<ellipse cx="53" cy="84" rx="43" ry="14" fill="#344d35" opacity=".17"/><rect x="14" y="29" width="70" height="55" rx="5" fill="${c('#edd9b2')}"/><path d="M77 40h7v39q0 5-5 5h-2Z" fill="${c('#cdb792')}"/><rect x="64" y="-24" width="11" height="31" rx="2" fill="${c('#b58b75')}"/><path d="M63-15h13m-13 8h13" stroke="${c('#dbb6a0')}" stroke-width="1.5"/><path d="M70-30q-9-6-3-12t-2-11" fill="none" stroke="${c('#eee4d4')}" stroke-width="3" stroke-linecap="round" opacity=".7"/><path d="M8 44Q4 44 6 39L18-10Q19-14 24-14H73Q78-14 79-9L92 39Q94 44 89 44Z" fill="${c('#c08763')}" stroke="${c('#a76f51')}" stroke-width="1.5" stroke-linejoin="round"/><path d="M18-2h62M14 10h69M11 22h75M8 34h81M34-13v11m25-11v11M24-2v12m25-12v12m24-12v12M34 10v12m25-12v12M24 22v12m25-12v12m24-12v12M34 34v9m25-9v9" fill="none" stroke="${c('#a96e50')}" stroke-width="1" opacity=".6"/><path d="M20-13h55M7 44h84" stroke="${c('#ead1aa')}" stroke-width="3" stroke-linecap="round"/><rect x="31" y="55" width="22" height="31" rx="5" fill="${c('#a4815b')}"/><rect x="35" y="59" width="14" height="25" rx="3" fill="${c('#8b6d4d')}"/><circle cx="46" cy="73" r="1.4" fill="#e7cb84"/><rect x="61" y="54" width="15" height="18" rx="3" fill="${window}" stroke="${c('#d4b98c')}" stroke-width="2"/><path d="M68.5 55v16M62 63h13" stroke="${c('#d4b98c')}" stroke-width="1.5"/><rect x="26" y="85" width="31" height="6" rx="2" fill="${c('#b8b4a7')}"/><rect x="23" y="90" width="37" height="5" rx="2" fill="${c('#c9c6b5')}"/><rect x="60" y="76" width="19" height="9" rx="3" fill="${c('#aa7955')}"/><path d="M62 77q-5-12 3-10q4-7 7 1q9-7 6 8" fill="${c('#809c61')}"/><g fill="${c('#e6b8a0')}"><circle cx="64" cy="69" r="2.5"/><circle cx="73" cy="72" r="2.5"/></g>${level>=2?`<path d="M19 74q-8-17-7-28m1 10q11-4 7-11M14 64q8-3 7-9" fill="none" stroke="${c('#72965c')}" stroke-width="4" stroke-linecap="round"/>`:''}${dark?'<ellipse cx="68" cy="64" rx="21" ry="23" fill="url(#lw-window)" opacity=".25"/>':''}`;
}
export function preview(def:string):string {
 const d=BUILDINGS.find(b=>b.id===def),[a,b]=d?.size??[1,1];
 return `<svg viewBox="-40 -110 ${a*TILE+80} ${b*TILE+140}" aria-hidden="true">${objectArt({id:0,def,zone:0,x:0,y:0,rotation:0,level:1,stored:false}).replaceAll('url(#lw-window)','#ffe3a0').replaceAll('url(#lw-water)','#87bbc0')}</svg>`;
}
const palettes=['#a7bf82','#aabe81','#a0b984','#9fbc92','#aebd88','#a2b98a'];
const hash=(n:number)=>Math.floor((Math.sin(n*127.1+311.7)*43758.5453%1+1)%1*100);
export function scene(w:World,host:Host,camera:Camera,selected:number,crop:number,person:number,edit:boolean,overlay:string):string {
 const dark=night(w),shade=(c:string)=>dark?mix(c,'#243d53',.48):c,roads=new Set(w.paths[0]??[]);
 const viewWidth=typeof innerWidth==='number'?innerWidth:1920,viewHeight=typeof innerHeight==='number'?innerHeight:1080;
 const visible=(x:number,y:number)=>!camera.ready||x*TILE>camera.x-220&&x*TILE<camera.x+viewWidth/camera.zoom+220&&y*TILE>camera.y-220&&y*TILE<camera.y+viewHeight/camera.zoom+220;
 let ground=`<rect width="${HOME_WIDTH*TILE}" height="${HOME_HEIGHT*TILE}" fill="${shade('#a7bf82')}"/>`,road='';
 const occupied=new Set(w.crops.map(c=>c.y*HOME_WIDTH+c.x));
 for(const p of w.placements.filter(p=>!p.stored)){const [a,b]=bounds(p);for(let y=p.y;y<p.y+b;y++)for(let x=p.x;x<p.x+a;x++)occupied.add(y*HOME_WIDTH+x);}
 for(let y=0;y<HOME_HEIGHT;y++)for(let x=0;x<HOME_WIDTH;x++){
  const n=y*HOME_WIDTH+x,biome=biomeAt(w,x,y),color=mix(palettes[biome],hash(n)%2?'#cbd9aa':'#91ad77',hash(n)/1800);
  ground+=`<rect x="${x*TILE}" y="${y*TILE}" width="48.5" height="48.5" fill="${shade(color)}" fill-opacity=".28"/>`;
  if(['light','moisture','fertility','quality'].includes(overlay)){
   const e=environment(w,0,x,y,host.state().slimes),value=e[overlay as 'light'|'moisture'|'fertility'|'quality'];
   ground+=`<rect class="home-environment" x="${x*TILE}" y="${y*TILE}" width="48.5" height="48.5" fill="${mix('#bd8469','#649ca1',Math.max(0,Math.min(1,value/100)))}" opacity=".72"><title>${Math.round(value)}</title></rect>`;
  }
  if(!roads.has(n)&&!occupied.has(n)&&hash(n)%3===0)ground+=`<path d="M${x*TILE+12} ${y*TILE+24}l-2-5m2 5l3-4m13 15l1-5m-1 5l-3-3" stroke="${shade('#779b60')}" stroke-width="1.5" opacity=".55" fill="none"/>`;
  if(!roads.has(n)&&!occupied.has(n)&&hash(n)%17===0)ground+=`<g fill="${shade('#f5ecc3')}"><circle cx="${x*TILE+30}" cy="${y*TILE+16}" r="2.4"/><circle cx="${x*TILE+18}" cy="${y*TILE+35}" r="1.7"/></g>`;
  if(!roads.has(n))continue;
  const tone=PATH_TONES[w.pathStyles?.[`0:${n}`]??0],left=x>0&&roads.has(n-1),right=x+1<HOME_WIDTH&&roads.has(n+1),top=y>0&&roads.has(n-HOME_WIDTH),bottom=y+1<HOME_HEIGHT&&roads.has(n+HOME_WIDTH);
  const px=x*TILE+(left?0:5),py=y*TILE+(top?0:5),width=TILE-(left?0:5)-(right?0:5),height=TILE-(top?0:5)-(bottom?0:5);
  road+=`<rect data-home-road="${n}" x="${px}" y="${py+2}" width="${width}" height="${height}" rx="${left||right||top||bottom?1:6}" fill="${shade(tone.edge)}"/><rect x="${px}" y="${py}" width="${width}" height="${height}" rx="${left||right||top||bottom?1:6}" fill="${shade(tone.base)}"/><path d="M${px+8} ${py+11}h5m14 16h4" stroke="${shade(tone.dot)}" stroke-width="2" opacity=".65"/>`;
 }
 const objects:{depth:number;id:number;html:string}[]=[];
 // Background plants yield their space whenever the player builds or sows there.
 for(let y=0;y<HOME_HEIGHT;y++)for(let x=0;x<HOME_WIDTH;x++){
  const n=y*HOME_WIDTH+x,h=hash(n+351),edge=x<3||x>32||y<3||y>21,woodland=x>25&&y<8;
  if(!visible(x,y)||occupied.has(n)||roads.has(n)||(!edge&&!woodland&&h>3))continue;
  const near=[...occupied].some(c=>Math.abs(c%HOME_WIDTH-x)+Math.abs(Math.floor(c/HOME_WIDTH)-y)<3);
  if(near||h>(edge?62:woodland?32:3))continue;
  const tree=edge||woodland,px=(x+.5)*TILE,py=(y+1)*TILE,size=.72+h/180;
  const art=tree?`<ellipse cy="4" rx="26" ry="10" fill="#3e6446" opacity=".15"/><path d="M-4 0L-3-40H4L5 0Z" fill="${shade('#8b7750')}"/><path d="M1-12Q-35-7-26-40Q-40-56-17-69Q-13-90 7-83Q30-82 27-60Q43-37 20-26Q20-10 1-12" fill="${shade(h%2?'#638b59':'#72985d')}"/><path d="M-21-52Q-30-69-10-72Q-9-84 7-77Q24-74 19-57Q8-63-1-53Q-14-46-21-52" fill="${shade('#90b46d')}"/><path d="M-9-39q8-6 15-2m-7 13v10" fill="none" stroke="${shade('#50764e')}" stroke-width="2" stroke-linecap="round"/>`:`<ellipse cy="3" rx="19" ry="6" fill="#486d42" opacity=".12"/><path d="M-18 0Q-23-15-10-17Q-4-29 5-19Q23-23 20-6Q24 4-18 0" fill="${shade('#84a465')}"/><path d="M-9-11q4-6 8-2m5 4q4-4 7-1" stroke="${shade('#b2c887')}" stroke-width="2" fill="none"/>`;
  objects.push({depth:y+.9,id:-n-1,html:`<g class="home-nature" data-depth="${y+.9}" transform="translate(${px} ${py}) scale(${size})" pointer-events="none">${art}</g>`});
 }
 for(const p of w.placements.filter(p=>!p.stored&&visible(p.x,p.y))){const [a,b]=bounds(p),def=BUILDINGS.find(d=>d.id===p.def)??DECORATIONS.find(d=>d.id===p.def);
  objects.push({depth:p.y+b,id:p.id,html:`<g class="home-object ${p.id===selected?'selected':''}" data-home-object="${p.id}" data-depth="${p.y+b}" transform="translate(${p.x*TILE} ${p.y*TILE+10})" tabindex="0" role="button" aria-label="${esc(def?.name??'物件')}"><rect class="home-footprint" y="-10" width="${a*TILE}" height="${b*TILE}" rx="6"/>${objectArt(p,dark)}<text class="home-label" x="${a*TILE/2}" y="${b*TILE+12}" text-anchor="middle">${esc(def?.name??'')}</text></g>`});
 }
 for(const c of w.crops.filter(c=>visible(c.x,c.y))){const cultivar=w.cultivars.find(v=>v.id===c.cultivar)!,def=PLANTS.find(p=>p.id===cultivar.species)!;
  objects.push({depth:c.y+1,id:c.id,html:`<g class="home-crop ${c.id===crop?'selected':''}" data-home-crop="${c.id}" data-depth="${c.y+1}" transform="translate(${(c.x+.5)*TILE} ${(c.y+1)*TILE-8})" role="button" tabindex="0" aria-label="${esc(cultivar.name)}，${Math.round(c.progress*100)}%"><rect class="home-footprint" x="-24" y="-40" width="48" height="48" rx="6"/>${plantArt(def,cultivar.genes.color,cultivar.genes.form,c.progress,dark)}${c.progress>=1?'<circle cy="-60" r="5" fill="#fff3b5" stroke="#ac8750"/>':c.water<=0?'<text class="home-label" y="-54" text-anchor="middle">缺水</text>':''}</g>`});
 }
 for(const s of host.state().slimes){const a=activity(w,s.id);if(!['home','work'].includes(a.kind)||!host.available(s.id)&&a.kind!=='work')continue;const r=resident(w,s);if(!visible(r.x,r.y))continue;
  objects.push({depth:r.y+.85,id:s.id,html:`<g class="home-resident ${s.id===person?'selected':''}" data-home-resident="${s.id}" data-depth="${r.y+.85}" transform="translate(${(r.x+.5)*TILE} ${(r.y+1)*TILE-5})" role="button" tabindex="0" aria-label="${esc(s.name)}"><ellipse cy="0" rx="21" ry="8" fill="#324a35" opacity=".18"/><foreignObject x="-34" y="-62" width="68" height="74"><div xmlns="http://www.w3.org/1999/xhtml" class="home-slime">${host.slimeHTML(s)}</div></foreignObject><text class="home-label resident-label" y="15" text-anchor="middle">${esc(s.name)}</text></g>`});
 }
 for(const [index,v] of VISITORS.filter(v=>w.visitors[v.id]).entries()){const x=(v.zone%3)*12+2+(index%4)*2,y=Math.floor(v.zone/3)*12+6+index%4;if(!visible(x,y))continue;objects.push({depth:y+.8,id:100000+index,html:`<g data-depth="${y+.8}" transform="translate(${(x+.5)*TILE} ${(y+1)*TILE-6})"><title>${esc(v.name+' · '+v.service)}</title>${visitorArt(v.id,dark)}</g>`});}
 return `<svg class="home-map ${dark?'night':''}" viewBox="0 0 ${HOME_WIDTH*TILE} ${HOME_HEIGHT*TILE}" preserveAspectRatio="xMidYMid slice" aria-label="家园，36乘24格连续地图" role="group"><defs><radialGradient id="lw-window"><stop stop-color="#fff2b9"/><stop offset="1" stop-color="#e5b660" stop-opacity=".1"/></radialGradient><linearGradient id="lw-water" x2="0" y2="1"><stop stop-color="#a8d5cd"/><stop offset="1" stop-color="#72aaa8"/></linearGradient><pattern id="home-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#3e624b" stroke-width="1" opacity=".25"/></pattern></defs><g class="home-ground">${ground}${road}${edit?`<rect width="${HOME_WIDTH*TILE}" height="${HOME_HEIGHT*TILE}" fill="url(#home-grid)"/>`:''}</g><g class="home-objects">${objects.sort((a,b)=>a.depth-b.depth||a.id-b.id).map(o=>o.html).join('')}</g><g class="home-preview" pointer-events="none"></g></svg>`;
}
