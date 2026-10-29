/* 植物素材包：6 科 × 6 种基础植物、18 个杂交种和发光花。
   原点 = 植物在 1×1 格子中心的落地点，身体向上画（y 为负）。每个物种都有独有轮廓；hue 控制花瓣、果实、菌盖等可变色，
   培育出的品种因此颜色不同。杂交种沿用亲本 A 的造型，把亲本 B 的颜色画在一半的花瓣、果实或叶片上。
   夜晚叶、茎、土经过 dusk() 压暗；发光的部分（月见花、光莓、灯笼菇、晶耳、梦孢、冰灯莲、星舟草、星光）保持原色。 */
import {mix,dusk,jitter,PAL} from './kit.ts';
import type {PlantDef} from '../types.ts';

type N=number;
interface Ctx{st:N;lit:boolean;hy:boolean;m:(l?:N)=>string;a:(l?:N)=>string;g:(l?:N)=>string;ga:(l?:N)=>string;u:(l?:N)=>string;ua:(l?:N)=>string;d:(c:string)=>string;lf:string;ll:string;ld:string;stem:string;wood:string;wd:string;cream:string;white:string;}
type Draw=(c:Ctx)=>string;

const RAD=Math.PI/180,r1=(v:N)=>Math.round(v*10)/10;
function hex(h:N,s:N,l:N):string{h=((h%360)+360)%360;s/=100;l=Math.max(4,Math.min(97,l))/100;const k=(n:N)=>(n+h/30)%12,a=s*Math.min(l,1-l),f=(n:N)=>Math.round(255*(l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1)))).toString(16).padStart(2,'0');return '#'+f(0)+f(8)+f(4);}
/* 基础物种的目标色 [色相, 饱和度, 亮度]：基础品种按名字取色（萝卜橙、番茄红），培育后的色相偏移叠加在上面。 */
const TONE:N[][][]=[
 [[200,55,80],[330,30,92],[45,85,62],[55,85,80],[355,70,62],[270,45,78]],
 [[140,40,56],[150,30,62],[15,60,58],[200,35,76],[125,40,55],[170,40,58]],
 [[26,85,60],[5,75,58],[46,70,74],[95,45,52],[320,75,72],[175,40,50]],
 [[355,70,58],[18,78,74],[42,80,60],[48,85,60],[70,55,76],[8,60,44]],
 [[28,40,48],[35,90,66],[0,72,58],[40,45,88],[185,60,78],[275,45,64]],
 [[100,50,52],[335,62,78],[32,40,60],[150,45,52],[195,75,84],[50,88,70]]];
const GLOW_TONE=[55,92,74];

const P=(d:string,f:string,x='')=>`<path d="${d}" fill="${f}"${x}/>`;
const S=(d:string,s:string,w:N,x='')=>`<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${x}/>`;
const C=(x:N,y:N,r:N,f:string,o='')=>`<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${f}"${o}/>`;
const E=(x:N,y:N,rx:N,ry:N,f:string,o='')=>`<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${f}"${o}/>`;
const op=(v:N)=>` opacity="${v}"`;
/* 以下返回路径片段，多个片段可拼进同一个 <path>，节省元素数。 */
const ov=(x:N,y:N,rx:N,ry:N)=>`M${r1(x-rx)} ${r1(y)}a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(2*rx)} 0a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(-2*rx)} 0`;
const dots=(a:N[][])=>a.map(([x,y,r])=>ov(x,y,r,r)).join('');
/** 叶片/花瓣：从 (x,y) 出发，长 len，角度 ang（0 朝上，正值向右），半宽控制 w，sq 把纵向压扁表示透视。 */
function leaf(x:N,y:N,len:N,ang:N,w:N,sq=1):string{const dx=Math.sin(ang*RAD),dy=-Math.cos(ang*RAD),q=(k:N,o:N)=>`${r1(x+dx*len*k-dy*o)} ${r1(y+(dy*len*k+dx*o)*sq)}`;return `M${q(0,0)}Q${q(.5,w)} ${q(1,0)}Q${q(.5,-w)} ${q(0,0)}Z`;}
const ring=(x:N,y:N,n:N,len:N,w:N,rot=0,sq=1)=>Array.from({length:n},(_,k)=>leaf(x,y,len,rot+k*360/n,w,sq)).join('');
const tip=(x:N,y:N,len:N,ang:N):[N,N]=>[x+Math.sin(ang*RAD)*len,y-Math.cos(ang*RAD)*len];
function star(x:N,y:N,n:N,ro:N,ri:N,rot=0):string{let d='';for(let k=0;k<n*2;k++){const a=(rot+k*180/n)*RAD,rr=k%2?ri:ro;d+=(k?'L':'M')+r1(x+Math.sin(a)*rr)+' '+r1(y-Math.cos(a)*rr);}return d+'Z';}
/** 相对坐标形状：q(a,b) = (x+a*s, y+b*s)。 */
const at=(x:N,y:N,s:N,dir=1)=>(a:N,b:N)=>`${r1(x+a*s*dir)} ${r1(y+b*s)}`;
const drop=(x:N,y:N,s=1)=>{const q=at(x,y,s);return `M${q(0,-3)}Q${q(2.6,.6)} ${q(0,1.6)}Q${q(-2.6,.6)} ${q(0,-3)}Z`;};
const bell=(x:N,y:N,s:N)=>{const q=at(x,y,s);return `M${q(-1,1.9)}C${q(-1,-.2)} ${q(1,-.2)} ${q(1,1.9)}L${q(.5,1.5)}L${q(0,2)}L${q(-.5,1.5)}Z`;};
const dome=(x:N,y:N,w:N,h:N)=>`M${r1(x-w)} ${r1(y)}C${r1(x-w)} ${r1(y-h*1.33)} ${r1(x+w)} ${r1(y-h*1.33)} ${r1(x+w)} ${r1(y)}Q${r1(x)} ${r1(y+h*.25)} ${r1(x-w)} ${r1(y)}Z`;
const pear=(x:N,y:N,s:N)=>{const q=at(x,y,s);return `M${q(0,-5)}C${q(1.5,-5)} ${q(1.4,-2.6)} ${q(2.8,-.6)}C${q(4.4,1.4)} ${q(3,4)} ${q(0,4)}C${q(-3,4)} ${q(-4.4,1.4)} ${q(-2.8,-.6)}C${q(-1.4,-2.6)} ${q(-1.5,-5)} ${q(0,-5)}Z`;};
const pad=(x:N,y:N,rx:N,ry:N)=>`M${r1(x)} ${r1(y)}L${r1(x+rx*.38)} ${r1(y+ry*.92)}A${r1(rx)} ${r1(ry)} 0 1 0 ${r1(x-rx*.38)} ${r1(y+ry*.92)}Z`;
const kite=(x:N,y:N,len:N,ang:N,w:N)=>{const dx=Math.sin(ang*RAD),dy=-Math.cos(ang*RAD),q=(k:N,o:N)=>`${r1(x+dx*len*k-dy*o)} ${r1(y+dy*len*k+dx*o)}`;return `M${q(0,0)}L${q(.45,w)}L${q(1,0)}L${q(.45,-w)}Z`;};
const fan=(x:N,y:N,s:N,rot=0)=>{const [ax,ay]=tip(x,y,s,rot-38),[bx,by]=tip(x,y,s,rot+38);return `M${r1(x)} ${r1(y)}L${r1(ax)} ${r1(ay)}A${s} ${s} 0 0 1 ${r1(bx)} ${r1(by)}Z`;};
/** 把列表按奇偶拆成两条路径，用来给杂交种画双色。 */
const split=<T,>(a:T[],fn:(v:T)=>string):[string,string]=>[a.filter((_,k)=>k%2===0).map(fn).join(''),a.filter((_,k)=>k%2===1).map(fn).join('')];
const cub=(p:N[],t:N):[N,N]=>{const u=1-t,k=[u*u*u,3*u*u*t,3*u*t*t,t*t*t];return [k[0]*p[0]+k[1]*p[2]+k[2]*p[4]+k[3]*p[6],k[0]*p[1]+k[1]*p[3]+k[2]*p[5]+k[3]*p[7]];};
const quad=(p:N[],t:N):[N,N]=>{const u=1-t;return [u*u*p[0]+2*u*t*p[2]+t*t*p[4],u*u*p[1]+2*u*t*p[3]+t*t*p[5]];};
const glints=(c:Ctx,a:N[][])=>P(dots(a),c.white,op(.7));
/** 柔光：两层同心圆，颜色向星光色靠拢；夜里更大更亮。 */
const halo=(c:Ctx,x:N,y:N,r:N,col:string)=>{const h=mix(col,PAL.star,.45);return c.lit?C(x,y,r*1.15,h,op(.12))+C(x,y,r*.7,h,op(.2)):C(x,y,r*.8,h,op(.14));};

