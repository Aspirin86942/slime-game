const {launch,fileUrl,sleep,waitFor}=require('./lib/cdp.js');
(async()=>{const b=await launch({url:'about:blank',width:1440,height:900,dpr:1,touchEnabled:true,gpu:true});const {ev,client}=b;try{
await client.send('Page.navigate',{url:fileUrl('史莱姆.html','?battle=ui')});await waitFor(()=>ev(`typeof S!=='undefined'&&S.started`),10000);
await ev(`document.querySelector('#selftestOut')?.remove();S.slimes=[createSlime(false),createSlime(false),createSlime(false)];S.slimes.forEach((s,i)=>s.name=['露露','芽芽','桃桃'][i]);S.theme='peach';applyTheme();S.world.clock=1200;for(const k of ['wood','stone','ingredient','herb','mushroom','fruit'])S.world.stock[k]=800;LivingWorld.execute(S,{type:'build',def:'kitchen',zone:0,x:10,y:8});switchTab('home');`);
for(const [width,height] of [[1440,900],[390,844],[320,568],[844,390]]){
 await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<760});
 await ev(`document.querySelector('[data-lw="close"]')?.click();document.querySelector('[data-panel="build"]').click();document.querySelector('[data-lw="inspect"][data-def="kitchen"]').click()`);await sleep(200);await b.shot(`tools/out/magic-ui/home-actions/orbit-${width}x${height}.png`);await ev(`document.querySelector('[data-lw="use"]').click()`);await sleep(80);await b.shot(`tools/out/magic-ui/home-actions/kitchen-${width}x${height}.png`);
 console.log(width,await ev(`(()=>{const p=document.querySelector('.home-object-panel'),s=S.world.placements.find(p=>p.def==='kitchen'),r=document.querySelector('[data-home-object="'+s.id+'"] image').getBoundingClientRect(),b=p.getBoundingClientRect();return {panel:[b.x,b.y,b.width,b.height],image:[r.x,r.y,r.width,r.height],scroll:p.querySelector('.home-panel-body').clientHeight}})()`));
 await ev(`document.querySelector('[data-lw="close"]').click();document.querySelector('[data-panel="build"]').click()`);await sleep(80);await b.shot(`tools/out/magic-ui/home-actions/catalog-${width}x${height}.png`);
}
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
