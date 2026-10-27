#!/usr/bin/env node
'use strict';
// 在独立临时 Chrome 配置中验收正常存档流程、按钮与手机画面。
const assert=require('node:assert/strict');
const path=require('node:path');
const {launch,fileUrl,waitFor,sleep,report}=require('../tools/out/lib/cdp.js');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'tools/out/shots/gameplay');
const url=fileUrl(path.join(ROOT,'史莱姆.html'));
(async()=>{
  const page=await launch({url,width:390,height:844,dpr:2,touchEnabled:true});
  const results=[],errors=[];
  page.client.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.text));
  const check=async(name,expr)=>{assert.ok(await page.ev(expr),name);results.push({name,status:'PASS'});console.log('PASS '+name);};
  const click=async selector=>{
    const point=await page.ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw new Error('Button unavailable');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await page.touch.tap(point.x,point.y);await sleep(80);
  };
  const shot=async name=>{
    await sleep(150);await check(name+' 手机宽度无横向溢出','document.documentElement.scrollWidth<=390');
    await page.shot(path.join(OUT,name+'.png'));
  };
  const ready=async()=>{assert.ok(await waitFor(()=>page.ev('document.readyState==="complete"&&typeof tickWorld==="function"'),12000));};
  const reload=async()=>{
    const origin=await page.ev('performance.timeOrigin');await page.client.send('Page.reload');
    assert.ok(await waitFor(()=>page.ev(`performance.timeOrigin!==${origin}&&document.readyState==='complete'&&typeof tickWorld==='function'`),20000));
  };
  try{
    await ready();await page.ev('S.name="旅人";S.sysName="团子";finishStory();true');
    await click('[data-tab="summon"]');await shot('01-summon');
    await click('[data-act="summon"]');await check('第一只伙伴免费并保存','S.slimes.length===1&&S.coins===2000&&JSON.parse(localStorage.getItem(SAVE_KEY)).slimes.length===1');
    await click('.summon-result>.btn');await click('[data-act="summon"]');
    await check('第二次召唤正确扣费','S.slimes.length===2&&S.coins===1400');await click('.summon-result>.btn');
    await click('[data-tab="travel"]');await click('[data-act="globalplan"][data-type="explore"]');
    await check('派遣按钮写入正常存档','JSON.parse(localStorage.getItem(SAVE_KEY)).globalPlan==="explore"');
    const clockFixture=await page.client.send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const key='slimeSummonerSave',data=JSON.parse(localStorage.getItem(key));if(data){data.lastActive=Date.now()-2*3600000;localStorage.setItem(key,JSON.stringify(data));}})();`});
    await reload();
    await page.client.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:clockFixture.identifier});
    await check('离线两小时实际发放晶币和经验并显示汇总','document.querySelector("#modalBox").textContent.includes("欢迎回来")&&document.querySelector("#modalBox").textContent.includes("伙伴经验")&&S.coins>1400&&S.slimes.some(s=>s.level>1)');
    await shot('02-offline');
    const coins=await page.ev('S.coins');await reload();
    await check('立即重载不会重复领取离线收益',`S.coins===${coins}&&!document.querySelector('#modalBox').textContent.includes('欢迎回来')`);
    await click('[data-tab="travel"]');await click('[data-act="globalplan"][data-type="clear"]');
    // 战斗用固定种子和中等潜力队伍，仍由真实按钮进入、真实计时器完成行动。
    const fight=async(floor,level)=>{
      await page.ev(`(()=>{let seed=7;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
        window.__TEST__={};S.globalPlan=null;S.customPlans={};S.battleMode='auto';S.battleSpeed=10;S.abyssUnlocked=Math.max(S.abyssUnlocked,${floor});S.abyssLevel=${floor};
        S.slimes.forEach((s,i)=>{s.element=['火','岩'][i];s.skill='元素弹';s.level=${level};s.personality='天真';s.traits=[];s.wit=0;s.luck=5;
          for(const k of ['str','agi','mag']){s[k+'Potential']=15;s[k]=growthStat(15,s.level);}s.hp=hpMax(s);s.resting=false;});
        S.lastAbyssSel=S.slimes.map(s=>s.id);renderTab();})()`);
      await click('[data-act="abyssSetup"]');
      if(floor===5){
        await check('首领弹窗显示额外奖励和羁绊','document.querySelector("#modalBox").textContent.includes("首领挑战")&&document.querySelector("#modalBox").textContent.includes("天材地宝")&&!!document.querySelector("#abyssBond")');
        await shot('03-boss-setup');
      }
      await click('[data-act="abyssStart"]');
      if(floor===5)await shot('04-boss-battle');
      const result=await page.ev(`(async()=>{const b=__TEST__._battle;clearInterval(b.B.timer);const end=Date.now()+45000;while(!b.B.ended&&Date.now()<end){if(!b.B.resolving)b.nextTurn();await new Promise(r=>setTimeout(r,80));}const result=b.B.result;b.closeBattle();return result;})()`);
      assert.ok(result?.win,`第 ${floor} 层可由真实行动获胜`);results.push({name:`第 ${floor} 层真实战斗获胜`,status:'PASS',turns:await page.ev('__TEST__._battle.B.turn')});
    };
    await fight(1,3);await fight(5,8);
    await click('[data-act="abyssSweep"]');await check('扫荡按钮生效且剩余次数刷新','S.sweepUsed===1&&document.querySelector("[data-act=abyssSweep]").textContent.includes("2/3")');
    await page.ev('openDetail(S.slimes[0].id);document.querySelector("#modalBox").scrollTop=250;true');
    await check('伙伴详情包含物理魔法防御信息','["防御","抗性","攻击类型"].every(t=>document.querySelector("#modalBox").textContent.includes(t))');await shot('05-detail');
    await page.ev('closeModal();switchTab("travel");document.querySelector("[data-act=abyssSweep]").scrollIntoView({block:"center"});true');await shot('06-sweep');
    await check('没有未捕获的浏览器异常',JSON.stringify(errors.length===0));
  }catch(e){results.push({name:'浏览器流程',status:'FAIL',error:e.stack});console.error(e.stack);process.exitCode=1;}
  finally{await page.close();}
  report(OUT,'report.json',{results,errors});
  console.log(`RESULT ${results.filter(x=>x.status==='PASS').length}/${results.length} passed`);
})();
