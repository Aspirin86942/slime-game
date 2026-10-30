import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,execute,advance,yieldOf} from '../src/world/engine.ts';
import {upgradeHome,prepareWorld} from '../src/world/migration.ts';
import {validWorld} from '../src/world/storage.ts';
import {entranceCells,resident} from '../src/world/life.ts';
import {cell,START_PLOTS,PLOT_COUNT} from '../src/world/map.ts';
import {TECHS,RECIPES,BRIDGE_CAPS,PROSPERITY} from '../src/world/content.ts';
import {estate,homeLevel,prosperity,clearing,migrateEstate,bufferHours,workerCap,ROUND} from '../src/world/estate.ts';
const clone=x=>JSON.parse(JSON.stringify(x));
const pet=(id,element='水')=>({id,name:'伙伴'+id,element,personality:'温柔',size:1,level:3,mood:80,stamina:100,intimacy:20});
const fresh=(slimes=[pet(1),pet(2,'岩')])=>({started:true,saveVersion:5,lastActive:0,slimes,world:createWorld(487)});
const run=(s,c)=>{const r=execute(s,c);assert.equal(r.ok,true,r.message);return r;};
const fail=(s,c,pattern)=>{const before=JSON.stringify(s),r=execute(s,c);assert.equal(r.ok,false,`应当失败：${JSON.stringify(c)}`);if(pattern)assert.match(r.message,pattern);assert.equal(JSON.stringify(s),before,'失败的命令不能改动存档');return r;};
const give=(s,stock)=>{for(const[k,v]of Object.entries(stock))s.world.stock[k]=(s.world.stock[k]??0)+v;};
const finish=(s,id)=>{const t=TECHS.find(t=>t.id===id);give(s,t.cost);run(s,{type:'research',id});advance(s.world,t.seconds,s.slimes);assert.ok(s.world.estate.tech.includes(id),id);};
// 让伙伴站到设施入口，等同于它已经走到岗位上。
const station=(s,slime,p)=>{const r=resident(s.world,s.slimes.find(x=>x.id===slime)),n=entranceCells(s.world,p)[0];Object.assign(r,{x:n%36,y:Math.floor(n/36),target:p.id,arrived:true,blocked:false});};

test('a new home starts on four cleared plots with starter facilities, notes and three orders',()=>{
 const s=fresh(),e=s.world.estate;
 assert.deepEqual(e.plots,START_PLOTS);assert.deepEqual(e.tech,[]);assert.equal(s.world.stock.notes,6);assert.equal(e.orders.length,3);
 assert.ok(validWorld(clone(s.world),[1,2]));assert.equal(homeLevel(s.world),1);
 // 林地上不能建造、种植或铺路；未研究的设施不能建；开局设施可以建。
 fail(s,{type:'build',def:'kitchen',zone:0,x:2,y:2},/林地/);
 fail(s,{type:'plant',cultivar:10,zone:0,x:30,y:20,explicit:true},/林地/);
 fail(s,{type:'paint',zone:0,cells:[cell(s.world,1,1)],style:1},/林地/);
 fail(s,{type:'build',def:'quarry',zone:0,x:20,y:14},/研究「采石」/);
 run(s,{type:'build',def:'kitchen',zone:0,x:20,y:14});
 // 果树与菌菇要先研究。
 const fruit=s.world.cultivars.find(c=>c.species==='plant-3-0');fail(s,{type:'plant',cultivar:fruit.id,zone:0,x:13,y:15,explicit:true},/果树栽培/);
});

test('research pays once, respects prerequisites, queue size and home level, continues offline and refunds on cancel',()=>{
 const s=fresh();
 fail(s,{type:'research',id:'res-mine'},/采石/);
 fail(s,{type:'research',id:'nope'},/没有这项研究/);
 const t=TECHS.find(t=>t.id==='res-quarry'),before=clone(s.world.inventory.items);
 run(s,{type:'research',id:'res-quarry'});for(const[k,v]of Object.entries(t.cost))assert.equal(s.world.stock[k],before[k]-v);
 fail(s,{type:'research',id:'cra-wood'},/档案馆 2 级/);
 run(s,{type:'cancelResearch',id:'res-quarry'});assert.deepEqual(clone(s.world.inventory.items),before);
 run(s,{type:'research',id:'res-quarry'});advance(s.world,t.seconds-1,s.slimes);assert.ok(!s.world.estate.tech.includes('res-quarry'));advance(s.world,1,s.slimes);
 assert.ok(s.world.estate.tech.includes('res-quarry'));assert.equal(s.world.estate.research.length,0);run(s,{type:'build',def:'quarry',zone:0,x:20,y:14});
 // 第二层需要家园 3 级。
 give(s,{notes:50,wood:500,stone:500});fail(s,{type:'research',id:'res-mine'},/家园 3 级/);
 assert.ok(validWorld(clone(s.world),[1,2]));
});

