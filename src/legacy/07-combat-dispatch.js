function startAbyssBattle(options){
  options = options || {};
  if(document.getElementById('gameOverlay')) return;
  const challenge = TRAINING_CHALLENGES[options.challengeId] || null;
  if(!challenge && !abyssSetupSel.length) return;
  const allies = challenge ? [makeTrainingSlime(-1001, '借用·'+challenge.element+'伙伴', challenge.element, challenge.hp, challenge.str, challenge.mag, false)] : S.slimes.filter(s=>abyssSetupSel.includes(s.id) && !hasExplorePlan(s) && !LivingWorld.isBusy(S,s.id)).slice(0,5);
  if(!allies.length){ toast('出战的史莱姆都在探险中，请先召回'); return; }
  if(!challenge&&!LivingWorld.reserve(S,allies.map(s=>s.id),'battle')){toast('伙伴正在忙碌');return;}
  battleSpeed = clamp(Number(S.battleSpeed)||1, 1, 10);
  const mLevel = challenge ? 1 : getAbyssLevel();
  const bossFloor = !challenge && isBossFloor(mLevel);
  const monCount = challenge ? 0 : abyssEnemyCount(mLevel);
  const monsters = challenge ? [makeTrainingSlime(-2001, '练习·'+challenge.name, challenge.enemyElement, challenge.enemyHp, 25, 15, true)] : [];
  for(let i=0;i<monCount;i++) monsters.push(makeAbyssMonster(mLevel, bossFloor && i === 0));

  const overlay = document.createElement('div');
  overlay.id = 'gameOverlay';

  const enemyHTML = monsters.map((m)=>`
    <div class="battle-unit" data-mon-id="${m.id}" data-side="enemy">
      <div class="slime-wrap">
        <div class="hpbar"><i style="width:100%"></i><i class="ghost"></i></div>
        ${slimeHTML(m,{mood:'idle', traitBadge: m.traits.length > 0})}
      </div>
      <div class="uname">${esc(m.name)} Lv.${m.level}</div>
    </div>`).join('');
  const allyHTML = allies.map(a=>`
    <div class="battle-unit" data-ally-id="${a.id}" data-side="ally">
      <div class="slime-wrap">
        <div class="hpbar"><i style="width:100%"></i><i class="ghost"></i></div>
        ${slimeHTML(a,{mood:'idle'})}
      </div>
      <div class="uname">${esc(a.name)}</div>
    </div>`).join('');

  const speeds = [1,2,3,5,10];
  overlay.innerHTML = `
    <div class="game-hud">
      <span class="hud-title">${uiIcon('sword')} ${challenge?'协作练习':`深渊 第 ${mLevel} 层`}${bossFloor?'<b class="hud-boss">首领</b>':''}</span>
      <div class="hud-speeds">
        ${speeds.map(sp=>`<button class="speed-btn ${battleSpeed===sp?'on':''}" data-speed="${sp}">${sp}x</button>`).join('')}
        <button class="speed-btn" id="bMode">自动</button>
      </div>
      <button class="hud-close" id="bClose">撤退</button>
    </div>
    <div class="battle-field">
      ${skyArt('arena')}
      ${Array.from({length:22}).map(()=>`<div class="bg-star" style="left:${rnd(2,98)}%;top:${rnd(2,62)}%;"></div>`).join('')}
      ${arenaIsle()}
      <div class="battle-row enemy">${enemyHTML}</div>
      <div class="battle-log" id="battleLog">战斗开始！</div>
      <div class="battle-row ally">${allyHTML}</div>
      <div class="skill-bar hide" id="skillBar"></div>
    </div>
  `;
  $('#app').appendChild(overlay);$('#app').classList.add('has-game-overlay');

  const logEl = overlay.querySelector('#battleLog');
  const fieldEl = overlay.querySelector('.battle-field');
  FX.bindField(fieldEl);

  function initBattleUnit(ref){
    const st = {
      burn:0, poison:0, frostbite:0, frozen:0, freezeVisual:false,
      paralysis:0, charm:0, weakness:0, intangible:0,
      rockArmor:0, iceArmor:0, timeRevive:false, reviveUsed:false,
      immuneDebuff:false, miniSlime:null
    };
    if(ref.element === '岩' && !ref.isTraining){ st.immuneDebuff = true; st.rockArmor = Math.round(hpMax(ref)*0.5); }
    if(ref.element === '冰'){ st.iceArmor = Math.round(hpMax(ref)*0.5); }
    if(ref.element === '时间'){ st.timeRevive = true; }
    const maxHp = ref.trainingHp || Math.round(hpMax(ref) * (ref.isBoss ? BOSS_HP_MUL : 1));
    return {ref, hp:Math.min(maxHp, ref.isBoss ? maxHp : ref.hp), maxHp, st, minis:[], cd:{}, acted:false, intent:null};
  }
  /* 元素羁绊：生命加成按比例放大当前血量，满血出战仍是满血 */
  function applyBond(units){
    if(challenge) return;
    const bond = teamBond(units.map(u=>u.ref));
    units.forEach(u=>{
      u.atkMul = bond.atk[u.ref.element] || 1;
      if(bond.hp > 1){
        const full = u.hp >= u.maxHp;
        u.maxHp = Math.round(u.maxHp * bond.hp);
        u.hp = full ? u.maxHp : Math.min(u.maxHp, Math.round(u.hp * bond.hp));
      }
    });
  }

  const B = {
    running:true, ended:false,
    allies: allies.map(initBattleUnit),
    monsters: monsters.map(initBattleUnit),
    turn:0, timer:null, pendingTimers:[],
    paused:false, pauseTimer:null, _pauseResume:null,
    atkBuff: 1, mLevel, training:!!challenge, trainingMode:'step', challengeId:options.challengeId || null, practiceUsed:{}, resolving:false,
    /* 开战时快照：本层是否已通关，决定结算是首通全额还是重复挑战折扣 */
    floorCleared: !challenge && abyssFloorCleared(mLevel)
  };
  applyBond(B.allies);
  applyBond(B.monsters);
  B.rewardMonsters = B.monsters.slice();
  function currentBattleMode(){ return B.training ? B.trainingMode : S.battleMode; }
  if(challenge && options.challengeId==='cleanse'){ B.allies[0].st.burn=3; B.allies[0].st.poison=3; }
  if(challenge){
    const title = overlay.querySelector('.hud-title');
    if(title) title.textContent = '战斗课堂 · '+challenge.name;
  }

  /* 自检钩子：?selftest=1 时把本局战斗暴露给 __TEST__，正常游玩不会触发 */
  if(window.__TEST__) window.__TEST__._battle = {
    B, overlay, fieldEl, logEl, later, performAction, performMiniAction,
    getUnitEl, refreshBars, dealDamage, handleUnitDeath, nextTurn,
    playerCast, playerBasic, renderSkillBar, castStrike, mitigate, unitAttack, bySpeed, tryFollowUp, autoCast,
    waitForPlayer, closeBattle, enemyPhase, endBattle, queueEnemyIntents, refreshIntentPanel, turnControl,
    setDodgeRate: fn => { dodgeRate = fn; },
    setCritRate: fn => { critRate = fn; },
    restoreRates: () => { dodgeRate = _rateOrig.dodgeRate; critRate = _rateOrig.critRate; }
  };
  const _rateOrig = { dodgeRate, critRate };

  /* ==================== 手动行动：技能条与施法 ==================== */
  const MODES = ['auto', 'interject', 'step'];
  const MODE_LABEL = { auto:'自动', interject:'插话', step:'逐回合' };
  let afterPlayerAction = null;   /* 逐回合模式接管后续推进（任务 9） */
  let skSel = null;               /* 当前选中的己方单位 */
  let skPick = null;              /* 'basic' | 'skill'：等待选目标 */

  function sideOfUnit(u){
    if(u.isMini) return u.side;
    return B.monsters.indexOf(u) >= 0 ? 'enemy' : 'ally';
  }
  function manualMode(){
    return currentBattleMode() === 'interject' || currentBattleMode() === 'step';
  }
  function lowestAllyUnit(){
    const alive = getAllAliveUnits('ally').filter(u=>u.hp > 0);
    if(!alive.length) return null;
    return alive.reduce((a,b)=> (b.hp/b.maxHp < a.hp/a.maxHp ? b : a));
  }

  /* 手动伤害：与自动战斗同口径（闪避→基础伤害→属性倍率→暴击→护甲） */
  function castStrike(attackerUnit, target, mult, opt){
    opt = opt || {};
    const ref = attackerUnit.ref;
    const atkEl = getUnitEl(attackerUnit, sideOfUnit(attackerUnit));
    const tSide = sideOfUnit(target);
    const tgtEl = getUnitEl(target, tSide);
    if(tgtEl && atkEl) doElementBallEffect(ref, atkEl, tgtEl, opt.name && opt.name!=='普攻' && opt.name!=='追击');

    const dodge = B.training || target.isMini ? 0 : dodgeRate(target.ref);
    if(gameRandom()*100 < dodge){
      FX.float(tgtEl, 'MISS', { cls:'miss' });
      log(`${target.ref.name} 闪避了 ${ref.name} 的${opt.name || '攻击'}`);
      return 0;
    }

    let baseDmg = unitAttack(attackerUnit) + (B.training ? 0 : gameInt(-3,3));
    baseDmg = Math.round(baseDmg * (B.atkBuff||1));
    if(attackerUnit.st.weakness > 0) baseDmg = Math.round(baseDmg * (1 - attackerUnit.st.weakness*0.05));

    let elemMult = 1;
    if(ELEMENT_CHART[ref.element] && ELEMENT_CHART[ref.element][target.ref.element]) {
      elemMult = ELEMENT_CHART[ref.element][target.ref.element];
    }
    let dmg = Math.round(baseDmg * elemMult * (mult || 1));
    if(ref.element === '光' && target.ref.isMonster) dmg *= 2;

    const critBonus = target.st.frostbite * 5;
    const crit = !B.training && gameRandom() < (critRate(ref)+critBonus)/100;
    if(crit) dmg = Math.round(dmg * 1.8);
    dmg = mitigate(ref, target, Math.max(1, dmg));

    if(!opt.noElement && !B.training) applyAttackerElement(attackerUnit, target);

    /* 冰甲反伤：与自动路径一致，攻击带冰甲的冰属性目标会被冻伤 */
    if(!opt.followUp && target.ref.element === '冰' && target.st.iceArmor > 0){
      if(applyStatus(attackerUnit, 'frostbite', 1))
        setTimeout(()=>log(`❄ ${ref.name} 被冰甲冻伤！`), 120);
    }

    const shield0 = shieldOf(target);
    const actual = dealDamage(target, dmg);
    if(tgtEl){
      FX.flash(tgtEl, crit);
      if(crit) FX.shake('crit');
      if(actual === 0){
        FX.float(tgtEl, '护盾', { cls:'small' });
      } else {
        const tag = elemMult > 1.2 ? ' 克制' : '';
        FX.float(tgtEl, '-' + actual + (crit ? '!' : '') + tag,
          { cls: crit ? 'crit' : (elemMult < 0.85 ? 'weak' : (elemMult > 1.2 ? 'strong' : '')) });
      }
    }
    const elemMsg = elemMult > 1 ? '（克制！）' : (elemMult < 1 ? '（微弱）' : '');
    log(damageLogText(target, shield0, actual,
      `${ref.name} 的${opt.name || '攻击'}命中 ${target.ref.name}`, `${crit?'（暴击！）':''}${elemMsg}`));
    /* 与自动战斗对齐的属性后续效果：雷对水溅射 / 草吸血 / 命中水史莱姆召出迷你 */
    if(!opt.followUp && ref.element === '雷' && actual > 0) doSplash(attackerUnit, target, actual);
    if(!opt.followUp && ref.element === '草' && actual > 0){
      const heal = Math.round(actual * 0.5);
      attackerUnit.hp = Math.min(attackerUnit.maxHp, attackerUnit.hp + heal);
      FX.float(atkEl, '+' + heal, { cls:'good small' });
      if(tgtEl && atkEl){
        const cc = slimeColor(ref);
        const colGrass = `hsl(${cc.h} ${Math.max(cc.s,40).toFixed(1)}% ${Math.max(cc.l,55).toFixed(1)}%)`;
        later(()=>{ doDrainEffect(tgtEl, atkEl, colGrass); }, Math.round(520 / battleSpeed));
      }
    }
    if(!opt.followUp && !target.isMini && target.ref.element === '水' && target.hp > 0){
      const mini = spawnMiniSlime(target, tSide);
      if(mini) miniSlimeAttack(mini);
    }
    refreshBars();
    if(target.hp <= 0) handleUnitDeath(target, tSide);
    return actual;
  }

  function doSplash(attackerUnit, target, actual){
    if(!(actual > 0) || target.ref.element !== '水') return;
    const splash = Math.max(1, Math.round(actual * 0.2));
    let hitCount = 0;
    [B.allies, B.monsters].forEach(team=>{
      const s = team === B.allies ? 'ally' : 'enemy';
      team.forEach(u=>{
        const list = [{u, side:s}];
        (u.minis||[]).forEach(m=>{ if(m.hp > 0) list.push({u:m, side:s}); });
        list.forEach(w=>{
          if(w.u === target || w.u.hp <= 0) return;
          if(w.u.ref.element !== '水') return;
          dealDamage(w.u, splash);
          FX.float(getUnitEl(w.u, w.side), '-' + splash, { cls:'small' });
          hitCount++;
          if(w.u.hp <= 0) handleUnitDeath(w.u, w.side);
        });
      });
    });
    if(hitCount){
      log(`⚡ 电流顺着水流扩散，其他水史莱姆受到 ${splash} 点溅射伤害`);
      refreshBars();
    }
  }

  function playerBasic(attackerUnit, targetUnit){
    if(storageConflict || persistenceBlocked || saveRetryNeeded)return false;
    const ref = attackerUnit.ref;
    if(!attackerUnit || attackerUnit.hp <= 0) return false;
    if(attackerUnit.acted){ log(`${ref.name} 本回合已经行动过了`); renderSkillBar(); return false; }
    /* 冻结/麻痹/持续伤害/魅惑：手动行动也要先结算，否则玩家可以绕过控制 */
    if(turnControl(attackerUnit, 'ally')){ attackerUnit.acted = true; renderSkillBar(); return false; }
    const enemyMain = getAllAliveMain('enemy');
    const target = targetUnit || gamePick(getAllAliveUnits('enemy'));
    if(!target || target.hp <= 0){ log('没有可攻击的目标'); renderSkillBar(); return false; }
    if(isUntargetable(target, enemyMain)){
      log(`${target.ref.name} 虚化中，无法选中`);
      renderSkillBar();
      return false;
    }
    castStrike(attackerUnit, target, 1, { name:'普攻' });
    tryFollowUp(attackerUnit, target);
    attackerUnit.acted = true;
    renderSkillBar();
    return true;
  }

  function applyLivingCombo(attacker,target,damage,side){
    if(B.training || !S.world || attacker.isMini) return;
    B.comboUsed=B.comboUsed||{};
    const team=side==='ally'?B.allies:B.monsters,opponents=side==='ally'?B.monsters:B.allies;
    const effect=LivingWorld.comboFor(attacker.ref.element,team.filter(u=>u.hp>0).map(u=>u.ref.element),!!B.comboUsed[side]);
    if(!effect.combo)return;
    B.comboUsed[side]=true;
    const base=Math.max(1,damage||unitAttack(attacker));
    if(effect.heal)team.filter(u=>u.hp>0).forEach(u=>{const n=Math.round(u.maxHp*effect.heal);u.hp=Math.min(u.maxHp,u.hp+n);FX.float(getUnitEl(u,side),'+'+n,{cls:'good small'});});
    if(effect.cleanse)team.filter(u=>u.hp>0).forEach(u=>{const key=['burn','poison','frostbite','frozen','paralysis','charm','weakness'].find(k=>u.st[k]>0);if(key)u.st[key]=0;});
    if(effect.cooldown)team.filter(u=>u!==attacker).forEach(u=>{Object.keys(u.cd).forEach(k=>u.cd[k]=Math.max(0,u.cd[k]-1));});
    const victim=target&&target.hp>0?target:opponents.find(u=>u.hp>0);
    if(victim){
      if(effect.extra){const hit=dealDamage(victim,Math.max(1,Math.round(base*effect.extra)));FX.float(getUnitEl(victim,side==='ally'?'enemy':'ally'),'-'+hit,{cls:'small'});}
      if(effect.burn)applyStatus(victim,'burn',1);
      if(effect.weakness)applyStatus(victim,'weakness',1);
      if(victim.hp<=0)handleUnitDeath(victim,side==='ally'?'enemy':'ally');
    }
    if(effect.secondary){const other=opponents.find(u=>u!==target&&u.hp>0);if(other){dealDamage(other,Math.max(1,Math.round(base*.2)));if(other.hp<=0)handleUnitDeath(other,side==='ally'?'enemy':'ally');}}
    log('元素协作 · '+effect.combo);refreshBars();
  }

  function playerCast(attackerUnit, targetUnit){
    if(storageConflict || persistenceBlocked || saveRetryNeeded)return false;
    const ref = attackerUnit ? attackerUnit.ref : null;
    if(!ref) return false;
    const sk = skillOf(ref);
    if(!sk) return false;
    if(attackerUnit.hp <= 0) return false;
    if(attackerUnit.acted){ log(`${ref.name} 本回合已经行动过了`); renderSkillBar(); return false; }
    const cd = attackerUnit.cd[ref.element] || 0;
    if(cd > 0){ log(`${sk.name} 冷却中（还剩 ${cd} 回合）`); renderSkillBar(); return false; }
    /* 冻结/麻痹/持续伤害/魅惑：手动施法同样先结算 */
    if(turnControl(attackerUnit, 'ally')){ attackerUnit.acted = true; renderSkillBar(); return false; }

    const enemyMain = getAllAliveMain('enemy');
    let target = targetUnit || null;
    if(sk.target === 'enemy' && sk.kind !== 'revive'){
      if(!target || target.hp <= 0){ log('没有可攻击的目标'); renderSkillBar(); return false; }
      if(isUntargetable(target, enemyMain)){
        log(`${target.ref.name} 虚化中，无法选中`);
        renderSkillBar();
        return false;
      }
    }

    const el = ref.element;
    const unitEl = getUnitEl(attackerUnit, 'ally');

    if(el === '岩'){
      castStrike(attackerUnit, target, 1.6, { name: sk.name, noElement:true });
      const sh = Math.round(attackerUnit.maxHp * 0.3);
      attackerUnit.st.rockArmor = (attackerUnit.st.rockArmor || 0) + sh;
      log(`🪨 ${ref.name} 的${sk.name}落下，获得 ${sh} 点护盾`);
    } else if(el === '火'){
      castStrike(attackerUnit, target, 1.4, { name: sk.name, noElement:true });
      if(applyStatus(target, 'burn', 2)) log(`🔥 ${ref.name} 的${sk.name}点燃了 ${target.ref.name}（2 层烧伤）`);
    } else if(el === '水'){
      const lowest = lowestAllyUnit();
      if(lowest){
        const heal = Math.max(1, Math.round(magAtk(ref) * 1.2));
        lowest.hp = Math.min(lowest.maxHp, lowest.hp + heal);
        const lel = getUnitEl(lowest, sideOfUnit(lowest));
        if(lel && unitEl) doHealEffect(ref, unitEl, lel);
        FX.float(lel, '+' + heal, { cls:'good' });
        log(`💧 ${ref.name} 的${sk.name}治疗 ${lowest.ref.name} ${heal} 点`);
      }
      const mini = spawnMiniSlime(attackerUnit, 'ally');
      if(mini){ refreshMiniBars(); log('💧 涌泉召唤出一只迷你水史莱姆'); }
    } else if(el === '风'){
      const pool = getAllAliveUnits('enemy').filter(u=>u.hp > 0 && !isUntargetable(u, enemyMain));
      const hitList = [];
      let hits = 0;
      for(let i=0;i<2;i++){
        /* 两道风刃必须打不同目标（规格：2 个随机敌人） */
        const cand = pool.filter(u=>hitList.indexOf(u) < 0 && u.hp > 0);
        if(!cand.length) break;
        const t = gamePick(cand);
        hitList.push(t);
        castStrike(attackerUnit, t, 0.9, { name: sk.name });
        hits++;
      }
      if(hits === 2) log(`🌪 ${ref.name} 的${sk.name}斩出两道风刃`);
    } else if(el === '草'){
      /* 吸血已由 castStrike 统一处理（草属性命中回 50%） */
      castStrike(attackerUnit, target, 0.8, { name: sk.name, noElement:true });
      if(applyStatus(target, 'poison', 3)) log(`🌿 ${target.ref.name} 缠绕上 3 层中毒`);
    } else if(el === '冰'){
      castStrike(attackerUnit, target, 0.7, { name: sk.name, noElement:true });
      if(applyStatus(target, 'frostbite', 2)) log(`❄ ${target.ref.name} 被冻结 2 层`);
    } else if(el === '雷'){
      /* 溅射已由 castStrike 统一处理（任意雷命中水史莱姆都会触发） */
      castStrike(attackerUnit, target, 1.5, { name: sk.name, noElement:true });
    } else if(el === '光'){
      if(B.training && getAllAliveUnits('ally').some(u=>['burn','poison','frostbite','frozen','paralysis','charm','weakness'].some(k=>u.st[k]>0))) B.practiceUsed.cleanse=true;
      const heal = Math.max(1, Math.round(magAtk(ref) * 0.6));
      getAllAliveUnits('ally').forEach(u=>{
        if(u.hp <= 0) return;
        u.hp = Math.min(u.maxHp, u.hp + heal);
        FX.float(getUnitEl(u, sideOfUnit(u)), '+' + heal, { cls:'good small' });
        u.st.burn = u.st.poison = u.st.frostbite = 0;
        u.st.frozen = u.st.paralysis = u.st.charm = u.st.weakness = 0;
      });
      log(`✨ ${ref.name} 的${sk.name}治愈全队 ${heal} 点并净化负面状态`);
    } else if(el === '暗'){
      castStrike(attackerUnit, target, 0.9, { name: sk.name, noElement:true });
      if(applyStatus(target, 'weakness', 3)) log(`🌑 ${target.ref.name} 被削弱 3 层`);
    } else if(el === '幻'){
      castStrike(attackerUnit, target, 0.5, { name: sk.name, noElement:true });
      if(applyStatus(target, 'charm', 2)) log(`💗 ${target.ref.name} 被魅惑 2 回合`);
    } else if(el === '空间'){
      castStrike(attackerUnit, target, 0.8, { name: sk.name, noElement:true });
      attackerUnit.st.intangible = 1;
      log(`🌌 ${ref.name} 相位化，暂时无法被选中`);
    } else if(el === '时间'){
      const dead = B.allies.find(u=>u !== attackerUnit && u.hp <= 0);
      if(dead){
        dead.hp = Math.max(1, Math.round(dead.maxHp * 0.3));
        if(dead.st){
          dead.st.burn = dead.st.poison = dead.st.frostbite = 0;
          dead.st.frozen = dead.st.paralysis = dead.st.charm = dead.st.weakness = 0;
        }
        refreshBars();
        const del = getUnitEl(dead, 'ally');
        /* 撤掉死亡演出残留，否则复活后单位停在 opacity:0 */
        const delSl = del && del.querySelector('.slime');
        if(delSl) delSl.classList.remove('dying');
        if(del) FX.float(del, '复活', { cls:'good' });
        log(`⏳ ${ref.name} 的${sk.name}让 ${dead.ref.name} 回到战场（30% 生命）`);
      } else {
        if(!target || target.hp <= 0){
          log('没有阵亡友方，也没有可攻击的目标');
          renderSkillBar();
          return false;
        }
        castStrike(attackerUnit, target, 1.3, { name: sk.name });
      }
    }

    applyLivingCombo(attackerUnit,target,unitAttack(attackerUnit),'ally');
    attackerUnit.acted = true;
    attackerUnit.cd[el] = sk.cd;
    refreshIntentPanel();
    refreshBars();
    renderSkillBar();
    return true;
  }

  function markTargetable(on){
    overlay.querySelectorAll('.battle-row.enemy .battle-unit').forEach(el=>{
      const u=B.monsters.find(b=>String(b.ref.id)===String(el.dataset.monId));
      el.classList.toggle('targetable', !!on && !!u && u.hp>0 && !isUntargetable(u,getAllAliveMain('enemy')));
    });
  }

  function renderSkillBar(){
    overlay.querySelectorAll('[data-ally-id]').forEach(el=>el.classList.toggle('selected-unit', !!skSel && manualMode() && String(el.dataset.allyId)===String(skSel.ref.id)));
    const bar = overlay.querySelector('#skillBar');
    if(!bar) return;
    if(!manualMode()){
      bar.classList.add('hide');
      bar.innerHTML = '';
      skSel = null;
      skPick = null;
      markTargetable(false);
      return;
    }
    bar.classList.remove('hide');
    const alive = B.allies.filter(u=>u.hp > 0).slice(0, 5);
    /* 全队阵亡：技能条必须收起来，否则残留按钮会让人以为还能行动 */
    if(!alive.length){
      bar.classList.add('hide');
      bar.innerHTML = '';
      skSel = null;
      skPick = null;
      markTargetable(false);
      return;
    }
    if(skSel && (skSel.hp <= 0 || alive.indexOf(skSel) < 0)){ skSel = null; skPick = null; markTargetable(false); }
    let html = alive.map(u=>{
      const cd = u.cd[u.ref.element] || 0;
      return `<button class="sk-unit ${u === skSel ? 'on' : ''}" data-sk-unit="${u.ref.id}">
        <span class="sk-ic">${elementIcon(u.ref.element)}</span>
        <span class="sk-nm">${esc(u.ref.name)}</span>
        ${cd > 0 ? `<span class="sk-nm">CD ${cd}</span>` : (u.acted ? '<span class="sk-nm">已行动</span>' : '')}
      </button>`;
    }).join('');
    if(skSel){
      const sk = skillOf(skSel.ref);
      const cd = skSel.cd[skSel.ref.element] || 0;
      html += `<div class="sk-acts">
        <button class="sk-act" data-sk-act="basic" ${skSel.acted ? 'disabled' : ''}>普攻</button>
        <button class="sk-act" data-sk-act="skill" ${(skSel.acted || cd > 0) ? 'disabled' : ''}>${sk ? sk.name : '—'}${cd > 0 ? ' CD' + cd : ''}</button>
        <button class="sk-act ghost" data-sk-act="cancel">×</button>
      </div>`;
    }
    if(skSel && S.world){
      const combo=LivingWorld.comboFor(skSel.ref.element,alive.map(u=>u.ref.element),!!(B.comboUsed&&B.comboUsed.ally));
      if(combo.combo){const def=LivingWorld.COMBOS.find(c=>c.name===combo.combo);html+='<div class="small" style="padding:4px 7px;flex-basis:100%">协作预告：'+esc(combo.combo)+' · '+esc(def.desc)+'</div>';}
    }
    bar.innerHTML = html;

    bar.querySelectorAll('[data-sk-unit]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = String(btn.dataset.skUnit);
        const u = B.allies.find(a=>String(a.ref.id) === id);
        if(!u || u.hp <= 0) return;
        skSel = (skSel === u) ? null : u;
        skPick = null;
        markTargetable(false);
        renderSkillBar();
      });
    });
    bar.querySelectorAll('[data-sk-act]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const act = btn.dataset.skAct;
        if(act === 'cancel'){ skSel = null; skPick = null; markTargetable(false); renderSkillBar(); return; }
        if(!skSel) return;
        if(act === 'basic'){ skPick = 'basic'; markTargetable(true); log('选择普攻目标…'); return; }
        const sk = skillOf(skSel.ref);
        if(!sk) return;
        if(sk.target === 'enemy'){ skPick = 'skill'; markTargetable(true); log('选择技能目标…'); return; }
        doManual('skill', null);
      });
    });
  }

  function doManual(kind, target){
    markTargetable(false);
    const u = skSel;
    skPick = null;
    if(!u) return;
    const ok = (kind === 'basic') ? playerBasic(u, target) : playerCast(u, target);
    if(ok) skSel = null;
    renderSkillBar();
    if((ok || u.acted) && typeof afterPlayerAction === 'function') afterPlayerAction(u);
    refreshIntentPanel();
  }

  overlay.addEventListener('click', (ev)=>{
    if(!skSel || !skPick) return;
    const unitEl = ev.target.closest ? ev.target.closest('.battle-row.enemy .battle-unit') : null;
    if(!unitEl) return;
    const id = String(unitEl.dataset.monId);
    const target = B.monsters.find(m=>String(m.ref.id) === id);
    if(!target) return;
    doManual(skPick, target);
  });

  overlay.querySelector('#bMode').addEventListener('click', ()=>{
    const i = MODES.indexOf(currentBattleMode());
    const nextMode = MODES[(i + 1) % MODES.length];
    if(B.training) B.trainingMode = nextMode; else S.battleMode = nextMode;
    overlay.querySelector('#bMode').textContent = MODE_LABEL[currentBattleMode()];
    renderSkillBar();
    log(`战斗玩法切换为「${MODE_LABEL[currentBattleMode()]}」`);
    /* 从逐回合切走时，立刻交回这条待行动的单位，不用等 8s 兜底 */
    if(B.paused && typeof B._pauseResume === 'function'){
      const resume = B._pauseResume;
      B._pauseResume = null;
      resume();
    }
    save();
  });
  overlay.querySelector('#bMode').textContent = MODE_LABEL[currentBattleMode()] || '自动';
  renderSkillBar();

  let battleClosed = false;
  let autoCloseTimer = null;
  let storageResumeTimer = null;
  const deferredActions = [];

  function closeBattle(){
    if(storageConflict || persistenceBlocked || saveRetryNeeded)return;
    if(battleClosed) return;
    battleClosed = true;
    B.running = false;
    B.paused = false;
    afterPlayerAction = null;
    if(B.pauseTimer){ clearTimeout(B.pauseTimer); B.pauseTimer = null; }
    B._pauseResume = null;
    if(autoCloseTimer){ clearTimeout(autoCloseTimer); autoCloseTimer = null; }
    if(storageResumeTimer){ clearTimeout(storageResumeTimer); storageResumeTimer = null; }
    deferredActions.length = 0;
    if(B.timer) clearInterval(B.timer);
    B.pendingTimers.forEach(t=>clearTimeout(t));
    B.pendingTimers = [];
    overlay.remove();$('#app').classList.remove('has-game-overlay');
    LivingWorld.clearFX();
    LivingWorld.release(S,'battle');save();
    renderTab();
  }

  function resumeActions(){
    storageResumeTimer = null;
    if(battleClosed || storageConflict || persistenceBlocked)return;
    if(saveRetryNeeded){ storageResumeTimer = setTimeout(resumeActions, 100); return; }
    // Keep the original action order when several timers became due during a failed save.
    while(deferredActions.length && !battleClosed && !storageConflict && !persistenceBlocked && !saveRetryNeeded){
      deferredActions.shift()();
    }
    if(deferredActions.length && !battleClosed && !storageConflict && !persistenceBlocked)storageResumeTimer = setTimeout(resumeActions, 100);
  }
  function later(fn, ms){
    const id = setTimeout(()=>{
      B.pendingTimers = B.pendingTimers.filter(x=>x!==id);
      if(battleClosed)return;
      if(storageConflict || persistenceBlocked || saveRetryNeeded || deferredActions.length){
        deferredActions.push(fn);
        if(!storageResumeTimer && !storageConflict && !persistenceBlocked)storageResumeTimer = setTimeout(resumeActions, 100);
        return;
      }
      fn();
    }, ms);
    B.pendingTimers.push(id);
    return id;
  }

  overlay.querySelectorAll('.speed-btn[data-speed]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      battleSpeed = +btn.dataset.speed;
      S.battleSpeed = battleSpeed;
      save();
      overlay.querySelectorAll('.speed-btn[data-speed]').forEach(b=>b.classList.toggle('on', b===btn));
      restartTimer();
    });
  });

  function intervalMs(){ return Math.round(9000 / battleSpeed); }

  function restartTimer(){
    if(B.timer) clearInterval(B.timer);
    if(!B.running) return;
    B.timer = setInterval(nextTurn, intervalMs());
  }

  function log(msg){ logEl.innerHTML = msg; }

  /* 战斗内攻击力：攻击类型 × 元素羁绊 × 首领加成。教学战保持原来的物攻口径，课程数值不变。 */
  function unitAttack(unit){
    if(unit.isMini) return unit.atk;
    const base = B.training ? physAtk(unit.ref) : attackPower(unit.ref);
    return Math.round(base * (unit.atkMul || 1) * (unit.ref.isBoss ? BOSS_ATK_MUL : 1));
  }
  /* 防御/抗性减伤：在暴击和克制之后、护盾之前结算 */
  function mitigate(attackerRef, target, dmg){
    if(B.training) return dmg;
    return Math.max(1, Math.round(dmg * mitigation(attackerRef, target.ref)));
  }

  function dealDamage(target, dmg){
    const st = target.st;
    let remaining = dmg;
    if(st.rockArmor > 0 || st.iceArmor > 0){
      remaining = Math.max(1, Math.round(remaining * 0.75));
    }
    if(st.rockArmor > 0){
      const absorbed = Math.min(st.rockArmor, remaining);
      st.rockArmor -= absorbed;
      remaining -= absorbed;
    }
    if(st.iceArmor > 0){
      const absorbed = Math.min(st.iceArmor, remaining);
      st.iceArmor -= absorbed;
      remaining -= absorbed;
    }
    target.hp = Math.max(0, target.hp - remaining);
    return remaining;
  }

  /* 护盾（岩甲 / 冰甲）会把伤害先吃掉；如果护盾吃满了这一下，直接报“造成 0 伤害”
     会像攻击打空，所以战报改成披露吸收量，飘字也换成“护盾”。 */
  function shieldOf(target){
    return (target.st.rockArmor || 0) + (target.st.iceArmor || 0);
  }
  function damageLogText(target, beforeShield, actual, head, tail){
    const absorbed = Math.max(0, beforeShield - shieldOf(target));
    if(actual === 0 && absorbed > 0) return `${head}，护盾吸收 ${absorbed} 点${tail || ''}`;
    return `${head}，造成 ${actual} 伤害${tail || ''}`;
  }

  function applyStatus(unit, key, amount){
    const st = unit.st;
    if(st.immuneDebuff) return false;
    if(key === 'burn' && unit.ref.element === '水') return false;
    if(key === 'burn' && unit.ref.element === '草') amount += 1;
    const def = STATUS_DEFS[key];
    if(!def) return false;
    st[key] = Math.min(def.max, (st[key]||0) + amount);
    if(key === 'frostbite' && st.frostbite >= 3){
      st.frostbite = 0;
      st.frozen = 1;
    }
    return true;
  }

  function isUntargetable(unit, team){
    if(unit.st && (unit.st.intangible || 0) > 0) return true;
    if(unit.ref.element !== '空间') return false;
    return team.some(u=>u !== unit && u.hp > 0);
  }

  function checkRevive(side){
    const team = side === 'ally' ? B.allies : B.monsters;
    if(team.some(u=>u.hp > 0)) return false;
    const reviver = team.find(u=>u.st.timeRevive && !u.st.reviveUsed);
    if(!reviver) return false;
    reviver.st.reviveUsed = true;
    team.forEach(u=>{
      u.hp = Math.max(1, Math.round(u.maxHp * 0.2));
      u.st.burn = u.st.poison = u.st.frostbite = 0;
      u.st.frozen = u.st.paralysis = u.st.charm = u.st.weakness = 0;
      u.st.rockArmor = 0;
      u.st.iceArmor = 0;
      /* 死亡演出（.dying 定格 opacity:0）必须撤掉，否则复活的史莱姆看不见 */
      const el = getUnitEl(u, side);
      const sl = el && el.querySelector('.slime');
      if(sl) sl.classList.remove('dying');
    });
    log(`⏳ ${reviver.ref.name} 触发【回溯】，全体友方复活（回复20%生命）！`);
    refreshBars();
    return true;
  }

  function getCoords(el){
    const fieldRect = fieldEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {x:r.left-fieldRect.left+r.width/2, y:r.top-fieldRect.top+r.height/2};
  }

  function spawnRadiantOrbs(from, to, col, count, sizeRange, opts){
    opts = opts || {};
    const [minS, maxS] = sizeRange || [9, 24];
    const opBase = opts.opacity != null ? opts.opacity : 0.92;
    const spreadX = opts.spreadX != null ? opts.spreadX : 22;
    const spreadYMin = opts.spreadYMin != null ? opts.spreadYMin : 28;
    const spreadYMax = opts.spreadYMax != null ? opts.spreadYMax : 60;
    const noFade = !!opts.noFade;
    const glow = opts.glow;
    const glowSpread = opts.glowSpread != null ? opts.glowSpread : 1.4;
    for(let i=0;i<count;i++){
      const size = rnd(minS, maxS);
      const orb = document.createElement('div');
      orb.className = 'skill-orb';
      orb.style.left = from.x+'px'; orb.style.top = from.y+'px';
      orb.style.width = size+'px'; orb.style.height = size+'px';
      orb.style.background = `radial-gradient(circle, ${col} 12%, ${col} 28%, rgba(255,255,255,0.22) 58%, rgba(255,255,255,0) 100%)`;
      orb.style.clipPath = 'polygon(50% 0%, 65% 40%, 100% 50%, 65% 60%, 50% 100%, 35% 60%, 0% 50%, 35% 40%)';
      orb.style.borderRadius = '0';
      orb.style.filter = 'blur(2.6px)';
      orb.style.opacity = String(opBase);
      if(glow){
        orb.style.boxShadow = `0 0 ${size*glowSpread}px ${glow}, 0 0 ${size*glowSpread*1.7}px ${glow}`;
      } else {
        orb.style.boxShadow = `0 0 ${size*0.6}px ${col}, 0 0 ${size*1.4}px ${col}80`;
      }
      fieldEl.appendChild(orb);
      const ex = from.x + rnd(-spreadX, spreadX);
      const ey = from.y - rnd(spreadYMin, spreadYMax);
      setTimeout(()=>{
        if(!orb.isConnected) return;
        const t0 = performance.now(), d1 = 260 + Math.random()*120;
        function spread(now){
          if(!orb.isConnected) return;
          const p = Math.min(1,(now-t0)/d1);
          const ease = 1-Math.pow(1-p,2);
          orb.style.left = (from.x+(ex-from.x)*ease)+'px';
          orb.style.top  = (from.y+(ey-from.y)*ease)+'px';
          if(p<1){ requestAnimationFrame(spread); return; }
          const t1 = performance.now(), d2 = 340 + Math.random()*140;
          function fly(now2){
            if(!orb.isConnected) return;
            const q = Math.min(1,(now2-t1)/d2);
            const e2 = q*q;
            orb.style.left = (ex+(to.x-ex)*e2)+'px';
            orb.style.top  = (ey+(to.y-ey)*e2)+'px';
            if(noFade){
              orb.style.opacity = String(opBase);
            } else {
              orb.style.opacity = (opBase * (1 - q*0.6)).toFixed(2);
            }
            if(q<1) requestAnimationFrame(fly); else orb.remove();
          }
          requestAnimationFrame(fly);
        }
        requestAnimationFrame(spread);
      }, i*50);
    }
  }

  function markBattleAction(atkUnit,tgtUnit){
    overlay.querySelectorAll('.is-acting,.is-targeted').forEach(e=>e.classList.remove('is-acting','is-targeted'));
    if(atkUnit)atkUnit.classList.add('is-acting');if(tgtUnit)tgtUnit.classList.add('is-targeted');
    later(()=>{if(atkUnit)atkUnit.classList.remove('is-acting');if(tgtUnit)tgtUnit.classList.remove('is-targeted');},Math.max(400,1100/battleSpeed));
  }
  function doElementBallEffect(attacker, atkUnit, tgtUnit, important){
    if(!atkUnit || !tgtUnit) return;
    markBattleAction(atkUnit,tgtUnit);
    const from = getCoords(atkUnit), to = getCoords(tgtUnit);
    const c = slimeColor(attacker);
    const h = c.h, s = Math.max(c.s,40), l = Math.max(c.l,55);
    const col = `hsl(${h} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
    const miniScale = attacker.miniScale || 1;
    if(!important){
      const orb=document.createElement('div');orb.className='skill-orb';orb.style.cssText=`left:${from.x}px;top:${from.y}px;width:7px;height:7px;background:${col};box-shadow:0 0 5px ${col};opacity:.8`;fieldEl.appendChild(orb);
      const start=performance.now(),duration=Math.max(120,320/battleSpeed);
      const fly=now=>{if(!orb.isConnected)return;const p=Math.min(1,(now-start)/duration);orb.style.left=from.x+(to.x-from.x)*p+'px';orb.style.top=from.y+(to.y-from.y)*p+'px';if(p<1)requestAnimationFrame(fly);else orb.remove();};requestAnimationFrame(fly);return;
    }
    const ring = document.createElement('div');
    ring.className = 'skill-ring important';
    ring.style.left = from.x+'px';
    ring.style.top = from.y+'px';
    ring.style.setProperty('--h', h);
    ring.style.setProperty('--s', s.toFixed(1)+'%');
    ring.style.setProperty('--l', l.toFixed(1)+'%');
    fieldEl.appendChild(ring);
    setTimeout(()=>ring.remove(), 820);

    const el = attacker.element;

    if(el === '幻'){
      const heartCount = 6 + Math.floor(Math.random()*3);
      for(let i=0;i<heartCount;i++){
        const size = rnd(7, 17);
        const orb = document.createElement('div');
        orb.className = 'skill-orb';
        orb.style.left = from.x+'px'; orb.style.top = from.y+'px';
        orb.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="fill:${col}; filter:drop-shadow(0 0 6px ${col})"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
        orb.style.background = 'transparent';
        orb.style.boxShadow = 'none';
        orb.style.width = size + 'px';
        orb.style.height = size + 'px';
        fieldEl.appendChild(orb);
        const ang = Math.random()*Math.PI*2;
        const dist = rnd(18, 46);
        const ex = from.x + Math.cos(ang)*dist;
        const ey = from.y + Math.sin(ang)*dist;
        setTimeout(()=>{
          if(!orb.isConnected) return;
          const t0 = performance.now(), d1 = 240 + Math.random()*120;
          function spread(now){
            if(!orb.isConnected) return;
            const p = Math.min(1,(now-t0)/d1);
            const ease = 1-Math.pow(1-p,2);
            orb.style.left = (from.x+(ex-from.x)*ease)+'px';
            orb.style.top  = (from.y+(ey-from.y)*ease)+'px';
            if(p<1){ requestAnimationFrame(spread); return; }
            const t1 = performance.now(), d2 = 340 + Math.random()*140;
            function fly(now2){
              if(!orb.isConnected) return;
              const q = Math.min(1,(now2-t1)/d2);
              const e2 = q*q;
              orb.style.left = (ex+(to.x-ex)*e2)+'px';
              orb.style.top  = (ey+(to.y-ey)*e2)+'px';
              orb.style.opacity = (1 - q*0.5).toFixed(2);
              if(q<1) requestAnimationFrame(fly); else orb.remove();
            }
            requestAnimationFrame(fly);
          }
          requestAnimationFrame(spread);
        }, i*55);
      }
      return;
    }

    if(el === '光'){
      spawnRadiantOrbs(from, to, col, 9 + Math.floor(Math.random()*5));
      return;
    }

    if(el === '雷' || el === '暗'){
      const bigSize = rnd(34, 48);
      const orb = document.createElement('div');
      orb.className = 'skill-orb';
      orb.style.left = from.x+'px'; orb.style.top = from.y+'px';
      orb.style.width = bigSize+'px'; orb.style.height = bigSize+'px';
      orb.style.borderRadius = '50%';
      orb.style.background = `radial-gradient(circle at 34% 30%, ${col}, ${col} 58%, rgba(0,0,0,.22) 100%)`;
      orb.style.boxShadow = `0 0 ${bigSize*0.55}px rgba(180,190,200,0.85), inset -7px -7px 16px rgba(150,155,165,0.9), inset 5px 5px 12px rgba(0,0,0,.25)`;
      orb.style.overflow = 'hidden';
      const inner = document.createElement('span');
      inner.style.position = 'absolute';
      inner.style.left = '50%';
      inner.style.top = '50%';
      inner.style.transform = 'translate(-50%,-50%)';
      inner.style.borderRadius = '50%';
      inner.style.background = 'rgba(0,0,0,0.65)';
      inner.style.boxShadow = '0 0 8px rgba(0,0,0,.5)';
      inner.style.width = (bigSize*0.6)+'px';
      inner.style.height = (bigSize*0.6)+'px';
      inner.style.opacity = '0.75';
      orb.appendChild(inner);
      fieldEl.appendChild(orb);

      const changeTimer = setInterval(()=>{
        if(!inner.isConnected){ clearInterval(changeTimer); return; }
        const maxS = bigSize * 0.75;
        const s2 = rnd(bigSize*0.3, maxS);
        inner.style.width = s2.toFixed(1)+'px';
        inner.style.height = s2.toFixed(1)+'px';
        inner.style.opacity = (0.55 + Math.random()*0.35).toFixed(2);
      }, 90);

      const dur = 540 + Math.random()*200;
      const t0 = performance.now();
      function step(now){
        if(!orb.isConnected){ clearInterval(changeTimer); return; }
        const p = Math.min(1, (now - t0)/dur);
        orb.style.left = (from.x+(to.x-from.x)*p)+'px';
        orb.style.top  = (from.y+(to.y-from.y)*p)+'px';
        if(p<1) requestAnimationFrame(step);
        else { clearInterval(changeTimer); orb.remove(); }
      }
      requestAnimationFrame(step);
      return;
    }

    if(el === '火'){
      const count = 3 + (Math.random() < 0.5 ? 1 : 0);
      for(let i=0;i<count;i++){
        const outerSize = rnd(20, 34) * miniScale;
        const midSize = outerSize * 7 / 9;
        const innerSize = outerSize * 5 / 9;
        const orb = document.createElement('div');
        orb.className = 'skill-orb';
        orb.style.left = from.x+'px'; orb.style.top = from.y+'px';
        orb.style.width = outerSize+'px';
        orb.style.height = outerSize+'px';
        orb.style.borderRadius = '50%';
        orb.style.background = 'rgba(255, 100, 35, 0.95)';
        orb.style.boxShadow = `0 0 ${outerSize*0.5}px rgba(255, 120, 40, 0.9)`;
        orb.style.overflow = 'hidden';
        orb.innerHTML = `
          <span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${midSize.toFixed(1)}px;height:${midSize.toFixed(1)}px;border-radius:50%;background:${col};"></span>
          <span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${innerSize.toFixed(1)}px;height:${innerSize.toFixed(1)}px;border-radius:50%;background:#fff8e8;"></span>
        `;
        fieldEl.appendChild(orb);
        setTimeout(()=>{
          if(!orb.isConnected) return;
          const t0 = performance.now(), dur = 420;
          function step(now){
            if(!orb.isConnected) return;
            const p = Math.min(1,(now-t0)/dur);
            orb.style.left = (from.x+(to.x-from.x)*p)+'px';
            orb.style.top  = (from.y+(to.y-from.y)*p)+'px';
            if(p<1) requestAnimationFrame(step); else orb.remove();
          }
          requestAnimationFrame(step);
        }, i*80);
      }
      return;
    }

    if(el === '岩' || el === '冰'){
      const count = 5 + Math.floor(Math.random()*3);
      const spacing = 14;
      const headY = from.y - 46;
      for(let i=0;i<count;i++){
        const orb = document.createElement('div');
        orb.className = 'skill-orb';
        const startX = from.x + (i - (count-1)/2) * spacing + rnd(-2,2);
        const startY = headY + rnd(-10, 10);
        orb.style.left = startX+'px';
        orb.style.top = startY+'px';
        orb.style.background = col;
        orb.style.boxShadow = `0 0 10px ${col}`;
        orb.style.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
        orb.style.borderRadius = '0';
        orb.style.width = '36px';
        orb.style.height = '5px';
        const ang = Math.atan2(to.y - startY, to.x - startX) * 180 / Math.PI;
        orb.style.transform = `translate(-50%,-50%) rotate(${ang}deg)`;
        fieldEl.appendChild(orb);
        setTimeout(()=>{
          if(!orb.isConnected) return;
          const t0 = performance.now(), dur = 380;
          function step(now){
            if(!orb.isConnected) return;
            const p = Math.min(1,(now-t0)/dur);
            orb.style.left = (startX+(to.x-startX)*p)+'px';
            orb.style.top  = (startY+(to.y-startY)*p)+'px';
            if(p<1) requestAnimationFrame(step); else orb.remove();
          }
          requestAnimationFrame(step);
        }, 280 + i*45);
      }
      return;
    }

    if(el === '风' || el === '空间'){
      const rows = 2, cols = 3;
      const spacingX = 20, spacingY = 15;
      const baseY = from.y - 64;
      const crescentSVG = `<svg viewBox="0 0 60 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;overflow:visible"><path d="M 50,5 Q 5,50 50,95 Q 30,50 50,5 Z" fill="${col}" style="filter:drop-shadow(0 0 4px ${col})"/></svg>`;
      const blades = [];
      for(let r = 0; r < rows; r++){
        const colOrder = r === 0 ? [0, 1, 2] : [2, 1, 0];
        for(let ci = 0; ci < cols; ci++){
          const c2 = colOrder[ci];
          const ow = rnd(22, 36);
          const oh = ow * 0.55;
          const w = ow * 0.5;
          const h = oh;
          const orb = document.createElement('div');
          orb.className = 'skill-orb';
          orb.style.width = w + 'px';
          orb.style.height = h + 'px';
          orb.style.background = 'transparent';
          orb.style.borderRadius = '0';
          orb.style.boxShadow = 'none';
          orb.innerHTML = crescentSVG;
          orb.style.transform = 'translate(-50%,-50%) rotate(90deg)';
          const sx = from.x + (c2 - 1) * spacingX + rnd(-2, 2);
          const sy = baseY + r * spacingY + rnd(-2, 2);
          orb.style.left = sx + 'px';
          orb.style.top = sy + 'px';
          fieldEl.appendChild(orb);
          const launchIndex = r === 0 ? ci : cols + ci;
          blades.push({ orb, sx, sy, launchIndex });
        }
      }
      blades.forEach(b => {
        setTimeout(() => {
          if(!b.orb.isConnected) return;
          const angle = Math.atan2(to.y - b.sy, to.x - b.sx) * 180 / Math.PI - 180;
          b.orb.style.transform = `translate(-50%,-50%) rotate(${angle}deg)`;
          const t0 = performance.now(), dur = 400 + Math.random() * 120;
          function step(now){
            if(!b.orb.isConnected) return;
            const p = Math.min(1, (now - t0) / dur);
            const e = 1 - Math.pow(1 - p, 2);
            b.orb.style.left = (b.sx + (to.x - b.sx) * e) + 'px';
            b.orb.style.top  = (b.sy + (to.y - b.sy) * e) + 'px';
            b.orb.style.opacity = (1 - p * 0.6).toFixed(2);
            if(p < 1) requestAnimationFrame(step); else b.orb.remove();
          }
          requestAnimationFrame(step);
        }, b.launchIndex * 70);
      });
      return;
    }

    const count = 3 + (Math.random() < 0.5 ? 1 : 0);
    for(let i=0;i<count;i++){
      const orb = document.createElement('div');
      orb.className = 'skill-orb';
      orb.style.left = from.x+'px'; orb.style.top = from.y+'px';

      if (el === '水') {
          const size = rnd(12, 31) * miniScale;
          orb.style.width = size+'px';
          orb.style.height = size+'px';
          orb.style.background = 'transparent';
          orb.style.border = `1px solid ${col}`;
          orb.style.borderRadius = '50%';
          orb.style.boxShadow = `inset 0 0 6px rgba(255,255,255,0.45), 0 0 8px ${col}`;
          orb.style.overflow = 'hidden';
          orb.innerHTML = `<span style="position:absolute;right:22%;top:18%;width:26%;height:22%;border-radius:50%;background:rgba(255,255,255,0.95);filter:blur(0.4px);"></span>`;
      } else {
          const size = rnd(6, 16);
          orb.style.width = size+'px';
          orb.style.height = size+'px';
          orb.style.background = col;
          orb.style.boxShadow = `0 0 12px ${col}`;
      }

      fieldEl.appendChild(orb);
      setTimeout(()=>{
        if(!orb.isConnected) return;
        const t0 = performance.now(), dur = 420;
        function step(now){
          if(!orb.isConnected) return;
          const p = Math.min(1,(now-t0)/dur);
          orb.style.left = (from.x+(to.x-from.x)*p)+'px';
          orb.style.top  = (from.y+(to.y-from.y)*p)+'px';
          if(p<1) requestAnimationFrame(step); else orb.remove();
        }
        requestAnimationFrame(step);
      }, i*70);
    }
  }

  function doHealEffect(healer, healUnit, tgtUnit){
    if(!healUnit || !tgtUnit) return;
    markBattleAction(healUnit,tgtUnit);
    const from = getCoords(healUnit), to = getCoords(tgtUnit);
    const c = slimeColor(healer);
    const h = c.h, s = Math.max(c.s,40), l = Math.max(c.l,60);
    const col = `hsl(${h} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;

    if(healer.element === '光'){
      spawnRadiantOrbs(
        from, to,
        'rgba(255, 233, 133, 1)',
        22 + Math.floor(Math.random()*8),
        [6, 14],
        {
          opacity: 1,
          spreadX: 48,
          spreadYMin: 38,
          spreadYMax: 88,
          noFade: true,
          glow: 'rgba(255, 240, 120, 0.95)',
          glowSpread: 0.8
        }
      );
      return;
    }
    if(healer.element === '暗'){
      spawnRadiantOrbs(
        from, to, col,
        20 + Math.floor(Math.random()*9),
        [4, 10],
        {opacity: 1, spreadX: 42, spreadYMin: 36, spreadYMax: 92}
      );
      return;
    }

    const isWaterHeal = healer.element === '水';
    const count = 10 + Math.floor(Math.random()*6);
    for(let i=0;i<count;i++){
      const dot = document.createElement('div');
      dot.className = 'heal-dot';
      const size = isWaterHeal ? rnd(6,13) : rnd(4,10);
      dot.style.width = size+'px'; dot.style.height = size+'px';
      if(isWaterHeal){
        dot.style.background = 'transparent';
        dot.style.border = `1px solid ${col}`;
        dot.style.borderRadius = '50%';
        dot.style.boxShadow = `inset 0 0 5px rgba(255,255,255,0.4), 0 0 6px ${col}`;
        dot.style.overflow = 'hidden';
        dot.innerHTML = `<span style="position:absolute;right:22%;top:18%;width:26%;height:22%;border-radius:50%;background:rgba(255,255,255,0.95);filter:blur(0.4px);"></span>`;
      } else {
        dot.style.background = col;
        dot.style.boxShadow = `0 0 8px ${col}`;
      }
      const angle = Math.random()*Math.PI*2;
      const dist = rnd(15,45);
      const sx = from.x+Math.cos(angle)*dist, sy = from.y+Math.sin(angle)*dist;
      dot.style.left = sx+'px'; dot.style.top = sy+'px';
      fieldEl.appendChild(dot);
      setTimeout(()=>{
        if(!dot.isConnected) return;
        const t0 = performance.now(), dur = 500+Math.random()*200;
        function step(now){
          if(!dot.isConnected) return;
          const p = Math.min(1,(now-t0)/dur);
          const ease = 1-Math.pow(1-p,3);
          dot.style.left = (sx+(to.x-sx)*ease)+'px';
          dot.style.top  = (sy+(to.y-sy)*ease)+'px';
          dot.style.opacity = (1-p).toFixed(2);
          if(p<1) requestAnimationFrame(step); else dot.remove();
        }
        requestAnimationFrame(step);
      }, Math.random()*200);
    }
  }

  function doDrainEffect(fromEl, toEl, col){
    if(!fromEl || !toEl) return;
    const from = getCoords(fromEl), to = getCoords(toEl);
    const count = 6 + Math.floor(Math.random()*4);
    for(let i=0;i<count;i++){
      const dot = document.createElement('div');
      dot.className = 'heal-dot';
      const size = rnd(2.5, 6.5);
      dot.style.width = size+'px';
      dot.style.height = size+'px';
      dot.style.background = col;
      dot.style.boxShadow = `0 0 6px ${col}`;
      dot.style.opacity = '0.7';
      dot.style.filter = 'blur(0.4px)';
      const sx = from.x + rnd(-10, 10);
      const sy = from.y + rnd(-10, 10);
      dot.style.left = sx+'px'; dot.style.top = sy+'px';
      fieldEl.appendChild(dot);
      const ang = Math.random()*Math.PI*2;
      const dist = rnd(18, 46);
      const ex = from.x + Math.cos(ang)*dist;
      const ey = from.y + Math.sin(ang)*dist;
      setTimeout(()=>{
        if(!dot.isConnected) return;
        const t0 = performance.now(), d1 = 240 + Math.random()*120;
        function spread(now){
          if(!dot.isConnected) return;
          const p = Math.min(1,(now-t0)/d1);
          const ease = 1-Math.pow(1-p,2);
          dot.style.left = (from.x+(ex-from.x)*ease)+'px';
          dot.style.top  = (from.y+(ey-from.y)*ease)+'px';
          if(p<1){ requestAnimationFrame(spread); return; }
          const t1 = performance.now(), d2 = 420 + Math.random()*180;
          function fly(now2){
            if(!dot.isConnected) return;
            const q = Math.min(1,(now2-t1)/d2);
            const e2 = q*q;
            dot.style.left = (ex+(to.x-ex)*e2)+'px';
            dot.style.top  = (ey+(to.y-ey)*e2)+'px';
            dot.style.opacity = (0.7*(1-q*0.7)).toFixed(2);
            if(q<1) requestAnimationFrame(fly); else dot.remove();
          }
          requestAnimationFrame(fly);
        }
        requestAnimationFrame(spread);
      }, i*45);
    }
  }

  function getUnitEl(unit, side){
    if(unit.isMini && unit.el) return unit.el;
    const s = side || unit.side;
    return overlay.querySelector(s==='ally'
      ? `[data-ally-id="${unit.ref.id}"]`
      : `[data-mon-id="${unit.ref.id}"]`);
  }

  function getAllAliveMain(side){
    return (side==='ally'?B.allies:B.monsters).filter(u=>u.hp>0);
  }
  function getAllAliveUnits(side){
    const main = getAllAliveMain(side);
    const minis = [];
    main.forEach(u=>{
      (u.minis||[]).forEach(m=>{ if(m.hp>0) minis.push(m); });
    });
    return main.concat(minis);
  }

  function removeMini(mini){
    const owner = mini.ownerUnit;
    if(owner && owner.minis){
      owner.minis = owner.minis.filter(m=>m!==mini);
    }
    if(mini.el && mini.el.isConnected){
      const el = mini.el;
      const sl = el.querySelector('.slime');
      if(sl) FX.die(sl, 6);
      el.dataset.dead = '1';
      /* 让缩灭演出播完再摘节点 */
      setTimeout(()=>{ if(el.isConnected) el.remove(); }, 340);
    }
  }
  function removeMinisOf(unit){
    if(!unit || !unit.minis) return;
    unit.minis.slice().forEach(m=>removeMini(m));
    unit.minis = [];
  }

  function handleUnitDeath(unit, side){
    if(unit.hp > 0) return;
    if(unit.isMini){
      removeMini(unit);
      return;
    }
    /* 先判回溯复活：被拉起来的单位不播死亡演出 */
    const revived = checkRevive(side);
    const deadEl = getUnitEl(unit, side);
    if(!revived && deadEl){
      FX.die(deadEl, 12);
      /* 死亡演出（.dying 用 forwards 定格在 opacity:0）播完后撤掉该类，
         让身体回到第一版的观感：留在原地、平眼（data-dead=1 由 refreshBars 维护） */
      setTimeout(() => {
        const sl = deadEl.querySelector('.slime');
        if(sl && sl.dataset.dead === '1') sl.classList.remove('dying');
      }, 380);
    }
    removeMinisOf(unit);
    /* 手动模式下阵亡后技能条要立刻少一个可用单位 */
    if(currentBattleMode() !== 'auto') renderSkillBar();
  }

  function spawnMiniSlime(ownerUnit, side){
    if(!ownerUnit || ownerUnit.hp <= 0) return null;
    if(!ownerUnit.minis) ownerUnit.minis = [];
    const alive = ownerUnit.minis.filter(m=>m.hp>0);
    if(alive.length >= 3) return null;
    const slots = ['right','left-front','left-back'];
    let slot = null;
    for(const s of slots){
      if(!alive.some(m=>m.slot===s)){ slot = s; break; }
    }
    if(!slot) return null;
    const ownerEl = getUnitEl(ownerUnit, side);
    if(!ownerEl) return null;
    const wrap = ownerEl.querySelector('.slime-wrap');
    if(!wrap) return null;
    const maxHp = Math.max(1, Math.round(ownerUnit.maxHp * 0.3));
    const mini = {
      isMini:true,
      id: 'mini_'+ownerUnit.ref.id+'_'+(++miniSeq),
      ownerUnit, side, slot,
      hp: maxHp, maxHp,
      atk: Math.max(1, Math.round(unitAttack(ownerUnit) * 0.3)),
      st: {burn:0, poison:0, frostbite:0, frozen:0, freezeVisual:false, paralysis:0, charm:0, weakness:0, rockArmor:0, iceArmor:0, timeRevive:false, reviveUsed:false, immuneDebuff:false},
      ref: { name: `${ownerUnit.ref.name}的迷你水史莱姆`, element:'水', isMonster: ownerUnit.ref.isMonster, level: ownerUnit.ref.level }
    };
    mini.ref.id = mini.id;
    const el = document.createElement('div');
    el.className = 'mini-slime pos-'+slot;
    el.dataset.miniId = mini.id;
    el.innerHTML = `<div class="mini-hpbar"><i style="width:100%"></i></div>${slimeHTML(ownerUnit.ref,{mood:'jump'})}`;
    wrap.appendChild(el);
    mini.el = el;
    mini.hpBarEl = el.querySelector('.mini-hpbar i');
    ownerUnit.minis.push(mini);
    if(side==='enemy' && B.turn>0){ queueOneEnemy(mini); refreshIntentPanel(); }
    setTimeout(()=>{
      const sl = el.querySelector('.slime');
      if(sl && el.isConnected) sl.dataset.mood = 'idle';
    }, 900);
    return mini;
  }

  function miniSlimeAttack(mini){
    if(!mini || mini.hp <= 0) return;
    const targetSide = mini.side === 'ally' ? 'enemy' : 'ally';
    const all = getAllAliveUnits(targetSide);
    if(!all.length) return;
    const target = gamePick(all);
    const dmg = mitigate(mini.ref, target, Math.max(1, Math.round((mini.atk + gameInt(-2,2)) * (B.atkBuff||1))));
    const shield0 = shieldOf(target);
    const actual = dealDamage(target, dmg);
    const tgtEl = getUnitEl(target, target.isMini ? target.side : targetSide);
    if(tgtEl){
      FX.flash(tgtEl, false);
      FX.float(tgtEl, actual === 0 ? '护盾' : '-' + actual, { cls:'small' });
    }
    log(damageLogText(target, shield0, actual, `💧 ${mini.ref.name} 反击 ${target.ref.name}`));
    refreshBars();
    if(target.hp <= 0) handleUnitDeath(target, targetSide);
  }

  function performMiniAction(mini, side){
    if(storageConflict || persistenceBlocked || saveRetryNeeded)return;
    if(!mini || mini.hp <= 0) return;
    if(mini.acted) return;
    const q = side==='enemy' ? (mini.intent && mini.intent.round===B.turn ? mini.intent : queueOneEnemy(mini)) : null;
    if(turnControl(mini,side)){ mini.acted=true; if(q)q.state='canceled'; refreshIntentPanel(); return; }
    mini.acted=true;
    if(q)q.state='done';
    const el = mini.el;
    if(!el || !el.isConnected) return;
    const inner = el.querySelector('.slime');
    if(inner){
      inner.dataset.mood = 'jump';
      setTimeout(()=>{ if(inner.isConnected) inner.dataset.mood = 'idle'; }, 500);
    }
    const enemiesSide = side==='ally' ? 'enemy' : 'ally';
    const all = getAllAliveUnits(enemiesSide);
    if(!all.length) return;
    const target = q ? resolveIntentTarget(mini,side,false) : gamePick(all);
    if(!target) return;
    const tgtEl = getUnitEl(target, target.isMini ? target.side : enemiesSide);
    const attackerForFx = {element:'水', colorOverride:{h:205, s:80, l:60}, miniScale: 0.55};
    if(tgtEl) doElementBallEffect(attackerForFx, el, tgtEl);
    const dmg = mitigate(mini.ref, target, Math.max(1, Math.round((mini.atk + gameInt(-2,2)) * (B.atkBuff||1))));
    const shield0 = shieldOf(target);
    const actual = dealDamage(target, dmg);
    if(tgtEl){
      FX.flash(tgtEl, false);
      FX.float(tgtEl, actual === 0 ? '护盾' : '-' + actual, { cls:'small' });
    }
    log(damageLogText(target, shield0, actual, `💧 ${mini.ref.name} 攻击 ${target.ref.name}`));
    refreshBars();
    refreshIntentPanel();
    if(target.hp <= 0) handleUnitDeath(target, enemiesSide);
  }

  function refreshMiniBars(){
    [B.allies, B.monsters].forEach(team=>{
      team.forEach(u=>{
        (u.minis||[]).slice().forEach(m=>{
          if(m.hpBarEl && m.hpBarEl.isConnected){
            m.hpBarEl.style.width = Math.max(0, m.hp / m.maxHp * 100) + '%';
          }
          if(m.hp <= 0) removeMini(m);
        });
      });
    });
  }

  function applyAttackerElement(attackerUnit, targetUnit){
    const el = attackerUnit.ref.element;
    switch(el){
      case '火':
        if(applyStatus(targetUnit, 'burn', 1))
          setTimeout(()=>log(`🔥 ${targetUnit.ref.name} 被点燃！`), 120);
        break;
      case '草':
        if(applyStatus(targetUnit, 'poison', 1))
          setTimeout(()=>log(`☠ ${targetUnit.ref.name} 中毒！`), 120);
        break;
      case '雷':
        if(gameRandom() < 0.35 && applyStatus(targetUnit, 'paralysis', 1))
          setTimeout(()=>log(`⚡ ${targetUnit.ref.name} 被麻痹！`), 120);
        break;
      case '幻':
        if(gameRandom() < 0.45 && applyStatus(targetUnit, 'charm', 1))
          setTimeout(()=>log(`💗 ${targetUnit.ref.name} 被魅惑！`), 120);
        break;
      case '暗':
        if(applyStatus(targetUnit, 'weakness', 1))
          setTimeout(()=>log(`⬇ ${targetUnit.ref.name} 被侵蚀削弱！`), 120);
        break;
    }
  }

  /* 回合开始的状态结算：冻结/麻痹/持续伤害/魅惑。返回 true 表示本次行动被状态消耗掉 */
  function turnControl(unitWrapper, side){
    const ref = unitWrapper.ref;
    const st = unitWrapper.st;
    const unitEl = getUnitEl(unitWrapper, side);
    if(!unitEl) return false;

    if(st.frozen > 0){
      log(`${ref.name} 被冻结，无法行动`);
      st.frozen = 0;
      st.freezeVisual = true;
      refreshBars();
      later(()=>{ st.freezeVisual = false; refreshBars(); }, Math.round(1400 / battleSpeed));
      return true;
    }
    if(st.paralysis > 0){ st.paralysis--; log(`${ref.name} 被麻痹，无法行动`); refreshBars(); return true; }

    const burn = st.burn, poison = st.poison;
    if(burn > 0 || poison > 0){
      let dot = 0;
      if(burn > 0) dot += Math.round(unitWrapper.maxHp * 0.03 * burn);
      if(poison > 0) dot += Math.round(unitWrapper.maxHp * 0.03 * poison);
      const actual = dealDamage(unitWrapper, dot);
      FX.float(unitEl, '-' + actual, { cls:'dot', icon: burn > 0 ? '🔥' : '☠' });
      log(`${ref.name} 受到 ${actual} 点持续伤害${burn?'（烧伤）':''}${poison?'（毒素）':''}`);
      refreshBars();
      if(unitWrapper.hp <= 0){ handleUnitDeath(unitWrapper, side); return true; }
    }

    if(st.charm > 0){
      st.charm--;
      const friends = side==='ally' ? B.allies : B.monsters;
      const alive = friends.filter(f=>f.hp>0 && f!==unitWrapper);
      if(alive.length){
        const target = gamePick(alive);
        const tgtEl = getUnitEl(target, side);
        if(tgtEl) doElementBallEffect(ref, unitEl, tgtEl);
        const dmg = mitigate(ref, target, Math.max(1, Math.round(unitAttack(unitWrapper) * (B.atkBuff||1))));
        const actual = dealDamage(target, dmg);
        FX.flash(tgtEl, false);
        FX.float(tgtEl, '-' + actual, {});
        log(`💗 ${ref.name} 被魅惑，攻击友方 ${target.ref.name}，造成 ${actual} 伤害`);
        refreshBars();
        if(target.hp <= 0) handleUnitDeath(target, side);
      } else {
        log(`💗 ${ref.name} 被魅惑，但无事发生`);
      }
      return true;
    }
    return false;
  }

  /* 意图只计划一次；执行使用同一个动作和目标，而非根据文案重新掷骰。 */
  function chooseIntentTarget(unit, side, healing){
    const targetSide = healing ? side : (side==='enemy'?'ally':'enemy');
    const mains = getAllAliveMain(targetSide);
    const all = getAllAliveUnits(targetSide);
    let pool = all.filter(t=>healing || !isUntargetable(t,mains));
    if(!pool.length) pool = all;
    if(!pool.length) return null;
    if(healing) return pool.reduce((a,b)=>b.hp/b.maxHp<a.hp/a.maxHp?b:a);
    let bestScore=-Infinity, best=[];
    pool.forEach(t=>{
      const mult = ((ELEMENT_CHART[unit.ref.element]||{})[t.ref.element]||1) * (unit.ref.element==='光'&&t.ref.isMonster?2:1);
      const score = mult>1?2:mult===1?1:0;
      if(score>bestScore){bestScore=score;best=[t];} else if(score===bestScore) best.push(t);
    });
    return B.training ? best[0] : gamePick(best);
  }
  function queueOneEnemy(unit){
    if(unit.hp<=0) return null;
    let kind='attack', name='攻击', mult=1, power=0;
    if(unit.isMini){name='水弹';}
    else if(B.training){
      if(B.challengeId==='shield'){power=B.turn<=1?320:60;kind=B.turn<=1?'heavy':'attack';}
      else if(B.challengeId==='control'){kind=(B.turn-1)%3===0?'heavy':'attack';power=kind==='heavy'?400:60;}
      else power=35;
      name=kind==='heavy'?'重击':'攻击';
    } else if(unit.ref.skill==='治疗' && getAllAliveMain('enemy').some(u=>u.hp<u.maxHp*0.7)) {kind='heal';name=unit.ref.element==='光'?'治疗并净化':'治疗';}
    else if(unit.hp/unit.maxHp<0.4 && B.turn%3===2){kind='guard';name='防御 · 25%护盾';}
    else if(B.turn%3===0){kind='heavy';name='蓄力重击';mult=1.65;}
    const target=kind==='guard'?unit:chooseIntentTarget(unit,'enemy',kind==='heal');
    unit.intent={kind,name,mult,power,round:B.turn,state:'pending',targetId:target?target.ref.id:null,targetName:target?target.ref.name:'无目标'};
    return unit.intent;
  }
  function queueEnemyIntents(){
    getAllAliveUnits('enemy').forEach(queueOneEnemy);
    refreshIntentPanel();
    refreshBars();
  }
  function refreshIntentPanel(){
    let hint = overlay.querySelector('.training-hint');
    if(!B.running || !challenge){ if(hint) hint.remove(); return; }
    if(!hint){
      hint = document.createElement('div');
      hint.className = 'training-hint';
      hint.setAttribute('aria-live', 'polite');
      fieldEl.appendChild(hint);
    }
    hint.textContent = `${challenge.hint} · ${B.practiceUsed[B.challengeId] ? '机制已达成，请赢下本场' : '等待完成本课机制'}`;
  }
  function resolveIntentTarget(unit, side, healing){
    const q=unit.intent;
    if(!q) return chooseIntentTarget(unit,side,healing);
    const targetSide=healing?side:(side==='enemy'?'ally':'enemy');
    const mains=getAllAliveMain(targetSide);
    const all=getAllAliveUnits(targetSide);
    let target=all.find(t=>String(t.ref.id)===String(q.targetId));
    if(target && (healing || !isUntargetable(target,mains))) return target;
    target=chooseIntentTarget(unit,side,healing);
    q.targetId=target?target.ref.id:null;
    q.targetName=target?target.ref.name:'无目标';
    log(`${unit.ref.name} 的预告目标已失效，${target?'重新锁定 '+target.ref.name:'取消行动'}`);
    refreshIntentPanel();
    return target;
  }
  function resolveTrainingAttack(unit, target){
    const q=unit.intent;
    if(!target) return;
    const shield0=shieldOf(target);
    const actual=dealDamage(target,q.power);
    if(B.challengeId==='shield' && q.kind==='heavy' && shield0>shieldOf(target)) B.practiceUsed.shield=true;
    const targetEl=getUnitEl(target,'ally');
    const attackerEl=getUnitEl(unit,'enemy');
    if(targetEl && attackerEl) doElementBallEffect(unit.ref,attackerEl,targetEl,q.kind==='heavy');
    FX.flash(targetEl,q.kind==='heavy');
    if(q.kind==='heavy') FX.shake('crit');
    FX.float(targetEl,actual?'-'+actual:'护盾',{cls:q.kind==='heavy'?'crit':''});
    log(damageLogText(target,shield0,actual,`${unit.ref.name} 执行预告${q.name}，命中 ${target.ref.name}`,''));
    if(target.hp<=0) handleUnitDeath(target,'ally');
    refreshBars();
    refreshIntentPanel();
  }

  function performAction(unitWrapper, side){
    if(storageConflict || persistenceBlocked || saveRetryNeeded)return;
    const ref = unitWrapper.ref;
    const st = unitWrapper.st;
    if(unitWrapper.hp <= 0) return;
    /* 插话模式下玩家可能已经手动行动过：同一回合不再自动行动 */
    if(unitWrapper.acted) return;

    const unitEl = getUnitEl(unitWrapper, side);
    if(!unitEl) return;
    if(side === 'ally' && !B.training && currentBattleMode() === 'auto' && autoCast(unitWrapper)) return;
    /* autoCast 里的施法可能被冻结/麻痹消耗掉本次行动 */
    if(unitWrapper.acted) return;

    /* 控制会取消同一条预告，绝不会在控制后偷偷执行原动作。 */
    const queued = side==='enemy' ? (unitWrapper.intent && unitWrapper.intent.round===B.turn ? unitWrapper.intent : queueOneEnemy(unitWrapper)) : null;
    const wasControlled = st.frozen>0 || st.paralysis>0 || st.charm>0;
    if(turnControl(unitWrapper, side)){
      unitWrapper.acted = true;
      if(queued){
        queued.state='canceled';
        if(B.training && B.challengeId==='control' && wasControlled && queued.kind==='heavy') B.practiceUsed.control=true;
      }
      refreshBars(); refreshIntentPanel();
      return;
    }
    unitWrapper.acted = true;
    if(queued){
      queued.state='done';
      if(queued.kind==='guard'){
        st.rockArmor=(st.rockArmor||0)+Math.round(unitWrapper.maxHp*0.25);
        log(`${ref.name} 执行防御，获得 25% 最大生命护盾`);
        refreshBars(); refreshIntentPanel(); return;
      }
      if(B.training){ resolveTrainingAttack(unitWrapper,resolveIntentTarget(unitWrapper,side,false)); return; }
      refreshIntentPanel();
    }

    const wrap = unitEl.querySelector('.slime-wrap');
    if(wrap){ wrap.classList.add('attack-jump'); setTimeout(()=>wrap.classList.remove('attack-jump'), 700); }

    /* 治疗系在队友低于 70% 生命时治疗，其他回合攻击，避免互相治疗拖住战斗。 */
    const healTurn = queued ? queued.kind === 'heal' : (ref.skill === '治疗' && getAllAliveMain(side).some(u=>u.hp < u.maxHp*0.7));
    if(healTurn){
      const mains = getAllAliveMain(side);
      const allMainsFull = mains.every(u=>u.hp >= u.maxHp);
      const candidates = [];
      mains.forEach(u=>{
        candidates.push(u);
        if(allMainsFull){
          (u.minis||[]).forEach(m=>{ if(m.hp>0) candidates.push(m); });
        }
      });
      if(!candidates.length) return;
      let target = queued ? resolveIntentTarget(unitWrapper,side,true) : candidates[0];
      if(!target) return;
      if(!queued){
        let lowest = target.hp/target.maxHp;
        for(const a of candidates){ const r = a.hp/a.maxHp; if(r < lowest){ lowest = r; target = a; } }
      }
      const tgtEl = getUnitEl(target, target.isMini ? target.side : side);
      if(tgtEl) doHealEffect(ref, unitEl, tgtEl);
      const heal = Math.max(1, Math.round(magAtk(ref)*0.45 + ref.level*2));
      target.hp = Math.min(target.maxHp, target.hp + heal);
      FX.float(tgtEl, '+' + heal, { cls:'good' });
      if(ref.element === '光'){
        target.st.burn = target.st.poison = target.st.frostbite = 0;
        target.st.frozen = target.st.paralysis = target.st.charm = target.st.weakness = 0;
        log(`${ref.name} 治疗 ${target.ref.name}，恢复 ${heal} 血量（净化负面状态）`);
      } else {
        log(`${ref.name} 治疗 ${target.ref.name}，恢复 ${heal} 血量`);
      }
      refreshBars();
      return;
    }

    const enemiesSide = side==='ally' ? 'enemy' : 'ally';
    const enemiesMain = getAllAliveMain(enemiesSide);
    const allEnemies = getAllAliveUnits(enemiesSide);
    if(!allEnemies.length) return;

    const candidates = allEnemies.filter(e=>!isUntargetable(e, enemiesMain));
    const pool = candidates.length ? candidates : allEnemies;
    let bestScore = -Infinity;
    let best = [];
    pool.forEach(e=>{
      let mult = 1;
      if(ELEMENT_CHART[ref.element] && ELEMENT_CHART[ref.element][e.ref.element]) {
        mult = ELEMENT_CHART[ref.element][e.ref.element];
      }
      if(ref.element === '光' && e.ref.isMonster) mult *= 2;
      const score = mult > 1 ? 2 : (mult === 1 ? 1 : 0);
      if(score > bestScore){ bestScore = score; best = [e]; }
      else if(score === bestScore) best.push(e);
    });
    const target = queued ? resolveIntentTarget(unitWrapper,side,false) : gamePick(best.length ? best : pool);
    if(!target) return;
    const tgtEl = getUnitEl(target, target.isMini ? target.side : enemiesSide);
    if(tgtEl) doElementBallEffect(ref, unitEl, tgtEl, !!queued && queued.kind==='heavy');

    const dodge = B.training || target.isMini ? 0 : dodgeRate(target.ref);
    if(gameRandom()*100 < dodge){
      FX.float(tgtEl, 'MISS', { cls:'miss' });
      log(`${target.ref.name} 闪避了 ${ref.name} 的攻击`);
      return;
    }

    let baseDmg = unitAttack(unitWrapper) + (B.training ? 0 : gameInt(-3,3));
    baseDmg = Math.round(baseDmg * (B.atkBuff||1));
    if(st.weakness > 0) baseDmg = Math.round(baseDmg * (1 - st.weakness*0.05));

    let elemMult = 1;
    if (ELEMENT_CHART[ref.element] && ELEMENT_CHART[ref.element][target.ref.element]) {
        elemMult = ELEMENT_CHART[ref.element][target.ref.element];
    }
    let dmg = Math.round(baseDmg * elemMult * (queued ? queued.mult : 1));

    if(ref.element === '光' && target.ref.isMonster) dmg *= 2;

    const critBonus = target.st.frostbite * 5;
    const crit = !B.training && gameRandom() < (critRate(ref)+critBonus)/100;
    if(crit) dmg = Math.round(dmg * 1.8);
    dmg = mitigate(ref, target, Math.max(1, dmg));

    let elemMsg = '';
    if(elemMult > 1) elemMsg = '（克制！）';
    else if(elemMult < 1) elemMsg = '（微弱）';

    if(!B.training) applyAttackerElement(unitWrapper, target);

    if(target.ref.element === '冰' && target.st.iceArmor > 0){
      if(applyStatus(unitWrapper, 'frostbite', 1))
        setTimeout(()=>log(`❄ ${ref.name} 被冰甲冻伤！`), 120);
    }

    const shield0 = shieldOf(target);
    const actual = dealDamage(target, dmg);
    applyLivingCombo(unitWrapper,target,actual,side);
    if(tgtEl){
      FX.flash(tgtEl, crit);
      if(crit) FX.shake('crit');
      if(actual === 0){
        FX.float(tgtEl, '护盾', { cls:'small' });
      } else {
        const tag = elemMult > 1.2 ? ' 克制' : '';
        FX.float(tgtEl, '-' + actual + (crit ? '!' : '') + tag,
          { cls: crit ? 'crit' : (elemMult < 0.85 ? 'weak' : (elemMult > 1.2 ? 'strong' : '')) });
      }
    }
    log(damageLogText(target, shield0, actual,
      `${ref.name} ${queued?queued.name:'攻击'} ${target.ref.name}`, `${crit?'（暴击！）':''}${elemMsg}`));
    refreshBars();

    if(ref.element === '雷' && target.ref.element === '水' && actual > 0){
      const splash = Math.max(1, Math.round(actual * 0.2));
      const waters = [];
      [B.allies, B.monsters].forEach(team=>{
        const s = team === B.allies ? 'ally' : 'enemy';
        team.forEach(u=>{
          if(u.hp > 0 && u.ref.element === '水') waters.push({u, side:s});
          (u.minis||[]).forEach(m=>{ if(m.hp > 0 && m.ref.element === '水') waters.push({u:m, side:s}); });
        });
      });
      let hitCount = 0;
      waters.forEach(w=>{
        if(w.u === target) return;
        dealDamage(w.u, splash);
        FX.float(getUnitEl(w.u, w.side), '-' + splash, { cls:'small' });
        hitCount++;
        if(w.u.hp <= 0) handleUnitDeath(w.u, w.side);
      });
      if(hitCount){
        log(`⚡ 电流顺着水流扩散，其他水史莱姆受到 ${splash} 点溅射伤害`);
        refreshBars();
      }
    }

    if(ref.element === '草' && actual > 0){
      const heal = Math.round(actual * 0.5);
      unitWrapper.hp = Math.min(unitWrapper.maxHp, unitWrapper.hp + heal);
      FX.float(unitEl, '+' + heal, { cls:'good small' });
      if(tgtEl){
        const cc = slimeColor(ref);
        const colGrass = `hsl(${cc.h} ${Math.max(cc.s,40).toFixed(1)}% ${Math.max(cc.l,55).toFixed(1)}%)`;
        const delay = Math.round(520 / battleSpeed);
        later(()=>{ doDrainEffect(tgtEl, unitEl, colGrass); }, delay);
      }
    }

    if(!target.isMini && target.ref.element === '水' && target.hp > 0){
      const targetSide = side==='ally'?'enemy':'ally';
      const mini = spawnMiniSlime(target, targetSide);
      if(mini) miniSlimeAttack(mini);
    }

    if(target.hp <= 0) handleUnitDeath(target, enemiesSide);
    else if(!queued || queued.kind === 'attack') tryFollowUp(unitWrapper, target);
  }

  /* 追击（参考《火焰纹章》）：速度达到目标 1.3 倍时，普攻后追加一次 0.5× 攻击，不叠加元素效果 */
  function tryFollowUp(unit, target){
    if(B.training || !B.running || unit.isMini || !target || target.isMini || unit.hp <= 0 || target.hp <= 0) return;
    if(atkSpeed(unit.ref) < atkSpeed(target.ref) * FOLLOW_UP_SPEED) return;
    castStrike(unit, target, FOLLOW_UP_MULT, { name:'追击', noElement:true, followUp:true });
  }
  /* 同一方内按攻击速度从快到慢出手 */
  function bySpeed(units){ return units.slice().sort((a,b)=>atkSpeed(b.ref) - atkSpeed(a.ref)); }
  /* 自动模式：技能就绪就放（参考放置游戏的自动大招）。治疗技能只在有人低于 70% 或光系需要净化时释放。 */
  function autoCast(unit){
    const ref = unit.ref, sk = skillOf(ref);
    if(!sk || (unit.cd[ref.element]||0) > 0) return false;
    const team = getAllAliveUnits('ally');
    if(sk.kind === 'heal'){
      const hurt = team.some(u=>u.hp < u.maxHp * 0.7);
      const debuffed = ref.element === '光' && team.some(u=>['burn','poison','frostbite','frozen','paralysis','charm','weakness'].some(k=>u.st[k] > 0));
      return (hurt || debuffed) ? playerCast(unit, null) : false;
    }
    if(sk.kind === 'revive' && B.allies.some(u=>u !== unit && u.hp <= 0)) return playerCast(unit, null);
    const mains = getAllAliveMain('enemy');
    const pool = getAllAliveUnits('enemy').filter(e=>e.hp > 0 && !isUntargetable(e, mains));
    if(!pool.length) return false;
    const score = e => ((ELEMENT_CHART[ref.element]||{})[e.ref.element]||1) * 1000 - e.hp / e.maxHp;
    return playerCast(unit, pool.reduce((a,b)=>score(b) > score(a) ? b : a));
  }

  function updateUnitLabel(el, b){
    const uname=el.querySelector('.uname');if(!uname)return;
    uname.textContent=b.ref.name;uname.title=`${b.ref.name} · Lv.${b.ref.level}`;
    el.dataset.fallen=b.hp<=0?'1':'0';
    let hp=el.querySelector('.hp-value');if(!hp){hp=document.createElement('div');hp.className='hp-value';el.appendChild(hp);}hp.textContent=`${Math.max(0,Math.ceil(b.hp))}/${b.maxHp}`;hp.title=`生命 ${Math.max(0,Math.ceil(b.hp))}/${b.maxHp}`;
    let statuses=el.querySelector('.battle-statuses');if(!statuses){statuses=document.createElement('div');statuses.className='battle-statuses';el.appendChild(statuses);}
    const defs=[['burn','flame','烧伤'],['poison','leaf','中毒'],['frostbite','snow','冻伤'],['frozen','snow','冻结'],['paralysis','bolt','麻痹'],['charm','heart','魅惑'],['weakness','down','削弱'],['intangible','eye','虚化'],['rockArmor','shield','岩甲'],['iceArmor','shield','冰甲']];
    statuses.innerHTML=defs.filter(d=>(b.st[d[0]]||0)>0&&b.hp>0).map(d=>`<span class="status-chip ${['intangible','rockArmor','iceArmor'].includes(d[0])?'positive':'negative'}" title="${d[2]} ${b.st[d[0]]}" aria-label="${d[2]} ${b.st[d[0]]}">${uiIcon(d[1])}<b>${Math.ceil(b.st[d[0]])}</b></span>`).join('');
    if(el.dataset.side==='enemy'){
      let intent=el.querySelector('.intent-label');if(!intent){intent=document.createElement('div');intent.className='intent-label';el.appendChild(intent);}
      intent.textContent=b.hp>0&&typeof enemyIntentText==='function'?enemyIntentText(b):'';intent.title=intent.textContent;
    }
  }

  function updateShieldBar(el, b){
    let sb = el.querySelector('.shieldbar');
    if(!sb){
      sb = document.createElement('div');
      sb.className = 'shieldbar';
      sb.innerHTML = '<i></i><i class="ghost"></i>';
      const w = el.querySelector('.slime-wrap');
      if(w) w.appendChild(sb);
    }
    const shieldVal = b.hp > 0 ? ((b.st.rockArmor||0) + (b.st.iceArmor||0)) : 0;
    sb.classList.toggle('show', shieldVal > 0);
    if(shieldVal > 0){
      const shieldMax = Math.max(1, Math.round(b.maxHp * 0.5));
      const pct = Math.min(100, shieldVal / shieldMax * 100) + '%';
      sb.querySelector('i').style.width = pct;
      const g = sb.querySelector('i.ghost');
      if(g) g.style.width = pct;
    }
  }

  /* 血条同步：主条 + 残影 + 低血闪烁 */
  function syncHpBar(el, b){
    const hb = el.querySelector('.hpbar');
    if(!hb) return;
    const pct = Math.max(0, b.hp / b.maxHp * 100) + '%';
    const main = hb.querySelector('i:not(.ghost)');
    if(main) main.style.width = pct;
    const g = hb.querySelector('i.ghost');
    if(g) g.style.width = pct;
    hb.classList.toggle('low', b.hp > 0 && b.hp / b.maxHp < 0.3);
  }

  function refreshBars(){
    overlay.querySelectorAll('[data-side="enemy"]').forEach(el=>{
      const id = +el.dataset.monId;
      const b = B.monsters.find(x=>x.ref.id === id);
      if(!b) return;
      syncHpBar(el, b);
      const sl = el.querySelector('.slime');
      if(sl){
          sl.dataset.dead = b.hp <= 0 ? '1' : '0';
          if(b.hp <= 0) sl.dataset.mood = 'sleep';
          else if(b.st.charm > 0) sl.dataset.mood = 'charm';
          else if(b.st.paralysis > 0) sl.dataset.mood = 'fear';
          else sl.dataset.mood = 'idle';
      }
      updateUnitLabel(el, b);
      updateShieldBar(el, b);

      const wrap = el.querySelector('.slime-wrap');
      if(wrap) {
          let rockSh = wrap.querySelector('.shield-orb.rock');
          let iceSh = wrap.querySelector('.shield-orb.ice');
          if(b.st.rockArmor > 0) {
              if(!rockSh) { rockSh = document.createElement('div'); rockSh.className = 'shield-orb rock'; wrap.appendChild(rockSh); }
              if(iceSh) iceSh.remove();
          } else if(b.st.iceArmor > 0) {
              if(!iceSh) { iceSh = document.createElement('div'); iceSh.className = 'shield-orb ice'; wrap.appendChild(iceSh); }
              if(rockSh) rockSh.remove();
          } else {
              if(rockSh) rockSh.remove();
              if(iceSh) iceSh.remove();
          }
          let frz = wrap.querySelector('.frozen-orb');
          if(b.st.frozen > 0 || b.st.freezeVisual){
              if(!frz){ frz = document.createElement('div'); frz.className='frozen-orb'; wrap.appendChild(frz); }
          } else {
              if(frz) frz.remove();
          }
      }

      if(!B.training && b.hp <= 0 && !el.querySelector('.capture-btn')){
        const btn = document.createElement('button');
        btn.className = 'capture-btn';
        btn.textContent = `捕捉 (${S.bag.net||0})`;
        btn.addEventListener('click', ()=>captureMonster(b.ref, btn));
        if(wrap) wrap.appendChild(btn);
      }
      if(b.hp > 0){
        const cb = el.querySelector('.capture-btn');
        if(cb) cb.remove();
      }
    });
    overlay.querySelectorAll('[data-side="ally"]').forEach(el=>{
      const id = +el.dataset.allyId;
      const b = B.allies.find(x=>x.ref.id === id);
      if(!b) return;
      syncHpBar(el, b);
      const sl = el.querySelector('.slime');
      if(sl){
          sl.dataset.dead = b.hp <= 0 ? '1' : '0';
          if(b.hp <= 0) sl.dataset.mood = 'sleep';
          else if(b.st.charm > 0) sl.dataset.mood = 'charm';
          else if(b.st.paralysis > 0) sl.dataset.mood = 'fear';
          else sl.dataset.mood = 'idle';
      }
      updateUnitLabel(el, b);
      updateShieldBar(el, b);

      const wrap = el.querySelector('.slime-wrap');
      if(wrap) {
          let rockSh = wrap.querySelector('.shield-orb.rock');
          let iceSh = wrap.querySelector('.shield-orb.ice');
          if(b.st.rockArmor > 0) {
              if(!rockSh) { rockSh = document.createElement('div'); rockSh.className = 'shield-orb rock'; wrap.appendChild(rockSh); }
              if(iceSh) iceSh.remove();
          } else if(b.st.iceArmor > 0) {
              if(!iceSh) { iceSh = document.createElement('div'); iceSh.className = 'shield-orb ice'; wrap.appendChild(iceSh); }
              if(rockSh) rockSh.remove();
          } else {
              if(rockSh) rockSh.remove();
              if(iceSh) iceSh.remove();
          }
          let frz = wrap.querySelector('.frozen-orb');
          if(b.st.frozen > 0 || b.st.freezeVisual){
              if(!frz){ frz = document.createElement('div'); frz.className='frozen-orb'; wrap.appendChild(frz); }
          } else {
              if(frz) frz.remove();
          }
      }
    });
    refreshMiniBars();
  }

  function captureMonster(mon, btn){
    if(storageConflict || persistenceBlocked || saveRetryNeeded)return;
    if(B.training){ toast('借用训练不能捕捉，也不消耗捕捉网'); return; }
    if(!S.bag.net || S.bag.net <= 0){ toast('没有捕捉网了，请先去背包购买'); return; }
    S.bag.net--;
    delete mon.isBoss;
    mon.hp = hpMax(mon);
    mon.isMonster = true;
    mon.mood = 30;
    mon.stamina = staminaMax(mon);
    mon.level = mon.level || 1;
    S.monsters.push(mon);
    B.monsters = B.monsters.filter(x=>x.ref !== mon);
    const unit = btn.closest('.battle-unit');
    if(unit) unit.remove();
    save();
    toast(`🕸️ 成功捕捉 ${mon.name}！\n已放入魔物空间`, 'good');
  }

  function aliveAllies(){ return B.allies.filter(a=>a.hp > 0); }
  function aliveMonsters(){ return B.monsters.filter(m=>m.hp > 0); }

  function nextTurn(){
    if(storageConflict || persistenceBlocked || saveRetryNeeded)return;
    if(!B.running || B.resolving) return;
    /* 暂停中（逐回合等待玩家操作）不推进回合：否则 9s 轮询会把玩家还没行动的回合吃掉 */
    if(B.paused) return;
    B.turn++;
    B.comboUsed={};
    B.resolving = true;

    /* 每回合：清掉上一轮的手动行动标记，并递减主动技 CD */
    B.allies.concat(B.monsters, getAllAliveUnits('ally').filter(u=>u.isMini), getAllAliveUnits('enemy').filter(u=>u.isMini)).forEach(u=>{
      u.acted = false;
      if(u.st && u.st.intangible > 0) u.st.intangible = 0;
      if(u.cd) Object.keys(u.cd).forEach(k=>{ u.cd[k] = Math.max(0, u.cd[k] - 1); });
    });
    renderSkillBar();

    if(B.turn > 35 && (B.turn - 35) % 10 === 0){
      B.atkBuff = (B.atkBuff || 1) * 1.2;
      log(`⚔️ 战斗进入白热化！所有史莱姆攻击属性提升20%`);
    }

    checkRevive('ally');
    checkRevive('enemy');

    if(!aliveAllies().length){ log('出战史莱姆全部倒下……'); endBattle(false); return; }
    if(!aliveMonsters().length){ log('怪物全部倒下！胜利！'); endBattle(true); return; }

    queueEnemyIntents();
    const stepDelay = Math.round(1400 / battleSpeed);
    const as = bySpeed(aliveAllies());
    const allyMinis = [];
    as.forEach(a=>{ (a.minis||[]).forEach(m=>{ if(m.hp>0) allyMinis.push(m); }); });
    const allyActors = as.concat(allyMinis);

    if(currentBattleMode() === 'step'){
      runStepActors(allyActors, 0);
      return;
    }

    allyActors.forEach((u, idx)=>{
      later(()=>{
        if(!B.running) return;
        if(u.hp <= 0) return;
        if(u.isMini) performMiniAction(u, 'ally');
        else performAction(u, 'ally');
      }, idx * stepDelay);
    });

    later(()=>{ enemyPhase(); }, allyActors.length * stepDelay + 500);
  }

  /* 逐回合模式：己方单位逐个等待玩家操作，迷你史莱姆仍自动行动 */
  function runStepActors(actors, idx){
    if(!B.running) return;
    if(idx >= actors.length){ later(()=>{ enemyPhase(); }, 300); return; }
    const u = actors[idx];
    if(u.hp <= 0){ runStepActors(actors, idx + 1); return; }
    if(u.isMini){ performMiniAction(u, 'ally'); runStepActors(actors, idx + 1); return; }
    waitForPlayer(u, 'ally', ()=> runStepActors(actors, idx + 1));
  }

  function waitForPlayer(unit, side, done, timeoutMs){
    B.paused = true;
    skSel = unit;
    skPick = null;
    markTargetable(false);
    log(`<span>${uiIcon('clock')} 轮到 ${esc(unit.ref.name)} 行动</span>`);
    renderSkillBar();

    let finished = false;
    const finish = () => {
      if(finished) return;
      finished = true;
      B.paused = false;
      B._pauseResume = null;
      if(B.pauseTimer){ clearTimeout(B.pauseTimer); B.pauseTimer = null; }
      afterPlayerAction = null;
      skSel = null;
      skPick = null;
      markTargetable(false);
      renderSkillBar();
      done();
    };
    B._pauseResume = () => {
      if(unit.hp > 0 && !unit.acted){
        const t = gamePick(getAllAliveUnits('enemy'));
        if(t) playerBasic(unit, t);
      }
      finish();
    };
    B.pauseTimer = later(()=>{
      if(!B.running) return;
      if(unit.hp > 0 && !unit.acted){
        log(`${unit.ref.name} 超时未操作，自动普攻`);
        const t = gamePick(getAllAliveUnits('enemy'));
        if(t) playerBasic(unit, t);
      }
      finish();
    }, timeoutMs || (B.training ? 60000 : 8000));
    afterPlayerAction = () => finish();
  }

  function enemyPhase(){
    if(!B.running) return;
    /* 从 nextTurn 抽出来时注意：stepDelay 原本是 nextTurn 的局部量，必须在本函数内重算 */
    const stepDelay = Math.round(1400 / battleSpeed);
    checkRevive('enemy');
      if(!aliveMonsters().length){ log('怪物全部倒下！胜利！'); endBattle(true); return; }
      checkRevive('ally');
      if(!aliveAllies().length){ log('出战史莱姆全部倒下……'); endBattle(false); return; }

      const ms2 = bySpeed(aliveMonsters());
      const enemyMinis = [];
      ms2.forEach(m=>{ (m.minis||[]).forEach(x=>{ if(x.hp>0) enemyMinis.push(x); }); });
      const enemyActors = ms2.concat(enemyMinis);

      enemyActors.forEach((m, idx)=>{
        later(()=>{
          if(!B.running) return;
          if(m.hp <= 0) return;
          if(m.isMini) performMiniAction(m, 'enemy');
          else performAction(m, 'enemy');
        }, idx * stepDelay);
      });

      later(()=>{
        if(!B.running) return;
        checkRevive('ally');
        checkRevive('enemy');
        if(!aliveAllies().length){ log('出战史莱姆全部倒下……'); endBattle(false); return; }
        if(!aliveMonsters().length){ log('怪物全部倒下！胜利！'); endBattle(true); return; }
        B.resolving = false;
        refreshIntentPanel();
      }, enemyActors.length * stepDelay + 300);
  }

  function endBattle(win){
    if(storageConflict || persistenceBlocked || saveRetryNeeded)return;
    if(!B.running) return;
    B.running = false;
    B.ended = true;
    B.paused = false;
    if(B.pauseTimer){ clearTimeout(B.pauseTimer); B.pauseTimer = null; }
    B._pauseResume = null;
    if(B.timer) clearInterval(B.timer);

    [...B.allies, ...B.monsters].forEach(u=>removeMinisOf(u));

    const rewards=calculateBattleRewards(B,win,B.mLevel);
    const {totalExp,coinGain}=rewards;
    B.result={win,totalExp,coinGain,defeatedCount:rewards.defeatedCount,survivorCount:rewards.survivorCount,recipientIds:rewards.recipients.map(a=>a.ref.id)};
    const progressLine=typeof recordBattleProgress==='function' ? recordBattleProgress(B,win) : '';
    if(!B.training){
      S.coins += coinGain;
      S.totalEarned += coinGain;
      if(totalExp>0) rewards.recipients.forEach(a=>{
        addExp(a.ref, Math.floor(totalExp/Math.max(1,rewards.recipients.length)));
        a.ref.mood=clamp(a.ref.mood+(win?10:3),0,100);
      });
      if(win) S.abyssUnlocked=Math.max(getAbyssUnlocked(),Math.min(50,(B.mLevel||1)+1));
      if(win) addTaskProgress('abyss', 1);
      /* 首通奖励按开战时快照判定，同一层只发一次 */
      const bonus = win && !B.floorCleared ? firstClearBonus(B.mLevel||1) : null;
      if(bonus){
        S.bag.treasure = (S.bag.treasure||0) + bonus.treasure;
        S.bag.net = (S.bag.net||0) + bonus.net;
        S.bag.ticket = (S.bag.ticket||0) + bonus.ticket;
        S.points += bonus.points;
        B.result.bonus = bonus;
      }
    }
    B.allies.forEach(a=>{
      a.hp=hpMax(a.ref);
      if(!B.training) a.ref.hp=a.hp;
      a.st.burn=a.st.poison=a.st.frostbite=a.st.frozen=a.st.freezeVisual=a.st.paralysis=a.st.charm=a.st.weakness=0;
    });
    LivingWorld.finishBattle(S,allies.map(s=>s.id),win,challenge?'教学挑战':'深渊第'+mLevel+'层');
    save(); renderTop(); renderTab();

    refreshBars();

    overlay.querySelectorAll('.battle-unit').forEach(el=>{
      const hpEl = el.querySelector('.hpbar');
      if(hpEl) hpEl.style.display = 'none';
      const sbEl = el.querySelector('.shieldbar');
      if(sbEl) sbEl.style.display = 'none';
      el.querySelectorAll('.shield-orb, .frozen-orb').forEach(x=>x.remove());
    });

    /* 战斗结束后技能条不能残留：它只在战斗进行中才有意义 */
    skSel = null;
    skPick = null;
    markTargetable(false);
    const staleBar = overlay.querySelector('#skillBar');
    if(staleBar){ staleBar.classList.add('hide'); staleBar.innerHTML = ''; }

    /* 战败演出回到第一版：输的一方站在原地「闭眼 + 发抖」（data-mood="fear"），
       不倒下、不变灰、不留标记；赢的一方照旧蹦跳庆祝。双方战败都走这套。 */
    const loserLook = (el, mood) => {
      if(!el) return;
      const sl = el.querySelector('.slime');
      if(!sl) return;
      sl.classList.remove('dying');
      sl.dataset.dead = '0';
      sl.dataset.mood = mood;
    };

    if(win){
      const emojis = ['🌸','🌼','💮'];
      B.allies.forEach(b=>{
        const el = overlay.querySelector(`[data-ally-id="${b.ref.id}"]`);
        if(!el) return;
        loserLook(el, 'jump');
        const wrap = el.querySelector('.slime-wrap');
        if(wrap){
          for(let i=0;i<5;i++){
            const f = document.createElement('span');
            f.textContent = pick(emojis);
            f.style.position = 'absolute';
            f.style.left = rnd(5, 95) + '%';
            f.style.top = rnd(-150, -90) + '%';
            f.style.fontSize = rnd(7, 16) + 'px';
            f.style.zIndex = 40;
            f.style.pointerEvents = 'none';
            f.style.opacity = '0';
            f.style.animation = `flowerFall ${rnd(1.6, 2.8)}s ease-in forwards`;
            f.style.animationDelay = rnd(0, 1.2) + 's';
            wrap.appendChild(f);
            setTimeout(()=>f.remove(), 4500);
          }
        }
      });
      /* 对面战败：魔物保持站位，闭眼发抖 */
      B.monsters.forEach(b=>loserLook(overlay.querySelector(`[data-mon-id="${b.ref.id}"]`), 'fear'));
    } else {
      /* 我方战败：己方闭眼发抖，活着的魔物蹦跳 */
      B.allies.forEach(b=>loserLook(overlay.querySelector(`[data-ally-id="${b.ref.id}"]`), 'fear'));
      B.monsters.forEach(b=>loserLook(overlay.querySelector(`[data-mon-id="${b.ref.id}"]`), 'jump'));
    }

    const head = win ? '🎉 战斗胜利！' : '⚔️ 战斗结束……';
    const rewardLine = B.training ? '教学练习不消耗伙伴，也不产生普通战利品。' : `击败 ${rewards.defeatedCount}/${(B.rewardMonsters||B.monsters).length} · ${win?'全额奖励':'已击败敌人 25% 奖励'}${rewards.repeat?' · 已通关层 ×20%':''}：${coinGain} 晶币 / ${totalExp} 总经验。${B.result.bonus?'<br>首领首通：'+bonusText(B.result.bonus):''}伙伴已恢复。`;
    const catchLine = win && !B.training ? '<br>点击倒下的怪物可捕捉' : '';
    log(head + '<br>' + rewardLine + (progressLine ? '<br>'+progressLine : '') + catchLine);

    const cb = overlay.querySelector('#bClose');
    if(cb) cb.textContent = '关 闭';
    /* 闭眼发抖是无限循环动画，不需要为了演出延长停留时间 */
    autoCloseTimer = setTimeout(closeBattle, win ? 4800 : 3000);
  }

  overlay.querySelector('#bClose').addEventListener('click', ()=>{
    if(B.ended) closeBattle();
    else endBattle(false);
  });

  refreshBars();
  restartTimer();

  later(()=>{
    if(B.running && B.turn === 0) nextTurn();
  }, 800);
}

