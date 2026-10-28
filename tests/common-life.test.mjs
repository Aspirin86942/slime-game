import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,execute,advance,companion} from '../src/world/engine.ts';
import {activity,resident,record,route,blockedCells,entranceCells} from '../src/world/life.ts';
import {prepareWorld,upgradeWorld} from '../src/world/migration.ts';
import {attachLegacyInventory} from '../src/world/inventory.ts';
import {storyRequirement,startStory,choiceProblem,tripScene,automaticChoice} from '../src/world/stories.ts';
import {validWorld} from '../src/world/storage.ts';
import {scene} from '../src/world/art.ts';
import {ZONES} from '../src/world/content.ts';
import {environment} from '../src/world/ecology.ts';
const pet=(id,element='草')=>({id,name:'小芽'+id,personality:'胆小',element,size:1,level:5,mood:70,stamina:100,intimacy:0});
const fresh=()=>({started:true,saveVersion:4,lastActive:0,slimes:[pet(1),pet(2,'水'),pet(3,'火')],world:createWorld(987)});
const go=(s,c)=>{const r=execute(s,c);assert.equal(r.ok,true,r.message);return r;};
const reload=s=>{const t=JSON.parse(JSON.stringify(s));assert.ok(validWorld(t.world,t.slimes.map(p=>p.id)));prepareWorld(t.world);return t;};

test('stories randomly cast an available partner once and keep that identity after reload',()=>{
 const casts=new Set();
 for(let seed=1;seed<=16;seed++){
  let s=fresh();s.world=createWorld((seed*0x9e3779b1)>>>0);s.world.activities[1]={kind:'battle'};
  go(s,{type:'storyStart',definition:'world:sprout',actor:1});
  const id=s.world.stories['world:sprout'].participants[0];assert.ok([2,3].includes(id));casts.add(id);
  s=reload(s);assert.deepEqual(s.world.stories['world:sprout'].participants,[id]);
  const before=JSON.stringify(s);assert.equal(execute(s,{type:'storyStart',definition:'world:sprout'}).ok,false);assert.equal(JSON.stringify(s),before);
 }
 assert.equal(casts.size,2);
});
test('random encounters choose valid casts and reject duplicate or unavailable starts atomically',()=>{
 for(const kind of ['world','personal','pair']){
  const s=fresh();go(s,{type:'storyEncounter',kind});const story=Object.values(s.world.stories)[0];
  assert.equal(story.kind,kind);assert.equal(new Set(story.participants).size,kind==='pair'?2:1);
  const before=JSON.stringify(s);assert.equal(execute(s,{type:'storyEncounter',kind}).ok,false);assert.equal(JSON.stringify(s),before);assert.ok(validWorld(s.world,[1,2,3]));
 }
 const s=fresh(),before=JSON.stringify(s);assert.equal(execute(s,{type:'storyEncounter',kind:'world'},()=>false).ok,false);assert.equal(JSON.stringify(s),before);
});
test('continuing a story preserves RNG across reload, requires real progress and cannot pay twice',()=>{
 const s=fresh();go(s,{type:'storyStart',definition:'world:sprout'});const id=s.world.stories['world:sprout'].participants[0],command={type:'storyContinue',id:'world:sprout',stage:0};
 const before=JSON.stringify(s);assert.equal(execute(s,command).ok,false);assert.equal(JSON.stringify(s),before);
 record(s.world,s.slimes,'plant',[id]);const saved=reload(s);go(s,command);go(saved,command);
 assert.deepEqual(saved.world.stories,s.world.stories);assert.equal(saved.world.rng,s.world.rng);assert.equal(s.world.memorials.length,1);
 const finished=JSON.stringify(s);assert.equal(execute(s,command).ok,false);assert.equal(JSON.stringify(s),finished);
 record(s.world,s.slimes,'harvest',[id]);const busy=JSON.stringify(s);assert.equal(execute(s,{...command,stage:1},candidate=>candidate!==id).ok,false);assert.equal(JSON.stringify(s),busy);
});
test('automatic narration filters unavailable abilities and never spends optional materials',()=>{
 const s=fresh();const choices=[{text:'pay',result:'paid',reward:{},requires:{cost:{wood:1}}},{text:'wind',result:'flew',reward:{},requires:{element:'风'}},{text:'walk',result:'walked',reward:{}}];
 for(let i=0;i<20;i++)assert.equal(automaticChoice(s.world,s.slimes,choices),2);
});
test('every travel encounter continues without a decision, optional spending or stale rewards',async()=>{
 const {EVENTS}=await import('../src/world/narratives.ts');
 for(const event of EVENTS){
  const s=fresh();s.slimes[0].level=1;s.world.discoveries=Array.from({length:20},(_,i)=>'d'+i);
  go(s,{type:'depart',region:event.region,route:0,team:[1],mode:'active',duration:300});const id=s.world.trips[0].id;s.world.trips[0].events[0]=event.id;go(s,{type:'step',id});
  const stock={...s.world.stock},command={type:'tripContinue',id,event:event.id};go(s,command);assert.deepEqual({...s.world.stock},stock,event.id);assert.equal(s.world.trips[0].pending,null);
  const after=JSON.stringify(s);assert.equal(execute(s,command).ok,false);assert.equal(JSON.stringify(s),after,event.id);
 }
});
test('childhood narration resumes with distinct chapters and rejects a repeated click',()=>{
 const s=fresh();go(s,{type:'resonate',a:1,b:2});const baby=s.world.juveniles[0];
 const command={type:'babyContinue',id:baby.id,stage:0,chapter:0};go(s,command);const after=JSON.stringify(s);
 assert.equal(execute(s,command).ok,false);assert.equal(JSON.stringify(s),after);
 const saved=reload(s);go(saved,{...command,chapter:1});assert.equal(saved.world.juveniles[0].choices.length,2);
});
function outing(s,region=0,team=[1]){go(s,{type:'depart',region,route:0,team,mode:'active',duration:300});const id=s.world.trips.at(-1).id;for(let n=0;n<4;n++){go(s,{type:'step',id});const choices=tripScene(s.world,s.world.trips.find(t=>t.id===id),s.slimes).choices;const choice=choices.findIndex(c=>!choiceProblem(s.world,s.slimes.filter(p=>team.includes(p.id)),c));go(s,{type:'tripChoice',id,choice});}return id;}