/* ===== 花卉 ===== */
const tulip=(x:N,y:N,s:N,col:string,front:string)=>{const q=at(x,y,s);return P(`M${q(-6,-10)}Q${q(-7,.5)} ${q(0,0)}Q${q(7,.5)} ${q(6,-10)}L${q(3,-6.5)}L${q(0,-11.5)}L${q(-3,-6.5)}Z`,col)+P(leaf(x,y,10.5*s,0,3.6*s),front);};
const bells=(p:N[],ts:N[],s:N)=>{let st='',bl='';for(const t of ts){const [x,y]=cub(p,t);st+=`M${r1(x)} ${r1(y)}l0 1.4`;bl+=bell(x,y+1.4,s);}return [st,bl];};
function frond(bx:N,cx:N,cy:N,R0:N,dir:N):string{const sx=cx+dir*R0;let d=`M${bx} 0Q${r1(bx+(sx-bx)*.2)} ${r1(cy*.55)} ${r1(sx)} ${r1(cy)}`;const t0=dir>0?0:Math.PI;for(let k=1;k<=14;k++){const t=t0-dir*k*.72,rr=R0*(1-.8*k/14);d+=`L${r1(cx+Math.cos(t)*rr)} ${r1(cy+Math.sin(t)*rr)}`;}return d;}

const FLOWERS:Draw[]=[
 // 晨露花：五瓣开放花，叶上挂露珠
 c=>{const t=c.st>=4?-31:c.st===3?-27:-19;let s=S(`M0 0Q-3 ${r1(t/2)} 0 ${t}`,c.stem,1.6)+P(leaf(0,-5,13,-62,4.5)+leaf(0,-9,12,58,4),c.lf)+P(leaf(0,-9,7,58,1.2),c.ll,op(.6));
  if(c.st<3)return s;const r=c.st>=4?9:6;
  if(c.st>=4)s+=S('M0-13Q7-14 9-20',c.stem,1.2)+P(ring(9,-21,5,5.5,3,20,.75),c.a(4))+C(9,-21,1.5,c.d('#f4cf6e'));
  s+=P(ring(0,t,5,r,r*.55,0,.75),c.m())+P(ring(0,t,5,r*.55,r*.3,36,.75),c.a(12))+C(0,t,r*.26,c.d('#f6d77a'));
  if(c.st>=4)s+=P(drop(-7,-9.5)+drop(6,-14),c.d('#dff5fb'),op(.92))+P(dots([[-7.6,-10.4,.6],[5.4,-14.9,.6]]),'#ffffff');
  return s;},
 // 铃兰：两片宽叶，拱形花葶上垂着一串小铃铛
 c=>{let s=P(leaf(-2,0,c.st>=3?24:20,-14,7),c.ld);
  if(c.st>=3){const A=[-1,0,-1,-26,6,-34,15,-27],[st,bl]=bells(A,c.st>=4?[.42,.58,.74,.88,1]:[.62,.82,1],c.st>=4?2.6:2);s+=S('M-1 0C-1-26 6-34 15-27'+st,c.stem,1.2);
   s+=P(leaf(1,0,22,14,6.5),c.lf)+P(bl,c.m())+P(dots(c.st>=4?[[2.6,-24,.7],[7.2,-27.5,.7]]:[]),c.white,op(.8));
   if(c.st>=4){const B=[-2,0,-3,-14,-8,-20,-14,-16],[s2,b2]=bells(B,[.55,.78,1],2.2);s+=S('M-2 0C-3-14-8-20-14-16'+s2,c.stem,1.1)+P(b2,c.a(-2));}
  }else s+=P(leaf(1,0,18,14,6),c.lf);
  return s+P(leaf(1,-3,11,14,1.3),c.ll,op(.5));},
 // 日光菊：高茎向日葵，双层放射花瓣，深色花盘
 c=>{const t=c.st>=4?-36:c.st===3?-32:-24;let s=S(`M0 0Q3 ${r1(t/2)} 0 ${t}`,c.stem,2.2)+P(leaf(0,-10,13,-68,6)+leaf(1,-17,12,64,5.5),c.lf)+P(leaf(0,-10,8,-68,1.4)+leaf(1,-17,7,64,1.4),c.ll,op(.5));
  if(c.st<3)return s+P(leaf(0,t+2,6,0,3.4),c.ld);const r=c.st>=4?10:6.5;
  return s+P(ring(0,t,14,r,2.5,13,.85),c.m(-12))+P(ring(0,t,14,r*.9,2.3,0,.85),c.a(0))+C(0,t,r*.48,c.d('#8a5a3a'))+P(dots([[-1.6,t-1.2,.9],[1.6,t-.6,.9],[0,t+1.4,.9],[-1.4,t+1.2,.6]]),c.d('#c08850'));},
 // 月见花：低矮莲座叶 + 浅杯形四瓣花，夜里发柔光
 c=>{let s=P([-82,-52,-22,22,52,82].map(a=>leaf(0,-1,13,a,2.6,.55)).join(''),c.ld)+P([-64,-32,0,32,64].map(a=>leaf(0,-1,10,a,2.2,.55)).join(''),c.lf);
  if(c.st<3)return s;s+=S('M0-2Q-6-12-7-22M0-2Q5-9 8-15'+(c.st>=4?'M0-2Q1-14 3-28':''),c.stem,1.3);
  const fl=(x:N,y:N,r:N,col:string)=>halo(c,x,y,r*1.5,col)+P(ring(x,y,4,r,r*.78,45,.6),col)+P(star(x,y,5,r*.4,r*.15),'#f2c14e');
  if(c.st===3)return s+fl(-7,-23,5.5,c.g())+P(leaf(8,-15,7,20,2),c.m(-8));
  return s+fl(-7,-23,7,c.g())+fl(8,-16,6,c.ga(4))+P(leaf(3,-28,7,10,2),c.m(-8));},
 // 绯瓣花：郁金香式杯形花，长波浪叶
 c=>{const t=c.st>=4?-28:-24;let s=P(leaf(0,0,24,-24,5)+leaf(0,0,20,30,4.5),c.lf)+P(leaf(0,0,14,-24,1.2),c.ll,op(.5))+S(`M0 0Q-1 ${t/2} 1 ${t}`,c.stem,1.8);
  if(c.st>=4)s+=S('M0-4Q-6-10-9-17',c.stem,1.4)+tulip(-9,-17,.7,c.a(-4),c.a(8));
  if(c.st<3)return s+P(leaf(1,t,7,0,2.4),c.ld);
  return s+tulip(1,t,c.st>=4?1:.75,c.m(),c.a(10))+S(`M${c.st>=4?-2.6:-1.4} ${t-6}q1-2 1.4-4`,c.white,.9,op(.55));},
 // 星绒花：毛绒灰绿叶丛 + 五角星形花，熟时周围闪星光
 c=>{const fz=c.d('#a9c2a4');let s=P(dots([[-9,-4,4.5],[-3,-6,5.5],[4,-6,5],[10,-3.5,4]]),c.ld)+P(dots([[-6,-7,3.5],[1,-9,4],[7,-7,3],[-2,-4,3]]),fz)+P(dots([[-6,-9,.7],[0,-11,.7],[5,-8.5,.7],[-9,-6,.7],[9,-5,.7],[2,-6,.7]]),c.d('#eef3e6'),op(.8));
  if(c.st<3)return s;const big=c.st>=4;s+=S('M-4-8L-8-19M0-9L1-25M5-8L9-18',fz,1.3);
  [[-8,-19],[1,-25],[9,-18]].forEach(([x,y],k)=>{if(!big&&k!==1){s+=C(x,y,2,c.m(-6));return;}s+=P(star(x,y,5,big?6:4.5,2.5),k===1?c.a(0):c.m())+C(x,y,1.5,c.d('#fbf1d4'));});
  if(big)s+=P(star(-13,-26,4,2.6,.6)+star(13,-27,4,2,.5)+star(5,-33,4,1.8,.5),PAL.star,op(c.lit?.95:.7));
  return s;}];

