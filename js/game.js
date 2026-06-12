/* ============================================================
   BLACKWOOD — Core game: state, loop, rendering, interaction
   ============================================================ */

class Inventory {
  constructor(){ this.items = {}; }
  add(id,c=1){ this.items[id]=(this.items[id]||0)+c; }
  remove(id,c=1){ if(this.items[id]){ this.items[id]-=c; if(this.items[id]<=0) delete this.items[id]; } }
  has(id){ return !!this.items[id]; }
  count(id){ return this.items[id]||0; }
  list(){ return Object.keys(this.items).map(id=>({id,count:this.items[id]})); }
  serialize(){ return Object.assign({}, this.items); }
  load(o){ this.items = Object.assign({}, o||{}); }
}

const USABLES = ['medkit','pills','battery','scalpel','match'];

const Game = (() => {
  let canvas, ctx;
  const cam = { ox:0, oy:0, scale:24 };

  const state = {
    mode: 'menu',          // menu | cutscene | playing | dead | win
    chapterIndex: 0,
    flags: {},
    sanity: 100,
    battery: 100,
    inv: new Inventory(),
    journal: [],           // [{id,unread}]
    notesFound: 0,
    playtime: 0,
  };

  let map = null, player = null, monster = null;
  let flashlightOn = true;
  let lastTime = 0, running = false;
  let blocking = false;     // an overlay (inv/journal/note/puzzle) is open
  let hideLocker = null;
  let chapterStartSnap = null;
  let matchTimer = 0;       // temporary light from a match
  let hallTimer = 6;        // hallucination scheduler
  let lowBatWarn = 0;
  let exitHintTimer = 0;
  let deaths = 0;
  let advancing = false;
  // --- fear & polish state ---
  let shake = 0;              // screen shake magnitude (px)
  let flickerSmooth = 1;      // flashlight stability 0..1
  let flickerHold = 0;        // forced flicker burst (s)
  let ambientTimer = 14;      // next ambient scare event
  let stalker = null;         // fleeting silhouette {x,y,life}
  let stalkerTimer = 22;
  let particles = null;       // dust motes in the beam
  let caughtLock = false;     // prevents double-death
  let sanityFilterStep = -1;  // cached css filter bucket
  let screamerCD = 18;        // cooldown before next random screamer
  let pendingScare = 0;       // >0 = riser armed, counting down to the bang
  let behindCD = 0;           // cooldown for "breath behind you"

  // ---------- setup ----------
  function init(cv){
    canvas = cv; ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }
  function resize(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cam.scale = Math.max(20, Math.floor(Math.min(canvas.width/22, canvas.height/15)));
  }

  // ---------- chapter flow ----------
  function newGame(){
    state.chapterIndex = 0;
    state.flags = {};
    state.sanity = 100;
    state.battery = 100;
    state.inv = new Inventory();
    state.journal = [];
    state.notesFound = 0;
    state.playtime = 0;
    deaths = 0;
    enterChapter(0, true);
  }

  function continueGame(){
    const s = Save.read();
    if (!s) { newGame(); return; }
    state.chapterIndex = s.chapterIndex||0;
    state.flags = {};                 // flags reset per chapter checkpoint
    state.sanity = s.sanity!=null ? s.sanity : 100;
    state.battery = s.battery!=null ? s.battery : 100;
    state.inv = new Inventory(); state.inv.load(s.inv);
    state.journal = s.journal||[];
    state.notesFound = s.notesFound||0;
    state.playtime = s.playtime||0;
    deaths = s.deaths||0;
    enterChapter(state.chapterIndex, true);
  }

  function saveCheckpoint(){
    Save.write({
      chapterIndex: state.chapterIndex,
      sanity: state.sanity,
      battery: state.battery,
      inv: state.inv.serialize(),
      journal: state.journal,
      notesFound: state.notesFound,
      playtime: state.playtime,
      deaths,
      ts: Date.now()
    });
  }

  function enterChapter(i, showIntro){
    state.chapterIndex = i;
    state.flags = {};
    map = buildChapter(i);
    Lighting.init(map.W, map.H);
    Lighting.resetExplored();
    player = new Player(map.playerStart.x, map.playerStart.y, map.playerStart.facing);
    monster = map.monster ? new Monster(map.monster.x, map.monster.y, map.monster) : null;
    flashlightOn = true;
    hideLocker = null; blocking = false; matchTimer = 0;
    shake = 0; flickerSmooth = 1; flickerHold = 0;
    ambientTimer = 10 + Math.random()*10;
    stalker = null; stalkerTimer = 16 + Math.random()*14;
    particles = null; caughtLock = false;
    screamerCD = 16 + Math.random()*14; pendingScare = 0; behindCD = 0;
    sanityFilterStep = -1; canvas.style.filter = '';
    // snapshot for retry
    chapterStartSnap = {
      sanity: state.sanity, battery: state.battery,
      inv: state.inv.serialize(), journal: JSON.parse(JSON.stringify(state.journal)),
      notesFound: state.notesFound
    };
    saveCheckpoint();
    UI.setObjective(map.objective);
    UI.setChapter(map.name);
    Audio.setDread(map.dread);
    if (showIntro) playCutscene(map.intro, ()=> startPlaying());
    else startPlaying();
  }

  function retryChapter(){
    deaths++;
    // restore snapshot
    state.sanity = chapterStartSnap.sanity;
    state.battery = chapterStartSnap.battery;
    state.inv.load(chapterStartSnap.inv);
    state.journal = JSON.parse(JSON.stringify(chapterStartSnap.journal));
    state.notesFound = chapterStartSnap.notesFound;
    UI.hide('death');
    enterChapter(state.chapterIndex, false);
  }

  function startPlaying(){
    state.mode = 'playing';
    advancing = false;
    UI.showHUD(true);
    document.querySelectorAll('.screen').forEach(s=>{ if(s.id!=='') s.classList.add('hidden'); });
    UI.hide('cutscene');
    if (!running){ running = true; lastTime = performance.now(); requestAnimationFrame(loop); }
  }

  function nextChapter(){
    if (advancing) return;
    advancing = true;
    state.mode = 'cutscene';      // freeze sim during transition
    if (state.chapterIndex+1 >= CHAPTER_COUNT){ winGame(); return; }
    UI.blink(()=>{
      enterChapter(state.chapterIndex+1, true);
    });
  }

  function winGame(){
    state.mode = 'win';
    Save.clear();
    UI.showHUD(false);
    const mins = Math.floor(state.playtime/60), secs = Math.floor(state.playtime%60);
    document.getElementById('win-stats').innerHTML =
      `Vous avez fui l'Institut Blackwood.<br><br>`+
      `Temps de survie : ${mins} min ${secs} s<br>`+
      `Documents trouvés : ${state.notesFound} / ${countAllNotes()}<br>`+
      `Morts : ${deaths}<br><br>`+
      `<span class="hint-small">Mais dans le rétroviseur, l'hôpital est toujours éclairé...</span>`;
    UI.show('win');
  }

  function countAllNotes(){ return Object.keys(NOTES).length; }

  // ---------- cutscene ----------
  let cutLines = [], cutIdx = 0, cutCb = null;
  function playCutscene(lines, cb){
    state.mode = 'cutscene';
    UI.showHUD(false);
    cutLines = lines.slice(); cutIdx = 0; cutCb = cb;
    document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
    UI.show('cutscene');
    showCutLine();
  }
  function showCutLine(){
    const el = document.getElementById('cutscene-text');
    el.style.opacity = 0;
    el.textContent = cutLines[cutIdx] || "";
    requestAnimationFrame(()=>{ el.style.transition='opacity 1s'; el.style.opacity=1; });
  }
  function cutsceneNext(){
    cutIdx++;
    if (cutIdx >= cutLines.length){ UI.hide('cutscene'); const cb=cutCb; cutCb=null; if(cb) cb(); }
    else { Audio.uiMove(); showCutLine(); }
  }
  function cutsceneSkip(){ UI.hide('cutscene'); const cb=cutCb; cutCb=null; if(cb) cb(); }

  // ---------- main loop ----------
  function loop(ts){
    if (!running) return;
    let dt = (ts - lastTime)/1000; lastTime = ts;
    if (dt > 0.1) dt = 0.1;
    if (state.mode === 'playing' && !blocking){
      update(dt);
    }
    render();
    Input.endFrame();
    requestAnimationFrame(loop);
  }

  // ---------- update ----------
  function update(dt){
    state.playtime += dt;
    updateCam();

    // global hotkeys
    if (Input.consume('Escape')){ pause(); return; }
    if (Input.consume('KeyI')){ openInventory(); return; }
    if (Input.consume('KeyJ')){ openJournal(); return; }
    if (Input.consume('KeyF')){ toggleFlashlight(); }
    if (Input.consume('Space')){ toggleHide(); }
    for (let n=1;n<=6;n++){ if (Input.consume('Digit'+n)) useSlot(n-1); }

    if (player.hidden){
      // limited update while hiding
      computeLighting();
      if (Input.consume('KeyE')) {} // nothing
      doInteractionPrompt();
      if (monster) monster.update(dt, gameApi);
      updateMeters(dt);
      return;
    }

    player.update(dt, gameApi);
    if (monster) monster.update(dt, gameApi);

    // interaction
    const focus = getFocus();
    if (focus) UI.prompt(focus.prompt); else UI.prompt(null);
    if (Input.consume('KeyE') && focus) doInteract(focus);

    // monster auto-open doors it walks into
    if (monster) autoOpenDoorsFor(monster);

    computeLighting();
    triggersUpdate();
    updateMeters(dt);
    checkExit();
    hallucinations(dt);
    fearUpdate(dt);
  }

  // fire a full screamer right now (mid-gameplay jolt, not a death)
  const SCARE_LINES = [
    "QUELQUE CHOSE A HURLÉ DANS VOTRE OREILLE.",
    "Un visage. Juste devant le vôtre. Puis plus rien.",
    "Vous n'êtes pas seul. Vous ne l'avez jamais été.",
    "IL VOUS A SOURI.",
  ];
  function doScreamer(opts={}){
    UI.screamer(opts.dur||500, opts.variant);
    Audio.screamer();
    shake = Math.max(shake, opts.shake||24);
    flickerHold = Math.max(flickerHold, 0.9);
    state.sanity = Math.max(0, state.sanity - (opts.sanity!=null?opts.sanity:10));
    if (opts.text!==null)
      UI.subtitle(opts.text || SCARE_LINES[Math.floor(Math.random()*SCARE_LINES.length)], 2200);
    screamerCD = (opts.cd!=null?opts.cd : (24 + Math.random()*22));
  }
  function armScare(){
    Audio.holdBreath(); Audio.riser(0.9);
    pendingScare = 0.92; screamerCD = 999;  // held until it fires
  }

  // ---------- fear systems: flicker, ambient events, stalker ----------
  function fearUpdate(dt){
    // flashlight flicker — worse when IT is near
    const near = monster && map.monster && map.monster.enabled
      ? Math.hypot(player.x-monster.x, player.y-monster.y) : 99;

    // ===== screamer scheduler =====
    screamerCD -= dt;
    if (pendingScare > 0){
      pendingScare -= dt;
      if (pendingScare <= 0) doScreamer();
    } else if (screamerCD <= 0){
      const tension = (1 - state.sanity/100) + (near < 11 ? 0.6 : 0) + map.dread*0.5;
      if (Math.random() < dt * (0.05 + 0.12*tension)) armScare();
    }

    // ===== breath right behind you =====
    behindCD -= dt;
    if (behindCD <= 0 && near < 3.8 && monster.state!=='repelled'){
      // is it behind the way you're facing?
      const ang = Math.atan2(monster.y-player.y, monster.x-player.x);
      let diff = Math.abs(((ang - player.facing + Math.PI)%(Math.PI*2)) - Math.PI);
      if (diff > 1.9){ // it's behind you and you can't see it
        Audio.breath(); shake = Math.max(shake, 3); behindCD = 6 + Math.random()*4;
        if (Math.random() < 0.4) doScreamer({dur:340, sanity:6, text:"Un souffle chaud. Juste derrière votre nuque.", cd:20});
        else UI.subtitle("Vous sentez une respiration dans votre dos...", 1800);
      }
    }
    let target = 1;
    if (flickerHold > 0){ flickerHold -= dt; target = 0.25 + Math.random()*0.5; }
    else if (near < 8 && flashlightActive()){
      target = 0.45 + Math.random()*0.55;
      if (Math.random() < dt*1.5) Audio.buzz();
    }
    else if (state.battery < 15 && flashlightOn){ target = 0.6 + Math.random()*0.4; }
    else if (Math.random() < dt*0.25){ target = 0.7; } // occasional idle blink
    flickerSmooth += (target - flickerSmooth) * Math.min(1, dt*14);

    // screen shake decay (+ constant rumble while chased up close)
    shake = Math.max(0, shake - dt*26);
    if (monster && monster.state==='chase' && near < 5) shake = Math.max(shake, 2);

    // ambient one-shot scares
    ambientTimer -= dt;
    if (ambientTimer <= 0){
      ambientTimer = 16 + Math.random()*16;
      const roll = Math.random();
      if (state.inv.has('doll') && roll < 0.25){
        Audio.giggle();
        UI.subtitle("Un rire d'enfant. Tout près. La poupée est tiède dans votre sac.", 2600);
        state.sanity = Math.max(0, state.sanity - 3);
      } else if (roll < 0.4){
        Audio.slam(); shake = Math.max(shake, 7);
        UI.subtitle("Une porte claque, quelque part dans le bâtiment.", 2200);
      } else if (roll < 0.6){
        Audio.growl(0.95);
      } else if (roll < 0.78){
        Audio.whisper();
      } else {
        // the light dies for a moment
        flickerHold = 1.2; Audio.buzz();
      }
    }

    // stalker apparition — a silhouette at the edge of your beam
    stalkerTimer -= dt;
    if (!stalker && stalkerTimer <= 0 && !player.hidden){
      stalkerTimer = 20 + Math.random()*18;
      const a = player.facing + (Math.random()-0.5)*0.7;
      const d = 5.5 + Math.random()*2;
      const sx = player.x + Math.cos(a)*d, sy = player.y + Math.sin(a)*d;
      const tx = Math.floor(sx), ty = Math.floor(sy);
      if (!isWall(tx,ty)){
        stalker = { x:sx, y:sy, life: 0.9 };
        Audio.whisper();
      }
    }
    if (stalker){
      stalker.life -= dt;
      if (stalker.life <= 0){
        stalker = null;
        if (Math.random() < 0.45 && screamerCD < 900){
          // the silhouette lunges at the screen
          doScreamer({dur:380, sanity:7, text:"Elle s'est jetée sur vous. Le faisceau n'éclaire que le mur.", cd:18});
        } else {
          Audio.stinger(0.35); shake = Math.max(shake, 5);
          state.sanity = Math.max(0, state.sanity - 4);
          if (Math.random()<0.5) UI.subtitle("Il y avait quelqu'un. Il n'y a plus personne.", 2000);
        }
      }
    }

    // dust motes drifting in the dark
    if (!particles){
      particles = [];
      for (let i=0;i<46;i++) particles.push({
        x: player.x + (Math.random()-0.5)*16,
        y: player.y + (Math.random()-0.5)*16,
        vx: (Math.random()-0.5)*0.12, vy: (Math.random()-0.5)*0.12,
        s: 0.5 + Math.random()*1.2,
      });
    }
    particles.forEach(p=>{
      p.x += p.vx*dt; p.y += p.vy*dt;
      if (Math.abs(p.x-player.x)>9 || Math.abs(p.y-player.y)>9){
        const a=Math.random()*Math.PI*2, d=4+Math.random()*4;
        p.x = player.x+Math.cos(a)*d; p.y = player.y+Math.sin(a)*d;
      }
    });
  }

  function updateCam(){
    cam.ox = canvas.width/2 - player.x*cam.scale;
    cam.oy = canvas.height/2 - player.y*cam.scale;
  }

  // ---------- lighting & sanity ----------
  function flashlightActive(){ return (flashlightOn && state.battery>0) || matchTimer>0; }

  function computeLighting(){
    const sanF = 0.55 + 0.45*(state.sanity/100);
    const range = (matchTimer>0 ? 5 : 9) * (0.55 + 0.45*flickerSmooth);
    Lighting.compute(player.x, player.y, player.facing,
      flashlightActive(), 0.62, range, 2.6, sanF,
      (x,y)=>isWall(x,y));
  }

  function lightOnPlayer(){ return Lighting.lightAt(player.tileX(), player.tileY()); }
  // psychologically, only a real light source (torch / match) keeps the mind lucid
  function inDarkness(){ return !flashlightActive(); }

  function updateMeters(dt){
    // battery
    if (flashlightOn && state.battery>0 && matchTimer<=0){
      state.battery = Math.max(0, state.battery - dt*2.4);
      if (state.battery<15){ lowBatWarn-=dt; if(lowBatWarn<=0){ Audio.batteryLow(); lowBatWarn=1.2; } }
      if (state.battery<=0){ flashlightOn=false; UI.toast("La lampe s'éteint. Vous êtes dans le noir.", 'bad'); }
    }
    if (matchTimer>0){ matchTimer-=dt; if(matchTimer<=0) UI.toast("L'allumette s'éteint.", 'bad'); }

    // sanity
    let dread = map.dread;
    let near = monster ? Math.hypot(player.x-monster.x, player.y-monster.y) : 99;
    let chasing = monster && (monster.state==='chase'||monster.enraged && near<8);
    if (inDarkness()){
      // the dark in your own head erodes you
      state.sanity = Math.max(0, state.sanity - dt*(2.0 + dread*3));
    } else {
      state.sanity = Math.min(100, state.sanity + dt*1.2);
    }
    if (near < 6){ state.sanity = Math.max(0, state.sanity - dt*(6-near)*1.4); }
    Audio.setBreathing(state.sanity < 35);

    // heartbeat scales with threat
    let hr = 0;
    if (near < 9 || chasing) hr = 70 + (9-Math.min(9,near))*9 + (chasing?30:0);
    else if (state.sanity < 30) hr = 60;
    Audio.heartbeat(hr);
    Audio.setDread(Math.min(1, dread + (chasing?0.4:0) + (1-state.sanity/100)*0.3));

    // sanity death (mind breaks)
    if (state.sanity <= 0){ onSanityBreak(); }

    UI.meters(state.sanity/100, state.battery/100, player.stamina);
    UI.vignette(Math.min(1, dread*0.5 + (1-state.sanity/100)*0.7 + (chasing?0.3:0)));
    refreshHotbar();

    // madness distorts the image itself (bucketed to avoid style churn)
    const step = state.sanity >= 40 ? 0 : Math.ceil((40-state.sanity)/8);
    if (step !== sanityFilterStep){
      sanityFilterStep = step;
      canvas.style.filter = step === 0 ? '' :
        `contrast(${1+step*0.07}) saturate(${Math.max(0.4,1-step*0.12)}) hue-rotate(-${step*4}deg)`;
    }
  }

  function onSanityBreak(){
    Audio.scream();
    die("Votre esprit a cédé dans l'obscurité. Vous ne vous êtes jamais relevé.");
  }

  // ---------- hallucinations (low sanity) ----------
  let hallGhost = null;
  function hallucinations(dt){
    if (state.sanity > 35){ hallGhost=null; return; }
    hallTimer -= dt;
    if (hallTimer <= 0){
      hallTimer = 3 + Math.random()*5;
      const r = Math.random();
      if (r < 0.5){ Audio.whisper(); UI.subtitle(["Daniel...","reste avec nous","il a faim","derrière toi"][Math.floor(Math.random()*4)], 1800); }
      else { // fleeting ghost
        const ang = Math.random()*Math.PI*2;
        hallGhost = { x: player.x+Math.cos(ang)*4, y: player.y+Math.sin(ang)*4, t: 0.6 };
        Audio.stinger(0.4); UI.damageFlash();
      }
    }
    if (hallGhost){ hallGhost.t -= dt; if (hallGhost.t<=0) hallGhost=null; }
  }

  // ---------- collision ----------
  function isWall(tx,ty){
    if (tx<0||ty<0||tx>=map.W||ty>=map.H) return true;
    if (map.grid[ty][tx]===0) return true;
    const d = map.doors[tx+","+ty];
    if (d && !d.open) return true;
    return false;
  }
  function blockedAt(px,py){ return isWall(Math.floor(px), Math.floor(py)); }
  function canWalk(x,y,r){
    return !blockedAt(x,y) && !blockedAt(x+r,y) && !blockedAt(x-r,y) &&
           !blockedAt(x,y+r) && !blockedAt(x,y-r);
  }
  function isWallForMonster(tx,ty){
    if (tx<0||ty<0||tx>=map.W||ty>=map.H) return true;
    if (map.grid[ty][tx]===0) return true;
    const d = map.doors[tx+","+ty];
    if (d && d.locked && !d.open) return true;   // locked blocks monster
    return false;
  }
  function canMonsterWalk(x,y){
    const tx=Math.floor(x), ty=Math.floor(y);
    return !isWallForMonster(tx,ty);
  }
  function gridForPath(){ return map.grid; }

  function autoOpenDoorsFor(ent){
    const tx=Math.floor(ent.x), ty=Math.floor(ent.y);
    for (const dx of [-1,0,1]) for (const dy of [-1,0,1]){
      const key=(tx+dx)+","+(ty+dy); const d=map.doors[key];
      if (d && !d.open && !d.locked){
        const cx=tx+dx+0.5, cy=ty+dy+0.5;
        if (Math.hypot(ent.x-cx,ent.y-cy)<0.9){ d.open=true; Audio.doorOpen(); }
      }
    }
  }

  // ---------- interaction ----------
  function getFocus(){
    let best=null, bestD=1.6;
    const consider=(type,ref,x,y,prompt)=>{
      const d=Math.hypot(player.x-(x+0.5), player.y-(y+0.5));
      if (d<bestD){ best={type,ref,prompt,d}; bestD=d; }
    };
    map.items.forEach(it=>{ if(!it.taken) consider('item',it,it.x,it.y,`[E] Ramasser <b>${itemDef(it.id).name}</b>`); });
    map.notes.forEach(nt=>{ consider('note',nt,nt.x,nt.y,`[E] Lire le document`); });
    map.puzzles.forEach(pz=>{ if(!pz.solved) consider('puzzle',pz,pz.x,pz.y,`[E] ${pz.prompt}`); });
    for (const key in map.doors){
      const d=map.doors[key]; if(d.open) continue;
      const [dx,dy]=key.split(',').map(Number);
      let prompt;
      if (d.locked){
        if (d.key && state.inv.has(d.key)) prompt=`[E] Déverrouiller — ${d.label}`;
        else prompt=`[E] 🔒 ${d.label}`;
      } else prompt=`[E] Ouvrir — ${d.label}`;
      consider('door',{key,d,dx,dy},dx,dy,prompt);
    }
    if (map.exit){
      const reqOK = !map.exit.requires || map.exit.requires(state);
      consider('exit',map.exit,map.exit.x,map.exit.y, reqOK?`[E] Continuer ▸`:`[E] Verrouillé — objectif incomplet`);
    }
    return best;
  }

  function doInteract(focus){
    switch(focus.type){
      case 'item': pickupItem(focus.ref); break;
      case 'note': readNote(focus.ref); break;
      case 'puzzle': Puzzles.open(focus.ref, gameApi); blocking = Puzzles.isOpen(); break;
      case 'door': interactDoor(focus.ref); break;
      case 'exit': tryExit(); break;
    }
  }

  function pickupItem(it){
    it.taken = true;
    state.inv.add(it.id, it.count);
    Audio.pickup();
    UI.toast(`Ramassé : ${itemDef(it.id).name}${it.count>1?' ×'+it.count:''}`, 'good');
    if (it.note){ readNote({id:it.note, _temp:true}); }
    refreshHotbar();
  }

  function readNote(nt){
    if (!nt._temp){ addJournal(nt.id); }
    else addJournal(nt.id);
    blocking = true;
    UI.openNote(nt.id);
  }
  function addJournal(id){
    if (!state.journal.find(e=>e.id===id)){
      state.journal.push({id, unread:true});
      state.notesFound++;
    }
  }
  function closeNote(){ UI.closeNote(); blocking=false; }

  function interactDoor(ref){
    const d=ref.d;
    if (d.locked){
      if (d.key && state.inv.has(d.key)){
        d.locked=false; d.open=true; Audio.doorOpen();
        UI.toast(`Déverrouillé avec ${itemDef(d.key).name}.`, 'good');
      } else { Audio.doorLocked(); UI.toast("Verrouillé. Il vous faut une clé.", 'bad'); }
    } else { d.open=true; Audio.doorOpen(); }
  }

  function tryExit(){
    const ex=map.exit;
    if (!ex.requires || ex.requires(state)){
      UI.toast("Vous progressez plus profond...", 'good');
      nextChapter();
    } else {
      Audio.doorLocked();
      UI.toast("Vous ne pouvez pas partir : l'objectif n'est pas terminé.", 'bad');
    }
  }

  function doInteractionPrompt(){
    // while hidden show exit prompt
    UI.prompt(player.hidden ? `[Espace] Sortir de la cachette` : null);
  }

  // ---------- hiding ----------
  function toggleHide(){
    if (player.hidden){
      player.hidden=false; hideLocker.occupied=false; hideLocker=null;
      Audio.lockerHide(); UI.prompt(null);
      return;
    }
    // find nearby locker
    let near=null, nd=1.3;
    map.lockers.forEach(l=>{ const d=Math.hypot(player.x-(l.x+0.5),player.y-(l.y+0.5)); if(d<nd){near=l;nd=d;} });
    if (near){
      player.hidden=true; hideLocker=near; near.occupied=true;
      player.x=near.x+0.5; player.y=near.y+0.5;
      Audio.lockerHide(); UI.toast("Vous retenez votre souffle.", '');
    }
  }

  // ---------- flashlight & items ----------
  function toggleFlashlight(){
    if (state.battery<=0 && matchTimer<=0){ UI.toast("Batterie morte. Trouvez une pile.", 'bad'); Audio.flashlightClick(); return; }
    flashlightOn=!flashlightOn; Audio.flashlightClick();
  }

  function hotbarSlots(){
    const slots=[];
    USABLES.forEach(id=>{ if(state.inv.has(id)) slots.push({id,count:state.inv.count(id)}); });
    while(slots.length<6) slots.push(null);
    return slots.slice(0,6);
  }
  function refreshHotbar(){ UI.hotbar(hotbarSlots()); }

  function useSlot(i){
    const slots=hotbarSlots(); const s=slots[i]; if(!s) return;
    useItem(s.id);
  }
  function useItem(id){
    switch(id){
      case 'medkit':
        if(state.sanity>=100){ UI.toast("Esprit déjà stable.",''); return; }
        state.inv.remove('medkit'); state.sanity=Math.min(100,state.sanity+40);
        Audio.pulse(); UI.toast("Vous reprenez vos esprits. (+40)", 'good'); break;
      case 'pills':
        if(state.sanity>=100){ UI.toast("Inutile pour l'instant.",''); return; }
        state.inv.remove('pills'); state.sanity=Math.min(100,state.sanity+20);
        Audio.pulse(); UI.toast("La panique reflue. (+20)", 'good'); break;
      case 'battery':
        if(state.battery>=100){ UI.toast("Lampe déjà chargée.",''); return; }
        state.inv.remove('battery'); state.battery=Math.min(100,state.battery+35);
        Audio.flashlightClick(); UI.toast("Pile insérée. (+35%)", 'good'); break;
      case 'match':
        state.inv.remove('match'); matchTimer=6; flashlightOn=false;
        Audio.flashlightClick(); UI.toast("Une allumette grésille...", ''); break;
      case 'scalpel':
        if (monster && Math.hypot(player.x-monster.x,player.y-monster.y)<1.8){
          state.inv.remove('scalpel');
          monster.spawnDelay=2.5; monster.state='investigate'; monster.investigateTimer=0;
          monster.x += (monster.x-player.x); monster.y += (monster.y-player.y);
          Audio.scream(); UI.damageFlash(); UI.toast("Vous le frappez ! Il recule en hurlant.", 'good');
        } else UI.toast("Rien à portée de lame.", '');
        break;
    }
    refreshHotbar();
  }

  // ---------- triggers & actions ----------
  function triggersUpdate(){
    map.triggers.forEach(tr=>{
      if (tr.fired) return;
      const d=Math.hypot(player.x-(tr.x+0.5), player.y-(tr.y+0.5));
      if (d<tr.r){ tr.fired=true; applyActions(tr.action); }
    });
  }

  function applyActions(list){
    if (!list) return;
    list.forEach(a=>{
      switch(a.type){
        case 'flag': state.flags[a.name]=true; break;
        case 'unlockDoor': { const d=map.doors[a.x+","+a.y]; if(d){ d.locked=false; d.open=true; } break; }
        case 'toast': UI.toast(a.text, a.kind); break;
        case 'subtitle': UI.subtitle(a.text); break;
        case 'stinger': Audio.stinger(a.intensity||1); UI.damageFlash(); shake = Math.max(shake, 6+8*(a.intensity||1)); break;
        case 'screamer': doScreamer({ dur:a.dur||560, sanity:a.sanity!=null?a.sanity:12, text:a.text!==undefined?a.text:undefined, shake:a.shake||26 }); break;
        case 'scrape': Audio.scrape(); break;
        case 'breath': Audio.breath(); break;
        case 'sound': if (Audio[a.name]) Audio[a.name](); break;
        case 'growl': Audio.growl(0.2); break;
        case 'sanity': state.sanity=Math.max(0,Math.min(100,state.sanity+(a.amount||0))); break;
        case 'give': state.inv.add(a.id, a.count||1); refreshHotbar(); UI.toast(`Obtenu : ${itemDef(a.id).name}`,'good'); break;
        case 'enrage': if(monster){ monster.enrage(); } break;
        case 'setObjective': map.objective=a.text; UI.setObjective(a.text); break;
      }
    });
  }

  function solvePuzzle(pz){
    pz.solved=true;
    blocking=false;
    applyActions(pz.onSolve);
  }

  function checkExit(){
    if (!map.exit) return;
    const ex=map.exit;
    const d=Math.hypot(player.x-(ex.x+0.5), player.y-(ex.y+0.5));
    if (d<0.6){
      if (!ex.requires || ex.requires(state)){ nextChapter(); }
      else { exitHintTimer-=0.016; if(exitHintTimer<=0){ UI.toast("Objectif incomplet.", 'bad'); exitHintTimer=2; } }
    }
  }

  // ---------- caught / death ----------
  function onCaught(){
    if (state.mode!=='playing' || caughtLock) return;
    caughtLock = true;
    state.mode = 'dying';           // freeze the simulation
    Audio.scream(); Audio.stinger(1);
    shake = 26;
    UI.showJumpscare();
    setTimeout(()=>{
      UI.hideJumpscare();
      die("Il vous a trouvé. Les bras se referment, et le noir vous avale.");
    }, 950);
  }
  function die(msg){
    state.mode='dead';
    UI.showHUD(false);
    Audio.heartbeat(0);
    document.getElementById('death-msg').textContent = msg;
    UI.blink(()=> UI.show('death'));
  }

  // ---------- pause ----------
  function pause(){
    if (state.mode!=='playing') return;
    state.mode='paused';
    UI.show('pause');
  }
  function resume(){
    if (state.mode!=='paused') return;
    UI.hide('pause'); state.mode='playing';
    lastTime = performance.now();
  }
  function quitToMenu(){
    state.mode='menu'; running=true; // keep loop but mode menu renders nothing special
    UI.hide('pause'); UI.showHUD(false);
    UI.show('menu');
    Audio.heartbeat(0); Audio.setBreathing(false);
    canvas.style.filter=''; sanityFilterStep=-1;
  }

  // ---------- overlays toggles ----------
  function openInventory(){ blocking=true; UI.openInventory(state.inv); }
  function closeInventory(){ UI.closeInventory(); blocking=false; }
  function openJournal(){ blocking=true; UI.openJournal(state.journal); }
  function closeJournal(){ UI.closeJournal(); blocking=false; }

  // =========================================================
  //  RENDERING
  // =========================================================
  // deterministic per-tile hash for texture variation
  function tileHash(x,y){ let h=(x*73856093) ^ (y*19349663); h=(h^(h>>13))>>>0; return h; }

  function render(){
    ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
    if (!map || (state.mode!=='playing' && state.mode!=='paused' && state.mode!=='dead' && state.mode!=='dying')) return;

    // screen shake
    ctx.save();
    if (shake > 0.2){
      ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
    }

    const s=cam.scale;
    const x0=Math.floor(player.x - canvas.width/(2*s)) - 1;
    const x1=Math.ceil (player.x + canvas.width/(2*s)) + 1;
    const y0=Math.floor(player.y - canvas.height/(2*s)) - 1;
    const y1=Math.ceil (player.y + canvas.height/(2*s)) + 1;

    // brightness with neighbor smoothing (kills the blocky look)
    const L=(x,y)=>Math.max(Lighting.lightAt(x,y), Lighting.exploredAt(x,y)*0.55);
    const smoothL=(x,y)=>(L(x,y)*4 + L(x+1,y)+L(x-1,y)+L(x,y+1)+L(x,y-1))*0.125;

    const pal = map.palette;
    const fr=pal.floor[0], fg=pal.floor[1], fb=pal.floor[2];
    const wr=pal.wall[0],  wg=pal.wall[1],  wb=pal.wall[2];

    // tiles
    for (let ty=y0; ty<=y1; ty++){
      for (let tx=x0; tx<=x1; tx++){
        if (tx<0||ty<0||tx>=map.W||ty>=map.H) continue;
        const b=smoothL(tx,ty);
        if (b<0.03) continue;
        const wall=map.grid[ty][tx]===0;
        const sx=tx*s+cam.ox, sy=ty*s+cam.oy;
        const h=tileHash(tx,ty);
        const jit=0.92 + (h%17)/100;           // ±8% per-tile tone variation
        const f=Math.min(1, b*1.25)*jit;
        let r,g,bl;
        if (wall){ r=wr; g=wg; bl=wb; } else { r=fr; g=fg; bl=fb; }
        ctx.fillStyle=`rgb(${Math.round(r*f+4)},${Math.round(g*f+4)},${Math.round(bl*f+5)})`;
        ctx.fillRect(sx,sy,s+1,s+1);

        if (!wall){
          if (b>0.1){ // floor grout lines
            ctx.fillStyle=`rgba(0,0,0,${0.15*f})`;
            ctx.fillRect(sx,sy,s+1,1); ctx.fillRect(sx,sy,1,s+1);
          }
          // old blood stains
          if (h%19===0 && b>0.12){
            ctx.save(); ctx.globalAlpha=Math.min(0.5, f*0.5);
            ctx.fillStyle='#3a0a08';
            const ox=(h>>4)%10/10, oy=(h>>7)%10/10, rr=s*(0.18+((h>>9)%10)/40);
            ctx.beginPath(); ctx.ellipse(sx+s*0.3+ox*s*0.4, sy+s*0.3+oy*s*0.4, rr, rr*0.7, h%6, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(sx+s*0.2+ox*s*0.5, sy+s*0.6, rr*0.3, 0, Math.PI*2); ctx.fill();
            ctx.restore();
          }
          // scattered grime
          if (h%7===0 && b>0.15){
            ctx.fillStyle=`rgba(0,0,0,${0.12*f})`;
            ctx.fillRect(sx+(h%5)*s/6, sy+((h>>3)%5)*s/6, s*0.3, s*0.16);
          }
        } else {
          // wall depth: lit edge facing adjacent floor below
          if (ty+1<map.H && map.grid[ty+1][tx]===1 && b>0.08){
            ctx.fillStyle=`rgba(${Math.round(r*f*2.4+25)},${Math.round(g*f*2.2+22)},${Math.round(bl*f*2+20)},0.8)`;
            ctx.fillRect(sx, sy+s-Math.max(2,s*0.14), s+1, Math.max(2,s*0.14));
          }
          // cracks
          if (h%23===0 && b>0.12){
            ctx.strokeStyle=`rgba(0,0,0,${0.5*f})`; ctx.lineWidth=1;
            ctx.beginPath();
            ctx.moveTo(sx+s*0.2, sy+s*((h>>2)%8)/10);
            ctx.lineTo(sx+s*0.5, sy+s*0.5);
            ctx.lineTo(sx+s*0.75, sy+s*((h>>5)%9)/10);
            ctx.stroke();
          }
          // scratch marks (claws) on some walls
          if (h%31===0 && b>0.15){
            ctx.strokeStyle=`rgba(20,5,5,${0.6*f})`; ctx.lineWidth=1;
            for(let k=0;k<3;k++){
              ctx.beginPath();
              ctx.moveTo(sx+s*0.25+k*s*0.14, sy+s*0.2);
              ctx.lineTo(sx+s*0.2+k*s*0.14, sy+s*0.75);
              ctx.stroke();
            }
          }
        }
      }
    }

    // doors
    for (const key in map.doors){
      const d=map.doors[key]; const [dx,dy]=key.split(',').map(Number);
      if (dx<x0||dx>x1||dy<y0||dy>y1) continue;
      const b=Math.max(Lighting.lightAt(dx,dy), Lighting.exploredAt(dx,dy)*0.6);
      if (b<0.05) continue;
      const sx=dx*s+cam.ox, sy=dy*s+cam.oy;
      if (!d.open){
        const f=Math.min(1,b*1.3);
        ctx.fillStyle = d.locked ? `rgb(${90*f|0},${40*f|0},${40*f|0})` : `rgb(${90*f|0},${70*f|0},${45*f|0})`;
        ctx.fillRect(sx+2,sy+2,s-3,s-3);
        if (d.locked && b>0.2){ ctx.fillStyle='#d8a13a'; ctx.font=`${s*0.5}px monospace`; ctx.textAlign='center'; ctx.fillText('🔒',sx+s/2,sy+s*0.7); }
      }
    }

    // decor (faint)
    map.decor.forEach(dc=>{
      if (dc.x<x0||dc.x>x1||dc.y<y0||dc.y>y1) return;
      const b=Lighting.lightAt(dc.x,dc.y);
      if (b<0.12) return;
      const sx=dc.x*s+cam.ox, sy=dc.y*s+cam.oy, f=Math.min(1,b*1.3);
      ctx.save(); ctx.globalAlpha=f*0.9;
      if (dc.type==='bed'){ ctx.fillStyle='#3a3530'; ctx.fillRect(sx+2,sy+s*0.2,s-4,s*0.7); }
      else if (dc.type==='cabinet'){ ctx.fillStyle='#42474a'; ctx.fillRect(sx+1,sy+1,s-2,s-2); ctx.strokeStyle='#222'; ctx.strokeRect(sx+s*0.45,sy+2,1,s-4); }
      else if (dc.type==='pew'){ ctx.fillStyle='#332a20'; ctx.fillRect(sx+2,sy+s*0.4,s-4,s*0.3); }
      else if (dc.type==='chair'){ ctx.fillStyle='#2e2a26'; ctx.fillRect(sx+s*0.3,sy+s*0.3,s*0.4,s*0.4); }
      ctx.restore();
    });

    // notes
    map.notes.forEach(nt=>{
      const b=Lighting.lightAt(nt.x,nt.y); if(b<0.12) return;
      const sx=nt.x*s+cam.ox, sy=nt.y*s+cam.oy;
      ctx.save(); ctx.globalAlpha=Math.min(1,b*1.4);
      ctx.fillStyle='#d8cca6'; ctx.fillRect(sx+s*0.3,sy+s*0.3,s*0.4,s*0.45);
      ctx.fillStyle='#9a8a5a'; ctx.fillRect(sx+s*0.34,sy+s*0.36,s*0.32,2);
      ctx.fillRect(sx+s*0.34,sy+s*0.44,s*0.32,2); ctx.fillRect(sx+s*0.34,sy+s*0.52,s*0.24,2);
      ctx.restore();
    });

    // items
    map.items.forEach(it=>{ if(it.taken) return;
      const b=Lighting.lightAt(it.x,it.y); if(b<0.12) return;
      const sx=it.x*s+cam.ox+s/2, sy=it.y*s+cam.oy+s/2;
      const pulse=0.6+0.4*Math.sin(state.playtime*4);
      ctx.save(); ctx.globalAlpha=Math.min(1,b*1.5);
      ctx.shadowColor='#d8a13a'; ctx.shadowBlur=10*pulse;
      ctx.font=`${s*0.6}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(itemDef(it.id).icon, sx, sy);
      ctx.restore();
    });

    // puzzles
    map.puzzles.forEach(pz=>{ if(pz.solved) return;
      const b=Math.max(Lighting.lightAt(pz.x,pz.y),Lighting.exploredAt(pz.x,pz.y)*0.6); if(b<0.08) return;
      const sx=pz.x*s+cam.ox, sy=pz.y*s+cam.oy;
      ctx.save(); ctx.globalAlpha=Math.min(1,b*1.4);
      ctx.fillStyle='#2f5f6f'; ctx.fillRect(sx+s*0.2,sy+s*0.2,s*0.6,s*0.6);
      ctx.strokeStyle='#6fcfdf'; ctx.lineWidth=2; ctx.strokeRect(sx+s*0.2,sy+s*0.2,s*0.6,s*0.6);
      ctx.restore();
    });

    // lockers
    map.lockers.forEach(l=>{
      const b=Math.max(Lighting.lightAt(l.x,l.y),Lighting.exploredAt(l.x,l.y)*0.6); if(b<0.08) return;
      const sx=l.x*s+cam.ox, sy=l.y*s+cam.oy, f=Math.min(1,b*1.3);
      ctx.fillStyle=`rgb(${50*f|0},${42*f|0},${34*f|0})`;
      ctx.fillRect(sx+s*0.15,sy+s*0.05,s*0.7,s*0.9);
      ctx.strokeStyle=`rgba(20,16,12,${f})`; ctx.strokeRect(sx+s*0.5,sy+s*0.1,1,s*0.8);
    });

    // exit
    if (map.exit){
      const ex=map.exit;
      const b=Math.max(Lighting.lightAt(ex.x,ex.y),Lighting.exploredAt(ex.x,ex.y)*0.7);
      if (b>0.05){
        const sx=ex.x*s+cam.ox+s/2, sy=ex.y*s+cam.oy+s/2;
        const ok=!ex.requires||ex.requires(state);
        const pulse=0.5+0.5*Math.sin(state.playtime*3);
        ctx.save(); ctx.globalAlpha=Math.min(1,b*1.6);
        ctx.shadowColor= ok?'#6fae5a':'#b62f2f'; ctx.shadowBlur=18*pulse;
        ctx.fillStyle= ok?'#6fae5a':'#7a3030';
        ctx.beginPath(); ctx.arc(sx,sy,s*0.3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#0a0a0a'; ctx.font=`${s*0.4}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(ok?'▼':'✕',sx,sy);
        ctx.restore();
      }
    }

    // monster
    if (monster && map.monster && map.monster.enabled){
      const mb=Lighting.lightAt(monster.tileX(),monster.tileY());
      const dist=Math.hypot(player.x-monster.x,player.y-monster.y);
      if (mb>0.1 || dist<3 || monster.state==='chase'){
        drawMonster(monster, mb, dist, s);
      }
    }

    // hallucination ghost
    if (hallGhost){
      const sx=hallGhost.x*s+cam.ox, sy=hallGhost.y*s+cam.oy;
      ctx.save(); ctx.globalAlpha=hallGhost.t*0.7;
      ctx.fillStyle='#000'; ctx.beginPath();
      ctx.ellipse(sx,sy,s*0.4,s*1.0,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#c81212'; ctx.beginPath();
      ctx.arc(sx-s*0.12,sy-s*0.4,s*0.06,0,Math.PI*2);
      ctx.arc(sx+s*0.12,sy-s*0.4,s*0.06,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // stalker silhouette at the edge of the beam
    if (stalker){
      const sx=stalker.x*s+cam.ox, sy=stalker.y*s+cam.oy;
      const a=Math.min(0.85, stalker.life*1.4);
      const jit=(Math.random()-0.5)*s*0.05;
      ctx.save(); ctx.globalAlpha=a;
      ctx.fillStyle='#020203';
      ctx.beginPath(); ctx.ellipse(sx+jit,sy,s*0.34,s*1.15,0,0,Math.PI*2); ctx.fill();
      // head, slightly tilted — wrong
      ctx.beginPath(); ctx.ellipse(sx+jit+s*0.1, sy-s*1.05, s*0.22, s*0.3, 0.5, 0, Math.PI*2); ctx.fill();
      ctx.shadowColor='#ff1010'; ctx.shadowBlur=10;
      ctx.fillStyle='rgba(255,30,30,'+a+')';
      ctx.beginPath();
      ctx.arc(sx+jit+s*0.04, sy-s*1.08, s*0.045, 0, Math.PI*2);
      ctx.arc(sx+jit+s*0.18, sy-s*1.02, s*0.045, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // dust motes drifting in the light
    if (particles){
      ctx.save();
      particles.forEach(p=>{
        const b=Lighting.lightAt(Math.floor(p.x),Math.floor(p.y));
        if (b<0.15) return;
        const px=p.x*s+cam.ox, py=p.y*s+cam.oy;
        ctx.globalAlpha=Math.min(0.35, b*0.4);
        ctx.fillStyle='#d8d2b8';
        ctx.fillRect(px, py, p.s, p.s);
      });
      ctx.restore();
    }

    // flashlight glow
    if (flashlightActive()){
      drawFlashlightGlow(s);
    }

    // player
    if (!player.hidden){
      const sx=player.x*s+cam.ox, sy=player.y*s+cam.oy;
      ctx.save();
      ctx.fillStyle='#cfc8b0'; ctx.beginPath(); ctx.arc(sx,sy,s*0.3,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#1a1a1a'; ctx.lineWidth=2; ctx.stroke();
      ctx.strokeStyle='#8a8470'; ctx.beginPath(); ctx.moveTo(sx,sy);
      ctx.lineTo(sx+Math.cos(player.facing)*s*0.4, sy+Math.sin(player.facing)*s*0.4); ctx.stroke();
      ctx.restore();
    } else {
      // hidden: darkened view
      ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    ctx.restore(); // end screen shake

    // low-sanity red haze
    if (state.sanity<25){
      ctx.save(); ctx.globalAlpha=(25-state.sanity)/25*0.15;
      ctx.fillStyle='#400000'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.restore();
    }
  }

  function drawMonster(mo, b, dist, s){
    const sx=mo.x*s+cam.ox, sy=mo.y*s+cam.oy;
    const f=Math.min(1, Math.max(b*1.4, dist<3?0.5:0));
    const chasing = mo.state==='chase';
    const jitter=chasing?(Math.random()-0.5)*s*0.12:0;
    const breathe=1+0.05*Math.sin(state.playtime*5);
    ctx.save();

    // black smoke trailing off the body
    ctx.globalAlpha=Math.min(0.4,0.2+f*0.25);
    ctx.fillStyle='#000';
    for(let k=0;k<4;k++){
      const wx=sx+Math.sin(state.playtime*2.4+k*1.9)*s*0.35;
      const wy=sy-s*0.2-k*s*0.28+Math.cos(state.playtime*3.1+k)*s*0.1;
      ctx.beginPath(); ctx.ellipse(wx,wy,s*(0.34-k*0.05),s*(0.26-k*0.04),k,0,Math.PI*2); ctx.fill();
    }

    // body — a too-tall mass
    ctx.globalAlpha=Math.min(1,0.55+f*0.45);
    ctx.fillStyle='#050507';
    ctx.beginPath();
    ctx.ellipse(sx+jitter, sy, s*0.42*breathe, s*1.1*breathe, 0, 0, Math.PI*2); ctx.fill();

    // too many arms, bent wrong
    ctx.strokeStyle='#08080b'; ctx.lineWidth=s*0.13; ctx.lineCap='round';
    const sway=Math.sin(state.playtime*(chasing?13:4))*s*0.12;
    ctx.beginPath();
    ctx.moveTo(sx-s*0.3,sy-s*0.2); ctx.lineTo(sx-s*0.62+sway, sy+s*0.35); ctx.lineTo(sx-s*0.5, sy+s*0.9);
    ctx.moveTo(sx+s*0.3,sy-s*0.2); ctx.lineTo(sx+s*0.62-sway, sy+s*0.35); ctx.lineTo(sx+s*0.5, sy+s*0.9);
    ctx.moveTo(sx-s*0.25,sy-s*0.6); ctx.lineTo(sx-s*0.7, sy-s*0.45+sway);
    ctx.moveTo(sx+s*0.25,sy-s*0.6); ctx.lineTo(sx+s*0.7, sy-s*0.45-sway);
    ctx.stroke();

    // head, tilted unnaturally
    const tilt=chasing?0.65:0.3+0.1*Math.sin(state.playtime*1.7);
    ctx.beginPath();
    ctx.ellipse(sx+jitter+s*0.06, sy-s*1.0, s*0.26, s*0.34, tilt, 0, Math.PI*2);
    ctx.fillStyle='#040406'; ctx.fill();

    // gaping jaw when it hunts
    if (chasing){
      ctx.fillStyle='#2a0606';
      ctx.beginPath();
      ctx.ellipse(sx+jitter+s*0.1, sy-s*0.82, s*0.12, s*0.18+Math.random()*s*0.05, tilt, 0, Math.PI*2);
      ctx.fill();
    }

    // glowing eyes — always the last thing you see
    const eg=0.6+0.4*Math.sin(state.playtime*8);
    ctx.shadowColor='#ff1010'; ctx.shadowBlur=(chasing?22:14)*eg; ctx.globalAlpha=1;
    ctx.fillStyle=chasing?'#ff4030':'#ff2a2a';
    const er=s*(chasing?0.085:0.065);
    ctx.beginPath();
    ctx.arc(sx-s*0.07+jitter, sy-s*1.06, er, 0, Math.PI*2);
    ctx.arc(sx+s*0.19+jitter, sy-s*0.98, er, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function drawFlashlightGlow(s){
    const sx=player.x*s+cam.ox, sy=player.y*s+cam.oy;
    const fk=0.55+0.45*flickerSmooth;          // flicker dims the beam
    const range=(matchTimer>0?5:9)*s*fk;
    const half=0.62;
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    const warm = matchTimer>0;                  // match burns orange
    const grad=ctx.createRadialGradient(sx,sy,s*0.5, sx,sy,range);
    grad.addColorStop(0,`rgba(255,${warm?200:240},${warm?140:205},${0.32*fk})`);
    grad.addColorStop(0.5,`rgba(255,${warm?190:230},${warm?120:180},${0.11*fk})`);
    grad.addColorStop(1,'rgba(255,220,160,0)');
    ctx.fillStyle=grad;
    ctx.beginPath(); ctx.moveTo(sx,sy);
    ctx.arc(sx,sy,range, player.facing-half, player.facing+half); ctx.closePath(); ctx.fill();
    // small ambient halo
    const g2=ctx.createRadialGradient(sx,sy,0,sx,sy,s*2.6);
    g2.addColorStop(0,`rgba(200,200,180,${0.10*fk})`); g2.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g2; ctx.beginPath(); ctx.arc(sx,sy,s*2.6,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ---------- public API used by entities/puzzles ----------
  const gameApi = {
    get player(){ return player; },
    get map(){ return map; },
    get inv(){ return state.inv; },
    get cam(){ return cam; },
    get flashlightOn(){ return flashlightActive(); },
    canWalk, isWall, canMonsterWalk, isWallForMonster, gridForPath,
    lightOnPlayer, onCaught, solvePuzzle, applyActions,
    toast:(t,k)=>UI.toast(t,k),
  };

  return {
    init, newGame, continueGame,
    cutsceneNext, cutsceneSkip,
    resume, pause, retryChapter, quitToMenu,
    closeNote, closeInventory, closeJournal,
    get state(){ return state; },
    get blocking(){ return blocking; },
    set blocking(v){ blocking=v; },
    get mode(){ return state.mode; },
  };
})();
