// Regress the phone bug: the controls fitted, but the map edge and house stayed behind them.
'use strict';
const assert=require('node:assert/strict');
const {start}=require('./lib/browser/session.cjs');
const profiles=require('./lib/browser/profiles.cjs');
const layout=require('./lib/browser/layout.cjs');
const {waitFor,report}=require('../tools/out/lib/cdp.js');
const out='tools/out/magic-ui/mobile',checks=[];
// 43 项基线要求 PASS 行与 results.json 的 {name,ok,detail} 结构保持不变，底座没有等价 check。
const check=(name,ok,detail)=>{checks.push({name,ok,detail});assert.ok(ok,name+': '+JSON.stringify(detail));console.log('PASS '+name);};
// 原脚本的五个视口；档案尺寸就是检查名与截图名里的 width×height，顺序也保持原样。
const viewports=['se','iphone-14','land-844','desktop-s','desktop-m'],notches=[0,.7,1.5];
// R6：保留原脚本 dpr=2、mobile=width<1000 的口径；安全区按原值显式传入。
const zeroSafeArea={top:0,right:0,bottom:0,left:0};
// 原脚本的四组设备用例：档案提供尺寸，覆盖值仍是原来的宽高与安全区。
const cases=[
 {name:'iphone-safari',profile:'iphone-14',width:390,height:700,insets:{top:47,bottom:34,left:0,right:0}},
 {name:'android-chrome',profile:'android-s',width:360,height:640,insets:zeroSafeArea},
 {name:'small-landscape',profile:'land-568',width:568,height:320,insets:zeroSafeArea},
 {name:'phone-landscape',profile:'land-844',width:844,height:390,insets:{top:0,bottom:21,left:47,right:47}},
];
const page=process.argv[2]||'史莱姆.html';
(async()=>{
 const session=await start({profile:'iphone-14',url:page+'?battle=ui',gpu:true,outDir:out});
 const {ev,client}=session,errors=session.consoleErrors;
 // Use pointer clicks for HTML controls; map dragging and planting below use actual touch events.
 const tap=session.tap;
 const geometry=()=>ev(`(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const p=S.world.placements.find(p=>p.def==='house'&&!p.stored),house=document.querySelector('[data-home-object="'+p.id+'"]'),map=document.querySelector('.home-map');
  return {house:house?rect(house):null,map:rect(map),controls:['.topbar','.home-season','.home-stock','.home-tools','.home-camera','.tabbar'].map(s=>({selector:s,...rect(document.querySelector(s))})),viewBox:map.getAttribute('viewBox'),size:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth>innerWidth};
 })()`);
 // 原 clearHouse 的三段判断（房在视口内、无横向溢出、不被 HUD 压盖）仍用底座几何快照，名称与阈值不变。
 const clearHouse=async name=>{
  const selectors=['.topbar','.home-season','.home-stock','.home-tools','.home-camera','.tabbar'];
  const id=await ev(`S.world.placements.find(p=>p.def==='house'&&!p.stored)?.id`);
  const houseSelector=`[data-home-object="${id}"]`;
  const snapshot=await layout.measure(session,[houseSelector,...selectors]);
  const house=snapshot.elements.find(e=>e.selector===houseSelector);
  const viewport=snapshot.viewport,failures=[];
  if(house){
   // 原脚本是严格 0px 包含判定；layout.noOverflow 带 1px 容差，这里按原口径单独判断四边与横向滚动。
   const r=house.rect;
   if(!(r.left>=0&&r.top>=0&&r.right<=viewport.width&&r.bottom<=viewport.height))failures.push({check:'overflow',selector:houseSelector,reason:`房子越出视口：left ${r.left}, top ${r.top}, right ${r.right}, bottom ${r.bottom}`});
   if(viewport.scrollWidth>viewport.width)failures.push({check:'overflow',selector:'document',reason:`横向溢出：scrollWidth ${viewport.scrollWidth} > 视口宽度 ${viewport.width}`});
   // 原判据是房子与 6 个 HUD 任一两轴相交都超过 1px 即失败。ignore 会跳过所有含 HUD 的配对（房子对 HUD 全被跳过），
   // 改用 whitelist 只豁免 HUD 之间的历史布局，房子对每个 HUD 仍逐对比较，阈值保持 >1px。
   const hudPairs=selectors.flatMap((a,i)=>selectors.slice(i+1).map(b=>[a,b]));
   failures.push(...layout.noOverlap(snapshot,{whitelist:hudPairs,minOverlap:1}));
   // 快照会跳过缺失的选择器；缺 HUD 时不能静默少比较一对，按失败处理。
   for(const selector of selectors)if(!snapshot.elements.some(e=>e.selector===selector))failures.push({check:'overlap',selector,reason:'HUD 缺失，无法比较房子与它的压盖'});
  }
  check(name,!!house&&!failures.length,{house:house?house.rect:null,viewport,failures});
 };
 const point=(x,y)=>ev(`(()=>{const p=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('.home-map').getScreenCTM());return {x:p.x,y:p.y};})()`);
 const metrics=async(profile,overrides={})=>session.metrics(profile,{dpr:2,mobile:(overrides.width||profiles.resolve(profile).width)<1000,safeArea:zeroSafeArea,...overrides});
 try{
  await client.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__intervals=[];const originalInterval=window.setInterval;window.setInterval=(...a)=>{const id=originalInterval(...a);__intervals.push(id);return id;};'});
  await metrics('iphone-14');
  await session.visit(page+'?battle=ui');
  assert.ok(await waitFor(()=>ev("typeof S!=='undefined'&&S.started"),10000));
  await ev(`__intervals.forEach(clearInterval);document.querySelector('#selftestOut')?.remove();S.world.clock=1200;S.world.estate.plots=Array.from({length:24},(_,i)=>i);S.world.estate.tech=LivingWorld.TECHS.map(t=>t.id);switchTab('home');`);await session.frame();
  await clearHouse('initial phone view shows the whole house below the resource bars');
  for(const name of viewports)for(const notch of notches){
   await metrics(name);await ev(`S.notchHeight=${notch};applyNotch()`);await session.frame();
   const {width,height}=session.profile;
   await clearHouse(`${width}x${height}/${notch}cm keeps the focused house visible after resizing`);
  }
  for(const c of cases){
   await metrics(c.profile,{width:c.width,height:c.height,safeArea:c.insets});await ev('S.notchHeight=.7;applyNotch()');await session.frame();
   await clearHouse(c.name+' respects browser chrome and system safe areas');
   const controls=(await geometry()).controls;check(c.name+' keeps controls outside the notch',controls.every(r=>r.left>=c.insets.left&&r.right<=c.width-c.insets.right),controls);
   for(const [x,y]of [[14,0],[0,0],[34,22]]){
    const r=await ev(`LivingWorld.execute(S,{type:'move',id:1,zone:0,x:${x},y:${y},rotation:0})`);assert.ok(r.ok,r.message);
    await ev('renderTab()');await tap('[data-lw="center"]');await clearHouse(`${c.name} centers the complete edge house at ${x},${y}`);
   }
   await session.shot(`${c.name}-house.png`);
  }
  await metrics('iphone-14',{height:700,safeArea:{top:47,bottom:34,left:0,right:0}});await tap('[data-lw="center"]');
  // Drag through the clear middle, so both map boundaries must become reachable with real touch input.
  for(let i=0;i<12;i++)await session.touch.drag({x:80,y:290},{x:290,y:470},3);
  const edge=await point(0,0),g=await geometry(),stock=g.controls.find(c=>c.selector==='.home-stock');
  check('dragging exposes the northern and western map edges below the HUD',edge.y>stock.bottom&&edge.x>0,{edge,stock});
  await session.shot('north-edge.png');
  await tap('[data-lw="panel"][data-panel="plants"]');assert.ok(await waitFor(()=>ev('!!document.querySelector(\'[data-lw="plant"][data-id="10"]\')'),2000),'seed panel opens after touch');await tap('[data-lw="plant"][data-id="10"]');
  const planted=await point(24,24);await session.touch.tap(planted.x,planted.y);await session.frame();
  check('the first map tile is reachable for planting by touch',await ev('S.world.crops.some(c=>c.x===0&&c.y===0)'),{planted});
  await tap('[data-lw="cancel"]');await session.touch.tap(planted.x,planted.y);await session.frame();
  check('a crop at the map edge opens its care panel',await ev('document.querySelector(".home-panel h2")?.textContent==="照料植物"'));
  await tap('[data-lw="close"]');
  await ev(`LivingWorld.execute(S,{type:'move',id:1,zone:0,x:14,y:0,rotation:0});renderTab()`);await tap('[data-lw="center"]');
  await clearHouse('return to the northern house after planting remains unobstructed');
  assert.ok(await waitFor(()=>ev('!document.querySelector(".toast.show")'),4000));await session.shot('iphone-safari-north-house.png');
  const before=await ev('document.querySelector(".home-map").getAttribute("viewBox")');
  await tap('[data-act="tab"][data-tab="space"]');await tap('[data-act="tab"][data-tab="home"]');
  check('leaving and returning preserves the camera without a map jump',await ev('document.querySelector(".home-map").getAttribute("viewBox")')===before);
  await client.send('Network.enable');await client.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await ev(`S.lastActive=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(S));`);
  await session.visit(page);assert.ok(await waitFor(()=>ev("typeof S!=='undefined'&&S.started"),10000));
  await ev('switchTab("home");__intervals.forEach(clearInterval)');await session.frame();await clearHouse('offline reload shows the saved northern house in full');
  check('no browser errors',errors.length===0,errors);report(out,'results.json',{checks,errors});
 }catch(e){await session.shot('failure.png').catch(()=>{});report(out,'results.json',{checks,errors,failure:String(e)});throw e;}
 finally{await session.close();}
 console.log(`RESULT ${checks.length}/${checks.length} mobile home checks`);
})().catch(e=>{console.error(e);process.exitCode=1;});