/* ===== 草药：hue 控制叶色 ===== */
const HERBS:Draw[]=[
 // 薄荷：三根直茎，成对卵形叶，顶端淡紫穗花
 c=>{const L:N[][]=[[-6,22],[0,28],[6,20]],n=c.st>=3?4:3;let lo='',hi='',sp:N[][]=[];
  for(const [x,h] of L){for(let k=0;k<n;k++){const y=-4-k*(h-4)/n,ln=6.8-k*.8,frag=leaf(x,y,ln,-62,3.3)+leaf(x,y,ln,62,3.3);if(k<2)lo+=frag;else hi+=frag;}if(c.st>=4||(c.st===3&&x===0))sp.push([x,-h-1,1.6],[x,-h-3.4,1.4],[x,-h-5.5,1.1]);}
  return S('M-6 0L-6-22M0 0L0-28M6 0L6-20',c.m(-20),1.4)+P(lo,c.m(-8))+P(hi,c.a(4))+P(leaf(0,-22,4,-62,.8)+leaf(0,-22,4,62,.8),c.d('#f2f8e8'),op(.45))+(sp.length?P(dots(sp),c.d('#c9b3e6')):'');},
 // 甘露草：肉质尖叶莲座（芦荟），橙色花葶，叶尖挂金色蜜露
 c=>{const A=[-62,-38,-14,12,36,60],Ln=[15,21,26,25,20,14],t=c.st>=4?-42:-34;let s='';
  if(c.st>=3)s+=S(`M2-6Q5-26 3 ${t}`,c.d('#8fae7c'),1.4);
  s+=P([0,2,4].map(k=>leaf(0,0,Ln[k],A[k],4.6)).join(''),c.m(-8))+P([1,3,5].map(k=>leaf(0,0,Ln[k],A[k],4.6)).join(''),c.a(2))+P(dots([[-6,-8,.6],[-3,-15,.6],[3,-14,.6],[8,-11,.6],[-1,-20,.5],[6,-6,.5],[-9,-5,.5]]),c.d('#f4f8ee'),op(.6));
  if(c.st>=3)s+=P(dots([[3,t,1.6],[4.6,t+3,1.5],[2,t+5,1.4],[4.2,t+7.6,1.3],[2.6,t+10,1.1]]),c.d(c.st>=4?'#f29a5e':'#a9c77e'));
  if(c.st>=4)s+=P(drop(-13.2,-5.4)+drop(12.1,-4.8),c.d('#f6c75e'),op(.95))+glints(c,[[-13.6,-6.4,.5],[11.7,-5.8,.5]]);
  return s;},
 // 暖叶草：低矮的宽圆叶堆（秋海棠式），浅色叶脉，暖黄小花
 c=>{const B:N[][]=[[-58,15],[-24,19],[22,18],[56,14]],F:N[][]=[[-9,13],[11,12]],vein=(a:N[][],y:N)=>a.map(([g,l])=>{const [x2,y2]=tip(0,y,l*.8,g);return `M0 ${y}L${r1(x2)} ${r1(y+(y2-y)*.85)}`;}).join('');
  let s=P(B.map(([a,l])=>leaf(0,0,l,a,8.5,.85)).join(''),c.m(-10))+S(vein(B,0),c.m(12),.9,op(.7))+P(F.map(([a,l])=>leaf(0,-1,l,a,7,.85)).join(''),c.a(3))+S(vein(F,-1),c.a(18),.9,op(.7));
  if(c.st>=3)s+=S('M0-2L0-17',c.m(-18),1.1)+P(dots(c.st>=4?[[0,-18,2],[-2.6,-16,1.6],[2.6,-16.4,1.6],[-1.2,-20.6,1.4],[1.6,-20.2,1.3]]:[[0,-18,1.6],[1.6,-16,1.2]]),c.d('#f6cf72'));
  if(c.st>=4)s+=P(dots([[-8,-9,1.1],[8,-8,1],[-3,-13,.9]]),c.d('#ffdca0'),op(.7));
  return s;},
 // 霜叶草：细长竖叶，叶尖结霜，熟时有冰晶闪光
 c=>{const B:N[][]=[[-4,22,-22],[-1,34,-6],[3,30,10],[5,20,24]],F:N[][]=[[-2,28,-14],[1,36,3],[4,25,17]],tips=[...B,...F].map(([x,l,a])=>{const [tx,ty]=tip(x,0,l,a);return [tx,ty,1];});
  let s='';if(c.st>=3)s+=S(c.st>=4?'M-3 0L-9-38M2 0L8-34':'M-3 0L-8-34',c.m(-14),1.1)+P(dots(c.st>=4?[[-9,-38,1.4],[-8.5,-35.5,1.3],[-8,-33,1.2],[8,-34,1.3],[7.6,-31.6,1.2]]:[[-8,-34,1.3],[-7.6,-31.6,1.2]]),c.d('#dbe7fb'));
  s+=P(B.map(([x,l,a])=>leaf(x,0,l,a,2.2)).join(''),c.m(-10))+P(F.map(([x,l,a])=>leaf(x,0,l,a,2.3)).join(''),c.a(4))+P(F.map(([x,l,a])=>leaf(x,-2,l*.6,a,.5)).join(''),c.d('#f4fbff'),op(.5))+P(dots(tips),c.d('#f7fcff'));
  if(c.st>=4)s+=P(star(-12,-22,4,2.6,.6)+star(11,-28,4,2.2,.5)+star(-3,-40,4,2,.5),'#f4fbff',op(c.lit?.95:.8));
  return s;},
 // 清心草：三叶草，叶面浅色 V 纹，粉白绒球花
 c=>{const H:N[][]=[[-9,-13],[1,-19],[9,-11],[-3,-8]],tre=([x,y]:N[])=>[0,120,240].map(a=>leaf(x,y,6,a,4.4,.75)).join(''),[ha,hb]=split(H,tre);
  let s=S(H.map(([x,y])=>`M0 0Q${r1(x*.3)} ${r1(y*.5)} ${x} ${y}`).join('')+(c.st>=3?'M0 0Q3-14 2-26':'')+(c.st>=4?'M0 0Q-5-12-7-22':''),c.m(-18),1.1)+P(ha,c.m(-4))+P(hb,c.a(4))+S(H.map(([x,y])=>`M${x-2} ${y-2.4}l2 1.4l2-1.4`).join(''),c.d('#eef6e8'),.8,op(.7));
  if(c.st>=3){const B:N[][]=c.st>=4?[[2,-27],[-7,-23]]:[[2,-27]],r=c.st>=4?4:3;s+=P(dots(B.map(([x,y])=>[x,y,r])),c.d('#f6e8ee'))+P(dots(B.flatMap(([x,y])=>[[x-1.5,y-1.5,.9],[x+1.4,y-1,.9],[x,y+1.4,.9],[x-1.6,y+1,.7]])),c.d('#e9a3c0'));}
  return s;},
 // 回声草：卷曲的蕨类卷芽，熟时卷芽旁有回声波纹
 c=>{const F:N[][]=[[-4,-9,-26,5,-1],[0,3,-35,6,1],[5,12,-19,4.5,1]];let lv='';
  if(c.st>=3)for(const [bx,cx,cy,R0,dir] of F){const p=[bx,0,bx+(cx+dir*R0-bx)*.2,cy*.55,cx+dir*R0,cy];for(const t of [.3,.55,.78]){const [x,y]=quad(p,t);lv+=leaf(x,y,4.2*(1.1-t*.5),-55,1.7)+leaf(x,y,4.2*(1.1-t*.5),55,1.7);}}
  let s=(lv?P(lv,c.m(-8)):'')+S(frond(F[0][0],F[0][1],F[0][2],F[0][3],F[0][4])+frond(F[2][0],F[2][1],F[2][2],F[2][3],F[2][4]),c.m(),2.2)+S(frond(F[1][0],F[1][1],F[1][2],F[1][3],F[1][4]),c.a(4),2.4);
  if(c.st>=4)s+=S('M12-37q3 3 0 6M15-39q5 5 0 10M-15-28q-3 3 0 6',c.a(16),1,op(.6));
  return s;}];