test('clearing opens adjacent forest only, rises in cost, refunds timber and enables building there',()=>{
 const s=fresh();give(s,{wood:500,stone:500});
 assert.equal(clearing(s.world,0).problem,'先开垦相邻的地块');fail(s,{type:'clear',plot:0},/相邻/);fail(s,{type:'clear',plot:8},/已经开垦/);
 const first=clearing(s.world,7);assert.equal(first.problem,'');const wood=s.world.stock.wood;run(s,{type:'clear',plot:7});
 assert.equal(s.world.stock.wood,wood-first.cost.wood+first.refund.wood);assert.ok(s.world.estate.plots.includes(7));
 const second=clearing(s.world,13);assert.ok(second.cost.wood>first.cost.wood);run(s,{type:'clear',plot:13});
 // 第三块起需要家园 2 级。
 assert.equal(clearing(s.world,6).problem,'家园 2 级可以开垦');fail(s,{type:'clear',plot:6},/家园 2 级/);
 run(s,{type:'build',def:'kitchen',zone:0,x:7,y:7});assert.ok(validWorld(clone(s.world),[1,2]));
});

test('resource buildings stash output until collected, cap it by storage hours and auto-collect after research',()=>{
 const s=fresh([]);s.world.estate.tech.push('res-quarry');give(s,{wood:100,stone:100});
 // 放在植物苗圃地形（无加成），产量就是基础的 4。
 run(s,{type:'build',def:'quarry',zone:0,x:21,y:7});const q=s.world.placements.at(-1),stone=s.world.stock.stone;
 advance(s.world,300,s.slimes);assert.equal(s.world.estate.yields[q.id].stone,4);assert.equal(s.world.stock.stone,stone);
 run(s,{type:'collect',id:q.id});assert.equal(s.world.stock.stone,stone+4);fail(s,{type:'collect',id:q.id},/没有可以收取/);
 // 4 小时暂存上限：12 小时离线也只保留 48 轮。
 advance(s.world,43200,s.slimes);assert.equal(bufferHours(s.world),4);assert.equal(s.world.estate.yields[q.id].stone,4*48);
 run(s,{type:'collectAll'});assert.equal(s.world.estate.yields[q.id],undefined);
 s.world.estate.tech.push('res-storage1','res-auto');const now=s.world.stock.stone;advance(s.world,300,s.slimes);assert.equal(s.world.stock.stone,now+4);assert.equal(s.world.estate.yields[q.id],undefined);
});

test('element affinity, terrain and tired companions change production exactly as the panel reports',()=>{
 const s=fresh([pet(1,'岩'),pet(2,'水')]);s.world.estate.tech.push('res-quarry','res-mine');s.world.estate.plots=Array.from({length:PLOT_COUNT},(_,i)=>i);give(s,{wood:200,stone:200});
 run(s,{type:'build',def:'quarry',zone:0,x:2,y:2});const q=s.world.placements.at(-1);assert.deepEqual(yieldOf(s.world,q,s.slimes),{stone:4});
 run(s,{type:'assign',slime:2,building:q.id});station(s,2,q);assert.deepEqual(yieldOf(s.world,q,s.slimes),{stone:5},'非对口伙伴只多带回 1 份');
 run(s,{type:'unassign',slime:2});run(s,{type:'assign',slime:1,building:q.id});station(s,1,q);assert.deepEqual(yieldOf(s.world,q,s.slimes),{stone:6},'岩元素对口 +25% 再加 1 份');
 s.slimes[0].mood=35;assert.deepEqual(yieldOf(s.world,q,s.slimes),{stone:5},'心情低于 40 只发挥一半');
 // 工坊营地（地形 4）上的采石场 +25%。
 run(s,{type:'move',id:q.id,zone:0,x:14,y:14});s.slimes[0].mood=80;const moved=s.world.placements.find(p=>p.id===q.id);station(s,1,moved);assert.deepEqual(yieldOf(s.world,moved,s.slimes),{stone:Math.round(4*1.25*1.25)+1});
 // 元素泉没有伙伴就不出产。
 s.world.estate.tech.push('res-spring');run(s,{type:'build',def:'spring',zone:0,x:30,y:2});const spring=s.world.placements.at(-1);assert.deepEqual(yieldOf(s.world,spring,s.slimes),{});
});

