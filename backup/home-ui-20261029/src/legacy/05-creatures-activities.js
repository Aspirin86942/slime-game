function createSlime(forceMonster){
  const element = pickElement(summonBoost);
  const isMon = !!forceMonster;
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
  const s = {id, name:`${element}${nameNo}`, element, morality,personality: pick(PERSONALITIES),mood:70, stamina:initStaminaMax, traits,level:1, exp:0, size:baseSize, resting:false,intimacy:0, starred:false, mergeCount:0,strPotential, agiPotential, magPotential, luck, wit,str, agi, mag};
  s.hp = hpMax(s);
  if(forceMonster){
    s.isMonster = true;
    s.monSat = rnd(18,58);
    s.monLight = rnd(14,34);
  }
  s.skill = HEAL_ELEMENTS.includes(element) ? '治疗' : '元素弹';
  return s;
}

function doSummon(){
  const slots = getSlots();
  if(S.slimes.length >= slots){ toast(`召唤空间已满（${slots}）\n提升召唤师等级可扩充`); return; }
  const s = createSlime(false);
  S.slimes.push(s);
  summonBoost = {};
  addTaskProgress('summon', 1);
  save();
  const traitText = s.traits.length ? s.traits.map(t=>`<span data-tip="${esc(t.d)}">${t.n}</span>`).join('') : '';
  openModal(`<div class="summon-result"><div class="sr-title">召 唤 成 功</div><div class="sr-slime">${slimeHTML(s,{mood:'jump'})}</div><div class="sr-name">${esc(s.name)}</div><div class="sr-props"><span>${ELEMENTS[s.element].icon} ${s.element}属性</span><span>天赋 ${calcTalent(s)}</span><span>善恶 ${s.morality}</span><span data-tip="${esc(getPersonaDesc(s))}">${s.personality}</span><span>体型 ${s.size.toFixed(2)}</span><span>Lv.${s.level}</span><span>力 ${s.str}</span><span>敏 ${s.agi}</span><span>魔 ${s.mag}</span><span>技能 · ${s.skill}</span>${traitText}</div><button class="btn gold full" data-act="close">好耶！</button></div>`);
  renderTab();
}

function doBreakthrough(){if(!S.breakPending){ return; }S.breakPending = false;S.summonerExp = 0;save(); renderTop(); renderTab();toast(`⚡ 突破成功！\n召唤师 Lv.${S.level}，召唤位 ${getSlots()}`, 'good');}
function growthStat(potential, level){const p = Math.max(0, Number(potential)||0);return p + Math.max(0, (Number(level)||1)-1) * Math.round(p * 0.5);}
function growthStats(s, newLevel, potentials){const out = {};for(const key of ['str','agi','mag']){const potKey = key + 'Potential';const nextPot = potentials && Number.isFinite(potentials[potKey]) ? potentials[potKey] : s[potKey];out[key] = (Number(s[key])||0) + Math.max(0,growthStat(nextPot, newLevel) - growthStat(s[potKey], s.level));}return out;}
function addExp(s, amount){const rate = expRate(s);const actual = Math.max(0, Math.round((Number(amount)||0) * rate));if(!Number.isFinite(actual) || actual <= 0) return false;addSummonerExp(Math.max(1, Math.round(actual * 0.1)));s.exp = (Number(s.exp)||0) + actual;let leveled = false;while(s.exp >= slimeExpNeed(s.level)){s.exp -= slimeExpNeed(s.level);const nextLevel = s.level + 1;Object.assign(s, growthStats(s, nextLevel));s.level = nextLevel;s.size = +(s.size + 0.0016).toFixed(3);leveled = true;}if(leveled) s.hp = hpMax(s);return leveled;}
function buyItem(k, qty){qty = qty || 1;const it = ITEMS[k];const total = it.price * qty;if(k === 'ticket'){if(S.points < total){ toast(`系统积分不足（需要 ${total} 积分）`); return; }S.points -= total;S.bag.ticket = (S.bag.ticket||0) + qty;save(); renderTop(); renderTab();toast(`购买成功：${it.name} ×${qty}`, 'good');return;}if(k === 'expPotion'){if(S.coins < total){ toast('晶币不足'); return; }S.coins -= total;let used = false;for(let i=0;i<qty;i++){if(autoUseExpPotionSilent()) used = true;else S.bag.expPotion = (S.bag.expPotion||0) + 1;}save(); renderTop(); renderTab();if(used) toast(`🧪 经验药水已自动使用于等级最低的史莱姆`, 'good');else toast('没有史莱姆，经验药水已暂存');return;}if(S.coins < total){ toast('晶币不足'); return; }S.coins -= total;S.bag[k] = (S.bag[k]||0) + qty;save(); renderTop(); renderTab();toast(`购买成功：${it.name} ×${qty}`, 'good');}

