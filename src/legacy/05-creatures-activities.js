function createSlime(forceMonster, opts){
  const isMon = !!forceMonster;
  /* 魔物不吃玩家的献祭加成；保底召唤只在稀有元素里抽 */
  const element = opts && opts.rare ? pickRareElement(summonBoost) : pickElement(isMon ? null : summonBoost);

  const strPotential = isMon ? rndInt(12, 26) : rndInt(5, 20);
  const agiPotential = isMon ? rndInt(12, 26) : rndInt(5, 20);
  const magPotential = isMon ? rndInt(12, 26) : rndInt(5, 20);
  const luck = isMon ? rndInt(3, 14) : rndInt(0, 10);
  const wit  = isMon ? rndInt(3, 14) : rndInt(0, 10);

  const baseSize = +(0.66 + Math.random() * 0.34).toFixed(2);

  const str = strPotential;
  const agi = agiPotential;
  const mag = magPotential;
  const initStaminaMax = Math.round(80 + baseSize * 40);

  const morality = rndInt(-100,100);
  const id = S.seq++;

  S.nameSeq = (S.nameSeq || 0) + 1;
  if(S.nameSeq >= 99) S.nameSeq = 1;
  const nameNo = S.nameSeq;

  const traits = [];
  if(Math.random() < 0.15){
    const count = Math.random() < 0.25 ? 2 : 1;
    const pool = [...TRAITS_POOL];
    for(let i=0;i<count && pool.length;i++){
      const idx = Math.floor(Math.random()*pool.length);
      const t = pool.splice(idx,1)[0];
      const nt = {n:t.n,d:t.d,k:t.k,v:t.v};
      refreshTraitDesc(nt);
      traits.push(nt);
    }
  }

  const s = {
    id, name:`${element}${nameNo}`, element, morality,
    personality: pick(PERSONALITIES),
    mood:70, stamina:initStaminaMax, traits,
    level:1, exp:0, size:baseSize, resting:false,
    intimacy:0, locked:false, mergeCount:0,
    strPotential, agiPotential, magPotential, luck, wit,
    str, agi, mag
  };
  s.hp = hpMax(s);
  if(forceMonster){
    s.isMonster = true;
    s.monSat = rnd(18,58);
    s.monLight = rnd(14,34);
  }
  s.skill = HEAL_ELEMENTS.includes(element) ? '治疗' : '元素弹';
  return s;
}

let summonRevealTimer=null;
let summonOpen=false;
function clearSummonReveal(){
  if(summonRevealTimer!==null)clearTimeout(summonRevealTimer);
  summonRevealTimer=null;
  summonOpen=false;
}
function finishSummonReveal(){
  if(summonRevealTimer!==null)clearTimeout(summonRevealTimer);
  summonRevealTimer=null;
  const result=$('#modalBox .summon-result');
  if(result){result.classList.remove('summoning');result.setAttribute('aria-busy','false');}
}
function doSummon(){
  if(summonOpen)return;
  const slots = getSlots();
  if(S.slimes.length >= slots){
    toast(`召唤空间已满（${slots}）\n提升召唤师等级可扩充`);
    return;
  }
  const cost = summonCost();
  if(S.coins < cost){ toast(`晶币不足，召唤需要 ${cost} 晶币`); return; }
  const s = createSlime(false, {rare: (S.summonPity||0) >= SUMMON_PITY - 1});
  S.coins -= cost;
  S.summonPity = RARE_ELEMENTS.includes(s.element) ? 0 : (S.summonPity||0) + 1;
  S.slimes.push(s);
  summonBoost = {};
  addTaskProgress('summon', 1);
  save();
  const traitText = s.traits.length
    ? s.traits.map(t=>`<span>${esc(t.n)} · ${esc(t.d)}</span>`).join('')
    : '';
  const weight=ELEMENT_WEIGHTS[s.element];
  const rarity=weight<=2?'rare':'normal';
  const rarityName=weight<1?'极稀有的相遇':weight<=2?'稀有的相遇':'新的相遇';
  const reduced=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  openModal(`
    <div class="summon-result ${reduced?'':'summoning'}" data-rarity="${rarity}" style="--summon-hue:${ELEMENTS[s.element].h}" aria-busy="${!reduced}">
      <button class="close" data-act="close" aria-label="关闭召唤结果">×</button>
      <div class="sr-title">${rarityName}</div>
      <div class="summon-reveal-stage">${summonAltar()}
        <div class="summon-motes" aria-hidden="true">${[[-110,-42],[93,-51],[-78,37],[100,36],[-34,-75],[40,-83]].map(([x,y],i)=>`<i class="summon-mote" style="--dx:${x}px;--dy:${y}px;--delay:${i*.035}s"></i>`).join('')}</div>
        <div class="sr-slime">${slimeHTML(s,{mood:'idle'})}</div>
      </div>
      <div class="sr-name">${esc(s.name)}</div>
      <div class="summon-identity">${elementIcon(s.element)} ${s.element}属性 <span>·</span> ${esc(s.personality)}</div>
      <div class="summon-stats">
        <div><small>力量</small><b>${s.str}</b></div><div><small>敏捷</small><b>${s.agi}</b></div><div><small>魔力</small><b>${s.mag}</b></div>
      </div>
      <details class="rules-details"><summary>查看伙伴详情</summary><div class="sr-props">
        <span>天赋 ${calcTalent(s)}</span><span>善恶 ${s.morality}</span><span>体型 ${s.size.toFixed(2)}</span><span>Lv.${s.level}</span><span>技能 · ${esc(s.skill)}</span>${traitText}
      </div></details>
      <button class="btn gold full" data-act="close">收下伙伴</button>
      <button class="summon-skip" data-act="summonSkip">跳过演出</button>
    </div>`);
  summonOpen=true;
  if(!reduced)summonRevealTimer=setTimeout(finishSummonReveal,1200);
  renderTab();
}

