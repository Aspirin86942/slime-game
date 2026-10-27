/* 真实浏览器触屏验收：用 CDP 触摸事件（不是鼠标事件）验证
   ① 手指抚摸（tap）加亲密、30 秒内重复抚摸只加心情
   ② 手指拖动史莱姆：跟手、拖动中摆动、松手不回弹、页面不滚动
   ③ 空白处跟手移动（亲密度 ≥5 的伙伴跟随手指，<5 的不追）
   ④ 触屏点标签页、点玩具、玩「扔皮球」小游戏
   用法：node tools/out/touch-check.js
   报告：tools/out/touch-report.json，截图：tools/out/shots/touch-*.png */
const path = require('node:path');
const { launch, sleep, waitFor, center, report, makeChecker, fileUrl } = require('./lib/cdp.js');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, '史莱姆.html');
const URL = fileUrl(GAME);
const OUT = path.join(__dirname, 'shots');
const results = [];
const check = makeChecker(results);

const q = sel => JSON.stringify(sel);
/* 取元素矩形前先滚进视口，避免点到屏幕外 */
const RECT = sel => `(() => {
  const el = document.querySelector(${q(sel)});
  if(!el) return null;
  el.scrollIntoView({ block:'center', inline:'nearest', behavior:'instant' });
  const r = el.getBoundingClientRect();
  return { left:r.left, top:r.top, width:r.width, height:r.height, cx:r.left+r.width/2, cy:r.top+r.height/2 };
})()`;
const LEFTPCT = sel => `(() => { const el = document.querySelector(${q(sel)}); return el ? parseFloat(el.style.left) : null; })()`;
const clearFloats = () => `document.querySelectorAll('.float-text').forEach(f => f.remove()); true`;
const sleepMs = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const p = await launch({ url: URL, touchEnabled: true });
  /* 记录每个 setInterval 的回调源码：空间里的史莱姆每 2.4~5.1 秒会自己挪位置，
     会把手势的坐标判定搅乱。测试里按回调特征（含 "contains('dragging')"）精确冻结它们，
     不动游戏代码，也不影响小游戏/派遣的定时器。 */
  await p.client.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const si = window.setInterval; window.__timers = []; window.setInterval = function(fn, ms){ const id = si.call(window, fn, ms); try { window.__timers.push({ id: id, ms: ms, src: String(fn).slice(0, 400) }); } catch (e) {} return id; }; })();` });
  const freezeWander = () => p.ev(`(() => { const hit = (window.__timers || []).filter(t => t.src.indexOf("contains('dragging')") !== -1); hit.forEach(t => clearInterval(t.id)); return hit.length; })()`);
  const reportData = { when: new Date().toISOString(), game: GAME, mode: 'touch (CDP Input.dispatchTouchEvent)', checks: results, shots: [] };
  const shot = async name => { const f = await p.shot(path.join(OUT, 'touch-' + name + '.png')); reportData.shots.push(path.relative(ROOT, f)); };
  try {
    await waitFor(() => p.ev('document.readyState === "complete" && !!document.querySelector("#storyScreen")'), 20000);
    const env = await p.ev(`({ w: window.innerWidth, h: window.innerHeight, touchPoints: navigator.maxTouchPoints })`);
    check('移动端视口 + 触摸模拟开启（390×844，maxTouchPoints=5）', env.w === 390 && env.h === 844 && env.touchPoints === 5, env);

    /* 夹具：正常开局 + 2 只伙伴；直接把改好的存档写回 localStorage 再重载，省掉 5 次抚摸的 30 秒等待 */
    await p.ev('finishStory()');
    await sleep(400);
    await p.ev('(() => { for(let i=0;i<2;i++){ doSummon(); closeModal(); } save(); return true; })()');
    await sleep(400);
    const base = JSON.parse(await p.ev(`localStorage.getItem('slimeSummonerSave')`));
    const idA = String(base.slimes[0].id), idB = String(base.slimes[1].id);
    base.slimes[0].name = '甲'; base.slimes[0].intimacy = 34; delete base.slimes[0].lastPetAt;
    base.slimes[1].name = '乙'; base.slimes[1].intimacy = 1; delete base.slimes[1].lastPetAt;
    await p.ev(`localStorage.setItem('slimeSummonerSave', ${JSON.stringify(JSON.stringify(base))})`);
    await p.client.send('Page.reload', { ignoreCache: true });
    const rendered = await waitFor(() => p.ev(`document.querySelectorAll('.pl-slime[data-mon="0"]').length >= 2 && !!document.querySelector(${q(`.pl-slime[data-id="${idA}"]`)})`), 20000);
    check('夹具载入：陪伴页渲染出伙伴（甲/乙都在）', !!rendered);
    await sleep(900);
    const frozen = await freezeWander();
    check('冻结空间自由活动定时器（避免史莱姆自己挪动干扰手势判定）', Number(frozen) >= 1, { timersCleared: frozen });

    const selA = `.pl-slime[data-id="${idA}"]`, selB = `.pl-slime[data-id="${idB}"]`;
    /* 位置工具：游戏每几秒会重写内联 left/top，且 .pl-slime 带 3s 过渡，
       所以固定位置用「内联样式 + important + 定时重刷」；测试期间让系统史莱姆不接收触摸，避免抢走 pointerdown。 */
    await p.ev(`(() => {
      window.__pins = {};
      window.__pin = (sel, l, t, pe) => {
        if (window.__pins[sel]) clearInterval(window.__pins[sel]);
        const iv = setInterval(() => {
          const e = document.querySelector(sel);
          if (!e) return;
          e.style.setProperty('left', l, 'important');
          e.style.setProperty('top', t, 'important');
          if (pe) e.style.setProperty('pointer-events', 'none', 'important');
        }, 40);
        window.__pins[sel] = iv;
        return true;
      };
      window.__unpin = (sel) => {
        const clear = s => {
          clearInterval(window.__pins[s]); delete window.__pins[s];
          const e = document.querySelector(s);
          if (!e) return;
          /* 把 important 内联值降级成普通内联值，元素停在原位但游戏自己的 moveEl 可以再推动它 */
          const l = e.style.getPropertyValue('left'), t = e.style.getPropertyValue('top'), pe = e.style.getPropertyValue('pointer-events');
          e.style.removeProperty('left'); e.style.removeProperty('top'); e.style.removeProperty('pointer-events');
          if (l) e.style.left = l;
          if (t) e.style.top = t;
          if (pe) e.style.pointerEvents = pe;
        };
        if (sel) { clear(sel); return true; }
        Object.keys(window.__pins || {}).forEach(clear); return true;
      };
      return true;
    })()`);
    const readSave = async () => JSON.parse(await p.ev(`localStorage.getItem('slimeSummonerSave')`));
    const bondOf = async id => { const s = await readSave(); const t = (s.slimes || []).find(x => String(x.id) === String(id)); return t ? Number(t.intimacy) : null; };

    /* ⓪ 亲密度 ≥30 的伙伴会冒「名字：里程碑台词」气泡：长名字在窄屏下要换行、不能溢出屏幕 */
    const bubble = await waitFor(() => p.ev(`(() => {
      const el = document.querySelector(${q(selA)} + ' .sys-bubble.show');
      if(!el) return null;
      const r = el.getBoundingClientRect(), pg = document.querySelector('#playground').getBoundingClientRect();
      return { text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, sw: el.scrollWidth, cw: el.clientWidth, vw: window.innerWidth, below: el.classList.contains('below'), pgLeft: pg.left, pgRight: pg.right, pgTop: pg.top, pgBottom: pg.bottom };
    })()`), 6000);
    if (bubble) await shot('bubble');
    const inside = !!bubble && bubble.left >= bubble.pgLeft - 1 && bubble.right <= bubble.pgRight + 1 && bubble.top >= bubble.pgTop - 1 && bubble.bottom <= bubble.pgBottom + 1;
    check('伙伴里程碑气泡出现，长名字换行且完整落在场景可视区内（不横向/纵向被裁）', !!bubble && bubble.text.includes('甲') && bubble.sw <= bubble.cw + 1 && bubble.right <= bubble.vw + 1 && inside, bubble && { text: bubble.text, left: Math.round(bubble.left), right: Math.round(bubble.right), top: Math.round(bubble.top), bottom: Math.round(bubble.bottom), pgTop: Math.round(bubble.pgTop), below: bubble.below, sw: bubble.sw, cw: bubble.cw });

    /* 让系统史莱姆挪到角落并脱离触摸命中测试（它随机落在伙伴身上会抢走 pointerdown） */
    await p.ev(`(() => { window.__pin('#playground .pl-slime[data-id="__sys__"]', '92%', '88%', true); return true; })()`);
    /* 把甲、乙钉到互不重叠的固定位置：随机落点偶尔会压在小游戏入口/玩具条或场景边缘，
       导致「点自己的中心点」命不中，抚摸与拖动手势会随机失败 */
    await p.ev(`(() => {
      window.__pin(${JSON.stringify(selA)}, '50%', '58%');
      window.__pin(${JSON.stringify(selB)}, '20%', '34%');
      return true;
    })()`);
    await sleep(3400);
    const pinDbg = await p.ev(`(() => {
      const sys = document.querySelector('#playground .pl-slime[data-id="__sys__"]');
      const a = document.querySelector(${q(selA)});
      const hitA = a ? (r => { const t = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)); return t ? (t.closest('.pl-slime') ? (t.closest('.pl-slime').dataset.id || 'sys') : t.tagName + '.' + t.className) : null; })(a.getBoundingClientRect()) : null;
      return { styleAttr: sys ? sys.getAttribute('style') : null, pe: sys ? getComputedStyle(sys).pointerEvents : null, pinA: a ? a.getAttribute('style') : null, hitA };
    })()`);
    console.log('PIN-DEBUG', JSON.stringify(pinDbg));
    /* 位置摆好就松开：再钉着会跟游戏自己的「拖动跟手 / 跟手势靠近」逻辑打架 */
    await p.ev(`(() => { window.__unpin(${JSON.stringify(selA)}); window.__unpin(${JSON.stringify(selB)}); return true; })()`);
    await sleep(600);
    const unpinDbg = await p.ev(`(() => {
      const a = document.querySelector(${q(selA)});
      return { pinA: a ? a.getAttribute('style') : null, tracking: a ? a.classList.contains('tracking') : null };
    })()`);
    console.log('UNPIN-DEBUG', JSON.stringify(unpinDbg));

    /* 抚摸辅助：史莱姆会被巡视定时器挪位置，所以每次点前重新取坐标，最多重试几次 */
    let tapDebug = null;
    const hitTest = async r => p.ev(`(() => {
      const top = document.elementFromPoint(${r.cx}, ${r.cy});
      const pl = top && top.closest ? top.closest('.pl-slime') : null;
      return { cx: ${Math.round(r.cx)}, cy: ${Math.round(r.cy)}, top: top ? top.tagName + '.' + (top.className || '') : null, hitId: pl ? pl.dataset.id : null };
    })()`);
    const tapPet = async (expectRe, tries = 4) => {
      let last = '';
      for (let i = 0; i < tries; i++) {
        const r = await p.ev(RECT(selA));
        await sleepMs(120);
        await p.ev(clearFloats());
        await p.touch.tap(r.cx, r.cy);
        for (let j = 0; j < 12; j++) {
          last = await p.ev(`Array.from(document.querySelectorAll('.float-text')).map(f => f.textContent).join(' | ')`);
          if (last) break;
          await sleepMs(100);
        }
        if (expectRe.test(last)) return last;
        tapDebug = await hitTest(r);
        await sleepMs(350);
      }
      return last;
    };

    /* ① 手指抚摸：亲密 +1，并出现「亲密+1」浮字 */
    await p.ev(`(() => { window.scrollTo(0, 0); const c = document.querySelector('#content'); if (c) c.scrollTop = 0; return true; })()`);
    await sleep(350);
    const rectA = await p.ev(RECT(selA));
    check('拿到伙伴甲的触屏坐标（元素在视口内）', !!rectA && rectA.cy > 0 && rectA.cy < 844, rectA && { x: Math.round(rectA.cx), y: Math.round(rectA.cy) });
    const intimacyBefore = await bondOf(idA);
    const float1 = await tapPet(/亲密\+1/);
    await sleep(200);
    const intimacyAfter = await bondOf(idA);
    check('手指抚摸：亲密度 +1（34→35）', intimacyAfter === intimacyBefore + 1, { before: intimacyBefore, after: intimacyAfter, tapDebug });
    check('抚摸反馈浮字出现「亲密+1」', /亲密\+1/.test(float1), float1);

    /* ② 30 秒内再次抚摸：只加心情，不再加亲密 */
    await sleepMs(1200); /* 等上一枚浮字自然消失，避免读到旧浮字 */
    const float2 = await tapPet(/心情\+10/);
    await sleep(200);
    const intimacyAfter2 = await bondOf(idA);
    check('30 秒内重复抚摸被限流：亲密不变、只加心情', intimacyAfter2 === intimacyAfter && /心情\+10/.test(float2) && !/亲密/.test(float2), { intimacy: intimacyAfter2, float: float2 });

    /* ③ 手指拖动：落点跟手、拖动中摆动、松手不回弹、页面不滚动 */
    const dragStart = await p.ev(`(() => {
      const el = document.querySelector(${q(selA)});
      el.scrollIntoView({ block:'center', inline:'nearest', behavior:'instant' });
      const r = el.getBoundingClientRect(), pg = document.querySelector('#playground').getBoundingClientRect();
      return { cx: r.left + r.width/2, cy: r.top + r.height/2, pgLeft: pg.left, pgWidth: pg.width, left: parseFloat(el.style.left) };
    })()`);
    const from = { x: dragStart.cx, y: dragStart.cy };
    const to = { x: from.x + 40, y: from.y - 30 };
    const expectLeft = (to.x - dragStart.pgLeft) / dragStart.pgWidth * 100;
    await p.touch.start(from.x, from.y);
    await sleep(40);
    for (let i = 1; i <= 10; i++) {
      await p.touch.move(from.x + (to.x - from.x) * i / 10, from.y + (to.y - from.y) * i / 10);
      await sleep(20);
    }
    const during = await p.ev(`(() => { const el = document.querySelector(${q(selA)}); const s = el && el.querySelector('.slime'); return { dragging: !!el && el.classList.contains('dragging'), transform: s ? (s.style.transform || '') : '', left: el ? parseFloat(el.style.left) : null }; })()`);
    await shot('drag');
    await p.touch.end();
    await sleep(200);
    const afterDrop = await p.ev(`(() => { const el = document.querySelector(${q(selA)}); const c = document.querySelector('#content') || document.scrollingElement; return { left: parseFloat(el.style.left), dragging: el.classList.contains('dragging'), scrollY: window.scrollY || document.scrollingElement.scrollTop, contentTop: c ? c.scrollTop : 0 }; })()`);
    await sleep(700);
    const settled = await p.ev(LEFTPCT(selA));
    check('拖动中元素进入 dragging 状态', during.dragging === true, during.dragging);
    check('拖动中史莱姆摆动（transform 带 rotate）', /rotate\(-?[\d.]+deg\)/.test(during.transform), during.transform);
    check('拖动落点跟手指（落点百分比与触点位置相差 < 8%）', Math.abs(afterDrop.left - expectLeft) < 8, { before: Math.round(dragStart.left), during: Math.round(during.left), after: Math.round(afterDrop.left), expect: Math.round(expectLeft) });
    check('松手后被拖到的手指位置保持不变（0.9 秒内不回弹）', Math.abs(settled - afterDrop.left) < 1.5, { afterDrop: afterDrop.left, settled });
    check('拖动过程页面没有跟着滚动（触摸被元素接管）', (afterDrop.scrollY || 0) === 0, afterDrop.scrollY);

    /* ④ 空白处跟手：亲密度 ≥5 的甲追手指，亲密度 1 的乙不追
       史莱姆落点随机，偶尔会压在候选点上，因此挑点要远离所有史莱姆中心，并允许有限次重试 */
    const pickSpot = () => p.ev(`(() => {
      const pg = document.querySelector('#playground').getBoundingClientRect();
      const rects = Array.from(document.querySelectorAll('#playground .pl-slime')).map(e => e.getBoundingClientRect());
      const ys = [0.80, 0.88, 0.72, 0.92, 0.64, 0.56, 0.96, 0.50], xs = [0.18, 0.28, 0.10, 0.40, 0.55, 0.68, 0.06, 0.78];
      for (const fy of ys) for (const fx of xs) {
        const x = pg.left + pg.width * fx, y = pg.top + pg.height * fy;
        const el = document.elementFromPoint(x, y);
        if (!el || el.closest('.pl-slime') || !el.closest('#playground')) continue;
        const near = rects.some(r => Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y) < 70);
        if (near) continue;
        return { x, y, pct: fx * 100 };
      }
      return null;
    })()`);
    let spot = null, aBefore = 0, bBefore = 0, aAfter = 0, bAfter = 0, trackingDuring = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      spot = await pickSpot();
      if (!spot) break;
      aBefore = await p.ev(LEFTPCT(selA));
      bBefore = await p.ev(LEFTPCT(selB));
      await p.touch.start(spot.x, spot.y);
      await sleep(80);
      trackingDuring = null;
      for (let i = 1; i <= 5; i++) {
        await p.touch.move(spot.x + i * 6, spot.y - i * 3);
        await sleep(170);
        if (i === 3) trackingDuring = await p.ev(`(() => ({ a: document.querySelector(${q(selA)}).classList.contains('tracking'), b: document.querySelector(${q(selB)}).classList.contains('tracking') }))()`);
      }
      if (attempt === 1) await shot('follow');
      await p.touch.end();
      await sleep(600);
      aAfter = await p.ev(LEFTPCT(selA));
      bAfter = await p.ev(LEFTPCT(selB));
      const pulled = Math.abs(aAfter - aBefore) > 1.5;
      console.log('FOLLOW-ATTEMPT', attempt, JSON.stringify({ spotX: spot && Math.round(spot.x), aBefore: Number(aBefore.toFixed(1)), aAfter: Number(aAfter.toFixed(1)), tracking: trackingDuring }));
      if (!!(trackingDuring && trackingDuring.a) && pulled) break;
      await sleep(500);
    }
    check('找到陪伴页的空白触控点（且远离所有史莱姆）', !!spot, spot && { x: Math.round(spot.x), y: Math.round(spot.y) });
    check('手指按下后亲密度 ≥5 的甲进入 tracking 跟随状态', !!(trackingDuring && trackingDuring.a), trackingDuring);
    check('亲密度 <5 的乙不进入 tracking 跟随状态', !!(trackingDuring && trackingDuring.b === false), trackingDuring);
    check('甲的横向位置随手指移动（朝触点方向偏移）', Math.abs(aAfter - aBefore) > 1.5 || aAfter > aBefore + 1.5, { before: Number(aBefore.toFixed(1)), after: Number(aAfter.toFixed(1)), touchX: spot && Math.round(spot.x) });
    check('乙的位置没有被跟手逻辑拉动（仍在原地附近）', Math.abs(bAfter - bBefore) < 12 || Math.abs(bAfter - (spot ? spot.pct : bBefore)) > 8, { before: Number(bBefore.toFixed(1)), after: Number(bAfter.toFixed(1)) });

    /* ⑤ 触屏点标签页 */
    const tab = await p.ev(RECT('.tabbar button[data-tab="travel"]'));
    await p.touch.tap(tab.cx, tab.cy);
    await sleep(700);
    const travelOk = await p.ev(`(() => ({ active: document.querySelector('.tabbar button[data-tab="travel"]').classList.contains('active'), hasGoals: document.body.innerText.includes('旅途目标') }))()`);
    check('触屏点击标签页能切换（探索页 + 旅途目标可见）', travelOk.active && travelOk.hasGoals, travelOk);
    await shot('travel-touch');

    /* ⑥ 触屏选玩具 + 玩「扔皮球」：点史莱姆开局、点球接住 */
    const spaceTab = await p.ev(RECT('.tabbar button[data-tab="space"]'));
    await p.touch.tap(spaceTab.cx, spaceTab.cy);
    await sleep(800);
    await freezeWander();
    const toy = await p.ev(RECT('.toy-bar button[data-toy="ball"]'));
    await p.touch.tap(toy.cx, toy.cy);
    await sleep(400);
    check('触屏点选玩具「扔皮球」生效', await p.ev(`!!document.querySelector('.toy-bar button[data-toy="ball"].on')`));

    const rectA2 = await p.ev(RECT(selA));
    await p.touch.tap(rectA2.cx, rectA2.cy);
    const started = await waitFor(() => p.ev(`!!document.querySelector('#gameOverlay #gameBall')`), 6000);
    check('触屏点击史莱姆可以开始小游戏', !!started);

    let catches = '0';
    if (started) {
      await sleep(350);
      for (let i = 0; i < 24; i++) {
        const ball = await p.ev(RECT('#gameBall'));
        if (!ball) break;
        await p.touch.tap(ball.cx, ball.cy);
        await sleep(240);
        catches = await p.ev(`document.querySelector('#gCatch').textContent`);
        if (Number(catches) > 0) break;
      }
      await shot('ballgame');
    }
    check('触屏点中飞来的球（小游戏计分 +1）', Number(catches) >= 1, { catches });
    if (started) {
      const closeBtn = await p.ev(RECT('#gClose'));
      await p.touch.tap(closeBtn.cx, closeBtn.cy);
      await sleep(600);
      check('触屏点「退出」能关闭小游戏', await p.ev(`!document.querySelector('#gameOverlay')`));
    }

    /* ⑦ 触摸产生的状态已落盘 */
    const finalSave = await readSave();
    const finalA = (finalSave.slimes || []).find(x => String(x.id) === idA);
    check('触摸产生的亲密值已写入存档（含抚摸时间戳）', Number(finalA.intimacy) === intimacyAfter2 && Number.isFinite(Number(finalA.lastPetAt)), { intimacy: finalA.intimacy, lastPetAt: typeof finalA.lastPetAt });

    /* ⑧ 头顶空间不足时气泡翻到脚下，仍完整可见（放在最后，避免影响前面的交互）
       把场景压矮、伙伴钉在靠上位置，制造「上方放不下」的几何条件 */
    await p.ev(`(() => {
      const pg = document.getElementById('playground');
      if (pg) pg.style.setProperty('height', '140px', 'important');
      window.__pin(${JSON.stringify(selA)}, '50%', '14%');
      const el = document.querySelector(${q(selA)});
      const b = el && el.querySelector('.sys-bubble');
      if (b) b.classList.remove('show', 'below');
      return true;
    })()`);
    await sleep(3600);
    const bubbleBelow = await waitFor(() => p.ev(`(() => {
      const el = document.querySelector(${q(selA)} + ' .sys-bubble.show');
      if (!el) return null;
      const r = el.getBoundingClientRect(), pg = document.querySelector('#playground').getBoundingClientRect();
      return { text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, below: el.classList.contains('below'), pgLeft: pg.left, pgRight: pg.right, pgTop: pg.top, pgBottom: pg.bottom };
    })()`), 12000);
    if (bubbleBelow) await shot('bubble-below');
    const belowInside = !!bubbleBelow && bubbleBelow.top >= bubbleBelow.pgTop - 1 && bubbleBelow.bottom <= bubbleBelow.pgBottom + 1 && bubbleBelow.left >= bubbleBelow.pgLeft - 1 && bubbleBelow.right <= bubbleBelow.pgRight + 1;
    check('史莱姆贴近场景上沿时气泡翻到脚下，仍完整落在场景内', belowInside && !!bubbleBelow && bubbleBelow.below === true, bubbleBelow && { text: bubbleBelow.text, top: Math.round(bubbleBelow.top), bottom: Math.round(bubbleBelow.bottom), pgTop: Math.round(bubbleBelow.pgTop), below: bubbleBelow.below });
  } catch (e) {
    check('执行过程未抛异常', false, e.message);
  } finally {
    await p.close();
  }
  reportData.pass = results.filter(r => r.status === 'PASS').length;
  reportData.total = results.length;
  const file = report(__dirname, 'touch-report.json', reportData);
  console.log(`\nRESULT ${reportData.pass}/${reportData.total} passed → ${path.relative(ROOT, file)}`);
  process.exitCode = reportData.pass === reportData.total ? 0 : 1;
})();
