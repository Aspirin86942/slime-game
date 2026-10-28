/* 装饰素材包：围栏、灯、休憩、花架、标牌、自然、纪念七组，每组六件各有独立轮廓。
   全部是 1×1 占地，原点见 kit.ts；格子中心在屏幕 (0,5)，地面菱形四角 (0,-10)(23,5)(0,20)(-23,5)。
   夜间（lit）物件本体经过 dusk 压暗，灯芯、萤火、星光不压暗并加柔光。第 0 组小路由路面拼接绘制，这里返回空串。 */
import {pt,poly,line,box,faces,dusk,PAL,type Pt} from './kit.ts';

type Art=(lit:boolean)=>string;
const r1=(n:number)=>Math.round(n*10)/10;
const xy=(p:Pt)=>`${p[0]} ${p[1]}`;
const HL=PAL.highlight,SH='#1d2440';
const P=(d:string,fill:string,x='')=>`<path d="${d}" fill="${fill}"${x}/>`;
const L=(d:string,stroke:string,w:number,x='')=>`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${x}/>`;
const E=(cx:number,cy:number,rx:number,ry:number,fill:string,x='')=>`<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${fill}"${x}/>`;
const C=(cx:number,cy:number,r:number,fill:string,x='')=>`<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${fill}"${x}/>`;
const hl=(d:string,o=.6,w=1.5)=>L(d,HL,w,` stroke-opacity="${o}"`);
const op=(o:number)=>` opacity="${o}"`;
/* 柔和落地阴影：椭圆，略向右下偏。 */
const shade=(rx:number,ry:number,cx=2,cy=9)=>E(cx,cy,rx,ry,SH,op(.2));
/* 沿格子平面的阴影条（围栏、长椅等细长物件）。 */
const strip=(u0:number,v0:number,u1:number,v1:number)=>P(poly([pt(u0,v0),pt(u1,v0),pt(u1,v1),pt(u0,v1)]),SH,' opacity=".18" transform="translate(2 3)"');
/* 柔光：白天很淡，夜里明显。颜色不压暗。 */
const halo=(x:number,y:number,r:number,col:string,lit:boolean)=>C(x,y,r,col,op(lit?.2:.07))+C(x,y,r*.55,col,op(lit?.34:.12));
/* 立在 v 平面上的竖直面板（朝左前方），用于围栏、靠背、木板。 */
const plane=(u0:number,u1:number,v:number,h0:number,h1:number)=>poly([pt(u0,v,h0),pt(u1,v,h0),pt(u1,v,h1),pt(u0,v,h1)]);
/* 竖直圆柱：(x,y) 为底面中心，左侧次亮、右侧最暗、顶面最亮，与 kit.faces 一致。 */
function cyl(x:number,y:number,rx:number,ry:number,h:number,col:string):string{
 const f=faces(col),t=r1(y-h),a=r1(x+rx*.3),b=r1(ry*.95);
 return P(`M${r1(x-rx)} ${t}V${y}A${rx} ${ry} 0 0 0 ${r1(x+rx)} ${y}V${t}Z`,f.left)+
  P(`M${a} ${r1(t+b)}V${r1(y+b)}A${rx} ${ry} 0 0 0 ${r1(x+rx)} ${y}V${t}A${rx} ${ry} 0 0 1 ${a} ${r1(t+b)}Z`,f.right)+
  E(x,t,rx,ry,col);
}
/* n 角星（n=4 为闪光，n=6 为霜花）。 */
function star(x:number,y:number,R:number,r:number,n=5):string{
 let d='';for(let i=0;i<n*2;i++){const a=(-90+i*180/n)*Math.PI/180,k=i%2?r:R;d+=(i?'L':'M')+r1(x+k*Math.cos(a))+' '+r1(y+k*Math.sin(a));}
 return d+'Z';
}
/* 月牙：外弧向左鼓，开口朝右。 */
const crescent=(x:number,y:number,R:number)=>`M${x} ${r1(y-R)}A${R} ${R} 0 0 0 ${x} ${r1(y+R)}A${r1(R*1.3)} ${r1(R*1.3)} 0 0 1 ${x} ${r1(y-R)}Z`;
const leaf=(x:number,y:number,len:number,ang:number,fill:string)=>E(x,y,len,len*.45,fill,` transform="rotate(${ang} ${x} ${y})"`);
const heart=(x:number,y:number,s:number)=>`M${x} ${r1(y+s*.9)}C${r1(x-s*1.6)} ${r1(y-s*.1)} ${r1(x-s*.7)} ${r1(y-s*1.3)} ${x} ${r1(y-s*.45)}C${r1(x+s*.7)} ${r1(y-s*1.3)} ${r1(x+s*1.6)} ${r1(y-s*.1)} ${x} ${r1(y+s*.9)}Z`;
/* 蘑菇：茎 + 圆顶伞盖，(x,y) 为茎底。 */
const mush=(x:number,y:number,R:number,cap:string,stem:string)=>P(`M${r1(x-R*.32)} ${y}V${r1(y-R*.9)}H${r1(x+R*.32)}V${y}Z`,stem)+
 P(`M${r1(x-R)} ${r1(y-R*.8)}Q${r1(x-R)} ${r1(y-R*2)} ${x} ${r1(y-R*2)}Q${r1(x+R)} ${r1(y-R*2)} ${r1(x+R)} ${r1(y-R*.8)}Q${x} ${r1(y-R*.4)} ${r1(x-R)} ${r1(y-R*.8)}Z`,cap);
const lerp=(a:Pt,b:Pt,t:number):Pt=>[r1(a[0]+(b[0]-a[0])*t),r1(a[1]+(b[1]-a[1])*t)];
/* 四边形 [左下,右下,右上,左上] 内的相对位置，s 横向、t 纵向（0 在底）。 */
const quadAt=(q:Pt[],s:number,t:number):Pt=>lerp(lerp(q[0],q[1],s),lerp(q[3],q[2],s),t);

