'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {launch,fileUrl,waitFor,sleep,report}=require('../tools/out/lib/cdp.js');
(async()=>{
 const p=await launch({url:fileUrl(path.resolve('史莱姆.html')),width:390,height:844,dpr:2,touchEnabled:true});const results=[],errors=[];
 p.client.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails?.text));
 const check=async(name,expr)=>{assert.ok(await p.ev(expr),name);results.push({name,status:'PASS'});console.log('PASS '+name);};
 const tap=async(selector)=>{const r=await p.ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing control');for(let n=el.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await p.touch.tap(r.x,r.y);await sleep(100);};
 try{
  assert.ok(await waitFor(()=>p.ev('typeof finishStory==="function"'),10000));
  await p.ev(`finishStory();doSummon();finishSummonReveal();closeModal();doSummon();finishSummonReveal();closeModal();S.slimes.forEach((s,i)=>{s.name=['甲','乙'][i];s.mood=40;});switchTab('home');S.world.residents[S.slimes[0].id].x=5;S.world.residents[S.slimes[0].id].y=5;S.world.residents[S.slimes[1].id].x=7;S.world.residents[S.slimes[1].id].y=6;Object.values(S.world.residents).forEach(r=>{r.until=S.world.clock+100;r.target=null;});renderTab();true`);
  const id=await p.ev('S.slimes[1].id');await tap(`[data-resident="${id}"] .slime`);
  await check('touching the resident opens care for that exact companion',`document.querySelector('[data-care-for]').dataset.careFor==='${id}'`);
  const before=await p.ev('S.slimes[1].intimacy');await tap('[data-command*="pet"]');await check('touch pet records affection for the selected ID',`S.slimes[1].intimacy===${before+1}`);await tap('[data-command*="pet"]');await check('repeated touch respects the affection cooldown',`S.slimes[1].intimacy===${before+1}`);
  const food=await p.ev('S.bag.food');await tap('[data-command*="feed"]');await check('touch feeding charges the common inventory once',`S.bag.food===${food-1}&&S.world.inventory.items.feed===${food-1}`);
  await tap('[data-lw="play"][data-kind="ball"]');await check('ball game reserves the selected participant',`ballGame.slime.id===${id}&&LivingWorld.activity(S.world,${id}).kind==='play'`);
  await tap('#gameBall');assert.ok(await waitFor(()=>p.ev('ballGame.ballState==="toPlayer"'),4000,30));
  await p.ev(`window.savedSetItem=Storage.prototype.setItem;window.failSave=()=>{Storage.prototype.setItem=()=>{throw new Error('Quota')};save();};document.querySelector('#gameField').addEventListener('pointerdown',failSave,{once:true});true`);
  await tap('#gameBall');await check('real touch returns the moving ball','ballGame.catches===1&&document.querySelector("#gCatch").textContent==="1"');
  // A failed save freezes reward callbacks until the same pending state is saved.
  const mood=await p.ev('S.slimes[1].mood'),up=await p.ev('[ballGame.ballX,ballGame.ballY]');await sleep(200);await check('save failure pauses the outbound ball without losing its animation',`ballGame.ballState==='toSlime'&&ballGame.ballX===${up[0]}&&ballGame.ballY===${up[1]}`);
  await tap('#gClose');await check('save failure prevents game callbacks from granting new rewards',`saveRetryNeeded&&ballGame.running&&S.slimes[1].mood===${mood}`);
  await p.ev('Storage.prototype.setItem=savedSetItem;true');await tap('[data-act="retrySave"]');assert.ok(await waitFor(()=>p.ev('ballGame.ballState==="toPlayer"'),4000,30));
  await p.shot(path.resolve('tools/out/shots/touch-v4-ball.png'));
  const down=await p.ev('failSave();[ballGame.ballX,ballGame.ballY]');await sleep(200);await check('save failure pauses the returning ball at its current position',`ballGame.ballState==='toPlayer'&&ballGame.ballX===${down[0]}&&ballGame.ballY===${down[1]}`);
  await p.ev('Storage.prototype.setItem=savedSetItem;true');await tap('[data-act="retrySave"]');assert.ok(await waitFor(()=>p.ev('ballGame.ballState==="gone"'),5000,20));await p.ev('failSave();true');await sleep(550);await check('missed ball waits for save recovery before respawning','ballGame.ballState==="gone"');
  await p.ev('Storage.prototype.setItem=savedSetItem;true');await tap('[data-act="retrySave"]');assert.ok(await waitFor(()=>p.ev('ballGame.ballState==="ready"'),2000,30));await check('retry resumes the same game without repeating a catch','ballGame.catches===1&&ballGame.ballState==="ready"');
  await tap('#gClose');await check('retry then close grants one result and releases the partner',`!ballGame&&LivingWorld.activity(S.world,${id}).kind==='home'&&S.slimes[1].mood>=${mood+3}&&getComputedStyle(document.querySelector('#gameScreen')).visibility==='visible'`);
  await p.ev('switchTab("home");true');const toys=await p.ev('S.world.placements.find(p=>p.def==="toys").id');await tap(`[data-lw-object="${toys}"]`);await tap('[data-lw="play"][data-kind="stack"]');await check('stack game reserves its actual team','S.slimes.every(s=>LivingWorld.activity(S.world,s.id).kind==="play")');
  await tap('#gameField');assert.ok(await waitFor(()=>p.ev('Number(document.querySelector("#gCount")?.textContent)>=1'),5000,50));await check('touch dropping stacks a real partner','S.stackRecord>=1');await p.shot(path.resolve('tools/out/shots/touch-v4-stack.png'));await tap('#gClose');await check('stack completion restores the same home and frees the team','S.slimes.every(s=>!LivingWorld.isBusy(S,s.id))&&!document.querySelector("#gameOverlay")&&!!document.querySelector(".lw-map")');
  await p.client.send('Page.reload');assert.ok(await waitFor(()=>p.ev('typeof S!=="undefined"&&S.started&&!persistenceBlocked'),10000));await check('touch progress survives refresh without occupied ghosts','S.stackRecord>=1&&Object.keys(S.world.activities).length===0&&S.world.evidence.some(e=>e.type==="play")');await check('touch session has no browser errors',JSON.stringify(errors.length===0));
 }catch(e){process.exitCode=1;results.push({name:'touch acceptance',status:'FAIL',error:e.stack});console.error(e.stack);await p.shot(path.resolve('tools/out/shots/touch-v4-failure.png')).catch(()=>{});}
 finally{report('tools/out','touch-report.json',{results,errors,viewport:'390×844, DPR 2',input:'CDP touch'});await p.close();}
 console.log(`RESULT ${results.filter(r=>r.status==='PASS').length}/${results.length}`);
})();
