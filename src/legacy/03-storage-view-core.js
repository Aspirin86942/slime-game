const DIAGNOSTIC_MODE=/(?:^|[?&])(selftest|gallery|battle|fps)(?:=|&|$)/.test(location.search||'');
const SAVE_KEY = 'slimeSummonerSave';
const SAVE_BACKUP_KEY = 'slimeSummonerSave_v1_backup';
const SAVE_V4_BACKUP_KEY='slimeSummonerSave_v4_backup';
const SAVE_V3_BACKUP_KEY='slimeSummonerSave_v3_backup';
let saveRetryNeeded=false;
const SAVE_V2_BACKUP_KEY = 'slimeSummonerSave_v2_backup';
let saveSnapshot;
let storageConflict=false;
function storageNotice(message){
  persistenceWarning=message;
  let banner=document.getElementById('saveProtectionBanner');
  if(!banner){banner=document.createElement('div');banner.id='saveProtectionBanner';banner.className='save-protection-banner';document.body.appendChild(banner);}
  banner.innerHTML=esc(message)+(storageConflict?' <button data-act="reloadSave">重新加载</button>':saveRetryNeeded?' <button data-act="retrySave">重试保存</button>':'');
}
window.addEventListener('storage',e=>{if(!DIAGNOSTIC_MODE && e.key===SAVE_KEY && e.newValue!==saveSnapshot){storageConflict=true;storageNotice('另一个页面更新了存档。本页已停止推进，请重新加载后继续。');}});
let persistenceWarning = '';
let persistenceBlocked = false;
const SAVE_DEFAULTS=JSON.parse(JSON.stringify(S));
function validSaveData(d){
  if(!d || typeof d !== 'object' || Array.isArray(d) || typeof d.started!=='boolean' || !Array.isArray(d.slimes)) return false;
  const safeTree=value=>{
    if(!value || typeof value!=='object') return true;
    return Object.keys(value).every(k=>!['__proto__','prototype','constructor'].includes(k) && safeTree(value[k]));
  };
  if(!safeTree(d)) return false;
  if(d.saveVersion!==undefined&&![1,2,3,4,5].includes(d.saveVersion) || (d.saveVersion>=3 && (!d.world||d.world.version!==d.saveVersion))) return false;
  if(d.saveVersion>=4 && ['bag','feedTrough'].some(k=>Object.prototype.hasOwnProperty.call(d,k))) return false;
  if(d.world!==undefined && !LivingWorld.validWorld(d.world,d.slimes.map(s=>s.id))) return false;
  const number=(obj,k,min=0,integer=false)=>obj[k]===undefined || (typeof obj[k]==='number' && Number.isFinite(obj[k]) && obj[k]>=min && (!integer || Number.isInteger(obj[k])));
  for(const k of ['coins','points','summonerExp','totalEarned','feedTrough','stackRecord','lastActive']) if(!number(d,k)) return false;
  for(const k of ['level','abyssLevel','abyssUnlocked','seq']) if(!number(d,k,1,true)) return false;
  for(const k of ['nameSeq','exploreMapIndex','saveVersion','summonPity','sweepUsed','planClock']) if(!number(d,k,0,true)) return false;
  if(d.planClock !== undefined && d.planClock >= 12) return false;
  if(d.monsters !== undefined && !Array.isArray(d.monsters)) return false;
  for(const k of ['bag','tasks','taskClaimed','customPlans','progress']) if(d[k]!==undefined && (!d[k] || typeof d[k]!=='object' || Array.isArray(d[k]))) return false;
  if(d.bag && !Object.values(d.bag).every(v=>typeof v==='number' && Number.isFinite(v) && v>=0)) return false;
  if(d.progress){
    for(const key of ['abyssClears','challengeClears','regions','collected','claimed']){
      const record=d.progress[key];
      if(record!==undefined && (!record || typeof record!=='object' || Array.isArray(record))) return false;
      if(record && !Object.values(record).every(v=>key==='regions' ? typeof v==='number' && Number.isFinite(v) && v>=0 : typeof v==='boolean')) return false;
    }
  }

  const ids=new Set();
  return [...d.slimes,...(d.monsters||[])].every(s=>{
    if(!s || typeof s!=='object' || Array.isArray(s) || !Number.isInteger(s.id) || s.id<1 || ids.has(s.id) || typeof s.name!=='string' || !Object.prototype.hasOwnProperty.call(ELEMENTS,s.element)) return false;
    ids.add(s.id);
    if(!number(s,'level',1,true) || !number(s,'size',0.001)) return false;
    for(const k of ['strPotential','agiPotential','magPotential','luck','wit','str','agi','mag','mood','stamina','hp','exp','intimacy','mergeCount']) if(!number(s,k)) return false;
    if(!number(s,'morality',-100)) return false;
    if(s.traits!==undefined && (!Array.isArray(s.traits) || !s.traits.every(t=>t && typeof t==='object' && typeof t.n==='string' && typeof t.k==='string' && typeof t.v==='number' && Number.isFinite(t.v)))) return false;
    return true;
  });
}
function getAbyssUnlocked(){ return clamp(Math.floor(Number(S.abyssUnlocked)||1),1,50); }
function getAbyssLevel(){ S.abyssLevel=clamp(Math.floor(Number(S.abyssLevel)||1),1,getAbyssUnlocked()); return S.abyssLevel; }
function save(){
  if(DIAGNOSTIC_MODE || bulkSimulation) return true; // Preview/self-tests must never overwrite a player's real save.
  if(persistenceBlocked || storageConflict) return false;
  try{
    const current=localStorage.getItem(SAVE_KEY);
    if(saveSnapshot!==undefined && current!==saveSnapshot){storageConflict=true;storageNotice('另一个页面更新了存档。本页已停止推进，请重新加载后继续。');return false;}
    LivingWorld.ensure(S);LivingWorld.reconcile(S);S.saveVersion=5;S.lastActive=Math.max(Number(S.lastActive)||0,Date.now());
    const raw=JSON.stringify(S);localStorage.setItem(SAVE_KEY,raw);saveSnapshot=raw;saveRetryNeeded=false;
    const banner=document.getElementById('saveProtectionBanner');if(banner)banner.remove();return true;
  }catch(e){saveRetryNeeded=true;storageNotice('存储空间不足或浏览器禁止存档。进度暂存在本页，请不要关闭页面。');return false;}
}

