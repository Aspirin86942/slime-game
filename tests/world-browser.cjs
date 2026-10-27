'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {launch,waitFor,sleep,report,fileUrl}=require('../tools/out/lib/cdp.js');
const url=fileUrl(path.resolve('史莱姆.html'));
const results=[],errors=[],requests=[];
(async()=>{
 const p=await launch({url,width:390,height:844,dpr:1,touchEnabled:true});
 p.client.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails?.exception?.description||e.exceptionDetails?.text));
 await p.client.send('Network.enable');p.client.on('Network.requestWillBeSent',e=>{if(/^https?:/.test(e.request.url))requests.push(e.request.url);});
 const check=async(name,expression)=>{const value=await p.ev(expression);assert.ok(value,name+' '+JSON.stringify(value));results.push({name,status:'PASS'});console.log('PASS '+name);};
 const click=async(selector)=>{const rect=await p.ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('missing control');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await p.touch.tap(rect.x,rect.y);await sleep(90);};
 const tab=async(name)=>click(`[data-lw="tab"][data-tab="${name}"]`);
 const shot=async(name)=>{await p.ev('document.querySelector("#content").scrollTop=0;true');await p.shot(path.resolve('tools/out/shots/world-'+name+'.png'));};
 const cmdClick=async(type)=>{const sel=await p.ev(`(()=>{const a=[...document.querySelectorAll('[data-command]')].find(b=>JSON.parse(b.dataset.command).type===${JSON.stringify(type)}&&!b.disabled);if(!a)throw new Error('command unavailable');a.id='world-test-target';return '#world-test-target';})()`);await click(sel);};
 try{
  assert.ok(await waitFor(()=>p.ev('typeof LivingWorld!=="undefined"&&typeof finishStory==="function"'),10000));
  await p.ev('finishStory();S.globalPlan=null;S.customPlans={};save();true');
  await click('[data-act="tab"][data-tab="world"]');
  await check('normal mode home and six districts render','!!document.querySelector(".lw-map")&&document.querySelectorAll(".lw-zone-nav button").length===6');
  for(const width of [320,390,480]){await p.client.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await sleep(60);await check('home has no document overflow at '+width,'document.documentElement.scrollWidth<=innerWidth');await shot('home-'+width);}
  await p.client.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await tab('stories');await cmdClick('chapter');await check('authored story recruits once and saves progress','S.world.chapters.sprout===1&&S.slimes.some(s=>s.name==="芽芽")&&JSON.parse(localStorage.getItem("slimeSummonerSave")).world.chapters.sprout===1');
  await shot('story');
  await tab('nursery');await cmdClick('sow');await check('batch planting consumes seeds and persists crops','S.world.crops.length===2&&JSON.parse(localStorage.getItem("slimeSummonerSave")).world.crops.length===2');
  await p.ev('advanceWorld(1200,true);save();renderTab();true');
  await tab('home');await cmdClick('harvestAll');await check('maturity to harvest cycle grants material and unlock discovery','S.world.stock.petal>0&&S.world.flags.includes("harvest")');
  await click('[data-lw="zone"][data-zone="1"]');await cmdClick('unlock');await check('district expansion charges materials and opens map','S.world.unlocked.includes(1)&&!!document.querySelector(".lw-map")');
  await click('[data-lw="zone"][data-zone="0"]');
  await click('[data-lw="edit"]');
  const move=await p.ev(`(()=>{const svg=document.querySelector('.lw-map');svg.scrollIntoView({block:'center'});const r=svg.getBoundingClientRect(),a=document.querySelector('[data-lw-object="1"]').getBoundingClientRect();return{from:{x:a.x+a.width/2,y:a.y+a.height/2},to:{x:r.x+300/600*r.width,y:r.y+317/470*r.height}};})()`);
  await p.touch.drag(move.from,move.to,8);await sleep(120);
  await check('touch drag moves building on grid','S.world.placements.find(p=>p.id===1).y>=7');
  await click('[data-lw="edit"]');
  await tab('nursery');await shot('nursery');
  await tab('explore');await click('[data-lw="depart"][data-mode="active"]');
  await check('trip owns selected companion','S.world.trips.length===1&&LivingWorld.isBusy(S,S.world.trips[0].team[0])');
  for(let i=0;i<4;i++){await cmdClick('step');await cmdClick('tripChoice');}
  await cmdClick('claimTrip');await check('full four-node expedition returns once with journal','S.world.trips.length===0&&S.world.journals.some(j=>j.lines.length>=5)');await shot('exploration');
  await tab('games');await p.ev(`document.querySelector('[data-command*="observation"]').click();true`);
  for(let i=0;i<5;i++){const idx=await p.ev('S.world.mini.board[S.world.mini.round]');await click(`[data-lw="mini-cell"][data-index="${idx}"]`);}
  await cmdClick('miniClaim');await check('minigame actual controls settle and persist one reward','S.world.mini.claimed&&S.world.mini.score===5');await shot('games');
  await tab('workshop');await check('workshop and all combo recipes render','document.querySelectorAll(".lw-combo").length===8&&document.querySelectorAll(".lw-recipe").length>=12');await shot('workshop');
  await tab('ecology');await click('[data-lw="overlay"][data-overlay="quality"]');await check('environment layer and 18 visitor entries render','document.querySelectorAll(".lw-visitor-list article").length===18');await shot('ecology');
  // A second browser load uses the exact bytes saved by normal gameplay.
  const before=await p.ev('({count:S.world.discoveries.length,chapters:S.world.chapters.sprout,slimes:S.slimes.length})');
  await p.client.send('Page.reload');assert.ok(await waitFor(()=>p.ev('typeof S!=="undefined"&&S.started&&!persistenceBlocked'),10000));
  await check('reload preserves V3 world and roster',`S.world.discoveries.length===${before.count}&&S.world.chapters.sprout===${before.chapters}&&S.slimes.length===${before.slimes}`);
  await p.client.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await p.client.send('Page.reload');assert.ok(await waitFor(()=>p.ev('typeof S!=="undefined"&&S.started'),10000));await click('[data-act="tab"][data-tab="world"]');await check('offline file opens with zero remote asset requests','!!document.querySelector(".lw-map")');assert.deepEqual(requests,[]);
  await p.ev(`(()=>{const old=JSON.parse(localStorage.getItem(SAVE_KEY));old.saveVersion=2;delete old.world;localStorage.setItem(SAVE_KEY,JSON.stringify(old));})()`);await p.client.send('Page.reload');assert.ok(await waitFor(()=>p.ev('typeof S!=="undefined"&&S.started'),10000));
  await check('V2 migration backs up raw bytes and initializes V3 without erasing roster','S.saveVersion===3&&!!S.world&&JSON.parse(localStorage.getItem("slimeSummonerSave_v2_backup")).saveVersion===2&&!persistenceBlocked');
  // Storage failure preserves in-memory progress and reports it visibly.
  await p.ev(`window.originalStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError')};save();true`);
  await check('storage failure displays persistent warning','document.querySelector("#saveProtectionBanner").textContent.includes("不要关闭")');await p.ev('Storage.prototype.setItem=originalStorageSet;save();true');
  await p.ev(`window.dispatchEvent(new StorageEvent('storage',{key:SAVE_KEY,newValue:'other-tab'}));true`);
  await check('other-tab conflict blocks simulation and writing','storageConflict===true&&save()===false');const clock=await p.ev('S.world.clock');await p.ev('advanceWorld(60,true);true');assert.equal(await p.ev('S.world.clock'),clock);
  await p.client.send('Page.reload');assert.ok(await waitFor(()=>p.ev('typeof S!=="undefined"&&S.started'),10000));
  await p.ev(`(()=>{const d=JSON.parse(localStorage.getItem(SAVE_KEY));d.saveVersion=999;localStorage.setItem(SAVE_KEY,JSON.stringify(d));})()`);await p.client.send('Page.reload');assert.ok(await waitFor(()=>p.ev('typeof persistenceBlocked!=="undefined"&&persistenceBlocked'),10000));
  await check('unknown future save stays protected','save()===false&&JSON.parse(localStorage.getItem(SAVE_KEY)).saveVersion===999');
  assert.deepEqual(errors,[],'browser runtime errors');results.push({name:'no browser runtime exceptions',status:'PASS'});
 }catch(e){results.push({name:'browser acceptance',status:'FAIL',error:e.stack});console.error(e.stack);process.exitCode=1;await p.shot(path.resolve('tools/out/shots/world-failure.png')).catch(()=>{});}
 finally{report('tools/out','world-browser.json',{results,errors,remoteRequests:requests});await p.close();}
 console.log(`RESULT ${results.filter(r=>r.status==='PASS').length}/${results.length}`);
})();
