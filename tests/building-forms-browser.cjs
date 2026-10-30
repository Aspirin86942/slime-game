// Exercise the shipped, offline HTML with isolated test saves and real browser input.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {launch,fileUrl,sleep,waitFor,report}=require('../tools/out/lib/cdp.js');
const out='tools/out/magic-ui/building-forms',checks=[],errors=[],gallery=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});assert.ok(ok,name+': '+JSON.stringify(detail));console.log('PASS '+name);};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async()=>{
 const b=await launch({url:'about:blank',width:1440,height:900,dpr:1,touchEnabled:true,gpu:true});
 const {ev,client}=b;
 client.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 client.on('Runtime.consoleAPICalled',e=>{if(['error','assert'].includes(e.type))errors.push(e.args.map(a=>a.value??a.description).join(' '));});
 const tap=async p=>{await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});};
 const click=async selector=>tap(await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`));
 const imageHash=selector=>ev(`(async()=>{const src=document.querySelector(${JSON.stringify(selector)}).href.baseVal;await new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src=src;});return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await (await fetch(src)).arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');})()`);
 const resize=async(width,height)=>{await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<760,screenWidth:width,screenHeight:height});await sleep(160);};
 try{
  await client.send('Page.navigate',{url:fileUrl('史莱姆.html','?battle=ui')});
  assert.ok(await waitFor(()=>ev(`typeof S!=='undefined'&&S.started`),10000));
  await ev(`document.querySelector('#selftestOut')?.remove();S.name='林间小院';S.slimes=[createSlime(false)];S.slimes[0].name='芽芽';S.started=true;S.saveVersion=5;S.theme='light';applyTheme();`);
  const defs=await ev(`LivingWorld.BUILDINGS.filter(d=>!['expedition','resonance'].includes(d.id)).map(d=>({id:d.id,name:d.name,forms:d.forms}))`);
  for(let i=0;i<defs.length;i++){
   const def=defs[i];
   const id=await ev(`(()=>{switchTab('space');S.world=LivingWorld.createWorld(487);S.world.estate.plots=Array.from({length:24},(_,i)=>i);S.world.estate.tech=LivingWorld.TECHS.map(t=>t.id);S.world.placements=[];S.world.crops=[];S.world.workers=[];LivingWorld.ensure(S);for(const k of ['wood','stone'])S.world.stock[k]=100000;const r=LivingWorld.execute(S,{type:'build',def:${JSON.stringify(def.id)},zone:0,x:6,y:6});if(!r.ok)throw Error(r.message);switchTab('home');return S.world.placements[0].id;})()`);
   await click('[data-lw="center"]');
   const selector=`[data-home-object="${id}"]`;
   await click(selector);await click('[data-lw="upgrade-view"]');
   const variants=[];
   for(let form=1;form<=3;form++){
    if(form>1){
     check(`${def.id}: distinct current and next previews at form ${form-1}`,await ev(`new Set([...document.querySelectorAll('.home-object-preview image,.home-next-form image')].map(i=>i.href.baseVal)).size===2`));
     await click('[data-command*="upgrade"]');
     const state=await ev(`(()=>{const p=S.world.placements[0],e=document.querySelector(${JSON.stringify(selector)}+' .home-footprint');return {form:p.form,level:p.level,width:+e.getAttribute('width'),height:+e.getAttribute('height')};})()`);
     check(`${def.id}: upgrade ${form} changes form and footprint`,state.form===form&&state.level===form&&state.width===def.forms[form-1][0]*48&&state.height===def.forms[form-1][1]*48,state);
     // 前 24 座的 2、3 级在 c/d/e 图集里成对排列；6 座资源建筑的 1–3 级在 f/g 图集里按行排列。
     const k=i-24,sheet=i<24?['facilities-c','facilities-d','facilities-e'][Math.floor(i/8)]:k<3?'facilities-f':'facilities-g',index=i<24?(i%8)*2+form-2:(k%3)*3+form-1;
     check(`${def.id}: form ${form} renders the packaged sprite`,await imageHash(selector+' image')===hash(`src/assets/storybook/${sheet}-${index}.webp`));
     if(def.id==='house'&&form===2)check('successful upgrade starts the growth animation',await ev(`getComputedStyle(document.querySelector(${JSON.stringify(selector)}+' > g')).animationName==='home-grow'`));
    }
    variants.push(await ev(`document.querySelector(${JSON.stringify(selector)}).innerHTML`));
    if(['house','kitchen'].includes(def.id)){await sleep(950);await b.shot(`${out}/${def.id}-${form}-desktop.png`);}
   }
   check(`${def.id}: fully upgraded save validates`,await ev(`LivingWorld.validWorld(JSON.parse(JSON.stringify(S.world)),S.slimes.map(s=>s.id))`));
   gallery.push({...def,variants});
  }
  // These sheets display the real rendered SVG fragments at one shared map scale.
  await resize(1280,1810);
  for(let sheet=0;sheet<3;sheet++){
   const rows=gallery.slice(sheet*8,sheet*8+8).map(d=>`<article><h2>${d.name}</h2>${d.variants.map((svg,i)=>`<figure><svg viewBox="-16 -96 192 280">${svg}</svg><figcaption>${i+1} 级 · ${d.forms[i].join('×')} 格</figcaption></figure>`).join('')}</article>`).join('');
   await ev(`(()=>{document.querySelector('#form-review')?.remove();const e=document.createElement('section');e.id='form-review';e.innerHTML=${JSON.stringify(`<style>#form-review{position:fixed;inset:0;z-index:99999;background:#f4efdf;color:#31452e;padding:24px 60px;font:16px sans-serif;overflow:hidden}#form-review h1{font-size:26px;margin:0 0 14px}#form-review article{display:grid;grid-template-columns:150px repeat(3,1fr);height:210px;align-items:center;border-top:1px solid #d7d2bd}#form-review h2{font-size:20px}#form-review figure{margin:0;text-align:center}#form-review svg{height:180px;width:100%}#form-review figcaption{font-size:13px;color:#68745c}#form-review .home-footprint{opacity:.5;fill:#d9e1bf;stroke:#8ca277}#form-review .home-label{display:none}</style><h1>家园建筑 · 1 → 2 → 3 级</h1>${rows}`)};document.body.append(e);})()`);
   await sleep(200);await b.shot(`${out}/forms-${sheet+1}.png`);
  }
  await ev(`document.querySelector('#form-review').remove()`);await resize(1440,900);
  // Keep a small usable home for storage, rotation, night and phone checks.
  await ev(`switchTab('space');S.world=LivingWorld.createWorld(487);S.world.estate.plots=Array.from({length:24},(_,i)=>i);S.world.estate.tech=LivingWorld.TECHS.map(t=>t.id);S.world.placements=[];S.world.crops=[];LivingWorld.ensure(S);S.world.stock.wood=100000;S.world.stock.stone=100000;for(const [def,x,y] of [['house',6,6],['kitchen',10,6],['archive',14,6]]){let r=LivingWorld.execute(S,{type:'build',def,zone:0,x,y});if(!r.ok)throw Error(r.message);const id=S.world.placements.at(-1).id;for(let n=0;n<2;n++){r=LivingWorld.execute(S,{type:'upgrade',id});if(!r.ok)throw Error(r.message);}}switchTab('home');`);
  await click('[data-lw="center"]');
  const house=await ev(`S.world.placements.find(p=>p.def==='house').id`),kitchen=await ev(`S.world.placements.find(p=>p.def==='kitchen').id`);
  const houseSelector=`[data-home-object="${house}"]`,houseHash=await imageHash(houseSelector+' image');
  await click(houseSelector);await click('[data-lw="manage-open"]');await click('[data-command*="store"]');await click('[data-lw="close"]');await click('[data-panel="build"]');await click('[data-category="stored"]');
  check('stored upgraded house keeps its form in the catalog',await imageHash(`[data-lw="move"][data-id="${house}"] image`)===houseHash);
  await click(`[data-lw="move"][data-id="${house}"]`);
  await tap(await ev(`(()=>{const p=new DOMPoint(6.5*48,5.5*48).matrixTransform(document.querySelector('.home-map').getScreenCTM());return {x:p.x,y:p.y};})()`));
  check('restoring the house preserves the level-three image and form',await ev(`S.world.placements.find(p=>p.id===${house}).form===3&&!S.world.placements.find(p=>p.id===${house}).stored`)&&await imageHash(houseSelector+' image')===houseHash);
  await ev(`LivingWorld.dispatch({type:'move',id:${kitchen},zone:0,x:10,y:5,rotation:1})`);
  check('rotating an upgraded kitchen preserves image proportions',await ev(`(()=>{const e=document.querySelector('[data-home-object="${kitchen}"] image'),m=e.getScreenCTM();return Math.abs(Math.hypot(m.a,m.b)-Math.hypot(m.c,m.d))<.001;})()`));
  await b.shot(`${out}/home-day.png`);
  await ev(`S.world.clock=2500;renderTab()`);
  check('night keeps the upgraded image and adds its window lights',await imageHash(houseSelector+' image')===houseHash&&await ev(`document.querySelectorAll('${houseSelector} .home-lamplight').length===3`));
  await b.shot(`${out}/home-night.png`);
  for(const [width,height] of [[320,568],[390,844],[844,390],[1920,1080]]){
   await resize(width,height);await click('[data-lw="center"]');await click(houseSelector);await click('[data-lw="use"]');
   check(`${width}x${height}: upgraded preview decodes without horizontal overflow`,await imageHash('.home-object-preview image')===houseHash&&await ev(`document.documentElement.scrollWidth===innerWidth&&document.querySelector('.home-panel').scrollWidth<=document.querySelector('.home-panel').clientWidth+1`));
   await b.shot(`${out}/house-${width}x${height}.png`);await click('[data-lw="close"]');
  }
  await resize(1440,900);
  await ev(`S.world.clock=1200;S.world.reducedMotion=true;const p=S.world.placements.find(p=>p.id===${house});p.level=2;p.form=2;renderTab()`);await click('[data-lw="center"]');await click(houseSelector);await click('[data-lw="upgrade-view"]');await click('[data-command*="upgrade"]');
  check('reduced motion suppresses growth animation while upgrading',await ev(`S.world.placements.find(p=>p.id===${house}).form===3&&getComputedStyle(document.querySelector('${houseSelector} > g')).animationName==='none'`));
  await ev(`S.lastActive=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(S))`);
  const saved=await ev(`JSON.stringify(S.world.placements)`);
  await client.send('Network.enable');await client.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await client.send('Page.navigate',{url:fileUrl('史莱姆.html')});
  assert.ok(await waitFor(()=>ev(`typeof S!=='undefined'&&S.started&&S.saveVersion===5`),10000));await ev(`switchTab('home')`);await click('[data-lw="center"]');
  check('offline reload retains upgraded placements and locally decodes their artwork',await ev(`JSON.stringify(S.world.placements)`)===saved&&await imageHash(houseSelector+' image')===houseHash);
  check('no browser exceptions or console errors',errors.length===0,errors);
  report(out,'results.json',{checks,errors,renderer:await ev(`navigator.userAgent`)});
 }catch(e){await b.shot(`${out}/failure.png`).catch(()=>{});report(out,'results.json',{checks,errors,failure:String(e)});throw e;}
 finally{await b.close();}
 console.log(`RESULT ${checks.length}/${checks.length} building form browser checks`);
})().catch(e=>{console.error(e);process.exitCode=1;});
