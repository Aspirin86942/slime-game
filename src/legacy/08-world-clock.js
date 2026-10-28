/* ==================== 世界时钟与离线收益 ==================== */
/* 每秒恢复体力/心情，每 12 秒一次派遣行动。在线计时器、后台补算、离线结算都走 advanceWorld，
   所以三种情况的收益规则一致；本作离线最多累计 12 小时。 */
const PLAN_INTERVAL = 12;
const OFFLINE_CAP_MS = 12 * 3600 * 1000;
const OFFLINE_MIN_MS = 60 * 1000;
function advanceWorld(seconds, silent){
  if(storageConflict || persistenceBlocked)return {coins:0,treasure:0,actions:0,exp:0,changed:false};
  if(S.saveVersion>=4)return LivingWorld.tick(S,seconds);
  LivingWorld.tickLegacy(S,seconds);
  const gains = {coins:0, treasure:0, actions:0, exp:0, changed:false};
  for(let i=0;i<seconds;i++){
    for(const s of S.slimes){ if(recoverPlanTick(s)) gains.changed = true; }
    S.planClock = (S.planClock + 1) % PLAN_INTERVAL;
    if(S.planClock === 0){
      const g = runPlans(silent);
      if(g){ gains.coins += g.coins; gains.treasure += g.treasure; gains.actions += g.actions; gains.exp += g.exp; }
    }
  }
  if(gains.actions || (S.started && seconds>0)) gains.changed = true;
  return gains;
}
function settleOffline(ms){
  const seconds = DIAGNOSTIC_MODE || !S.started ? 0 : Math.floor(clamp(Number(ms)||0, 0, OFFLINE_CAP_MS) / 1000);
  const before = new Map(S.slimes.map(s=>[s.id, s.level]));
  const g = advanceWorld(seconds, true);
  const leveled = S.slimes.filter(s=>before.has(s.id) && s.level > before.get(s.id))
    .map(s=>({name:s.name, from:before.get(s.id), to:s.level}));
  return {seconds, coins:g.coins, treasure:g.treasure, actions:g.actions, exp:g.exp, leveled};
}
function formatDuration(sec){
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
  return h ? `${h} 小时 ${m} 分` : `${Math.max(1, m)} 分钟`;
}
function offlineReportHTML(r){
  const lv = r.leveled.length ? `<p class="small">${r.leveled.map(x=>`${esc(x.name)} Lv.${x.from} → Lv.${x.to}`).join('<br>')}</p>` : '';
  return `<h3 style="text-align:center;margin:0 0 6px;">欢迎回来</h3>
    <p class="muted small" style="text-align:center;">离开 ${formatDuration(r.seconds)}${r.seconds*1000>=OFFLINE_CAP_MS?'（已达 12 小时上限）':''}，委托队伍完成 ${r.actions} 次探险</p>
    <div class="summon-stats"><div><small>晶币</small><b>+${r.coins}</b></div><div><small>天材地宝</small><b>+${r.treasure}</b></div><div><small>升级</small><b>${r.leveled.length}</b></div></div>
    <p class="small">单次委托的物资请在远行页领取。伙伴经验 +${r.exp}${S.breakPending?' · 召唤师已达突破等级，请到状态页突破。':''}</p>
    ${lv}<button class="btn gold full" data-act="close" style="margin-top:12px;">收下</button>`;
}

let lastRecoverySave=0;
let lastWorldTick=Date.now();
function tickWorld(silent){
  const now = Date.now(), gap = now - lastWorldTick;
  if(storageConflict || persistenceBlocked || saveRetryNeeded || !S.started || gap < 0){ lastWorldTick=now; return; }
  const seconds = Math.floor(gap / 1000);
  if(seconds < 1) return;
  lastWorldTick += seconds * 1000;
  /* 后台标签页的计时器会被浏览器节流，设备休眠也会停表：间隔超过 5 秒就按真实时间补算 */
  if(gap > 5000){
    const r = settleOffline(gap);
    if(r.actions && !silent) toast(`离开 ${formatDuration(r.seconds)}，派遣收获晶币 +${r.coins}${r.leveled.length?`，${r.leveled.length} 只伙伴升级`:''}`, 'good');
    save(); lastRecoverySave = now; renderTop(); updateLive();
    return;
  }
  const g = advanceWorld(seconds, silent);
  if(g.changed){
    updateLive();LivingWorld.paintResidents();
    if(now-lastRecoverySave>=10000){save();lastRecoverySave=now;if(['home','journey','companions'].includes(activeTab) && !document.querySelector('.lw-edit') && !['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)){LivingWorld.refresh();}}
  }
}
setInterval(()=>tickWorld(false), 1000);
window.addEventListener('pagehide', ()=>{ if(S.started){ tickWorld(true); save(); } });
document.addEventListener('visibilitychange', ()=>{
  if(!DIAGNOSTIC_MODE && S.started){ tickWorld(true); save(); }
});


LivingWorld.connect({
  state:()=>S, save:()=>save(), writable:()=>!storageConflict&&!persistenceBlocked&&!saveRetryNeeded, diagnostic:DIAGNOSTIC_MODE,
  render:()=>{renderTop();renderTab();}, toast:text=>toast(text),
  available:id=>{const s=S.slimes.find(s=>s.id===id);return !!s&&!hasExplorePlan(s)&&!document.getElementById('gameOverlay')&&!storageConflict&&!persistenceBlocked;},
  create:(element,name,personality)=>{const s=createSlime(false);s.element=element;s.name=name;s.personality=personality;s.skill=HEAL_ELEMENTS.includes(element)?'治疗':'元素弹';s.hp=hpMax(s);S.slimes.push(s);return s;},
  slimeHTML:s=>slimeHTML(s,{mood:'idle'}),
  open:page=>page.startsWith('detail:')?openDetail(Number(page.slice(7))):switchTab(page),
  play:(kind,id)=>{const s=S.slimes.find(s=>s.id===id);if(kind==='ball'&&s)startBallGame(s);else if(kind==='stack')startStackGame();},
  progress:events=>{for(const e of events){if(e.type==='income'){S.coins+=e.amount||0;S.totalEarned+=e.amount||0;}if(['feed','experience'].includes(e.type))for(const id of e.participants||[]){const s=S.slimes.find(s=>s.id===id);if(s)addExp(s,e.amount||0,true);}if(e.type==='pet')addTaskProgress('pet',1,true);if(e.type==='feed')addTaskProgress('feed',1,true);if(e.type==='collection'){addTaskProgress('rent',1,true);recordRegionExplore(Math.floor(Number(e.object)/2));}}}
});
