import type {World,Slime,StoryInstance,Choice,Stock,Trip,ExploreEvent} from './types.ts';
import {EVENTS,CHARACTERS,PERSONAL_CHAINS,PAIR_EVENTS} from './narratives.ts';
import {ZONES,PLANTS} from './content.ts';
import {companion,reward} from './engine.ts';
import {seedAccount} from './inventory.ts';
import {activity,record,resident} from './life.ts';

const need=(ok:unknown,message:string)=>{if(!ok)throw new Error(message);};
const facts=(w:World,id:number)=>w.companions[id]?.facts??{};
const counter=(w:World,ids:number[],key:string)=>Math.min(...ids.map(id=>facts(w,id)[key]??0));
const shared=(w:World,ids:number[])=>ids.length===2?Math.min(facts(w,ids[0])['with:'+ids[1]]??0,facts(w,ids[1])['with:'+ids[0]]??0):0;
const actions=['plant','harvest','trip','care','craft','meal'];
const labels:Record<string,string>={plant:'一起种下一株植物',harvest:'一起收获成熟植物',trip:'完成一次同行旅行',care:'一起照料植物',craft:'在厨房或工坊一起完成制作',meal:'参加一次聚餐',together:'一起工作、聚餐或旅行',bloom:'让带回的发光种子开花'};
export function storyId(definition:string,participants:number[]):string {
 return definition.startsWith('personal:')||definition.startsWith('pair:')||definition==='wish'?`${definition}:${participants.slice().sort((a,b)=>a-b).join(':')}`:definition;
}
export function startStory(w:World,slimes:Slime[],definition:string,ids:number[]):StoryInstance {
 need(ids.length>0&&ids.length<=3&&new Set(ids).size===ids.length,'请选择1–3位不同的参与者');
 const team=ids.map(id=>slimes.find(s=>s.id===id));need(team.every(Boolean),'参与者不存在');
 const [kind,key]=definition.split(':');
 need(kind==='wish'||kind==='world'&&CHARACTERS.some(c=>c.id===key)||kind==='personal'&&PERSONAL_CHAINS.some(c=>c.id===key&&team.every(s=>s!.personality===c.personality))||kind==='pair'&&ids.length===2&&PAIR_EVENTS.some(e=>e.id===key)||kind==='region'&&ZONES[Number(key)],'故事或参与者不符合条件');
 if(kind==='wish'||kind==='personal')need(ids.length===1,'这是属于一位伙伴的故事');
 const id=storyId(definition,ids),old=w.stories[id];need(!old||old.legacy&&old.status==='active'&&!old.participants.length,'这段故事已经开始，请继续原来的记录');
 const instance:StoryInstance={id,kind:kind as StoryInstance['kind'],definition,participants:ids.slice(),stage:0,status:'active',baseline:{},choices:[],effects:[]};
 for(const s of team)companion(w,s!);
 for(const action of [...actions,'together','bloom','craft:meal'])instance.baseline[action]=counter(w,ids,action);
 // The first wish acknowledges the planting that brought the partner here.
 if(kind==='wish')instance.baseline.plant=0;if(kind==='pair')instance.baseline.together=0;
 if(old){instance.stage=old.stage;instance.legacy=true;instance.choices=old.choices;instance.effects=old.effects;}
 w.stories[id]=instance;return instance;
}
export function storyTitle(i:StoryInstance):string {
 const key=i.definition.split(':')[1];
 return i.kind==='wish'?'一起带回一束光':i.kind==='world'?CHARACTERS.find(c=>c.id===key)!.theme:i.kind==='personal'?PERSONAL_CHAINS.find(c=>c.id===key)!.title:i.kind==='pair'?PAIR_EVENTS.find(e=>e.id===key)!.title:`${ZONES[Number(key)].area}的修复`;
}
export function storyRequirement(w:World,i:StoryInstance):string|null {
 if(i.status!=='active')return i.status==='completed'?'这段故事已完成':'这段故事已归档';
 if(!i.participants.length)return '选择伙伴继续余下的故事';
 if(i.participants.some(id=>!w.companions[id]))return '参与者已离开，回忆保留在档案中';
 const action=i.kind==='world'?actions[i.stage]:i.kind==='personal'?['care','trip','meal'][i.stage]:i.kind==='pair'?'together':i.kind==='region'?['trip','craft','care'][i.stage]:['plant','trip','bloom'][i.stage];
 if((i.kind==='pair'?shared(w,i.participants):counter(w,i.participants,action))<=(i.baseline[action]??0))return labels[action];
 if(i.kind==='wish'&&i.stage===0&&counter(w,i.participants,'care')<1)return labels.care;
 if(i.kind==='wish'&&i.stage===1&&(!i.effects.includes('seed')||counter(w,i.participants,'craft:meal')<=(i.baseline['craft:meal']??0)))return '一起制作便当，并从低语森林带回发光种子';
 if(i.kind==='region'&&!w.camps.includes(Number(i.definition.split(':')[1])))return '修复本区营地';
 if(i.kind==='pair'){const[a,b]=i.participants,idx=PAIR_EVENTS.findIndex(e=>e.id===i.definition.split(':')[1]);if((w.companions[a]?.friends[b]??0)<idx*2)return `共同生活，关系达到${idx*2}`;}
 return null;
}
export function storyScene(i:StoryInstance,team:Slime[]=[],w?:World):{text:string;choices:Choice[]} {
 const key=i.definition.split(':')[1];
 if(i.kind==='world'){const ch=CHARACTERS.find(c=>c.id===key)!;const scene=ch.chapters[Math.min(5,i.stage)];return{text:`来访者${ch.name}带来一个请求。你选择的伙伴与你一起参与：${scene.text}`,choices:scene.choices.map(c=>({...c,result:c.result.replace(ch.name+'和你','同行伙伴与你')}))};}
 if(i.kind==='personal'){const chain=PERSONAL_CHAINS.find(c=>c.id===key)!;return{text:chain.chapters[Math.min(2,i.stage)],choices:chain.choices.map(text=>({text,result:`${text}。这位伙伴把共同完成的行动记在心里，并愿意在家园再试一次。`,reward:{}}))};}
 if(i.kind==='pair'){const event=PAIR_EVENTS.find(e=>e.id===key)!;return{text:event.text,choices:event.choices.map(text=>({text,result:`${text}。两位伙伴约定，下次遇见彼此时主动打招呼。`,reward:{notes:1}}))};}
 if(i.kind==='region'){const z=ZONES[Number(key)];return{text:z.story+['你们带回了沿途的线索。','你们准备了家园制作的工具。','你们照料的植物已经能够送往营地。'][Math.min(2,i.stage)],choices:['留下共同绘制的路线','留下种植与修复记录'].map(text=>({text,result:`${z.area}保存了你们的${text.slice(2)}，路牌开始指向共同的家。`,reward:{notes:3}}))};}
 const shy=team.find(s=>s.personality==='胆小'),supported=shy?(w?.companions[shy.id]?.facts?.supported??0):0;
 return {text:(shy?(supported>=2?`${shy.name}记得你曾经陪它慢慢尝试，这次主动提出想再往前走一点。`:`${shy.name}有些胆小，希望先和你一起观察。`):'')+['伙伴停在刚照料的花旁，轻声说：想找一颗晚上会发光的种子。','森林树洞里那束光，现在安静地躺在你们的旅行背包里。一起把它种在家里吧。','花开了。伙伴想起树洞里的那一刻，邀请你在花边坐一会儿。'][Math.min(2,i.stage)],choices:[['陪它慢慢观察，约好一起出发','听它的想法，一起准备旅程'],['种在常常散步的地方','种在能够一起休息的角落'],['记住这次慢慢尝试的勇气','记住你们互相支持的约定']][Math.min(2,i.stage)].map(text=>({text,result:`${text}。这束光属于你们共同经历的旅程。`,reward:{}}))};
}
export function choiceProblem(w:World,team:Slime[],choice:Choice):string|null {
 const r=choice.requires;if(!r)return null;
 if(r.element&&!team.some(s=>s.element===r.element))return `需要同行的${r.element}元素伙伴`;
 if(r.companions&&team.length<r.companions)return `需要${r.companions}位同行伙伴`;
 if(r.personality&&!team.some(s=>s.personality===r.personality))return `需要${r.personality}的同行伙伴`;
 if(r.building&&!w.placements.some(p=>!p.stored&&p.def===r.building))return '需要对应设施';
 if(r.cost&&!Object.entries(r.cost).every(([k,n])=>(w.stock[k]??0)>=n))return '材料不足';return null;
}
export function finishStoryChoice(w:World,slimes:Slime[],i:StoryInstance,index:number):string {
 const issue=storyRequirement(w,i);need(!issue,issue??'');need(Number.isInteger(index)&&index>=0&&index<storyScene(i).choices.length,'选择无效');
 const team=i.participants.map(id=>slimes.find(s=>s.id===id)!);need(team.every(s=>s&&activity(w,s.id).kind==='home'),'先让参与者回到家园');
 const choice=storyScene(i,team,w).choices[index];need(!choiceProblem(w,team,choice),choiceProblem(w,team,choice)??'');
 if(choice.requires?.cost)for(const[k,n]of Object.entries(choice.requires.cost))w.stock[k]-=n;
 const title=storyTitle(i),stage=i.stage,result=`${team.map(s=>s.name).join('、')}与你一起：${choice.result}`;
 reward(w,choice.reward);i.choices.push({stage,choice:index,text:choice.text,result,at:w.clock});i.stage++;
 const effect=`${i.id}:${stage}`;i.effects.push(effect);
 for(const s of team){const c=companion(w,s);c.memories.push({id:effect,title,text:result,at:w.clock});s.intimacy+=2;s.mood=Math.min(100,s.mood+4);if(i.kind==='personal')c.interest=index===0?'旅行':'花草';if(i.kind==='wish'){c.facts??={};c.facts.supported=(c.facts.supported??0)+1;if(i.stage>=2&&s.personality==='胆小')c.interest='花草';}}
 for(const a of team)for(const b of team)if(a!==b){const c=companion(w,a);c.friends[b.id]=Math.min(100,(c.friends[b.id]??0)+3);}
 const zone=resident(w,team[0]).zone;w.memorials.push({id:effect,story:i.id,participants:i.participants.slice(),title:`${title} · ${i.stage}`,text:result,zone});
 for(const action of [...actions,'together','bloom','craft:meal'])i.baseline[action]=counter(w,i.participants,action);
 const length=i.kind==='world'?6:i.kind==='pair'?1:3;if(i.stage>=length)i.status='completed';
 const key=i.definition.split(':')[1];if(i.kind==='world')w.chapters[key]=i.stage;if(i.kind==='region')w.regionStory[key]=i.stage;
 if(i.kind==='personal')for(const s of team)companion(w,s).story[key]=i.stage;
 if(i.kind==='pair'){const[a,b]=i.participants.slice().sort((a,b)=>a-b);w.flags.push(`pair:${a}:${b}:${key}`);}
 w.journals.unshift({id:w.seq++,title,lines:[choice.text,result],at:w.clock});return result;
}
export function grantGlowSeed(w:World,slimes:Slime[],ids:number[]):void {
 for(const id of ids){const i=w.stories[`wish:${id}`];if(i?.status==='active'&&i.stage===1&&!i.effects.includes('seed')&&i.effects.some(e=>e.startsWith('hollow:'))){
  let cultivar=w.cultivars.find(c=>c.species==='glowflower');if(!cultivar){cultivar={id:w.seq++,species:'glowflower',name:'一起带回的发光花',genes:{color:65,form:2,yield:2,speed:2,adapt:2},parents:['低语森林的共同旅行'],protected:false,seeds:0};w.cultivars.push(cultivar);}
  seedAccount(w,cultivar);reward(w,{['seed:'+cultivar.id]:1});i.effects.push('seed');record(w,slimes,'glowSeed',[id]);
 }}
}

