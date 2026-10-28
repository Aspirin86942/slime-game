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
    <div class="summon-pity"><div class="pity-track" aria-hidden="true">${Array.from({length:SUMMON_PITY},(_,i)=>`<i class="${i<SUMMON_PITY-summonPityLeft()?'on':''}"></i>`).join('')}</div><p class="muted small">再召唤 ${summonPityLeft()} 次内必得稀有元素（光/暗/空间/时间）</p></div>
    <details class="rules-details"><summary>了解属性与召唤概率</summary><p>岩、火、水、风较常见；草、冰、雷、幻较稀有；光、暗稀有；空间、时间极为罕见。</p></details>
  </div>

  <div class="panel">
    <h3>${uiIcon('gem')} 献祭天材地宝</h3>
    <p class="muted small">消耗1个天材地宝，小幅提升对应属性史莱姆的召唤概率（仅对下一次召唤有效）。</p>
    <div class="boost-grid">
      ${ELEMENT_KEYS.map(el=>`<button class="boost-btn" data-act="boost" data-element="${el}" aria-pressed="${!!summonBoost[el]}" style="--el-h:${ELEMENTS[el].h}">
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
  /* 色板：天顶、地平线、远山、地面亮部、地面暗部、光源。草原是白天的淡紫晴空，黄昏由紫转桃，雪原偏冷蓝 */
  const c=snow?['#9fb3df','#e4edf2','#8fa9bf','#e6eff1','#8fa8bb','#f7f1df']:
    dusk?['#6c639f','#f2b996','#7a6688','#a88a72','#4a4358','#ffd49c']:
    ['#a9b8e6','#e2e8d4','#7ea69a','#9cc69c','#4a7b68','#f6e9c2'];
  /* 画布按容器拉伸，圆会被纵向拉长；月亮用纵向压扁的椭圆抵消手机上的典型比例 */
  const moons=`<ellipse cx="${dusk?262:470}" cy="${dusk?46:40}" rx="15" ry="13" fill="#f6ead0" opacity="${dusk?.85:.6}"/><ellipse cx="${dusk?230:432}" cy="${dusk?30:24}" rx="6" ry="5.3" fill="#e4ebfb" opacity="${dusk?.8:.5}"/>`;
  const islets=[[60,70,.42],[214,40,.26]].map(([x,y,k])=>`<g transform="translate(${x} ${y}) scale(${k})" opacity=".5"><path d="M0 14C20 4 80 2 100 14C86 30 62 46 50 70C38 46 14 30 0 14Z" fill="${c[2]}"/><path d="M0 14C20 4 80 2 100 14C70 20 30 20 0 14Z" fill="${c[3]}"/></g>`).join('');
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
    ${dusk?`<circle cx="430" cy="150" r="120" fill="url(#${id}-sun)"/><ellipse cx="430" cy="150" rx="30" ry="26" fill="${c[5]}" opacity=".9"/>`:''}${moons}${islets}
    <g class="landmark-back" fill="${c[2]}"><path d="M0 164 84 88 170 169 281 69 397 166 500 93 600 164V280H0Z" opacity=".32"/><path d="M0 192q102-76 220-18t213-13 167 31v88H0Z" opacity=".5"/>${snow?'<path d="m237 109 44-40 40 38-23-7-13 13-16-12Z" fill="#f4f6eb" opacity=".7"/>':''}</g>
    <path d="M0 213q93-24 185 2t192-3 223 1v67H0Z" fill="url(#${id}-ground)"/>
    <path d="M0 244q130 20 268-1t332 1" fill="none" stroke="${c[5]}" stroke-width="23" opacity=".22"/>
    <g class="landmark-front">${landmark}</g>
    <g fill="${c[4]}" opacity=".3"><ellipse cx="96" cy="225" rx="61" ry="7"/><ellipse cx="455" cy="225" rx="52" ry="7"/></g>
    <g fill="${c[5]}" opacity=".75"><circle cx="211" cy="225" r="2"/><circle cx="219" cy="229" r="2"/><circle cx="384" cy="243" r="2"/><circle cx="389" cy="238" r="2"/></g>
    <g fill="none" stroke="${c[4]}" stroke-width="2" opacity=".5"><path d="m21 257 3-10m-3 10-5-5m174 3 4-11m-4 11-6-6m366 4 3-11m-3 11 6-5"/></g>
    <path d="M0 274q150-8 300 0t300 0v6H0Z" fill="${c[4]}" opacity=".5"/>
    <g fill="${c[4]}" opacity=".75"><path d="M0 280V238q24 4 34 22 4-30 26-36-2 32-14 56Z"/><path d="M600 280V232q-28 6-36 26-6-28-28-30 4 30 18 52Z"/></g>
    <path d="M0 0h600v280H0Z" fill="url(#${id}-grain)"/>
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

/* 深渊入口：浮石一圈圈沉向深处的光点，当前层数写在左侧；首领层换成暖红色的光 */
function abyssPortalInfo(level){return isBossFloor(level)?'首领层 · 首通掉落额外宝物':`${abyssEnemyCount(level)} 名敌人等在下面`;}
function abyssPortalHTML(){
  const level=getAbyssLevel(),id='portal-'+(++sceneArtId);
  const rocks=[[196,30,22,.9],[276,26,16,.75],[300,78,18,.7],[178,86,14,.6],[238,16,10,.6],[256,96,9,.5]].map(([x,y,w,o])=>`<path d="M${x-w} ${y}q${w} -${w*.35} ${w*2} 0q-${w*.5} ${w*.9}-${w} ${w*1.1}q-${w*.5}-${w*.2}-${w}-${w*1.1}Z" fill="#3b3462" opacity="${o}"/><path d="M${x-w} ${y}q${w} -${w*.35} ${w*2} 0q-${w} ${w*.25}-${w*2} 0Z" fill="#6b6396" opacity="${o}"/>`).join('');
  return `<div class="abyss-portal ${isBossFloor(level)?'boss':''}" id="abyssPortal">
    <svg class="abyss-art" viewBox="0 0 320 120" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <defs><radialGradient id="${id}-core" cx=".5" cy=".5" r=".5"><stop class="portal-core" offset="0"/><stop class="portal-mid" offset=".35"/><stop offset="1" stop-color="#120f24" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="240" cy="62" rx="110" ry="58" fill="url(#${id}-core)"/>
      <g fill="none" stroke="#b9acf0"><ellipse cx="240" cy="62" rx="92" ry="34" stroke-opacity=".18"/><ellipse cx="240" cy="64" rx="64" ry="23" stroke-opacity=".26"/><ellipse cx="240" cy="66" rx="38" ry="13" stroke-opacity=".38"/><ellipse cx="240" cy="67" rx="16" ry="5" stroke-opacity=".6"/></g>
      ${rocks}
      <circle cx="240" cy="67" r="3" fill="#fff4dc"/>
    </svg>
    <div class="abyss-floor"><b id="abyssPortalFloor">第 ${level} 层</b><span id="abyssPortalInfo">${abyssPortalInfo(level)}</span></div>
  </div>`;
}
function syncAbyssPortal(){
  const el=document.getElementById('abyssPortal');if(!el)return;
  const level=getAbyssLevel();
  el.classList.toggle('boss',isBossFloor(level));
  el.querySelector('#abyssPortalFloor').textContent=`第 ${level} 层`;
  el.querySelector('#abyssPortalInfo').textContent=abyssPortalInfo(level);
}
function renderTravel(){
  if(!S.slimes.length){
    return `<div class="panel center">
      <p class="muted">还没有史莱姆伙伴，先去召唤一只吧～</p>
      <button class="btn full" data-act="goto" data-tab="summon">前往召唤</button>
    </div>${challengeCards()}${progressionGoalCards()}`;
  }
  return `
  <div class="panel">
    <h3>${uiIcon('sword')} 深渊冒险</h3>
    ${abyssPortalHTML()}
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

function renderSpace(){LivingWorld.navigate('home');return LivingWorld.render();}
function initPlayground(){LivingWorld.mount();}

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

function refillTrough(){ LivingWorld.dispatch({type:'refill'}); }

function renderBag(){
  return LivingWorld.inventoryHTML(S) + Object.keys(ITEMS).map(k=>{
    const it = ITEMS[k];
    const priceText = k==='ticket' ? `${it.price}积分` : `${it.price}晶币`;
    const price10 = k==='ticket' ? `${it.price*10}积分` : `${it.price*10}晶币`;
    const owned = S.bag[k] || 0;
    return `<div class="panel item-row" data-item="${k}">
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
  }).join('') + `<div class="panel"><p class="muted small">在家园点击伙伴可喂食，在伙伴详情中可使用成长道具。饲料槽使用同一仓库的基础饲料。词条抽取券仅可使用系统积分购买，系统积分通过完成系统任务获得。</p></div>`;
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


function renderMonsterCare(){
 return `<div class="panel"><h3>魔物照料</h3><p class="muted">捕获的魔物在家园的小屋中休息，可以喂食、查看状态或作为副宠参与合体。</p>${S.monsters.map(s=>`<div class="item-row"><div class="scale-box">${slimeHTML(s,{mood:'idle'})}</div><div><b>${esc(s.name)}</b><p>饱食 ${Math.round(s.monSat||0)} · 亲近 ${Math.round(s.monLight||0)}</p><button class="btn sm" data-act="detail" data-id="${s.id}">查看</button><button class="btn sm" data-act="feed" data-id="${s.id}">喂饲料</button>${S.monItemConfigs.map((c,i)=>`<button class="btn sm" data-act="monsterCare" data-id="${s.id}" data-idx="${i}">${esc(c.label)}</button>`).join('')}</div></div>`).join('')||'<p>在挑战区域捕获的魔物会在这里安家。</p>'}<button class="btn" data-act="mergeopen">合体</button></div>`;
}
