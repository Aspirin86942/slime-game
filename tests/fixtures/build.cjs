// 存档夹具生成器：真实会话 → 游戏内命令造状态 → 导出 localStorage → 规范化 → 反向校验 → 落盘。
// 用法：node tests/fixtures/build.cjs [name...]（缺省生成全部五份）。
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { start } = require('../lib/browser/session.cjs');

const SAVE_DIR = path.join(__dirname, 'saves');
const PAGE = '史莱姆.html';
const PROFILE = 'iphone-14';
const FIXTURE_NAME = '存档夹具';
const FIXTURE_DATE = '2026-01-01';
// 冻结夹具写 0：读档时游戏跳过离线补算，测试拿到的是夹具原文状态。
const FROZEN_LAST_ACTIVE = 0;
// 固定时间无法在运行时仍然“恰好 13 小时前”；这里写一个远超 12 小时上限的旧时间，
// 游戏读档时会补算到上限（43200 秒），离线语义保持不变且文件仍可重复生成。
const OFFLINE_LAST_ACTIVE = Date.UTC(2026, 0, 2) - 13 * 60 * 60 * 1000;

// 建造与升级只验证家园经营路径，库存给足即可；所有数值都由命令真实扣除。
const STOCK = [
  'wood', 'stone', 'dew', 'ingredient', 'petal', 'herb', 'fruit', 'notes', 'plank', 'ingot',
  'ore', 'honey', 'essence', 'stardust', 'crystal', 'feed', 'meal', 'snack', 'soup', 'potion',
  'fertilizer', 'soil', 'dye',
];

// 固定在右上角空地：与初始小屋/育苗床/饲料槽/玩具区互不相邻，扩建时不会互相挡住。
const FACILITIES = [
  ['kitchen', 24, 4],
  ['table', 28, 4],
  ['market', 32, 4],
  ['grove', 24, 8],
  ['archive', 28, 8],
  ['greenhouse', 32, 8],
];

const PAGE_HELPERS = `
  const cmd = function (command) {
    const result = LivingWorld.execute(S, command);
    if (!result.ok) throw new Error(command.type + ': ' + result.message);
    for (const event of (result.events || [])) {
      if (event.type === 'income') { S.coins += event.amount || 0; S.totalEarned += event.amount || 0; }
      if (event.type === 'points') S.points += event.amount || 0;
    }
    return result.message;
  };
  const stockUp = function () {
    const keys = ${JSON.stringify(STOCK)};
    for (const key of keys) S.world.stock[key] = 3000;
  };
  const buildFacilities = function (list) {
    for (const item of list) {
      cmd({ type: 'build', def: item[0], zone: 0, x: item[1], y: item[2] });
      const placement = S.world.placements.find(function (p) { return p.def === item[0]; });
      if (!placement) throw new Error('设施没有建成: ' + item[0]);
      cmd({ type: 'upgrade', id: placement.id });
      cmd({ type: 'upgrade', id: placement.id });
    }
  };
`;

// 全部地块开垦、全科技完成、6 座设施升到三档、4 株在长作物（订单夹具复用这套底子）。
function developedBody(missingTech) {
  const filter = missingTech
    ? `.filter(function (id) { return id !== ${JSON.stringify(missingTech)}; })`
    : '';
  return `
    S.world.clock = 1200;
    S.world.estate.plots = Array.from({ length: 24 }, function (_, index) { return index; });
    S.world.estate.tech = LivingWorld.TECHS.map(function (tech) { return tech.id; })${filter};
    stockUp();
    buildFacilities(${JSON.stringify(FACILITIES)});
    const crops = [['plant-0-0', 20, 20], ['plant-1-0', 21, 20], ['plant-2-0', 22, 20], ['plant-3-0', 23, 20]];
    const progress = [0.5, 0.35, 0.65, 0.2];
    crops.forEach(function (entry, index) {
      const variety = S.world.cultivars.find(function (c) { return c.species === entry[0]; });
      if (!variety) throw new Error('缺少品系: ' + entry[0]);
      cmd({ type: 'plant', cultivar: variety.id, zone: 0, x: entry[1], y: entry[2] });
      const crop = S.world.crops[S.world.crops.length - 1];
      crop.progress = progress[index];
      crop.water = 180;
      crop.lastSim = S.world.clock;
    });
`;
}

const ORDER_TAIL = `
    cmd({ type: 'research', id: 'cra-compost' });
    const order = S.world.estate.orders[0];
    if (!order) throw new Error('没有可完成的委托');
    cmd({ type: 'order', id: order.id });
    cmd({ type: 'sell', item: 'wood', amount: 10 });
`;

