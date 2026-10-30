// Actual Chromium input, layout, persistence and frame sampling in an isolated profile.
const assert=require('node:assert/strict');
const {launch,fileUrl,sleep,waitFor,report}=require('../tools/out/lib/cdp.js');
const out='tools/out/magic-ui/home',checks=[],errors=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});assert.ok(ok,name+': '+JSON.stringify(detail));console.log('PASS '+name);};
(async()=>{
 const b=await launch({url:'about:blank',width:1440,height:900,dpr:1,touchEnabled:true,gpu:true});
 const {ev,client}=b;client.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 client.on('Runtime.consoleAPICalled',e=>{if(['error','assert'].includes(e.type))errors.push(e.args.map(a=>a.value??a.description).join(' '));});
 client.on('Log.entryAdded',({entry})=>{if(entry.level==='error')errors.push(entry.text);});
 await client.send('Log.enable');
 const mouse=async(type,p,extra={})=>client.send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,...extra});
 const tap=async p=>{await mouse('mousePressed',p,{button:'left',clickCount:1});await mouse('mouseReleased',p,{button:'left',clickCount:1});};
 const click=async selector=>{
  if(/data-panel=/.test(selector)&&await ev(`!!document.querySelector('.home-panel,.home-orbit')`))await click('[data-lw="close"]');
  if(/data-panel="(?:craft|storage|ecology)"/.test(selector)&&!await ev(`!!document.querySelector(${JSON.stringify(selector)})`))await click('[data-lw="more"]');
  const p=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await tap(p);
 };
 const point=async(x,y)=>ev(`(()=>{const p=new DOMPoint(${(x+.5)*48},${(y+.5)*48}).matrixTransform(document.querySelector('.home-map').getScreenCTM());return {x:p.x,y:p.y};})()`);
 const view=()=>ev(`document.querySelector('.home-map').getAttribute('viewBox')`);
 const drag=async(a,z)=>{await mouse('mousePressed',a,{button:'left',buttons:1,clickCount:1});for(let i=1;i<=10;i++){await mouse('mouseMoved',{x:a.x+(z.x-a.x)*i/10,y:a.y+(z.y-a.y)*i/10},{button:'left',buttons:1});await sleep(18);}await mouse('mouseReleased',z,{button:'left',clickCount:1});};
 const resize=async(width,height)=>{await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<760,screenWidth:width,screenHeight:height});await sleep(150);};
 try{
  await client.send('Page.navigate',{url:fileUrl('史莱姆.html','?battle=ui')});
  await waitFor(()=>ev(`typeof S!=='undefined'&&S.started`),10000);
  await ev(`document.querySelector('#selftestOut')?.remove();S.name='小院主人';S.slimes=[createSlime(false),createSlime(false),createSlime(false)];S.slimes.forEach((s,i)=>{s.name=['露露','芽芽','桃桃'][i];s.size=.8;});S.started=true;for(const k of ['wood','stone','dew','petal','herb','algae','plank','dye','stardust','ingredient','fruit'])S.world.stock[k]=800;switchTab('home');`);
  await sleep(250);check('single fullscreen map with shared navigation and all currencies',await ev(`document.querySelectorAll('.home-map').length===1&&document.querySelectorAll('.tabbar button').length===6&&getComputedStyle(document.querySelector('.topbar .cur.p')).display!=='none'&&document.querySelector('.home-map').getBoundingClientRect().width===innerWidth`));
  const loaded=await ev(`Promise.all([...new Set([...document.querySelectorAll('.home-map image')].map(i=>i.href.baseVal))].map(src=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth>0);image.onerror=()=>resolve(false);image.src=src})))`);
  check('painted ground and object atlases decode locally',loaded.length>=3&&loaded.every(Boolean),loaded);
  check('home uses shared line icons in navigation and four tools',await ev(`document.querySelectorAll('.tabbar .ui-icon').length===6&&document.querySelectorAll('.home-tools .ui-icon').length===4&&!document.querySelector('.tabbar .home-art-icon')`));
  await ev('S.world.stock.wood=0;renderTab()');
  await click('[data-lw="panel"][data-panel="build"]');await click('[data-lw="build"][data-def="woodshop"]');
  check('insufficient materials disable construction without spending stock',await ev(`document.querySelector('[data-def="woodshop"]').disabled&&S.world.stock.wood===0&&!S.world.placements.some(p=>p.def==='woodshop')`));
  await ev('S.world.stock.wood=800;renderTab()');
  await click('[data-lw="build"][data-def="woodshop"]');await click('[data-lw="rotate"]');
  const placementBefore=await ev('JSON.stringify({placements:S.world.placements,stock:S.world.inventory.items,seq:S.world.seq})');
  const house=await ev('S.world.placements.find(p=>p.def==="house")');await tap(await point(house.x,house.y));
  check('overlapping construction preserves placements and materials',await ev('JSON.stringify({placements:S.world.placements,stock:S.world.inventory.items,seq:S.world.seq})')===placementBefore);
  await tap(await point(21,8));
  check('mouse places rotated facility',await ev(`S.world.placements.some(p=>p.def==='woodshop'&&p.x===21&&p.y===8&&p.rotation===1)`));
  check('rotated painted facilities preserve their aspect ratio',await ev(`(()=>{const p=S.world.placements.find(p=>p.def==='woodshop'),m=document.querySelector('[data-home-object="'+p.id+'"] image').getScreenCTM();return Math.abs(Math.hypot(m.a,m.b)-Math.hypot(m.c,m.d))<.001;})()`));
  const id=await ev(`S.world.placements.find(p=>p.def==='woodshop').id`);await click(`[data-home-object="${id}"]`);await click('[data-lw="move"]');await drag(await point(21,8),await point(23,8));
  check('drag moves facility and keeps its ID',await ev(`S.world.placements.find(p=>p.id===${id}).x===23`));
  await click(`[data-home-object="${id}"]`);await click('[data-lw="manage-open"]');await click('[data-lw="cmd"][data-command*="store"]');
  await click('[data-lw="panel"][data-panel="build"]');await click('[data-lw="category"][data-category="stored"]');await click(`[data-lw="move"][data-id="${id}"]`);await tap(await point(21,8));
  check('stored item returns through the catalog',await ev(`!S.world.placements.find(p=>p.id===${id}).stored`));
  await click('[data-lw="close"]');await click('[data-lw="center"]');await click('[data-lw="panel"][data-panel="build"]');await click('[data-lw="category"][data-category="paths"]');await click('[data-lw="path"][data-style="2"]');await drag(await point(11,7),await point(24,7));
  check('one dragged stroke crosses both former district seams',await ev(`[11,12,23,24].every(x=>S.world.paths[0].includes(7*36+x)&&S.world.pathStyles['0:'+(7*36+x)]===2)`));
  const roads=await ev(`JSON.stringify(S.world.paths)`),a=await point(12,6),z=await point(14,6);await b.touch.start(a.x,a.y);await b.touch.move(z.x,z.y);await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  check('cancelled touch stroke does not change the saved roads',await ev(`JSON.stringify(S.world.paths)`)===roads);
  await click('[data-lw="cancel"]');let before=await view();await drag({x:600,y:240},{x:780,y:350});check('drag pans map',await view()!==before);
  before=await view();await mouse('mouseWheel',{x:700,y:350},{deltaY:-180,deltaX:0});await sleep(100);check('wheel zoom changes the camera',await view()!==before);
  before=await view();await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:600,y:350,id:1},{x:800,y:350,id:2}]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:550,y:340,id:1},{x:850,y:360,id:2}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});check('pinch zoom and two-finger pan work',await view()!==before);
  await click('[data-lw="center"]');await click('[data-lw="panel"][data-panel="plants"]');await click('[data-lw="plant"][data-id="10"]');
  let tile=await ev(`(()=>{const svg=document.querySelector('.home-map'),r=svg.viewBox.baseVal;return {x:Math.floor((r.x+r.width*.38)/48),y:Math.floor((r.y+r.height*.42)/48)};})()`);await tap(await point(tile.x,tile.y));
  check('seed catalog plants by tapping the ground',await ev(`S.world.crops.some(c=>c.x===${tile.x}&&c.y===${tile.y})`));await click('[data-lw="cancel"]');
  const planted=await ev('S.world.crops.at(-1).id'),dew=await ev('S.world.stock.dew');
  await click(`[data-home-crop="${planted}"]`);await click('[data-command*="care"]');
  check('plant care consumes one dew through the visible control',await ev('S.world.stock.dew')===dew-1);
  await ev(`S.world.crops.find(c=>c.id===${planted}).progress=1;renderTab();`);
  const beforeHarvest=await ev('JSON.stringify(S.world.inventory.items)');await click('[data-command*="harvest"]');
  check('mature crop harvest changes inventory and cannot stay harvestable',await ev('JSON.stringify(S.world.inventory.items)')!==beforeHarvest&&await ev(`!S.world.crops.some(c=>c.id===${planted}&&c.progress>=1)`));
  await click('[data-lw="close"]');await click('[data-home-object="2"]');await click('[data-lw="manage-open"]');await click('[data-lw="assign"]');
  check('a partner starts work from the facility panel',await ev('S.world.workers.length===1&&LivingWorld.isBusy(S,S.world.workers[0].slimeId)'));
  await click('[data-command*="unassign"]');check('resting releases a working partner',await ev('S.world.workers.length===0'));
  await click('[data-lw="close"]');
  await ev(`for(const c of S.world.crops.slice())LivingWorld.execute(S,{type:'uproot',id:c.id});`);
  // Populate a showcase using the same atomic commands; never touch a player profile.
  await ev(`(()=>{const issue=c=>{const r=LivingWorld.execute(S,c);if(!r.ok)throw Error(r.message)};for(const [def,x,y]of [['kitchen',12,13],['pond',22,11],['stars',10,8],['pollen',19,6],['decor-3-0',12,10],['decor-4-0',16,8],['decor-2-1',16,10],['decor-1-0',13,8],['decor-1-0',13,9]])issue({type:'build',def,zone:0,x,y});for(const [cultivar,x,y]of [[10,19,12],[11,20,12],[12,19,13],[13,20,13],[22,19,14],[23,20,14],[28,10,11],[29,11,11]]){issue({type:'plant',cultivar,zone:0,x,y});S.world.crops.at(-1).progress=.85;}issue({type:'craft',recipe:'feed',building:S.world.placements.find(p=>p.def==='kitchen').id});renderTab();})()`);
  await click('[data-lw="panel"][data-panel="craft"]');await ev(`LivingWorld.tick(S,61);`);await sleep(2700);await ev('LivingWorld.refresh()');check('open crafting panel updates ready state',await ev(`!!document.querySelector('.home-panel [data-command*="claimCraft"]:not(:disabled)')`));
  const feedBefore=await ev('S.bag.food'),claimPoint=await ev(`(()=>{const r=document.querySelector('.home-panel [data-command*="claimCraft"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await tap(claimPoint);await tap(claimPoint);
  check('repeated claim clicks pay exactly once into the shared inventory',await ev('S.bag.food')===feedBefore+2&&await ev('S.world.crafts.length===0&&!document.querySelector(\'.home-panel [data-command*="claimCraft"]\')'));
  await click('[data-lw="close"]');await click('[data-lw="panel"][data-panel="ecology"]');await click('[data-lw="overlay"][data-overlay="moisture"]');check('ecology layer renders across the continuous map',await ev(`document.querySelectorAll('.home-environment').length===864`));await click('[data-lw="overlay"][data-overlay=""]');await click('[data-lw="close"]');
  await ev('S.world.clock=1200;renderTab()');
  for(let i=0;i<3;i++)await click('[data-lw="zoom"][data-factor="0.8"]');await click('[data-lw="center"]');
  const toy=await ev(`S.world.placements.find(p=>p.def==='toys').id`);
  // The house now centers between the HUD and tools. Pan the southern toys into view before clicking.
  const toyY=await ev(`(()=>{const r=document.querySelector('[data-home-object="${toy}"]').getBoundingClientRect();return r.y+r.height/2;})()`);
  await drag({x:1100,y:600},{x:1100,y:600+450-toyY});
  for(const kind of ['ball','stack']){
   await click(`[data-home-object="${toy}"]`);await click('[data-lw="use"]');await click(`[data-lw="play"][data-kind="${kind}"]`);
   // Stack binds its controls after the first animation frame has measured the field.
   const ready=await waitFor(()=>ev(`${kind==='stack'?'stackGame':'ballGame'}?.running===true`),3000);
   check('home launches original '+kind+' game',ready&&await ev(`!!document.querySelector('#gameOverlay')&&Object.values(S.world.activities).some(a=>a.kind==='play')`));
   await click('#gClose');check(kind+' releases companions on exit',await ev(`!document.querySelector('#gameOverlay')&&!Object.values(S.world.activities).some(a=>a.kind==='play')`));await click('[data-lw="close"]');
  }
  await waitFor(()=>ev(`!document.querySelector('.toast.show')`),5000);
  await tap(await point(17,6));
  for(const [width,height]of [[1440,900],[1920,1080],[390,844],[320,568],[844,390]]){
   await resize(width,height);const zoom=await ev('innerWidth/document.querySelector(".home-map").viewBox.baseVal.width');await mouse('mouseWheel',{x:width*.5,y:height*.45},{deltaY:Math.log(zoom/(width<760?1.1:1.45))/.0015,deltaX:0});await sleep(90);await click('[data-lw="center"]');const layout=await ev(`(()=>{const r=document.querySelector('.home-map').getBoundingClientRect(),nav=document.querySelector('.tabbar').getBoundingClientRect(),tool=document.querySelector('.home-tools').getBoundingClientRect();return {width:r.width,height:r.height,navBottom:nav.bottom,toolLeft:tool.left,toolRight:tool.right,scroll:document.documentElement.scrollWidth,inner:innerWidth};})()`);
   check(`viewport ${width}x${height} fills screen and keeps controls visible`,layout.width===width&&layout.height===height&&layout.navBottom<=height&&layout.toolLeft>=0&&layout.toolRight<=width&&layout.scroll===layout.inner,layout);
   await b.shot(`${out}/home-${width}x${height}.png`);await click('[data-lw="panel"][data-panel="build"]');await click('[data-lw="category"][data-category="facilities"]');const panel=await ev(`(()=>{const r=document.querySelector('.home-panel').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})()`);check(`catalog fits ${width}x${height}`,panel.left>=0&&panel.right<=width&&panel.top>=0&&panel.bottom<=height,panel);
   if(width===844)check('landscape catalog shows a complete available item without scrolling',await ev(`(()=>{const p=document.querySelector('.home-panel'),b=p.querySelector('.home-catalog button:not(:disabled)'),r=b.getBoundingClientRect();return r.top>=p.getBoundingClientRect().top&&r.bottom<=p.getBoundingClientRect().bottom;})()`));
   await b.shot(`${out}/catalog-${width}x${height}.png`);await click('[data-lw="close"]');
  }
  await resize(390,844);await click('[data-lw="center"]');await click('[data-lw="panel"][data-panel="build"]');
  await click('[data-lw="category"][data-category="decor"]');const decorCount=await ev(`document.querySelectorAll('.home-catalog [data-def]>svg image.painted-sprite').length`);check('all 42 decorations have painted catalog previews',decorCount===42,decorCount);await b.shot(`${out}/decor-390x844.png`);
  await click('[data-lw="category"][data-category="paths"]');check('six painted road styles are available',await ev(`document.querySelectorAll('.home-catalog .road-swatch').length===6`));await b.shot(`${out}/paths-390x844.png`);
  await click('[data-lw="panel"][data-panel="plants"]');check('seed catalog shows all plants including the first-harvest reward',await ev(`document.querySelectorAll('.home-plant-heading image').length===S.world.cultivars.filter(c=>LivingWorld.PLANTS.find(p=>p.id===c.species)?.family===0).length&&S.world.flags.includes('home:glow-seed')`));await b.shot(`${out}/plants-390x844.png`);await click('[data-lw="close"]');
  before=await view();await b.touch.drag({x:180,y:270},{x:245,y:330});check('phone touch drag pans without selecting objects',await view()!==before);
  await resize(1440,900);await click('[data-lw="center"]');await ev('S.world.clock=2800;S.theme="dark";applyTheme();renderTab()');
  await ev(`new Promise(resolve=>{const start=performance.now();function frame(){if(performance.now()-start>220)resolve(true);else requestAnimationFrame(frame);}requestAnimationFrame(frame);})`);
  await b.shot(`${out}/home-night.png`);check('night scenery retains the shared dark theme',await ev(`document.querySelector('.home-map').classList.contains('night')&&getComputedStyle(document.querySelector('.home-tools')).backgroundColor==='rgb(20, 26, 42)'&&getComputedStyle(document.querySelector('.home-season')).color==='rgb(126, 138, 168)'&&getComputedStyle(document.querySelector('.tabbar button')).color==='rgb(126, 138, 168)'`));
  await ev('S.world.clock=1200;S.theme="sunset";applyTheme();renderTab()');
  const fps=async()=>ev(`new Promise(resolve=>{const samples=[],start=performance.now();let last=start;function step(t){if(t>last)samples.push(t-last);last=t;if(t-start<2500)requestAnimationFrame(step);else resolve({fps:1000/(samples.reduce((a,b)=>a+b,0)/samples.length),frames:samples.length,p95:samples.sort((a,b)=>a-b)[Math.floor(samples.length*.95)]});}requestAnimationFrame(step);})`);
  const ordinary=await fps();check('ordinary home reaches 55 FPS',ordinary.fps>=55,ordinary);
  const normal=await ev('JSON.stringify(S)');await ev(`for(let y=3;y<22;y++)for(let x=3;x<33;x++){if(S.world.crops.length>=300)break;const v=S.world.cultivars.find(c=>c.id===10);v.seeds=999;LivingWorld.execute(S,{type:'plant',cultivar:10,zone:0,x,y});}renderTab();`);const dense=await fps();check('300 plants reach 30 FPS',dense.fps>=30&&await ev('S.world.crops.length')>=300,dense);
  const renderer=await ev(`(()=>{const gl=document.createElement('canvas').getContext('webgl');const e=gl?.getExtension('WEBGL_debug_renderer_info');return {userAgent:navigator.userAgent,renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'unavailable',cpuThreads:navigator.hardwareConcurrency};})()`);
  await ev(`Object.assign(S,JSON.parse(${JSON.stringify(normal)}));LivingWorld.ensure(S);S.lastActive=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(S));`);const saved=await ev(`JSON.stringify({slimes:S.slimes.map(s=>s.id),stock:S.world.inventory.items,placements:S.world.placements,crops:S.world.crops.map(c=>c.id)})`);
  await client.send('Network.enable');await client.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await client.send('Page.navigate',{url:fileUrl('史莱姆.html')});await waitFor(()=>ev(`typeof S!=='undefined'&&S.started&&S.saveVersion===5`),10000);await ev(`switchTab('home')`);
  check('offline normal reload retains identities, layout and all stock',await ev(`JSON.stringify({slimes:S.slimes.map(s=>s.id),stock:S.world.inventory.items,placements:S.world.placements,crops:S.world.crops.map(c=>c.id)})`)===saved);
  const offlineArt=await ev(`Promise.all([...new Set([...document.querySelectorAll('.home-map image')].map(i=>i.href.baseVal))].map(src=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth>0);image.onerror=()=>resolve(false);image.src=src})))`);
  check('all painted assets reload with networking disabled',offlineArt.length>=3&&offlineArt.every(Boolean));
  for(const tab of ['space','summon','travel','bag','status','home']){await click(`[data-act="tab"][data-tab="${tab}"]`);check('old page opens: '+tab,await ev(`activeTab===${JSON.stringify(tab)}&&document.querySelector('#content').textContent.length>20`));}
  await ev(`localStorage.setItem(SAVE_KEY,'synthetic-conflict');save();`);check('conflicting tab freezes writes and shows recovery action',await ev(`!canWrite()&&!!document.querySelector('[data-act="reloadSave"]')&&localStorage.getItem(SAVE_KEY)==='synthetic-conflict'`));
  check('no browser exceptions or console errors',errors.length===0,errors);report(out,'results.json',{checks,ordinary,dense,renderer,errors});
 }catch(e){await b.shot(`${out}/failure.png`).catch(()=>{});report(out,'results.json',{checks,errors,failure:String(e)});throw e;}
 finally{await b.close();}
 console.log(`RESULT ${checks.length}/${checks.length} browser checks`);
})().catch(e=>{console.error(e);process.exitCode=1;});