/* ==== 1 围栏：沿格子后缘（v≈.16）的一段，相邻格首尾相接 ==== */
const V=.16;
const fences:Art[]=[
 lit=>{const c=(x:string)=>dusk(x,lit);let s=strip(-.04,.06,1.04,.3)+P(plane(-.02,1.02,.12,8,11),c(PAL.woodDark))+P(plane(-.02,1.02,.12,19,22),c(PAL.woodDark));let tips='';
  [.02,.22,.42,.62,.82].forEach((u,i)=>{const w=.15;s+=P(poly([pt(u,V,0),pt(u+w,V,0),pt(u+w,V,24),pt(u+w/2,V,30),pt(u,V,24)]),c(i%2?'#e2c39a':PAL.woodLight));tips+=line([pt(u+.02,V,24),pt(u+w/2,V,29)]);});
  const f=pt(.7,.42);return s+hl(tips,.6,1.2)+leaf(f[0]-3,f[1]-2,3.5,-40,c(PAL.leaf))+leaf(f[0]+2,f[1]-3,3.5,30,c(PAL.leafLight))+C(f[0],f[1]-5,1.8,c('#f2b0c0'))+C(f[0]+4,f[1]-6,1.5,c('#f6e2a0'));},
 lit=>{const c=(x:string)=>dusk(x,lit);let s=strip(-.04,.06,1.04,.3)+P(plane(-.02,1.02,V,1,22),c('#c9a878'));
  for(const [k,h] of [[0,6],[1,11],[0,16]]){const a:Pt[]=[],b:Pt[]=[];for(let i=0;i<=13;i++){const u=-.02+i*.08;a.push(pt(u,V,h+((i+k)%2?2:-2)));b.push(pt(u,V,h+((i+k)%2?-2:2)));}s+=L(line(a),c('#8f7350'),1.5)+L(line(b),c('#e6d0a2'),1.1);}
  s+=L([.02,.34,.66,.98].map(u=>line([pt(u,V,0),pt(u,V,27)])).join(''),c(PAL.woodDark),2.4);
  const vine:Pt[]=[];for(let i=0;i<=10;i++)vine.push(pt(-.02+i*.104,V,23+(i%2?3:0)));s+=L(line(vine),c(PAL.leafDark),1.6);
  [[.1,25],[.3,27],[.52,24],[.72,27],[.9,25]].forEach(([u,h],i)=>{const p=pt(u,V,h);s+=leaf(p[0],p[1],3.4,i%2?35:-35,c(i%2?PAL.leafLight:PAL.leaf));});
  [[.2,26],[.62,26],[.84,24]].forEach(([u,h])=>{const p=pt(u,V,h);s+=C(p[0],p[1],1.8,c('#f2a9c0'));});return s;},
 lit=>{const c=(x:string)=>dusk(x,lit),pf=faces(c('#f6f2f8')),bf=faces(c('#e8e1ed'));let s=strip(-.04,.02,1.04,.32)+box(0,.08,1,.26,0,13,bf);
  s+=L(line([pt(0,.26,6.5),pt(1,.26,6.5)])+[.3,.55,.8].map((u,i)=>line([pt(u,.26,i%2?0:6.5),pt(u,.26,i%2?6.5:13)])).join(''),c('#c4bccf'),.9);
  s+=box(-.04,.05,1.04,.29,13,16,pf);
  for(const u of [0,.78]){s+=box(u,.04,u+.22,.3,0,23,bf)+box(u-.02,.02,u+.24,.32,23,26,pf);const p=pt(u+.11,.17,29.5);s+=C(p[0],p[1],3.4,c('#f8f5fb'))+C(p[0]-1,p[1]-1.2,1.2,HL,op(.7));}
  return s+hl(line([pt(-.04,.29,16),pt(1.04,.29,16)]),.5);},
 lit=>{const c=(x:string)=>dusk(x,lit);let s=strip(-.04,.06,1.04,.3),tops='',nodes='';const hs=[30,25,33,27,31,24,29,34,26,30];
  s+=L(line([pt(-.02,V+.03,8),pt(1.02,V+.03,8)]),c('#7c6a4a'),2);
  hs.forEach((h,i)=>{const u=.03+i*.104;s+=L(line([pt(u,V,0),pt(u,V,h)]),c(i%2?'#86b27a':'#a3c98e'),3.4);const t=pt(u,V,h);tops+=`M${t[0]-1.6} ${t[1]}h3.2`;for(const k of [10,20])if(k<h-3){const n=pt(u,V,k);nodes+=`M${n[0]-1.7} ${n[1]}h3.4`;}});
  return s+L(nodes,c('#5f8a56'),.9)+L(tops,c('#d9ebbf'),1.4)+L(line([pt(-.02,V+.03,20),pt(1.02,V+.03,20)]),c('#7c6a4a'),2)+L(`M${xy(pt(.35,V+.03,20))}l1.5 3M${xy(pt(.66,V+.03,8))}l1.5 3`,c('#7c6a4a'),1.2);},
 lit=>{const c=(x:string)=>dusk(x,lit);let s=strip(-.04,.06,1.04,.3);
  s+=L(`M${xy(pt(.1,V,12))}Q${xy(pt(.3,V,7))} ${xy(pt(.5,V,12))}Q${xy(pt(.7,V,7))} ${xy(pt(.9,V,12))}`,c(PAL.woodDark),2);
  s+=L(`M${xy(pt(-.04,V,6))}L${xy(pt(.1,V,6))}M${xy(pt(.9,V,6))}L${xy(pt(1.04,V,6))}M${xy(pt(.1,V,6))}Q${xy(pt(.3,V,3))} ${xy(pt(.5,V,6))}Q${xy(pt(.7,V,3))} ${xy(pt(.9,V,6))}`,c(PAL.woodDark),1.4);
  [[.1,19,7.5,'#e48a83'],[.5,26,9.5,'#e8a16c'],[.9,17,7,'#d9879e']].forEach(([u,h,R,col])=>{const p=pt(+u,V);const x=p[0],y=p[1],H=+h,r=+R;
   s+=P(`M${r1(x-2.6)} ${y}V${r1(y-H)}H${r1(x+2.6)}V${y}Z`,c('#f3e6cf'))+P(`M${r1(x-r)} ${r1(y-H+1)}Q${r1(x-r)} ${r1(y-H-r*1.15)} ${x} ${r1(y-H-r*1.1)}Q${r1(x+r)} ${r1(y-H-r*1.15)} ${r1(x+r)} ${r1(y-H+1)}Q${x} ${r1(y-H+3.5)} ${r1(x-r)} ${r1(y-H+1)}Z`,c(String(col)))+
    C(x-r*.45,y-H-r*.45,1.5,c('#fff6e6'))+C(x+r*.35,y-H-r*.7,1.2,c('#fff6e6'))+C(x+r*.6,y-H-r*.1,1,c('#fff6e6'));});
  return s+L(`M${xy(pt(.25,.3))}l-1 -4M${xy(pt(.27,.3))}l1 -3M${xy(pt(.75,.3))}l0 -4`,c(PAL.leafDark),1.2);},
 lit=>{const c=(x:string)=>dusk(x,lit),pf=faces(c('#b9b0dc')),moon=lit?'#fff1b8':'#f1df9e';let s=strip(-.04,.06,1.04,.3);
  s+=L(line([pt(-.02,V,8),pt(1.02,V,8)]),c('#cfc6ea'),2.2);
  s+=L(`M${xy(pt(.04,V,19))}Q${xy(pt(.27,V,31))} ${xy(pt(.5,V,19))}Q${xy(pt(.73,V,31))} ${xy(pt(.96,V,19))}`,c('#d8d0f0'),2.4);
  for(const u of [.04,.5,.96]){s+=box(u-.045,V-.045,u+.045,V+.045,0,24,pf);const p=pt(u,V,30);s+=(lit?C(p[0],p[1],7,'#fff1b8',op(.25)):'')+P(crescent(p[0]+1,p[1],4.6),moon);}
  for(const u of [.27,.73]){const p=pt(u,V,17);s+=P(star(p[0],p[1],2.8,1,4),lit?'#fff6c8':c('#f4e7b8'));}
  return s;}
];

