// Exercise the same shared controls across themes, viewports and safe-area settings.
'use strict';
const assert=require('node:assert/strict');
const {start}=require('./lib/browser/session.cjs');
const profiles=require('./lib/browser/profiles.cjs');
const {waitFor,report}=require('../tools/out/lib/cdp.js');
const out='tools/out/magic-ui/themes',checks=[];
// 283 项基线要求 PASS 行与 results.json 的 {name,ok,detail} 结构保持不变，底座没有等价 check。
const check=(name,ok,detail)=>{checks.push({name,ok,detail});assert.ok(ok,name+': '+JSON.stringify(detail));console.log('PASS '+name);};
// 原脚本的五个视口；档案尺寸就是检查名与截图名里的 width×height，顺序也保持原样。
const viewports=['se','iphone-14','land-844','desktop-s','desktop-m'],notches=[0,.7,1.5];
const sizes=viewports.map(name=>{const d=profiles.resolve(name);return [d.width,d.height];});
// R6：迁移保留原脚本 dpr=1、mobile=width<760 的口径；安全区仍由原 S.notchHeight 机制模拟。
const zeroSafeArea={top:0,right:0,bottom:0,left:0};
(async()=>{
 const session=await start({profile:'iphone-14',url:'史莱姆.html?battle=ui',gpu:true,outDir:out});
 const {ev,client}=session,errors=session.consoleErrors;
 const bars=()=>ev(`['.topbar','.tabbar'].map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect(),c=getComputedStyle(e);return {rect:[r.x,r.y,r.width,r.height].map(n=>Math.round(n*100)/100),background:c.backgroundColor,radius:c.borderRadius,font:c.font,icons:[...e.querySelectorAll('.ui-icon path')].map(p=>p.getAttribute('d'))};})`);
 try{
  // 原脚本在导航前注入 interval / observer 探针，这里在同一文档生命周期内重载一次。
  await client.send('Page.addScriptToEvaluateOnNewDocument',{source:`
   window.__intervals=[];const interval=window.setInterval;window.setInterval=(...args)=>{const id=interval(...args);__intervals.push(id);return id;};
   window.__observers=new Set();const Observer=window.ResizeObserver;
   window.ResizeObserver=class extends Observer{constructor(fn){super(fn);__observers.add(this);}disconnect(){__observers.delete(this);super.disconnect();}};
  `});
  await session.metrics('iphone-14',{dpr:1,mobile:true,safeArea:zeroSafeArea});
  await session.visit('史莱姆.html?battle=ui');assert.ok(await waitFor(()=>ev("typeof S!=='undefined'&&S.started"),10000));
  await ev(`__intervals.forEach(clearInterval);document.querySelector('#selftestOut')?.remove();S.slimes=[createSlime(false),createSlime(false),createSlime(false)];S.slimes.forEach((s,i)=>{s.name=['露露','芽芽','桃桃'][i];s.stamina=100;});S.world.estate.plots=Array.from({length:24},(_,i)=>i);S.world.estate.tech=LivingWorld.TECHS.map(t=>t.id);for(const k of ['wood','stone','dew','petal','herb','ingredient','fruit'])S.world.stock[k]=800;
   for(const [def,x,y]of [['kitchen',12,13],['pond',22,11],['woodshop',21,8],['decor-3-0',12,10],['decor-2-1',16,10],['decor-1-0',13,8]]){const r=LivingWorld.execute(S,{type:'build',def,zone:0,x,y});if(!r.ok)throw Error(r.message);}S.world.clock=1200;`);
  const themes=await ev('THEMES.map(t=>t.id)');
  for(const name of viewports){
   const device=profiles.resolve(name);
   const {width,height}=await session.metrics(name,{dpr:1,mobile:device.width<760,safeArea:zeroSafeArea});
   for(const notch of notches)for(const theme of themes){
    const label=`${width}x${height}/${notch}cm/${theme}`;
    await ev(`S.theme=${JSON.stringify(theme)};S.notchHeight=${notch};applyTheme();applyNotch();renderTop();switchTab('space');__intervals.forEach(clearInterval)`);await session.frame();
    const expected=await bars();check(label+' releases map observers on exit',await ev('__observers.size===0'));
    if(width===390&&notch===.7)await session.shot(`companion-${theme}.png`);
    await session.tap('[data-act="tab"][data-tab="home"]');await session.frame();assert.deepEqual(await bars(),expected,label+' shared bar geometry, color and icons');
    const layout=await ev(`(()=>{
     const top=document.querySelector('.topbar').getBoundingClientRect().bottom,bottom=document.querySelector('.tabbar').getBoundingClientRect().top;
     const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
     const controls=['.home-season','.home-stock','.home-tools','.home-camera'].map(s=>({name:s,...rect(document.querySelector(s))}));
     const inside=controls.every(r=>r.x>=0&&r.right<=innerWidth+.5&&r.y>=top-.5&&r.bottom<=bottom+.5);
     const overlap=controls.some((a,i)=>controls.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5));
     return {inside,overlap,controls,top,bottom,observers:__observers.size,overflow:document.documentElement.scrollWidth>innerWidth};
    })()`);
    check(label+' shares bars and keeps map controls clear',layout.inside&&!layout.overlap&&!layout.overflow&&layout.observers===1,layout);
    if(notch===.7&&(width===390||theme==='sunset'))await session.shot(`home-${width}x${height}-${theme}.png`);
    await session.tap('[data-lw="panel"][data-panel="build"]');await session.frame();
    const panel=await ev(`(()=>{const e=document.querySelector('.home-panel'),r=e.getBoundingClientRect(),c=getComputedStyle(e),body=e.querySelector('.home-panel-body');return {inside:r.top>=document.querySelector('.topbar').getBoundingClientRect().bottom&&r.bottom<=document.querySelector('.tabbar').getBoundingClientRect().top&&r.left>=0&&r.right<=innerWidth,body:body.clientHeight,overflow:body.scrollWidth>body.clientWidth,background:c.backgroundColor,texture:c.backgroundImage,blur:c.backdropFilter,solid:getComputedStyle(document.querySelector('#app')).getPropertyValue('--surface-solid').trim()};})()`);
    const expectedColor=await ev(`(()=>{const e=document.createElement('span');e.style.backgroundColor='color-mix(in srgb,'+${JSON.stringify(panel.solid)}+' 78%,transparent)';document.body.append(e);const color=getComputedStyle(e).backgroundColor;e.remove();return color;})()`);
    check(label+' keeps the themed catalog readable and scrollable',panel.inside&&!panel.overflow&&panel.body>=70&&panel.background===expectedColor&&panel.texture==='none'&&panel.blur.includes('blur(22px)'),panel);
    if(notch===.7&&(width===390||theme==='sunset'))await session.shot(`catalog-${width}x${height}-${theme}.png`);
    await session.tap('[data-lw="close"]');
     const tokens=await ev(`(()=>{const app=getComputedStyle(document.querySelector('#app'));const keys=['lw-rock','lw-spore','lw-crystal','lw-vein','lw-ink','lw-text','lw-muted','lw-border'];const values=keys.map(k=>app.getPropertyValue('--'+k).trim());return {values,complete:values.every(v=>v.length>0),unique:new Set(values).size>=6};})()`);
     check(label+' shares one token set across home and the six pages',tokens.complete&&tokens.unique,tokens);
     // 夜间可读性取当前主题的 token 值。
     if(theme==='sunset'||theme==='dark'||theme==='peach'||theme==='lavender'){
      await ev(`S.world.clock=2800;renderTab()`);
      const legible=await ev(`(()=>{const lum=h=>{const v=h.replace('#','');const [r,g,b]=[0,2,4].map(i=>parseInt(v.slice(i,i+2),16)/255).map(c=>c<=.03928?c/12.92:((c+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};const css=getComputedStyle(document.querySelector('#app'));const ink=css.getPropertyValue('--lw-ink').trim(),rock=css.getPropertyValue('--lw-rock').trim(),light=css.getPropertyValue('--lw-rock-light').trim();return {ink,rock,light,inkVsRock:Math.abs(lum(ink)-lum(rock)),rockVsLight:Math.abs(lum(rock)-lum(light))};})()`);
      check(label+' keeps the road and building edges distinguishable at night',legible.inkVsRock>.04&&legible.rockVsLight>.05,legible);
      await ev(`S.world.clock=1200;renderTab()`);
     }
     // 浅色主题正文与底色对比度至少 4.5:1。
     if(theme==='light'||theme==='mint'){
      const ratio=await ev(`(()=>{const parse=c=>c.match(/[\\d.]+/g).slice(0,3).map(Number);const lum=rgb=>{const [r,g,b]=rgb.map(v=>v/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};const s=getComputedStyle(document.querySelector('.home-tools'));const l1=lum(parse(s.backgroundColor)),l2=lum(parse(s.color));const [hi,lo]=[Math.max(l1,l2),Math.min(l1,l2)];return (hi+.05)/(lo+.05);})()`);
      check(label+' keeps body text readable in a light theme',ratio>=4.5,{ratio});
     }
   }
  }
  await session.metrics('iphone-14',{dpr:1,mobile:true,safeArea:zeroSafeArea});await ev('S.notchHeight=.7;applyNotch();switchTab("home")');
  for(const theme of themes){
   await session.tap('[data-act="settings"]');await session.tap(`[data-act="theme"][data-theme="${theme}"]`);await session.frame();
   check(theme+' applies from settings to both modal and home',await ev(`S.theme===${JSON.stringify(theme)}&&getComputedStyle(document.querySelector('#modalBox')).backgroundColor===getComputedStyle(document.querySelector('.home-tools')).backgroundColor`));
   await session.shot(`settings-${theme}.png`);await session.tap('#modalBox [data-act="close"]');
  }
  await ev('S.theme="sunset";applyTheme();S.world.clock=2800;renderTab()');await session.frame();
  check('night changes scenery while preserving the selected UI theme',await ev(`document.querySelector('.home-map').classList.contains('night')&&getComputedStyle(document.querySelector('.home-tools')).backgroundColor==='rgb(19, 30, 38)'`));await session.shot('home-night.png');
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
   check(kind+' inherits the selected theme from home',await ev(`document.querySelector('#gameOverlay')?.closest('#app').dataset.theme==='sunset'`));await session.tap('#gClose');
  }
  await ev(`S.theme='mint';applyTheme();S.lastActive=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(S))`);
  await session.visit('史莱姆.html');assert.ok(await waitFor(()=>ev("typeof S!=='undefined'&&S.started"),10000));await ev('switchTab("home")');await session.frame();
  check('theme selection survives a normal reload without migration',await ev(`S.theme==='mint'&&S.saveVersion===5&&getComputedStyle(document.querySelector('.home-tools')).backgroundColor==='rgb(232, 242, 236)'`));
  check('no browser exceptions or console errors',errors.length===0,errors);
  report(out,'results.json',{checks,errors,sizes,notches,themes});
 }catch(e){await session.shot('failure.png').catch(()=>{});report(out,'results.json',{checks,errors,failure:String(e)});throw e;}
 finally{await session.close();}
 console.log(`RESULT ${checks.length}/${checks.length} theme browser checks`);
})().catch(e=>{console.error(e);process.exitCode=1;});
