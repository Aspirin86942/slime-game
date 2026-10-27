function renderStatus(){
  const need = summonerNeed(S.level);
  const pct = S.breakPending ? 100 : Math.min(100, S.summonerExp / need * 100);
  const taskRows = Object.keys(TASK_DEFS).map(k=>{
    const def = TASK_DEFS[k];
    const prog = Math.min(S.tasks[k]||0, def.need);
    const done = S.taskClaimed[k];
    return `<div class="task-row">
      <div>
        <div class="task-name">${def.name}${done?'<span class="task-done">✓ 已完成</span>':''}</div>
        <div class="task-desc">${def.desc}（${prog}/${def.need}）</div>
      </div>
      <div class="task-reward">+${def.reward} ⭐</div>
    </div>`;
  }).join('');

  return `
  <div class="panel">
    <div class="profile">
      <div class="avatar">✦</div>
      <div style="flex:1;min-width:0;">
        <div class="pname">${esc(S.name)}</div>
        <div class="psub">Lv.${S.level} · 史莱姆召唤师 · 召唤位 ${getSlots()}</div>
        <div class="barwrap" style="margin-top:9px;max-width:230px;">
          <div class="bar"><i style="width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--accent2))"></i></div>
          <span class="barlabel">经验 <b>${S.breakPending?'MAX':Math.floor(S.summonerExp)+'/'+need}</b></span>
        </div>
        ${S.breakPending
          ? `<button class="btn gold full" data-act="breakthrough" style="margin-top:10px;">⚡ 突破境界（Lv.${S.level} → Lv.${S.level+1}）</button>`
          : `<p class="muted small" style="margin-top:8px;">史莱姆获得经验的10% 供给召唤师。<br>每提升 10 级增加 1 个召唤位，整十级时需要手动突破。</p>`}
      </div>
    </div>
  </div>

  <div class="panel">
    <h3>系统任务 <span style="float:right;color:var(--gold);font-size:13px;">${uiIcon('star')} ${S.points}</span></h3>
    <p class="muted small" style="margin-bottom:4px;">每日重置 · 完成可获得系统积分</p>
    ${taskRows}
  </div>

  <button class="settings-row" data-act="settings"><span class="settings-row-text">界面主题<small>切换配色，伙伴外观不变</small></span></button>`;
}

function renderSummon(){
  const slots = getSlots();
  const full = S.slimes.length >= slots;
  const boostKeys = Object.keys(summonBoost);
  const boostText = boostKeys.length
    ? boostKeys.map(k=>`${k}+${summonBoost[k]}`).join('，')
    : '无';
  return `
  <div class="panel center summon-panel">
    <h2>史莱姆召唤</h2>
    <p class="muted">一点微光，一位即将相遇的伙伴。</p>
    ${summonAltar()}
    <div class="summon-capacity"><span>伙伴席位</span><b>${S.slimes.length} / ${slots}</b></div>
    <button class="btn big gold" data-act="summon" ${full||S.coins<summonCost()?'disabled':''}>
      ${full?'召唤空间已满':`迎接新伙伴 · ${summonCost()?summonCost()+' 晶币':'免费'}`}
    </button>
    ${full?'<p class="muted small">提升召唤师等级，可以解锁更多伙伴席位。</p>':''}
    <p class="muted small summon-pity">再召唤 ${summonPityLeft()} 次内必得稀有元素（光/暗/空间/时间）</p>
    <details class="rules-details"><summary>了解属性与召唤概率</summary><p>岩、火、水、风较常见；草、冰、雷、幻较稀有；光、暗稀有；空间、时间极为罕见。</p></details>
  </div>

  <div class="panel">
    <h3>${uiIcon('gem')} 献祭天材地宝</h3>
    <p class="muted small">消耗1个天材地宝，小幅提升对应属性史莱姆的召唤概率（仅对下一次召唤有效）。</p>
    <div class="boost-grid">
      ${ELEMENT_KEYS.map(el=>`<button class="boost-btn" data-act="boost" data-element="${el}" aria-pressed="${!!summonBoost[el]}">
        ${elementIcon(el)}${el}${summonBoost[el]?`+${summonBoost[el]}`:''}
      </button>`).join('')}
    </div>
    <p class="muted small" style="margin-top:8px;">当前加成：${boostText}　｜　天材地宝 ×${S.bag.treasure}</p>
  </div>

  <div class="panel">
    <h3>${uiIcon('spark')} 史莱姆合体</h3>
    <p class="muted small">主宠延续原有身份与成长，副宠会永久消耗。确认前可以查看继承、变异概率和费用。</p>
    <details class="rules-details"><summary>合体规则与费用</summary><p>主宠保留名字、ID、亲密度、经验和已有属性，等级取较高者；副宠永久消耗。珍爱锁定宠物不能作为副宠。</p><p>合体需晶币：500 + 100 × 较高等级 + 250 × 主宠融合次数 ×（次数 + 1），随次数递增。合体与升级使用同一成长规则，同级无变异不会凭空翻倍。</p></details>
    <button class="btn full" data-act="mergeopen">开始合体</button>
  </div>`;
}

