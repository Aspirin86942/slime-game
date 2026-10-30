import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUILDINGS,DECORATIONS,PLANTS} from '../src/world/content.ts';
const manifest=JSON.parse(readFileSync(new URL('../src/assets/storybook/manifest.json',import.meta.url),'utf8'));
globalThis.__HOME_ART__=Object.fromEntries(Object.entries(manifest).map(([key,value])=>[key,{...value,image:'data:image/webp;base64,'}]));
const {objectFrame,plantFrame,paintedPlant,paintedObject,natureArt,GROWN_FACILITIES,grownFrame}=await import('../src/world/art/storybook.ts');
import {dayPhase,night,season,springThaw} from '../src/world/ecology.ts';
test('every facility, decoration and plant resolves to a real, bounded painted sprite',()=>{
 const grown=GROWN_FACILITIES.flatMap(id=>[2,3].map(form=>{const ref=objectFrame(id,form);assert.deepEqual(ref,grownFrame(id,form),`${id} form ${form} must use its own artwork`);return ref;}));
 assert.equal(new Set(grown.map(ref=>ref.join('/'))).size,48);
 for(const [sheet,index] of grown){const file=readFileSync(new URL(`../src/assets/storybook/${sheet}-${index}.webp`,import.meta.url));assert.equal(file.toString('ascii',0,4),'RIFF');assert.equal(file.toString('ascii',8,12),'WEBP');}
 const frames=[...BUILDINGS.map(d=>objectFrame(d.id)),...grown,...DECORATIONS.filter(d=>d.group>0).map(d=>objectFrame(d.id)),...PLANTS.map(plantFrame)];
 for(const ref of frames){assert.ok(ref);const [sheet,index]=ref,atlas=manifest[sheet],frame=atlas?.frames[index];assert.ok(frame,`${sheet}/${index}`);const [x,y,w,h]=frame;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=atlas.width&&y+h<=atlas.height,`${sheet}/${index} outside sheet`);}
 assert.equal(new Set(BUILDINGS.map(d=>objectFrame(d.id).join('/'))).size,32);
 // 6 座资源建筑的 1–3 级各自有独立素材，共 18 张。
 const estate=['quarry','mine','apiary','spring','warehouse','market'].flatMap(id=>[1,2,3].map(form=>objectFrame(id,form).join('/')));
 assert.equal(new Set(estate).size,18);for(const ref of estate)assert.ok(manifest[ref.split('/')[0]]?.frames[Number(ref.split('/')[1])],ref);
 assert.equal(new Set(DECORATIONS.filter(d=>d.group>0).map(d=>objectFrame(d.id).join('/'))).size,42);
 assert.equal(new Set(PLANTS.filter(d=>!d.parents).map(d=>plantFrame(d).join('/'))).size,37);
});
test('upgraded night windows follow the selected artwork and stay inside its drawn bounds',()=>{
 for(const id of ['house','kitchen','archive','stars'])for(const form of [1,2,3]){
  const d=BUILDINGS.find(d=>d.id===id),[a,b]=d.forms[form-1],day=paintedObject(id,a,b,false,form),night=paintedObject(id,a,b,true,form);
  assert.ok(!day.includes('home-lamplight'));
  if(form===1&&id!=='house'&&id!=='kitchen')continue;
  const [,x,y,w,h]=/x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/.exec(night).map(Number);
  const lights=[...night.matchAll(/class="home-lamplight" cx="([\d.-]+)" cy="([\d.-]+)"/g)];assert.ok(lights.length,`${id}:${form}`);
  for(const [,cx,cy] of lights)assert.ok(+cx>=x&&+cx<=x+w&&+cy>=y&&+cy<=y+h,`${id}:${form} window outside its sprite`);
 }
});
test('painted growth keeps seed, seedling, bud and mature states, and respects genes and night',()=>{
 const d=PLANTS[0],render=(p,h=d.color,f=2,night=false)=>paintedPlant(d,h,f,p,night);
 assert.equal(new Set([0,.2,.5,.8,1].map(p=>render(p))).size,5);
 assert.notEqual(render(1),render(1,d.color+25));
 assert.notEqual(render(1),render(1,d.color,5));
 assert.notEqual(render(1),render(1,d.color,2,true));
});
test('scene phases follow the game clock, including day, season and year boundaries',()=>{
 for(const [clock,phase,dark,s] of [[0,'dawn',false,0],[299,'dawn',false,0],[300,'day',false,0],[2099,'day',false,0],[2100,'dusk',false,0],[2399,'dusk',false,0],[2400,'night',true,0],[3599,'night',true,0],[3600,'dawn',false,0],[25199,'night',true,0],[25200,'dawn',false,1],[100799,'night',true,3],[100800,'dawn',false,0]]){
  const w={clock};assert.equal(dayPhase(w),phase,`${clock} phase`);assert.equal(night(w),dark,`${clock} night`);assert.equal(season(w),s,`${clock} season`);
 }
 assert.equal(springThaw({clock:0}),1);
 assert.equal(springThaw({clock:1800}),.5);
 assert.equal(springThaw({clock:3600}),0);
 assert.equal(springThaw({clock:75600}),0);
 assert.equal(springThaw({clock:100800}),1);
});
test('hand-painted clouds, snow-covered trees and four grounds are packaged offline',()=>{
 for(const [sheet,count] of [['clouds-handpainted',6],['nature-winter',3]]){
  const atlas=manifest[sheet];assert.equal(atlas.frames.length,count);
  const files=atlas.frames.map(([x,y,w,h],i)=>{assert.ok(x>=0&&y>=0&&x+w<=atlas.width&&y+h<=atlas.height);return readFileSync(new URL(`../src/assets/storybook/${sheet}-${i}.webp`,import.meta.url));});
  assert.equal(new Set(files.map(b=>b.toString('base64'))).size,count,'each silhouette has its own picture');
 }
 const grounds=['spring','summer','autumn','winter'].map(s=>readFileSync(new URL(`../src/assets/storybook/ground-${s}.webp`,import.meta.url)));
 assert.equal(new Set(grounds.map(b=>b.toString('base64'))).size,4);
 for(const file of grounds){assert.equal(file.toString('ascii',0,4),'RIFF');assert.equal(file.toString('ascii',8,12),'WEBP');}
});
test('seasonal dressing preserves every building form and lamp position in day and night',()=>{
 for(const def of BUILDINGS)for(const form of [1,2,3])for(const dark of [false,true]){
  const [a,b]=def.forms[form-1],before=JSON.stringify(def),base=paintedObject(def.id,a,b,dark,form);
  const images=[...base.matchAll(/<image[^>]+>/g)].map(m=>m[0]);
  const lamps=[...base.matchAll(/class="home-lamplight"[^>]+/g)].map(m=>m[0]);
  for(let s=0;s<4;s++){
   const art=paintedObject(def.id,a,b,dark,form,s);
   assert.ok(images.every(img=>art.replaceAll(/data-home-paint="[^"]*"/g,'').includes(img)),`${def.id}:${form} changed original artwork`);
   assert.deepEqual([...art.matchAll(/class="home-lamplight"[^>]+/g)].map(m=>m[0]),lamps);
   assert.ok(art.includes(`data-season="${s}"`));
  }
  assert.equal(JSON.stringify(def),before);
 }
 for(const dark of [false,true])assert.equal(new Set([0,1,2,3].map(s=>natureArt('fruit',1,dark,s))).size,4);
 const tree=PLANTS.find(p=>p.family===3),before=JSON.stringify(tree);
 assert.equal(new Set([0,1,2,3].map(s=>paintedPlant(tree,tree.color,2,1,false,s))).size,4);
 assert.equal(new Set([0,1,2,3].map(s=>paintedPlant(tree,tree.color,2,.1,false,s))).size,1,'seeds keep their growth artwork');
 assert.equal(JSON.stringify(tree),before);
});
