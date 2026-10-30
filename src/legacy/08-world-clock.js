/* The original recovery and dispatch rules share one clock with the home. */
let bulkSimulation=false;
let lastWorldTick=Date.now(),lastRecoverySave=0;
function canWrite(){return !persistenceBlocked&&!storageConflict&&!saveRetryNeeded;}
function advanceWorld(seconds,silent=false,includeHome=true){
  const gains={coins:0,treasure:0,actions:0,exp:0,changed:false};
  if(!canWrite()||!S.started||!Number.isFinite(seconds)||seconds<=0)return gains;
  seconds=Math.min(43200,Math.floor(seconds));
  const beforeCoins=S.coins,beforeTreasure=S.bag.treasure||0;
  const previous=bulkSimulation;bulkSimulation=true;
  try{
    for(let i=0;i<seconds;i++){
      for(const s of S.slimes)recoverPlanTick(s);
      S.planClock=((S.planClock||0)+1)%12;
      if(S.planClock===0)runPlans(silent);
      if(includeHome){if(S.world?.version===5)LivingWorld.tick(S,1);else LivingWorld.tickLegacy(S,1);}
    }
  }finally{bulkSimulation=previous;}
  gains.coins=S.coins-beforeCoins;gains.treasure=(S.bag.treasure||0)-beforeTreasure;gains.changed=true;return gains;
}
function settleOffline(ms){
  const seconds=Math.floor(clamp(Number(ms)||0,0,43200000)/1000);
  if(!canWrite()||!S.started||seconds<=0)return;
  const previous=bulkSimulation;bulkSimulation=true;
  try{return LivingWorld.tick(S,seconds);}finally{bulkSimulation=previous;}
}
function tickWorld(){
  const now=Date.now(),seconds=Math.floor((now-lastWorldTick)/1000);
  if(!S.started||!canWrite()||seconds<0){lastWorldTick=now;return;}
  if(seconds<1)return;lastWorldTick+=seconds*1000;
  if(seconds>1)settleOffline((seconds-1)*1000);
  advanceWorld(1);updateLive();if(activeTab==='home')LivingWorld.paintResidents();
  if(now-lastRecoverySave>=10000){save();lastRecoverySave=now;if(activeTab==='home')LivingWorld.refresh();}
}
setInterval(tickWorld,1000);
window.addEventListener('pagehide',()=>{if(S.started){tickWorld();save();}});
document.addEventListener('visibilitychange',()=>{if(S.started&&!DIAGNOSTIC_MODE){tickWorld();save();}});
LivingWorld.connect({
  state:()=>S,save:()=>save(),writable:canWrite,diagnostic:DIAGNOSTIC_MODE,
  render:()=>{renderTop();renderTab();},toast:text=>toast(text),
  available:id=>{const s=getSlime(id);return !!s&&!hasExplorePlan(s)&&canWrite();},
  create:(element,name,personality)=>{const s=createSlime(false);s.element=element;s.name=name;s.personality=personality;S.slimes.push(s);return s;},
  slimeHTML:s=>slimeHTML(s,{mood:'idle'}),
  open:page=>page.startsWith('detail:')?openDetail(Number(page.slice(7))):switchTab(page),
  play:(kind,id)=>{const s=getSlime(id);if(kind==='ball'&&s)startBallGame(s);else if(kind==='stack')startStackGame();},
  progress:events=>{for(const e of events){if(e.type==='income'){S.coins+=e.amount||0;S.totalEarned+=e.amount||0;}if(e.type==='points')S.points+=e.amount||0;if(['experience','feed'].includes(e.type))for(const id of e.participants||[]){const s=getSlime(id);if(s)addExp(s,e.amount||0);}if(e.type==='pet')addTaskProgress('pet',1);if(e.type==='feed')addTaskProgress('feed',1);if(e.type==='collection'){addTaskProgress('rent',1);recordRegionExplore(Math.floor(Number(e.object)/2));}}}
});
