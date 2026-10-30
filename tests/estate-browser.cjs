// 家园经营的真实浏览器输入：开垦路牌、研究、建造资源建筑、产出气泡、委托、集市、桥接物品进背包和多视口布局。
const assert=require('node:assert/strict');
const {launch,fileUrl,sleep,waitFor,report}=require('../tools/out/lib/cdp.js');
const out='tools/out/magic-ui/estate',checks=[],errors=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});assert.ok(ok,name+': '+JSON.stringify(detail));console.log('PASS '+name);};
(async()=>{
 const b=await launch({url:'about:blank',width:1440,height:900,dpr:1,touchEnabled:true,gpu:true});const {ev,client}=b;
 client.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 client.on('Runtime.consoleAPICalled',e=>{if(['error','assert'].includes(e.type))errors.push(e.args.map(a=>a.value??a.description).join(' '));});
 await client.send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__intervals=[];const interval=window.setInterval;window.setInterval=(...args)=>{const id=interval(...args);__intervals.push(id);return id;};`});
 const mouse=async(type,p,extra={})=>client.send('Input.dispatchMouseEvent',{type,...p,...extra});
 const frame=()=>ev('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
 const tap=async p=>{await mouse('mouseMoved',p);await mouse('mousePressed',p,{button:'left',clickCount:1});await mouse('mouseReleased',p,{button:'left',clickCount:1});await frame();await sleep(120);};
 // 取元素中心，并确认这一点真的落在元素上（没有被工具栏或面板挡住）。
 const at=async selector=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});if(!(e instanceof SVGElement))e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),p={x:r.x+r.width/2,y:r.y+r.height/2},hit=document.elementFromPoint(p.x,p.y);if(!hit||!(e===hit||e.contains(hit)||hit.closest('[data-home-plot],[data-home-bubble]')===e.closest('[data-home-plot],[data-home-bubble]')&&e.closest('[data-home-plot],[data-home-bubble]')))throw Error('Covered '+${JSON.stringify(selector)}+' by '+(hit?.className?.baseVal??hit?.className));return p;})()`);
 const click=async selector=>tap(await at(selector));
 const close=async()=>{while(await ev(`!!document.querySelector('.home-panel [data-lw="close"],.home-selection-close [data-lw="close"]')`))await click('.home-panel [data-lw="close"],.home-selection-close [data-lw="close"]');};
 const point=async(x,y)=>ev(`(()=>{const p=new DOMPoint(${(x+.5)*48},${(y+.5)*48}).matrixTransform(document.querySelector('.home-map').getScreenCTM());return {x:p.x,y:p.y};})()`);
 const size=async(width,height)=>{await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<1000,screenWidth:width,screenHeight:height});await frame();await sleep(250);};
 const render=async()=>{await ev('renderTab()');await frame();await sleep(150);};
 const items=()=>ev('JSON.stringify(S.world.inventory.items)');
 // 与 home-browser 相同的 2.5 秒帧率采样。
 const fps=async()=>ev(`new Promise(resolve=>{const samples=[],start=performance.now();let last=start;function step(t){if(t>last)samples.push(t-last);last=t;if(t-start<2500)requestAnimationFrame(step);else resolve({fps:1000/(samples.reduce((a,b)=>a+b,0)/samples.length),frames:samples.length,p95:samples.sort((a,b)=>a-b)[Math.floor(samples.length*.95)]});}requestAnimationFrame(step);})`);
 try{
  await client.send('Page.navigate',{url:fileUrl('史莱姆.html','?battle=ui')});assert.ok(await waitFor(()=>ev(`typeof S!=='undefined'&&S.started`),10000));
  await ev(`__intervals.forEach(clearInterval);document.querySelector('#selftestOut')?.remove();S.slimes=[createSlime(false),createSlime(false)];S.slimes[0].element='岩';S.slimes.forEach((s,i)=>{s.name=['石石','露露'][i];s.stamina=100;s.mood=80;});S.world=LivingWorld.createWorld(487);S.world.clock=1200;LivingWorld.ensure(S);switchTab('home');`);await frame();await sleep(300);

  // 1. 开局：四块地、20 块密林、等级与委托在季节栏、五个主工具。
  const start=await ev(`({plots:S.world.estate.plots.length,locked:document.querySelectorAll('.home-locked-plot').length,signs:document.querySelectorAll('[data-home-plot]').length,level:document.querySelector('.home-season .home-button')?.textContent,tools:document.querySelectorAll('.home-tools>.home-button').length,overflow:document.documentElement.scrollWidth>innerWidth})`);
  check('a new home opens four plots and shows the rest as forest with clearing signs',start.plots===4&&start.locked===20&&start.signs>=6&&!start.overflow,start);
  check('home level and orders sit in the season bar beside five main tools',/1\s*级/.test(start.level)&&/3/.test(start.level)&&start.tools===5,start);
  await b.shot(`${out}/new-1440.png`);
  // 开局缩到最小：20 块密林全部在画面里，是树木最多的情形。
  for(let i=0;i<8;i++)await ev(`document.querySelectorAll('[data-lw="zoom"]')[1].click()`);await frame();
  const forest=await fps();check('the forest-covered starting map stays at 55 FPS when fully zoomed out',forest.fps>=55,forest);await b.shot(`${out}/forest-zoomed-out-1440.png`);
  await ev(`document.querySelector('[data-lw="center"]').click()`);await frame();

  // 2. 点路牌开垦；缺材料时按钮写明缺什么且不改存档。
  await ev('S.world.stock.wood=200;S.world.stock.stone=100;renderTab()');await frame();
  await click('[data-home-plot="7"] image');check('tapping a forest sign opens its clearing card',await ev(`!!document.querySelector('.home-plot-card')&&document.querySelector('.home-panel').getAttribute('aria-label')==='开垦林地'`));
  const wood=await ev('S.world.stock.wood');await click(`.home-panel [data-command*='"type":"clear"']`);
  check('clearing spends wood and stone, returns timber and opens the plot',await ev(`S.world.estate.plots.includes(7)&&S.world.stock.wood===${wood}-20+10&&S.world.stock.stone===90&&!document.querySelector('[data-home-plot="7"]')`));
  await ev('S.world.stock.wood=0;renderTab()');await frame();const poor=await items();
  await click('[data-home-plot="13"] image');const clearButton=JSON.stringify('.home-panel [data-command*=\'"type":"clear"\']'),blocked=await ev(`(()=>{const b=document.querySelector(${clearButton});return {disabled:b.disabled,text:b.textContent};})()`);
  check('clearing without materials names the shortage and changes nothing',blocked.disabled&&blocked.text.includes('缺')&&await items()===poor,blocked);await close();

  // 3. 建造栏里锁定的设施直接带到对应研究；开始研究、离线推进、完成后可以建造。
  await ev('S.world.stock.wood=400;S.world.stock.stone=300;renderTab()');await frame();
  await click('[data-panel="build"]');await click('[data-group="resource"]');await click('[data-lw="tech-node"][data-def="quarry"]');
  check('a locked facility card opens its research node',await ev(`document.querySelector('.home-tech-panel')&&document.querySelector('#tech-res-quarry.focus')!==null`));
  const notes=await ev('S.world.stock.notes');await click('#tech-res-quarry [data-command*="research"]');
  check('starting research spends notes once and shows the queue',await ev(`S.world.stock.notes===${notes}-2&&S.world.estate.research[0]?.id==='res-quarry'&&document.querySelectorAll('.home-research').length===1`));
  await b.shot(`${out}/research-1440.png`);
  await ev('LivingWorld.tick(S,120)');await render();
  check('research completes on the shared clock',await ev(`S.world.estate.tech.includes('res-quarry')&&!S.world.estate.research.length&&!!document.querySelector('#tech-res-quarry.done')`));await close();
  await click('[data-panel="build"]');await click('[data-group="resource"]');await click('[data-lw="build"][data-def="quarry"]');
  await mouse('mouseMoved',await point(20,7));await tap(await point(20,7));
  check('the researched quarry is placed with the build tool',await ev(`S.world.placements.some(p=>p.def==='quarry'&&p.x===20&&p.y===7)`));await close();

  // 4. 产出先存在建筑里，地图冒出气泡；点气泡收进仓库。
  const quarry=await ev(`S.world.placements.find(p=>p.def==='quarry').id`),stone=await ev('S.world.stock.stone');
  await ev('LivingWorld.tick(S,300)');await render();
  check('production waits in the building and raises a bubble',await ev(`S.world.estate.yields[${quarry}]?.stone===4&&S.world.stock.stone===${stone}&&!!document.querySelector('[data-home-bubble="${quarry}"]')`));
  await b.shot(`${out}/bubble-1440.png`);
  await click(`[data-home-bubble="${quarry}"] circle`);
  check('tapping the bubble collects exactly once',await ev(`S.world.stock.stone===${stone}+4&&!S.world.estate.yields[${quarry}]&&!document.querySelector('[data-home-bubble="${quarry}"]')`));
  await ev('LivingWorld.tick(S,300)');await render();await click('.home-collect .home-button');
  check('the collect pill gathers every waiting building',await ev(`S.world.stock.stone===${stone}+8&&!Object.keys(S.world.estate.yields).length&&!document.querySelector('.home-collect')`));

  // 5. 委托：交付后晶币与积分进入原版余额，笔记进家园库存。
  await click('.home-season .home-button');const order=await ev(`(()=>{const o=S.world.estate.orders[0],[k,n]=Object.entries(o.need)[0];S.world.stock[k]=n;renderTab();return {id:o.id,coins:o.coins,points:o.points,notes:o.notes,k};})()`);await frame();
  const before=await ev('({coins:S.coins,points:S.points,notes:S.world.stock.notes})');await click(`.home-order [data-command*='"id":${order.id}']`);
  check('delivering an order pays coins and points to the original game and notes to the home',await ev(`S.coins===${before.coins}+${order.coins}&&S.points===${before.points}+${order.points}&&S.world.stock.notes===${before.notes}+${order.notes}&&S.world.stock.${order.k}===0&&!S.world.estate.orders.some(o=>o.id===${order.id})`),order);
  check('the order panel shows the shared nine-order allowance',await ev(`document.querySelector('.home-panel')?.textContent.includes('本轮已完成 1/9 份')`));
  await b.shot(`${out}/orders-1440.png`);await close();

  // 6. 集市与桥接物品：卖材料换晶币；捕捉网直接进入原版背包。
  await ev(`(()=>{const w=S.world;w.estate.tech.push('pal-market','cra-wood','cra-alchemy','res-mine','cra-smelt','cra-net');w.inventory.items.wood=900;w.inventory.items.stone=900;Object.assign(w.inventory.items,{plank:10,ingot:10,herb:10});
   for(const c of [{type:'build',def:'market',zone:0,x:7,y:7},{type:'build',def:'woodshop',zone:0,x:7,y:10}])if(!LivingWorld.dispatch(c))throw Error(JSON.stringify(c));
   if(!LivingWorld.dispatch({type:'upgrade',id:S.world.placements.at(-1).id}))throw Error('upgrade');})()`);await render();await close();
  await click('[data-panel="build"]');await click('[data-group="resource"]');await click('[data-lw="inspect"][data-def="market"]');await click('.home-orbit [data-lw="use"]');
  const coins=await ev('S.coins'),woodBefore=await ev('S.world.stock.wood');await click(`.home-market [data-command*='"item":"wood","amount":10']`);
  check('the market sells ten wood for coins through the original income event',await ev(`S.coins===${coins}+40&&S.world.stock.wood===${woodBefore}-10&&S.world.estate.daily.sold===40`));
  await b.shot(`${out}/market-1440.png`);await close();
  await click('[data-panel="build"]');await click('[data-group="craft"]');await click('[data-lw="inspect"][data-def="woodshop"]');await click('.home-orbit [data-lw="use"]');
  const nets=await ev('S.bag.net||0');await click(`.home-recipes [data-command*='"recipe":"net"']`);
  check('net crafting shows its round allowance',await ev(`document.querySelector('.home-bridge')?.textContent.includes('本轮 1/4')`));
  await ev('LivingWorld.tick(S,300)');await render();await click('[data-command*="claimCraft"]');
  check('a crafted net lands in the original bag',await ev(`(S.bag.net||0)===${nets}+1`));await close();
  await ev('LivingWorld.tick(S,900)');await render();
  const busy=await fps();check('a developed home with production bubbles stays at 55 FPS',busy.fps>=55&&await ev(`document.querySelectorAll('[data-home-bubble]').length>=2`),busy);
  report(out,'performance.json',{viewport:'1440×900, DPR 1',sample:'2.5 s',renderer:await ev(`(()=>{const gl=document.createElement('canvas').getContext('webgl');const ext=gl?.getExtension('WEBGL_debug_renderer_info');return gl?(ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)):'WebGL unavailable';})()`),browser:await ev('navigator.userAgent'),forest,busy});

  // 7. 五种视口：季节栏、资源栏、工具栏互不重叠；研究面板完整在窗口内。
  for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900],[1920,1080]]){
   await size(width,height);await render();
   const g=await ev(`(()=>{const r=s=>document.querySelector(s).getBoundingClientRect(),list=['.home-season','.home-stock','.home-tools'].map(r),overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;return {overlap:list.some((a,i)=>list.some((b,j)=>i<j&&overlap(a,b))),inside:list.every(a=>a.left>=0&&a.right<=innerWidth),overflow:document.documentElement.scrollWidth>innerWidth};})()`);
   check(`${width}x${height} keeps the season, stock and tool bars apart and on screen`,!g.overlap&&g.inside&&!g.overflow,g);
   await click('[data-lw="panel"][data-panel="tech"]');
   const t=await ev(`(()=>{const p=document.querySelector('.home-tech-panel').getBoundingClientRect(),n=document.querySelector('.tabbar').getBoundingClientRect();return {left:p.left,right:p.right,top:p.top,bottom:p.bottom,nav:n.top,cards:document.querySelectorAll('.home-tech').length,w:innerWidth};})()`);
   check(`${width}x${height} research panel fits between the bars`,t.left>=0&&t.right<=t.w&&t.top>=0&&t.bottom<=t.nav+1&&t.cards>0,t);
   await b.shot(`${out}/research-${width}x${height}.png`);await close();
  }
  check('no browser exceptions or console errors',errors.length===0,errors);report(out,'results.json',{checks,errors});
 }catch(e){await b.shot(`${out}/failure.png`).catch(()=>{});report(out,'results.json',{checks,errors,failure:String(e)});throw e;}
 finally{await b.close();}
 console.log(`RESULT ${checks.length}/${checks.length} estate browser checks`);
})().catch(e=>{console.error(e);process.exitCode=1;});
