/* 远行地区插画与家园地面点缀。
   regionArt：远行页地区卡片的横幅风景（320×120，卡片约 165×62 显示）。未解锁时是同一场景的雾中剪影，夜晚出现双月和星光。
   zoneDressing：家园地图空地上的小草、落叶、石子等点缀，只画在空格子里，不接收触摸。 */
import {mix,dusk,jitter,PAL} from './kit.ts';

let seq=0;
const f=(n:number)=>Math.round(n*10)/10;
const grey=(c:string)=>{const [r,g,b]=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));const l=Math.round(r*.3+g*.59+b*.11).toString(16).padStart(2,'0');return '#'+l+l+l;};

/* 每个地区的天色（白天上→下）、远景雾色。夜里统一用深紫夜空，底部带一点地区色。 */
const SKIES:[string,string,string][]=[
 ['#b3c3ec','#e9e0ef','#f6e6d6'],
 ['#a8bfdc','#d6e3dc','#eef0d8'],
 ['#b0c4ea','#d8e4ec','#e8efe0'],
 ['#bcb2e2','#ecd0d4','#f6dcc6'],
 ['#b4c6ec','#dfe6f4','#f2f2f6'],
 ['#a7a2dc','#d4c8ea','#f0dcea']
];
const NIGHT=['#15123a','#2a235e'];

interface Ink {
 /** 物件颜色：far 越大越接近远处的天色（空气透视）；夜晚压暗，未解锁时去色并蒙上雾色。 */
 c:(x:string,far?:number)=>string;
 /** 发光颜色（萤火、星光、月亮）：夜里不压暗，未解锁时同样去色。 */
 g:(x:string)=>string;
 dark:boolean;locked:boolean;id:string;
}

const moons=(k:Ink)=>`${k.dark?`<circle cx="262" cy="28" r="34" fill="url(#${k.id}-h)"/>`:''}<circle cx="262" cy="28" r="12" fill="${k.g('#f7e4b4')}" opacity="${k.dark?1:.55}"/><circle cx="258.5" cy="24.5" r="7" fill="${k.g('#fff8e8')}" opacity="${k.dark?.55:.4}"/><circle cx="266" cy="31" r="2.2" fill="${k.g('#c9a066')}" opacity=".35"/><circle cx="232" cy="15" r="4.6" fill="${k.g('#d4def4')}" opacity="${k.dark?.95:.5}"/>`;
const stars=(k:Ink,n:number)=>k.dark?`<g fill="${k.g('#efeaff')}">${Array.from({length:n},(_,i)=>`<circle cx="${f(8+jitter(i,1)*304)}" cy="${f(4+jitter(i,2)*44)}" r="${i%4===0?1.1:.6}" opacity="${f(.45+jitter(i,3)*.5)}"/>`).join('')}</g>`:'';
/** 小草丛：几根弯曲的草叶，一条路径。 */
const tuft=(x:number,y:number,s:number,col:string)=>`<path d="M${f(x-3*s)} ${y}q${f(-s)} ${f(-4*s)} ${f(-3*s)} ${f(-6*s)}M${x} ${y}q0 ${f(-5*s)} ${f(s)} ${f(-8*s)}M${f(x+2*s)} ${y}q${f(s)} ${f(-4*s)} ${f(3*s)} ${f(-6*s)}" stroke="${col}" stroke-width="${f(1.1*s)}" stroke-linecap="round" fill="none"/>`;
/** 四角星：遗迹与星光用。 */
const spark=(x:number,y:number,r:number,col:string,o=1)=>`<path d="M${x} ${f(y-r)}Q${f(x+r*.18)} ${f(y-r*.18)} ${f(x+r)} ${y}Q${f(x+r*.18)} ${f(y+r*.18)} ${x} ${f(y+r)}Q${f(x-r*.18)} ${f(y+r*.18)} ${f(x-r)} ${y}Q${f(x-r*.18)} ${f(y-r*.18)} ${x} ${f(y-r)}Z" fill="${col}" opacity="${o}"/>`;

