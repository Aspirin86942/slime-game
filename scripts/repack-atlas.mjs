// 把排得过紧、互相粘连的生成图集拆成独立物件，再按规整网格重新排布（每格四周留透明边）。
// 用法：node scripts/repack-atlas.mjs <sharp所在node_modules> <输入png> <物件数> <列数> <输出png> [提示矩形JSON]
// 仅用于离线制作素材；生成记录见 docs/art-2026-10-29/production/estate-art-generation.json。
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const [mods,file,countArg,colsArg,out,hintArg]=process.argv.slice(2);
// 人工分界提示：[[x1,y1,x2,y2,px,py],...]，矩形内像素归属于 (px,py) 所在的物件，用于两件物件实心接触的地方。
const hints=hintArg?JSON.parse(hintArg):[];const count=Number(countArg),cols=Number(colsArg);
const sharp=createRequire(import.meta.url)(resolve(mods,'sharp'));
const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height,N=W*H,alpha=i=>data[i*4+3];
// 1. 腐蚀：距离透明区超过 r 的像素才算核心，细小的粘连处会断开。
function cores(r){
 const solid=new Uint8Array(N);for(let i=0;i<N;i++)solid[i]=alpha(i)>=40?1:0;
 // 曼哈顿距离变换（两遍扫描）
 const d=new Int32Array(N);for(let i=0;i<N;i++)d[i]=solid[i]?1e6:0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!d[i])continue;if(x>0)d[i]=Math.min(d[i],d[i-1]+1);if(y>0)d[i]=Math.min(d[i],d[i-W]+1);if(x===0||y===0)d[i]=Math.min(d[i],1);}
 for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){const i=y*W+x;if(!d[i])continue;if(x<W-1)d[i]=Math.min(d[i],d[i+1]+1);if(y<H-1)d[i]=Math.min(d[i],d[i+W]+1);}
 const label=new Int32Array(N).fill(-1),blobs=[];
 for(let i=0;i<N;i++){if(d[i]<=r||label[i]>=0)continue;const id=blobs.length,stack=[i];label[i]=id;let area=0;
  while(stack.length){const n=stack.pop();area++;const x=n%W;for(const m of [x>0?n-1:-1,x<W-1?n+1:-1,n-W,n+W]){if(m<0||m>=N||d[m]<=r||label[m]>=0)continue;label[m]=id;stack.push(m);}}
  blobs.push({id,area});}
 return {label,blobs};
}
let picked=null;
for(const r of [4,8,12,16,20,26,32]){const c=cores(r),big=c.blobs.filter(b=>b.area>800).sort((a,b)=>b.area-a.area);
 if(big.length===count){picked={...c,big,r};break;}
 // 核心数超过时取最大的 count 个，剩余的小核心会在扩散阶段并入相邻物件。
 if(big.length>count&&big[count-1].area>4*big[count].area){picked={...c,big:big.slice(0,count),r};break;}}
if(!picked){console.error('无法分离出',count,'个物件');process.exit(1);}
// 2. 多源加权扩散（Dijkstra，桶队列）：穿过半透明边缘代价高，分界线落在物件之间的柔边上，不会切进实心部位。
const owner=new Int32Array(N).fill(-1),keep=new Map(picked.big.map((b,k)=>[b.id,k])),dist=new Int32Array(N).fill(2**30);
const cost=i=>{const a=alpha(i)/255;return 1+Math.round(60*(1-a)*(1-a));};
const buckets=[];const push=(i,d)=>{(buckets[d]??=[]).push(i);};
for(let i=0;i<N;i++){const k=keep.get(picked.label[i]);if(k!==undefined){owner[i]=k;dist[i]=0;push(i,0);}}
for(const [x1,y1,x2,y2,px,py] of hints){let k=-1,best=1e18;for(let i=0;i<N;i++){if(owner[i]<0)continue;const x=i%W,y=(i-x)/W,d=(x-px)**2+(y-py)**2;if(d<best){best=d;k=owner[i];}}
 for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++){const i=y*W+x;if(alpha(i)===0)continue;owner[i]=k;dist[i]=0;push(i,0);}}
