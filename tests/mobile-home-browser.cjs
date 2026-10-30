// Regress the phone bug: the controls fitted, but the map edge and house stayed behind them.
const assert=require('node:assert/strict');
const {launch,fileUrl,waitFor,report}=require('../tools/out/lib/cdp.js');
const out='tools/out/magic-ui/mobile',checks=[],errors=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});assert.ok(ok,name+': '+JSON.stringify(detail));console.log('PASS '+name);};
(async()=>{
 const b=await launch({url:'about:blank',width:390,height:844,dpr:2,touchEnabled:true,gpu:true}),{ev,client}=b;
 client.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 client.on('Runtime.consoleAPICalled',e=>{if(['error','assert'].includes(e.type))errors.push(e.args.map(a=>a.value??a.description).join(' '));});
 client.on('Log.entryAdded',({entry})=>{if(entry.level==='error')errors.push(entry.text);});await client.send('Log.enable');
 const frame=()=>ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))))');
 // Use pointer clicks for HTML controls; map dragging and planting below use actual touch events.
 const tap=async selector=>{const p=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});await frame();};
 const geometry=()=>ev(`(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const p=S.world.placements.find(p=>p.def==='house'&&!p.stored),house=document.querySelector('[data-home-object="'+p.id+'"]'),map=document.querySelector('.home-map');
  return {house:house?rect(house):null,map:rect(map),controls:['.topbar','.home-season','.home-stock','.home-tools','.home-camera','.tabbar'].map(s=>({selector:s,...rect(document.querySelector(s))})),viewBox:map.getAttribute('viewBox'),size:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth>innerWidth};
 })()`);
 const clearHouse=async name=>{const g=await geometry(),h=g.house;check(name,!!h&&h.left>=0&&h.top>=0&&h.right<=g.size.width&&h.bottom<=g.size.height&&!g.overflow&&!g.controls.some(c=>Math.min(h.right,c.right)-Math.max(h.left,c.left)>1&&Math.min(h.bottom,c.bottom)-Math.max(h.top,c.top)>1),g);};
 const point=(x,y)=>ev(`(()=>{const p=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('.home-map').getScreenCTM());return {x:p.x,y:p.y};})()`);
 const metrics=async(width,height,insets={top:0,left:0,bottom:0,right:0})=>{
  await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:width<1000,screenWidth:width,screenHeight:height});
  await client.send('Emulation.setSafeAreaInsetsOverride',{insets});await frame();
 };
 try{
  await client.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__intervals=[];const originalInterval=window.setInterval;window.setInterval=(...a)=>{const id=originalInterval(...a);__intervals.push(id);return id;};'});
  await client.send('Page.navigate',{url:fileUrl(process.argv[2]||'史莱姆.html','?battle=ui')});
  assert.ok(await waitFor(()=>ev("typeof S!=='undefined'&&S.started"),10000));
  await ev(`__intervals.forEach(clearInterval);document.querySelector('#selftestOut')?.remove();S.world.clock=1200;S.world.estate.plots=Array.from({length:24},(_,i)=>i);S.world.estate.tech=LivingWorld.TECHS.map(t=>t.id);switchTab('home');`);await frame();
  await clearHouse('initial phone view shows the whole house below the resource bars');
  for(const [width,height]of [[320,568],[390,844],[844,390],[1440,900],[1920,1080]])for(const notch of [0,.7,1.5]){
   await metrics(width,height);await ev(`S.notchHeight=${notch};applyNotch()`);await frame();
   await clearHouse(`${width}x${height}/${notch}cm keeps the focused house visible after resizing`);
  }
  const cases=[{name:'iphone-safari',width:390,height:700,insets:{top:47,bottom:34,left:0,right:0}},{name:'android-chrome',width:360,height:640,insets:{top:0,bottom:0,left:0,right:0}},{name:'small-landscape',width:568,height:320,insets:{top:0,bottom:0,left:0,right:0}},{name:'phone-landscape',width:844,height:390,insets:{top:0,bottom:21,left:47,right:47}}];
  for(const c of cases){
   await metrics(c.width,c.height,c.insets);await ev('S.notchHeight=.7;applyNotch()');await frame();
   await clearHouse(c.name+' respects browser chrome and system safe areas');
   const controls=(await geometry()).controls;check(c.name+' keeps controls outside the notch',controls.every(r=>r.left>=c.insets.left&&r.right<=c.width-c.insets.right),controls);
   for(const [x,y]of [[14,0],[0,0],[34,22]]){
    const r=await ev(`LivingWorld.execute(S,{type:'move',id:1,zone:0,x:${x},y:${y},rotation:0})`);assert.ok(r.ok,r.message);
    await ev('renderTab()');await tap('[data-lw="center"]');await clearHouse(`${c.name} centers the complete edge house at ${x},${y}`);
   }
   await b.shot(`${out}/${c.name}-house.png`);
  }
  await metrics(390,700,{top:47,bottom:34,left:0,right:0});await tap('[data-lw="center"]');
  // Drag through the clear middle, so both map boundaries must become reachable with real touch input.
  for(let i=0;i<12;i++)await b.touch.drag({x:80,y:290},{x:290,y:470},3);
  const edge=await point(0,0),g=await geometry(),stock=g.controls.find(c=>c.selector==='.home-stock');
  check('dragging exposes the northern and western map edges below the HUD',edge.y>stock.bottom&&edge.x>0,{edge,stock});
  await b.shot(`${out}/north-edge.png`);
  await tap('[data-lw="panel"][data-panel="plants"]');assert.ok(await waitFor(()=>ev('!!document.querySelector(\'[data-lw="plant"][data-id="10"]\')'),2000),'seed panel opens after touch');await tap('[data-lw="plant"][data-id="10"]');
  const planted=await point(24,24);await b.touch.tap(planted.x,planted.y);await frame();
  check('the first map tile is reachable for planting by touch',await ev('S.world.crops.some(c=>c.x===0&&c.y===0)'),{planted});
  await tap('[data-lw="cancel"]');await b.touch.tap(planted.x,planted.y);await frame();
  check('a crop at the map edge opens its care panel',await ev('document.querySelector(".home-panel h2")?.textContent==="照料植物"'));
  await tap('[data-lw="close"]');
  await ev(`LivingWorld.execute(S,{type:'move',id:1,zone:0,x:14,y:0,rotation:0});renderTab()`);await tap('[data-lw="center"]');
  await clearHouse('return to the northern house after planting remains unobstructed');
  assert.ok(await waitFor(()=>ev('!document.querySelector(".toast.show")'),4000));await b.shot(`${out}/iphone-safari-north-house.png`);
  const before=await ev('document.querySelector(".home-map").getAttribute("viewBox")');
  await tap('[data-act="tab"][data-tab="space"]');await tap('[data-act="tab"][data-tab="home"]');
  check('leaving and returning preserves the camera without a map jump',await ev('document.querySelector(".home-map").getAttribute("viewBox")')===before);
  await client.send('Network.enable');await client.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await ev(`S.lastActive=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(S));`);
  await client.send('Page.navigate',{url:fileUrl(process.argv[2]||'史莱姆.html')});assert.ok(await waitFor(()=>ev("typeof S!=='undefined'&&S.started"),10000));
  await ev('switchTab("home");__intervals.forEach(clearInterval)');await frame();await clearHouse('offline reload shows the saved northern house in full');
  check('no browser errors',errors.length===0,errors);report(out,'results.json',{checks,errors});
 }catch(e){await b.shot(`${out}/failure.png`).catch(()=>{});report(out,'results.json',{checks,errors,failure:String(e)});throw e;}
 finally{await b.close();}
 console.log(`RESULT ${checks.length}/${checks.length} mobile home checks`);
})().catch(e=>{console.error(e);process.exitCode=1;});