/* ===== 蔬果：hue 控制果实色 ===== */
const VEG:Draw[]=[
 // 甜萝卜：羽状叶丛 + 露出土面的橙色根肩
 c=>{const by=c.st>=3?-5:-1,T:N[][]=[[-10,-22],[-4,-29],[3,-30],[10,-23]];let lv='',tp='';
  for(const [tx,ty] of T){const a=Math.atan2(tx,-(ty-by))/RAD;for(const k of [.45,.7]){const x=tx*k,y=by+(ty-by)*k;lv+=leaf(x,y,4.6,a-48,1.9)+leaf(x,y,4.6,a+48,1.9);}tp+=leaf(tx,ty,4,a,2.2);}
  let s=S(T.map(([x,y])=>`M0 ${by}L${x} ${y}`).join(''),c.stem,1.2)+P(lv,c.lf)+P(tp,c.ll);
  if(c.st>=3){const w=c.st>=4?6.5:4.6,h=c.st>=4?7.5:5.4;s+=P(`M${-w} 0Q${-w} ${-h} 0 ${-h}Q${w} ${-h} ${w} 0Z`,c.u())+S(`M${r1(-w*.85)} ${r1(-h*.35)}q${r1(w*.85)} 1.4 ${r1(w*1.7)} 0M${r1(-w*.7)} ${r1(-h*.7)}q${r1(w*.7)} 1.1 ${r1(w*1.4)} 0`,c.ua(-14),1,op(.75))+S(`M${r1(-w*.55)} ${r1(-h*.75)}q.8-1.6 2.8-1.9`,c.white,.9,op(.55));}
  return s;},
 // 蜜番茄：竹竿支架 + 藤蔓 + 成串圆果
 c=>{const top=c.st>=3?-40:-32;let s=S(`M8 2L8 ${top}`,c.wood,2.2)+S(`M0 0Q-3-14 2-22Q6-30 3 ${top+2}`,c.stem,1.8)+S('M6.6-14h3M6.6-27h3',c.cream,1)+P(leaf(1,-6,9,-72,3.6)+leaf(3,-19,8,62,3.2)+leaf(3,-33,7,40,2.8),c.ld)+P(leaf(-1,-12,9,-58,3.4)+leaf(4,-27,8,-50,3)+leaf(0,-9,7,50,3),c.lf);
  if(c.st<3)return s;const Fr:N[][]=c.st>=4?[[-6,-15,4.6],[5,-21,4.2],[-3,-27,3.8],[1,-11,3.8]]:[[-6,-15,3],[5,-21,2.6]],[fa,fb]=split(Fr,([x,y,r])=>ov(x,y,r,r));
  s+=P(fa,c.u())+(fb?P(fb,c.ua()):'')+P(Fr.map(([x,y,r])=>star(x,y-r+.6,5,2.2,.8)).join(''),c.ld)+glints(c,Fr.map(([x,y,r])=>[x-r*.4,y-r*.25,r*.2]));
  if(c.st===3)s+=P(star(-3,-27,5,2.4,1)+star(1,-11,5,2.2,.9),c.d('#f4d35e'));
  return s;},
 // 月南瓜：背后的大叶 + 带棱的浅色圆胖南瓜
 c=>{let s=P(leaf(-3,-3,15,-60,8,.8)+leaf(3,-3,15,58,8,.8)+leaf(0,-4,14,-8,8,.85),c.ld)+P(leaf(-1,-4,9,-60,1.2,.8)+leaf(2,-4,9,58,1.2,.8)+leaf(0,-5,8,-8,1.2,.85),c.ll,op(.5))+S('M-12-14q-3-3 0-5q3 0 1 3',c.stem,1);
  if(c.st<3)return s;
  if(c.st===3)return s+P(leaf(-6,-9,8,-25,4.2),c.d('#f4c94a'))+C(-6.4,-12.6,1.3,c.d('#e59a3c'))+E(5,-3.6,4.2,3.6,c.u());
  return s+E(-5,-7,6,6.8,c.ua(-8))+E(5,-7,6,6.8,c.ua(-8))+E(0,-7.6,5.6,7.4,c.m())+S('M-2.6-14q-1.6 6.4 0 13M2.6-14q1.6 6.4 0 13',c.m(-16),.8,op(.6))+S('M0-14Q1-18 4-17.5',c.d('#7a6040'),2)+S('M-8.6-10.6q-1 4 1 7',c.white,1.1,op(.5));},
 // 脆豆：三根竹竿搭成架子，藤缠绕，长豆荚下垂
 c=>{const ap=c.st>=3?-46:-38;let s=S(`M-11 1L0 ${ap}M11 1L0 ${ap}M1 3L0 ${ap+2}`,c.wood,1.6)+S(`M-9 0Q2-6-7-12Q5-17-5-23Q4-28-3-33Q2-38 0 ${ap+3}`,c.stem,1.3)+S(`M-2 ${ap+3}l4-2M-2 ${ap+1}l4 2`,c.cream,1)+P(leaf(-6,-10,6,-70,3.4)+leaf(-4,-22,6,-60,3.2)+leaf(-2,-34,5.5,-50,3),c.ld)+P(leaf(3,-15,6,60,3.4)+leaf(3,-28,6,55,3.2)+leaf(1,-39,5,45,2.8),c.lf);
  if(c.st<3)return s;
  if(c.st===3)return s+P(dots([[-6,-16,1.5],[5,-20,1.4],[-3,-28,1.4],[5,-32,1.3]]),c.d('#e9d4f4'))+P(leaf(-7,-16,6,176,1.3)+leaf(5,-21,6,186,1.3),c.u());
  const [pa,pb]=split([[-7,-16,172],[5,-20,186],[-3,-28,178],[6,-31,190],[-6,-34,176]],([x,y,a]:N[])=>leaf(x,y,11,a,1.9));
  return s+P(pa,c.m())+P(pb,c.a(4))+S('M-6.4-14.6v7.4M-2.6-26.6v7.6',c.a(18),.7,op(.6));},
 // 光莓：低矮圆灌木，挂着夜里发光的浆果串
 c=>{let s=P(dots([[-10,-6,5],[-4,-10,6.5],[4,-10,6.5],[10,-6,5],[0,-5,6]]),c.ld)+P(dots([[-7,-10,4],[1,-14,4.5],[8,-10,3.5],[-2,-7,3.5]]),c.lf)+P(dots([[-5,-13,2],[3,-16,2],[-9,-9,1.5]]),c.ll,op(.8));
  if(c.st<3)return s;const K:N[][]=[[-8,-9],[3,-14],[8,-5],[-2,-4]];
  if(c.st===3)return s+P(dots(K.map(([x,y])=>[x,y,1.6])),c.d('#fbf6ea'))+P(dots(K.map(([x,y])=>[x+2.2,y+1.2,1.1])),c.u());
  const cl=([x,y]:N[])=>dots([[x,y,1.9],[x+2.6,y+.8,1.8],[x+1.2,y+2.8,1.7]]),[ka,kb]=split(K,cl);
  return s+(c.lit?P(dots(K.map(([x,y])=>[x+1.2,y+1.2,6])),c.g(),op(.28)):'')+P(ka,c.g())+P(kb,c.ga())+glints(c,K.map(([x,y])=>[x-.6,y-.7,.55]));},
 // 雨瓜：卧在叶间的长椭圆条纹瓜，瓜顶有雨滴
 c=>{let s=P(leaf(-4,-2,15,-70,7,.8)+leaf(4,-2,14,72,7,.8)+leaf(0,-3,13,-20,7,.8),c.ld)+P(leaf(-6,-6,8,-40,1.1,.8)+leaf(5,-5,8,40,1.1,.8),c.ll,op(.5))+S('M10-10q4-2 3 2q-1 3 2 3',c.stem,1);
  if(c.st<3)return s;
  if(c.st===3)return s+P(star(-6,-11,5,3.4,1.4),c.d('#f4d35e'))+E(4,-3.6,5.4,3.2,c.u());
  return s+`<g transform="rotate(-10 0 -6)">`+E(0,-6,11.5,6.6,c.m())+S('M-11-6Q0-17.4 11-6M-11.4-6Q0-9 11.4-6M-11-6Q0 2.2 11-6',c.a(-16),1.4,op(.8))+E(-4,-9.6,4,1.4,c.white,op(.35))+'</g>'+P(drop(3,-14.4,1.3),c.d('#bfe6f4'),op(.95))+P(drop(-7,-13,.7),c.d('#bfe6f4'),op(.8));}];

