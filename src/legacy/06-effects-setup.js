const FX = {
  field: null, log: [], _txt: 0, _part: 0,
  _merge: null, _shakeRank: 0, _shakeKind: '', _shakeRaf: 0,

  /* 记录演出容器（.battle-field） */
  bindField(el){
    this.field = el || null;
    return this.field;
  },
  /* 高速档压缩演出时长 */
  _ts(){
    const sp = (typeof battleSpeed === 'number' && battleSpeed > 0) ? battleSpeed : 1;
    return 1 / Math.max(1, Math.min(2, sp / 2));
  },
  _host(){
    return this.field || document.querySelector('.battle-field') || document.body;
  },
  _record(type, text, cls, kind){
    this.log.push({ t: performance.now(), type, kind: kind || '', text: String(text == null ? '' : text), cls: cls || '' });
    if(this.log.length > 200) this.log.shift();
  },

  /* 震屏：一帧内多次调用只保留最强档 */
  shake(kind){
    const rank = kind === 'crit' ? 2 : (kind === 'kill' ? 3 : 1);
    const k = kind === 'crit' ? 'crit' : (kind === 'kill' ? 'kill' : 'light');
    if(rank > this._shakeRank){ this._shakeRank = rank; this._shakeKind = k; }
    if(this._shakeRaf) return;
    this._shakeRaf = requestAnimationFrame(()=>{
      this._shakeRaf = 0;
      const key = this._shakeKind || 'light';
      this._shakeRank = 0; this._shakeKind = '';
      const el = this._host();
      if(!el || el === document.body) return;
      el.classList.remove('field-shake');
      void el.offsetWidth;
      el.setAttribute('data-k', key);
      el.classList.add('field-shake');
      this._record('shake', key, '', 'shake');
      setTimeout(()=>el.classList.remove('field-shake'), 220);
    });
  },

  /* 命中闪白：打在 .breath 上，暴击额外放大描边 */
  flash(el, isCrit){
    if(el && typeof matchMedia==='function'){const r=el.getBoundingClientRect();LivingWorld.impact(r.left+r.width/2,r.top+r.height/2,'#ffe2ad',isCrit);}
    if(!el) return;
    const tb = (el.querySelector && el.querySelector('.breath')) || el;
    if(!tb || !tb.classList) return;
    tb.classList.remove('hit-flash', 'crit');
    void tb.offsetWidth;
    tb.classList.add('hit-flash');
    if(isCrit) tb.classList.add('crit');
    setTimeout(()=>tb.classList.remove('hit-flash', 'crit'), isCrit ? 280 : 200);
  },

  /* 飘字：同目标 250ms 内同 cls 的纯数字合并累加 */
  float(el, text, opt){
    const o = opt || {};
    if(!el) return null;
    const field = this._host();
    const cls = o.cls || '';
    const icon = o.icon || '';
    const raw = String(text == null ? '' : text);
    const mm = /^(-?\d+)(.*)$/.exec(raw);
    const num = mm ? parseInt(mm[1], 10) : null;
    const suffix = mm ? mm[2] : '';
    const now = performance.now();
    const m = this._merge;
    if(num !== null && m && m.suffix === suffix && m.el === el && m.cls === cls && (now - m.t) < 250 && m.node && m.node.isConnected){
      m.sum += num;
      m.t = now;
      m.count++;
      m.node.textContent = icon + m.sum + suffix;
      this._record('float', icon + m.sum + suffix, cls, 'merge');
      return m.node;
    }
    const node = document.createElement('div');
    node.className = 'fx-float' + (cls ? ' ' + cls : '');
    node.textContent = icon + raw;
    const fr = field.getBoundingClientRect();
    const tr = (el.querySelector ? (el.querySelector('.slime') || el) : el).getBoundingClientRect();
    /* 越界保护：贴近场地顶部时改为从单位下方冒字，保证 24px 上升后仍在场地内 */
    let ty = tr.top - fr.top + 2;
    if(ty < 28) ty = tr.top - fr.top + tr.height + 2;
    /* 同目标连续飘字向上错开 14px（规格 §4.3）：数一下 600ms 内还挂在这个目标身上的飘字 */
    let stack = 0;
    const alive = field.querySelectorAll('.fx-float');
    for(let i = 0; i < alive.length; i++){
      const n = alive[i];
      if(n._owner === el && (now - (n._born || 0)) < 600) stack++;
    }
    const off = Math.min(stack, 3) * 14;
    if(ty - off >= 2) ty -= off;
    else ty = ty + off; /* 顶部放不下就往下错，两个方向都保证仍在场地内 */
    ty = Math.max(2, Math.min(Math.max(2, fr.height - 16), ty));
    node.style.left = (tr.left - fr.left + tr.width / 2) + 'px';
    node.style.top = ty + 'px';
    const dur = Math.round(850 * this._ts());
    node.style.animationDuration = dur + 'ms';
    field.appendChild(node);
    node._owner = el;
    node._born = now;
    setTimeout(()=>node.remove(), dur + 60);
    this._trimFloat(field);
    this._merge = { el, cls, t: now, node, sum: num === null ? 0 : num, suffix, count: 1 };
    this._record('float', icon + raw, cls, 'float');
    return node;
  },
  /* 同屏飘字上限 12 */
  _trimFloat(field){
    const list = field.querySelectorAll('.fx-float');
    for(let i = 0; i < list.length - 12; i++) list[i].remove();
    this._txt = field.querySelectorAll('.fx-float').length;
  },

  /* 击杀演出：本体缩灭 + 元素色爆散（count 由调用方决定：本体 12、迷你 6） */
  die(el, count){
    if(!el) return;
    const slime = (el.querySelector && el.querySelector('.slime')) || el;
    const st = slime.style || {};
    const g = n => (st.getPropertyValue ? String(st.getPropertyValue(n) || '').trim() : '');
    const h = g('--h') || '45';
    let s = g('--s') || '80%';
    let l = g('--l') || '60%';
    if(!s.includes('%')) s += '%';
    if(!l.includes('%')) l += '%';
    if(slime.classList) slime.classList.add('dying');
    this.shake('kill');
    this.burst(slime, 'hsl(' + h + ' ' + s + ' ' + l + ')', count || 12);
    this._record('die', 'dying', 'kill', 'die');
  },

  /* 元素色爆散粒子，同屏上限 60 */
  burst(el, color, count){
    if(!el) return;
    const field = this._host();
    const n = Math.max(1, Math.min(40, count || 10));
    const fr = field.getBoundingClientRect();
    const tr = (el.querySelector ? (el.querySelector('.slime') || el) : el).getBoundingClientRect();
    const cx = tr.left - fr.left + tr.width / 2;
    const cy = tr.top - fr.top + tr.height * 0.55;
    const dur = Math.round(620 * this._ts());
    for(let i = 0; i < n; i++){
      const p = document.createElement('i');
      p.className = 'fx-part';
      const ang = Math.PI * 2 * (i / n) + rnd(-0.25, 0.25);
      const dist = rnd(16, 44) * Math.max(0.6, tr.width / 60);
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.background = color || '#fff';
      p.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
      p.style.setProperty('--dy', Math.round(Math.sin(ang) * dist - rnd(4, 18)) + 'px');
      p.style.setProperty('--sz', rnd(2, 5).toFixed(1) + 'px');
      p.style.animationDuration = dur + 'ms';
      field.appendChild(p);
      setTimeout(()=>p.remove(), dur + 60);
    }
    this._trimParts(field);
    this._record('burst', n + ' particles', '', 'burst');
  },
  _trimParts(field){
    const list = field.querySelectorAll('.fx-part');
    for(let i = 0; i < list.length - 60; i++) list[i].remove();
    this._part = field.querySelectorAll('.fx-part').length;
  }
};

