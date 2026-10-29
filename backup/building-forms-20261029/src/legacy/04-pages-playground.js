function renderStatus(){
  const need = summonerNeed(S.level);
  const pct = S.breakPending ? 100 : Math.min(100, S.summonerExp / need * 100);
  const taskRows = Object.keys(TASK_DEFS).map(k=>{const def = TASK_DEFS[k];const prog = Math.min(S.tasks[k]||0, def.need);const done = S.taskClaimed[k];return `<div class="task-row"><div><div class="task-name">${def.name}${done?'<span class="task-done">✓ 已完成</span>':''}</div><div class="task-desc">${def.desc}（${prog}/${def.need}）</div></div><div class="task-reward">+${def.reward} ⭐</div></div>`;}).join('');
  return `<div class="panel"><div class="profile"><div class="avatar">✦</div><div style="flex:1;min-width:0;"><div class="pname">${esc(S.name)}</div><div class="psub">Lv.${S.level} · 史莱姆召唤师 · 召唤位 ${getSlots()}</div><div class="barwrap" style="margin-top:9px;max-width:230px;"><div class="bar"><i style="width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--accent2))"></i></div><span class="barlabel">经验 <b>${S.breakPending?'MAX':Math.floor(S.summonerExp)+'/'+need}</b></span></div>${S.breakPending?`<button class="btn gold full" data-act="breakthrough" style="margin-top:10px;">⚡ 突破境界</button>`:`<p class="muted small" style="margin-top:8px;">史莱姆获得经验的10% 供给召唤师。<br>每提升 10 级增加 1 个召唤位，整十级时需要手动突破。</p>`}</div></div></div>
  <div class="panel"><h3>◈ 系统任务 <span style="float:right;color:var(--gold);font-size:13px;">⭐ ${S.points}</span></h3><p class="muted small" style="margin-bottom:4px;">每日重置 · 完成可获得系统积分</p>${taskRows}</div>
  ${challengeCards()}
  ${progressionGoalCards()}
  <div class="panel"><button class="btn full themed" data-act="settings">界面主题与存档设置</button></div>`;
}

function renderSummon(){
  const slots = getSlots();
  const full = S.slimes.length >= slots;
  const boostKeys = Object.keys(summonBoost);
  const boostText = boostKeys.length ? boostKeys.map(k=>`${k}+${summonBoost[k]}`).join('，') : '无';
  return `<div class="panel center"><h2>史莱姆召唤</h2><p class="muted">从虚空中召唤一位新的史莱姆伙伴</p><div class="summon-count">${S.slimes.length} / ${slots}</div><button class="btn big" data-act="summon" ${full?'disabled':''}>${full?'召唤空间已满':'✨ 召　唤 ✨'}</button><p class="muted small">岩、火、水、风较常见；草、冰、雷、幻较稀有；光、暗稀有；空间、时间极为罕见。</p><div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--border);text-align:left;"><h3 style="margin-bottom:6px;">◈ 献祭天材地宝</h3><p class="muted small">消耗1个天材地宝，小幅提升对应属性史莱姆的召唤概率（仅对下一次召唤有效）。</p><div class="boost-grid">${ELEMENT_KEYS.map(el=>`<button class="boost-btn" data-act="boost" data-element="${el}">${ELEMENTS[el].icon}${el}${summonBoost[el]?`+${summonBoost[el]}`:''}</button>`).join('')}</div><p class="muted small" style="margin-top:8px;">当前加成：${boostText}　｜　天材地宝 ×${S.bag.treasure}</p></div></div>
  <div class="panel"><h3>◈ 史莱姆合体</h3><p class="muted small">主宠保留名字、ID、亲密度、经验和已有属性，等级取较高者；副宠永久消耗。合体需晶币：500 + 100 × 较高等级 + 250 × 主宠融合次数 ×（次数 + 1），随次数递增。</p><button class="btn full" data-act="mergeopen">开始合体</button></div>`;
}

