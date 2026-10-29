// Compare the shipped game with the user-selected reference using the same inputs.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const ts=require('typescript');
const {loadGame}=require('./lib/vm-harness.cjs');
const reference=fs.readFileSync('史莱姆-参考.html','utf8');
const shipped=fs.readFileSync('史莱姆.html','utf8');
const scripts=html=>[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const referenceBoot=loadGame('reference',scripts(reference)).boot;
const shippedBoot=loadGame('shipped',scripts(shipped)).boot;
const now=1793232000000;
function fixture(boot=shippedBoot){
  const h=boot({},{now});
  Object.assign(h.state(),{started:true,name:'小院主人',sysName:'团子',coins:10000,points:300});
  h.state().slimes=['火','水','草'].map((element,i)=>h.slime({element,name:['露露','芽芽','桃桃'][i],stamina:100,mood:80,luck:0}));
  return h;
}
function snapshot(h){return JSON.parse(h.run('JSON.stringify({slimes:S.slimes,coins:S.coins,points:S.points,bag:S.bag,feedTrough:S.feedTrough,summonerExp:S.summonerExp,explorePending:S.explorePending,plan:S.globalPlan})'));}
function seed(h,n=12345){h.context.Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}

test('the selected reference is immutable and its complete original stylesheet is retained',()=>{
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync('史莱姆-参考.html')).digest('hex'),'0f8774ec7664b40ef4e57338d21d77c8e3535203063f0e2a878a5dc3339255a6');
  const css=s=>s.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.ok(css(shipped).startsWith(css(reference)));
  assert.ok(css(shipped).slice(css(reference).length).startsWith('.save-protection-banner'));
  assert.deepEqual([...shipped.matchAll(/<button data-act="tab" data-tab="([^"]+)"/g)].map(m=>m[1]),['space','home','summon','travel','bag','status']);
});

test('reference content, skills, creature rendering and original page functions remain exact',()=>{
  const source=fs.readdirSync('src/legacy').filter(f=>f.endsWith('.js')).sort().map(f=>fs.readFileSync('src/legacy/'+f,'utf8')).join('\n');
  const functions=code=>{const p=ts.createSourceFile('game.js',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);return new Map(p.statements.filter(ts.isFunctionDeclaration).map(n=>[n.name.text,n.getText(p)]));};
  const a=functions(scripts(reference)),b=functions(source);
  for(const name of ['slimeHTML','slimeHTMLFromColor','renderStatus','renderSummon','renderTravel','renderBag','openSettings','openDetail','createSlime','doSummon','addExp','growthStats','calculateBattleRewards'])assert.equal(b.get(name),a.get(name),name);
  const r=fixture(referenceBoot),g=fixture();
  const content='JSON.stringify([THEMES,MAP_THEMES,ELEMENTS,ELEMENT_CHART,ELEMENT_TALENTS,SKILLS,SKILL_DESC,PERSONALITIES,PERSONA_BUFF,ITEMS,TASK_DEFS,TRAINING_CHALLENGES,BOND_MILESTONES,STORY_STEPS])';
  assert.equal(g.run(content),r.run(content));
});

test('all five original pages and the detail panel produce the reference content',()=>{
  const r=fixture(referenceBoot),g=fixture();
  for(const render of ['renderSpace','renderSummon','renderTravel','renderBag','renderStatus']){
    seed(r);seed(g);assert.equal(g.run(render+'()'),r.run(render+'()'),render);
  }
  for(const h of [r,g])h.run('openModal=html=>window.detailHTML=html;openDetail(S.slimes[0].id)');
  assert.equal(g.context.detailHTML,r.context.detailHTML);
});

test('summoning, growth, merging, purchases and exploration match reference results',()=>{
  for(const action of ['doSummon()','addExp(S.slimes[0],1000)','mergeSel=[S.slimes[0].id,S.slimes[1].id];doMerge()','buyItem("food",2)','S.globalPlan="explore";for(let i=0;i<3;i++)runPlans()']){
    const r=fixture(referenceBoot),g=fixture();seed(r);seed(g);r.run(action);g.run(action);
    assert.deepEqual(snapshot(g),snapshot(r),action);
  }
});