function doBreakthrough(){
  if(!S.breakPending){ return; }
  S.breakPending = false;
  S.summonerExp = 0;
  save(); renderTop(); renderTab();
  toast(`⚡ 突破成功！\n召唤师 Lv.${S.level}，召唤位 ${getSlots()}`, 'good');
}

/* One growth rule for leveling and merging. Add deltas instead of replacing
   existing stats, so old saves keep every previously earned point. */
function growthStat(potential, level){
  const p = Math.max(0, Number(potential)||0);
  return p + Math.max(0, (Number(level)||1)-1) * Math.round(p * 0.5);
}
function growthStats(s, newLevel, potentials){
  const out = {};
  for(const key of ['str','agi','mag']){
    const potKey = key + 'Potential';
    const nextPot = potentials && Number.isFinite(potentials[potKey]) ? potentials[potKey] : s[potKey];
    out[key] = (Number(s[key])||0) + Math.max(0,
      growthStat(nextPot, newLevel) - growthStat(s[potKey], s.level));
  }
  return out;
}
function addExp(s, amount, silent){
  const rate = expRate(s);
  const actual = Math.max(0, Math.round((Number(amount)||0) * rate));
  if(!Number.isFinite(actual) || actual <= 0) return false;
  addSummonerExp(Math.max(1, Math.round(actual * 0.1)), silent);
  s.exp = (Number(s.exp)||0) + actual;
  let leveled = false;
  while(s.exp >= slimeExpNeed(s.level)){
    s.exp -= slimeExpNeed(s.level);
    const nextLevel = s.level + 1;
    Object.assign(s, growthStats(s, nextLevel));
    s.level = nextLevel;
    s.size = +(s.size + 0.0016).toFixed(3);
    leveled = true;
  }
  if(leveled) s.hp = hpMax(s);
  return leveled;
}

function buyItem(k, qty){
  qty = qty || 1;
  const it = ITEMS[k];
  const total = it.price * qty;
  if(k === 'ticket'){
    if(S.points < total){ toast(`系统积分不足（需要 ${total} 积分）`); return; }
    S.points -= total;
    S.bag.ticket = (S.bag.ticket||0) + qty;
    save(); renderTop(); renderTab();
    toast(`购买成功：${it.name} ×${qty}`, 'good');
    return;
  }
  /* 经验药水：获得后自动对等级最低的史莱姆使用 */
  if(k === 'expPotion'){
    if(S.coins < total){ toast('晶币不足'); return; }
    S.coins -= total;
    let used = false;
    for(let i=0;i<qty;i++){
      if(autoUseExpPotionSilent()) used = true;
      else S.bag.expPotion = (S.bag.expPotion||0) + 1;
    }
    save(); renderTop(); renderTab();
    if(used) toast(`🧪 经验药水已自动使用于等级最低的史莱姆`, 'good');
    else toast('没有史莱姆，经验药水已暂存');
    return;
  }
  if(S.coins < total){ toast('晶币不足'); return; }
  S.coins -= total;
  S.bag[k] = (S.bag[k]||0) + qty;
  save(); renderTop(); renderTab();
  toast(`购买成功：${it.name} ×${qty}`, 'good');
}

function useItem(k,id){
  const s = getSlime(id); if(!s) return;
  if(s.isMonster && k !== 'food'){ toast('魔物无法使用该道具'); return; }
  if((S.bag[k]||0) <= 0){ toast('数量不足，请先购买'); return; }

  if(k === 'food'){
    S.bag.food--;
    s.stamina = clamp(s.stamina + 30, 0, staminaMax(s));
    s.mood = clamp(s.mood + 5, 0, 100);
    if(!s.isMonster) addExp(s, 8);
    addTaskProgress('feed', 1);
    toast('🍖 吃得很好！体力+30 心情+5', 'good');
  }
  else if(k === 'treasure'){
    S.bag.treasure--;
    const inc = rndInt(6,14);
    s.strPotential = clamp(s.strPotential + Math.round(inc/3), 5, 40);
    s.agiPotential = clamp(s.agiPotential + Math.round(inc/3), 5, 40);
    s.magPotential = clamp(s.magPotential + Math.round(inc/3), 5, 40);
    s.mood = clamp(s.mood + 15, 0, 100);
    s.stamina = clamp(s.stamina + 20, 0, staminaMax(s));
    addExp(s, 25);
    addTaskProgress('grow', 1);
    toast(`💎 吸收了${s.element}属性天材地宝！\n潜力提升（天赋现为 ${calcTalent(s)}）`, 'good');
  }
  else if(k === 'ticket'){
    if(s.traits.length >= 3){ toast('这只史莱姆的词条已满（3/3）'); return; }
    const pool = TRAITS_POOL.filter(t=>!s.traits.some(x=>x.n===t.n));
    if(!pool.length){ toast('已无可抽取的词条'); return; }
    S.bag.ticket--;
    const t = pick(pool);
    const nt = {n:t.n, d:t.d, k:t.k, v:t.v};
    refreshTraitDesc(nt);
    s.traits.push(nt);
    addExp(s, 15);
    toast(`🎫 抽取词条：【${nt.n}】\n${nt.d}`, 'good');
  }
  else if(k === 'expPotion'){
    S.bag.expPotion--;
    const gain = potionExp(s);
    addExp(s, gain);
    toast(`🧪 喝下经验药水！获得 ${gain} 经验（受悟性加成）`, 'good');
  }
  save(); renderTop(); renderTab();
  if(!$('#modalLayer').classList.contains('hidden')) openDetail(id);
}