function mapLandmarks(map){const content=map.id==='snow'?`<g class="landmark-back"><path d="M0 180 85 55 175 180 245 70 360 180 430 80 600 190V260H0" fill="#6c9dad"/><path d="m56 98 29-43 34 47-22-8-14 15-12-17m141 27 33-49 35 47-24-10-12 14-13-11" fill="#f5ffff"/></g><g class="landmark-front"><path d="M335 205q20-90 96-85 63 0 81 90" fill="#91b4bc"/><path d="M365 208q17-61 62-61 43 0 57 61Z" fill="#304c64"/><path d="M338 172q25-62 93-52 49 1 70 46l-34-8-11 10-24-16-28 17-18-6Z" fill="#f2ffff"/><path d="m57 210 27-67 27 67Zm57 0 19-48 19 48Z" fill="#719d9a"/><path d="m66 187 18-44 18 44-18-8Z" fill="#e6f9f8"/><path d="M0 215Q170 195 290 216T600 210" fill="none" stroke="#f5ffff" stroke-width="9"/></g>`:map.id==='dusk'?`<g class="landmark-back"><circle cx="445" cy="64" r="36" fill="#ffe3a4"/><path d="M0 176q80-70 160-10t160-15 150 15 130-10v104H0" fill="#7f5960"/></g><g class="landmark-front"><path d="M65 203V111h26v92m62 0V111h27v92M57 108h130v20H57m34-20q31-54 62 0" fill="#6c5262" stroke="#a68479" stroke-width="5"/><path d="M60 204h130v11H60m226-7 14-62 31-7 19 69m-55-40 50-6" fill="#675165" stroke="#a68479" stroke-width="4"/><path d="M485 210V125m0 30-28-25m28 42 31-35" stroke="#6c4250" stroke-width="8" fill="none"/><path d="m243 209 22-13 11 13m105 0 18-19 20 19" fill="#7e5963"/></g>`:`<g class="landmark-back"><path d="M0 160q110-120 230-10t185-13 185 20v103H0" fill="#4f9a87"/><path d="M0 183q140-60 260 0t220-15 120 10v82H0" fill="#78b489"/></g><g class="landmark-front"><path d="M90 210v-80m350 80v-70" stroke="#725943" stroke-width="12"/><path d="M40 137q-9-37 26-43-5-36 28-39 35 0 39 37 37 3 31 40-52 35-124 5" fill="#387e62"/><path d="M393 150q-8-28 20-33 0-31 27-33 30 0 35 31 30 3 23 32-49 27-105 3" fill="#4a9064"/><path d="M230 209v-47m-12 0h38l-8 18h-30Z" fill="#b48d61" stroke="#795c40" stroke-width="4"/><path d="m305 213 18-16 28 16m-202 0 9-10 20 10" fill="#86a682"/></g>`;return `<svg class="scene-landmarks" viewBox="0 0 600 280" preserveAspectRatio="none" aria-hidden="true">${content}</svg>`;}

function renderExploreScene(){
  const map = MAP_THEMES[S.exploreMapIndex] || MAP_THEMES[0];
  const dispatched = S.slimes.filter(s => isDispatched(s));
  const now = Date.now();
  function buildSlimeEl(s, i, opts){opts = opts || {};const scaleMul = opts.scaleMul || 1;const preferWalk = !!opts.preferWalk;const isJump = preferWalk ? Math.random() < 0.3 : Math.random() < 0.5;const nextToggle = now + 500 + Math.random() * 800;const sz = clamp(s.size || 1, 0.6, 1.6);const scale = 0.18 * sz * scaleMul;const w = Math.round(26 * sz * scaleMul);const h = Math.round(22 * sz * scaleMul);return `<div class="explore-slime ${isJump?'jumping':'walking'}" style="width:${w}px;height:${h}px;--ex-scale:${scale.toFixed(3)};--delay:${(i*0.2).toFixed(2)}s" data-sid="${s.id}" data-row="${opts.row || 'back'}" data-next-toggle="${nextToggle}">${slimeHTML(s,{mood:'idle'})}</div>`;}
  let slimesHTML;
  if(!dispatched.length){slimesHTML = `<div class="explore-slimes" style="bottom:18%;"><span class="explore-empty-text">暂无史莱姆在探险</span></div>`;}
  else if(dispatched.length <= 5){slimesHTML = `<div class="explore-slimes" style="bottom:18%;">${dispatched.map((s,i)=>buildSlimeEl(s,i,{row:'back'})).join('')}</div>`;}
  else {const half = Math.ceil(dispatched.length / 2);let rowBack = dispatched.slice(0, half);let rowFront = dispatched.slice(half);const sortedBySize = [...dispatched].sort((a,b)=>(b.size||1)-(a.size||1));const top3Ids = new Set(sortedBySize.slice(0,3).map(x=>x.id));const lastFront = rowFront[rowFront.length - 1];if(lastFront && top3Ids.has(lastFront.id)){let swapped = false;for(let i = rowFront.length - 2; i >= 0; i--){if(!top3Ids.has(rowFront[i].id)){const tmp = rowFront[i];rowFront[i] = rowFront[rowFront.length - 1];rowFront[rowFront.length - 1] = tmp;swapped = true;break;}}if(!swapped){for(let i = rowBack.length - 1; i >= 0; i--){if(!top3Ids.has(rowBack[i].id)){const tmp = rowBack[i];rowBack[i] = rowFront[rowFront.length - 1];rowFront[rowFront.length - 1] = tmp;swapped = true;break;}}}}slimesHTML = `<div class="explore-slimes" style="bottom:22.2%;">${rowBack.map((s,i)=>buildSlimeEl(s,i,{row:'back', scaleMul:0.99})).join('')}</div><div class="explore-slimes" style="bottom:14.4%;">${rowFront.map((s,i)=>buildSlimeEl(s,i,{row:'front', scaleMul:0.8, preferWalk:true})).join('')}</div>`;}
  return `<div class="explore-scene" style="--sky1:${map.sky1};--sky2:${map.sky2};--grass1:${map.grass1};--grass2:${map.grass2};--soil1:${map.soil1};--soil2:${map.soil2};"><div class="bg-scroll"><div class="bg-panel"><div class="scene-sky"></div><div class="scene-grass"></div><div class="scene-soil"></div>${mapLandmarks(map)}</div><div class="bg-panel"><div class="scene-sky"></div><div class="scene-grass"></div><div class="scene-soil"></div>${mapLandmarks(map)}</div></div><span class="region-label">${map.id==='snow'?'极地冰原':map.id==='dusk'?'暮色遗迹':'林间小径'}</span><div class="explore-items-layer"></div>${slimesHTML}</div>`;
}

