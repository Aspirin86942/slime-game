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
function node(tag='div') {
  const children = new Map();
  const classes = new Set();
  const n = { tagName:tag.toUpperCase(), dataset:{}, children:[], parentNode:null,
    textContent:'', innerHTML:'', isConnected:true, offsetWidth:400, offsetHeight:250,
    clientWidth:400, clientHeight:250, scrollHeight:250,
    style:{setProperty(k,v){this[k]=v;}, removeProperty(k){delete this[k];}},
    classList:{add(...v){v.forEach(x=>classes.add(x));},remove(...v){v.forEach(x=>classes.delete(x));},contains(v){return classes.has(v);},toggle(v,b){b=b===undefined?!classes.has(v):b;b?classes.add(v):classes.delete(v);return b;}},
    appendChild(c){this.children.push(c);c.parentNode=this;return c;},
    append(...cs){cs.forEach(c=>this.appendChild(c));}, prepend(c){this.children.unshift(c);c.parentNode=this;},
    removeChild(c){this.children=this.children.filter(x=>x!==c);}, remove(){this.isConnected=false;if(this.parentNode)this.parentNode.removeChild(this);},
    querySelector(s){if(!children.has(s))children.set(s,node(s.startsWith('canvas')?'canvas':'div'));return children.get(s);},
    querySelectorAll(){return [];},
    addEventListener(){}, removeEventListener(){}, setAttribute(k,v){this[k]=String(v);},getAttribute(k){return this[k]??null;},removeAttribute(k){delete this[k];},
    getBoundingClientRect(){return {left:0,top:0,width:400,height:250,right:400,bottom:250};},
    closest(){return null;},matches(){return false;}, focus(){}, click(){},
    getContext(){return new Proxy({},{get:()=>()=>{}});}
  };
  return n;
}
function boot(storageInput={},options={}) {
  const storage = new Map(Object.entries(storageInput));
  const roots = new Map();
  const intervals = new Map(), timeouts = new Map();
  let nextTimer=1;
  const document = {
    body:node('body'), documentElement:node('html'), title:'',
    createElement:node, createElementNS:(_,tag)=>node(tag),
    querySelector(s){if(s==='#gameOverlay')return this.body.children.find(x=>x.id==='gameOverlay'&&x.isConnected)||roots.get('#app')?.children.find(x=>x.id==='gameOverlay'&&x.isConnected)||null;if(!roots.has(s))roots.set(s,node());return roots.get(s);},
    querySelectorAll(){return [];}, getElementById(id){return this.querySelector('#'+id);},
    addEventListener(){},removeEventListener(){}
  };
  const context = {
    console, document, location:{search:options.search||'',href:'file://independent-test/index.html'},
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
    setInterval(fn,ms){const id=nextTimer++;intervals.set(id,{fn,ms});return id;},clearInterval:id=>intervals.delete(id),
    setTimeout(fn,ms){const id=nextTimer++;timeouts.set(id,{fn,ms});return id;},clearTimeout:id=>timeouts.delete(id),
    requestAnimationFrame:()=>nextTimer++,cancelAnimationFrame(){},
    performance:{now:()=>0}, navigator:{}, Blob, URL, Math:Object.create(Math),
    getComputedStyle:()=>({getPropertyValue:()=>'',transform:'none'}),
    innerWidth:1200,innerHeight:800, addEventListener(){}, removeEventListener(){},
    confirm:()=>false,alert(){},prompt:()=>null
  };
  context.window=context;context.self=context;
  context.Math.random=()=>0.42;
  vm.createContext(context);
  // Startup/render/self-test boot is not the subject of this rule-level harness.
  const init = code.indexOf('(function init(){');
  assert.ok(init>0,'Expected recognizable init boundary');
  vm.runInContext(code.slice(0,init),context,{filename:file,timeout:2000});
  const run = source=>vm.runInContext(source,context,{filename:'review-test.js',timeout:2000});
  run(`renderTop=()=>{};renderTab=()=>{};updateLive=()=>{};toast=()=>{};openModal=()=>{};closeModal=()=>{};window.__TEST__={};`);
  return {context,run,storage,intervals,timeouts,
    tick(ms){for(const {fn,ms:delay} of [...intervals.values()])if(delay===ms)fn();},
    flush(maxMs=5000){let count=0;while(true){const next=[...timeouts].find(([id,t])=>t.ms<=maxMs);if(!next)break;const [id,t]=next;timeouts.delete(id);if(++count>1000)throw new Error('Timer flush cap exceeded');t.fn();}},
    state(){return run('S');},
    slime(overrides={}){const s=run('createSlime(false)');Object.assign(s,overrides);return s;},
    battle(elements=['火','火']){
      const state=run('S');state.started=true;state.globalPlan=null;state.customPlans={};state.slimes=elements.map((element,i)=>this.slime({element,name:'QA-'+i,skill:'元素弹',wit:0}));
      run('abyssSetupSel=S.slimes.map(s=>s.id);startAbyssBattle();');
      const b=context.__TEST__._battle;assert.ok(b,'Battle test hook should be initialized');return b;
    }
  };
}
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
  const expected=Math.round(Math.floor((30+b.B.monsters[0].ref.level*10)*0.25)*2.5),before=h.state().coins;
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
for(const stamina of [1,19])check(`exploration: stamina ${stamina} enters rest and eventually resumes`,()=>{
  const h=boot();const s=h.slime({stamina,mood:100});Object.assign(h.state(),{started:true,globalPlan:'explore',slimes:[s]});
  h.run('runPlans()');assert.equal(s.resting,true);
  const coins=h.state().coins;
  let n=0;while(s.resting&&n++<400)h.tick(1000);
  assert.equal(s.resting,false,'Passive recovery must exit rest at a visible threshold');
  assert.ok(s.stamina>=20);h.run('runPlans()');assert.ok(h.state().coins>coins,'Exploration resumes earning');
});
for(const mode of ['space','ball','stack'])check(`exploration: dispatched team keeps progressing during ${mode}`,()=>{
  const h=boot();const s=h.slime({stamina:100,mood:100});Object.assign(h.state(),{started:true,globalPlan:'explore',slimes:[s]});
  h.run(`activeTab='space';${mode==='ball'?'ballGame={running:true};':mode==='stack'?'stackGame={running:true};':''}`);
  const before=h.state().coins;h.run('runPlans()');assert.equal(s.stamina,80);assert.ok(h.state().coins>before);
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
  h.run('save()');const saved=h.storage.get('slimeSummonerSave');assert.equal(h.run('load()'),true);h.run('save()');
  assert.equal(h.storage.get('slimeSummonerSave'),saved);assert.equal(h.storage.get('slimeSummonerSave_v1_backup'),raw);
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
  assert.equal(h.state().coins-before,25);assert.equal(b.B.result.defeatedCount,1);
});
check('battle: repeated start while overlay exists cannot duplicate roster/sequence',()=>{
  const h=boot(),b=h.battle();const seq=h.state().seq;h.run('startAbyssBattle()');assert.equal(h.context.__TEST__._battle,b);assert.equal(h.state().seq,seq);
});
check('companion home: default tab, target navigation and themes in settings',()=>{
  const h=boot();assert.equal(h.run('activeTab'),'space');const content=h.run('renderSpace()');
  assert.ok(content.includes('home-objective'));assert.ok(content.includes('data-act="goto"'));assert.ok(!content.includes('theme-row'));
  h.run('openModal=html=>window.__settingsHTML=html;openSettings()');assert.ok(h.context.__settingsHTML.includes('theme-row'));
});
check('companionship: affinity thresholds unlock visible existing-expression responses without battle',()=>{
  const h=boot(),s=h.slime({intimacy:0});h.context.pet=s;const initial=h.run('bondMilestone(pet)');s.intimacy=10000;const max=h.run('bondMilestone(pet)');
  assert.ok(max.need>initial.need);assert.notEqual(max.name,initial.name);assert.ok(h.run('renderSpace()').includes('home-objective'));
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

if(require.main===module){
  const passed=results.filter(r=>r.status==='PASS').length;
  console.log(`RESULT ${passed}/${results.length} passed (Node VM; simulated DOM, NOT browser QA)`);
  process.exitCode=passed===results.length?0:1;
}
module.exports={boot,check,results,html,original,code,assert};