/* ==================== 魔物空间道具栏 ==================== */
let monItemLongTimer = null;
let monItemLongPressed = false;

function useMonItem(idx, slimeEl){
  const cfg = (S.monItemConfigs && S.monItemConfigs[idx]);
  if(!cfg || !slimeEl) return;

  const delta = Number(cfg.mood) || 0;
  const target = S.monsters.find(m=>String(m.id) === String(slimeEl.dataset.id));
  if(target) target.mood = clamp(target.mood + delta, 0, 100);

  const inner = slimeEl.querySelector('.slime');
  if(inner && cfg.face && cfg.face !== 'idle'){
    inner.dataset.mood = cfg.face;
    setTimeout(()=>{
      if(inner && inner.isConnected) inner.dataset.mood = 'idle';
    }, 2600);
  }

  if(delta !== 0) showFloat(slimeEl, `心情${delta>=0?'+':''}${delta}`);
  if(cfg.text) toast(`「${cfg.label}」\n${cfg.text}`);
  save();
}

function openMonItemEditor(idx){
  const cfg = S.monItemConfigs[idx];
  if(!cfg) return;
  openModal(`
    <button class="close" data-act="close">✕</button>
    <h3 style="text-align:center;margin:0 0 12px;color:var(--accent2);">编辑道具 · 第 ${idx+1} 个</h3>
    <div>
      <label class="edit-label">按钮文本</label>
      <input id="miLabel" class="story-input" maxlength="6" value="${esc(cfg.label)}" style="margin-top:4px;">
      <label class="edit-label">史莱姆反应表情</label>
      <select id="miFace" class="story-input" style="margin-top:4px;">
        ${MON_MOODS.map(m=>`<option value="${m.v}" ${cfg.face===m.v?'selected':''}>${m.n}</option>`).join('')}
      </select>
      <label class="edit-label">心情变化（-50 ~ 50）</label>
      <input id="miMood" class="story-input" type="number" min="-50" max="50" value="${Number(cfg.mood)||0}" style="margin-top:4px;">
      <label class="edit-label">弹窗文字</label>
      <input id="miText" class="story-input" maxlength="20" value="${esc(cfg.text||'')}" placeholder="例如：舒服地蹭了蹭" style="margin-top:4px;">
    </div>
    <button class="btn gold full" data-act="monItemSave" data-idx="${idx}" style="margin-top:14px;">保 存</button>
  `);
}