function mapLandmarks(map){
  const id='landscape-'+(++sceneArtId),snow=map.id==='snow',dusk=map.id==='dusk';
  const c=snow?['#e6eff0','#afc9d0','#8ba9b5','#c4d8d8','#a5bfc7','#eef3e7']:
    dusk?['#e8c2aa','#ad9ca7','#8a7e94','#8d8c83','#555f68','#edc6a5']:
    ['#d3e0d1','#99b9b1','#6b9790','#8eac8a','#426e66','#e0dfb5'];
  const landmark=snow?`<path d="M337 222q15-104 112-96 80 5 91 101" fill="#829fa9"/><path d="M377 224q9-69 64-67 57 2 63 70" fill="#3f6274"/><path d="M340 171q29-63 100-55 66 4 89 56l-31-3-15 12-25-14-27 11-28-12-30 14Z" fill="#e9f2ed"/><path d="m61 222 29-103 30 103m18 0 23-81 26 81" fill="#759891"/><path d="m72 181 18-62 18 62-18-9Z" fill="#e9f1e7"/>`:
    dusk?`<g stroke="#b4a395" stroke-width="3"><path d="M65 222V119h25v103m68 0V119h25v103M57 113h134v19H57m33-19q34-54 68 0" fill="#7a7786"/><path d="M58 220h135v11H58m239-2 11-70 31-5 17 75m-49-39 40-5" fill="#727382"/></g><path d="M496 227V118m0 30-30-24m30 42 33-33" stroke="#6a6875" stroke-width="8" fill="none"/><path d="m237 228 22-18 17 18m100 0 21-23 22 23" fill="#8b8b88"/>`:
    `<g stroke="#776e59" stroke-width="8" stroke-linecap="round"><path d="M94 221V102m0 50-30-23m30 41 27-28M455 221V117m0 52-26-24m26 38 24-25"/></g><g fill="url(#${id}-leaves)"><path d="M24 130q-10-38 27-49-4-41 41-45 39-2 49 42 43 5 38 46-63 39-155 6Z"/><path d="M390 150q-7-31 25-40-3-36 33-39 38-1 44 34 39 8 31 40-54 33-133 5Z"/></g><path d="M46 105q17-30 48-23m-31-19q22-17 43-5m312 63q19-21 44-17" fill="none" stroke="#c8d3a6" stroke-opacity=".4" stroke-width="8" stroke-linecap="round"/><path d="M263 225v-44m-17-1h43l-9 18h-34Z" fill="#b6a581" stroke="#7e8268" stroke-width="3"/>`;
  return `<svg class="scene-landmarks" viewBox="0 0 600 280" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient>
    <linearGradient id="${id}-ground" x2="0" y2="1"><stop stop-color="${c[3]}"/><stop offset="1" stop-color="${c[4]}"/></linearGradient>
    <linearGradient id="${id}-leaves" x2=".4" y2="1"><stop stop-color="#91b792"/><stop offset=".55" stop-color="#5c927c"/><stop offset="1" stop-color="#47776a"/></linearGradient>
    <radialGradient id="${id}-sun"><stop stop-color="${c[5]}" stop-opacity=".9"/><stop offset=".25" stop-color="${c[5]}" stop-opacity=".65"/><stop offset="1" stop-color="${c[5]}" stop-opacity="0"/></radialGradient>
    <pattern id="${id}-grain" width="23" height="19" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r=".7" fill="#fff" opacity=".23"/><circle cx="16" cy="13" r=".6" fill="#152f39" opacity=".15"/></pattern></defs>
    <path d="M0 0h600v280H0Z" fill="url(#${id}-sky)"/>
    <circle cx="430" cy="58" r="91" fill="url(#${id}-sun)"/><circle cx="430" cy="58" r="${dusk?24:17}" fill="${c[5]}" opacity=".85"/>
    <g class="landmark-back" fill="${c[2]}"><path d="M0 164 84 88 170 169 281 69 397 166 500 93 600 164V280H0Z" opacity=".32"/><path d="M0 192q102-76 220-18t213-13 167 31v88H0Z" opacity=".5"/>${snow?'<path d="m237 109 44-40 40 38-23-7-13 13-16-12Z" fill="#f4f6eb" opacity=".7"/>':''}</g>
    <path d="M0 213q93-24 185 2t192-3 223 1v67H0Z" fill="url(#${id}-ground)"/>
    <path d="M0 244q130 20 268-1t332 1" fill="none" stroke="${c[5]}" stroke-width="23" opacity=".22"/>
    <g class="landmark-front">${landmark}</g>
    <g fill="${c[4]}" opacity=".3"><ellipse cx="96" cy="225" rx="61" ry="7"/><ellipse cx="455" cy="225" rx="52" ry="7"/></g>
    <g fill="${c[5]}" opacity=".75"><circle cx="211" cy="225" r="2"/><circle cx="219" cy="229" r="2"/><circle cx="384" cy="243" r="2"/><circle cx="389" cy="238" r="2"/></g>
    <g fill="none" stroke="${c[4]}" stroke-width="2" opacity=".5"><path d="m21 257 3-10m-3 10-5-5m174 3 4-11m-4 11-6-6m366 4 3-11m-3 11 6-5"/></g>
    <path d="M0 274q150-8 300 0t300 0v6H0Z" fill="${c[4]}" opacity=".5"/><path d="M0 0h600v280H0Z" fill="url(#${id}-grain)"/>
  </svg>`;
}

