import type {World,Host,Placement} from './types.ts';
import {BUILDINGS,DECORATIONS,PLANTS,VISITORS} from './content.ts';
import {bounds,formOf,night,environment} from './ecology.ts';
import {resident,activity} from './life.ts';
import {facilityArt} from './art/facilities.ts';
import {decorArt} from './art/decor.ts';
import {visitorArt} from './art/creatures.ts';
import {mix} from './art/kit.ts';
import {artURL,paintedObject,paintedPlant,natureArt,pathPatterns,objectPreview,artGlyph,artTop,sprite} from './art/storybook.ts';
import {PLOT,PLOT_COUNT,plotAt,plotOrigin} from './map.ts';
import {clearing} from './estate.ts';
import {esc} from './art.ts';
import {HOME_WIDTH,HOME_HEIGHT,TILE,type Camera} from './map.ts';

export function objectArt(p:Placement,dark=false):string {
 const def=BUILDINGS.find(b=>b.id===p.def),[a,b]=bounds(p);
 const painted=paintedObject(p.def,a,b,dark,formOf(p));
 // Fit the picture into the rotated footprint without stretching its aspect ratio.
 if(painted)return `<g transform="${p.rotation===1||p.rotation===2?`translate(${a*TILE} 0) scale(-1 1)`:''}">${painted}</g>`;
 const raw=p.def==='house'?cottage(dark,p.level):def?facilityArt(p.def,dark,p.level):decorArt(p.def,dark);
 const [w0,h0]=bounds({...p,rotation:0}),rotation=p.rotation%2?`translate(${a*TILE} 0) scale(${-a/w0} ${b/h0})`:p.rotation===2?`translate(${a*TILE} 0) scale(-1 1)`:'';
 return `<g transform="${rotation}">${raw}</g>`;
}
function cottage(dark:boolean,level:number):string {
 const c=(v:string)=>dark?mix(v,'#293c52',.43):v,window=dark?'#ffe5a2':'#fff0bb';
 return `<ellipse cx="53" cy="84" rx="43" ry="14" fill="#344d35" opacity=".17"/><rect x="14" y="29" width="70" height="55" rx="5" fill="${c('#edd9b2')}"/><path d="M77 40h7v39q0 5-5 5h-2Z" fill="${c('#cdb792')}"/><rect x="64" y="-24" width="11" height="31" rx="2" fill="${c('#b58b75')}"/><path d="M63-15h13m-13 8h13" stroke="${c('#dbb6a0')}" stroke-width="1.5"/><path d="M70-30q-9-6-3-12t-2-11" fill="none" stroke="${c('#eee4d4')}" stroke-width="3" stroke-linecap="round" opacity=".7"/><path d="M8 44Q4 44 6 39L18-10Q19-14 24-14H73Q78-14 79-9L92 39Q94 44 89 44Z" fill="${c('#c08763')}" stroke="${c('#a76f51')}" stroke-width="1.5" stroke-linejoin="round"/><path d="M18-2h62M14 10h69M11 22h75M8 34h81M34-13v11m25-11v11M24-2v12m25-12v12m24-12v12M34 10v12m25-12v12M24 22v12m25-12v12m24-12v12M34 34v9m25-9v9" fill="none" stroke="${c('#a96e50')}" stroke-width="1" opacity=".6"/><path d="M20-13h55M7 44h84" stroke="${c('#ead1aa')}" stroke-width="3" stroke-linecap="round"/><rect x="31" y="55" width="22" height="31" rx="5" fill="${c('#a4815b')}"/><rect x="35" y="59" width="14" height="25" rx="3" fill="${c('#8b6d4d')}"/><circle cx="46" cy="73" r="1.4" fill="#e7cb84"/><rect x="61" y="54" width="15" height="18" rx="3" fill="${window}" stroke="${c('#d4b98c')}" stroke-width="2"/><path d="M68.5 55v16M62 63h13" stroke="${c('#d4b98c')}" stroke-width="1.5"/><rect x="26" y="85" width="31" height="6" rx="2" fill="${c('#b8b4a7')}"/><rect x="23" y="90" width="37" height="5" rx="2" fill="${c('#c9c6b5')}"/><rect x="60" y="76" width="19" height="9" rx="3" fill="${c('#aa7955')}"/><path d="M62 77q-5-12 3-10q4-7 7 1q9-7 6 8" fill="${c('#809c61')}"/><g fill="${c('#e6b8a0')}"><circle cx="64" cy="69" r="2.5"/><circle cx="73" cy="72" r="2.5"/></g>${level>=2?`<path d="M19 74q-8-17-7-28m1 10q11-4 7-11M14 64q8-3 7-9" fill="none" stroke="${c('#72965c')}" stroke-width="4" stroke-linecap="round"/>`:''}${dark?'<ellipse cx="68" cy="64" rx="21" ry="23" fill="url(#lw-window)" opacity=".25"/>':''}`;
}
export function preview(def:string,form=1):string {
 const painted=objectPreview(def,form);if(painted)return painted;
 const d=BUILDINGS.find(b=>b.id===def),[a,b]=d?.forms[form-1]??[1,1];
 return `<svg viewBox="-12 -75 ${a*TILE+24} ${b*TILE+90}" aria-hidden="true">${objectArt({id:0,def,zone:0,x:0,y:0,rotation:0,level:form,stored:false,form}).replaceAll('url(#lw-window)','#ffe3a0').replaceAll('url(#lw-water)','#87bbc0')}</svg>`;
}
const hash=(n:number)=>Math.floor(((Math.sin(n*127.1+311.7)*43758.5453)%1+1)%1*1000);
export function scene(w:World,host:Host,camera:Camera,selected:number,crop:number,person:number,edit:boolean,overlay:string,preview=''):string {
 const dark=night(w),shade=(c:string)=>dark?mix(c,'#243d53',.48):c,roads=new Set(w.paths[0]??[]);
 const viewWidth=typeof innerWidth==='number'?innerWidth:1920,viewHeight=typeof innerHeight==='number'?innerHeight:1080;
 const visible=(x:number,y:number)=>!camera.ready||x*TILE>camera.x-220&&x*TILE<camera.x+viewWidth/camera.zoom+220&&y*TILE>camera.y-220&&y*TILE<camera.y+viewHeight/camera.zoom+220;
 const meadow=`<rect width="${HOME_WIDTH*TILE}" height="${HOME_HEIGHT*TILE}" fill="${shade('#a7bf82')}"/><image class="home-meadow" href="${artURL('ground')}" width="${HOME_WIDTH*TILE}" height="${HOME_HEIGHT*TILE}" preserveAspectRatio="none" style="filter:${dark?'brightness(.48) saturate(.65)':'saturate(.74)'}"/><rect width="${HOME_WIDTH*TILE}" height="${HOME_HEIGHT*TILE}" fill="${dark?'#304e5a':'#aac18a'}" opacity="${dark?'.2':'.46'}"/>`;
 // Continue the same meadow through the camera margin; the playable tiles stay 36 by 24.
 let ground=`<defs><pattern id="home-meadow-fill" width="${HOME_WIDTH*TILE}" height="${HOME_HEIGHT*TILE}" patternUnits="userSpaceOnUse">${meadow}</pattern></defs><rect x="${-HOME_WIDTH*TILE}" y="${-HOME_HEIGHT*TILE}" width="${HOME_WIDTH*TILE*3}" height="${HOME_HEIGHT*TILE*3}" fill="url(#home-meadow-fill)"/>`,road='';
 const occupied=new Set(w.crops.map(c=>c.y*HOME_WIDTH+c.x));
 for(const p of w.placements.filter(p=>!p.stored)){const [a,b]=bounds(p);for(let y=p.y;y<p.y+b;y++)for(let x=p.x;x<p.x+a;x++)occupied.add(y*HOME_WIDTH+x);}
 for(let y=0;y<HOME_HEIGHT;y++)for(let x=0;x<HOME_WIDTH;x++){
  const n=y*HOME_WIDTH+x;
  if(['light','moisture','fertility','quality'].includes(overlay)){
   const e=environment(w,0,x,y,host.state().slimes),value=e[overlay as 'light'|'moisture'|'fertility'|'quality'];
   ground+=`<rect class="home-environment" x="${x*TILE}" y="${y*TILE}" width="48.5" height="48.5" fill="${mix('#bd8469','#649ca1',Math.max(0,Math.min(1,value/100)))}" opacity=".72"><title>${Math.round(value)}</title></rect>`;
  }
  if(!roads.has(n))continue;
  const left=x>0&&roads.has(n-1),right=x+1<HOME_WIDTH&&roads.has(n+1),top=y>0&&roads.has(n-HOME_WIDTH),bottom=y+1<HOME_HEIGHT&&roads.has(n+HOME_WIDTH);
  const px=x*TILE+(left?0:5),py=y*TILE+(top?0:5),width=TILE-(left?0:5)-(right?0:5),height=TILE-(top?0:5)-(bottom?0:5);
  road+=`<rect data-home-road="${n}" x="${px}" y="${py}" width="${width}" height="${height}" rx="${left||right||top||bottom?0:6}" fill="url(#home-road-${w.pathStyles?.[`0:${n}`]??0})"/>`;
 }
 const objects:{depth:number;id:number;html:string}[]=[];
 // 未开垦的地块：画成密林并轻轻压暗；与已开垦地相邻的地块中央立一块路牌，点它开垦。
 const glade=new Set<number>(),opened=new Set(w.version===5&&w.estate?w.estate.plots:Array.from({length:PLOT_COUNT},(_,i)=>i)),locked=(x:number,y:number)=>!opened.has(plotAt(x,y));
 for(let n=0;n<PLOT_COUNT;n++){
  if(opened.has(n))continue;const [x,y]=plotOrigin(n);
  ground+=`<rect class="home-locked-plot" x="${x*TILE}" y="${y*TILE}" width="${PLOT*TILE}" height="${PLOT*TILE}" fill="${dark?'#132a2c':'#2f4b2f'}" opacity="${edit?.34:dark?.2:.14}"/>`;
  if(clearing(w,n).problem==='先开垦相邻的地块')continue;
  const cx=(x+PLOT/2)*TILE,cy=(y+PLOT/2+.6)*TILE,need=clearing(w,n);
  for(let yy=y+1;yy<y+PLOT-1;yy++)for(let xx=x+1;xx<x+PLOT-1;xx++)glade.add(yy*HOME_WIDTH+xx);
  objects.push({depth:y+PLOT/2+.6,id:-100000-n,html:`<g class="home-plot-sign${need.problem?' waiting':''}" data-home-plot="${n}" data-depth="${y+PLOT/2+.6}" transform="translate(${cx} ${cy})" role="button" tabindex="0" aria-label="开垦这片林地${need.problem?'，'+esc(need.problem):''}"><ellipse rx="30" ry="9" fill="#243a26" opacity=".22"/><circle class="home-plot-halo" cy="-44" r="44"/><g transform="translate(-42 -90)" style="${dark?'filter:brightness(.7)':''}">${sprite('items-a',15,0,0,84,84)}</g><text class="home-label home-plot-label" y="16" text-anchor="middle">${need.problem?esc(need.problem):'开垦'}</text></g>`});
 }
 // Background plants yield their space whenever the player builds or sows there.
 const occupiedTiles=[...occupied,...roads],treeClearance=new Set<number>(),lowClearance=new Set<number>();
 for(const n of occupiedTiles){const x=n%HOME_WIDTH,y=Math.floor(n/HOME_WIDTH);
  for(let dy=-1;dy<=2;dy++)for(let dx=-1;dx<=1;dx++){
   const nx=x+dx,ny=y+dy;if(nx<0||nx>=HOME_WIDTH||ny<0||ny>=HOME_HEIGHT)continue;
   treeClearance.add(ny*HOME_WIDTH+nx);if(Math.abs(dx)+Math.abs(dy)<2)lowClearance.add(ny*HOME_WIDTH+nx);
  }
 }
 for(let y=0;y<HOME_HEIGHT;y++)for(let x=0;x<HOME_WIDTH;x++){
  const n=y*HOME_WIDTH+x,h=hash(n+351),wild=locked(x,y),edge=x<3||x>32||y<3||y>21||wild;
  const woodland=(x-17)**2/100+(y-4)**2/16<1||(x-6)**2/20+(y-14)**2/65<1||(x-28)**2/24+(y-13)**2/75<1||Math.sin(x*.55)+Math.cos(y*.71)+Math.sin((x+y)*.36)>1.4;
  // 可开垦地块中央留一片林间空地，路牌不会被树冠挡住。
  if(!visible(x,y)||occupied.has(n)||roads.has(n)||glade.has(n))continue;
  const tree=(edge||woodland)&&x%2===0&&y%2===0&&!treeClearance.has(n);
  if(!tree&&(lowClearance.has(n)||h>(wild?520:edge||woodland?360:85)))continue;
  const px=(x+.5)*TILE+(hash(n+15)%23-11),py=(y+1)*TILE+(hash(n+9)%35-17),size=tree ? .94+(h%100)/210 : .6+(h%100)/260;
  const art=natureArt(tree?(h%(wild?9:4)===0?'fruit':'tree'):h%7===0?'rock':h%3===0?'flowers':'bush',size,dark);
  const depth=py/TILE-.1;
  objects.push({depth,id:-n-1,html:`<g class="home-nature" data-depth="${depth}" transform="translate(${px} ${py})" pointer-events="none">${art}</g>`});
 }
 for(const p of w.placements.filter(p=>!p.stored&&visible(p.x,p.y))){const [a,b]=bounds(p),def=BUILDINGS.find(d=>d.id===p.def)??DECORATIONS.find(d=>d.id===p.def);
  // 建筑暂存的产出：屋顶上方冒出气泡，显示数量最多的那种产物，点一下收进仓库。
  const bag=w.estate?.yields[p.id],main=bag&&Object.entries(bag).sort((x,y)=>y[1]-x[1])[0],top=main?artTop(p.def,a,b,formOf(p)):0;
  const bubble=main?`<g class="home-bubble" data-home-bubble="${p.id}" transform="translate(${a*TILE/2} ${Math.max(-150,top-6)})" role="button" tabindex="0" aria-label="收取${esc(def?.name??'')}的产出"><g class="home-bubble-float"><path d="M-6 -4 0 5 6 -4Z" fill="#fff6dc" stroke="#a9834e" stroke-width="1.5" stroke-linejoin="round"/><circle cy="-22" r="20" fill="#fff6dc" stroke="#a9834e" stroke-width="2"/><svg x="-15" y="-38" width="30" height="30" viewBox="0 0 32 32" overflow="visible">${artGlyph(main[0])}</svg><text class="home-bubble-count" x="15" y="-4" text-anchor="middle">${Math.floor(main[1])>99?'99+':Math.floor(main[1])}</text></g></g>`:'';
  objects.push({depth:p.y+b,id:p.id,html:`<g class="home-object ${p.id===selected?'selected':''}" data-home-object="${p.id}" data-depth="${p.y+b}" transform="translate(${p.x*TILE} ${p.y*TILE+10})" tabindex="0" role="button" aria-label="${esc(def?.name??'物件')}${BUILDINGS.some(d=>d.id===p.def)?`，${p.level} 级`:''}"><rect class="home-footprint" y="-10" width="${a*TILE}" height="${b*TILE}" rx="6"/>${objectArt(p,dark)}<text class="home-label" x="${a*TILE/2}" y="${b*TILE+12}" text-anchor="middle">${esc(def?.name??'')}</text>${bubble}</g>`});
 }
 for(const c of w.crops.filter(c=>visible(c.x,c.y))){const cultivar=w.cultivars.find(v=>v.id===c.cultivar)!,def=PLANTS.find(p=>p.id===cultivar.species)!;
  objects.push({depth:c.y+1,id:c.id,html:`<g class="home-crop ${c.id===crop?'selected':''}" data-home-crop="${c.id}" data-depth="${c.y+1}" transform="translate(${(c.x+.5)*TILE} ${(c.y+1)*TILE-8})" role="button" tabindex="0" aria-label="${esc(cultivar.name)}，${Math.round(c.progress*100)}%"><rect class="home-footprint" x="-24" y="-40" width="48" height="48" rx="6"/>${paintedPlant(def,cultivar.genes.color,cultivar.genes.form,c.progress,dark)}${c.progress>=1?'<circle cy="-60" r="5" fill="#fff3b5" stroke="#ac8750"/>':c.water<=0?'<text class="home-label" y="-54" text-anchor="middle">缺水</text>':''}</g>`});
 }
 for(const s of host.state().slimes){const a=activity(w,s.id);if(!['home','work'].includes(a.kind)||!host.available(s.id)&&a.kind!=='work')continue;const r=resident(w,s);if(!visible(r.x,r.y))continue;
  objects.push({depth:r.y+.85,id:s.id,html:`<g class="home-resident ${s.id===person?'selected':''}" data-home-resident="${s.id}" data-depth="${r.y+.85}" transform="translate(${(r.x+.5)*TILE} ${(r.y+1)*TILE-5})" role="button" tabindex="0" aria-label="${esc(s.name)}"><ellipse cy="0" rx="21" ry="8" fill="#324a35" opacity=".18"/><foreignObject x="-34" y="-62" width="68" height="74"><div xmlns="http://www.w3.org/1999/xhtml" class="home-slime">${host.slimeHTML(s)}</div></foreignObject><text class="home-label resident-label" y="15" text-anchor="middle">${esc(s.name)}</text></g>`});
 }
 for(const [index,v] of VISITORS.filter(v=>w.visitors[v.id]).entries()){const x=(v.zone%3)*12+2+(index%4)*2,y=Math.floor(v.zone/3)*12+6+index%4;if(!visible(x,y))continue;objects.push({depth:y+.8,id:100000+index,html:`<g data-depth="${y+.8}" transform="translate(${(x+.5)*TILE} ${(y+1)*TILE-6})"><title>${esc(v.name+' · '+v.service)}</title>${visitorArt(v.id,dark)}</g>`});}
 return `<svg class="home-map ${dark?'night':''}" viewBox="0 0 ${HOME_WIDTH*TILE} ${HOME_HEIGHT*TILE}" preserveAspectRatio="xMidYMid slice" aria-label="家园，36乘24格连续地图" role="group"><defs><radialGradient id="lw-window"><stop stop-color="#fff2b9"/><stop offset="1" stop-color="#e5b660" stop-opacity=".1"/></radialGradient><linearGradient id="lw-water" x2="0" y2="1"><stop stop-color="#a8d5cd"/><stop offset="1" stop-color="#72aaa8"/></linearGradient>${pathPatterns()}<pattern id="home-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#3e624b" stroke-width="1" opacity=".25"/></pattern></defs><g class="home-ground">${ground}<g class="home-roads" style="${dark?'filter:brightness(.58) saturate(.7)':''}">${road}</g>${edit?`<rect width="${HOME_WIDTH*TILE}" height="${HOME_HEIGHT*TILE}" fill="url(#home-grid)"/>`:''}</g><g class="home-objects">${objects.sort((a,b)=>a.depth-b.depth||a.id-b.id).map(o=>o.html).join('')}</g><g class="home-preview" pointer-events="none">${preview}</g></svg>`;
}
