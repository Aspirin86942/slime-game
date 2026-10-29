function startAbyssBattle(options){
  options = options || {};
  if(!canWrite()||document.getElementById('gameOverlay')) return;
  const challenge = TRAINING_CHALLENGES[options.challengeId] || null;
  if(!challenge && !abyssSetupSel.length) return;
  const allies = challenge ? [makeTrainingSlime(-1001, '借用·'+challenge.element+'伙伴', challenge.element, challenge.hp, challenge.str, challenge.mag, false)] : abyssSetupSel.map(id=>getSlime(id)).filter(Boolean).filter(s=>!isDispatched(s)&&!LivingWorld.isBusy(S,s.id));
  if(!allies.length){ toast('出战的史莱姆都在探险中，请先召回'); return; }
  battleSpeed = clamp(Number(S.battleSpeed)||1, 1, 10);
  if(![1,2,5].includes(battleSpeed)) battleSpeed = 1;
  const monCount = challenge ? 0 : rndInt(2, 4);
  if(!challenge&&!LivingWorld.reserve(S,allies.map(s=>s.id),'battle'))return;
  const monsters = challenge ? [makeTrainingSlime(-2001, '练习·'+challenge.name, challenge.enemyElement, challenge.enemyHp, 25, 15, true)] : [];
  const mLevel = challenge ? 1 : getAbyssLevel();
  for(let i=0;i<monCount;i++){const m = createSlime(true);m.isMonster = true;m.level = mLevel;m.str = m.strPotential * mLevel;m.agi = m.agiPotential * mLevel;m.mag = m.magPotential * mLevel;m.size = +(m.size + (mLevel-1)*0.0016).toFixed(3);m.hp = hpMax(m);m.name = `${m.element}魔物${m.id}`;monsters.push(m);}
  const overlay = document.createElement('div');
  overlay.id = 'gameOverlay';
  const enemyHTML = monsters.map((m)=>`<div class="battle-unit" data-mon-id="${m.id}" data-side="enemy"><div class="slime-wrap"><div class="hpbar"><i style="width:100%"></i><i class="ghost"></i></div>${slimeHTML(m,{mood:'idle', traitBadge: m.traits.length > 0})}</div><div class="uname">${esc(m.name)} Lv.${m.level}</div></div>`).join('');
  const allyHTML = allies.map(a=>`<div class="battle-unit" data-ally-id="${a.id}" data-side="ally"><div class="slime-wrap"><div class="hpbar"><i style="width:100%"></i><i class="ghost"></i></div>${slimeHTML(a,{mood:'idle'})}</div><div class="uname">${esc(a.name)}</div></div>`).join('');
  const hudTitle = challenge ? ('战斗课堂 · '+challenge.name) : (`⚔️ 深渊对战 · 第 ${mLevel} 层`);
  overlay.innerHTML = `<div class="game-hud"><span class="hud-title">${hudTitle}</span><button class="hud-close" id="bClose">撤退</button></div><div class="battle-field">${Array.from({length:30}).map(()=>`<div class="bg-star" style="left:${rnd(2,98)}%;top:${rnd(2,98)}%;"></div>`).join('')}<div class="battle-row enemy">${enemyHTML}</div><div class="battle-log" id="battleLog">战斗开始！</div><div class="battle-row ally">${allyHTML}</div></div>
  <div class="battle-dock">
    <div class="sk-ctrl" id="skCtrl">
      <button class="sk-speed" data-speed="1" style="left:12px;top:50px;">1x</button>
      <button class="sk-speed" data-speed="2" style="left:24px;top:24px;">2x</button>
      <button class="sk-speed" data-speed="5" style="left:48px;top:10px;">5x</button>
      <button class="sk-mode">手动</button>
    </div>
    <div class="skill-bar hide" id="skillBar"></div>
  </div>`;
  $('#app').appendChild(overlay);
  const logEl = overlay.querySelector('#battleLog');
  const fieldEl = overlay.querySelector('.battle-field');
  FX.bindField(fieldEl);
  let lastSkillBarSig = '';

  function applyParticleStyle(orb, el, size, col){
    orb.style.width = size+'px';
    orb.style.height = size+'px';
    orb.style.background = 'transparent';
    orb.style.boxShadow = 'none';
    orb.style.borderRadius = '0';
    if(el === '岩' || el === '冰'){
      orb.style.background = col;
      orb.style.boxShadow = `0 0 8px ${col}`;
      orb.style.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
      orb.style.width = (size*1.4)+'px';
      orb.style.height = (size*0.6)+'px';
    } else if(el === '火'){
      orb.style.borderRadius = '50%';
      orb.style.background = 'rgba(255,100,35,0.95)';
      orb.style.boxShadow = `0 0 ${size*0.5}px rgba(255,120,40,0.9)`;
      orb.style.overflow = 'hidden';
      orb.innerHTML = `<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${(size*0.7).toFixed(1)}px;height:${(size*0.7).toFixed(1)}px;border-radius:50%;background:${col};"></span><span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${(size*0.4).toFixed(1)}px;height:${(size*0.4).toFixed(1)}px;border-radius:50%;background:#fff8e8;"></span>`;
    } else if(el === '水'){
      orb.style.borderRadius = '50%';
      orb.style.border = `1px solid ${col}`;
      orb.style.boxShadow = `inset 0 0 6px rgba(255,255,255,0.45), 0 0 8px ${col}`;
      orb.style.overflow = 'hidden';
      orb.innerHTML = `<span style="position:absolute;right:22%;top:18%;width:26%;height:22%;border-radius:50%;background:rgba(255,255,255,0.95);filter:blur(0.4px);"></span>`;
    } else if(el === '风' || el === '空间'){
      orb.style.width = size+'px';
      orb.style.height = (size*1.2)+'px';
      orb.innerHTML = `<svg viewBox="0 0 60 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;overflow:visible"><path d="M 50,5 Q 5,50 50,95 Q 30,50 50,5 Z" fill="${col}" style="filter:drop-shadow(0 0 4px ${col})"/></svg>`;
    } else if(el === '雷' || el === '暗'){
      orb.style.borderRadius = '50%';
      orb.style.background = `radial-gradient(circle at 34% 30%, ${col}, ${col} 58%, rgba(0,0,0,.22) 100%)`;
      orb.style.boxShadow = `0 0 ${size*0.55}px rgba(180,190,200,0.85), inset -3px -3px 8px rgba(150,155,165,0.9)`;
      orb.style.overflow = 'hidden';
      orb.innerHTML = `<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${(size*0.55).toFixed(1)}px;height:${(size*0.55).toFixed(1)}px;border-radius:50%;background:rgba(0,0,0,0.6);"></span>`;
    } else if(el === '光'){
      orb.style.background = `radial-gradient(circle, ${col} 12%, ${col} 28%, rgba(255,255,255,0.22) 58%, rgba(255,255,255,0) 100%)`;
      orb.style.clipPath = 'polygon(50% 0%, 65% 40%, 100% 50%, 65% 60%, 50% 100%, 35% 60%, 0% 50%, 35% 40%)';
      orb.style.filter = 'blur(1.5px)';
      orb.style.boxShadow = `0 0 ${size*0.5}px ${col}`;
    } else if(el === '草'){
      orb.style.borderRadius = '50%';
      orb.style.background = col;
      orb.style.boxShadow = `0 0 8px ${col}`;
    } else if(el === '幻'){
      orb.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="fill:${col}; filter:drop-shadow(0 0 6px ${col})"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
      orb.style.width = size+'px';
      orb.style.height = size+'px';
    } else {
      orb.style.borderRadius = '50%';
      orb.style.background = col;
      orb.style.boxShadow = `0 0 8px ${col}`;
    }
  }

  function doBasicParticleEffect(attacker, atkUnit, tgtUnit){
    if(!atkUnit || !tgtUnit) return;
    markBattleAction(atkUnit, tgtUnit);
    const from = getCoords(atkUnit), to = getCoords(tgtUnit);
    const angDeg = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
    const c = slimeColor(attacker);
    const h = c.h, s = Math.max(c.s,40), l = Math.max(c.l,55);
    const col = `hsl(${h} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
    const el = attacker.element;
    const offsets = [{dx: 0, dy: -7, size: 18, delay: 0},{dx: -7, dy: 5, size: 11, delay: 90},{dx: 7, dy: 5, size: 11, delay: 180}];
    offsets.forEach(o=>{
      setTimeout(()=>{
        const orb = document.createElement('div');
        orb.className = 'skill-orb';
        applyParticleStyle(orb, el, o.size, col);
        if(el === '风' || el === '空间'){
          orb.style.transform = `translate(-50%,-50%) rotate(${(angDeg + 180).toFixed(1)}deg)`;
        } else if(el === '岩' || el === '冰'){
          orb.style.width = (o.size * 1.8) + 'px';
          orb.style.height = (o.size * 0.5) + 'px';
          orb.style.transform = `translate(-50%,-50%) rotate(${angDeg.toFixed(1)}deg)`;
        }
        const sx = from.x + o.dx;
        const sy = from.y + o.dy;
        orb.style.left = sx+'px';
        orb.style.top = sy+'px';
        fieldEl.appendChild(orb);
        const t0 = performance.now(), dur = 380;
        function step(now){
          if(!orb.isConnected) return;
          const p = Math.min(1,(now-t0)/dur);
          const e = 1-Math.pow(1-p,2);
          orb.style.left = (sx+(to.x-sx)*e)+'px';
          orb.style.top = (sy+(to.y-sy)*e)+'px';
          orb.style.opacity = (1-p*0.6).toFixed(2);
          if(p<1) requestAnimationFrame(step); else orb.remove();
        }
        requestAnimationFrame(step);
      }, o.delay);
    });
  }

  function initBattleUnit(ref){
    const st = {burn:0, poison:0, frostbite:0, frozen:0, freezeVisual:false,paralysis:0, charm:0, weakness:0, intangible:0,rockArmor:0, iceArmor:0, timeRevive:false, reviveUsed:false,immuneDebuff:false, miniSlime:null};
    if(ref.element === '岩' && !ref.isTraining){ st.immuneDebuff = true; st.rockArmor = Math.round(hpMax(ref)*0.5); }
    if(ref.element === '冰'){ st.iceArmor = Math.round(hpMax(ref)*0.5); }
    if(ref.element === '时间'){ st.timeRevive = true; }
    return {ref, hp:ref.hp, maxHp:ref.trainingHp || hpMax(ref), st, minis:[], cd:{}, acted:false, intent:null};
  }
  const B = {running:true, ended:false,allies: allies.map(initBattleUnit),monsters: monsters.map(initBattleUnit),turn:0, timer:null, pendingTimers:[],paused:false, pauseTimer:null, _pauseResume:null,atkBuff: 1, mLevel, training:!!challenge, trainingMode:'manual', challengeId:options.challengeId || null, practiceUsed:{}, resolving:false, manualTimeoutStreak:0};
  B.rewardMonsters = B.monsters.slice();
  autoTabId = null;
  function currentBattleMode(){ return B.training ? B.trainingMode : S.battleMode; }
  if(challenge && options.challengeId==='cleanse'){ B.allies[0].st.burn=3; B.allies[0].st.poison=3; }
    if(window.__TEST__) window.__TEST__._battle = {
    B, overlay, fieldEl, logEl, later, performAction, performMiniAction,
    getUnitEl, refreshBars, dealDamage, handleUnitDeath, nextTurn,
    playerCast, playerBasic, renderSkillBar, castStrike,
    waitForPlayer, closeBattle, enemyPhase, endBattle, queueEnemyIntents, refreshIntentPanel, turnControl,
    setDodgeRate: fn => { dodgeRate = fn; },
    setCritRate: fn => { critRate = fn; },
    restoreRates: () => { dodgeRate = _rateOrig.dodgeRate; critRate = _rateOrig.critRate; }
  };
  const _rateOrig = { dodgeRate, critRate };

const MODES = ['manual', 'auto'];
  const MODE_LABEL = { manual:'手动', auto:'自动' };
  let afterPlayerAction = null;
  let skSel = null;
  let skPick = null;
  function sideOfUnit(u){if(u.isMini) return u.side;return B.monsters.indexOf(u) >= 0 ? 'enemy' : 'ally';}
  function manualMode(){return currentBattleMode() === 'manual';}
  function lowestAllyUnit(){const alive = getAllAliveUnits('ally').filter(u=>u.hp > 0);if(!alive.length) return null;return alive.reduce((a,b)=> (b.hp/b.maxHp < a.hp/a.maxHp ? b : a));}

  function updateCtrlUI(){
    const ctrl = overlay.querySelector('#skCtrl');
    if(!ctrl) return;
    ctrl.querySelectorAll('.sk-speed').forEach(b=>b.classList.toggle('on', Number(b.dataset.speed)===battleSpeed));
    const mb = ctrl.querySelector('.sk-mode');
    if(mb) mb.textContent = currentBattleMode()==='manual' ? '手动' : '自动';
  }

  function updateCounterBadges(){
    const atk = (skSel && skSel.hp > 0) ? skSel : null;
    overlay.querySelectorAll('.battle-row.enemy .battle-unit').forEach(el=>{
      const id = +el.dataset.monId;
      const mon = B.monsters.find(x=>x.ref.id === id);
      let txt = '', cls = '';
      if(manualMode() && atk && mon && mon.hp > 0){
        let m = (ELEMENT_CHART[atk.ref.element] || {})[mon.ref.element] || 1;
        if(atk.ref.element === '光' && mon.ref.isMonster) m *= 2;
        if(m >= 2) { txt = '强克'; cls = 'strong'; }
        else if(m >= 1.5){
          if(atk.ref.element !== '暗' && atk.ref.element !== '空间'){ txt = '弱克'; cls = 'weak'; }
        }
        else if(m <= 0.5) { txt = '抵抗'; cls = 'resist'; }
      }
      let badge = el.querySelector('.counter-badge');
      if(txt){
        if(!badge){ badge = document.createElement('div'); el.appendChild(badge); }
        badge.className = 'counter-badge ' + cls;
        badge.textContent = txt;
      } else if(badge){ badge.remove(); }
    });
  }

  function markTargetable(on, mode){
    overlay.querySelectorAll('.battle-row.enemy .battle-unit, .battle-row.ally .battle-unit').forEach(el=>{
      let canTarget = false;
      if(on){
        if(el.dataset.side === 'enemy' && mode === 'enemy'){
          const u = B.monsters.find(b=>String(b.ref.id)===String(el.dataset.monId));
          if(u && u.hp > 0 && !isUntargetable(u, getAllAliveMain('enemy'))) canTarget = true;
        } else if(el.dataset.side === 'ally' && (mode === 'ally-single' || mode === 'ally-aoe')){
          const u = B.allies.find(b=>String(b.ref.id)===String(el.dataset.allyId));
          if(u && u.hp > 0) canTarget = true;
        }
      }
      el.classList.toggle('targetable', canTarget);
      el.classList.toggle('single-targetable', canTarget && (mode === 'enemy' || mode === 'ally-single'));
      el.classList.toggle('aoe-targetable', canTarget && mode === 'ally-aoe');
    });
  }

  function castStrike(attackerUnit, target, mult, opt){
    opt = opt || {};
    const ref = attackerUnit.ref;
    const atkEl = getUnitEl(attackerUnit, sideOfUnit(attackerUnit));
    const tSide = sideOfUnit(target);
    const tgtEl = getUnitEl(target, tSide);
    if(tgtEl && atkEl){
      const isBasicAtk = !opt.name || opt.name === '普攻';
      if(isBasicAtk){ doBasicParticleEffect(ref, atkEl, tgtEl); }
      else { doElementBallEffect(ref, atkEl, tgtEl, true, 1); }
    }
    const dodge = B.training || target.isMini ? 0 : dodgeRate(target.ref);
    if(Math.random()*100 < dodge){FX.float(tgtEl, 'MISS', { cls:'miss' });log(`${target.ref.name} 闪避了 ${ref.name} 的${opt.name || '攻击'}`);return 0;}
    let baseDmg = physAtk(ref) + (B.training ? 0 : rndInt(-3,3));
    baseDmg = Math.round(baseDmg * (B.atkBuff||1));
    if(attackerUnit.st.weakness > 0) baseDmg = Math.round(baseDmg * (1 - attackerUnit.st.weakness*0.05));
    let elemMult = 1;
    if(ELEMENT_CHART[ref.element] && ELEMENT_CHART[ref.element][target.ref.element]) { elemMult = ELEMENT_CHART[ref.element][target.ref.element]; }
    let dmg = Math.round(baseDmg * elemMult * (mult || 1));
    if(ref.element === '光' && target.ref.isMonster) dmg *= 2;
    const critBonus = target.st.frostbite * 5;
    const crit = !B.training && Math.random() < (critRate(ref)+critBonus)/100;
    if(crit) dmg = Math.round(dmg * 1.8);
    dmg = Math.max(1, dmg);
    if(!opt.noElement && !B.training) applyAttackerElement(attackerUnit, target);
    if(target.ref.element === '冰' && target.st.iceArmor > 0){ if(applyStatus(attackerUnit, 'frostbite', 1)) setTimeout(()=>log(`❄ ${ref.name} 被冰甲冻伤！`), 120); }
    const shield0 = shieldOf(target);
    const actual = dealDamage(target, dmg);
    if(tgtEl){
      FX.flash(tgtEl, crit);
      if(crit) FX.shake('crit');
      if(actual === 0){ FX.float(tgtEl, '护盾', { cls:'small' }); }
      else { const tag = elemMult > 1.2 ? ' 克制' : ''; FX.float(tgtEl, '-' + actual + (crit ? '!' : '') + tag,{ cls: crit ? 'crit' : (elemMult < 0.85 ? 'weak' : (elemMult > 1.2 ? 'strong' : '')) }); }
    }
    const elemMsg = elemMult > 1 ? '（克制！）' : (elemMult < 1 ? '（微弱）' : '');
    log(damageLogText(target, shield0, actual,`${ref.name} 的${opt.name || '攻击'}命中 ${target.ref.name}`, `${crit?'（暴击！）':''}${elemMsg}`));
    if(ref.element === '雷' && actual > 0) doSplash(attackerUnit, target, actual);
    if(ref.element === '草' && actual > 0){const heal = Math.round(actual * 0.5);attackerUnit.hp = Math.min(attackerUnit.maxHp, attackerUnit.hp + heal);FX.float(atkEl, '+' + heal, { cls:'good small' });if(tgtEl && atkEl){const cc = slimeColor(ref);const colGrass = `hsl(${cc.h} ${Math.max(cc.s,40).toFixed(1)}% ${Math.max(cc.l,55).toFixed(1)}%)`;later(()=>{ doDrainEffect(tgtEl, atkEl, colGrass); }, Math.round(520 / battleSpeed));}}
    if(!target.isMini && target.ref.element === '水' && target.hp > 0){const mini = spawnMiniSlime(target, tSide);if(mini) miniSlimeAttack(mini);}
    refreshBars();
    if(target.hp <= 0) handleUnitDeath(target, tSide);
    return actual;
  }
  function doSplash(attackerUnit, target, actual){if(!(actual > 0) || target.ref.element !== '水') return;const splash = Math.max(1, Math.round(actual * 0.2));let hitCount = 0;[B.allies, B.monsters].forEach(team=>{const s = team === B.allies ? 'ally' : 'enemy';team.forEach(u=>{const list = [{u, side:s}];(u.minis||[]).forEach(m=>{ if(m.hp > 0) list.push({u:m, side:s}); });list.forEach(w=>{if(w.u === target || w.u.hp <= 0) return;if(w.u.ref.element !== '水') return;dealDamage(w.u, splash);FX.float(getUnitEl(w.u, w.side), '-' + splash, { cls:'small' });hitCount++;if(w.u.hp <= 0) handleUnitDeath(w.u, w.side);});});});if(hitCount){log(`⚡ 电流顺着水流扩散，其他水史莱姆受到 ${splash} 点溅射伤害`);refreshBars();}}
  function playerBasic(attackerUnit, targetUnit){if(!canWrite())return false;const ref = attackerUnit.ref;if(!attackerUnit || attackerUnit.hp <= 0) return false;if(attackerUnit.acted){ log(`${ref.name} 本回合已经行动过了`); renderSkillBar(); return false; }if(turnControl(attackerUnit, 'ally')){ attackerUnit.acted = true; renderSkillBar(); return false; }const enemyMain = getAllAliveMain('enemy');const target = targetUnit || pick(getAllAliveUnits('enemy'));if(!target || target.hp <= 0){ log('没有可攻击的目标'); renderSkillBar(); return false; }if(isUntargetable(target, enemyMain)){ log(`${target.ref.name} 虚化中，无法选中`); renderSkillBar(); return false; }castStrike(attackerUnit, target, 1, { name:'普攻' });attackerUnit.acted = true;renderSkillBar();return true;}
  function playerCast(attackerUnit, targetUnit){if(!canWrite())return false;
    const ref = attackerUnit ? attackerUnit.ref : null;
    if(!ref) return false;
    const sk = skillOf(ref);
    if(!sk) return false;
    if(attackerUnit.hp <= 0) return false;
    if(attackerUnit.acted){ log(`${ref.name} 本回合已经行动过了`); renderSkillBar(); return false; }
    const cd = attackerUnit.cd[ref.element] || 0;
    if(cd > 0){ log(`${sk.name} 冷却中（还剩 ${cd} 回合）`); renderSkillBar(); return false; }
    if(turnControl(attackerUnit, 'ally')){ attackerUnit.acted = true; renderSkillBar(); return false; }
    const enemyMain = getAllAliveMain('enemy');
    let target = targetUnit || null;
    if(sk.target === 'enemy' && sk.kind !== 'revive'){ if(!target || target.hp <= 0){ log('没有可攻击的目标'); renderSkillBar(); return false; } if(isUntargetable(target, enemyMain)){ log(`${target.ref.name} 虚化中，无法选中`); renderSkillBar(); return false; } }
    const el = ref.element;
    const unitEl = getUnitEl(attackerUnit, 'ally');
    if(el === '岩'){ castStrike(attackerUnit, target, 1.6, { name: sk.name, noElement:true }); const sh = Math.round(attackerUnit.maxHp * 0.3); attackerUnit.st.rockArmor = (attackerUnit.st.rockArmor || 0) + sh; log(`🪨 ${ref.name} 的${sk.name}落下，获得 ${sh} 点护盾`); }
    else if(el === '火'){ castStrike(attackerUnit, target, 1.4, { name: sk.name, noElement:true }); if(applyStatus(target, 'burn', 2)) log(`🔥 ${ref.name} 的${sk.name}点燃了 ${target.ref.name}（2 层烧伤）`); }
    else if(el === '水'){
      const healTarget = target || lowestAllyUnit();
      if(healTarget){
        const heal = Math.max(1, Math.round(magAtk(ref) * 1.2));
        healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + heal);
        const lel = getUnitEl(healTarget, sideOfUnit(healTarget));
        if(lel && unitEl) doHealEffect(ref, unitEl, lel);
        FX.float(lel, '+' + heal, { cls:'good' });
        log(`💧 ${ref.name} 的${sk.name}治疗 ${healTarget.ref.name} ${heal} 点`);
      }
      const mini = spawnMiniSlime(attackerUnit, 'ally');
      if(mini){ refreshMiniBars(); log('💧 涌泉召唤出一只迷你水史莱姆'); }
    }
    else if(el === '风'){ const pool = getAllAliveUnits('enemy').filter(u=>u.hp > 0 && !isUntargetable(u, enemyMain)); const hitList = []; let hits = 0; for(let i=0;i<2;i++){ const cand = pool.filter(u=>hitList.indexOf(u) < 0 && u.hp > 0); if(!cand.length) break; const t = pick(cand); hitList.push(t); castStrike(attackerUnit, t, 0.9, { name: sk.name }); hits++; } if(hits === 2) log(`🌪 ${ref.name} 的${sk.name}斩出两道风刃`); }
    else if(el === '草'){ castStrike(attackerUnit, target, 0.8, { name: sk.name, noElement:true }); if(applyStatus(target, 'poison', 3)) log(`🌿 ${target.ref.name} 缠绕上 3 层中毒`); }
    else if(el === '冰'){ castStrike(attackerUnit, target, 0.7, { name: sk.name, noElement:true }); if(applyStatus(target, 'frostbite', 2)) log(`❄ ${target.ref.name} 被冻结 2 层`); }
    else if(el === '雷'){ castStrike(attackerUnit, target, 1.5, { name: sk.name, noElement:true }); }
    else if(el === '光'){
      if(B.training && getAllAliveUnits('ally').some(u=>['burn','poison','frostbite','frozen','paralysis','charm','weakness'].some(k=>u.st[k]>0))) B.practiceUsed.cleanse=true;
      const heal = Math.max(1, Math.round(magAtk(ref) * 0.6));
      getAllAliveUnits('ally').forEach(u=>{ if(u.hp <= 0) return; u.hp = Math.min(u.maxHp, u.hp + heal); FX.float(getUnitEl(u, sideOfUnit(u)), '+' + heal, { cls:'good small' }); u.st.burn = u.st.poison = u.st.frostbite = 0; u.st.frozen = u.st.paralysis = u.st.charm = u.st.weakness = 0; });
      log(`✨ ${ref.name} 的${sk.name}治愈全队 ${heal} 点并净化负面状态`);
    }
    else if(el === '暗'){ castStrike(attackerUnit, target, 0.9, { name: sk.name, noElement:true }); if(applyStatus(target, 'weakness', 3)) log(`🌑 ${target.ref.name} 被削弱 3 层`); }
    else if(el === '幻'){ castStrike(attackerUnit, target, 0.5, { name: sk.name, noElement:true }); if(applyStatus(target, 'charm', 2)) log(`💗 ${target.ref.name} 被魅惑 2 回合`); }
    else if(el === '空间'){ castStrike(attackerUnit, target, 0.8, { name: sk.name, noElement:true }); attackerUnit.st.intangible = 1; log(`🌌 ${ref.name} 相位化，暂时无法被选中`); }
    else if(el === '时间'){ const dead = B.allies.find(u=>u !== attackerUnit && u.hp <= 0); if(dead){ dead.hp = Math.max(1, Math.round(dead.maxHp * 0.3)); if(dead.st){ dead.st.burn = dead.st.poison = dead.st.frostbite = 0; dead.st.frozen = dead.st.paralysis = dead.st.charm = dead.st.weakness = 0; } refreshBars(); const del = getUnitEl(dead, 'ally'); const delSl = del && del.querySelector('.slime'); if(delSl) delSl.classList.remove('dying'); if(del) FX.float(del, '复活', { cls:'good' }); log(`⏳ ${ref.name} 的${sk.name}让 ${dead.ref.name} 回到战场（30% 生命）`); } else { if(!target || target.hp <= 0){ log('没有阵亡友方，也没有可攻击的目标'); renderSkillBar(); return false; } castStrike(attackerUnit, target, 1.3, { name: sk.name }); } }
    attackerUnit.acted = true;
    attackerUnit.cd[el] = sk.cd;
    refreshIntentPanel();
    refreshBars();
    renderSkillBar();
    return true;
  }

  function getSkillDesc(){
    if(!skSel) return '';
    if(skPick === 'basic') return '普攻：对单个敌人造成 100% 物理攻击伤害，并附带本元素的常规效果。';
    const sk = skillOf(skSel.ref);
    if(!sk) return '';
    return SKILL_DESC[skSel.ref.element] || '';
  }

  function renderSkillBar(){
    updateCtrlUI();
    overlay.querySelectorAll('[data-ally-id]').forEach(el=>el.classList.toggle('selected-unit', !!skSel && manualMode() && String(el.dataset.allyId)===String(skSel.ref.id)));
    const bar = overlay.querySelector('#skillBar');
    if(!bar) return;
    updateCounterBadges();
    if(!manualMode()){
      bar.classList.add('hide');
      bar.innerHTML = '';
      lastSkillBarSig = '';
      markTargetable(false);
      return;
    }
    bar.classList.remove('auto');
    bar.classList.add('manual');
    bar.classList.remove('hide');
    const alive = B.allies.filter(u=>u.hp > 0).slice(0, 5);
    if(!alive.length){ bar.classList.add('hide'); bar.innerHTML = ''; skSel = null; skPick = null; markTargetable(false); lastSkillBarSig=''; return; }
    if(skSel && (skSel.hp <= 0 || alive.indexOf(skSel) < 0)){ skSel = null; skPick = null; markTargetable(false); }
    const sig = 'M|' + alive.map(u=>`${u.ref.id}:${u===skSel?1:0}:${u.cd[u.ref.element]||0}:${u.acted?1:0}`).join(',') + '|' + skPick;
    if(sig === lastSkillBarSig && bar.innerHTML) return;
    lastSkillBarSig = sig;
    const avatars = alive.map(u=>{
      const cd = u.cd[u.ref.element] || 0;
      const badge = cd > 0 ? `<span class="sk-cd">${cd}</span>` : (u.acted ? `<span class="sk-cd done">✓</span>` : '');
      return `<button class="sk-avatar ${u === skSel ? 'on' : ''}" data-sk-unit="${u.ref.id}" title="${esc(u.ref.name)}">${slimeHTML(u.ref,{mood:'idle'})}${badge}</button>`;
    }).join('');
    let actsHTML = '';
    if(skSel){
      const sk = skillOf(skSel.ref);
      const cd = skSel.cd[skSel.ref.element] || 0;
      const desc = getSkillDesc();
      actsHTML = `<button class="sk-act big" data-sk-act="basic" ${skSel.acted?'disabled':''}>普攻</button>
        <button class="sk-act big" data-sk-act="skill" ${(skSel.acted||cd>0)?'disabled':''}>${sk ? sk.name : '—'}${cd>0?' CD'+cd:''}</button>
        <div class="skill-desc-box">${esc(desc)}</div>`;
    } else {
      actsHTML = `<span class="sk-hint-text">点选史莱姆准备行动</span>`;
    }
    bar.innerHTML = `<div class="sk-avatars">${avatars}</div><div class="sk-acts">${actsHTML}</div>`;
    bar.querySelectorAll('[data-sk-unit]').forEach(btn=>{btn.addEventListener('click', ()=>{
      const id = String(btn.dataset.skUnit);
      const u = B.allies.find(a=>String(a.ref.id) === id);
      if(!u || u.hp <= 0) return;
      if(skSel === u){ skSel = null; skPick = null; markTargetable(false); }
      else { skSel = u; skPick = 'basic'; markTargetable(true, 'enemy'); }
      renderSkillBar();
    });});
    bar.querySelectorAll('[data-sk-act]').forEach(btn=>{btn.addEventListener('click', ()=>{
      const act = btn.dataset.skAct;
      if(!skSel) return;
      if(act === 'basic'){ skPick = 'basic'; markTargetable(true, 'enemy'); renderSkillBar(); return; }
      if(act === 'skill'){
        const sk = skillOf(skSel.ref);
        if(!sk) return;
        if(sk.target === 'enemy'){ skPick = 'skill'; markTargetable(true, 'enemy'); renderSkillBar(); return; }
        if(sk.target === 'ally-low'){ skPick = 'skill'; markTargetable(true, 'ally-single'); renderSkillBar(); return; }
        if(sk.target === 'all-ally'){ skPick = 'skill'; markTargetable(true, 'ally-aoe'); renderSkillBar(); return; }
        doManual('skill', null);
      }
    });});
  }
  function doManual(kind, target){markTargetable(false);const u = skSel;skPick = null;if(!u) return;const ok = (kind === 'basic') ? playerBasic(u, target) : playerCast(u, target);if(ok) skSel = null;renderSkillBar();if((ok || u.acted) && typeof afterPlayerAction === 'function') afterPlayerAction(u);refreshIntentPanel();}
  overlay.addEventListener('click', (ev)=>{
    if(!skSel || !skPick) return;
    const enemyEl = ev.target.closest ? ev.target.closest('.battle-row.enemy .battle-unit') : null;
    const allyEl = ev.target.closest ? ev.target.closest('.battle-row.ally .battle-unit') : null;
    const sk = skPick === 'skill' ? skillOf(skSel.ref) : null;
    if(skPick === 'basic' && enemyEl){
      const id = String(enemyEl.dataset.monId);
      const target = B.monsters.find(m=>String(m.ref.id) === id);
      if(target) doManual('basic', target);
    } else if(sk && sk.target === 'enemy' && enemyEl){
      const id = String(enemyEl.dataset.monId);
      const target = B.monsters.find(m=>String(m.ref.id) === id);
      if(target) doManual('skill', target);
    } else if(sk && (sk.target === 'ally-low' || sk.target === 'all-ally') && allyEl){
      const id = String(allyEl.dataset.allyId);
      const target = B.allies.find(a=>String(a.ref.id) === id);
      if(target) doManual('skill', target);
    }
  });

  const ctrlEl = overlay.querySelector('#skCtrl');
  ctrlEl.addEventListener('click', ev=>{
    const spBtn = ev.target.closest('.sk-speed');
    if(spBtn){
      const sp = Number(spBtn.dataset.speed);
      if([1,2,5].includes(sp)){
        battleSpeed = sp; S.battleSpeed = sp; save();
        updateCtrlUI();
        restartTimer();
      }
      return;
    }
    const modeBtn = ev.target.closest('.sk-mode');
    if(modeBtn){
      const i = MODES.indexOf(currentBattleMode());
      const nextMode = MODES[(i+1)%MODES.length];
      if(B.training) B.trainingMode = nextMode; else S.battleMode = nextMode;
      lastSkillBarSig = '';
      updateCtrlUI();
      renderSkillBar();
      log(`战斗玩法切换为「${MODE_LABEL[currentBattleMode()]}」`);
      if(B.paused && typeof B._pauseResume === 'function'){ const resume = B._pauseResume; B._pauseResume = null; resume(); }
      save();
      return;
    }
  });

  renderSkillBar();
  let battleClosed = false;
  let autoCloseTimer = null;
  function closeBattle(){if(battleClosed) return;LivingWorld.release(S,'battle');battleClosed = true;B.running = false;B.paused = false;afterPlayerAction = null;if(B.pauseTimer){ clearTimeout(B.pauseTimer); B.pauseTimer = null; }B._pauseResume = null;if(autoCloseTimer){ clearTimeout(autoCloseTimer); autoCloseTimer = null; }if(B.timer) clearInterval(B.timer);B.pendingTimers.forEach(t=>clearTimeout(t));B.pendingTimers = [];overlay.remove();save();if(activeTab === 'space'||activeTab==='home') renderTab();}
  function later(fn, ms){
    const id = setTimeout(()=>{
      B.pendingTimers = B.pendingTimers.filter(x=>x!==id);
      if(battleClosed)return;
      if(!canWrite()){later(fn,250);return;}
      fn();
    }, ms);
    B.pendingTimers.push(id);
    return id;
  }
  function intervalMs(){ return Math.round(9000 / battleSpeed); }
  function restartTimer(){if(B.timer) clearInterval(B.timer);if(!B.running) return;B.timer = setInterval(nextTurn, intervalMs());}
  function log(msg){ logEl.innerHTML = msg; }
  function dealDamage(target, dmg){const st = target.st;let remaining = dmg;if(st.rockArmor > 0 || st.iceArmor > 0){remaining = Math.max(1, Math.round(remaining * 0.75));}if(st.rockArmor > 0){const absorbed = Math.min(st.rockArmor, remaining);st.rockArmor -= absorbed;remaining -= absorbed;}if(st.iceArmor > 0){const absorbed = Math.min(st.iceArmor, remaining);st.iceArmor -= absorbed;remaining -= absorbed;}target.hp = Math.max(0, target.hp - remaining);return remaining;}
  function shieldOf(target){return (target.st.rockArmor || 0) + (target.st.iceArmor || 0);}
  function damageLogText(target, beforeShield, actual, head, tail){const absorbed = Math.max(0, beforeShield - shieldOf(target));if(actual === 0 && absorbed > 0) return `${head}，护盾吸收 ${absorbed} 点${tail || ''}`;return `${head}，造成 ${actual} 伤害${tail || ''}`;}
  function applyStatus(unit, key, amount){const st = unit.st;if(st.immuneDebuff) return false;if(key === 'burn' && unit.ref.element === '水') return false;if(key === 'burn' && unit.ref.element === '草') amount += 1;const def = STATUS_DEFS[key];if(!def) return false;st[key] = Math.min(def.max, (st[key]||0) + amount);if(key === 'frostbite' && st.frostbite >= 3){st.frostbite = 0;st.frozen = 1;}return true;}
  function isUntargetable(unit, team){if(unit.st && (unit.st.intangible || 0) > 0) return true;if(unit.ref.element !== '空间') return false;return team.some(u=>u !== unit && u.hp > 0);}
  function checkRevive(side){const team = side === 'ally' ? B.allies : B.monsters;if(team.some(u=>u.hp > 0)) return false;const reviver = team.find(u=>u.st.timeRevive && !u.st.reviveUsed);if(!reviver) return false;reviver.st.reviveUsed = true;team.forEach(u=>{u.hp = Math.max(1, Math.round(u.maxHp * 0.2));u.st.burn = u.st.poison = u.st.frostbite = 0;u.st.frozen = u.st.paralysis = u.st.charm = u.st.weakness = 0;u.st.rockArmor = 0;u.st.iceArmor = 0;const el = getUnitEl(u, side);const sl = el && el.querySelector('.slime');if(sl) sl.classList.remove('dying');});log(`⏳ ${reviver.ref.name} 触发【回溯】，全体友方复活（回复20%生命）！`);refreshBars();return true;}
  function getCoords(el){const fieldRect = fieldEl.getBoundingClientRect();const r = el.getBoundingClientRect();return {x:r.left-fieldRect.left+r.width/2, y:r.top-fieldRect.top+r.height/2};}
  function spawnRadiantOrbs(from, to, col, count, sizeRange, opts){opts = opts || {};const [minS, maxS] = sizeRange || [9, 24];const opBase = opts.opacity != null ? opts.opacity : 0.92;const spreadX = opts.spreadX != null ? opts.spreadX : 22;const spreadYMin = opts.spreadYMin != null ? opts.spreadYMin : 28;const spreadYMax = opts.spreadYMax != null ? opts.spreadYMax : 60;const noFade = !!opts.noFade;const glow = opts.glow;const glowSpread = opts.glowSpread != null ? opts.glowSpread : 1.4;for(let i=0;i<count;i++){const size = rnd(minS, maxS);const orb = document.createElement('div');orb.className = 'skill-orb';orb.style.left = from.x+'px'; orb.style.top = from.y+'px';orb.style.width = size+'px'; orb.style.height = size+'px';orb.style.background = `radial-gradient(circle, ${col} 12%, ${col} 28%, rgba(255,255,255,0.22) 58%, rgba(255,255,255,0) 100%)`;orb.style.clipPath = 'polygon(50% 0%, 65% 40%, 100% 50%, 65% 60%, 50% 100%, 35% 60%, 0% 50%, 35% 40%)';orb.style.borderRadius = '0';orb.style.filter = 'blur(2.6px)';orb.style.opacity = String(opBase);if(glow){orb.style.boxShadow = `0 0 ${size*glowSpread*0.55}px ${glow}, 0 0 ${size*glowSpread*0.95}px ${glow}70`;} else {orb.style.boxShadow = `0 0 ${size*0.4}px ${col}, 0 0 ${size*0.8}px ${col}50`;}fieldEl.appendChild(orb);let ringEl = null;if(opts.ring){ringEl = document.createElement('div');ringEl.style.cssText = 'position:absolute;pointer-events:none;border-radius:50%;border:1px solid rgba(255,246,222,0.92);box-shadow:0 0 10px rgba(255,238,186,0.85), inset 0 0 8px rgba(255,238,186,0.55);filter:blur(0.6px);z-index:1;';ringEl.style.width = (size * 0.5) + 'px';ringEl.style.height = (size * 0.5) + 'px';ringEl.style.left = from.x + 'px';ringEl.style.top = from.y + 'px';ringEl.style.animation = 'holyRingPulse 1.3s ease-in-out infinite alternate';fieldEl.appendChild(ringEl);}const ex = from.x + rnd(-spreadX, spreadX);const ey = from.y - rnd(spreadYMin, spreadYMax);setTimeout(()=>{if(!orb.isConnected){ if(ringEl) ringEl.remove(); return; }const t0 = performance.now(), d1 = 260 + Math.random()*120;function spread(now){if(!orb.isConnected){ if(ringEl) ringEl.remove(); return; }const p = Math.min(1,(now-t0)/d1);const ease = 1-Math.pow(1-p,2);const nx = from.x+(ex-from.x)*ease;const ny = from.y+(ey-from.y)*ease;orb.style.left = nx+'px'; orb.style.top = ny+'px';if(ringEl && ringEl.isConnected){ ringEl.style.left = nx+'px'; ringEl.style.top = ny+'px'; }if(p<1){ requestAnimationFrame(spread); return; }const t1 = performance.now(), d2 = 340 + Math.random()*140;function fly(now2){if(!orb.isConnected){ if(ringEl) ringEl.remove(); return; }const q = Math.min(1,(now2-t1)/d2);const e2 = q*q;const nx2 = ex+(to.x-ex)*e2;const ny2 = ey+(to.y-ey)*e2;orb.style.left = nx2+'px'; orb.style.top = ny2+'px';if(ringEl && ringEl.isConnected){ ringEl.style.left = nx2+'px'; ringEl.style.top = ny2+'px'; }if(noFade){orb.style.opacity = String(opBase);} else {orb.style.opacity = (opBase * (1 - q*0.6)).toFixed(2);}if(q<1) requestAnimationFrame(fly); else { orb.remove(); if(ringEl) ringEl.remove(); }}requestAnimationFrame(fly);}requestAnimationFrame(spread);}, i*50);}}
  function markBattleAction(atkUnit,tgtUnit){overlay.querySelectorAll('.is-acting,.is-targeted').forEach(e=>e.classList.remove('is-acting','is-targeted'));if(atkUnit)atkUnit.classList.add('is-acting');if(tgtUnit)tgtUnit.classList.add('is-targeted');later(()=>{if(atkUnit)atkUnit.classList.remove('is-acting');if(tgtUnit)tgtUnit.classList.remove('is-targeted');},Math.max(400,1100/battleSpeed));}
  function doElementBallEffect(attacker, atkUnit, tgtUnit, important, scale){
    if(!atkUnit || !tgtUnit) return;
    scale = (typeof scale === 'number' && scale > 0) ? scale : 1;
    markBattleAction(atkUnit,tgtUnit);
    const from = getCoords(atkUnit), to = getCoords(tgtUnit);
    const c = slimeColor(attacker);
    const h = c.h, s = Math.max(c.s,40), l = Math.max(c.l,55);
    const col = `hsl(${h} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
    const miniScale = (attacker.miniScale || 1) * scale;
    const ring = document.createElement('div');
    ring.className = 'skill-ring' + (important ? ' important' : '');
    ring.style.left = from.x+'px';
    ring.style.top = from.y+'px';
    ring.style.setProperty('--h', h);
    ring.style.setProperty('--s', s.toFixed(1)+'%');
    ring.style.setProperty('--l', l.toFixed(1)+'%');
    fieldEl.appendChild(ring);
    setTimeout(()=>ring.remove(), 820);
    const el = attacker.element;
    if(el === '幻'){const heartCount = 6 + Math.floor(Math.random()*3);for(let i=0;i<heartCount;i++){const size = rnd(7, 17) * miniScale;const orb = document.createElement('div');orb.className = 'skill-orb';orb.style.left = from.x+'px'; orb.style.top = from.y+'px';orb.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="fill:${col}; filter:drop-shadow(0 0 6px ${col})"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;orb.style.background = 'transparent';orb.style.boxShadow = 'none';orb.style.width = size + 'px';orb.style.height = size + 'px';fieldEl.appendChild(orb);const ang = Math.random()*Math.PI*2;const dist = rnd(18, 46);const ex = from.x + Math.cos(ang)*dist;const ey = from.y + Math.sin(ang)*dist;setTimeout(()=>{if(!orb.isConnected) return;const t0 = performance.now(), d1 = 240 + Math.random()*120;function spread(now){if(!orb.isConnected) return;const p = Math.min(1,(now-t0)/d1);const ease = 1-Math.pow(1-p,2);orb.style.left = (from.x+(ex-from.x)*ease)+'px';orb.style.top  = (from.y+(ey-from.y)*ease)+'px';if(p<1){ requestAnimationFrame(spread); return; }const t1 = performance.now(), d2 = 340 + Math.random()*140;function fly(now2){if(!orb.isConnected) return;const q = Math.min(1,(now2-t1)/d2);const e2 = q*q;orb.style.left = (ex+(to.x-ex)*e2)+'px';orb.style.top  = (ey+(to.y-ey)*e2)+'px';orb.style.opacity = (1 - q*0.5).toFixed(2);if(q<1) requestAnimationFrame(fly); else orb.remove();}requestAnimationFrame(fly);}requestAnimationFrame(spread);}, i*55);}return;}
    if(el === '光'){spawnRadiantOrbs(from, to, col, 9 + Math.floor(Math.random()*5), [14*miniScale, 14*miniScale], {ring: true});return;}
    if(el === '雷' || el === '暗'){const bigSize = rnd(34, 48) * miniScale;const orb = document.createElement('div');orb.className = 'skill-orb';orb.style.left = from.x+'px'; orb.style.top = from.y+'px';orb.style.width = bigSize+'px'; orb.style.height = bigSize+'px';orb.style.borderRadius = '50%';orb.style.background = `radial-gradient(circle at 34% 30%, ${col}, ${col} 58%, rgba(0,0,0,.22) 100%)`;orb.style.boxShadow = `0 0 ${bigSize*0.55}px rgba(180,190,200,0.85), inset -7px -7px 16px rgba(150,155,165,0.9), inset 5px 5px 12px rgba(0,0,0,.25)`;orb.style.overflow = 'hidden';const inner = document.createElement('span');inner.style.position = 'absolute';inner.style.left = '50%';inner.style.top = '50%';inner.style.transform = 'translate(-50%,-50%)';inner.style.borderRadius = '50%';inner.style.background = 'rgba(0,0,0,0.65)';inner.style.boxShadow = '0 0 8px rgba(0,0,0,.5)';inner.style.width = (bigSize*0.6)+'px';inner.style.height = (bigSize*0.6)+'px';inner.style.opacity = '0.75';orb.appendChild(inner);fieldEl.appendChild(orb);const changeTimer = setInterval(()=>{if(!inner.isConnected){ clearInterval(changeTimer); return; }const maxS = bigSize * 0.75;const s2 = rnd(bigSize*0.3, maxS);inner.style.width = s2.toFixed(1)+'px';inner.style.height = s2.toFixed(1)+'px';inner.style.opacity = (0.55 + Math.random()*0.35).toFixed(2);}, 90);const dur = 540 + Math.random()*200;const t0 = performance.now();function step(now){if(!orb.isConnected){ clearInterval(changeTimer); return; }const p = Math.min(1, (now - t0)/dur);orb.style.left = (from.x+(to.x-from.x)*p)+'px';orb.style.top  = (from.y+(to.y-from.y)*p)+'px';if(p<1) requestAnimationFrame(step);else { clearInterval(changeTimer); orb.remove(); }}requestAnimationFrame(step);return;}
    if(el === '火'){const count = 3 + (Math.random() < 0.5 ? 1 : 0);for(let i=0;i<count;i++){const outerSize = rnd(20, 34) * miniScale;const midSize = outerSize * 7 / 9;const innerSize = outerSize * 5 / 9;const orb = document.createElement('div');orb.className = 'skill-orb';orb.style.left = from.x+'px'; orb.style.top = from.y+'px';orb.style.width = outerSize+'px';orb.style.height = outerSize+'px';orb.style.borderRadius = '50%';orb.style.background = 'rgba(255, 100, 35, 0.95)';orb.style.boxShadow = `0 0 ${outerSize*0.5}px rgba(255, 120, 40, 0.9)`;orb.style.overflow = 'hidden';orb.innerHTML = `<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${midSize.toFixed(1)}px;height:${midSize.toFixed(1)}px;border-radius:50%;background:${col};"></span><span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${innerSize.toFixed(1)}px;height:${innerSize.toFixed(1)}px;border-radius:50%;background:#fff8e8;"></span>`;fieldEl.appendChild(orb);setTimeout(()=>{if(!orb.isConnected) return;const t0 = performance.now(), dur = 420;function step(now){if(!orb.isConnected) return;const p = Math.min(1,(now-t0)/dur);orb.style.left = (from.x+(to.x-from.x)*p)+'px';orb.style.top  = (from.y+(to.y-from.y)*p)+'px';if(p<1) requestAnimationFrame(step); else orb.remove();}requestAnimationFrame(step);}, i*80);}return;}
    if(el === '岩' || el === '冰'){const count = 5 + Math.floor(Math.random()*3);const spacing = 14 * miniScale;const headY = from.y - 46 * miniScale;for(let i=0;i<count;i++){const orb = document.createElement('div');orb.className = 'skill-orb';const startX = from.x + (i - (count-1)/2) * spacing + rnd(-2,2);const startY = headY + rnd(-10, 10);orb.style.left = startX+'px';orb.style.top = startY+'px';orb.style.background = col;orb.style.boxShadow = `0 0 10px ${col}`;orb.style.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';orb.style.borderRadius = '0';orb.style.width = (36 * miniScale)+'px';orb.style.height = (5 * miniScale)+'px';const ang = Math.atan2(to.y - startY, to.x - startX) * 180 / Math.PI;orb.style.transform = `translate(-50%,-50%) rotate(${ang}deg)`;fieldEl.appendChild(orb);setTimeout(()=>{if(!orb.isConnected) return;const t0 = performance.now(), dur = 380;function step(now){if(!orb.isConnected) return;const p = Math.min(1,(now-t0)/dur);orb.style.left = (startX+(to.x-startX)*p)+'px';orb.style.top  = (startY+(to.y-startY)*p)+'px';if(p<1) requestAnimationFrame(step); else orb.remove();}requestAnimationFrame(step);}, 280 + i*45);}return;}
    if(el === '风' || el === '空间'){const rows = 2, cols = 3;const spacingX = 20 * miniScale, spacingY = 15 * miniScale;const baseY = from.y - 64 * miniScale;const crescentSVG = `<svg viewBox="0 0 60 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;overflow:visible"><path d="M 50,5 Q 5,50 50,95 Q 30,50 50,5 Z" fill="${col}" style="filter:drop-shadow(0 0 4px ${col})"/></svg>`;const blades = [];for(let r = 0; r < rows; r++){const colOrder = r === 0 ? [0, 1, 2] : [2, 1, 0];for(let ci = 0; ci < cols; ci++){const c2 = colOrder[ci];const ow = rnd(22, 36) * miniScale;const oh = ow * 0.55;const w = ow * 0.5;const h = oh;const orb = document.createElement('div');orb.className = 'skill-orb';orb.style.width = w + 'px';orb.style.height = h + 'px';orb.style.background = 'transparent';orb.style.borderRadius = '0';orb.style.boxShadow = 'none';orb.innerHTML = crescentSVG;orb.style.transform = 'translate(-50%,-50%) rotate(90deg)';const sx = from.x + (c2 - 1) * spacingX + rnd(-2, 2);const sy = baseY + r * spacingY + rnd(-2, 2);orb.style.left = sx + 'px';orb.style.top = sy + 'px';fieldEl.appendChild(orb);const launchIndex = r === 0 ? ci : cols + ci;blades.push({ orb, sx, sy, launchIndex });}}blades.forEach(b => {setTimeout(() => {if(!b.orb.isConnected) return;const angle = Math.atan2(to.y - b.sy, to.x - b.sx) * 180 / Math.PI - 180;b.orb.style.transform = `translate(-50%,-50%) rotate(${angle}deg)`;const t0 = performance.now(), dur = 400 + Math.random() * 120;function step(now){if(!b.orb.isConnected) return;const p = Math.min(1, (now - t0) / dur);const e = 1 - Math.pow(1 - p, 2);b.orb.style.left = (b.sx + (to.x - b.sx) * e) + 'px';b.orb.style.top  = (b.sy + (to.y - b.sy) * e) + 'px';b.orb.style.opacity = (1 - p * 0.6).toFixed(2);if(p < 1) requestAnimationFrame(step); else b.orb.remove();}requestAnimationFrame(step);}, b.launchIndex * 70);});return;}
    const count = 3 + (Math.random() < 0.5 ? 1 : 0);
    for(let i=0;i<count;i++){
      const orb = document.createElement('div');
      orb.className = 'skill-orb';
      orb.style.left = from.x+'px'; orb.style.top = from.y+'px';
      if (el === '水') {const size = rnd(12, 31) * miniScale;orb.style.width = size+'px';orb.style.height = size+'px';orb.style.background = 'transparent';orb.style.border = `1px solid ${col}`;orb.style.borderRadius = '50%';orb.style.boxShadow = `inset 0 0 6px rgba(255,255,255,0.45), 0 0 8px ${col}`;orb.style.overflow = 'hidden';orb.innerHTML = `<span style="position:absolute;right:22%;top:18%;width:26%;height:22%;border-radius:50%;background:rgba(255,255,255,0.95);filter:blur(0.4px);"></span>`;} else {const size = rnd(6, 16) * miniScale;orb.style.width = size+'px';orb.style.height = size+'px';orb.style.background = col;orb.style.boxShadow = `0 0 12px ${col}`;}
      fieldEl.appendChild(orb);
      setTimeout(()=>{if(!orb.isConnected) return;const t0 = performance.now(), dur = 420;function step(now){if(!orb.isConnected) return;const p = Math.min(1,(now-t0)/dur);orb.style.left = (from.x+(to.x-from.x)*p)+'px';orb.style.top  = (from.y+(to.y-from.y)*p)+'px';if(p<1) requestAnimationFrame(step); else orb.remove();}requestAnimationFrame(step);}, i*70);
    }
  }
  function doHealEffect(healer, healUnit, tgtUnit){if(!healUnit || !tgtUnit) return;markBattleAction(healUnit,tgtUnit);const from = getCoords(healUnit), to = getCoords(tgtUnit);const c = slimeColor(healer);const h = c.h, s = Math.max(c.s,40), l = Math.max(c.l,60);const col = `hsl(${h} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;if(healer.element === '光'){spawnRadiantOrbs(from, to, 'rgba(255, 233, 133, 1)', 22 + Math.floor(Math.random()*8), [10, 10], {opacity: 1, spreadX: 48, spreadYMin: 38, spreadYMax: 88, noFade: true, glow: 'rgba(255, 240, 120, 0.75)', glowSpread: 0.6, ring: true});return;}if(healer.element === '暗'){spawnRadiantOrbs(from, to, col, 20 + Math.floor(Math.random()*9), [7, 7], {opacity: 1, spreadX: 42, spreadYMin: 36, spreadYMax: 92});return;}const isWaterHeal = healer.element === '水';const count = 10 + Math.floor(Math.random()*6);for(let i=0;i<count;i++){const dot = document.createElement('div');dot.className = 'heal-dot';const size = isWaterHeal ? rnd(6,13) : rnd(4,10);dot.style.width = size+'px'; dot.style.height = size+'px';if(isWaterHeal){dot.style.background = 'transparent';dot.style.border = `1px solid ${col}`;dot.style.borderRadius = '50%';dot.style.boxShadow = `inset 0 0 5px rgba(255,255,255,0.4), 0 0 6px ${col}`;dot.style.overflow = 'hidden';dot.innerHTML = `<span style="position:absolute;right:22%;top:18%;width:26%;height:22%;border-radius:50%;background:rgba(255,255,255,0.95);filter:blur(0.4px);"></span>`;} else {dot.style.background = col;dot.style.boxShadow = `0 0 8px ${col}`;}const angle = Math.random()*Math.PI*2;const dist = rnd(15,45);const sx = from.x+Math.cos(angle)*dist, sy = from.y+Math.sin(angle)*dist;dot.style.left = sx+'px'; dot.style.top = sy+'px';fieldEl.appendChild(dot);setTimeout(()=>{if(!dot.isConnected) return;const t0 = performance.now(), dur = 500+Math.random()*200;function step(now){if(!dot.isConnected) return;const p = Math.min(1,(now-t0)/dur);const ease = 1-Math.pow(1-p,3);dot.style.left = (sx+(to.x-sx)*ease)+'px';dot.style.top  = (sy+(to.y-sy)*ease)+'px';dot.style.opacity = (1-p).toFixed(2);if(p<1) requestAnimationFrame(step); else dot.remove();}requestAnimationFrame(step);}, Math.random()*200);}}
  function doDrainEffect(fromEl, toEl, col){if(!fromEl || !toEl) return;const from = getCoords(fromEl), to = getCoords(toEl);const count = 6 + Math.floor(Math.random()*4);for(let i=0;i<count;i++){const dot = document.createElement('div');dot.className = 'heal-dot';const size = rnd(2.5, 6.5);dot.style.width = size+'px';dot.style.height = size+'px';dot.style.background = col;dot.style.boxShadow = `0 0 6px ${col}`;dot.style.opacity = '0.7';dot.style.filter = 'blur(0.4px)';const sx = from.x + rnd(-10, 10);const sy = from.y + rnd(-10, 10);dot.style.left = sx+'px'; dot.style.top = sy+'px';fieldEl.appendChild(dot);const ang = Math.random()*Math.PI*2;const dist = rnd(18, 46);const ex = from.x + Math.cos(ang)*dist;const ey = from.y + Math.sin(ang)*dist;setTimeout(()=>{if(!dot.isConnected) return;const t0 = performance.now(), d1 = 240 + Math.random()*120;function spread(now){if(!dot.isConnected) return;const p = Math.min(1,(now-t0)/d1);const ease = 1-Math.pow(1-p,2);dot.style.left = (from.x+(ex-from.x)*ease)+'px';dot.style.top  = (from.y+(ey-from.y)*ease)+'px';if(p<1){ requestAnimationFrame(spread); return; }const t1 = performance.now(), d2 = 420 + Math.random()*180;function fly(now2){if(!dot.isConnected) return;const q = Math.min(1,(now2-t1)/d2);const e2 = q*q;dot.style.left = (ex+(to.x-ex)*e2)+'px';dot.style.top  = (ey+(to.y-ey)*e2)+'px';dot.style.opacity = (0.7*(1-q*0.7)).toFixed(2);if(q<1) requestAnimationFrame(fly); else dot.remove();}requestAnimationFrame(fly);}requestAnimationFrame(spread);}, i*45);}}
  function getUnitEl(unit, side){if(unit.isMini && unit.el) return unit.el;const s = side || unit.side;return overlay.querySelector(s==='ally' ? `[data-ally-id="${unit.ref.id}"]` : `[data-mon-id="${unit.ref.id}"]`);}
  function getAllAliveMain(side){return (side==='ally'?B.allies:B.monsters).filter(u=>u.hp>0);}
  function getAllAliveUnits(side){const main = getAllAliveMain(side);const minis = [];main.forEach(u=>{(u.minis||[]).forEach(m=>{ if(m.hp>0) minis.push(m); });});return main.concat(minis);}
  function removeMini(mini){const owner = mini.ownerUnit;if(owner && owner.minis){owner.minis = owner.minis.filter(m=>m!==mini);}if(mini.el && mini.el.isConnected){const el = mini.el;const sl = el.querySelector('.slime');if(sl) FX.die(sl, 6);el.dataset.dead = '1';setTimeout(()=>{ if(el.isConnected) el.remove(); }, 340);}}
  function removeMinisOf(unit){if(!unit || !unit.minis) return;unit.minis.slice().forEach(m=>removeMini(m));unit.minis = [];}
  function handleUnitDeath(unit, side){if(unit.hp > 0) return;if(unit.isMini){removeMini(unit);return;}const revived = checkRevive(side);const deadEl = getUnitEl(unit, side);if(!revived && deadEl){FX.die(deadEl, 12);setTimeout(() => {const sl = deadEl.querySelector('.slime');if(sl && sl.dataset.dead === '1') sl.classList.remove('dying');}, 380);}removeMinisOf(unit);if(currentBattleMode() !== 'auto') renderSkillBar();}
  function spawnMiniSlime(ownerUnit, side){if(!ownerUnit || ownerUnit.hp <= 0) return null;if(!ownerUnit.minis) ownerUnit.minis = [];const alive = ownerUnit.minis.filter(m=>m.hp>0);if(alive.length >= 3) return null;const slots = ['right','left-front','left-back'];let slot = null;for(const s of slots){if(!alive.some(m=>m.slot===s)){ slot = s; break; }}if(!slot) return null;const ownerEl = getUnitEl(ownerUnit, side);if(!ownerEl) return null;const wrap = ownerEl.querySelector('.slime-wrap');if(!wrap) return null;const maxHp = Math.max(1, Math.round(ownerUnit.maxHp * 0.3));const mini = {isMini:true,id: 'mini_'+ownerUnit.ref.id+'_'+(++miniSeq),ownerUnit, side, slot,hp: maxHp, maxHp,atk: Math.max(1, Math.round(physAtk(ownerUnit.ref) * 0.3)),st: {burn:0, poison:0, frostbite:0, frozen:0, freezeVisual:false, paralysis:0, charm:0, weakness:0, rockArmor:0, iceArmor:0, timeRevive:false, reviveUsed:false, immuneDebuff:false},ref: { name: `${ownerUnit.ref.name}的迷你水史莱姆`, element:'水', isMonster: ownerUnit.ref.isMonster, level: ownerUnit.ref.level }};mini.ref.id = mini.id;const el = document.createElement('div');el.className = 'mini-slime pos-'+slot;el.dataset.miniId = mini.id;el.innerHTML = `<div class="mini-hpbar"><i style="width:100%"></i></div>${slimeHTML(ownerUnit.ref,{mood:'jump'})}`;wrap.appendChild(el);mini.el = el;mini.hpBarEl = el.querySelector('.mini-hpbar i');if(mini.hpBarEl){mini.hpBarEl.style.backgroundImage = side === 'ally' ? 'linear-gradient(90deg,#3fb28c,#9ee6ac)' : 'linear-gradient(90deg,#f87171,#fbbf24)';}ownerUnit.minis.push(mini);if(side==='enemy' && B.turn>0){ queueOneEnemy(mini); refreshIntentPanel(); }setTimeout(()=>{const sl = el.querySelector('.slime');if(sl && el.isConnected) sl.dataset.mood = 'idle';}, 900);return mini;}
  function miniSlimeAttack(mini){if(!mini || mini.hp <= 0) return;const targetSide = mini.side === 'ally' ? 'enemy' : 'ally';const all = getAllAliveUnits(targetSide);if(!all.length) return;const target = pick(all);const dmg = Math.max(1, Math.round((mini.atk + rndInt(-2,2)) * (B.atkBuff||1)));const shield0 = shieldOf(target);const actual = dealDamage(target, dmg);const tgtEl = getUnitEl(target, target.isMini ? target.side : targetSide);if(tgtEl){FX.flash(tgtEl, false);FX.float(tgtEl, actual === 0 ? '护盾' : '-' + actual, { cls:'small' });}log(damageLogText(target, shield0, actual, `💧 ${mini.ref.name} 反击 ${target.ref.name}`));refreshBars();if(target.hp <= 0) handleUnitDeath(target, targetSide);}
  function performMiniAction(mini, side){if(!canWrite())return;if(!mini || mini.hp <= 0) return;if(mini.acted) return;const q = side==='enemy' ? (mini.intent && mini.intent.round===B.turn ? mini.intent : queueOneEnemy(mini)) : null;if(turnControl(mini,side)){ mini.acted=true; if(q)q.state='canceled'; refreshIntentPanel(); return; }mini.acted=true;if(q)q.state='done';const el = mini.el;if(!el || !el.isConnected) return;const inner = el.querySelector('.slime');if(inner){inner.dataset.mood = 'jump';setTimeout(()=>{ if(inner.isConnected) inner.dataset.mood = 'idle'; }, 500);}const enemiesSide = side==='ally' ? 'enemy' : 'ally';const all = getAllAliveUnits(enemiesSide);if(!all.length) return;const target = q ? resolveIntentTarget(mini,side,false) : pick(all);if(!target) return;const tgtEl = getUnitEl(target, target.isMini ? target.side : enemiesSide);const attackerForFx = {element:'水', colorOverride:{h:205, s:80, l:60}, miniScale: 0.55};if(tgtEl) doBasicParticleEffect(attackerForFx, el, tgtEl);const dmg = Math.max(1, Math.round((mini.atk + rndInt(-2,2)) * (B.atkBuff||1)));const shield0 = shieldOf(target);const actual = dealDamage(target, dmg);if(tgtEl){FX.flash(tgtEl, false);FX.float(tgtEl, actual === 0 ? '护盾' : '-' + actual, { cls:'small' });}log(damageLogText(target, shield0, actual, `💧 ${mini.ref.name} 攻击 ${target.ref.name}`));refreshBars();refreshIntentPanel();if(target.hp <= 0) handleUnitDeath(target, enemiesSide);}
  function refreshMiniBars(){[B.allies, B.monsters].forEach(team=>{team.forEach(u=>{(u.minis||[]).slice().forEach(m=>{if(m.hpBarEl && m.hpBarEl.isConnected){m.hpBarEl.style.width = Math.max(0, m.hp / m.maxHp * 100) + '%';}if(m.hp <= 0) removeMini(m);});});});}
  function applyAttackerElement(attackerUnit, targetUnit){const el = attackerUnit.ref.element;switch(el){case '火': if(applyStatus(targetUnit, 'burn', 1)) setTimeout(()=>log(`🔥 ${targetUnit.ref.name} 被点燃！`), 120); break;case '草': if(applyStatus(targetUnit, 'poison', 1)) setTimeout(()=>log(`☠ ${targetUnit.ref.name} 中毒！`), 120); break;case '雷': if(Math.random() < 0.35 && applyStatus(targetUnit, 'paralysis', 1)) setTimeout(()=>log(`⚡ ${targetUnit.ref.name} 被麻痹！`), 120); break;case '幻': if(Math.random() < 0.45 && applyStatus(targetUnit, 'charm', 1)) setTimeout(()=>log(`💗 ${targetUnit.ref.name} 被魅惑！`), 120); break;case '暗': if(applyStatus(targetUnit, 'weakness', 1)) setTimeout(()=>log(`⬇ ${targetUnit.ref.name} 被侵蚀削弱！`), 120); break;}}
  function turnControl(unitWrapper, side){const ref = unitWrapper.ref;const st = unitWrapper.st;const unitEl = getUnitEl(unitWrapper, side);if(!unitEl) return false;if(st.frozen > 0){log(`${ref.name} 被冻结，无法行动`);st.frozen = 0;st.freezeVisual = true;refreshBars();later(()=>{ st.freezeVisual = false; refreshBars(); }, Math.round(1400 / battleSpeed));return true;}if(st.paralysis > 0){ st.paralysis--; log(`${ref.name} 被麻痹，无法行动`); refreshBars(); return true; }const burn = st.burn, poison = st.poison;if(burn > 0 || poison > 0){let dot = 0;if(burn > 0) dot += Math.round(unitWrapper.maxHp * 0.03 * burn);if(poison > 0) dot += Math.round(unitWrapper.maxHp * 0.03 * poison);const actual = dealDamage(unitWrapper, dot);FX.float(unitEl, '-' + actual, { cls:'dot', icon: burn > 0 ? '🔥' : '☠' });log(`${ref.name} 受到 ${actual} 点持续伤害${burn?'（烧伤）':''}${poison?'（毒素）':''}`);refreshBars();if(unitWrapper.hp <= 0){ handleUnitDeath(unitWrapper, side); return true; }}if(st.charm > 0){st.charm--;const friends = side==='ally' ? B.allies : B.monsters;const alive = friends.filter(f=>f.hp>0 && f!==unitWrapper);if(alive.length){const target = pick(alive);const tgtEl = getUnitEl(target, side);if(tgtEl) doBasicParticleEffect(ref, unitEl, tgtEl);const dmg = Math.max(1, Math.round((unitWrapper.isMini ? unitWrapper.atk : physAtk(ref)) * (B.atkBuff||1)));const actual = dealDamage(target, dmg);FX.flash(tgtEl, false);FX.float(tgtEl, '-' + actual, {});log(`💗 ${ref.name} 被魅惑，攻击友方 ${target.ref.name}，造成 ${actual} 伤害`);refreshBars();if(target.hp <= 0) handleUnitDeath(target, side);} else {log(`💗 ${ref.name} 被魅惑，但无事发生`);}return true;}return false;}
  function chooseIntentTarget(unit, side, healing){const targetSide = healing ? side : (side==='enemy'?'ally':'enemy');const mains = getAllAliveMain(targetSide);const all = getAllAliveUnits(targetSide);let pool = all.filter(t=>healing || !isUntargetable(t,mains));if(!pool.length) pool = all;if(!pool.length) return null;if(healing) return pool.reduce((a,b)=>b.hp/b.maxHp<a.hp/a.maxHp?b:a);let bestScore=-Infinity, best=[];pool.forEach(t=>{const mult = ((ELEMENT_CHART[unit.ref.element]||{})[t.ref.element]||1) * (unit.ref.element==='光'&&t.ref.isMonster?2:1);const score = mult>1?2:mult===1?1:0;if(score>bestScore){bestScore=score;best=[t];} else if(score===bestScore) best.push(t);});return B.training ? best[0] : pick(best);}
  function queueOneEnemy(unit){if(unit.hp<=0) return null;let kind='attack', name='攻击', mult=1, power=0;if(unit.isMini){name='水弹';}else if(B.training){if(B.challengeId==='shield'){power=B.turn<=1?320:60;kind=B.turn<=1?'heavy':'attack';}else if(B.challengeId==='control'){kind=(B.turn-1)%3===0?'heavy':'attack';power=kind==='heavy'?400:60;}else power=35;name=kind==='heavy'?'重击':'攻击';} else if(unit.ref.skill==='治疗') {kind='heal';name=unit.ref.element==='光'?'治疗并净化':'治疗';}else if(unit.hp/unit.maxHp<0.4 && B.turn%3===2){kind='guard';name='防御 · 25%护盾';}else if(B.turn%3===0){kind='heavy';name='蓄力重击';mult=1.65;}const target=kind==='guard'?unit:chooseIntentTarget(unit,'enemy',kind==='heal');unit.intent={kind,name,mult,power,round:B.turn,state:'pending',targetId:target?target.ref.id:null,targetName:target?target.ref.name:'无目标'};return unit.intent;}
  function queueEnemyIntents(){getAllAliveUnits('enemy').forEach(queueOneEnemy);refreshIntentPanel();refreshBars();}
  function refreshIntentPanel(){let hint = overlay.querySelector('.training-hint');if(!B.running || !challenge){ if(hint) hint.remove(); return; }if(!hint){hint = document.createElement('div');hint.className = 'training-hint';hint.setAttribute('aria-live', 'polite');fieldEl.appendChild(hint);}hint.textContent = `${challenge.hint} · ${B.practiceUsed[B.challengeId] ? '机制已达成，请赢下本场' : '等待完成本课机制'}`;}
  function resolveIntentTarget(unit, side, healing){const q=unit.intent;if(!q) return chooseIntentTarget(unit,side,healing);const targetSide=healing?side:(side==='enemy'?'ally':'enemy');const mains=getAllAliveMain(targetSide);const all=getAllAliveUnits(targetSide);let target=all.find(t=>String(t.ref.id)===String(q.targetId));if(target && (healing || !isUntargetable(target,mains))) return target;target=chooseIntentTarget(unit,side,healing);q.targetId=target?target.ref.id:null;q.targetName=target?target.ref.name:'无目标';log(`${unit.ref.name} 的预告目标已失效，${target?'重新锁定 '+target.ref.name:'取消行动'}`);refreshIntentPanel();return target;}
  function resolveTrainingAttack(unit, target){const q=unit.intent;if(!target) return;const shield0=shieldOf(target);const actual=dealDamage(target,q.power);if(B.challengeId==='shield' && q.kind==='heavy' && shield0>shieldOf(target)) B.practiceUsed.shield=true;const targetEl=getUnitEl(target,'ally');const attackerEl=getUnitEl(unit,'enemy');if(targetEl && attackerEl){const isHeavy = q.kind==='heavy';if(isHeavy) doElementBallEffect(unit.ref, attackerEl, targetEl, true, 1);else doBasicParticleEffect(unit.ref, attackerEl, targetEl);}FX.flash(targetEl,q.kind==='heavy');if(q.kind==='heavy') FX.shake('crit');FX.float(targetEl,actual?'-'+actual:'护盾',{cls:q.kind==='heavy'?'crit':''});log(damageLogText(target,shield0,actual,`${unit.ref.name} 执行预告${q.name}，命中 ${target.ref.name}`,''));if(target.hp<=0) handleUnitDeath(target,'ally');refreshBars();refreshIntentPanel();}
  function performAction(unitWrapper, side){if(!canWrite())return;
    const ref = unitWrapper.ref;
    const st = unitWrapper.st;
    if(unitWrapper.hp <= 0) return;
    if(unitWrapper.acted) return;
    const unitEl = getUnitEl(unitWrapper, side);
    if(!unitEl) return;
    const queued = side==='enemy' ? (unitWrapper.intent && unitWrapper.intent.round===B.turn ? unitWrapper.intent : queueOneEnemy(unitWrapper)) : null;
    const wasControlled = st.frozen>0 || st.paralysis>0 || st.charm>0;
    if(turnControl(unitWrapper, side)){unitWrapper.acted = true;if(queued){queued.state='canceled';if(B.training && B.challengeId==='control' && wasControlled && queued.kind==='heavy') B.practiceUsed.control=true;}refreshBars(); refreshIntentPanel();return;}
    unitWrapper.acted = true;
    if(queued){queued.state='done';if(queued.kind==='guard'){st.rockArmor=(st.rockArmor||0)+Math.round(unitWrapper.maxHp*0.25);log(`${ref.name} 执行防御，获得 25% 最大生命护盾`);refreshBars(); refreshIntentPanel(); return;}if(B.training){ resolveTrainingAttack(unitWrapper,resolveIntentTarget(unitWrapper,side,false)); return; }refreshIntentPanel();}
    const wrap = unitEl.querySelector('.slime-wrap');
    if(wrap){ wrap.classList.add('attack-jump'); setTimeout(()=>wrap.classList.remove('attack-jump'), 700); }
    if(ref.skill === '治疗'){const mains = getAllAliveMain(side);const allMainsFull = mains.every(u=>u.hp >= u.maxHp);const candidates = [];mains.forEach(u=>{candidates.push(u);if(allMainsFull){(u.minis||[]).forEach(m=>{ if(m.hp>0) candidates.push(m); });}});if(!candidates.length) return;let target = queued ? resolveIntentTarget(unitWrapper,side,true) : candidates[0];if(!target) return;if(!queued){let lowest = target.hp/target.maxHp;for(const a of candidates){ const r = a.hp/a.maxHp; if(r < lowest){ lowest = r; target = a; } }}const tgtEl = getUnitEl(target, target.isMini ? target.side : side);if(tgtEl) doHealEffect(ref, unitEl, tgtEl);const heal = Math.max(1, Math.round(magAtk(ref)*0.8 + ref.level*5));target.hp = Math.min(target.maxHp, target.hp + heal);FX.float(tgtEl, '+' + heal, { cls:'good' });if(ref.element === '光'){target.st.burn = target.st.poison = target.st.frostbite = 0;target.st.frozen = target.st.paralysis = target.st.charm = target.st.weakness = 0;log(`${ref.name} 治疗 ${target.ref.name}，恢复 ${heal} 血量（净化负面状态）`);} else {log(`${ref.name} 治疗 ${target.ref.name}，恢复 ${heal} 血量`);}refreshBars();return;}
    const enemiesSide = side==='ally' ? 'enemy' : 'ally';
    const enemiesMain = getAllAliveMain(enemiesSide);
    const allEnemies = getAllAliveUnits(enemiesSide);
    if(!allEnemies.length) return;
    const candidates = allEnemies.filter(e=>!isUntargetable(e, enemiesMain));
    const pool = candidates.length ? candidates : allEnemies;
    let bestScore = -Infinity;
    let best = [];
    pool.forEach(e=>{let mult = 1;if(ELEMENT_CHART[ref.element] && ELEMENT_CHART[ref.element][e.ref.element]) { mult = ELEMENT_CHART[ref.element][e.ref.element]; }if(ref.element === '光' && e.ref.isMonster) mult *= 2;const score = mult > 1 ? 2 : (mult === 1 ? 1 : 0);if(score > bestScore){ bestScore = score; best = [e]; }else if(score === bestScore) best.push(e);});
    const target = queued ? resolveIntentTarget(unitWrapper,side,false) : pick(best.length ? best : pool);
    if(!target) return;
    const tgtEl = getUnitEl(target, target.isMini ? target.side : enemiesSide);
    if(tgtEl){const isHeavy = !!(queued && queued.kind === 'heavy');if(isHeavy) doElementBallEffect(ref, unitEl, tgtEl, true, 1);else doBasicParticleEffect(ref, unitEl, tgtEl);}
    const dodge = B.training || target.isMini ? 0 : dodgeRate(target.ref);
    if(Math.random()*100 < dodge){FX.float(tgtEl, 'MISS', { cls:'miss' });log(`${target.ref.name} 闪避了 ${ref.name} 的攻击`);return;}
    let baseDmg = physAtk(ref) + (B.training ? 0 : rndInt(-3,3));
    baseDmg = Math.round(baseDmg * (B.atkBuff||1));
    if(st.weakness > 0) baseDmg = Math.round(baseDmg * (1 - st.weakness*0.05));
    let elemMult = 1;
    if (ELEMENT_CHART[ref.element] && ELEMENT_CHART[ref.element][target.ref.element]) { elemMult = ELEMENT_CHART[ref.element][target.ref.element]; }
    let dmg = Math.round(baseDmg * elemMult * (queued ? queued.mult : 1));
    if(ref.element === '光' && target.ref.isMonster) dmg *= 2;
    const critBonus = target.st.frostbite * 5;
    const crit = !B.training && Math.random() < (critRate(ref)+critBonus)/100;
    if(crit) dmg = Math.round(dmg * 1.8);
    dmg = Math.max(1, dmg);
    let elemMsg = '';
    if(elemMult > 1) elemMsg = '（克制！）';
    else if(elemMult < 1) elemMsg = '（微弱）';
    if(!B.training) applyAttackerElement(unitWrapper, target);
    if(target.ref.element === '冰' && target.st.iceArmor > 0){ if(applyStatus(unitWrapper, 'frostbite', 1)) setTimeout(()=>log(`❄ ${ref.name} 被冰甲冻伤！`), 120); }
    const shield0 = shieldOf(target);
    const actual = dealDamage(target, dmg);
    if(tgtEl){
      FX.flash(tgtEl, crit);
      if(crit) FX.shake('crit');
      if(actual === 0){ FX.float(tgtEl, '护盾', { cls:'small' }); }
      else { const tag = elemMult > 1.2 ? ' 克制' : ''; FX.float(tgtEl, '-' + actual + (crit ? '!' : '') + tag, { cls: crit ? 'crit' : (elemMult < 0.85 ? 'weak' : (elemMult > 1.2 ? 'strong' : '')) }); }
    }
    log(damageLogText(target, shield0, actual, `${ref.name} ${queued?queued.name:'攻击'} ${target.ref.name}`, `${crit?'（暴击！）':''}${elemMsg}`));
    refreshBars();
    if(ref.element === '雷' && target.ref.element === '水' && actual > 0){const splash = Math.max(1, Math.round(actual * 0.2));const waters = [];[B.allies, B.monsters].forEach(team=>{const s = team === B.allies ? 'ally' : 'enemy';team.forEach(u=>{if(u.hp > 0 && u.ref.element === '水') waters.push({u, side:s});(u.minis||[]).forEach(m=>{ if(m.hp > 0 && m.ref.element === '水') waters.push({u:m, side:s}); });});});let hitCount = 0;waters.forEach(w=>{if(w.u === target) return;dealDamage(w.u, splash);FX.float(getUnitEl(w.u, w.side), '-' + splash, { cls:'small' });hitCount++;if(w.u.hp <= 0) handleUnitDeath(w.u, w.side);});if(hitCount){log(`⚡ 电流顺着水流扩散，其他水史莱姆受到 ${splash} 点溅射伤害`);refreshBars();}}
    if(ref.element === '草' && actual > 0){const heal = Math.round(actual * 0.5);unitWrapper.hp = Math.min(unitWrapper.maxHp, unitWrapper.hp + heal);FX.float(unitEl, '+' + heal, { cls:'good small' });if(tgtEl){const cc = slimeColor(ref);const colGrass = `hsl(${cc.h} ${Math.max(cc.s,40).toFixed(1)}% ${Math.max(cc.l,55).toFixed(1)}%)`;const delay = Math.round(520 / battleSpeed);later(()=>{ doDrainEffect(tgtEl, unitEl, colGrass); }, delay);}}
    if(!target.isMini && target.ref.element === '水' && target.hp > 0){const targetSide = side==='ally'?'enemy':'ally';const mini = spawnMiniSlime(target, targetSide);if(mini) miniSlimeAttack(mini);}
    if(target.hp <= 0) handleUnitDeath(target, enemiesSide);
  }
  function updateUnitLabel(el, b){
    const uname=el.querySelector('.uname');if(!uname)return;
    if(el._uname !== b.ref.name){ uname.textContent=b.ref.name; uname.title=`${b.ref.name} · Lv.${b.ref.level}`; el._uname = b.ref.name; }
    el.dataset.fallen=b.hp<=0?'1':'0';
    let hp=el.querySelector('.hp-value');if(!hp){hp=document.createElement('div');hp.className='hp-value';el.appendChild(hp);}
    const hpText=`${Math.max(0,Math.ceil(b.hp))}/${b.maxHp}`;
    if(el._hpText !== hpText){ hp.textContent=hpText; hp.title=`生命 ${hpText}`; el._hpText=hpText; }
    let statuses=el.querySelector('.battle-statuses');if(!statuses){statuses=document.createElement('div');statuses.className='battle-statuses';el.appendChild(statuses);}
    const defs=[['burn','flame','烧伤'],['poison','leaf','中毒'],['frostbite','snow','冻伤'],['frozen','snow','冻结'],['paralysis','bolt','麻痹'],['charm','heart','魅惑'],['weakness','down','削弱'],['intangible','eye','虚化'],['rockArmor','shield','岩甲'],['iceArmor','shield','冰甲']];
    const statusHTML = defs.filter(d=>(b.st[d[0]]||0)>0&&b.hp>0).map(d=>`<span class="status-chip ${['intangible','rockArmor','iceArmor'].includes(d[0])?'positive':'negative'}" title="${d[2]} ${b.st[d[0]]}" aria-label="${d[2]} ${b.st[d[0]]}">${uiIcon(d[1])}<b>${Math.ceil(b.st[d[0]])}</b></span>`).join('');
    if(el._statusHTML !== statusHTML){ statuses.innerHTML=statusHTML; el._statusHTML=statusHTML; }
    if(el.dataset.side==='enemy'){
      let intent=el.querySelector('.intent-label');if(!intent){intent=document.createElement('div');intent.className='intent-label';el.appendChild(intent);}
      const it = b.hp>0?enemyIntentText(b):'';
      if(el._intentText !== it){ intent.textContent=it; intent.title=it; el._intentText=it; }
    }
  }
  function updateShieldBar(el, b){let sb = el.querySelector('.shieldbar');if(!sb){sb = document.createElement('div');sb.className = 'shieldbar';sb.innerHTML = '<i></i><i class="ghost"></i>';const w = el.querySelector('.slime-wrap');if(w) w.appendChild(sb);}const shieldVal = b.hp > 0 ? ((b.st.rockArmor||0) + (b.st.iceArmor||0)) : 0;sb.classList.toggle('show', shieldVal > 0);if(shieldVal > 0){const shieldMax = Math.max(1, Math.round(b.maxHp * 0.5));const pct = Math.min(100, shieldVal / shieldMax * 100) + '%';sb.querySelector('i').style.width = pct;const g = sb.querySelector('i.ghost');if(g) g.style.width = pct;}}
  function syncHpBar(el, b){const hb = el.querySelector('.hpbar');if(!hb) return;const pct = Math.max(0, b.hp / b.maxHp * 100) + '%';if(el._hpPct === pct) return;el._hpPct = pct;const main = hb.querySelector('i:not(.ghost)');if(main) main.style.width = pct;const g = hb.querySelector('i.ghost');if(g) g.style.width = pct;hb.classList.toggle('low', b.hp > 0 && b.hp / b.maxHp < 0.3);}
  function refreshBars(){
    overlay.querySelectorAll('[data-side="enemy"]').forEach(el=>{const id = +el.dataset.monId;const b = B.monsters.find(x=>x.ref.id === id);if(!b) return;syncHpBar(el, b);const sl = el.querySelector('.slime');if(sl){sl.dataset.dead = b.hp <= 0 ? '1' : '0';if(b.hp <= 0) sl.dataset.mood = 'uncomfortable';else if(b.st.charm > 0) sl.dataset.mood = 'charm';else if(b.st.paralysis > 0) sl.dataset.mood = 'fear';else sl.dataset.mood = 'idle';}updateUnitLabel(el, b);updateShieldBar(el, b);const wrap = el.querySelector('.slime-wrap');if(wrap) {let rockSh = wrap.querySelector('.shield-orb.rock');let iceSh = wrap.querySelector('.shield-orb.ice');if(b.st.rockArmor > 0) {if(!rockSh) { rockSh = document.createElement('div'); rockSh.className = 'shield-orb rock'; wrap.appendChild(rockSh); }if(iceSh) iceSh.remove();} else if(b.st.iceArmor > 0) {if(!iceSh) { iceSh = document.createElement('div'); iceSh.className = 'shield-orb ice'; wrap.appendChild(iceSh); }if(rockSh) rockSh.remove();} else {if(rockSh) rockSh.remove();if(iceSh) iceSh.remove();}let frz = wrap.querySelector('.frozen-orb');if(b.st.frozen > 0 || b.st.freezeVisual){if(!frz){ frz = document.createElement('div'); frz.className='frozen-orb'; wrap.appendChild(frz); }} else {if(frz) frz.remove();}}if(!B.training && b.hp <= 0 && !el.querySelector('.capture-btn')){const btn = document.createElement('button');btn.className = 'capture-btn';btn.textContent = `捕捉 (${S.bag.net||0})`;btn.addEventListener('click', ()=>captureMonster(b.ref, btn));if(wrap) wrap.appendChild(btn);}if(b.hp > 0){const cb = el.querySelector('.capture-btn');if(cb) cb.remove();}});
    overlay.querySelectorAll('[data-side="ally"]').forEach(el=>{const id = +el.dataset.allyId;const b = B.allies.find(x=>x.ref.id === id);if(!b) return;syncHpBar(el, b);const sl = el.querySelector('.slime');if(sl){sl.dataset.dead = b.hp <= 0 ? '1' : '0';if(b.hp <= 0) sl.dataset.mood = 'uncomfortable';else if(b.st.charm > 0) sl.dataset.mood = 'charm';else if(b.st.paralysis > 0) sl.dataset.mood = 'fear';else sl.dataset.mood = 'idle';}updateUnitLabel(el, b);updateShieldBar(el, b);const wrap = el.querySelector('.slime-wrap');if(wrap) {let rockSh = wrap.querySelector('.shield-orb.rock');let iceSh = wrap.querySelector('.shield-orb.ice');if(b.st.rockArmor > 0) {if(!rockSh) { rockSh = document.createElement('div'); rockSh.className = 'shield-orb rock'; wrap.appendChild(rockSh); }if(iceSh) iceSh.remove();} else if(b.st.iceArmor > 0) {if(!iceSh) { iceSh = document.createElement('div'); iceSh.className = 'shield-orb ice'; wrap.appendChild(iceSh); }if(rockSh) rockSh.remove();} else {if(rockSh) rockSh.remove();if(iceSh) iceSh.remove();}let frz = wrap.querySelector('.frozen-orb');if(b.st.frozen > 0 || b.st.freezeVisual){if(!frz){ frz = document.createElement('div'); frz.className='frozen-orb'; wrap.appendChild(frz); }} else {if(frz) frz.remove();}}});
    refreshMiniBars();
    updateCounterBadges();
  }
  function captureMonster(mon, btn){if(!canWrite())return;if(B.training){ toast('借用训练不能捕捉，也不消耗捕捉网'); return; }if(!S.bag.net || S.bag.net <= 0){ toast('没有捕捉网了，请先去背包购买'); return; }S.bag.net--;mon.hp = hpMax(mon);mon.isMonster = true;mon.mood = 30;mon.stamina = staminaMax(mon);mon.level = mon.level || 1;S.monsters.push(mon);B.monsters = B.monsters.filter(x=>x.ref !== mon);const unit = btn.closest('.battle-unit');if(unit) unit.remove();save();toast(`🕸️ 成功捕捉 ${mon.name}！\n已放入魔物空间`, 'good');}
  function aliveAllies(){ return B.allies.filter(a=>a.hp > 0); }
  function aliveMonsters(){ return B.monsters.filter(m=>m.hp > 0); }
  function nextTurn(){if(!canWrite())return;
    if(!B.running || B.resolving) return;
    if(B.paused) return;
    B.turn++;
    B.resolving = true;
    B.allies.concat(B.monsters, getAllAliveUnits('ally').filter(u=>u.isMini), getAllAliveUnits('enemy').filter(u=>u.isMini)).forEach(u=>{u.acted = false;if(u.st && u.st.intangible > 0) u.st.intangible = 0;if(u.cd) Object.keys(u.cd).forEach(k=>{ u.cd[k] = Math.max(0, u.cd[k] - 1); });});
    lastSkillBarSig = '';
    renderSkillBar();
    if(B.turn > 35 && (B.turn - 35) % 10 === 0){B.atkBuff = (B.atkBuff || 1) * 1.2;log(`⚔️ 战斗进入白热化！所有史莱姆攻击属性提升20%`);}
    checkRevive('ally');
    checkRevive('enemy');
    if(!aliveAllies().length){ log('出战史莱姆全部倒下……'); endBattle(false); return; }
    if(!aliveMonsters().length){ log('怪物全部倒下！胜利！'); endBattle(true); return; }
    queueEnemyIntents();
    const stepDelay = Math.round(1400 / battleSpeed);
    const as = aliveAllies();
    const allyMinis = [];
    as.forEach(a=>{ (a.minis||[]).forEach(m=>{ if(m.hp>0) allyMinis.push(m); }); });
    const allyActors = as.concat(allyMinis);
    if(currentBattleMode() === 'manual'){runStepActors(allyActors, 0);return;}
    allyActors.forEach((u, idx)=>{later(()=>{if(!B.running) return;if(u.hp <= 0) return;if(u.isMini) performMiniAction(u, 'ally');else performAction(u, 'ally');}, idx * stepDelay);});
    later(()=>{ enemyPhase(); }, allyActors.length * stepDelay + 500);
  }
  function runStepActors(actors, idx){if(!B.running) return;if(idx >= actors.length){ later(()=>{ enemyPhase(); }, 300); return; }const u = actors[idx];if(u.hp <= 0){ runStepActors(actors, idx + 1); return; }if(u.isMini){ performMiniAction(u, 'ally'); runStepActors(actors, idx + 1); return; }waitForPlayer(u, 'ally', ()=> runStepActors(actors, idx + 1));}
  /* 30 秒思考时间：不显示倒计时文本 */
  function waitForPlayer(unit, side, done, timeoutMs){
    B.paused = true;
    skSel = unit;
    skPick = 'basic';
    markTargetable(true, 'enemy');
    log(`⏳ 轮到 ${unit.ref.name} 行动`);
    lastSkillBarSig = '';
    renderSkillBar();
    let finished = false;
    const finish = (isTimeout) => {
      if(finished) return;
      finished = true;
      B.paused = false;
      B._pauseResume = null;
      if(B.pauseTimer){ clearTimeout(B.pauseTimer); B.pauseTimer = null; }
      afterPlayerAction = null;
      skSel = null;
      skPick = null;
      markTargetable(false);
      lastSkillBarSig='';
      renderSkillBar();
      if(isTimeout){
        B.manualTimeoutStreak = (B.manualTimeoutStreak || 0) + 1;
        if(B.manualTimeoutStreak >= 2 && !B.training){
          S.battleMode = 'auto';
          save();
          log('⏱ 连续两次超时，已切换为自动模式');
          updateCtrlUI();
        }
      } else {
        B.manualTimeoutStreak = 0;
      }
      done();
    };
    B._pauseResume = () => {
      if(unit.hp > 0 && !unit.acted){
        const t = pick(getAllAliveUnits('enemy'));
        if(t) playerBasic(unit, t);
      }
      finish(true);
    };
    B.pauseTimer = later(()=>{
      if(!B.running) return;
      if(unit.hp > 0 && !unit.acted){
        log(`⏱ ${unit.ref.name} 超时未操作，自动普攻`);
        const t = pick(getAllAliveUnits('enemy'));
        if(t) playerBasic(unit, t);
      }
      finish(true);
    }, timeoutMs || 30000);
    afterPlayerAction = () => finish(false);
  }
  function enemyPhase(){
    if(!B.running) return;
    const stepDelay = Math.round(1400 / battleSpeed);
    checkRevive('enemy');
    if(!aliveMonsters().length){ log('怪物全部倒下！胜利！'); endBattle(true); return; }
    checkRevive('ally');
    if(!aliveAllies().length){ log('出战史莱姆全部倒下……'); endBattle(false); return; }
    const ms2 = aliveMonsters();
    const enemyMinis = [];
    ms2.forEach(m=>{ (m.minis||[]).forEach(x=>{ if(x.hp>0) enemyMinis.push(x); }); });
    const enemyActors = ms2.concat(enemyMinis);
    enemyActors.forEach((m, idx)=>{later(()=>{if(!B.running) return;if(m.hp <= 0) return;if(m.isMini) performMiniAction(m, 'enemy');else performAction(m, 'enemy');}, idx * stepDelay);});
    /* 敌方攻击完毕后到下一轮的等待时间减半：300 → 150 */
    later(()=>{if(!B.running) return;checkRevive('ally');checkRevive('enemy');if(!aliveAllies().length){ log('出战史莱姆全部倒下……'); endBattle(false); return; }if(!aliveMonsters().length){ log('怪物全部倒下！胜利！'); endBattle(true); return; }B.resolving = false;refreshIntentPanel();}, enemyActors.length * stepDelay + 150);
  }
  function endBattle(win){if(!canWrite())return;
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
    const progressLine=recordBattleProgress(B,win);
    if(!B.training){
      S.coins += coinGain;
      S.totalEarned += coinGain;
      if(totalExp>0) rewards.recipients.forEach(a=>{addExp(a.ref, Math.floor(totalExp/Math.max(1,rewards.recipients.length)));a.ref.mood=clamp(a.ref.mood+(win?10:3),0,100);});
      if(win) S.abyssUnlocked=Math.max(getAbyssUnlocked(),Math.min(50,(B.mLevel||1)+1));
    }
    B.allies.forEach(a=>{a.hp=hpMax(a.ref);if(!B.training) a.ref.hp=a.hp;a.st.burn=a.st.poison=a.st.frostbite=a.st.frozen=a.st.freezeVisual=a.st.paralysis=a.st.charm=a.st.weakness=0;});
    save(); renderTop(); renderTab();
    refreshBars();
    overlay.querySelectorAll('.battle-unit').forEach(el=>{const hpEl = el.querySelector('.hpbar');if(hpEl) hpEl.style.display = 'none';const sbEl = el.querySelector('.shieldbar');if(sbEl) sbEl.style.display = 'none';el.querySelectorAll('.shield-orb, .frozen-orb').forEach(x=>x.remove());el.querySelectorAll('.counter-badge').forEach(x=>x.remove());});
    skSel = null;
    skPick = null;
    markTargetable(false);
    const staleBar = overlay.querySelector('#skillBar');
    if(staleBar){ staleBar.classList.add('hide'); staleBar.innerHTML = ''; }
    lastSkillBarSig = '';
    const loserLook = (el, mood) => {if(!el) return;const sl = el.querySelector('.slime');if(!sl) return;sl.classList.remove('dying');sl.dataset.dead = '0';sl.dataset.mood = mood;};
    if(win){const emojis = ['🌸','🌼','💮'];B.allies.forEach(b=>{const el = overlay.querySelector(`[data-ally-id="${b.ref.id}"]`);if(!el) return;loserLook(el, 'jump');const wrap = el.querySelector('.slime-wrap');if(wrap){for(let i=0;i<5;i++){const f = document.createElement('span');f.textContent = pick(emojis);f.style.position = 'absolute';f.style.left = rnd(5, 95) + '%';f.style.top = rnd(-150, -90) + '%';f.style.fontSize = rnd(7, 16) + 'px';f.style.zIndex = 40;f.style.pointerEvents = 'none';f.style.opacity = '0';f.style.animation = `flowerFall ${rnd(1.6, 2.8)}s ease-in forwards`;f.style.animationDelay = rnd(0, 1.2) + 's';wrap.appendChild(f);setTimeout(()=>f.remove(), 4500);}}});B.monsters.forEach(b=>loserLook(overlay.querySelector(`[data-mon-id="${b.ref.id}"]`), 'fear'));} else {B.allies.forEach(b=>loserLook(overlay.querySelector(`[data-ally-id="${b.ref.id}"]`), 'fear'));B.monsters.forEach(b=>loserLook(overlay.querySelector(`[data-mon-id="${b.ref.id}"]`), 'jump'));}
    const head = win ? '🎉 战斗胜利！' : '⚔️ 战斗结束……';
    const rewardLine = B.training ? '教学练习不消耗伙伴，也不产生普通战利品。' : `击败 ${rewards.defeatedCount}/${(B.rewardMonsters||B.monsters).length} · ${win?'全额奖励':'已击败敌人 25% 奖励'}：${coinGain} 晶币 / ${totalExp} 总经验。伙伴已恢复。`;
    const catchLine = win && !B.training ? '<br>点击倒下的怪物可捕捉' : '';
    log(head + '<br>' + rewardLine + (progressLine ? '<br>'+progressLine : '') + catchLine);
    const cb = overlay.querySelector('#bClose');
    if(cb) cb.textContent = '关 闭';
    autoCloseTimer = setTimeout(closeBattle, win ? 4800 : 3000);
  }
  overlay.querySelector('#bClose').addEventListener('click', ()=>{if(B.ended) closeBattle();else endBattle(false);});
  refreshBars();
  restartTimer();
  later(()=>{if(B.running && B.turn === 0) nextTurn();}, 800);
}

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
    setTimeout(()=>{ if(inner && inner.isConnected) inner.dataset.mood = 'idle'; }, 2600);
  }
  if(delta !== 0) showFloat(slimeEl, `心情${delta>=0?'+':''}${delta}`);
  if(cfg.text) toast(`「${cfg.label}」\n${cfg.text}`);
  save();
}
function openMonItemEditor(idx){
  const cfg = S.monItemConfigs[idx];
  if(!cfg) return;
  openModal(`<button class="close" data-act="close">✕</button><h3 style="text-align:center;margin:0 0 12px;color:var(--accent2);">编辑道具 · 第 ${idx+1} 个</h3><div><label class="edit-label">按钮文本</label><input id="miLabel" class="story-input" maxlength="6" value="${esc(cfg.label)}" style="margin-top:4px;"><label class="edit-label">史莱姆反应表情</label><select id="miFace" class="story-input" style="margin-top:4px;">${MON_MOODS.map(m=>`<option value="${m.v}" ${cfg.face===m.v?'selected':''}>${m.n}</option>`).join('')}</select><label class="edit-label">心情变化（-50 ~ 50）</label><input id="miMood" class="story-input" type="number" min="-50" max="50" value="${Number(cfg.mood)||0}" style="margin-top:4px;"><label class="edit-label">弹窗文字</label><input id="miText" class="story-input" maxlength="20" value="${esc(cfg.text||'')}" placeholder="例如：舒服地蹭了蹭" style="margin-top:4px;"></div><button class="btn gold full" data-act="monItemSave" data-idx="${idx}" style="margin-top:14px;">保 存</button>`);
}

document.addEventListener('click', e=>{
  if(LivingWorld.handleClick(e))return;
  const mtip = e.target.closest('[data-merge-tip]');
  if(mtip){ e.stopPropagation(); e.preventDefault(); showMergeTip(mtip); return; }
  const tipEl = e.target.closest('[data-tip]');
  if(tipEl && !tipEl.closest('[data-act]')){
    e.stopPropagation();
    e.preventDefault();
    toast(tipEl.dataset.tip);
    return;
  }
  const t = e.target.closest('[data-act]');
  if(!t) return;
  if(t.dataset.long !== undefined){ if(monItemLongPressed){ monItemLongPressed = false; return; } }
  const act = t.dataset.act, ds = t.dataset;
  if(!canWrite()&&!['reloadSave','retrySave','tab','goto','close','settings','detail','resetSave'].includes(act)){toast('请先处理存档保护提示');return;}
  switch(act){
    case 'reloadSave': location.reload();return;
    case 'retrySave': if(save())lastWorldTick=Date.now();return;
    case 'tab': switchTab(ds.tab); break;
    case 'goto': switchTab(ds.tab); break;
    case 'summon': doSummon(); break;
    case 'breakthrough': doBreakthrough(); break;
    case 'detail': e.stopPropagation(); openDetail(+ds.id); break;
    case 'buy': buyItem(ds.item, 1); break;
    case 'buy10': buyItem(ds.item, 10); break;
    case 'close': e.stopPropagation(); closeTopModal(); break;
    case 'chipInfo': {
      e.stopPropagation();
      if(!modalBackup) modalBackup = $('#modalBox').innerHTML;
      $('#modalBox').innerHTML = `<button class="close" data-act="close" title="关闭">✕</button><h3 style="text-align:center;margin:0 0 10px;color:var(--accent2);">${esc(ds.title)}</h3><p class="muted" style="line-height:1.9;font-size:13px;">${esc(ds.desc)}</p><button class="btn full themed" data-act="close" style="margin-top:8px;">知道了</button>`;
      refreshUIIcons($('#modalBox'));
      break;
    }
    case 'toggleCollapse': {
      const targetId = ds.target;
      const body = document.getElementById(targetId);
      const arrow = document.getElementById('arrow_' + targetId);
      if(body && arrow){
        body.classList.toggle('hidden');
        arrow.classList.toggle('open');
      }
      break;
    }
    case 'rename': renameSlime(+ds.id); break;
    case 'toggleStar': e.stopPropagation(); toggleStar(+ds.id); break;
    case 'settings': openSettings(); break;
    case 'theme': S.theme = ds.theme; applyTheme(); save(); openSettings(); break;
    case 'notchMinus': {
      S.notchHeight = Math.max(0, Math.round(((Number(S.notchHeight)||0) - 0.1)*10)/10);
      applyNotch(); save();
      const v = document.querySelector('.notch-val'); if(v) v.textContent = S.notchHeight.toFixed(1) + ' cm';
      break;
    }
    case 'notchPlus': {
      S.notchHeight = Math.min(1.5, Math.round(((Number(S.notchHeight)||0) + 0.1)*10)/10);
      applyNotch(); save();
      const v = document.querySelector('.notch-val'); if(v) v.textContent = S.notchHeight.toFixed(1) + ' cm';
      break;
    }
    case 'globalplan': {
      if(ds.type === 'clear'){ S.globalPlan = null; toast('全部召回，已停止探险'); }
      else { S.globalPlan = ds.type; toast('自动探险：派遣史莱姆出发探险', 'good'); }
      save(); renderTab(); break;
    }
    case 'claimExplore': {
      ensureExplorePending();
      const p = S.explorePending;
      const coinAmt = p.coins || 0;
      const expAmt = p.exp || 0;
      const foodAmt = p.food || 0;
      const pointAmt = p.point || 0;
      const treasureAmt = p.treasure || 0;
      if(coinAmt <= 0 && expAmt <= 0 && foodAmt <= 0 && pointAmt <= 0 && treasureAmt <= 0) break;
      S.coins += coinAmt;
      S.totalEarned += coinAmt;
      if(foodAmt > 0) S.bag.food = (S.bag.food||0) + foodAmt;
      if(pointAmt > 0) S.points += pointAmt;
      if(treasureAmt > 0) S.bag.treasure = (S.bag.treasure||0) + treasureAmt;
      if(expAmt > 0){
        const dispatched = S.slimes.filter(isDispatched);
        if(dispatched.length > 0){
          const each = Math.floor(expAmt / dispatched.length);
          let remainder = expAmt - each * dispatched.length;
          dispatched.forEach((s, i)=>{
            const gain = each + (i === 0 ? remainder : 0);
            if(gain > 0) addExp(s, gain);
          });
        }
      }
      S.explorePending = {coins:0,exp:0,food:0,point:0,treasure:0,weight:0};
      save(); renderTop(); renderTab();
      toast(`领取：${coinAmt} 晶币 / ${expAmt} 经验`, 'good');
      break;
    }
    case 'cycleMap': {
      S.exploreMapIndex = ((S.exploreMapIndex||0) + 1) % MAP_THEMES.length;
      save(); renderTab();
      toast(`地图已切换：${MAP_THEMES[S.exploreMapIndex].name}`, 'good');
      break;
    }
    case 'refill': refillTrough(); break;
    case 'toggleSpaceMode': S.spaceMode = (S.spaceMode === 'free') ? 'monster' : 'free'; selectedToy = null; save(); renderTab(); break;
    case 'selectToy': {
      const toy = ds.toy;
      if(toy === 'stack'){
        const idleCount = S.slimes.filter(s=>!isDispatched(s)&&!LivingWorld.isBusy(S,s.id)).length;
        if(idleCount < 1){ toast('空间中没有自由活动的史莱姆，无法进行游戏'); break; }
        startStackGame(); break;
      }
      selectedToy = (selectedToy === toy) ? null : toy;
      document.querySelectorAll('.toy-btn').forEach(b=>{ b.classList.toggle('on', b.dataset.toy === selectedToy); });
      const hint = document.querySelector('.toy-hint');
      if(hint){ if(selectedToy){ hint.style.display = 'block'; hint.textContent = `已选择「扔皮球」 · 点击空间中的史莱姆开始游戏`; } else { hint.style.display = 'none'; hint.textContent = ''; } }
      if(selectedToy){ toast(`已选择「扔皮球」\n点击空间中的史莱姆开始游戏`); }
      break;
    }
    case 'setupTeam': openTeamSetup(); break;
    case 'teamSel': { const id = +ds.id; if(teamSel.has(id)) teamSel.delete(id); else teamSel.add(id); renderTeamModal(); break; }
    case 'teamClearAll': S.exploreTeam = null; save(); renderTab(); closeModal(); toast('已恢复默认（派遣全部史莱姆）'); break;
    case 'teamSave':
      if(teamSel.size === 0){ S.exploreTeam = null; toast('未选择史莱姆，已恢复默认派遣全部'); }
      else { S.exploreTeam = Array.from(teamSel); toast('已设置队伍'); }
      save(); renderTab(); closeModal(); break;
    case 'resetSave': {
      if(!confirm('将删除无法读取的存档并从新进度开始，删除后无法恢复。确定继续？')) break;
      try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
      location.reload(); break;
    }
    case 'abyssSetup': openAbyssSetup(); break;
    case 'abyssSel': toggleAbyssSel(+ds.id); break;
    case 'abyssStart': { if(!abyssSetupSel.length) return; S.lastAbyssSel = [...abyssSetupSel]; save(); closeModal(); startAbyssBattle(); break; }
    case 'challengeStart': startTrainingChallenge(ds.id); break;
    case 'claimGoal': claimProgressGoal(ds.id); break;
    case 'abyssLevelMinus': { S.abyssLevel = clamp((S.abyssLevel||1) - 1, 1, getAbyssUnlocked()); const inp = document.getElementById('abyssLevelInput'); if(inp) inp.value = S.abyssLevel; save(); break; }
    case 'abyssLevelPlus': { S.abyssLevel = clamp((S.abyssLevel||1) + 1, 1, getAbyssUnlocked()); const inp = document.getElementById('abyssLevelInput'); if(inp) inp.value = S.abyssLevel; save(); break; }
    case 'boost': {
      const el = ds.element;
      if(S.bag.treasure <= 0){ toast('天材地宝不足，无法献祭'); break; }
      S.bag.treasure--;
      summonBoost[el] = (summonBoost[el]||0) + 12;
      save(); renderTab();
      toast(`献祭成功：${el}属性权重 +12\n本次召唤有效`, 'good');
      break;
    }
    case 'mergeopen': {
      if(S.slimes.length + S.monsters.length < 2){ toast('至少需要2只史莱姆才能合体'); break; }
      if(S.slimes.length < 1){ toast('至少需要一只非魔物史莱姆作为主宠'); break; }
      mergeSel = []; openMerge(); break;
    }
    case 'mergepick': openMergePicker(ds.role); break;
    case 'mergepickselect': {
      const role = ds.role;
      const id = +ds.id;
      if(role === 'main'){ mergeSel[0] = id; if(mergeSel[1] === id) mergeSel[1] = null; }
      else { mergeSel[1] = id; if(mergeSel[0] === id) mergeSel[0] = null; }
      openMerge(); break;
    }
    case 'mergepickcancel': openMerge(); break;
    case 'mergeconfirm': doMerge(); break;
    case 'monItem': { const first = plSlimes[0]; if(!first){ toast('魔物空间里没有史莱姆'); break; } useMonItem(+ds.idx, first.el); break; }
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
      save(); closeModal();
      if(activeTab === 'space') renderTab();
      toast('道具按钮已更新', 'good');
      break;
    }
  }
});

document.addEventListener('input', e=>{
  if(!canWrite())return;
  if(e.target && e.target.id === 'abyssLevelInput'){
    let v = Number(e.target.value);
    if(isNaN(v) || v < 1) v = 1;
    v=clamp(Math.floor(v),1,getAbyssUnlocked());
    e.target.value=v;
    S.abyssLevel = v;
    save();
  }
});

document.addEventListener('pointerdown', e=>{
  const t = e.target.closest('[data-long]');
  if(!t) return;
  monItemLongPressed = false;
  monItemLongTimer = setTimeout(()=>{ monItemLongPressed = true; openMonItemEditor(+t.dataset.long); }, 700);
});
document.addEventListener('pointerup', ()=>{ if(monItemLongTimer){ clearTimeout(monItemLongTimer); monItemLongTimer = null; } });
document.addEventListener('pointercancel', ()=>{ if(monItemLongTimer){ clearTimeout(monItemLongTimer); monItemLongTimer = null; } });
$('#modalLayer').addEventListener('click', e=>{ if(e.target.id === 'modalLayer') closeTopModal(); });
$('#storyScreen').addEventListener('click', e=>{ if(blocking) return; if(e.target.closest('input,button,label')) return; storyStep++; renderStory(); });

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
    if(el.closest('.explore-item')) return;
    const next = +el.dataset.nextToggle || 0;
    if(now < next) return;
    const isFront = el.dataset.row === 'front';
    let nextJumping;
    if(isFront){ nextJumping = Math.random() < 0.28; }
    else { nextJumping = !el.classList.contains('jumping'); }
    el.classList.toggle('jumping', nextJumping);
    el.classList.toggle('walking', !nextJumping);
    el.dataset.nextToggle = now + 700 + Math.random() * 900;
  });
}, 200);

function updateLive(){
  renderTop();
  for(const s of S.slimes){
    const rlabel=document.querySelector(`[data-rest-label="${s.id}"]`),rbar=document.querySelector(`[data-rest-bar="${s.id}"]`),rtext=document.querySelector(`[data-rest-text="${s.id}"]`);
    if(rlabel)rlabel.textContent=s.resting?'恢复中':'探索中';
    if(rbar)rbar.style.width=(s.resting?planRestProgress(s):Math.min(100,s.stamina/staminaMax(s)*100))+'%';
    if(rtext)rtext.textContent=s.resting?planRestText(s):`体力 ${Math.floor(s.stamina)}/${staminaMax(s)} · 每次探索消耗 20`;
  }
}

function planActionCost(){ return 20; }
function planResumeThreshold(s){ return Math.max(planActionCost(),Math.ceil(staminaMax(s)*0.5)); }
function hasExplorePlan(s){ const plan=getPlan(s.id); return !!(plan && plan.type==='explore' && (!plan.global || S.exploreTeam===null || S.exploreTeam.includes(s.id))); }
function planRestProgress(s){ return Math.round(100*Math.min(1,Math.max(0,s.stamina)/planResumeThreshold(s),Math.max(0,s.mood)/50)); }
function planRestText(s){ if(!s.resting) return hasExplorePlan(s) ? '探险中 · 每次消耗 20 体力' : '在家陪伴'; return `休息 ${planRestProgress(s)}% · 体力 ${Math.floor(s.stamina)}/${planResumeThreshold(s)} · 心情 ${Math.floor(s.mood)}/50 后续行`; }
function recoverPlanTick(s){let changed=false;if(hasExplorePlan(s) && !s.resting && (s.stamina<planActionCost() || s.mood<=0)){ s.resting=true; changed=true; }if(s.resting && s.stamina>=planResumeThreshold(s) && s.mood>=50){ s.resting=false; changed=true; }const dispatched=isDispatched(s);if(!dispatched){const stMax=staminaMax(s);const st=Math.min(stMax,s.stamina+0.4*(1+traitBonus(s,'stam')));if(Math.abs(st-s.stamina)>0.01){s.stamina=st;changed=true;}if(s.mood<100){s.mood=Math.min(100,s.mood+0.1);changed=true;}if(S.feedTrough>0 && s.stamina<stMax-5 && Math.random()<0.14){S.feedTrough--;s.stamina=clamp(s.stamina+30,0,stMax);s.mood=clamp(s.mood+3,0,100);changed=true;}}return changed;}

function runPlans(silent=false){
  if(!S.started||!canWrite()) return;
  let changed = false;
  ensureExplorePending();
  const p = S.explorePending;
  const cap = exploreCap();
  for(const s of S.slimes){
    const plan = getPlan(s.id);
    if(!plan || plan.type !== 'explore') continue;
    if(plan.global && S.exploreTeam !== null && !S.exploreTeam.includes(s.id)) continue;
    if(s.resting) continue;
    if(s.stamina < planActionCost() || s.mood <= 0){ s.resting = true; changed = true; continue; }
    s.stamina -= planActionCost();
    const mult = 1 + traitBonus(s,'all') + traitBonus(s,'explore');
    const pwMult = 1 + slimePower(s) / 600;
    let expGain = 4;
    let extra = 0, msgExtra = '';
    const luckTrigger = Math.random() < (s.luck||0) * 0.005;
    const roll = Math.random();
    if(roll < 0.008){
      if(p.weight + 1 <= cap){ extra = Math.round(60 * (1 + s.mag/100) * mult); msgExtra = ' 发现天材地宝！'; p.treasure++; p.weight++; }
    }
    else if(roll < 0.04){ extra = Math.round(36 * (1 + s.mag/100) * mult); msgExtra = ' 意外收获！'; }
    else if(roll < 0.15){ extra = Math.round(15 * (1 + s.mag/100) * mult); }
    let gain = Math.round(3 * (1 + s.agi/100) * mult) + extra;
    s.mood = clamp(s.mood + rndInt(-5,8), 0, 100);
    if(msgExtra&&!silent) setTimeout(()=>toast(`🗺️ ${s.name}${msgExtra}`, 'good'), 100);
    if(luckTrigger){ const bonus = Math.round(gain * 0.5); gain += bonus; if(!silent)setTimeout(()=>toast(`🍀 ${s.name} 触发幸运事件！额外 +${bonus} 晶币`, 'good'), 200); }
    gain = Math.round(gain * pwMult);
    expGain = Math.round(expGain * pwMult);
    p.coins += gain;
    p.exp += expGain;
    addTaskProgress('rent', 1);
    recordRegionExplore(S.exploreMapIndex);
    changed = true;
  }
  if(changed&&!silent){ save(); renderTop(); if(activeTab==='travel') renderTab(); }
}