function renderExploreScene(){
  const map = MAP_THEMES[exploreRegionIndex()];
  const dispatched = S.slimes.filter(s => isDispatched(s));
  const now = Date.now();

  function buildSlimeEl(s, i, opts){
    opts = opts || {};
    const scaleMul = opts.scaleMul || 1;
    const preferWalk = !!opts.preferWalk;
    const isJump = preferWalk ? Math.random() < 0.3 : Math.random() < 0.5;
    const nextToggle = now + 500 + Math.random() * 800;
    const sz = clamp(s.size || 1, 0.6, 1.6);
    const scale = 0.18 * sz * scaleMul;
    const w = Math.round(26 * sz * scaleMul);
    const h = Math.round(22 * sz * scaleMul);
    return `
    <div class="explore-slime ${isJump?'jumping':'walking'}"
         style="width:${w}px;height:${h}px;--ex-scale:${scale.toFixed(3)};--delay:${(i*0.2).toFixed(2)}s"
         data-sid="${s.id}"
         data-row="${opts.row || 'back'}"
         data-next-toggle="${nextToggle}">
      ${slimeHTML(s,{mood:'idle'})}
    </div>`;
  }

  let slimesHTML;
  if(!dispatched.length){
    slimesHTML = `<div class="explore-slimes" style="bottom:18%;">
      <span class="explore-empty small">暂无史莱姆在探险</span>
    </div>`;
  } else if(dispatched.length <= 5){
    slimesHTML = `<div class="explore-slimes" style="bottom:18%;">
      ${dispatched.map((s,i)=>buildSlimeEl(s,i,{row:'back'})).join('')}
    </div>`;
  } else {
    const half = Math.ceil(dispatched.length / 2);
    let rowBack = dispatched.slice(0, half);
    let rowFront = dispatched.slice(half);

    const sortedBySize = [...dispatched].sort((a,b)=>(b.size||1)-(a.size||1));
    const top3Ids = new Set(sortedBySize.slice(0,3).map(x=>x.id));
    const lastFront = rowFront[rowFront.length - 1];
    if(lastFront && top3Ids.has(lastFront.id)){
      let swapped = false;
      for(let i = rowFront.length - 2; i >= 0; i--){
        if(!top3Ids.has(rowFront[i].id)){
          const tmp = rowFront[i];
          rowFront[i] = rowFront[rowFront.length - 1];
          rowFront[rowFront.length - 1] = tmp;
          swapped = true;
          break;
        }
      }
      if(!swapped){
        for(let i = rowBack.length - 1; i >= 0; i--){
          if(!top3Ids.has(rowBack[i].id)){
            const tmp = rowBack[i];
            rowBack[i] = rowFront[rowFront.length - 1];
            rowFront[rowFront.length - 1] = tmp;
            swapped = true;
            break;
          }
        }
      }
    }

    slimesHTML = `
      <div class="explore-slimes" style="bottom:22.2%;">
        ${rowBack.map((s,i)=>buildSlimeEl(s,i,{row:'back', scaleMul:0.99})).join('')}
      </div>
      <div class="explore-slimes" style="bottom:14.4%;">
        ${rowFront.map((s,i)=>buildSlimeEl(s,i,{row:'front', scaleMul:0.8, preferWalk:true})).join('')}
      </div>`;
  }

  return `
    <div class="explore-scene" style="--sky1:${map.sky1};--sky2:${map.sky2};--grass1:${map.grass1};--grass2:${map.grass2};--soil1:${map.soil1};--soil2:${map.soil2};">
      <div class="bg-scroll">
        <div class="bg-panel">
          <div class="scene-sky"></div>
          <div class="scene-grass"></div>
          <div class="scene-soil"></div>
          ${mapLandmarks(map)}
        </div>
        <div class="bg-panel">
          <div class="scene-sky"></div>
          <div class="scene-grass"></div>
          <div class="scene-soil"></div>
          ${mapLandmarks(map)}
        </div>
      </div>
      <span class="region-label">${map.id==='snow'?'冰洞与雪峰':map.id==='dusk'?'暮色遗迹':'林间小径'}</span>
      <div class="explore-items-layer"></div>
      ${slimesHTML}
    </div>`;
}

function renderTravel(){
  if(!S.slimes.length){
    return `<div class="panel center">
      <p class="muted">还没有史莱姆伙伴，先去召唤一只吧～</p>
      <button class="btn full" data-act="goto" data-tab="summon">前往召唤</button>
    </div>${challengeCards()}${progressionGoalCards()}`;
  }
  const gp = S.globalPlan;
  const currentMap = MAP_THEMES[exploreRegionIndex()];
  return `
  <div class="panel">
    <h3 style="display:flex;align-items:center;justify-content:space-between;">野外探险 <button class="btn sm themed" data-act="cycleMap" style="padding:7px 9px;font-size:12px;">${uiIcon('map')} ${currentMap.name}</button></h3>
    <p class="muted small">派遣史莱姆自动探险，获取经验与晶币。关闭页面也会继续（最多累计 12 小时）。</p>
    <p class="muted small region-line">${MAP_THEMES.map((m,i)=>regionUnlocked(i)?`${m.name} 收益×${m.coinMul}`:`${m.name} 通关第 ${m.unlock} 层开放`).join(' · ')}</p>
    ${renderExploreScene()}
    <div class="explore-btns">
      <button class="btn ${gp==='explore'?'gold':''} explore-btn" data-act="globalplan" data-type="explore">自动探险</button>
      <button class="btn themed explore-btn" data-act="globalplan" data-type="clear" ${gp?'':'disabled'}>全部召回</button>
      <button class="btn themed explore-btn" data-act="setupTeam">设置队伍</button>
    </div>
    <p class="muted small" style="margin-top:8px;">当前状态：${gp==='explore'?'队伍已派遣 · 休息后自动继续':'未设置全局规划'} · 在陪伴空间和小游戏里也会继续</p>
    ${dispatchProgressHTML()}
  </div>

  <div class="panel">
    <h3>${uiIcon('sword')} 深渊冒险</h3>
    <p class="muted small">最多 5 只伙伴，已解锁 ${getAbyssUnlocked()}/50 层。每 5 层挑战首领，首通领取全额奖励与额外宝物；重复挑战收益 20%。失败只结算已击败敌人的 25%。</p>
    <div class="abyss-row">
      <label>怪物等级</label>
      <button class="btn sm abyss-step" data-act="abyssLevelMinus">◀</button>
      <input type="number" class="abyss-level-input" id="abyssLevelInput" min="1" max="${getAbyssUnlocked()}" value="${getAbyssLevel()}">
      <button class="btn sm abyss-step" data-act="abyssLevelPlus">▶</button>
    </div>
    <button class="btn full gold" data-act="abyssSetup" style="margin-top:10px;">进入深渊冒险</button>
    <button class="btn full themed" data-act="abyssSweep" style="margin-top:8px;" ${!highestClearedFloor() || S.sweepUsed>=SWEEP_PER_DAY?'disabled':''}>扫荡${highestClearedFloor()?'第 '+highestClearedFloor()+' 层':''} · 今日剩余 ${Math.max(0,SWEEP_PER_DAY-S.sweepUsed)}/3 次</button>
  </div>
  ${challengeCards()}
  ${progressionGoalCards()}`;
}