function load(){
  const previous=JSON.stringify(S);
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    saveSnapshot=raw;storageConflict=false;
    if(!raw) return false;
    const d = JSON.parse(raw);
    if(!validSaveData(d)) throw new Error('存档结构无效');
    const fromVersion=Number(d.saveVersion)||1;
    if(!DIAGNOSTIC_MODE&&fromVersion<5){
      for(const base of [[SAVE_BACKUP_KEY,SAVE_V2_BACKUP_KEY,SAVE_V3_BACKUP_KEY,SAVE_V4_BACKUP_KEY][fromVersion-1]]){
        let key=base,index=0;while(localStorage.getItem(key)!==null&&localStorage.getItem(key)!==raw)key=base+'_'+Date.now()+'_'+(++index);
        if(localStorage.getItem(key)!==raw)localStorage.setItem(key,raw);
        if(localStorage.getItem(key)!==raw)throw new Error('原始存档备份未成功');
      }
    }
    delete S.bag;delete S.feedTrough;Object.keys(S).forEach(k=>delete S[k]);
    Object.assign(S,JSON.parse(JSON.stringify(SAVE_DEFAULTS)),d);
    const clears=d.progress && d.progress.abyssClears;
    let proven=1;
    if(clears && typeof clears==='object') Object.keys(clears).forEach(k=>{ if(clears[k]) proven=Math.max(proven,Math.min(50,(Number(k)||0)+1)); });
    S.abyssUnlocked=clamp(Math.floor(Number(d.abyssUnlocked)||proven),1,50);
    const oldSelected=Number(S.abyssLevel)||1;
    getAbyssLevel();S.saveVersion=fromVersion;if(fromVersion<3&&!d.world)S.world=LivingWorld.createWorld();
    persistenceBlocked=false;
    persistenceWarning=oldSelected>S.abyssUnlocked ? '旧档已安全备份：旧版任意选择层数不是通关记录，深渊按胜利逐层解锁。伙伴、属性和资源全部保留。' : '';
    if(!S.customPlans) S.customPlans = {};
    if(S.globalPlan === undefined) S.globalPlan = null;
    if(typeof S.summonerExp !== 'number') S.summonerExp = 0;
    if(typeof S.breakPending !== 'boolean') S.breakPending = false;
    if(typeof S.feedTrough !== 'number') S.feedTrough = 0;
    if(typeof S.points !== 'number') S.points = 0;
    if(typeof S.taskDate !== 'string') S.taskDate = '';
    if(S.battleMode !== 'auto' && S.battleMode !== 'interject' && S.battleMode !== 'step') S.battleMode = 'auto';
    if(!S.tasks) S.tasks = {rent:0, summon:0, feed:0};
    if(!S.taskClaimed) S.taskClaimed = {rent:false, summon:false, feed:false};
    if(fromVersion<4&&!S.bag) S.bag = {food:0,treasure:0,ticket:0,expPotion:0,net:0};
    if(fromVersion>=4)LivingWorld.attachLegacyInventory(S);
    if(typeof S.bag.expPotion !== 'number') S.bag.expPotion = 0;
    if(typeof S.bag.net !== 'number') S.bag.net = 0;
    if(fromVersion>=4)LivingWorld.attachLegacyInventory(S);
    if(!S.monsters) S.monsters = [];
    if(!Array.isArray(S.lastAbyssSel)) S.lastAbyssSel = [];
    if(typeof S.nameSeq !== 'number') S.nameSeq = 0;
    if(typeof S.exploreMapIndex !== 'number') S.exploreMapIndex = 0;
    if(S.exploreMapIndex < 0 || S.exploreMapIndex >= MAP_THEMES.length) S.exploreMapIndex = 0;
    if(!Array.isArray(S.monItemConfigs) || !S.monItemConfigs.length){
      S.monItemConfigs = defaultMonItems();
      if(Array.isArray(S.monItemLabels)){
        S.monItemLabels.forEach((l,i)=>{
          if(l && S.monItemConfigs[i]) S.monItemConfigs[i].label = l;
        });
      }
    }
    delete S.monItemLabels;
    if(!S.spaceMode) S.spaceMode = 'free';
    if(typeof S.abyssLevel !== 'number') S.abyssLevel = 1;
    if(!THEMES.some(t=>t.id===S.theme)) S.theme = 'sunset';
    if(S.exploreTeam !== null && !Array.isArray(S.exploreTeam)) S.exploreTeam = null;
    if(typeof S.stackRecord !== 'number') S.stackRecord = 0;
    if(typeof S.battleSpeed !== 'number' || S.battleSpeed < 1) S.battleSpeed = 1;

    if(S.globalPlan === 'rent') S.globalPlan = 'explore';
    Object.keys(S.customPlans).forEach(id=>{
      if(S.customPlans[id] && S.customPlans[id].type === 'rent') S.customPlans[id].type = 'explore';
    });

    delete S.slots;
    (S.slimes||[]).forEach(s=>normalizeSlime(s));
    (S.monsters||[]).forEach(s=>{
      normalizeSlime(s);
      s.isMonster = true;
      if(typeof s.monSat !== 'number') s.monSat = rnd(18,58);
      if(typeof s.monLight !== 'number') s.monLight = rnd(14,34);
      if(typeof s.hp !== 'number') s.hp = hpMax(s);
    });
    S.seq=Math.max(S.seq||1,...[...S.slimes,...S.monsters].map(s=>s.id+1));
    if(fromVersion<5){
      const away=!DIAGNOSTIC_MODE&&S.started&&S.lastActive>0?Math.floor(clamp(Date.now()-S.lastActive,0,43200000)/1000):0;
      LivingWorld.prepareLegacy(S);
      bulkSimulation=true;
      try{if(away){if(fromVersion===4)LivingWorld.tick(S,away);else advanceWorld(away,true,fromVersion>=3);}}finally{bulkSimulation=false;}
      if(fromVersion<4&&S.world.version<4)LivingWorld.upgradeWorld(S.world,S.slimes,fromVersion,Date.now());
      LivingWorld.upgradeHome(S.world,S.slimes);S.saveVersion=5;LivingWorld.attachLegacyInventory(S);
      if(fromVersion===4&&Array.isArray(S.legacyTeamPreset))S.exploreTeam=S.legacyTeamPreset.slice();
      LivingWorld.flushPayments(S);S.lastActive=Date.now();S.planClock=Number(S.planClock)||0;
    }else{LivingWorld.ensure(S);S.world.activities={};}
    if(!LivingWorld.validWorld(S.world,S.slimes.map(s=>s.id)))throw new Error('迁移后的存档无效');
    if(fromVersion<5&&!DIAGNOSTIC_MODE&&!save())throw new Error('迁移无法保存');
    return true;
  }catch(e){
    const restored=JSON.parse(previous); delete S.bag;delete S.feedTrough;Object.keys(S).forEach(k=>delete S[k]); Object.assign(S,restored);LivingWorld.ensure(S);
    persistenceBlocked=true; persistenceWarning='现有存档无法安全读取，已停止自动写入以保护原始数据。';
    return false;
  }
}

