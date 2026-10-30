import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUILDINGS,DECORATIONS,PLANTS} from '../src/world/content.ts';
const manifest=JSON.parse(readFileSync(new URL('../src/assets/storybook/manifest.json',import.meta.url),'utf8'));
globalThis.__HOME_ART__=Object.fromEntries(Object.entries(manifest).map(([key,value])=>[key,{...value,image:'data:image/webp;base64,'}]));
const {objectFrame,plantFrame,paintedPlant,paintedObject,GROWN_FACILITIES,grownFrame}=await import('../src/world/art/storybook.ts');
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