/* ==================== 事件委托 ==================== */
// Protect target-level controls before their handlers can mutate a pending save.
document.addEventListener('click', e=>{
  if((storageConflict || persistenceBlocked || saveRetryNeeded) && !e.target.closest('[data-act="reloadSave"],[data-act="retrySave"]')){
    e.preventDefault();e.stopImmediatePropagation();
  }
}, true);
document.addEventListener('click', e=>{
  if(storageConflict || persistenceBlocked){const reload=e.target.closest('[data-act="reloadSave"]');if(reload)location.reload();return;}
  if(saveRetryNeeded){const retry=e.target.closest('[data-act="retrySave"]');if(retry){save();renderTab();}return;}
  if(LivingWorld.handleClick(e))return;
  const t = e.target.closest('[data-act]');
  if(!t) return;
  if(t.dataset.long !== undefined){
    if(monItemLongPressed){ monItemLongPressed = false; return; }
  }
  const act = t.dataset.act, ds = t.dataset;
  switch(act){
    case 'tab': switchTab(ds.tab); break;
    case 'goto': switchTab(ds.tab); break;
    case 'summon': doSummon(); break;
    case 'summonSkip': finishSummonReveal(); $('#modalBox .btn[data-act="close"]')?.focus(); break;
    case 'breakthrough': doBreakthrough(); break;
    case 'detail': {
      e.stopPropagation();
      openDetail(+ds.id, ds.mon === '1');
      break;
    }
    case 'buy': buyItem(ds.item, 1); break;
    case 'buy10': buyItem(ds.item, 10); break;
    case 'close': closeModal(); break;
    case 'feed': useItem('food', +ds.id); break;
    case 'treasure': useItem('treasure', +ds.id); break;
    case 'trait': useItem('ticket', +ds.id); break;
    case 'drinkPotion': useItem('expPotion', +ds.id); break;
    case 'rename': renameSlime(+ds.id); break;
    case 'petlock': togglePetLock(+ds.id); break;
    case 'settings': openSettings(); break;
    case 'theme': S.theme = ds.theme; applyTheme(); save(); openSettings(); break;
    case 'plan': openPlan(+ds.id); break;
    case 'setplan': if(S.saveVersion>=4){switchTab('journey');closeModal();break;} if(LivingWorld.isBusy(S,+ds.id)){toast('请先结束伙伴的家园工作或远征');break;} S.customPlans[+ds.id] = {type:ds.type}; save(); renderTab(); closeModal(); toast('定制规划已设置', 'good'); break;
    case 'clearplan': delete S.customPlans[+ds.id]; save(); renderTab(); closeModal(); toast('定制规划已清除'); break;
    case 'globalplan': {
      if(S.saveVersion>=4){switchTab('journey');closeModal();break;}
      if(ds.type === 'clear'){ S.globalPlan = null; toast('全部召回，已停止探险'); }
      else { S.globalPlan = ds.type; toast('自动探险：派遣史莱姆出发探险', 'good'); }
      save(); renderTab(); break;
    }
    case 'cycleMap': {
      /* 只在已解锁区域之间轮换 */
      let next = S.exploreMapIndex||0;
      do { next = (next + 1) % MAP_THEMES.length; } while(!regionUnlocked(next) && next !== 0);
      S.exploreMapIndex = next;
      save();
      renderTab();
      toast(`地图已切换：${MAP_THEMES[S.exploreMapIndex].name}`, 'good');
      break;
    }
    case 'toggleTips': travelTipsOpen = !travelTipsOpen; renderTab(); break;
    case 'refill': LivingWorld.dispatch({type:'refill'}); break;
    case 'claimOverflow': LivingWorld.dispatch({type:'claimOverflow'}); break;
    case 'monsterCare': careMonster(+ds.id,+ds.idx); break;
    case 'toggleSpaceMode':
      S.spaceMode = (S.spaceMode === 'free') ? 'monster' : 'free';
      selectedToy = null;
      save(); renderTab();
      break;
    case 'selectToy': {
      const toy = ds.toy;
      if(toy === 'stack'){
        const idleCount = S.slimes.filter(s=>!isDispatched(s)).length;
        if(idleCount < 1){
          toast('空间中没有自由活动的史莱姆，无法进行游戏');
          break;
        }
        startStackGame();
        break;
      }
      selectedToy = (selectedToy === toy) ? null : toy;
      document.querySelectorAll('.toy-btn').forEach(b=>{
        b.classList.toggle('on', b.dataset.toy === selectedToy);
      });
      const hint = document.querySelector('.toy-hint');
      if(hint){
        if(selectedToy){
          hint.style.display = 'block';
          hint.textContent = `已选择「扔皮球」 · 点击空间中的史莱姆开始游戏`;
        } else {
          hint.style.display = 'none';
          hint.textContent = '';
        }
      }
      if(selectedToy){
        toast(`已选择「扔皮球」\n点击空间中的史莱姆开始游戏`);
      }
      break;
    }
    case 'setupTeam': openTeamSetup(); break;
    case 'teamSel': {
      const id = +ds.id;
      if(teamSel.has(id)) teamSel.delete(id);
      else teamSel.add(id);
      renderTeamModal();
      break;
    }
    case 'teamClearAll':
      S.exploreTeam = null;
      save(); renderTab(); closeModal();
      toast('已恢复默认（派遣全部史莱姆）');
      break;
    case 'teamSave':
      if(teamSel.size === 0){
        S.exploreTeam = null;
        toast('未选择史莱姆，已恢复默认派遣全部');
      } else {
        S.exploreTeam = Array.from(teamSel);
        toast('已设置队伍');
      }
      save(); renderTab(); closeModal();
      break;
    case 'resetSave': {
      saveSnapshot=undefined;storageConflict=false;
      if(!confirm('将删除无法读取的存档并从新进度开始，删除后无法恢复。确定继续？')) break;
      try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
      location.reload();
      break;
    }
    case 'abyssSetup': openAbyssSetup(); break;
    case 'abyssSweep': sweepAbyss(); break;
    case 'abyssSel': toggleAbyssSel(+ds.id); break;
    case 'abyssStart': {
      if(!abyssSetupSel.length) return;
      S.lastAbyssSel = [...abyssSetupSel];
      save();
      closeModal();
      startAbyssBattle();
      break;
    }
    case 'challengeStart': startTrainingChallenge(ds.id); break;
    case 'claimGoal': claimProgressGoal(ds.id); break;
    case 'abyssLevelMinus': {
      S.abyssLevel = clamp((S.abyssLevel||1) - 1, 1, getAbyssUnlocked());
      const inp = document.getElementById('abyssLevelInput');
      if(inp) inp.value = S.abyssLevel;
      syncAbyssPortal();
      save();
      break;
    }
    case 'abyssLevelPlus': {
      S.abyssLevel = clamp((S.abyssLevel||1) + 1, 1, getAbyssUnlocked());
      const inp = document.getElementById('abyssLevelInput');
      if(inp) inp.value = S.abyssLevel;
      syncAbyssPortal();
      save();
      break;
    }
    case 'boost': {
      const el = ds.element;
      if(S.bag.treasure <= 0){ toast('天材地宝不足，无法献祭'); break; }
      S.bag.treasure--;
      summonBoost[el] = (summonBoost[el]||0) + 12;
      save(); renderTab();
      toast(`献祭成功：${el}属性权重 +12\n本次召唤有效`, 'good');
      break;
    }
    case 'mergeopen': openMerge(); break;
    case 'mergesel': toggleMergeSel(+ds.id); break;
    case 'mergeconfirm': doMerge(); break;
    case 'monItem': {
      const first = plSlimes[0];
      if(!first){ toast('魔物空间里没有史莱姆'); break; }
      useMonItem(+ds.idx, first.el);
      break;
    }
    case 'monItemSave': {
      const idx = +ds.idx;
      const cfg = S.monItemConfigs[idx];
      if(!cfg) return;
      const label = ($('#miLabel').value || '').trim().slice(0,6);
      const mood = clamp(parseInt($('#miMood').value, 10) || 0, -50, 50);
      cfg.label = label || '互动';
      cfg.face = $('#miFace').value || 'idle';
      cfg.mood = mood;
      cfg.text = ($('#miText').value || '').trim().slice(0,20);
      save();
      closeModal();
      renderTab();
      toast('道具按钮已更新', 'good');
      break;
    }
  }
});

