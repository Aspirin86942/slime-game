#!/usr/bin/env node
'use strict';
/** 数值模拟：用真实游戏函数跑种子化战斗与派遣，输出胜率、回合数和经济数据。
 * Node VM 执行，DOM/计时器为模拟；只测数值，不测画面。
 * 用法（项目根目录）：
 *   node tests/balance-sim.cjs [史莱姆.html] [--n=200] [--json=tools/out/balance.json] [--check]
 * --checkpoint=tools/out/balance-checkpoint.json：中断后复用同源码、同参数已完成的楼层。
 * --check：按《数值设计.md》的目标区间判定，任一不达标则退出码 1。
 */
const fs = require('fs');
const path = require('path');
const {createHash}=require('node:crypto');
const args = require.main === module ? process.argv.slice(2) : [];
const opt = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const file = path.resolve(args.find(x => !x.startsWith('--')) || path.join(__dirname, '..', '史莱姆.html'));
const N = Number(opt('n')) || 200;
if(!Number.isInteger(N) || N<1) throw new Error('--n 必须是正整数');
const html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const code = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const {boot} = require('./lib/vm-harness.cjs').loadGame(file, code);

function seed(h, n) {
  let sd = (n * 2654435761) >>> 0 || 1;
  h.context.Math.random = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
}
/* 按游戏自己的召唤与成长规则造一只 L 级伙伴（潜力随机，与玩家真实召唤一致） */
function makeSlime(h, level) {
  const s = h.run('createSlime(false)');
  s.level = level;
  for (const k of ['str', 'agi', 'mag']) s[k] = h.run(`growthStat(${s[k + 'Potential']},${level})`);
  s.hp = h.run('hpMax')(s);
  return s;
}
/* 跑一场深渊战斗到结束；返回 {win, turns} */
/* 队伍人数随进度增长：召唤位 2 + 召唤师等级/10，按玩家到达该层时的典型席位估算 */
function teamSize(floor) { return floor < 10 ? 2 : floor < 20 ? 3 : floor < 35 ? 4 : 5; }
function battle(h, level, floor, team = Number(opt('team')) || teamSize(floor)) {
  const S = h.state();
  S.started = true; S.globalPlan = null; S.customPlans = {}; S.battleMode = 'auto'; S.battleSpeed = 10;
  S.slimes = Array.from({length: team}, () => makeSlime(h, level));
  S.abyssUnlocked = Math.max(S.abyssUnlocked || 1, floor); S.abyssLevel = floor;
  h.run('abyssSetupSel=S.slimes.map(s=>s.id);startAbyssBattle();');
  const b = h.context.__TEST__._battle;
  let guard = 0;
  while (!b.B.ended && guard++ < 200) { b.nextTurn(); h.flush(1e9); }
  const res = {win: !!(b.B.result && b.B.result.win), turns: b.B.turn, ended: b.B.ended};
  b.closeBattle(); h.flush(1e9);
  return res;
}
const DELTAS = opt('deltas') ? opt('deltas').split(',').map(Number) : [-5, -3, 0, 2, 5, 10];
const FLOORS = opt('floors') ? opt('floors').split(',').map(Number) : [1,3,4,5,9,10,14,15,19,20,24,25,29,30,34,35,39,40,44,45,49,50];
function winGrid() {
  const checkpoint=opt('checkpoint'),identity=createHash('sha256').update(html).update(fs.readFileSync(__filename)).update(fs.readFileSync(path.join(__dirname,'lib/vm-harness.cjs'))).update(JSON.stringify({N,DELTAS,FLOORS,team:opt('team')})).digest('hex');
  let completed=[];if(checkpoint&&fs.existsSync(checkpoint)){const saved=JSON.parse(fs.readFileSync(checkpoint,'utf8'));if(saved.identity===identity)completed=saved.rows;}
  const rows = [];
  for (const F of FLOORS) {
    const saved=completed.find(r=>r.floor===F);if(saved){rows.push(saved);console.log(`复用已完成 F${F}: ${N*DELTAS.length} 场`);continue;}
    const row = {floor: F, team: Number(opt('team')) || teamSize(F), cells: {}};
    for (const d of DELTAS) {
      const L = Math.max(1, F + d);
      let wins = 0, turns = 0, stalled = 0;
      for (let i = 0; i < N; i++) {
        const h = boot();
        seed(h, F * 10007 + i); // 同一组伙伴与敌人跨等级对照，减少抽样差异。
        const r = battle(h, L, F);
        wins += r.win; turns += r.turns; stalled += !r.ended;
      }
      row.cells[d] = {level: L, win: wins / N, turns: turns / N, stalled};
    }
    rows.push(row);console.log(`完成 F${F}: ${N*DELTAS.length} 场 (${rows.length}/${FLOORS.length})`);
    if(checkpoint){fs.mkdirSync(path.dirname(checkpoint),{recursive:true});fs.writeFileSync(checkpoint,JSON.stringify({identity,rows}));}
  }
  return rows;
}
/* 派遣经济：单只 L 级伙伴在线 seconds 秒（真实 runPlans / 恢复计时器） */
function economy(level, seconds, mapIndex = 0) {
  const h = boot();
  seed(h, 777 + level);
  const S = h.state();
  S.started = true; S.slimes = [makeSlime(h, level)]; S.globalPlan = 'explore'; S.exploreTeam = null; S.exploreMapIndex = mapIndex;
  S.abyssUnlocked = mapIndex === 2 ? 26 : mapIndex === 1 ? 11 : 1;
  h.run(`S.world.familiar=['${mapIndex*2}:0'];S.world.discoveries=Array.from({length:20},(_,i)=>'fixture:'+i);S.world.stock.feed=9999;LivingWorld.execute(S,{type:'depart',region:${mapIndex*2},route:0,team:S.slimes.map(s=>s.id),mode:'offline',duration:300,repeat:true});`);
  const coins0 = S.coins, treasure0 = S.bag.treasure, exp0 = S.slimes[0].exp, lv0 = S.slimes[0].level;
  for (let t = 1; t <= seconds; t++) h.tick(1000);
  const s = S.slimes[0];
  let expTotal = s.exp - exp0;
  for (let l = lv0; l < s.level; l++) expTotal += h.run(`slimeExpNeed(${l})`);
  const levelsPerHour = (s.level - lv0 + s.exp / h.run(`slimeExpNeed(${s.level})`) - exp0 / h.run(`slimeExpNeed(${lv0})`)) * 3600 / seconds;
  return {level, mapIndex, coins: S.coins - coins0, treasure: S.bag.treasure - treasure0, exp: expTotal, levelsGained: s.level - lv0, levelsPerHour};
}
/* 离线：直接调用游戏的离线结算（若存在） */
function offline(level, hours) {
  const h = boot();
  seed(h, 999 + level);
  if (h.run('typeof settleOffline') !== 'function') return null;
  const S = h.state();
  S.started = true; S.slimes = [makeSlime(h, level)]; S.globalPlan = 'explore'; S.exploreTeam = null;
  h.run("S.world.familiar=['0:0'];S.world.stock.feed=9999;LivingWorld.execute(S,{type:'depart',region:0,route:0,team:S.slimes.map(s=>s.id),mode:'offline',duration:300,repeat:true});");
  const coins0 = S.coins;
  const r = h.run('settleOffline')(hours * 3600 * 1000);
  return {level, hours, coins: S.coins - coins0, seconds: r.seconds, actions: r.actions, levelsGained: S.slimes[0].level - level};
}
/* 首通经验按实际敌人编制与全员生还估算；战斗中的阵亡者不分经验。 */
function levelPace() {
  const h = boot();
  return FLOORS.map(F => {
    const L = F + 2;
    const team = teamSize(F);
    const count = h.run('typeof abyssEnemyCount') === 'function' ? h.run('abyssEnemyCount')(F) : 3;
    const fake = {monsters: Array.from({length:count},(_,i) => ({hp: 0, ref: {level: F, isBoss: F % 5 === 0 && i === 0}})), allies: Array.from({length: team}, () => ({hp: 1, ref: {}}))};
    const r = h.run('calculateBattleRewards')(fake, true, F);
    const per = Math.floor(r.totalExp / team);
    const need = h.run(`slimeExpNeed(${L})`);
    return {floor: F, level: L, expPerSlimePerWin: per, need, winsPerLevel: +(need / per).toFixed(2)};
  });
}