/* ==================== 可验证目标与借用伙伴教学 ==================== */
const TRAINING_CHALLENGES = {
  shield:{name:'护盾时机', element:'岩', hp:320, str:35, mag:20, enemyHp:220, enemyElement:'火', hint:'首回合重击 320：先用「磐石落」撑起护盾，再反击。通关需实际挡住重击。'},
  control:{name:'打断重击', element:'幻', hp:300, str:45, mag:20, enemyHp:230, enemyElement:'火', hint:'首回合重击 400：用「魅惑」取消已预告的行动，利用两回合空档反击。'},
  cleanse:{name:'净化危机', element:'光', hp:300, str:25, mag:40, enemyHp:260, enemyElement:'岩', hint:'已有 3 层烧伤与 3 层中毒：先用「圣光」净化，再进攻。通关需真正移除负面。'}
};
function ensureProgress(){
  if(!S.progress || typeof S.progress !== 'object' || Array.isArray(S.progress)) S.progress = {};
  const p = S.progress;
  ['abyssClears','challengeClears','regions','collected','claimed'].forEach(k=>{
    if(!p[k] || typeof p[k] !== 'object' || Array.isArray(p[k])) p[k] = {};
  });
  S.slimes.concat(S.monsters || []).forEach(s=>{ if(ELEMENTS[s.element]) p.collected[s.element] = true; });
  return p;
}
function recordRegionExplore(index){
  const map = MAP_THEMES[index] || MAP_THEMES[0];
  const p = ensureProgress();
  p.regions[map.id] = Math.max(0, Number(p.regions[map.id]) || 0) + 1;
}
function progressionGoals(){
  const p = ensureProgress();
  const goals = [{id:'abyss-first',name:'第一次深渊胜利',now:Object.keys(p.abyssClears).length ? 1 : 0,need:1,coins:400,points:5}];
  Object.keys(TRAINING_CHALLENGES).forEach(id=>goals.push({id:'training-'+id,name:'教学 · '+TRAINING_CHALLENGES[id].name,now:p.challengeClears[id] ? 1 : 0,need:1,coins:300,points:5}));
  goals.push({id:'regions',name:'踏遍三片土地（各完成 3 次派遣）',now:MAP_THEMES.filter(m=>(p.regions[m.id]||0)>=3).length,need:MAP_THEMES.length,coins:600,treasure:2});
  goals.push({id:'collection-six',name:'结识 6 种元素伙伴',now:Object.keys(p.collected).filter(k=>ELEMENTS[k] && p.collected[k]).length,need:6,coins:800,points:10});
  return goals.map(g=>Object.assign(g,{claimed:!!p.claimed[g.id],ready:g.now>=g.need}));
}
function claimProgressGoal(id){
  const g = progressionGoals().find(x=>x.id===id);
  if(!g || !g.ready || g.claimed) return false;
  ensureProgress().claimed[id] = true;
  S.coins += g.coins || 0;
  S.totalEarned += g.coins || 0;
  S.points += g.points || 0;
  S.bag.treasure = (S.bag.treasure || 0) + (g.treasure || 0);
  save(); renderTop(); renderTab();
  toast('目标奖励已领取：'+g.name, 'good');
  return true;
}
function progressionGoalCards(){
  const p = ensureProgress();
  return `<div class="panel"><h3>旅途目标 · 一次性奖励</h3><p class="muted small">${MAP_THEMES.map(m=>`${m.name} ${Math.min(3,p.regions[m.id]||0)}/3`).join(' · ')} · 收集记录不会因融合丢失</p>${progressionGoals().map(g=>`<div class="task-row"><div><div class="task-name">${esc(g.name)}</div><div class="muted small">${Math.min(g.now,g.need)}/${g.need} · ${g.coins} 晶币${g.points?' + '+g.points+' 积分':''}${g.treasure?' + '+g.treasure+' 天材地宝':''}</div></div><button class="btn sm ${g.ready&&!g.claimed?'gold':'themed'}" data-act="claimGoal" data-id="${g.id}" ${!g.ready||g.claimed?'disabled':''}>${g.claimed?'已领取':g.ready?'领取':'进行中'}</button></div>`).join('')}</div>`;
}
function challengeCards(){
  const p = ensureProgress();
  return `<div class="panel"><h3>战斗课堂 · 固定挑战</h3><p class="muted small">借用伙伴，零消耗。默认逐回合；首次达标后在旅途目标领取奖励，重复训练无收益。</p>${Object.keys(TRAINING_CHALLENGES).map(id=>{const c=TRAINING_CHALLENGES[id];return `<div class="task-row"><div><div class="task-name">${esc(c.name)}${p.challengeClears[id]?' · 已掌握':''}</div><p class="muted small">${esc(c.hint)}</p></div><button class="btn sm themed" data-act="challengeStart" data-id="${id}">练习</button></div>`;}).join('')}</div>`;
}
function recordBattleProgress(B, win){
  const p = ensureProgress();
  if(B.training){
    const used = B.practiceUsed && B.practiceUsed[B.challengeId];
    if(win && used){ p.challengeClears[B.challengeId] = true; B.progressResult = '教学达标！首次奖励可在旅途目标领取。'; }
    else B.progressResult = win ? '战斗获胜，但尚未完成本课机制；可免费再试。' : '免费练习结束；根据预告调整行动后再试。';
  } else if(win){
    p.abyssClears[String(B.mLevel || 1)] = true;
    B.progressResult = '胜利已记入旅途目标。';
  } else B.progressResult = '';
  return B.progressResult;
}
function makeTrainingSlime(id, name, element, hp, str, mag, isMonster){
  return {id,name,element,level:1,size:1,str,agi:10,mag,strPotential:str,agiPotential:10,magPotential:mag,luck:0,wit:0,personality:'平常',traits:[],skill:'元素弹',isMonster:!!isMonster,isTraining:true,trainingHp:hp,hp,stamina:120,mood:100,intimacy:0,exp:0};
}
function startTrainingChallenge(id){
  const c = TRAINING_CHALLENGES[id];
  if(!c || document.getElementById('gameOverlay')) return;
  closeModal();
  startAbyssBattle({challengeId:id});
}
function enemyIntentText(unit){
  if(!unit || unit.hp<=0) return '已倒下';
  const q = unit.intent;
  if(!q) return '正在观察';
  if(q.state==='canceled') return '已取消 · '+q.name;
  if(q.state==='done') return '已行动 · '+q.name;
  const controlled = unit.st && (unit.st.frozen>0 || unit.st.paralysis>0 || unit.st.charm>0);
  const suffix = q.targetName ? ' → '+q.targetName : '';
  const power = q.power ? ' '+q.power : q.mult>1 ? ' '+q.mult+'×' : '';
  return (controlled?'受控待取消 · ':'预告 · ')+q.name+power+suffix;
}

