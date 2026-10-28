export type Element = '岩'|'火'|'水'|'风'|'草'|'冰'|'雷'|'幻'|'光'|'暗'|'时间'|'空间';
export type Stock = Record<string, number>;
export interface Slime { id:number; name:string; element:Element; personality:string; intimacy:number; mood:number; stamina:number; level:number; exp?:number; luck?:number; wit?:number; traits?:{k:string;v:number}[]; str?:number; agi?:number; mag?:number; strPotential?:number; agiPotential?:number; magPotential?:number; locked?:boolean; resting?:boolean; size?:number; }
export interface GameState { started:boolean; saveVersion:number; slimes:Slime[]; legacyTeamPreset?:number[]; coins?:number; totalEarned?:number; points?:number; world?:World; lastActive:number; }
export interface SaveV4 extends GameState { saveVersion:4; world:World; }
export interface SaveV3 extends GameState { saveVersion:3; world:World; }
export interface BuildingDef {id:string; name:string; zone:number; icon:string; desc:string; service:string; size:[number,number]; cost:Stock; upgrades:[string,string];}
export interface DecorationDef {id:string; name:string; group:number; icon:string; effect:string; cost:Stock;}
export interface PlantDef {id:string;name:string;family:number;minutes:number;color:number;light:number;moisture:number;temp:number;product:string;use:string;parents?:[string,string];}
export interface VisitorDef {id:string;name:string;zone:number;need:string;service:string;humidity:number;quality:number;plants:number;}
export interface ZoneDef {id:number; name:string; area:string; color:string; threshold:number; story:string;}
export interface Placement {id:number; def:string;zone:number;x:number;y:number;rotation:number;level:number;stored:boolean;}
export interface Genes {color:number;form:number;yield:number;speed:number;adapt:number;}
export interface Cultivar {id:number;species:string;name:string;genes:Genes;parents:string[];protected:boolean;seeds:number;}
export interface Crop {id:number;cultivar:number;zone:number;x:number;y:number;progress:number;water:number;care:number;harvests:number;lastSim:number;}
export interface Juvenile {id:number;name:string;element:Element;born:number;stage:number;care:string[];mentor:number|null;traits:string[];choices:string[];active:boolean;personality:string;}
export interface Memory {id:string;title:string;text:string;at:number;}
export interface Companion {slimeId:number;role:string;interest:string;memories:Memory[];friends:Record<string,number>;story:Record<string,number>;mentor:number|null;daily:number;day:number;facts?:Record<string,number>;lastPet?:number;}
export interface Work {slimeId:number;building:number;}
export interface Recipe {id:string;name:string;building:string;cost:Stock;output:Stock;seconds:number;level:number;}
export interface Craft {participants?:number[];id:number;recipe:string;building:number;remaining:number;ready:boolean;}
export interface Choice {text:string;result:string;reward:Stock;flag?:string; requires?:{element?:Element; personality?:string; companions?:number; cost?:Stock; building?:string};}
export interface ExploreEvent {id:string;region:number;title:string;text:string;kind:string;choices:Choice[];}
export interface Chapter {title:string;text:string;need:string;choices:Choice[];}
export interface StoryCharacter {id:string;name:string;element:Element;personality:string;theme:string;chapters:Chapter[];}
export interface PersonalityChain {id:string;personality:string;title:string;chapters:[string,string,string];choices:[string,string];}
export interface PairEvent {id:string;title:string;text:string;choices:[string,string];}
export interface Trip {id:number;region:number;route:number;team:number[];mode:'active'|'offline';duration:number;nextAt:number;node:number;events:string[];pending:string|null;bag:Stock;log:string[];ready:boolean; repeat?:boolean; resting?:boolean; phase?:number; coins?:number; experience?:Record<string,number>; actions?:number; familiar?:boolean; legacy?:boolean;returned?:boolean;}
export interface TravelLog {id:number;title:string;lines:string[];at:number;}
export interface Mini {kind:'match'|'pollination'|'observation';board:number[];selected:number;steps:number;score:number;hp:number;matches:number[];done:boolean;claimed:boolean;round:number;participants?:number[];}
export interface World {version:3|4;inventory:Inventory;residents:Record<string,SceneResident>;stories:Record<string,StoryInstance>;activities:Record<string,CompanionActivity>;archives:Record<string,{name:string;profile:Companion}>;familiar:string[];evidence:LifeEvent[];payments:GameEvent[];memorials:Memorial[];migration?:{from:number;at:number};clock:number;rng:number;seq:number;stock:Stock;unlocked:number[];placements:Placement[];paths:Record<string,number[]>;pathStyles?:Record<string,number>;cultivars:Cultivar[];crops:Crop[];juveniles:Juvenile[];companions:Record<string,Companion>;workers:Work[];crafts:Craft[];visitors:Record<string,boolean>;discoveries:string[];trips:Trip[];journals:TravelLog[];chapters:Record<string,number>;recruited:Record<string,number>;flags:string[];camps:number[];regionStory:Record<string,number>;mini:Mini|null;miniRewards:Record<string,number>;lastGather:number;lastResonance:number;weather:number;weatherAt:number;reducedMotion:boolean;autoReplant:boolean;notices:string[];pending:Stock;}
export type GameCommandData =
 | {type:'interact';slime:number;action:'pet'|'chat'|'feed'|'snack'|'rest';item?:string}
 | {type:'refill';amount?:number} | {type:'relocate';slime:number;zone:number}
 | {type:'storyStart';definition:string;participants?:number[]} | {type:'storyChoice';id:string;choice:number}
 | {type:'storyEncounter';kind:'world'|'personal'|'pair'} | {type:'storyContinue';id:string;stage:number}
 | {type:'gather'} | {type:'unlock';zone:number}
 | {type:'build';def:string;zone:number;x:number;y:number;rotation?:number}
 | {type:'move';id:number;zone:number;x:number;y:number;rotation?:number}
 | {type:'store'|'upgrade';id:number} | {type:'path';zone:number;x:number;y:number}
 | {type:'paint';zone:number;cells:number[];style:number;erase?:boolean}
 | {type:'plant';cultivar:number;zone:number;x:number;y:number;explicit?:boolean}
 | {type:'care'|'harvest'|'uproot';id:number} | {type:'harvestAll'|'careAll'} | {type:'sow';cultivar:number;zone:number}
 | {type:'breed';a:number;b:number} | {type:'cultivar';id:number;name?:string;protect?:boolean} | {type:'clone';id:number}
 | {type:'resonate';a:number;b:number} | {type:'babyCare';id:number;kind:string;mentor?:number}
 | {type:'babyChoice';id:number;choice:number} | {type:'babyContinue';id:number;stage:number;chapter:number} | {type:'grow';id:number} | {type:'adopt';id:number}
 | {type:'assign';slime:number;building:number} | {type:'unassign';slime:number}
 | {type:'craft';recipe:string;building:number} | {type:'claimCraft';id:number}
 | {type:'useSupply';item:'meal'|'soup'|'potion';slime:number} | {type:'fertilize';id:number;item:'fertilizer'|'soil'}
 | {type:'depart';region:number;route:number;team:number[];duration:number;mode:'active'|'offline';supply?:'feed'|'meal';repeat?:boolean}
 | {type:'step'|'recall'|'claimTrip'|'restTrip';id:number} | {type:'tripChoice';id:number;choice:number} | {type:'tripContinue';id:number;event:string}
 | {type:'camp';region:number} | {type:'regionStory';region:number;participants?:number[]}
 | {type:'chapter';character:string;choice:number;participants?:number[]} | {type:'personal';slime:number;chain:string;choice:number}
 | {type:'pair';a:number;b:number;event:string;choice:number} | {type:'meal';ids:number[]}
 | {type:'miniStart';kind:Mini['kind']} | {type:'miniCell';index:number} | {type:'miniClaim'}
 | {type:'settings';reduced?:boolean;replant?:boolean} | {type:'claimOverflow'};
