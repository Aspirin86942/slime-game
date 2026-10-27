// Native game boundary checks use the same compiled HTML as the player.
const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('史莱姆.html','utf8');
const code=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const {boot}=require('./lib/vm-harness.cjs').loadGame('史莱姆.html',code);
let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name);}
check('each elemental pairing is wired to actual battle actions',()=>{
 const combos=[['水','草'],['火','水'],['水','雷'],['火','风'],['冰','岩'],['草','光'],['暗','幻'],['时间','空间']];
 for(const elements of combos){const h=boot(),b=h.battle(elements);b.B.allies.forEach(u=>u.hp=Math.floor(u.maxHp/2));const a=b.B.allies[0],target=b.B.monsters[0];assert.equal(b.playerCast(a,target),true);assert.equal(b.B.comboUsed.ally,true,elements.join('+'));const result=b.B.allies.map(u=>u.hp);a.acted=false;a.cd={};b.playerCast(a,target);assert.equal(b.B.comboUsed.ally,true);assert.ok(result.every(Number.isFinite));}
});
check('world ownership blocks direct native battle and merge',()=>{const h=boot();const s=h.slime(),t=h.slime();h.state().slimes=[s,t];h.state().world.workers=[{slimeId:s.id,building:2}];h.run('abyssSetupSel=[S.slimes[0].id];startAbyssBattle();');assert.equal(h.context.__TEST__._battle,undefined);assert.equal(h.run('mergePreview(S.slimes[0],S.slimes[1]).valid'),false);});
check('story residents preserve the original summon allowance',()=>{const h=boot();h.state().slimes=[h.slime(),h.slime()];const base=h.run('getSlots()');h.state().world.recruited.sprout=h.state().slimes[0].id;assert.equal(h.run('getSlots()'),base+1);h.run('doSummon()');assert.equal(h.state().slimes.length,3);});
check('v2 migration preserves raw original and creature identity',()=>{const h=boot(),s=h.slime();h.state().slimes=[s];const old=JSON.parse(JSON.stringify(h.state()));old.saveVersion=2;delete old.world;const raw=JSON.stringify(old),loaded=boot({slimeSummonerSave:raw});assert.equal(loaded.run('load()'),true);assert.equal(loaded.storage.get('slimeSummonerSave_v2_backup'),raw);assert.equal(loaded.state().slimes[0].id,s.id);assert.equal(loaded.run('save()'),true);assert.equal(JSON.parse(loaded.storage.get('slimeSummonerSave')).saveVersion,3);});
check('same-origin conflicting save prevents overwrite',()=>{const h=boot();h.run('load();save();');const old=h.storage.get('slimeSummonerSave');h.storage.set('slimeSummonerSave','another-tab');assert.equal(h.run('save()'),false);assert.equal(h.run('storageConflict'),true);assert.equal(h.storage.get('slimeSummonerSave'),'another-tab');assert.ok(old);});
check('save conflict freezes active combat as well as the world clock',()=>{const h=boot(),b=h.battle(['火','水']),before=b.B.monsters.map(u=>u.hp),turn=b.B.turn;h.run('storageConflict=true;');b.nextTurn();b.performAction(b.B.allies[0],'ally');assert.equal(b.playerCast(b.B.allies[0],b.B.monsters[0]),false);assert.equal(b.B.turn,turn);assert.deepEqual(b.B.monsters.map(u=>u.hp),before);});
check('corrupt world and future versions preserve original bytes',()=>{for(const mutate of [s=>s.saveVersion=9,s=>s.world.cultivars[0].species='missing',s=>s.world.mini={kind:'observation',board:[]}]){const h=boot(),s=JSON.parse(JSON.stringify(h.state()));mutate(s);const raw=JSON.stringify(s),bad=boot({slimeSummonerSave:raw});assert.equal(bad.run('load()'),false);assert.equal(bad.run('save()'),false);assert.equal(bad.storage.get('slimeSummonerSave'),raw);}});
console.log(`RESULT ${count}/${count} integration checks`);