let mergeSel = [];
let mergePreviewSignature = '';
function mergeStateSignature(a, b){const fields = ['id','name','element','level','exp','intimacy','size','str','agi','mag','strPotential','agiPotential','magPotential','luck','wit','traits','mergeCount'];return JSON.stringify([a,b].map(s=>fields.map(k=>s && s[k])));}
function mergeCost(a, b){const count = Math.max(0, Math.floor(Number(a.mergeCount)||0));return 500 + 100 * Math.max(a.level, b.level) + 250 * count * (count + 1);}
function mergePreview(a, b){if(a&&b&&(LivingWorld.isBusy(S,a.id)||LivingWorld.isBusy(S,b.id)))return {valid:false,reason:'请先让伙伴结束当前活动'};if(!a || !b || a === b || a.id === b.id) return {valid:false, reason:'请选择两只不同的史莱姆'};if(b.locked) return {valid:false,reason:'请先解除伙伴的珍爱锁'};if(a.isMonster) return {valid:false, reason:'魔物不能作为主史莱姆'};return {valid:true, cost:mergeCost(a,b), level:Math.max(a.level, b.level)};}
function unknownSlimeHTML(showQ){
  return `<div class="slime merge-unknown" data-mood="idle" style="--h:0;--s:0%;--l:62%;--eh:0;--es:0%;--el:30%;"><div class="shadow"></div><div class="anim"><div class="breath"><div class="blob outer"></div><div class="blob inner"></div>${showQ ? '<div class="merge-q">?</div>' : ''}</div></div></div>`;
}
function mergeSlotHTML(role, col, row){
  const idx = role==='main' ? 0 : 1;
  const s = mergeSel[idx] ? getSlime(mergeSel[idx]) : null;
  const label = role==='main' ? '主宠' : '副宠';
  const inner = s
    ? `<div class="merge-sel-img">${slimeHTML(s,{mood:'idle'})}</div><div class="merge-slot-line"><span class="merge-slot-label">${label}</span><span class="merge-sel-name">${esc(s.name)} Lv.${s.level}</span></div>`
    : `<div class="merge-choose-wrap">${unknownSlimeHTML(false)}<span class="merge-choose-text">请选择</span></div><div class="merge-slot-line"><span class="merge-slot-label">${label}</span></div>`;
  return `<div class="merge-slot ${role}" style="grid-column:${col};grid-row:${row};" data-act="mergepick" data-role="${role}">${inner}</div>`;
}
function mergeTraitsHTML(a, b){
  if(!a) return '';
  const chips = [`<span class="merge-trait persona" data-merge-tip="${esc(getPersonaDesc(a))}">${esc(a.personality)}</span>`];
  const aTraits = a.traits || [];
  aTraits.slice(0,3).forEach(t=>chips.push(`<span class="merge-trait" data-merge-tip="${esc(t.d)}">${esc(t.n)}</span>`));
  if(b && aTraits.length < 3){
    const bTraits = b.traits || [];
    if(bTraits.some(bt=>!aTraits.some(t=>t.n===bt.n))){
      chips.push('<span class="merge-trait unknown">?</span>');
    }
  }
  return chips.join('');
}
function mergeResultColHTML(a, b){
  let imgHTML = '';
  if(!a || !b){
    imgHTML = `<div class="merge-init-item">${unknownSlimeHTML(true)}</div>`;
  } else if(a.element === b.element){
    imgHTML = `<div class="merge-same-item"><div class="merge-img-wrap">${slimeHTML(a,{mood:'idle'})}</div><div class="merge-prob-single">100%</div></div>`;
  } else {
    imgHTML = `<div class="merge-tri-top merge-tri-item"><div class="merge-img-wrap">${slimeHTML(a,{mood:'idle'})}</div><div class="merge-prob-single">主 80%</div></div><div class="merge-tri-row"><div class="merge-tri-item"><div class="merge-img-wrap">${slimeHTML(b,{mood:'idle'})}</div><div class="merge-prob-single">副 18%</div></div><div class="merge-tri-item"><div class="merge-img-wrap">${unknownSlimeHTML(true)}</div><div class="merge-prob-single">变异 2%</div></div></div>`;
  }
  const traitsHTML = a ? `<div class="merge-result-traits" style="margin-top:6px;">${mergeTraitsHTML(a,b)}</div>` : '';
  return `<div class="merge-result-stack">${imgHTML}${traitsHTML}</div>`;
}
function openMerge(){
  const a = mergeSel[0] ? getSlime(mergeSel[0]) : null;
  const b = mergeSel[1] ? getSlime(mergeSel[1]) : null;
  const p = (a && b) ? mergePreview(a,b) : null;
  const valid = !!(p && p.valid);
  mergePreviewSignature = valid ? mergeStateSignature(a,b) : '';
  const disabled = !valid || S.coins < p.cost;
  const infoHTML = a ? `<div class="merge-result-level">${valid ? `Lv.${a.level}→${p.level}` : `Lv.${a.level}→?`}</div>${valid ? `<div class="merge-cost">${p.cost} 晶币</div>` : ''}` : '';
  openModal(`
    <button class="close" data-act="close">✕</button>
    <h3 style="text-align:center;margin:0 0 6px;color:var(--accent2);">史莱姆合体</h3>
    <div class="merge-layout">
      ${mergeSlotHTML('main',1,1)}
      <div class="merge-plus" style="grid-column:1;grid-row:2;">+</div>
      ${mergeSlotHTML('sub',1,3)}
      <div class="merge-center-col" style="grid-column:2;grid-row:1/4;">
        <button class="btn gold merge-btn" data-act="mergeconfirm" ${disabled?'disabled':''}>合体</button>
        ${infoHTML}
      </div>
      <div class="merge-result-col" style="grid-column:3;grid-row:1/4;">${mergeResultColHTML(a,b)}</div>
    </div>
    <div class="merge-rule-box">注：主宠保留名字、ID、善恶、亲密度。主副存在相同词条，则强化20%；主宠词条不足3条时，概率获得副宠词条。</div>
  `);
}
function mergePickCard(s, role){
  return `<div class="merge-pick-card" data-act="mergepickselect" data-id="${s.id}" data-role="${role}"><div class="scale-box sm">${slimeHTML(s,{mood:'idle'})}</div><div class="merge-pick-name"><span class="merge-pick-elem">${ELEMENTS[s.element].icon}</span><b>${esc(s.name)}</b><span class="merge-pick-lv">Lv.${s.level}</span></div></div>`;
}
function openMergePicker(role){
  const otherId = role==='main' ? mergeSel[1] : mergeSel[0];
  const source = role==='main' ? S.slimes : [...S.slimes, ...S.monsters];
  const list = sortStarred(source.filter(s=>s.id !== otherId));
  openModal(`<button class="close" data-act="mergepickcancel">✕</button><h3 style="text-align:center;margin:0 0 6px;color:var(--accent2);">选择${role==='main'?'主宠':'副宠'}</h3><div class="merge-picker-grid">${list.length ? list.map(s=>mergePickCard(s,role)).join('') : '<p class="muted small">没有可选的史莱姆</p>'}</div><button class="btn full themed" data-act="mergepickcancel" style="margin-top:10px;">返回</button>`);
}
function doMerge(){
  if(!canWrite())return;
  const a = mergeSel[0] ? getSlime(mergeSel[0]) : null;
  const b = mergeSel[1] ? getSlime(mergeSel[1]) : null;
  if(!a || !b) return;
  const preview = mergePreview(a,b);
  if(!preview.valid){ toast(preview.reason); return; }
  if(mergePreviewSignature && mergePreviewSignature !== mergeStateSignature(a,b)){ openMerge(); toast('宠物在预览期间获得了成长，已更新预览；请再次确认费用与继承结果'); return; }
  if(S.coins < preview.cost){ openMerge(); toast(`晶币不足，合体需要 ${preview.cost} 晶币`); return; }
  const potBonus = Math.random() < 0.25 ? rndInt(1,3) : 0;
  const pots = {};
  for(const key of ['strPotential','agiPotential','magPotential']) pots[key] = Math.max(a[key], Math.min(40, a[key] + potBonus));
  const stats = growthStats(a, preview.level, pots);
  const mergedTraits = (a.traits||[]).map(t=>({...t}));
  (b.traits||[]).forEach(bt=>{
    const mt = mergedTraits.find(t=>t.n===bt.n);
    if(mt){ mt.v = +(mt.v * 1.2).toFixed(4); refreshTraitDesc(mt); }
    else if(mergedTraits.length < 3 && Math.random() < 0.5){ const nt = {...bt}; refreshTraitDesc(nt); mergedTraits.push(nt); }
  });
  const newSize = Math.random() < 0.1 ? +(a.size + b.size * 0.008).toFixed(3) : a.size;
  let newElement = a.element;
  if(a.element !== b.element){
    const r = Math.random();
    if(r >= 0.80 && r < 0.98) newElement = b.element;
    else if(r >= 0.98) newElement = pick(['草','冰','雷','幻','光','暗','空间','时间']);
  }
  ensureProgress();
  S.coins -= preview.cost;
  Object.assign(a, pots, stats, {element:newElement, level:preview.level, traits:mergedTraits, size:newSize,luck:Math.max(a.luck||0, Math.min(20, (a.luck||0) + (potBonus?1:0))),wit:Math.max(a.wit||0, Math.min(20, (a.wit||0) + (potBonus?1:0))),mergeCount:(Math.max(0, Math.floor(Number(a.mergeCount)||0)))+1});
  a.skill = HEAL_ELEMENTS.includes(newElement) ? '治疗' : '元素弹';
  a.hp = Math.min(a.hp, hpMax(a));
  LivingWorld.archiveCompanion(S,b.id);
  S.slimes = S.slimes.filter(s=>s!==b);
  S.monsters = S.monsters.filter(s=>s!==b);
  delete S.customPlans[b.id];
  if(Array.isArray(S.exploreTeam)) S.exploreTeam = S.exploreTeam.filter(id=>id!==b.id);
  if(Array.isArray(S.lastAbyssSel)) S.lastAbyssSel = S.lastAbyssSel.filter(id=>id!==b.id);
  ensureProgress();
  mergeSel = [];
  mergePreviewSignature = '';
  save(); renderTop(); renderTab(); closeModal();
  toast(`合体完成：${a.name} 仍是你的老朋友！\n消耗 ${preview.cost} 晶币 · Lv.${a.level} · 天赋 ${calcTalent(a)}\n${b.name} 已被消耗；主宠名字、经验与亲密度保留`, 'good');
}

