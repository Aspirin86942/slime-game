import type {World,Stock,Inventory,Cultivar,Trip} from './types.ts';

const alias=(object:object,key:string,get:()=>unknown,set?:(v:any)=>void)=>Object.defineProperty(object,key,{configurable:true,enumerable:false,get,set});
const itemKey=(key:string)=>key==='food'?'ingredient':key;
export function deposit(items:Stock,gain:Stock,pending?:Stock):void {
 for(const [key,value] of Object.entries(gain)){
  if(!Number.isFinite(value)||value<0)throw new Error('物品数量无效');
  const n=pending?Math.min(value,Math.max(0,9999-(items[key]??0))):value;
  items[key]=(items[key]??0)+n;if(pending&&value>n)pending[key]=(pending[key]??0)+value-n;
 }
}
export function spend(items:Stock,cost:Stock):void {
 if(!Object.entries(cost).every(([key,n])=>Number.isFinite(n)&&n>=0&&(items[key]??0)>=n))throw new Error('物品不足');
 for(const [key,n] of Object.entries(cost))items[key]-=n;
}
export function seedAccount(w:World,c:Cultivar):void {
 const key=`seed:${c.id}`,raw=Object.getOwnPropertyDescriptor(c,'seeds');
 if(raw&&'value'in raw){w.inventory.items[key]=raw.value;delete (c as Partial<Cultivar>).seeds;}
 alias(c,'seeds',()=>w.inventory.items[key]??0,v=>{if(!Number.isFinite(v)||v<0)throw new Error('种子数量无效');w.inventory.items[key]=v;});
}
export function tripAccount(w:World,t:Trip):void {
 const key=`trip:${t.id}`,raw=Object.getOwnPropertyDescriptor(t,'bag');
 if(raw&&'value'in raw){w.inventory.containers[key]=Object.fromEntries(Object.entries(raw.value as Stock).map(([k,n])=>[itemKey(k),n]));delete (t as Partial<Trip>).bag;}
 w.inventory.containers[key]??={};alias(t,'bag',()=>w.inventory.containers[key],v=>{w.inventory.containers[key]=v;});
}
/** Compatibility views are deliberately non-enumerable: a save has one balance. */
export function bindInventory(w:World):World {
 if(!w.inventory){const old=w.stock??{};w.inventory={items:{},pending:Object.fromEntries(Object.entries(w.pending??{}).map(([k,n])=>[itemKey(k),n])),containers:{trough:{feed:0}}};for(const[k,n]of Object.entries(old))w.inventory.items[itemKey(k)]=n;}
 const inventory=w.inventory;inventory.containers.trough??={feed:0};
 alias(w,'stock',()=>new Proxy(inventory.items,{get:(t,k)=>typeof k==='string'?t[itemKey(k)]:Reflect.get(t,k),set:(t,k,v)=>{if(typeof k!=='string'||!Number.isFinite(v)||v<0)throw new Error('物品数量无效');t[itemKey(k)]=v;return true;}}));
 alias(w,'pending',()=>inventory.pending,v=>inventory.pending=v);
 for(const c of w.cultivars)seedAccount(w,c);for(const t of w.trips)tripAccount(w,t);
 return w;
}
export function attachLegacyInventory(state:Record<string,any>):void {
 const world=bindInventory(state.world as World);
 const old=Object.getOwnPropertyDescriptor(state,'bag');
 if(old&&'value'in old){for(const[k,n]of Object.entries(old.value??{}))deposit(world.inventory.items,{[k==='food'?'feed':k]:Number(n)});delete state.bag;}
 const trough=Object.getOwnPropertyDescriptor(state,'feedTrough');
 if(trough&&'value'in trough){world.inventory.containers.trough.feed+=Number(trough.value)||0;delete state.feedTrough;}
 const bag=new Proxy({} as Stock,{
  get:(_t,k)=>typeof k==='string'?state.world.inventory.items[k==='food'?'feed':k]??0:undefined,
  set:(_t,k,v)=>{if(typeof k!=='string'||!Number.isFinite(v)||v<0)throw new Error('物品数量无效');state.world.inventory.items[k==='food'?'feed':k]=v;return true;},
  ownKeys:()=>['food','treasure','ticket','expPotion','net'],getOwnPropertyDescriptor:()=>({configurable:true,enumerable:true})
 });
 alias(state,'bag',()=>bag);
 alias(state,'feedTrough',()=>state.world.inventory.containers.trough.feed??0,v=>{if(!Number.isFinite(v)||v<0)throw new Error('饲料数量无效');state.world.inventory.containers.trough.feed=v;});
}