/* ===== 果树 ===== */
const trunk=(c:Ctx,h:N,w:N)=>P(`M${-w} 0L${r1(-w*.6)} ${-h}L${r1(w*.6)} ${-h}L${w} 0Z`,c.wood)+P(`M${r1(w*.2)} 0L${r1(w*.15)} ${-h}L${r1(w*.6)} ${-h}L${w} 0Z`,c.wd);
const blossom=(c:Ctx,a:N[][],col:string)=>P(dots(a.map(([x,y])=>[x,y,1.4])),c.d(col))+P(dots(a.map(([x,y])=>[x,y,.5])),c.d('#f6d77a'));
const TREES:Draw[]=[
 // 苹果树：圆冠，红苹果，熟时地上掉一个
 c=>{let s=trunk(c,28,3.2)+S('M0-20L-7-30M0-22L7-31',c.wood,2)+P(dots([[-9,-36,10],[9,-36,10],[0,-45,11],[0,-31,9]]),c.ld)+P(dots([[-6,-40,8],[6,-41,8],[0,-48,6.5]]),c.lf)+P(dots([[-5,-48,3.5],[-11,-40,2.6],[3,-51,2.2]]),c.ll,op(.85));
  if(c.st<3)return s;const A:N[][]=[[-10,-33],[8,-29],[2,-40],[-3,-27],[11,-41],[-7,-45]];
  if(c.st===3)return s+blossom(c,A,'#f8e2ea')+P(dots([[-5,-36,1.8],[6,-35,1.8]]),c.u());
  const [aa,ab]=split([...A,[13,-1.6]],([x,y])=>ov(x,y,3.2,3.2));
  return s+P(aa,c.m())+P(ab,c.a())+S(A.map(([x,y])=>`M${x} ${y-3}l.8-1.6`).join(''),c.d('#7a5a3e'),.8)+glints(c,A.map(([x,y])=>[x-1.1,y-1,.7]));},
 // 蜜桃树：分叉矮干，扁宽树冠，尖叶探出，桃子带红晕
 c=>{let s=P('M-2.6 0L-1.6-14L-9-26L-6.4-27.6L0-18.4L6.4-27.6L9-26L1.6-14L2.6 0Z',c.wood)+P('M1 0L1-15L6.4-27.6L9-26L1.6-14L2.6 0Z',c.wd)+E(0,-35,16,10,c.ld)+E(-2,-37,13,7.6,c.lf)+E(-4,-40.4,7,3.6,c.ll,op(.8))+P([[-15,-35,-100],[-12,-41,-60],[-5,-44.4,-20],[5,-44.4,20],[12,-41,60],[15,-35,100],[-11,-28,-140],[11,-28,140]].map(([x,y,a])=>leaf(x,y,4.4,a,1.8)).join(''),c.lf);
  if(c.st<3)return s;const A:N[][]=[[-9,-31],[7,-30],[0,-37],[11,-37],[-12,-37]];
  if(c.st===3)return s+blossom(c,[...A,[-4,-42],[5,-42],[-2,-30]],'#f6c3d2')+P(dots([[-5,-33,1.8],[4,-35,1.8]]),c.u());
  return s+P(dots(A.map(([x,y])=>[x,y,3.9])),c.u())+P(dots(A.map(([x,y])=>[x+1.1,y+1,2.3])),c.ua(-12),op(.85))+S(A.map(([x,y])=>`M${x} ${y-3.4}q-1.4 2.2 0 4.6`).join(''),c.u(-20),.7,op(.7))+P(A.map(([x,y])=>leaf(x,y-3.4,3,40,1.2)).join(''),c.lf);},
 // 风梨树：被风吹弯的棕榈干，羽状大叶，叶下挂菠萝形果
 c=>{const cx=3,cy=-40,fr=(a:N,len:N,dp:N)=>{const dx=Math.cos(a*RAD),dy=-Math.sin(a*RAD),tx=cx+dx*len,ty=cy+dy*len+dp,mx=cx+dx*len*.55,my=cy+dy*len*.55-3+dp*.3,w=3.2;return {d:`M${cx} ${cy}Q${r1(mx+dy*w)} ${r1(my-dx*w)} ${r1(tx)} ${r1(ty)}Q${r1(mx-dy*w*.3)} ${r1(my+dx*w*.3)} ${cx} ${cy}Z`,rib:`M${cx} ${cy}Q${r1(mx)} ${r1(my)} ${r1(tx)} ${r1(ty)}`};};
  const F=[[168,15,9],[132,13,5],[98,9,0],[66,11,2],[32,14,6],[4,15,10]].map(([a,l,d])=>fr(a,l,d)),[fa,fb]=split(F,f=>f.d);
  let s=P('M-3 0Q-2-20 1.6-38L5-37.4Q2-20 3 0Z',c.wood)+S('M-2.8-6h5.8M-2.6-13h5.6M-2-20h5.2M-1-27h5M.4-33h4.4',c.wd,.9)+P(fa,c.ld)+P(fb,c.lf)+S(F.map(f=>f.rib).join(''),c.ll,.8,op(.7));
  if(c.st<3)return s;
  if(c.st===3)return s+P(leaf(cx-2,cy+2,6,195,2)+leaf(cx+3,cy+2,6,165,2),c.cream)+S('M-17-26q5-3 11-1',c.d('#f4fbff'),1,op(.5));
  const Fr:N[][]=[[cx-4,cy+6],[cx+4,cy+7]],[pa,pb]=split(Fr,([x,y])=>ov(x,y,3,4.2));
  return s+P(Fr.map(([x,y])=>leaf(x,y-3.6,3.6,-28,1.1)+leaf(x,y-3.6,4,0,1.1)+leaf(x,y-3.6,3.6,28,1.1)).join(''),c.lf)+P(pa,c.u())+P(pb,c.ua())+S(Fr.map(([x,y])=>`M${x-2.4} ${y-2}l4.6 4.6M${x-2.8} ${y+1}l3.4 3M${x+2.4} ${y-2}l-4.6 4.6M${x+2.8} ${y+1}l-3.4 3`).join(''),c.u(-22),.6,op(.7))+S('M-17-26q5-3 11-1M-16-19q4-2 8 0',c.d('#f4fbff'),1,op(.55));},
 // 银杏：直干，高耸的扇叶树冠，由绿转金，熟时地上落扇叶
 c=>{const base=c.st>=4?c.g():c.st===3?mix(c.g(),PAL.leaf,.5):PAL.leaf,lite=c.st>=4?c.ga(10):mix(base,PAL.leafLight,.5);
  let s=trunk(c,24,3)+S('M0-14L-6-24M0-17L6-27',c.wood,1.8)+P('M0-56C9-48 17-36 16-27Q8-20 0-22Q-8-20-16-27C-17-36-9-48 0-56Z',c.d(mix(base,'#4d6a4a',.25)))+P('M0-52C7-45 12-36 11-29Q5-26 0-28Q-6-25-12-29C-12-38-7-45 0-52Z',c.d(base));
  s+=P([[-8,-29,0],[6,-31,10],[-3,-38,-10],[7,-41,15],[-8,-43,-15],[1,-48,0],[11,-30,25],[-12,-34,-25],[2,-30,0]].map(([x,y,r])=>fan(x,y,3.4,r)).join(''),c.d(lite),op(.9));
  if(c.st>=4)s+=P(fan(-13,1,2.6,-60)+fan(10,2,2.6,40)+fan(15,-1,2.4,80),c.m(-4))+P(dots([[-4,-33,1.1],[5,-36,1.1],[-1,-44,1]]),c.d('#f0d79a'));
  return s;},
 // 雪梨树：卵形高冠戴着白色雪顶，挂水滴形梨
 c=>{let s=trunk(c,26,3)+S('M0-18L-6-28M0-21L6-30',c.wood,1.8)+P(dots([[-8,-33,9],[8,-33,9],[0,-41,10.5],[0,-28,8]]),c.ld)+P(dots([[-5,-44,7],[6,-44,7],[0,-36,8]]),c.lf)+P(dots([[-7,-49,4],[0,-52,4.6],[7,-48,3.8],[-11,-42,2.6],[11,-41,2.6]]),c.d('#f5f7fc'))+P(dots([[-3,-53.4,1.4],[-8.4,-50,1]]),'#ffffff',op(.8));
  if(c.st<3)return s;const A:N[][]=[[-9,-30],[7,-27],[1,-36],[12,-35],[-4,-24]];
  if(c.st===3)return s+blossom(c,A,'#fbfaf4')+P(dots([[-5,-34,1.8],[5,-32,1.8]]),c.u());
  const [pa,pb]=split(A,([x,y])=>pear(x,y,.9));
  return s+P(pa,c.u())+P(pb,c.ua())+S(A.map(([x,y])=>`M${x} ${y-4.4}l.6-1.6`).join(''),c.d('#7a5a3e'),.8)+glints(c,A.map(([x,y])=>[x-1.2,y,.6]));},
 // 星枣树：之字形多刺枝干，稀疏小叶团，挂小椭圆枣，熟时闪星光
 c=>{let s=S('M0 0L-1.5-10L2-18L-1.5-27L1-34',c.wood,3.4)+S('M1.5-15L11-25M-1-24L-11-31M0-30L5-38M6.4-20.2l2.6-.6M-6-27.6l-1-2.8M-1.4-10l-3-2M2-18l3 .6',c.wood,1.4)+P(dots([[11,-28,5],[-11,-34,5.5],[4,-40,5],[-2,-35,3.5]]),c.ld)+P(dots([[10,-30,3],[-11,-36,3.5],[5,-42,3]]),c.lf);
  if(c.st<3)return s;const A:N[][]=[[8,-23],[13,-24],[-9,-29],[-13,-30],[2,-35],[6,-35],[-4,-31]];
  if(c.st===3)return s+P(dots(A.map(([x,y])=>[x,y-1,1])),c.d('#e4e79a'));
  const [da,db]=split(A,([x,y])=>ov(x,y,1.7,2.5)),Sp:N[][]=[[-15,-42],[14,-37],[0,-48]];
  return s+P(da,c.m())+P(db,c.a(4))+glints(c,A.map(([x,y])=>[x-.6,y-1,.5]))+(c.lit?P(dots(Sp.map(([x,y])=>[x,y,4])),PAL.star,op(.25)):'')+P(Sp.map(([x,y])=>star(x,y,4,3,.7)).join(''),PAL.star,op(c.lit?.95:.75));}];