test('harvest, cook, feed, travel and a lasting glowing memorial use the same original partner',()=>{
 let s=fresh();const id=1;go(s,{type:'plant',cultivar:22,zone:0,x:1,y:6,actor:id});go(s,{type:'interact',slime:id,action:'chat'});go(s,{type:'care',id:s.world.crops[0].id,actor:id});go(s,{type:'storyChoice',id:'wish:1',choice:0});
 advance(s.world,2400,s.slimes);go(s,{type:'harvestAll',actor:id});go(s,{type:'build',def:'kitchen',zone:0,x:0,y:6});const kitchen=s.world.placements.at(-1).id;
 for(const recipe of ['feed','simplemeal'])go(s,{type:'craft',recipe,building:kitchen,actor:id});advance(s.world,120,s.slimes);for(const c of [...s.world.crafts])go(s,{type:'claimCraft',id:c.id,actor:2});
 assert.equal(companion(s.world,s.slimes[0]).facts.craft,2);assert.equal(companion(s.world,s.slimes[1]).facts?.craft,undefined);
 const before=s.world.stock.feed;go(s,{type:'interact',slime:id,action:'feed'});assert.equal(s.world.stock.feed,before-1);
 go(s,{type:'claimTrip',id:outing(s)});const journey=outing(s,1);assert.equal(activity(s.world,id).kind,'home');assert.ok(s.world.cultivars.some(c=>c.species==='glowflower'));go(s,{type:'claimTrip',id:journey});
 go(s,{type:'storyChoice',id:'wish:1',choice:1});const cv=s.world.cultivars.find(c=>c.species==='glowflower');go(s,{type:'plant',cultivar:cv.id,zone:0,x:7,y:7,actor:id});
 s=reload(s);s.slimes[0].name='改名后的小芽';advance(s.world,3600,s.slimes);go(s,{type:'storyChoice',id:'wish:1',choice:0});s=reload(s);
 assert.equal(s.world.stories['wish:1'].status,'completed');assert.deepEqual(s.world.stories['wish:1'].participants,[1]);assert.equal(s.world.stories['wish:1'].choices.length,3);assert.equal(s.world.memorials.filter(m=>m.story==='wish:1').length,3);assert.equal(companion(s.world,s.slimes[1]).memories.length,0);
 advance(s.world,3600-(s.world.clock%3600)+2420,s.slimes);assert.equal(s.world.residents[1].pose,'在发光花边休息');assert.ok(s.world.crops.some(c=>c.progress===1));
 const flower=s.world.crops.find(c=>s.world.cultivars.find(v=>v.id===c.cultivar)?.species==='glowflower');assert.equal(execute(s,{type:'harvest',id:flower.id}).ok,false);
});