let mergeSel = [];
let mergePreviewSignature = '';
function mergeStateSignature(a, b){
  const fields = ['id','name','element','level','exp','intimacy','size','str','agi','mag','strPotential','agiPotential','magPotential','luck','wit','traits','locked','mergeCount'];
  return JSON.stringify([a,b].map(s=>fields.map(k=>s && s[k])));
}
function mergeCost(a, b){
  const count = Math.max(0, Math.floor(Number(a.mergeCount)||0));
  return 500 + 100 * Math.max(a.level, b.level) + 250 * count * (count + 1);
}
function mergePreview(a, b){
  if(typeof LivingWorld!=='undefined' && ((a && LivingWorld.isBusy(S,a.id)) || (b && LivingWorld.isBusy(S,b.id)))) return {valid:false,reason:'请先让伙伴结束家园工作或远征。'};
  if(!a || !b || a === b || a.id === b.id) return {valid:false, reason:'请选择两只不同的史莱姆'};
  if(a.isMonster) return {valid:false, reason:'魔物不能作为主史莱姆'};
  if(b.locked) return {valid:false, reason:'副宠已珍爱锁定，不能被消耗；请先在详情中解锁'};
  const level = Math.max(a.level, b.level);
  const maxPots = {};
  for(const key of ['strPotential','agiPotential','magPotential']) maxPots[key] = Math.max(a[key], Math.min(40, a[key] + 3));
  const guaranteedTraits = (a.traits||[]).filter(t=>(b.traits||[]).some(bt=>bt.n===t.n)).map(t=>t.n);
  const possibleTraits = (b.traits||[]).filter(bt=>!(a.traits||[]).some(t=>t.n===bt.n)).map(t=>t.n);
  return {valid:true, cost:mergeCost(a,b), level,
    statsMin:growthStats(a, level), statsMax:growthStats(a, level, maxPots),
    guaranteedTraits, possibleTraits, fullTraits:(a.traits||[]).length >= 3};
}
function renderMergePreview(){
  const el = document.getElementById('mergePreview');
  const btn = document.querySelector('[data-act="mergeconfirm"]');
  if(!el || !btn) return;
  const a = getSlime(mergeSel[0]), b = getSlime(mergeSel[1]);
  if(!a || !b){
    el.innerHTML = '<p class="muted small">先选择保留身份的主宠，再选择会被消耗的副宠。</p>';
    btn.disabled = true;
    btn.textContent = '先选择主宠与副宠';
    return;
  }
  const p = mergePreview(a,b);
  if(!p.valid){ mergePreviewSignature = ''; el.textContent = p.reason; btn.disabled = true; return; }
  mergePreviewSignature = mergeStateSignature(a,b);
  const traitText = p.guaranteedTraits.length ? p.guaranteedTraits.map(esc).join('、') + '：确定增强 20%' : '无同名词条增强';
  const possibleText = p.fullTraits ? '主宠词条已满，不会继承副宠新词条' : (p.possibleTraits.length ? p.possibleTraits.map(esc).join('、') + '：按顺序各 50% 继承，最多 3 条' : '没有不同词条');
  const attrs = [['str','力'],['agi','敏'],['mag','魔']].map(([k,n])=>`${n} ${a[k]} → ${p.statsMin[k]}${p.statsMax[k]===p.statsMin[k]?'':'–'+p.statsMax[k]}`).join(' · ');
  el.innerHTML = `
    <h4 style="margin:4px 0 8px;color:var(--accent2)">合体预览 · ${esc(a.name)} 保留身份</h4>
    <p class="small"><b>确定继承：</b>主宠名字、ID、性格、善恶、亲密度 ${a.intimacy||0}、经验 ${a.exp||0}、珍爱锁和定制规划。等级 Lv.${a.level} → ${p.level}。心情、体力不刷新。</p>
    <p class="small"><b>统一成长：</b>${attrs}；现有属性不会下降，同级无潜力变异不加属性。</p>
    <p class="small"><b>词条：</b>${traitText}；${possibleText}。主宠原词条不会丢失。</p>
    <p class="small"><b>随机变化：</b>75% 潜力不变；25% 三项潜力同时 +1～3（各等概率，上限 40），并幸运/悟性 +1（上限 20）。体型 90% 不变 / 10% +${(b.size*0.008).toFixed(3)}。</p>
    <p class="small"><b>元素：</b>${a.element===b.element ? '同元素，100% 保持 '+a.element : '80% 保持 '+a.element+' / 18% 继承 '+b.element+' / 2% 从草、冰、雷、幻、光、暗、空间、时间等概率抽取（可能抽回双方元素）'}。技能随最终元素匹配。</p>
    <p class="small" style="color:var(--danger,#ff8299)"><b>永久消耗：</b>${esc(b.name)}（Lv.${b.level}）及其未继承的词条、经验 ${b.exp||0}、亲密度 ${b.intimacy||0}与规划；无法撤销。</p>
    <p class="small"><b>费用 ${p.cost} 晶币</b> · 当前 ${Math.floor(S.coins)} · 主宠第 ${(a.mergeCount||0)+1} 次融合，后续费用递增。${S.coins < p.cost ? '余额不足，请先探索。':''}</p>`;
  btn.disabled = S.coins < p.cost;
  btn.textContent = `消耗 ${p.cost} 晶币，确认合体`;
}
function openMerge(){
  mergeSel = [];
  mergePreviewSignature = '';
  const all = [...S.slimes, ...S.monsters];
  if(all.length < 2){ toast('至少需要2只史莱姆才能合体'); return; }
  openModal(`
    <button class="close" data-act="close">✕</button>
    <h3 style="text-align:center;margin:0 0 6px;color:var(--accent2);">史莱姆合体</h3>
    <p class="muted small" style="text-align:center;">先选主宠：保留名字与陪伴关系；再选副宠：永久消耗。<br>魔物不能作为主宠；珍爱锁定的宠物不能作为副宠。<br>费用 = 500 + 100 × 较高等级 + 250 × 主宠融合次数 ×（次数 + 1）。</p>
    <div class="minigrid merge-list" style="margin-top:14px;">
      ${all.map(s=>`
        <div class="minicard" data-act="mergesel" data-id="${s.id}" role="button" tabindex="0">
          <div class="scale-box">${slimeHTML(s,{mood:'idle'})}</div>
          <div class="mc-name">${s.locked?'◇ ':''}${esc(s.name)}</div>
          <div class="mc-tag">${elementIcon(s.element)}${s.element} · ${s.isMonster?'魔物':'Lv.'+s.level}${s.locked?' · 珍爱锁定':''}</div>
          <div class="merge-role small" style="min-height:18px;color:var(--accent2)"></div>
        </div>`).join('')}
    </div>
    <div id="mergePreview" style="margin-top:14px;padding:12px;background:rgba(0,0,0,.12);border-radius:12px;line-height:1.6"></div>
    <button class="btn gold full" data-act="mergeconfirm" style="margin-top:16px;" disabled>先选择主宠与副宠</button>
  `);
  renderMergePreview();
}
function toggleMergeSel(id){
  const s = getSlime(id);
  if(!s) return;
  const idx = mergeSel.indexOf(id);
  if(idx >= 0){
    mergeSel.splice(idx,1);
    if(mergeSel.length && getSlime(mergeSel[0]).isMonster) mergeSel = [];
  } else {
    if(mergeSel.length >= 2){ toast('请先取消一个选择，再替换宠物'); return; }
    if(!mergeSel.length && s.isMonster){ toast('魔物不能作为主史莱姆'); return; }
    if(mergeSel.length === 1 && s.locked){ toast('这只宠物已珍爱锁定，不能作为被消耗的副宠'); return; }
    mergeSel.push(id);
  }
  document.querySelectorAll('.merge-list .minicard').forEach(c=>{
    const at = mergeSel.indexOf(+c.dataset.id);
    c.classList.toggle('on', at>=0);
    c.setAttribute('aria-pressed', String(at>=0));
    const label = c.querySelector('.merge-role');
    if(label) label.textContent = at===0 ? '主宠 · 身份保留' : at===1 ? '副宠 · 将被消耗' : '';
  });
  renderMergePreview();
}
function doMerge(){
  if(mergeSel.length !== 2) return;
  const a = getSlime(mergeSel[0]), b = getSlime(mergeSel[1]);
  const preview = mergePreview(a,b);
  if(!preview.valid){ toast(preview.reason); return; }
  if(mergePreviewSignature && mergePreviewSignature !== mergeStateSignature(a,b)){
    renderMergePreview();
    toast('宠物在预览期间获得了成长，已更新预览；请再次确认费用与继承结果');
    return;
  }
  if(S.coins < preview.cost){ toast(`晶币不足，合体需要 ${preview.cost} 晶币`); renderMergePreview(); return; }

  const potBonus = Math.random() < 0.25 ? rndInt(1,3) : 0;
  const pots = {};
  for(const key of ['strPotential','agiPotential','magPotential']) pots[key] = Math.max(a[key], Math.min(40, a[key] + potBonus));
  const stats = growthStats(a, preview.level, pots);
  const mergedTraits = (a.traits||[]).map(t=>({...t}));
  (b.traits||[]).forEach(bt=>{
    const mt = mergedTraits.find(t=>t.n===bt.n);
    if(mt){ mt.v = +(mt.v * 1.2).toFixed(4); refreshTraitDesc(mt); }
    else if(mergedTraits.length < 3 && Math.random() < 0.5){
      const nt = {...bt}; refreshTraitDesc(nt); mergedTraits.push(nt);
    }
  });
  const newSize = Math.random() < 0.1 ? +(a.size + b.size * 0.008).toFixed(3) : a.size;
  let newElement = a.element;
  if(a.element !== b.element){
    const r = Math.random();
    if(r >= 0.80 && r < 0.98) newElement = b.element;
    else if(r >= 0.98) newElement = pick(['草','冰','雷','幻','光','暗','空间','时间']);
  }

  /* Mutate the retained primary in place: references, custom name, earned
     intimacy/experience and all old-save extras survive the operation. */
  if(typeof ensureProgress === 'function') ensureProgress();
  S.coins -= preview.cost;
  Object.assign(a, pots, stats, {
    element:newElement, level:preview.level, traits:mergedTraits, size:newSize,
    luck:Math.max(a.luck||0, Math.min(20, (a.luck||0) + (potBonus?1:0))),
    wit:Math.max(a.wit||0, Math.min(20, (a.wit||0) + (potBonus?1:0))),
    mergeCount:(Math.max(0, Math.floor(Number(a.mergeCount)||0)))+1
  });
  a.skill = HEAL_ELEMENTS.includes(newElement) ? '治疗' : '元素弹';
  a.hp = Math.min(a.hp, hpMax(a));
  S.slimes = S.slimes.filter(s=>s!==b);
  S.monsters = S.monsters.filter(s=>s!==b);
  delete S.customPlans[b.id];
  if(Array.isArray(S.exploreTeam)) S.exploreTeam = S.exploreTeam.filter(id=>id!==b.id);
  if(Array.isArray(S.lastAbyssSel)) S.lastAbyssSel = S.lastAbyssSel.filter(id=>id!==b.id);
  if(typeof ensureProgress === 'function') ensureProgress();
  mergeSel = [];
  mergePreviewSignature = '';
  addTaskProgress('grow', 1);
  save(); renderTop(); renderTab(); closeModal();
  toast(`合体完成：${a.name} 仍是你的老朋友！\n消耗 ${preview.cost} 晶币 · Lv.${a.level} · 天赋 ${calcTalent(a)}\n${b.name} 已被消耗；主宠名字、经验与亲密度保留`, 'good');
}
function togglePetLock(id){
  const s = getSlime(id); if(!s) return;
  s.locked = !s.locked;
  save(); renderTab(); openDetail(id);
  toast(s.locked ? `${s.name} 已珍爱锁定，不会被合体消耗` : `${s.name} 已解除珍爱锁定`, s.locked?'good':undefined);
}