test('workers wear their mood down slowly to a floor and training pays experience to the original growth',()=>{
 const s=fresh([pet(1,'雷')]);s.world.estate.tech.push('pal-training');give(s,{wood:200,stone:200});
 run(s,{type:'build',def:'training',zone:0,x:20,y:14});const p=s.world.placements.at(-1);run(s,{type:'assign',slime:1,building:p.id});station(s,1,p);
 // 最后一轮的经验在下一秒交给原版成长，这里连同暂存的 payments 一起数。
 const events=[];advance(s.world,900,s.slimes,e=>events.push(...e));events.push(...s.world.payments);
 assert.equal(s.slimes[0].mood,79);assert.deepEqual(events.filter(e=>e.type==='experience').map(e=>e.amount),[12,12,12],'雷元素对口，训练经验翻倍');
 s.slimes[0].mood=30.5;advance(s.world,900,s.slimes);assert.equal(s.slimes[0].mood,30);
});

test('bridge items go straight to the original bag with a 12-hour cap, then refresh',()=>{
 const s=fresh([]);s.world.estate.tech=TECHS.map(t=>t.id).filter(id=>id!=='pal-blessing');s.world.estate.plots=Array.from({length:PLOT_COUNT},(_,i)=>i);give(s,{wood:999,stone:999,plank:50,ingot:50,herb:50,honey:50,essence:50,crystal:50,stardust:50});
 run(s,{type:'build',def:'woodshop',zone:0,x:2,y:2});const shop=s.world.placements.at(-1);shop.level=3;
 run(s,{type:'build',def:'alchemy',zone:0,x:8,y:2});const lab=s.world.placements.at(-1);lab.level=3;
 const command=item=>({type:'craft',recipe:item,building:item==='net'?shop.id:lab.id});
 for(const[item,cap]of Object.entries(BRIDGE_CAPS)){
  const recipe=RECIPES.find(r=>r.id===item);
  for(let i=0;i<cap;i++){run(s,command(item));advance(s.world,recipe.seconds,s.slimes);run(s,{type:'claimCraft',id:s.world.crafts.at(-1).id});}
  assert.equal(s.world.stock[item],cap);fail(s,command(item),/本轮已制作/);
 }
 advance(s.world,ROUND-s.world.clock%ROUND-1,s.slimes);
 for(const item of Object.keys(BRIDGE_CAPS))fail(s,command(item),/本轮已制作/);
 advance(s.world,1,s.slimes);
 for(const item of Object.keys(BRIDGE_CAPS))run(s,command(item));
 assert.deepEqual(s.world.estate.daily.made,{net:1,expPotion:1,treasure:1});
 // 星辰祝福让天材地宝的上限 +1。
 s.world.estate.tech.push('pal-blessing');
 for(let i=1;i<BRIDGE_CAPS.treasure+1;i++)run(s,command('treasure'));
 fail(s,command('treasure'),/本轮已制作/);
});

test('locked recipes stay locked until researched even at full building level',()=>{
 const s=fresh([]);s.world.estate.tech.push('cra-alchemy');give(s,{wood:999,stone:999,ore:9});run(s,{type:'build',def:'alchemy',zone:0,x:20,y:14});
 fail(s,{type:'craft',recipe:'ingot',building:s.world.placements.at(-1).id},/研究「冶炼」/);
});

test('the market pays coins through the original income event and stops at its round allowance',()=>{
 const s=fresh([]);s.world.estate.tech.push('pal-market');s.world.estate.plots=Array.from({length:PLOT_COUNT},(_,i)=>i);give(s,{wood:3000,stone:999});
 fail(s,{type:'sell',item:'wood',amount:10},/集市/);run(s,{type:'build',def:'market',zone:0,x:2,y:2});
 const r=run(s,{type:'sell',item:'wood',amount:10});assert.deepEqual(r.events,[{type:'income',text:'集市收购',amount:40}]);
 fail(s,{type:'sell',item:'net',amount:1},/不能出售/);fail(s,{type:'sell',item:'wood',amount:1.5});
 run(s,{type:'sell',item:'wood',amount:490});fail(s,{type:'sell',item:'wood',amount:1},/本轮还能换 0/);
});

