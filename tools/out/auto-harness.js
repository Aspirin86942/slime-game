/* R-auto 基线对拍用的外部脚本：固定种子跑一场自动战斗，把前 20 条战报写进 document.title */
(function(){
  var seed = 4242;
  Math.random = function(){
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  var logs = [];
  window.__LOGS = logs;

  function boot(){
    try{
      S.started = true;
      S.battleMode = 'auto';
      var story = document.querySelector('#storyScreen');
      if(story) story.style.display = 'none';
      var game = document.querySelector('#gameScreen');
      if(game) game.style.display = 'block';
      applyTheme();

      S.slimes = [];
      ['岩','火','冰'].forEach(function(el, i){
        var s = createSlime(false);
        s.element = el;
        s.name = 'A' + i;
        s.level = 20;
        s.str = s.strPotential * 20;
        s.agi = s.agiPotential * 20;
        s.mag = s.magPotential * 20;
        s.skill = '元素弹';
        s.hp = hpMax(s);
        S.slimes.push(s);
      });
      S.abyssLevel = 20;
      S.battleSpeed = 10;
      abyssSetupSel = S.slimes.map(function(s){ return s.id; });
      startAbyssBattle();

      var logEl = document.querySelector('#battleLog');
      if(logEl){
        new MutationObserver(function(){ logs.push(logEl.textContent); })
          .observe(logEl, { childList: true, characterData: true, subtree: true });
      }
    }catch(e){
      document.title = 'ERR ' + (e && e.message);
    }
  }

  setTimeout(boot, 60);
  setTimeout(function(){
    document.title = 'LOGS:' + JSON.stringify(logs.slice(0, 20));
  }, 24000);
})();