let modalBackup = null;
function openModal(html){modalBackup = null;$('#modalBox').innerHTML = html;$('#modalLayer').classList.remove('hidden');refreshUIIcons($('#modalBox'));}
function closeModal(){$('#modalLayer').classList.add('hidden');$('#modalBox').innerHTML = '';modalBackup = null;}
function closeTopModal(){
  if(modalBackup){
    const html = modalBackup;
    modalBackup = null;
    $('#modalBox').innerHTML = html;
    $('#modalLayer').classList.remove('hidden');
    refreshUIIcons($('#modalBox'));
  } else {
    closeModal();
  }
}

/* 合体词条气泡：宽度=第2列+第3列+gap；右侧与布局右边缘对齐；三角形位于词条标签中心 */
function showMergeTip(chip){
  const wrap = chip.closest('.merge-result-traits');
  const layout = chip.closest('.merge-layout');
  if(!wrap || !layout) return;
  let bubble = wrap.querySelector('.merge-tip-bubble');
  if(!bubble){
    bubble = document.createElement('div');
    bubble.className = 'merge-tip-bubble';
    wrap.appendChild(bubble);
  }
  bubble.textContent = chip.dataset.mergeTip || '';
  // 计算列宽
  const layoutRect = layout.getBoundingClientRect();
  const cs = window.getComputedStyle(layout);
  const gap = parseFloat(cs.columnGap) || 6;
  const total = layoutRect.width - gap * 2;
  const frSum = 1.25 + 0.7 + 1.25;
  const col2W = 0.7 / frSum * total;
  const col3W = 1.25 / frSum * total;
  const bubbleW = col2W + col3W + gap;
  // 右侧与布局右边缘对齐
  const bubbleRight = layoutRect.right;
  const bubbleLeft = bubbleRight - bubbleW;
  const wrapRect = wrap.getBoundingClientRect();
  const chipRect = chip.getBoundingClientRect();
  bubble.style.left = (bubbleLeft - wrapRect.left) + 'px';
  bubble.style.top = (chipRect.bottom - wrapRect.top + 9) + 'px';
  bubble.style.width = bubbleW + 'px';
  // 三角形位于词条标签正下方（相对气泡内部）
  const tailX = (chipRect.left + chipRect.width / 2) - bubbleLeft;
  bubble.style.setProperty('--tail-x', Math.max(8, Math.min(bubbleW - 8, tailX)) + 'px');
}

