import type {BattleActionResult,Element} from './types.ts';
export const COMBOS:{elements:[Element,Element];name:string;desc:string}[]=[
 {elements:['水','草'],name:'滋养',desc:'队友恢复 5% 生命'},
 {elements:['火','水'],name:'蒸汽',desc:'额外造成 20% 伤害'},
 {elements:['水','雷'],name:'传导',desc:'另一名敌人受到 20% 伤害'},
 {elements:['火','风'],name:'焰流',desc:'施加 1 回合灼烧'},
 {elements:['冰','岩'],name:'碎裂',desc:'额外造成 25% 伤害'},
 {elements:['草','光'],name:'净生',desc:'清除队友一个不利状态'},
 {elements:['暗','幻'],name:'惑影',desc:'施加 1 回合虚弱'},
 {elements:['时间','空间'],name:'共振',desc:'其他队友技能冷却减少 1'}
];
export function comboFor(attacker:Element,team:Element[],used:boolean):BattleActionResult {
 const c=used?undefined:COMBOS.find(c=>c.elements.includes(attacker)&&c.elements.every(e=>team.includes(e)));
 return{combo:c?.name??null,heal:c?.name==='滋养'?.05:0,extra:c?.name==='蒸汽'?.2:c?.name==='碎裂'?.25:0,secondary:c?.name==='传导',burn:c?.name==='焰流',cleanse:c?.name==='净生',weakness:c?.name==='惑影',cooldown:c?.name==='共振'};
}
