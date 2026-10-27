// Browser acceptance for composition, themes, and the summon lifecycle.
// Run from the project root: node tests/art-direction.cjs
'use strict';
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {launch, sleep, waitFor, report, makeChecker} = require('../tools/out/lib/cdp.js');
const ROOT = path.resolve(__dirname, '..');
const URL = pathToFileURL(path.join(ROOT, '史莱姆.html')).href;
const OUT = path.join(ROOT, 'tools/out');
const checks = [], shots = [], errors = [];
const check = makeChecker(checks);
const setup = `(() => {
  S.globalPlan=null;S.customPlans={};
  const T=window.__TEST__;
  T.startBattle({elements:['岩','水','草'],level:20,monsterLevel:14,speed:1,seed:7});
  T._battle.closeBattle();
  S.slimes.forEach((s,i)=>{s.name=['小石头','涌泉','青藤'][i];s.intimacy=34;s.mood=90;});
  S.name='星野';S.level=30;S.coins=28640;S.points=1260;
  S.bag={food:12,treasure:3,ticket:5,expPotion:2,net:4};
  S.theme='sunset';applyTheme();renderTop();switchTab('space');
  return true;
})()`;
const overflow = `(() => {
  const app=document.querySelector('#app').getBoundingClientRect();
  return [...document.querySelectorAll('#content button,.companion-head h2,.home-objective,.boost-grid,#modalBox button')]
    .filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&(r.left<app.left-1||r.right>app.right+1);})
    .map(el=>({text:el.textContent.trim().slice(0,30),class:el.className}));
})()`;
const buttonContrast = `(() => {
  const ctx=document.createElement('canvas').getContext('2d');
  const color=value=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
  const blend=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*fg[3]/255+bg[i]*(1-fg[3]/255));
  const lum=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  return ['.home-objective .btn','.home-care .btn'].map(selector=>{
    const el=document.querySelector(selector),chain=[];
    for(let n=el;n&&n.id!=='app';n=n.parentElement)chain.unshift(n);
    let bg=color(getComputedStyle(document.querySelector('#app')).getPropertyValue('--bgMid'));
    for(const n of chain)bg=blend(color(getComputedStyle(n).backgroundColor),bg);
    const a=lum(blend(color(getComputedStyle(el).color),bg)),b=lum(bg);
    return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  });
})()`;

