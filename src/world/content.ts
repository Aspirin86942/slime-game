import type {BuildingDef,DecorationDef,PlantDef,Recipe,VisitorDef,ZoneDef,Element} from './types.ts';
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
 ['training','训练场','⚔','练习元素协作，生产训练笔记','stone',[2,2],'石材与训练产出提高','开放高级训练配方'],
 ['archive','档案馆','▣','收藏区域故事和研究笔记','archive',[2,2],'研究队列增加','故事纪念物解锁'],
 ['stars','观星台','✧','记录夜空，收集星尘','stars',[1,2],'星尘生产增加','特殊天气提供额外星尘'],
 ['resonance','共鸣石','◈','成年伙伴共鸣产生幼体','resonance',[1,1],'共鸣冷却缩短','成长所需时间减少'],
 ['memorial','纪念馆','♡','陈列伙伴回忆与旅程纪念物','memory',[2,1],'聚餐关系收益增加','访客舒适度增加']
];
export const BUILDINGS:BuildingDef[]=buildingRows.map((r,i)=>({id:r[0],name:r[1],icon:r[2],desc:r[3],service:r[4],size:r[5],upgrades:[r[6],r[7]],zone:Math.floor(i/4),cost:{wood:12+4*Math.floor(i/4),stone:8+3*Math.floor(i/4)}}));
BUILDINGS.push({id:'trough',name:'饲料槽',zone:0,icon:'▱',desc:'伙伴走过来分享实际存放的饲料',service:'feed',size:[1,1],cost:{wood:8,stone:4},upgrades:['伙伴安心用餐','家园的用餐角落']},{id:'toys',name:'玩具区',zone:0,icon:'◉',desc:'一起接球、叠叠乐和练习观察',service:'play',size:[1,1],cost:{wood:8,stone:4},upgrades:['保留共同游戏的记录','伙伴喜欢的游乐角落']});
const decorNames=[['碎石小径','苔石小径','木板步道','白砂路','落叶路','星砂路'],['矮木篱','藤编围栏','白石围栏','竹篱','蘑菇围栏','月牙围栏'],['纸灯','萤光灯','蘑菇灯','冰晶灯','星灯','暖炉灯'],['长椅','摇椅','野餐毯','秋千','躺椅','树桩桌'],['木花架','藤花门','垂吊花盆','种子风铃','水莲盆','菌菇架'],['庭院路牌','苗圃标签','访客告示','旅人留言板','星图牌','伙伴名牌'],['落叶堆','蜜源花篮','小鸟浴盆','虫洞木桩','苔石丘','浅水盆'],['种子相框','溪流石刻','小小灶台','归家门牌','霜花瓶','旅程相册']];
/* 第一组「小径」是路面材质：在地图上拖动铺成连续道路，材质编号存进 pathStyles。 */
export const PATH_STYLES=decorNames[0];
export const DECORATIONS:DecorationDef[]=decorNames.flatMap((names,g)=>names.map((name,i)=>({id:`decor-${g}-${i}`,name,group:g,icon:['·','╬','✦','▱','❋','⚑','♧','♡'][g],effect:['铺设可通行的小路','遮阴 +3','光照 +4','舒适与聚餐回忆','授粉环境 +3','家园标识与回忆','湿度与肥力 +3','舒适与回忆'][g],cost:{wood:3+g,stone:2+i}})));
export const FAMILIES=['花卉','草药','蔬果','果树','菌菇','水生'];
const plants=[['晨露花','铃兰','日光菊','月见花','绯瓣花','星绒花'],['薄荷','甘露草','暖叶草','霜叶草','清心草','回声草'],['甜萝卜','蜜番茄','月南瓜','脆豆','光莓','雨瓜'],['苹果树','蜜桃树','风梨树','银杏','雪梨树','星枣树'],['苔菇','灯笼菇','雨伞菇','绒球菇','晶耳','梦孢菇'],['浮萍','水莲','芦苇','净水藻','冰灯莲','星舟草']];
const hybrids=[['露铃花','昼月菊','绯星花'],['甘薄草','暖霜草','心声草'],['蜜萝果','南豆瓜','光雨莓'],['桃果树','风银树','雪枣树'],['苔灯菇','雨绒菇','晶梦菇'],['萍莲','苇藻','冰舟莲']];
export const PLANTS:PlantDef[]=plants.flatMap((names,f)=>names.map((name,i)=>({id:`plant-${f}-${i}`,name,family:f,minutes:f===3?120:[5,15,30,60,15,30][i],color:([315,155,20,90,35,185][f]+i*11)%360,light:f===4?30:f===3?65:55,moisture:f===5?80:f===4?65:50,temp:i===3||i===4?12:22,product:['petal','herb','ingredient','fruit','mushroom','algae'][f],use:['染料与授粉','药剂与料理','聚餐与远征','果酱与林间访客','料理与分解共生','净水与水生访客'][f]})));
for(let f=0;f<6;f++)for(let i=0;i<3;i++){const a=PLANTS.find(p=>p.id===`plant-${f}-${i*2}`)!; PLANTS.push({...a,id:`hybrid-${f}-${i}`,name:hybrids[f][i],minutes:f===3?120:60,parents:[a.id,`plant-${f}-${i*2+1}`],use:a.use+'；命名杂交品种'});}
PLANTS.push({id:'glowflower',name:'发光花',family:0,minutes:5,color:65,light:55,moisture:50,temp:22,product:'petal',use:'共同旅行带回的花；开花后成为夜间休息的角落'});
export const MATERIALS:Record<string,string>={feed:'基础饲料',snack:'果香小食',wood:'木材',stone:'石材',dew:'露水',ingredient:'食材',petal:'花瓣',herb:'草药',fruit:'果实',mushroom:'菌菇',algae:'水草',plank:'木板',dye:'染料',fertilizer:'肥料',soil:'沃土',meal:'便当',soup:'暖汤',potion:'恢复药剂',crystal:'共鸣晶石',notes:'研究笔记',stardust:'星尘',relic:'遗迹碎片',keepsake:'纪念物'};
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
 ['蜜蜂',0,'2 株开花植物，湿度 ≥40','种子产出 +1',40,0,2],['粉蝶',1,'3 株植物，湿度 ≥45','授粉产出增加',45,0,3],['夜蛾',1,'夜间，2 株植物','发现夜间花粉',30,0,2],['瓢虫',0,'3 株植物','改善植物适应',35,0,3],['蜻蜓',3,'水质 ≥60、湿度 ≥60','湿地调查加成',60,60,2],['萤火虫',2,'夜间，水质 ≥55','旅行可发现星尘',45,55,2],['蚯蚓',0,'湿度 ≥50、2 株植物','土壤肥力 +8',50,0,2],['潮虫',2,'湿度 ≥65、2 株植物','堆肥产量增加',65,0,2],['独角仙',2,'4 株植物','林木产量增加',45,0,4],['树蛙',2,'湿度 ≥60、水质 ≥50','水质 +5',60,50,2],['溪虾',3,'水质 ≥65','水生植物加速',65,65,1],['银鳍鱼',3,'水质 ≥75、3 株植物','水塘观察记录',65,75,3],['松鼠',2,'3 株植物，其中有果树','旅行带回果实',30,0,3],['刺猬',0,'4 株植物','发现草药',40,0,4],['织巢鸟',2,'4 株植物','授粉与种子传播',30,0,4],['苔灵',2,'湿度 ≥70、4 株植物','肥力 +10',70,0,4],['雪雀',4,'冬季或冰元素伙伴','带回耐寒种子',25,0,1],['星蛾',5,'夜间，3 株植物','星尘产量增加',30,0,3]
];
export const VISITORS:VisitorDef[]=visitorRows.map((r,i)=>({id:`visitor-${i}`,name:r[0],zone:r[1],need:r[2],service:r[3],humidity:r[4],quality:r[5],plants:r[6]}));
export const BABY_EVENTS=ELEMENTS.map((element,i)=>({element,title:['滚动的小石子','太热的拥抱','水洼里的倒影','抓不住的风','第一片新叶','不会融化的礼物','静电小火花','梦里的颜色','窗边的光','影子的朋友','慢慢长大','口袋里的远方'][i],text:['它把石子排成一条通往你的小路。','它想帮忙加热牛奶，却把杯沿烫红了。','它向倒影挥手，等着另一只幼体回应。','它追着纸风车绕了整座苗圃。','它把落叶藏进被窝，期待叶子重新发芽。','它捧着一朵霜花，担心礼物会在你手中融化。','它打了个喷嚏，让桌上的种子跳了起来。','它描述了一朵从未见过的花，颜色随心情改变。','它跟着光斑移动，想把温暖分给种子。','它给自己的影子留了一份点心。','它盯着沙漏，问长大以后是否仍能一起玩。','它的玩具滚进小小裂隙，带回来一片陌生叶子。'][i],choices:['一起试一试，培养好奇心','先陪它练习，培养耐心']}));
export const BABY_PERSONAL_EVENTS=Array.from({length:24},(_,i)=>({id:`baby-personal-${i}`,title:['分享点心','第一次道歉','收好玩具','陌生的访客','守住约定','照顾小苗','晚安故事','找回铃铛','雨天散步','轮流游戏','勇敢发问','自己的名字'][i%12]+(i>=12?'·长大以后':''),text:['它把最后一块点心推给同伴，又悄悄看向你。','玩具碰倒了花盆，它躲在叶子后面不敢出来。','它发现整理好的玩具更容易找到，却舍不得结束游戏。','一位陌生访客来到围栏边，它不知道该靠近还是躲开。','它答应等同伴回来，午睡时间却已经到了。','小苗的叶子垂了下来，它提起了比自己还高的水壶。','故事讲到迷路的旅人，它坚持要听到旅人回家。','草丛里响起别人的铃铛，它抱着铃铛寻找主人。','雨停后的地面很滑，它伸出身体想牵住你。','两只幼体都想玩同一个球，它看着你等待答案。','它举起小手，想知道为什么冰和火也能成为朋友。','它把自己的名字写在叶子上，想贴在门边。'][i%12],choices:['鼓励它表达自己的想法','陪它考虑同伴的感受']}));
