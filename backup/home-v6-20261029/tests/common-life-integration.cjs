'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('史莱姆.html','utf8'),code=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const {boot}=require('./lib/vm-harness.cjs').loadGame('史莱姆.html',code),fixture=JSON.parse(fs.readFileSync('tests/fixtures/save-v3.json','utf8'));
const now=fixture.lastActive,key='slimeSummonerSave';let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name);}
check('V1/V2/V3 migration preserves identity, growth, locks and distinct food accounts',()=>{
 for(const version of [1,2,3]){const d=structuredClone(fixture);d.saveVersion=version;if(version<3)delete d.world;const raw=JSON.stringify(d),h=boot({[key]:raw},{now});assert.equal(h.run('load()'),true);
 assert.equal(h.storage.get('slimeSummonerSave_v3_backup'),raw);const s=h.state();assert.equal(s.saveVersion,4);assert.equal(s.bag.food,17);assert.equal(s.feedTrough,9);assert.equal(s.slimes[0].name,'小芽');assert.ok(s.slimes[1].locked);assert.equal(s.slimes[0].exp,d.slimes[0].exp);assert.equal(s.globalPlan,null);assert.deepEqual([...s.legacyTeamPreset],d.exploreTeam);
 if(version===3){assert.equal(s.world.stock.ingredient,d.world.stock.food);assert.equal(s.world.pending.ingredient,7);assert.equal(s.world.chapters.sprout,6);assert.equal(s.world.stories['world:sprout'].status,'completed');assert.equal(s.world.trips.length,1);assert.deepEqual([...s.world.trips[0].team],d.world.trips[0].team);}
 const saved=h.storage.get(key),re=boot({[key]:saved},{now});assert.ok(re.run('load()'));assert.equal(re.run('save()'),true);assert.equal(re.storage.get(key),saved);
 }
});
check('old auto dispatch settles exactly once before being recalled',()=>{
 const raw=JSON.stringify(fixture),h=boot({[key]:raw},{now:now+3600000});assert.ok(h.run('load()'));assert.ok(h.state().coins>fixture.coins);assert.ok(h.state().slimes[0].level>fixture.slimes[0].level);assert.equal(h.state().globalPlan,null);assert.equal(h.state().slimes[0].resting,false);
 const saved=h.storage.get(key),again=boot({[key]:saved},{now:now+3600000});assert.ok(again.run('load()'));assert.equal(again.state().coins,h.state().coins);assert.equal(again.state().slimes[0].exp,h.state().slimes[0].exp);
});
check('backup failure and migration-write failure preserve the exact old save bytes',()=>{
 for(const target of ['slimeSummonerSave_v3_backup',key]){const raw=JSON.stringify(fixture),h=boot({[key]:raw},{now});const set=h.context.localStorage.setItem;h.context.localStorage.setItem=(k,v)=>{if(k===target)throw new Error('Quota');set(k,v);};assert.equal(h.run('load()'),false);assert.equal(h.storage.get(key),raw);assert.equal(h.run('save()'),false);}
});
check('save retry persists the existing result without repeating the feeding charge or XP',()=>{
 const h=boot({}, {now});h.state().started=true;h.state().slimes=[h.slime()];h.run('load();save()');const feed=h.state().bag.food,exp=h.state().slimes[0].exp,set=h.context.localStorage.setItem;h.context.localStorage.setItem=()=>{throw new Error('Quota');};h.run("LivingWorld.dispatch({type:'interact',slime:S.slimes[0].id,action:'feed'})");assert.equal(h.state().bag.food,feed-1);assert.ok(h.state().slimes[0].exp>exp);const once=h.state().slimes[0].exp;h.run("LivingWorld.dispatch({type:'interact',slime:S.slimes[0].id,action:'feed'})");assert.equal(h.state().bag.food,feed-1);h.context.localStorage.setItem=set;assert.ok(h.run('save()'));assert.equal(h.state().slimes[0].exp,once);assert.equal(h.run('saveRetryNeeded'),false);
});
check('battle refresh safely releases activity without inventing victory',()=>{const h=boot({}, {now}),b=h.battle();h.run('save()');const raw=h.storage.get(key),re=boot({[key]:raw},{now});assert.ok(re.run('load()'));assert.equal(Object.keys(re.state().world.activities).length,0);assert.equal(re.state().coins,h.state().coins);assert.equal(re.state().world.journals.length,0);});
check('queued battle actions pause during a failed save and resume without losing the turn',()=>{
 const h=boot({}, {now}),b=h.battle(['火','水']);b.setDodgeRate(()=>0);b.setCritRate(()=>0);b.B.monsters.forEach(u=>{u.hp=u.maxHp=10000;u.st.rockArmor=u.st.iceArmor=0;});b.nextTurn();
 const set=h.context.localStorage.setItem;h.context.localStorage.setItem=()=>{throw new Error('Quota');};assert.equal(h.run('save()'),false);
 const before=JSON.stringify({coins:h.state().coins,turn:b.B.turn,hp:b.B.monsters.map(u=>u.hp)});
 for(const[id,t]of [...h.timeouts]){h.timeouts.delete(id);t.fn();}
 assert.equal(b.playerBasic(b.B.allies[0],b.B.monsters[0]),false);b.endBattle(false);assert.equal(b.B.ended,false);assert.equal(JSON.stringify({coins:h.state().coins,turn:b.B.turn,hp:b.B.monsters.map(u=>u.hp)}),before);
 h.context.localStorage.setItem=set;assert.ok(h.run('save()'));h.flush(1e9);assert.ok(b.B.monsters.some(u=>u.hp<10000));assert.equal(b.B.resolving,false);b.closeBattle();
});
check('a queued victory waits for save recovery and settles its reward only once',()=>{
 const h=boot({}, {now}),b=h.battle();b.B.monsters.forEach(u=>u.hp=0);b.later(()=>b.endBattle(true),0);const set=h.context.localStorage.setItem;h.context.localStorage.setItem=()=>{throw new Error('Quota');};h.run('save()');const coins=h.state().coins;
 for(const[id,t]of [...h.timeouts]){h.timeouts.delete(id);t.fn();}
 assert.equal(h.state().coins,coins);assert.equal(b.B.ended,false);h.context.localStorage.setItem=set;assert.ok(h.run('save()'));h.flush(1e9);assert.equal(b.B.result.win,true);assert.ok(h.state().coins>coins);const earned=h.state().coins;b.endBattle(true);h.flush(1e9);assert.equal(h.state().coins,earned);assert.equal(h.state().world.companions[h.state().slimes[0].id].facts.battleWin,1);
});
check('fusion retains the primary and archives donor history plus unfinished stories',()=>{
 const h=boot({}, {now});h.state().slimes=[h.slime(),h.slime()];h.state().coins=99999;h.run("LivingWorld.execute(S,{type:'storyStart',definition:'world:sprout',participants:[S.slimes[1].id]});S.world.companions[S.slimes[1].id].memories.push({id:'private',title:'自己的回忆',text:'确实参加',at:0});mergeSel=S.slimes.map(s=>s.id);doMerge();");const s=h.state();assert.equal(s.slimes.length,1);const a=Object.values(s.world.archives)[0];assert.equal(a.profile.memories[0].id,'private');assert.equal(s.world.stories['world:sprout'].status,'archived');assert.equal(s.world.companions[s.slimes[0].id]?.memories.length??0,0);assert.ok(h.run('LivingWorld.validWorld(S.world,S.slimes.map(s=>s.id))'));
});
check('full old layout grants new facilities to storage without moving old objects',()=>{
 const d=structuredClone(fixture);d.world.placements=Array.from({length:144},(_,n)=>({id:1000+n,def:'decor-1-0',zone:0,x:n%12,y:Math.floor(n/12),rotation:0,level:1,stored:false}));d.world.seq=1200;const h=boot({[key]:JSON.stringify(d)},{now});assert.ok(h.run('load()'));assert.equal(h.state().world.placements.filter(p=>['trough','toys'].includes(p.def)&&p.stored).length,2);assert.equal(JSON.stringify(h.state().world.placements.slice(0,144)),JSON.stringify(d.world.placements));assert.equal(h.state().feedTrough,9);
});
check('ready old trip preserves pending cargo and cannot be claimed twice',()=>{
 const d=structuredClone(fixture);d.world.trips[0].ready=true;d.world.trips[0].node=4;d.world.trips[0].bag={food:5,wood:50};const h=boot({[key]:JSON.stringify(d)},{now});assert.ok(h.run('load()'));const id=h.state().world.trips[0].id;assert.equal(h.state().world.trips[0].bag.ingredient,5);const before=h.state().world.stock.ingredient;h.run(`LivingWorld.dispatch({type:'claimTrip',id:${id}})`);assert.equal(h.state().world.stock.ingredient,before+5);const after=h.run('JSON.stringify(S)');h.run(`LivingWorld.dispatch({type:'claimTrip',id:${id}})`);assert.equal(h.run('JSON.stringify(S)'),after);
});
check('existing backup is preserved and a different imported save gets its own exact backup',()=>{
 const raw=JSON.stringify(fixture),old=JSON.stringify({...fixture,coins:fixture.coins+1}),h=boot({[key]:raw,slimeSummonerSave_v3_backup:old},{now});assert.ok(h.run('load()'));assert.equal(h.storage.get('slimeSummonerSave_v3_backup'),old);assert.ok([...h.storage.entries()].some(([k,v])=>k.startsWith('slimeSummonerSave_v3_backup_')&&v===raw));
});
check('visual randomness cannot change summoned attributes or the saved gameplay random sequence',()=>{
 const a=boot({}, {now}),b=boot({}, {now});for(const h of [a,b])h.run('S.world=LivingWorld.createWorld(345);gameRandom=()=>LivingWorld.gameRandom(S);');b.run('for(let n=0;n<2000;n++)Math.random();');const sa=a.slime(),sb=b.slime();assert.equal(JSON.stringify(sa),JSON.stringify(sb));assert.equal(a.state().world.rng,b.state().world.rng);
});
check('V4 rejects a second legacy inventory instead of importing it twice',()=>{
 const h=boot({}, {now});h.state().started=true;h.state().slimes=[h.slime()];h.run('save()');const d=JSON.parse(h.storage.get(key));d.bag={food:12};const raw=JSON.stringify(d),re=boot({[key]:raw},{now});assert.equal(re.run('load()'),false);assert.equal(re.run('save()'),false);assert.equal(re.storage.get(key),raw);
});
check('sweep cannot borrow a working companion and records its real participants once',()=>{
 const h=boot({}, {now});h.state().started=true;h.state().slimes=[h.slime()];h.run("ensureProgress().abyssClears[1]=true;S.lastAbyssSel=S.slimes.map(s=>s.id);LivingWorld.execute(S,{type:'assign',slime:S.slimes[0].id,building:2});");const coins=h.state().coins;assert.equal(h.run('sweepAbyss()'),false);assert.equal(h.state().coins,coins);h.run("LivingWorld.execute(S,{type:'unassign',slime:S.slimes[0].id});");assert.equal(h.run('sweepAbyss()'),true);assert.equal(h.state().world.companions[h.state().slimes[0].id].facts.battleWin,1);assert.equal(h.run('LivingWorld.isBusy(S,S.slimes[0].id)'),false);
});
console.log(`RESULT ${count}/${count} shared-life integration checks`);