/* ==================== 深渊数值：敌人、首领、羁绊、结算 ==================== */
/* 敌人与伙伴共用 growthStat，固定每层编制，避免靠重开刷到一只首领就越层。
   潜力保留随机差异；数值由 tests/balance-sim.cjs 校准。 */
const ABYSS_POT_MIN = 8, ABYSS_POT_MAX = 16;
const BOSS_HP_MUL = 3, BOSS_ATK_MUL = 1.5, BOSS_EXP_MUL = 2.5;
const REPEAT_REWARD_MUL = 0.2;
const SWEEP_PER_DAY = 3;
const FOLLOW_UP_SPEED = 1.3, FOLLOW_UP_MULT = 0.5;
function isBossFloor(floor){ return floor % 5 === 0; }
/* 编制随进度为 2/3/4/5 只；每五层第一只升级为首领，保留其余护卫。 */
function abyssEnemyCount(floor){
  return floor < 10 ? 2 : floor < 20 ? 3 : floor < 35 ? 4 : 5;
}
function makeAbyssMonster(level, boss){
  const m = createSlime(true);
  for(const key of ['strPotential','agiPotential','magPotential']) m[key] = rndInt(ABYSS_POT_MIN, ABYSS_POT_MAX);
  m.level = level;
  m.str = growthStat(m.strPotential, level);
  m.agi = growthStat(m.agiPotential, level);
  m.mag = growthStat(m.magPotential, level);
  m.size = +(m.size + (level-1)*0.0016).toFixed(3);
  if(boss){ m.isBoss = true; m.name = `首领·${m.element}魔物`; }
  else m.name = `${m.element}魔物${m.id}`;
  m.hp = hpMax(m);
  return m;
}
function abyssFloorCleared(floor){ return !!ensureProgress().abyssClears[String(floor)]; }
function highestClearedFloor(){
  return Object.keys(ensureProgress().abyssClears).reduce((max,k)=>Number.isInteger(+k) && +k>=1 && +k<=50 && abyssFloorCleared(+k) ? Math.max(max, +k) : max, 0);
}
/* 元素羁绊：同元素 2 只攻击 +10%、3 只及以上 +20%；4 种及以上元素全队生命 +10% */
function teamBond(refs){
  const count = {};
  refs.forEach(r=>{ if(r && ELEMENTS[r.element]) count[r.element] = (count[r.element]||0) + 1; });
  const atk = {};
  Object.keys(count).forEach(el=>{ if(count[el] >= 3) atk[el] = 1.2; else if(count[el] >= 2) atk[el] = 1.1; });
  return {atk, hp: Object.keys(count).length >= 4 ? 1.1 : 1, count};
}
function bondText(refs){
  const b = teamBond(refs);
  const parts = Object.keys(b.atk).map(el=>`${el}×${b.count[el]} 攻击+${Math.round((b.atk[el]-1)*100)}%`);
  if(b.hp > 1) parts.push(`${Object.keys(b.count).length} 种元素 全队生命+10%`);
  return parts.length ? parts.join(' · ') : '暂无（同元素 2 只或 4 种不同元素可激活）';
}
/* 首通奖励：首领层额外给天材地宝、捕捉网、积分，每 10 层再给词条券 */
function firstClearBonus(floor){
  if(!isBossFloor(floor)) return null;
  return {treasure:1, net:1, points:5, ticket: floor % 10 === 0 ? 1 : 0};
}
function bonusText(b){
  if(!b) return '';
  return [b.treasure&&`天材地宝×${b.treasure}`, b.net&&`捕捉网×${b.net}`, b.ticket&&`词条券×${b.ticket}`, b.points&&`积分+${b.points}`].filter(Boolean).join(' ');
}