test('inventory serializes one source; old feed, ingredients, trough and trip stock stay separate',()=>{
 const s=fresh();s.world=JSON.parse(JSON.stringify(s.world));s.world.version=3;delete s.world.inventory;s.world.stock={food:23,wood:5};s.world.pending={food:7};s.world.cultivars.forEach(c=>c.seeds=2);s.bag={food:17,treasure:2};s.feedTrough=9;upgradeWorld(s.world,s.slimes,3,Date.now());attachLegacyInventory(s);
 assert.equal(s.world.stock.ingredient,23);assert.equal(s.world.stock.feed,17);assert.equal(s.feedTrough,9);assert.equal(s.world.pending.ingredient,7);go(s,{type:'refill',amount:4});assert.equal(s.bag.food,13);assert.equal(s.feedTrough,13);
 const raw=JSON.parse(JSON.stringify(s));assert.equal(raw.bag,undefined);assert.equal(raw.feedTrough,undefined);assert.equal(raw.world.stock,undefined);assert.equal(raw.world.cultivars[0].seeds,undefined);
 attachLegacyInventory(s);assert.equal(s.bag.food,13);assert.ok(validWorld(s.world,[1,2,3]));
});
test('wind option cannot be executed without wind, while ordinary route succeeds',()=>{
 const s=fresh();go(s,{type:'depart',region:0,route:0,team:[1],mode:'active',duration:300});const t=s.world.trips[0];t.events[0]='event-0-7';
 // Resolve the exact authored wind event, regardless of ordering in the deck.
 return import('../src/world/narratives.ts').then(({EVENTS})=>{const ev=EVENTS.find(e=>e.choices.some(c=>c.requires?.element==='风'));t.events[0]=ev.id;go(s,{type:'step',id:t.id});const choice=ev.choices.findIndex(c=>c.requires?.element==='风'),before=JSON.stringify(s);assert.equal(execute(s,{type:'tripChoice',id:t.id,choice}).ok,false);assert.equal(JSON.stringify(s),before);go(s,{type:'tripChoice',id:t.id,choice:1-choice});});
});
test('failed challenges record actual failure without success flags or rewards',async()=>{
 const {EVENTS}=await import('../src/world/narratives.ts');const s=fresh();s.slimes[0].level=1;s.world.discoveries=Array.from({length:20},(_,i)=>'d'+i);const ev=EVENTS.find(e=>e.region===5&&e.kind==='挑战');go(s,{type:'depart',region:5,route:0,team:[1],mode:'active',duration:300});const t=s.world.trips[0];t.events[0]=ev.id;go(s,{type:'step',id:t.id});go(s,{type:'tripChoice',id:t.id,choice:0});assert.deepEqual(s.world.trips[0].bag,{});assert.ok(s.world.companions[1].memories.at(-1).text.includes('未能'));assert.equal(s.world.familiar.includes('5:0'),false);
});
test('zero coins, food and seeds recover without combat or a kitchen',()=>{const s=fresh();s.coins=0;for(const k of Object.keys(s.world.stock))s.world.stock[k]=0;go(s,{type:'gather'});assert.equal(s.world.stock.feed,1);assert.equal(s.world.cultivars.find(c=>c.species==='plant-2-0').seeds,1);go(s,{type:'depart',region:0,route:0,team:[1],mode:'active',duration:300});assert.equal(s.world.stock.feed,1);});
test('same participant occupies one district and follows moved facilities without crossing buildings',()=>{
 const s=fresh();s.world.unlocked=[0,1,2,3,4,5];go(s,{type:'assign',slime:1,building:2});advance(s.world,30,s.slimes);const r=s.world.residents[1];assert.ok(r.arrived);assert.equal(r.target,2);const serial=JSON.stringify(s.world.residents[1]);let counts=0;for(let z=0;z<6;z++)counts+=(scene(s.world,z,s.slimes,0,'',()=>'<div class="slime"></div>').match(/data-resident="1"/g)||[]).length;assert.equal(counts,1);
 go(s,{type:'move',id:2,zone:1,x:2,y:2});advance(s.world,30,s.slimes);assert.equal(s.world.residents[1].zone,1);assert.ok(s.world.residents[1].arrived);assert.ok(!blockedCells(s.world,1).has(s.world.residents[1].y*12+s.world.residents[1].x));assert.notEqual(JSON.stringify(s.world.residents[1]),serial);
});
test('paths prefer roads and report unreachable destinations',()=>{const s=fresh(),w=s.world;w.placements=[];w.paths[0]=[12,13,14];const p=route(w,0,0,[2]);assert.deepEqual(p,[1,2]);w.placements=[{id:9,def:'house',zone:0,x:0,y:0,rotation:0,level:1,stored:false}];assert.equal(route(w,0,143,[0]),null);});
test('trough only consumes on arrival and never exceeds capacity; layout changes retain contents',()=>{
 const s=fresh();s.slimes=s.slimes.slice(0,1);s.slimes[0].stamina=10;s.world.stock.feed=200;go(s,{type:'refill'});assert.equal(s.world.inventory.containers.trough.feed,99);const r=resident(s.world,s.slimes[0]);r.x=10;r.y=0;advance(s.world,1,s.slimes);assert.equal(s.world.inventory.containers.trough.feed,99);advance(s.world,30,s.slimes);assert.ok(s.world.inventory.containers.trough.feed<99);const before=s.world.inventory.containers.trough.feed;go(s,{type:'store',id:s.world.placements.find(p=>p.def==='trough').id});advance(s.world,30,s.slimes);assert.equal(s.world.inventory.containers.trough.feed,before);
});
test('elemental ecological effects start when workers arrive at an accessible facility',()=>{
 const s=fresh();const before=environment(s.world,0,6,2,s.slimes).moisture;go(s,{type:'assign',slime:2,building:2});assert.equal(environment(s.world,0,6,2,s.slimes).moisture,before);advance(s.world,30,s.slimes);assert.equal(environment(s.world,0,6,2,s.slimes).moisture,before+10);
});
test('relationship stories cannot borrow unrelated shared experiences',()=>{const s=fresh();record(s.world,s.slimes,'together',[1,3],'trip');record(s.world,s.slimes,'together',[2,3],'meal');const story=startStory(s.world,s.slimes,'pair:pair-0',[1,2]);assert.ok(storyRequirement(s.world,story));record(s.world,s.slimes,'together',[1,2],'work');assert.equal(storyRequirement(s.world,story),null);});
test('stories do not block daily work, but work, travel and games exclude one another',()=>{const s=fresh();go(s,{type:'storyStart',definition:'world:sprout',participants:[1]});go(s,{type:'assign',slime:1,building:2});const before=JSON.stringify(s);assert.equal(execute(s,{type:'miniStart',kind:'observation',actor:1}).ok,false);assert.equal(JSON.stringify(s),before);go(s,{type:'unassign',slime:1});go(s,{type:'miniStart',kind:'observation',actor:1});assert.equal(execute(s,{type:'assign',slime:1,building:2}).ok,false);for(let n=0;n<5;n++)go(s,{type:'miniCell',index:s.world.mini.board[n]});assert.equal(activity(s.world,1).kind,'home');});
test('repeated gift cannot manufacture unlimited intimacy',()=>{const s=fresh();s.world.stock.snack=8;for(let n=0;n<8;n++)go(s,{type:'interact',slime:1,action:'snack'});assert.equal(s.slimes[0].intimacy,1);assert.equal(s.world.stock.snack,0);});
test('collections require familiarity, settle once, release before claiming and keep repeat containers unique',()=>{
 const s=fresh();s.world.stock.feed=10;assert.equal(execute(s,{type:'depart',region:0,route:0,team:[1],mode:'offline',duration:300}).ok,false);const id=outing(s);go(s,{type:'claimTrip',id});go(s,{type:'depart',region:0,route:0,team:[1],mode:'offline',duration:300,repeat:true});advance(s.world,600,s.slimes);assert.ok(validWorld(s.world,[1,2,3]));assert.equal(s.world.trips.length,1);assert.equal(Object.keys(s.world.inventory.containers).filter(k=>k.startsWith('trip:')).length,1);
 go(s,{type:'recall',id:s.world.trips[0].id});assert.equal(activity(s.world,1).kind,'home');const pending=s.world.trips[0].id;go(s,{type:'claimTrip',id:pending});const after=JSON.stringify(s);assert.equal(execute(s,{type:'claimTrip',id:pending}).ok,false);assert.equal(JSON.stringify(s),after);
});
test('V4 validation rejects missing ledgers, malformed stories, orphan containers and activity conflicts',()=>{for(const damage of [w=>delete w.stories,w=>delete w.inventory.containers.trough,w=>w.inventory.items.feed=-1,w=>w.inventory.containers['trip:999']={},w=>w.activities[1]={kind:'battle'},w=>w.stories.invalid={id:'invalid',kind:'world',definition:'world:missing',status:'active',participants:[1],stage:0,baseline:{},choices:[],effects:[]}]){const s=fresh();go(s,{type:'assign',slime:1,building:2});const raw=JSON.parse(JSON.stringify(s.world));damage(raw);assert.equal(validWorld(raw,[1,2,3]),false);}});
test('all six regional stories produce memorials and preserve their bound participant',()=>{for(const zone of ZONES){const s=fresh();s.world.camps=[zone.id];const definition='region:'+zone.id;go(s,{type:'storyStart',definition,participants:[2]});for(const action of ['trip','craft','care']){record(s.world,s.slimes,action,[2],String(zone.id));go(s,{type:'storyChoice',id:definition,choice:0});}assert.equal(s.world.stories[definition].status,'completed');assert.equal(s.world.memorials.length,3);assert.ok(s.world.memorials.every(m=>m.participants[0]===2));}});

