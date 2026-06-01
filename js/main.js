/* ============================================================
   BLACKWOOD — Bootstrap & menu wiring
   ============================================================ */
(function(){
  const $ = id => document.getElementById(id);

  function audioWake(){ Audio.resume(); }
  window.addEventListener('mousedown', audioWake, { once:false });
  window.addEventListener('keydown', audioWake, { once:false });

  window.addEventListener('load', ()=>{
    Input.bind();
    Game.init($('game'));

    // continue button availability
    if (Save.exists()) $('btn-continue').disabled = false;

    // ---- main menu ----
    $('btn-new').onclick = ()=>{ Audio.uiSelect(); Audio.start();
      if (Save.exists() && !confirm("Une sauvegarde existe. Démarrer une NOUVELLE partie l'écrasera. Continuer ?")) return;
      Save.clear(); Game.newGame(); };
    $('btn-continue').onclick = ()=>{ Audio.uiSelect(); Audio.start(); Game.continueGame(); };
    $('btn-howto').onclick = ()=>{ Audio.uiSelect(); $('menu').classList.add('hidden'); $('howto').classList.remove('hidden'); };
    $('btn-credits').onclick = ()=>{ Audio.uiSelect(); $('menu').classList.add('hidden'); $('credits').classList.remove('hidden'); };

    document.querySelectorAll('[data-back]').forEach(b=>{
      b.onclick = ()=>{ Audio.uiBack(); b.closest('.screen').classList.add('hidden'); $('menu').classList.remove('hidden'); };
    });

    // ---- pause ----
    $('btn-resume').onclick = ()=>{ Audio.uiSelect(); Game.resume(); };
    $('btn-restart-chapter').onclick = ()=>{ Audio.uiSelect(); $('pause').classList.add('hidden'); Game.retryChapter(); };
    $('btn-quit').onclick = ()=>{ Audio.uiBack(); Game.quitToMenu(); };

    // ---- death ----
    $('btn-retry').onclick = ()=>{ Audio.uiSelect(); Game.retryChapter(); };
    $('btn-death-menu').onclick = ()=>{ Audio.uiBack(); $('death').classList.add('hidden'); Game.quitToMenu(); };

    // ---- win ----
    $('btn-win-menu').onclick = ()=>{ Audio.uiSelect(); $('win').classList.add('hidden'); Game.quitToMenu(); };

    // ---- cutscene ----
    $('cutscene-skip').onclick = (e)=>{ e.stopPropagation(); Audio.uiBack(); Game.cutsceneSkip(); };
    $('cutscene').onclick = ()=>{ if (Game.mode==='cutscene') Game.cutsceneNext(); };

    // ---- note reader ----
    $('note-close').onclick = ()=>{ Audio.uiBack(); Game.closeNote(); };

    // ---- overlay close buttons ----
    $('inventory').querySelector('[data-close-overlay]').onclick = ()=>{ Audio.uiBack(); Game.closeInventory(); };
    $('journal').querySelector('[data-close-overlay]').onclick = ()=>{ Audio.uiBack(); Game.closeJournal(); };

    // ---- global keys for overlays (loop is paused while blocking) ----
    window.addEventListener('keydown', (e)=>{
      // note reader
      if (!$('note-reader').classList.contains('hidden')){
        if (e.code==='KeyE'||e.code==='Escape'||e.code==='Space'){ e.preventDefault(); Game.closeNote(); }
        return;
      }
      if (!$('inventory').classList.contains('hidden')){
        if (e.code==='KeyI'||e.code==='Escape'){ e.preventDefault(); Game.closeInventory(); }
        return;
      }
      if (!$('journal').classList.contains('hidden')){
        if (e.code==='KeyJ'||e.code==='Escape'){ e.preventDefault(); Game.closeJournal(); }
        return;
      }
      if (!$('keypad').classList.contains('hidden')){
        if (e.code==='Escape'){ e.preventDefault(); Puzzles.close(); Game.blocking=false; }
        return;
      }
      if (!$('puzzle').classList.contains('hidden')){
        if (e.code==='Escape'){ e.preventDefault(); Puzzles.close(); Game.blocking=false; }
        return;
      }
      // cutscene advance with space/enter
      if (Game.mode==='cutscene' && (e.code==='Space'||e.code==='Enter')){ e.preventDefault(); Game.cutsceneNext(); }
    });
  });
})();
