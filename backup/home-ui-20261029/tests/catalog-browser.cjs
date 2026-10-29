'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {launch,fileUrl,waitFor,sleep,report}=require('../tools/out/lib/cdp.js');
const results=[],errors=[],requests=[];
(async()=>{
 const p=await launch({url:fileUrl(path.resolve('史莱姆.html')),width:390,height:844,dpr:1,touchEnabled:true});
 p.client.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails?.exception?.description||e.exceptionDetails?.text));
 await p.client.send('Network.enable');p.client.on('Network.requestWillBeSent',e=>{if(/^https?:/.test(e.request.url))requests.push(e.request.url);});
 const check=async(name,expression)=>{assert.ok(await p.ev(expression),name);results.push({name,status:'PASS'});console.log('PASS '+name);};
 const tap=async selector=>{const r=await p.ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing '+${JSON.stringify(selector)});for(let n=el.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;el.scrollIntoView({block:'center',inline:'nearest'});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await p.touch.tap(r.x,r.y);await sleep(120);};
 const cell=async(x,y)=>{const r=await p.ev(`(()=>{const el=document.querySelector('.lw-map');el.scrollIntoView({block:'start'});const r=el.getBoundingClientRect();return{x:r.x+(300+(${x}-${y})*23)/600*r.width,y:r.y+(62+(${x}+${y}+1)*15)/540*r.height};})()`);await p.touch.tap(r.x,r.y);await sleep(100);};
 const command=async(type,extra={})=>{const selector=await p.ev(`(()=>{const el=[...document.querySelectorAll('[data-command]')].find(el=>{const c=JSON.parse(el.dataset.command);return c.type===${JSON.stringify(type)}&&Object.entries(${JSON.stringify(extra)}).every(([k,v])=>c[k]===v);});if(!el)throw new Error('Missing command');return '[data-command='+JSON.stringify(el.dataset.command)+']';})()`);await tap(selector);};
 const shot=async name=>{await p.ev('document.querySelectorAll(".toast").forEach(t=>t.remove());true');await p.shot(path.resolve('tools/out/shots/catalog-'+name+'.png'));};
 const viewport=async(width,height=844)=>p.client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
 const contrast=`(()=>{const e=document.querySelector('.lw-build-tabs .is-active'),s=getComputedStyle(e),l=c=>{const a=c.match(/[\\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722;},a=l(s.color),b=l(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);})()`;
 try{
  assert.ok(await waitFor(()=>p.ev('typeof S!=="undefined"&&!!S.name&&!!S.sysName'),10000));
  const identity=await p.ev('JSON.stringify([S.name,S.sysName,S.sysLook])');
  await check('opening assigns and saves identity without input fields','!S.started&&!document.querySelector("#storyScreen input,#storyScreen select")&&JSON.parse(localStorage.getItem(SAVE_KEY)).name===S.name');
  for(const width of [320,390,480]){await viewport(width,width===320?667:844);await check('opening fits two-line heading and visible action at '+width,`(()=>{const h=document.querySelector('.story-arrival h1'),b=document.querySelector('#storyNext').getBoundingClientRect();return h.getBoundingClientRect().height<=parseFloat(getComputedStyle(h).lineHeight)*2+1&&b.top>26&&b.bottom<innerHeight-26&&document.documentElement.scrollWidth<=innerWidth;})()`);}
  await viewport(390);await sleep(700);await shot('arrival');
  await p.client.send('Page.reload');assert.ok(await waitFor(()=>p.ev('typeof S!=="undefined"&&!!S.sysName'),10000));assert.equal(await p.ev('JSON.stringify([S.name,S.sysName,S.sysLook])'),identity);results.push({name:'reload preserves the assigned identity',status:'PASS'});
  for(let n=0;n<3;n++)await tap('#storyNext');await check('three next buttons enter the home and grant the starter gift once','S.started&&S.points===200&&JSON.parse(localStorage.getItem(SAVE_KEY)).starterGiftClaimed');
  await p.ev('finishStory();doSummon();finishSummonReveal();closeModal();doSummon();finishSummonReveal();closeModal();switchTab("home");true');
  await check('home uses portrait buttons and has no construction or partner dropdown','document.querySelectorAll(".lw-companion-chip").length===2&&!document.querySelector("#lw-build,#lw-person")');
  const second=await p.ev('S.slimes[1].id');await tap(`[data-lw="person"][data-id="${second}"]`);await check('portrait touch targets the matching care panel',`document.querySelector('[data-care-for]').dataset.careFor==='${second}'`);
  await tap('[data-lw="edit"]');
  await check('catalog opens with illustrated accessible buttons','document.querySelector(".lw-build-catalog").open&&document.querySelectorAll(".lw-build-item svg").length===6&&!document.querySelector(".lw-build-catalog select,.lw-build-item [tabindex],.lw-build-item [role=button]")');
  await p.ev('document.querySelector(".lw-build-catalog").scrollIntoView({block:"start"});true');await shot('facilities');
  const stock=await p.ev('[S.world.stock.wood,S.world.stock.stone]');await tap('[data-def="kitchen"]');
  await check('touching an illustration selects it and reveals placement instructions','document.querySelector("[data-def=kitchen]").getAttribute("aria-pressed")==="true"&&document.querySelector(".lw-placement-hint").textContent.includes("厨房")');
  await check('selecting an object does not charge materials',`S.world.stock.wood===${stock[0]}&&S.world.stock.stone===${stock[1]}`);
  await cell(2,1);await check('overlap keeps the layout and material balance',`!S.world.placements.some(p=>p.def==='kitchen')&&S.world.stock.wood===${stock[0]}`);
  await cell(0,6);await check('touching an empty tile builds and charges exactly once',`S.world.placements.filter(p=>p.def==='kitchen').length===1&&S.world.stock.wood===${stock[0]-12}&&S.world.stock.stone===${stock[1]-8}`);
  await tap('[data-lw="cancel-build"]');await check('cancel removes the active construction mode','!document.querySelector(".lw-placement-hint")');
  const kitchen=await p.ev('S.world.placements.find(p=>p.def==="kitchen").id');await tap(`[data-lw-object="${kitchen}"]`);await command('store',{id:kitchen});
  await tap('[data-lw="build-kind"][data-kind="stored"]');await check('stored objects have direct illustrated retrieval','document.querySelectorAll(".lw-build-item").length===1&&document.querySelector(".lw-build-item svg")');
  const beforeRetrieve=await p.ev('S.world.stock.wood');await tap(`.lw-build-item[data-id="${kitchen}"]`);await cell(0,6);await check('retrieval preserves object identity and costs nothing',`!S.world.placements.find(p=>p.id===${kitchen}).stored&&S.world.stock.wood===${beforeRetrieve}`);
  await tap('[data-lw="build-kind"][data-kind="decor"]');await tap('[data-lw="build-group"][data-group="2"]');
  await p.ev('document.querySelector(".lw-build-catalog").scrollIntoView({block:"start"});true');await shot('lanterns');
  await tap('[data-def="decor-2-1"]');await cell(10,8);await check('decorations place through the same touch flow','S.world.placements.some(p=>p.def==="decor-2-1"&&p.x===10&&p.y===8)');await tap('[data-lw="cancel-build"]');
  await p.ev('S.world.stock.wood=0;S.world.stock.stone=0;renderTab();true');await tap('[data-def="decor-2-0"]');await check('unaffordable objects explain the shortage without entering placement mode','document.querySelector("[data-def=decor-2-0]").getAttribute("aria-disabled")==="true"&&!document.querySelector(".lw-placement-hint")');
  await p.ev('S.world.stock.wood=100;S.world.stock.stone=100;renderTab();true');
  await p.ev('document.querySelector("[data-lw=build-kind][data-kind=facilities]").focus();true');
  await p.client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13});await p.client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await check('keyboard changes category and keeps focus on the chosen control','document.activeElement?.dataset.kind==="facilities"&&document.querySelector("[data-kind=facilities]").getAttribute("aria-pressed")==="true"');
  await p.client.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await check('reduced motion disables object transitions','getComputedStyle(document.querySelector(".lw-build-art svg")).transitionDuration==="0s"');
  await p.client.send('Emulation.setEmulatedMedia',{features:[]});
  for(const theme of ['sunset','dark','light','peach','mint','lavender','sky']){
   await p.ev(`S.theme=${JSON.stringify(theme)};applyTheme();renderTab();true`);
   const ratio=await p.ev(contrast);assert.ok(ratio>=4.5,theme+' active tab contrast '+ratio.toFixed(2));results.push({name:theme+' active tab contrast',status:'PASS',ratio});
   await check('catalog fits '+theme,'document.documentElement.scrollWidth<=innerWidth&&document.querySelector(".lw-build-items").scrollWidth===document.querySelector(".lw-build-items").clientWidth');
   if(theme==='light'){await p.ev('document.querySelector(".lw-build-catalog").scrollIntoView({block:"start"});true');await shot('light');}
  }
  for(const width of [320,390,480,1280]){await viewport(width);await check('catalog has no horizontal overflow at '+width,'document.documentElement.scrollWidth<=innerWidth&&document.querySelector(".lw-build-items").scrollWidth===document.querySelector(".lw-build-items").clientWidth');}
  await viewport(390);await p.ev('S.theme="sunset";applyTheme();switchTab("companions");true');await command('storyEncounter',{kind:'world'});
  const story=await p.ev('Object.values(S.world.stories).find(i=>i.kind==="world")');
  await check('story assigns one partner and shows one continuation without casting controls','document.querySelectorAll(".lw-story [data-command]").length===1&&!document.querySelector("#lw-pair-a,#lw-pair-b,#lw-pair-event")&&document.querySelector(".lw-story").closest("details").open');
  await p.ev(`S.world.companions[${story.participants[0]}].facts={plant:1};renderTab();true`);await command('storyContinue');
  await check('continuing keeps the same story open and records one scene',`S.world.stories[${JSON.stringify(story.id)}].stage===1&&S.world.memorials.length===1&&document.querySelector('.lw-story').closest('details').open`);
  await p.ev('document.querySelector(".lw-story").scrollIntoView({block:"center"});true');await shot('story');
  await p.client.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await p.client.send('Page.reload');assert.ok(await waitFor(()=>p.ev('typeof S!=="undefined"&&S.started&&!persistenceBlocked'),10000));
  await check('offline reload retains cast, story outcome and constructed objects',`S.world.stories[${JSON.stringify(story.id)}].participants[0]===${story.participants[0]}&&S.world.stories[${JSON.stringify(story.id)}].stage===1&&S.world.placements.some(p=>p.id===${kitchen})&&S.world.placements.some(p=>p.def==='decor-2-1')`);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);results.push({name:'no uncaught errors or remote assets',status:'PASS'});
 }catch(error){results.push({name:'catalog and story acceptance',status:'FAIL',error:error.stack});console.error(error.stack);process.exitCode=1;await p.shot(path.resolve('tools/out/shots/catalog-failure.png')).catch(()=>{});}
 finally{report('tools/out','catalog-browser.json',{results,errors,requests});await p.close();}
 console.log(`RESULT ${results.filter(r=>r.status==='PASS').length}/${results.length}`);
})();