/* 晨露草甸：起伏的草坡，一条小路通向荒弃的邮亭；路牌上画着信封，旁边是圆顶信箱，草叶挂着露珠。 */
function meadow(k:Ink):string {
 const {c,g,dark}=k,roof=PAL.roofs[0];
 const flowers=[[42,104,'#f2b8c6'],[58,111,'#f6dd8a'],[226,106,'#fff4e6'],[250,112,'#f2b8c6'],[284,103,'#f6dd8a'],[22,114,'#fff4e6'],[300,114,'#f2b8c6'],[94,100,'#f6dd8a']] as const;
 const dew=[[64,100],[236,99],[276,108],[30,106]];
 return `<path d="M0 66Q46 50 104 60T214 54T320 60V120H0Z" fill="${c('#b4d0b0',.5)}"/>
<path d="M0 80Q70 64 150 74T320 70V120H0Z" fill="${c('#a0c493',.2)}"/>
<path d="M0 94Q90 82 180 90T320 86V120H0Z" fill="${c('#86ad7d')}"/>
<path d="M160 93Q138 101 124 109T92 120H126Q140 110 154 103T178 93Z" fill="${c('#e4d4aa')}"/>
<path d="M141 104Q148 99 156 96" stroke="${c('#f4ead0')}" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".7"/>
<g transform="translate(178 92) scale(1.32) translate(-178 -92)"><ellipse cx="178" cy="91" rx="26" ry="4" fill="#1d2440" opacity=".18"/>
<path d="M186 67L198 62V86L186 91Z" fill="${c(mix(PAL.plaster,'#1b1c3a',.3))}"/>
<path d="M162 67H186V91H162Z" fill="${c(PAL.plaster)}"/>
<path d="M174 50L188 46L202 61L190 66Z" fill="${c(mix(roof,'#1b1c3a',.3))}"/>
<path d="M157 68L174 50L191 68Z" fill="${c(roof)}"/>
<path d="M158 68L174 51L190 68" stroke="#fff3dc" stroke-opacity=".6" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
<path d="M166 72H182V80H166Z" fill="${dark?g('#7a6650'):c('#6f6658')}"/>
<path d="M169 75.5h6l-3 2.2Z" fill="${c('#f6e6bf')}"/>
<path d="M164 82H184" stroke="${c(PAL.wood)}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M167 91V85h7v6" fill="${c(PAL.woodDark)}"/>
<path d="M197 70q-4 6-1 12M197 76l-3-1M196 82l3-2" stroke="${c(PAL.leafDark)}" stroke-width="1.4" stroke-linecap="round" fill="none"/>
<circle cx="194" cy="70" r="2" fill="${c(PAL.leaf)}"/><circle cx="198" cy="79" r="1.8" fill="${c(PAL.leafLight)}"/>
${dark?`<circle cx="188" cy="72" r="9" fill="url(#${k.id}-w)"/>`:''}<path d="M188 68v3" stroke="${c(PAL.woodDark)}" stroke-width="1"/><circle cx="188" cy="72.5" r="2.2" fill="${dark?g('#ffe4a0'):c('#f3d79a')}"/>
<path d="M144 96V72" stroke="${c(PAL.woodDark)}" stroke-width="2.4" stroke-linecap="round"/>
<path d="M135 71L152 69L153 78L136 80Z" fill="${c(PAL.woodLight)}"/>
<path d="M139 72.5l13-1.5 .8 5.6-13 1.5ZM139 72.5l6.8 3.4 6.2-4.9" stroke="${c(PAL.woodDark)}" stroke-width="1" stroke-linejoin="round" fill="none"/>
<path d="M214 94V79" stroke="${c(PAL.woodDark)}" stroke-width="2.2"/>
<path d="M208 80V73Q208 68 214 68Q220 68 220 73V80Z" fill="${c('#8fa9c4')}"/><path d="M210 72q4-3 8 0" stroke="#fff3dc" stroke-opacity=".55" stroke-width="1.2" fill="none"/><path d="M220 72h3v-5h-3" fill="${c('#d9876a')}"/></g>
${[[20,100,1.4],[76,106,1.2],[112,96,1],[200,98,1.1],[262,100,1.4],[306,98,1.2],[48,116,1.5],[270,118,1.6]].map(([x,y,s])=>tuft(x,y,s,c(PAL.leafDark))).join('')}
${flowers.map(([x,y,col])=>`<circle cx="${x}" cy="${y}" r="2" fill="${c(col)}"/><circle cx="${x}" cy="${y}" r=".7" fill="${c('#e2ad73')}"/>`).join('')}
${dew.map(([x,y])=>spark(x,y,2.2,g('#ffffff'),dark?.5:.85)).join('')}`;
}

/* 低语森林：三层树林，前景大树的树皮上刻着箭头和圆环标记，夜里标记微微发光；树根旁有蕨和小蘑菇。 */
function forest(k:Ink):string {
 const {c,g,dark}=k;
 const far='M'+Array.from({length:14},(_,i)=>{const x=i*25-8,h=24+jitter(i,7)*14;return `${f(x-14)} 80L${x} ${f(80-h)}L${f(x+14)} 80`;}).join('L')+'V120H-22Z';
 const mid=[[34,0],[78,1],[232,2],[288,3]].map(([x,i])=>{const r=13+jitter(i,4)*5;return `<path d="M${x-2} 92V${f(76-r)}h4V92Z" fill="${c(PAL.woodDark,.25)}"/><circle cx="${x}" cy="${f(68-r)}" r="${f(r)}" fill="${c('#6f9a82',.25)}"/><circle cx="${f(x-r*.5)}" cy="${f(76-r*.6)}" r="${f(r*.7)}" fill="${c('#7aa58a',.25)}"/><circle cx="${f(x+r*.55)}" cy="${f(74-r*.5)}" r="${f(r*.62)}" fill="${c('#628c76',.25)}"/>`;}).join('');
 const mark=g(dark?'#d6f2dc':'#f0dcb4');
 return `${dark?'':`<path d="M150 0L190 0L150 120H96Z" fill="#fff7d6" opacity=".2"/><path d="M214 0H234L214 120H186Z" fill="#fff7d6" opacity=".14"/>`}
<path d="${far}" fill="${c('#9cbfae',.5)}"/>
${mid}
<path d="M0 90Q100 82 200 88T320 86V120H0Z" fill="${c('#5f8a6a')}"/>
<path d="M0 104Q80 98 170 104T320 100V120H0Z" fill="${c('#527c5f')}"/>
<path d="M104 120C108 98 110 72 112 26H130C131 72 134 98 140 120Z" fill="${c('#8a6a4f')}"/>
<path d="M124 26C125 72 128 98 133 120H140C134 98 131 72 130 26Z" fill="${c('#6e5440')}"/>
<path d="M96 120q8-8 14-10M146 120q-6-8-12-10" stroke="${c('#7a5d46')}" stroke-width="5" stroke-linecap="round" fill="none"/>
<path d="M116 92l5-6 5 6M121 86v14M116 64a5 5 0 1 0 10 0a5 5 0 1 0-10 0M121 61v6" stroke="${mark}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${dark?.9:.8}"/>
${dark?`<circle cx="121" cy="78" r="20" fill="url(#${k.id}-w)" opacity=".6"/>`:''}
<path d="M200 120C202 104 204 86 205 56H217C218 86 220 104 224 120Z" fill="${c('#82644c',.08)}"/>
<path d="M207 82h7M207 87h7M207 92h7" stroke="${mark}" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>
<ellipse cx="120" cy="10" rx="54" ry="24" fill="${c('#5f8a6a')}"/><ellipse cx="88" cy="24" rx="30" ry="16" fill="${c('#83ac84')}"/><ellipse cx="150" cy="22" rx="30" ry="15" fill="${c('#6f9a7a')}"/>
<ellipse cx="212" cy="40" rx="30" ry="18" fill="${c('#6a957c',.08)}"/><ellipse cx="200" cy="48" rx="18" ry="10" fill="${c('#8db48e',.08)}"/>
<path d="M90 50q8-4 16 0M138 42q10-4 18 1" stroke="#fff3dc" stroke-opacity=".35" stroke-width="1.5" stroke-linecap="round" fill="none"/>
${[[60,112,1],[164,110,-1],[268,108,1],[18,104,-1]].map(([x,y,d])=>`<path d="M${x} ${y}q${8*d} -10 ${18*d} -10M${x+4*d} ${y-4}l${2*d} -5M${x+9*d} ${y-7}l${2*d} -4M${x+6*d} ${y-6}l${4*d} 2M${x+12*d} ${y-9}l${3*d} 2" stroke="${c(PAL.leafLight)}" stroke-width="1.6" stroke-linecap="round" fill="none"/>`).join('')}
${[[150,113],[156,116],[244,111]].map(([x,y],i)=>`<path d="M${x-1} ${y}v-4h2v4Z" fill="${c('#efe2c6')}"/><path d="M${x-4} ${y-3}q4-6 8 0Z" fill="${dark?g(['#b8d8ff','#cbbaff','#b8f0dc'][i]):c(['#d9876a','#e0a07a','#c97a6a'][i])}"/>`).join('')}
${[[84,114,30,'#d99a5b'],[184,116,-20,'#c9a25a'],[300,112,60,'#c97a5a']].map(([x,y,r,col])=>`<ellipse cx="${x}" cy="${y}" rx="3" ry="1.4" fill="${c(col as string)}" transform="rotate(${r} ${x} ${y})"/>`).join('')}`;
}

