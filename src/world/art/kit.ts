/* 美术素材共用工具：等距坐标、立方体三面着色、夜间压暗。所有素材包只通过这里取坐标和颜色，保证光照方向一致。
   坐标原点 = 物件锚点格子的顶角向下 10 像素（与地图里的 transform 一致）。
   u 沿地图 x 轴（屏幕右下），v 沿地图 y 轴（屏幕左下），h 为离地高度（向上为正）。一格 = 46×30 像素的菱形。 */
export const TW=23,TH=15;
const r=(n:number)=>Math.round(n*10)/10;
export type Pt=[number,number];
/** 格子坐标 (u,v) 加高度 h → 屏幕坐标。 */
export const pt=(u:number,v:number,h=0):Pt=>[r(TW*(u-v)),r(TH*(u+v)-10-h)];
/** 多边形路径。 */
export const poly=(pts:Pt[]):string=>'M'+pts.map(([x,y])=>`${x} ${y}`).join('L')+'Z';
/** 折线路径（不闭合），用于描边细节。 */
export const line=(pts:Pt[]):string=>'M'+pts.map(([x,y])=>`${x} ${y}`).join('L');
/** 把十六进制颜色向另一种颜色混合。 */
export function mix(a:string,b:string,t:number):string{const n=(h:string)=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const [x,y]=[n(a),n(b)];return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');}
/** 夜间压暗：物件本身的颜色向夜色靠拢；发光部分（灯、窗、星）不要经过它。 */
export const dusk=(c:string,lit:boolean):string=>lit?mix(c,'#2a2c5e',.38):c;
/** 统一光照：顶面最亮、左前面（朝 +v）次亮、右前面（朝 +u）最暗。传入顶面颜色即可得到三面。 */
export const faces=(c:string)=>({top:c,left:mix(c,'#1b1c3a',.14),right:mix(c,'#1b1c3a',.3)});
/** 等距立方体：占据 [u0,u1]×[v0,v1]，高度 h0→h1。只画看得见的顶面、左前面、右前面。 */
export function box(u0:number,v0:number,u1:number,v1:number,h0:number,h1:number,c:{top:string;left:string;right:string}):string{
 return `<path d="${poly([pt(u0,v1,h0),pt(u1,v1,h0),pt(u1,v1,h1),pt(u0,v1,h1)])}" fill="${c.left}"/>`+
  `<path d="${poly([pt(u1,v0,h0),pt(u1,v1,h0),pt(u1,v1,h1),pt(u1,v0,h1)])}" fill="${c.right}"/>`+
  `<path d="${poly([pt(u0,v0,h1),pt(u1,v0,h1),pt(u1,v1,h1),pt(u0,v1,h1)])}" fill="${c.top}"/>`;
}
/** 双坡屋顶：屋脊沿 u 方向（along='u'）或 v 方向，屋檐高度 h0，屋脊高度 h1，四周出檐 eave 格。 */
export function gable(u0:number,v0:number,u1:number,v1:number,h0:number,h1:number,color:string,along:'u'|'v'='u',eave=.08):string{
 const a=u0-eave,b=u1+eave,c=v0-eave,d=v1+eave,f=faces(color);
 if(along==='u'){const m=(c+d)/2;
  return `<path d="${poly([pt(a,d,h0),pt(b,d,h0),pt(b,m,h1),pt(a,m,h1)])}" fill="${f.top}"/>`+
   `<path d="${poly([pt(b,c,h0),pt(b,d,h0),pt(b,m,h1)])}" fill="${f.right}"/>`+
   `<path d="${line([pt(a,m,h1),pt(b,m,h1)])}" stroke="#fff3dc" stroke-opacity=".55" stroke-width="1.5" stroke-linecap="round"/>`;}
 const m=(a+b)/2;
 return `<path d="${poly([pt(b,c,h0),pt(b,d,h0),pt(m,d,h1),pt(m,c,h1)])}" fill="${f.right}"/>`+
  `<path d="${poly([pt(a,d,h0),pt(b,d,h0),pt(m,d,h1)])}" fill="${f.left}"/>`+
  `<path d="${line([pt(m,c,h1),pt(m,d,h1)])}" stroke="#fff3dc" stroke-opacity=".55" stroke-width="1.5" stroke-linecap="round"/>`;
}
/** 落地阴影：覆盖整个占地，略向右下偏移。 */
export function shadow(a:number,b:number):string{
 const k=.06;return `<path d="${poly([pt(-k,-k),pt(a+k,-k),pt(a+k,b+k),pt(-k,b+k)])}" transform="translate(3 3)" fill="#1d2440" opacity=".2"/>`;
}
/** 固定伪随机数：同一个种子每次得到同一个值，用于草叶、石子的位置。 */
export const jitter=(n:number,k:number):number=>{const v=Math.sin(n*127.1+k*311.7)*43758.5453;return v-Math.floor(v);};
/** 共享色板：所有素材优先从这里取色，保证同一世界观。 */
export const PAL={
 wood:'#b08a66',woodDark:'#8a6a4f',woodLight:'#d8b98e',
 stone:'#b9b3c4',stoneDark:'#8f88a0',
 plaster:'#efe2c6',cream:'#f6e6bf',
 leaf:'#83ac84',leafLight:'#b6d8a0',leafDark:'#5f8a6a',
 water:'#8dcbd0',waterDeep:'#5aa6b4',foam:'#effbf6',
 glow:'#ffe4a0',glowWarm:'#f5c58d',star:'#fff6c8',
 roofs:['#c98a6a','#7fae8c','#6c9eae','#c99a6f','#86aac4','#a08fc9'],
 ink:'#2a3048',highlight:'#fff3dc'
};
