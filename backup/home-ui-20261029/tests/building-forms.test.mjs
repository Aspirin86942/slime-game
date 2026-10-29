import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,execute,footprint,growth} from '../src/world/engine.ts';
import {validWorld} from '../src/world/storage.ts';
import {BUILDINGS} from '../src/world/content.ts';
import {bounds,formOf} from '../src/world/ecology.ts';
import {GROWN_FACILITIES,grownFrame,objectFrame} from '../src/world/art/storybook.ts';
const clone=x=>JSON.parse(JSON.stringify(x));
const fresh=()=>({started:true,saveVersion:5,lastActive:0,slimes:[],world:createWorld(487)});
const run=(s,c)=>{const r=execute(s,c);assert.equal(r.ok,true,r.message);return r;};
const fill=s=>{for(const k of ['wood','stone'])s.world.stock[k]=1000;};
const build=(s,def,x,y,rotation=0)=>{run(s,{type:'build',def,zone:0,x,y,rotation});return s.world.placements.at(-1);};
const get=(s,id)=>s.world.placements.find(p=>p.id===id);
const cells=(s,p)=>footprint(p,s.world);

test('every upgradeable facility grows each level and memorial facilities keep their size',()=>{
 for(const d of BUILDINGS){
  assert.deepEqual(d.forms[0],d.size,d.id);
  if(['expedition','resonance'].includes(d.id)){assert.ok(d.forms.every(f=>f.join()===d.size.join()),d.id);continue;}
  for(let i=1;i<3;i++){const [a,b]=d.forms[i-1],[A,B]=d.forms[i];assert.ok(A>=a&&B>=b&&A*B>a*b,`${d.id} form ${i+1}`);}
 }
 assert.ok(BUILDINGS.filter(d=>GROWN_FACILITIES.includes(d.id)).reduce((n,d)=>n+d.forms[2][0]*d.forms[2][1],0)<36*24/4);
});

test('upgrading grows the building in place: the new footprint contains the old one and keeps its front edge',()=>{
 const s=fresh();fill(s);let p=build(s,'kitchen',4,4);const id=p.id,old=cells(s,p),wood=s.world.stock.wood;
 run(s,{type:'upgrade',id});p=get(s,id);
 assert.equal(p.level,2);assert.equal(formOf(p),2);assert.deepEqual(bounds(p),[2,2]);
 assert.ok(old.every(c=>cells(s,p).includes(c)));assert.equal(p.y+2,4+1,'bottom edge stays on the original row');
 assert.ok(s.world.stock.wood<wood,'a paid upgrade consumes materials');
 run(s,{type:'upgrade',id});p=get(s,id);assert.deepEqual(bounds(p),[3,2]);assert.equal(p.level,3);assert.equal(p.form,3);
 assert.equal(execute(s,{type:'upgrade',id}).ok,false);
 assert.ok(validWorld(clone(s.world),[]));
});

test('growth picks another containing spot at the map edge and stays inside the map',()=>{
 const s=fresh();fill(s);const p=build(s,'compost',35,23);run(s,{type:'upgrade',id:p.id});
 const q=get(s,p.id);assert.deepEqual([q.x,q.y,...bounds(q)],[34,23,2,1]);
 run(s,{type:'upgrade',id:p.id});const r=get(s,p.id);assert.deepEqual([r.x,r.y,...bounds(r)],[34,22,2,2]);
});

test('blocked growth fails atomically: no materials, sequence or position change, and the panel can show blocked cells',()=>{
 const s=fresh();fill(s);const p=build(s,'compost',5,5);
 for(const [x,y] of [[4,5],[6,5]])build(s,'decor-1-0',x,y);
 const before=JSON.stringify(s),r=execute(s,{type:'upgrade',id:p.id});
 assert.equal(r.ok,false);assert.match(r.message,/扩建需要 2×1 的空地/);assert.equal(JSON.stringify(s),before);
 const g=growth(s.world,get(s,p.id));assert.equal(g.placement,null);assert.ok(g.cells.some(c=>!c.free));
 run(s,{type:'store',id:s.world.placements.at(-1).id});run(s,{type:'upgrade',id:p.id});assert.deepEqual(bounds(get(s,p.id)),[2,1]);
});