function starter30(){
  const h=boot();seed(h,20261027);const S=h.state();S.started=true;
  h.run('doSummon();clearSummonReveal();doSummon();clearSummonReveal();');
  const afterSummon=S.coins;h.run("S.world.familiar=['0:0'];S.world.stock.feed=9999;LivingWorld.execute(S,{type:'depart',region:0,route:0,team:S.slimes.map(s=>s.id),mode:'offline',duration:300,repeat:true});");
  for(let t=0;t<1800;t++)h.tick(1000);
  const earned=S.coins-afterSummon,level=S.slimes[0].level;
  const cost=h.run('mergeCost(S.slimes[0],S.slimes[1])');
  h.run("for(const t of [...S.world.trips]){LivingWorld.dispatch({type:'recall',id:t.id});LivingWorld.dispatch({type:'claimTrip',id:t.id});}S.globalPlan=null;mergeSel=S.slimes.map(s=>s.id);doMerge();");
  const merged=S.slimes.length===1;h.run('doSummon();clearSummonReveal();');
  return {earned,level,mergeCost:cost,merged,refilled:S.slimes.length===2,coinsLeft:S.coins};
}
function hitPace(){
  const h=boot();
  return [1,10,30,50].map(level=>{
    const s=makeSlime(h,level);Object.assign(s,{element:'岩',personality:'天真',traits:[],size:0.8});
    for(const k of ['str','agi','mag'])s[k]=h.run('growthStat')(13,level);
    const atk=h.run('typeof attackPower')==='function'?h.run('attackPower')(s):h.run('physAtk')(s);
    const reduction=h.run('typeof mitigation')==='function'?h.run('mitigation')(s,s):1;
    const hp=h.run('hpMax')(s),damage=Math.max(1,Math.round(atk*reduction));
    return {level,hp,damage,normalHits:Math.ceil(hp/damage),criticalAdvantageHits:Math.ceil(hp/(damage*1.6*2))};
  });
}