test('orders pay coins, points and notes once, can be dismissed and refill over time',()=>{
 const s=fresh(),o=s.world.estate.orders[0],[item,n]=Object.entries(o.need)[0];
 s.world.stock[item]=0;fail(s,{type:'order',id:o.id});give(s,{[item]:n});const notes=s.world.stock.notes;
 const r=run(s,{type:'order',id:o.id});assert.deepEqual(r.events.map(e=>e.type),['income','points']);assert.equal(r.events[0].amount,o.coins);assert.equal(r.events[1].amount,o.points);
 assert.equal(s.world.stock.notes,notes+o.notes);fail(s,{type:'order',id:o.id},/已经完成/);
 run(s,{type:'dismissOrder',id:s.world.estate.orders[0].id});assert.equal(s.world.estate.orders.length,1);
 advance(s.world,1800,s.slimes);assert.equal(s.world.estate.orders.length,3);assert.ok(validWorld(clone(s.world),[1,2]));
 // 每轮最多完成 9 份：额满后交付失败、不再补新委托，下一轮恢复。
 s.world.estate.daily.orders=9;const next=s.world.estate.orders[0];give(s,next.need);fail(s,{type:'order',id:next.id},/本轮委托已完成/);
 run(s,{type:'dismissOrder',id:next.id});advance(s.world,3600,s.slimes);assert.equal(s.world.estate.orders.length,2);
 advance(s.world,ROUND-s.world.clock%ROUND+1800,s.slimes);assert.equal(s.world.estate.daily.orders,0);assert.equal(s.world.estate.orders.length,3);
});

test('prosperity raises the home level, which opens tiers, worker places and decoration groups',()=>{
 const s=fresh();assert.equal(prosperity(s.world).score,40);assert.equal(workerCap(s.world),3);
 fail(s,{type:'build',def:'decor-3-0',zone:0,x:20,y:15},/家园 2 级/);
 give(s,{wood:500,stone:500});run(s,{type:'build',def:'kitchen',zone:0,x:20,y:14});run(s,{type:'build',def:'table',zone:0,x:12,y:15});
 assert.equal(prosperity(s.world).score,PROSPERITY[1]);assert.equal(homeLevel(s.world),2);run(s,{type:'build',def:'decor-3-0',zone:0,x:22,y:15});
});

test('an existing V5 home keeps everything it had: all land, built facilities, auto storage and current crop pace',()=>{
 const s=fresh(),w=s.world;w.estate=undefined;
 w.placements.push({id:w.seq++,def:'woodshop',zone:0,x:2,y:2,rotation:0,level:2,stored:false,form:2},{id:w.seq++,def:'training',zone:0,x:30,y:20,rotation:0,level:1,stored:false});
 w.crops.push({id:w.seq++,cultivar:10,zone:0,x:3,y:20,progress:.4,water:100,care:0,harvests:0,lastSim:0});
 assert.ok(validWorld(clone(w),[1,2]),'缺少家园扩展的旧档可以读入');
 prepareWorld(w);const e=w.estate;assert.equal(e.plots.length,PLOT_COUNT);
 for(const id of ['cra-wood','pal-training','res-quarry','res-auto','res-storage1','agr-fruit','agr-fungi'])assert.ok(e.tech.includes(id),id);
 assert.ok(!e.tech.includes('res-mine'));assert.equal(w.crops.at(-1).legacy,true);
 const once=JSON.stringify(w);prepareWorld(w);assert.equal(JSON.stringify(w),once,'重复读入结果不变');assert.ok(validWorld(clone(w),[1,2]));
 // 已有的伙伴驻场不会因为家园等级被撤下。
 const old=createWorld(5,4);upgradeHome(old,[]);assert.equal(old.estate.plots.length,PLOT_COUNT);assert.deepEqual(migrateEstate(clone(old)).tech,old.estate.tech);
});

test('damaged estate data is rejected instead of silently repaired',()=>{
 const s=fresh(),bad=[
  w=>{w.estate.tech.push('unknown');},w=>{w.estate.plots.push(99);},w=>{w.estate.plots=[8,8,9,14,15];},
  w=>{w.estate.research.push({id:'res-quarry',remaining:-1});},w=>{w.estate.yields['424242']={wood:1};},
  w=>{w.estate.orders.push({id:1,slime:0,need:{wood:'x'},coins:1,points:1,notes:1});},
  w=>{w.estate.plots=[8];},w=>{w.estate.rev=2;},w=>{w.estate.daily.orders=-1;},w=>{w.estate.daily.orders=null;},w=>{w.estate.daily.orders='0';},w=>{w.estate.daily.orders=.5;}
 ];
 for(const damage of bad){const w=clone(s.world);damage(w);assert.equal(validWorld(w,[1,2]),false,damage.toString());}
});
