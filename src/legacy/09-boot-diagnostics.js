(function init(){
  applyWaveMasks();
  battleSpeed = clamp(Number(S.battleSpeed)||1, 1, 10);
  if(![1,2,5].includes(battleSpeed)) battleSpeed = 1;
  if(load() && S.started){
    if(!DIAGNOSTIC_MODE&&S.lastActive>0){settleOffline(Date.now()-S.lastActive);save();}
    battleSpeed = clamp(Number(S.battleSpeed)||1, 1, 10);
    if(![1,2,5].includes(battleSpeed)) battleSpeed = 1;
    if((S.bag.expPotion||0) > 0 && S.slimes.length){
      let guard = 0;
      while((S.bag.expPotion||0) > 0 && S.slimes.length && guard++ < 200){ S.bag.expPotion--; autoUseExpPotionSilent(); }
      save();
    }
    $('#storyScreen').classList.add('hidden');
    $('#gameScreen').classList.remove('hidden');
    applyTheme();
    applyNotch();
    checkDailyReset();
    renderTop();
    renderTab();
  } else {
    renderStory();
    if(persistenceBlocked) openModal(`<h3>存档保护</h3><p>${esc(persistenceWarning)}</p><p class="muted small">存档内容无法安全读取时会停在这里，以便保留原始数据不被覆盖。确定放弃这份存档的话，可以清除后重新开始。</p><button class="btn gold full" data-act="resetSave">清除损坏存档并重新开始</button>`);
  }
})();

