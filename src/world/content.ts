import type {BuildingDef,DecorationDef,PlantDef,Recipe,VisitorDef,ZoneDef,Element,TechDef,Stock} from './types.ts';
export const ELEMENTS:Element[]=['岩','火','水','风','草','冰','雷','幻','光','暗','时间','空间'];
export const PERSONALITIES=['天真','勇敢','温柔','安静','沉稳','乖巧','调皮','胆小','傲娇','活泼','黏人','冷漠','懒惰','腹黑'];
export const ZONES:ZoneDef[]=[
 {id:0,name:'生活庭院',area:'晨露草甸',color:'#96b78e',threshold:0,story:'让荒弃的邮亭再次成为旅人分享种子的地方。'},
 {id:1,name:'植物苗圃',area:'低语森林',color:'#6b9880',threshold:1,story:'沿着刻在树皮上的旧标记，找回失散的种子目录。'},
 {id:2,name:'林间栖地',area:'萤光湿地',color:'#699eac',threshold:3,story:'恢复水道，让沉寂的萤光重新连成一条河。'},
 {id:3,name:'溪流湿地',area:'赤晶峡谷',color:'#be947b',threshold:6,story:'为依靠热泉生活的居民修好安全的引水渠。'},
 {id:4,name:'工坊营地',area:'霜铃雪原',color:'#91b6c7',threshold:10,story:'收集被风吹散的铃片，重新标出雪原上的归路。'},
 {id:5,name:'星光遗迹',area:'星落遗迹',color:'#9d96c2',threshold:15,story:'解开留下的观测记录，确认这座家园为何等待着你。'}
];
const buildingRows:[string,string,string,string,string,[number,number],string,string][]=[
 ['house','小屋','⌂','幼体安置、休息和个人空间','home',[2,2],'在养容量增加至 4','在养容量增加至 6'],
 ['kitchen','厨房','♨','把蔬果与草药变成旅行料理','kitchen',[2,1],'可烹饪暖汤','可制作星光便当'],
 ['table','餐桌','▤','与伙伴分享料理，增进朋友关系','meal',[2,1],'一次聚餐可邀请 4 位','一次聚餐可邀请 6 位'],
 ['spa','温泉','≈','休息中的伙伴恢复心情与体力','rest',[2,2],'恢复速度增加','恢复效果进一步提高'],
 ['bed','育苗床','❀','稳定的种植环境，供应露水','water',[2,1],'自动浇水半径 2','自动浇水半径 3'],
 ['greenhouse','温室','⌑','稳定温度，减少季节影响','climate',[2,2],'全区温度偏差减半','光照与温度可适应植物'],
 ['pollen','授粉棚','✣','交叉授粉，研究新品系','breed',[2,1],'复制品系所需露水减半','后代品质获得保证'],
 ['seedbank','种子库','▥','为珍贵品系留种并整理家谱','seed',[1,2],'克隆留种额外一份','收获种子额外一份'],
 ['grove','林木园','♧','供应木材并形成树荫','wood',[2,2],'木材产出 +4','树荫范围增加'],
 ['compost','堆肥箱','▧','把植物产物转化为肥料','fertility',[1,1],'肥力影响增加','可将肥料制成沃土'],
 ['insects','虫舍','⋈','为授粉者与分解者提供栖息处','habitat',[1,1],'放宽访客湿度条件','访客生态服务增强'],
 ['observe','观测台','◎','识别访客并获取生态研究笔记','observe',[1,2],'生态观察奖励增加','调查额外获得笔记'],
 ['channel','水渠','≋','输送灌溉水并生产露水','water',[1,2],'自动补水半径 2','自动补水半径 3'],
 ['pond','水塘','◉','容纳水生植物与溪流生物','aquatic',[2,2],'水质获得加成','湿度影响半径增加'],
 ['filter','净水池','◇','改善附近水体质量','quality',[1,2],'净水作用增加','水质不足时自动恢复'],
 ['waterbed','水生种植台','≀','让水生植物在任何区域扎根','aquatic',[2,1],'附近水生植物加速','成熟种子产量提高'],
 ['woodshop','木工台','⚒','把原料制成家具与木板','woodshop',[2,1],'加工队列增加','解锁雕刻纪念物'],
 ['alchemy','炼制台','⚗','制作药剂、矿晶和生态材料','alchemy',[2,1],'解锁恢复药剂','解锁共鸣晶石'],
 ['expedition','远征站','⚑','整理补给，支持三支远征队','expedition',[2,2],'远征奖励提高','调查种子额外一粒'],
 ['training','训练场','⚔','驻场伙伴练习元素协作，持续获得经验','training',[2,2],'训练经验提高','开放高级训练配方'],
 ['archive','档案馆','▣','研究科技，驻场伙伴整理研究笔记','archive',[2,2],'研究队列增加','研究速度提高，解锁故事纪念物'],
 ['stars','观星台','✧','记录夜空，收集星尘','stars',[1,2],'星尘生产增加','特殊天气提供额外星尘'],
 ['resonance','共鸣石','◈','成年伙伴共鸣产生幼体','resonance',[1,1],'共鸣冷却缩短','成长所需时间减少'],
 ['memorial','纪念馆','♡','陈列伙伴回忆与旅程纪念物','memory',[2,1],'留下聚餐回忆','访客舒适度增加']
];
/* 升级后的形态占地：2、3 级逐步扩建，每一档都能完整包住上一档，建筑看起来是原地长大。纪念设施不再升级，保持原尺寸。 */
const growth:Record<string,[[number,number],[number,number]]>={
 house:[[3,2],[3,3]],spa:[[3,2],[3,3]],greenhouse:[[3,2],[3,3]],grove:[[3,2],[3,3]],pond:[[3,2],[3,3]],training:[[3,2],[3,3]],archive:[[3,2],[3,3]],
 kitchen:[[2,2],[3,2]],pollen:[[2,2],[3,2]],woodshop:[[2,2],[3,2]],alchemy:[[2,2],[3,2]],memorial:[[2,2],[3,2]],
 table:[[3,1],[3,2]],bed:[[3,1],[3,2]],waterbed:[[3,1],[3,2]],
 seedbank:[[2,2],[2,3]],observe:[[2,2],[2,3]],filter:[[2,2],[2,3]],stars:[[2,2],[2,3]],channel:[[1,3],[2,3]],
 compost:[[2,1],[2,2]],trough:[[2,1],[2,2]],toys:[[2,1],[2,2]],insects:[[1,2],[2,2]],
 quarry:[[3,2],[3,3]],mine:[[3,2],[3,3]],spring:[[3,2],[3,3]],warehouse:[[3,2],[3,3]],apiary:[[2,2],[3,2]],market:[[2,2],[3,2]]
};
const forms=(id:string,size:[number,number]):BuildingDef['forms']=>[size,...(growth[id]??[size,size])];
export const BUILDINGS:BuildingDef[]=buildingRows.map((r,i)=>({id:r[0],name:r[1],icon:r[2],desc:r[3],service:r[4],size:r[5],forms:forms(r[0],r[5]),upgrades:[r[6],r[7]],zone:Math.floor(i/4),cost:{wood:12+4*Math.floor(i/4),stone:8+3*Math.floor(i/4)}}));
BUILDINGS.push({id:'trough',name:'饲料槽',zone:0,icon:'▱',desc:'伙伴走过来分享实际存放的饲料',service:'feed',size:[1,1],forms:forms('trough',[1,1]),cost:{wood:8,stone:4},upgrades:['伙伴安心用餐','家园的用餐角落']},{id:'toys',name:'玩具区',zone:0,icon:'◉',desc:'一起接球和叠叠乐',service:'play',size:[1,1],forms:forms('toys',[1,1]),cost:{wood:8,stone:4},upgrades:['保留共同游戏的记录','伙伴喜欢的游乐角落']});
/* 资源建筑：持续产出原料，暂存在建筑里等待收取；元素泉需要伙伴驻场才会涌出精华。 */
BUILDINGS.push(...([
 ['quarry','采石场','▦','开采石材，岩元素伙伴更擅长','quarry',[2,2],{wood:14,stone:4},'石材产出增加','开采出带晶的石块'],
 ['mine','矿洞','⛏','挖掘矿石，3 级矿脉偶尔带出星尘','ore',[2,2],{wood:24,stone:16},'矿石产出增加','深处出现星尘'],
 ['apiary','蜂箱','✿','附近花开得越多，蜂蜜越多','honey',[2,1],{wood:18,stone:6},'蜂蜜产出增加','蜜源范围扩大'],
 ['spring','元素泉','✺','伙伴驻场时涌出元素精华','essence',[2,2],{wood:20,stone:30},'精华产出增加','双伙伴共鸣涌泉'],
 ['warehouse','仓库','▤','建筑能暂存更久的产出','storage',[2,2],{wood:24,stone:12},'暂存时间延长','暂存时间再延长'],
 ['market','集市','⚖','把多余材料换成晶币','market',[2,1],{wood:26,stone:16},'每轮可换晶币增加','每轮可换晶币再增加']
] as [string,string,string,string,string,[number,number],Stock,string,string][]).map(r=>({id:r[0],name:r[1],zone:4,icon:r[2],desc:r[3],service:r[4],size:r[5],forms:forms(r[0],r[5]),cost:r[6],upgrades:[r[7],r[8]] as [string,string]})));
const decorNames=[['碎石小径','苔石小径','木板步道','白砂路','落叶路','星砂路'],['矮木篱','藤编围栏','白石围栏','竹篱','蘑菇围栏','月牙围栏'],['纸灯','萤光灯','蘑菇灯','冰晶灯','星灯','暖炉灯'],['长椅','摇椅','野餐毯','秋千','躺椅','树桩桌'],['木花架','藤花门','垂吊花盆','种子风铃','水莲盆','菌菇架'],['庭院路牌','苗圃标签','访客告示','旅人留言板','星图牌','伙伴名牌'],['落叶堆','蜜源花篮','小鸟浴盆','虫洞木桩','苔石丘','浅水盆'],['种子相框','溪流石刻','小小灶台','归家门牌','霜花瓶','旅程相册']];
/* 第一组「小径」是路面材质：在地图上拖动铺成连续道路，材质编号存进 pathStyles。 */
export const PATH_STYLES=decorNames[0];
export const DECORATIONS:DecorationDef[]=decorNames.flatMap((names,g)=>names.map((name,i)=>({id:`decor-${g}-${i}`,name,group:g,icon:['·','╬','✦','▱','❋','⚑','♧','♡'][g],effect:['铺设可通行的小路','遮阴 +3','光照 +4','舒适与聚餐回忆','授粉环境 +3','家园标识与回忆','湿度与肥力 +3','舒适与回忆'][g],cost:{wood:3+g,stone:2+i}})));
export const FAMILIES=['花卉','草药','蔬果','果树','菌菇','水生'];
const plants=[['晨露花','铃兰','日光菊','月见花','绯瓣花','星绒花'],['薄荷','甘露草','暖叶草','霜叶草','清心草','回声草'],['甜萝卜','蜜番茄','月南瓜','脆豆','光莓','雨瓜'],['苹果树','蜜桃树','风梨树','银杏','雪梨树','星枣树'],['苔菇','灯笼菇','雨伞菇','绒球菇','晶耳','梦孢菇'],['浮萍','水莲','芦苇','净水藻','冰灯莲','星舟草']];
const hybrids=[['露铃花','昼月菊','绯星花'],['甘薄草','暖霜草','心声草'],['蜜萝果','南豆瓜','光雨莓'],['桃果树','风银树','雪枣树'],['苔灯菇','雨绒菇','晶梦菇'],['萍莲','苇藻','冰舟莲']];
export const PLANTS:PlantDef[]=plants.flatMap((names,f)=>names.map((name,i)=>({id:`plant-${f}-${i}`,name,family:f,minutes:f===3?120:[5,15,30,60,15,30][i],color:([315,155,20,90,35,185][f]+i*11)%360,light:f===4?30:f===3?65:55,moisture:f===5?80:f===4?65:50,temp:i===3||i===4?12:22,product:['petal','herb','ingredient','fruit','mushroom','algae'][f],use:['染料与授粉','药剂与料理','料理与聚餐','果酱与林间访客','料理与分解共生','净水与水生访客'][f]})));
for(let f=0;f<6;f++)for(let i=0;i<3;i++){const a=PLANTS.find(p=>p.id===`plant-${f}-${i*2}`)!; PLANTS.push({...a,id:`hybrid-${f}-${i}`,name:hybrids[f][i],minutes:f===3?120:60,parents:[a.id,`plant-${f}-${i*2+1}`],use:a.use+'；命名杂交品种'});}
/* 同类植物按品种区分喜好，温室、树荫和湿地因此有了实际意义；读档前已在生长的作物本轮仍按旧喜好计算。 */
const tastes:[number,number,number][]=[[0,0,0],[-8,6,-2],[8,-6,4],[-4,8,0],[4,-8,2],[10,0,2]];
for(const p of PLANTS.filter(p=>!p.parents)){const i=Number(p.id.split('-')[2]),[l,m,t]=tastes[i];p.light+=l;p.moisture+=m;p.temp+=t;}
for(const p of PLANTS.filter(p=>p.parents)){const a=PLANTS.find(x=>x.id===p.parents![0])!;p.light=a.light;p.moisture=a.moisture;p.temp=a.temp;}
export const LEGACY_TASTES=(p:PlantDef):[number,number,number]=>{if(p.id==='glowflower')return[p.light,p.moisture,p.temp];const f=p.family,i=Number((p.parents?.[0]??p.id).split('-')[2]);return[f===4?30:f===3?65:55,f===5?80:f===4?65:50,i===3||i===4?12:22];};
PLANTS.push({id:'glowflower',name:'发光花',family:0,minutes:5,color:65,light:55,moisture:50,temp:22,product:'petal',use:'首次收获获赠的花；开花后成为夜间休息的角落'});
export const MATERIALS:Record<string,string>={feed:'基础饲料',snack:'果香小食',wood:'木材',stone:'石材',dew:'露水',ingredient:'食材',petal:'花瓣',herb:'草药',fruit:'果实',mushroom:'菌菇',algae:'水草',plank:'木板',dye:'染料',fertilizer:'肥料',soil:'沃土',meal:'便当',soup:'暖汤',potion:'恢复药剂',crystal:'共鸣晶石',notes:'研究笔记',stardust:'星尘',relic:'遗迹碎片',keepsake:'纪念物',ore:'矿石',ingot:'金属锭',honey:'蜂蜜',essence:'元素精华',net:'捕捉网',expPotion:'经验药水',treasure:'天材地宝',ticket:'词条抽取券'};
export const RECIPES:Recipe[]=[
 {id:'feed',name:'基础饲料',building:'kitchen',cost:{ingredient:1},output:{feed:2},seconds:60,level:1},
 {id:'simplemeal',name:'家常便当',building:'kitchen',cost:{ingredient:2},output:{meal:1},seconds:60,level:1},
 {id:'snack',name:'果香小食',building:'kitchen',cost:{fruit:1},output:{snack:2},seconds:60,level:1},
 {id:'meal',name:'野餐便当',building:'kitchen',cost:{ingredient:2,fruit:1},output:{meal:2},seconds:60,level:1},
 {id:'soup',name:'暖叶浓汤',building:'kitchen',cost:{herb:2,mushroom:1},output:{soup:2},seconds:120,level:2},
 {id:'starmeal',name:'星光便当',building:'kitchen',cost:{ingredient:2,stardust:1},output:{meal:5},seconds:180,level:3},
 {id:'plank',name:'精制木板',building:'woodshop',cost:{wood:4},output:{plank:2},seconds:60,level:1},
 {id:'keepsake',name:'雕刻纪念物',building:'woodshop',cost:{plank:2,dye:1},output:{keepsake:1},seconds:180,level:3},
 {id:'dye',name:'花瓣染料',building:'alchemy',cost:{petal:3,dew:1},output:{dye:2},seconds:60,level:1},
 {id:'potion',name:'清心药剂',building:'alchemy',cost:{herb:3,dew:2},output:{potion:2},seconds:120,level:2},
 {id:'crystal',name:'共鸣晶石',building:'alchemy',cost:{stone:5,stardust:2},output:{crystal:1},seconds:180,level:3},
 {id:'fertilizer',name:'落叶堆肥',building:'compost',cost:{petal:1,algae:1},output:{fertilizer:3},seconds:120,level:1},
 {id:'soil',name:'活力沃土',building:'compost',cost:{fertilizer:2,mushroom:1},output:{soil:2},seconds:180,level:3},
 {id:'notes',name:'生态笔记',building:'archive',cost:{petal:1,herb:1,algae:1},output:{notes:2},seconds:120,level:1},
 {id:'archive-keepsake',name:'装帧旅行纪念册',building:'archive',cost:{notes:4,relic:1},output:{keepsake:1},seconds:180,level:3},
 {id:'training',name:'协作练习',building:'training',cost:{ingredient:2},output:{notes:1},seconds:120,level:3}
];
const visitorRows:[string,number,string,string,number,number,number][]=[
 ['蜜蜂',0,'2 株开花植物，湿度 ≥40','种子产出 +1',40,0,2],['粉蝶',1,'3 株植物，湿度 ≥45','授粉产出增加',45,0,3],['夜蛾',1,'夜间，2 株植物','发现夜间花粉',30,0,2],['瓢虫',0,'3 株植物','改善植物适应',35,0,3],['蜻蜓',3,'水质 ≥60、湿度 ≥60','湿地调查加成',60,60,2],['萤火虫',2,'夜间，水质 ≥55','夜间庭院的微光访客',45,55,2],['蚯蚓',0,'湿度 ≥50、2 株植物','土壤肥力 +8',50,0,2],['潮虫',2,'湿度 ≥65、2 株植物','堆肥产量增加',65,0,2],['独角仙',2,'4 株植物','林木产量增加',45,0,4],['树蛙',2,'湿度 ≥60、水质 ≥50','水质 +5',60,50,2],['溪虾',3,'水质 ≥65','水生植物加速',65,65,1],['银鳍鱼',3,'水质 ≥75、3 株植物','水塘观察记录',65,75,3],['松鼠',2,'3 株植物，其中有果树','定期带来果实',30,0,3],['刺猬',0,'4 株植物','发现草药',40,0,4],['织巢鸟',2,'4 株植物','授粉与种子传播',30,0,4],['苔灵',2,'湿度 ≥70、4 株植物','肥力 +10',70,0,4],['雪雀',4,'冬季或冰元素伙伴','带回耐寒种子',25,0,1],['星蛾',5,'夜间，3 株植物','星尘产量增加',30,0,3]
];
export const VISITORS:VisitorDef[]=visitorRows.map((r,i)=>({id:`visitor-${i}`,name:r[0],zone:r[1],need:r[2],service:r[3],humidity:r[4],quality:r[5],plants:r[6]}));
export const BABY_EVENTS=ELEMENTS.map((element,i)=>({element,title:['滚动的小石子','太热的拥抱','水洼里的倒影','抓不住的风','第一片新叶','不会融化的礼物','静电小火花','梦里的颜色','窗边的光','影子的朋友','慢慢长大','口袋里的远方'][i],text:['它把石子排成一条通往你的小路。','它想帮忙加热牛奶，却把杯沿烫红了。','它向倒影挥手，等着另一只幼体回应。','它追着纸风车绕了整座苗圃。','它把落叶藏进被窝，期待叶子重新发芽。','它捧着一朵霜花，担心礼物会在你手中融化。','它打了个喷嚏，让桌上的种子跳了起来。','它描述了一朵从未见过的花，颜色随心情改变。','它跟着光斑移动，想把温暖分给种子。','它给自己的影子留了一份点心。','它盯着沙漏，问长大以后是否仍能一起玩。','它的玩具滚进小小裂隙，带回来一片陌生叶子。'][i],choices:['一起试一试，培养好奇心','先陪它练习，培养耐心']}));
export const BABY_PERSONAL_EVENTS=Array.from({length:24},(_,i)=>({id:`baby-personal-${i}`,title:['分享点心','第一次道歉','收好玩具','陌生的访客','守住约定','照顾小苗','晚安故事','找回铃铛','雨天散步','轮流游戏','勇敢发问','自己的名字'][i%12]+(i>=12?'·长大以后':''),text:['它把最后一块点心推给同伴，又悄悄看向你。','玩具碰倒了花盆，它躲在叶子后面不敢出来。','它发现整理好的玩具更容易找到，却舍不得结束游戏。','一位陌生访客来到围栏边，它不知道该靠近还是躲开。','它答应等同伴回来，午睡时间却已经到了。','小苗的叶子垂了下来，它提起了比自己还高的水壶。','故事讲到迷路的旅人，它坚持要听到旅人回家。','草丛里响起别人的铃铛，它抱着铃铛寻找主人。','雨停后的地面很滑，它伸出身体想牵住你。','两只幼体都想玩同一个球，它看着你等待答案。','它举起小手，想知道为什么冰和火也能成为朋友。','它把自己的名字写在叶子上，想贴在门边。'][i%12],choices:['鼓励它表达自己的想法','陪它考虑同伴的感受']}));

