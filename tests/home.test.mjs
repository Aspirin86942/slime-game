import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createWorld,execute,advance,placementError,companion} from '../src/world/engine.ts';
import {upgradeHome,prepareWorld} from '../src/world/migration.ts';
import {validWorld} from '../src/world/storage.ts';
import {activity,resident,route,blockedCells} from '../src/world/life.ts';
import {mapWidth,mapHeight,cell,constrainCamera,screenToCell,MAP_MARGIN} from '../src/world/map.ts';
import {BUILDINGS,PLANTS,RECIPES,VISITORS,TECHS} from '../src/world/content.ts';
import {environment,refreshVisitors} from '../src/world/ecology.ts';
const clone=x=>JSON.parse(JSON.stringify(x));
const pet=(id)=>({id,name:'伙伴'+id,element:'水',personality:'温柔',size:1,level:3,mood:70,stamina:100,intimacy:20});
// 几何与规则测试使用完全发展的家园：全部地块已开垦、全部科技已完成；开局进度另见 estate.test.mjs。
const developed=w=>{w.estate.plots=Array.from({length:24},(_,i)=>i);w.estate.tech=TECHS.map(t=>t.id);return w;};
const fresh=()=>({started:true,saveVersion:5,lastActive:0,slimes:[pet(1),pet(2)],world:developed(createWorld(487))});
const run=(s,c)=>{const r=execute(s,c);assert.equal(r.ok,true,r.message);return r;};
const stored=w=>clone(w);
const fill=s=>{for(const k of ['wood','stone','dew','ingredient','petal','herb','fruit','mushroom','algae','plank','dye','stardust','notes','fertilizer','soil','meal','snack','potion','soup','relic','ore','ingot','honey','essence','crystal'])s.world.stock[k]=1000;};
test('new home serializes as one valid 36 by 24 map',()=>{
 const s=fresh(),w=s.world;assert.equal(w.version,5);assert.equal(mapWidth(w),36);assert.equal(mapHeight(w),24);assert.equal(w.map.terrain.length,864);assert.ok(validWorld(stored(w),[1,2]));assert.deepEqual(Object.keys(w.paths),['0']);
 assert.equal(w.trips.length+w.juveniles.length,0);assert.equal(w.mini,null);
});
test('build, rotate, store and restore across former map borders retain identity and reject overlap atomically',()=>{
 const s=fresh();fill(s);run(s,{type:'build',def:'woodshop',zone:0,x:35,y:21,rotation:1});const id=s.world.placements.at(-1).id;
 const before=JSON.stringify(s);assert.equal(execute(s,{type:'move',id,zone:0,x:35,y:23,rotation:1}).ok,false);assert.equal(JSON.stringify(s),before);
 run(s,{type:'move',id,zone:0,x:11,y:12,rotation:0});run(s,{type:'upgrade',id});run(s,{type:'store',id});run(s,{type:'move',id,zone:0,x:23,y:12,rotation:3});assert.equal(s.world.placements.find(p=>p.id===id).level,2);
 assert.equal(execute(s,{type:'plant',cultivar:10,zone:0,x:23,y:12}).ok,false);
 assert.equal(execute(s,{type:'move',id,zone:1,x:20,y:20}).ok,false);assert.ok(validWorld(stored(s.world),[1,2]));
});
test('a continuous road can cross both old seams, reach the last tile, and erase only chosen cells',()=>{
 const s=fresh(),cells=Array.from({length:220},(_,i)=>i+600);run(s,{type:'paint',zone:0,cells,style:3});run(s,{type:'path',zone:0,x:35,y:23});assert.ok(s.world.paths[0].includes(863));
 run(s,{type:'paint',zone:0,cells:[611,612,623,624],style:0,erase:true});for(const c of [611,612,623,624])assert.ok(!s.world.paths[0].includes(c));
 const path=route(s.world,0,cell(s.world,10,18),[cell(s.world,26,18)]);assert.ok(path?.length);assert.equal(path.at(-1),674);assert.ok(path.every(n=>!blockedCells(s.world,0).has(n)));assert.ok(validWorld(stored(s.world),[1,2]));
});
test('facilities keep an entrance and all map coordinates and rotations must be integers',()=>{
 const w=fresh().world;const house=w.placements[0];for(const mutate of [p=>p.x=-1,p=>p.y=24,p=>p.x=.5,p=>p.rotation=1.5,p=>p.zone=2]){const p={...house};mutate(p);assert.ok(placementError(w,p));}
 for(const mutate of [w=>w.placements[0].rotation=.5,w=>w.crops.push({id:w.seq++,cultivar:10,zone:0,x:.5,y:4,progress:0,water:90,care:0,harvests:0,lastSim:0}),w=>w.version='5']){const d=stored(w);mutate(d);assert.equal(validWorld(d,[1,2]),false);}
});
test('camera includes map-edge artwork at all supported viewport sizes and maps input to the correct tile',()=>{
 for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900],[1920,1080]]){const c={x:9999,y:-999,zoom:.01,ready:true};constrainCamera(c,width,height);assert.ok(c.x>=-MAP_MARGIN&&c.y>=-MAP_MARGIN);assert.ok(c.x+width/c.zoom<=36*48+MAP_MARGIN+.001);assert.ok(c.y+height/c.zoom<=24*48+MAP_MARGIN+.001);const [x,y]=screenToCell(c,0,0);assert.equal(x,Math.floor(c.x/48));assert.equal(y,Math.floor(c.y/48));}
});
test('map edges can move inside the clear area below the header and above the tools',()=>{
 for(const [width,height,frame] of [[390,844,{left:12,top:185,right:322,bottom:670}],[844,390,{left:308,top:92,right:772,bottom:294}]])for(const zoom of [.1,1.1,3]){
  const c={x:-99999,y:-99999,zoom,ready:true};constrainCamera(c,width,height,frame);
  assert.ok(-c.x*c.zoom>=frame.left);assert.ok(-c.y*c.zoom>=frame.top);
  const point={x:(24-c.x)*c.zoom,y:(24-c.y)*c.zoom};assert.deepEqual(screenToCell(c,point.x,point.y),[0,0]);
  c.x=99999;c.y=99999;constrainCamera(c,width,height,frame);
  assert.ok((36*48-c.x)*c.zoom<=frame.right);assert.ok((24*48-c.y)*c.zoom<=frame.bottom);
 }
});
test('V4 migration preserves all six layouts, styles, seeds, memories and in-flight earnings exactly once',()=>{
 const s=fresh(),w=createWorld(99,4);s.world=w;w.unlocked=[0,1,2,3,4,5];
 for(let z=0;z<6;z++){w.placements.push({id:w.seq++,def:'decor-2-0',zone:z,x:10,y:8,rotation:0,level:1,stored:false});w.crops.push({id:w.seq++,cultivar:10,zone:z,x:9,y:9,progress:.7,water:100,care:0,harvests:0,lastSim:0});w.paths[z]=[0,13,143];}
 w.pathStyles={'5:143':4};resident(w,s.slimes[0]);w.residents[1].zone=5;w.residents[1].x=11;w.residents[1].y=11;
 const c=companion(w,s.slimes[0]);c.friends[2]=37;c.memories.push({id:'old',title:'旧回忆',text:'留下的日子',at:0});
 run(s,{type:'depart',region:0,route:0,team:[2],mode:'active',duration:300});const t=s.world.trips[0];t.bag.wood=19;t.coins=43;
 s.world.juveniles.push({id:s.world.seq++,name:'小团',element:'水',born:0,stage:0,care:[],mentor:null,traits:[],choices:[],active:true,personality:'温柔'});
 const old=stored(s.world),before=s.world.stock.wood,seeds=s.world.cultivars.map(c=>c.seeds);upgradeHome(s.world,s.slimes);
 assert.equal(s.world.stock.wood,before+19);assert.equal(s.world.payments.at(-1).amount,43);assert.equal(s.world.retired.trips[0].bag.wood,19);assert.equal(s.world.retired.juveniles[0].name,'小团');assert.equal(s.world.retired.relationships[1].friends[2],37);assert.equal(s.world.companions[1].memories[0].text,'留下的日子');assert.deepEqual(s.world.cultivars.map(c=>c.seeds),seeds);
 for(const p of old.crops){const now=s.world.crops.find(c=>c.id===p.id);assert.equal(now.x,p.x+p.zone%3*12);assert.equal(now.y,p.y+Math.floor(p.zone/3)*12);assert.equal(now.progress,p.progress);}
 assert.equal(s.world.pathStyles['0:863'],4);assert.equal(s.world.residents[1].x,35);assert.equal(s.world.residents[1].y,23);assert.ok(validWorld(stored(s.world),[1,2]));const once=JSON.stringify(s.world);upgradeHome(s.world,s.slimes);assert.equal(JSON.stringify(s.world),once);
});
test('retired commands cannot spend stock, start activities or issue rewards',()=>{
 const s=fresh();for(const type of ['depart','storyStart','resonate','miniStart','babyCare','adopt','pair','unlock']){const before=JSON.stringify(s);assert.equal(execute(s,{type}).ok,false);assert.equal(JSON.stringify(s),before);}
 assert.equal(execute(s,{type:'build',def:'expedition',zone:0,x:0,y:0}).ok,false);
 for(const def of ['expedition','resonance']){
  const p={id:s.world.seq++,def,zone:0,x:0,y:0,rotation:0,level:1,stored:true};s.world.placements.push(p);
  run(s,{type:'move',id:p.id,zone:0,x:0,y:0,rotation:0});
  const before=JSON.stringify(s);assert.equal(execute(s,{type:'assign',slime:1,building:p.id}).ok,false);assert.equal(JSON.stringify(s),before);
  run(s,{type:'store',id:p.id});assert.ok(validWorld(stored(s.world),[1,2]));
 }
});
test('plant, care, harvest, breed, name, protect and clone remain available; glowing seed is a one-time harvest reward',()=>{
 const s=fresh();fill(s);run(s,{type:'build',def:'pollen',zone:0,x:5,y:6});run(s,{type:'build',def:'seedbank',zone:0,x:8,y:6});
 run(s,{type:'plant',cultivar:10,zone:0,x:12,y:18});run(s,{type:'plant',cultivar:11,zone:0,x:13,y:18});for(const c of s.world.crops)c.progress=.8;
 run(s,{type:'breed',a:10,b:11});const child=s.world.cultivars.at(-1);assert.equal(child.species,'hybrid-0-0');run(s,{type:'cultivar',id:child.id,name:'露铃',protect:true});run(s,{type:'clone',id:child.id});
 for(const c of s.world.crops)c.progress=1;run(s,{type:'harvestAll'});const glow=s.world.cultivars.find(c=>c.species==='glowflower');assert.equal(glow.seeds,1);
 run(s,{type:'plant',cultivar:10,zone:0,x:35,y:23});run(s,{type:'care',id:s.world.crops.at(-1).id});s.world.crops.at(-1).progress=1;run(s,{type:'harvestAll'});assert.equal(s.world.cultivars.find(c=>c.id===glow.id).seeds,1);
 run(s,{type:'plant',cultivar:glow.id,zone:0,x:0,y:23});advance(s.world,1200,s.slimes);assert.equal(s.world.crops.at(-1).progress,1);assert.ok(validWorld(stored(s.world),[1,2]));
});
test('all retained facilities and recipes are reachable on the map; completed crafts pay once',()=>{
 const s=fresh();fill(s);s.world.placements=[];let i=0;for(const d of BUILDINGS.filter(d=>!['expedition','resonance'].includes(d.id))){const p={id:s.world.seq++,def:d.id,zone:0,x:i%8*4,y:Math.floor(i/8)*5,rotation:0,level:3,stored:false};i++;assert.equal(placementError(s.world,p),null);s.world.placements.push(p);}
 for(const r of RECIPES){run(s,{type:'craft',recipe:r.id,building:s.world.placements.find(p=>p.def===r.building).id});advance(s.world,r.seconds,s.slimes);const task=s.world.crafts.at(-1);assert.equal(task.ready,true);const before=s.world.stock[Object.keys(r.output)[0]]??0;run(s,{type:'claimCraft',id:task.id});assert.equal(s.world.stock[Object.keys(r.output)[0]],before+Object.values(r.output)[0]);assert.equal(execute(s,{type:'claimCraft',id:task.id}).ok,false);}
 assert.ok(s.world.stock.relic);assert.ok(validWorld(stored(s.world),[1,2]));
});
test('ecology differs by terrain and retains visitors in one map',()=>{
 const s=fresh();assert.ok(environment(s.world,0,2,14).moisture>environment(s.world,0,2,2).moisture);
 for(const [x,y] of [[2,3],[3,3]]){run(s,{type:'plant',cultivar:10,zone:0,x,y});s.world.crops.at(-1).progress=1;}refreshVisitors(s.world,s.slimes);assert.equal(s.world.visitors['visitor-0'],true);
});
const require=createRequire(import.meta.url),html=fs.readFileSync('史莱姆.html','utf8'),code=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const {boot}=require('./lib/vm-harness.cjs').loadGame('史莱姆.html',code),now=1793232000000;
const native=()=>{const h=boot({}, {now});h.state().started=true;h.state().slimes=[h.slime({stamina:40})];return h;};
test('V1 through V4 native saves migrate once, back up original bytes and retain all balances on reload',()=>{
 for(const version of [1,2,3,4]){const h=native(),d=clone(h.state());d.saveVersion=version;d.lastActive=now;
  if(version<3){delete d.world;d.bag={food:7,treasure:2,ticket:4,expPotion:0,net:1};d.feedTrough=3;}
  else{const w=createWorld(22,4);if(version===3){const seeds=w.cultivars.map(c=>c.seeds),stock={...w.stock};d.world=clone(w);d.world.version=3;delete d.world.inventory;d.world.stock=stock;d.world.pending={};d.world.cultivars.forEach((c,i)=>c.seeds=seeds[i]);d.bag={food:7};d.feedTrough=3;}else{w.stock.feed=7;d.world=clone(w);}}
  const raw=JSON.stringify(d),loaded=boot({slimeSummonerSave:raw},{now});assert.equal(loaded.run('load()'),true,'V'+version);assert.equal(loaded.storage.get(`slimeSummonerSave_v${version}_backup`),raw);assert.equal(loaded.state().saveVersion,5);assert.equal(loaded.state().slimes[0].id,d.slimes[0].id);assert.equal(loaded.state().bag.food,7);
  const migrated=loaded.storage.get('slimeSummonerSave');assert.equal(loaded.run('load();save()'),true);assert.equal(loaded.storage.get('slimeSummonerSave'),migrated);assert.equal(loaded.storage.get(`slimeSummonerSave_v${version}_backup`),raw);
 }
});
test('an existing V5 save gains the estate once, after its original bytes are backed up, and keeps existing backups',()=>{
 const h=native(),d=clone(h.state());d.lastActive=now;delete d.world.estate;
 d.world.placements.push({id:d.world.seq++,def:'woodshop',zone:0,x:1,y:1,rotation:0,level:1,stored:false});
 const raw=JSON.stringify(d),loaded=boot({slimeSummonerSave:raw,slimeSummonerSave_v5_backup:'older backup'},{now});
 assert.equal(loaded.run('load()'),true);
 // 已有的旧备份不被覆盖，原文写入带后缀的新键。
 assert.equal(loaded.storage.get('slimeSummonerSave_v5_backup'),'older backup');
 assert.ok([...loaded.storage.keys()].some(k=>k.startsWith('slimeSummonerSave_v5_backup_')&&loaded.storage.get(k)===raw));
 const saved=JSON.parse(loaded.storage.get('slimeSummonerSave'));assert.equal(saved.saveVersion,5);assert.equal(saved.world.estate.plots.length,24);assert.ok(saved.world.estate.tech.includes('cra-wood'));
 // 再次读入：不再备份、不再改写。
 const keys=[...loaded.storage.keys()].length,migrated=loaded.storage.get('slimeSummonerSave');assert.equal(loaded.run('load()'),true);assert.equal([...loaded.storage.keys()].length,keys);assert.equal(loaded.storage.get('slimeSummonerSave'),migrated);
});
test('a V5 estate saved before the order cap is backed up and gains its counter without resetting quotas',()=>{
 const h=native(),d=clone(h.state());d.lastActive=now;
 d.world.estate.daily.made={net:2,expPotion:3,treasure:1};d.world.estate.daily.sold=120;
 delete d.world.estate.daily.orders;
 const raw=JSON.stringify(d),loaded=boot({slimeSummonerSave:raw,slimeSummonerSave_v5_backup:'older backup'},{now});
 assert.equal(loaded.run('load()'),true);
 assert.equal(loaded.storage.get('slimeSummonerSave_v5_backup'),'older backup');
 assert.ok([...loaded.storage.entries()].some(([k,v])=>k.startsWith('slimeSummonerSave_v5_backup_')&&v===raw));
 const migrated=loaded.storage.get('slimeSummonerSave'),saved=JSON.parse(migrated);
 assert.deepEqual(saved.world.estate,{...d.world.estate,daily:{...d.world.estate.daily,orders:0}});
 assert.deepEqual(saved.world.inventory,d.world.inventory);
 assert.deepEqual(saved.slimes,d.slimes);
 const keys=[...loaded.storage.keys()];assert.equal(loaded.run('load()'),true);
 assert.deepEqual([...loaded.storage.keys()],keys);assert.equal(loaded.storage.get('slimeSummonerSave'),migrated);
});
test('native dispatch keeps reference pending rewards and home workers cannot be dispatched, merged or used in battle',()=>{
 const h=native();h.run('S.globalPlan="explore";S.slimes[0].stamina=100;S.slimes[0].luck=0;');const s=h.state().slimes[0],before=h.state().coins;h.run('runPlans(true)');assert.equal(h.state().coins,before);assert.equal(h.state().explorePending.coins,Math.round(Math.round(3*(1+s.agi/100))*(1+h.run('slimePower(S.slimes[0])')/600)));
 h.run('S.globalPlan=null;LivingWorld.dispatch({type:"assign",slime:S.slimes[0].id,building:2});');assert.equal(h.run('LivingWorld.isBusy(S,S.slimes[0].id)'),true);h.run('S.globalPlan="explore";');assert.equal(h.run('getPlan(S.slimes[0].id)'),null);h.run('abyssSetupSel=[S.slimes[0].id];startAbyssBattle();');assert.equal(h.context.__TEST__._battle,undefined);
});
test('one recovery clock matches segmented online time without duplicate stamina recovery',()=>{
 const a=native(),b=native();for(const h of [a,b]){h.run('S.globalPlan="explore";S.feedTrough=10;');}
 a.run('advanceWorld(3600,true)');for(let i=0;i<60;i++)b.run('advanceWorld(60,true)');assert.equal(a.run('JSON.stringify(S)'),b.run('JSON.stringify(S)'));
 const c=native();c.run('S.slimes[0].stamina=50;S.feedTrough=0;advanceWorld(10,true)');assert.ok(Math.abs(c.state().slimes[0].stamina-54)<.00001);
 const dispatched=native();dispatched.run(`{const s=S.slimes[0],id=S.world.seq++;S.globalPlan='explore';s.stamina=100;s.mood=60;S.world.clock=299;S.world.placements.push({id,def:'spa',zone:0,x:0,y:0,rotation:0,level:1,stored:false});S.world.residents[s.id]={slimeId:s.id,zone:0,x:2,y:1,target:id,pose:'休息',until:999,arrived:true};advanceWorld(1,true);}`);assert.equal(dispatched.state().slimes[0].mood,60,'dispatch must not also receive a home spa bonus');
});
test('the real V3 fixture retains old cargo, interrupted stories, layout and archived juveniles',()=>{
 const d=JSON.parse(fs.readFileSync('tests/fixtures/save-v3.json','utf8'));d.lastActive=now;const raw=JSON.stringify(d),h=boot({slimeSummonerSave:raw},{now});assert.equal(h.run('load()'),true);
 assert.equal(h.state().world.trips.length,0);assert.equal(h.state().world.retired.trips.length,d.world.trips.length);assert.equal(h.state().world.retired.juveniles.length,d.world.juveniles.length);
 assert.equal(h.state().slimes[0].name,d.slimes[0].name);assert.equal(h.state().feedTrough,d.feedTrough);assert.ok(h.state().world.placements.some(p=>p.def==='trough'));assert.ok(h.state().world.placements.some(p=>p.def==='toys'));
 for(const p of d.world.placements){const migrated=h.state().world.placements.find(x=>x.id===p.id);assert.equal(migrated.x,p.x+p.zone%3*12);assert.equal(migrated.y,p.y+Math.floor(p.zone/3)*12);}
 const saved=h.storage.get('slimeSummonerSave');assert.equal(h.run('load();save()'),true);assert.equal(h.storage.get('slimeSummonerSave'),saved);
});
test('failed saves retain queued battle results and a successful retry pays only once',()=>{
 const h=native(),b=h.battle();b.B.monsters.forEach(u=>u.hp=0);b.later(()=>b.endBattle(true),0);const set=h.context.localStorage.setItem;h.context.localStorage.setItem=()=>{throw Error('quota')};h.run('save()');const coins=h.state().coins;
 for(const [id,t] of [...h.timeouts]){h.timeouts.delete(id);t.fn();}assert.equal(h.state().coins,coins);assert.equal(b.B.ended,false);
 h.context.localStorage.setItem=set;assert.equal(h.run('save()'),true);h.flush(1e9);assert.equal(b.B.result.win,true);assert.ok(h.state().coins>coins);const earned=h.state().coins;b.endBattle(true);assert.equal(h.state().coins,earned);
});
test('corrupt and future saves, failed backups and conflicting tabs never overwrite source; combat freezes',()=>{
 for(const mutate of [d=>d.saveVersion=6,d=>d.saveVersion=0,d=>d.world.placements[0].x=.5,d=>d.world.map.terrain.pop(),d=>d.world.placements.push({...d.world.placements[0],id:d.world.seq++})]){const d=clone(native().state());mutate(d);const raw=JSON.stringify(d),h=boot({slimeSummonerSave:raw},{now});assert.equal(h.run('load()'),false);assert.equal(h.run('save()'),false);assert.equal(h.storage.get('slimeSummonerSave'),raw);}
 const h=native();h.run('save()');const old=h.storage.get('slimeSummonerSave');h.run('localStorage.setItem=()=>{throw Error("quota")};');assert.equal(h.run('save()'),false);const before=h.run('JSON.stringify(S)');h.run('advanceWorld(300)');assert.equal(h.run('JSON.stringify(S)'),before);assert.equal(h.storage.get('slimeSummonerSave'),old);
 const b=native(),battle=b.battle(['火','水']),hp=battle.B.monsters.map(x=>x.hp);b.run('storageConflict=true;');battle.nextTurn();battle.performAction(battle.B.allies[0],'ally');assert.equal(battle.playerCast(battle.B.allies[0],battle.B.monsters[0]),false);assert.deepEqual(battle.B.monsters.map(x=>x.hp),hp);
 const d=clone(native().state());d.saveVersion=2;delete d.world;d.bag={food:3};const raw=JSON.stringify(d),q=boot({slimeSummonerSave:raw},{now});q.run('localStorage.setItem=()=>{throw Error("quota")};');assert.equal(q.run('load()'),false);assert.equal(q.storage.get('slimeSummonerSave'),raw);
});