function openDetail(id){
  const s = getSlime(id); if(!s) return;
  const power = slimePower(s);
  const talent = calcTalent(s);
  const isMon = !!s.isMonster;
  const expPct = clamp(Math.floor(s.exp / slimeExpNeed(s.level) * 100), 0, 100);
  const elemTalent = ELEMENT_TALENTS[s.element];
  const personaDesc = getPersonaDesc(s);
  const on = !!s.starred;
  const sk = SKILLS[s.element];
  const chip = (title, desc) => `<span class="trait-chip" data-act="chipInfo" data-title="${esc(title)}" data-desc="${esc(desc)}">${esc(title)}</span>`;
  openModal(`
    <button class="close" data-act="close" title="关闭">✕</button>
    <div class="detail">
      <div class="detail-slime">
        <div class="detail-marks">
          <div class="dm-row">
            <span class="detail-star-wrap"><button class="detail-star-btn" data-act="toggleStar" data-id="${s.id}" aria-label="特别关注"></button><span class="detail-star ${on?'on':''}">★</span></span>
            <span class="dm-text">Lv.${s.level}（${expPct}%）</span>
          </div>
          <div class="dm-row">
            <span class="detail-heart">${heartIcon(heartColor(s))}</span>
            <span class="dm-text">${bondMilestone(s).name} · ${s.intimacy||0}</span>
          </div>
        </div>
        ${slimeHTML(s,{mood:'idle'})}
      </div>
      <h3 style="display:flex;align-items:center;justify-content:center;gap:6px;">
        <span>${ELEMENTS[s.element].icon} ${esc(s.name)}</span>
        <button class="rename-btn" data-act="rename" data-id="${s.id}" title="改名">✏️</button>
      </h3>
      <div class="stat-section-title">◈ 基础属性（天赋：${talent}）</div>
      <div class="info-grid">
        <div class="info-row"><span>力量</span><b>${s.str}</b></div>
        <div class="info-row"><span>敏捷</span><b>${s.agi}</b></div>
        <div class="info-row"><span>魔力</span><b>${s.mag}</b></div>
        <div class="info-row"><span>体型</span><b>${s.size.toFixed(3)}</b></div>
        <div class="info-row"><span>幸运</span><b>${s.luck||0}</b></div>
        <div class="info-row"><span>悟性</span><b>${s.wit||0}</b></div>
      </div>
      <div class="stat-section-title">◈ 战斗属性（战力：${power}）${isMon?' · 深渊侵蚀 ×2':''}</div>
      <div class="info-grid">
        <div class="info-row"><span>血量值</span><b>${hpMax(s)}</b></div>
        <div class="info-row"><span>魔力值</span><b>${manaMax(s)}</b></div>
        <div class="info-row"><span>物理攻击</span><b>${physAtk(s)}</b></div>
        <div class="info-row"><span>魔法攻击</span><b>${magAtk(s)}</b></div>
        <div class="info-row"><span>闪避率</span><b>${dodgeRate(s)}%</b></div>
        <div class="info-row"><span>攻击速度</span><b>${atkSpeed(s)}</b></div>
        <div class="info-row"><span>暴击率</span><b>${critRate(s)}%</b></div>
      </div>
      <div class="stat-section-title">◈ 天赋</div>
      <div class="trait-list">
        ${elemTalent ? chip(`${s.element}·${elemTalent.name}`, elemTalent.desc) : ''}
        ${chip(`性格·${s.personality}`, personaDesc)}
        ${(s.traits||[]).map(t=>chip(t.n, t.d)).join('')}
      </div>
      <div class="stat-section-title">◈ 技能</div>
      <div class="trait-list">
        ${chip('普攻', '对单个敌人造成 100% 物理攻击伤害，并附带本元素的常规效果。')}
        ${sk ? `<span class="trait-chip skill-chip" data-act="chipInfo" data-title="${esc(sk.name)}" data-desc="${esc(SKILL_DESC[s.element]||'')}">${esc(sk.name)}</span>` : ''}
      </div>
    </div>`);
}