/* ===== 菌菇：未成熟时菌盖偏奶白 ===== */
const lantern=(c:Ctx,x:N,b:N,s:N,col:string,glow:boolean)=>{const q=at(x,b,s);return (glow?halo(c,x,b-7*s,15*s,col):'')+P(`M${q(-9,0)}C${q(-9,-10)} ${q(-6,-14)} ${q(0,-14)}C${q(6,-14)} ${q(9,-10)} ${q(9,0)}Q${q(0,3.5)} ${q(-9,0)}Z`,col)+E(x,b-5*s,5*s,6*s,'#fff1c2',op(glow?(c.lit?.85:.55):.25))+S(`M${q(-4.5,-13)}Q${q(-7,-6)} ${q(-5,1)}M${q(4.5,-13)}Q${q(7,-6)} ${q(5,1)}`,c.d('#a8603a'),.8,op(.45))+C(x,b-14.6*s,1.4*s,col)+E(x,b+.6*s,6*s,1.3*s,glow?'#ffe9a8':c.cream,op(.9));};
const cone=(x:N,y:N,w:N,h:N,t:N)=>`M${r1(x-w)} ${y}Q${r1(x-w*.5)} ${r1(y-h*.55)} ${r1(x+t)} ${r1(y-h)}Q${r1(x+w*.5)} ${r1(y-h*.55)} ${r1(x+w)} ${y}Q${x} ${y+2.2} ${r1(x-w)} ${y}Z`;
const ear=(x:N,y:N,s:N,d:N)=>{const q=at(x,y,s,d);return `M${q(0,0)}C${q(5,-7)} ${q(11,-4)} ${q(10,1)}C${q(9,5)} ${q(3,4)} ${q(0,0)}Z`;};
const SHROOMS:Draw[]=[
 // 苔菇：苔藓小丘上冒出三朵小褐菇，菌盖沾着苔点
 c=>{let s=P(dots([[-10,-2.5,4.5],[-4,-5,6],[4,-5,6],[10,-2.5,4.5]]),c.d('#6f9a62'))+P(dots([[-6,-7,2.5],[2,-9,3],[8,-6,2.2],[-11,-4,1.6]]),c.d('#8fbf78'))+P(dots([[-8,-5,.7],[-2,-9,.7],[5,-8,.7],[10,-4,.6],[0,-4,.6]]),c.d('#b9da90'),op(.85));
  const k=c.st>=4?1:c.st===3?.78:.45,M:N[][]=[[0,-13,6,6,5],[-6,-8,4.6,4.6,3],[6,-9,4.2,4.4,3]];
  s+=P(M.map(([x,y,,,st])=>`M${x-1.4} ${y+st}L${x-1} ${y}L${x+1} ${y}L${x+1.4} ${y+st}Z`).join(''),c.cream);
  return s+P(dome(0,-13,6*k,6*k),c.u())+P(dome(-6,-8,4.6*k,4.6*k)+dome(6,-9,4.2*k,4.4*k),c.ua(-4))+(c.st>=3?P(dots([[-1.6,-13-6*k,.8],[2.2,-14-3*k,.7],[-7,-8-4.4*k,.7],[6.6,-9-4.6*k,.7]]),c.d('#8fbf78')):'')+glints(c,[[-2.4*k,-13-4.4*k,.8*k]]);},
 // 灯笼菇：细高菌柄顶着会发光的灯笼形菌盖
 c=>{const sc=c.st>=4?1:c.st===3?.82:.5,h=c.st>=4?24:c.st===3?20:10,glow=c.st>=3;
  let s=P(`M-1.6 0Q-2.6 ${-h/2}-1.2 ${-h}L1.2 ${-h}Q2.6 ${-h/2} 1.6 0Z`,c.cream)+lantern(c,0,-h,sc,glow?c.g():c.u(),glow);
  if(c.st>=4)s=P('M-11.2 0Q-11.8-6-10.6-11L-9.4-11Q-8.4-6-8.8 0Z',c.cream)+lantern(c,-10,-11,.5,c.ga(-4),true)+s;
  return s;},
 // 雨伞菇：高柄带菌环，宽平红伞盖上有白点，旁边一朵小菇
 c=>{const w=c.st>=4?15:c.st===3?10:5.5,h=c.st>=4?30:c.st===3?24:12,ry=c.st>=4?.8:1.1,sp=c.hy?c.ua(20):c.d('#fbf3e4');
  let s='';if(c.st>=4)s+=P('M9 0L9.4-5L11-5L11.4 0Z',c.cream)+P(dome(10.2,-5,3.6,3.2),c.ua(-4))+P(dots([[9.2,-7.6,.7],[11.4,-7,.6]]),sp);
  s+=P(`M-2 0Q-2.6 ${-h/2}-1.4 ${-h}L1.4 ${-h}Q2.6 ${-h/2} 2 0Z`,c.cream)+(c.st>=3?P(`M-3.4 ${r1(-h*.76)}Q0 ${r1(-h*.76+3)} 3.4 ${r1(-h*.76)}L4 ${r1(-h*.7)}Q0 ${r1(-h*.7+3.4)}-4 ${r1(-h*.7)}Z`,c.d('#e6d4bc')):'');
  s+=P(`M${-w} ${-h}Q${r1(-w*.9)} ${r1(-h-w*ry)} 0 ${r1(-h-w*ry*1.05)}Q${r1(w*.9)} ${r1(-h-w*ry)} ${w} ${-h}Q0 ${-h+2.5} ${-w} ${-h}Z`,c.u())+S(`M${r1(-w*.86)} ${-h+.4}Q0 ${-h+2.4} ${r1(w*.86)} ${-h+.4}`,c.u(-18),1.1,op(.6));
  if(c.st>=3)s+=P(dots([[-.55,-.32,.13],[-.1,-.62,.13],[.42,-.4,.11],[.76,-.12,.08],[-.84,-.08,.07],[.12,-.22,.09]].map(([x,y,r])=>[x*w,-h+y*w*ry*1.2,r*w])),sp);
  return s;},
 // 绒球菇：贴地的一团圆胖白绒球，熟时冒孢子烟
 c=>{const B:N[][]=c.st>=4?[[7,-6,5.6],[-12,-3.6,3.6],[-3,-8,8]]:c.st===3?[[6,-4.6,4],[-3,-6,6]]:[[3,-2,2],[-2,-3,3]];let s='';
  B.forEach(([x,y,r],k)=>{const col=k===1&&c.st>=4?c.ua:c.u;s+=C(x,y,r,col(-14))+C(x-r*.16,y-r*.18,r*.8,col());});
  s+=P(dots(B.flatMap(([x,y,r])=>[[x-r*.4,y-r*.1,r*.09],[x+r*.3,y-r*.45,r*.08],[x+r*.1,y+r*.3,r*.08],[x-r*.1,y-r*.55,r*.07],[x+r*.55,y,r*.07]])),c.d('#fffaf0'),op(.7))+P(B.map(([x,y,r])=>ov(x-r*.38,y-r*.42,r*.26,r*.16)).join(''),c.white,op(.6))+S('M-17 0l-1-4M-16 0l1-3.4M15 0l-1-4M16 0l1.6-3',c.lf,1);
  if(c.st>=4)s+=P(dots([[-13,-10,1.3],[-10.6,-14,1],[-14.6,-17,.8],[-11,-19,.6]]),c.d('#efe6d4'),op(.6));
  return s;},
 // 晶耳：小木桩两侧长出半透明的耳状晶体
 c=>{let s=P('M-8 0L-7-15Q0-17.5 7-15L8 0Q0 3-8 0Z',c.wood)+P('M2 1.6L3-16.2Q5.5-16 7-15L8 0Q5 1.8 2 1.6Z',c.wd)+E(0,-15,7,2.5,c.d(PAL.woodLight))+S('M-3.6-15a3.6 1.2 0 1 0 7.2 0a3.6 1.2 0 1 0-7.2 0M-5-3v-8M-2-1v-7',c.wd,.6,op(.7));
  const all:N[][]=[[7,-10,1,1],[-7,-12,1,-1],[1,-16,.8,1],[6,-4,.75,1],[-6,-5,.7,-1]],Ea=all.slice(0,c.st>=4?5:c.st===3?3:2).map(e=>c.st<3?[e[0],e[1],e[2]*.5,e[3]]:e),glow=c.st>=3,[ea,eb]=split(Ea,([x,y,k,d])=>ear(x,y,k,d));
  if(glow&&c.lit)s=halo(c,0,-10,15,c.g())+s;
  s+=P(ea,glow?c.g():c.u(),op(.88))+(eb?P(eb,glow?c.ga(4):c.ua(),op(.88)):'')+S(Ea.map(([x,y,k,d])=>{const q=at(x,y,k,d);return `M${q(2,0)}C${q(5,-3)} ${q(7,-2)} ${q(7.5,.5)}`;}).join(''),'#ffffff',.7,op(.55));
  if(c.st>=4)s+=P(star(12,-15,4,2.2,.5)+star(-12,-18,4,1.8,.4),'#ffffff',op(c.lit?.95:.8));
  return s;},
 // 梦孢菇：细柄顶着尖帽菌盖，飘着发光孢子和虚线漩涡
 c=>{const k=c.st>=4?1:c.st===3?.8:.5;
  let s=S(`M-3 0Q-6 ${r1(-14*k)}-2 ${r1(-28*k)}`,c.d('#e6dcef'),2.4)+P(cone(-2,r1(-28*k),7*k,16*k,3*k),c.u())+S(`M${r1(-2-6*k)} ${r1(-28*k-2)}Q-2 ${r1(-28*k)} ${r1(-2+6*k)} ${r1(-28*k-2)}`,c.u(-18),1.6);
  if(c.st>=4)s+=S('M6 0Q8-9 7-16',c.d('#e6dcef'),1.8)+P(cone(7,-16,4.5,10,2),c.a(4));
  if(c.st>=3){const Sp:N[][]=[[-11,-40,1.4],[4,-46,1.2],[10,-34,1.5],[-13,-26,1],[13,-24,1.1],[-6,-49,.9]].slice(0,c.st>=4?6:3),[pa,pb]=split(Sp,([x,y,r])=>ov(x,y,r,r));
   if(c.lit)s+=P(dots(Sp.map(([x,y,r])=>[x,y,r*2.6])),c.g(16),op(.3));
   s+=P(pa,c.g(18))+P(pb,c.ga(18))+S('M-12-30q-4-8 4-12t10-4',c.g(14),1.2,` stroke-dasharray="1 3"${op(.6)}`);}
  return s;}];