RECIPES.push({id:'home-relic',name:'星纹遗物',building:'archive',cost:{notes:2,stardust:1},output:{relic:1},seconds:180,level:1});

/* 新配方：前三条桥接物品直接进入原版背包，按 12 小时一轮设置上限，避免冲垮商店和战斗经济。 */
RECIPES.push(
 {id:'honeyfeed',name:'蜂蜜饲料',building:'kitchen',cost:{ingredient:1,honey:1},output:{feed:4},seconds:90,level:1,tech:'res-apiary'},
 {id:'ingot',name:'冶炼金属锭',building:'alchemy',cost:{ore:3,wood:1},output:{ingot:1},seconds:120,level:1,tech:'cra-smelt'},
 {id:'net',name:'编织捕捉网',building:'woodshop',cost:{plank:2,ingot:1,herb:2},output:{net:1},seconds:300,level:2,tech:'cra-net'},
 {id:'expPotion',name:'调制经验药水',building:'alchemy',cost:{herb:3,honey:2,essence:1},output:{expPotion:1},seconds:300,level:2,tech:'cra-pharma'},
 {id:'treasure',name:'凝炼天材地宝',building:'alchemy',cost:{crystal:2,stardust:3,essence:2},output:{treasure:1},seconds:600,level:3,tech:'cra-treasure'}
);
// 全部解锁并用满额度时，每轮按商店价折合 13,000 晶币（捕捉网、经验药水各 1000，天材地宝 1500）。
export const BRIDGE_CAPS:Record<string,number>={net:4,expPotion:6,treasure:2};
export const BRANCHES=['资源','工艺','农艺','生态','伙伴'];
export const TIER_LEVEL=[0,1,3,6,9];
const tierCost=(tier:number,extra:Stock={}):Stock=>({...[{},{notes:2,wood:20,stone:10},{notes:6,wood:40,stone:30},{notes:15,plank:6,ingot:4},{notes:30,crystal:2,stardust:10}][tier],...extra});
const tierSeconds=[0,120,600,1800,7200];
const techRows:[string,number,1|2|3|4,string,string,string[],TechDef['effects'],Stock?][]=[
 ['res-quarry',0,1,'采石','解锁采石场，稳定供应石材',[],[{kind:'building',id:'quarry'}]],
 ['res-storage1',0,1,'仓储 I','解锁仓库，建筑可暂存更久的产出',[],[{kind:'building',id:'warehouse'}]],
 ['res-mine',0,2,'矿脉勘探','解锁矿洞，开采矿石',['res-quarry'],[{kind:'building',id:'mine'}]],
 ['res-apiary',0,2,'养蜂','解锁蜂箱与蜂蜜饲料',[],[{kind:'building',id:'apiary'},{kind:'recipe',id:'honeyfeed'}]],
 ['res-spring',0,3,'元素泉','解锁元素泉，伙伴驻场时涌出元素精华',['res-mine'],[{kind:'building',id:'spring'}]],
 ['res-storage2',0,3,'仓储 II','所有建筑暂存时间 +1 小时',['res-storage1'],[{kind:'buffer',n:1}]],
 ['res-auto',0,3,'自动入库','产出直接进入仓库，不再需要逐个收取',['res-storage1'],[{kind:'feature',id:'auto'}]],
 ['res-deep',0,4,'深层矿脉','任意等级的矿洞都能带出星尘',['res-mine'],[{kind:'feature',id:'deep'}]],
 ['res-storage3',0,4,'仓储 III','所有建筑暂存时间再 +1 小时',['res-storage2'],[{kind:'buffer',n:1}]],
 ['cra-wood',1,1,'木工','解锁木工台',[],[{kind:'building',id:'woodshop'}]],
 ['cra-alchemy',1,1,'炼制入门','解锁炼制台',[],[{kind:'building',id:'alchemy'}]],
 ['cra-smelt',1,2,'冶炼','炼制台可把矿石炼成金属锭',['cra-alchemy','res-mine'],[{kind:'recipe',id:'ingot'}]],
 ['cra-net',1,2,'结网','木工台可编织捕捉网，直接放进背包',['cra-wood','cra-smelt'],[{kind:'recipe',id:'net'}]],
 ['cra-compost',1,2,'堆肥','解锁堆肥箱',[],[{kind:'building',id:'compost'}]],
 ['cra-pharma',1,3,'药理','炼制台可调制经验药水',['cra-alchemy','res-apiary','res-spring'],[{kind:'recipe',id:'expPotion'}]],
 ['cra-queue',1,3,'加工双队列','所有制作设施的队列 +1',['cra-wood','cra-alchemy'],[{kind:'queue',id:'craft',n:1}]],
 ['cra-treasure',1,4,'天工','炼制台可凝炼天材地宝',['cra-pharma'],[{kind:'recipe',id:'treasure'}]],
 ['agr-fruit',2,1,'果树栽培','可以种植果树',[],[{kind:'family',n:3}]],
 ['agr-greenhouse',2,2,'温室','解锁温室，稳定作物温度',[],[{kind:'building',id:'greenhouse'}]],
 ['agr-fungi',2,2,'菌菇与水生栽培','可以种植菌菇和水生植物，解锁水生种植台',[],[{kind:'family',n:4},{kind:'family',n:5},{kind:'building',id:'waterbed'}]],
 ['agr-pollen',2,2,'杂交','解锁授粉棚，培育新品系',[],[{kind:'building',id:'pollen'}]],
 ['agr-seedbank',2,3,'留种','解锁种子库，复制珍贵品系',['agr-pollen'],[{kind:'building',id:'seedbank'}]],
 ['agr-rotation',2,3,'轮作','收获后自动补种',[],[{kind:'feature',id:'replant'}]],
 ['agr-master',2,4,'品系大师','杂交品种收获时额外 +1 产物',['agr-seedbank'],[{kind:'feature',id:'master'}]],
 ['eco-channel',3,1,'水利','解锁水渠，生产露水并灌溉',[],[{kind:'building',id:'channel'}]],
 ['eco-pond',3,2,'水塘与净水','解锁水塘和净水池',['eco-channel'],[{kind:'building',id:'pond'},{kind:'building',id:'filter'}]],
 ['eco-insects',3,2,'栖息地','解锁虫舍，吸引授粉者',[],[{kind:'building',id:'insects'}]],
 ['eco-observe',3,3,'观测','解锁观测台；首次遇见访客多得研究笔记',['eco-insects'],[{kind:'building',id:'observe'},{kind:'feature',id:'observe'}]],
 ['eco-night',3,3,'夜间生态','夜间访客所需植物 −1',[],[{kind:'feature',id:'night'}]],
 ['eco-symbiosis',3,4,'共生','访客带来的物资翻倍',['eco-observe'],[{kind:'feature',id:'symbiosis'}]],
 ['pal-slots',4,1,'驻场 I','每座设施多一个工作位',[],[{kind:'slots',n:1}]],
 ['pal-affinity',4,2,'元素专精','元素对口加成从 25% 提高到 50%',['pal-slots'],[{kind:'affinity',n:25}]],
 ['pal-spa',4,2,'温泉','解锁温泉，恢复伙伴心情',[],[{kind:'building',id:'spa'}]],
 ['pal-training',4,2,'训练场','解锁训练场，驻场伙伴获得经验',[],[{kind:'building',id:'training'}]],
 ['pal-stars',4,3,'观星','解锁观星台，收集星尘',[],[{kind:'building',id:'stars'}]],
 ['pal-memorial',4,3,'纪念','解锁纪念馆',[],[{kind:'building',id:'memorial'}]],
 ['pal-market',4,3,'集市','解锁集市，把多余材料换成晶币',[],[{kind:'building',id:'market'}]],
 ['pal-blessing',4,4,'星辰祝福','天材地宝每轮上限 +1',['pal-stars','cra-treasure'],[{kind:'cap',id:'treasure',n:1}]]
];
export const TECHS:TechDef[]=techRows.map(([id,branch,tier,name,desc,requires,effects,extra])=>({id,branch,tier,name,desc,requires,effects,cost:tierCost(tier,extra),seconds:tierSeconds[tier]}));
/** 开局即可建造的设施；其余功能设施由科技解锁。 */
export const STARTER_BUILDINGS=['house','kitchen','table','trough','toys','grove','bed','archive'];
export const STARTER_FAMILIES=[0,1,2];
/** 元素对口：驻场伙伴在对口设施里提高产出或制作速度。 */
export const AFFINITY:Record<Element,string[]>={岩:['quarry','mine'],火:['kitchen','alchemy'],水:['channel','pond','filter','spring'],风:['grove','apiary'],草:['bed','greenhouse','pollen','seedbank','waterbed','grove'],冰:['warehouse','greenhouse'],雷:['woodshop','training'],幻:['pollen','market'],光:['stars','market'],暗:['mine','compost'],时间:['archive'],空间:['warehouse']};
/** 地形加成：建筑落在对应地形时产出 +25%。地形编号即 V5 地图的六片原区域。 */
export const BIOME_BONUS:Record<string,number>={quarry:4,mine:4,grove:2,apiary:1,channel:3,spring:3,stars:5};
/** 家园等级所需繁荣度：1–10 级。 */
export const PROSPERITY=[0,60,120,200,300,420,560,720,900,1100];
/** 装饰组按家园等级开放：围栏、灯具、休闲、花架、标识、生态、纪念。 */
export const DECOR_LEVEL=[0,1,1,2,3,4,5,6];
/** 集市收购价与委托估值（晶币）。桥接物品和种子不可出售。 */
export const VALUES:Record<string,number>={wood:4,stone:5,dew:3,ingredient:8,petal:6,herb:8,fruit:10,mushroom:10,algae:8,plank:12,dye:16,fertilizer:8,soil:20,feed:20,snack:15,meal:40,soup:40,potion:60,crystal:120,notes:30,stardust:40,ore:12,ingot:45,honey:25,essence:80,keepsake:150,relic:200};
export const MARKET_CAP=[0,2000,3500,5000];
/** 每 12 小时最多完成的委托份数，避免委托收入超过战斗收入的一半。 */
export const ORDER_CAP=9;
/** 委托模板：[物品, 数量, 需要的设施或科技]。只会抽到当前家园做得出来的物品。 */
export const ORDER_POOL:[string,number,string][]=[
 ['wood',30,'grove'],['stone',20,'quarry'],['dew',12,'bed'],['feed',4,'kitchen'],['meal',2,'kitchen'],['ingredient',6,''],['petal',6,''],['herb',6,''],['fruit',4,'agr-fruit'],['mushroom',4,'agr-fungi'],
 ['plank',4,'woodshop'],['dye',2,'alchemy'],['ore',10,'mine'],['ingot',3,'cra-smelt'],['honey',5,'apiary'],['essence',2,'spring'],['potion',2,'alchemy'],['soup',2,'kitchen'],['stardust',3,'stars'],['crystal',1,'alchemy']
];