/* 萤光湿地：远处是垂柳，两条蜿蜒的水道穿过草地，芦苇、睡莲和一座小木桥；萤火虫白天隐约、夜里连成一片。 */
function wetland(k:Ink):string {
 const {c,g,dark}=k;
 const flies=[[38,70],[70,86],[104,62],[132,92],[168,72],[196,98],[226,66],[254,84],[290,74],[60,104],[150,58],[278,100],[12,88],[312,92]];
 const reeds=(x:number,y:number,s:number)=>`<path d="M${x} ${y}q-2 ${-9*s} -5 ${-15*s}M${x+3} ${y}q0 ${-11*s} 1 ${-19*s}M${x+6} ${y}q2 ${-8*s} 6 ${-13*s}M${x+1} ${y}q-6 ${-5*s} -10 ${-6*s}" stroke="${c('#6f9a7a')}" stroke-width="1.4" stroke-linecap="round" fill="none"/><ellipse cx="${f(x+3.9)}" cy="${f(y-16*s)}" rx="1.5" ry="${f(3.2*s)}" fill="${c('#9a7656')}"/><ellipse cx="${f(x-4)}" cy="${f(y-13*s)}" rx="1.4" ry="${f(2.8*s)}" fill="${c('#8a6a4f')}"/>`;
 // 垂柳：树干、圆冠和垂下的柳条；萤火沿主水道排成一条光带。
 const willow=(x:number,y:number,r:number,far:number)=>{
  // 树冠下缘是一排长短不一的柳条尖，从两侧向中间垂得更低。
  const fringe=Array.from({length:7},(_,i)=>{const t=i/6*2-1,px=x+r*1.05*t,py=y+r*(.55+.35*(1-Math.abs(t)))+(i%2?-r*.28:0);return `L${f(px)} ${f(py)}`;}).join('');
  return `<path d="M${x-1.5} ${y+14}V${y}h3V${y+14}Z" fill="${c(PAL.woodDark,far)}"/><path d="M${f(x+r*1.05)} ${f(y+r*.4)}Q${f(x+r*1.1)} ${f(y-r*.9)} ${x} ${f(y-r*.9)}Q${f(x-r*1.1)} ${f(y-r*.9)} ${f(x-r*1.05)} ${f(y+r*.4)}${fringe}Z" fill="${c('#7aa596',far)}"/><path d="M${f(x-r*.4)} ${f(y-r*.5)}q-2 ${f(r*.6)} -1 ${f(r*1.2)}M${f(x+r*.3)} ${f(y-r*.6)}q2 ${f(r*.6)} 1 ${f(r*1.3)}" stroke="${c('#9cc4ae',far)}" stroke-width="1.4" stroke-linecap="round" fill="none"/>`;
 };
 const trail=Array.from({length:16},(_,i)=>{const x=6+i*20+jitter(i,3)*8,y=96+Math.sin(i*.9)*3-(x>178?((x-178)/142)*4:0);return [f(x),f(y-4-jitter(i,4)*6)];});
 return `${willow(30,58,20,.45)}${willow(84,60,14,.5)}${willow(262,56,22,.45)}${willow(306,62,14,.5)}
<path d="M0 72Q160 66 320 72V120H0Z" fill="${c('#86ab90',.15)}"/>
<path d="M0 86Q160 78 320 86V120H0Z" fill="${c('#7aa087')}"/>
<path d="M-4 78C70 74 150 82 220 77S300 74 324 76V81C290 80 250 84 200 84S70 80-4 83Z" fill="${c(PAL.water,.2)}"/>
<path d="M-10 94C60 84 120 104 178 94S278 80 330 90V104C280 94 222 110 168 108S60 98-10 110Z" fill="${c(PAL.waterDeep)}"/>
<path d="M-10 94C60 84 120 104 178 94S278 80 330 90V96C280 88 222 104 170 102S60 92-10 102Z" fill="${c(PAL.water)}"/>
<path d="M20 96q14-3 26-1M110 98q16 2 28-1M218 90q14-3 24-2M270 92q12-2 22 0" stroke="${g(PAL.foam)}" stroke-opacity="${dark?.35:.75}" stroke-width="1.3" stroke-linecap="round" fill="none"/>
${dark?`<ellipse cx="236" cy="98" rx="16" ry="2.4" fill="${g('#f6e3b4')}" opacity=".45"/>`:''}
<path d="M200 82L206 108M232 80L238 106" stroke="${c(PAL.woodDark)}" stroke-width="2.2" stroke-linecap="round"/>
<path d="M196 90L240 86L242 92L198 96Z" fill="${c(PAL.wood)}"/><path d="M207 89.2l.6 5.6M218 88.2l.6 5.6M229 87.3l.6 5.6" stroke="${c(PAL.woodDark)}" stroke-width="1"/><path d="M197 90L240 86" stroke="#fff3dc" stroke-opacity=".5" stroke-width="1"/>
${[[70,99,8],[92,103,6],[150,101,7],[286,95,6]].map(([x,y,r],i)=>`<path d="M${x} ${y}l${r} -1.2A${r} ${f(r*.4)} 0 1 1 ${x} ${f(y-r*.4)}Z" fill="${c(i%2?'#8fbe86':'#78a97a')}"/>`).join('')}
<circle cx="74" cy="97" r="2.4" fill="${c('#f2b8c6')}"/><circle cx="74" cy="97" r="1" fill="${c('#fff3dc')}"/>
<path d="M128 112l8-3 6 2-1 5-9 1Z" fill="${c('#8fbe86')}"/><path d="M134 110q-4-6 0-10 2 4 2 6 2-3 4-6 3 6-2 10Z" fill="${c('#f2b8c6')}"/><path d="M135 106q1-3 2-5" stroke="#fff3dc" stroke-opacity=".7" stroke-width="1" stroke-linecap="round" fill="none"/>
${reeds(26,118,1.5)}${reeds(108,110,.9)}${reeds(268,116,1.5)}${reeds(306,106,.9)}
<g fill="url(#${k.id}-ff)" opacity="${dark?1:.5}">${[...flies,...trail].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${dark?6:4}" opacity="${f(.55+jitter(i,5)*.45)}"/>`).join('')}</g>
<g fill="${g(dark?'#f7ec9f':'#fff8c8')}">${[...flies,...trail].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i<flies.length?1.2:1}"/>`).join('')}</g>`;
}