// 旧 V5 档：保留 saveVersion 5，设施 form 低于 level，地块只留一部分。
// 故意不写 estate.daily.orders：读档会走“家园扩展补齐”迁移并留下 v5 原文备份。
const LEGACY_BODY = `
    const estate = S.world.estate;
    estate.plots = [8, 9, 14, 15, 16];
    estate.tech = [];
    estate.research = [];
    estate.orders = [];
    estate.nextOrder = 0;
    estate.daily = { window: 0, made: {}, sold: 0 };
    estate.yields = {};
    const house = S.world.placements.find(function (p) { return p.def === 'house'; });
    const bed = S.world.placements.find(function (p) { return p.def === 'bed'; });
    if (!house || !bed) throw new Error('缺少初始设施');
    house.level = 3;
    house.form = 1;
    bed.level = 2;
    delete bed.form;
    const legacyVariety = S.world.cultivars.find(function (c) { return c.species === 'plant-0-1'; });
    if (!legacyVariety) throw new Error('缺少 legacy 品系');
    cmd({ type: 'plant', cultivar: legacyVariety.id, zone: 0, x: 13, y: 7 });
    const legacyCrop = S.world.crops[S.world.crops.length - 1];
    legacyCrop.progress = 0.4;
    legacyCrop.water = 120;
    legacyCrop.lastSim = S.world.clock;
    legacyCrop.legacy = true;
`;

const BUILDERS = [
  { name: 'mobile-baseline', lastActive: FROZEN_LAST_ACTIVE, body: '' },
  { name: 'mobile-developed', lastActive: FROZEN_LAST_ACTIVE, body: developedBody() },
  { name: 'mobile-orders', lastActive: FROZEN_LAST_ACTIVE, body: developedBody('cra-compost') + ORDER_TAIL },
  { name: 'mobile-offline', lastActive: OFFLINE_LAST_ACTIVE, body: '' },
  { name: 'legacy-v5', lastActive: FROZEN_LAST_ACTIVE, body: LEGACY_BODY, legacy: true },
];

const READ_STATE = `(() => {
  const world = S.world || null;
  return {
    started: S.started,
    saveVersion: S.saveVersion,
    coins: S.coins,
    points: S.points,
    plots: world && world.estate ? world.estate.plots.length : null,
    tech: world && world.estate ? world.estate.tech.length : null,
    research: world && world.estate ? world.estate.research.map(function (r) { return r.id; }) : [],
    orders: world && world.estate ? world.estate.orders.length : null,
    ordersDone: world && world.estate ? world.estate.daily.orders : null,
    sold: world && world.estate ? world.estate.daily.sold : null,
    clock: world ? world.clock : null,
    yields: world && world.estate ? Object.keys(world.estate.yields).length : 0,
    crops: world ? world.crops.map(function (c) {
      return { id: c.id, cultivar: c.cultivar, progress: c.progress, legacy: c.legacy === true };
    }) : [],
    placements: world ? world.placements.map(function (p) {
      return { id: p.id, def: p.def, level: p.level, form: p.form === undefined ? null : p.form };
    }) : [],
    backup: Object.keys(localStorage).some(function (key) { return key.indexOf(SAVE_KEY + '_v5_backup') === 0; }),
  };
})()`;

function pageScript(builder) {
  return `(() => {
    ${PAGE_HELPERS}
    ${builder.body}
    finishStory();
    // 固定时间和身份字段，让同一份状态每次序列化都得到相同字节。
    S.name = ${JSON.stringify(FIXTURE_NAME)};
    S.sysName = '团子';
    S.lastActive = ${builder.lastActive};
    S.planClock = 0;
    S.taskDate = ${JSON.stringify(FIXTURE_DATE)};
    const text = JSON.stringify(S);
    localStorage.setItem(SAVE_KEY, text);
    return localStorage.getItem(SAVE_KEY);
  })()`;
}