/* ==================== 自检 / 画廊（仅 ?selftest=1 或 ?gallery=1 生效，正常游玩不执行） ==================== */
(function selftestBoot(){
  const qs = location.search || '';
  if(!qs.includes('selftest') && !qs.includes('gallery') && !qs.includes('battle') && !qs.includes('fps')) return;

  /* 统一进主界面，别让剧本屏挡住检查 */
  try{
    S.started = true;
    S.name = S.name || '测试';
    $('#storyScreen').classList.add('hidden');
    $('#gameScreen').classList.remove('hidden');
    applyTheme();
    renderTop();
    renderTab();
  }catch(e){ console.error('[selftest] boot', e); }

  const out = document.createElement('pre');
  out.id = 'selftestOut';
  out.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;max-width:100%;max-height:100%;overflow:auto;margin:0;padding:6px;background:#0b0b0f;color:#7dfa9a;font:11px/1.5 Consolas,monospace;white-space:pre-wrap';
  document.body.appendChild(out);
  const lines = [];
  const emit = t => { lines.push(t); out.textContent = lines.join('\n'); };

  /* 造一场可控战斗：重建双方并直接进深渊 */
  function startBattle(opts){
    opts = opts || {};
    if(window.__TEST__ && window.__TEST__._battle) window.__TEST__._battle.closeBattle();
    if(opts.seed !== undefined){
      let sd = (opts.seed >>> 0) || 1;
      Math.random = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
    }
    S.slimes = [];
    S.monsters = [];
    S.abyssLevel = opts.monsterLevel || 1;
    S.abyssUnlocked=Math.max(getAbyssUnlocked(),S.abyssLevel); // Diagnostic fixture only.
    S.battleSpeed = opts.speed || 10;
    battleSpeed = clamp(S.battleSpeed, 1, 10);
    (opts.elements || ['火','冰']).forEach((el, i)=>{
      const s = createSlime(false);
      s.element = el;
      s.name = 'T' + i;
      s.level = opts.level || 5;
      s.skill = '元素弹';
      s.hp = hpMax(s);
      S.slimes.push(s);
    });
    abyssSetupSel = S.slimes.map(s=>s.id);
    startAbyssBattle();
    const ov = document.querySelector('#gameOverlay');
    return ov ? ov.querySelector('.battle-field') : null;
  }

  const CHECKS = [];
  const check = (name, fn) => CHECKS.push([name, fn]);

  /* 捕获未处理异常：setTimeout 里抛的错会被静默吞掉，只靠断言查不出来 */
  const __ERRS = [];
  window.addEventListener('error', e => __ERRS.push(String((e && e.message) || e)));
  window.addEventListener('unhandledrejection', e => __ERRS.push('rejection: ' + String(e && e.reason)));

  window.__TEST__ = {
    get S(){ return S; },
    get FX(){ return typeof FX !== 'undefined' ? FX : null; },
    get B(){ return (this._battle && this._battle.B) || null; },
    get fieldEl(){ return (this._battle && this._battle.fieldEl) || null; },
    _battle: null,
    check, emit, startBattle
  };

  /* ===== CHECKS-START ===== */
  check('scaffold-alive', () => {
    if(!window.__TEST__.S) throw new Error('拿不到 S');
    if(!document.querySelector('#app')) throw new Error('没有 #app');
    return true;
  });

  check('scaffold-battle', () => {
    const field = window.__TEST__.startBattle({ speed:10, seed:1, elements:['火','冰'] });
    if(!field) throw new Error('startBattle 没有返回 .battle-field');
    if(!document.querySelector('#gameOverlay')) throw new Error('没有 #gameOverlay');
    const n = document.querySelectorAll('.battle-unit').length;
    if(n < 3) throw new Error('战斗单位过少: ' + n);
    const ally = document.querySelectorAll('.battle-unit[data-side="ally"]').length;
    if(ally !== 2) throw new Error('己方单位数应为 2，实际 ' + ally);
    return true;
  });
  check('FX-api', () => {
    if(typeof FX.bindField !== 'function') throw new Error('FX.bindField 缺失');
    if(typeof FX.shake !== 'function') throw new Error('FX.shake 缺失');
    if(typeof FX.flash !== 'function') throw new Error('FX.flash 缺失');
    if(typeof FX.float !== 'function') throw new Error('FX.float 缺失');
    if(typeof FX.die !== 'function') throw new Error('FX.die 缺失');
    if(!Array.isArray(FX.log)) throw new Error('FX.log 不是数组');
    return true;
  });
  check('FX-log', () => {
    const n = FX.log.length;
    FX.float(document.querySelector('#app'), '-1', { cls:'crit' });
    const last = FX.log[FX.log.length - 1];
    if(!last) throw new Error('log 为空');
    if(last.type !== 'float') throw new Error('最后一条不是 float: ' + last.type);
    if(last.text !== '-1') throw new Error('log 文本不对: ' + last.text);
    if(last.cls !== 'crit') throw new Error('log cls 不对: ' + last.cls);
    if(FX.log.length !== n + 1) throw new Error('log 未追加 ' + n + ' → ' + FX.log.length);
    return true;
  });
  /* ===== 任务 2：打击感（闪白 / 震屏 / 飘字 / 残影） ===== */
  const freshBattle = (opts) => {
    const prev = window.__TEST__._battle;
    if(prev && prev.B && prev.B.timer) clearInterval(prev.B.timer);
    document.querySelectorAll('#gameOverlay').forEach(o => o.remove());
    window.__TEST__.startBattle(Object.assign({ speed:10, seed:7, elements:['火','冰'], level:20, monsterLevel:30 }, opts || {}));
    const b = window.__TEST__._battle;
    b.B.allies.concat(b.B.monsters).forEach(u => {
      u.st = u.st || {};
      u.st.burn = 0; u.st.poison = 0; u.st.frozen = 0; u.st.paralysis = 0; u.st.charm = 0;
    });
    /* 敌人血量拉高，避免一击必杀把震屏档位顶到 kill */
    b.B.monsters.forEach(m => { m.hp = m.maxHp * 20; });
    b.setDodgeRate(() => 0);
    b.setCritRate(() => 0);
    FX._merge = null;
    FX._shakeRank = 0;
    FX._shakeKind = '';
    return b;
  };
  const since = (n) => FX.log.slice(n);
  const lastFloat = () => {
    for(let i = FX.log.length - 1; i >= 0; i--) if(FX.log[i].type === 'float') return FX.log[i];
    return null;
  };

  check('A-hit', () => {
    const b = freshBattle();
    const u = b.B.allies[0];
    /* 岩/冰 目标自带护盾池，会把一下普攻全部吸收、飘字变成「护盾」，这里先清掉 */
    b.B.monsters.forEach(m => { m.st.rockArmor = 0; m.st.iceArmor = 0; });
    const n = FX.log.length;
    b.performAction(u, 'ally');
    if(!b.fieldEl.querySelector('.breath.hit-flash')) throw new Error('命中没有闪白');
    if(FX._shakeKind) throw new Error('普通命中应克制，不震屏，实际 ' + FX._shakeKind);
    if(!since(n).some(e => e.type === 'float' && /^-\d+/.test(e.text))) throw new Error('没有伤害飘字');
    return true;
  });

  check('A-crit', () => {
    const b = freshBattle();
    const u = b.B.allies[0];
    b.setCritRate(() => 1000);
    b.B.monsters.forEach(m => { m.st.rockArmor = 0; m.st.iceArmor = 0; });
    const n = FX.log.length;
    b.performAction(u, 'ally');
    const hit = since(n).filter(e => e.type === 'float' && e.cls === 'crit');
    if(!hit.length) throw new Error('没有暴击飘字');
    if(!/^-\d+!/.test(hit[0].text)) throw new Error('暴击飘字缺叹号: ' + hit[0].text);
    if(FX._shakeKind !== 'crit') throw new Error('暴击震屏档位应为 crit，实际 ' + FX._shakeKind);
    return true;
  });

  check('A-shield', () => {
    const b = freshBattle();
    const u = b.B.allies[0];
    /* 护盾池足够大时，一下普攻会被完全吸收：不应显示「-0」或「造成 0 伤害」 */
    b.B.monsters.forEach(m => { m.st.rockArmor = m.maxHp; m.st.iceArmor = 0; });
    const n = FX.log.length;
    b.performAction(u, 'ally');
    const floats = FX.log.slice(n).filter(e => e.type === 'float');
    const txt = (b.logEl.textContent || '');
    if(floats.some(e => e.text === '-0')) throw new Error('护盾吃满时仍在飘 -0');
    if(!floats.some(e => e.text === '护盾')) throw new Error('护盾吃满时没有「护盾」飘字');
    if(!/护盾吸收 \d+ 点/.test(txt)) throw new Error('战报没有披露护盾吸收量: ' + txt);
    return true;
  });

  check('A-miss', () => {
    const b = freshBattle();
    const u = b.B.allies[0];
    b.setDodgeRate(() => 100);
    const n = FX.log.length;
    b.performAction(u, 'ally');
    const f = since(n).filter(e => e.type === 'float' && e.text === 'MISS');
    if(!f.length) throw new Error('闪避没有飘字');
    if(f[0].cls !== 'miss') throw new Error('闪避飘字 class 不对: ' + f[0].cls);
    if(FX._shakeKind) throw new Error('闪避不应震屏，实际 ' + FX._shakeKind);
    return true;
  });

  check('A-heal', () => {
    const b = freshBattle();
    const u = b.B.allies[0];
    u.ref.skill = '治疗';
    u.hp = Math.round(u.maxHp * 0.5);
    const n = FX.log.length;
    b.performAction(u, 'ally');
    const f = since(n).filter(e => e.type === 'float' && /^\+\d+/.test(e.text));
    if(!f.length) throw new Error('治疗没有回血飘字');
    if(!f[0].cls.includes('good')) throw new Error('回血飘字应为 good: ' + f[0].cls);
    return true;
  });

  check('A-dot', () => {
    const b = freshBattle();
    const u = b.B.allies[0];
    u.st.burn = 2;
    const n = FX.log.length;
    b.performAction(u, 'ally');
    const f = since(n).filter(e => e.type === 'float' && e.cls === 'dot');
    if(!f.length) throw new Error('持续伤害没有飘字');
    if(!/^🔥-\d+/.test(f[0].text)) throw new Error('DoT 飘字格式不对: ' + f[0].text);
    return true;
  });

  check('A-splash', () => {
    const b = freshBattle({ elements:['雷','冰'] });
    b.B.monsters.forEach(m => { m.ref.element = '水'; });
    const n = FX.log.length;
    b.performAction(b.B.allies[0], 'ally');
    const f = since(n).filter(e => e.type === 'float' && e.cls === 'small');
    if(!f.length) throw new Error('雷溅射没有小号飘字');
    if(!/^-\d+/.test(f[0].text)) throw new Error('溅射飘字格式不对: ' + f[0].text);
    return true;
  });

  check('A-leech', () => {
    const b = freshBattle({ elements:['草','冰'] });
    const n = FX.log.length;
    b.performAction(b.B.allies[0], 'ally');
    const f = since(n).filter(e => e.type === 'float' && /^\+\d+/.test(e.text) && e.cls.includes('good'));
    if(!f.length) throw new Error('草吸血没有回血飘字');
    return true;
  });

  check('A-ghost', () => {
    const b = freshBattle();
    const u = b.B.allies[0];
    const el = b.getUnitEl(u, 'ally');
    u.hp = Math.round(u.maxHp * 0.25);
    b.refreshBars();
    const hb = el.querySelector('.hpbar');
    if(!hb) throw new Error('找不到血条');
    const main = hb.querySelector('i:not(.ghost)');
    const ghost = hb.querySelector('i.ghost');
    if(!ghost) throw new Error('血条缺少残影层');
    const mv = parseFloat(main.style.width);
    const gv = parseFloat(ghost.style.width);
    if(!(Math.abs(mv - 25) < 1)) throw new Error('主条宽度不对: ' + main.style.width);
    if(!(Math.abs(mv - gv) < 0.6)) throw new Error('残影与主条不同步: ' + main.style.width + ' / ' + ghost.style.width);
    if(!hb.classList.contains('low')) throw new Error('低血没有 low 标记');
    u.hp = u.maxHp;
    b.refreshBars();
    if(hb.classList.contains('low')) throw new Error('满血仍在 low 状态');
    return true;
  });

  check('A-merge', () => {
    const b = freshBattle();
    const el = b.getUnitEl(b.B.allies[0], 'ally');
    FX._merge = null;
    document.querySelectorAll('.fx-float').forEach(o => o.remove());
    FX.float(el, '-10', {});
    const node = FX.float(el, '-20', {});
    FX.float(el, '-30', {});
    if(node.textContent !== '-60') throw new Error('飘字没有累加: ' + node.textContent);
    if(document.querySelectorAll('.fx-float').length !== 1) throw new Error('同目标飘字应合并为 1 个，实际 ' + document.querySelectorAll('.fx-float').length);
    const other = FX.float(el, '-10', { cls:'crit' });
    if(other === node) throw new Error('不同 class 不应合并');
    return true;
  });

  check('A-bounds', () => {
    const b = freshBattle();
    const el = b.getUnitEl(b.B.monsters[0], 'enemy');
    const node = FX.float(el, '-99999!', { cls:'crit' });
    if(!node) throw new Error('没有生成飘字');
    const fr = b.fieldEl.getBoundingClientRect();
    const top = parseFloat(node.style.top);
    const left = parseFloat(node.style.left);
    if(!(top >= 0)) throw new Error('飘字越出场地顶部: ' + top);
    if(!(top + 18 <= fr.height + 1)) throw new Error('飘字越出场地底部: ' + top + ' / ' + fr.height);
    if(!(left >= -1 && left <= fr.width + 1)) throw new Error('飘字越出场地左右: ' + left);
    return true;
  });
  /* ===== 任务 3：击杀演出 ===== */
  check('A-offset', () => {
    /* 规格 §4.3：同目标连续飘字向上错开 14px，且都不越界 */
    const b = freshBattle();
    const el = b.getUnitEl(b.B.monsters[0], 'enemy');
    const fr = b.fieldEl.getBoundingClientRect();
    b.fieldEl.querySelectorAll('.fx-float').forEach(n => n.remove());
    const nodes = [
      FX.float(el, '-11', { cls:'crit' }),
      FX.float(el, '-22', { cls:'weak' }),
      FX.float(el, '-33', { cls:'strong' })
    ];
    if(nodes.some(n => !n)) throw new Error('有飘字没有生成');
    const tops = nodes.map(n => parseFloat(n.style.top));
    if(Math.abs(tops[1] - tops[0]) < 12) throw new Error('第二条没有和第一条错开: ' + tops.join(','));
    if(Math.abs(tops[2] - tops[1]) < 12) throw new Error('第三条没有继续错开: ' + tops.join(','));
    tops.forEach((tp, i) => {
      if(!(tp >= 0 && tp + 18 <= fr.height + 1)) throw new Error(`第 ${i + 1} 条飘字越界 top=${tp} 场地高=${fr.height}`);
    });
    nodes.forEach(n => n.remove());
    return true;
  });
  check('A-kill', () => {
    const b = freshBattle();
    const t = b.B.monsters[0];
    const el = b.getUnitEl(t, 'enemy');
    /* 只留一个活敌人，保证目标唯一；清护甲与回溯，血量归 1 保证一击致死 */
    b.B.monsters.forEach(m => { m.hp = 0; m.st.rockArmor = 0; m.st.iceArmor = 0; m.st.timeRevive = false; });
    t.hp = 1;
    FX._shakeRank = 0;
    FX._shakeKind = '';
    b.fieldEl.querySelectorAll('.fx-part').forEach(p => p.remove());
    const n = FX.log.length;
    b.performAction(b.B.allies[0], 'ally');
    const sl = el.querySelector('.slime');
    if(!sl || !sl.classList.contains('dying')) throw new Error('死亡没有 .dying 演出');
    const seg = since(n);
    if(!seg.some(e => e.type === 'die')) throw new Error('FX.log 没有 die 记录');
    if(FX._shakeKind !== 'kill') throw new Error('击杀震屏档位应为 kill，实际 ' + FX._shakeKind);
    const burst = seg.filter(e => e.type === 'burst').pop();
    if(!burst) throw new Error('没有爆散粒子');
    const cnt = parseInt(burst.text, 10);
    if(!(cnt >= 10 && cnt <= 14)) throw new Error('击杀粒子数应在 10–14，实际 ' + cnt);
    const parts = b.fieldEl.querySelectorAll('.fx-part').length;
    if(parts < 10) throw new Error('实际粒子节点过少: ' + parts);
    return true;
  });
  check('A-dead-mark', async () => {
    /* 阵亡观感沿用第一版：身体留在原地、平眼（data-dead=1），不灰化、不留 💀 */
    const b = freshBattle();
    const t = b.B.monsters[0];
    const el = b.getUnitEl(t, 'enemy');
    b.B.monsters.forEach(m => { m.hp = 0; m.st.rockArmor = 0; m.st.iceArmor = 0; m.st.timeRevive = false; });
    t.hp = 1;
    b.performAction(b.B.allies[0], 'ally');
    b.refreshBars();
    const sl = el.querySelector('.slime');
    if(sl.dataset.dead !== '1') throw new Error('阵亡单位没有标记 data-dead=1，实际 ' + sl.dataset.dead);
    if(sl.dataset.mood !== 'sleep') throw new Error('阵亡单位应为平眼(sleep)，实际 ' + sl.dataset.mood);
    if(el.classList.contains('dead')) throw new Error('阵亡单位不应再带 .dead 标记（已回到第一版观感）');
    await sleep(500);   /* 等死亡演出（0.34s）播完并撤掉 .dying */
    if(sl.classList.contains('dying')) throw new Error('死亡演出结束后 .dying 没有撤掉，身体会保持不可见');
    const op = parseFloat(getComputedStyle(sl).opacity);
    if(!(op > 0.9)) throw new Error('阵亡单位身体不可见，opacity=' + op);
    const content = getComputedStyle(el.querySelector('.slime-wrap'), '::after').content || '';
    if(content.indexOf('💀') >= 0) throw new Error('不应再有 💀 角标，实际 content=' + content);
    return true;
  });
  check('A-revive-mark', () => {
    /* 时间回溯复活后必须回到站立可交互状态（不再有 .dying 定格） */
    const b = freshBattle({ elements: ['时间', '火'] });
    const t = b.B.monsters[0];
    const el = b.getUnitEl(t, 'enemy');
    b.B.monsters.forEach(m => { m.hp = 0; m.st.rockArmor = 0; m.st.iceArmor = 0; });
    t.hp = 0;
    t.st.timeRevive = true;
    b.handleUnitDeath(t, 'enemy');
    if(t.hp <= 0) throw new Error('回溯没有复活目标');
    b.refreshBars();
    if(el.querySelector('.slime').classList.contains('dying')) throw new Error('复活后仍带 .dying 定格');
    if(el.querySelector('.slime').dataset.dead === '1') throw new Error('复活后仍是阵亡标记');
    return true;
  });
  check('R-lose-look', async () => {
    /* 我方战败：己方站着「闭眼 + 发抖」，不倒下、不留 💀、不带 .dead */
    const b = freshBattle({ elements: ['岩', '火'] });
    clearInterval(b.B.timer);
    const allies = b.B.allies;
    allies.forEach(u => { u.hp = 0; b.handleUnitDeath(u, 'ally'); });
    b.endBattle(false);
    await sleep(600);
    const els = Array.from(b.overlay.querySelectorAll('.battle-row.ally .battle-unit'));
    if(!els.length) throw new Error('战败后找不到己方单位');
    els.forEach(el => {
      const sl = el.querySelector('.slime');
      const nm = (el.querySelector('.uname') || {}).textContent || '?';
      if(sl.dataset.mood !== 'fear') throw new Error('战败的己方应是害怕表情(fear)，' + nm + ' 实际 ' + sl.dataset.mood);
      if(sl.dataset.dead !== '0') throw new Error('战败的己方不应是阵亡外观: ' + nm);
      if(el.classList.contains('dead')) throw new Error('战败的己方仍带 .dead 标记: ' + nm);
      const anim = getComputedStyle(el.querySelector('.breath .anim') || el.querySelector('.anim')).animationName;
      if(anim !== 'shake') throw new Error('害怕表情没有发抖动画，' + nm + ' 实际 ' + anim);
      const eyeAfter = getComputedStyle(el.querySelector('.eye'), '::after').display;
      if(eyeAfter !== 'none') throw new Error('害怕表情没有闭眼，' + nm + ' .eye::after display=' + eyeAfter);
    });
    killBattle(b);
    return true;
  });
  check('R-win-look', async () => {
    /* 对方战败：魔物同样站着「闭眼 + 发抖」，我方蹦跳庆祝，且技能条已收起 */
    const b = freshBattle({ elements: ['岩', '火'] });
    clearInterval(b.B.timer);
    b.B.monsters.forEach(m => { m.hp = 0; b.handleUnitDeath(m, 'enemy'); });
    b.endBattle(true);
    await sleep(600);
    const bar = b.overlay.querySelector('#skillBar');
    if(bar && !bar.classList.contains('hide')) throw new Error('战斗结束后技能条没有收起');
    const mons = Array.from(b.overlay.querySelectorAll('.battle-row.enemy .battle-unit'));
    if(!mons.length) throw new Error('战斗胜利后找不到魔物单位');
    mons.forEach(el => {
      const sl = el.querySelector('.slime');
      const nm = (el.querySelector('.uname') || {}).textContent || '?';
      if(sl.dataset.mood !== 'fear') throw new Error('战败的魔物应是害怕表情(fear)，' + nm + ' 实际 ' + sl.dataset.mood);
      if(sl.dataset.dead !== '0') throw new Error('战败的魔物不应是阵亡外观: ' + nm);
      const anim = getComputedStyle(el.querySelector('.anim')).animationName;
      if(anim !== 'shake') throw new Error('战败的魔物没有发抖动画，' + nm + ' 实际 ' + anim);
    });
    const allyMoods = Array.from(b.overlay.querySelectorAll('.battle-row.ally .slime')).map(s => s.dataset.mood);
    if(!allyMoods.every(m => m === 'jump')) throw new Error('胜利方应蹦跳，实际 ' + allyMoods.join(','));
    killBattle(b);
    return true;
  });
  /* ===== 任务 4/5：属性形态 ===== */
  const mountSlime = (element, mood, sz, extra) => {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:60px;z-index:9999';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'transform:scale(' + (sz || 1) + ');transform-origin:top left';
    wrap.innerHTML = slimeHTMLFromColor({ h:200, s:70, l:52 }, { h:210, s:40, l:22 },
      Object.assign({ element, mood, sz: sz || 1 }, extra || {}));
    box.appendChild(wrap);
    document.body.appendChild(box);
    return { box, root: wrap.firstElementChild };
  };
  check('B-dom', () => {
    const { box, root } = mountSlime('火', 'idle', 1);
    try{
      if(root.dataset.el !== '火') throw new Error('根节点没有 data-el: ' + root.dataset.el);
      const mark = root.querySelector('.breath .mark');
      if(!mark) throw new Error('.breath 内没有 .mark');
      if(!mark.nextElementSibling || !mark.nextElementSibling.classList.contains('fx')) throw new Error('.mark 不在 .fx 之前');
      /* 装饰层已按用户要求全部移除：任何属性都不许再画伪元素 */
      ['岩','火','水','风','草','冰','雷','光','暗','幻','空间','时间'].forEach(el => {
        const m = mountSlime(el, 'idle', 1);
        try{
          const mm = m.root.querySelector('.breath .mark');
          ['::before','::after'].forEach(which => {
            const cs = getComputedStyle(mm, which);
            if(cs.content && cs.content !== 'none' && cs.content !== 'normal') throw new Error(el + ' 的 ' + which + ' 仍有装饰 content=' + cs.content);
          });
        }finally{ m.box.remove(); }
      });
      const sys = mountSlime(undefined, 'idle', 1);
      try{
        if(sys.root.dataset.el !== 'sys') throw new Error('未传 element 时应为 sys: ' + sys.root.dataset.el);
      }finally{ sys.box.remove(); }
    }finally{ box.remove(); }
    return true;
  });


  /* ===== 任务 7：战斗数据层（三态 + 技能表 + CD） ===== */
  const killBattle = (b) => {
    if(!b) return;
    try{ clearInterval(b.B.timer); }catch(e){}
    (b.B.pendingTimers || []).forEach(t => { clearTimeout(t); clearInterval(t); });
    if(b.B.pendingTimers) b.B.pendingTimers.length = 0;
    b.B.running = false;
    if(b.overlay && b.overlay.isConnected) b.overlay.remove();
  };

  check('C-mode', () => {
    if(S.battleMode !== 'auto') throw new Error('S.battleMode 默认应为 auto，实际 ' + S.battleMode);
    return true;
  });

  check('C-save', () => {
    const bak = localStorage.getItem('slimeSummonerSave');
    const bakMode = S.battleMode;
    try{
      delete S.battleMode;
      const legacy = JSON.parse(JSON.stringify(S));
      localStorage.setItem('slimeSummonerSave', JSON.stringify(legacy));
      if(!load()) throw new Error('旧档加载失败');
      if(S.battleMode !== 'auto') throw new Error('旧档缺 battleMode 未回落 auto，实际 ' + S.battleMode);
      ['status','summon','travel','space','bag'].forEach(t => {
        try{ switchTab(t); }catch(e){ throw new Error('切到 ' + t + ' 抛错: ' + e.message); }
      });
    }finally{
      S.battleMode = bakMode || 'auto';
      if(bak) localStorage.setItem('slimeSummonerSave', bak);
      else localStorage.removeItem('slimeSummonerSave');
      try{ switchTab('status'); }catch(e){}
    }
    return true;
  });

  check('C-skill', () => {
    if(!SKILLS || typeof SKILLS !== 'object') throw new Error('没有 SKILLS 表');
    const names = { 岩:'磐石落', 火:'炽炎爆', 水:'涌泉', 风:'疾风连斩', 草:'缠根', 冰:'霜封',
                    雷:'落雷', 光:'圣光', 暗:'侵蚀', 幻:'魅惑', 空间:'相位', 时间:'回溯' };
    Object.keys(names).forEach(el => {
      const sk = SKILLS[el];
      if(!sk) throw new Error('技能表缺 ' + el);
      if(sk.name !== names[el]) throw new Error(el + ' 技能名应为 ' + names[el] + '，实际 ' + sk.name);
      if(sk.cd !== 3) throw new Error(el + ' 的 CD 应为 3，实际 ' + sk.cd);
      if(!sk.kind) throw new Error(el + ' 缺 kind');
      if(typeof sk.mult !== 'number' || sk.mult <= 0) throw new Error(el + ' 倍率非法: ' + sk.mult);
    });
    const fire = { element:'火' };
    const sk = skillOf(fire);
    if(!sk || sk.name !== '炽炎爆') throw new Error('skillOf(火) 应返回 炽炎爆');
    if(skillOf({ element: undefined }) !== null) throw new Error('无元素应返回 null');
    return true;
  });

  check('C-unit', () => {
    const b = freshBattle({ elements:['火','冰'] });
    try{
      b.B.allies.concat(b.B.monsters).forEach(u => {
        if(!u.cd || typeof u.cd !== 'object') throw new Error('单位没有 cd 对象');
        if(u.acted !== false) throw new Error('单位 acted 应为 false，实际 ' + u.acted);
      });
      const u = b.B.allies[0];
      u.cd['火'] = 3;
      u.acted = true;
      b.nextTurn();
      if(u.acted !== false) throw new Error('nextTurn 后 acted 未重置');
      if(u.cd['火'] !== 2) throw new Error('nextTurn 后 CD 应递减为 2，实际 ' + u.cd['火']);
    }finally{
      killBattle(b);
    }
    return true;
  });

  /* ===== 任务 8：技能条与手动施法 ===== */
  const setMode = (m) => { S.battleMode = m; };

  check('C-bar', () => {
    const b = freshBattle({ elements:['岩','火'] });
    try{
      setMode('interject');
      b.renderSkillBar();
      const bar = document.querySelector('#gameOverlay .skill-bar');
      if(!bar) throw new Error('没有 .skill-bar');
      const btn = bar.querySelectorAll('.sk-unit').length;
      const alive = b.B.allies.filter(u=>u.hp>0).length;
      if(btn !== alive) throw new Error('技能条按钮数 ' + btn + ' ≠ 存活 ' + alive);
      setMode('auto');
      b.renderSkillBar();
      const bar2 = document.querySelector('#gameOverlay .skill-bar');
      if(bar2 && !bar2.classList.contains('hide')) throw new Error('auto 模式下技能条应隐藏');
    }finally{ killBattle(b); setMode('auto'); }
    return true;
  });

  check('C-cast', () => {
    const b = freshBattle({ elements:['岩','火'] });
    try{
      setMode('interject');
      const u = b.B.allies.find(x=>x.ref.element==='岩');
      const t = b.B.monsters[0];
      t.st.rockArmor = 0; t.st.iceArmor = 0;
      const hp0 = t.hp;
      if(b.playerCast(u, t) !== true) throw new Error('磐石落释放失败');
      if(!(t.hp < hp0)) throw new Error('目标没有掉血');
      if(!(u.st.rockArmor > 0)) throw new Error('没有获得护盾');
      if(u.acted !== true) throw new Error('acted 未置 true');
      if(u.cd['岩'] !== 3) throw new Error('CD 未置 3，实际 ' + u.cd['岩']);
      if(b.playerCast(u, t) !== false) throw new Error('冷却/已行动状态下仍可释放');
    }finally{ killBattle(b); setMode('auto'); }
    return true;
  });

  check('C-target', () => {
    const b = freshBattle({ elements:['火','冰'] });
    try{
      setMode('interject');
      if(b.B.monsters.length < 2) throw new Error('夹具需要至少 2 个敌人');
      const u = b.B.allies[0];
      const t = b.B.monsters[0];
      t.ref.element = '空间';
      if(b.playerCast(u, t) !== false) throw new Error('虚化目标仍被释放');
      if(u.acted === true) throw new Error('打空不应消耗行动');
      if(!/虚化|无法选中/.test(b.logEl.innerHTML)) throw new Error('没有不可选中的提示文案: ' + b.logEl.textContent);
    }finally{ killBattle(b); setMode('auto'); }
    return true;
  });

  check('C-revive', () => {
    const b = freshBattle({ elements:['时间','火'] });
    try{
      setMode('interject');
      const u = b.B.allies.find(x=>x.ref.element==='时间');
      const dead = b.B.allies.find(x=>x!==u);
      dead.hp = 0;
      if(!b.playerCast(u, null)) throw new Error('回溯释放失败');
      if(!(dead.hp > 0)) throw new Error('阵亡友方没有复活');
      if(Math.abs(dead.hp - Math.round(dead.maxHp*0.3)) > 1) throw new Error('复活血量应为 30%，实际 ' + dead.hp + '/' + dead.maxHp);
      u.acted = false; u.cd['时间'] = 0;
      const t = b.B.monsters[0];
      t.st.rockArmor = 0; t.st.iceArmor = 0;
      const hp0 = t.hp;
      if(!b.playerCast(u, t)) throw new Error('无阵亡时回溯应改为伤害');
      if(!(t.hp < hp0)) throw new Error('无阵亡时没有造成伤害');
    }finally{ killBattle(b); setMode('auto'); }
    return true;
  });
  /* ===== 任务 9：逐回合模式 ===== */
  const sleep = ms => new Promise(r=>setTimeout(r, ms));

  check('C-step1', async () => {
    const b = freshBattle({ elements:['岩','火'] });
    try{
      setMode('step');
      if(b.B.timer) clearInterval(b.B.timer);
      b.nextTurn();
      await sleep(120);
      if(b.B.paused !== true) throw new Error('step 模式轮到己方没有暂停');
      if(!document.querySelector('#skillBar .sk-unit.on')) throw new Error('技能条没有高亮当前单位');
    }finally{ killBattle(b); setMode('auto'); }
    return true;
  });

  check('C-step2', async () => {
    const b = freshBattle({ elements:['岩','火'] });
    try{
      setMode('step');
      if(b.B.timer) clearInterval(b.B.timer);
      const u = b.B.allies[0];
      let cbCalled = false;
      b.waitForPlayer(u, 'ally', ()=>{ cbCalled = true; }, 60);
      if(b.B.paused !== true) throw new Error('waitForPlayer 没有置 paused');
      await sleep(220);
      if(u.acted !== true) throw new Error('超时后没有自动普攻（acted 仍为 false）');
      if(!cbCalled) throw new Error('超时后没有回调 done');
      if(b.B.paused !== false) throw new Error('超时后没有解除暂停');
    }finally{ killBattle(b); setMode('auto'); }
    return true;
  });

  check('C-step3', async () => {
    const b = freshBattle({ elements:['岩','火'] });
    try{
      setMode('step');
      if(b.B.timer) clearInterval(b.B.timer);
      b.waitForPlayer(b.B.allies[0], 'ally', ()=>{}, 5000);
      if(!(b.B.pendingTimers.length > 0)) throw new Error('等待玩家时没有挂兜底定时器');
      b.closeBattle();
      if(b.B.pendingTimers.length !== 0) throw new Error('关闭战斗后仍有残留定时器 ' + b.B.pendingTimers.length);
      if(b.B.paused !== false) throw new Error('关闭战斗后 paused 未复位');
    }finally{ killBattle(b); setMode('auto'); }
    return true;
  });
  /* ===== 任务 10：插话模式 ===== */
  check('C-inter', () => {
    const b = freshBattle({ elements:['岩','火'] });
    try{
      setMode('interject');
      const u = b.B.allies.find(x=>x.ref.element==='岩');
      const t = b.B.monsters[0];
      t.st.rockArmor = 0; t.st.iceArmor = 0;
      if(b.playerCast(u, t) !== true) throw new Error('插话施法失败');
      if(b.B.paused !== false) throw new Error('插话模式不应暂停自动节奏');
      const hpAfterCast = t.hp;
      b.performAction(u, 'ally');
      if(t.hp !== hpAfterCast) throw new Error('同一单位同回合既手动又自动行动了');
      if(u.acted !== true) throw new Error('acted 标记被清掉了');
    }finally{ killBattle(b); setMode('auto'); }
    return true;
  });

  check('C-inter2', () => {
    const b = freshBattle({ elements:['岩','火'] });
    try{
      setMode('interject');
      if(b.B.timer) clearInterval(b.B.timer);
      b.B.timer = setInterval(()=>{}, 9000);
      const timerId = b.B.timer;
      const u = b.B.allies.find(x=>x.ref.element==='岩');
      const t = b.B.monsters[0];
      t.st.rockArmor = 0; t.st.iceArmor = 0;
      b.playerCast(u, t);
      if(b.B.timer !== timerId) throw new Error('插话后自动计时器被替换/重置');
    }finally{ killBattle(b); setMode('auto'); }
    return true;
  });
  /* ===== 任务 11：自动战斗整回合必须真的跑完 ===== */
  check('C-phase', async () => {
    const b = freshBattle({ elements:['岩','火'] });
    try{
      setMode('auto');
      if(b.B.timer) clearInterval(b.B.timer);
      /* 把双方血量拉满，避免一个回合内就分出胜负（结束后血量会被还原，断言失去意义） */
      b.B.allies.concat(b.B.monsters).forEach(u=>{ u.maxHp = 999999; u.hp = 999999; });
      const before = FX.log.length;
      const t0 = b.B.turn;
      b.nextTurn();
      await sleep(1800);
      if(__ERRS.length) throw new Error('自动回合出现未捕获异常: ' + __ERRS.join(' | '));
      if(b.B.turn !== t0 + 1) throw new Error('回合数没有推进');
      if(FX.log.length - before < 3) throw new Error('整回合的反馈条数过少: ' + (FX.log.length - before));
      if(!b.B.allies.some(a => a.hp < a.maxHp)) throw new Error('敌方阶段似乎没有出手（我方血量未变）');
    }finally{ killBattle(b); setMode('auto'); }
    return true;
  });

  check('R-perf', () => {
    /* 首场作为基线 */
    let b = freshBattle({ elements:['岩','火','水'] });
    killBattle(b);
    const base = document.querySelectorAll('*').length;
    for(let i = 0; i < 10; i++){
      b = freshBattle({ elements:['岩','火','水'] });
      killBattle(b);
    }
    const after = document.querySelectorAll('*').length;
    if(after > base * 1.05 + 20) throw new Error(`连战 10 场后节点数未回落: ${base} → ${after}`);
    return true;
  });

  check('C-step-timer', async () => {
    const b = freshBattle({ elements:['岩','火'] });
    try{
      setMode('step');
      clearInterval(b.B.timer);
      /* 用高频轮询模拟真实回合计时器，验证暂停期间不会推进回合 */
      b.B.timer = setInterval(()=>b.nextTurn(), 120);
      b.nextTurn();
      const t0 = b.B.turn;
      await sleep(430);
      if(!b.B.paused) throw new Error('等待玩家操作时应处于暂停态');
      if(b.B.turn !== t0) throw new Error(`暂停中回合仍在推进: ${t0} → ${b.B.turn}`);
    }finally{ killBattle(b); setMode('auto'); }
    return true;
  });

  check('C-revive-vis', async () => {
    const b = freshBattle({ elements:['时间','火'] });
    try{
      setMode('interject');
      clearInterval(b.B.timer);
      const timeU = b.B.allies[0];
      const dead = b.B.allies[1];
      timeU.st.timeRevive = false;
      dead.st.timeRevive = false;
      dead.hp = 0;
      b.handleUnitDeath(dead, 'ally');
      const sl = b.getUnitEl(dead, 'ally').querySelector('.slime');
      if(!sl.classList.contains('dying')) throw new Error('死亡后应加 .dying');
      timeU.cd = {};
      timeU.acted = false;
      const ok = b.playerCast(timeU, null);
      if(!ok) throw new Error('时间回溯应该能复活阵亡友方');
      if(dead.hp <= 0) throw new Error('复活后血量应大于 0');
      if(sl.classList.contains('dying')) throw new Error('复活后 .dying 残留，单位会停在透明状态');
    }finally{ killBattle(b); setMode('auto'); }
    return true;
  });

  check('C-align', async () => {
    /* 场景 1：手动雷普攻对水史莱姆溅射 */
    let b = freshBattle({ elements:['雷','草'] });
    try{
      setMode('interject');
      clearInterval(b.B.timer);
      const thunder = b.B.allies[0];
      thunder.ref.element = '雷';
      thunder.acted = false;
      const water = b.B.monsters[0];
      const water2 = b.B.monsters[1];
      water.ref.element = '水'; water.st.iceArmor = 0; water.st.rockArmor = 0;
      water2.ref.element = '水'; water2.hp = water2.maxHp;
      const w2hp = water2.hp;
      b.playerBasic(thunder, water);
      if(!(water2.hp < w2hp)) throw new Error('手动雷普攻没有对水史莱姆溅射');
    }finally{ killBattle(b); }

    /* 场景 2：手动行动前必须结算持续伤害 */
    b = freshBattle({ elements:['火','草'] });
    try{
      setMode('interject');
      clearInterval(b.B.timer);
      const burnU = b.B.allies[0];
      burnU.acted = false;
      burnU.st.burn = 2;
      const bhp = burnU.hp;
      b.playerBasic(burnU, b.B.monsters[0]);
      if(!(burnU.hp < bhp)) throw new Error('手动行动没有结算持续伤害');
      if(!burnU.acted) throw new Error('被持续伤害消耗的行动应记为已行动');
    }finally{ killBattle(b); }

    /* 场景 3：手动命中冰甲要反冻攻击者（单独一场，避免水史莱姆召唤的小怪干扰） */
    b = freshBattle({ elements:['火','草'] });
    try{
      setMode('interject');
      clearInterval(b.B.timer);
      const atk = b.B.allies[0];
      atk.acted = false;
      atk.st.frostbite = 0;
      const ice = b.B.monsters[0];
      ice.ref.element = '冰';
      ice.st.iceArmor = 80;
      b.playerBasic(atk, ice);
      if(!(atk.st.frostbite > 0)) throw new Error(`手动命中冰甲没有反冻攻击者 (hp=${atk.hp} acted=${atk.acted} iceArmor=${ice.st.iceArmor} fb=${atk.st.frostbite})`);
    }finally{ killBattle(b); setMode('auto'); }
    return true;
  });

  check('R-input', async () => {
    /* 极端 1：只有一只史莱姆，把技能条上所有按钮都点一遍 */
    let b = freshBattle({ elements:['火'] });
    try{
      setMode('interject');
      b.renderSkillBar();
      const units = document.querySelectorAll('#skillBar .sk-unit');
      if(!units.length) throw new Error('技能条没有渲染己方按钮');
      units.forEach(u=>u.dispatchEvent(new MouseEvent('click', { bubbles:true })));
      document.querySelectorAll('#skillBar .sk-act').forEach(btn=>btn.dispatchEvent(new MouseEvent('click', { bubbles:true })));
      document.querySelectorAll('.battle-row.enemy .battle-unit').forEach(e=>e.dispatchEvent(new MouseEvent('click', { bubbles:true })));
      await sleep(60);
      if(__ERRS.length) throw new Error('单只史莱姆点技能报错: ' + __ERRS.join(' | '));
    }finally{ killBattle(b); }
    /* 极端 2：全队阵亡 */
    b = freshBattle({ elements:['火','冰'] });
    try{
      setMode('interject');
      b.B.allies.forEach(a=>{ a.hp = 0; });
      b.renderSkillBar();
      const bar = document.querySelector('#skillBar');
      if(!bar.classList.contains('hide')) throw new Error('全队阵亡后技能条应隐藏');
      const u = b.B.allies[0];
      const res = b.playerCast(u, b.B.monsters[0]);
      if(res !== false) throw new Error('阵亡单位不应能施法');
      await sleep(60);
      if(__ERRS.length) throw new Error('全队阵亡路径报错: ' + __ERRS.join(' | '));
    }finally{ killBattle(b); setMode('auto'); }
    return true;
  });

  check('R-noerr', () => {
    if(__ERRS.length) throw new Error('全局未捕获异常: ' + __ERRS.join(' | '));
    return true;
  });
  /* ===== CHECKS-END ===== */

  /* 战斗界面截图：?battle=1（插话）/ ?battle=step（逐回合）—— 便于人工复核技能条布局 */
  /* 纯界面模式：只挂测试钩子，不自动开战（截图 / 人工检查界面用） */
  if(qs.includes('battle=ui')){
    document.title = 'UI';
    return;
  }

  if(qs.includes('battle')){
    const wantStep = qs.includes('step');
    S.battleMode = wantStep ? 'step' : 'interject';
    if(window.__TEST__ && window.__TEST__.startBattle){
      window.__TEST__.startBattle({ elements:['岩','火','水'], level:20, speed: wantStep ? 10 : 1 });
      const b = window.__TEST__._battle;
      if(b){
        b.renderSkillBar();
        if(!wantStep){
          const first = document.querySelector('#skillBar .sk-unit');
          if(first) first.click();
        }
      }
      const btn = document.querySelector('#bMode');
      if(btn) btn.textContent = wantStep ? '逐回合' : '插话';
    }
    document.title = 'BATTLE';
    return;
  }

  /* 帧率测试：?fps=1 真实时间采样；?fps=1&fx=off 关掉特效做同场景对照 */
  if(qs.includes('fps')){
    const noFx = qs.includes('fx=off');
    document.getElementById('storyScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'flex';
    S.started = true;
    S.battleMode = 'auto';
    applyTheme();
    if(noFx){
      /* 关掉特效后，同场景的开销就是纯战斗逻辑 + 血条刷新 */
      FX.float = () => null;
      FX.flash = () => {};
      FX.shake = () => {};
      FX.die = () => {};
      FX.burst = () => {};
    }
    const sampleFrames = ms => new Promise(resolve => {
      const t0 = performance.now();
      const deltas = [];
      let last = t0;
      const frame = () => {
        const now = performance.now();
        deltas.push(now - last);
        last = now;
        if(now - t0 < ms){ requestAnimationFrame(frame); return; }
        const sorted = deltas.slice().sort((a, b) => a - b);
        const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        resolve({
          frames: deltas.length,
          avgMs: +avg.toFixed(2),
          fps: +(1000 / avg).toFixed(1),
          p95Ms: +(sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(2),
          maxMs: +Math.max.apply(null, deltas).toFixed(2),
          longPct: +(deltas.filter(d => d > 33.4).length / deltas.length * 100).toFixed(1)
        });
      };
      requestAnimationFrame(frame);
    });
    const stressFx = ms => new Promise(resolve => {
      const units = document.querySelectorAll('.battle-field .battle-unit');
      if(!units.length || noFx){ resolve(null); return; }
      const t0 = performance.now();
      const deltas = [];
      let last = t0;
      const frame = () => {
        const now = performance.now();
        deltas.push(now - last);
        last = now;
        for(let i = 0; i < 12; i++){
          const el = units[i % units.length];
          FX.float(el, '-' + (100 + i), { cls: i % 3 === 0 ? 'crit' : '' });
          if(i % 2 === 0) FX.flash(el, i % 4 === 0);
          if(i === 5) FX.burst(el, 'hsl(20 80% 60%)', 20);
          if(i === 7) FX.shake(i % 2 ? 'crit' : 'light');
        }
        if(now - t0 < ms){ requestAnimationFrame(frame); return; }
        const sorted = deltas.slice().sort((a, b) => a - b);
        const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        resolve({
          frames: deltas.length,
          avgMs: +avg.toFixed(2),
          fps: +(1000 / avg).toFixed(1),
          p95Ms: +(sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(2),
          maxMs: +Math.max.apply(null, deltas).toFixed(2),
          floatNodes: document.querySelectorAll('.fx-float').length,
          partNodes: document.querySelectorAll('.fx-part').length
        });
      };
      requestAnimationFrame(frame);
    });
    window.__FPS__ = (async () => {
      await new Promise(r => setTimeout(r, 300));
      window.__TEST__.startBattle({ elements:['岩','火','水','草','冰'], level:20, monsterLevel:20, speed:10, seed:99 });
      const b = window.__TEST__._battle;
      /* 拉满血量：保证 6 秒里战斗不结束，全程都在出招 */
      b.B.allies.concat(b.B.monsters).forEach(u => { u.maxHp = 999999; u.hp = 999999; });
      await new Promise(r => setTimeout(r, 400));
      const out = { noFx, units: b.B.allies.length + b.B.monsters.length };
      out.battle = await sampleFrames(6000);
      out.fxLog = FX.log.length;
      out.stress = await stressFx(3000);
      out.nodes = document.querySelectorAll('*').length;
      document.title = 'FPS-DONE';
      return out;
    })();
    document.title = 'FPS-MODE';
    return;
  }

  /* 画廊：?gallery=1 渲染形态矩阵，只出图不跑检查 */
  if(qs.includes('gallery')){
    const cellHTML = (element, mood, sz, extra, label, width) => {
      const c = { h: element ? ELEMENTS[element].h : 200, s: 68, l: 50 };
      const e = { h: (c.h + 200) % 360, s: 30, l: 22 };
      const html = slimeHTMLFromColor(c, e, Object.assign({ element, mood, sz }, extra || {}));
      const k = sz || 1;
      const h = Math.round(118 * k) + 8;
      return `<div style="display:inline-block;vertical-align:top;margin:2px;width:${width||120}px;text-align:center;color:#9fb6ff;font:10px/1.4 sans-serif">` +
        `<div style="height:${h}px;display:flex;align-items:flex-end;justify-content:center;overflow:hidden">` +
        `<div style="transform:scale(${k});transform-origin:bottom center">${html}</div></div>` +
        `<div>${label||''}</div></div>`;
    };
    const els = ['岩','火','水','风','草','冰','雷','光','暗','幻','空间','时间'];
    let html = '<h3 style="color:#ffd166;font:13px sans-serif;margin:6px 2px">12 属性 × idle</h3><div>';
    els.forEach(el => { html += cellHTML(el, 'idle', 1, null, el); });
    html += '</div><h3 style="color:#ffd166;font:13px sans-serif;margin:10px 2px">表情抽样（火/水/风/岩 × idle/happy/charm/sleep）</h3><div>';
    ['火','水','风','岩'].forEach(el => ['idle','happy','charm','sleep'].forEach(m => { html += cellHTML(el, m, 1, null, el + ' · ' + m); }));
    html += '</div><h3 style="color:#ffd166;font:13px sans-serif;margin:10px 2px">缩放尺度 1.0 / .43 / .36 / .28</h3><div>';
    ['火','水','风','岩'].forEach(el => [1, 0.43, 0.36, 0.28].forEach(sz => { html += cellHTML(el, 'idle', sz, null, el + ' · ' + sz, 88); }));
    html += '</div><h3 style="color:#ffd166;font:13px sans-serif;margin:10px 2px">死亡 / 虚化 / 系统</h3><div>';
    html += cellHTML('火', 'idle', 1, { dead:true }, '火 dead');
    html += cellHTML('时间', 'idle', 1, null, '时间 ghost');
    html += cellHTML(undefined, 'idle', 1, null, '系统 sys');
    html += '</div>';
    const g = document.createElement('div');
    g.id = 'galleryGrid';
    g.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0e0b18;overflow:auto;padding:8px 8px 40px';
    g.innerHTML = html;
    document.body.appendChild(g);
    out.remove();
    document.title = 'GALLERY';
    return;
  }

  (async function runAll(){
    await new Promise(r => setTimeout(r, 0));
    let pass = 0, fail = 0;
    if(!CHECKS.length) emit('NO_CHECKS');
    for(const [name, fn] of CHECKS){
      try{
        const r = await Promise.race([
          Promise.resolve().then(fn),
          new Promise((_, rej)=>setTimeout(()=>rej(new Error('超时 8000ms')), 8000))
        ]);
        if(r === false) throw new Error('返回 false');
        pass++; emit('PASS ' + name);
      }catch(e){
        fail++; emit('FAIL ' + name + ': ' + ((e && e.message) || e));
      }
    }
    document.title = (fail === 0 && pass > 0 ? 'PASS ' : 'FAIL ') + pass + '/' + (pass + fail);
    emit('RESULT ' + document.title);
  })();
})();
