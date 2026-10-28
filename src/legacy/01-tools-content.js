/* ==================== 工具 ==================== */
const $ = s => document.querySelector(s);
const rnd = (a,b)=>a+Math.random()*(b-a);
const rndInt = (a,b)=>Math.floor(rnd(a,b+1));
const pick = a=>a[Math.floor(Math.random()*a.length)];
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const esc = s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function todayKey(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

const THEMES = [
  {id:'sunset',  name:'星空紫', color:'#8b5cf6'},
  {id:'dark',    name:'深色', color:'#8ab4f8'},
  {id:'light',   name:'浅色', color:'#7c8bd0'},
  {id:'peach',   name:'蜜桃', color:'#e0603a'},
  {id:'mint',    name:'薄荷', color:'#0d9488'},
  {id:'lavender',name:'薰衣草',color:'#7c3aed'}
];

const MAP_THEMES = [
  {id:'grass', name:'草原', unlock:0, coinMul:1, expMul:1, treasureMul:1, sky1:'#87CEEB', sky2:'#B0E0E6', grass1:'#4CAF50', grass2:'#388E3C', soil1:'#8D6E63', soil2:'#5D4037'},
  {id:'dusk', name:'黄昏', unlock:10, coinMul:1.6, expMul:1.25, treasureMul:1.5, sky1:'#FFB74D', sky2:'#FFCC80', grass1:'#8D6E63', grass2:'#5D4037', soil1:'#4E342E', soil2:'#3E2723'},
  {id:'snow', name:'雪原', unlock:25, coinMul:2.5, expMul:1.5, treasureMul:2, sky1:'#E1F5FE', sky2:'#B3E5FC', grass1:'#E0F2F1', grass2:'#B2DFDB', soil1:'#CFD8DC', soil2:'#90A4AE'}
];

/* 区域按深渊进度开放（通关第 unlock 层后），收益倍率更高，成为中后期收入增长的主要来源 */
function regionUnlocked(i){
  const map = MAP_THEMES[i];
  return !!map && getAbyssUnlocked() > map.unlock;
}

const ELEMENTS = {
  '岩':{h:32,  sat:.72, icon:'🪨'},
  '火':{h:20,  sat:1.15,icon:'🔥'},
  '水':{h:205, sat:1.05,icon:'💧'},
  '风':{h:158, sat:.88, icon:'🍃'},
  '草':{h:105, sat:1.0, icon:'🌿'},
  '冰':{h:188, sat:.85, icon:'❄️'},
  '雷':{h:272, sat:1.2, icon:'⚡'},
  '光':{h:52,  sat:1.18,icon:'✨'},
  '暗':{h:276, sat:.85, icon:'🌑'},
  '空间':{h:215,sat:.28, icon:'🌌'},
  '时间':{h:260,sat:.55, icon:'⏳'},
  '幻':{h:320, sat:1.1, icon:'🌀'}
};
const ELEMENT_KEYS = Object.keys(ELEMENTS);
const HEAL_ELEMENTS = ['水','光'];

/* ========== 元素克制表 ========== */
const ELEMENT_CHART = {
  '岩': {'岩':1, '火':1, '水':1.5, '风':1, '草':1, '冰':1, '雷':1, '幻':1, '光':1, '暗':1, '时间':1, '空间':1},
  '火': {'岩':1, '火':1, '水':0.5, '风':1, '草':2, '冰':1.5, '雷':1, '幻':1, '光':1, '暗':1, '时间':1, '空间':1},
  '水': {'岩':0.5, '火':2, '水':1, '风':1, '草':0.5, '冰':0.5, '雷':0.5, '幻':1, '光':1, '暗':1, '时间':1, '空间':1},
  '风': {'岩':1, '火':1, '水':1, '风':1, '草':1, '冰':1, '雷':1, '幻':1, '光':1, '暗':1, '时间':1, '空间':1},
  '草': {'岩':1.5, '火':0.5, '水':1.5, '风':1, '草':1, '冰':0.5, '雷':1, '幻':1, '光':1, '暗':1, '时间':1, '空间':1},
  '冰': {'岩':1, '火':0.5, '水':1.5, '风':1, '草':2, '冰':1, '雷':1, '幻':1, '光':1, '暗':1, '时间':1, '空间':1},
  '雷': {'岩':0.5, '火':1, '水':2, '风':1, '草':1.5, '冰':1, '雷':1, '幻':1.5, '光':1, '暗':1, '时间':1, '空间':1},
  '幻': {'岩':0.5, '火':1, '水':1, '风':1, '草':1, '冰':1, '雷':0.5, '幻':1, '光':1, '暗':1, '时间':1, '空间':1},
  '光': {'岩':1, '火':1, '水':1, '风':1, '草':1, '冰':1, '雷':1, '幻':1, '光':1, '暗':2, '时间':1, '空间':1},
  '暗': {'岩':1.5, '火':1.5, '水':1.5, '风':1.5, '草':1.5, '冰':1.5, '雷':1.5, '幻':1.5, '光':2, '暗':1.5, '时间':1.5, '空间':1.5},
  '时间': {'岩':0.5, '火':1, '水':1, '风':1, '草':1, '冰':1, '雷':1, '幻':1, '光':1, '暗':1, '时间':1, '空间':1},
  '空间': {'岩':1.5, '火':1.5, '水':1.5, '风':1.5, '草':1.5, '冰':1.5, '雷':1.5, '幻':1.5, '光':1.5, '暗':1.5, '时间':1.5, '空间':1.5}
};

/* ========== 元素天赋 ========== */
const ELEMENT_TALENTS = {
  '岩': {name:'磐石', desc:'免疫所有负面状态，战斗开始时获得岩甲（吸收50%最大生命伤害），岩甲存在时受到伤害降低25%'},
  '火': {name:'灼热', desc:'造成伤害附加烧伤（每层每回合损失3%最大生命，最多3层）'},
  '水': {name:'源泉', desc:'免疫烧伤，被攻击时召唤迷你水史莱姆反击（属性为本体30%）'},
  '风': {name:'轻灵', desc:'闪避率 +20%'},
  '草': {name:'血藤', desc:'造成伤害吸血50%，并附加毒素（每层每回合损失3%最大生命，最多5层）'},
  '冰': {name:'冰甲', desc:'战斗开始时获得冰甲（吸收50%最大生命伤害），冰甲存在时受到伤害降低25%，且被攻击会给攻击者叠1层冻伤（被暴击率+5%），3层冻伤转为冻结（1回合无法行动）'},
  '雷': {name:'电流', desc:'造成伤害35%概率附加麻痹（1回合无法行动）；命中水史莱姆时，其他水史莱姆受到20%溅射伤害'},
  '幻': {name:'迷幻', desc:'造成伤害45%概率附加魅惑（1回合攻击友方）'},
  '光': {name:'净化', desc:'对深渊怪物造成双倍伤害；治疗可额外清除目标所有负面状态'},
  '暗': {name:'侵蚀', desc:'造成伤害附加虚弱（全属性-5%，最多3层）'},
  '时间': {name:'回溯', desc:'本局全员阵亡后全体友方原地复活（限一次，回复20%生命）'},
  '空间': {name:'虚化', desc:'任一友方存活时，无法被选中'}
};

const STATUS_DEFS = {
  burn:      {name:'烧伤',  max:3, dmgPct:0.03},
  poison:    {name:'毒素',  max:5, dmgPct:0.03},
  frostbite: {name:'冻伤',  max:3, critBoost:5},
  frozen:    {name:'冻结',  max:1, stun:true},
  paralysis: {name:'麻痹',  max:1, stun:true},
  charm:     {name:'魅惑',  max:1},
  weakness:  {name:'虚弱',  max:3, statPct:0.05}
};

const ELEMENT_WEIGHTS = {
  '岩':16, '火':16, '水':16, '风':16,
  '草':6,  '冰':6,  '雷':6,  '幻':6,
  '光':2,  '暗':2,
  '空间':0.8, '时间':0.8
};
// Persist gameplay randomness independently of decorative effects.
function gameRandom(){return S.saveVersion>=4?LivingWorld.gameRandom(S):Math.random();}
const gameRange=(a,b)=>a+gameRandom()*(b-a);
const gameInt=(a,b)=>Math.floor(gameRange(a,b+1));
const gamePick=a=>a[Math.floor(gameRandom()*a.length)];
function pickElement(boost){
  const weights = {...ELEMENT_WEIGHTS};
  if(boost){
    for(const k in boost){
      if(weights[k] !== undefined) weights[k] += boost[k];
    }
  }
  const entries = Object.entries(weights);
  const total = entries.reduce((a,[,v])=>a+v,0);
  let r = gameRandom()*total;
  for(const [k,v] of entries){ r -= v; if(r <= 0) return k; }
  return entries[0][0];
}

/* 稀有元素 = 权重 ≤2 的光/暗/空间/时间；保底召唤只在这里面按原权重抽 */
const RARE_ELEMENTS = ELEMENT_KEYS.filter(k=>ELEMENT_WEIGHTS[k] <= 2);
function pickRareElement(boost){
  const pool = RARE_ELEMENTS.map(k=>[k, ELEMENT_WEIGHTS[k] + ((boost && boost[k]) || 0)]);
  let r = gameRandom() * pool.reduce((a,[,v])=>a+v, 0);
  for(const [k,v] of pool){ r -= v; if(r <= 0) return k; }
  return pool[0][0];
}
/* 召唤收费（伙伴为空时免费，避免没有伙伴又没钱时卡死）；连续 9 次未出稀有，第 10 次必出 */
const SUMMON_PITY = 10;
function summonCost(){ return S.slimes.length ? 500 + 100 * S.level : 0; }
function summonPityLeft(){ return Math.max(1, SUMMON_PITY - (S.summonPity||0)); }

const PERSONALITIES = ['天真','勇敢','温柔','安静','沉稳','乖巧','调皮','胆小','傲娇','活泼','黏人','冷漠','懒惰','腹黑'];

const PERSONA_BUFF = {
  '天真': {hp:1.05, atk:1.0,  matk:1.0,  speed:1.0},
  '勇敢': {hp:1.10, atk:1.15, matk:1.0,  speed:0.95},
  '温柔': {hp:1.12, atk:0.95, matk:1.05, speed:1.0},
  '安静': {hp:1.0,  atk:0.95, matk:1.15, speed:1.0},
  '沉稳': {hp:1.12, atk:1.0,  matk:1.05, speed:0.95},
  '乖巧': {hp:1.05, atk:1.0,  matk:1.05, speed:1.05},
  '调皮': {hp:0.95, atk:1.05, matk:1.0,  speed:1.15},
  '胆小': {hp:0.92, atk:0.9,  matk:1.0,  speed:1.25},
  '傲娇': {hp:1.0,  atk:1.12, matk:1.08, speed:0.95},
  '活泼': {hp:1.0,  atk:1.05, matk:1.0,  speed:1.2},
  '黏人': {hp:1.15, atk:0.92, matk:1.0,  speed:1.0},
  '冷漠': {hp:0.98, atk:1.08, matk:1.15, speed:0.95},
  '懒惰': {hp:1.2,  atk:0.9,  matk:0.9,  speed:0.85},
  '腹黑': {hp:0.95, atk:1.1,  matk:1.12, speed:1.05}
};
function personaMul(s, key){
  const b = PERSONA_BUFF[s.personality] || {};
  return b[key] || 1;
}
function getPersonaDesc(s) {
  const b = PERSONA_BUFF[s.personality];
  if(!b) return "无特殊影响";
  const parts = [];
  if(b.hp !== 1) parts.push(`血量${b.hp > 1 ? '+' : ''}${Math.round((b.hp-1)*100)}%`);
  if(b.atk !== 1) parts.push(`物攻${b.atk > 1 ? '+' : ''}${Math.round((b.atk-1)*100)}%`);
  if(b.matk !== 1) parts.push(`魔攻${b.matk > 1 ? '+' : ''}${Math.round((b.matk-1)*100)}%`);
  if(b.speed !== 1) parts.push(`速度${b.speed > 1 ? '+' : ''}${Math.round((b.speed-1)*100)}%`);
  return parts.join(' ');
}

const TRAITS_POOL = [
  {n:'幸运', d:'探险收益+25%', k:'explore', v:.25},
  {n:'亲和', d:'心情恢复+60%', k:'mood', v:.6},
  {n:'坚韧', d:'体力恢复+40%', k:'stam', v:.4},
  {n:'大胃王', d:'体力消耗+30%', k:'glutton', v:.3},
  {n:'闪光', d:'天赋+6', k:'talent', v:6},
  {n:'轻灵', d:'出行体力消耗-25%', k:'ecost', v:.25},
  {n:'富贵', d:'所有收益+15%', k:'all', v:.15},
  {n:'治愈', d:'心情持续恢复', k:'heal', v:.3},
  {n:'呆萌', d:'无效果，但很可爱', k:'none', v:0},
  {n:'强健', d:'', k:'bhp', v:.10},
  {n:'锋锐', d:'', k:'batk', v:.08},
  {n:'秘法', d:'', k:'bmatk', v:.08},
  {n:'迅捷', d:'', k:'bspd', v:.08},
  {n:'灵巧', d:'', k:'bdodge', v:.04},
  {n:'精准', d:'', k:'bcrit', v:.04},
  {n:'魔量', d:'', k:'bmana', v:.10},
  {n:'战意', d:'', k:'ball', v:.05}
];

function refreshTraitDesc(t){
  if(!t || !t.k) return t;
  const pct = v => Math.round(v*100);
  switch(t.k){
    case 'explore': t.d = `探险收益+${pct(t.v)}%`; break;
    case 'mood': t.d = `心情恢复+${pct(t.v)}%`; break;
    case 'stam': t.d = `体力恢复+${pct(t.v)}%`; break;
    case 'glutton': t.d = `体力消耗+${pct(t.v)}%`; break;
    case 'talent': t.d = `天赋+${t.v}`; break;
    case 'ecost': t.d = `出行体力消耗-${pct(t.v)}%`; break;
    case 'all': t.d = `所有收益+${pct(t.v)}%`; break;
    case 'heal': t.d = `心情持续恢复`; break;
    case 'none': t.d = `无效果，但很可爱`; break;
    case 'bhp': t.d = `血量上限+${pct(t.v)}%`; break;
    case 'batk': t.d = `物理攻击+${pct(t.v)}%`; break;
    case 'bmatk': t.d = `魔法攻击+${pct(t.v)}%`; break;
    case 'bspd': t.d = `攻击速度+${pct(t.v)}%`; break;
    case 'bdodge': t.d = `闪避率+${pct(t.v)}%`; break;
    case 'bcrit': t.d = `暴击率+${pct(t.v)}%`; break;
    case 'bmana': t.d = `魔力值+${pct(t.v)}%`; break;
    case 'ball': t.d = `全部战斗属性+${pct(t.v)}%`; break;
    default: if(!t.d) t.d = t.n;
  }
  return t;
}

const ITEMS = {
  food:     {icon:'🍖', name:'史莱姆饲料', desc:'恢复体力+30，心情+5。可放入空间饲料槽', price:150},
  treasure: {icon:'💎', name:'天材地宝',  desc:'投喂提升潜力，也可在召唤时献祭提升对应属性概率', price:3000},
  ticket:   {icon:'🎫', name:'词条抽取券', desc:'为史莱姆抽取随机系统词条（仅限系统积分购买）', price:50},
  expPotion:{icon:'🧪', name:'经验药水',  desc:'获得本级升级所需经验的 50%，购买后自动用于等级最低的伙伴', price:2500},
  net:      {icon:'🕸️', name:'捕捉网',    desc:'在深渊战斗中捕捉血量归零的怪物史莱姆', price:1000}
};

/* 主动技表：每元素一个，CD 3 回合，效果全部复用现有战斗机制 */
const SKILLS = {
  岩:   { name:'磐石落',   cd:3, kind:'atk',    mult:1.6, target:'enemy',    shield:0.3,
          desc:'1.6× 物攻伤害，自身获得 30% 最大生命护盾' },
  火:   { name:'炽炎爆',   cd:3, kind:'atk',    mult:1.4, target:'enemy',    status:{burn:2},
          desc:'1.4× 伤害 + 必定叠 2 层烧伤' },
  水:   { name:'涌泉',     cd:3, kind:'heal',   mult:1.2, target:'ally-low', mini:true,
          desc:'治疗最低血友方 1.2× 魔攻 + 召唤 1 只迷你水史莱姆' },
  风:   { name:'疾风连斩', cd:3, kind:'atk',    mult:0.9, target:'enemy',    hits:2,
          desc:'对随机 2 个敌人各 0.9× 伤害' },
  草:   { name:'缠根',     cd:3, kind:'atk',    mult:0.8, target:'enemy',    status:{poison:3}, leech:0.5,
          desc:'0.8× 伤害 + 3 层中毒 + 回复造成伤害的 50%' },
  冰:   { name:'霜封',     cd:3, kind:'atk',    mult:0.7, target:'enemy',    status:{frostbite:2},
          desc:'0.7× 伤害 + 2 层冻伤' },
  雷:   { name:'落雷',     cd:3, kind:'atk',    mult:1.5, target:'enemy',    splash:true,
          desc:'1.5× 伤害，目标为水时触发溅射' },
  光:   { name:'圣光',     cd:3, kind:'heal',   mult:0.6, target:'all-ally', cleanse:true,
          desc:'治疗全队 0.6× 魔攻 + 净化所有负面' },
  暗:   { name:'侵蚀',     cd:3, kind:'atk',    mult:0.9, target:'enemy',    status:{weakness:3},
          desc:'0.9× 伤害 + 3 层削弱' },
  幻:   { name:'魅惑',     cd:3, kind:'atk',    mult:0.5, target:'enemy',    status:{charm:2},
          desc:'0.5× 伤害 + 必定魅惑 2 回合' },
  空间: { name:'相位',     cd:3, kind:'buff',   mult:0.8, target:'enemy',    intangible:1,
          desc:'自身虚化 1 回合（不可选中）+ 对目标 0.8× 伤害' },
  时间: { name:'回溯',     cd:3, kind:'revive', mult:1.3, target:'enemy',
          desc:'复活一名阵亡友方（30% 生命）；无阵亡时改为 1.3× 伤害' }
};

function skillOf(s){
  if(!s || !s.element) return null;
  return SKILLS[s.element] || null;
}

const TASK_DEFS = {
  rent:   {name:'探险达人', need:3, reward:10, desc:'完成3次探险'},
  summon: {name:'初次召唤', need:1, reward:10, desc:'召唤1只史莱姆'},
  feed:   {name:'投喂小能手', need:1, reward:5,  desc:'投喂1次饲料'},
  abyss:  {name:'深渊试炼', need:1, reward:10, desc:'赢得1场深渊战斗'},
  pet:    {name:'亲密时光', need:3, reward:5,  desc:'抚摸伙伴3次'},
  grow:   {name:'精心培养', need:1, reward:10, desc:'合体或喂天材地宝1次'}
};

const MON_MOODS = [
  {v:'idle',   n:'平静'},
  {v:'happy',  n:'开心'},
  {v:'like',   n:'喜欢'},
  {v:'jump',   n:'跳跃'},
  {v:'crawl',  n:'爬行'},
  {v:'look',   n:'张望'},
  {v:'sleep',  n:'睡觉'},
  {v:'fear',   n:'害怕'},
  {v:'deadpan',n:'无语'}
];
function defaultMonItems(){
  return [
    {label:'抚摸', mood:8,  face:'like',    text:'舒服地蹭了蹭'},
    {label:'喂食', mood:12, face:'happy',   text:'开心地吃了'},
    {label:'玩耍', mood:15, face:'jump',    text:'欢快地蹦跳'},
    {label:'说教', mood:-5, face:'deadpan', text:'歪着头听不懂'}
  ];
}