/* ==== 2 灯：灯芯不压暗，白天柔光很淡 ==== */
function shard(x:number,y:number,w:number,h:number,t:number,lit:boolean):string{
 const a:Pt[]=[[x-w,y],[x-w+t,r1(y-h*.72)],[x+t,y-h],[x+w+t,r1(y-h*.72)],[x+w,y],[x,y+2]];
 return P(poly(a),lit?'#e9f9ff':'#d4eef9')+P(poly([[x,y+2],[x+t,y-h],[x+w+t,r1(y-h*.72)],[x+w,y]]),lit?'#b6e2f6':'#a3cde4')+L(`M${r1(x+t*.2)} ${y-3}L${r1(x+t*.75)} ${r1(y-h*.72)}`,'#ffffff',1.1,op(lit?.9:.6));
}
const lights:Art[]=[
 lit=>{const c=(x:string)=>dusk(x,lit);return shade(12,4.5,0,11)+(lit?E(7,12,15,5,'#ffd59a',op(.25)):'')+E(-9,12,4.5,2,c(PAL.stoneDark))+L('M-9 12V-44',c(PAL.woodDark),3.2)+L('M-9 -41Q-2 -51 9 -46',c(PAL.woodDark),2.4)+L('M9 -46V-39',c(PAL.ink),1)+
  halo(9,-27,20,'#ffb38a',lit)+E(9,-27,9,11.5,lit?'#ffb48c':'#ee8f7f')+E(9,-27,4.5,7,lit?'#fff2c8':'#f9c4a4',op(.85))+L('M9 -38.5V-15.5M4 -37Q1 -27 4 -17M14 -37Q17 -27 14 -17',lit?'#ffd9b5':'#c76e66',1)+
  P('M5 -41h8v3h-8Z',c('#5a4a52'))+P('M5 -16h8v3h-8Z',c('#5a4a52'))+L('M9 -13V-6M7.5 -8L9 -6L10.5 -8',c('#e0605a'),1.5)+hl('M3 -33Q1.5 -27 3 -21',.6);},
 lit=>{const c=(x:string)=>dusk(x,lit),ff='#fff59a';let s=shade(14,5,1,11)+cyl(0,10,11,5,9,c(PAL.wood))+E(0,1,7,3,'none',` stroke="${c(PAL.woodDark)}" stroke-width=".8"`)+halo(0,-16,22,'#e8ff9a',lit)+
  P('M-8 -1Q-11 -1 -11 -6V-26Q-11 -31 -6 -32H6Q11 -31 11 -26V-6Q11 -1 8 -1Z',lit?'#c9f0a8':'#d5ece0',' fill-opacity=".72"')+P('M-6 -32V-36H6V-32Z',c('#b9a07c'))+E(0,-36,6,1.8,c('#d8bf98'))+L('M-6 -35Q0 -46 6 -35',c(PAL.stoneDark),1.2);
  for(const [x,y] of [[-5,-10],[3,-16],[-2,-23],[6,-7],[4,-26],[-6,-18]])s+=C(x,y,3.4,ff,op(lit?.45:.18))+C(x,y,1.5,ff);
  for(const [x,y] of [[-17,-30],[15,-41],[18,-18]])s+=C(x,y,3,ff,op(lit?.4:.15))+C(x,y,1.1,ff);
  return s+hl('M-8 -27V-8',.7,1.6);},
 lit=>{const c=(x:string)=>dusk(x,lit),spot=lit?'#fff8c4':'#e8f6e8';return shade(17,5.5,1,11)+(lit?E(0,12,19,6,'#c9fff0',op(.22)):'')+P('M-4 12Q-6 -6 -3.5 -20H3.5Q6 -6 4 12Q0 14 -4 12Z',c('#f1e6d2'))+P('M1.5 -20H3.5Q6 -6 4 12Q2.5 13 1.5 13Z',c('#d6c7b4'))+
  halo(0,-24,25,'#b9fff0',lit)+E(0,-21,18,4.5,lit?'#fff3b8':'#f3e6c4')+P('M-21 -21Q-22 -46 0 -48Q22 -46 21 -21Q0 -27 -21 -21Z',c('#86c8c0'))+
  C(-10,-36,3,spot)+C(4,-42,2.6,spot)+C(12,-31,2.2,spot)+C(-2,-32,1.8,spot)+hl('M-15 -33Q-12 -43 -2 -45')+
  P('M14.5 13V6H17.5V13Z',c('#f1e6d2'))+E(16,6,5,1.4,lit?'#fff3b8':'#f3e6c4')+P('M10.5 6Q11 -3 16 -3Q21 -3 21.5 6Q16 4.5 10.5 6Z',c('#e6a7c4'))+C(14,1,1.1,spot);},
 lit=>{const c=(x:string)=>dusk(x,lit);return shade(17,6,1,11)+P('M-16 12Q-18 2 -8 -1Q2 -4 12 0Q19 4 16 12Q0 17 -16 12Z',c(PAL.stoneDark))+P('M-14 6Q-8 -1 2 -2Q12 -1 15 5Q0 9 -14 6Z',c(PAL.stone))+
  halo(0,-20,25,'#c8ecff',lit)+shard(-8,5,4.5,25,-5,lit)+shard(9,5,4,21,5,lit)+shard(0,7,6,40,0,lit)+C(0,-14,lit?3.2:2,'#ffffff',op(lit?.9:.6))+
  P(star(-15,-30,3.2,1,4),'#f4fbff')+P(star(14,-38,2.6,.9,4),'#f4fbff')+P(star(-10,-46,2,.7,4),'#f4fbff',op(lit?1:.7));},
 lit=>{const c=(x:string)=>dusk(x,lit);return shade(10,4,1,11)+cyl(0,11,6.5,2.8,3.5,c(PAL.stoneDark))+L('M0 8V-34',c('#8a84a6'),2.6)+E(0,-34,3,1.2,c('#b9b3c4'))+
  halo(0,-45,24,'#ffe9a0',lit)+P(star(0,-45,13,5.6),lit?'#ffd86a':'#f3cf6c')+P(star(0,-45,6.5,3),'#fff6c8')+
  P(star(-15,-54,3.6,1,4),'#fff6c8')+P(star(15,-31,2.8,.9,4),'#fff6c8')+P(star(16,-57,2,.7,4),'#fff6c8')+C(-14,-36,1,'#fff6c8');},
 lit=>{const c=(x:string)=>dusk(x,lit);return shade(15,5,1,11)+L('M-5 -10L-14 12M5 -10L14 11M0 -8L1 15',c('#6e6276'),2.4)+halo(0,-24,24,'#ffb070',lit)+
  P('M-14 -17Q-12 -5 0 -5Q12 -5 14 -17Z',c('#7c7085'))+L('M-13 -12Q0 -6 13 -12',c('#5f5468'),1.2)+E(0,-17,14,4.4,c('#9a8ea3'))+E(0,-17,11,3.1,lit?'#ff9a5a':'#d9774c')+
  P('M-8 -18Q-10 -30 -3 -36Q-2 -30 1 -31Q0 -40 5 -46Q12 -34 9 -18Z',lit?'#ffb05a':'#f2a35d')+P('M-4 -18Q-5 -26 0 -30Q1 -26 3 -27Q7 -24 5 -18Z','#ffe7a0')+
  C(-9,-40,1.2,'#ffd27a')+C(11,-48,1,'#ffd27a')+C(3,-54,.9,'#ffd27a');}
];

/* ==== 3 休憩 ==== */
const iron='#5f7a74';
const rests:Art[]=[
 lit=>{const c=(x:string)=>dusk(x,lit),us=[.16,.84];let s=strip(.06,.3,.94,.72);
  s+=L(us.map(u=>line([pt(u,.36,0),pt(u,.36,27)])).join(''),c(iron),2.4)+P(plane(.08,.92,.37,15,19),c(PAL.wood))+P(plane(.08,.92,.37,21,25.5),c(PAL.woodLight));
  s+=L(us.map(u=>line([pt(u,.44,0),pt(u,.44,9)])).join(''),c(iron),2.2)+box(.08,.4,.92,.64,9,11.5,faces(c(PAL.woodLight)))+L(line([pt(.08,.52,11.5),pt(.92,.52,11.5)]),c(PAL.woodDark),.8);
  s+=L(us.map(u=>line([pt(u,.62,0),pt(u,.62,9)])+line([pt(u,.38,18),pt(u,.64,15),pt(u,.66,12)])).join(''),c(iron),2.2);
  return s+hl(line([pt(.08,.37,25.5),pt(.92,.37,25.5)]),.6)+E(...pt(.3,.5,13),4.5,2.4,c('#e7a7a5'));},
 lit=>{const c=(x:string)=>dusk(x,lit),w=c('#a8805e');let s=shade(16,5.5,1,9);
  s+=L(`M${xy(pt(.3,.06,5))}Q${xy(pt(.3,.5,-4))} ${xy(pt(.3,.94,5))}M${xy(pt(.7,.06,5))}Q${xy(pt(.7,.5,-4))} ${xy(pt(.7,.94,5))}`,c(PAL.woodDark),2.8);
  s+=L([.3,.7].map(u=>line([pt(u,.33,1),pt(u,.33,42)])).join(''),w,2.6)+L([.41,.5,.59].map(u=>line([pt(u,.33,13),pt(u,.33,39)])).join(''),c(PAL.woodLight),1.8);
  s+=L(`M${xy(pt(.27,.33,40))}Q${xy(pt(.5,.33,50))} ${xy(pt(.73,.33,40))}`,w,3.4)+L([.3,.7].map(u=>line([pt(u,.66,1),pt(u,.66,11)])).join(''),w,2.4);
  s+=box(.27,.32,.73,.68,11,14,faces(c(PAL.woodLight)))+P(poly([pt(.32,.37,14),pt(.68,.37,14),pt(.68,.63,15.5),pt(.32,.63,15.5)]),c('#e7a7a5'));
  return s+L([.27,.73].map(u=>line([pt(u,.34,26),pt(u,.68,22),pt(u,.68,14)])).join(''),w,2.2)+hl(`M${xy(pt(.3,.33,41))}Q${xy(pt(.5,.33,50))} ${xy(pt(.7,.33,41))}`,.55,1.2);},
 lit=>{const c=(x:string)=>dusk(x,lit);let s=P(poly([pt(.06,.1,1),pt(.94,.06,1),pt(.96,.92,1),pt(.08,.94,1)]),c('#f6ece0'));let g='';
  for(const t of [.22,.42,.62,.82])g+=line([pt(.07,t,1),pt(.95,t,1)])+line([pt(t,.08,1),pt(t,.93,1)]);
  s+=L(g,c('#e48f8f'),3.4,op(.55))+L(line([pt(.08,.94,1),pt(.96,.92,1)]),c('#e48f8f'),1.4,' stroke-dasharray="1.5 2"');
  s+=box(.16,.18,.42,.38,1,9,faces(c('#c9a06c')))+L(line([pt(.16,.38,5),pt(.42,.38,5)]),c(PAL.woodDark),.8)+L(`M${xy(pt(.17,.28,9))}Q${xy(pt(.29,.28,20))} ${xy(pt(.41,.28,9))}`,c(PAL.woodDark),1.6);
  const pl=pt(.68,.62,1.5),ap=pt(.48,.8,3),cu=pt(.78,.3,1);
  return s+E(pl[0],pl[1],5.5,2.8,c('#fdfaf2'))+P(`M${pl[0]-3} ${pl[1]}l3 -3 3 3Z`,c('#f0cf8a'))+C(ap[0],ap[1],2.8,c('#e0605a'))+leaf(ap[0]+1.5,ap[1]-3.2,1.6,-30,c(PAL.leaf))+cyl(cu[0],cu[1],2.2,1,4,c('#a9c9e6'));},
 lit=>{const c=(x:string)=>dusk(x,lit);let s=shade(17,6,1,9)+E(...pt(.5,.52),10,3.6,c('#b8a27a'),op(.55));
  s+=L(line([pt(.1,.18,0),pt(.1,.5,54)])+line([pt(.9,.18,0),pt(.9,.5,54)]),c(PAL.woodDark),3);
  s+=L(line([pt(.04,.5,54),pt(.96,.5,54)]),c(PAL.wood),3.8)+hl(line([pt(.06,.5,55.5),pt(.94,.5,55.5)]),.55,1.1);
  s+=L(line([pt(.3,.5,53),pt(.3,.5,17)])+line([pt(.7,.5,53),pt(.7,.5,17)]),c('#e8dcc0'),1.2);
  for(const u of [.3,.7]){const p=pt(u,.5,51);s+=leaf(p[0]-2,p[1]+1,2.6,-30,c(PAL.leaf))+C(p[0]+1.5,p[1]+3,1.4,c('#f2a9c0'));}
  return s+box(.24,.43,.76,.58,15,18,faces(c('#e6a8a0')))+L(line([pt(.1,.82,0),pt(.1,.5,54)])+line([pt(.9,.82,0),pt(.9,.5,54)]),c(PAL.wood),3);},
 lit=>{const c=(x:string)=>dusk(x,lit),cv='#a9d3d6';let s=strip(.08,.24,1,.76);
  s+=L(line([pt(.17,.3,34),pt(.44,.3,13),pt(.94,.3,11)])+line([pt(.44,.3,0),pt(.44,.3,13)])+line([pt(.92,.3,0),pt(.92,.3,11)])+line([pt(.3,.3,0),pt(.22,.3,28)]),c(PAL.woodDark),2.2);
  s+=P(poly([pt(.17,.31,34),pt(.44,.31,13),pt(.44,.69,13),pt(.17,.69,34)]),c(cv))+P(poly([pt(.44,.31,13),pt(.93,.31,11),pt(.93,.69,11),pt(.44,.69,13)]),c('#bfe2e2'));
  s+=L([.43,.57].map(v=>line([pt(.17,v,34),pt(.44,v,13),pt(.93,v,11)])).join(''),c('#f3f0e4'),2.6);
  const p=pt(.22,.5,31);s+=E(p[0],p[1],6,3.4,c('#f5e2c6'),` transform="rotate(-20 ${p[0]} ${p[1]})"`);
  s+=P(poly([pt(.74,.33,11.5),pt(.86,.33,11.2),pt(.86,.67,11.2),pt(.74,.67,11.5)]),c('#e9a3a3'));
  return s+L(line([pt(.17,.7,34),pt(.44,.7,13),pt(.94,.7,11)])+line([pt(.44,.7,0),pt(.44,.7,13)])+line([pt(.92,.7,0),pt(.92,.7,11)])+line([pt(.3,.7,0),pt(.22,.7,28)]),c(PAL.wood),2.4);},
 lit=>{const c=(x:string)=>dusk(x,lit),stool=(x:number,y:number)=>cyl(x,y,5.5,2.6,6,c('#b08766'))+E(x,y-6,3.4,1.5,'none',` stroke="${c('#8a6a4f')}" stroke-width=".8"`);
  return shade(21,7,1,10)+P('M-16 7Q-14 3 -12 6M12 6Q15 3 17 7',c('#8a6a4f'))+cyl(0,6,13,6.2,15,c('#a57a58'))+E(0,-9,11.5,5.4,c('#e2c296'))+E(0,-9,7.5,3.4,'none',` stroke="${c('#c49d70')}" stroke-width="1"`)+E(0,-9,3.5,1.6,'none',` stroke="${c('#c49d70')}" stroke-width="1"`)+
   L('M-8 -1V7M4 0V9M-2 1V10',c('#7d5a42'),1)+E(-4,-10,4.2,1.8,c('#f3efe6'))+cyl(-4,-11,2.6,1.2,4,c('#f8f4ec'))+E(5,-7.5,4.5,2,c(PAL.leafLight))+C(4,-8.5,1.3,c('#d65a6a'))+C(6.5,-8,1.3,c('#d65a6a'))+
   stool(-16,11)+stool(15,12);}
];