function renderTravel(){
  if(!S.slimes.length){return `<div class="panel center"><p class="muted">还没有史莱姆伙伴，先去召唤一只吧～</p><button class="btn full" data-act="goto" data-tab="summon">前往召唤</button></div>`;}
  const gp = S.globalPlan;
  const currentMap = MAP_THEMES[S.exploreMapIndex] || MAP_THEMES[0];
  ensureExplorePending();
  const p = S.explorePending;
  const cap = exploreCap();
  const hasAny = (p.coins||0)>0 || (p.exp||0)>0 || (p.food||0)>0 || (p.point||0)>0 || (p.treasure||0)>0;
  return `<div class="panel"><h3 style="display:flex;align-items:center;justify-content:space-between;">◈ 野外探险 <button class="btn sm themed" data-act="cycleMap" style="padding:4px 8px;font-size:11px;">🗺️ ${currentMap.name}</button></h3>${renderExploreScene()}<div class="explore-btns"><button class="btn ${gp==='explore'?'gold':''} explore-btn" data-act="globalplan" data-type="explore">🗺️ 自动探险</button><button class="btn themed explore-btn" data-act="globalplan" data-type="clear" ${gp?'':'disabled'}>↩️ 全部召回</button><button class="btn themed explore-btn" data-act="setupTeam">👥 设置队伍</button></div><div class="explore-reward-row"><span>收益：<span class="coin-silver"></span> ${p.coins||0}　🧪 ${p.exp||0}<br>负重 ${p.weight||0}/${cap}</span><button class="btn sm gold" data-act="claimExplore" ${hasAny?'':'disabled'}>领取</button></div></div>
  <div class="panel"><h3>◈ 深渊冒险</h3><p class="muted small">派遣最多5只伙伴。已解锁 ${getAbyssUnlocked()}/50 层，胜利解锁下一层。失败只获得已击败敌人 25% 的收益；零击败零奖励。</p><div class="abyss-row"><label>怪物等级</label><button class="btn sm abyss-step" data-act="abyssLevelMinus">◀</button><input type="number" class="abyss-level-input" id="abyssLevelInput" min="1" max="${getAbyssUnlocked()}" value="${getAbyssLevel()}"><button class="btn sm abyss-step" data-act="abyssLevelPlus">▶</button></div><button class="btn full gold" data-act="abyssSetup" style="margin-top:10px;">⚔️ 进入深渊冒险</button></div>`;
}