test('wish requires the bound partner to cook a meal, and the hollow helper must really travel',async()=>{
 const {tripScene}=await import('../src/world/stories.ts');const s=fresh();go(s,{type:'plant',cultivar:22,zone:0,x:1,y:6,actor:1});go(s,{type:'care',id:s.world.crops[0].id,actor:1});go(s,{type:'interact',slime:1,action:'chat'});go(s,{type:'storyChoice',id:'wish:1',choice:0});
 go(s,{type:'build',def:'kitchen',zone:0,x:8,y:6});const kitchen=s.world.placements.at(-1).id;go(s,{type:'craft',recipe:'feed',building:kitchen,actor:1});advance(s.world,60,s.slimes);go(s,{type:'claimCraft',id:s.world.crafts[0].id});s.world.discoveries=['forest-access'];go(s,{type:'depart',region:1,route:0,team:[1],mode:'active',duration:300});const id=s.world.trips[0].id;
 for(let n=0;n<3;n++){go(s,{type:'step',id});const ev=tripScene(s.world,s.world.trips.find(t=>t.id===id),s.slimes);go(s,{type:'tripChoice',id,choice:ev.choices.findIndex(c=>!choiceProblem(s.world,[s.slimes[0]],c))});}go(s,{type:'step',id});assert.equal(tripScene(s.world,s.world.trips[0],s.slimes).title,'树洞里的一束光');const before=JSON.stringify(s);assert.equal(execute(s,{type:'tripChoice',id,choice:1}).ok,false);assert.equal(JSON.stringify(s),before);go(s,{type:'tripChoice',id,choice:0});assert.match(storyRequirement(s.world,s.world.stories['wish:1']),/制作便当/);
 go(s,{type:'craft',recipe:'simplemeal',building:kitchen,actor:2});advance(s.world,60,s.slimes);go(s,{type:'claimCraft',id:s.world.crafts[0].id});assert.match(storyRequirement(s.world,s.world.stories['wish:1']),/制作便当/);
 go(s,{type:'craft',recipe:'simplemeal',building:kitchen,actor:1});advance(s.world,60,s.slimes);go(s,{type:'claimCraft',id:s.world.crafts[0].id});assert.equal(storyRequirement(s.world,s.world.stories['wish:1']),null);assert.ok(s.world.companions[1].facts.supported>=2);
});