/* ==== 4 花架与花器 ==== */
const pot=(p:Pt,f:string,c:(x:string)=>string)=>{const [x,y]=p;return P(`M${r1(x-3.4)} ${r1(y-5.5)}H${r1(x+3.4)}L${r1(x+2.4)} ${y}H${r1(x-2.4)}Z`,c('#d98b6a'))+C(x,y-7.5,3.6,c(PAL.leaf))+C(x-1.3,y-9,1.9,c(f))+C(x+1.7,y-8.3,1.5,c(f));};
const flowers:Art[]=[
 lit=>{const c=(x:string)=>dusk(x,lit),wf=faces(c(PAL.woodLight)),side=(u:number)=>L(line([pt(u,.2,0),pt(u,.2,33)])+line([pt(u,.2,33),pt(u,.86,0)]),c(PAL.woodDark),2.2);
  return strip(.08,.14,.92,.9)+side(.14)+box(.12,.2,.88,.38,30,32.5,wf)+pot(pt(.32,.29,32.5),'#f2a9c0',c)+pot(pt(.68,.29,32.5),'#b7a2dc',c)+
   box(.12,.42,.88,.6,19,21.5,wf)+pot(pt(.3,.51,21.5),'#f6d27a',c)+pot(pt(.7,.51,21.5),'#fdfaf2',c)+
   box(.12,.64,.88,.82,8,10.5,wf)+pot(pt(.32,.73,10.5),'#ef9a7a',c)+pot(pt(.68,.73,10.5),'#9cc4e6',c)+side(.86);},
 lit=>{const c=(x:string)=>dusk(x,lit);let s=shade(19,6,1,11)+E(0,9,8,3.2,c(PAL.stone))+L('M-14 6V-34Q3 -66 20 -34V6',c(PAL.woodDark),3)+L('M-17 12V-28Q0 -60 17 -28V12',c(PAL.wood),3.4)+
  L('M-17 -8L-14 -13M17 -8L20 -13M-15 -36L-12 -41M15 -36L18 -41M0 -44L3 -49',c(PAL.woodDark),1.6)+
  L('M-17 10Q-20 0 -16 -10Q-13 -20 -17 -28Q-14 -40 -6 -43Q0 -46 6 -43Q14 -40 17 -28Q20 -18 16 -8Q14 2 17 10',c(PAL.leafDark),1.5);
  for(const [x,y,k] of [[-17,-20,0],[-14,-35,1],[-7,-42,0],[0,-45,1],[7,-42,0],[14,-35,1],[17,-20,0],[-16,-4,1],[17,-6,1],[-3,-47,0],[11,-40,1]])s+=C(x,y,3,c(k?PAL.leafLight:PAL.leaf));
  s+=L('M-12 -37v8M-6 -41v11M0 -42v7M6 -41v10M12 -37v8',c('#b7a2dc'),3.4)+L('M-12 -37v4M-6 -41v5M6 -41v4M12 -37v4M0 -42v3',c('#ddd0f2'),2.4);
  for(const [x,y] of [[-18,-13],[16,-24],[-15,-29],[18,-1],[-17,4]])s+=C(x,y,1.9,c('#f2b0c0'));
  return s;},
 lit=>{const c=(x:string)=>dusk(x,lit);let s=shade(12,4.5,-3,11)+E(-11,12,4,1.8,c(PAL.stoneDark))+L('M-11 12V-46Q-11 -56 -1 -56Q8 -56 8 -48',c('#6e6a86'),2.6)+L('M-11 -46Q-16 -46 -15 -50Q-14 -53 -11 -51',c('#6e6a86'),1.6)+
  L('M8 -48L0 -30M8 -48L8 -30M8 -48L16 -30',c('#8f8aa6'),.9)+C(2,-32,3.6,c(PAL.leaf))+C(8,-34,4,c(PAL.leafLight))+C(14,-32,3.6,c(PAL.leaf))+
  P('M-1 -30Q0 -18 8 -18Q16 -18 17 -30Z',c('#b08a66'))+E(8,-30,9,2.6,c('#d2b086'))+L('M0 -26Q8 -22 16 -26M2 -22Q8 -19.5 14 -22',c(PAL.woodDark),.9)+
  L('M1 -29Q-3 -20 -1 -9M15 -29Q20 -18 17 -5M8 -19Q9 -12 7 -6',c(PAL.leafDark),1.4);
  for(const [x,y,a] of [[-2,-21,40],[-1,-13,-30],[18,-19,-40],[18,-10,30],[8,-12,20]])s+=leaf(x,y,2.6,a,c(PAL.leafLight));
  for(const [x,y] of [[-3,-16],[19,-14],[7,-7],[3,-35],[12,-36],[17,-6]])s+=C(x,y,1.8,c('#f2a0b8'));
  return s;},
 lit=>{const c=(x:string)=>dusk(x,lit);let s=shade(14,5,0,11)+L('M-15 12L3 -50M15 12L-3 -50',c(PAL.woodDark),2.6)+C(0,-40,2,c('#d9c9a0'))+L('M0 -40V-33',c(PAL.ink),.9)+
  E(0,-31,9,2.8,c(PAL.wood))+E(0,-32,9,2.8,c(PAL.woodLight))+L('M-6.5 -31V-19M-3 -30V-13M3 -30V-15M6.5 -31V-22M0 -30V-3',c('#efe4c8'),.8);
  for(const [x,y,col] of [[-6.5,-16,'#c98a55'],[-3,-10,'#a8784e'],[3,-12,'#d8a46a'],[6.5,-19,'#b8875a']])s+=E(+x,+y,2.2,3,c(String(col)))+P(`M${+x-2.4} ${+y-2}Q${x} ${+y-5} ${+x+2.4} ${+y-2}Z`,c('#7a5a40'));
  return s+P('M0 -3Q-8 1 -9 8Q-3 6 0 -1Z',c('#d9b06a'))+P('M0 -3Q8 1 9 8Q3 6 0 -1Z',c('#c99a5a'))+C(0,-2.5,1.6,c('#8a6a4f'))+hl('M-14 -26Q-16 -20 -14 -14',.6)+hl('M14 -28Q16 -22 14 -16',.6);},
 lit=>{const c=(x:string)=>dusk(x,lit),pet=(a:number,col:string,k=1)=>P(`M0 0Q${-3*k} ${-5*k} 0 ${-11*k}Q${3*k} ${-5*k} 0 0Z`,c(col),` transform="translate(2 -1) rotate(${a})"`);
  return shade(22,7,2,13)+cyl(0,10,20,8.5,10,c('#bcd8cf'))+L('M-19 5Q0 13 19 5',c('#8fb2a9'),1.2)+E(0,0,17.5,7,c('#e2efe9'))+E(0,.6,16,6.2,'url(#lw-water)')+
   E(-9,1,6,2.6,c(PAL.leaf))+L('M-9 1l5 -1.2',c(PAL.waterDeep),1)+E(10,3,5,2.2,c(PAL.leafLight))+L('M10 3l4 .6',c(PAL.waterDeep),1)+
   L('M-12 -1Q-13 -9 -11 -15',c(PAL.leafDark),1.2)+P('M-11 -15Q-14 -18 -11 -23Q-8 -18 -11 -15Z',c('#f4b3c6'))+
   pet(-70,'#f4b3c6')+pet(70,'#f4b3c6')+pet(-35,'#f7c4d3')+pet(35,'#f7c4d3')+pet(0,'#fbd6e0',1.15)+E(2,-2,2.6,1.4,c('#f6d27a'))+hl('M-16 -1Q-8 -6 4 -6',.45);},
 lit=>{const c=(x:string)=>dusk(x,lit),tr=(u:number)=>L(line([pt(u,.25,0),pt(u,.75,22)])+line([pt(u,.75,0),pt(u,.25,22)]),c(PAL.woodDark),2.4);
  const log=(A:Pt,B:Pt,r:number,col:string)=>{const o:Pt=[-.546*r,.838*r],q=(p:Pt,k:number):Pt=>[r1(p[0]+o[0]*k),r1(p[1]+o[1]*k)];
   return P(poly([q(A,1),q(B,1),q(B,-1),q(A,-1)]),c(col))+L(line([q(A,-.6),q(B,-.6)]),HL,1.2,' stroke-opacity=".35"')+E(B[0],B[1],r,r*.62,c('#e2c296'),` transform="rotate(-57 ${B[0]} ${B[1]})"`)+E(B[0],B[1],r*.45,r*.28,'none',` stroke="${c('#b08a66')}" stroke-width=".8" transform="rotate(-57 ${B[0]} ${B[1]})"`);};
  const A=pt(.04,.5,28),B=pt(.96,.5,28),top=(t:number):Pt=>[r1(A[0]+(B[0]-A[0])*t+3),r1(A[1]+(B[1]-A[1])*t-4.6)];
  let s=strip(0,.2,1,.9)+tr(.16)+log(A,B,5.5,'#8f6d50')+tr(.84);
  [[.14,4.8,'#c08a5c'],[.4,6.8,'#e6a25a'],[.66,5,'#d9879e'],[.86,3.6,'#c08a5c']].forEach(([t,R,col])=>{const p=top(+t);s+=mush(p[0],p[1]+1,+R,c(String(col)),c('#f3e6cf'));});
  const m=lerp(A,B,.6);s+=P(`M${m[0]-5} ${m[1]+1}Q${m[0]} ${m[1]+6.5} ${m[0]+5} ${m[1]+1}Z`,c('#f0d29a'))+P(`M${m[0]-12} ${m[1]-3}Q${m[0]-8} ${m[1]+2} ${m[0]-4} ${m[1]-3.5}Z`,c('#f0d29a'));
  const A2=pt(.1,.86,4.5),B2=pt(.92,.86,4.5);s+=log(A2,B2,4.5,'#9a7556');
  const g=lerp(A2,B2,.35);return s+mush(g[0]+2.5,g[1]-3,4,c('#d9879e'),c('#f3e6cf'))+mush(g[0]+9,g[1],3,c('#e6a25a'),c('#f3e6cf'));}
];