function renderSpace(){
  const isMonster = S.spaceMode === 'monster';
  const list = isMonster ? S.monsters : S.slimes;
  const idle = sortStarred(isMonster ? list : list.filter(s=>!isDispatched(s)&&!LivingWorld.isBusy(S,s.id)));
  const feed = S.feedTrough || 0;
  const feedHTML = `<div class="feed-trough"><div class="ft-left"><span class="ft-icon">🥣</span><span>饲料槽</span></div><div class="ft-right"><b>${feed}/99</b><button class="btn sm" data-act="refill">补充饲料</button></div></div>`;
  const toyHTML = !isMonster ? `<div class="toy-bar"><span class="toy-title">🎮 游戏栏</span><button class="toy-btn ${selectedToy==='ball'?'on':''}" data-act="selectToy" data-toy="ball">⚽ 扔皮球</button><button class="toy-btn ${selectedToy==='stack'?'on':''}" data-act="selectToy" data-toy="stack">🧱 叠叠乐</button><div class="toy-hint" style="${selectedToy?'':'display:none'}">${selectedToy?`已选择「${selectedToy==='ball'?'扔皮球':'叠叠乐'}」 · 点击空间中的史莱姆开始游戏`:''}</div></div>` : `<div class="mon-item-bar">${(S.monItemConfigs||[]).map((c,i)=>`<button class="mon-item-btn" data-act="monItem" data-idx="${i}" data-long="${i}">${esc(c.label)}</button>`).join('')}</div><p class="muted small" style="margin-top:6px;">长按道具按钮可编辑按钮文本、史莱姆的反应表情、心情变化与弹窗文字。</p>`;
  const switchHTML = `<div class="space-header"><h3>◈ ${isMonster ? '魔物空间' : '空间 · 自由活动'}</h3><button class="space-switch" data-act="toggleSpaceMode"><span>${isMonster ? '🔄' : '👾'}</span><span>${isMonster ? '自由活动' : '魔物空间'}</span></button></div>`;
  if(!idle.length && isMonster){return `<div class="panel center">${switchHTML}<p class="muted">魔物空间空荡荡的……去深渊捕捉一只吧！</p>${feedHTML}<p class="muted small">在深渊战斗中让怪物血量归零后使用捕捉网。</p></div>`;}
  return `<div class="panel">${switchHTML}<p class="muted small">${isMonster ? '被捕捉的怪物史莱姆会在这里自由活动，可拖动改变位置。' : '未派遣的史莱姆会在空间中自由活动，可拖动它们改变位置，点击它们可以互动。系统史莱姆会一直陪在这里。'}</p>${feedHTML}<div class="space-playground ${isMonster?'monster':''}" id="playground">${Array.from({length:14}).map(()=>`<div class="bg-star" style="left:${rnd(2,98)}%;top:${rnd(2,98)}%;"></div>`).join('')}</div>${toyHTML}<div class="minigrid four" style="margin-top:12px;">${idle.map(s=>`<div class="minicard" data-act="detail" data-id="${s.id}" data-mon="${isMonster?1:0}">${starHeartHTML(s)}<div class="scale-box sm">${slimeHTML(s,{mood:'idle'})}</div><div class="mc-name">${esc(s.name)} Lv.${s.level}</div></div>`).join('')}</div></div>`;
}