function renameSlime(id){const s = getSlime(id); if(!s) return;const v = prompt('给这只史莱姆起个名字：', s.name);if(v && v.trim()){ s.name = v.trim().slice(0,10); save(); openDetail(id); renderTab(); }}

function startBallGame(s){
  if(ballGame||!canWrite()||hasExplorePlan(s)||!LivingWorld.reserve(S,[s.id],'play')) return;
  const overlay = document.createElement('div');
  overlay.id = 'gameOverlay';
  overlay.innerHTML = `<div class="game-hud"><span>⚽ 接住 <b id="gCatch">0</b> 次</span><span>⏱ <b id="gTime">30</b>s</span><button class="hud-close" id="gClose">退出</button></div><div class="game-field" id="gameField">${Array.from({length:14}).map(()=>`<div class="bg-star" style="left:${rnd(2,98)}%;top:${rnd(2,98)}%;"></div>`).join('')}<div class="catch-zone"></div><div class="catch-line"></div><div class="out-line"></div><div class="game-slime" id="gameSlime">${slimeHTML(s,{mood:'idle'})}</div><div class="game-ball" id="gameBall"></div></div>`;
  $('#app').appendChild(overlay);
  const field = overlay.querySelector('#gameField');
  const slimeEl = overlay.querySelector('#gameSlime');
  const ballEl = overlay.querySelector('#gameBall');
  const G = {slime: s, catches: 0, timeLeft: 30, running: true,field, slimeEl, ballEl,slimeX: 50, ballX: 50, ballY: 75,ballState: 'ready', animId: null, timers: []};
  ballGame = G;
  slimeEl.style.left = '50%';
  slimeEl.style.top = '30%';
  function placeBall(x, y){G.ballX = x; G.ballY = y;ballEl.style.left = x + '%';ballEl.style.top = y + '%';}
  function showBall(v){ ballEl.classList.toggle('hidden', !v); }
  placeBall(50, 75);
  showBall(true);
  const slimeTimer = setInterval(()=>{if(!G.running||!canWrite()) return;if(G.ballState === 'toSlime') return;G.slimeX = clamp(G.slimeX + rnd(-18,18), 18, 82);slimeEl.style.left = G.slimeX + '%';slimeEl.dataset.mood = Math.random()<0.5 ? 'jump' : 'crawl';setTimeout(()=>{ if(slimeEl && G.running) slimeEl.dataset.mood = 'idle'; }, 900);}, 1300);
  G.timers.push(slimeTimer);
  const clock = setInterval(()=>{if(!G.running||!canWrite()) return;G.timeLeft--;overlay.querySelector('#gTime').textContent = Math.max(0, G.timeLeft);if(G.timeLeft <= 0) endGame();}, 1000);
  G.timers.push(clock);
  field.addEventListener('pointerdown', ev=>{if(!G.running||!canWrite()) return;if(G.ballState !== 'ready' && G.ballState !== 'toPlayer') return;const rect = field.getBoundingClientRect();const bx = rect.left + (G.ballX/100)*rect.width;const by = rect.top + (G.ballY/100)*rect.height;const dx = ev.clientX - bx;const dy = ev.clientY - by;if(Math.sqrt(dx*dx + dy*dy) > 50) return;if(G.ballState === 'ready'){G.ballState = 'toSlime';flyToSlime();} else {G.catches++;overlay.querySelector('#gCatch').textContent = G.catches;G.ballState = 'toSlime';flyToSlime();}});
  function flyToSlime(){const startX = G.ballX, startY = G.ballY;const targetX = G.slimeX, targetY = 30;const dur = 420;const t0 = performance.now();function step(now){if(!G.running||!canWrite()) return;const p = Math.min(1, (now - t0)/dur);const x = startX + (targetX-startX)*p;const y = startY + (targetY-startY)*p;placeBall(x,y);if(p < 1){G.animId = requestAnimationFrame(step);} else {slimeEl.dataset.mood = 'happy';setTimeout(()=>{ if(slimeEl && G.running) slimeEl.dataset.mood = 'idle'; }, 700);G.ballState = 'toPlayer';fallDown();}}G.animId = requestAnimationFrame(step);}
  function fallDown(){const base = 23 + G.catches * 0.015;const variation = rnd(0.8, 1.25);const speedY = clamp(base * variation, 15, 40);const drift = rnd(-7, 7);let lastNow = performance.now();function step(now){if(!G.running||!canWrite()) return;const dt = Math.min(0.05, (now - lastNow)/1000);lastNow = now;G.ballY += speedY * dt;G.ballX = clamp(G.ballX + drift * dt, 6, 94);placeBall(G.ballX, G.ballY);if(G.ballY >= 83.33){G.ballState = 'gone';showBall(false);setTimeout(()=>{if(!G.running||!canWrite()) return;placeBall(50, 75);showBall(true);G.ballState = 'ready';}, 420);return;}G.animId = requestAnimationFrame(step);}G.animId = requestAnimationFrame(step);}
  function endGame(){if(!G.running||!canWrite()) return;G.running = false;G.timers.forEach(t=>clearInterval(t));if(G.animId) cancelAnimationFrame(G.animId);const catches = G.catches;const moodGain = catches * 3;const intimacyGain = Math.floor(catches / 10);s.mood = clamp(s.mood + moodGain, 0, 100);s.intimacy = (s.intimacy||0) + intimacyGain;LivingWorld.release(S,'play');save();overlay.remove();ballGame = null;if(activeTab === 'space'||activeTab==='home') renderTab();if(catches > 0){toast(`⚽ 游戏结束！\n接住 ${catches} 次\n心情 +${moodGain}　亲密度 +${intimacyGain}`, 'good');} else {toast(`⚽ 游戏结束！\n这次没有接住皮球……\n下次加油～`);}}
  overlay.querySelector('#gClose').addEventListener('click', endGame);
}