// 设施与伙伴 id 改递增序号：伙伴（slimes/companions）夹具里为空，设施、品系、作物统一重排。
// 先设施再品系/作物，保证引用（种子账、作物亲本、暂存产出）一起改写。
function normalizeEntityIds(world) {
  if ((world.trips && world.trips.length) || (world.juveniles && world.juveniles.length) || (world.crafts && world.crafts.length)) {
    throw new Error('id 规范化尚未覆盖 trips/juveniles/crafts，请先扩展生成器');
  }
  let serial = 0;
  const placements = new Map();
  for (const placement of world.placements) {
    const id = ++serial;
    placements.set(placement.id, id);
    placement.id = id;
  }
  const cultivars = new Map();
  for (const cultivar of world.cultivars) {
    const id = ++serial;
    cultivars.set(cultivar.id, id);
    cultivar.id = id;
  }
  const crops = new Map();
  for (const crop of world.crops) {
    const id = ++serial;
    crops.set(crop.id, id);
    crop.id = id;
  }
  for (const crop of world.crops) {
    if (cultivars.has(crop.cultivar)) crop.cultivar = cultivars.get(crop.cultivar);
  }
  const items = world.inventory.items;
  // 两阶段改写：新编号会与旧键重叠，直接边读边写会互相覆盖。
  const seeds = [];
  for (const key of Object.keys(items)) {
    if (!key.startsWith('seed:')) continue;
    const oldId = Number(key.slice('seed:'.length));
    if (!cultivars.has(oldId)) continue;
    seeds.push([cultivars.get(oldId), items[key]]);
    delete items[key];
  }
  for (const [id, value] of seeds) items['seed:' + id] = value;
  const estate = world.estate;
  if (estate && estate.yields) {
    const next = {};
    for (const [key, value] of Object.entries(estate.yields)) {
      const mapped = placements.get(Number(key));
      next[mapped === undefined ? key : mapped] = value;
    }
    estate.yields = next;
  }
  for (const job of world.workers || []) if (placements.has(job.building)) job.building = placements.get(job.building);
  for (const craft of world.crafts || []) if (placements.has(craft.building)) craft.building = placements.get(craft.building);
  for (const resident of Object.values(world.residents || {})) {
    if (resident.target > 0 && placements.has(resident.target)) resident.target = placements.get(resident.target);
    else if (resident.target < 0 && crops.has(-resident.target)) resident.target = -crops.get(-resident.target);
  }
  const used = [serial];
  for (const order of (estate && estate.orders) || []) used.push(order.id);
  for (const journal of world.journals || []) used.push(journal.id);
  for (const evidence of world.evidence || []) used.push(evidence.id);
  world.seq = Math.max(...used) + 1;
}

function normalizeState(state, builder) {
  const world = state.world;
  if (!world) throw new Error(builder.name + ': 快照缺少 world');
  state.saveVersion = 5;
  state.name = FIXTURE_NAME;
  state.sysName = '团子';
  state.sysLook = { h: 200, s: 70, l: 58, eh: 200, es: 65, el: 22 };
  state.theme = 'sunset';
  state.lastActive = builder.lastActive;
  state.planClock = 0;
  state.taskDate = FIXTURE_DATE;
  world.version = 5;
  if (builder.legacy) delete world.estate.daily.orders;
  normalizeEntityIds(world);
}

// 对象键排序后紧凑序列化：键顺序、空行和缩进都不会影响哈希。
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  return value;
}

async function buildOne(builder) {
  const session = await start({ profile: PROFILE, url: PAGE });
  let raw;
  try {
    raw = await session.ev(pageScript(builder));
  } finally {
    await session.close();
  }
  if (typeof raw !== 'string' || !raw) throw new Error(builder.name + ': 没有从 localStorage 导出快照');
  const state = JSON.parse(raw);
  if (state.saveVersion !== 5 || !state.world || state.world.version !== 5) {
    throw new Error(builder.name + ': 导出的不是 V5 存档');
  }
  normalizeState(state, builder);
  const text = JSON.stringify(canonical(state));
  fs.mkdirSync(SAVE_DIR, { recursive: true });
  fs.writeFileSync(path.join(SAVE_DIR, builder.name + '.json'), text + '\n', 'utf8');
  return { text, bytes: Buffer.byteLength(text + '\n', 'utf8') };
}

function formOf(placement) {
  return placement.form === undefined ? 1 : placement.form;
}

