'use strict';
const assert=require('node:assert/strict');
const {start}=require('./lib/browser/session.cjs');
const profiles=require('./lib/browser/profiles.cjs');
const {sleep,waitFor,report}=require('../tools/out/lib/cdp.js');
const out='tools/out/magic-ui/original-pages',checks=[];
// 62 项基线要求 PASS 行与 results.json 的 {name,ok,detail} 结构保持不变，底座没有等价 check。
const check=(name,ok,detail)=>{checks.push({name,ok,detail});assert.ok(ok,name+': '+JSON.stringify(detail));console.log('PASS '+name);};
// 原脚本的五个视口，档案尺寸就是检查名与截图名里的 width×height，顺序也保持原样。
const viewports=['se','iphone-14','land-844','desktop-s','desktop-m'];
// R6：保留原脚本 dpr=1、mobile=width<760 的口径；原脚本未动安全区，这里显式传零。
const zeroSafeArea={top:0,right:0,bottom:0,left:0};
const tabs=['space','summon','travel','bag','status'];
(async()=>{
 const session=await start({profile:'iphone-14',url:'史莱姆-参考.html?battle=ui',gpu:true,outDir:out});
 const {ev,client}=session,errors=session.consoleErrors;
 client.on('Page.javascriptDialogOpening',()=>client.send('Page.handleJavaScriptDialog',{accept:true}));
 await client.send('Page.addScriptToEvaluateOnNewDocument',{source:`
  window.__intervals=[];window.__resizeSignals=[];
  const interval=window.setInterval;window.setInterval=(...args)=>{const id=interval(...args);__intervals.push(id);return id;};
  const add=EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener=function(type,listener,options){if(this===window&&type==='resize'&&options?.signal)__resizeSignals.push(options.signal);return add.call(this,type,listener,options);};
 `});
 const measure=()=>ev(`(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(n=>Math.round(n*100)/100);},app=getComputedStyle(document.querySelector('#app'));return {app:rect('#app'),content:rect('#content'),top:rect('.topbar'),nav:rect('.tabbar'),colors:['--bgTop','--bgMid','--bgBot','--accent','--text','--panel','--tabbar'].map(k=>app.getPropertyValue(k)),overflow:document.documentElement.scrollWidth>innerWidth,icons:document.querySelectorAll('.tabbar .home-art-icon').length};})()`);
 const baseline=new Map();
 try{
  for(const [label,file]of [['reference','史莱姆-参考.html'],['shipped','史莱姆.html']]){
   await session.visit(file+'?battle=ui');
   assert.ok(await waitFor(()=>ev("typeof S!=='undefined'&&typeof switchTab==='function'"),10000));
   await ev(`
    __intervals.forEach(clearInterval);document.querySelector('#selftestOut')?.remove();
    Math.random=()=>.42;S.seq=1;S.nameSeq=0;S.slimes=[];S.monsters=[];S.started=true;S.name='小院主人';S.sysName='团子';S.coins=8000;S.points=40;S.level=20;S.battleMode='manual';S.theme='sunset';S.notchHeight=.7;S.globalPlan=null;
    for(const [i,element]of ['火','水','草'].entries()){const s=createSlime(false);s.element=element;s.name=['露露','芽芽','桃桃'][i];s.stamina=100;s.mood=80;S.slimes.push(s);}
    document.querySelector('#storyScreen').classList.add('hidden');document.querySelector('#gameScreen').classList.remove('hidden');applyTheme();applyNotch();renderTop();switchTab('space');
   `);
   for(const name of viewports){
    const {width,height}=await session.metrics(name,{dpr:1,mobile:profiles.resolve(name).width<760,safeArea:zeroSafeArea});
    for(const tab of tabs){
     if(label==='shipped')await session.tap('[data-act="tab"][data-tab="home"]');
     await session.tap(`[data-act="tab"][data-tab="${tab}"]`);await sleep(90);
     await ev('__intervals.forEach(clearInterval)');
     const layout=await measure(),key=`${width}x${height}-${tab}`;
     if(label==='reference')baseline.set(key,layout);
     else{
      assert.deepEqual(layout,baseline.get(key),key+' must retain the reference layout and theme');
      check(key+' restores reference layout, colors and navigation icons',!layout.overflow);
      check(key+' releases home listeners',await ev('__resizeSignals.every(s=>s.aborted)'));
     }
     await session.shot(`${label}-${key}.png`);
    }
   }
  }
  await session.metrics('iphone-14',{dpr:1,mobile:true,safeArea:zeroSafeArea});
  await session.tap('[data-act="tab"][data-tab="summon"]');const count=await ev('S.slimes.length');
  await session.tap('[data-act="summon"]');check('reference summon control creates one partner',await ev('S.slimes.length')===count+1);
  await session.shot('summon-result.png');await session.tap('#modalBox [data-act="close"]');
  await session.tap('[data-act="tab"][data-tab="travel"]');await session.tap('[data-act="globalplan"][data-type="explore"]');
  const coins=await ev('S.coins');await ev('advanceWorld(12)');
  check('exploration stores rewards until the visible claim button is used',await ev('S.explorePending.coins>0&&S.coins')===coins);
  await session.tap('[data-act="claimExplore"]');check('claim transfers exploration coins',await ev('S.coins')>coins&&await ev('S.explorePending.coins===0'));
  await session.tap('[data-act="globalplan"][data-type="clear"]');await session.tap('[data-act="abyssSetup"]');
  if(!await ev('abyssSetupSel.length'))await session.tap('[data-act="abyssSel"]');
  await session.tap('[data-act="abyssStart"]');
  check('original battle opens with manual controls and reserves partners',await ev("!!document.querySelector('#gameOverlay')&&S.battleMode==='manual'&&Object.values(S.world.activities).some(a=>a.kind==='battle')"));
  await session.tap('#skCtrl .sk-mode');check('battle mode toggles to automatic',await ev("S.battleMode==='auto'"));
  await session.tap('#skCtrl .sk-mode');check('battle mode returns to manual',await ev("S.battleMode==='manual'"));
  await session.shot('battle-manual.png');
  await session.tap('#bClose');check('retreat shows the reference battle result',await ev("!!document.querySelector('#gameOverlay')&&document.querySelector('#bClose').textContent.includes('闭')"));
  await session.tap('#bClose');check('closing battle releases partners',await ev("!document.querySelector('#gameOverlay')&&!Object.values(S.world.activities).some(a=>a.kind==='battle')"));
  await session.tap('[data-act="tab"][data-tab="home"]');
  check('returning home creates exactly one active map listener',await ev('__resizeSignals.filter(s=>!s.aborted).length===1'));
  await session.tap('[data-act="tab"][data-tab="space"]');await session.tap('[data-act="settings"]');
  const notch=await ev('S.notchHeight');
  await session.tap('#modalBox [data-act="notchPlus"]');
  check('reference settings increase the notch height',await ev('S.notchHeight')===Math.round((notch+.1)*10)/10);
  await session.tap('#modalBox [data-act="notchMinus"]');
  check('reference settings restore the notch height',await ev('S.notchHeight')===notch);
  await session.shot('settings.png');await session.tap('#modalBox [data-act="close"]');
  check('no browser exceptions or console errors during reference comparison or play',errors.length===0,errors);
  report(out,'results.json',{checks,errors,sizes:viewports.map(name=>{const d=profiles.resolve(name);return [d.width,d.height];})});
 }catch(e){await session.shot('failure.png').catch(()=>{});report(out,'results.json',{checks,errors,failure:String(e)});throw e;}
 finally{await session.close();}
 console.log(`RESULT ${checks.length}/${checks.length} reference browser checks`);
})().catch(e=>{console.error(e);process.exitCode=1;});