function openPlan(id){
  const s = getSlime(id); if(!s) return;
  const plan = S.customPlans[id];
  openModal(`
    <button class="close" data-act="close">✕</button>
    <h3 style="text-align:center;margin:0 0 6px;color:var(--accent2);">定制规划 · ${esc(s.name)}</h3>
    <p class="muted small" style="text-align:center;">定制规划优先于一键规划，且不受一键规划影响</p>
    <div class="plan-options">
      <button class="btn ${plan&&plan.type==='explore'?'gold':''}" data-act="setplan" data-id="${id}" data-type="explore">🗺️ 自动探险</button>
    </div>
    <button class="btn full themed" data-act="clearplan" data-id="${id}" style="margin-top:14px;">清除定制规划</button>
  `);
}

function openModal(html){
  clearSummonReveal();
  $('#modalBox').innerHTML = html;
  $('#modalLayer').classList.remove('hidden');
  refreshUIIcons($('#modalBox'));
}
function closeModal(){
  clearSummonReveal();
  $('#modalLayer').classList.add('hidden');
  $('#modalBox').innerHTML = '';
}

function openDetail(id, fromMonster){
  const s = getSlime(id); if(!s) return;
  const power = slimePower(s);
  const talent = calcTalent(s);
  const isMon = !!s.isMonster;
  const moraleText = `${s.morality}`;
  const expPct = clamp(Math.floor(s.exp / slimeExpNeed(s.level) * 100), 0, 100);
  const elemTalent = ELEMENT_TALENTS[s.element];
  const personaDesc = getPersonaDesc(s);

  openModal(`
    <button class="close" data-act="close">✕</button>
    <div class="detail">
      <div class="detail-slime">${slimeHTML(s,{mood:'idle'})}</div>
      <h3 style="display:flex;align-items:center;justify-content:center;gap:6px;">
        <span>${elementIcon(s.element)} ${esc(s.name)}</span>
        <button class="rename-btn" data-act="rename" data-id="${s.id}" title="改名">✏️</button>
        <button class="btn small" data-act="petlock" data-id="${s.id}" aria-pressed="${!!s.locked}" title="珍爱锁：防止作为副宠消耗">${s.locked?'◇ 已珍爱锁定':'◇ 珍爱锁'}</button>
      </h3>

      <div class="info-grid">
        <div class="info-row"><span>善恶</span><b>${moraleText}</b></div>
        <div class="info-row"><span>等级</span><b class="lv-exp">Lv.${s.level}（${expPct}%）</b></div>
        <div class="info-row"><span>性格</span><b>${s.personality}</b></div>
        <div class="info-row"><span>亲密度</span><b>${s.intimacy||0} · ${bondMilestone(s).name}</b></div>
      </div>
      ${bondProgressHTML(s)}

      <div class="stat-section-title">◈ 基础属性（天赋：${talent}）</div>
      <div class="info-grid">
        <div class="info-row"><span>力量</span><b>${s.str}</b></div>
        <div class="info-row"><span>敏捷</span><b>${s.agi}</b></div>
        <div class="info-row"><span>魔力</span><b>${s.mag}</b></div>
        <div class="info-row"><span>体型</span><b>${s.size.toFixed(3)}</b></div>
        <div class="info-row"><span>幸运</span><b>${s.luck||0}</b></div>
        <div class="info-row"><span>悟性</span><b>${s.wit||0}</b></div>
      </div>

      <div class="stat-section-title">◈ 战斗属性（战力：${power}）</div>
      <div class="info-grid">
        <div class="info-row"><span>血量值</span><b>${hpMax(s)}</b></div>
        <div class="info-row"><span>魔力值</span><b>${manaMax(s)}</b></div>
        <div class="info-row"><span>物理攻击</span><b>${physAtk(s)}</b></div>
        <div class="info-row"><span>魔法攻击</span><b>${magAtk(s)}</b></div>
        <div class="info-row"><span>防御</span><b>${defense(s)}</b></div>
        <div class="info-row"><span>抗性</span><b>${resist(s)}</b></div>
        <div class="info-row"><span>攻击类型</span><b>${damageType(s)==='phys'?'物理':'魔法'}</b></div>
        <div class="info-row"><span>闪避率</span><b>${dodgeRate(s)}%</b></div>
        <div class="info-row"><span>攻击速度</span><b>${atkSpeed(s)}</b></div>
        <div class="info-row"><span>暴击率</span><b>${critRate(s)}%</b></div>
        <div class="info-row"><span>技能</span><b>${s.skill}</b></div>
      </div>

      <div class="stat-section-title">◈ 天赋</div>
      <div class="trait-list">
        ${elemTalent ? `<span class="trait-chip" style="background:rgba(139,123,255,.15);color:var(--accent2);border-color:rgba(139,123,255,.3);">${elemTalent.name} · ${elemTalent.desc}</span>` : ''}
        <span class="trait-chip" style="background:rgba(56,189,248,.15);color:#38bdf8;border-color:rgba(56,189,248,.3);">性格·${s.personality} · ${personaDesc}</span>
      </div>

      <div style="font-size:11.5px;color:var(--muted);margin-bottom:6px;">◈ 系统词条（${s.traits.length}/3）</div>
      <div class="trait-list">
        ${s.traits.length ? s.traits.map(t=>`<span class="trait-chip">${t.n} · ${t.d}</span>`).join('')
                          : '<span class="muted small">暂无词条</span>'}
      </div>
    </div>`);
}

