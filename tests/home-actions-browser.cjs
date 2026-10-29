// Contextual home actions, placement feedback and responsive cards in an isolated save.
const assert=require('node:assert/strict');
const {launch,fileUrl,sleep,waitFor,report}=require('../tools/out/lib/cdp.js');
const out='tools/out/magic-ui/home-actions',checks=[],errors=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});assert.ok(ok,name+': '+JSON.stringify(detail));console.log('PASS '+name);};
(async()=>{
 const b=await launch({url:'about:blank',width:1440,height:900,dpr:1,touchEnabled:true,gpu:true});const {ev,client}=b;
 client.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 client.on('Runtime.consoleAPICalled',e=>{if(['error','assert'].includes(e.type))errors.push(e.args.map(a=>a.value??a.description).join(' '));});
 await client.send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__intervals=[];const interval=window.setInterval;window.setInterval=(...args)=>{const id=interval(...args);__intervals.push(id);return id;};`});
 const mouse=async(type,p,extra={})=>client.send('Input.dispatchMouseEvent',{type,...p,...extra});
 const tap=async p=>{await mouse('mousePressed',p,{button:'left',clickCount:1});await mouse('mouseReleased',p,{button:'left',clickCount:1});};
 const click=async selector=>tap(await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`));
 const close=async()=>{if(await ev(`!!document.querySelector('.home-panel,.home-orbit')`))await click('[data-lw="close"]');};
 const open=async(def,action='use')=>{await close();await click('[data-panel="build"]');await click('[data-category="facilities"]');if(await ev(`!!document.querySelector('[data-group="all"]')?.getClientRects().length`))await click('[data-group="all"]');await click(`[data-lw="inspect"][data-def="${def}"]`);if(action)await click(`[data-lw="${action}"]`);};
 const point=async(x,y)=>ev(`(()=>{const p=new DOMPoint(${(x+.5)*48},${(y+.5)*48}).matrixTransform(document.querySelector('.home-map').getScreenCTM());return {x:p.x,y:p.y};})()`);
 const key=async key=>{await client.send('Input.dispatchKeyEvent',{type:'keyDown',key});await client.send('Input.dispatchKeyEvent',{type:'keyUp',key});};
 const frame=()=>ev('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
 const snapshot=()=>ev(`JSON.stringify({stock:S.world.inventory.items,placements:S.world.placements,seq:S.world.seq})`);
 try{
  await client.send('Page.navigate',{url:fileUrl('史莱姆.html','?battle=ui')});assert.ok(await waitFor(()=>ev(`typeof S!=='undefined'&&S.started`),10000));
  await ev(`__intervals.forEach(clearInterval);document.querySelector('#selftestOut')?.remove();S.slimes=[createSlime(false),createSlime(false),createSlime(false)];S.slimes.forEach((s,i)=>{s.name=['露露','芽芽','桃桃'][i];s.stamina=100;});S.theme='peach';applyTheme();S.world.clock=1200;for(const k of ['wood','stone','ingredient','herb','mushroom','fruit','meal'])S.world.stock[k]=800;for(const [def,x,y] of [['kitchen',10,8],['woodshop',22,7],['table',22,12],['pollen',26,8]]){const r=LivingWorld.execute(S,{type:'build',def,zone:0,x,y});if(!r.ok)throw Error(r.message);}switchTab('home');`);
  await click('[data-panel="build"]');const unplaced=await snapshot(),shelf=await ev(`(()=>{const r=document.querySelector('.home-catalog').getBoundingClientRect();return {x:r.x+r.width*.7,y:r.y+55};})()`);
  await mouse('mousePressed',shelf,{button:'left',buttons:1,clickCount:1});for(let n=1;n<=8;n++)await mouse('mouseMoved',{x:shelf.x-n*30,y:shelf.y},{button:'left',buttons:1});await mouse('mouseReleased',{x:shelf.x-240,y:shelf.y},{button:'left',clickCount:1});
  check('mouse dragging slides the catalog without selecting a building',await snapshot()===unplaced&&await ev(`document.querySelector('.home-build-panel .home-catalog').scrollLeft>100&&!document.querySelector('.home-tool-hint')`));
  const shelfScroll=await ev(`document.querySelector('.home-catalog').scrollLeft`);await sleep(2600);await ev('LivingWorld.refresh()');check('refresh keeps the shelf at the browsed position',await ev(`Math.abs(document.querySelector('.home-catalog').scrollLeft-${shelfScroll})<2`));
  await click('[data-lw="shelf-scroll"][data-dir="1"]');check('desktop shelf arrows scroll through more buildings',await waitFor(()=>ev(`document.querySelector('.home-catalog').scrollLeft>${shelfScroll}+100`),2000));
  await open('kitchen');
  check('selecting the kitchen exposes only its unlocked recipes',await ev(`(()=>{const cmds=[...document.querySelectorAll('.home-recipes [data-command]')].map(e=>JSON.parse(e.dataset.command));return cmds.length===4&&cmds.every(c=>['feed','simplemeal','snack','meal'].includes(c.recipe)&&S.world.placements.find(p=>p.id===c.building).def==='kitchen')&&!document.querySelector('.home-panel select');})()`));
  check('upgrade and move remain in the fixed action footer',await ev(`!!document.querySelector('.home-object-footer [data-command*="upgrade"]')&&!!document.querySelector('.home-object-footer [data-lw="move"]')&&!!document.querySelector('.home-next-form image')`));
  const ingredients=await ev('S.world.stock.ingredient');await click('.home-recipes [data-command*="feed"]');
  check('one recipe click starts crafting in the selected facility',await ev(`S.world.stock.ingredient===${ingredients}-1&&S.world.crafts.length===1&&S.world.placements.find(p=>p.id===S.world.crafts[0].building).def==='kitchen'`));
  await click('.home-recipes [data-command*="simplemeal"]');const full=await snapshot();await click('.home-recipes [data-command*="snack"]');
  check('a full crafting queue explains why and preserves materials',await snapshot()===full&&await ev(`document.querySelector('.home-recipes button').disabled&&document.querySelector('.home-recipes button').textContent==='队列已满'`));
  await click('[data-lw="manage"]');check('a busy facility cannot be stored',await ev(`document.querySelector('[data-command*="store"]').disabled`));await click('[data-lw="manage"]');
  await ev('LivingWorld.tick(S,121);renderTab()');const beforeFeed=await ev('S.world.stock.feed');await click('[data-command*="claimCraft"]');
  check('the contextual queue pays into the shared inventory',await ev(`S.world.stock.feed===${beforeFeed}+2`));await click('[data-command*="claimCraft"]');
  await ev('S.world.stock.ingredient=0;renderTab()');check('missing recipe materials are shown on the recipe button',await ev(`document.querySelector('.home-recipes [data-command*="feed"]').disabled&&document.querySelector('.home-recipes [data-command*="feed"]').textContent.includes('缺 食材')`));await ev('S.world.stock.ingredient=800;renderTab()');
  await click('[data-lw="manage"]');await click('[data-lw="assign"]');
  check('one partner chip assigns work without a dropdown',await ev(`S.world.workers.length===1&&!document.querySelector('.home-panel select')&&[...document.querySelectorAll('[data-lw="assign"]')].every(b=>b.disabled)`));
  await click('[data-command*="unassign"]');check('rest releases the assigned partner',await ev('S.world.workers.length===0'));await click('[data-lw="manage"]');
  await click('[data-command*="upgrade"]');
  check('upgrade immediately exposes the newly unlocked recipe',await ev(`S.world.placements.find(p=>p.def==='kitchen').level===2&&!!document.querySelector('.home-recipes [data-command*="soup"]')`));
  const stock=await ev('S.world.stock.wood');await ev('S.world.stock.wood=0;renderTab()');const poor=await snapshot();await click('[data-command*="upgrade"]');
  check('unaffordable upgrade is disabled with a visible shortage',await snapshot()===poor&&await ev(`document.querySelector('[data-command*="upgrade"]').disabled&&document.querySelector('.home-upgrade-note').textContent.includes('还缺 木材')`));await ev(`S.world.stock.wood=${stock};renderTab()`);
  const baseline=await ev('JSON.stringify(S.world)');
  await ev(`(()=>{const p=S.world.placements.find(p=>p.def==='kitchen');p.level=1;p.form=1;p.x=10;p.y=8;S.world.placements=S.world.placements.filter(b=>b.id===p.id);for(const [x,y]of [[10,7],[11,7],[10,9],[11,9]])S.world.placements.push({id:S.world.seq++,def:'decor-1-0',zone:0,x,y,rotation:0,level:1,stored:false});renderTab()})()`);
  await open('kitchen','upgrade-view');const blocked=await snapshot();await click('[data-command*="upgrade"]');
  check('blocked expansion is visible and cannot spend materials',await snapshot()===blocked&&await ev(`document.querySelector('[data-command*="upgrade"]').disabled&&document.querySelector('.home-upgrade-note').textContent.includes('需要 2×2 空地')&&document.querySelectorAll('.home-growth-cell.blocked').length>0`));
  await ev(`(()=>{S.world=JSON.parse(${JSON.stringify(baseline)});LivingWorld.ensure(S);const p=S.world.placements.find(p=>p.def==='kitchen');p.level=3;delete p.form;renderTab()})()`);
  const legacyWood=await ev('S.world.stock.wood');await click('[data-command*="upgrade"]');await click('[data-command*="upgrade"]');
  check('legacy upgraded facilities unfold for free and finish at max form',await ev(`S.world.placements.find(p=>p.def==='kitchen').form===3&&S.world.stock.wood===${legacyWood}&&!document.querySelector('[data-command*="upgrade"]')&&document.querySelector('.home-max-level').textContent.includes('最高等级')`));
  await click('[data-lw="manage"]');await click('[data-command*="store"]');
  check('storage returns directly to the stored catalog',await ev(`document.querySelector('[data-category="stored"]').getAttribute('aria-pressed')==='true'&&S.world.placements.find(p=>p.def==='kitchen').stored`));
  const kitchen=await ev(`S.world.placements.find(p=>p.def==='kitchen').id`);await click(`[data-lw="move"][data-id="${kitchen}"]`);
  const cancelled=await snapshot();await click('[data-lw="rotate"]');
  check('moving previews the actual upgraded sprite before committing',await snapshot()===cancelled&&await ev(`!!document.querySelector('.home-placement-ghost image')&&!document.querySelector('.home-panel')`));
  await key('Escape');check('Escape from a toolbar button cancels without changing the save',await snapshot()===cancelled&&await ev(`!document.querySelector('.home-tool-hint')`));
  await click('[data-panel="build"]');await click(`[data-lw="move"][data-id="${kitchen}"]`);await tap(await point(10,8));
  check('restoring from storage opens the usable building card',await ev(`!S.world.placements.find(p=>p.id===${kitchen}).stored&&S.world.placements.find(p=>p.id===${kitchen}).form===3&&!!document.querySelector('.home-orbit')`));
  await open('house');await click('[data-lw="move"]');const moveBefore=await snapshot();await key('ArrowRight');
  check('keyboard arrows adjust the image preview without moving the building',await snapshot()===moveBefore&&await ev(`document.querySelector('.home-placement-ghost').getAttribute('transform').includes('720')`));await key('Enter');
  check('Enter commits the preview through the normal movement rules',await ev(`S.world.placements.find(p=>p.def==='house').x===15&&!document.querySelector('.home-tool-hint')`));
  await close();await click('[data-panel="build"]');await click('[data-group="craft"]');check('purpose filters show only matching facilities',await ev(`document.querySelectorAll('.home-catalog [data-def]').length===7&&![...document.querySelectorAll('.home-catalog [data-def]')].some(e=>e.dataset.def==='table')`));
  await click('[data-category="decor"]');await click('[data-def="decor-1-0"]');const beforeBuild=await snapshot();await mouse('mouseMoved',await point(15,8));
  check('placement hover renders the sprite and explains an occupied tile',await snapshot()===beforeBuild&&await ev(`!!document.querySelector('.home-placement-ghost image')&&document.querySelector('.home-placement-status').textContent.includes('已有设施')`));await tap(await point(15,8));check('invalid placement retains the tool and save',await snapshot()===beforeBuild&&await ev(`!!document.querySelector('.home-tool-hint')`));
  await tap(await point(18,7));check('one ground click places the decoration and opens its actions',await ev(`S.world.placements.some(p=>p.def==='decor-1-0'&&p.x===18&&p.y===7)&&!!document.querySelector('.home-orbit')`));
  await open('toys');check('toys start with an available partner selected',await ev(`document.querySelectorAll('[data-lw="play-person"][aria-pressed="true"]').length===1&&!document.querySelector('.home-panel select')`));
  await click('[data-lw="play-person"]:last-child');const chosen=await ev(`+document.querySelector('[data-lw="play-person"][aria-pressed="true"]').dataset.person`);await click('[data-lw="play"][data-kind="ball"]');
  assert.ok(await waitFor(()=>ev('ballGame?.running===true'),3000));check('play uses the partner selected on the visual chip',await ev(`S.world.activities[${chosen}]?.kind==='play'`));await click('#gClose');
  await open('table');check('the dining table preselects its available capacity',await ev(`document.querySelectorAll('[data-lw="meal-person"][aria-pressed="true"]').length===2&&!document.querySelector('[data-lw="meal"]').disabled`));
  const meal=await ev('S.world.stock.meal');await click('[data-lw="meal"]');check('one click serves the selected partners',await ev(`S.world.stock.meal===${meal}-1`));await click('[data-lw="meal-person"][aria-pressed="true"]');check('fewer than two dining partners disables serving',await ev(`document.querySelector('[data-lw="meal"]').disabled`));
  await ev(`LivingWorld.execute(S,{type:'upgrade',id:S.world.placements.find(p=>p.def==='table').id});renderTab()`);await open('table');await click('[data-lw="meal-person"]:last-child');await click('[data-lw="meal-person"]:last-child');
  await ev(`S.world.activities[S.slimes[0].id]={kind:'battle'};renderTab()`);const availableMeal=await ev('S.world.stock.meal');await click('[data-lw="meal"]');check('dining uses only the currently available selected partners',await ev(`S.world.stock.meal===${availableMeal}-1`));await ev(`delete S.world.activities[S.slimes[0].id];renderTab()`);
  await open('pollen');check('breeding waits for flowering parents',await ev(`document.querySelector('[data-lw="breed"]').disabled&&!document.querySelector('.home-panel select')`));
  await ev(`for(const [cultivar,x,y]of [[10,25,12],[11,26,12]]){const r=LivingWorld.execute(S,{type:'plant',cultivar,zone:0,x,y});if(!r.ok)throw Error(r.message);S.world.crops.at(-1).progress=.8;}renderTab()`);await open('pollen');const cultivars=await ev('S.world.cultivars.length');
  check('flowering parents are selected as image chips',await ev(`document.querySelectorAll('[data-lw="parent"][aria-pressed="true"]').length===2`));await click('[data-lw="breed"]');check('breeding runs directly from its building',await ev(`S.world.cultivars.length===${cultivars}+1`));
  await open('kitchen');await ev(`S.world.placements.find(p=>p.def==='kitchen').level=1;S.world.placements.find(p=>p.def==='kitchen').form=1;renderTab()`);
  for(const [width,height] of [[1440,900],[1920,1080],[390,844],[320,568],[844,390]]){
   await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<760,screenWidth:width,screenHeight:height});await frame();await open('kitchen','');await frame();
   const orbit=await ev(`(()=>{const p=S.world.placements.find(p=>p.def==='kitchen'),art=document.querySelector('[data-home-object="'+p.id+'"] image').getBoundingClientRect(),buttons=[...document.querySelectorAll('.home-orbit button')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}),top=document.querySelector('.topbar').getBoundingClientRect().bottom,bottom=document.querySelector('.tabbar').getBoundingClientRect().top;return {count:buttons.length,visible:getComputedStyle(document.querySelector('.home-orbit')).visibility,clear:buttons.every(r=>r.right<=art.left||r.x>=art.right||r.bottom<=art.top||r.y>=art.bottom),inside:buttons.every(r=>r.x>=0&&r.right<=innerWidth&&r.y>=top&&r.bottom<=bottom&&r.width>=44&&r.height>=44)};})()`);
   check(`${width}x${height}: orbit surrounds the building with accessible buttons`,orbit.count===4&&orbit.visible==='visible'&&orbit.clear&&orbit.inside,orbit);await b.shot(`${out}/orbit-${width}x${height}.png`);await click('[data-lw="use"]');await frame();
   const g=await ev(`(()=>{const p=document.querySelector('.home-object-panel'),b=p.getBoundingClientRect(),n=document.querySelector('.tabbar').getBoundingClientRect(),t=document.querySelector('.topbar').getBoundingClientRect(),k=S.world.placements.find(p=>p.def==='kitchen'),r=document.querySelector('[data-home-object="'+k.id+'"] image').getBoundingClientRect(),actions=[...p.querySelectorAll('.home-object-footer button')].map(e=>{const q=e.getBoundingClientRect();return {width:q.width,height:q.height,inside:q.top>=b.top&&q.bottom<=n.top};});return {inside:b.left>=0&&b.right<=innerWidth&&b.top>=t.bottom&&b.bottom<=n.top,clear:r.top>=t.bottom&&r.bottom<=n.top&&(r.right<=b.left||r.bottom<=b.top),overflow:p.scrollWidth>p.clientWidth,actions,body:p.querySelector('.home-panel-body').clientHeight};})()`);
   check(`${width}x${height}: building, actions and scroll area remain usable`,g.inside&&g.clear&&!g.overflow&&g.body>=55&&g.actions.every(a=>a.inside&&a.width>=44&&a.height>=44),g);await b.shot(`${out}/kitchen-${width}x${height}.png`);
  }
  for(const [width,height,insets] of [[390,844,{top:47,bottom:34,left:0,right:0}],[844,390,{top:0,bottom:21,left:47,right:47}],[320,568,{top:0,bottom:0,left:0,right:0}]]){
   await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<760});await client.send('Emulation.setSafeAreaInsetsOverride',{insets});
   for(const [x,y]of [[0,0],[33,21]]){
    await ev(`(()=>{const p=S.world.placements.find(p=>p.def==='house');p.x=${x};p.y=${y};p.level=3;p.form=3;renderTab()})()`);await open('house','');await frame();
    const safe=await ev(`(()=>{const top=document.querySelector('.topbar').getBoundingClientRect().bottom,bottom=document.querySelector('.tabbar').getBoundingClientRect().top;return [...document.querySelectorAll('.home-orbit button')].every(e=>{const r=e.getBoundingClientRect();return r.left>=${insets.left}&&r.right<=innerWidth-${insets.right}&&r.top>=top&&r.bottom<=bottom&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-lw]')===e;});})()`);
    check(`${width}x${height}: edge house ${x},${y} keeps all orbit buttons reachable`,safe);
   }
  }
  await client.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,bottom:0,left:0,right:0}});await client.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await open('kitchen');
  for(const theme of await ev('THEMES.map(t=>t.id)')){
   await ev(`S.theme=${JSON.stringify(theme)};applyTheme();renderTab()`);await frame();
   check(theme+' contextual card inherits the selected theme',await ev(`getComputedStyle(document.querySelector('.home-object-panel')).backdropFilter.includes('blur(22px)')&&getComputedStyle(document.querySelector('.home-object-panel')).backgroundColor.includes('0.78')&&!document.querySelector('.home-panel [style*="background"]')`));await b.shot(`${out}/kitchen-${theme}.png`);
  }
  await ev('S.theme="peach";applyTheme();renderTab()');await close();await click('[data-panel="build"]');await click('[data-category="facilities"]');await click('[data-group="all"]');await b.shot(`${out}/catalog-390x844.png`);
  const shelfBefore=await ev(`document.querySelector('.home-catalog').scrollLeft`),touchShelf=await ev(`(()=>{const r=document.querySelector('.home-catalog').getBoundingClientRect();return {x:r.right-35,y:r.y+50};})()`);await b.touch.drag(touchShelf,{x:touchShelf.x-200,y:touchShelf.y},8);check('phone swipes slide the building shelf without placing',await waitFor(()=>ev(`document.querySelector('.home-catalog')?.scrollLeft>${shelfBefore}+50&&!document.querySelector('.home-tool-hint')`),2500));
  await click('[data-def="alchemy"]');await mouse('mouseMoved',await point(19,7));await b.shot(`${out}/placement-390x844.png`);
  const edit=await ev(`(()=>{const a=document.querySelector('.home-tool-hint').getBoundingClientRect(),b=document.querySelector('.home-camera').getBoundingClientRect(),n=document.querySelector('.tabbar').getBoundingClientRect();return {clear:b.bottom<=a.top,inside:a.left>=0&&a.right<=innerWidth&&a.bottom<=n.top};})()`);check('phone placement controls do not overlap the camera or navigation',edit.clear&&edit.inside,edit);
  await click('[data-lw="cancel"]');
  check('no browser exceptions or console errors',errors.length===0,errors);report(out,'results.json',{checks,errors});
 }catch(e){await b.shot(`${out}/failure.png`).catch(()=>{});report(out,'results.json',{checks,errors,failure:String(e)});throw e;}
 finally{await b.close();}
 console.log(`RESULT ${checks.length}/${checks.length} home action checks`);
})().catch(e=>{console.error(e);process.exitCode=1;});