/* 赤晶峡谷：两侧是有层理的红岩峭壁，谷底的热泉冒着蒸汽，木渠从右侧引水；红色晶簇长在岩脚，夜里透出微光。 */
function canyon(k:Ink):string {
 const {c,g,dark}=k;
 const crystal=(x:number,y:number,s:number,a:number)=>`<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})"><path d="M-4 0L-5-7L-1-20L3-22L5-7L4 0Z" fill="${c('#d06a72')}"/><path d="M-1-20L3-22L5-7L4 0L0 0Z" fill="${c('#a84e62')}"/><path d="M-3.5-7L-1-18" stroke="${g('#ffd4d0')}" stroke-width="1.2" stroke-linecap="round" opacity=".8"/></g>`;
 const cluster=(x:number,y:number,s:number)=>(dark?`<circle cx="${x}" cy="${y-8*s}" r="${18*s}" fill="url(#${k.id}-cr)"/>`:'')+crystal(x-6*s,y,.7*s,-22)+crystal(x+7*s,y,.6*s,24)+crystal(x,y+1,s,0);
 return `<path d="M0 74L22 62Q26 58 34 58H54Q60 58 64 64L76 72L96 60Q100 56 108 56H124Q130 56 134 62L148 74H186L204 62Q208 58 216 58H234Q240 58 244 64L262 76L280 66Q284 60 292 60H320V120H0Z" fill="${c('#dcb3a6',.5)}"/>
<path d="M0 96Q160 82 320 96V120H0Z" fill="${c('#d9ab8c')}"/>
<path d="M0 26L34 30L50 48L60 78L72 120H0Z" fill="${c('#b8826e')}"/>
<path d="M34 30L50 48L60 78L72 120H50L46 84L38 54L26 34Z" fill="${c('#96645a')}"/>
<path d="M0 46L30 50M0 66L42 70M2 88L50 92M4 106L58 108" stroke="${c('#d6a088')}" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
<path d="M320 20L284 26L264 46L254 82L242 120H320Z" fill="${c('#b07a68')}"/>
<path d="M284 26L264 46L254 82L242 120H262L268 86L276 52L292 30Z" fill="${c('#d09a80')}"/>
<path d="M320 42L282 46M320 62L268 66M320 84L262 88M320 104L256 106" stroke="${c('#8e5e54')}" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
<path d="M262 74L226 92" stroke="${c(PAL.woodDark)}" stroke-width="4" stroke-linecap="round"/><path d="M262 72L226 90" stroke="${c(PAL.wood)}" stroke-width="2.2" stroke-linecap="round"/><path d="M240 86v14M254 79v18" stroke="${c(PAL.woodDark)}" stroke-width="1.6"/>
<ellipse cx="166" cy="103" rx="44" ry="10" fill="${c('#e8ccb2')}"/>
<ellipse cx="166" cy="102" rx="38" ry="7.5" fill="${c('#7cc0c8')}"/>
<ellipse cx="166" cy="101" rx="34" ry="5.5" fill="${c('#a6dcd8')}"/>
<path d="M146 100q10-2 18 0M176 102q8-2 14 0" stroke="${g(PAL.foam)}" stroke-opacity=".8" stroke-width="1.2" stroke-linecap="round" fill="none"/>
<path d="M226 92q-6 4-14 6" stroke="${g('#a6dcd8')}" stroke-width="1.6" stroke-linecap="round" fill="none"/>
<g stroke="${g('#fff8f2')}" stroke-linecap="round" fill="none" opacity="${dark?.55:.8}"><path d="M150 96q-6-8 0-16t0-16" stroke-width="3"/><path d="M168 94q6-9 0-18t2-18" stroke-width="3.6"/><path d="M186 96q-5-7 0-14t0-12" stroke-width="2.6"/></g>
${cluster(72,104,1.1)}${cluster(244,100,.9)}${cluster(118,112,.6)}${cluster(28,116,.7)}`;
}