/* ==== 5 标牌：不写字，只用图标 ==== */
const signs:Art[]=[
 lit=>{const c=(x:string)=>dusk(x,lit),pf=faces(c(PAL.wood)),rf=faces(c(PAL.roofs[0]));
  const b3=pt(.3,.43,16.5),b2=pt(.57,.32,30.5),b1=pt(.64,.57,42);
  return shade(11,4,1,10)+P(poly([pt(.62,.43,20),pt(.12,.43,20),pt(.03,.43,16.5),pt(.12,.43,13),pt(.62,.43,13)]),c('#e8b9b9'))+C(b3[0],b3[1],1.8,c('#6c9eae'))+
   box(.44,.44,.56,.56,0,48,pf)+P(poly([pt(.42,.58,48),pt(.58,.58,48),pt(.5,.5,54)]),rf.left)+P(poly([pt(.58,.42,48),pt(.58,.58,48),pt(.5,.5,54)]),rf.right)+
   P(poly([pt(.57,.6,34),pt(.57,.12,34),pt(.57,.03,30.5),pt(.57,.12,27),pt(.57,.6,27)]),c('#a9d3c0'))+leaf(b2[0],b2[1],2.6,-50,c(PAL.leafDark))+
   P(poly([pt(.38,.57,46),pt(.86,.57,46),pt(.96,.57,42),pt(.86,.57,38),pt(.38,.57,38)]),c(PAL.cream))+P(`M${b1[0]-2.6} ${b1[1]+2.2}V${b1[1]-.4}L${b1[0]} ${b1[1]-3}L${b1[0]+2.6} ${b1[1]-.4}V${b1[1]+2.2}Z`,c('#c98a6a'))+
   hl(line([pt(.4,.57,45.5),pt(.86,.57,45.5)]),.6,1.1)+L('M-6 13l-2 -5M-4 13l0 -6M-2 13l2 -4',c(PAL.leafDark),1.2)+E(7,13,2.4,1.4,c(PAL.stone))+E(10,11,1.6,1,c(PAL.stoneDark));},
 lit=>{const c=(x:string)=>dusk(x,lit);let s=shade(17,6,1,10)+E(0,8,17,7,c('#8d6c52'))+E(0,6,14,5,c('#a8826a'))+L('M-12 6V-2M-5 9V-4',c('#6f9d6a'),1.4);
  for(const [x,y,a] of [[-12,-2,-35],[-12,-2,35],[-5,-4,-35],[-5,-4,35]])s+=leaf(x+(a<0?-2.4:2.4),y-1,2.8,a,c(PAL.leafLight));
  s+=`<g transform="rotate(7 7 12)">`+P('M6.5 14.5L6 -10H10Q13.5 -10 13.5 -14V-34Q13.5 -38 9.5 -38H0.5Q-3.5 -38 -3.5 -34V-14Q-3.5 -10 0.5 -10H4.5L5 14.5L5.8 16Z',c('#c9bfa6'),' transform="translate(1.5 1)"')+
   P('M6.5 14.5L6 -10H10Q13.5 -10 13.5 -14V-34Q13.5 -38 9.5 -38H0.5Q-3.5 -38 -3.5 -34V-14Q-3.5 -10 0.5 -10H4.5L5 14.5L5.8 16Z',c('#f6efdc'))+
   C(5,-34.5,1.1,c('#a8957a'))+P('M5 -14Q-2 -20 1 -30Q10 -26 5 -14Z',c(PAL.leaf))+L('M5 -14L3 -27',c(PAL.leafLight),1)+`</g>`;
  return s+P('M-15 11V-2H-19V-9H-10V-2H-14V11Z',c('#efb6b6'))+C(-14.5,-5.5,1.3,c('#f6d27a'));},
 lit=>{const c=(x:string)=>dusk(x,lit),F:Pt[]=[pt(0,.82),pt(1,.82),pt(1,.52,38),pt(0,.52,38)],I:Pt[]=[quadAt(F,.1,.08),quadAt(F,.9,.08),quadAt(F,.9,.9),quadAt(F,.1,.9)],h=quadAt(F,.5,.62),t=quadAt(F,.62,.86);
  return strip(0,.16,1.04,.88)+P(poly([pt(0,.52,38),pt(1,.52,38),pt(1,.22),pt(0,.22)]),c(PAL.woodDark))+L(line([pt(1,.74,10),pt(1,.3,10)]),c(PAL.woodDark),1.4)+
   P(poly(F),c(PAL.wood))+P(poly(I),c('#56766a'))+P(heart(h[0],h[1],4.8),c('#f2a9b8'))+L(line([quadAt(F,.22,.34),quadAt(F,.78,.34)])+line([quadAt(F,.28,.22),quadAt(F,.62,.22)]),c('#eef3e6'),1.2,op(.8))+
   P(star(t[0],t[1],2.4,1,4),c('#f6e2a0'))+hl(line([pt(0,.52,38),pt(1,.52,38)]),.6)+C(...quadAt(F,.5,.97),1.3,c('#d9b87a'));},
 lit=>{const c=(x:string)=>dusk(x,lit),pin=(x:number,y:number,col:string)=>C(x,y,1.1,c(col));
  return shade(22,6,0,9)+L('M-18 8V-36M18 8V-36',c(PAL.woodDark),3.4)+P('M-21 -35H21V-11H-21Z',c(PAL.wood))+P('M-19 -33H19V-13H-19Z',c('#d2a776'))+
   P('M-26 -36L0 -50L26 -36Z',c(PAL.roofs[0]))+P('M-26 -36H26L24 -33H-24Z',c('#a46c56'))+hl('M-23 -36.5L0 -49',.55)+
   P('M-17 -31h9v8h-9Z',c('#fbf3dc'),' transform="rotate(-6 -12.5 -27)"')+pin(-12.5,-30,'#e0605a')+P('M-5 -32h8v7h-8Z',c('#f6c4cf'))+pin(-1,-31,'#6c9eae')+
   P('M6 -31h10v9h-10Z',c('#cfe3f0'),' transform="rotate(5 11 -26.5)"')+pin(11,-30,'#f2c44e')+L('M-15.5 -28h6M-15.5 -25.5h4.5M8 -27h6M8 -24.5h4',c('#9a8a7a'),.8)+
   P('M-14 -22h13v8h-13Z',c('#f6ecd2'))+L('M-12 -16.5q3 -4 5.5 -1.5t4 -3',c('#c26d5a'),.9,' stroke-dasharray="1.2 1.2"')+L('M-4 -20.5l2 2M-2 -20.5l-2 2',c('#c26d5a'),.9)+pin(-7.5,-21,'#7fae8c')+
   P('M4 -21h9v7h-9Z',c('#f6e2a0'),' transform="rotate(-4 8.5 -17.5)"')+P(heart(8.5,-17,2.2),c('#e08a8a'))+L('M-21 -11H21',c(PAL.woodDark),1.6);},
 lit=>{const c=(x:string)=>dusk(x,lit),sc='#fff6c8',pts:Pt[]=[[-9,-43],[-3,-46],[3,-41],[9,-45],[4,-33],[-2,-30]];let s=shade(12,4.5,1,10)+P('M-8 11Q-8 6 0 6Q8 6 8 11Q0 14 -8 11Z',c(PAL.stoneDark))+L('M0 7V-22',c(PAL.stoneDark),3.4)+
  halo(0,-37,24,'#c8c4ff',lit)+C(2,-36,17.5,c('#9c7f52'))+C(0,-37,17.5,c('#d9b87a'))+C(0,-37,14.5,lit?'#25306a':'#34407a')+L('M0 -54V-51M0 -23V-20M-17.5 -37h3M14.5 -37h3',c('#a58550'),1.2)+
  L('M-9 -43L-3 -46L3 -41L9 -45M3 -41L4 -33L-2 -30',sc,.7,op(.6));
  for(const [x,y] of pts)s+=C(x,y,1.2,sc);
  return s+P(star(-7,-31,3.4,1.1,4),sc)+P(crescent(9,-31,3.2),'#f4e3a8')+hl('M-12 -49A17 17 0 0 1 5 -53.5',.6);},
 lit=>{const c=(x:string)=>dusk(x,lit),blob='M-18 -14C-21 -26 -11 -46 0 -46C11 -46 21 -26 18 -14Q0 -7 -18 -14Z';
  return shade(12,4.5,1,10)+L('M0 12V-16',c(PAL.woodDark),3)+P(blob,c('#6fae98'),' transform="translate(2 1.5)"')+P(blob,c('#9fd8c0'))+P('M-15 -15Q0 -9 15 -15Q0 -12 -15 -15Z',c('#c8eedd'))+
   E(-8,-37,4.5,2.2,'#ffffff',' opacity=".7" transform="rotate(-30 -8 -37)"')+E(-6,-27,1.8,2.6,c(PAL.ink))+E(6,-27,1.8,2.6,c(PAL.ink))+C(-5.4,-28,.6,'#fff')+C(6.6,-28,.6,'#fff')+
   E(-11,-21.5,2.6,1.3,'#f2a3b5',op(.7))+E(11,-21.5,2.6,1.3,'#f2a3b5',op(.7))+L('M-2.5 -22q2.5 2.5 5 0',c(PAL.ink),1.1)+
   P('M-11 -6H11V3H-11Z',c(PAL.cream))+P('M-11 3H11L10 4.5H-10Z',c('#c9b28c'))+C(-6,-1.5,1.2,c('#b8a88e'))+C(-2.5,-1.5,1.2,c('#b8a88e'))+C(1,-1.5,1.2,c('#b8a88e'))+P(heart(6,-1.5,2.2),c('#e08a8a'));}
];

