const assert=require('node:assert/strict');
const {launch,fileUrl,sleep,waitFor,report}=require('../tools/out/lib/cdp.js');
const out='tools/out/magic-ui/original-pages',checks=[],errors=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});assert.ok(ok,name+': '+JSON.stringify(detail));console.log('PASS '+name);};
const sizes=[[320,568],[390,844],[844,390],[1440,900],[1920,1080]];
const tabs=['space','summon','travel','bag','status'];
(async()=>{
 const b=await launch({url:'about:blank',width:390,height:844,dpr:1,touchEnabled:true,gpu:true});
 const {ev,client}=b;
 client.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 client.on('Runtime.consoleAPICalled',e=>{if(['error','assert'].includes(e.type))errors.push(e.args.map(a=>a.value??a.description).join(' '));});
 client.on('Log.entryAdded',({entry})=>{if(entry.level==='error')errors.push(entry.text);});
 await client.send('Log.enable');
 client.on('Page.javascriptDialogOpening',()=>client.send('Page.handleJavaScriptDialog',{accept:true}));
 await client.send('Page.addScriptToEvaluateOnNewDocument',{source:`
  window.__intervals=[];window.__resizeSignals=[];
  const interval=window.setInterval;window.setInterval=(...args)=>{const id=interval(...args);__intervals.push(id);return id;};
  const add=EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener=function(type,listener,options){if(this===window&&type==='resize'&&options?.signal)__resizeSignals.push(options.signal);return add.call(this,type,listener,options);};
 `});
 const click=async selector=>{
  const p=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
  await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
 };
 const measure=()=>ev(`(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(n=>Math.round(n*100)/100);},app=getComputedStyle(document.querySelector('#app'));return {app:rect('#app'),content:rect('#content'),top:rect('.topbar'),nav:rect('.tabbar'),colors:['--bgTop','--bgMid','--bgBot','--accent','--text','--panel','--tabbar'].map(k=>app.getPropertyValue(k)),overflow:document.documentElement.scrollWidth>innerWidth,icons:document.querySelectorAll('.tabbar .home-art-icon').length};})()`);
 const baseline=new Map();
 try{
  for(const [label,file]of [['reference','史莱姆-参考.html'],['shipped','史莱姆.html']]){
   await client.send('Page.navigate',{url:fileUrl(file,'?battle=ui')});
   assert.ok(await waitFor(()=>ev("typeof S!=='undefined'&&typeof switchTab==='function'"),10000));
   await ev(`
    __intervals.forEach(clearInterval);document.querySelector('#selftestOut')?.remove();
    Math.random=()=>.42;S.seq=1;S.nameSeq=0;S.slimes=[];S.monsters=[];S.started=true;S.name='小院主人';S.sysName='团子';S.coins=8000;S.points=40;S.level=20;S.battleMode='manual';S.theme='sunset';S.notchHeight=.7;S.globalPlan=null;
    for(const [i,element]of ['火','水','草'].entries()){const s=createSlime(false);s.element=element;s.name=['露露','芽芽','桃桃'][i];s.stamina=100;s.mood=80;S.slimes.push(s);}
    document.querySelector('#storyScreen').classList.add('hidden');document.querySelector('#gameScreen').classList.remove('hidden');applyTheme();applyNotch();renderTop();switchTab('space');
   `);
   for(const [width,height]of sizes){
    await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<760,screenWidth:width,screenHeight:height});
    for(const tab of tabs){
     if(label==='shipped')await click('[data-act="tab"][data-tab="home"]');
     await click(`[data-act="tab"][data-tab="${tab}"]`);await sleep(90);
     await ev('__intervals.forEach(clearInterval)');
     const layout=await measure(),key=`${width}x${height}-${tab}`;
     if(label==='reference')baseline.set(key,layout);
     else{
      assert.deepEqual(layout,baseline.get(key),key+' must retain the reference layout and theme');
      check(key+' restores reference layout, colors and navigation icons',!layout.overflow);
      check(key+' releases home listeners',await ev('__resizeSignals.every(s=>s.aborted)'));
     }
     await b.shot(`${out}/${label}-${key}.png`);
    }
   }
  }
  await client.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await click('[data-act="tab"][data-tab="summon"]');const count=await ev('S.slimes.length');
  await click('[data-act="summon"]');check('reference summon control creates one partner',await ev('S.slimes.length')===count+1);
  await b.shot(`${out}/summon-result.png`);await click('#modalBox [data-act="close"]');
  await click('[data-act="tab"][data-tab="travel"]');await click('[data-act="globalplan"][data-type="explore"]');
  const coins=await ev('S.coins');await ev('advanceWorld(12)');
  check('exploration stores rewards until the visible claim button is used',await ev('S.explorePending.coins>0&&S.coins')===coins);
  await click('[data-act="claimExplore"]');check('claim transfers exploration coins',await ev('S.coins')>coins&&await ev('S.explorePending.coins===0'));
  await click('[data-act="globalplan"][data-type="clear"]');await click('[data-act="abyssSetup"]');
  if(!await ev('abyssSetupSel.length'))await click('[data-act="abyssSel"]');
  await click('[data-act="abyssStart"]');
  check('original battle opens with manual controls and reserves partners',await ev("!!document.querySelector('#gameOverlay')&&S.battleMode==='manual'&&Object.values(S.world.activities).some(a=>a.kind==='battle')"));
  await click('#skCtrl .sk-mode');check('battle mode toggles to automatic',await ev("S.battleMode==='auto'"));
  await click('#skCtrl .sk-mode');check('battle mode returns to manual',await ev("S.battleMode==='manual'"));
  await b.shot(`${out}/battle-manual.png`);
  await click('#bClose');check('retreat shows the reference battle result',await ev("!!document.querySelector('#gameOverlay')&&document.querySelector('#bClose').textContent.includes('闭')"));
  await click('#bClose');check('closing battle releases partners',await ev("!document.querySelector('#gameOverlay')&&!Object.values(S.world.activities).some(a=>a.kind==='battle')"));
  await click('[data-act="tab"][data-tab="home"]');
  check('returning home creates exactly one active map listener',await ev('__resizeSignals.filter(s=>!s.aborted).length===1'));
  await click('[data-act="tab"][data-tab="space"]');await click('[data-act="settings"]');
  const notch=await ev('S.notchHeight');
  await click('#modalBox [data-act="notchPlus"]');
  check('reference settings increase the notch height',await ev('S.notchHeight')===Math.round((notch+.1)*10)/10);
  await click('#modalBox [data-act="notchMinus"]');
  check('reference settings restore the notch height',await ev('S.notchHeight')===notch);
  await b.shot(`${out}/settings.png`);await click('#modalBox [data-act="close"]');
  check('no browser exceptions or console errors during reference comparison or play',errors.length===0,errors);
  report(out,'results.json',{checks,errors,sizes});
 }catch(e){await b.shot(`${out}/failure.png`).catch(()=>{});report(out,'results.json',{checks,errors,failure:String(e)});throw e;}
 finally{await b.close();}
 console.log(`RESULT ${checks.length}/${checks.length} reference browser checks`);
})().catch(e=>{console.error(e);process.exitCode=1;});
