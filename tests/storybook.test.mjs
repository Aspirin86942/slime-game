import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUILDINGS,DECORATIONS,PLANTS} from '../src/world/content.ts';
const manifest=JSON.parse(readFileSync(new URL('../src/assets/storybook/manifest.json',import.meta.url),'utf8'));
globalThis.__HOME_ART__=Object.fromEntries(Object.entries(manifest).map(([key,value])=>[key,{...value,image:'data:image/webp;base64,'}]));
const {objectFrame,plantFrame,paintedPlant}=await import('../src/world/art/storybook.ts');
test('every facility, decoration and plant resolves to a real, bounded painted sprite',()=>{
 const frames=[...BUILDINGS.map(d=>objectFrame(d.id)),...DECORATIONS.filter(d=>d.group>0).map(d=>objectFrame(d.id)),...PLANTS.map(plantFrame)];
 for(const ref of frames){assert.ok(ref);const [sheet,index]=ref,atlas=manifest[sheet],frame=atlas?.frames[index];assert.ok(frame,`${sheet}/${index}`);const [x,y,w,h]=frame;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=atlas.width&&y+h<=atlas.height,`${sheet}/${index} outside sheet`);}
 assert.equal(new Set(BUILDINGS.map(d=>objectFrame(d.id).join('/'))).size,26);
 assert.equal(new Set(DECORATIONS.filter(d=>d.group>0).map(d=>objectFrame(d.id).join('/'))).size,42);
 assert.equal(new Set(PLANTS.filter(d=>!d.parents).map(d=>plantFrame(d).join('/'))).size,37);
});
test('painted growth keeps seed, seedling, bud and mature states, and respects genes and night',()=>{
 const d=PLANTS[0],render=(p,h=d.color,f=2,night=false)=>paintedPlant(d,h,f,p,night);
 assert.equal(new Set([0,.2,.5,.8,1].map(p=>render(p))).size,5);
 assert.notEqual(render(1),render(1,d.color+25));
 assert.notEqual(render(1),render(1,d.color,5));
 assert.notEqual(render(1),render(1,d.color,2,true));
});