/* Pure reward calculation: snapshot before post-battle healing.
   每只敌人经验 = (40 + 30×等级) × 首领 2.5；胜利全额，失败只算已击败的 25%；
   已通关层的重复挑战再 ×0.2，主要收益来自首通、派遣和每日扫荡。 */
function enemyExp(ref){ return Math.round((40 + 30 * (Number(ref.level)||1)) * (ref.isBoss ? BOSS_EXP_MUL : 1)); }
function calculateBattleRewards(battle,win,level){
  const enemies=battle.rewardMonsters || battle.monsters || [], participants=battle.allies || [];
  const defeated=enemies.filter(m=>m.hp<=0);
  const survivors=participants.filter(a=>a.hp>0);
  const recipients=survivors.length ? survivors.slice() : participants.slice();
  if(battle.training) return {totalExp:0,coinGain:0,defeatedCount:defeated.length,recipients:[],survivorCount:survivors.length,repeat:false};
  const base=(win ? enemies : defeated).reduce((sum,m)=>sum+enemyExp(m.ref),0);
  let totalExp=win ? base : Math.floor(base*0.25);
  if(battle.floorCleared) totalExp=Math.floor(totalExp*REPEAT_REWARD_MUL);
  return {totalExp,coinGain:Math.round(totalExp*2.5),defeatedCount:defeated.length,recipients,survivorCount:survivors.length,repeat:!!battle.floorCleared};
}
/* 扫荡（参考爬塔类游戏）：对最高已通关层直接结算一场 3 只敌人的胜利，每日 3 次 */
function sweepAbyss(){
  checkDailyReset();
  const floor = highestClearedFloor();
  if(!floor){ toast('先通关至少一层深渊才能扫荡'); return false; }
  if((S.sweepUsed||0) >= SWEEP_PER_DAY){ toast('今日扫荡次数已用完，明天再来'); return false; }
  const ids = new Set(S.lastAbyssSel || []);
  let team = S.slimes.filter(s=>ids.has(s.id)).slice(0,5);
  if(!team.length) team = S.slimes.slice(0, 5);
  if(!team.length){ toast('还没有伙伴可以扫荡'); return false; }
  const fake = {
    monsters: [0,1,2].map(()=>({hp:0, ref:{level:floor}})),
    allies: team.map(s=>({hp:1, ref:s}))
  };
  const r = calculateBattleRewards(fake, true, floor);
  S.sweepUsed = (S.sweepUsed||0) + 1;
  S.coins += r.coinGain;
  S.totalEarned += r.coinGain;
  const each = Math.floor(r.totalExp / team.length);
  team.forEach(s=>addExp(s, each));
  save(); renderTop(); renderTab();
  toast(`扫荡第 ${floor} 层完成\n晶币 +${r.coinGain} · 每只伙伴经验 +${each}\n今日剩余 ${SWEEP_PER_DAY - S.sweepUsed} 次`, 'good');
  return true;
}
/* ==================== 深渊对战 ==================== */
let abyssSetupSel = [];