export interface GameEvent {type:'notice'|'adopt'|'recruit'|'experience'|'feed'|'income'|'collection'|'pet';text:string;juvenile?:Juvenile;character?:StoryCharacter;participants?:number[];amount?:number;at?:number;object?:string;}
export interface Result {ok:boolean;message:string;events:GameEvent[];}
export interface Environment {light:number;moisture:number;fertility:number;quality:number;temperature:number;reasons:string[];}
export interface Host {state:()=>GameState;save:()=>boolean;writable:()=>boolean;render:()=>void;toast:(s:string)=>void;available:(id:number)=>boolean;create:(element:Element,name:string,personality:string)=>Slime;slimeHTML:(s:Slime)=>string;diagnostic:boolean;open?:(page:string)=>void;play?:(kind:string,slime:number)=>void;progress?:(events:GameEvent[])=>void;}
export interface BattleActionResult {combo:string|null;heal:number;extra:number;cleanse:boolean;weakness:boolean;burn:boolean;cooldown:boolean;secondary:boolean;}

export interface Inventory {items:Stock;pending:Stock;containers:Record<string,Stock>;}
export interface CompanionActivity {kind:'home'|'work'|'trip'|'battle'|'play';ref?:number|string;phase?:'resting'|'active';}
export interface SceneResident {slimeId:number;zone:number;x:number;y:number;target:number|null;pose:string;until:number;blocked?:boolean;goal?:number;arrived?:boolean;}
export interface LifeEvent {id:number;type:string;participants:number[];object:string;at:number;}
export interface StoryInstance {id:string;kind:'world'|'personal'|'pair'|'region'|'wish';definition:string;participants:number[];stage:number;status:'active'|'completed'|'archived';baseline:Record<string,number>;choices:{stage:number;choice:number;text:string;result:string;at:number}[];effects:string[];legacy?:boolean;}
export interface Memorial {id:string;story:string;participants:number[];title:string;text:string;zone:number;plant?:number;}

export type GameCommand = GameCommandData & {actor?:number};