/* 霜铃雪原：远山雪顶，两根木桩之间的绳上挂着金色铃铛，脚印通向铃铛；雪松和飘雪。 */
function snowfield(k:Ink):string {
 const {c,g,dark}=k;
 const pine=(x:number,y:number,s:number,far=0)=>`<path d="M${x} ${f(y-30*s)}L${f(x+8*s)} ${f(y-16*s)}H${f(x+4*s)}L${f(x+11*s)} ${f(y-4*s)}H${f(x-11*s)}L${f(x-4*s)} ${f(y-16*s)}H${f(x-8*s)}Z" fill="${c('#5f8a8a',far)}"/><path d="M${x} ${f(y-30*s)}L${f(x+4*s)} ${f(y-23*s)}Q${x} ${f(y-21*s)} ${f(x-4*s)} ${f(y-23*s)}ZM${f(x-8*s)} ${f(y-12*s)}Q${x} ${f(y-8*s)} ${f(x+8*s)} ${f(y-12*s)}L${f(x+9.5*s)} ${f(y-8*s)}Q${x} ${f(y-4*s)} ${f(x-9.5*s)} ${f(y-8*s)}Z" fill="${c('#f4f8fc',far)}"/><path d="M${x} ${f(y-4*s)}v${f(4*s)}" stroke="${c(PAL.woodDark,far)}" stroke-width="${f(2*s)}"/>`;
 const bell=(x:number,y:number,len:number,s:number)=>`<path d="M${x} ${y}v${len}" stroke="${c(PAL.woodDark)}" stroke-width=".8"/><path d="M${f(x-4.5*s)} ${f(y+len+8*s)}Q${f(x-4*s)} ${y+len} ${x} ${y+len}Q${f(x+4*s)} ${y+len} ${f(x+4.5*s)} ${f(y+len+8*s)}Z" fill="${c('#e6c070')}"/><path d="M${f(x-5*s)} ${f(y+len+8*s)}H${f(x+5*s)}" stroke="${c('#c49a52')}" stroke-width="${f(1.4*s)}" stroke-linecap="round"/><circle cx="${x}" cy="${f(y+len+9.4*s)}" r="${f(1.3*s)}" fill="${c('#a8803e')}"/><path d="M${f(x-2*s)} ${f(y+len+6*s)}Q${f(x-2*s)} ${f(y+len+2*s)} ${x} ${f(y+len+1.6*s)}" stroke="${g('#fff6d8')}" stroke-width="1" stroke-linecap="round" fill="none" opacity="${dark?.95:.75}"/>`;
 const rope='M128 52Q170 74 212 50';
 const rp=(t:number):[number,number]=>[f((1-t)**2*128+2*(1-t)*t*170+t*t*212),f((1-t)**2*52+2*(1-t)*t*74+t*t*50)];
 const bells=[[.2,3,.9],[.4,6,1.15],[.62,4,1],[.82,2,.85]].map(([t,len,s])=>{const [x,y]=rp(t);return bell(x,y,len,s);}).join('');
 return `<path d="M0 74L36 44L58 60L96 32L132 62L170 46L206 66L246 36L282 58L320 42V120H0Z" fill="${c('#a4b8d8',.3)}"/>
<path d="M36 44L46 52L40 54L30 50ZM96 32L108 44L100 46L92 42L84 44ZM246 36L258 46L250 48L242 44L234 46ZM320 42L310 50L304 48Z" fill="${c('#f6f8fc',.3)}"/>
${pine(20,82,.9,.2)}${pine(44,84,.7,.2)}${pine(286,80,.8,.2)}
<path d="M0 82Q80 70 170 80T320 76V120H0Z" fill="${c('#e4ecf4')}"/>
<path d="M0 100Q100 88 200 98T320 94V120H0Z" fill="${c('#f6f9fc')}"/>
<path d="M0 100Q100 88 200 98T320 94" stroke="${c('#c9d9ea')}" stroke-width="2" fill="none"/>
<path d="M120 96q30-6 60 0M220 104q24-4 44 0" stroke="${c('#d4e2ee')}" stroke-width="3" stroke-linecap="round" fill="none"/>
${[[86,116],[96,111],[104,106],[114,101],[122,96],[132,92],[140,88]].map(([x,y],i)=>`<ellipse cx="${x+(i%2?3:-3)}" cy="${y}" rx="2.2" ry="1.1" fill="${c('#b8cce0')}"/>`).join('')}
<path d="M128 88V48M212 86V46" stroke="${c(PAL.woodDark)}" stroke-width="3.4" stroke-linecap="round"/>
<path d="M124.6 48q3.4-4 6.8 0ZM208.6 46q3.4-4 6.8 0Z" fill="${c('#f6f9fc')}"/>
<path d="${rope}" stroke="${c(PAL.wood)}" stroke-width="1.4" fill="none"/>
${bells}
${pine(250,98,1.1)}${pine(270,104,.8)}${pine(64,104,.9)}
<g fill="${g('#ffffff')}">${Array.from({length:22},(_,i)=>`<circle cx="${f(6+jitter(i,8)*308)}" cy="${f(8+jitter(i,9)*100)}" r="${f(.6+jitter(i,10)*.9)}" opacity="${f(dark?.45+jitter(i,6)*.4:.7+jitter(i,6)*.3)}"/>`).join('')}</g>`;
}

