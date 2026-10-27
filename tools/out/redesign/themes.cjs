// 浅色主题与窄屏下的家园截图。用法：node tools/out/redesign/themes.cjs
'use strict';
const path=require('node:path');const {launch,sleep,waitFor,fileUrl}=require('../lib/cdp.js');
const ROOT=path.resolve(__dirname,'..','..','..');const OUT=path.join(__dirname,'after');
(async()=>{const p=await launch({url:fileUrl(path.join(ROOT,'史莱姆.html'),'?battle=ui'),width:390,height:844,dpr:2,touchEnabled:true});
 try{await waitFor(()=>p.ev('!!window.__TEST__'),15000);
  await p.ev(`(()=>{const T=window.__TEST__;T.startBattle({elements:['岩','水','草'],level:20,monsterLevel:14,speed:1,seed:7});T._battle.closeBattle();S.slimes.forEach((s,i)=>s.name=['小石头','涌泉','青藤'][i]);return true})()`);
  for(const th of ['peach','light']){await p.ev(`S.theme='${th}';applyTheme();switchTab('world');true`);await sleep(400);await p.shot(path.join(OUT,'theme-'+th+'-world.png'));
   await p.ev(`document.querySelector('[data-lw="tab"][data-tab="explore"]').click();true`);await sleep(300);await p.shot(path.join(OUT,'theme-'+th+'-explore.png'));
   await p.ev(`document.querySelector('[data-lw="tab"][data-tab="home"]').click();switchTab('space');true`);await sleep(300);await p.shot(path.join(OUT,'theme-'+th+'-space.png'));}
  await p.ev(`S.theme='sunset';applyTheme();true`);
  await p.client.send('Emulation.setDeviceMetricsOverride',{width:320,height:667,deviceScaleFactor:2,mobile:true});
  for(const t of ['home','nursery','explore']){await p.ev(`switchTab('world');document.querySelector('[data-lw="tab"][data-tab="${t}"]').click();true`);await sleep(300);
   const of=await p.ev(`[...document.querySelectorAll('#content *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&!e.closest('.lw-zone-nav,.lw-nav,.lw-scene-wrap')}).map(e=>e.className).slice(0,5)`);
   console.log(t,'overflow',JSON.stringify(of));await p.shot(path.join(OUT,'w320-'+t+'.png'));}
  await p.ev(`switchTab('bag');true`);await sleep(300);await p.shot(path.join(OUT,'w320-bag.png'));
 }finally{await p.close();}})();
