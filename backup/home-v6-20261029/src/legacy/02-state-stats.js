const S = {started:false,name:'',sysName:'',sysLook:{h:200,s:70,l:58,eh:200,es:65,el:22},level:1,summonerExp:0,breakPending:false,coins:2000,points:0,taskDate:'',tasks:{rent:0,summon:0,feed:0},taskClaimed:{rent:false,summon:false,feed:false},slimes:[],monsters:[],bag:{food:5,treasure:2,ticket:1,expPotion:0,net:0},feedTrough:0,totalEarned:0,seq:1,nameSeq:0,theme:'sunset',globalPlan:null,customPlans:{},monItemConfigs:defaultMonItems(),saveVersion:5,world:LivingWorld.createWorld(),lastActive:0,planClock:0,spaceMode:'free',abyssLevel:1,abyssUnlocked:1,lastAbyssSel:[],exploreMapIndex:0,exploreTeam:null,explorePending:{coins:0,exp:0,food:0,point:0,treasure:0,weight:0},stackRecord:0,battleSpeed:1,battleMode:'manual',starterGiftClaimed:false,notchHeight:0.7};
LivingWorld.ensure(S);
let activeTab='space';
let plSlimes=[];
let summonBoost = {};
let selectedToy = null;
let ballGame = null;
let stackGame = null;
let battleSpeed = 1;
let miniSeq = 0;
let teamSel = new Set();
let autoTabId = null;
const SYS_QUOTES = ['宿主，加油呀～','今天也很努力呢','需要帮忙吗？','休息一下吧～','我在这里陪你'];
const SYS_DRAG_QUOTES = ['别抓我','头晕','放我下来','坏家伙'];
function getSystemSlimeObj(){return {id:'__sys__',isSystem:true,name:S.sysName || '团子',element:'空间',size:1,level:1,mood:100,stamina:100,intimacy:0,strPotential:10,agiPotential:10,magPotential:10,luck:0,wit:0,str:10,agi:10,mag:10,traits:[],personality:'乖巧',morality:0,hp:100,exp:0,resting:false};}
let exploreRunning = false;
let exploreRAF = null;
let exploreSpawnTimer = null;
let exploreLastT = 0;
let exploreItems = [];
let exploreLayer = null;
function getSlots(){ return 2 + Math.floor(S.level / 10); }
function summonerNeed(lv){ return 10 + lv * 6; }
function staminaMax(s){ return Math.round(80 + (s.size || 1) * 40); }
function monMul(s){ return s.isMonster ? 2 : 1; }
function hpMax(s){const m = monMul(s);const bonus = 1 + traitBonus(s,'bhp') + traitBonus(s,'ball');return Math.round((100 * (s.size || 1) + (s.str || 0) * 3 * m + (s.level || 1) * 10) * personaMul(s,'hp') * bonus);}
function physAtk(s){const m = monMul(s);const bonus = 1 + traitBonus(s,'batk') + traitBonus(s,'ball');return Math.round((s.str * 2 * m + s.level * 3) * personaMul(s,'atk') * bonus);}
function magAtk(s){const m = monMul(s);const bonus = 1 + traitBonus(s,'bmatk') + traitBonus(s,'ball');return Math.round((s.mag * 2 * m + s.level * 3) * personaMul(s,'matk') * bonus);}
function atkSpeed(s){const m = monMul(s);const bonus = 1 + traitBonus(s,'bspd') + traitBonus(s,'ball');return Math.round((100 + s.agi * m) * personaMul(s,'speed') * bonus);}
function dodgeRate(s){const agi = s.agi * monMul(s);const base = agi / (agi + 60) * 100 * 0.2;let add = (traitBonus(s,'bdodge') + traitBonus(s,'ball')) * 100;if(s.element === '风') add += 20;return clamp(Math.round(base + add), 0, 70);}
function critRate(s){const luck = (s.luck||0) * monMul(s);const base = luck / (luck + 80) * 100;const add = (traitBonus(s,'bcrit') + traitBonus(s,'ball')) * 100;return clamp(Math.round(base + add), 0, 30);}
function manaMax(s){const bonus = 1 + traitBonus(s,'bmana') + traitBonus(s,'ball');return Math.round(s.mag * 10 * monMul(s) * bonus);}
function expRate(s){ return 1 + (s.wit||0) * 0.02; }
function slimePower(s){return Math.round(physAtk(s) + magAtk(s) + hpMax(s) * 0.5 + atkSpeed(s) * 0.3 + dodgeRate(s) * 2 + critRate(s) * 2 + manaMax(s) * 0.1);}
function slimeWeightCap(s){ return Math.max(1, Math.round((s.str * 0.5 + 6) * (s.size || 1))); }
function exploreCap(){ return S.slimes.filter(isDispatched).reduce((sum,s)=>sum+slimeWeightCap(s),0); }
