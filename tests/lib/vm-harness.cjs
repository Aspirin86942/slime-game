#!/usr/bin/env node
'use strict';
/** 共享 VM 夹具：在 Node VM 里执行游戏真实 JS，DOM 与计时器是惰性模拟。
 * review-tests.cjs 与 balance-sim.cjs 共用，保证两边测到的是同一套游戏函数。
 * 用法：const {boot} = loadGame(file, code); const h = boot(storage, {search});
 */
const vm = require('vm');
const assert = require('node:assert/strict');
function loadGame(file, code) {
  const init = code.indexOf('(function init(){');
  assert.ok(init>0,'Expected recognizable init boundary');
  const program = new vm.Script(code.slice(0,init),{filename:file});
  function node(tag='div') {
    const children = new Map();
    const classes = new Set();
    const n = { tagName:tag.toUpperCase(), dataset:{}, children:[], parentNode:null,
      textContent:'', innerHTML:'', isConnected:true, offsetWidth:400, offsetHeight:250,
      clientWidth:400, clientHeight:250, scrollHeight:250,
      style:{setProperty(k,v){this[k]=v;}, removeProperty(k){delete this[k];}},
      classList:{add(...v){v.forEach(x=>classes.add(x));},remove(...v){v.forEach(x=>classes.delete(x));},contains(v){return classes.has(v);},toggle(v,b){b=b===undefined?!classes.has(v):b;b?classes.add(v):classes.delete(v);return b;}},
      appendChild(c){this.children.push(c);c.parentNode=this;return c;},
      append(...cs){cs.forEach(c=>this.appendChild(c));}, prepend(c){this.children.unshift(c);c.parentNode=this;},
      removeChild(c){this.children=this.children.filter(x=>x!==c);}, remove(){this.isConnected=false;if(this.parentNode)this.parentNode.removeChild(this);},
      querySelector(s){if(!children.has(s))children.set(s,node(s.startsWith('canvas')?'canvas':'div'));return children.get(s);},
      querySelectorAll(){return [];},
      addEventListener(){}, removeEventListener(){}, setAttribute(k,v){this[k]=String(v);},getAttribute(k){return this[k]??null;},removeAttribute(k){delete this[k];},
      getBoundingClientRect(){return {left:0,top:0,width:400,height:250,right:400,bottom:250};},
      closest(){return null;},matches(){return false;}, focus(){}, click(){},
      getContext(){return new Proxy({},{get:()=>()=>{}});}
    };
    return n;
  }
  function boot(storageInput={},options={}) {
    const storage = new Map(Object.entries(storageInput));
    const roots = new Map();
    const intervals = new Map(), timeouts = new Map();
    let nextTimer=1;
    let now=options.now ?? Date.now();
    class ClockDate extends Date {
      constructor(...args){ super(...(args.length ? args : [now])); }
      static now(){ return now; }
    }
    const document = {
      body:node('body'), documentElement:node('html'), title:'',
      createElement:node, createElementNS:(_,tag)=>node(tag),
      querySelector(s){if(s==='#gameOverlay')return this.body.children.find(x=>x.id==='gameOverlay'&&x.isConnected)||roots.get('#app')?.children.find(x=>x.id==='gameOverlay'&&x.isConnected)||null;if(!roots.has(s))roots.set(s,node());return roots.get(s);},
      querySelectorAll(){return [];}, getElementById(id){return this.querySelector('#'+id);},
      addEventListener(){},removeEventListener(){}
    };
    const context = {
      console, document, location:{search:options.search||'',href:'file://independent-test/index.html'},
      localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
      setInterval(fn,ms){const id=nextTimer++;intervals.set(id,{fn,ms,next:now+ms});return id;},clearInterval:id=>intervals.delete(id),
      setTimeout(fn,ms){const id=nextTimer++;timeouts.set(id,{fn,ms});return id;},clearTimeout:id=>timeouts.delete(id),
      requestAnimationFrame:()=>nextTimer++,cancelAnimationFrame(){},
      performance:{now:()=>0}, navigator:{}, Blob, URL, Date:ClockDate, Math:Object.create(Math),
      getComputedStyle:()=>({getPropertyValue:()=>'',transform:'none'}),
      innerWidth:1200,innerHeight:800, addEventListener(){}, removeEventListener(){},
      confirm:()=>false,alert(){},prompt:()=>null
    };
    context.window=context;context.self=context;
    context.Math.random=()=>0.42;
    vm.createContext(context);
    // Startup/render/self-test boot is not the subject of this rule-level harness.
    program.runInContext(context,{timeout:10000});
    const run = source=>vm.runInContext(source,context,{filename:'review-test.js',timeout:10000});
    run(`gameRandom=()=>Math.random();renderTop=()=>{};renderTab=()=>{};updateLive=()=>{};toast=()=>{};openModal=()=>{};closeModal=()=>{};window.__TEST__={};`);
    return {context,run,storage,intervals,timeouts,
      tick(ms){
        const end=now+ms;
        while(true){
          const due=[...intervals.values()].filter(t=>t.next<=end).sort((a,b)=>a.next-b.next)[0];
          if(!due)break;
          now=Math.max(now,due.next);due.next=now+Math.max(1,due.ms);due.fn();
        }
        now=end;
      },
      elapse(ms){now+=ms;},
      flush(maxMs=5000){let count=0;while(true){const next=[...timeouts].find(([id,t])=>t.ms<=maxMs);if(!next)break;const [id,t]=next;timeouts.delete(id);if(++count>1000)throw new Error('Timer flush cap exceeded');t.fn();}},
      state(){return run('S');},
      slime(overrides={}){const s=run('createSlime(false)');Object.assign(s,overrides);return s;},
      battle(elements=['火','火']){
        const state=run('S');state.started=true;state.globalPlan=null;state.customPlans={};state.slimes=elements.map((element,i)=>this.slime({element,name:'QA-'+i,skill:'元素弹',wit:0}));
        run('abyssSetupSel=S.slimes.map(s=>s.id);startAbyssBattle();');
        const b=context.__TEST__._battle;assert.ok(b,'Battle test hook should be initialized');return b;
      }
    };
  }
  return {boot, node};
}
module.exports = {loadGame};
