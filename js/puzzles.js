/* ============================================================
   BLACKWOOD — Interactive puzzles (DOM driven)
   Each opener wires up the relevant overlay and, on success,
   calls game.solvePuzzle(puzzle) which applies onSolve actions.
   ============================================================ */
const Puzzles = (() => {
  let active = null;       // {puzzle, game, type}

  function close() {
    document.getElementById('keypad').classList.add('hidden');
    document.getElementById('puzzle').classList.add('hidden');
    active = null;
    if (typeof Game !== 'undefined') Game.blocking = false;
  }
  function isOpen(){ return !!active; }

  function open(puzzle, game) {
    if (puzzle.solved) { game.toast("Déjà résolu."); return; }
    active = { puzzle, game, type: puzzle.type };
    switch (puzzle.type) {
      case 'keypad':  return openKeypad(puzzle, game);
      case 'valves':  return openValves(puzzle, game);
      case 'fusebox': return openFusebox(puzzle, game);
      case 'altar':   return openAltar(puzzle, game);
      case 'crank':   return openCrank(puzzle, game);
    }
  }

  function success(puzzle, game) {
    close();
    game.solvePuzzle(puzzle);
  }

  // ---------------- KEYPAD ----------------
  function openKeypad(puzzle, game) {
    const scr = document.getElementById('keypad');
    const disp = document.getElementById('keypad-display');
    const grid = document.getElementById('keypad-grid');
    document.getElementById('keypad-title').textContent = puzzle.label || "Clavier à code";
    let entry = "";
    const render = () => { disp.textContent = (entry + "----").slice(0,4).replace(/[^0-9]/g,'-'); };
    render();
    grid.innerHTML = "";
    const layout = ['1','2','3','4','5','6','7','8','9','C','0','OK'];
    layout.forEach(ch => {
      const b = document.createElement('button');
      b.className = 'kp-btn' + (ch==='OK'?' ok':'') + (ch==='C'?' del':'');
      b.textContent = ch;
      b.onclick = () => {
        Audio.uiSelect();
        if (ch === 'C') { entry = ""; }
        else if (ch === 'OK') {
          if (entry === puzzle.code) { Audio.keypadOk(); success(puzzle, game); return; }
          else { Audio.keypadErr(); disp.textContent = "ERR "; entry=""; setTimeout(render,500); return; }
        } else if (entry.length < 4) { entry += ch; }
        render();
      };
      grid.appendChild(b);
    });
    document.getElementById('keypad-close').onclick = () => { Audio.uiBack(); close(); };
    scr.classList.remove('hidden');
  }

  // ---------------- VALVES ----------------
  function openValves(puzzle, game) {
    const scr = document.getElementById('puzzle');
    const host = document.getElementById('puzzle-host');
    const colors = ['off','blue','red','green'];
    const colMap = { off:'#444', blue:'#2f6fae', red:'#b62f2f', green:'#3f9f3f' };
    const colName = { off:'—', blue:'BLEU', red:'ROUGE', green:'VERT' };
    let state = ['off','off','off'];
    host.innerHTML = `<h2>${puzzle.label}</h2>
      <p class="hint-small">Réglez les trois vannes dans le bon ordre, puis validez.</p>
      <div class="row" id="valverow"></div>
      <div class="row"><button id="valve-go">Valider</button>
      <button id="valve-cancel" class="back-btn">Annuler</button></div>`;
    const row = host.querySelector('#valverow');
    const labels = ['ENTRÉE','PURGE','SORTIE'];
    function draw(){
      row.innerHTML = "";
      state.forEach((c,i)=>{
        const wrap = document.createElement('div'); wrap.className='valve';
        const knob = document.createElement('div'); knob.className='knob';
        knob.style.borderColor = colMap[c];
        knob.style.color = colMap[c];
        knob.textContent = colName[c];
        knob.style.transform = `rotate(${colors.indexOf(c)*90}deg)`;
        knob.onclick = ()=>{ Audio.uiSelect(); const idx=(colors.indexOf(c)+1)%colors.length; state[i]=colors[idx]; draw(); };
        const lbl = document.createElement('div'); lbl.className='lbl'; lbl.textContent=labels[i];
        wrap.appendChild(knob); wrap.appendChild(lbl); row.appendChild(wrap);
      });
    }
    draw();
    host.querySelector('#valve-go').onclick = ()=>{
      if (state.join(',') === puzzle.solution.join(',')) { Audio.keypadOk(); success(puzzle, game); }
      else { Audio.keypadErr(); game.toast("Les tuyaux gémissent. Mauvais ordre.", 'bad'); }
    };
    host.querySelector('#valve-cancel').onclick = ()=>{ Audio.uiBack(); close(); };
    scr.classList.remove('hidden');
  }

  // ---------------- FUSEBOX ----------------
  function openFusebox(puzzle, game) {
    const scr = document.getElementById('puzzle');
    const host = document.getElementById('puzzle-host');
    const need = puzzle.needFuses || 3;
    let placed = 0;
    function draw(){
      const have = game.inv.count('fuse');
      let slots = "";
      for (let i=0;i<need;i++) slots += `<div class="fuse-slot ${i<placed?'filled':''}" data-slot="${i}">${i<placed?'⚡':''}</div>`;
      host.innerHTML = `<h2>${puzzle.label}</h2>
        <p class="hint-small">Fusibles en poche : ${have}. Insérez-en ${need}, puis tirez le levier.</p>
        <div class="row">${slots}</div>
        <div class="row">
          <button id="fuse-lever" ${placed<need?'disabled':''}>🔴 Tirer le levier</button>
          <button id="fuse-cancel" class="back-btn">Reculer</button>
        </div>`;
      host.querySelectorAll('.fuse-slot').forEach(el=>{
        el.onclick = ()=>{
          if (parseInt(el.dataset.slot) === placed && game.inv.count('fuse')>0) {
            game.inv.remove('fuse',1); placed++; Audio.uiSelect(); draw();
          } else if (game.inv.count('fuse')===0 && parseInt(el.dataset.slot)>=placed) {
            game.toast("Plus de fusibles. Cherchez-en d'autres.", 'bad'); Audio.keypadErr();
          }
        };
      });
      host.querySelector('#fuse-lever').onclick = ()=>{ if(placed>=need){ Audio.keypadOk(); success(puzzle, game);} };
      host.querySelector('#fuse-cancel').onclick = ()=>{ Audio.uiBack(); close(); };
    }
    draw();
    scr.classList.remove('hidden');
  }

  // ---------------- ALTAR (symbol order) ----------------
  function openAltar(puzzle, game) {
    const scr = document.getElementById('puzzle');
    const host = document.getElementById('puzzle-host');
    const symbols = ['👁️','🔥','✝️','✋']; // 1=oeil,2=flamme,3=croix,4=main
    let order = [];
    function draw(){
      host.innerHTML = `<h2>${puzzle.label}</h2>
        <p class="hint-small">Touchez les symboles dans l'ordre du sermon.</p>
        <div class="row" id="symrow"></div>
        <div class="row"><b style="letter-spacing:6px">${order.map(i=>symbols[i-1]).join(' ') || '· · · ·'}</b></div>
        <div class="row"><button id="alt-reset" class="back-btn">Effacer</button>
        <button id="alt-cancel" class="back-btn">Annuler</button></div>`;
      const r = host.querySelector('#symrow');
      symbols.forEach((s,i)=>{
        const b=document.createElement('button'); b.className='sym-btn'; b.textContent=s;
        b.onclick=()=>{
          Audio.uiSelect(); order.push(i+1);
          if (order.length === puzzle.solution.length) {
            if (order.join(',')===puzzle.solution.join(',')) { Audio.keypadOk(); success(puzzle, game); }
            else { Audio.keypadErr(); game.toast("Les symboles s'éteignent. Recommencez.", 'bad'); order=[]; draw(); }
          } else draw();
        };
        r.appendChild(b);
      });
      host.querySelector('#alt-reset').onclick=()=>{ order=[]; Audio.uiBack(); draw(); };
      host.querySelector('#alt-cancel').onclick=()=>{ Audio.uiBack(); close(); };
    }
    draw();
    scr.classList.remove('hidden');
  }

  // ---------------- CRANK (mash to fill) ----------------
  function openCrank(puzzle, game) {
    if (puzzle.needItem && !game.inv.has(puzzle.needItem)) {
      game.toast("Il manque " + itemDef(puzzle.needItem).name + ".", 'bad');
      Audio.doorLocked(); active=null; return;
    }
    const scr = document.getElementById('puzzle');
    const host = document.getElementById('puzzle-host');
    let prog = 0;
    host.innerHTML = `<h2>${puzzle.label}</h2>
      <p class="hint-small">Cliquez frénétiquement sur la manivelle pour la tourner !</p>
      <div class="progress-wrap"><div class="progress-bar" id="cr-bar"></div></div>
      <div class="row"><button id="cr-turn" style="font-size:28px">🔧 TOURNER</button></div>
      <div class="row"><button id="cr-cancel" class="back-btn">Annuler</button></div>`;
    const bar = host.querySelector('#cr-bar');
    host.querySelector('#cr-turn').onclick = ()=>{
      prog = Math.min(100, prog + 9); bar.style.width = prog + '%';
      Audio.footstep(false);
      if (prog >= 100) { Audio.keypadOk(); success(puzzle, game); }
    };
    host.querySelector('#cr-cancel').onclick = ()=>{ Audio.uiBack(); close(); };
    // crank slowly drains if you stop
    const drain = setInterval(()=>{ if(!active){clearInterval(drain);return;} prog=Math.max(0,prog-3); if(bar)bar.style.width=prog+'%'; }, 350);
    scr.classList.remove('hidden');
  }

  return { open, close, isOpen };
})();
