'use strict';
const path=require('node:path'),assert=require('node:assert/strict');
const {launch,waitFor,report,fileUrl}=require('../tools/out/lib/cdp.js');
(async()=>{
 const p=await launch({url:fileUrl(path.resolve('史莱姆.html'),'?battle=ui'),width:390,height:844,dpr:1,gpu:true});
 const results={browser:'Headless Chrome',gpuDisabled:false,viewport:'390×844, DPR 1',samples:[]};
 try{
  assert.ok(await waitFor(()=>p.ev('typeof S!=="undefined"&&typeof LivingWorld!=="undefined"'),10000));
  results.renderer=await p.ev(`(()=>{const gl=document.createElement('canvas').getContext('webgl');if(!gl)return 'WebGL unavailable';const ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);})()`);
  await p.ev(`S.started=true;S.globalPlan=null;S.customPlans={};S.slimes=Array.from({length:12},(_,i)=>{const s=createSlime(false);s.name=['芽芽','汐汐','烬团','苔石','铃霜','夜灯','跳跳','星眠','团团','小叶','阿露','点点'][i];return s;});S.world=LivingWorld.createWorld();S.world.stock.wood=500;S.world.stock.stone=500;S.world.stock.dew=500;document.getElementById('storyScreen').classList.add('hidden');document.getElementById('gameScreen').classList.remove('hidden');switchTab('world');true`);
  for(const stress of [false,true]){
   if(stress)await p.ev(`(()=>{for(let y=0;y<12;y++)for(let x=0;x<12;x++){const v=S.world.cultivars[(x+y*12)%30];v.seeds=50;const r=LivingWorld.execute(S,{type:'plant',cultivar:v.id,zone:0,x,y,explicit:true});}S.world.crops.forEach(c=>c.progress=1);renderTab();return S.world.crops.length;})()`);
   for(let n=0;n<3;n++){
    const data=await p.ev(`new Promise(resolve=>{const gaps=[];let last=0,start=0;function frame(now){if(!start){start=now;last=now;}else{gaps.push(now-last);last=now;}if(now-start<${stress?3000:6000})requestAnimationFrame(frame);else{const sorted=[...gaps].sort((a,b)=>a-b);resolve({fps:Number((1000*gaps.length/(now-start)).toFixed(1)),p95:sorted[Math.floor(sorted.length*.95)],max:Math.max(...gaps),frames:gaps.length,plants:S.world.crops.length});}}requestAnimationFrame(frame);})`);
    results.samples.push({scene:stress?'full-garden':'garden',...data});
   }
   if(stress)await p.shot(path.resolve('tools/out/shots/world-full-garden.png'));
  }
  const med=rows=>rows.map(r=>r.fps).sort((a,b)=>a-b)[1];results.gardenMedian=med(results.samples.filter(r=>r.scene==='garden'));results.fullGardenMedian=med(results.samples.filter(r=>r.scene==='full-garden'));
  assert.ok(results.gardenMedian>=55,'normal garden >= 55 fps');assert.ok(results.fullGardenMedian>=30,'full garden >= 30 fps');console.log(JSON.stringify(results,null,2));
 }catch(e){results.error=e.message;process.exitCode=1;console.error(e);}
 finally{report('tools/out','world-performance.json',results);await p.close();}
})();