/* ==== 6 自然 ==== */
const bee=(x:number,y:number,c:(x:string)=>string)=>E(x-1,y-2.6,2.2,1.5,'#f4fbff',op(.85))+E(x+1.5,y-2.8,2,1.4,'#f4fbff',op(.85))+E(x,y,3.2,2.2,c('#f2c44e'))+L(`M${x-.8} ${y-2}v4M${x+1} ${y-2}v4`,c('#4a3a30'),.9);
const natures:Art[]=[
 lit=>{const c=(x:string)=>dusk(x,lit);let s=shade(21,6.5,1,12)+L('M14 2L26 -34',c(PAL.wood),2)+P('M-21 11Q-21 -10 -2 -15Q19 -12 21 11Q0 17 -21 11Z',c('#c98450'));
  for(const [x,y,a,col] of [[-14,4,-30,'#e8a24f'],[-6,-8,20,'#d9704f'],[4,-11,-15,'#f0c35a'],[12,-3,35,'#e8a24f'],[-11,-3,60,'#f0c35a'],[2,-2,-50,'#d9704f'],[15,6,10,'#b5643e'],[-2,6,25,'#e8a24f'],[8,4,-70,'#f0c35a'],[-16,10,15,'#d9704f'],[-4,-12,-60,'#b5643e'],[17,14,40,'#f0c35a'],[-8,16,-20,'#e8a24f']])s+=leaf(+x,+y,4.6,+a,c(String(col)));
  return s+L('M9 5L20 0',c(PAL.woodDark),2)+L('M10 5l-.5 3M13 3.6l-.5 3M16 2.2l-.5 3M19 .8l-.5 3',c(PAL.woodDark),1)+L('M-4 -12l3 1M4 -11l-2 2',c('#8a5a3c'),.7);},
 lit=>{const c=(x:string)=>dusk(x,lit);let s=shade(17,6,1,12)+L('M-14 -7Q0 -44 14 -7',c(PAL.woodDark),3);
  for(const [x,y,k] of [[-11,-9,0],[-4,-13,1],[5,-12,0],[11,-9,1]])s+=C(x,y,4.2,c(k?PAL.leafLight:PAL.leaf));
  s+=P('M-16 -6Q-14 12 0 13Q14 12 16 -6Z',c('#c9a06c'))+L('M-15 0Q0 6 15 0M-12 6Q0 11 12 6',c('#9c7a52'),1)+E(0,-6,16,5,c('#ddb984'));
  for(const [x,y,col] of [[-10,-11,'#f2a9c0'],[-3,-16,'#f6d27a'],[4,-13,'#fdfaf2'],[11,-10,'#c4b2e6'],[-13,-5,'#f6d27a'],[13,-4,'#f2a9c0'],[1,-8,'#f2a9c0']])s+=C(+x,+y,2.7,c(String(col)))+C(+x,+y,1,c('#e8a24f'));
  return s+L('M-24 -24Q-16 -32 -8 -26T6 -32',c('#fff3dc'),.9,' stroke-dasharray="1.2 2" stroke-opacity=".7"')+bee(-20,-26,c)+bee(12,-33,c);},
 lit=>{const c=(x:string)=>dusk(x,lit),bird='#8fb3d9',wing='#7397c0';return shade(16,5,2,13)+cyl(0,13,9,4,4,c(PAL.stoneDark))+P('M-3.5 9V-14H3.5V9Z',c(PAL.stone))+P('M1 9V-14H3.5V9Z',c(PAL.stoneDark))+
  P('M-19 -18Q-12 -8 0 -8Q12 -8 19 -18Z',c(PAL.stoneDark))+E(0,-18,19,6.5,c('#d6d0dc'))+E(0,-17.6,15.5,5,'url(#lw-water)')+L('M-8 -18q4 -2 8 0M2 -16q3 -1.5 6 0',PAL.foam,1,op(.8))+
  P('M15.5 -24l5.5 -3 -1 4.5Z',c(wing))+E(12,-23,5,3.2,c(bird),' transform="rotate(-15 12 -23)"')+E(10,-21.8,2.8,2.2,c('#f2b8a0'))+E(13.5,-24,3,1.7,c(wing),' transform="rotate(-15 13.5 -24)"')+
  C(8,-27,2.9,c(bird))+P('M5.4 -27.6l-2.8 1 2.8 .9Z',c('#e8a24f'))+C(7.4,-27.8,.6,c(PAL.ink))+L('M-14 -26q-2 -3 0 -5M-10 -28q-1 -3 1 -5',c(PAL.foam),1,op(.7))+hl('M-17 -19Q-10 -13 0 -13',.4);},
 lit=>{const c=(x:string)=>dusk(x,lit),hole='#3d2f2a';let s=shade(14,5,2,13)+cyl(0,11,11,5,34,c('#9a7556'))+E(0,-23,9,4,c('#d8b98e'))+E(0,-23,5.5,2.4,'none',` stroke="${c('#b08a66')}" stroke-width=".9"`)+
  L('M-8 -16Q-9 -4 -7 8M-1 -14Q0 0 -2 13M6 -17Q5 -5 7 10',c('#7d5a42'),1);
  for(const [x,y,rx,ry] of [[-4,-12,2.2,2.6],[3,-4,1.6,2],[-6,1,1.8,2.2],[4,7,2.4,2.8],[6,-14,1.4,1.8],[-1,6,1.2,1.5]])s+=E(x,y,rx,ry,c(hole));
  return s+C(-4,-12,1.2,c('#6d8a4a'))+C(8.5,-8,3,c('#e0504a'))+C(8.5,-11,1.6,c(PAL.ink))+L('M8.5 -11v6',c(PAL.ink),.7)+C(7.3,-8,.6,c(PAL.ink))+C(9.7,-7,.6,c(PAL.ink))+
   P('M-11 11Q-12 4 -6 6Q-3 2 0 7Q-4 13 -11 11Z',c(PAL.leaf))+mush(14,13,2.6,c('#e6a25a'),c('#f3e6cf'))+hl('M-9 -20V-8',.4);},
 lit=>{const c=(x:string)=>dusk(x,lit);return shade(21,6,1,12)+P('M-15 8Q-19 -8 -6 -18Q8 -24 15 -9Q19 2 13 9Q0 13 -15 8Z',c(PAL.stone))+P('M5 -20Q15 -16 15 -9Q19 2 13 9Q8 11 4 11Q10 -4 5 -20Z',c(PAL.stoneDark))+
  P('M-13 -8Q-10 -19 -3 -20Q8 -23 13 -12Q6 -14 2 -10Q-4 -15 -13 -8Z',c(PAL.leaf))+C(-6,-17,1.6,c(PAL.leafLight))+C(4,-19,1.3,c(PAL.leafLight))+
  P('M-22 13Q-23 3 -15 2Q-8 2 -8 11Q-14 15 -22 13Z',c('#c8c2d2'))+P('M-21 6Q-17 1 -11 3Q-14 6 -21 6Z',c(PAL.leafLight))+P('M8 15Q8 7 14 7Q21 7 21 14Q15 17 8 15Z',c('#aea7bb'))+P('M9 11Q13 6 19 9Q14 11 9 11Z',c(PAL.leaf))+
  L('M-2 13Q-5 5 -13 0M-5 8l-1.5 -3M-8 5l-1.5 -3M-11 2.5l0 -3M-5 8l2.5 -1.5M-8 5l2.5 -1.5',c(PAL.leafDark),1.3)+C(12,4,1.2,'#fff6e0')+C(-17,0,1.2,'#fff6e0')+C(0,-21,1.1,'#fff6e0')+hl('M-12 -2Q-12 -10 -7 -14',.45);},
 lit=>{const c=(x:string)=>dusk(x,lit);let s=E(1,8,22,8.5,SH,op(.15))+L('M-12 -1Q-13 -14 -14 -25M-8 -1Q-7 -12 -5 -20M-16 0Q-19 -8 -21 -14',c(PAL.leafDark),1.4)+E(-14,-25,1.4,3.6,c('#8a5a3c'))+E(-5,-20,1.3,3.2,c('#8a5a3c'))+
  E(0,6,21,9.5,c('#cfc6b2'))+E(0,5.6,18.5,8,c('#9c9583'))+E(0,6,17,7,'url(#lw-water)')+E(5,7.5,5,2,'none',' stroke="#effbf6" stroke-opacity=".75" stroke-width="1"')+E(5,7.5,9.5,3.8,'none',' stroke="#effbf6" stroke-opacity=".35" stroke-width="1"')+
  E(-7,3.2,4,2,c(PAL.stoneDark))+E(-7,2.6,3.6,1.6,c(PAL.stone));
  for(const [x,y,rx,k] of [[-19,9,3,0],[-12,13.5,3.2,1],[5,15,3,0],[16,11,3.4,1],[19,3,2.6,0],[-18,1,2.6,1]])s+=E(x,y,rx,rx*.6,c(k?'#d6d0dc':PAL.stone));
  return s+L('M9 -13h7',c('#6c9eae'),1.2)+E(12,-15,2.6,1,'#effbf6',op(.85))+E(12,-11,2.6,1,'#effbf6',op(.85));}
];