document.addEventListener('input', e=>{
  if(e.target && e.target.id === 'abyssLevelInput'){
    let v = Number(e.target.value);
    if(isNaN(v) || v < 1) v = 1;
    v=clamp(Math.floor(v),1,getAbyssUnlocked());
    e.target.value=v;
    S.abyssLevel = v;
    syncAbyssPortal();
    save();
  }
});

document.addEventListener('pointerdown', e=>{
  const t = e.target.closest('[data-long]');
  if(!t) return;
  monItemLongPressed = false;
  monItemLongTimer = setTimeout(()=>{
    monItemLongPressed = true;
    openMonItemEditor(+t.dataset.long);
  }, 700);
});
document.addEventListener('pointerup', ()=>{
  if(monItemLongTimer){ clearTimeout(monItemLongTimer); monItemLongTimer = null; }
});
document.addEventListener('pointercancel', ()=>{
  if(monItemLongTimer){ clearTimeout(monItemLongTimer); monItemLongTimer = null; }
});

$('#modalLayer').addEventListener('click', e=>{
  if(e.target.id === 'modalLayer') closeModal();
});

$('#storyScreen').addEventListener('click', e=>{
  if(blocking) return;
  if(e.target.closest('input,button,label')) return;
  storyStep++; renderStory();
});