/* ===== 水生：画在小水盘上 ===== */
const boat=(x:N,y:N,w:N)=>`M${x-w} ${y-3}Q${x} ${y+4.5} ${x+w} ${y-3}Q${x} ${y+.6} ${x-w} ${y-3}Z`;
const AQUA:Draw[]=[
 // 浮萍：水面铺满成簇的小圆叶，熟时点缀小白花
 c=>{const n=c.st>=4?15:c.st===3?11:7;let a='',b='',sh='';
  for(let k=0;k<n;k++){const x=(jitter(k,1)*2-1)*10.5,y=-1+(jitter(k,2)*2-1)*3.6,frag=ov(x,y,2.5,1.4)+ov(x+2,y-.8,1.9,1.1)+(k<9?ov(x+.8,y+1,1.6,.9):'');sh+=ov(x+.6,y+.9,3,1.4);if(k%2)b+=frag;else a+=frag;}
  return P(sh,c.d(PAL.waterDeep),op(.4))+P(a,c.m())+P(b,c.hy?c.a():c.m(12))+P(dots([[-6,-2,.6],[3,-3,.6],[8,0,.5],[-2,1,.5]]),c.ll,op(.8))+(c.st>=4?P(dots([[-4,-2.4,.9],[5,-.6,.9],[1,-4,.8]]),c.d('#fffaf0')):'');},
 // 水莲：缺口圆叶浮在水面，粉色莲花从水中立起
 c=>{let s=P(pad(-6,-1,8.5,3.4)+pad(7,1.5,6,2.6),c.lf)+S('M-6-1l-6-1.4M-6-1l3.4-2.6M-6-1l-1.4-3M7 1.5l4-1.4M7 1.5l-3.4-1.8',c.ll,.7,op(.6));
  if(c.st<3)return s+S('M3-1q0-6 3-7',c.lf,1.6);
  if(c.st===3)return s+S('M1-1L1-6',c.stem,1.4)+P(leaf(1,-5,10,0,3.6),c.m());
  return s+S('M1-1L1-6',c.stem,1.4)+P([-75,-48,-20,20,48,75].map(a=>leaf(1,-7,10,a,3.4,.85)).join(''),c.m(-8))+C(1,-10,2.6,c.d('#f4cf6e'))+P([-50,-16,16,50].map(a=>leaf(1,-6,7.4,a,3.2,.85)).join(''),c.a(8))+S('M-3-14q1-2 3-2.4',c.white,.8,op(.5));},
 // 芦苇：细长叶片丛，几根高秆顶着下垂的褐色穗
 c=>{let s=P(leaf(-6,0,22,-16,2.2)+leaf(3,0,27,9,2),c.ld)+P(leaf(-2,0,30,-5,2)+leaf(7,0,20,22,2.2)+leaf(0,0,16,-28,2),c.lf);
  if(c.st<3)return s;const big=c.st>=4;
  s+=S(big?'M-3 0L-6-36M2 0L3-42M6 0L10-32':'M-3 0L-5-30M3 0L5-34',c.d('#b9a27a'),1.3);
  const pl=big?[[-6,-36,-58,10],[10,-32,62,9],[3,-42,30,10]]:[[-5,-30,-40,6],[5,-34,30,6]],[pa,pb]=split(pl,([x,y,a,l])=>leaf(x,y,l,a,3.4));
  return s+P(pa,c.u())+(pb?P(pb,c.ua(4)):'')+S(pl.map(([x,y,a,l])=>{const [tx,ty]=tip(x,y,l*.8,a);return `M${x} ${y}L${r1(tx)} ${r1(ty)}`;}).join(''),c.u(18),.7,op(.7));},
 // 净水藻：几条波浪状半透明藻带从水中升起，带气泡
 c=>{const R:N[][]=[[-6,34,4],[7,20,3.2],[1,26,3.6]],rib=([x,h]:N[])=>`M${x} 0Q${x-4} ${r1(-h/6)} ${x} ${r1(-h/3)}T${x} ${r1(-2*h/3)}T${x} ${-h}`;
  let s=S(rib(R[0])+rib(R[1]),c.m(),3.6,op(.88))+S(rib(R[2]),c.a(4),3.6,op(.88))+S(R.map(rib).join(''),c.m(18),.9,op(.7));
  if(c.st>=3)s+=S(dots([[-1,-30,1.6],[3,-36,1.2],[-10,-24,1.1],[11,-26,1.4],[5,-14,1]].slice(0,c.st>=4?5:2)),c.d(PAL.foam),.8);
  if(c.st>=4)s+=P(dots([[-12,1,1],[12,2,.9],[-9,3,.8]]),c.m(8))+P(star(-12,-34,4,2.4,.5),c.white,op(.9));
  return s;},
 // 冰灯莲：泛霜浮叶上立着棱角分明的冰晶莲花，始终发出冷光
 c=>{let s=P(pad(-5,-.5,9,3.5)+pad(8,1.5,5.5,2.2),c.d(mix(PAL.leaf,'#cfe6ef',.45)))+S('M-5-.5l-6-1.4M-5-.5l3.4-2.6M-5-.5l-1.2-3M8 1.5l3.6-1.2',c.d(PAL.foam),.7,op(.7));
  if(c.st<3)return s+P(kite(1,-1,6,10,1.8),c.u());
  if(c.st===3)return s+halo(c,0,-6,10,c.g())+P(kite(0,-1,12,0,3.4),c.g(-6))+S('M0-1v-10',c.white,.6,op(.6));
  return s+halo(c,0,-9,15,c.g())+E(0,1.4,9,2.4,c.g(),op(c.lit?.35:.15))+P([-60,-30,0,30,60].map(a=>kite(0,-2,13,a,4)).join(''),c.g(-10))+P([-32,0,32].map(a=>kite(0,-2,9,a,3.6)).join(''),c.ga(6))+S([-60,-30,0,30,60].map(a=>{const [x,y]=tip(0,-2,12,a);return `M0-2L${r1(x)} ${r1(y)}`;}).join(''),'#ffffff',.6,op(.55))+C(0,-6,2.2,'#ffffff',op(.85));},
 // 星舟草：月牙形浮叶像小船，船心立起细叶，顶着发光星花
 c=>{const big=c.st>=4,mt=big?20:15;let s=P(boat(-3,0,11),c.lf)+S('M-12.4-2.6Q-3 1.2 6.4-2.6',c.ll,.9,op(.8))+P(leaf(-3,-1,mt,6,2.4)+leaf(-4,-1,12,-16,1.8),c.ld);
  if(c.st>=3)s+=P(boat(9,4,6),c.lf)+P(leaf(9,2.4,9,-6,1.6),c.ld);
  if(c.st===3)return s+C(-1.4,-15.6,2,c.m(-6));
  if(!big)return s;
  return s+(c.lit?halo(c,-1,-22,9,c.g())+halo(c,8,-7,6,c.ga()):'')+P(star(-1,-22,5,5,2.2),c.g())+P(star(8,-6.8,5,3,1.3),c.ga(4))+C(-1,-22,1.3,'#fffbe8')+C(8,-6.8,.8,'#fffbe8');}];