/** The authored night-flower encounter carries the current partner's wish. */
export function wishTravellers(w:World,ids:number[]):number[]{
 return ids.filter(id=>{const i=w.stories[`wish:${id}`];return i?.status==='active'&&i.stage===1&&!i.effects.includes('seed');});
}
export function tripScene(w:World,t:Trip,slimes:Slime[]):ExploreEvent|undefined {
 const event=EVENTS.find(e=>e.id===t.pending);
 if(event?.id!=='event-1-7'||t.mode!=='active'||!wishTravellers(w,t.team).length)return event;
 const shy=slimes.find(s=>t.team.includes(s.id)&&s.personality==='胆小');
 return {...event,title:'树洞里的一束光',text:`昏暗的树洞里，夜开的花正结出发光种子。${shy?`${shy.name}停在洞口，希望先看清里面的动静。`:'同行伙伴停下来，认真听树洞里的声音。'}`,choices:[
  {text:'陪伙伴慢慢观察，再一起靠近',result:'你们确认树洞安全后，一起收起落下的发光种子。伙伴记住了这次耐心的陪伴。',reward:{notes:1}},
  {text:'邀请同行伙伴一起探索树洞',result:'同行伙伴互相照应，一起收起落下的发光种子。每一位参与者都记住了彼此的帮助。',reward:{notes:1},requires:{companions:2}}
 ]};
}
export function rememberHollow(w:World,slimes:Slime[],t:Trip,choice:number):void {
 if(t.pending!=='event-1-7'||t.mode!=='active')return;
 for(const id of wishTravellers(w,t.team)){const i=w.stories[`wish:${id}`];i.effects.push(`hollow:${choice}`);const c=companion(w,slimes.find(s=>s.id===id)!);c.facts??={};c.facts.supported=(c.facts.supported??0)+1;}
}