function initPlayground(){
  const pg = $('#playground');
  if(!pg) return;
  plSlimes.forEach(p=>{if(p.timer) clearInterval(p.timer);if(p.bubbleTimer) clearInterval(p.bubbleTimer);});
  plSlimes = [];
  const isMonster = S.spaceMode === 'monster';
  const idle = sortStarred(isMonster ? S.monsters : S.slimes.filter(s=>!isDispatched(s)&&!LivingWorld.isBusy(S,s.id)));
  const sprites = isMonster ? idle.slice() : idle.concat([getSystemSlimeObj()]);
  const mainMoods = ['idle','jump','crawl','sleep','look'];
  const placed = [];
  const pgW = pg.clientWidth || 340, pgH = pg.clientHeight || 380;
  let suppressClick = false;
  const MAX_DISP_SCALE = 0.43 * 1.6;
  const NON_SYS_SCALE = 0.72;
  const maxSizeInSpace = sprites.length ? Math.max(...sprites.map(x=>clamp(x.size || 1, 0.6, 1.6))) : 1;
  function rectCircleHit(cx, cy, w, h, ox, oy, r){const left = cx - w/2, right = cx + w/2;const top = cy - h/2, bottom = cy + h/2;const px = clamp(ox, left, right);const py = clamp(oy, top, bottom);const dx = px - ox, dy = py - oy;return (dx*dx + dy*dy) < r*r;}
  function resolveAirWalls(){for(let iter = 0; iter < 8; iter++){let moved = false;for(let i=0;i<plSlimes.length;i++){for(let j=i+1;j<plSlimes.length;j++){const A = plSlimes[i], B = plSlimes[j];if(A.el.classList.contains('dragging') || B.el.classList.contains('dragging')) continue;const aw = 140 * A.dispScale, ah = 118 * A.dispScale;const bw = 140 * B.dispScale, bh = 118 * B.dispScale;const ax = A.x/100*pgW, ay = A.y/100*pgH;const bx = B.x/100*pgW, by = B.y/100*pgH;if(rectCircleHit(ax, ay, aw, ah, bx, by, B.airR)){const dx = ax - bx, dy = ay - by;const dist = Math.hypot(dx, dy) || 1;const px = clamp(bx, ax-aw/2, ax+aw/2);const py = clamp(by, ay-ah/2, ay+ah/2);const d2 = Math.hypot(px-bx, py-by);const push = Math.max(1, B.airR - d2 + 1);A.x = clamp(A.x + (dx/dist)*push/pgW*100, A.minX, A.maxX);A.y = clamp(A.y + (dy/dist)*push/pgH*100, A.minY, A.maxY);A.el.style.left = A.x + '%';A.el.style.top = A.y + '%';moved = true;}if(rectCircleHit(bx, by, bw, bh, ax, ay, A.airR)){const dx = bx - ax, dy = by - ay;const dist = Math.hypot(dx, dy) || 1;const px = clamp(ax, bx-bw/2, bx+bw/2);const py = clamp(ay, by-bh/2, by+bh/2);const d2 = Math.hypot(px-ax, py-ay);const push = Math.max(1, A.airR - d2 + 1);B.x = clamp(B.x + (dx/dist)*push/pgW*100, B.minX, B.maxX);B.y = clamp(B.y + (dy/dist)*push/pgH*100, B.minY, B.maxY);B.el.style.left = B.x + '%';B.el.style.top = B.y + '%';moved = true;}}}if(!moved) break;}}
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
    const findFreePos = () => {for(let tries=0; tries<80; tries++){const x = rnd(minX, maxX);const y = rnd(minY, maxY);let ok = true;for(const p of placed){const dx = (x-p.x)*pgW/100, dy = (y-p.y)*pgH/100;const minD = airR + p.airR;if(Math.sqrt(dx*dx+dy*dy) < minD){ ok=false; break; }}if(ok) return {x,y};}return {x:(minX+maxX)/2, y:(minY+maxY)/2};};
    const pos = findFreePos();
    placed.push({x:pos.x,y:pos.y,airR});
    const el = document.createElement('div');
    el.className = 'pl-slime';
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
    if(s.isSystem){
      const showLine = ()=>{if(!bubbleEl.isConnected) return;if(el.classList.contains('dragging')) return;bubbleEl.textContent = pick(SYS_QUOTES);bubbleEl.classList.add('show');const box = el.getBoundingClientRect(), pgBox = pg.getBoundingClientRect();const edge = 6, bw = bubbleEl.offsetWidth, bh = bubbleEl.offsetHeight;bubbleEl.classList.toggle('below', box.top + 14 - bh < pgBox.top + edge);const center = box.left + box.width/2, half = bw/2;let shift = 0;if(center - half < pgBox.left + edge) shift = (pgBox.left + edge) - (center - half);else if(center + half > pgBox.right - edge) shift = (pgBox.right - edge) - (center + half);bubbleEl.style.marginLeft = shift ? shift.toFixed(1) + 'px' : '';clearTimeout(bubbleEl._t);bubbleEl._t = setTimeout(()=>{ if(bubbleEl.isConnected) bubbleEl.classList.remove('show'); }, 2600);};
      setTimeout(showLine, 1500);
      obj.bubbleTimer = setInterval(showLine, 9000);
    }
    const move = (targetX, targetY)=>{const oldIdx = placed.findIndex(p=>p.x===obj.x && p.y===obj.y);if(oldIdx>=0) placed.splice(oldIdx,1);let np = {x: targetX, y: targetY};if(targetX === undefined) {np = findFreePos();} else {np.x = clamp(np.x, minX, maxX);np.y = clamp(np.y, minY, maxY);}obj.x = np.x; obj.y = np.y;placed.push({x:np.x,y:np.y,airR});const slimeEl = el.querySelector('.slime');if(slimeEl){slimeEl.dataset.mood = Math.random() < 0.5 ? 'jump' : 'crawl';setTimeout(()=>{ if(slimeEl.isConnected) slimeEl.dataset.mood = 'idle'; }, 800);}el.style.left = np.x+'%';el.style.top = np.y+'%';resolveAirWalls();};
    obj.timer = setInterval(()=>{if(activeTab !== 'space') return;if(el.classList.contains('dragging')) return;if(el.classList.contains('tracking')) return;if(ballGame && ballGame.running && ballGame.slime.id === s.id) return;const slimeEl = el.querySelector('.slime');if(!slimeEl) return;const r = Math.random();if(r < 0.08){slimeEl.dataset.mood = 'happy';setTimeout(()=>{if(slimeEl && slimeEl.dataset.mood==='happy' && activeTab==='space') slimeEl.dataset.mood = 'idle';}, 2000);} else {const m = pick(mainMoods);slimeEl.dataset.mood = m;if(m==='crawl' || m==='jump') move(undefined, undefined);}}, 2400 + i*300);
    let drag = null;
    el.addEventListener('pointerdown', ev=>{ev.preventDefault();ev.stopPropagation();drag = { startX: ev.clientX, startY: ev.clientY, lastX: ev.clientX, lastY: ev.clientY, moved:false, velocity:0, sysBubbleShown:false };el.classList.add('dragging');const idx = placed.findIndex(p=>p.x===obj.x && p.y===obj.y);if(idx>=0) placed.splice(idx,1);try{ el.setPointerCapture(ev.pointerId); }catch(e){}});
    el.addEventListener('pointermove', ev=>{if(!drag) return;const dx = ev.clientX - drag.startX;const dy = ev.clientY - drag.startY;if(Math.abs(dx) > 6 || Math.abs(dy) > 6) drag.moved = true;if(!drag.moved) return;if(s.isSystem && bubbleEl && !drag.sysBubbleShown){drag.sysBubbleShown = true;bubbleEl.textContent = pick(SYS_DRAG_QUOTES);bubbleEl.classList.add('show');clearTimeout(bubbleEl._t);}const pgRect = pg.getBoundingClientRect();let px = ((ev.clientX - pgRect.left) / pgRect.width) * 100;let py = ((ev.clientY - pgRect.top) / pgRect.height) * 100;px = clamp(px, minX, maxX);py = clamp(py, minY, maxY);obj.x = px; obj.y = py;el.style.left = px + '%';el.style.top = py + '%';const mdx = ev.clientX - drag.lastX;drag.velocity = drag.velocity * 0.6 + mdx * 0.4;drag.lastX = ev.clientX;drag.lastY = ev.clientY;const angle = clamp(drag.velocity * 4, -50, 50);const slimeEl = el.querySelector('.slime');if(slimeEl){slimeEl.dataset.mood = 'swing';slimeEl.style.transform = `scale(${dispScale}) rotate(${angle}deg)`;slimeEl.style.transition = 'transform .05s ease-out';}});
    el.addEventListener('pointerup', ()=>{if(!drag) return;const wasMoved = drag.moved;el.classList.remove('dragging');placed.push({x:obj.x, y:obj.y, airR});const slimeEl = el.querySelector('.slime');if(slimeEl){slimeEl.style.transform = `scale(${dispScale})`;slimeEl.style.transition = 'transform .2s ease-out';if(slimeEl.dataset.mood === 'swing') slimeEl.dataset.mood = 'idle';}if(s.isSystem && bubbleEl){bubbleEl.classList.remove('show');}drag = null;if(wasMoved){suppressClick = true;setTimeout(()=>{ suppressClick = false; }, 160);}});
    el.addEventListener('pointercancel', ()=>{if(!drag) return;el.classList.remove('dragging');placed.push({x:obj.x, y:obj.y, airR});const slimeEl = el.querySelector('.slime');if(slimeEl){slimeEl.style.transform = `scale(${dispScale})`;slimeEl.style.transition = 'transform .2s ease-out';if(slimeEl.dataset.mood === 'swing') slimeEl.dataset.mood = 'idle';}if(s.isSystem && bubbleEl){bubbleEl.classList.remove('show');}drag = null;});
    el.addEventListener('click', ()=>{if(suppressClick) return;if(!isMonster && selectedToy === 'ball'){ startBallGame(s); return; }const slimeEl = el.querySelector('.slime');if(slimeEl) slimeEl.dataset.mood = 'happy';setTimeout(()=>{if(slimeEl && slimeEl.dataset.mood==='happy') slimeEl.dataset.mood = 'idle';}, 2600);if(s.isSystem){if(bubbleEl){bubbleEl.textContent = pick(SYS_QUOTES);bubbleEl.classList.add('show');clearTimeout(bubbleEl._t);bubbleEl._t = setTimeout(()=>{ if(bubbleEl.isConnected) bubbleEl.classList.remove('show'); }, 2600);}return;}s.mood = clamp(s.mood + 10, 0, 100);const bondGain=gainCompanionIntimacy(s,Date.now());const before=bondGain.before,bond=bondGain.bond,canBond=bondGain.gained;if(slimeEl)slimeEl.dataset.mood=bond.face;showFloat(el,canBond?'心情+10 · 亲密+1':'心情+10');if(bond.need>before.need){toast(`${s.name} 和你成为「${bond.name}」！`, 'good');if(bond.need>=30&&!el.querySelector('.bond-badge'))el.insertAdjacentHTML('beforeend',`<span class="bond-badge" title="挚友">${uiIcon('heart')}</span>`);}if(slimeEl)setTimeout(()=>{if(slimeEl.isConnected)slimeEl.dataset.mood='idle';},2800);save();});
    plSlimes.push(obj);
  });
  let trackMove = false;
  let lastTrackTime = 0;
  function handleTrack(ev) {const now = Date.now();if(now - lastTrackTime < 150) return;lastTrackTime = now;const rect = pg.getBoundingClientRect();const clickX = ((ev.clientX - rect.left) / rect.width) * 100;const clickY = ((ev.clientY - rect.top) / rect.height) * 100;const items = [];plSlimes.forEach(p => {if(p.el.classList.contains('dragging')) return;const s = isMonster ? S.monsters.find(x => x.id === p.sid) : S.slimes.find(x => x.id === p.sid);if (s && (s.intimacy || 0) >= 5) {items.push({p,x: clamp(clickX + rnd(-5, 5), p.minX, p.maxX),y: clamp(clickY + rnd(-5, 5), p.minY, p.maxY)});}});for(let iter = 0; iter < 12; iter++){let moved = false;for(let i = 0; i < items.length; i++){for(let j = i + 1; j < items.length; j++){const A = items[i], B = items[j];const dxPx = (B.x - A.x) * pgW / 100;const dyPx = (B.y - A.y) * pgH / 100;const d = Math.hypot(dxPx, dyPx);const minD = A.p.airR + B.p.airR;if(d >= minD) continue;const ux = d > 0.001 ? dxPx / d : (Math.random() < 0.5 ? -1 : 1);const uy = d > 0.001 ? dyPx / d : (Math.random() < 0.5 ? -1 : 1);const push = (minD - d) / 2 + 0.6;A.x = clamp(A.x - ux * push / pgW * 100, A.p.minX, A.p.maxX);A.y = clamp(A.y - uy * push / pgH * 100, A.p.minY, A.p.maxY);B.x = clamp(B.x + ux * push / pgW * 100, B.p.minX, B.p.maxX);B.y = clamp(B.y + uy * push / pgH * 100, B.p.minY, B.p.maxY);moved = true;}}if(!moved) break;}items.forEach(it => {const x = clamp(it.x, it.p.minX, it.p.maxX);const y = clamp(it.y, it.p.minY, it.p.maxY);moveEl(it.p, x, y);});resolveAirWalls();}
  function moveEl(p, tx, ty) {const targetX = clamp(tx, p.minX, p.maxX);const targetY = clamp(ty, p.minY, p.maxY);p.x = targetX; p.y = targetY;p.el.classList.toggle('tracking', trackMove);p.el.style.left = targetX + '%';p.el.style.top = targetY + '%';const slimeEl = p.el.querySelector('.slime');if (slimeEl) {if (trackMove) {slimeEl.dataset.mood = 'jump';clearTimeout(slimeEl._moveTimer);slimeEl._moveTimer = null;} else {slimeEl.dataset.mood = Math.random() < 0.5 ? 'jump' : 'crawl';clearTimeout(slimeEl._moveTimer);slimeEl._moveTimer = setTimeout(() => {if (slimeEl.isConnected) slimeEl.dataset.mood = 'idle';}, 800);}}}
  function stopTracking(){trackMove = false;plSlimes.forEach(p=>{p.el.classList.remove('tracking');const slimeEl = p.el.querySelector('.slime');if(slimeEl){clearTimeout(slimeEl._moveTimer);slimeEl._moveTimer = null;slimeEl.dataset.mood = 'idle';}});}
  pg.addEventListener('pointerdown', (ev) => {if (ev.target.closest('.pl-slime')) return;trackMove = true;handleTrack(ev);});
  pg.addEventListener('pointermove', (ev) => {if (!trackMove) return;handleTrack(ev);});
  pg.addEventListener('pointerup', stopTracking);
  pg.addEventListener('pointercancel', stopTracking);
  pg.addEventListener('pointerleave', stopTracking);
}