/* 星落遗迹：断裂的石拱和残柱，柱上刻着发光的符文，地面有观测圆环；流星从右上方落下，地上散着星屑。 */
function ruins(k:Ink):string {
 const {c,g,dark}=k,st=PAL.stone,sd=PAL.stoneDark;
 // 拱圈：圆心 (157,56)，外半径 37、内半径 23，从左侧 180° 画到约 20° 处断开，与右侧残柱之间留一道裂口。
 const arc=(r:number,a:number)=>{const t=a*Math.PI/180;return `${f(157+r*Math.cos(t))} ${f(56-r*Math.sin(t))}`;};
 const arch=`M${arc(37,180)}A37 37 0 0 1 ${arc(37,24)}L${arc(32,17)}L${arc(28,22)}L${arc(23,15)}A23 23 0 0 0 ${arc(23,180)}Z`;
 const fall=[[214,6,30],[62,10,22],[300,30,18]];
 return `${[[14,40,.42],[278,62,.3]].map(([x,y,s])=>`<g transform="translate(${x} ${y}) scale(${s} ${f(s*.7)})"><path d="M0 14C8 6 22 3 36 5C48 1 64 2 76 6C88 4 97 9 100 14C93 22 83 27 76 35C68 47 59 59 51 70C44 58 37 47 28 39C18 31 7 24 0 14Z" fill="${c('#6e6496',.3)}"/><path d="M0 14C8 6 22 3 36 5C48 1 64 2 76 6C88 4 97 9 100 14C86 18 70 16 50 18C30 16 13 18 0 14Z" fill="${c('#9cc4a2',.3)}"/></g>`).join('')}
${fall.map(([x,y,l],i)=>`<path d="M${x-l} ${y-l*.55}L${x} ${y}" stroke="url(#${k.id}-fs)" stroke-width="${i?1.4:1.8}" stroke-linecap="round"/>${spark(x,y,i?2.6:3.4,g(PAL.star),dark?1:.85)}`).join('')}
<path d="M0 78Q60 70 120 76T240 72T320 76V120H0Z" fill="${c('#b4acd4',.35)}"/>
<path d="M0 90Q90 80 180 88T320 84V120H0Z" fill="${c('#9a93c0')}"/>
<path d="M0 106Q100 98 200 104T320 102V120H0Z" fill="${c('#8a83b2')}"/>
<ellipse cx="160" cy="100" rx="46" ry="8" fill="none" stroke="${g('#cbbaff')}" stroke-width="1.4" opacity="${dark?.75:.5}"/>
<ellipse cx="160" cy="100" rx="30" ry="5" fill="none" stroke="${g('#cbbaff')}" stroke-width="1" stroke-dasharray="3 4" opacity="${dark?.7:.45}"/>
<path d="M118 96V56H134V96Z" fill="${c(st)}"/><path d="M130 56H134V96H130Z" fill="${c(sd)}"/>
<path d="M115 56H137V51H115Z" fill="${c(mix(st,'#ffffff',.2))}"/>
<path d="${arch}" fill="${c(st)}"/>
<path d="${arch}" fill="none" stroke="#fff3dc" stroke-opacity=".35" stroke-width="1"/>
<path d="M180 96V60L184 56L187 61L192 54L196 58V96Z" fill="${c(st)}"/><path d="M192 54L196 58V96H192Z" fill="${c(sd)}"/><path d="M184 50l5-2 2 4-5 2Z" fill="${c(st)}"/>
<path d="M124 66l2-4 2 4-2 4ZM126 74v8M123 78h6" stroke="${g('#d8ccff')}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${dark?1:.75}"/>
${dark?`<circle cx="126" cy="72" r="12" fill="url(#${k.id}-gl)"/>`:''}
<path d="M200 98l12-3 8 4-10 4Z" fill="${c(st)}"/><path d="M200 98l10 5v3l-10-5Z" fill="${c(sd)}"/>
<path d="M98 100l10-6 9 3-8 6Z" fill="${c(sd)}"/>
<path d="M254 92V62H266V92Z" fill="${c(st,.15)}"/><path d="M262 62H266V92H262Z" fill="${c(sd,.15)}"/><path d="M251 62H269V57H251Z" fill="${c(mix(st,'#ffffff',.2),.15)}"/>
<path d="M44 96V76L48 72L52 76V96Z" fill="${c(st,.15)}"/>
<path d="M116 92q4-5 9-2M182 90q4-4 8-1" stroke="${c(PAL.leaf)}" stroke-width="2" stroke-linecap="round" fill="none"/>
${[[84,108,2],[236,110,1.6],[176,114,1.4],[30,112,1.8],[292,106,1.5],[140,110,1.2]].map(([x,y,r])=>(dark?`<circle cx="${x}" cy="${y}" r="${r*3}" fill="url(#${k.id}-gl)"/>`:'')+spark(x,y,r,g(PAL.star),dark?1:.8)).join('')}`;
}

const SCENES=[meadow,forest,wetland,canyon,snowfield,ruins];

