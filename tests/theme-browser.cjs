// Exercise the same shared controls across themes, viewports and safe-area settings.
const assert=require('node:assert/strict');
const {launch,fileUrl,waitFor,report}=require('../tools/out/lib/cdp.js');
const out='tools/out/magic-ui/themes',checks=[],errors=[];
const sizes=[[320,568],[390,844],[844,390],[1440,900],[1920,1080]],notches=[0,.7,1.5];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});assert.ok(ok,name+': '+JSON.stringify(detail));console.log('PASS '+name);};
(async()=>{
 const b=await launch({url:'about:blank',width:390,height:844,dpr:1,touchEnabled:true,gpu:true});
 const {ev,client}=b;
 client.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 client.on('Runtime.consoleAPICalled',e=>{if(['error','assert'].includes(e.type))errors.push(e.args.map(a=>a.value??a.description).join(' '));});
 client.on('Log.entryAdded',({entry})=>{if(entry.level==='error')errors.push(entry.text);});await client.send('Log.enable');
 await client.send('Page.addScriptToEvaluateOnNewDocument',{source:`
  window.__intervals=[];const interval=window.setInterval;window.setInterval=(...args)=>{const id=interval(...args);__intervals.push(id);return id;};
  window.__observers=new Set();const Observer=window.ResizeObserver;
  window.ResizeObserver=class extends Observer{constructor(fn){super(fn);__observers.add(this);}disconnect(){__observers.delete(this);super.disconnect();}};
 `});
 const click=async selector=>{
  const p=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
 };
 const frame=()=>ev('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
 const bars=()=>ev(`['.topbar','.tabbar'].map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect(),c=getComputedStyle(e);return {rect:[r.x,r.y,r.width,r.height].map(n=>Math.round(n*100)/100),background:c.backgroundColor,radius:c.borderRadius,font:c.font,icons:[...e.querySelectorAll('.ui-icon path')].map(p=>p.getAttribute('d'))};})`);
 try{
  await client.send('Page.navigate',{url:fileUrl('史莱姆.html','?battle=ui')});assert.ok(await waitFor(()=>ev("typeof S!=='undefined'&&S.started"),10000));
  await ev(`__intervals.forEach(clearInterval);document.querySelector('#selftestOut')?.remove();S.slimes=[createSlime(false),createSlime(false),createSlime(false)];S.slimes.forEach((s,i)=>{s.name=['露露','芽芽','桃桃'][i];s.stamina=100;});for(const k of ['wood','stone','dew','petal','herb','ingredient','fruit'])S.world.stock[k]=800;
   for(const [def,x,y]of [['kitchen',12,13],['pond',22,11],['woodshop',21,8],['decor-3-0',12,10],['decor-2-1',16,10],['decor-1-0',13,8]]){const r=LivingWorld.execute(S,{type:'build',def,zone:0,x,y});if(!r.ok)throw Error(r.message);}S.world.clock=1200;`);
  const themes=await ev('THEMES.map(t=>t.id)');
  for(const [width,height]of sizes){
   await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<760,screenWidth:width,screenHeight:height});
   for(const notch of notches)for(const theme of themes){
    const name=`${width}x${height}/${notch}cm/${theme}`;
    await ev(`S.theme=${JSON.stringify(theme)};S.notchHeight=${notch};applyTheme();applyNotch();renderTop();switchTab('space');__intervals.forEach(clearInterval)`);await frame();
    const expected=await bars();check(name+' releases map observers on exit',await ev('__observers.size===0'));
    if(width===390&&notch===.7)await b.shot(`${out}/companion-${theme}.png`);
    await click('[data-act="tab"][data-tab="home"]');await frame();assert.deepEqual(await bars(),expected,name+' shared bar geometry, color and icons');
    const layout=await ev(`(()=>{
     const top=document.querySelector('.topbar').getBoundingClientRect().bottom,bottom=document.querySelector('.tabbar').getBoundingClientRect().top;
     const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
     const controls=['.home-season','.home-stock','.home-tools','.home-camera'].map(s=>({name:s,...rect(document.querySelector(s))}));
     const inside=controls.every(r=>r.x>=0&&r.right<=innerWidth+.5&&r.y>=top-.5&&r.bottom<=bottom+.5);
     const overlap=controls.some((a,i)=>controls.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5));
     return {inside,overlap,controls,top,bottom,observers:__observers.size,overflow:document.documentElement.scrollWidth>innerWidth};
    })()`);
    check(name+' shares bars and keeps map controls clear',layout.inside&&!layout.overlap&&!layout.overflow&&layout.observers===1,layout);
    if(notch===.7&&(width===390||theme==='sunset'))await b.shot(`${out}/home-${width}x${height}-${theme}.png`);
    await click('[data-lw="panel"][data-panel="build"]');await frame();
    const panel=await ev(`(()=>{const e=document.querySelector('.home-panel'),r=e.getBoundingClientRect(),c=getComputedStyle(e),body=e.querySelector('.home-panel-body');return {inside:r.top>=document.querySelector('.topbar').getBoundingClientRect().bottom&&r.bottom<=document.querySelector('.tabbar').getBoundingClientRect().top&&r.left>=0&&r.right<=innerWidth,body:body.clientHeight,overflow:body.scrollWidth>body.clientWidth,background:c.backgroundColor,texture:c.backgroundImage,solid:getComputedStyle(document.querySelector('#app')).getPropertyValue('--surface-solid').trim()};})()`);
    const expectedColor=await ev(`(()=>{const e=document.createElement('span');e.style.color=${JSON.stringify(panel.solid)};document.body.append(e);const color=getComputedStyle(e).color;e.remove();return color;})()`);
    check(name+' keeps the themed catalog readable and scrollable',panel.inside&&!panel.overflow&&panel.body>=70&&panel.background===expectedColor&&panel.texture==='none',panel);
    if(notch===.7&&(width===390||theme==='sunset'))await b.shot(`${out}/catalog-${width}x${height}-${theme}.png`);
    await click('[data-lw="close"]');
   }
  }
  await client.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await ev('S.notchHeight=.7;applyNotch();switchTab("home")');
  for(const theme of themes){
   await click('[data-act="settings"]');await click(`[data-act="theme"][data-theme="${theme}"]`);await frame();
   check(theme+' applies from settings to both modal and home',await ev(`S.theme===${JSON.stringify(theme)}&&getComputedStyle(document.querySelector('#modalBox')).backgroundColor===getComputedStyle(document.querySelector('.home-tools')).backgroundColor`));
   await b.shot(`${out}/settings-${theme}.png`);await click('#modalBox [data-act="close"]');
  }
  await ev('S.theme="sunset";applyTheme();S.world.clock=2800;renderTab()');await frame();
  check('night changes scenery while preserving the selected UI theme',await ev(`document.querySelector('.home-map').classList.contains('night')&&getComputedStyle(document.querySelector('.home-tools')).backgroundColor==='rgb(22, 17, 41)'`));await b.shot(`${out}/home-night.png`);
  await ev('S.world.reducedMotion=true;renderTab()');
  check('reduced motion removes home transitions and animations',await ev(`getComputedStyle(document.querySelector('.home-tools .home-button')).transitionDuration==='0s'&&getComputedStyle(document.querySelector('.home-tools .home-button')).animationName==='none'`));
  await ev('S.world.reducedMotion=false;renderTab()');await client.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  check('system reduced-motion preference is respected',await ev(`getComputedStyle(document.querySelector('.home-tools .home-button')).transitionDuration==='0s'`));
  await client.send('Emulation.setEmulatedMedia',{features:[]});
  for(const kind of ['ball','stack']){
   await ev('switchTab("home")');
   // The pointer-driven map selection is covered by home-browser; exercise theme inheritance here.
   await ev(kind==='ball'?'startBallGame(S.slimes[0])':'startStackGame()');
   assert.ok(await waitFor(()=>ev(`${kind==='ball'?'ballGame':'stackGame'}?.running===true`),3000));
   check(kind+' inherits the selected theme from home',await ev(`document.querySelector('#gameOverlay')?.closest('#app').dataset.theme==='sunset'`));await click('#gClose');
  }
  await ev(`S.theme='mint';applyTheme();S.lastActive=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(S))`);
  await client.send('Page.navigate',{url:fileUrl('史莱姆.html')});assert.ok(await waitFor(()=>ev("typeof S!=='undefined'&&S.started"),10000));await ev('switchTab("home")');await frame();
  check('theme selection survives a normal reload without migration',await ev(`S.theme==='mint'&&S.saveVersion===5&&getComputedStyle(document.querySelector('.home-tools')).backgroundColor==='rgb(240, 255, 249)'`));
  check('no browser exceptions or console errors',errors.length===0,errors);
  report(out,'results.json',{checks,errors,sizes,notches,themes});
 }catch(e){await b.shot(`${out}/failure.png`).catch(()=>{});report(out,'results.json',{checks,errors,failure:String(e)});throw e;}
 finally{await b.close();}
 console.log(`RESULT ${checks.length}/${checks.length} theme browser checks`);
})().catch(e=>{console.error(e);process.exitCode=1;});
