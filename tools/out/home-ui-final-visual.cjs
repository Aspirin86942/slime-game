const assert=require('node:assert/strict');
const {launch,fileUrl,waitFor,sleep,report}=require('./lib/cdp.js');
(async()=>{const b=await launch({url:'about:blank',width:390,height:844,dpr:1,touchEnabled:true,gpu:true});const {ev,client}=b;try{
 await client.send('Page.navigate',{url:fileUrl('史莱姆.html','?battle=ui')});assert.ok(await waitFor(()=>ev(`typeof S!=='undefined'&&S.started`),10000));
 await ev(`document.querySelector('#selftestOut')?.remove();S.slimes=[createSlime(false),createSlime(false)];S.slimes.forEach((s,i)=>s.name=['露露','芽芽'][i]);S.theme='peach';applyTheme();S.world.clock=1200;for(const k of ['wood','stone','ingredient','fruit'])S.world.stock[k]=800;LivingWorld.execute(S,{type:'build',def:'kitchen',zone:0,x:10,y:8});switchTab('home');document.querySelector('[data-panel="build"]').click();document.querySelector('[data-lw="inspect"][data-def="kitchen"]').click();`);
 await sleep(180);await b.shot('tools/out/magic-ui/home-actions/final-orbit.png');
 await ev(`document.querySelector('[data-lw="close"]').click();document.querySelector('[data-panel="build"]').click()`);await sleep(100);await b.shot('tools/out/magic-ui/home-actions/final-catalog.png');
 await ev(`document.querySelector('[data-def="alchemy"]').click()`);
 const point=await ev(`(()=>{const p=new DOMPoint(10.5*48,10.5*48).matrixTransform(document.querySelector('.home-map').getScreenCTM());return {x:p.x,y:p.y}})()`);
 await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await sleep(100);
 const controls=await ev(`(()=>{const e=document.querySelector('.home-camera button'),s=getComputedStyle(e);return {background:s.backgroundColor,blur:s.backdropFilter,valid:!document.querySelector('.home-placement-status.invalid'),preview:!!document.querySelector('.home-placement-ghost image')};})()`);
 assert.ok(controls.background.includes('0.86')&&controls.blur.includes('blur(16px)')&&controls.preview&&controls.valid);
 await b.shot('tools/out/magic-ui/home-actions/final-placement.png');report('tools/out/magic-ui/home-actions','final-visual.json',{controls,ok:true});console.log('Final visual checks passed');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