function renameSlime(id){
  const s = getSlime(id); if(!s) return;
  const v = prompt('给这只史莱姆起个名字：', s.name);
  if(v && v.trim()){ s.name = v.trim().slice(0,10); save(); openDetail(id); renderTab(); }
}

function startBallGame(s){
  if(ballGame) return;
  const overlay = document.createElement('div');
  overlay.id = 'gameOverlay';
  overlay.innerHTML = `
    <div class="game-hud">
      <span>⚽ 接住 <b id="gCatch">0</b> 次</span>
      <span>⏱ <b id="gTime">30</b>s</span>
      <button class="hud-close" id="gClose">退出</button>
    </div>
    <div class="game-field" id="gameField">
      ${Array.from({length:14}).map(()=>`<div class="bg-star" style="left:${rnd(2,98)}%;top:${rnd(2,98)}%;"></div>`).join('')}
      <div class="catch-zone"></div>
      <div class="catch-line"></div>
      <div class="out-line"></div>
      <div class="game-slime" id="gameSlime">${slimeHTML(s,{mood:'idle'})}</div>
      <div class="game-ball" id="gameBall"></div>
    </div>
  `;
  $('#app').appendChild(overlay);
  const field = overlay.querySelector('#gameField');
  const slimeEl = overlay.querySelector('#gameSlime');
  const ballEl = overlay.querySelector('#gameBall');
  const G = {
    slime: s, catches: 0, timeLeft: 30, running: true,
    field, slimeEl, ballEl,
    slimeX: 50, ballX: 50, ballY: 75,
    ballState: 'ready', animId: null, timers: []
  };
  ballGame = G;
  slimeEl.style.left = '50%';
  slimeEl.style.top = '30%';
  function placeBall(x, y){
    G.ballX = x; G.ballY = y;
    ballEl.style.left = x + '%';
    ballEl.style.top = y + '%';
  }
  function showBall(v){ ballEl.classList.toggle('hidden', !v); }
  placeBall(50, 75);
  showBall(true);
  const slimeTimer = setInterval(()=>{
    if(!G.running) return;
    if(G.ballState === 'toSlime') return;
    G.slimeX = clamp(G.slimeX + rnd(-18,18), 18, 82);
    slimeEl.style.left = G.slimeX + '%';
    slimeEl.dataset.mood = Math.random()<0.5 ? 'jump' : 'crawl';
    setTimeout(()=>{ if(slimeEl && G.running) slimeEl.dataset.mood = 'idle'; }, 900);
  }, 1300);
  G.timers.push(slimeTimer);
  const clock = setInterval(()=>{
    if(!G.running) return;
    G.timeLeft--;
    overlay.querySelector('#gTime').textContent = Math.max(0, G.timeLeft);
    if(G.timeLeft <= 0) endGame();
  }, 1000);
  G.timers.push(clock);
  field.addEventListener('pointerdown', ev=>{
    if(!G.running) return;
    if(G.ballState !== 'ready' && G.ballState !== 'toPlayer') return;
    const rect = field.getBoundingClientRect();
    const bx = rect.left + (G.ballX/100)*rect.width;
    const by = rect.top + (G.ballY/100)*rect.height;
    const dx = ev.clientX - bx;
    const dy = ev.clientY - by;
    if(Math.sqrt(dx*dx + dy*dy) > 50) return;
    if(G.ballState === 'ready'){
      G.ballState = 'toSlime';
      flyToSlime();
    } else {
      G.catches++;
      overlay.querySelector('#gCatch').textContent = G.catches;
      G.ballState = 'toSlime';
      flyToSlime();
    }
  });
  function flyToSlime(){
    const startX = G.ballX, startY = G.ballY;
    const targetX = G.slimeX, targetY = 30;
    const dur = 420;
    const t0 = performance.now();
    function step(now){
      if(!G.running) return;
      const p = Math.min(1, (now - t0)/dur);
      const x = startX + (targetX-startX)*p;
      const y = startY + (targetY-startY)*p;
      placeBall(x,y);
      if(p < 1){
        G.animId = requestAnimationFrame(step);
      } else {
        slimeEl.dataset.mood = 'happy';
        setTimeout(()=>{ if(slimeEl && G.running) slimeEl.dataset.mood = 'idle'; }, 700);
        G.ballState = 'toPlayer';
        fallDown();
      }
    }
    G.animId = requestAnimationFrame(step);
  }
  function fallDown(){
    const base = 23 + G.catches * 0.015;
    const variation = rnd(0.8, 1.25);
    const speedY = clamp(base * variation, 15, 40);
    const drift = rnd(-7, 7);
    let lastNow = performance.now();
    function step(now){
      if(!G.running) return;
      const dt = Math.min(0.05, (now - lastNow)/1000);
      lastNow = now;
      G.ballY += speedY * dt;
      G.ballX = clamp(G.ballX + drift * dt, 6, 94);
      placeBall(G.ballX, G.ballY);
      if(G.ballY >= 83.33){
        G.ballState = 'gone';
        showBall(false);
        setTimeout(()=>{
          if(!G.running) return;
          placeBall(50, 75);
          showBall(true);
          G.ballState = 'ready';
        }, 420);
        return;
      }
      G.animId = requestAnimationFrame(step);
    }
    G.animId = requestAnimationFrame(step);
  }
  function endGame(){
    if(!G.running) return;
    G.running = false;
    G.timers.forEach(t=>clearInterval(t));
    if(G.animId) cancelAnimationFrame(G.animId);
    const catches = G.catches;
    const moodGain = catches * 3;
    const intimacyGain = Math.floor(catches / 10);
    s.mood = clamp(s.mood + moodGain, 0, 100);
    s.intimacy = (s.intimacy||0) + intimacyGain;
    save();
    overlay.remove();
    ballGame = null;
    if(activeTab === 'space') renderTab();
    if(catches > 0){
      toast(`⚽ 游戏结束！\n接住 ${catches} 次\n心情 +${moodGain}　亲密度 +${intimacyGain}`, 'good');
    } else {
      toast(`⚽ 游戏结束！\n这次没有接住皮球……\n下次加油～`);
    }
  }
  overlay.querySelector('#gClose').addEventListener('click', endGame);
}

