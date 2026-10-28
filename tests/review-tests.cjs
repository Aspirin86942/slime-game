#!/usr/bin/env node
'use strict';
/** Independent deterministic regression checks.
 * Executes real inline game JavaScript in Node's VM with inert DOM/timer adapters.
 * NOT browser, screenshot, CSS layout, input, animation, or performance testing.
 * The adapters suppress presentation callbacks only; tested rules are game code.
 * Usage（在项目根目录运行）: node tests/review-tests.cjs [史莱姆.html]
 * 对照基线：tests/baseline-original.html（升级前原稿，只用于「造型未被改造」比对）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', '史莱姆.html'));
const html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const original = fs.readFileSync(path.join(__dirname, 'baseline-original.html'), 'utf8').replace(/\r\n/g, '\n');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const code = scripts.join('\n');
const results = [];
function check(name, fn) {
  try { fn(); results.push({name, status:'PASS'}); console.log('PASS ' + name); }
  catch (error) { results.push({name, status:'FAIL', error:error.message}); console.error('FAIL ' + name + ': ' + error.message); }
}
const {boot} = require('./lib/vm-harness.cjs').loadGame(file, code);
function namedFunction(source,name) {
  const start=source.indexOf('function '+name+'(');
  assert.ok(start>=0,'Missing '+name);
  const end=source.indexOf('\n}',start)+2;
  assert.ok(end>start,'Cannot locate end of '+name);
  return source.slice(start,end).trim();
}
check('syntax: all inline game scripts compile',()=>{scripts.forEach((s,i)=>new vm.Script(s,{filename:'inline-'+i+'.js'}));});
check('baseline protection: 基线原稿保持逐字节不变（防止被就地改写而「测试恒过」）',()=>{
  const hash = require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'baseline-original.html'))).digest('hex');
  assert.equal(hash,'60a7b01f21ac6707a399bcb461b233016e9cbae5bfedff20aa36352bf864d6f4');
});
check('creature rendering functions retain original visual markup',()=>{
  for(const name of ['slimeHTMLFromColor','slimeHTML'])assert.equal(namedFunction(html,name),namedFunction(original,name),name+' changed');
});
check('harness: real game state and creature constructors initialize',()=>{
  const h=boot();const s=h.slime();assert.ok(s.id);assert.ok(s.hp>0);assert.ok(s.str>0);assert.equal(h.state().coins,2000);
});

check('creature CSS: original body, expressions and elemental appearance rules preserved',()=>{
  const body = source => source.slice(source.indexOf('.slime{--sz:1;'),source.indexOf('\n.mon-badge{'));
  assert.ok(body(original).length>2000);
  assert.equal(body(html),body(original));
});
check('offline: no remote script/style/image/font dependency introduced',()=>{
  assert.equal(/<(?:script|link|img)\b[^>]*(?:src|href)\s*=\s*["']https?:\/\//i.test(html),false);
  assert.equal(/@import\s+(?:url\()?\s*["']?https?:/i.test(html),false);
});
check('defeat: zero enemy kills grants zero coins, creature XP and summoner XP',()=>{
  const h=boot(),b=h.battle();b.B.allies.forEach(x=>x.hp=0);
  const before={coins:h.state().coins,xp:h.state().slimes.map(x=>x.exp),summoner:h.state().summonerExp};
  b.endBattle(false);
  assert.equal(h.state().coins,before.coins);
  assert.deepEqual(Array.from(h.state().slimes,x=>x.exp),Array.from(before.xp));
  assert.equal(h.state().summonerExp,before.summoner);
  b.B.allies.forEach(x=>assert.ok(x.hp>0,'Post-battle recovery remains present'));
});
check('defeat: only defeated enemies contribute partial rewards, repeated settlement is inert',()=>{
  const h=boot(),b=h.battle();b.B.monsters[0].hp=0;b.B.allies.forEach(x=>x.hp=0);
  const expected=Math.round(Math.floor((40+b.B.monsters[0].ref.level*30)*0.25)*2.5),before=h.state().coins;
  b.endBattle(false);assert.equal(h.state().coins-before,expected);
  const after=h.state().coins;b.endBattle(false);assert.equal(h.state().coins,after);
});
check('rewards: recipient snapshot excludes knocked-out allies before post-battle healing',()=>{
  const h=boot(),b=h.battle();b.B.monsters.forEach(x=>x.hp=0);b.B.allies[0].hp=0;b.B.allies[1].hp=5;
  // Record allocations without changing reward selection or settlement code.
  h.run('window.__awards=[];addExp=(s,n)=>window.__awards.push({id:s.id,n});');
  b.endBattle(true);
  assert.equal(h.context.__awards.some(x=>x.id===b.B.allies[0].ref.id),false);
  assert.ok(h.context.__awards.some(x=>x.id===b.B.allies[1].ref.id&&x.n>0));
  assert.ok(b.B.allies[0].hp>0,'Healing is subsequent to reward recipient selection');
});
check('abyss: direct attempt cannot start above the unlocked level',()=>{
  const h=boot();const s=h.slime();h.state().slimes=[s];h.state().started=true;
  h.run('S.abyssLevel=50;abyssSetupSel=[S.slimes[0].id];startAbyssBattle();');
  const b=h.context.__TEST__._battle;
  if(b){assert.ok(b.B.monsters.every(m=>m.ref.level<=1));assert.equal(h.state().abyssLevel,1);}
});
for(const stamina of [1,19])check(`collection: stamina ${stamina} enters rest and eventually resumes`,()=>{
 const h=boot(),s=h.slime({stamina,mood:100});Object.assign(h.state(),{started:true,slimes:[s]});
 h.run("S.world.familiar=['0:0'];S.world.stock.feed=10;LivingWorld.execute(S,{type:'depart',region:0,route:0,team:[S.slimes[0].id],mode:'offline',duration:300});advanceWorld(1,true);");
 assert.equal(h.state().world.trips[0].resting,true);let n=0;while(h.state().world.trips[0].resting&&n++<400)h.run('advanceWorld(1,true)');
 assert.equal(h.state().world.trips[0].resting,false);h.run('advanceWorld(12,true)');assert.ok(h.state().world.trips[0].coins>0);
});
for(const mode of ['home','ball','stack'])check(`collection: another partner can stay in ${mode} while travel progresses`,()=>{
 const h=boot(),s=h.slime({stamina:100,mood:100}),home=h.slime();Object.assign(h.state(),{started:true,slimes:[s,home]});
 h.run("S.world.familiar=['0:0'];S.world.stock.feed=10;LivingWorld.execute(S,{type:'depart',region:0,route:0,team:[S.slimes[0].id],mode:'offline',duration:300});");
 if(mode!=='home')assert.equal(h.run("LivingWorld.reserve(S,[S.slimes[1].id],'play')"),true);
 h.run('advanceWorld(12,true)');assert.equal(s.stamina,80);assert.ok(h.state().world.trips[0].coins>0);
});
check('growth: zero XP does not manufacture summoner XP',()=>{
  const h=boot(),s=h.slime({wit:0});const before=h.state().summonerExp;h.context.pet=s;
  h.run('addExp(pet,0)');assert.equal(h.state().summonerExp,before);assert.equal(s.exp,0);
});
check('growth: large XP consumes all earned levels using the unified formula',()=>{
  const h=boot(),s=h.slime({wit:0});h.context.pet=s;
  const before={str:s.str,agi:s.agi,mag:s.mag};
  h.run('addExp(pet,slimeExpNeed(1)+slimeExpNeed(2)+1)');
  assert.equal(s.level,3);assert.equal(s.exp,1);
  for(const stat of ['str','agi','mag'])assert.equal(s[stat],before[stat]+2*Math.round(s[stat+'Potential']*.5));
});
check('merge: insufficient coins has no mutation or donor consumption',()=>{
  const h=boot(),a=h.slime(),b=h.slime();Object.assign(h.state(),{slimes:[a,b],coins:0});h.run('mergeSel=S.slimes.map(x=>x.id)');
  const before=h.run('JSON.stringify(S)');h.run('doMerge()');assert.equal(h.run('JSON.stringify(S)'),before);
});
check('merge: locked donor cannot be consumed even by direct confirmation',()=>{
  const h=boot(),a=h.slime(),b=h.slime({locked:true});Object.assign(h.state(),{slimes:[a,b],coins:100000});h.run('mergeSel=S.slimes.map(x=>x.id)');
  const before=h.run('JSON.stringify(S)');h.run('doMerge()');assert.equal(h.run('JSON.stringify(S)'),before);
});
check('merge: primary identity, affinity, XP and assignment survive; donor removed once',()=>{
  const h=boot(),a=h.slime({name:'Beloved',intimacy:123,exp:7,locked:true}),b=h.slime();
  Object.assign(h.state(),{slimes:[a,b],coins:100000,customPlans:{[a.id]:{type:'explore'}}});
  h.run('mergeSel=S.slimes.map(x=>x.id)');const cost=h.run('mergeCost(S.slimes[0],S.slimes[1])');const coins=h.state().coins;
  h.run('doMerge()');assert.equal(h.state().slimes.length,1);const m=h.state().slimes[0];
  for(const key of ['id','name','intimacy','exp','locked'])assert.equal(m[key],a[key],key);
  assert.equal(h.state().customPlans[a.id]?.type,'explore');assert.equal(h.state().coins,coins-cost);
  const after=h.state().coins;h.run('doMerge()');assert.equal(h.state().coins,after);
});
check('merge: same-level no-mutation result cannot inflate stats and preview is deterministic',()=>{
  const h=boot(),a=h.slime({level:5,str:999,agi:1000,mag:1001}),b=h.slime({level:5});
  Object.assign(h.state(),{slimes:[a,b],coins:100000});h.context.pet=a;
  const before=h.run('JSON.stringify(S)');const p1=h.run('JSON.stringify(mergePreview(S.slimes[0],S.slimes[1]))');const p2=h.run('JSON.stringify(mergePreview(S.slimes[0],S.slimes[1]))');
  assert.equal(p1,p2);assert.equal(h.run('JSON.stringify(S)'),before,'Preview must not mutate state');
  const stats=[a.str,a.agi,a.mag];h.run('mergeSel=S.slimes.map(x=>x.id);doMerge()');
  assert.deepEqual(Array.from(h.state().slimes,s=>[s.str,s.agi,s.mag]),[stats]);
});
check('migration: legacy data gains one immutable backup and repeat loads preserve earned stats',()=>{
  const seed=boot(),s=seed.slime({level:30,str:999,agi:998,mag:997,intimacy:123});
  const legacy=JSON.parse(seed.run('JSON.stringify(S)'));Object.assign(legacy,{started:true,slimes:[s],abyssLevel:50});delete legacy.saveVersion;delete legacy.version;
  const raw=JSON.stringify(legacy);const h=boot({slimeSummonerSave:raw});
  assert.equal(h.run('load()'),true);assert.equal(h.storage.get('slimeSummonerSave_v1_backup'),raw);
  assert.equal(h.state().slimes[0].str,999);assert.equal(h.state().slimes[0].intimacy,123);
  assert.equal(h.run('getAbyssUnlocked()'),1,'Old selected level is not proof of earned victory');
  // lastActive 是每次存档时写入的时间戳（离线收益用），不属于「已获得的进度」，比较时去掉
  const stable=k=>{const d=JSON.parse(h.storage.get(k));assert.ok(d.lastActive>0);delete d.lastActive;return JSON.stringify(d);};
  h.run('save()');const saved=stable('slimeSummonerSave');assert.equal(h.run('load()'),true);h.run('save()');
  assert.equal(stable('slimeSummonerSave'),saved);assert.equal(h.storage.get('slimeSummonerSave_v1_backup'),raw);
});
for(const corruption of ['coins','level','size','duplicateId'])check(`migration: invalid ${corruption} blocks writes without losing original data`,()=>{
  const seed=boot(),pet=seed.slime();const d=JSON.parse(seed.run('JSON.stringify(S)'));Object.assign(d,{started:true,slimes:[pet]});
  if(corruption==='coins')d.coins='broken';
  if(corruption==='level')d.slimes[0].level='9';
  if(corruption==='size')d.slimes[0].size='large';
  if(corruption==='duplicateId')d.slimes.push({...pet,name:'Duplicate identity'});
  const raw=JSON.stringify(d),h=boot({slimeSummonerSave:raw});
  assert.equal(h.run('load()'),false,'Invalid supplied state must not be loaded as a good save');
  h.run('save()');assert.equal(h.storage.get('slimeSummonerSave'),raw);
});
check('migration: malformed JSON is not silently replaced by a later auto-save',()=>{
  const raw='{broken but recoverable source';const h=boot({slimeSummonerSave:raw});
  assert.equal(h.run('load()'),false);h.run('save()');assert.equal(h.storage.get('slimeSummonerSave'),raw);
});


check('onboarding: unfinished name/customization save survives reload and remains writable',()=>{
  const h=boot();Object.assign(h.state(),{started:false,name:'Returning',sysName:'Companion'});h.run('save()');
  const raw=h.storage.get('slimeSummonerSave'),reload=boot({slimeSummonerSave:raw});
  assert.equal(reload.run('load()'),true);assert.equal(reload.state().started,false);
  assert.equal(reload.state().name,'Returning');assert.equal(reload.state().sysName,'Companion');assert.equal(reload.run('save()'),true);
});
check('onboarding: finishing twice or after reloading cannot duplicate starter points',()=>{
  const h=boot();h.run('finishStory()');const points=h.state().points;assert.equal(points,200);
  h.run('finishStory()');assert.equal(h.state().points,points);
  const reload=boot({slimeSummonerSave:h.storage.get('slimeSummonerSave')});reload.run('load();finishStory()');assert.equal(reload.state().points,points);
});
check('enemy intent: actual target remains locked when RNG changes before execution',()=>{
  const h=boot(),b=h.battle(['火','火']);const enemy=b.B.monsters[0];enemy.ref.element='火';enemy.ref.skill='元素弹';
  b.B.allies.forEach(a=>{a.hp=10000;a.maxHp=10000;a.st.rockArmor=0;a.st.iceArmor=0;});
  b.B.turn=1;h.context.Math.random=()=>0;b.queueEnemyIntents();const intent=enemy.intent;const targetId=intent.targetId;
  h.context.Math.random=()=>0.99;b.setDodgeRate(()=>0);b.setCritRate(()=>0);b.performAction(enemy,'enemy');
  assert.equal(enemy.intent,intent);assert.equal(intent.targetId,targetId);assert.equal(intent.state,'done');
  assert.ok(b.B.allies.find(a=>a.ref.id===targetId).hp<10000);assert.equal(b.B.allies.find(a=>a.ref.id!==targetId).hp,10000);
});
check('enemy intent: frozen actor cancels queued attack without damaging its target',()=>{
  const h=boot(),b=h.battle(['火','火']);const enemy=b.B.monsters[0];enemy.ref.skill='元素弹';b.B.turn=1;b.queueEnemyIntents();const q=enemy.intent;
  const before=b.B.allies.map(a=>a.hp);enemy.st.frozen=1;b.performAction(enemy,'enemy');
  assert.equal(q.state,'canceled');assert.deepEqual(Array.from(b.B.allies,a=>a.hp),Array.from(before));
});
check('enemy intent: dead target is explicitly replaced and replacement receives the action',()=>{
  const h=boot(),b=h.battle(['火','火']);const enemy=b.B.monsters[0];enemy.ref.element='火';enemy.ref.skill='元素弹';b.B.turn=1;b.queueEnemyIntents();
  const oldId=enemy.intent.targetId;b.B.allies.find(a=>a.ref.id===oldId).hp=0;const survivor=b.B.allies.find(a=>a.ref.id!==oldId);survivor.hp=10000;survivor.maxHp=10000;
  b.setDodgeRate(()=>0);b.setCritRate(()=>0);b.performAction(enemy,'enemy');assert.equal(enemy.intent.targetId,survivor.ref.id);assert.ok(survivor.hp<10000);
});
check('goals: premature claims fail and first-clear reward cannot be claimed twice or after reload',()=>{
  const h=boot();h.state().started=true;assert.equal(h.run("claimProgressGoal('abyss-first')"),false);
  const b=h.battle();b.B.monsters.forEach(m=>m.hp=0);b.endBattle(true);
  const coins=h.state().coins,points=h.state().points;assert.equal(h.run("claimProgressGoal('abyss-first')"),true);
  assert.equal(h.state().coins-coins,400);assert.equal(h.state().points-points,5);assert.equal(h.run("claimProgressGoal('abyss-first')"),false);
  const reload=boot({slimeSummonerSave:h.storage.get('slimeSummonerSave')});reload.run('load()');assert.equal(reload.run("claimProgressGoal('abyss-first')"),false);
});
for(const id of ['shield','control','cleanse'])check(`teaching ${id}: actual required skill enables victory, rewards are one-time and loan stays separate`,()=>{
  const h=boot();h.state().started=true;const pet=h.slime({name:'Owned pet'});h.state().slimes=[pet];h.state().battleMode='auto';
  const owned=JSON.stringify(pet),coins=h.state().coins,xp=h.state().summonerExp;
  h.run(`startTrainingChallenge('${id}')`);const b=h.context.__TEST__._battle;assert.ok(b);assert.equal(b.B.training,true);assert.equal(b.B.trainingMode,'step');assert.equal(h.state().battleMode,'auto');
  const ally=b.B.allies[0],enemy=b.B.monsters[0];
  b.nextTurn();assert.equal(b.playerCast(ally,enemy),true);if(b.B._pauseResume)b.B._pauseResume();h.flush();
  assert.equal(b.B.practiceUsed[id],true,'Required mechanic must be genuinely exercised');
  let rounds=0;
  while(b.B.running&&rounds++<12){b.nextTurn();if(!b.B.running)break;if(ally.hp>0&&enemy.hp>0)b.playerBasic(ally,enemy);if(b.B._pauseResume)b.B._pauseResume();h.flush();}
  assert.equal(b.B.running,false,'Challenge must reach a terminal state');assert.equal(h.run(`!!ensureProgress().challengeClears['${id}']`),true,'Skill-first strategy should win');
  assert.equal(h.state().coins,coins);assert.equal(h.state().summonerExp,xp);assert.equal(JSON.stringify(pet),owned);assert.equal(h.state().slimes.length,1);
  assert.equal(h.run(`claimProgressGoal('training-${id}')`),true);const after=h.state().coins;assert.equal(h.run(`claimProgressGoal('training-${id}')`),false);assert.equal(h.state().coins,after);
  b.closeBattle();assert.equal(h.state().battleMode,'auto');
});


check('rewards: captured defeated enemies remain in the immutable reward ledger',()=>{
  const h=boot(),b=h.battle();const enemy=b.B.monsters[0];enemy.hp=0;assert.ok(b.B.rewardMonsters.includes(enemy));
  // Equivalent roster mutation to capture; retained ledger must still settle this kill.
  b.B.monsters=b.B.monsters.filter(m=>m!==enemy);b.B.allies.forEach(a=>a.hp=0);const before=h.state().coins;b.endBattle(false);
  // 第 1 层敌人经验 40+30×1=70，失败取 25% → 17，晶币 ×2.5 → 43
  assert.equal(h.state().coins-before,43);assert.equal(b.B.result.defeatedCount,1);
});
check('battle: repeated start while overlay exists cannot duplicate roster/sequence',()=>{
  const h=boot(),b=h.battle();const seq=h.state().seq;h.run('startAbyssBattle()');assert.equal(h.context.__TEST__._battle,b);assert.equal(h.state().seq,seq);
});
check('companion home: default tab, target navigation and themes in settings',()=>{
  const h=boot();assert.equal(h.run('activeTab'),'home');const content=h.run('LivingWorld.render()');
  assert.ok(content.includes('lw-map'));assert.ok(content.includes('data-page="summon"'));assert.ok(!content.includes('theme-row'));
  h.run('openModal=html=>window.__settingsHTML=html;openSettings()');assert.ok(h.context.__settingsHTML.includes('theme-row'));
});
check('companionship: affinity thresholds unlock visible existing-expression responses without battle',()=>{
  const h=boot(),s=h.slime({intimacy:0});h.context.pet=s;const initial=h.run('bondMilestone(pet)');s.intimacy=10000;const max=h.run('bondMilestone(pet)');
  assert.ok(max.need>initial.need);assert.notEqual(max.name,initial.name);assert.ok(h.run('renderSpace()').includes('lw-map'));
});

check('migration: missing individual legacy fields fill safely without replacing earned values or reusing IDs',()=>{
  const raw=JSON.stringify({started:true,slimes:[{id:1,name:'Old friend',element:'火',level:3,str:123,agi:234,mag:345,agiPotential:29,magPotential:30}],monsters:[]});
  const h=boot({slimeSummonerSave:raw});assert.equal(h.run('load()'),true);const s=h.state().slimes[0];
  assert.equal(s.strPotential,10);assert.equal(s.agiPotential,29);assert.equal(s.magPotential,30);assert.deepEqual([s.str,s.agi,s.mag],[123,234,345]);assert.equal(s.exp,0);assert.ok(h.slime().id>1);
});
check('diagnostics: selftest mode neither overwrites player progress nor creates migration backup',()=>{
  const seed=boot();const d=JSON.parse(seed.run('JSON.stringify(S)'));d.started=true;delete d.saveVersion;const raw=JSON.stringify(d);
  const h=boot({slimeSummonerSave:raw},{search:'?selftest=1'});assert.equal(h.run('load()'),true);h.state().coins=999999;h.run('save()');
  assert.equal(h.storage.get('slimeSummonerSave'),raw);assert.equal(h.storage.has('slimeSummonerSave_v1_backup'),false);
});
check('collection: merging before visiting goal UI still preserves consumed element history',()=>{
  const h=boot(),a=h.slime({element:'火'}),b=h.slime({element:'水'});Object.assign(h.state(),{slimes:[a,b],coins:100000});
  h.run('mergeSel=S.slimes.map(x=>x.id);doMerge()');assert.equal(h.state().slimes.length,1);assert.equal(h.run('ensureProgress().collected["火"]'),true);assert.equal(h.run('ensureProgress().collected["水"]'),true);
});
check('region goal: requires three trips per region and grants exactly one reward',()=>{
  const h=boot();assert.equal(h.run("claimProgressGoal('regions')"),false);
  for(let i=0;i<3;i++)for(let n=0;n<3;n++)h.run(`recordRegionExplore(${i})`);
  const coins=h.state().coins,treasure=h.state().bag.treasure;assert.equal(h.run("claimProgressGoal('regions')"),true);
  assert.equal(h.state().coins-coins,600);assert.equal(h.state().bag.treasure-treasure,2);assert.equal(h.run("claimProgressGoal('regions')"),false);
});
check('teaching: victory without using required mechanism never unlocks a claim',()=>{
  for(const id of ['shield','control','cleanse']){const h=boot();h.state().started=true;h.run(`startTrainingChallenge('${id}')`);const b=h.context.__TEST__._battle;
    b.B.monsters.forEach(m=>m.hp=0);const coins=h.state().coins;b.endBattle(true);assert.equal(h.state().coins,coins);assert.equal(h.run(`claimProgressGoal('training-${id}')`),false);}
});
check('companionship: petting unlocks a milestone with 30-second repeat guard, no combat required',()=>{
  const h=boot(),s=h.slime({intimacy:4});h.context.pet=s;const gained=h.run('gainCompanionIntimacy(pet,100000)');
  assert.equal(gained.gained,true);assert.equal(s.intimacy,5);assert.equal(gained.bond.need,5);
  assert.equal(h.run('gainCompanionIntimacy(pet,110000).gained'),false);assert.equal(s.intimacy,5);
  assert.equal(h.run('gainCompanionIntimacy(pet,130000).gained'),true);assert.equal(s.intimacy,6);assert.equal(h.state().summonerExp,0);
});
check('battle feedback: ordinary hit avoids whole-scene shake; critical hit gets stronger signal',()=>{
  const h=boot(),b=h.battle();const actor=b.B.allies[0];b.B.monsters.forEach(m=>{m.hp=10000;m.maxHp=10000;m.st.rockArmor=0;m.st.iceArmor=0;m.ref.element='火';});
  b.setDodgeRate(()=>0);b.setCritRate(()=>0);h.run("FX._shakeKind='';FX._shakeRank=0");b.performAction(actor,'ally');assert.equal(h.run('FX._shakeKind'),'');
  actor.acted=false;b.setCritRate(()=>1000);b.performAction(actor,'ally');assert.equal(h.run('FX._shakeKind'),'crit');
});
check('scene structure: three regions use distinct local SVG landmarks',()=>{
  const h=boot();const svgs=[0,1,2].map(i=>h.run(`mapLandmarks(MAP_THEMES[${i}])`));
  assert.equal(new Set(svgs).size,3);svgs.forEach(svg=>{assert.ok(svg.includes('<svg'));assert.ok(svg.includes('landmark-front'));assert.ok(svg.includes('landmark-back'));assert.equal(/https?:\/\//.test(svg),false);});
});

check('combat: physical and magical attacks respond to the matching attribute and defense',()=>{
  const h=boot(),s=h.slime({element:'火',str:10,mag:40,level:10});h.context.pet=s;
  const before=h.run('attackPower(pet)');s.str=100;assert.equal(h.run('attackPower(pet)'),before);
  s.mag=80;assert.ok(h.run('attackPower(pet)')>before);
  s.element='岩';assert.equal(h.run('attackPower(pet)'),h.run('physAtk(pet)'));
  const target=h.slime({str:20,mag:20});h.context.target=target;
  const light=h.run('mitigation(pet,target)');target.str=200;assert.ok(h.run('mitigation(pet,target)')<light);
  s.element='火';const magic=h.run('mitigation(pet,target)');target.mag=200;assert.ok(h.run('mitigation(pet,target)')<magic);
});
check('combat: speed ordering preserves formation and follow-up has an exact threshold with no element proc',()=>{
  const h=boot(),b=h.battle(['火','水']);h.run('S.battleMode="interject";atkSpeed=s=>s.agi;');
  const [a,c]=b.B.allies,t=b.B.monsters[0];a.ref.agi=129;c.ref.agi=200;t.ref.agi=100;
  assert.deepEqual(b.bySpeed(b.B.allies).map(u=>u.ref.id),[c.ref.id,a.ref.id]);assert.equal(b.B.allies[0],a);
  b.setDodgeRate(()=>0);b.setCritRate(()=>0);t.ref.element='水';t.hp=t.maxHp=10000;t.st.rockArmor=t.st.iceArmor=0;
  b.tryFollowUp(a,t);assert.equal(t.hp,10000);
  a.ref.agi=130;b.tryFollowUp(a,t);assert.ok(t.hp<10000);assert.equal(t.minis.length,0);assert.equal(t.st.burn,0);
});
check('combat: auto mode casts ready skills once, respects cooldown, and heals only when needed',()=>{
  const h=boot(),b=h.battle(['火','水']),[fire,water]=b.B.allies;
  b.setDodgeRate(()=>0);b.setCritRate(()=>0);
  b.B.monsters.forEach(u=>{u.ref.element='火';u.hp=u.maxHp=10000;u.st.rockArmor=u.st.iceArmor=0;});
  b.performAction(fire,'ally');assert.equal(fire.cd['火'],3);assert.equal(fire.acted,true);
  const hp=b.B.monsters.map(u=>u.hp);b.performAction(fire,'ally');assert.deepEqual(b.B.monsters.map(u=>u.hp),hp);
  assert.equal(b.autoCast(water),false);fire.hp=1;
  assert.equal(b.autoCast(water),true);assert.ok(fire.hp>1);assert.equal(water.cd['水'],3);
  water.acted=false;assert.equal(b.autoCast(water),false);
});
check('combat: healing teams finish without an endless full-health loop',()=>{
  const h=boot(),b=h.battle(['水','水']);
  b.B.allies.concat(b.B.monsters).forEach(u=>{u.ref.element='水';u.ref.skill='治疗';u.st.rockArmor=u.st.iceArmor=0;});
  for(let i=0;i<200 && !b.B.ended;i++){b.nextTurn();h.flush(1e9);}
  assert.ok(b.B.ended);assert.ok(b.B.turn<200);
});
check('boss: every fifth floor has one durable leader and keeps its escorts',()=>{
  const h=boot();Object.assign(h.state(),{abyssLevel:25,abyssUnlocked:25});const b=h.battle();
  assert.equal(b.B.monsters.length,4);assert.equal(b.B.monsters.filter(u=>u.ref.isBoss).length,1);
  const boss=b.B.monsters[0];assert.equal(boss.maxHp,h.run('hpMax')(boss.ref)*3);
  const normal=h.run('makeAbyssMonster(24,false)');assert.equal(normal.isBoss,undefined);
  assert.equal(normal.str,h.run('growthStat')(normal.strPotential,24));
});
check('bonds: matching elements boost attacks and diverse teams boost current and maximum health',()=>{
  const h=boot(),b=h.battle(['火','火','火','岩','水']);
  assert.equal(b.B.allies[0].atkMul,1.2);assert.equal(b.B.allies[3].atkMul,1);
  assert.equal(b.unitAttack(b.B.allies[0]),Math.round(h.run('attackPower')(b.B.allies[0].ref)*1.2));
  b.closeBattle();h.state().slimes[1].element='风';h.state().slimes[2].element='草';
  h.run('startAbyssBattle()');const next=h.context.__TEST__._battle;
  next.B.allies.forEach(u=>{assert.equal(u.maxHp,Math.round(h.run('hpMax')(u.ref)*1.1));assert.equal(u.hp,u.maxHp);});
});
check('battle roster: resting explorers must be recalled, captured monsters and excess members stay out',()=>{
  const h=boot(),S=h.state(),s=h.slime({resting:true,stamina:1});Object.assign(S,{started:true,globalPlan:'explore',slimes:[s]});
  h.run('abyssSetupSel=[S.slimes[0].id];startAbyssBattle()');assert.equal(h.context.__TEST__._battle,undefined);
  S.globalPlan=null;S.slimes=Array.from({length:7},()=>h.slime());S.monsters=[h.slime({isMonster:true})];
  h.run('abyssSetupSel=[...S.slimes,...S.monsters].map(s=>s.id);startAbyssBattle()');
  const b=h.context.__TEST__._battle;assert.equal(b.B.allies.length,5);assert.ok(b.B.allies.every(u=>!u.ref.isMonster));
});
check('rewards: boss first-clear loot is once only and repeat victory is discounted',()=>{
  const h=boot();Object.assign(h.state(),{abyssLevel:5,abyssUnlocked:5});let b=h.battle();
  const before=h.state().bag.treasure;b.B.monsters.forEach(u=>u.hp=0);b.endBattle(true);
  assert.equal(h.state().bag.treasure,before+1);assert.equal(h.state().abyssUnlocked,6);
  const reward=b.B.result.totalExp;b.closeBattle();
  h.run('abyssSetupSel=S.slimes.map(s=>s.id);startAbyssBattle()');b=h.context.__TEST__._battle;
  b.B.monsters.forEach(u=>u.hp=0);b.endBattle(true);
  assert.equal(h.state().bag.treasure,before+1);assert.equal(b.B.result.totalExp,Math.floor(reward*0.2));
});
check('sweep: requires a real clear, caps at three, persists usage, and resets with the day',()=>{
  const h=boot(),S=h.state();S.slimes=[h.slime()];assert.equal(h.run('sweepAbyss()'),false);
  h.run('ensureProgress().abyssClears[5]=true;S.abyssUnlocked=6;');
  const treasure=S.bag.treasure;
  for(let i=0;i<3;i++)assert.equal(h.run('sweepAbyss()'),true);
  const coins=S.coins;assert.equal(h.run('sweepAbyss()'),false);assert.equal(S.coins,coins);
  assert.equal(S.bag.treasure,treasure);assert.equal(S.abyssUnlocked,6);
  const reloaded=boot(Object.fromEntries(h.storage));assert.equal(reloaded.run('load()'),true);
  assert.equal(reloaded.run('sweepAbyss()'),false);
  reloaded.state().taskDate='2000-01-01';assert.equal(reloaded.run('sweepAbyss()'),true);
  assert.equal(reloaded.state().sweepUsed,1);
});
check('summon: empty roster is free, insufficient funds/full roster do not consume pity, and tenth draw is rare',()=>{
  const h=boot(),S=h.state();S.coins=0;h.run('doSummon();clearSummonReveal()');assert.equal(S.slimes.length,1);assert.equal(S.coins,0);
  const pity=S.summonPity,seq=S.seq;h.run('doSummon()');assert.equal(S.seq,seq);assert.equal(S.summonPity,pity);
  S.coins=10000;S.summonPity=9;const price=h.run('summonCost()');h.run('doSummon();clearSummonReveal()');
  assert.equal(S.coins,10000-price);assert.ok(h.run('RARE_ELEMENTS').includes(S.slimes[1].element));assert.equal(S.summonPity,0);
  const snapshot=h.run('JSON.stringify(S)');h.run('doSummon()');assert.equal(h.run('JSON.stringify(S)'),snapshot);
});
check('regions: unlock at cleared floors 10 and 25 and locked legacy selection earns grass rewards',()=>{
  const h=boot();assert.equal(h.run('regionUnlocked(1)'),false);h.state().abyssUnlocked=11;
  assert.equal(h.run('regionUnlocked(1)'),true);assert.equal(h.run('regionUnlocked(2)'),false);
  h.state().abyssUnlocked=26;assert.equal(h.run('regionUnlocked(2)'),true);
  h.state().abyssUnlocked=1;h.state().exploreMapIndex=2;assert.equal(h.run('exploreRegionIndex()'),0);
});
check('potions: experience scales with level and benefits the selected partner',()=>{
  const h=boot(),s=h.slime({level:30,wit:0});h.state().slimes=[s];h.state().bag.expPotion=1;
  const amount=h.run('potionExp')(s);assert.equal(amount,h.run('slimeExpNeed(30)')*0.5);
  h.run('useItem("expPotion",S.slimes[0].id)');assert.equal(s.exp,amount);assert.equal(h.state().bag.expPotion,0);
});
function exploringHarness(){
  const h=boot({}, {now:Date.parse('2026-10-27T04:00:00Z')});
  Object.assign(h.state(),{started:true,slimes:[h.slime({stamina:1,mood:100})]});
  h.run("S.world.familiar=['0:0'];S.world.stock.feed=1000;LivingWorld.execute(S,{type:'depart',region:0,route:0,team:[S.slimes[0].id],mode:'offline',duration:300,repeat:true});");
  h.run('checkDailyReset(true)');return h;
}
check('offline: collection earnings, growth and activity equal live ticking',()=>{
  const online=exploringHarness(),off=exploringHarness();
  for(let i=0;i<3600;i++)online.tick(1000);
  const r=off.run('settleOffline(3600000)');assert.ok(r.actions>0);assert.ok(r.exp>0);
  for(const key of ['coins','totalEarned','bag','slimes','tasks','points','world'])assert.equal(JSON.stringify(off.state()[key]),JSON.stringify(online.state()[key]),key);
  assert.equal(off.storage.size,0,'Offline simulation must not save a partially applied result');
});
check('offline: twelve-hour cap, clock rollback, and diagnostic isolation',()=>{
  const a=exploringHarness(),b=exploringHarness();
  const r=a.run('settleOffline(24*3600000)'),s=b.run('settleOffline(12*3600000)');
  assert.equal(r.seconds,43200);assert.equal(JSON.stringify(r),JSON.stringify(s));assert.equal(a.state().coins,b.state().coins);
  const before=a.run('JSON.stringify(S)');assert.equal(a.run('settleOffline(-10000)').seconds,0);assert.equal(a.run('JSON.stringify(S)'),before);
  const diagnostic=boot({}, {search:'?gallery=1'});diagnostic.state().started=true;diagnostic.state().slimes=[diagnostic.slime()];
  const snapshot=diagnostic.run('JSON.stringify(S)');assert.equal(diagnostic.run('settleOffline(7200000)').actions,0);assert.equal(diagnostic.run('JSON.stringify(S)'),snapshot);
});
check('clock: delayed callbacks account for elapsed seconds once and resume collection after reload',()=>{
 const h=exploringHarness();h.elapse(4000);h.run('tickWorld()');assert.equal(h.state().world.trips[0].phase,4);
 h.run('tickWorld()');assert.equal(h.state().world.trips[0].phase,4);h.elapse(19000);h.run('tickWorld();save()');assert.equal(h.state().world.trips[0].phase,23);
 const reload=boot(Object.fromEntries(h.storage),{now:Date.parse('2026-10-27T04:00:23Z')});assert.equal(reload.run('load()'),true);assert.equal(reload.state().world.trips[0].phase,23);reload.tick(1000);assert.equal(reload.state().world.trips[0].phase,24);
});
check('migration: old same-day saves acquire new counters and task keys without losing earned stats',()=>{
  const h=exploringHarness();h.state().slimes[0].str=999;h.state().tasks={rent:2,summon:1,feed:0};
  const legacy=JSON.parse(h.run('JSON.stringify(S)'));for(const key of ['lastActive','summonPity','sweepUsed','planClock'])delete legacy[key];
  const reload=boot({slimeSummonerSave:JSON.stringify(legacy)},{now:Date.parse('2026-10-27T04:00:00Z')});
  assert.equal(reload.run('load()'),true);reload.run('checkDailyReset()');
  assert.equal(reload.state().slimes[0].str,999);assert.equal(reload.state().tasks.rent,2);assert.equal(reload.state().tasks.abyss,0);assert.equal(reload.state().tasks.pet,0);
  for(const key of ['lastActive','summonPity','sweepUsed','planClock'])assert.equal(reload.state()[key],0);
});
for(const [key,value] of [['lastActive',-1],['summonPity',0.5],['sweepUsed','3'],['planClock',12]])check(`migration: invalid ${key} keeps raw save protected`,()=>{
  const h=exploringHarness(),data=JSON.parse(h.run('JSON.stringify(S)'));data[key]=value;
  const raw=JSON.stringify(data),load=boot({slimeSummonerSave:raw});assert.equal(load.run('load()'),false);load.run('save()');assert.equal(load.storage.get('slimeSummonerSave'),raw);
});

if(require.main===module){
  const passed=results.filter(r=>r.status==='PASS').length;
  console.log(`RESULT ${passed}/${results.length} passed (Node VM; simulated DOM, NOT browser QA)`);
  process.exitCode=passed===results.length?0:1;
}
module.exports={boot,check,results,html,original,code,assert};