for(let d=0;d<buckets.length;d++){const list=buckets[d];if(!list)continue;for(const n of list){if(dist[n]!==d)continue;const x=n%W;for(const m of [x>0?n-1:-1,x<W-1?n+1:-1,n-W,n+W]){if(m<0||m>=N||alpha(m)===0)continue;const nd=d+cost(m);if(nd<dist[m]){dist[m]=nd;owner[m]=owner[n];push(m,nd);}}}buckets[d]=null;}
// 断开的小碎片：同一物件内与主体不相连（不透明像素 4 连通）且面积很小的部分，改归与它接触最多的相邻物件。
{const seen=new Uint8Array(N);const parts=[];
 for(let i=0;i<N;i++){if(seen[i]||owner[i]<0||alpha(i)<18)continue;const k=owner[i],list=[i];seen[i]=1;for(let q=0;q<list.length;q++){const n=list[q],x=n%W;for(const m of [x>0?n-1:-1,x<W-1?n+1:-1,n-W,n+W]){if(m<0||m>=N||seen[m]||owner[m]!==k||alpha(m)<18)continue;seen[m]=1;list.push(m);}}parts.push({k,list});}
 const main=new Map();for(const p of parts)if(!main.has(p.k)||main.get(p.k).list.length<p.list.length)main.set(p.k,p);
 for(const p of parts){if(main.get(p.k)===p||p.list.length>0.05*main.get(p.k).list.length)continue;const votes=new Map();
  for(const n of p.list){const x=n%W,y=(n-x)/W;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=W||yy>=H)continue;const o=owner[yy*W+xx];if(o>=0&&o!==p.k&&alpha(yy*W+xx)>=18)votes.set(o,(votes.get(o)??0)+1);}}
  const best=[...votes.entries()].sort((a,b)=>b[1]-a[1])[0];if(best)for(const n of p.list)owner[n]=best[0];}
 // 碎片周围的半透明柔边跟随碎片归属。
 for(let i=0;i<N;i++){if(owner[i]<0||alpha(i)>=18)continue;const x=i%W;for(const m of [x>0?i-1:-1,x<W-1?i+1:-1,i-W,i+W])if(m>=0&&m<N&&alpha(m)>=18&&owner[m]>=0&&owner[m]!==owner[i]){owner[i]=owner[m];break;}}
}
// 孤立的小碎片（火花、星尘）并给距离最近的物件。
const box=Array.from({length:count},()=>({x1:W,y1:H,x2:0,y2:0,sx:0,sy:0,n:0}));
for(let i=0;i<N;i++)if(owner[i]>=0){const b=box[owner[i]],x=i%W,y=(i-x)/W;b.sx+=x;b.sy+=y;b.n++;}
box.forEach(b=>{b.cx=b.sx/b.n;b.cy=b.sy/b.n;});
for(let i=0;i<N;i++)if(owner[i]<0&&alpha(i)>0){const x=i%W,y=(i-x)/W;let best=0,dist=1e18;box.forEach((b,k)=>{const dd=(b.cx-x)**2+(b.cy-y)**2;if(dd<dist){dist=dd;best=k;}});owner[i]=best;}
for(let i=0;i<N;i++)if(owner[i]>=0&&alpha(i)>=18){const b=box[owner[i]],x=i%W,y=(i-x)/W;b.x1=Math.min(b.x1,x);b.y1=Math.min(b.y1,y);b.x2=Math.max(b.x2,x);b.y2=Math.max(b.y2,y);}
// 3. 阅读顺序：按中心 y 分行，行内按 x。
const order=box.map((b,k)=>k).sort((a,b)=>box[a].cy-box[b].cy),rows=[];for(let i=0;i<order.length;i+=cols)rows.push(order.slice(i,i+cols).sort((a,b)=>box[a].cx-box[b].cx));
const ordered=rows.flat();
// 4. 重新排布：格子取最大物件尺寸再四周各留 12% 透明边，物件底边对齐格子底部留白处，水平居中。
const cw=Math.max(...box.map(b=>b.x2-b.x1+1)),ch=Math.max(...box.map(b=>b.y2-b.y1+1)),cell=Math.ceil(Math.max(cw,ch)/0.76);
const rowsN=Math.ceil(count/cols),OW=cell*cols,OH=cell*rowsN,canvas=Buffer.alloc(OW*OH*4);
ordered.forEach((k,slot)=>{const b=box[k],c=slot%cols,r=Math.floor(slot/cols),w=b.x2-b.x1+1,h=b.y2-b.y1+1,ox=c*cell+Math.round((cell-w)/2),oy=r*cell+Math.round(cell*0.88)-h;
 for(let y=b.y1;y<=b.y2;y++)for(let x=b.x1;x<=b.x2;x++){const i=y*W+x;if(owner[i]!==k)continue;const o=((oy+y-b.y1)*OW+ox+x-b.x1)*4;data.copy(canvas,o,i*4,i*4+4);}
});
await sharp(canvas,{raw:{width:OW,height:OH,channels:4}}).png({compressionLevel:9}).toFile(out);
console.log(JSON.stringify({file,erosion:picked.r,out,size:[OW,OH],cell,objects:ordered.map(k=>[box[k].x2-box[k].x1+1,box[k].y2-box[k].y1+1])}));