/** 远行页地区卡片插画。unlocked=false 时是雾中剪影；dark=true 时是夜景并显示双月。 */
export function regionArt(id:number,unlocked:boolean,dark:boolean):string {
 const z=Math.max(0,Math.min(5,Math.floor(id)||0)),gid='rg'+(++seq),locked=!unlocked;
 const [top,mid,bottom]=SKIES[z],haze=dark?mix(NIGHT[1],bottom,.18):bottom,veil=dark?'#3b3668':'#9993bb';
 const fog=(x:string,t:number)=>mix(mix(x,grey(x),.72),veil,t);
 const ink:Ink={dark,locked,id:gid,
  c:(x,far=0)=>{const y=dusk(mix(x,haze,far),dark);return locked?fog(y,.32):y;},
  g:x=>locked?fog(x,.45):x};
 const sky=dark?[NIGHT[0],NIGHT[1],mix(NIGHT[1],bottom,.18)]:[top,mid,bottom];
 const s=(x:string)=>locked?fog(x,.3):x;
 const defs=`<defs><linearGradient id="${gid}-s" x2="0" y2="1"><stop stop-color="${s(sky[0])}"/><stop offset=".6" stop-color="${s(sky[1])}"/><stop offset="1" stop-color="${s(sky[2])}"/></linearGradient>
<radialGradient id="${gid}-h"><stop stop-color="${ink.g('#f2d9a6')}" stop-opacity=".38"/><stop offset="1" stop-color="${ink.g('#f2d9a6')}" stop-opacity="0"/></radialGradient>
<radialGradient id="${gid}-w"><stop stop-color="#ffe3a0" stop-opacity="${locked?.25:.7}"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
<radialGradient id="${gid}-gl"><stop stop-color="#cbbaff" stop-opacity="${locked?.2:.6}"/><stop offset="1" stop-color="#cbbaff" stop-opacity="0"/></radialGradient>
<radialGradient id="${gid}-ff"><stop stop-color="${ink.g('#f4f09a')}" stop-opacity=".75"/><stop offset="1" stop-color="${ink.g('#d8f09a')}" stop-opacity="0"/></radialGradient>
<radialGradient id="${gid}-cr"><stop stop-color="#ff9aa0" stop-opacity="${locked?.12:.5}"/><stop offset="1" stop-color="#ff9aa0" stop-opacity="0"/></radialGradient>
<linearGradient id="${gid}-fs"><stop stop-color="${ink.g(PAL.star)}" stop-opacity="0"/><stop offset="1" stop-color="${ink.g(PAL.star)}" stop-opacity="${dark?.95:.8}"/></linearGradient>
${locked?`<linearGradient id="${gid}-m" x2="0" y2="1"><stop stop-color="${veil}" stop-opacity=".1"/><stop offset=".55" stop-color="${veil}" stop-opacity=".3"/><stop offset="1" stop-color="${veil}" stop-opacity=".5"/></linearGradient>`:''}</defs>`;
 const mist=locked?`<rect width="320" height="120" fill="url(#${gid}-m)"/><g fill="${dark?'#4a4478':'#d4d0e6'}" opacity="${dark?.5:.4}"><ellipse cx="70" cy="88" rx="90" ry="9"/><ellipse cx="250" cy="100" rx="100" ry="10"/><ellipse cx="170" cy="70" rx="70" ry="6"/></g>`:'';
 return `<svg class="lw-region-art" viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${defs}<rect width="320" height="120" fill="url(#${gid}-s)"/>${stars(ink,18)}${moons(ink)}${SCENES[z](ink)}${mist}</svg>`;
}