// 发光花：两枝六瓣星花，花心常亮，夜里外圈柔光更明显
const GLOW:Draw=c=>{let s=P(leaf(0,-2,12,-60,4)+leaf(0,-5,11,58,3.6),c.lf)+S('M0 0Q-2-14-3-28'+(c.st>=4?'M0-6Q5-12 8-20':''),c.stem,1.4);
 if(c.st<3)return s+P(leaf(-3,-26,5,0,2.4),c.ld);
 const fl=(x:N,y:N,r:N,col:string)=>halo(c,x,y,r*1.8,col)+P(ring(x,y,6,r,r*.38,0,.85),col)+C(x,y,r*.32,'#fffbe0');
 s+=fl(-3,-28,c.st>=4?8:5.5,c.g());
 if(c.st>=4)s+=fl(8,-20,5.5,c.ga(6))+P(dots([[-12,-36,.9],[6,-38,.8],[14,-28,.8],[-13,-20,.7]]),PAL.star,op(c.lit?.95:.7));
 return s;};

const SPECIES:Draw[][]=[FLOWERS,HERBS,VEG,TREES,SHROOMS,AQUA];

/* 地面：土堆或小水盘，加落地阴影。不随生长缩放。 */
function ground(f:N,lit:boolean):string{
 if(f===5)return E(2,2,18,7.4,'#1d2440',op(.18))+E(0,0,17,7.4,dusk('#7d9a74',lit))+E(0,-.4,15,6,dusk(PAL.water,lit))+S('M-9-1.6q4-2 8 0M3 2.2q3-1.4 6 0',dusk(PAL.foam,lit),1,op(.7));
 const w=f===3?15:12;
 return E(2,1.5,w+2,w*.42,'#1d2440',op(.2))+E(0,0,w,w*.38,dusk(f===4?'#6e5a48':'#8a6a4f',lit))+E(-1,-.6,w*.62,w*.2,dusk(f===4?'#86705a':'#a7845f',lit));
}
function seed(f:N,c:Ctx):string{
 if(f===5)return E(0,-1,4,1.6,c.d('#9b7a58'))+C(.5,-1.6,1.1,c.m())+S('M-7 0a7 2.6 0 0 0 14 0',c.d(PAL.foam),.8,op(.6));
 return P('M-6 0Q0-6 6 0Z',c.d('#9a7a5c'))+C(.8,-3.4,1.3,c.m())+C(-2,-1.5,.7,c.d('#6e5440'));
}
/* 幼苗：按科区分——菌菇是白色菌钉，水生是浮在水面的小叶和卷芽，果树是带三片叶的细枝。 */
function sprout(f:N,c:Ctx,k:N):string{
 const h=r1((f===3?14:9)*k);
 if(f===4)return P(dots([[-3,-2,1.8*k],[2,-3,2.2*k],[5,-1.5,1.4*k]]),c.cream)+P(dots([[-3,-3.2*k,1.1*k],[2,-4.6*k,1.3*k],[5,-2.4*k,.8*k]]),c.u());
 if(f===5)return E(-1,-.5,6*k,2.4*k,c.lf)+S(`M2-1q0-${h} -3-${h}q-2 0-1 2`,c.ll,1.6);
 if(f===3)return S(`M0 0L0-${h}`,c.wood,1.6)+P(leaf(0,-h,5*k,-50,2.2)+leaf(0,-h,5*k,50,2.2)+leaf(0,-h*.6,4.5*k,70,2),c.lf);
 return S(`M0 0Q-1-${r1(h/2)} 0-${h}`,c.stem,1.4)+P(leaf(0,-h,6*k,-65,3)+leaf(0,-h,6*k,65,3),c.ll)+(f===1?P(leaf(0,-h,4*k,0,2),c.lf):'');
}

const idx=(id:string):[N,N]|null=>{const m=/^plant-(\d)-(\d)$/.exec(id);return m?[+m[1],+m[2]]:null;};

/** 植物图：origin = 1×1 格子中心的落地点。hue 为品种色相（基因 color），form 1–5 影响大小，progress 0–1 生长进度，lit = 夜晚。 */
export function plantArt(def:PlantDef,hue:number,form:number,progress:number,lit:boolean):string{
 const own=idx(def.parents?.[0]??def.id),other=def.parents?idx(def.parents[1]):null,glowflower=!own;
 const fam=own?own[0]:def.family,T=own?TONE[own[0]][own[1]]:GLOW_TONE,TA=other?TONE[other[0]][other[1]]:T;
 const shift=hue-def.color,hm=T[0]+shift,ha=TA[0]+shift;
 const p=Math.max(0,Math.min(1,progress)),st=p<.15?0:p<.4?1:p<.7?2:p<1?3:4;
 const tone=(t:N[],h:N,dl:N)=>hex(h,t[1],t[2]+dl+(st===4?4:0)),d=(x:string)=>dusk(x,lit);
 const unr=(x:string)=>st>=4?x:mix(x,fam===4?'#efe2c6':'#a3c47c',fam===4?.45:.62);
 const g=(l=0)=>tone(T,hm,l),ga=(l=0)=>tone(TA,ha,l);
 const c:Ctx={st,lit,hy:!!def.parents,g,ga,m:(l=0)=>d(g(l)),a:(l=0)=>d(ga(l)),u:(l=0)=>d(unr(g(l))),ua:(l=0)=>d(unr(ga(l))),d,
  lf:d(PAL.leaf),ll:d(PAL.leafLight),ld:d(PAL.leafDark),stem:d('#6f9a72'),wood:d(PAL.wood),wd:d(PAL.woodDark),cream:d('#f3e6cc'),white:d('#ffffff')};
 // 生长阶段：种子 → 幼苗 → 成株（只有叶）→ 开花/青果 → 成熟（最大最亮）。阶段内再随进度平滑长大。
 const fs=.85+Math.max(1,Math.min(5,form))*.05,k=(a:N,b:N)=>(p-a)/(b-a);
 const body=st===0?seed(fam,c):st===1?sprout(fam,c,.7+.3*k(.15,.4)):(glowflower?GLOW:SPECIES[fam][own![1]])(c);
 const s=r1((st<=1?1:st===2?.6+.18*k(.4,.7):st===3?.84+.12*k(.7,1):1)*fs*100)/100;
 return ground(fam,lit)+(s===1?body:`<g transform="scale(${s})">${body}</g>`);
}