function renderSpace(){
  const objective=homeObjective();
  const homeHTML=`<div class="home-objective"><div style="flex:1;min-width:0"><strong>${objective.title}</strong><p class="muted">${objective.desc}</p></div><button class="btn" data-act="goto" data-tab="${objective.tab}">${objective.cta}</button></div><div class="dispatch-summary">${dispatchSummaryHTML()}</div>`;
  const isMonster = S.spaceMode === 'monster';
  const list = isMonster ? S.monsters : S.slimes;
  const idle = isMonster ? list : list.filter(s=>!isDispatched(s));

  const feed = S.feedTrough || 0;
  const feedHTML = `
    <div class="feed-trough">
      <div class="ft-left"><span class="ft-icon">${uiIcon('food')}</span><span>饲料槽</span></div>
      <div class="ft-right"><b>${feed}/99</b>
        <button class="btn sm" data-act="refill">补充饲料</button>
      </div>
    </div>`;

  const toyHTML = !isMonster ? `
    <div class="toy-bar">
      <button class="toy-btn ${selectedToy==='ball'?'on':''}" data-act="selectToy" data-toy="ball">${uiIcon('ball')} 扔皮球</button>
      <button class="toy-btn ${selectedToy==='stack'?'on':''}" data-act="selectToy" data-toy="stack">${uiIcon('stack')} 叠叠乐</button>
      <div class="toy-hint" style="${selectedToy?'':'display:none'}">${selectedToy?`已选择「${selectedToy==='ball'?'扔皮球':'叠叠乐'}」 · 点击空间中的史莱姆开始游戏`:''}</div>
    </div>` : `
    <div class="mon-item-bar">
      ${(S.monItemConfigs||[]).map((c,i)=>`<button class="mon-item-btn" data-act="monItem" data-idx="${i}" data-long="${i}">${esc(c.label)}</button>`).join('')}
    </div>
    <p class="muted small" style="margin-top:6px;">长按道具按钮可编辑按钮文本、史莱姆的反应表情、心情变化与弹窗文字。</p>`;

  const switchHTML = `
    <div class="companion-head">
      <div><h2>${isMonster?'魔物的静谧庭院':`${esc(S.name||'召唤师')}的陪伴空间`}</h2><p>${idle.length?`${idle.length} 位伙伴在这里等你`:'留一点时间，和伙伴待在一起'}</p></div>
      <button class="space-switch" data-act="toggleSpaceMode">
        ${uiIcon(isMonster?'home':'moon')}
        <span>${isMonster ? '自由活动' : '魔物空间'}</span>
      </button>
    </div>`;

  return `<div class="panel companion-panel">
    ${switchHTML}
    <div class="space-playground ${isMonster?'monster':''}" id="playground">
      ${gardenScene(isMonster)}
      ${[[16,28],[78,18],[86,64],[23,76],[56,37]].map(([x,y],i)=>`<span class="garden-firefly" style="left:${x}%;top:${y}%;--delay:${-i}s" aria-hidden="true"></span>`).join('')}
      ${!idle.length&&isMonster?'<div class="garden-empty">庭院正等着新的住客。<br>在深渊中使用捕捉网，带一位伙伴回来。</div>':''}
      <div class="garden-caption">轻触抚摸 · 拖动陪伴</div>
    </div>
    <div class="home-care">${feedHTML}${toyHTML}</div>
    ${homeHTML}
    <div class="companion-roster">
    ${idle.length?'<h3>身边的伙伴</h3>':''}
    <div class="minigrid four">
      ${idle.map(s=>`
        <div class="minicard" data-act="detail" data-id="${s.id}" data-mon="${isMonster?1:0}">
          <div class="scale-box sm">${slimeHTML(s,{mood:'idle'})}</div>
          <div class="mc-name">${esc(s.name)}</div>
          <div class="mc-tag">Lv.${s.level}</div>
          <span class="bond-chip">${uiIcon('heart')}${bondMilestone(s).name}</span>
        </div>`).join('')}
    </div></div></div>`;
}