test('exploration claims move pending rewards once into the shared inventory',()=>{
  const r=fixture(referenceBoot),g=fixture();
  for(const h of [r,g]){
    h.run('S.globalPlan="explore";S.explorePending={coins:120,exp:30,food:2,point:3,treasure:1,weight:1};');
    h.click('claimExplore');const first=snapshot(h);h.click('claimExplore');assert.deepEqual(snapshot(h),first);
  }
  assert.deepEqual(snapshot(g),snapshot(r));
  assert.equal(g.state().world.inventory.items.feed,g.state().bag.food);
});

test('the online clock keeps reference recovery and the twelve-second dispatch cadence',()=>{
  const r=fixture(referenceBoot),g=fixture();
  for(const h of [r,g])h.run('S.globalPlan="explore";S.feedTrough=5;');
  seed(r);seed(g);
  r.run('for(let i=0;i<12;i++){for(const s of S.slimes)recoverPlanTick(s);if(i===11)runPlans();}');
  g.run('advanceWorld(12)');assert.deepEqual(snapshot(g),snapshot(r));
});

test('offline time advances only the home and is capped at twelve hours',()=>{
  const h=fixture();h.run('S.globalPlan="explore";S.feedTrough=5;S.slimes[0].stamina=20;');
  const before=snapshot(h),clock=h.state().world.clock;
  h.run('settleOffline(24*60*60*1000)');assert.equal(h.state().world.clock-clock,43200);
  assert.deepEqual(snapshot(h),before,'legacy rewards, stamina and feed must not advance offline');
  h.run('settleOffline(-1000)');assert.equal(h.state().world.clock-clock,43200);
});

test('a real reference V2 save retains its partners, manual mode, pending loot and resources',()=>{
  const r=fixture(referenceBoot);r.run('S.feedTrough=7;S.explorePending.coins=123;S.notchHeight=.4;save()');
  const raw=r.storage.get('slimeSummonerSave'),h=shippedBoot({slimeSummonerSave:raw},{now});
  assert.equal(h.run('load()'),true);assert.equal(h.storage.get('slimeSummonerSave_v2_backup'),raw);
  assert.deepEqual(snapshot(h),snapshot(r));assert.equal(h.state().battleMode,'manual');assert.equal(h.state().notchHeight,.4);
  const reload=shippedBoot({slimeSummonerSave:h.storage.get('slimeSummonerSave')},{now});
  assert.equal(reload.run('load()'),true);assert.deepEqual(snapshot(reload),snapshot(h));
});

test('legacy cherished locks stay protected and are editable from the reference favorite control',()=>{
  const h=fixture();h.state().slimes[1].locked=true;h.run('save()');
  const g=shippedBoot({slimeSummonerSave:h.storage.get('slimeSummonerSave')},{now});assert.equal(g.run('load()'),true);
  assert.equal(g.state().slimes[1].starred,true);assert.equal(g.run('mergePreview(S.slimes[0],S.slimes[1]).valid'),false);
  g.run('toggleStar(S.slimes[1].id)');assert.equal(g.state().slimes[1].locked,false);assert.equal(g.run('mergePreview(S.slimes[0],S.slimes[1]).valid'),true);
});

test('a working partner cannot enter original games or be consumed by a merge',()=>{
  const h=fixture();h.run('LivingWorld.dispatch({type:"assign",slime:S.slimes[0].id,building:2})');
  assert.equal(h.run('LivingWorld.isBusy(S,S.slimes[0].id)'),true);
  const before=snapshot(h);h.run('startBallGame(S.slimes[0]);mergeSel=[S.slimes[1].id,S.slimes[0].id];doMerge()');
  assert.equal(h.run('ballGame'),null);assert.deepEqual(snapshot(h),before);
});