if(require.main === module){
const t0 = Date.now();
const grid = args.includes('--economy-only') ? [] : winGrid();
const econ = [1, 10, 30].map(L => economy(L, 3600));
const off = offline(10, 12);
const pace = levelPace();
const starter=starter30(),hits=hitPace(),regions=[economy(10,3600,1),economy(30,3600,2)];
const out = {file: path.basename(file), sha256:createHash('sha256').update(html).digest('hex'), elapsedSeconds:(Date.now()-t0)/1000, n: N, seedScheme:'floor * 10007 + sample', grid, economyPerHour: econ, regionEconomy:regions, offline12h: off, levelPace: pace,starter30:starter,hitPace:hits};

console.log(`== 胜率（前期 2 只、随后 3/4/5 只随机伙伴，每格 ${N} 场；列 = 伙伴等级相对层数）==`);
console.log('层数 | ' + DELTAS.map(d => (d >= 0 ? '+' : '') + d).map(s => s.padStart(10)).join(''));
for (const r of grid) console.log(String(r.floor).padStart(4) + ' | ' + DELTAS.map(d => {
  const c = r.cells[d]; return `${Math.round(c.win * 100)}%/${c.turns.toFixed(1)}`.padStart(10);
}).join(''));
console.log('（单元格 = 胜率/平均回合数）');
console.log('== 在线派遣 1 小时（单只）==');
econ.forEach(e => console.log(`Lv${e.level}: 晶币 ${e.coins}，经验 ${e.exp}，约 ${(e.levelsPerHour||e.levelsGained).toFixed(2)} 级，天材地宝 ${e.treasure}`));
console.log('== 离线 12 小时（单只 Lv10）==', off ? `晶币 ${off.coins}，探险 ${off.actions} 次，升 ${off.levelsGained} 级` : '无离线结算');
console.log('== 首通经验（L=F+2，每只出战伙伴）==');
pace.forEach(p => console.log(`F${p.floor} L${p.level}: 每胜 ${p.expPerSlimePerWin} 经验，升级需 ${p.need}，约 ${p.winsPerLevel} 胜/级`));
console.log('== 前 30 分钟 ==',JSON.stringify(starter));
console.log('== 同级普攻次数（不含护盾/闪避/技能）==',JSON.stringify(hits));
console.log('== 解锁区域每小时单只收益 ==',JSON.stringify(regions));
console.log(`耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const jsonPath = opt('json');
if (jsonPath) { fs.mkdirSync(path.dirname(jsonPath), {recursive: true}); fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2)); }

if (args.includes('--check')) {
  const fails = [];
  const cell = (F, d) => grid.find(r => r.floor === F).cells[d];
  for (const r of grid) {
    const F = r.floor;
    const even = cell(F, 2).win, under = cell(F, -3).win, over = cell(F, 10).win;
    const boss = F % 5 === 0;
    // 普通层供练习与推进，首领承担养成门槛；随机元素允许强阵容适当越层。
    const lo = boss ? 0.50 : 0.75, hi = boss ? 0.85 : 1;
    if (even < lo || even > hi) fails.push(`F${F} 等级+2 胜率 ${Math.round(even * 100)}% 不在 ${lo * 100}–${hi * 100}%`);
    if (boss && under > 0.45) fails.push(`F${F} 等级-3 胜率 ${Math.round(under * 100)}% 应 ≤45%`);
    if (boss && even-under < 0.2) fails.push(`F${F} 等级成长没有带来至少 20 个百分点的胜率提升`);
    if (over < 0.85) fails.push(`F${F} 等级+10 胜率 ${Math.round(over * 100)}% 应 ≥85%`);
    const tr = cell(F, 2).turns;
    if (tr < 3 || tr > 15) fails.push(`F${F} 等级+2 平均 ${tr.toFixed(1)} 回合，应在 3–15`);
    Object.values(r.cells).forEach(c => { if (c.stalled) fails.push(`F${F} L${c.level} 有 ${c.stalled} 场 200 回合未结束`); });
  }
  const bosses=grid.filter(r=>r.floor%5===0);
  if(bosses.length>=5 && bosses.reduce((s,r)=>s+r.cells[-3].win,0)/bosses.length>0.25) fails.push('首领组低 3 级平均胜率应 ≤25%');
  for(const r of bosses){const prev=grid.find(p=>p.floor===r.floor-1);if(prev && prev.cells[2].win-r.cells[2].win<0.1)fails.push(`F${r.floor} 首领应比前一层至少难 10 个百分点`);}
  // 首通给约 0.2–1.5 级：有意义但不能替代挂机成长
  pace.forEach(p => { if (p.winsPerLevel < 0.66 || p.winsPerLevel > 5) fails.push(`F${p.floor} 首通每只伙伴 ${p.expPerSlimePerWin} 经验，约 ${p.winsPerLevel} 场/级，应在 0.66–5`); });
  // 经济：在线 1 小时单只伙伴（草原）
  const e1 = econ.find(e => e.level === 1), e30 = econ.find(e => e.level === 30);
  if (e1.coins < 2000 || e1.coins > 6000) fails.push(`Lv1 每小时晶币 ${e1.coins}，应在 2000–6000`);
  if (e30.coins < 10000 || e30.coins > 30000) fails.push(`Lv30 每小时晶币 ${e30.coins}，应在 10000–30000`);
  // 挂机 1 小时折合的等级数（含不足一级的部分），中期目标约 1 级/小时
  econ.forEach(e => { const lv = e.levelsPerHour; if (lv < 0.6 || lv > 3) fails.push(`Lv${e.level} 挂机 1 小时 ${lv.toFixed(2)} 级，应在 0.6–3`); });
  if (!off || off.actions < 500) fails.push('离线 12 小时结算缺失或探险次数过少');
  if(!starter.merged || !starter.refilled || starter.coinsLeft<0) fails.push('前 30 分钟应能召满两席、合体一次并补回第二只');
  hits.forEach(h=>{if(h.normalHits<4||h.normalHits>6||h.criticalAdvantageHits>3)fails.push(`Lv${h.level} 同级普攻/暴击克制伤害节奏不达标`);});
  if (fails.length) { console.log('CHECK FAIL\n- ' + fails.join('\n- ')); process.exit(1); }
  console.log('CHECK PASS');
}
}
module.exports = {seed, makeSlime, battle, teamSize};