function openAbyssSetup(){
  checkDailyReset();
  getAbyssLevel();
  const available = S.slimes.filter(s => !hasExplorePlan(s) && !LivingWorld.isBusy(S,s.id));
  if(!available.length){ toast('所有史莱姆都在野外探险中，请先召回后再进入深渊'); return; }
  const validIds = new Set(available.map(s=>s.id));
  abyssSetupSel = (S.lastAbyssSel || []).filter(id => validIds.has(id)).slice(0,5);
  openModal(`
    <button class="close" data-act="close">✕</button>
    <h3 style="text-align:center;margin:0 0 6px;color:var(--accent2);">深渊冒险 · 选择出战史莱姆</h3>
    <p class="muted small" style="text-align:center;">第 ${S.abyssLevel} 层${isBossFloor(S.abyssLevel)?' · 首领挑战':''} · 最多 5 只，速度快的先行动<br>正在野外探险的伙伴需要先召回</p>
    <p class="muted small">${abyssFloorCleared(S.abyssLevel)?'本层已通关，重复挑战收益为首通的 20%。':`首通：全额晶币与经验${firstClearBonus(S.abyssLevel)?'，'+bonusText(firstClearBonus(S.abyssLevel)):''}`}</p>
    <p class="small" id="abyssBond" aria-live="polite">羁绊：${bondText(available.filter(s=>abyssSetupSel.includes(s.id)))}</p>
    <div class="minigrid merge-list" style="margin-top:14px;">
      ${available.map(s=>`
        <div class="minicard ${abyssSetupSel.includes(s.id)?'on':''}" data-act="abyssSel" data-id="${s.id}">
          <div class="scale-box">${slimeHTML(s,{mood:'idle'})}</div>
          <div class="mc-name">${esc(s.name)}</div>
          <div class="mc-tag">战力 ${slimePower(s)}</div>
        </div>`).join('')}
    </div>
    <button class="btn gold full" data-act="abyssStart" style="margin-top:16px;" ${abyssSetupSel.length ? '' : 'disabled'}>进入深渊</button>
  `);
}
function toggleAbyssSel(id){
  const idx = abyssSetupSel.indexOf(id);
  if(idx>=0) abyssSetupSel.splice(idx,1);
  else {
    if(abyssSetupSel.length >= 5) return;
    abyssSetupSel.push(id);
  }
  document.querySelectorAll('.merge-list .minicard').forEach(c=>{
    c.classList.toggle('on', abyssSetupSel.includes(+c.dataset.id));
  });
  const btn = document.querySelector('[data-act="abyssStart"]');
  if(btn) btn.disabled = abyssSetupSel.length === 0;
  const bond = document.getElementById('abyssBond');
  if(bond) bond.textContent = '羁绊：' + bondText(S.slimes.filter(s=>abyssSetupSel.includes(s.id)));
}