function showFloat(el, text, topOffset){const pg = $('#playground');if(!pg) return;const r = el.getBoundingClientRect();const p = pg.getBoundingClientRect();const x = r.left - p.left + r.width/2;const y = r.top - p.top + (topOffset||0);const d = document.createElement('div');d.className = 'float-text';d.textContent = text;d.style.left = x + 'px';d.style.top = y + 'px';pg.appendChild(d);setTimeout(()=>d.remove(), 1350);}

function refillTrough(){
  if(S.feedTrough >= 99){ toast('饲料槽已满（99包）'); return; }
  if((S.bag.food||0) <= 0){ toast('背包中没有饲料，请先购买'); return; }
  const n = Math.min(S.bag.food, 99 - S.feedTrough);
  S.bag.food -= n;
  S.feedTrough += n;
  save();
  const numEl = document.querySelector('.ft-right b');
  if(numEl) numEl.textContent = S.feedTrough + '/99';
  toast(`补充了 ${n} 包饲料\n饲料槽：${S.feedTrough}/99`, 'good');
}

function renderBag(){return Object.keys(ITEMS).filter(k=>k!=='expPotion').map(k=>{const it = ITEMS[k];const priceText = k==='ticket' ? `${it.price}积分` : `${it.price}晶币`;const price10 = k==='ticket' ? `${it.price*10}积分` : `${it.price*10}晶币`;const owned = S.bag[k] || 0;return `<div class="panel item-row"><div class="item-icon">${it.icon}</div><div class="item-info"><div class="item-name">${it.name} <span class="owned">×${owned}</span></div><div class="muted small" style="margin:3px 0 0;">${it.desc}</div></div><div class="item-buy-col"><button class="btn sm" data-act="buy" data-item="${k}">${priceText}</button><button class="btn sm gold" data-act="buy10" data-item="${k}">买10个 · ${price10}</button></div></div>`;}).join('') + `<div class="panel"><p class="muted small">提示：在【空间】中点击史莱姆，即可使用背包中的道具。饲料也可以在空间饲料槽中补充。词条抽取券仅可使用系统积分购买，系统积分通过完成系统任务获得。</p></div>`;}