function toast(msg, type){
  const el = document.createElement('div');
  el.className = 'toast ' + (type||'');
  el.textContent = msg;
  $('#app').appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(),320); }, 2100);
}

setInterval(()=>{
  const slimes = document.querySelectorAll('.explore-scene .explore-slime');
  if(!slimes.length) return;
  const now = Date.now();
  slimes.forEach(el=>{
    const next = +el.dataset.nextToggle || 0;
    if(now < next) return;
    const isFront = el.dataset.row === 'front';
    let nextJumping;
    if(isFront){
      nextJumping = Math.random() < 0.28;
    } else {
      nextJumping = !el.classList.contains('jumping');
    }
    el.classList.toggle('jumping', nextJumping);
    el.classList.toggle('walking', !nextJumping);
    el.dataset.nextToggle = now + 700 + Math.random() * 900;
  });
}, 200);

function updateLive(){
  renderTop();
  if(activeTab==='space' && !(ballGame&&ballGame.running) && !(stackGame&&stackGame.running)){
    const ids=(S.spaceMode==='monster'?S.monsters:S.slimes.filter(s=>!isDispatched(s))).map(s=>s.id).join(',');
    if($('#content').dataset.spaceIdle!==ids)renderTab();
    const summary=document.querySelector('.dispatch-summary');
    if(summary)summary.innerHTML=dispatchSummaryHTML();
  }
  for(const s of S.slimes){
    const rlabel=document.querySelector(`[data-rest-label="${s.id}"]`),rbar=document.querySelector(`[data-rest-bar="${s.id}"]`),rtext=document.querySelector(`[data-rest-text="${s.id}"]`);
    if(rlabel)rlabel.textContent=s.resting?'恢复中':'探索中';
    if(rbar)rbar.style.width=(s.resting&&typeof planRestProgress==='function'?planRestProgress(s):Math.min(100,s.stamina/staminaMax(s)*100))+'%';
    if(rtext)rtext.textContent=s.resting&&typeof planRestText==='function'?planRestText(s):`体力 ${Math.floor(s.stamina)}/${staminaMax(s)} · 每次探索消耗 20`;
    const stMax = staminaMax(s);
    const b1 = document.getElementById('stam-'+s.id);
    if(b1) b1.style.width = Math.min(100, (s.stamina / stMax) * 100) + '%';
    const t1 = document.getElementById('stamtxt-'+s.id);
    if(t1) t1.textContent = Math.floor(s.stamina) + '/' + stMax;
    const b2 = document.getElementById('mood-'+s.id);
    if(b2) b2.style.width = s.mood + '%';
    const t2 = document.getElementById('moodtxt-'+s.id);
    if(t2) t2.textContent = Math.floor(s.mood);
  }
}

