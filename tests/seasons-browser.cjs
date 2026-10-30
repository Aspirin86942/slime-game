const assert=require('node:assert/strict');
const {launch,fileUrl,waitFor,report}=require('../tools/out/lib/cdp.js');
const out='tools/out/magic-ui/seasonal',checks=[],errors=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});assert.ok(ok,name+': '+JSON.stringify(detail));console.log('PASS '+name);};
(async()=>{
 const b=await launch({url:fileUrl('史莱姆.html','?battle=ui'),width:1440,height:900,dpr:1,gpu:true});
 const {ev,client}=b;
 client.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 client.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});
 const click=async selector=>{
  const p=await ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('missing control');const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
  await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
 };
 const decoded=()=>ev(`Promise.all([...new Set([...document.querySelectorAll('.home-map image')].map(i=>i.href.baseVal))].map(src=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth>0);image.onerror=()=>resolve(false);image.src=src})))`);
 const pixels=selector=>ev(`new Promise((resolve,reject)=>{const image=new Image();image.onerror=reject;image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const c=canvas.getContext('2d');c.drawImage(image,0,0,32,32);const a=c.getImageData(0,0,32,32).data,sum=[0,0,0];let minAlpha=255,snow=0;for(let i=0;i<a.length;i+=4){for(let k=0;k<3;k++)sum[k]+=a[i+k];minAlpha=Math.min(minAlpha,a[i+3]);if(Math.min(a[i],a[i+1],a[i+2])>180&&Math.max(a[i],a[i+1],a[i+2])-Math.min(a[i],a[i+1],a[i+2])<35)snow++;}resolve({rgb:sum.map(v=>v/1024),minAlpha,snow:snow/1024});};image.src=document.querySelector(${JSON.stringify(selector)}).getAttribute('href');})`);
 try{
  assert.ok(await waitFor(()=>ev(`typeof S!=='undefined'&&S.started`),15000));
  await ev(`document.querySelector('#selftestOut')?.remove();S.world.weather=0;S.world.weatherAt=1e12;S.world.reducedMotion=true;switchTab('home');window.fogCovers=n=>document.querySelector('#home-fog-shape').isPointInFill(new DOMPoint((n%6*6+3)*48,(Math.floor(n/6)*6+3)*48));`);
  const saved=await ev(`JSON.stringify({placements:S.world.placements,crops:S.world.crops,stock:S.world.inventory.items,slimes:S.slimes.map(s=>s.id)})`);
  for(let s=0;s<4;s++)for(const [phase,t] of [['dawn',150],['day',1200],['dusk',2250],['night',2800]]){
   await ev(`S.world.clock=${s*25200+t};renderTab();`);
   const art=await decoded();check(`${s} ${phase}: artwork decodes`,art.length>3&&art.every(Boolean));
   check(`${s} ${phase}: fog is visible and passes pointer input`,await ev(`(()=>{const fog=document.querySelector('.home-fog');return getComputedStyle(fog).pointerEvents==='none'&&Array.from({length:24},(_,n)=>n).filter(fogCovers).length===24-S.world.estate.plots.length&&document.querySelector('.home-map').dataset.phase===${JSON.stringify(phase)}&&document.querySelector('.home-world').dataset.season===${JSON.stringify(String(s))};})()`));
   check(`${s} ${phase}: evening lamps match daylight`,await ev(`!!document.querySelector('.home-lamplight')===${phase==='dusk'||phase==='night'}`));
   check(`${s} ${phase}: ground and road snow match the season`,await ev(`document.querySelector('.home-meadow').dataset.homeGround===${JSON.stringify(['spring','summer','autumn','winter'][s])}&&!!document.querySelector('.home-road-snow')===${s===3}`));
   if(s===3){const snow=await pixels('.home-meadow');check(`${phase}: winter ground is covered in white snow`,snow.snow>.9&&snow.rgb.every(v=>v>210),snow);}
   await b.shot(`${out}/${['spring','summer','autumn','winter'][s]}-${phase}.png`);
  }
  await ev(`S.world.reducedMotion=false;renderTab();`);
  check('seasonal pictures finish rasterizing and share cached images',await waitFor(()=>ev(`Promise.all([...new Set([...document.querySelectorAll('[data-home-paint]')].map(i=>i.getAttribute('href')))].map(src=>fetch(src).then(r=>r.blob()).then(b=>b.type==='image/png'))).then(values=>values.length>0&&values.every(Boolean))`),5000));
  const performance=await ev(`new Promise(resolve=>{const samples=[],start=performance.now();let last=start;function frame(t){if(t>last)samples.push(t-last);last=t;if(t-start<2500)requestAnimationFrame(frame);else resolve({fps:1000/(samples.reduce((a,b)=>a+b,0)/samples.length),frames:samples.length});}requestAnimationFrame(frame);})`);
  check('cloud cover and seasonal particles reach 55 FPS',performance.fps>=55,performance);
  await ev(`S.world.reducedMotion=true;renderTab();`);
  check('season changes preserve buildings, crops, inventory and companion identities',await ev(`JSON.stringify({placements:S.world.placements,crops:S.world.crops,stock:S.world.inventory.items,slimes:S.slimes.map(s=>s.id)})`)===saved);
  check('opened ground retains the original daytime brightness',await ev(`S.world.clock=1200;renderTab();document.querySelector('.home-meadow').style.filter==='saturate(0.74)'&&document.querySelector('.home-meadow+rect').getAttribute('opacity')==='.46'`));
  const dayCloud=await pixels('.home-cloud-texture');
  check('day fog is opaque blue-white hand-painted clouds above the scenery',dayCloud.minAlpha===255&&dayCloud.rgb[2]>dayCloud.rgb[0]&&dayCloud.rgb[0]>150&&await ev(`document.querySelector('.home-cloud-texture').dataset.cloudPalette==='0-day'&&new Set([...document.querySelectorAll('[data-cloud-variant]')].map(n=>n.dataset.cloudVariant)).size===6&&[...document.querySelectorAll('.home-cloud-edge image')].every(n=>+n.getAttribute('width')<=96)&&!!(document.querySelector('.home-objects').compareDocumentPosition(document.querySelector('.home-fog'))&Node.DOCUMENT_POSITION_FOLLOWING)`),dayCloud);
  check('every unreclaimed tile is covered by the cloud shape',await ev(`Array.from({length:864},(_,n)=>{const x=n%36,y=Math.floor(n/36),plot=Math.floor(y/6)*6+Math.floor(x/6);return S.world.estate.plots.includes(plot)||document.querySelector('#home-fog-shape').isPointInFill(new DOMPoint((x+.5)*48,(y+.5)*48));}).every(Boolean)`));
  await ev(`S.world.reducedMotion=false;renderTab();`);
  await click('[data-home-plot="7"] image');await click('.home-panel [data-command*="clear"]');
  check('successful clearing plays a bounded cloud reveal',await ev(`!!document.querySelector('.home-fog-reveal')&&document.querySelector('.home-fog-reveal').getAnimations().length===1`));
  check('clearing cloud effect removes itself',await waitFor(()=>ev(`!document.querySelector('.home-fog-reveal')`),2000));
  await ev(`S.world.reducedMotion=true;`);
  check('clearing a plot removes its fog and sign, while all other locked plots stay covered',await ev(`S.world.estate.plots.includes(7)&&Array.from({length:24},(_,n)=>n).filter(fogCovers).length===19&&!fogCovers(7)&&!document.querySelector('[data-home-plot="7"]')&&[8,9,14,15].every(n=>!fogCovers(n))`));
  if(await ev(`!!document.querySelector('.home-panel [data-lw="close"]')`))await click('.home-panel [data-lw="close"]');await decoded();await b.shot(`${out}/cleared-day.png`);
  await ev(`S.world.clock=2800;LivingWorld.paintResidents();`);
  const nightCloud=await pixels('.home-cloud-texture');
  check('night fog changes to opaque blue-black clouds without revealing locked plots',nightCloud.minAlpha===255&&nightCloud.rgb[2]>nightCloud.rgb[0]+25&&nightCloud.rgb.every(v=>v<105)&&await ev(`document.querySelector('.home-cloud-texture').dataset.cloudPalette==='0-night'&&Array.from({length:24},(_,n)=>n).filter(fogCovers).length===19`),nightCloud);
  await ev(`S.world.clock=2399;renderTab();`);await click('[data-home-object="1"]');await click('[data-lw="move"]');
  const p=await ev(`(()=>{const p=new DOMPoint(17*48,11*48).matrixTransform(document.querySelector('.home-map').getScreenCTM());return {x:p.x,y:p.y};})()`);
  await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});
  await ev(`window.seasonMap=document.querySelector('.home-map');window.seasonPreview=document.querySelector('.home-placement-ghost');window.seasonView=seasonMap.getAttribute('viewBox');S.world.clock=2400;LivingWorld.paintResidents();`);
  check('night begins during placement without replacing the map, camera or preview',await ev(`!!seasonPreview&&seasonMap===document.querySelector('.home-map')&&seasonView===seasonMap.getAttribute('viewBox')&&seasonPreview===document.querySelector('.home-placement-ghost')&&seasonMap.classList.contains('night')&&!!seasonPreview.querySelector('.home-lamplight')&&!!document.querySelector('[data-lw="cancel"]')`));
  await ev(`S.world.clock=100799;LivingWorld.paintResidents();S.world.clock=100800;LivingWorld.paintResidents();`);
  check('winter becomes spring automatically at the year boundary',await ev(`seasonMap.dataset.season==='0'&&seasonMap.dataset.phase==='dawn'&&!seasonMap.classList.contains('night')&&document.querySelector('[data-home-calendar]').textContent.includes('春季')&&!!document.querySelector('.home-nature [data-home-paint="home-blossom"]')`));
  await ev(`S.world.clock=102600;LivingWorld.paintResidents();`);
  check('spring snow remnants melt with the game clock during placement',await ev(`document.querySelector('.home-thaw').getAttribute('opacity')==='0.5'&&seasonMap===document.querySelector('.home-map')&&seasonPreview===document.querySelector('.home-placement-ghost')`));
  await click('[data-lw="cancel"]');
  await client.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844});
  await ev(`S.world.clock=78400;renderTab();`);await click('[data-lw="center"]');await decoded();await b.shot(`${out}/winter-night-mobile.png`);
  check('phone map fills the viewport without horizontal overflow',await ev(`document.querySelector('.home-map').getBoundingClientRect().width===390&&document.documentElement.scrollWidth===innerWidth&&document.querySelectorAll('.home-map').length===1`));
  await ev(`S.world.reducedMotion=false;S.world.clock=2800;renderTab();`);
  check('seasonal atmosphere animates with reduced motion disabled',await ev(`getComputedStyle(document.querySelector('.home-air i')).animationName==='home-air-fall'`));
  await client.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  check('system reduced motion stops fog and seasonal particles',await ev(`getComputedStyle(document.querySelector('.home-air i')).animationName==='none'&&getComputedStyle(document.querySelector('.home-fog-clouds')).animationName==='none'`));
  await ev(`S.world.estate.plots=Array.from({length:24},(_,n)=>n);renderTab();`);
  check('a fully reclaimed estate has no remaining cloud cover',await ev(`!document.querySelector('.home-fog')&&!document.querySelector('[data-home-plot]')`));
  await client.send('Emulation.setEmulatedMedia',{features:[]});
  await client.send('Network.enable');await client.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await client.send('Page.navigate',{url:fileUrl('史莱姆.html','?battle=ui')});assert.ok(await waitFor(()=>ev(`typeof S!=='undefined'&&S.started`),15000));
  await ev(`document.querySelector('#selftestOut')?.remove();S.world.clock=76800;switchTab('home');`);
  const offline=await decoded();check('seasonal art and fog work fully offline',offline.length>3&&offline.every(Boolean));
  check('no browser errors',errors.length===0,errors);
  report(out,'results.json',{checks,errors});console.log(`RESULT ${checks.length}/${checks.length} seasonal browser checks`);
 }catch(e){await b.shot(`${out}/failure.png`).catch(()=>{});report(out,'results.json',{checks,errors,failure:String(e)});throw e;}
 finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