/* ==== 7 纪念物 ==== */
const keeps:Art[]=[
 lit=>{const c=(x:string)=>dusk(x,lit);let s=shade(14,5,1,11)+L('M2 -40L9 10',c(PAL.woodDark),2.2)+L('M-6 -40L-12 12M6 -40L11 12',c(PAL.wood),2.4)+
  P('M-14 -48H14L16 -8H-16Z',c('#c9a46e'))+P('M-11.5 -45H11.5L13 -11H-13Z',c('#f3e8cf'))+P('M-9 -42H9L10 -14H-10Z',c('#e6d6b0'))+
  L('M0 -16Q-1 -24 0 -31',c('#7c9a5c'),1.6)+P('M0 -24Q-8 -25 -8 -31Q-2 -31 0 -24Z',c('#93b06a'))+P('M0 -27Q7 -29 8 -35Q1 -35 0 -27Z',c('#a8c27a'))+C(0,-35,2.2,c('#8a6a4f'));
  for(let i=0;i<6;i++){const a=i*Math.PI/3;s+=C(Math.cos(a)*4.4,-35+Math.sin(a)*4.4,1.3,c('#e8b25a'));}
  for(const x of [-6,-3,0,3,6])s+=E(x,-16+Math.abs(x)*.15,1.1,.8,c('#8a6a4f'));
  return s+hl('M-13 -47H13',.55)+L('M-17 -7H17',c(PAL.woodDark),2.6)+E(-15,13,1.4,.9,c('#a8784e'))+E(-12,15,1.2,.8,c('#d8a46a'));},
 lit=>{const c=(x:string)=>dusk(x,lit),wave=c('#6fa6bf');return shade(21,6,2,11)+E(-6,14,13,3.4,'url(#lw-water)')+L('M-14 14q4 -1.2 8 0M-2 15q3 -1 6 0',PAL.foam,.9,op(.7))+
  P('M-20 9Q-23 -6 -12 -15Q-1 -25 12 -19Q22 -12 21 2Q19 11 6 12Q-8 13 -20 9Z',c(PAL.stone))+P('M12 -19Q22 -12 21 2Q19 11 6 12Q15 0 12 -19Z',c(PAL.stoneDark))+
  P('M-16 -6Q-11 -16 -1 -19Q8 -21 12 -18Q3 -14 -16 -6Z',c('#d3cedd'))+P('M-19 4Q-14 0 -9 3Q-12 7 -19 4Z',c(PAL.leaf))+
  L('M-15 -4q2.5 -2.6 5 0t5 0t5 0t5 0M-15 2q2.5 -2.6 5 0t5 0t5 0t5 0',wave,1.8)+P('M-4 6.5q4 -3.2 7.5 0q-3.5 3.2 -7.5 0ZM3.5 6.5l3 -2.2v4.4Z',wave)+C(-12,8,1.4,wave)+C(9,-6,1,wave)+
  hl('M-15 -9Q-9 -17 1 -19.5',.55)+E(-18,13,2.6,1.5,c('#d6d0dc'))+E(12,14,2.4,1.4,c('#d6d0dc'))+E(17,11,2,1.2,c(PAL.stoneDark));},
 lit=>{const c=(x:string)=>dusk(x,lit),fa=pt(.36,.82,2),fb=pt(.64,.82,2),m=pt(.5,.82,2),[x,y]=m;
  return shade(18,6,2,11)+box(.18,.2,.82,.82,0,20,faces(c('#d39a76')))+
   L(line([pt(.18,.82,7),pt(.36,.82,7)])+line([pt(.64,.82,7),pt(.82,.82,7)])+line([pt(.18,.82,14),pt(.82,.82,14)])+line([pt(.27,.82,7),pt(.27,.82,14)])+line([pt(.73,.82,7),pt(.73,.82,14)])+line([pt(.82,.2,10),pt(.82,.82,10)]),c('#b47a5c'),.8)+
   P(`M${xy(fa)}L${xy(pt(.36,.82,10))}Q${xy(pt(.5,.82,17))} ${xy(pt(.64,.82,10))}L${xy(fb)}Z`,c('#3d2a26'))+(lit?C(x,y-4,10,'#ffb070',op(.3)):'')+
   P(`M${x-4} ${y}Q${x-4} ${y-6} ${x-1} ${y-9}Q${x} ${y-6} ${x+1} ${y-7}Q${x+4} ${y-4} ${x+4} ${y}Z`,lit?'#ffb05a':'#f2a35d')+P(`M${x-2} ${y}Q${x-2} ${y-3} ${x} ${y-5}Q${x+2} ${y-3} ${x+2} ${y}Z`,'#ffe7a0')+
   box(.6,.2,.8,.38,20,38,faces(c('#b97f62')))+L('M9 -45Q5 -50 9 -54Q13 -58 9 -61',c('#e7ded4'),2,op(.6))+
   cyl(-3,-18,7.5,3.2,7,c('#6e6a86'))+L('M-11 -21h-2M5 -21h2',c('#6e6a86'),1.6)+E(-3,-25.4,6,2.4,c('#8f8aa6'))+C(-3,-27.6,1.2,c('#b9b3c4'))+L('M-6 -30q-2 -3 0 -6M0 -30q2 -3 0 -6',c('#f4efe6'),1.2,op(.6))+
   hl(line([pt(.18,.82,20),pt(.82,.82,20),pt(.82,.2,20)]),.5);},
 lit=>{const c=(x:string)=>dusk(x,lit),plaque='M-14 -20V-38L0 -49L14 -38V-20Z',win=lit?'#ffd98a':c('#a8cfe0');
  return shade(12,4.5,1,10)+L('M0 12V-20',c(PAL.woodDark),3.4)+P(plaque,c('#cdbb98'),' transform="translate(2.5 1.5)"')+P(plaque,c(PAL.cream))+P('M-17.5 -37L0 -51.5L17.5 -37L15 -34.5L0 -47L-15 -34.5Z',c(PAL.roofs[0]))+
   (lit?C(0,-30,12,'#ffd98a',op(.18)):'')+P('M-4 -20V-28Q-4 -32 0 -32Q4 -32 4 -28V-20Z',c('#8a6a4f'))+C(2.2,-25,.8,'#f3d48a')+P('M5.5 -33h5v4h-5Z',win)+P('M-10.5 -33h5v4h-5Z',win)+
   P(heart(0,-39.5,2.4),c('#e08a8a'))+hl('M-15.5 -36.5L0 -49',.5)+C(-6,10,4.5,c(PAL.leaf))+C(4,11,4,c(PAL.leafLight))+C(-7,7.5,1.5,c('#f2b0c0'))+C(5,8.5,1.4,c('#f6d27a'));},
 lit=>{const c=(x:string)=>dusk(x,lit),fl=lit?'#f4fbff':'#eef7fd';let s=shade(10,4,1,10)+box(.3,.3,.7,.7,0,6,faces(c('#d8d2e2')))+
  L('M-1 -40Q-6 -48 -13 -54M1 -40Q3 -52 8 -58M0 -41Q8 -44 15 -48M-6 -48l-4 1M4 -50l4 -2',c('#d4e4f0'),1.4)+
  P('M-6 -1Q-14 -8 -12 -18Q-10 -26 -4 -30V-36Q-6 -38 -7 -40H7Q6 -38 4 -36V-30Q10 -26 12 -18Q14 -8 6 -1Z',c('#bcd9ec'))+P('M4 -30Q10 -26 12 -18Q14 -8 6 -1H2Q9 -8 8 -18Q7 -25 2.5 -30Z',c('#9ec3dc'))+
  E(0,-40,7,2,c('#d8ecf6'))+E(0,-40,4.5,1.2,c('#7a9cb4'))+L('M0 -22V-10M-5.2 -19L5.2 -13M-5.2 -13L5.2 -19',fl,1.1)+L('M-3 -33h6',fl,1,op(.8))+hl('M-8 -20Q-8 -10 -4 -5',.6);
  for(const [x,y,R] of [[-13,-55,3.6],[8,-58,3.2],[15,-49,3],[-9,-47,1.8],[7,-51,1.8]])s+=(lit&&R>2?C(x,y,R*2,'#dff3ff',op(.25)):'')+P(star(x,y,R,R*.36,6),fl);
  return s;},
 lit=>{const c=(x:string)=>dusk(x,lit);return shade(13,4.5,1,10)+P('M-9 12L0 7L9 12L0 15Z',c(PAL.woodDark))+L('M0 11V-14',c(PAL.wood),3.4)+P('M-21 -14L0 -9L21 -14L19 -18L0 -13L-19 -18Z',c(PAL.woodDark))+
  P('M-23 -16L0 -11L23 -16L21 -38L0 -33L-21 -38Z',c('#a08fc9'))+P('M-21 -18L0 -13V-33L-19 -38Z',c('#fbf3df'))+P('M0 -13L21 -18L19 -38L0 -33Z',c('#f1e5cb'))+L('M0 -13V-33',c('#d8c8a8'),1)+
  P('M-16 -31L-5 -28.5V-21L-16 -23.5Z',c('#a9d3e6'))+P('M-16 -23.5L-12 -28L-9 -24L-7 -26L-5 -21Z',c('#7fae8c'))+C(-8,-27.6,1.2,c('#f6d27a'))+
  P('M4 -28.5L16 -31.5V-24L4 -21Z',c('#f2c9b8'))+L('M5 -23.5q1.6 -1.6 3.2 0t3.2 0t3.2 0',c('#6c9eae'),1)+
  L('M-16 -20L-6 -17.5M-15 -17L-8 -15.3M4 -18L15 -20.6M4 -15.8L12 -17.6',c('#b8a88e'),.8)+L('M1 -13L3 -4',c('#e0605a'),1.4)+hl('M-19 -37.5L0 -33',.5);}
];

const GROUPS:Art[][]=[[],fences,lights,rests,flowers,signs,natures,keeps];
/** 装饰物 id（decor-<组>-<序号>）→ SVG 片段。第 0 组（小路）与未知 id 返回空串。 */
export function decorArt(id:string,lit:boolean):string{
 const m=/^decor-(\d+)-(\d+)$/.exec(id);if(!m)return '';
 return GROUPS[+m[1]]?.[+m[2]]?.(lit)??'';
}