function normalizeSlime(s){
  delete s.hunger;
  if(typeof s.locked !== 'boolean') s.locked = false;
  if(!Number.isFinite(s.mergeCount) || s.mergeCount < 0) s.mergeCount = 0;
  else s.mergeCount = Math.floor(s.mergeCount);
  if(s.resting === undefined) s.resting = false;
  if(typeof s.mood !== 'number') s.mood = 70;
  if(typeof s.size !== 'number') s.size = 1;
  if(typeof s.intimacy !== 'number') s.intimacy = 0;
  // Fill each absent legacy field independently; never overwrite a present potential/stat.
  for(const key of ['strPotential','agiPotential','magPotential']) if(typeof s[key]!=='number') s[key]=10;
  if(typeof s.luck !== 'number') s.luck = 0;
  if(typeof s.wit !== 'number') s.wit = 0;
  if(typeof s.level !== 'number') s.level = 1;
  if(typeof s.exp !== 'number') s.exp = 0;
  if(typeof s.morality !== 'number') s.morality = 0;
  const lv = s.level;
  if(typeof s.str !== 'number') s.str = growthStat(s.strPotential, lv);
  if(typeof s.agi !== 'number') s.agi = growthStat(s.agiPotential, lv);
  if(typeof s.mag !== 'number') s.mag = growthStat(s.magPotential, lv);
  const stMax = staminaMax(s);
  if(typeof s.stamina !== 'number') s.stamina = stMax;
  s.stamina = clamp(s.stamina, 0, stMax);
  if(typeof s.hp !== 'number' || s.hp <= 0) s.hp = hpMax(s);
  if(!s.traits) s.traits = [];
  s.traits.forEach(refreshTraitDesc);
  if(!s.personality) s.personality = pick(PERSONALITIES);
  if(s.isMonster){
    if(typeof s.monSat !== 'number') s.monSat = rnd(18,58);
    if(typeof s.monLight !== 'number') s.monLight = rnd(14,34);
  }
  if(!s.skill){
    s.skill = HEAL_ELEMENTS.includes(s.element) ? '治疗' : '元素弹';
  }
  return s;
}

function applyWaveMasks(){
  const gSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 100' preserveAspectRatio='none'><path d='M0,28 C6,20 12,34 22,26 C30,19 36,38 48,30 C56,24 62,36 74,26 C82,20 90,32 100,24 C108,18 116,34 128,28 C136,23 144,36 156,26 C164,18 172,34 184,26 C190,22 196,28 200,26 L200,100 L0,100 Z' fill='#ffffff'/></svg>`;
  const sSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 100' preserveAspectRatio='none'><path d='M0,32 C10,24 18,40 30,32 C42,24 50,42 64,34 C76,26 86,42 98,34 C110,26 120,40 134,30 C146,22 156,38 168,30 C180,22 190,34 200,30 L200,100 L0,100 Z' fill='#ffffff'/></svg>`;
  document.documentElement.style.setProperty('--grass-mask', `url("data:image/svg+xml;utf8,${encodeURIComponent(gSvg)}")`);
  document.documentElement.style.setProperty('--soil-mask', `url("data:image/svg+xml;utf8,${encodeURIComponent(sSvg)}")`);
}

function applyTheme(){
  $('#app').dataset.theme = S.theme;
  document.querySelectorAll('.theme-btn').forEach(b=>b.classList.toggle('on', b.dataset.theme===S.theme));
}

function checkDailyReset(){
  const today = todayKey();
  if(S.taskDate !== today){
    S.taskDate = today;
    S.tasks = {rent:0, summon:0, feed:0};
    S.taskClaimed = {rent:false, summon:false, feed:false};
    save();
  }
}
function addTaskProgress(key, n){
  checkDailyReset();
  S.tasks[key] = (S.tasks[key]||0) + n;
  if(!S.taskClaimed[key]){
    const def = TASK_DEFS[key];
    if(S.tasks[key] >= def.need){
      S.taskClaimed[key] = true;
      S.points += def.reward;
      toast(`系统任务完成：${def.name}\n获得 ${def.reward} 系统积分`, 'good');
      save();
      renderTop();
      if(activeTab==='status') renderTab();
    }
  }
}

function calcTalent(s){
  return s.strPotential + s.agiPotential + s.magPotential + (s.luck||0) + (s.wit||0) + Math.round(20 * s.size);
}

function slimeColor(s){
  if(s.colorOverride) return s.colorOverride;
  if(s.isMonster){
    if(typeof s.monSat !== 'number') s.monSat = rnd(18,58);
    if(typeof s.monLight !== 'number') s.monLight = rnd(14,34);
    return {h: ELEMENTS[s.element] ? ELEMENTS[s.element].h : 280, s:s.monSat, l:s.monLight};
  }
  const el = ELEMENTS[s.element] || ELEMENTS['空间'];
  const talent = calcTalent(s);
  const h = el.h;
  const sat = clamp((44 + talent*0.34) * el.sat, 12, 96);
  let lig = clamp(38 + (s.morality+100)/200*20 + talent*0.09, 20, 84);
  if(s.element === '暗') lig = clamp(lig - 28, 6, 34);
  return {h, s:sat, l:lig};
}
function eyeColor(s){
  if(s.isMonster) return {h: ELEMENTS[s.element] ? ELEMENTS[s.element].h : 280, s:10, l:50};
  const c = slimeColor(s);
  if(s.element === '暗') return {h:c.h, s:Math.min(c.s*.7,60), l:24};
  return {h:c.h, s:Math.min(c.s*.85,80), l:20};
}

function slimeHTMLFromColor(c,e,opts={}){
  const sz = opts.sz || 1;
  const ghost = (opts.element === '时间' || opts.element === '空间') ? 1 : 0;
  const dead = opts.dead ? 1 : 0;
  return `<div class="slime" data-mood="${opts.mood||'idle'}" data-dead="${dead}" data-ghost="${ghost}" data-el="${opts.element||'sys'}"
    style="--h:${c.h};--s:${c.s.toFixed(1)}%;--l:${c.l.toFixed(1)}%;--eh:${e.h};--es:${e.s.toFixed(1)}%;--el:${e.l}%;--sz:${sz.toFixed(2)}">
    <div class="shadow"></div>
    <div class="anim">
      <div class="breath">
        <div class="blob outer"></div>
        <div class="blob inner"></div>
        <div class="eyes"><div class="eye"></div><div class="eye"></div></div>
        <div class="mark"></div>
        <div class="fx"></div>
      </div>
      <div class="halo"><span class="fh fh1">🌸</span><span class="fh fh2">✿</span></div>
    </div>
    ${opts.traitBadge ? '<div class="mon-badge">!</div>' : ''}
  </div>`;
}
function slimeHTML(s,opts={}){
  const sz = clamp(s.size || 1, 0.6, 1.6);
  const dead = (opts.dead !== undefined ? opts.dead : (s.hp !== undefined && s.hp <= 0));
  if(s && s.isSystem){
    return slimeHTMLFromColor(
      {h:S.sysLook.h, s:S.sysLook.s, l:S.sysLook.l},
      {h:S.sysLook.eh, s:S.sysLook.es, l:S.sysLook.el},
      {mood:opts.mood, sz, dead:false, traitBadge:!!opts.traitBadge}
    );
  }
  return slimeHTMLFromColor(slimeColor(s), eyeColor(s), {
    ...opts, sz, dead, element: s.element,
    traitBadge: !!opts.traitBadge
  });
}
function lookHTML(look,opts={}){
  return slimeHTMLFromColor({h:look.h,s:look.s,l:look.l},{h:look.eh,s:look.es,l:look.el},{...opts, sz:1});
}

