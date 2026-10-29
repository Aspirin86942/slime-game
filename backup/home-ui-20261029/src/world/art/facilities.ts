/* 设施素材包：26 种设施各自一张等距插画，画在设施自己未旋转的占地 [a,b] 上（坐标规则见 kit.ts 与美术规范）。
   调用方负责镜像（奇数朝向）、标签和点击区域；这里只输出 SVG 片段。等级 2 加一盆花，等级 3 再加一面小旗。 */
import {pt,poly,line,box,gable,shadow,faces,dusk,mix,jitter,PAL,type Pt} from './kit.ts';
import {BUILDINGS} from '../content.ts';

type Faces={top:string;left:string;right:string};
interface Ctx{n:(c:string)=>string;roof:string;rf:Faces;lit:boolean;win:string;wat:string;g:(p:Pt,r?:number)=>string;}

const r1=(n:number)=>Math.round(n*10)/10;
const P=(d:string,f:string,x='')=>`<path d="${d}" fill="${f}"${x}/>`;
const S=(d:string,s:string,w:number,x='')=>`<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round"${x}/>`;
const HI=(ps:Pt[],o='.6')=>S(line(ps),PAL.highlight,1.5,` stroke-opacity="${o}"`);
const E=(p:Pt,rx:number,ry:number,f:string,x='')=>`<ellipse cx="${p[0]}" cy="${p[1]}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${f}"${x}/>`;
const C=(p:Pt,r:number,f:string,x='')=>`<circle cx="${p[0]}" cy="${p[1]}" r="${r1(r)}" fill="${f}"${x}/>`;
const off=(p:Pt,dx:number,dy:number):Pt=>[r1(p[0]+dx),r1(p[1]+dy)];
const seg=(a:Pt,b:Pt)=>`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;
/** 竖杆：同一路径里画多根，减少元素数。 */
const posts=(ps:[number,number][],h0:number,h1:number)=>ps.map(([u,v])=>seg(pt(u,v,h0),pt(u,v,h1))).join('');
/** 水平面上的四边形。 */
const top=(u0:number,v0:number,u1:number,v1:number,h:number)=>poly([pt(u0,v0,h),pt(u1,v0,h),pt(u1,v1,h),pt(u0,v1,h)]);
/** 朝 +v（左前）的竖直面。 */
const fv=(u0:number,u1:number,v:number,h0:number,h1:number)=>poly([pt(u0,v,h0),pt(u1,v,h0),pt(u1,v,h1),pt(u0,v,h1)]);
/** 朝 +u（右前）的竖直面。 */
const fu=(u:number,v0:number,v1:number,h0:number,h1:number)=>poly([pt(u,v0,h0),pt(u,v1,h0),pt(u,v1,h1),pt(u,v0,h1)]);
/** 一组同色小圆点 / 小椭圆合成一个路径。 */
const dots=(ps:Pt[],rx:number,f:string,ry=rx,x='')=>P(ps.map(([a,b])=>`M${a-rx} ${b}a${rx} ${ry} 0 1 0 ${2*rx} 0a${rx} ${ry} 0 1 0 ${-2*rx} 0`).join(''),f,x);
/** 地面上的圆环点列：sq<1 时更接近圆角方形，jit 让轮廓自然起伏。 */
function ring(cu:number,cv:number,rad:number,h:number,n=16,jit=0,seed=1,sq=1):Pt[]{
 const o:Pt[]=[];for(let i=0;i<n;i++){const t=i/n*Math.PI*2,k=rad*(1+jit*(jitter(seed,i)-.5)),x=Math.cos(t),y=Math.sin(t);
  o.push(pt(cu+Math.sign(x)*Math.abs(x)**sq*k,cv+Math.sign(y)*Math.abs(y)**sq*k,h));}
 return o;
}
/** 经过各点中点的平滑闭合曲线，用于水塘、温泉这类有机轮廓。 */
function smooth(ps:Pt[]):string{
 const m=(a:Pt,b:Pt)=>`${r1((a[0]+b[0])/2)} ${r1((a[1]+b[1])/2)}`;
 return `M${m(ps[ps.length-1],ps[0])}`+ps.map((p,i)=>`Q${p[0]} ${p[1]} ${m(p,ps[(i+1)%ps.length])}`).join('')+'Z';
}
/** 竖直圆柱：左半侧面、右半暗面、顶面椭圆。rad 以格为单位。 */
function cyl(cu:number,cv:number,rad:number,h0:number,h1:number,f:Faces):string{
 const [x,y0]=pt(cu,cv,h0),t=pt(cu,cv,h1),y1=t[1],rx=r1(rad*32.5),ry=r1(rad*21.2);
 return P(`M${x-rx} ${y1}V${y0}A${rx} ${ry} 0 0 0 ${x+rx} ${y0}V${y1}Z`,f.left)+
  P(`M${x} ${y0+ry}A${rx} ${ry} 0 0 0 ${x+rx} ${y0}V${y1}A${rx} ${ry} 0 0 1 ${x} ${y1+ry}Z`,f.right)+E(t,rx,ry,f.top);
}
/** 四角星：观星台尖顶与夜里的星光。 */
const star=([x,y]:Pt,s:number)=>`M${x} ${y-s}L${x+s*.3} ${y-s*.3}L${x+s} ${y}L${x+s*.3} ${y+s*.3}L${x} ${y+s}L${x-s*.3} ${y+s*.3}L${x-s} ${y}L${x-s*.3} ${y-s*.3}Z`;
/** 炉火、烛火这类发光体不经过 dusk。 */
const FIRE='#f7a75a',FLAME='#ffe08a';
const flame=([x,y]:Pt,s=1)=>P(`M${x-3*s} ${y}q0-4 ${3*s}-${7*s}q${3*s} ${3*s} ${3*s} ${7*s}Z`,FIRE)+P(`M${x-1.4*s} ${y}q0-2 ${1.4*s}-${3.6*s}q${1.4*s} ${1.6*s} ${1.4*s} ${3.6*s}Z`,FLAME);
/** 夜里的萤火：点本身不压暗，并带一圈柔光。 */
const fireflies=(c:Ctx,ps:Pt[])=>c.lit?c.g(ps[0],10)+dots(ps,1.5,PAL.star):'';

const ART:Record<string,(c:Ctx)=>string>={
 /* 小屋：双坡屋顶、烟囱、山墙圆窗、门前石阶。 */
 house:c=>{const w=faces(c.n(PAL.plaster)),fr=c.n('#efe2c6'),sm=pt(.68,.75,76);
  return box(.3,.3,1.7,1.7,0,30,w)+box(.55,.62,.82,.88,30,74,faces(c.n('#c49a86')))+gable(.3,.3,1.7,1.7,30,58,c.roof,'u',.14)+
   C(pt(1.84,1,41),5.4,fr)+C(pt(1.84,1,41),3.8,c.win)+
   P(fv(.5,.86,1.7,0,19),c.n(PAL.woodDark))+C(pt(.8,1.7,9),1.1,c.n('#f4d27a'))+box(.44,1.7,.92,1.9,0,2.5,faces(c.n(PAL.stone)))+
   P(fv(1.08,1.46,1.7,8,21),c.win)+P(fu(1.7,.62,1,8,21),c.win)+P(fu(1.7,1.18,1.52,8,21),c.win)+
   S(seg(pt(1.27,1.7,8),pt(1.27,1.7,21))+seg(pt(1.08,1.7,14.5),pt(1.46,1.7,14.5))+seg(pt(1.7,.81,8),pt(1.7,.81,21))+seg(pt(1.7,1.35,8),pt(1.7,1.35,21))+seg(pt(1.7,.62,14.5),pt(1.7,1.52,14.5)),fr,1.2)+
   HI([pt(.16,1.84,30),pt(1.84,1.84,30)])+
   S(`M${sm[0]} ${sm[1]}q-6-5 0-10t1-10`,'#ece6f2',2.6,' stroke-opacity=".55"')+c.g(pt(1.27,1.7,14),15)+c.g(pt(1.7,1.07,15),15);},
 /* 厨房：开放式前檐，台面和砧板在檐下，右侧砖砌炉灶与烟囱，檐口挂着锅。 */
 kitchen:c=>{const wd=faces(c.n(PAL.woodLight)),p1=pt(.45,.72,31),p2=pt(.82,.72,31),sp=pt(1.6,.64,17),ch=pt(1.67,.41,62);
  const pot=([x,y]:Pt)=>`M${x-4} ${y}q0 6 4 6q4 0 4-6Z`;
  return box(.08,.06,1.32,.2,0,34,faces(c.n(PAL.plaster)))+S(seg(pt(.25,.2,24),pt(1.15,.2,24)),c.n(PAL.woodDark),2)+
   dots([pt(.42,.2,27.5),pt(.66,.2,27.5),pt(.9,.2,27.5)],2.4,c.n('#e3c27a'),3.2)+
   box(.25,.3,1.15,.6,0,14,wd)+E(pt(.55,.45,14),6.5,3.2,c.n('#efe0bd'))+dots([pt(.5,.43,15.5),pt(.64,.47,15.5)],2.1,c.n('#e98b6f'))+
   P(poly([pt(-.04,0,42),pt(1.36,0,42),pt(1.36,.72,34),pt(-.04,.72,34)]),c.rf.top)+P(fv(-.04,1.36,.72,31,34),c.rf.left)+
   P(poly([pt(1.36,0,39),pt(1.36,.72,31),pt(1.36,.72,34),pt(1.36,0,42)]),c.rf.right)+HI([pt(-.04,.72,34),pt(1.36,.72,34)])+
   S(posts([[.02,.7],[1.3,.7]],0,31),c.n(PAL.woodDark),3)+
   S(seg(p1,off(p1,0,5))+seg(p2,off(p2,0,3)),c.n('#6f6a7a'),1)+P(pot(off(p1,0,5))+pot(off(p2,0,3)),c.n('#c08a68'))+
   box(1.4,.3,1.88,.76,0,17,faces(c.n('#aaa1b6')))+P(fv(1.5,1.74,.76,2,10),'#5a4a52')+flame(pt(1.62,.76,2.5),1.1)+
   box(1.56,.32,1.78,.5,17,62,faces(c.n('#c49a86')))+
   P(`M${sp[0]-6} ${sp[1]-6}v3q6 6 12 0v-3Z`,c.n('#6f6a7a'))+E(off(sp,0,-6),6,2.4,c.n('#e9c38c'))+
   S(`M${ch[0]} ${ch[1]-4}q-6-5 0-10t1-10`,'#ece6f2',2.6,' stroke-opacity=".55"')+c.g(pt(1.62,.76,6),16);},
 /* 餐桌：长桌配两条长凳，中间桌旗、四份餐盘和一支蜡烛。 */
 table:c=>{const wd=faces(c.n(PAL.woodLight)),bn=faces(c.n(PAL.wood)),leg=c.n(PAL.woodDark),fl=pt(1,.5,26);
  return S(posts([[.45,.18],[1.55,.18]],0,6),leg,2.2)+box(.35,.08,1.65,.22,6,9,bn)+
   S(posts([[.4,.38],[1.6,.38],[.4,.62],[1.6,.62]],0,14),leg,2.6)+box(.3,.32,1.7,.68,14,17.5,wd)+P(top(.3,.44,1.7,.56,17.6),c.roof)+
   dots([pt(.58,.4,17.6),pt(.78,.6,17.6),pt(1.22,.4,17.6),pt(1.42,.6,17.6)],5,c.n('#f6eedb'),2.6)+
   dots([pt(.58,.4,18.6),pt(1.22,.4,18.6)],2.3,c.n('#e7a36f'))+dots([pt(.78,.6,18.6),pt(1.42,.6,18.6)],2.3,c.n('#9cc583'))+
   E(pt(1.18,.52,20),3.4,3,c.n('#9fc4dd'))+S(seg(pt(1,.5,17.6),pt(1,.5,25)),c.n('#f6eedb'),2.4)+flame(fl,.7)+
   S(posts([[.45,.9],[1.55,.9]],0,6),leg,2.2)+box(.35,.8,1.65,.94,6,9,bn)+HI([pt(.35,.94,9),pt(1.65,.94,9)])+c.g(off(fl,0,-3),13);},
 /* 温泉：圆角方形石砌池沿、热气、石灯笼、搭着毛巾的岩石和木桶。 */
 spa:c=>{const R=(r:number,h:number)=>smooth(ring(1,1,r,h,16,.06,3,.6)),wp=pt(1,1,4),tw=pt(.22,1.78,0),bk=pt(1.86,1.84,0);
  const steam=[pt(.78,1,6),pt(1.18,1.2,6),pt(1.12,.72,6)].map(([x,y])=>`M${x} ${y}q-5-6 0-12t0-12`).join('');
  return P(R(.88,0),c.n(PAL.stoneDark))+P(R(.88,5),c.n(PAL.stone))+P(R(.66,4),c.wat)+
   dots(ring(1,1,.78,5,12,0,0,.6),3.6,c.n('#d8d2de'),2.2)+(c.lit?E(off(wp,4,-2),12,3.5,PAL.glow,' opacity=".45"'):'')+
   S(`M${wp[0]-14} ${wp[1]}q7-4 14 0M${wp[0]+2} ${wp[1]+7}q6-3 12 0`,PAL.foam,1.5,' stroke-opacity=".8"')+
   S(steam,'#ffffff',2.6,' stroke-opacity=".6"')+
   S(seg(pt(1.82,.18,0),pt(1.82,.18,16)),c.n(PAL.stoneDark),4.5)+box(1.72,.08,1.92,.28,16,24,faces(c.n('#d4cedd')))+
   P(fv(1.77,1.87,.28,17.5,22.5),c.win)+P(fu(1.92,.13,.23,17.5,22.5),c.win)+
   P(poly([pt(1.64,.36,24),pt(2,.36,24),pt(1.82,.18,32)]),c.n(PAL.stoneDark))+P(poly([pt(2,0,24),pt(2,.36,24),pt(1.82,.18,32)]),c.n('#77708a'))+c.g(pt(1.82,.28,20),14)+
   P(`M${tw[0]-11} ${tw[1]}q-2-11 8-13q11 0 12 9q0 4-9 4Z`,c.n('#a59eb3'))+P(`M${tw[0]-6} ${tw[1]-12}l10-1 4 5-11 2Z`,c.n('#f2b8c0'))+S(`M${tw[0]-4} ${tw[1]-9.5}l11-1.5`,'#fff6f0',1.2)+
   P(`M${bk[0]-5} ${bk[1]-9}l1 9h8l1-9Z`,c.n(PAL.wood))+E(off(bk,0,-9),5,1.8,c.wat)+S(`M${bk[0]-4.6} ${bk[1]-4}h9.2`,c.n(PAL.woodDark),1.2);},
 /* 育苗床：抬高的木框苗床，两行幼苗，一侧插着名牌，旁边放着浇水壶。 */
 bed:c=>{const fr=faces(c.n(PAL.wood)),sp:Pt[]=[];for(const v of [.4,.62])for(let u=.38;u<1.7;u+=.31)sp.push(pt(u,v,10.2));
  const can=pt(2.04,.6,0),tag=pt(.24,.28,10);
  return box(.12,.18,1.88,.82,0,10,fr)+S(seg(pt(.12,.82,5),pt(1.88,.82,5))+seg(pt(1.88,.18,5),pt(1.88,.82,5)),c.n(PAL.woodDark),1)+
   P(top(.2,.26,1.8,.74,10.2),c.n('#6a5442'))+S(sp.map(p=>seg(p,off(p,0,-7))).join(''),c.n(PAL.leafDark),1.5)+
   dots(sp.flatMap(p=>[off(p,-2.8,-6.5),off(p,2.8,-7.5)]),3,c.n(PAL.leafLight),1.7)+HI([pt(.12,.82,10),pt(1.88,.82,10)])+
   S(seg(tag,off(tag,0,-12)),c.n(PAL.woodDark),1.4)+P(`M${tag[0]-4} ${tag[1]-17}h8v6h-8Z`,c.n(PAL.cream))+
   P(`M${can[0]-5} ${can[1]}v-8h9v8Z`,c.n('#9fb4c8'))+S(`M${can[0]+3} ${can[1]-5}l7-6M${can[0]-4} ${can[1]-8}q3-5 7 0`,c.n('#7d93a8'),1.6)+
   fireflies(c,[pt(1,.5,26),pt(.6,.3,22),pt(1.5,.7,20)]);},
 /* 温室：玻璃墙与玻璃坡顶，白色窗框，里面两排种植台；夜里透出暖色补光。 */
 greenhouse:c=>{const st=faces(c.n(PAL.stone)),wd=faces(c.n(PAL.wood)),ga=c.lit?'#ffe3a0':'#d8f1e6',gb=c.lit?'#f5cf8a':'#aedccd',o=c.lit?' fill-opacity=".38"':' fill-opacity=".45"';
  const back=[.45,.75,1.05,1.35].map(u=>pt(u,.55,14)),front=[.6,.9,1.2].map(u=>pt(u,1.32,13));
  const fr=[.2,.6,1,1.4,1.8].map(u=>seg(pt(u,1.8,4),pt(u,1.8,28))).join('')+[.2,.6,1,1.4].map(v=>seg(pt(1.8,v,4),pt(1.8,v,28))).join('')+
   [16,28].map(h=>seg(pt(.2,1.8,h),pt(1.8,1.8,h))+seg(pt(1.8,.2,h),pt(1.8,1.8,h))).join('')+[.14,.6,1,1.4,1.86].map(u=>seg(pt(u,1.86,28),pt(u,1,50))).join('')+
   seg(pt(.14,1,50),pt(1.86,1,50))+line([pt(1.86,.14,28),pt(1.86,1,50),pt(1.86,1.86,28)])+seg(pt(1.86,1,28),pt(1.86,1,50));
  return P(fv(.2,1.8,1.8,0,4),st.left)+P(fu(1.8,.2,1.8,0,4),st.right)+P(top(.2,.2,1.8,1.8,4),c.n('#9c8a70'))+
   box(.32,.38,1.5,.7,4,10,wd)+dots(back,5.5,c.n(PAL.leafDark),4.5)+dots(back.map(p=>off(p,-1.5,-2.5)),3.5,c.n(PAL.leafLight),2.6)+dots([back[0],back[2]].map(p=>off(p,2.5,-4)),1.8,c.n('#f2a7b8'))+
   box(.48,1.15,1.35,1.48,4,9,wd)+dots(front,5,c.n(PAL.leaf),4)+dots(front.map(p=>off(p,1,-3)),1.8,c.n('#e98b6f'))+
   (c.lit?c.g(pt(.9,.6,18),20)+c.g(pt(1,1.3,14),18):'')+
   P(fv(.2,1.8,1.8,4,28),ga,o)+P(fu(1.8,.2,1.8,4,28),gb,o)+
   P(poly([pt(.14,1.86,28),pt(1.86,1.86,28),pt(1.86,1,50),pt(.14,1,50)]),ga,o)+P(poly([pt(1.86,.14,28),pt(1.86,1.86,28),pt(1.86,1,50)]),gb,o)+
   S(fr,c.n('#f4f0de'),1.5)+S(seg(pt(.3,1.8,10),pt(.5,1.8,22))+seg(pt(1.8,.5,8),pt(1.8,.75,20))+seg(pt(.5,1.7,32),pt(.8,1.3,40)),'#ffffff',2.2,' stroke-opacity=".55"');},
 /* 授粉棚：开放的木格架，顶上垂着开花藤蔓，下面一排花盆，一端是蜂箱。 */
 pollen:c=>{const wd=c.n(PAL.wood),bm=faces(c.n(PAL.woodDark)),hv=faces(c.n('#e9c46f')),pots=[.42,.78,1.12].map(u=>pt(u,.52,0)),bee=pt(1.58,.5,26),lamp=pt(.98,.8,26);
  const slats=[.22,.47,.72,.97,1.22,1.47,1.72].map(u=>seg(pt(u,.08,38),pt(u,.92,38))).join('');
  const vines=[.22,.72,1.22,1.72].flatMap(u=>[pt(u,.3,37),pt(u+.1,.62,36),pt(u,.86,35)]);
  return S(posts([[.2,.2],[1.8,.2]],0,34),wd,3.5)+box(.1,.17,1.9,.23,34,37.5,bm)+
   P(pots.map(([x,y])=>`M${x-4.5} ${y-7}h9l-1.5 7h-6Z`).join(''),c.n('#c98a6a'))+
   dots(pots.map(p=>off(p,0,-10)),5,c.n(PAL.leafDark),3.4)+dots(pots.flatMap(p=>[off(p,-2.5,-12),off(p,2.5,-13)]),2.4,c.n('#f2a7b8'))+dots(pots.map(p=>off(p,0,-15)),2.4,c.n('#f6d77e'))+
   S(posts([[1.48,.44],[1.68,.56]],0,6),c.n(PAL.woodDark),1.6)+box(1.44,.36,1.72,.64,6,20,hv)+box(1.4,.32,1.76,.68,20,23,c.rf)+
   S(seg(pt(1.44,.64,13),pt(1.72,.64,13))+seg(pt(1.72,.36,13),pt(1.72,.64,13)),c.n('#c9a24f'),1.2)+P(fv(1.52,1.64,.64,7.5,9.5),'#5a4636')+
   dots([off(bee,-6,2),off(bee,4,-3),off(bee,9,4)],1.6,'#f6d77e')+
   S(posts([[.2,.8],[1.8,.8]],0,34),wd,3.5)+box(.1,.77,1.9,.83,34,37.5,bm)+S(slats,c.n(PAL.woodLight),2.4)+
   dots(vines,3,c.n(PAL.leaf),2)+dots(vines.filter((_,i)=>i%2===0).map(p=>off(p,2,2)),2,c.n('#e7a6c8'))+
   S(seg(off(lamp,0,-8),off(lamp,0,-3)),c.n(PAL.woodDark),1)+P(`M${lamp[0]-2.5} ${lamp[1]-3}h5v5h-5Z`,c.lit?PAL.glow:c.n('#f3d89a'))+c.g(lamp,12);},
 /* 种子库：高高的抽屉柜，正面整齐的小抽屉，侧面嫩芽标记，门前两袋种子。 */
 seedbank:c=>{const wd=faces(c.n(PAL.wood)),gr=c.n(PAL.woodDark),vs=[.29,.597,.903,1.21],hs=[4,13.5,23,32.5,42],kn:Pt[]=[];
  for(let i=0;i<3;i++)for(let j=0;j<4;j++)kn.push(pt(.8,(vs[i]+vs[i+1])/2,(hs[j]+hs[j+1])/2));
  const sack=([x,y]:Pt)=>`M${x-7} ${y}q-2-9 4-12l-1-3h6l-1 3q6 3 4 12Z`,s1=pt(.32,1.6,0),s2=pt(.72,1.78,0),em=pt(.5,1.25,16),lp=pt(.5,1.27,40);
  return box(.2,.25,.8,1.25,0,46,wd)+gable(.2,.25,.8,1.25,46,56,c.roof,'v',.06)+P(fu(.8,.29,1.21,4,42),c.n(PAL.woodLight))+
   S(vs.slice(1,3).map(v=>seg(pt(.8,v,4),pt(.8,v,42))).join('')+hs.slice(1,4).map(h=>seg(pt(.8,.29,h),pt(.8,1.21,h))).join(''),gr,1.4)+
   dots(kn,1.3,c.n('#e8c27a'))+S(`M${em[0]} ${em[1]}v-10`,c.n(PAL.leafDark),1.6)+dots([off(em,-3,-8),off(em,3,-10)],3,c.n(PAL.leafLight),1.8)+
   S(seg(off(lp,0,-6),off(lp,0,-2)),gr,1)+C(lp,2.4,c.lit?PAL.glow:c.n('#f3d89a'))+c.g(lp,12)+
   P(sack(s1)+sack(s2),c.n('#d9c39a'))+S(`M${s1[0]-3} ${s1[1]-12}h6M${s2[0]-3} ${s2[1]-12}h6`,c.n('#9c7a4f'),1.5)+
   dots([off(s1,-1,-6),off(s2,-1,-6)],2.4,c.n(PAL.leaf),1.6)+dots([off(s2,8,-1),off(s2,11,1),off(s2,6,1.5)],1.1,c.n('#c49a62'));},
 /* 林木园：圆冠树、松树、小圆树三棵，前面堆着木头，树桩上插着斧头。 */
 grove:c=>{const tk=c.n(PAL.woodDark),dk=c.n(PAL.leafDark),lf=c.n(PAL.leaf),lt=c.n(PAL.leafLight);
  const round=(u:number,v:number,h:number,s:number)=>{const p=pt(u,v,h+10*s);return S(seg(pt(u,v,0),pt(u,v,h)),tk,4)+C(off(p,4*s,4*s),9*s,dk)+C(p,12*s,lf)+C(off(p,-4*s,-4*s),6*s,lt);};
  const pine=pt(1.52,.5,0),[x,y]=pine;
  const log=(v:number,h:number)=>S(seg(pt(1.16,v,h),pt(1.7,v,h)),c.n(PAL.wood),9)+C(pt(1.72,v,h),4.6,c.n(PAL.woodLight));
  const st=pt(.95,1.74,7);
  return round(.5,.45,30,1.15)+S(seg(pine,off(pine,0,-14)),tk,4)+P(`M${x-12} ${y-12}L${x} ${y-40}L${x+12} ${y-12}Z`,dk)+P(`M${x-9} ${y-30}L${x} ${y-54}L${x+9} ${y-30}Z`,lf)+
   round(.45,1.42,20,.9)+log(1.3,4.5)+log(1.62,4.5)+log(1.46,12.5)+dots([pt(1.72,1.3,4.5),pt(1.72,1.62,4.5),pt(1.72,1.46,12.5)],1.6,c.n(PAL.woodDark))+
   cyl(.95,1.74,.14,0,7,faces(c.n(PAL.wood)))+E(st,3.2,2,c.n(PAL.woodLight))+S(`M${st[0]} ${st[1]}l7-10`,c.n(PAL.woodDark),1.8)+P(`M${st[0]-2} ${st[1]-1}l4-4 3 3-3 3Z`,c.n('#b8c3cc'))+
   S(seg(pt(1.2,.95,0),pt(1.2,.95,5))+seg(pt(1.26,.98,0),pt(1.28,.98,4))+seg(pt(.15,.9,0),pt(.16,.9,5)),c.n(PAL.leafDark),1.4)+fireflies(c,[pt(.9,.9,40),pt(.3,.8,30),pt(1.2,.3,48)]);},
 /* 堆肥箱：板条木箱，盖子向后掀开，箱里是沃土和果皮，铲子插在土里，箱脚长着发光小菇。 */
 compost:c=>{const wd=faces(c.n(PAL.wood)),gap=c.n('#5d4636'),sh=pt(.6,.45,21),mu=pt(.08,.88,0);
  return P(poly([pt(.18,.22,24),pt(.82,.22,24),pt(.82,.04,42),pt(.18,.04,42)]),c.n(PAL.woodDark))+S(seg(pt(.18,.13,33),pt(.82,.13,33)),gap,1.2)+
   P(top(.18,.22,.82,.78,24),gap)+P(top(.24,.28,.76,.72,21),c.n('#7a5a40'))+
   dots([pt(.4,.4,21),pt(.62,.6,21)],2.4,c.n('#e9a35f'),1.4)+dots([pt(.5,.62,21),pt(.36,.56,21)],2.4,c.n('#9cc583'),1.4)+
   S(`M${sh[0]} ${sh[1]}l2-22`,c.n(PAL.woodDark),2)+S(`M${sh[0]+1} ${sh[1]-24}h5`,c.n(PAL.woodDark),2)+P(`M${sh[0]-3} ${sh[1]+3}l1-6h5l1 6Z`,c.n('#b8c3cc'))+
   P(fv(.18,.82,.78,0,24),wd.left)+P(fu(.82,.22,.78,0,24),wd.right)+
   S([8,16].map(h=>seg(pt(.18,.78,h),pt(.82,.78,h))+seg(pt(.82,.22,h),pt(.82,.78,h))).join(''),gap,1.6)+
   S(posts([[.2,.76],[.8,.76],[.8,.24]],0,24),c.n(PAL.woodDark),2.4)+HI([pt(.18,.78,24),pt(.82,.78,24),pt(.82,.22,24)])+
   S(`M${mu[0]} ${mu[1]}v-4M${mu[0]+5} ${mu[1]+2}v-3`,c.n('#efe2c6'),1.6)+
   P(`M${mu[0]-3.5} ${mu[1]-4}q3.5-5 7 0ZM${mu[0]+2} ${mu[1]-1}q3-4 6 0Z`,c.lit?PAL.glow:c.n('#e9cfa8'))+c.g(off(mu,1,-3),10);},
 /* 虫舍：高脚木框小屋，正面分格塞满麦秆、木段孔和竹管，屋顶山墙开圆孔。 */
 insects:c=>{const wd=faces(c.n(PAL.woodLight)),dk='#4e3b30',logs=[.37,.5,.63].map(u=>pt(u,.68,24)),tubes=[.34,.45,.56,.67].map(u=>pt(u,.68,14));
  const straw=Array.from({length:10},(_,i)=>seg(pt(.32+i*.04,.68,30),pt(.32+i*.04,.68,37.5))).join(''),bf=pt(.98,.38,44);
  return S(posts([[.3,.66],[.7,.66],[.7,.34]],0,8),c.n(PAL.woodDark),2.4)+box(.26,.32,.74,.68,8,40,wd)+gable(.26,.32,.74,.68,40,54,c.roof,'v',.06)+
   C(pt(.5,.74,45),2.2,dk)+P(fv(.3,.7,.68,10,38),c.n('#6b5444'))+S(straw,c.n('#e3c27a'),1.3)+
   dots(logs,3.6,c.n(PAL.woodLight))+dots(tubes,2.3,c.n('#cdb77a'))+dots([...logs,...tubes],1,dk)+
   S(seg(pt(.3,.68,19),pt(.7,.68,19))+seg(pt(.3,.68,29.3),pt(.7,.68,29.3)),c.n(PAL.woodDark),1.6)+
   C(pt(.74,.46,22),2.6,c.n('#d9675a'))+C(off(pt(.74,.46,22),-1.8,-1.8),1.1,c.n('#3b3448'))+
   dots([off(bf,-2.6,0),off(bf,2.6,0)],2.6,c.n('#f2b8d0'),3.4)+fireflies(c,[pt(.1,.4,30),pt(.9,.9,16),pt(.2,.9,44)]);},
 /* 观测台：高脚木平台，前面一架梯子，四周栏杆，平台上三脚架望远镜。 */
 observe:c=>{const wd=c.n(PAL.wood),dk=c.n(PAL.woodDark),ap=pt(.5,.86,46),lens=off(ap,11,-9),lp=pt(.88,1.62,36);
  const rungs=[.2,.4,.6,.8].map(t=>seg(pt(.38,1.98-.36*t,32*t),pt(.62,1.98-.36*t,32*t))).join('');
  return S(posts([[.2,.45],[.8,.45],[.2,1.55],[.8,1.55]],0,28),dk,3)+
   S(seg(pt(.8,.45,4),pt(.8,1.55,24))+seg(pt(.8,.45,24),pt(.8,1.55,4))+seg(pt(.2,1.55,4),pt(.8,1.55,24))+seg(pt(.2,1.55,24),pt(.8,1.55,4)),dk,1.6)+
   box(.12,.38,.88,1.62,28,32,faces(wd))+S(posts([[.12,.38],[.12,1.62],[.88,.38]],32,42)+line([pt(.12,1.62,42),pt(.12,.38,42),pt(.88,.38,42)]),c.n(PAL.woodLight),1.8)+
   S(seg(ap,pt(.36,.76,32))+seg(ap,pt(.64,.76,32))+seg(ap,pt(.5,1.06,32)),dk,1.4)+S(seg(off(ap,-9,5),lens),c.roof,5)+C(lens,3.2,c.lit?'#f6e9c0':'#d4eee5')+
   S(posts([[.88,1.62]],32,42)+line([pt(.12,1.62,42),pt(.3,1.62,42)])+line([pt(.7,1.62,42),pt(.88,1.62,42),pt(.88,.38,42)]),c.n(PAL.woodLight),1.8)+
   S(seg(pt(.38,1.98,0),pt(.38,1.62,32))+seg(pt(.62,1.98,0),pt(.62,1.62,32))+rungs,wd,1.8)+
   S(seg(off(lp,0,-4),off(lp,0,-1)),dk,1)+C(off(lp,0,2),2.4,c.lit?PAL.glow:c.n('#f3d89a'))+c.g(off(lp,0,2),12)+HI([pt(.12,1.62,32),pt(.88,1.62,32)]);},
 /* 水渠：石砌渠道里水流向前，中段一架半浸在水里的水车，上游一道升起的闸板。 */
 channel:c=>{const st=faces(c.n(PAL.stone)),vc=1.05,hc=15,rv=.36,rh=14,wd=c.n(PAL.woodDark);
  const at=(t:number,k=1):Pt=>pt(.5,vc+Math.cos(t)*rv*k,hc+Math.sin(t)*rh*k),lo=-.47,hi=Math.PI+.47,ts=Array.from({length:13},(_,i)=>lo+(hi-lo)*i/12);
  const cen=pt(.5,vc,hc),flow=[.45,1.55,1.82].map(v=>line([pt(.38,v-.06,8.6),pt(.5,v+.06,8.6),pt(.62,v-.06,8.6)])).join('');
  return box(.22,0,.78,2,0,9,st)+S([.5,1,1.5].map(v=>seg(pt(.78,v,0),pt(.78,v,9))).join('')+seg(pt(.78,0,4.5),pt(.78,2,4.5)),c.n(PAL.stoneDark),1)+
   P(top(.32,0,.68,2,8.6),c.wat)+S(flow,PAL.foam,1.4,' stroke-opacity=".75"')+P(fv(.32,.68,2,0,8.6),c.lit?c.wat:'#a9dfe2')+E(pt(.5,2.06,0),8,2.4,PAL.foam,' opacity=".8"')+
   S(posts([[.25,.2],[.75,.2]],9,27)+seg(pt(.25,.2,27),pt(.75,.2,27)),wd,2)+P(fv(.28,.72,.2,15,23),c.n(PAL.woodLight))+
   S(seg(pt(.22,vc,9),pt(.22,vc,hc+2))+seg(pt(.18,vc,hc),pt(.82,vc,hc)),wd,2.4)+
   S(line(ts.map(t=>at(t))),c.n(PAL.wood),2.4)+S([0,1,2,3,4,5].map(i=>seg(cen,at(i*Math.PI/5))).join(''),c.n(PAL.wood),1.4)+
   S(ts.filter((_,i)=>i%2===0).map(t=>seg(at(t),at(t,1.3))).join(''),c.n(PAL.woodLight),3)+C(cen,2.6,wd)+
   S(seg(pt(.78,vc,9),pt(.78,vc,hc+2)),wd,2.4)+dots([at(lo),at(hi)],3.4,PAL.foam,1.4,' opacity=".85"')+(c.lit?E(pt(.5,1.6,8.6),6,2,PAL.glow,' opacity=".5"'):'');},
 /* 水塘：不规则的自然水塘，睡莲叶与莲花，后岸芦苇和香蒲，前岸几块石头，叶上一只小青蛙。 */
 pond:c=>{const ps=(r:number,h:number)=>smooth(ring(1,1,r,h,14,.28,7)),pads=[pt(.72,1.12,-1.5),pt(1.25,.8,-1.5),pt(1.22,1.38,-1.5)],ln=pads[1],fg=pads[2];
  const reeds=[[.32,.62,26],[.4,.5,30],[.5,.4,24],[.28,.78,20],[.6,.3,22]].map(([u,v,h])=>seg(pt(u,v,0),pt(u,v,h))).join('');
  const heads=[[.4,.5,30],[.5,.4,24],[.28,.78,20]].map(([u,v,h])=>seg(pt(u,v,h-8),pt(u,v,h-2))).join('');
  const stones=[pt(1.86,1.2,0),pt(1.66,1.62,0),pt(1.3,1.86,0)];
  return P(ps(.92,0),c.n('#86ad7c'))+P(ps(.8,0),c.n('#a99a7c'))+P(ps(.7,-1.5),c.wat)+
   S(`M${pads[0][0]+10} ${pads[0][1]-2}q8-3 16 0M${ln[0]-16} ${ln[1]+12}q6-3 12 0`,PAL.foam,1.4,' stroke-opacity=".7"')+
   dots(pads,6,c.n(PAL.leaf),3.5)+S(pads.map(p=>seg(p,off(p,5,-1.5))).join(''),c.lit?c.wat:'#7cc0c8',1.5)+
   dots([off(ln,-2.5,-1.5),off(ln,2.5,-1.5),off(ln,0,-3.5)],2.3,c.n('#f2a7b8'))+C(off(ln,0,-2),1.3,c.n('#f6d77e'))+
   C(off(fg,0,-2.5),3.2,c.n('#8fc477'))+dots([off(fg,-1.5,-5),off(fg,1.5,-5)],1,c.n('#3b3448'))+
   S(reeds,c.n(PAL.leafDark),1.6)+S(heads,c.n('#9a7356'),3.4)+dots(stones,5,c.n(PAL.stone),3.2)+dots(stones.map(p=>off(p,-1.5,-1.2)),2,c.n('#d8d2de'),1.1)+
   (c.lit?E(pt(1.05,1.05,-1.5),10,3,PAL.glow,' opacity=".4"'):'')+fireflies(c,[pt(.45,.5,34),pt(.2,1,24),pt(.7,.2,30)]);},
 /* 净水池：三级逐层下降的石砌水池，上层的水沿缺口流到下一层，最下层可见洁净的卵石。 */
 filter:c=>{const st=faces(c.n(PAL.stone)),st2=faces(c.n('#c6c0d0')),fall=c.lit?c.wat:'#bfe9ec',pb=[pt(.36,1.6,7.4),pt(.5,1.74,7.4),pt(.62,1.56,7.4),pt(.42,1.82,7.4)],sp=pt(.62,1.7,7.4);
  return box(.15,.1,.85,.75,0,26,st)+P(top(.23,.18,.77,.67,25.4),c.wat)+P(fv(.42,.58,.75,15.4,25.4),fall)+
   box(.18,.75,.82,1.38,0,16,st2)+P(top(.26,.83,.74,1.3,15.4),c.wat)+P(fv(.42,.58,1.38,7.4,15.4),fall)+
   box(.21,1.38,.79,1.95,0,8,st)+P(top(.29,1.46,.71,1.87,7.4),c.wat)+dots(pb,2.2,c.n('#d8d2de'),1.3,' opacity=".85"')+
   S(seg(pt(.46,.75,24),pt(.46,.75,17))+seg(pt(.54,.75,23),pt(.54,.75,16))+seg(pt(.46,1.38,14),pt(.46,1.38,9))+seg(pt(.54,1.38,13),pt(.54,1.38,8.5)),PAL.foam,1.2,' stroke-opacity=".9"')+
   dots([pt(.5,.83,15.4),pt(.5,1.46,7.4)],5,PAL.foam,1.6,' opacity=".8"')+P(star(sp,3.2),c.lit?PAL.star:'#ffffff',' opacity=".9"')+
   S(`M${pt(.9,1.2,0)[0]} ${pt(.9,1.2,0)[1]}q-3-8-8-11M${pt(.9,1.2,0)[0]} ${pt(.9,1.2,0)[1]}q1-9 5-13M${pt(.9,1.2,0)[0]} ${pt(.9,1.2,0)[1]}q4-5 9-6`,c.n(PAL.leaf),1.8)+
   HI([pt(.15,.75,26),pt(.85,.75,26),pt(.85,.1,26)])+(c.lit?E(pt(.5,.42,25.4),7,2.4,PAL.glow,' opacity=".5"'):'');},
 /* 水生种植台：长木水槽，三只漂浮的方形种植筏（水草、莲花、穗草），一端竹管注水。 */
 waterbed:c=>{const tr=faces(c.n(PAL.woodDark)),rf=c.n(PAL.woodLight),rs=[.48,1,1.52].map(u=>pt(u,.5,11.6)),[a,b,d]=rs,sp=pt(.14,.3,22);
  const raft=(u:number)=>P(top(u-.15,.36,u+.15,.64,11.6),rf)+P(fv(u-.15,u+.15,.64,10.4,11.6),c.n(PAL.wood));
  return box(.1,.15,1.9,.85,0,11,tr)+S(seg(pt(.1,.85,5.5),pt(1.9,.85,5.5))+seg(pt(1.9,.15,5.5),pt(1.9,.85,5.5)),c.n('#6f5440'),1)+
   P(top(.17,.22,1.83,.78,10.6),c.wat)+S(rs.map(([x,y])=>`M${x-13} ${y+3}q13 7 26 0`).join(''),PAL.foam,1.3,' stroke-opacity=".75"')+
   raft(.48)+raft(1)+raft(1.52)+dots([off(a,-3,-3),off(a,3,-4),off(a,0,-6)],3.4,c.n(PAL.leaf),2.4)+
   dots([off(b,-3,-1),off(b,3,-1)],3.6,c.n(PAL.leaf),2)+dots([off(b,-2,-4),off(b,2,-4),off(b,0,-6)],2.2,c.n('#f2a7b8'))+
   S([-3,0,3].map(k=>`M${d[0]+k} ${d[1]}q${k} -6 ${k*1.6} -11`).join(''),c.n(PAL.leafDark),1.4)+dots([off(d,-4.8,-10),off(d,0,-11.5),off(d,4.8,-10)],1.6,c.n('#e3c27a'),2.4)+
   S(`M${sp[0]-8} ${sp[1]-4}L${sp[0]} ${sp[1]}`,c.n('#8fb77a'),3.4)+S(`M${sp[0]} ${sp[1]}q2 3 1 8`,c.lit?c.wat:'#bfe9ec',1.8)+
   HI([pt(.1,.85,11),pt(1.9,.85,11)])+(c.lit?c.g(b,14)+E(off(b,0,-3),3,2,PAL.glow,' opacity=".7"'):'');},
 /* 木工台：背板上挂着锯子和锤子，工作台上一只刨子和刨花，右边锯木架上搁着一块木板。 */
 woodshop:c=>{const wl=faces(c.n(PAL.woodLight)),dk=c.n(PAL.woodDark),mt=c.n('#b8c3cc'),sw=[pt(.62,.15,30),pt(1.02,.15,28),pt(1.02,.15,21),pt(.62,.15,23)];
  const teeth=Array.from({length:6},(_,i)=>{const t=i/6,p=pt(.62+.4*t,.15,23-2*t);return `M${p[0]} ${p[1]}l2.2 1.2 1.6-1.6`;}).join('');
  const horse=[1.45,1.85].map(u=>seg(pt(u,.38,0),pt(u,.55,14))+seg(pt(u,.72,0),pt(u,.55,14))).join(''),sv=pt(.9,.44,17);
  return box(.12,.05,1.3,.15,0,36,faces(dk))+S(seg(pt(.34,.15,14),pt(.34,.15,28)),c.n(PAL.wood),2)+S(seg(pt(.28,.15,28),pt(.41,.15,28)),mt,3.6)+
   P(poly(sw),mt)+S(teeth,c.n('#8f9aa4'),1)+P(fv(1.02,1.14,.15,21,28.5),c.n('#c08a68'))+
   E(pt(1.65,.55,0),10,3.4,c.n('#e8d2a8'))+S(posts([[.22,.56],[1.18,.56],[1.18,.28]],0,13),dk,3)+box(.15,.22,1.25,.62,13,17,wl)+
   box(.48,.36,.74,.48,17,20.5,faces(c.n('#a07d5a')))+C(pt(.56,.42,22),1.3,c.n('#3b3448'))+
   S(`M${sv[0]} ${sv[1]}q4-5 7 0q-2 3-4 0M${sv[0]+6} ${sv[1]+3}q3-4 6 0`,c.n('#f3dfb6'),1.2)+
   S(horse,dk,2.4)+S(seg(pt(1.4,.55,14),pt(1.9,.55,14)),dk,3.4)+box(1.3,.47,2.04,.63,15,17.5,wl)+HI([pt(.15,.62,17),pt(1.25,.62,17)])+
   (c.lit?C(pt(.2,.15,32),2.2,PAL.glow)+c.g(pt(.2,.15,32),12):'');},
 /* 炼制台：石面工作台，左边一套蒸馏器（圆底烧瓶、弯管、锥形瓶）和试管架，右边地上冒泡的小坩埚。 */
 alchemy:c=>{const dk=c.n(PAL.woodDark),tp=faces(c.n('#9d90b5')),gl=c.lit?'#e6f3f0':'#d9ecf2',fp=pt(.45,.45,25.5),[x,y]=fp,rv=pt(.98,.48,17),cd=pt(1.66,.52,0),[cx,cy]=cd;
  const purple=c.lit?'#c9a2f0':'#b48ad6',green=c.lit?'#b8f2aa':'#9fdc9a';
  return S(posts([[.25,.64],[1.2,.64],[1.2,.3]],0,14),dk,3)+box(.15,.25,1.3,.68,14,17,tp)+P(fv(.32,1.1,.68,9,17),c.roof)+
   S(`M${x-5} ${y+8.5}h10`,c.n('#7d7690'),1.6)+flame(off(fp,0,8.5),.55)+C(fp,7,gl,' fill-opacity=".9"')+P(`M${x-6.6} ${y+1.5}a7 7 0 0 0 13.2 0Z`,purple)+
   S(`M${x} ${y-7}v-9q5-5 ${rv[0]-x-2} ${rv[1]-y-6}`,gl,2.2)+
   P(`M${rv[0]-5} ${rv[1]}l3.5-8v-4h3v4l3.5 8Z`,gl,' fill-opacity=".9"')+P(`M${rv[0]-4} ${rv[1]}l1.6-3.6h4.8l1.6 3.6Z`,green)+
   S([[1.14,'#f2a7b8'],[1.2,'#f6d77e']].map(([u])=>seg(pt(u as number,.4,18),pt(u as number,.4,27))).join(''),gl,2.8)+
   S(seg(pt(1.14,.4,18),pt(1.14,.4,22))+seg(pt(1.2,.4,18),pt(1.2,.4,21)),'#e7a6c8',2.8)+
   P(`M${cx-5} ${cy}q0-4 5-7q5 3 5 7Z`,FIRE)+S(`M${cx-7} ${cy+1}l3-5M${cx+7} ${cy+1}l-3-5`,c.n('#4a4558'),2)+
   P(`M${cx-10} ${cy-16}q0 13 10 13q10 0 10-13Z`,c.n('#58526a'))+E(off(cd,0,-16),10.5,3.4,c.n('#6d6680'))+E(off(cd,0,-16),8.6,2.6,green)+
   dots([off(cd,-3,-20),off(cd,3,-23),off(cd,5,-19)],1.6,green)+c.g(fp,13)+c.g(off(cd,0,-16),13);},
 /* 远征站：三角帐篷（夜里门口透出灯光），高高的旗杆，背包，营火，写着路线的地图板。 */
 expedition:c=>{const tf=c.rf,pole=pt(1.66,.34,0),pk=(p:Pt,col:string,fl:string)=>P(`M${p[0]-5} ${p[1]}v-9q0-4 5-4q5 0 5 4v9Z`,col)+P(`M${p[0]-5} ${p[1]-9}q5-4 10 0v3h-10Z`,fl);
  const fire=pt(1.06,1.74,0),[fx,fy]=fire,b0=pt(.15,1.76,10),b1=pt(.6,1.76,26);
  return S(seg(pole,off(pole,0,-80)),c.n(PAL.woodDark),2)+P(`M${pole[0]} ${pole[1]-80}q9-3 16 2q-7 3-16 8Z`,c.n('#e6bd8c'))+
   P(poly([pt(.2,1.45,0),pt(1.3,1.45,0),pt(1.3,1,34),pt(.2,1,34)]),tf.top)+P(poly([pt(1.3,.55,0),pt(1.3,1.45,0),pt(1.3,1,34)]),tf.right)+
   P(poly([pt(1.3,.78,0),pt(1.3,1.22,0),pt(1.3,1,24)]),c.lit?PAL.glowWarm:'#4b4f63')+HI([pt(.2,1,34),pt(1.3,1,34)])+
   S(seg(pt(1.3,1,34),pt(1.56,1.1,0))+seg(pt(.2,1,34),pt(.02,1.12,0)),c.n('#d8cdb2'),.9)+(c.lit?c.g(pt(1.3,1,8),16):'')+
   pk(pt(1.6,1.3,0),c.n('#c99a6f'),c.n('#a87a52'))+pk(pt(1.8,1.6,0),c.n('#9fb88a'),c.n('#7e9a6c'))+
   dots([off(fire,-7,1),off(fire,7,1),off(fire,0,4),off(fire,-4,-2),off(fire,4,-2)],2.2,c.n(PAL.stoneDark),1.6)+S(`M${fx-5} ${fy+1}l10-4M${fx+5} ${fy+1}l-10-4`,c.n(PAL.woodDark),2)+flame(off(fire,0,-1),1.2)+c.g(off(fire,0,-4),15)+
   P(fv(.13,.62,1.76,10,26),c.n('#f3e6c4'))+S(`M${b0[0]+3} ${b0[1]-6}q6-4 10 1t10-6`,c.n('#d47a6a'),1.2,' stroke-dasharray="2 2"')+
   S(`M${b1[0]-5} ${b1[1]+3}l3 3m0-3l-3 3`,c.n('#d47a6a'),1.3)+S(seg(pt(.2,1.84,0),pt(.2,1.76,24))+seg(pt(.55,1.84,0),pt(.55,1.76,24)),c.n(PAL.woodDark),1.8);},
 /* 训练场：圆形沙地，绳索围栏，两个稻草木人和一块箭靶。 */
 training:c=>{const sand=ring(1,1,.9,0,20),fp=ring(1,1,.9,0,8).map((p,i)=>({p,i})),back=fp.filter(o=>o.i>=4),front=fp.filter(o=>o.i<5||o.i===0);
  const fence=(os:{p:Pt}[])=>os.map(({p})=>seg(p,off(p,0,-10))).join('')+line(os.map(({p})=>off(p,0,-8)));
  const dummy=(u:number,v:number)=>{const b=pt(u,v,17);return S(seg(pt(u,v,0),pt(u,v,34)),c.n(PAL.woodDark),3)+S(seg(pt(u-.18,v+.18,24),pt(u+.18,v-.18,24)),c.n(PAL.wood),3)+
   E(b,5.5,8.5,c.n('#dcb878'))+S(`M${b[0]-5.4} ${b[1]+2}h10.8`,c.n('#a67c52'),1.4)+C(pt(u,v,32),5,c.n('#e8c98a'))+C(off(b,0,-3),1.8,c.n('#d97a6a'));};
  const tg=pt(1.5,.5,22);
  return P(poly(sand),c.n('#e6d3a3'))+S(poly(sand),c.n('#c9ad7c'),2)+dots([pt(.7,1.3,0),pt(1.3,.7,0),pt(1.4,1.5,0)],3,c.n('#d6c08e'),1.4)+
   S(fence(back),c.n('#a67c52'),1.6)+S(seg(pt(1.42,.56,0),pt(1.5,.5,18))+seg(pt(1.58,.44,0),pt(1.5,.5,18)),c.n(PAL.woodDark),2)+
   C(tg,10,c.n('#f3e6c4'))+C(tg,7,c.n('#d97a6a'))+C(tg,4,c.n('#f3e6c4'))+C(tg,1.8,c.n('#d97a6a'))+S(`M${tg[0]+2} ${tg[1]-1}l8-5`,c.n(PAL.woodDark),1.4)+
   dummy(.65,.85)+dummy(1.25,1.25)+S(fence(front),c.n('#a67c52'),1.6)+fireflies(c,[pt(1,1,40),pt(.4,.6,30)]);},
 /* 档案馆：后方一座圆塔配尖顶，前面双坡屋顶的书屋，山墙一侧是摆满书脊的大窗。 */
 archive:c=>{const w=faces(c.n(PAL.plaster)),tw=faces(c.n('#d6cfe0')),tp=pt(.62,.52,56),rx=11.1,[tx,ty]=tp,ap=pt(.62,.52,80),sl=pt(.62,.52,44);
  const spines=(cols:string[],h0:number,h1:number)=>cols.map((col,k)=>S(Array.from({length:9},(_,i)=>i).filter(i=>i%cols.length===k).map(i=>seg(pt(1.75,1.02+i*.057,h0),pt(1.75,1.02+i*.057,h1-(i%3)*1.2))).join(''),col,2.6,' stroke-linecap="butt"')).join('');
  const books=[c.n('#c97a6a'),c.n('#7fae8c'),c.n('#6c9eae'),c.n('#e3c27a')];
  return cyl(.62,.52,.34,0,56,tw)+P(`M${tx-rx-2} ${ty}L${ap[0]} ${ap[1]}L${tx} ${ty+7.2}Z`,c.rf.top)+P(`M${tx} ${ty+7.2}L${ap[0]} ${ap[1]}L${tx+rx+2} ${ty}Z`,c.rf.right)+
   P(`M${sl[0]+2} ${sl[1]+6}v-7a2 2 0 0 1 4 0v7Z`,c.win)+box(.32,.78,1.75,1.72,0,28,w)+gable(.32,.78,1.75,1.72,28,50,c.roof,'u',.1)+
   P(fu(1.75,.98,1.54,6,23),c.lit?'#f0c27a':c.n('#5d4a40'))+spines(books,7.5,14)+spines(books.slice(1),15.5,22)+
   S(poly([pt(1.75,.98,6),pt(1.75,1.54,6),pt(1.75,1.54,23),pt(1.75,.98,23)])+seg(pt(1.75,.98,14.8),pt(1.75,1.54,14.8)),c.n('#efe2c6'),1.4)+
   P(fv(.58,.92,1.72,0,18),c.n(PAL.woodDark))+box(.52,1.72,.98,1.88,0,2.5,faces(c.n(PAL.stone)))+
   P(fv(1.14,1.46,1.72,9,20),c.win)+S(seg(pt(1.3,1.72,9),pt(1.3,1.72,20)),c.n('#efe2c6'),1.2)+c.g(pt(1.75,1.26,14),16)+c.g(pt(.62,.6,44),10);},
 /* 观星台：石台座上的圆柱鼓楼，紫色穹顶开着观测缝，望远镜从缝里探出，穹顶尖上一颗星；前面带门的小门廊。 */
 stars:c=>{const dr=faces(c.n('#ddd5e6')),t=pt(.5,.78,28),[x,y]=t,rx=13.7,ry=8.9,rh=17,dm=c.roof,ds=c.rf.right,lp=pt(.66,1.78,19);
  return box(.12,.14,.88,1.9,0,6,faces(c.n(PAL.stone)))+cyl(.5,.78,.42,6,28,dr)+P(fv(.36,.5,1.2,12,21),c.win)+
   P(`M${x-rx} ${y}A${rx} ${rh} 0 0 1 ${x+rx} ${y}A${rx} ${ry} 0 0 1 ${x-rx} ${y}Z`,dm)+P(`M${x} ${y-rh}A${rx} ${rh} 0 0 1 ${x+rx} ${y}A${rx} ${ry} 0 0 1 ${x} ${y+ry}Z`,ds)+
   P(`M${x+1} ${y-rh}L${x+5} ${y-rh+1}L${x+8} ${y+ry-1}L${x+3} ${y+ry}Z`,'#2d2b4d')+S(`M${x+4} ${y-4}l13-15`,c.n('#d9b36a'),4.5)+C([x+17,y-19],2.6,c.lit?'#f6e9c0':c.n('#efe2c6'))+
   HI([[x-rx+2,y-6],[x-6,y-rh+1]],'.5')+P(star([x,y-rh-4],4),c.lit?PAL.star:c.n('#f4d27a'))+
   box(.3,1.32,.7,1.78,6,22,faces(c.n(PAL.plaster)))+P(fv(.4,.58,1.78,6,17),c.n(PAL.woodDark))+C(lp,1.8,c.lit?PAL.glow:c.n('#f3d89a'))+c.g(lp,11)+
   (c.lit?P(star([x-18,y-26],3)+star([x+22,y-36],2.4)+star([x-8,y-44],2),PAL.star):'');},
 /* 共鸣石：刻着符文的圆形石座，上方悬浮一颗双色晶体，周围有光点环绕。 */
 resonance:c=>{const cr=pt(.5,.5,46),[x,y]=cr,rune=c.lit?'#d9c8ff':'#a08fc9',ca=c.lit?'#d8ccff':'#c3b4ef',cb=c.lit?'#b0a0ee':'#9f8fd9',cl=pt(.5,.5,16);
  const fp=pt(.5,.5,9),[fx,fy]=[fp[0],fp[1]+7];
  return cyl(.5,.5,.42,0,4,faces(c.n(PAL.stoneDark)))+cyl(.5,.5,.3,4,16,faces(c.n(PAL.stone)))+
   S(`M${fx-6} ${fy-3}l2-3 2 3M${fx} ${fy-6}v5M${fx+3} ${fy-5}l3 1-3 2`,rune,1.2)+E(cl,9,5.8,'#cbb8ff',c.lit?' opacity=".7"':' opacity=".45"')+
   C(cr,c.lit?20:16,'#cbb8ff',c.lit?' opacity=".28"':' opacity=".14"')+
   P(`M${x} ${y-17}L${x-8} ${y-2}L${x} ${y+14}L${x+1.5} ${y}Z`,ca)+P(`M${x} ${y-17}L${x+1.5} ${y}L${x} ${y+14}L${x+8} ${y-2}Z`,cb)+
   HI([[x-1.5,y-12],[x-5.5,y-2]],'.7')+P(`M${x-13} ${y+4}l2-4 2 4-2 2ZM${x+12} ${y-10}l1.6-3 1.6 3-1.6 1.6Z`,cb)+
   dots([[x-12,y-12],[x+14,y+6],[x+4,y-24],[x-9,y+16]],1.3,c.lit?PAL.star:'#efe6ff');},
 /* 纪念馆：庑殿顶小亭，后墙挂着三张相框，前面供台点着两支蜡烛，台阶上摆满花束。 */
 memorial:c=>{const w=faces(c.n(PAL.plaster)),fr=c.n(PAL.woodDark),ph=[.5,1,1.5],c1=pt(.78,.38,10),c2=pt(1.22,.38,10),fl=[.35,.62,1.38,1.65].map(u=>pt(u,.84,4));
  const frames=ph.map(u=>fv(u-.15,u+.15,.28,9,19)).join(''),pics=ph.map(u=>fv(u-.11,u+.11,.28,10.5,17.5)).join('');
  return box(.1,.12,1.9,.88,0,4,faces(c.n(PAL.stone)))+box(.22,.18,1.78,.28,4,33,w)+P(frames,fr)+P(pics,c.n('#bcd7e0'))+
   dots(ph.map(u=>pt(u,.28,12.5)),2.2,c.n('#f2b8c0'),1.6)+box(.6,.3,1.4,.46,4,10,faces(c.roof))+
   S(seg(c1,off(c1,0,-5))+seg(c2,off(c2,0,-5)),c.n('#f6eedb'),2.2)+flame(off(c1,0,-5),.6)+flame(off(c2,0,-5),.6)+c.g(off(c1,0,-7),12)+c.g(off(c2,0,-7),12)+
   S(posts([[.2,.84],[1.8,.84]],4,33),c.n('#a0705a'),3.4)+
   dots(fl,3.4,c.n(PAL.leafDark),2.4)+dots(fl.map(p=>off(p,-1.5,-3)),2.2,c.n('#f2a7b8'))+dots(fl.map(p=>off(p,2,-3.5)),2,c.n('#fff3dc'))+
   P(top(0,.04,2,.96,33),c.rf.left)+P(poly([pt(0,.96,33),pt(2,.96,33),pt(1.35,.5,48),pt(.65,.5,48)]),c.rf.top)+P(poly([pt(2,.04,33),pt(2,.96,33),pt(1.35,.5,48)]),c.rf.right)+
   HI([pt(0,.96,33),pt(2,.96,33)])+S(seg(pt(.65,.5,48),pt(1.35,.5,48)),PAL.highlight,1.5,' stroke-opacity=".55"')+C(pt(1,.5,50),2,c.n('#f4d27a'));},
 /* 饲料槽：V 形木槽装满饲料，两端交叉支脚，后面一捆干草，舀勺搭在槽边，旁边一盏小灯。 */
 trough:c=>{const wd=faces(c.n(PAL.wood)),hb=faces(c.n('#e3c97a')),fd=c.n('#d9b36a'),sc=pt(.78,.6,16),lp=pt(.06,.9,0);
  const legs=[.22,.78].map(u=>seg(pt(u,.36,0),pt(u,.64,9))+seg(pt(u,.64,0),pt(u,.36,9))).join('');
  return box(.18,.06,.62,.3,0,13,hb)+S(seg(pt(.3,.3,0),pt(.3,.3,13))+seg(pt(.5,.3,0),pt(.5,.3,13))+seg(pt(.3,.06,13),pt(.3,.3,13))+seg(pt(.5,.06,13),pt(.5,.3,13)),c.n('#b08a50'),1.4)+
   S(legs,c.n(PAL.woodDark),2.4)+P(top(.14,.32,.86,.68,15.5),c.n('#6f5440'))+E(pt(.5,.5,16),13,4.6,fd)+
   dots([pt(.35,.45,17),pt(.5,.55,17.5),pt(.62,.44,17),pt(.44,.6,16.5),pt(.7,.56,16.5)],1.2,c.n('#a8834a'))+
   P(poly([pt(.14,.58,7),pt(.86,.58,7),pt(.86,.68,16),pt(.14,.68,16)]),wd.left)+P(poly([pt(.86,.42,7),pt(.86,.58,7),pt(.86,.68,16),pt(.86,.32,16)]),wd.right)+
   HI([pt(.14,.68,16),pt(.86,.68,16)])+S(`M${sc[0]} ${sc[1]}l8 4`,c.n(PAL.woodDark),1.8)+P(`M${sc[0]-5} ${sc[1]-1}q0 5 5 5q4 0 4-5Z`,c.n('#b8c3cc'))+
   dots([pt(.4,.86,0),pt(.55,.9,0),pt(.66,.82,0)],1.2,fd)+S(seg(lp,off(lp,0,-22)),c.n(PAL.woodDark),1.6)+C(off(lp,0,-20),2.4,c.lit?PAL.glow:c.n('#f3d89a'))+c.g(off(lp,0,-20),11);},
 /* 玩具区：粉色游戏垫，带梯子的小滑梯，叠起来的积木和一只条纹皮球。 */
 toys:c=>{const ch=c.n('#91bec9'),bl=pt(.76,.72,6),[bx,by]=bl,st=pt(.3,.18,30);
  const rungs=[.25,.5,.75].map(t=>seg(pt(.15,.45+.25*t,24*(1-t)),pt(.45,.45+.25*t,24*(1-t)))).join('');
  return P(top(.06,.06,.94,.94,0),c.n('#ecd0da'))+S(top(.12,.12,.88,.88,0),c.n('#f7e6ec'),1.2)+
   S(posts([[.15,.15],[.45,.15],[.15,.45],[.45,.45]],0,24),c.n('#e3a584'),2.2)+box(.12,.12,.48,.48,22,24.5,faces(c.n('#e6c27a')))+
   P(poly([pt(.48,.18,23),pt(.48,.42,23),pt(.96,.42,1.5),pt(.96,.18,1.5)]),ch)+S(line([pt(.48,.42,26),pt(.96,.42,4)])+line([pt(.48,.18,26),pt(.96,.18,4)]),c.n('#6f9fae'),1.6)+
   S(seg(pt(.15,.45,24),pt(.15,.7,0))+seg(pt(.45,.45,24),pt(.45,.7,0))+rungs,c.n('#e3a584'),1.6)+
   box(.2,.62,.4,.82,0,8,faces(c.n('#9fc4dd')))+box(.24,.66,.38,.8,8,15,faces(c.n('#f2a7b8')))+box(.46,.74,.6,.88,0,7,faces(c.n('#e6c27a')))+
   C(bl,6.2,c.n('#e1a079'))+S(`M${bx-4} ${by-4.6}q5 4.6 0 9.2M${bx-6} ${by}h12`,c.n('#fff3cf'),1.6)+C(off(bl,-2,-2.5),1.4,'#ffffff',' opacity=".7"')+
   P(star(st,3.4),c.lit?PAL.star:c.n('#f4d27a'))+c.g(st,10);}
};

/* 升级装饰锚点：[花盆 u,v, 小旗 u,v,h, 旗杆长度]。花盆放在占地前缘，小旗放在物件最高处或地面一角。 */
const UP:Record<string,[number,number,number,number,number,number]>={
 house:[1.27,1.86,1.84,1,58,20],kitchen:[.62,.9,.02,.7,31,18],table:[1.86,.92,1.9,.14,0,30],spa:[1.42,1.9,1.82,.18,32,20],
 bed:[.24,.95,1.86,.2,10,22],greenhouse:[1,1.94,1.86,1,50,20],pollen:[1.94,.94,1.9,.8,37.5,18],seedbank:[.88,1.86,.5,1.31,56,18],
 grove:[1.86,1.86,1.86,.14,0,34],compost:[.9,.93,.82,.04,42,16],insects:[.88,.9,.5,.74,54,14],observe:[.88,1.9,.12,.38,42,18],
 channel:[.92,1.6,.25,.2,27,18],pond:[1.14,1.94,.14,.14,0,34],filter:[.92,1.76,.15,.1,26,20],waterbed:[1.95,.94,.1,.15,11,24],
 woodshop:[.32,.88,.12,.05,36,18],alchemy:[.3,.9,1.92,.14,0,34],expedition:[.78,1.96,1.3,1,34,18],training:[1.86,1.86,.14,.14,0,34],
 archive:[1.3,1.92,1.85,1.25,50,20],stars:[.86,1.86,.3,1.32,22,18],resonance:[.9,.92,.12,.12,0,28],memorial:[1.94,.94,1,.5,50,16],
 trough:[.92,.92,.6,.08,13,22],toys:[.93,.95,.45,.15,24,18]
};
function pot([x,y]:Pt,c:Ctx):string{
 return P(`M${x-4.5} ${y-6}h9l-1.5 6h-6Z`,c.n('#c98a6a'))+P(`M${x-4.5} ${y-6}q4.5-4 9 0Z`,c.n(PAL.leafDark))+
  dots([[x-2.6,y-9],[x+2.6,y-9.6]],2.3,c.n('#f2a7b8'))+C([x,y-12],2.3,c.n('#f6d77e'));
}
function flag([x,y]:Pt,len:number,c:Ctx):string{
 return S(`M${x} ${y}v-${len}`,c.n(PAL.woodDark),1.6)+P(`M${x} ${y-len}l12 3.5-12 3.5Z`,c.n('#f3d89a'))+P(`M${x} ${y-len+1.6}l6 1.9-6 1.9Z`,c.roof)+C([x,y-len-1],1.5,c.lit?PAL.glow:c.n('#f4d27a'));
}

/** 设施插画：画在未旋转的占地 [a,b] 上，原点为锚点格顶角下移 10 像素。lit=夜晚，level=1~3。 */
export function facilityArt(id:string,lit:boolean,level:number):string{
 const def=BUILDINGS.find(d=>d.id===id),[a,b]=def?.size??[1,1],n=(col:string)=>dusk(col,lit),roof=n(PAL.roofs[def?.zone??0]??PAL.roofs[0]);
 const c:Ctx={n,roof,rf:faces(roof),lit,win:lit?'#ffd98a':'#fff0c4',wat:lit?mix(PAL.waterDeep,'#2a2c5e',.35):'url(#lw-water)',
  g:(p,r=12)=>lit?C(p,r,'url(#lw-window)'):''};
 const draw=ART[id],up=UP[id];
 let s=shadow(a,b)+(draw?draw(c):box(.2,.2,a-.2,b-.2,0,24,faces(n(PAL.plaster)))+gable(.2,.2,a-.2,b-.2,24,40,roof));
 if(up&&level>=2)s+=pot(pt(up[0],up[1]),c);
 if(up&&level>=3)s+=flag(pt(up[2],up[3],up[4]),up[5],c);
 /* 拼接时的加减法会留下浮点尾数，统一收成一位小数。 */
 return s.replace(/-?\d+\.\d{2,}/g,m=>String(r1(+m)));
}