async function verify(builder) {
  const file = path.join(SAVE_DIR, builder.name + '.json');
  const fixture = JSON.parse(fs.readFileSync(file, 'utf8'));
  const session = await start({ profile: PROFILE, url: PAGE, seed: builder.name });
  let actual;
  try {
    actual = await session.ev(READ_STATE);
    actual.consoleErrors = session.consoleErrors.slice();
  } finally {
    await session.close();
  }
  const failures = [];
  const expect = (label, ok, detail) => {
    if (!ok) failures.push(label + (detail === undefined ? '' : '：' + JSON.stringify(detail)));
  };
  expect('S.started === true', actual.started === true, actual.started);
  expect('saveVersion 回读', actual.saveVersion === fixture.saveVersion, { actual: actual.saveVersion, fixture: fixture.saveVersion });
  expect('coins 回读', actual.coins === fixture.coins, { actual: actual.coins, fixture: fixture.coins });
  expect('plots 数量回读', actual.plots === fixture.world.estate.plots.length, { actual: actual.plots, fixture: fixture.world.estate.plots.length });
  expect('页内无错误', actual.consoleErrors.length === 0, actual.consoleErrors.slice(0, 3));

  if (builder.name === 'mobile-baseline') {
    expect('baseline 保留 4 块初始地块', actual.plots === 4, actual.plots);
    expect('baseline 没有完成科技', actual.tech === 0, actual.tech);
    expect('baseline 没有种植', actual.crops.length === 0, actual.crops.length);
    expect('baseline 只有 4 座初始设施', actual.placements.length === 4, actual.placements.length);
  }
  if (builder.name === 'mobile-developed') {
    expect('developed 全部 24 块地开垦', actual.plots === 24, actual.plots);
    expect('developed 全部 38 项科技完成', actual.tech === 38, actual.tech);
    expect('developed 有 4 株在长作物', actual.crops.length === 4 && actual.crops.every(c => c.progress > 0 && c.progress < 1), actual.crops);
    for (const [def] of FACILITIES) {
      const placement = actual.placements.find(p => p.def === def);
      expect('developed ' + def + ' 三档', !!placement && placement.level === 3 && formOf(placement) === 3, placement);
    }
  }
  if (builder.name === 'mobile-orders') {
    expect('orders 有 1 项研究进行中', actual.research.length === 1 && actual.research[0] === 'cra-compost', actual.research);
    expect('orders 完成 1 份委托', actual.ordersDone === 1, actual.ordersDone);
    expect('orders 完成 1 次出售', actual.sold === 40, actual.sold);
    expect('orders 委托余量', actual.orders === fixture.world.estate.orders.length, { actual: actual.orders, fixture: fixture.world.estate.orders.length });
    expect('orders 科技少一项', actual.tech === 37, actual.tech);
  }
  if (builder.name === 'mobile-offline') {
    const delta = actual.clock - fixture.world.clock;
    expect('offline 读档补算 12 小时上限', delta >= 43200 && delta <= 43320, delta);
    expect('offline 产出已进入暂存', actual.yields > 0, actual.yields);
  }
  if (builder.name === 'legacy-v5') {
    expect('legacy 保留 5 块旧地块', actual.plots === 5, actual.plots);
    expect('legacy 科技为空', actual.tech === 0, actual.tech);
    expect('legacy 触发了 v5 原文备份', actual.backup === true, actual.backup);
    const house = actual.placements.find(p => p.def === 'house');
    const bed = actual.placements.find(p => p.def === 'bed');
    expect('legacy 小屋 level 3 / form 1', !!house && house.level === 3 && house.form === 1, house);
    expect('legacy 育苗床 level 2 / 无 form', !!bed && bed.level === 2 && bed.form === null, bed);
    expect('legacy 作物保留 legacy 口味', actual.crops.length === 1 && actual.crops[0].legacy === true, actual.crops);
    expect('legacy 迁移后补齐委托计数', actual.ordersDone === 0, actual.ordersDone);
  }
  return failures;
}

(async () => {
  const requested = process.argv.slice(2);
  const known = new Map(BUILDERS.map(builder => [builder.name, builder]));
  for (const name of requested) {
    if (!known.has(name)) throw new Error('未知夹具: ' + name + '；可用: ' + [...known.keys()].join(', '));
  }
  const selected = requested.length ? requested : BUILDERS.map(builder => builder.name);
  let built = 0;
  for (const name of selected) {
    const builder = known.get(name);
    const output = await buildOne(builder);
    const failures = await verify(builder);
    if (failures.length) {
      // 反向校验失败说明这份存档不可用；删掉刚写出的文件，避免误提交。
      fs.rmSync(path.join(SAVE_DIR, builder.name + '.json'), { force: true });
      throw new Error(builder.name + ' 反向校验失败：' + failures.join('；'));
    }
    console.log('built ' + builder.name + '.json  ' + output.bytes + ' B');
    built += 1;
  }
  console.log('built ' + built + ' fixtures');
})().catch(error => {
  console.error('FAIL ' + ((error && error.message) || error));
  process.exitCode = 1;
});