function traitBonus(s,key){
  if(!s.traits) return 0;
  return s.traits.filter(t=>t.k===key).reduce((a,t)=>a+t.v, 0);
}

function slimeExpNeed(level){ return 100 + level*80; }

function addSummonerExp(amount){
  if(S.breakPending) return;
  if(amount <= 0) return;
  S.summonerExp += amount;
  let guard = 0;
  while(S.summonerExp >= summonerNeed(S.level) && guard++ < 100){
    S.summonerExp -= summonerNeed(S.level);
    S.level++;
    if(S.level % 10 === 0){
      S.breakPending = true;
      S.summonerExp = 0;
      toast(`👑 召唤师达到 Lv.${S.level}！\n需要手动突破才能继续升级`, 'good');
      break;
    }
  }
}

function getPlan(id){
  if(LivingWorld.isBusy(S,id)) return null;
  if(S.customPlans[id]) return S.customPlans[id];
  if(S.globalPlan) return {type:S.globalPlan, global:true};
  return null;
}
function isDispatched(s){
  const plan = getPlan(s.id);
  if(!plan) return false;
  if(s.resting) return false;
  if(plan.global && plan.type === 'explore' && S.exploreTeam !== null){
    return S.exploreTeam.includes(s.id);
  }
  return true;
}

/* ==================== 探险物品系统 ==================== */
function stopExploreItems(){
  exploreRunning = false;
  if(exploreRAF){ cancelAnimationFrame(exploreRAF); exploreRAF = null; }
  if(exploreSpawnTimer){ clearInterval(exploreSpawnTimer); exploreSpawnTimer = null; }
  exploreItems = [];
  exploreLayer = null;
  exploreLastT = 0;
}

function startExploreItems(){
  stopExploreItems();
  const scene = document.querySelector('.explore-scene');
  if(!scene) return;
  /* 没有史莱姆在探险时，不生成任何物品 */
  if(!S.slimes.some(s=>isDispatched(s))) return;
  let layer = scene.querySelector('.explore-items-layer');
  if(!layer){
    layer = document.createElement('div');
    layer.className = 'explore-items-layer';
    scene.appendChild(layer);
  }
  exploreLayer = layer;
  exploreItems = [];
  exploreLastT = 0;
  exploreRunning = true;

  exploreSpawnTimer = setInterval(()=>{
    if(!exploreRunning) return;
    if(!layer.isConnected){ stopExploreItems(); return; }
    spawnExploreItem(layer);
  }, 5000 + Math.random()*4000);

  exploreRAF = requestAnimationFrame(function loop(t){
    if(!exploreRunning) return;
    if(!exploreLastT) exploreLastT = t;
    const dt = Math.min(0.05, (t - exploreLastT)/1000);
    exploreLastT = t;
    updateExploreItems(dt);
    exploreRAF = requestAnimationFrame(loop);
  });
}

function makeExploreMonster(){
  const lv = 1 + Math.floor(Math.random()*10);
  const element = pick(ELEMENT_KEYS);
  const strPot = rndInt(12,26), agiPot = rndInt(12,26), magPot = rndInt(12,26);
  const luck = rndInt(3,14), wit = rndInt(3,14);
  const size = +(0.66 + Math.random()*0.34).toFixed(2);
  const mon = {
    id: -1, name: `${element}魔物`, element, isMonster:true, level:lv, size,
    str: strPot*lv, agi: agiPot*lv, mag: magPot*lv,
    strPotential:strPot, agiPotential:agiPot, magPotential:magPot,
    luck, wit, personality:'调皮', morality:-50, traits:[],
    monSat: rnd(18,58), monLight: rnd(14,34),
    stamina:100, mood:50, intimacy:0, resting:false, exp:0
  };
  mon.hp = hpMax(mon);
  return mon;
}

function spawnExploreItem(layer){
  if(!layer || !layer.isConnected) return;
  const r = Math.random();
  let type;
  if(r < 0.40) type = 'coin';
  else if(r < 0.60) type = 'exp';
  else if(r < 0.80) type = 'food';
  else if(r < 0.88) type = 'point';
  else if(r < 0.96) type = 'monster';
  else type = 'treasure';

  const el = document.createElement('div');
  el.className = 'explore-item explore-item-' + type;
  const x = 100;
  const y = 67 + Math.random()*13;
  el.style.left = x + '%';
  el.style.top = y + '%';

  let monster = null;
  let value = 0;

  if(type === 'monster'){
    monster = makeExploreMonster();
    const scale = 0.18;
    const w = 26, h = 22;
    const isJump = Math.random() < 0.5;
    el.innerHTML = `<div class="explore-slime explore-monster ${isJump?'jumping':'walking'}"
      style="width:${w}px;height:${h}px;--ex-scale:${scale};--delay:0s;"
      data-next-toggle="0">
      ${slimeHTML(monster,{mood:'idle'})}
    </div>`;
  } else {
    const icons = {coin:'coin',exp:'potion',food:'food',point:'star',treasure:'gem'};
    el.innerHTML = `<span class="ei-icon">${uiIcon(icons[type])}</span>`;
    if(type==='coin') value = rndInt(30,80);
    else if(type==='exp') value = rndInt(20,50);
    else if(type==='food') value = 1;
    else if(type==='point') value = rndInt(1,2);
    else if(type==='treasure') value = 1;
  }

  layer.appendChild(el);
  exploreItems.push({
    el, type, x, y, speed: 8 + Math.random()*6,
    monster, value, fleeing:false, fleeVx:0, fleeVy:0, fleeAngle:0
  });
}