/* ---------- 家园地面点缀 ---------- */
type Prop=(x:number,y:number,n:number,dark:boolean)=>string;
const at=(x:number,y:number)=>`${f(x)} ${f(y)}`;
const d=dusk;
/* 每个区域两到三种小物件；坐标 (x,y) 是物件落地点，物件向上不超过 9 像素。 */
const PROPS:Prop[][]=[
 [
  (x,y,_n,k)=>tuft(x,y,1.2,d('#6f9a6a',k))+tuft(x+5,y+2,.9,d('#86ad7d',k)),
  (x,y,n,k)=>tuft(x,y,1,d('#6f9a6a',k))+[[-3,-6],[3,-5]].map(([a,b],i)=>`<circle cx="${f(x+a)}" cy="${f(y+b)}" r="1.6" fill="${d(['#f2b8c6','#f6dd8a','#fff4e6'][(n+i)%3],k)}"/>`).join('')+`<circle cx="${f(x-3)}" cy="${f(y-6)}" r=".6" fill="${d('#e2ad73',k)}"/>`,
  (x,y,_n,k)=>`<g fill="${d('#7fae74',k)}"><circle cx="${f(x-1.6)}" cy="${f(y-1)}" r="1.7"/><circle cx="${f(x+1.6)}" cy="${f(y-1)}" r="1.7"/><circle cx="${x}" cy="${f(y-2.8)}" r="1.7"/></g><circle cx="${f(x+.6)}" cy="${f(y-3.4)}" r=".7" fill="#ffffff" opacity="${k?.45:.85}"/>`
 ],
 [
  (x,y,n,k)=>{const s=n%2?1:-1;return `<path d="M${at(x,y)}q${4*s} -7 ${10*s} -8M${at(x+3*s,y-3.5)}l${-1*s} -3M${at(x+6*s,y-6)}l${-.5*s} -3M${at(x+3*s,y-3.5)}l${3*s} 1M${at(x+6*s,y-6)}l${3*s} .6" stroke="${d('#5f8a6a',k)}" stroke-width="1.3" stroke-linecap="round" fill="none"/><path d="M${at(x,y)}q${-3*s} -5 ${-7*s} -6" stroke="${d('#7aa57e',k)}" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;},
  (x,y,n,k)=>[[-4,0,30,'#d99a5b'],[2,1.5,-25,'#c9a25a'],[5,-2,70,'#c97a5a']].map(([a,b,r,col])=>`<ellipse cx="${f(x+(a as number))}" cy="${f(y+(b as number))}" rx="2.6" ry="1.2" fill="${d(col as string,k)}" transform="rotate(${(r as number)+n%3*15} ${f(x+(a as number))} ${f(y+(b as number))})"/>`).join('')+`<path d="M${at(x-6,y+2)}l7 -2" stroke="${d('#8a6a4f',k)}" stroke-width="1" stroke-linecap="round"/>`,
  (x,y,_n,k)=>`<path d="M${at(x-.8,y)}v-3h1.6v3Z" fill="${d('#efe2c6',k)}"/><path d="M${at(x-3.4,y-2.6)}q3.4-5 6.8 0Z" fill="${k?'#b8d8ff':'#d9876a'}" opacity="${k?.9:1}"/><circle cx="${f(x+3.5)}" cy="${f(y+.5)}" r="1.4" fill="${d('#c97a6a',k)}"/>`
 ],
 [
  (x,y,_n,k)=>`<path d="M${at(x-2,y)}q-1-6-3-9M${at(x,y)}q0-6 1-10M${at(x+2,y)}q1-5 4-8" stroke="${d('#6f9a7a',k)}" stroke-width="1.2" stroke-linecap="round" fill="none"/><ellipse cx="${f(x+.6)}" cy="${f(y-8)}" rx="1.1" ry="2.2" fill="${d('#9a7656',k)}"/><ellipse cx="${f(x-4.6)}" cy="${f(y-7)}" rx="1" ry="2" fill="${d('#8a6a4f',k)}"/>`,
  (x,y,_n,k)=>`<ellipse cx="${x}" cy="${f(y+.6)}" rx="9" ry="3.6" fill="${d('#6a8f7c',k)}" opacity=".7"/><ellipse cx="${x}" cy="${y}" rx="8" ry="3" fill="${d(PAL.water,k)}"/><path d="M${at(x-4,y-.6)}q3-1.4 6 0" stroke="${k?'#f6e3b4':PAL.foam}" stroke-width="1" stroke-linecap="round" fill="none" opacity=".8"/>`
 ],
 [
  (x,y,n,k)=>[[-3,0,2.2,'#b8705c'],[2,1,1.6,'#d08a6a'],[4,-1.6,1.2,'#9a5a50']].map(([a,b,r,col])=>`<ellipse cx="${f(x+(a as number))}" cy="${f(y+(b as number))}" rx="${r}" ry="${f((r as number)*.65)}" fill="${d(col as string,k)}"/>`).join('')+`<ellipse cx="${f(x-3.6)}" cy="${f(y-.6)}" rx=".9" ry=".5" fill="#fff3dc" opacity="${n%2?.5:.35}"/>`,
  (x,y,_n,k)=>(k?`<circle cx="${x}" cy="${f(y-4)}" r="7" fill="#ff9aa0" opacity=".18"/>`:'')+`<path d="M${at(x-2,y)}l-1-4 1.6-5 2 .4.6 4.6-.6 4Z" fill="${d('#d06a72',k)}"/><path d="M${at(x+1,y)}l1-3.4 2.4-2.6 1 .6-.8 3-1.6 2.4Z" fill="${d('#a84e62',k)}"/><path d="M${at(x-1.6,y-4)}l.8-3.6" stroke="#ffd4d0" stroke-width=".9" stroke-linecap="round" opacity=".85"/>`
 ],
 [
  (x,y,_n,k)=>`<ellipse cx="${f(x+1)}" cy="${f(y+.8)}" rx="7" ry="2.4" fill="${d('#b8cce0',k)}"/><path d="M${at(x-6,y)}q2-5 6-5t6 5Z" fill="${d('#f4f8fc',k)}"/><path d="M${at(x-3,y-3)}q2-1.6 4-1.4" stroke="#ffffff" stroke-width="1" stroke-linecap="round" fill="none" opacity=".9"/>`,
  (x,y,_n,k)=>`<path d="M${at(x,y)}v-8M${at(x,y-3)}l-3-2.4M${at(x,y-5.4)}l2.8-2.2M${at(x,y-2)}l2.6-1" stroke="${d('#9cbcd2',k)}" stroke-width="1.1" stroke-linecap="round" fill="none"/><g fill="#ffffff" opacity="${k?.75:.9}"><circle cx="${f(x-3)}" cy="${f(y-5.4)}" r=".9"/><circle cx="${f(x+2.8)}" cy="${f(y-7.6)}" r=".9"/><circle cx="${x}" cy="${f(y-8.4)}" r="1"/></g>`
 ],
 [
  (x,y,n,k)=>`<path d="M${at(x-4,y+1)}v-5q0-3 4-3t4 3v5Z" fill="${d('#8c85a6',k)}"/><path d="M${at(x+2,y+1)}v-6q0-1.4 1.6-1.6l.4 7.6Z" fill="${d('#6e6890',k)}"/><path d="${n%2?`M${at(x-1.6,y-4)}l1.6-2 1.6 2-1.6 2Z`:`M${at(x-1.4,y-5)}h2.8M${at(x,y-5)}v3.4`}" stroke="${k?'#e4dcff':'#efe6ff'}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M${at(x-4,y+1)}q2-2 4-.6" stroke="${d(PAL.leaf,k)}" stroke-width="1.2" stroke-linecap="round" fill="none"/>`,
  (x,y,n,k)=>[[0,-2,2],[-5,1,1.3],[4.5,1.6,1.1]].map(([a,b,r],i)=>(k&&!i?`<circle cx="${f(x+a)}" cy="${f(y+b)}" r="6" fill="#fff6c8" opacity=".2"/>`:'')+spark(f(x+a),f(y+b),r+(n%2)*.3,k?PAL.star:'#fff0a8',1)).join('')
 ]
];

/** 家园地面点缀：在该区域 14–20 个空格子上放小物件，位置由格子编号决定，每次重绘相同。free(n) 判断格子 n=y*12+x 是否为空。 */
export function zoneDressing(zone:number,free:(cell:number)=>boolean,dark:boolean):string {
 const z=Math.max(0,Math.min(5,Math.floor(zone)||0)),props=PROPS[z];
 const cells=Array.from({length:144},(_,n)=>n).filter(free).sort((a,b)=>jitter(a,z*13+1)-jitter(b,z*13+1));
 const want=14+Math.floor(jitter(z,5)*7),picked:number[]=[];
 // 先挑互不相邻的格子让点缀散开；空地太少时再放宽到相邻格子。
 for(const n of cells){if(picked.length>=want)break;if(!picked.some(m=>Math.abs(m%12-n%12)<=1&&Math.abs(Math.floor(m/12)-Math.floor(n/12))<=1))picked.push(n);}
 for(const n of cells){if(picked.length>=want)break;if(!picked.includes(n))picked.push(n);}
 // 按 x+y 从后往前排序，前面的物件盖住后面的。
 picked.sort((a,b)=>(a%12+Math.floor(a/12))-(b%12+Math.floor(b/12)));
 const art=picked.map(n=>{
  const x=n%12,y=Math.floor(n/12),cx=300+(x-y)*23,cy=77+(x+y)*15;
  // 落地点在格子中心偏下，向上画的物件顶部仍在格子范围内（中心上方 8 像素以内）。
  const ox=(jitter(n,z+31)-.5)*14,oy=1+jitter(n,z+37)*3.5;
  return props[Math.floor(jitter(n,z+41)*props.length)](cx+ox,cy+oy,n,dark);
 }).join('');
 return `<g class="lw-dressing" pointer-events="none">${art}</g>`;
}