function initPlayground(){
  const pg = $('#playground');
  if(!pg) return;
  plSlimes.forEach(p=>{
    if(p.timer) clearInterval(p.timer);
    if(p.bubbleTimer) clearInterval(p.bubbleTimer);
  });
  plSlimes = [];

  const isMonster = S.spaceMode === 'monster';
  const idle = isMonster ? S.monsters : S.slimes.filter(s=>!isDispatched(s));
  const sprites = isMonster ? idle.slice() : idle.concat([getSystemSlimeObj()]);
  const mainMoods = ['idle','jump','crawl','sleep','look'];
  const placed = [];
  const pgW = pg.clientWidth || 340, pgH = pg.clientHeight || 380;
  let suppressClick = false;

  const MAX_DISP_SCALE = 0.43 * 1.6;
  const NON_SYS_SCALE = 0.72; /* 非系统史莱姆缩小比例 */
  const maxSizeInSpace = sprites.length
    ? Math.max(...sprites.map(x=>clamp(x.size || 1, 0.6, 1.6)))
    : 1;

  function rectCircleHit(cx, cy, w, h, ox, oy, r){
    const left = cx - w/2, right = cx + w/2;
    const top = cy - h/2, bottom = cy + h/2;
    const px = clamp(ox, left, right);
    const py = clamp(oy, top, bottom);
    const dx = px - ox, dy = py - oy;
    return (dx*dx + dy*dy) < r*r;
  }

  function resolveAirWalls(){
    for(let iter = 0; iter < 8; iter++){
      let moved = false;
      for(let i=0;i<plSlimes.length;i++){
        for(let j=i+1;j<plSlimes.length;j++){
          const A = plSlimes[i], B = plSlimes[j];
          if(A.el.classList.contains('dragging') || B.el.classList.contains('dragging')) continue;
          const aw = 140 * A.dispScale, ah = 118 * A.dispScale;
          const bw = 140 * B.dispScale, bh = 118 * B.dispScale;
          const ax = A.x/100*pgW, ay = A.y/100*pgH;
          const bx = B.x/100*pgW, by = B.y/100*pgH;

          if(rectCircleHit(ax, ay, aw, ah, bx, by, B.airR)){
            const dx = ax - bx, dy = ay - by;
            const dist = Math.hypot(dx, dy) || 1;
            const px = clamp(bx, ax-aw/2, ax+aw/2);
            const py = clamp(by, ay-ah/2, ay+ah/2);
            const d2 = Math.hypot(px-bx, py-by);
            const push = Math.max(1, B.airR - d2 + 1);
            A.x = clamp(A.x + (dx/dist)*push/pgW*100, A.minX, A.maxX);
            A.y = clamp(A.y + (dy/dist)*push/pgH*100, A.minY, A.maxY);
            A.el.style.left = A.x + '%';
            A.el.style.top = A.y + '%';
            moved = true;
          }
          if(rectCircleHit(bx, by, bw, bh, ax, ay, A.airR)){
            const dx = bx - ax, dy = by - ay;
            const dist = Math.hypot(dx, dy) || 1;
            const px = clamp(ax, bx-bw/2, bx+bw/2);
            const py = clamp(ay, by-bh/2, by+bh/2);
            const d2 = Math.hypot(px-ax, py-ay);
            const push = Math.max(1, A.airR - d2 + 1);
            B.x = clamp(B.x + (dx/dist)*push/pgW*100, B.minX, B.maxX);
            B.y = clamp(B.y + (dy/dist)*push/pgH*100, B.minY, B.maxY);
            B.el.style.left = B.x + '%';
            B.el.style.top = B.y + '%';
            moved = true;
          }
        }
      }
      if(!moved) break;
    }
  }

  sprites.forEach((s,i)=>{
    const ratio = clamp((s.size || 1) / maxSizeInSpace, 0.2, 1);
    const baseScale = s.isSystem ? 1 : NON_SYS_SCALE;
    const dispScale = MAX_DISP_SCALE * ratio * baseScale;
    const imgW = 140 * dispScale;
    const imgH = 118 * dispScale;
    const airD = imgW * 0.65;
    const airR = airD / 2;
    const halfW = imgW / 2;
    const halfH = imgH / 2;
    const padX = halfW / pgW * 100;
    const padY = halfH / pgH * 100;
    const minX = padX + 0.5, maxX = 100 - padX - 0.5;
    const minY = padY + 0.5, maxY = 100 - padY - 0.5;

    const findFreePos = () => {
      for(let tries=0; tries<80; tries++){
        const x = rnd(minX, maxX);
        const y = rnd(minY, maxY);
        let ok = true;
        for(const p of placed){
          const dx = (x-p.x)*pgW/100, dy = (y-p.y)*pgH/100;
          const minD = airR + p.airR;
          if(Math.sqrt(dx*dx+dy*dy) < minD){ ok=false; break; }
        }
        if(ok) return {x,y};
      }
      return {x:(minX+maxX)/2, y:(minY+maxY)/2};
    };

    const pos = findFreePos();
    placed.push({x:pos.x,y:pos.y,airR});
    const el = document.createElement('div');
    el.className = 'pl-slime';
    el.style.setProperty('--pet-scale',dispScale);
    el.dataset.id = s.id;
    el.dataset.mon = isMonster ? 1 : 0;
    el.innerHTML = slimeHTML(s,{mood:'idle'}) + (!s.isSystem && (s.intimacy||0)>=30 ? `<span class="bond-badge" title="挚友 · 亲密度 ${s.intimacy}">${uiIcon('heart')}</span>` : '');
    const slInit = el.querySelector('.slime');
    if(slInit) slInit.style.transform = `scale(${dispScale.toFixed(3)})`;
    const airWall = document.createElement('div');
    airWall.className = 'air-wall';
    airWall.style.width = airD.toFixed(2) + 'px';
    airWall.style.height = airD.toFixed(2) + 'px';
    el.appendChild(airWall);
    el.style.left = pos.x+'%';
    el.style.top = pos.y+'%';
    pg.appendChild(el);
    const obj = {el, timer:null, bubbleTimer:null, x:pos.x, y:pos.y, sid:s.id, minX, maxX, minY, maxY, dispScale, airR};

    let bubbleEl = document.createElement('div');
    bubbleEl.className = 'sys-bubble';
    el.appendChild(bubbleEl);
    if(s.isSystem || (s.intimacy||0)>=30){
      const showLine = ()=>{
        if(!bubbleEl.isConnected) return;
        if(el.classList.contains('dragging')) return;
        bubbleEl.textContent = s.isSystem ? pick(SYS_QUOTES) : `${s.name}：${bondMilestone(s).response}`;
        bubbleEl.classList.add('show');
        /* 窄屏防裁切：气泡默认以史莱姆为水平中心，靠近左右边缘时整体平移回可视区内 */
        const box = el.getBoundingClientRect(), pgBox = pg.getBoundingClientRect();
        const edge = 6, bw = bubbleEl.offsetWidth, bh = bubbleEl.offsetHeight;
        /* 头顶放不下就翻到脚下 */
        bubbleEl.classList.toggle('below', box.top + 14 - bh < pgBox.top + edge);
        const center = box.left + box.width/2, half = bw/2;
        let shift = 0;
        if(center - half < pgBox.left + edge) shift = (pgBox.left + edge) - (center - half);
        else if(center + half > pgBox.right - edge) shift = (pgBox.right - edge) - (center + half);
        bubbleEl.style.marginLeft = shift ? shift.toFixed(1) + 'px' : '';
        clearTimeout(bubbleEl._t);
        bubbleEl._t = setTimeout(()=>{ if(bubbleEl.isConnected) bubbleEl.classList.remove('show'); }, 2600);
      };
      setTimeout(showLine, 1500);
      obj.bubbleTimer = setInterval(showLine, 9000);
    }

    const move = (targetX, targetY)=>{
      const oldIdx = placed.findIndex(p=>p.x===obj.x && p.y===obj.y);
      if(oldIdx>=0) placed.splice(oldIdx,1);

      let np = {x: targetX, y: targetY};
      if(targetX === undefined) {
          np = findFreePos();
      } else {
          np.x = clamp(np.x, minX, maxX);
          np.y = clamp(np.y, minY, maxY);
      }

      obj.x = np.x; obj.y = np.y;
      placed.push({x:np.x,y:np.y,airR});
      const slimeEl = el.querySelector('.slime');
      if(slimeEl){
          slimeEl.dataset.mood = Math.random() < 0.5 ? 'jump' : 'crawl';
          setTimeout(()=>{ if(slimeEl.isConnected) slimeEl.dataset.mood = 'idle'; }, 800);
      }
      el.style.left = np.x+'%';
      el.style.top = np.y+'%';
      resolveAirWalls();
    };

    obj.timer = setInterval(()=>{
      if(activeTab !== 'space') return;
      if(el.classList.contains('dragging')) return;
      if(el.classList.contains('tracking')) return;
      if(ballGame && ballGame.running && ballGame.slime.id === s.id) return;
      const slimeEl = el.querySelector('.slime');
      if(!slimeEl) return;
      const r = Math.random();
      if(r < 0.08){
        slimeEl.dataset.mood = 'happy';
        setTimeout(()=>{
          if(slimeEl && slimeEl.dataset.mood==='happy' && activeTab==='space') slimeEl.dataset.mood = 'idle';
        }, 2000);
      } else {
        const m = pick(mainMoods);
        slimeEl.dataset.mood = m;
        if(m==='crawl' || m==='jump') move(undefined, undefined);
      }
    }, 2400 + i*300);

    let drag = null;
    el.addEventListener('pointerdown', ev=>{
      ev.preventDefault();
      ev.stopPropagation();
      drag = { startX: ev.clientX, startY: ev.clientY, lastX: ev.clientX, lastY: ev.clientY, moved:false, velocity:0, sysBubbleShown:false };
      el.classList.add('dragging');
      const idx = placed.findIndex(p=>p.x===obj.x && p.y===obj.y);
      if(idx>=0) placed.splice(idx,1);
      try{ el.setPointerCapture(ev.pointerId); }catch(e){}
    });
    el.addEventListener('pointermove', ev=>{
      if(!drag) return;
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      if(Math.abs(dx) > 6 || Math.abs(dy) > 6) drag.moved = true;
      if(!drag.moved) return;
      /* 系统史莱姆被拖拽：显示拖拽语录 */
      if(s.isSystem && bubbleEl && !drag.sysBubbleShown){
        drag.sysBubbleShown = true;
        bubbleEl.textContent = pick(SYS_DRAG_QUOTES);
        bubbleEl.classList.add('show');
        clearTimeout(bubbleEl._t);
      }
      const pgRect = pg.getBoundingClientRect();
      let px = ((ev.clientX - pgRect.left) / pgRect.width) * 100;
      let py = ((ev.clientY - pgRect.top) / pgRect.height) * 100;
      px = clamp(px, minX, maxX);
      py = clamp(py, minY, maxY);
      obj.x = px; obj.y = py;
      el.style.left = px + '%';
      el.style.top = py + '%';
      const mdx = ev.clientX - drag.lastX;
      drag.velocity = drag.velocity * 0.6 + mdx * 0.4;
      drag.lastX = ev.clientX;
      drag.lastY = ev.clientY;
      const angle = clamp(drag.velocity * 4, -50, 50);
      const slimeEl = el.querySelector('.slime');
      if(slimeEl){
        slimeEl.dataset.mood = 'swing';
        slimeEl.style.transform = `scale(${dispScale}) rotate(${angle}deg)`;
        slimeEl.style.transition = 'transform .05s ease-out';
      }
    });
    el.addEventListener('pointerup', ()=>{
      if(!drag) return;
      const wasMoved = drag.moved;
      el.classList.remove('dragging');
      placed.push({x:obj.x, y:obj.y, airR});
      const slimeEl = el.querySelector('.slime');
      if(slimeEl){
        slimeEl.style.transform = `scale(${dispScale})`;
        slimeEl.style.transition = 'transform .2s ease-out';
        if(slimeEl.dataset.mood === 'swing') slimeEl.dataset.mood = 'idle';
      }
      if(s.isSystem && bubbleEl){
        bubbleEl.classList.remove('show');
      }
      drag = null;
      if(wasMoved){
        suppressClick = true;
        setTimeout(()=>{ suppressClick = false; }, 160);
      }
    });
    el.addEventListener('pointercancel', ()=>{
      if(!drag) return;
      el.classList.remove('dragging');
      placed.push({x:obj.x, y:obj.y, airR});
      const slimeEl = el.querySelector('.slime');
      if(slimeEl){
        slimeEl.style.transform = `scale(${dispScale})`;
        slimeEl.style.transition = 'transform .2s ease-out';
        if(slimeEl.dataset.mood === 'swing') slimeEl.dataset.mood = 'idle';
      }
      if(s.isSystem && bubbleEl){
        bubbleEl.classList.remove('show');
      }
      drag = null;
    });

    el.addEventListener('click', ()=>{
      if(suppressClick) return;
      if(!isMonster && selectedToy === 'ball'){ startBallGame(s); return; }
      const slimeEl = el.querySelector('.slime');
      if(slimeEl) slimeEl.dataset.mood = 'happy';
      setTimeout(()=>{
        if(slimeEl && slimeEl.dataset.mood==='happy') slimeEl.dataset.mood = 'idle';
      }, 2600);
      if(s.isSystem){
        if(bubbleEl){
          bubbleEl.textContent = pick(SYS_QUOTES);
          bubbleEl.classList.add('show');
          clearTimeout(bubbleEl._t);
          bubbleEl._t = setTimeout(()=>{ if(bubbleEl.isConnected) bubbleEl.classList.remove('show'); }, 2600);
        }
        return;
      }
      s.mood = clamp(s.mood + 10, 0, 100);
      addTaskProgress('pet', 1);
      const bondGain=gainCompanionIntimacy(s,Date.now());
      const before=bondGain.before,bond=bondGain.bond,canBond=bondGain.gained;
      if(slimeEl)slimeEl.dataset.mood=bond.face;
      if(bubbleEl){bubbleEl.textContent=bond.response;bubbleEl.classList.add('show');clearTimeout(bubbleEl._t);bubbleEl._t=setTimeout(()=>bubbleEl.classList.remove('show'),3000);}
      showFloat(el,canBond?'心情+10 · 亲密+1':'心情+10');
      if(bond.need>before.need){toast(`${s.name} 和你成为「${bond.name}」！`, 'good');if(bond.need>=30&&!el.querySelector('.bond-badge'))el.insertAdjacentHTML('beforeend',`<span class="bond-badge" title="挚友">${uiIcon('heart')}</span>`);}
      if(slimeEl)setTimeout(()=>{if(slimeEl.isConnected)slimeEl.dataset.mood='idle';},2800);
      save();
    });

    plSlimes.push(obj);
  });

  let trackMove = false;
  let lastTrackTime = 0;

  function handleTrack(ev) {
    const now = Date.now();
    if(now - lastTrackTime < 150) return;
    lastTrackTime = now;

    const rect = pg.getBoundingClientRect();
    const clickX = ((ev.clientX - rect.left) / rect.width) * 100;
    const clickY = ((ev.clientY - rect.top) / rect.height) * 100;

    const items = [];
    plSlimes.forEach(p => {
      if(p.el.classList.contains('dragging')) return;
      const s = isMonster ? S.monsters.find(x => x.id === p.sid) : S.slimes.find(x => x.id === p.sid);
      if (s && (s.intimacy || 0) >= 5) {
        items.push({
          p,
          x: clamp(clickX + rnd(-5, 5), p.minX, p.maxX),
          y: clamp(clickY + rnd(-5, 5), p.minY, p.maxY)
        });
      }
    });

    for(let iter = 0; iter < 12; iter++){
      let moved = false;
      for(let i = 0; i < items.length; i++){
        for(let j = i + 1; j < items.length; j++){
          const A = items[i], B = items[j];
          const dxPx = (B.x - A.x) * pgW / 100;
          const dyPx = (B.y - A.y) * pgH / 100;
          const d = Math.hypot(dxPx, dyPx);
          const minD = A.p.airR + B.p.airR;
          if(d >= minD) continue;
          const ux = d > 0.001 ? dxPx / d : (Math.random() < 0.5 ? -1 : 1);
          const uy = d > 0.001 ? dyPx / d : (Math.random() < 0.5 ? -1 : 1);
          const push = (minD - d) / 2 + 0.6;
          A.x = clamp(A.x - ux * push / pgW * 100, A.p.minX, A.p.maxX);
          A.y = clamp(A.y - uy * push / pgH * 100, A.p.minY, A.p.maxY);
          B.x = clamp(B.x + ux * push / pgW * 100, B.p.minX, B.p.maxX);
          B.y = clamp(B.y + uy * push / pgH * 100, B.p.minY, B.p.maxY);
          moved = true;
        }
      }
      if(!moved) break;
    }

    items.forEach(it => {
      const x = clamp(it.x, it.p.minX, it.p.maxX);
      const y = clamp(it.y, it.p.minY, it.p.maxY);
      moveEl(it.p, x, y);
    });
    resolveAirWalls();
  }

  function moveEl(p, tx, ty) {
    const targetX = clamp(tx, p.minX, p.maxX);
    const targetY = clamp(ty, p.minY, p.maxY);
    p.x = targetX; p.y = targetY;
    p.el.classList.toggle('tracking', trackMove);
    p.el.style.left = targetX + '%';
    p.el.style.top = targetY + '%';

    const slimeEl = p.el.querySelector('.slime');
    if (slimeEl) {
      if (trackMove) {
        slimeEl.dataset.mood = 'jump';
        clearTimeout(slimeEl._moveTimer);
        slimeEl._moveTimer = null;
      } else {
        slimeEl.dataset.mood = Math.random() < 0.5 ? 'jump' : 'crawl';
        clearTimeout(slimeEl._moveTimer);
        slimeEl._moveTimer = setTimeout(() => {
          if (slimeEl.isConnected) slimeEl.dataset.mood = 'idle';
        }, 800);
      }
    }
  }

  function stopTracking(){
    trackMove = false;
    plSlimes.forEach(p=>{
      p.el.classList.remove('tracking');
      const slimeEl = p.el.querySelector('.slime');
      if(slimeEl){
        clearTimeout(slimeEl._moveTimer);
        slimeEl._moveTimer = null;
        slimeEl.dataset.mood = 'idle';
      }
    });
  }

  pg.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('.pl-slime')) return;
    trackMove = true;
    handleTrack(ev);
  });

  pg.addEventListener('pointermove', (ev) => {
    if (!trackMove) return;
    handleTrack(ev);
  });

  pg.addEventListener('pointerup', stopTracking);
  pg.addEventListener('pointercancel', stopTracking);
  pg.addEventListener('pointerleave', stopTracking);
}