function startStackGame(){
  if(stackGame||!canWrite()||document.getElementById('gameOverlay')) return;
  const idleSlimes = S.slimes.filter(s=>!isDispatched(s)&&!LivingWorld.isBusy(S,s.id));
  if(idleSlimes.length < 1){ toast('空间中没有自由活动的史莱姆，无法进行游戏'); return; }
  if(!LivingWorld.reserve(S,idleSlimes.map(s=>s.id),'play'))return;
  const overlay = document.createElement('div');
  overlay.id = 'gameOverlay';
  const recordNow = S.stackRecord || 0;
  overlay.innerHTML = `<div class="game-hud"><span>🧱 最高纪录 <b id="gRecord">${recordNow}</b></span><span style="font-size:11px;color:var(--muted);">点击屏幕让史莱姆落下</span><button class="hud-close" id="gClose">退出</button></div><div class="game-field" id="gameField" style="overflow:hidden;"><div id="gCount" style="position:absolute;left:50%;top:14.28%;transform:translate(-50%,-50%);font-size:52px;font-weight:900;line-height:1;color:var(--text);opacity:.85;pointer-events:none;z-index:60;text-shadow:0 2px 14px rgba(0,0,0,.45);">0</div>${Array.from({length:14}).map(()=>`<div class="bg-star" style="left:${rnd(2,98)}%;top:${rnd(2,98)}%;"></div>`).join('')}</div>`;
  $('#app').appendChild(overlay);
  const field = overlay.querySelector('#gameField');
  requestAnimationFrame(()=>{
    const W = field.clientWidth;
    const H = field.clientHeight;
    if(!W || !H){ setTimeout(()=>{ LivingWorld.release(S,'play');overlay.remove(); stackGame=null; }, 100); return; }
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
    function getSize(s){const sz = clamp(s.size || 1, 0.6, 1.6);const w = 56 * sz;const h = w * 118 / 140;return {w, h};}
    function buildSlimeEl(s){const {w, h} = getSize(s);const el = document.createElement('div');el.style.position = 'absolute';el.style.width = w + 'px';el.style.height = h + 'px';el.style.pointerEvents = 'none';const inner = document.createElement('div');inner.style.position = 'absolute';inner.style.left = '50%';inner.style.bottom = '0';inner.style.transformOrigin = '50% 100%';inner.style.transform = `translateX(-50%) scale(${w/140})`;inner.innerHTML = slimeHTML(s, {mood:'idle'});el.appendChild(inner);return {el, w, h};}
    function spawnActive(){if(!G.running||!canWrite()) return;const s = pool[usedIndex % pool.length];const {el, w, h} = buildSlimeEl(s);const lastTop = stack.length ? stack[stack.length - 1].topY : (H * 0.2 - h/2);let topY = Math.min(H * 0.2 - h/2, lastTop - h * 1.5);topY = Math.max(-h * 1.2, topY);el.style.top = topY + 'px';activeEl = el;activeObj = {slime: s, w, h};updateActiveLeft();field.appendChild(el);}
    function updateActiveLeft(){if(!activeEl || !activeObj) return;const x = W * activeX / 100 - activeObj.w / 2;activeEl.style.left = x + 'px';}
    function trimOutOfScreen(){stack.forEach(it=>{if(it.el && it.topY + it.h < 0){it.el.remove();it.el = null;}});}
    function placeCurrent(){
      const item = {slime: activeObj.slime, w: activeObj.w, h: activeObj.h,centerX: activeX, topY: dropY, el: activeEl};
      stack.push(item);
      usedIndex++;
      countEl.textContent = stack.length;
      if(stack.length > (S.stackRecord||0)){S.stackRecord = stack.length;overlay.querySelector('#gRecord').textContent = S.stackRecord;}
      const fx = document.createElement('div');
      fx.style.position = 'absolute';fx.style.left = (activeX + '%');fx.style.top = dropY + 'px';fx.style.transform = 'translate(-50%,-100%)';fx.style.fontSize = '18px';fx.style.color = '#4ade80';fx.style.fontWeight = '800';fx.style.pointerEvents = 'none';fx.style.zIndex = 50;fx.textContent = '✓';
      field.appendChild(fx);
      setTimeout(()=>fx.remove(), 600);
      activeEl.style.zIndex = 10 + stack.length;
      activeEl = null;
      activeObj = null;
      const last = stack[stack.length - 1];
      const limitY = H * 0.55;
      if(last.topY < limitY){
        const shift = limitY - last.topY;
        stack.forEach(it=>{it.topY += shift;if(it.el){it.el.style.transition = 'top .18s ease';it.el.style.top = it.topY + 'px';setTimeout(()=>{ if(it.el) it.el.style.transition = ''; }, 200);}});
      }
      trimOutOfScreen();
      setTimeout(()=>{if(!G.running||!canWrite()) return;spawnActive();state = 'moving';}, 280);
    }
    function loop(t){
      if(!G.running||!canWrite()) return;
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
          if(bottomY >= H){dropY = H - activeObj.h;activeEl.style.top = dropY + 'px';placeCurrent();}
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
    field.addEventListener('click', ()=>{if(!G.running||!canWrite()) return;if(state === 'moving' && activeEl){state = 'dropping';dropY = parseFloat(activeEl.style.top) || (H*0.2 - activeObj.h/2);}});
    function endGame(){
      if(!G.running||!canWrite()) return;
      G.running = false;
      const n = stack.length;
      const isNewRecord = n > recordNow;
      const gains = {};
      stack.forEach(item=>{const id = item.slime.id;gains[id] = (gains[id]||0) + 1;});
      Object.keys(gains).forEach(id=>{const slime = S.slimes.find(x=>x.id === +id);if(slime){slime.mood = clamp(slime.mood + gains[id] * 5, 0, 100);slime.intimacy = (slime.intimacy||0) + gains[id];}});
      LivingWorld.release(S,'play');
      save();
      overlay.remove();
      stackGame = null;
      if(activeTab === 'space'||activeTab==='home') renderTab();
      if(n > 0){
        if(isNewRecord){toast(`🧱 叠叠乐结束！\n成功叠放 ${n} 只史莱姆\n🎉 新纪录！最高 ${n} 只`, 'good');}
        else {toast(`🧱 叠叠乐结束！\n成功叠放 ${n} 只史莱姆\n历史最高 ${recordNow} 只\n史莱姆们的心情和亲密度提升了`, 'good');}
      } else {toast(`🧱 叠叠乐结束！\n没有叠放成功……\n下次加油～`);}
    }
    overlay.querySelector('#gClose').addEventListener('click', endGame);
    spawnActive();
    requestAnimationFrame(loop);
  });
}
