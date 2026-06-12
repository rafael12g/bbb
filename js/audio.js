/* ============================================================
   BLACKWOOD — Procedural Audio Engine (Web Audio API)
   All sound is synthesized at runtime. No external files.
   ============================================================ */
const Audio = (() => {
  let ctx = null;
  let master = null, sfxBus = null, musicBus = null;
  let started = false;
  let noiseBuffer = null;

  // ambient layers
  let drone = null, droneGain = null, heartTimer = null;
  let breathTimer = null;
  let dread = 0;           // 0..1 tension drives ambient
  let heartRate = 0;       // bpm-ish, 0 = off

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 1.0; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1.0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.6; musicBus.connect(master);
    const len = ctx.sampleRate * 2;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  function resume() {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    started = true;
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  function noiseSource() {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer; s.loop = true; return s;
  }

  // ---------- ambient drone ----------
  function startAmbient() {
    if (!ctx || drone) return;
    droneGain = ctx.createGain(); droneGain.gain.value = 0.0; droneGain.connect(musicBus);

    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 41;
    const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = 55.3;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 4;
    o1.connect(lp); o2.connect(lp); o3.connect(lp); lp.connect(droneGain);

    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 30;
    lfo.connect(lfoG); lfoG.connect(lp.frequency);

    const wind = noiseSource();
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 400; wf.Q.value = 0.6;
    const wg = ctx.createGain(); wg.gain.value = 0.04;
    wind.connect(wf); wf.connect(wg); wg.connect(droneGain);

    o1.start(); o2.start(); o3.start(); lfo.start(); wind.start();
    drone = { o1, o2, o3, lfo, lp, wind, wf };
    droneGain.gain.linearRampToValueAtTime(0.5, now() + 4);
  }

  function setDread(v) {
    dread = Math.max(0, Math.min(1, v));
    if (drone && ctx) {
      const t = now();
      drone.lp.frequency.setTargetAtTime(180 + dread * 700, t, 1.5);
      drone.o1.frequency.setTargetAtTime(55 + dread * 14, t, 1.5);
      drone.wf.frequency.setTargetAtTime(400 + dread * 1400, t, 1.5);
    }
  }

  // ---------- heartbeat ----------
  function heartbeat(rate) { heartRate = rate; }
  function _scheduleHeart() {
    if (!ctx) return;
    if (heartRate > 0 && started) { _thump(0.0, 0.9); _thump(0.16, 0.6); }
    const interval = heartRate > 0 ? (60 / heartRate) : 1.0;
    heartTimer = setTimeout(_scheduleHeart, interval * 1000);
  }
  function _thump(delay, amp) {
    const t = now() + delay;
    const o = ctx.createOscillator(); o.type = 'sine';
    const g = ctx.createGain();
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp * 0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + 0.3);
  }

  // ---------- breathing (low sanity) ----------
  let breathEnabled = false;
  function setBreathing(on){ breathEnabled = on; }
  function _scheduleBreath(){
    if(ctx && breathEnabled && started){ _breathPuff(); }
    breathTimer = setTimeout(_scheduleBreath, (breathEnabled?2200:3000) + Math.random()*600);
  }
  function _breathPuff(){
    const t = now();
    const n = noiseSource();
    const f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=900; f.Q.value=0.8;
    const g = ctx.createGain(); g.gain.value=0.0001;
    n.connect(f); f.connect(g); g.connect(sfxBus);
    g.gain.linearRampToValueAtTime(0.10, t+0.4);
    g.gain.linearRampToValueAtTime(0.0001, t+1.0);
    f.frequency.linearRampToValueAtTime(500, t+1.0);
    n.start(t); n.stop(t+1.1);
  }

  // ---------- generic one-shots ----------
  function blip(freq=440, dur=0.06, type='square', vol=0.2) {
    if (!ctx || !started) return;
    const t = now();
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    o.connect(g); g.connect(sfxBus);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function uiMove(){ blip(330,0.04,'square',0.08); }
  function uiSelect(){ blip(620,0.07,'square',0.12); }
  function uiBack(){ blip(200,0.08,'square',0.1); }
  function keypadOk(){ blip(880,0.12,'sine',0.18); setTimeout(()=>blip(1320,0.18,'sine',0.18),90); }
  function keypadErr(){ blip(160,0.2,'sawtooth',0.2); }

  function pickup(){ blip(520,0.05,'triangle',0.12); setTimeout(()=>blip(780,0.08,'triangle',0.12),60); }
  function noteRustle(){
    if(!ctx||!started)return;
    const t=now(); const n=noiseSource();
    const f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=2500;
    const g=ctx.createGain();g.gain.value=0.0001;
    n.connect(f);f.connect(g);g.connect(sfxBus);
    g.gain.linearRampToValueAtTime(0.08,t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.25);
    n.start(t);n.stop(t+0.3);
  }

  function footstep(run=false){
    if(!ctx||!started)return;
    const t=now(); const n=noiseSource();
    const f=ctx.createBiquadFilter(); f.type='lowpass';
    f.frequency.value = run?900:600;
    const g=ctx.createGain(); g.gain.value=0.0001;
    n.connect(f); f.connect(g); g.connect(sfxBus);
    const v = run?0.10:0.05;
    g.gain.linearRampToValueAtTime(v, t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.12);
    n.start(t); n.stop(t+0.14);
  }

  function doorOpen(){
    if(!ctx||!started)return;
    const t=now();
    const o=ctx.createOscillator(); o.type='sawtooth';
    o.frequency.setValueAtTime(120,t); o.frequency.exponentialRampToValueAtTime(60,t+0.5);
    const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=400;
    const g=ctx.createGain(); g.gain.value=0.0001;
    o.connect(f);f.connect(g);g.connect(sfxBus);
    g.gain.linearRampToValueAtTime(0.08,t+0.05);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.55);
    o.start(t);o.stop(t+0.6);
    const o2=ctx.createOscillator();o2.type='sine';
    o2.frequency.setValueAtTime(300,t);o2.frequency.linearRampToValueAtTime(520,t+0.4);
    const g2=ctx.createGain();g2.gain.value=0.0001;
    o2.connect(g2);g2.connect(sfxBus);
    g2.gain.linearRampToValueAtTime(0.03,t+0.1);
    g2.gain.exponentialRampToValueAtTime(0.0001,t+0.45);
    o2.start(t);o2.stop(t+0.5);
  }
  function doorLocked(){ blip(140,0.1,'square',0.12); setTimeout(()=>blip(120,0.12,'square',0.12),120); }
  function lockerHide(){ doorOpen(); }
  function flashlightClick(){ blip(900,0.02,'square',0.1); }
  function batteryLow(){ blip(1200,0.04,'sine',0.06); }

  // ---------- monster sounds ----------
  function growl(dist=1){
    if(!ctx||!started)return;
    const vol = 0.25*(1-dist*0.7);
    const t=now();
    const o=ctx.createOscillator(); o.type='sawtooth';
    o.frequency.setValueAtTime(58,t);
    o.frequency.linearRampToValueAtTime(44,t+0.8);
    const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=300;
    const lfo=ctx.createOscillator(); lfo.frequency.value=18;
    const lfoG=ctx.createGain(); lfoG.gain.value=200; lfo.connect(lfoG); lfoG.connect(f.frequency);
    const g=ctx.createGain(); g.gain.value=0.0001;
    o.connect(f);f.connect(g);g.connect(sfxBus);
    g.gain.linearRampToValueAtTime(Math.max(0.02,vol),t+0.15);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.95);
    o.start(t);lfo.start(t);o.stop(t+1);lfo.stop(t+1);
  }

  function _distCurve(amount){
    const n=256, c=new Float32Array(n), deg=Math.PI/180;
    for(let i=0;i<n;i++){const x=i*2/n-1;c[i]=(3+amount)*x*20*deg/(Math.PI+amount*Math.abs(x));}
    return c;
  }

  function scream(){
    if(!ctx||!started)return;
    const t=now();
    const o=ctx.createOscillator(); o.type='sawtooth';
    o.frequency.setValueAtTime(800,t);
    o.frequency.exponentialRampToValueAtTime(1600,t+0.15);
    o.frequency.exponentialRampToValueAtTime(300,t+0.9);
    const dist=ctx.createWaveShaper(); dist.curve=_distCurve(60);
    const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1200; f.Q.value=2;
    const g=ctx.createGain(); g.gain.value=0.0001;
    o.connect(dist);dist.connect(f);f.connect(g);g.connect(sfxBus);
    g.gain.linearRampToValueAtTime(0.4,t+0.05);
    g.gain.exponentialRampToValueAtTime(0.0001,t+1.0);
    o.start(t);o.stop(t+1.05);
  }

  function stinger(intensity=1){
    if(!ctx||!started)return;
    const t=now();
    [1318,1480,1567,1760,1975].forEach((fr)=>{
      const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=fr*(1+ (Math.random()*0.01));
      const g=ctx.createGain(); g.gain.value=0.0001;
      const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=800;
      o.connect(f);f.connect(g);g.connect(sfxBus);
      g.gain.linearRampToValueAtTime(0.12*intensity,t+0.01);
      g.gain.setValueAtTime(0.12*intensity,t+0.25);
      g.gain.exponentialRampToValueAtTime(0.0001,t+1.4);
      o.start(t);o.stop(t+1.45);
    });
    const b=ctx.createOscillator(); b.type='sine';
    b.frequency.setValueAtTime(90,t); b.frequency.exponentialRampToValueAtTime(30,t+1.2);
    const bg=ctx.createGain(); bg.gain.value=0.0001;
    b.connect(bg);bg.connect(sfxBus);
    bg.gain.linearRampToValueAtTime(0.5*intensity,t+0.02);
    bg.gain.exponentialRampToValueAtTime(0.0001,t+1.3);
    b.start(t);b.stop(t+1.35);
    const n=noiseSource(); const nf=ctx.createBiquadFilter(); nf.type='highpass'; nf.frequency.value=3000;
    const ng=ctx.createGain(); ng.gain.value=0.0001;
    n.connect(nf);nf.connect(ng);ng.connect(sfxBus);
    ng.gain.linearRampToValueAtTime(0.25*intensity,t+0.005);
    ng.gain.exponentialRampToValueAtTime(0.0001,t+0.5);
    n.start(t);n.stop(t+0.55);
  }

  function whisper(){
    if(!ctx||!started)return;
    const t=now(); const n=noiseSource();
    const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1800; f.Q.value=6;
    const lfo=ctx.createOscillator(); lfo.frequency.value=6;
    const lfoG=ctx.createGain(); lfoG.gain.value=600; lfo.connect(lfoG); lfoG.connect(f.frequency);
    const g=ctx.createGain(); g.gain.value=0.0001;
    n.connect(f);f.connect(g);g.connect(sfxBus);
    g.gain.linearRampToValueAtTime(0.06,t+0.3);
    g.gain.exponentialRampToValueAtTime(0.0001,t+1.6);
    n.start(t);lfo.start(t);n.stop(t+1.7);lfo.stop(t+1.7);
  }

  function hurt(){
    if(!ctx||!started)return;
    const t=now();
    const o=ctx.createOscillator();o.type='triangle';
    o.frequency.setValueAtTime(300,t);o.frequency.exponentialRampToValueAtTime(80,t+0.3);
    const g=ctx.createGain();g.gain.value=0.0001;
    o.connect(g);g.connect(sfxBus);
    g.gain.linearRampToValueAtTime(0.3,t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.35);
    o.start(t);o.stop(t+0.4);
  }

  function pulse(){ blip(660,0.1,'sine',0.15); setTimeout(()=>blip(990,0.14,'sine',0.12),100); }

  // heavy door slam somewhere in the building
  function slam(){
    if(!ctx||!started)return;
    const t=now();
    const o=ctx.createOscillator();o.type='sine';
    o.frequency.setValueAtTime(70,t);o.frequency.exponentialRampToValueAtTime(24,t+0.5);
    const g=ctx.createGain();g.gain.value=0.0001;
    o.connect(g);g.connect(sfxBus);
    g.gain.linearRampToValueAtTime(0.45,t+0.015);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.6);
    o.start(t);o.stop(t+0.65);
    const n=noiseSource();
    const nf=ctx.createBiquadFilter();nf.type='lowpass';nf.frequency.value=500;
    const ng=ctx.createGain();ng.gain.value=0.0001;
    n.connect(nf);nf.connect(ng);ng.connect(sfxBus);
    ng.gain.linearRampToValueAtTime(0.2,t+0.01);
    ng.gain.exponentialRampToValueAtTime(0.0001,t+0.3);
    n.start(t);n.stop(t+0.35);
  }

  // a child's giggle, far away — three small descending sine chirps
  function giggle(){
    if(!ctx||!started)return;
    [[1175,0],[1318,110],[988,230],[880,330]].forEach(([fr,d])=>{
      setTimeout(()=>{
        const t=now();
        const o=ctx.createOscillator();o.type='sine';
        o.frequency.setValueAtTime(fr,t);
        o.frequency.exponentialRampToValueAtTime(fr*0.82,t+0.09);
        const g=ctx.createGain();g.gain.value=0.0001;
        const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=fr;f.Q.value=3;
        o.connect(f);f.connect(g);g.connect(sfxBus);
        g.gain.linearRampToValueAtTime(0.05,t+0.015);
        g.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
        o.start(t);o.stop(t+0.14);
      },d);
    });
  }

  // electric buzz when the flashlight struggles
  function buzz(){
    if(!ctx||!started)return;
    const t=now();
    const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=110;
    const g=ctx.createGain();g.gain.value=0.0001;
    const f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=900;
    o.connect(f);f.connect(g);g.connect(sfxBus);
    g.gain.linearRampToValueAtTime(0.05,t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
    o.start(t);o.stop(t+0.14);
  }

  // ===== SCREAMER STACK — the loud, nasty stuff =====

  // a layered distorted human scream (much louder than scream())
  function screamLoud(){
    if(!ctx||!started)return;
    const t=now();
    [1,1.005,0.5,1.49].forEach((mul,i)=>{
      const o=ctx.createOscillator(); o.type= i<2?'sawtooth':'square';
      o.frequency.setValueAtTime(700*mul,t);
      o.frequency.exponentialRampToValueAtTime(1700*mul,t+0.12);
      o.frequency.exponentialRampToValueAtTime(280*mul,t+1.0);
      const dist=ctx.createWaveShaper(); dist.curve=_distCurve(120);
      const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1300; f.Q.value=1.4;
      const g=ctx.createGain(); g.gain.value=0.0001;
      o.connect(dist);dist.connect(f);f.connect(g);g.connect(sfxBus);
      g.gain.linearRampToValueAtTime(0.5,t+0.03);
      g.gain.exponentialRampToValueAtTime(0.0001,t+1.1);
      o.start(t);o.stop(t+1.15);
    });
  }

  // the full screamer: silence-snap → BANG → scream → high crash
  function screamer(){
    if(!ctx||!started)return;
    screamLoud();
    stinger(1.2);
    // sub bang
    const t=now();
    const b=ctx.createOscillator(); b.type='sine';
    b.frequency.setValueAtTime(120,t); b.frequency.exponentialRampToValueAtTime(28,t+0.7);
    const bg=ctx.createGain(); bg.gain.value=0.0001;
    const bd=ctx.createWaveShaper(); bd.curve=_distCurve(40);
    b.connect(bd);bd.connect(bg);bg.connect(sfxBus);
    bg.gain.linearRampToValueAtTime(0.7,t+0.01);
    bg.gain.exponentialRampToValueAtTime(0.0001,t+0.8);
    b.start(t);b.stop(t+0.85);
    // shrieking metal crash
    const n=noiseSource(); const nf=ctx.createBiquadFilter(); nf.type='highpass'; nf.frequency.value=2500;
    const ng=ctx.createGain(); ng.gain.value=0.0001;
    n.connect(nf);nf.connect(ng);ng.connect(sfxBus);
    ng.gain.linearRampToValueAtTime(0.35,t+0.005);
    ng.gain.exponentialRampToValueAtTime(0.0001,t+0.7);
    n.start(t);n.stop(t+0.75);
  }

  // rising tension tone that precedes a scare (call ~1s before)
  function riser(dur=1.0){
    if(!ctx||!started)return;
    const t=now();
    const o=ctx.createOscillator(); o.type='sawtooth';
    o.frequency.setValueAtTime(80,t);
    o.frequency.exponentialRampToValueAtTime(900,t+dur);
    const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(300,t);
    f.frequency.exponentialRampToValueAtTime(3000,t+dur);
    const g=ctx.createGain(); g.gain.value=0.0001;
    o.connect(f);f.connect(g);g.connect(sfxBus);
    g.gain.linearRampToValueAtTime(0.18,t+dur*0.8);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.1);
    o.start(t);o.stop(t+dur+0.15);
    // shimmer noise
    const n=noiseSource(); const nf=ctx.createBiquadFilter(); nf.type='bandpass'; nf.frequency.setValueAtTime(400,t);
    nf.frequency.exponentialRampToValueAtTime(4000,t+dur); nf.Q.value=2;
    const ng=ctx.createGain(); ng.gain.value=0.0001;
    n.connect(nf);nf.connect(ng);ng.connect(sfxBus);
    ng.gain.linearRampToValueAtTime(0.1,t+dur*0.9);
    ng.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.1);
    n.start(t);n.stop(t+dur+0.15);
  }

  // wet breath right behind you
  function breath(){
    if(!ctx||!started)return;
    const t=now();
    const n=noiseSource();
    const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=600; f.Q.value=1.2;
    const g=ctx.createGain(); g.gain.value=0.0001;
    n.connect(f);f.connect(g);g.connect(sfxBus);
    // inhale
    g.gain.linearRampToValueAtTime(0.16,t+0.35);
    f.frequency.linearRampToValueAtTime(1100,t+0.35);
    // exhale
    g.gain.linearRampToValueAtTime(0.05,t+0.5);
    g.gain.linearRampToValueAtTime(0.20,t+0.9);
    f.frequency.linearRampToValueAtTime(450,t+0.95);
    g.gain.exponentialRampToValueAtTime(0.0001,t+1.2);
    n.start(t);n.stop(t+1.25);
  }

  // metal scrape / nails dragged on steel
  function scrape(){
    if(!ctx||!started)return;
    const t=now();
    const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=2200;
    const lfo=ctx.createOscillator(); lfo.type='square'; lfo.frequency.value=42;
    const lg=ctx.createGain(); lg.gain.value=400; lfo.connect(lg); lg.connect(o.frequency);
    const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=3000; f.Q.value=8;
    const g=ctx.createGain(); g.gain.value=0.0001;
    o.connect(f);f.connect(g);g.connect(sfxBus);
    g.gain.linearRampToValueAtTime(0.12,t+0.05);
    g.gain.linearRampToValueAtTime(0.08,t+0.5);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.7);
    o.start(t);lfo.start(t);o.stop(t+0.72);lfo.stop(t+0.72);
  }

  // sudden snap of total quiet then a tick — the "calm before"
  function holdBreath(){
    if(!droneGain||!ctx)return;
    const t=now();
    droneGain.gain.cancelScheduledValues(t);
    droneGain.gain.setTargetAtTime(0.05, t, 0.15);
    droneGain.gain.setTargetAtTime(0.5, t+1.3, 0.6);
  }

  function powerOn(){
    if(!ctx||!started)return;
    const t=now();
    const o=ctx.createOscillator();o.type='sawtooth';
    o.frequency.setValueAtTime(40,t);o.frequency.linearRampToValueAtTime(120,t+1.5);
    const g=ctx.createGain();g.gain.value=0.0001;
    const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=600;
    o.connect(f);f.connect(g);g.connect(sfxBus);
    g.gain.linearRampToValueAtTime(0.12,t+0.3);
    g.gain.linearRampToValueAtTime(0.05,t+1.5);
    g.gain.exponentialRampToValueAtTime(0.0001,t+2.2);
    o.start(t);o.stop(t+2.3);
  }

  function start() {
    resume();
    startAmbient();
    if (!heartTimer) _scheduleHeart();
    if (!breathTimer) _scheduleBreath();
  }

  function setMasterVolume(v){ if(master) master.gain.value=v; }

  return {
    init, resume, start, now,
    setDread, heartbeat, setBreathing,
    uiMove, uiSelect, uiBack, keypadOk, keypadErr,
    pickup, noteRustle, footstep, doorOpen, doorLocked, lockerHide,
    flashlightClick, batteryLow, growl, scream, stinger, whisper, hurt, pulse, powerOn,
    slam, giggle, buzz, screamer, screamLoud, riser, breath, scrape, holdBreath,
    setMasterVolume,
    get ready(){ return started; }
  };
})();