function planActionCost(s){ return 20; }
function planResumeThreshold(s){ return Math.max(planActionCost(s),Math.ceil(staminaMax(s)*0.5)); }
function hasExplorePlan(s){
  const plan=getPlan(s.id);
  return !!(plan && plan.type==='explore' && (!plan.global || S.exploreTeam===null || S.exploreTeam.includes(s.id)));
}
function planRestProgress(s){
  return Math.round(100*Math.min(1,Math.max(0,s.stamina)/planResumeThreshold(s),Math.max(0,s.mood)/50));
}
function planRestText(s){
  if(!s.resting) return hasExplorePlan(s) ? '探险中 · 每次消耗 20 体力' : '在家陪伴';
  return `休息 ${planRestProgress(s)}% · 体力 ${Math.floor(s.stamina)}/${planResumeThreshold(s)} · 心情 ${Math.floor(s.mood)}/50 后续行`;
}
function recoverPlanTick(s){
  let changed=false;
  if(hasExplorePlan(s) && !s.resting && (s.stamina<planActionCost(s) || s.mood<=0)){ s.resting=true; changed=true; }
  if(s.resting && s.stamina>=planResumeThreshold(s) && s.mood>=50){ s.resting=false; changed=true; }
  const dispatched=isDispatched(s);
  if(!dispatched){
    const stMax=staminaMax(s);
    const st=Math.min(stMax,s.stamina+0.4*(1+traitBonus(s,'stam')));
    if(Math.abs(st-s.stamina)>0.01){s.stamina=st;changed=true;}
    if(s.mood<100){s.mood=Math.min(100,s.mood+0.1);changed=true;}
    if(S.feedTrough>0 && s.stamina<stMax-5 && Math.random()<0.14){
      S.feedTrough--;s.stamina=clamp(s.stamina+30,0,stMax);s.mood=clamp(s.mood+3,0,100);changed=true;
    }
  }
  return changed;
}