test('growth refuses to cover crops',()=>{
 const s=fresh();fill(s);s.world.cultivars.forEach(c=>c.seeds=5);const p=build(s,'insects',8,8);
 // 1×2 形态的两个候选位置分别被上方和下方的植物占住。
 for(const y of [7,9])run(s,{type:'plant',cultivar:s.world.cultivars[0].id,zone:0,x:8,y});
 const r=execute(s,{type:'upgrade',id:p.id});assert.equal(r.ok,false);assert.match(r.message,/周围有物件或植物挡住/);
});

test('rotation swaps the grown width and height',()=>{
 const s=fresh();fill(s);const p=build(s,'seedbank',4,16,1);assert.deepEqual(bounds(p),[2,1]);
 run(s,{type:'upgrade',id:p.id});assert.deepEqual(bounds(get(s,p.id)),[2,2]);
 run(s,{type:'upgrade',id:p.id});assert.deepEqual(bounds(get(s,p.id)),[3,2]);
 run(s,{type:'move',id:p.id,zone:0,x:10,y:18,rotation:0});assert.deepEqual(bounds(get(s,p.id)),[2,3]);
});

test('older saves with upgraded facilities load unchanged and unfold for free one form at a time',()=>{
 const s=fresh();fill(s);const p=build(s,'kitchen',4,4);const id=p.id;get(s,id).level=3;delete get(s,id).form;
 assert.ok(validWorld(clone(s.world),[]),'legacy level 3 without form keeps its original footprint');
 assert.deepEqual(bounds(get(s,id)),[2,1]);
 const stock=JSON.stringify(s.world.stock);
 run(s,{type:'upgrade',id});assert.equal(get(s,id).form,2);assert.equal(get(s,id).level,3);assert.equal(JSON.stringify(s.world.stock),stock);
 run(s,{type:'upgrade',id});assert.equal(get(s,id).form,3);assert.equal(JSON.stringify(s.world.stock),stock);
 assert.equal(execute(s,{type:'upgrade',id}).ok,false);
});

test('save validation rejects impossible forms',()=>{
 const s=fresh();const house=s.world.placements.find(p=>p.def==='house');
 for(const form of [0,1.5,2,4,'2']){const w=clone(s.world);w.placements.find(p=>p.id===house.id).form=form;assert.equal(validWorld(w,[]),false,String(form));}
 const w=clone(s.world);w.placements.find(p=>p.id===house.id).form=1;assert.ok(validWorld(w,[]));
});

test('grown art uses its own frame when present and falls back to the first form otherwise',()=>{
 assert.equal(GROWN_FACILITIES.length,24);
 const frames=new Set(GROWN_FACILITIES.flatMap(id=>[2,3].map(f=>grownFrame(id,f).join('/'))));assert.equal(frames.size,48);
 assert.equal(grownFrame('expedition',2),null);assert.equal(grownFrame('house',1),null);
 // Unit tests run without the embedded atlases, so every form resolves to the original sprite.
 assert.deepEqual(objectFrame('house',3),objectFrame('house',1));
});

test('the generation prompts list the grown forms in the exact cell order the game reads',async()=>{
 const fs=await import('node:fs');const text=fs.readFileSync(new URL('../docs/art-2026-10-29/production/building-forms-prompts.md',import.meta.url),'utf8');
 const order=[...text.matchAll(/^(\d+)\. (\w+) level ([23]):/gm)].map(m=>`${m[2]}:${m[3]}`);
 assert.deepEqual(order,GROWN_FACILITIES.flatMap(id=>[`${id}:2`,`${id}:3`]));
});