function startStackGame(){
  if(stackGame) return;
  const idleSlimes = S.slimes.filter(s=>!isDispatched(s));
  if(idleSlimes.length < 1){
    toast('空间中没有自由活动的史莱姆，无法进行游戏');
    return;
  }
  const overlay = document.createElement('div');
  overlay.id = 'gameOverlay';
  const recordNow = S.stackRecord || 0;
  overlay.innerHTML = `
    <div class="game-hud">
      <span>🧱 最高纪录 <b id="gRecord">${recordNow}</b></span>
      <span style="font-size:11px;color:var(--muted);">点击屏幕让史莱姆落下</span>
      <button class="hud-close" id="gClose">退出</button>
    </div>
    <div class="game-field" id="gameField" style="overflow:hidden;">
      <div id="gCount" style="position:absolute;left:50%;top:14.28%;transform:translate(-50%,-50%);
        font-size:52px;font-weight:900;line-height:1;color:var(--text);opacity:.85;
        pointer-events:none;z-index:60;text-shadow:0 2px 14px rgba(0,0,0,.45);">0</div>
      ${Array.from({length:14}).map(()=>`<div class="bg-star" style="left:${rnd(2,98)}%;top:${rnd(2,98)}%;"></div>`).join('')}
    </div>
  `;
  $('#app').appendChild(overlay);
  const field = overlay.querySelector('#gameField');
  requestAnimationFrame(()=>{
    const W = field.clientWidth;
    const H = field.clientHeight;
    if(!W || !H){ setTimeout(()=>{ overlay.remove(); stackGame=null; }, 100); return; }
    const pool = idleSlimes;
    let usedIndex = 0;
    let activeEl = null;
    let activeObj = null;
    let activeX = 15;
    let activeDir = 1;
    let state = 'moving';
    let dropY = 0;
    const dropSpeed = H * 0.9;
    const stack = [];
    let lastT = 0;
    const G = { running: true };
    stackGame = G;
    const countEl = overlay.querySelector('#gCount');
    function getSize(s){
      const sz = clamp(s.size || 1, 0.6, 1.6);
      const w = 56 * sz;
      const h = w * 118 / 140;
      return {w, h};
    }
    function buildSlimeEl(s){
      const {w, h} = getSize(s);
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      el.style.pointerEvents = 'none';
      const inner = document.createElement('div');
      inner.style.position = 'absolute';
      inner.style.left = '50%';
      inner.style.bottom = '0';
      inner.style.transformOrigin = '50% 100%';
      inner.style.transform = `translateX(-50%) scale(${w/140})`;
      inner.innerHTML = slimeHTML(s, {mood:'idle'});
      el.appendChild(inner);
      return {el, w, h};
    }
    function spawnActive(){
      if(!G.running) return;
      const s = pool[usedIndex % pool.length];
      const {el, w, h} = buildSlimeEl(s);
      const lastTop = stack.length ? stack[stack.length - 1].topY : (H * 0.2 - h/2);
      let topY = Math.min(H * 0.2 - h/2, lastTop - h * 1.5);
      topY = Math.max(-h * 1.2, topY);
      el.style.top = topY + 'px';
      activeEl = el;
      activeObj = {slime: s, w, h};
      updateActiveLeft();
      field.appendChild(el);
    }
    function updateActiveLeft(){
      if(!activeEl || !activeObj) return;
      const x = W * activeX / 100 - activeObj.w / 2;
      activeEl.style.left = x + 'px';
    }
    function trimOutOfScreen(){
      stack.forEach(it=>{
        if(it.el && it.topY + it.h < 0){
          it.el.remove();
          it.el = null;
        }
      });
    }
    function placeCurrent(){
      const item = {
        slime: activeObj.slime, w: activeObj.w, h: activeObj.h,
        centerX: activeX, topY: dropY, el: activeEl
      };
      stack.push(item);
      usedIndex++;
      countEl.textContent = stack.length;
      if(stack.length > (S.stackRecord||0)){
        S.stackRecord = stack.length;
        overlay.querySelector('#gRecord').textContent = S.stackRecord;
      }
      const fx = document.createElement('div');
      fx.style.position = 'absolute';
      fx.style.left = (activeX + '%');
      fx.style.top = dropY + 'px';
      fx.style.transform = 'translate(-50%,-100%)';
      fx.style.fontSize = '18px';
      fx.style.color = '#4ade80';
      fx.style.fontWeight = '800';
      fx.style.pointerEvents = 'none';
      fx.style.zIndex = 50;
      fx.textContent = '✓';
      field.appendChild(fx);
      setTimeout(()=>fx.remove(), 600);
      activeEl.style.zIndex = 10 + stack.length;
      activeEl = null;
      activeObj = null;
      const last = stack[stack.length - 1];
      const limitY = H * 0.55;
      if(last.topY < limitY){
        const shift = limitY - last.topY;
        stack.forEach(it=>{
          it.topY += shift;
          if(it.el){
            it.el.style.transition = 'top .18s ease';
            it.el.style.top = it.topY + 'px';
            setTimeout(()=>{ if(it.el) it.el.style.transition = ''; }, 200);
          }
        });
      }
      trimOutOfScreen();
      setTimeout(()=>{
        if(!G.running) return;
        spawnActive();
        state = 'moving';
      }, 280);
    }
    function loop(t){
      if(!G.running) return;
      if(!lastT) lastT = t;
      const dt = Math.min(0.05, (t - lastT)/1000);
      lastT = t;
      if(state === 'moving' && activeEl){
        activeX += activeDir * 32 * dt;
        if(activeX > 90){ activeX = 90; activeDir = -1; }
        if(activeX < 10){ activeX = 10; activeDir = 1; }
        updateActiveLeft();
      } else if(state === 'dropping' && activeEl){
        dropY += dropSpeed * dt;
        activeEl.style.top = dropY + 'px';
        const bottomY = dropY + activeObj.h;
        const prev = stack[stack.length - 1];
        if(!prev){
          if(bottomY >= H){
            dropY = H - activeObj.h;
            activeEl.style.top = dropY + 'px';
            placeCurrent();
          }
        } else {
          if(bottomY >= prev.topY){
            const dxPx = Math.abs(W * (activeX - prev.centerX) / 100);
            const limit = prev.w / 4;
            if(dxPx <= limit){
              const overlap = Math.min(4, Math.round(activeObj.h * 0.08));
              dropY = prev.topY - activeObj.h + overlap;
              activeEl.style.top = dropY + 'px';
              placeCurrent();
            } else {
              if(dropY > H){ endGame(); return; }
            }
          } else if(dropY > H){ endGame(); return; }
        }
      }
      requestAnimationFrame(loop);
    }
    field.addEventListener('click', ()=>{
      if(!G.running) return;
      if(state === 'moving' && activeEl){
        state = 'dropping';
        dropY = parseFloat(activeEl.style.top) || (H*0.2 - activeObj.h/2);
      }
    });
    function endGame(){
      if(!G.running) return;
      G.running = false;
      const n = stack.length;
      const isNewRecord = n > recordNow;
      const gains = {};
      stack.forEach(item=>{
        const id = item.slime.id;
        gains[id] = (gains[id]||0) + 1;
      });
      Object.keys(gains).forEach(id=>{
        const slime = S.slimes.find(x=>x.id === +id);
        if(slime){
          slime.mood = clamp(slime.mood + gains[id] * 5, 0, 100);
          slime.intimacy = (slime.intimacy||0) + gains[id];
        }
      });
      save();
      overlay.remove();
      stackGame = null;
      if(activeTab === 'space') renderTab();
      if(n > 0){
        if(isNewRecord){
          toast(`🧱 叠叠乐结束！\n成功叠放 ${n} 只史莱姆\n🎉 新纪录！最高 ${n} 只`, 'good');
        } else {
          toast(`🧱 叠叠乐结束！\n成功叠放 ${n} 只史莱姆\n历史最高 ${recordNow} 只\n史莱姆们的心情和亲密度提升了`, 'good');
        }
      } else {
        toast(`🧱 叠叠乐结束！\n没有叠放成功……\n下次加油～`);
      }
    }
    overlay.querySelector('#gClose').addEventListener('click', endGame);
    spawnActive();
    requestAnimationFrame(loop);
  });
}

/* ==================== 战斗特效门面 FX ==================== */
/* 只做 DOM 演出，不参与战斗结算；战斗侧只管调用 */