function getSlime(id){ return S.slimes.find(s=>s.id===id) || S.monsters.find(s=>s.id===id); }
function heartColor(s){const v = Number(s.intimacy) || 0;if(v < 0){const t = clamp(-v / 100, 0, 1);const g = Math.round(154 * (1 - t));return `rgb(${g},${g},${g})`;}const t = clamp(v / 50, 0, 1);const r = Math.round(154 + (255 - 154) * t);const g = Math.round(160 + (122 - 160) * t);const b = Math.round(166 + (162 - 166) * t);return `rgb(${r},${g},${b})`;}
function heartIcon(color){return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" style="fill:${color};stroke:none"><path d="M20.5 5.5a5 5 0 0 0-8.5 2 5 5 0 0 0-8.5-2C-1 10 5 16 12 21c7-5 13-11 8.5-15.5Z"/></svg>`;}
function starHeartHTML(s){
  const on = !!s.starred;
  return `<span class="mc-star-wrap"><button class="mc-star-btn" data-act="toggleStar" data-id="${s.id}" aria-label="特别关注"></button><span class="mc-star ${on?'on':''}">★</span></span>
    <span class="mc-heart" title="亲密度 ${Number(s.intimacy)||0}">${heartIcon(heartColor(s))}</span>`;
}
function toggleStar(id){const s = getSlime(id);if(!s) return;s.starred = !s.starred;if(s.locked!==undefined)s.locked=s.starred;save();if($('#modalBox .detail')) openDetail(id);else if(activeTab === 'space') renderTab();}

function autoUseExpPotionSilent(){if(!S.slimes.length) return false;let target = S.slimes[0];for(const s of S.slimes){ if(s.level < target.level) target = s; }addExp(target, 100);return true;}