function openTeamSetup(){
  teamSel = new Set(S.exploreTeam || []);
  renderTeamModal();
}
function renderTeamModal(){
  openModal(`
    <button class="close" data-act="close">✕</button>
    <h3 style="text-align:center;margin:0 0 6px;color:var(--accent2);">设置默认探险队伍</h3>
    <p class="muted small" style="text-align:center;">选中的史莱姆会在点击「自动探险」时被派遣<br>不设置时默认派遣全部史莱姆</p>
    <div class="minigrid merge-list" style="margin-top:14px;">
      ${S.slimes.length ? S.slimes.map(s=>{
        const hasExploreBuff = (s.traits||[]).some(t=>['explore','all','ecost'].includes(t.k));
        return `
        <div class="minicard ${teamSel.has(s.id)?'on':''}" data-act="teamSel" data-id="${s.id}">
          <div class="scale-box">
            ${slimeHTML(s,{mood:'idle'})}
            ${hasExploreBuff ? '<div class="team-alert">!</div>' : ''}
          </div>
          <div class="mc-name">${esc(s.name)}</div>
          <div class="mc-tag">${elementIcon(s.element)}${s.element}</div>
        </div>`;
      }).join('') : '<p class="muted small">暂无史莱姆</p>'}
    </div>
    <button class="btn full themed" data-act="teamClearAll" style="margin-top:10px;">取消设置（默认派遣全部）</button>
    <button class="btn gold full" data-act="teamSave" style="margin-top:6px;">保存队伍</button>
  `);
}