function showFloat(el, text, topOffset){
  const pg = $('#playground');
  if(!pg) return;
  const r = el.getBoundingClientRect();
  const p = pg.getBoundingClientRect();
  const x = r.left - p.left + r.width/2;
  const y = r.top - p.top + (topOffset||0);
  const d = document.createElement('div');
  d.className = 'float-text';
  d.textContent = text;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  pg.appendChild(d);
  setTimeout(()=>d.remove(), 1350);
}

function refillTrough(){
  if(S.feedTrough >= 99){ toast('饲料槽已满（99包）'); return; }
  if((S.bag.food||0) <= 0){ toast('背包中没有饲料，请先购买'); return; }
  const n = Math.min(S.bag.food, 99 - S.feedTrough);
  S.bag.food -= n;
  S.feedTrough += n;
  save(); renderTab();
  toast(`补充了 ${n} 包饲料\n饲料槽：${S.feedTrough}/99`, 'good');
}

function renderBag(){
  return Object.keys(ITEMS).map(k=>{
    const it = ITEMS[k];
    const priceText = k==='ticket' ? `${it.price}积分` : `${it.price}晶币`;
    const price10 = k==='ticket' ? `${it.price*10}积分` : `${it.price*10}晶币`;
    const owned = S.bag[k] || 0;
    return `<div class="panel item-row">
      <div class="item-icon">${itemIcon(k)}</div>
      <div class="item-info">
        <div class="item-name">${it.name} <span class="owned">×${owned}</span></div>
        <div class="muted small" style="margin:3px 0 0;">${it.desc}</div>
      </div>
      <div class="item-buy-col">
        <button class="btn sm" data-act="buy" data-item="${k}">${priceText}</button>
        <button class="btn sm gold" data-act="buy10" data-item="${k}">买10个 · ${price10}</button>
      </div>
    </div>`;
  }).join('') + `<div class="panel"><p class="muted small">提示：在【空间】中点击史莱姆，即可使用背包中的道具。饲料也可以在空间饲料槽中补充。词条抽取券仅可使用系统积分购买，系统积分通过完成系统任务获得。</p></div>`;
}

function getSlime(id){ return S.slimes.find(s=>s.id===id) || S.monsters.find(s=>s.id===id); }

/* 对等级最低的史莱姆自动使用经验药水（静默），无史莱姆返回 false */
function autoUseExpPotionSilent(){
  if(!S.slimes.length) return false;
  let target = S.slimes[0];
  for(const s of S.slimes){ if(s.level < target.level) target = s; }
  addExp(target, potionExp(target));
  return true;
}
/* 经验药水按等级给经验：始终约等于 0.5 级，不会在高等级时失效 */
function potionExp(s){ return Math.round(slimeExpNeed(s.level) * 0.5); }