test('unreachable workers cannot water, earn workplace relationships or contribute ecology',()=>{
 const s=fresh();s.world.placements.find(p=>p.id===2).level=2;go(s,{type:'assign',slime:1,building:2});go(s,{type:'assign',slime:2,building:2});go(s,{type:'plant',cultivar:22,zone:0,x:9,y:7,actor:3});s.world.placements.find(p=>p.id===2).level=1;
 for(const [n,x,y] of [[901,1,0],[902,0,1]])s.world.placements.push({id:n,def:'decor-1-0',zone:0,x,y,rotation:0,level:1,stored:false});s.world.seq=1000;
 for(const pet of s.slimes.slice(0,2)){const r=resident(s.world,pet);r.x=0;r.y=0;r.arrived=false;}s.world.crops[0].water=1;advance(s.world,300,s.slimes);
 assert.equal(s.world.residents[1].blocked,true);assert.equal(s.world.crops[0].water,0);assert.equal(s.world.companions[1].facts?.together??0,0);assert.equal(s.world.companions[1].friends[2]??0,0);
});

test('meal costs are atomic, and close friends receive neighbouring reachable seats',()=>{
 const s=fresh();go(s,{type:'build',def:'table',zone:0,x:7,y:7});const table=s.world.placements.at(-1);table.level=2;s.world.stock.meal=2;companion(s.world,s.slimes[0]).friends[3]=80;
 const before=JSON.stringify(s);assert.equal(execute(s,{type:'meal',ids:[1,1]}).ok,false);assert.equal(JSON.stringify(s),before);go(s,{type:'meal',ids:[1,2,3]});assert.equal(s.world.stock.meal,0);
 const a=s.world.residents[1].goal,b=s.world.residents[3].goal;assert.equal(Math.abs(a%12-b%12)+Math.abs(Math.floor(a/12)-Math.floor(b/12)),1);
 advance(s.world,30,s.slimes);for(const id of [1,2,3])assert.equal(s.world.residents[id].arrived,true);
});