/* 当前派遣区域：未解锁的区域（旧档可能停在雪原）按草原结算 */
function exploreRegionIndex(){ return regionUnlocked(S.exploreMapIndex) ? (S.exploreMapIndex||0) : 0; }
/* 一次派遣行动。收益 = (15 + 2.5×等级) × 区域倍率 × 词条 × 天赋加成(≤+50%)，
   经验 = (6 + 0.8×等级) × 区域经验倍率。在线计时器与离线结算共用，silent 时不弹提示、不存档。 */
function runPlans(silent){
  if(!S.started || storageConflict || S.saveVersion>=4) return null;
  const gains = {coins:0, treasure:0, actions:0, exp:0};
  const regionIndex = exploreRegionIndex();
  const region = MAP_THEMES[regionIndex];
  let changed = false;
  for(const s of S.slimes){
    if(LivingWorld.isBusy(S,s.id))continue;
    const plan = getPlan(s.id);
    if(!plan || plan.type !== 'explore') continue;
    if(plan.global && S.exploreTeam !== null && !S.exploreTeam.includes(s.id)) continue;
    if(s.resting) continue;
    if(s.stamina < planActionCost(s) || s.mood <= 0){
      s.resting = true;
      changed = true;
      continue;
    }

    s.stamina -= planActionCost(s);
    const mult = 1 + traitBonus(s,'all') + traitBonus(s,'explore');
    const talentMul = 1 + Math.min(0.5, calcTalent(s) / 300);
    const base = (15 + 2.5 * s.level) * region.coinMul * mult * talentMul;
    let gain = Math.round(base);
    let msgExtra = '';
    const roll = Math.random();
    if(roll < 0.02 * region.treasureMul){
      gain += Math.round(base * 3);
      msgExtra = ' 发现天材地宝！';
      S.bag.treasure++;
      gains.treasure++;
    } else if(roll < 0.10){
      gain += Math.round(base * 3);
      msgExtra = ' 意外收获！';
    } else if(roll < 0.35){
      gain += Math.round(base);
    }
    s.mood = clamp(s.mood + rndInt(-5,8), 0, 100);
    if(msgExtra && !silent) setTimeout(()=>toast(`🗺️ ${s.name}${msgExtra}`, 'good'), 100);

    if(Math.random() < (s.luck||0) * 0.005){
      const bonus = Math.round(gain * 0.5);
      gain += bonus;
      if(!silent) setTimeout(()=>toast(`🍀 ${s.name} 触发幸运事件！额外 +${bonus} 晶币`, 'good'), 200);
    }

    S.coins += gain; S.totalEarned += gain;
    gains.coins += gain; gains.actions++;
    const xp = Math.round((6 + 0.8 * s.level) * region.expMul);
    gains.exp += Math.round(xp * expRate(s));
    addExp(s, xp, silent);
    addTaskProgress('rent', 1, silent);
    recordRegionExplore(regionIndex);
    changed = true;
  }
  if(changed && !silent){ save(); renderTop(); if(activeTab==='travel') renderTab(); }
  return gains;
}


function careMonster(id,idx){
 const s=S.monsters.find(s=>s.id===id),config=S.monItemConfigs[idx];if(!s||!config)return;
 s.mood=clamp(s.mood+(Number(config.mood)||0),0,100);
 if(config.text)toast(config.text);
 save();renderTab();
}