function rectsIntersect(a, b){
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function applyExploreReward(item, slime){
  const kind = item.type;
  const base = item.value || 0;
  if(kind === 'coin'){
    const mult = 1 + slimePower(slime)/500;
    const gain = Math.round(base * mult);
    S.coins += gain;
    S.totalEarned += gain;
  } else if(kind === 'point'){
    S.points += base;
  } else if(kind === 'food'){
    S.bag.food += base;
  } else if(kind === 'exp'){
    addExp(slime, base);
  } else if(kind === 'treasure'){
    S.bag.treasure += base;
  }
  save(); renderTop();
}

function triggerMonsterReactions(monster, slimeRects){
  if(!monster || !slimeRects || !slimeRects.length) return;
  const monPower = slimePower(monster);
  const arr = slimeRects;
  arr.forEach((sr, idx)=>{
    if(Math.random() < 0.25){
      const slimeEl = sr.el.querySelector('.slime');
      if(!slimeEl) return;
      slimeEl.dataset.mood = 'fear';
      setTimeout(()=>{ if(slimeEl.isConnected) slimeEl.dataset.mood = 'idle'; }, 1600);
      if(slimePower(sr.s) > monPower){
        let nIdx = idx + (Math.random() < 0.5 ? -1 : 1);
        if(nIdx < 0) nIdx = idx + 1;
        if(nIdx >= arr.length) nIdx = idx - 1;
        if(nIdx >= 0 && nIdx < arr.length){
          const nEl = arr[nIdx].el.querySelector('.slime');
          if(nEl){
            nEl.dataset.mood = 'deadpan';
            setTimeout(()=>{ if(nEl.isConnected) nEl.dataset.mood = 'idle'; }, 1600);
          }
        }
      }
    }
  });
}

function updateExploreItems(dt){
  const scene = document.querySelector('.explore-scene');
  if(!scene){ stopExploreItems(); return; }
  const slimeEls = scene.querySelectorAll('.explore-slime');
  const slimeRects = [];
  slimeEls.forEach(el=>{
    if(el.closest('.explore-item')) return;
    const r = el.getBoundingClientRect();
    if(r.width === 0) return;
    const sid = +el.dataset.sid;
    const s = getSlime(sid);
    if(!s) return;
    slimeRects.push({el, sid, s, rect:r});
  });

  for(let i = exploreItems.length - 1; i >= 0; i--){
    const item = exploreItems[i];
    if(!item.el.isConnected){ exploreItems.splice(i,1); continue; }

    if(item.fleeing){
      item.x += item.fleeVx * dt;
      item.y += item.fleeVy * dt;
      item.fleeAngle += 540 * dt;
      item.el.style.left = item.x + '%';
      item.el.style.top = item.y + '%';
      const inner = item.el.querySelector('.explore-slime');
      if(inner){
        inner.style.animation = 'none';
        inner.style.transformOrigin = 'center center';
        inner.style.transform = `rotate(${item.fleeAngle}deg)`;
      }
      if(item.x > 130 || item.y < -40){
        item.el.remove();
        exploreItems.splice(i,1);
      }
      continue;
    }

    item.x -= item.speed * dt;
    item.el.style.left = item.x + '%';

    const itemRect = item.el.getBoundingClientRect();
    let hit = null;
    for(const sr of slimeRects){
      if(rectsIntersect(itemRect, sr.rect)){ hit = sr; break; }
    }

    if(hit){
      if(item.type === 'monster'){
        item.fleeing = true;
        const speed = 45 + Math.random()*15;
        const angle = 20 * Math.PI / 180;
        item.fleeVx = speed * Math.cos(angle);
        item.fleeVy = -speed * Math.sin(angle);
        item.fleeAngle = 0;
        triggerMonsterReactions(item.monster, slimeRects);
      } else {
        applyExploreReward(item, hit.s);
        const slimeEl = hit.el.querySelector('.slime');
        if(slimeEl && Math.random() < 0.65){
          slimeEl.dataset.mood = 'happy';
          setTimeout(()=>{ if(slimeEl.isConnected) slimeEl.dataset.mood = 'idle'; }, 1500);
        }
        item.el.remove();
        exploreItems.splice(i,1);
        continue;
      }
    }

    if(item.x < -15){
      item.el.remove();
      exploreItems.splice(i,1);
    }
  }
}

/* ==================== 剧情 ==================== */
const STORY_STEPS = [
  {t:`「……喂，醒醒。」\n\n你猛地睁开眼。\n\n头顶是深紫色的夜空，两轮月亮静静地悬着。远处的浮空岛屿缓缓飘动，成群发光的水母从云层间掠过。\n\n这里是……哪里？`},
  {t:`记忆像被搅碎的水面。\n\n你只记得自己在深夜赶完了一份报告，然后眼皮越来越沉……然后，就没有然后了。\n\n就在这时，一道冰冷的机械音在脑海里炸响——`},
  {t:`【叮！检测到异世界灵魂波动……】\n\n【最强召唤师系统 · 激活成功】`,highlight:true},
  {t:`金色的符文从你脚下升起，在空气中排列成一行行发光的小字。\n\n【宿主状态：未觉醒】\n【即将进行：天赋觉醒仪式】\n【请做好准备】`,highlight:true},
  {t:`白光吞没了视野。\n\n你听见无数声音在耳边低语，像是在等待一个答案。\n\n然后——\n\n【觉醒完成！】\n【宿主天赋：史莱姆召唤师（SSS级 · 唯一）】`,highlight:true},
  {t:`……史莱姆？\n\n你低下头，看见一只圆滚滚、软乎乎的小东西正歪着脑袋看你，眼睛一眨一眨的。\n\n【提示：请不要小看它。这世上最强的召唤师，都是从一只史莱姆开始的。】`},
  {t:`系统界面在你面前缓缓展开，一个空白的角色栏位闪烁着微光。\n\n【请为宿主录入姓名】`,input:'name'},
  {t:`录入完成。\n\n【检测到宿主尚未设定系统形象】\n【请自定义您的系统化身——它将常伴您左右】`,input:'sys'},
  {t:`一切准备就绪。\n\n远处的城镇亮起了灯火，而你在这个魔法世界的旅途，正式开始了。\n\n【新手礼包已发放：晶币 ×2000、系统积分 ×200、饲料 ×5、天材地宝 ×2、词条抽取券 ×1】`,highlight:true}
];

let storyStep = 0;
let blocking = false;

function renderStory(){
  if(storyStep >= STORY_STEPS.length){ finishStory(); return; }
  const st = STORY_STEPS[storyStep];
  const stage = $('#storyStage'), text = $('#storyText'), action = $('#storyAction'), hint = $('#storyHint');
  stage.innerHTML=''; action.innerHTML=''; hint.style.display='block';
  text.innerHTML = st.t.split('\n').join('<br>');
  text.classList.toggle('hl', !!st.highlight);
  text.style.opacity = 0;
  requestAnimationFrame(()=>{ text.style.transition='opacity .35s'; text.style.opacity=1; });

  if(st.input === 'name'){
    blocking = true; hint.style.display='none';
    action.innerHTML = `
      <input id="nameInput" class="story-input" placeholder="输入你的名字" maxlength="8" value="${esc(S.name||'')}">
      <button class="btn gold full" id="nameOk">确 定</button>`;
    const inp = $('#nameInput');
    setTimeout(()=>inp.focus(),150);
    $('#nameOk').onclick = ()=>{
      const v = inp.value.trim();
      if(!v){ inp.value=''; inp.placeholder='名字不能为空哦'; return; }
      S.name = v; blocking=false; storyStep++; renderStory(); save();
    };
    inp.addEventListener('keydown',e=>{ if(e.key==='Enter') $('#nameOk').click(); });
  }
  else if(st.input === 'sys'){
    blocking = true; hint.style.display='none';
    buildSysCustom();
  }
}

function buildSysCustom(){
  const stage = $('#storyStage'), action = $('#storyAction');
  const render = ()=>{ stage.innerHTML = lookHTML(S.sysLook,{mood:'idle'}); };
  render();
  const mk = (key,label,max)=>`
    <label>${label}<input type="range" min="0" max="${max}" value="${S.sysLook[key]}" data-look="${key}">
    <span data-out="${key}">${S.sysLook[key]}</span></label>`;
  action.innerHTML = `
    <div class="custom-panel">
      <div style="font-size:11.5px;color:var(--muted);letter-spacing:1px;">—— 身体 ——</div>
      ${mk('h','身体 色相',360)}${mk('s','身体 饱和',100)}${mk('l','身体 明度',100)}
      <div style="font-size:11.5px;color:var(--muted);letter-spacing:1px;margin-top:4px;">—— 眼睛 ——</div>
      ${mk('eh','眼睛 色相',360)}${mk('es','眼睛 饱和',100)}${mk('el','眼睛 明度',100)}
      <input id="sysNameInput" class="story-input" placeholder="为系统起个昵称" maxlength="8" value="${esc(S.sysName||'团子')}">
      <button class="btn gold full" id="sysOk">完 成 绑 定</button>
    </div>`;
  action.querySelectorAll('[data-look]').forEach(inp=>{
    inp.addEventListener('input',()=>{
      const k = inp.dataset.look;
      S.sysLook[k] = +inp.value;
      action.querySelector(`[data-out="${k}"]`).textContent = inp.value;
      render();
    });
  });
  $('#sysOk').onclick = ()=>{
    const v = $('#sysNameInput').value.trim();
    S.sysName = v || '团子';
    blocking = false; storyStep++; renderStory(); save();
  };
}

function finishStory(){
  if(!canWrite()){ toast('请先恢复存档；原始数据仍受保护'); return; }
  if(!S.started && !S.starterGiftClaimed){S.points += 200;S.starterGiftClaimed=true;}
  S.started = true;
  save();
  $('#storyScreen').classList.add('hidden');
  $('#gameScreen').classList.remove('hidden');
  applyTheme();
  checkDailyReset();
  renderTop();
  renderTab();
}

/* Local stroke icons belong to the interface, never to creature sprites. */
function uiIcon(name){
  const paths={home:'M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16',bag:'M6 8h12l2 13H4ZM9 8V5a3 3 0 0 1 6 0v3M9 13h6',person:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3',settings:'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',heart:'M20.5 5.5a5 5 0 0 0-8.5 2 5 5 0 0 0-8.5-2C-1 10 5 16 12 21c7-5 13-11 8.5-15.5Z',shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z',bolt:'m13 2-9 12h7l-1 8 10-13h-8Z',snow:'M12 2v20M3 7l18 10M3 17 21 7M9 4l3 3 3-3M9 20l3-3 3 3',flame:'M13 2c1 7 7 6 7 13a8 8 0 0 1-16 0c0-5 4-7 5-10 0 4 3 6 4-3Z',leaf:'M20 3C7 2 2 7 5 15c3 8 15 5 15-12ZM5 20 16 8',down:'M12 3v18M5 14l7 7 7-7',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6',ball:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM7 4c7 5 7 11 3 17M3 11c7-3 13-1 18 4',stack:'m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',food:'M3 10h18c0 7-4 10-9 10s-9-3-9-10ZM7 3v3M12 2v4M17 3v3',back:'m9 5-7 7 7 7M2 12h14a5 5 0 0 1 5 5',sword:'m4 3 13 13M3 3l1 5 12 10 2-2L8 4ZM14 18l4-4M18 18l3 3',gift:'M3 9h18v4H3ZM5 13v8h14v-8M12 9v12M12 9H8a3 3 0 1 1 3-3Zm0 0h4a3 3 0 1 0-3-3Z',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',lock:'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4'};
  Object.assign(paths,{
    coin:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7l4 5-4 5-4-5Z',
    star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',
    crown:'m3 7 5 4 4-7 4 7 5-4-2 13H5ZM6 16h12',
    rock:'m8 3 9 2 4 10-7 6-10-4-1-7Zm0 0 2 10 11 2M10 13l4 8',
    drop:'M12 2C9 7 4 10 4 15a8 8 0 0 0 16 0c0-5-5-8-8-13ZM8 15a4 4 0 0 0 4 4',
    wind:'M3 8h12a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h5a3 3 0 1 1-3 3',
    moon:'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',
    orbit:'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM3 17c-3-5 15-18 18-12s-15 18-18 12Z',
    clock:'M4 3h16M4 21h16M6 3v4l6 5-6 5v4M18 3v4l-6 5 6 5v4',
    spiral:'M12 12c-3-4 5-7 7-2 3 7-8 13-14 6C-2 8 9-1 17 4',
    potion:'M9 3h6M10 3v6L5 18q-1 3 3 3h8q4 0 3-3l-5-9V3M8 15h8',
    ticket:'M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4ZM15 6v3m0 3v2m0 3v1',
    net:'M12 3a8 8 0 1 1-8 8 8 8 0 0 1 8-8ZM6 6l12 12M5 12l7-7M6 17 17 6M12 19l7-7M6 18l-3 3',
    gem:'m7 3 10 0 5 6-10 12L2 9Zm-5 6h20M7 3l5 18 5-18'
  });
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;
}
function elementIcon(element){
  return uiIcon({'岩':'rock','火':'flame','水':'drop','风':'wind','草':'leaf','冰':'snow','雷':'bolt','光':'spark','暗':'moon','空间':'orbit','时间':'clock','幻':'spiral'}[element]);
}
function itemIcon(item){return uiIcon({food:'food',treasure:'gem',ticket:'ticket',expPotion:'potion',net:'net'}[item]);}
function refreshUIIcons(root){
  root=root||document;
  root.querySelectorAll('[data-ui-icon]').forEach(el=>{if(!el.querySelector('.ui-icon'))el.innerHTML=uiIcon(el.dataset.uiIcon);});
  const nav={space:'home',home:'leaf',summon:'spark',travel:'map',bag:'bag',status:'person'};
  const acts={settings:'settings',summon:'spark',mergeopen:'spark',cycleMap:'map',globalplan:'map',setupTeam:'person',abyssSetup:'sword',refill:'food',selectToy:'ball',toggleSpaceMode:'home',buy:'bag',buy10:'bag',feed:'food',treasure:'gift',drinkPotion:'gift',breakthrough:'bolt',claimGoal:'gift',challengeStart:'sword',petlock:'lock'};
  root.querySelectorAll('button[data-act]').forEach(b=>{
    const a=b.dataset.act;
    if(a==='tab'){const ic=b.querySelector('.ico');if(ic)ic.innerHTML=uiIcon(nav[b.dataset.tab]);return;}
    let name=acts[a];if(!name||b.querySelector('.ui-icon'))return;
    if(a==='globalplan'&&b.dataset.type==='clear')name='back';
    if(a==='selectToy'&&b.dataset.toy==='stack')name='stack';
    if(a==='settings'){b.innerHTML=uiIcon(name);return;}
    for(const n of Array.from(b.childNodes)){if(n.nodeType===3)n.textContent=n.textContent.replace(/^[\s✨🗺️↩️👥⚔️🥣🎮⚽🧱⚡🎁◇]+/u,'').replace(/[✨]+$/u,'');}
    b.insertAdjacentHTML('afterbegin',uiIcon(name));
  });
}

let sceneArtId=0;
function gardenScene(isMonster){
  const id='garden-'+(++sceneArtId);
  const colors=isMonster?['#5b526e','#34374e','#252b40','#91879d']:['#72918b','#3f6465','#243e4a','#b1c0a0'];
  return `<svg class="garden-art" viewBox="0 0 600 400" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="${id}-ground" x2="0" y2="1"><stop stop-color="${colors[0]}"/><stop offset=".6" stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[2]}"/></linearGradient>
      <radialGradient id="${id}-light"><stop stop-color="#f3e6bb" stop-opacity=".32"/><stop offset="1" stop-color="#f3e6bb" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}-leaf" x2=".6" y2="1"><stop stop-color="${colors[3]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient>
      <radialGradient id="${id}-lamp"><stop stop-color="#fff4cb"/><stop offset=".2" stop-color="#edcf8b" stop-opacity=".7"/><stop offset="1" stop-color="#edcf8b" stop-opacity="0"/></radialGradient>
    </defs>
    <path fill="url(#${id}-ground)" d="M0 0h600v400H0z"/>
    <ellipse cx="275" cy="165" rx="260" ry="200" fill="url(#${id}-light)"/>
    <path d="M-30 302Q110 282 180 229T358 152Q450 124 630 164" fill="none" stroke="#bac0a2" stroke-opacity=".1" stroke-width="74"/>
    <path d="M-30 302Q110 282 180 229T358 152Q450 124 630 164" fill="none" stroke="#c5c3a4" stroke-opacity=".17" stroke-width="45"/>
    <g fill="#253f46" opacity=".33"><ellipse cx="100" cy="336" rx="92" ry="21"/><ellipse cx="526" cy="72" rx="90" ry="18"/><ellipse cx="455" cy="350" rx="96" ry="22"/></g>
    <g fill="#a8b4a2" stroke="#d3d5b6" stroke-opacity=".16">
      <path d="m87 269 42-9 27 17-14 17-45-2Z"/><path d="m162 237 33-13 29 12-9 17-40 3Z" opacity=".8"/>
      <path d="m244 193 33-6 20 14-18 14-34-4Z" opacity=".6"/><path d="m324 155 37-5 18 13-13 11-39-3Z" opacity=".45"/>
    </g>
    <g fill="url(#${id}-leaf)">
      <path d="M0 117Q22 20 126 7 99 67 0 117ZM0 89Q51 27 63-20H0ZM600 120Q527 78 522 13 583 21 600 75Z"/>
      <path d="M0 400V302q29 5 40 29-3-59 35-72 10 47-9 78 39-43 77-23-20 44-57 54 43-8 64 32Z"/>
      <path d="M600 400V284q-37 0-48 35 0-64-39-75-10 47 6 80-45-39-76-17 19 39 58 53-41-2-66 40Z"/>
      <path d="M600 0H435q7 34 43 43 35 19 67-6 8 42 55 44Z"/>
    </g>
    <g fill="none" stroke="#d3d8b5" stroke-opacity=".2" stroke-width="2"><path d="M0 114 93 30M19 398l46-111M592 394l-77-123M594 62l-117-40"/></g>
    <g fill="#819990"><path d="m33 166 16-8 19 10-3 13-25 2Z"/><path d="m513 217 23-12 23 15-10 17-30-2Z"/></g>
    <g stroke="#c9d2aa" stroke-width="2" stroke-linecap="round" opacity=".45"><path d="m113 118 4-11m0 11 7-7m282 178 3-10m-3 10-7-6m-182 62 3-9m0 9 6-5m258-229 3-9"/></g>
    <g fill="#ddd6b5" opacity=".7"><circle cx="79" cy="199" r="2"/><circle cx="84" cy="204" r="2"/><circle cx="438" cy="305" r="2"/><circle cx="445" cy="302" r="2"/><circle cx="319" cy="76" r="1.5"/></g>
    <path d="M83 68v57m-9-46h18v24H74z" stroke="#b9ae8b" stroke-width="3" fill="#4d5c58"/>
    <circle cx="83" cy="92" r="44" fill="url(#${id}-lamp)"/><path d="M79 86h8v13h-8z" fill="#ffe8a9"/>
    <path d="M0 395Q170 371 300 391t300-1v10H0Z" fill="${colors[2]}" opacity=".45"/>
  </svg>`;
}
function summonAltar(){
  return `<div class="summon-altar" aria-hidden="true"><div class="altar-halo"></div>
    <svg class="altar-art" viewBox="0 0 300 130"><ellipse cx="150" cy="103" rx="119" ry="20" fill="#101522" opacity=".3"/>
      <path d="M39 76v15c0 36 222 36 222 0V76" fill="#625c78"/><ellipse cx="150" cy="76" rx="111" ry="31" fill="#888298"/>
      <ellipse cx="150" cy="73" rx="99" ry="26" fill="#a39aa9"/><ellipse cx="150" cy="73" rx="86" ry="21" fill="#77758b" stroke="#dfcba3" stroke-width="1.4"/>
      <ellipse cx="150" cy="73" rx="64" ry="15" fill="none" stroke="#e3d4ba" stroke-opacity=".5"/>
      <path d="m150 54 8 8-8 7-8-7Zm-74 15 10 4-10 4-9-4m157-4 9 4-9 4-10-4m-74 7 8 7-8 8-8-8" fill="#e6d5b4" opacity=".8"/>
      <path d="m56 94 17 6m35 10 15 2m52 0 15-2m36-10 17-6" stroke="#c8bdc4" opacity=".35" stroke-width="2"/>
    </svg><div class="altar-core"></div>
    <span class="altar-star" style="--x:29%;--y:29%">${uiIcon('spark')}</span><span class="altar-star" style="--x:70%;--y:39%">${uiIcon('spark')}</span><span class="altar-star" style="--x:59%;--y:14%">${uiIcon('spark')}</span></div>`;
}
function dispatchSummaryHTML(){
  const n=S.slimes.filter(isDispatched).length;
  return `<span class="pulse"></span>${n?`${n} 位伙伴正在探索，随时可以回来`:'伙伴在身边，慢慢享受这段时光'}`;
}
function openSettings(){
  openModal(`<button class="close" data-act="close" aria-label="关闭设置">×</button><h3>${uiIcon('settings')} 设置</h3><p class="muted small">只调整界面主题，不改变伙伴的样子。</p><div class="theme-row settings-themes">${THEMES.map(t=>`<button class="theme-btn ${S.theme===t.id?'on':''}" data-act="theme" data-theme="${t.id}" title="${t.name}"><span class="dot" style="background:${t.color}"></span><span>${t.name}</span></button>`).join('')}</div><p class="muted small" style="margin-top:14px">所有图标与场景均内置，无需联网。升级不会重置已有伙伴、属性或资源。</p>`);
}

const BOND_MILESTONES=[{need:0,name:'初识',response:'歪着头，认真记住你的声音。',face:'happy'},{need:5,name:'熟悉',response:'蹭了蹭你的手：想和你一起走！',face:'like'},{need:15,name:'信赖',response:'一看到你就跳起来：你终于回来啦！',face:'jump'},{need:30,name:'挚友',response:'把小小的安心交给你：有你在真好。',face:'like'}];
function bondMilestone(s){return BOND_MILESTONES.slice().reverse().find(m=>(Number(s.intimacy)||0)>=m.need)||BOND_MILESTONES[0];}
function gainCompanionIntimacy(s,now){
  const before=bondMilestone(s);
  const last=Number(s.lastPetAt),hasLast=s.lastPetAt!==undefined && s.lastPetAt!==null && Number.isFinite(last);
  const gained=!hasLast || now<last || now-last>=30000;
  if(gained){s.intimacy=(Number(s.intimacy)||0)+1;s.lastPetAt=now;}
  return {before,bond:bondMilestone(s),gained};
}
function bondProgressHTML(s){const v=Math.max(0,Number(s.intimacy)||0),cur=bondMilestone(s),next=BOND_MILESTONES.find(m=>m.need>v);return `<div class="bond-progress"><b>${uiIcon('heart')} ${cur.name} · 亲密度 ${v}</b><div>${esc(cur.response)}</div><div class="bar"><i style="width:${next?Math.min(100,v/next.need*100):100}%;background:var(--accent2)"></i></div><div class="muted">${next?`下一里程碑 ${next.need}：${next.name}`:'已解锁挚友徽章与专属回应'} · 抚摸每 30 秒可增加 1 亲密，滚球与叠叠乐也能增进感情，无需战斗。</div><div class="muted">5 熟悉：跟随手指 · 15 信赖：欢跳回应 · 30 挚友：星心徽章</div></div>`;}
function homeObjective(){if(!S.slimes.length)return {title:'迎接第一位伙伴',desc:'召唤后就能在这里抚摸、玩耍，一起慢慢成长。',tab:'summon',cta:'去召唤'};if(!S.globalPlan&&!S.slimes.some(s=>getPlan(s.id)))return {title:'让伙伴开始第一段探索',desc:'派遣一支队伍，留下伙伴陪你玩；探索会在后台继续。',tab:'travel',cta:'去探索'};return {title:'今天，向下一段旅程出发',desc:'探索区域、完成教学挑战、收集伙伴，都有可领取的成长奖励。',tab:'travel',cta:'查看目标'};}
function dispatchProgressHTML(){const list=S.slimes.filter(s=>{const p=getPlan(s.id);return p&&p.type==='explore'&&(!p.global||S.exploreTeam===null||S.exploreTeam.includes(s.id));});return list.length?`<div class="dispatch-list">${list.map(s=>`<div class="dispatch-row"><header><b>${esc(s.name)}</b><span data-rest-label="${s.id}">${s.resting?'恢复中':'探索中'}</span></header><div class="bar"><i data-rest-bar="${s.id}" style="width:${s.resting&&typeof planRestProgress==='function'?planRestProgress(s):Math.min(100,s.stamina/staminaMax(s)*100)}%"></i></div><small data-rest-text="${s.id}">${s.resting&&typeof planRestText==='function'?esc(planRestText(s)):`体力 ${Math.floor(s.stamina)}/${staminaMax(s)} · 每次探索消耗 20`}</small></div>`).join('')}</div>`:'';}

function renderTop(){
  $('#cCrystal').textContent = S.coins.toLocaleString();
  $('#cPoints').textContent = S.points;
  $('#cLevel').textContent = 'Lv.'+S.level + (S.breakPending?' !':'');
  $('#lvCur').classList.toggle('alert', S.breakPending);
  refreshUIIcons(document.querySelector('#gameScreen'));
}

function switchTab(t){
  if(activeTab==='space' && t!=='space'){
    plSlimes.forEach(p=>{
      if(p.timer) clearInterval(p.timer);
      if(p.bubbleTimer) clearInterval(p.bubbleTimer);
    });
    plSlimes = [];
  }
  if(t !== 'space') selectedToy = null;
  if(t === 'travel') travelTipsOpen = false;
  activeTab = t;
  document.querySelectorAll('.tabbar button').forEach(b=>b.classList.toggle('active', b.dataset.tab===t));
  renderTab();
}
function renderTab(){
  checkDailyReset();
  stopExploreItems();
  const el = $('#content');
  $('#app').classList.toggle('home-mode',activeTab==='home');
  const map = {home:()=>LivingWorld.render(),status:renderStatus, summon:renderSummon, travel:renderTravel, space:renderSpace, bag:renderBag};
  el.innerHTML = (map[activeTab]||renderSpace)();
  refreshUIIcons(el);
  if(activeTab==='home')LivingWorld.mount();
  if(activeTab==='space'){initPlayground();el.dataset.spaceIdle=(S.spaceMode==='monster'?S.monsters:S.slimes.filter(s=>!isDispatched(s))).map(s=>s.id).join(',');}
  if(activeTab==='travel') setTimeout(startExploreItems, 50);
}