(async()=>{
  const p=await launch({url:URL+'?battle=ui',width:390,height:844,dpr:2,touchEnabled:true});
  p.client.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails?.exception?.description||e.exceptionDetails?.text));
  const shot=async name=>{const f=await p.shot(path.join(OUT,'shots','art-'+name+'.png'));shots.push(path.relative(ROOT,f));};
  const viewport=async(width,height)=>p.client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true,screenWidth:width,screenHeight:height});
  try{
    if(!await waitFor(()=>p.ev('!!window.__TEST__'),15000))throw new Error('Diagnostic hooks unavailable');
    await p.ev(setup);await sleep(150);
    for(const [width,height] of [[390,844],[320,667],[480,900]]){
      await viewport(width,height);await p.ev('switchTab("space");true');await sleep(80);
      const layout=await p.ev(`(() => {const pg=document.querySelector('#playground').getBoundingClientRect(),nav=document.querySelector('.tabbar').getBoundingClientRect();return {top:pg.top,bottom:pg.bottom,nav:nav.top,overflow:document.documentElement.scrollWidth-innerWidth};})()`);
      check('Garden fully visible at '+width+'x'+height,layout.top<230&&layout.bottom<layout.nav&&layout.overflow===0,layout);
      check('Controls fit at width '+width,(await p.ev(overflow)).length===0);
      await shot('home-'+width);
    }
    await viewport(390,844);
    await p.ev(`S.name='名字很长也想一起探索世界的召唤师';switchTab('space');true`);
    const longName=await p.ev(`(() => {const h=document.querySelector('.companion-head h2'),p=document.querySelector('#playground').getBoundingClientRect();return {lines:h.clientHeight/parseFloat(getComputedStyle(h).lineHeight),top:p.top};})()`);
    check('Long name retains a two-line heading and visible garden',longName.lines<=2.1&&longName.top<230,longName);
    await shot('home-long-name');
    await p.ev(`S.name='星野';true`);
    for(const theme of ['sunset','dark','light','peach','mint','lavender','sky']){
      await p.ev(`S.theme=${JSON.stringify(theme)};applyTheme();switchTab('space');true`);
      await sleep(180);
      const fit=await p.ev(overflow);
      check('Theme fits: '+theme,fit.length===0,fit);
      const contrasts=await p.ev(buttonContrast);
      check('Home button text contrast: '+theme,contrasts.every(x=>x.ratio>=4.5),contrasts);
      if(theme==='light')await shot('home-light');
    }
    await p.ev(`S.theme='sunset';applyTheme();S.globalPlan='explore';switchTab('travel');true`);
    for(let i=0;i<3;i++){
      await p.ev(`S.exploreMapIndex=${i};renderTab();true`);await sleep(120);
      const refs=await p.ev(`(() => {const ids=[...document.querySelectorAll('.explore-scene [id]')].map(e=>e.id);return {unique:new Set(ids).size===ids.length,svg:document.querySelectorAll('.scene-landmarks').length};})()`);
      check('Landscape gradients remain unique: '+i,refs.unique&&refs.svg===2,refs);
      await shot('explore-'+i);
    }
    await p.ev(`S.globalPlan=null;switchTab('summon');true`);
    check('Summon controls fit',(await p.ev(overflow)).length===0);
    await shot('summon');
    await p.ev(`S.battleMode='step';window.__TEST__.startBattle({elements:['岩','火','水','风','草'],level:20,monsterLevel:50,speed:1,seed:7});window.__TEST__._battle.renderSkillBar();true`);
    await waitFor(()=>p.ev('!!document.querySelector("#skillBar .sk-act")'),5000);
    const battle=await p.ev(`(() => {const sprite=document.querySelector('.battle-unit .slime'),labels=[...document.querySelectorAll('.uname,.intent-label,.status-chip')];return {width:sprite.getBoundingClientRect().width,minText:Math.min(...labels.map(e=>parseFloat(getComputedStyle(e).fontSize)))};})()`);
    check('Battle preserves compact creatures and readable labels',battle.width>=49&&battle.width<=52&&battle.minText>=11,battle);
    await shot('battle');
    await p.ev(`window.__TEST__._battle.closeBattle();switchTab('bag');true`);await shot('bag');
    await p.ev(`switchTab('space');S.spaceMode='monster';renderTab();true`);await shot('empty-monster');
    check('Decorative scenery does not intercept touch',await p.ev(`getComputedStyle(document.querySelector('.garden-art')).pointerEvents==='none'`));

    // Normal mode in this temporary browser profile verifies persistence too.
    await p.client.send('Page.navigate',{url:URL});
    if(!await waitFor(()=>p.ev('location.search===""&&document.readyState==="complete"&&typeof doSummon==="function"'),15000))throw new Error('Normal game did not load');
    await p.ev(`finishStory();S.level=30;S.coins=20000;S.slimes=[];switchTab('summon');true`);
    const duplicate=await p.ev(`(() => {doSummon();doSummon();return {count:S.slimes.length,saved:JSON.parse(localStorage.getItem('slimeSummonerSave')).slimes.length,animating:document.querySelector('.summon-result').classList.contains('summoning')};})()`);
    check('Repeated summon creates and saves exactly one companion',duplicate.count===1&&duplicate.saved===1&&duplicate.animating,duplicate);
    const noticeClear=await p.ev(`(() => {const t=document.querySelector('.toast'),b=document.querySelector('.summon-result>.btn');if(!t)return true;const a=t.getBoundingClientRect(),r=b.getBoundingClientRect();return a.bottom<=r.top||a.top>=r.bottom;})()`);
    check('Reward notification leaves the confirmation button visible',noticeClear);
    await sleep(650);await shot('birth');
    await sleep(650);
    check('Birth completes without another click',await p.ev(`document.querySelector('.summon-result').getAttribute('aria-busy')==='false'&&!document.querySelector('.summon-result').classList.contains('summoning')`));
    await shot('result');
    await p.ev(`closeModal();doSummon();document.querySelector('[data-act="summonSkip"]').click();true`);
    check('Skip reveals the same saved companion',await p.ev(`!document.querySelector('.summon-result').classList.contains('summoning')&&S.slimes.length===2&&JSON.parse(localStorage.getItem('slimeSummonerSave')).slimes.length===2`));
    await p.ev(`closeModal();doSummon();closeModal();openSettings();true`);
    await sleep(1300);
    check('Closing early cancels presentation without losing the reward',await p.ev(`S.slimes.length===3&&JSON.parse(localStorage.getItem('slimeSummonerSave')).slimes.length===3&&!document.querySelector('.summon-result')&&!!document.querySelector('.settings-themes')`));
    await p.client.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await p.ev(`closeModal();doSummon();true`);
    check('Reduced motion reveals immediately',await p.ev(`!document.querySelector('.summoning')&&document.querySelector('.summon-result').getAttribute('aria-busy')==='false'&&summonRevealTimer===null`));
    await p.ev(`closeModal();doSummon();closeModal();const n=S.slimes.length;doSummon();window.__fullCount=n;true`);
    check('Full capacity rejects another summon',await p.ev(`S.slimes.length===window.__fullCount&&!document.querySelector('.summon-result')`));
    await p.ev(`S.slimes=[];const original=pickElement;try{pickElement=()=> '时间';doSummon();}finally{pickElement=original;}true`);
    check('Rare companion has a distinct reveal and retains attributes',await p.ev(`document.querySelector('.summon-result').dataset.rarity==='rare'&&S.slimes[0].element==='时间'&&document.querySelector('.summon-stats').textContent.includes(String(S.slimes[0].str))`));
    await shot('rare-result');
    for(const [width,height] of [[320,667],[390,844],[480,900]]){
      await viewport(width,height);
      check('Result fits at width '+width,(await p.ev(overflow)).length===0);
    }
    check('No uncaught browser errors',errors.length===0,errors);
  }catch(error){check('Browser acceptance completed',false,error.stack||String(error));}
  finally{await p.close();}
  report(OUT,'art-report.json',{checks,shots,errors});
  const passed=checks.filter(x=>x.status==='PASS').length;
  console.log(`RESULT ${passed}/${checks.length} passed`);
  process.exitCode=passed===checks.length?0:1;
})();
