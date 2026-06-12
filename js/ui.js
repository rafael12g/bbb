/* ============================================================
   BLACKWOOD — HUD & overlay UI
   ============================================================ */
const UI = (() => {
  const $ = id => document.getElementById(id);
  let subTimer = null, toastTimers = [];

  function showHUD(on){ $('hud').classList.toggle('hidden', !on); }

  function setObjective(text){
    $('hud-objective').innerHTML = `<div class="obj-label">OBJECTIF</div>${text||''}`;
  }
  function setChapter(text){ $('hud-chapter').textContent = text || ''; }
  function setHint(text){ $('hud-hint').textContent = text || ''; }

  function meters(sanity, battery, stamina){
    $('sanity-fill').style.width = Math.max(0,Math.min(1,sanity))*100 + '%';
    $('battery-fill').style.width = Math.max(0,Math.min(1,battery))*100 + '%';
    $('stamina-fill').style.width = Math.max(0,Math.min(1,stamina))*100 + '%';
    $('sanity-fill').style.background = sanity < 0.3
      ? 'linear-gradient(90deg,#7a1010,#b62f2f)' : 'linear-gradient(90deg,#3a6fae,#6f9fae)';
  }

  function toast(text, kind){
    const host = $('hud-toast');
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' '+kind : '');
    el.textContent = text;
    host.appendChild(el);
    const t = setTimeout(()=>{ el.style.opacity=0; setTimeout(()=>el.remove(),400); }, 3200);
    toastTimers.push(t);
  }

  function subtitle(text, dur=4200){
    const el = $('subtitle');
    el.textContent = text; el.classList.remove('hidden');
    if (subTimer) clearTimeout(subTimer);
    subTimer = setTimeout(()=> el.classList.add('hidden'), dur);
  }

  function prompt(text){
    const el = $('prompt');
    if (!text) { el.classList.add('hidden'); return; }
    el.innerHTML = text; el.classList.remove('hidden');
  }

  function damageFlash(){
    const el = $('damage-flash');
    el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'), 140);
  }

  function showJumpscare(){
    if (scrTimer){ clearTimeout(scrTimer); scrTimer=null; }
    const j=$('jumpscare'); j.classList.remove('hidden','flash');
    j.querySelector('.js-face').className='js-face';
  }
  function hideJumpscare(){ $('jumpscare').classList.add('hidden'); }

  // brief, violent screamer flash (mid-gameplay). dur in ms.
  let scrTimer=null;
  function screamer(dur=480, variant){
    const j=$('jumpscare'); const face=j.querySelector('.js-face');
    const v = variant || ('v'+(2+Math.floor(Math.random()*2)));
    face.className='js-face '+v;
    j.classList.remove('hidden'); j.classList.add('flash');
    damageFlash();
    if (scrTimer) clearTimeout(scrTimer);
    scrTimer=setTimeout(()=>{ j.classList.add('hidden'); j.classList.remove('flash'); }, dur);
  }

  function blink(cb){
    const el = $('blink');
    el.style.opacity = 1;
    setTimeout(()=>{ el.style.opacity = 0; if(cb) cb(); }, 130);
  }

  function vignette(intensity){ // 0..1 dread
    $('vignette').style.background =
      `radial-gradient(ellipse at center, rgba(0,0,0,0) ${35-intensity*15}%,`+
      ` rgba(0,0,0,${0.55+intensity*0.2}) ${75-intensity*10}%, rgba(0,0,0,0.96) 100%)`;
    $('grain').style.opacity = (0.05 + intensity*0.08).toFixed(3);
  }

  // ---------- hotbar ----------
  function hotbar(slots){ // [{id,count} | null] length 6
    const host = $('hotbar'); host.innerHTML = "";
    for (let i=0;i<6;i++){
      const it = slots[i];
      const el = document.createElement('div');
      el.className = 'slot' + (it?'':' empty');
      if (it){
        const d = itemDef(it.id);
        el.innerHTML = `<span class="num">${i+1}</span>${d.icon}`+
          (it.count>1?`<span class="cnt">${it.count}</span>`:``);
        el.title = d.name;
      } else el.innerHTML = `<span class="num">${i+1}</span>`;
      host.appendChild(el);
    }
  }

  // ---------- overlays ----------
  function show(id){ $(id).classList.remove('hidden'); }
  function hide(id){ $(id).classList.add('hidden'); }

  function openInventory(inv){
    const grid = $('inv-grid'), detail = $('inv-detail');
    grid.innerHTML = ""; detail.textContent = "Sélectionnez un objet.";
    const entries = inv.list();
    if (!entries.length) grid.innerHTML = '<p class="hint-small">Vos poches sont vides.</p>';
    entries.forEach(e=>{
      const d = itemDef(e.id);
      const el = document.createElement('div'); el.className='inv-item';
      el.innerHTML = `${d.icon}<span class="nm">${d.name}</span>`+
        (e.count>1?`<span class="cnt">${e.count}</span>`:``);
      el.onclick = ()=>{ Audio.uiMove(); detail.innerHTML = `<b>${d.name}</b> — ${d.desc}`; };
      grid.appendChild(el);
    });
    show('inventory');
  }
  function closeInventory(){ hide('inventory'); }

  function openJournal(journal){
    const list = $('journal-list'), read = $('journal-read');
    list.innerHTML = ""; read.textContent = "Sélectionnez un document.";
    if (!journal.length) list.innerHTML = '<p class="hint-small">Aucun document trouvé.</p>';
    journal.forEach(entry=>{
      const def = noteDef(entry.id);
      const el = document.createElement('div');
      el.className = 'journal-entry' + (entry.unread?' unread':'');
      el.textContent = def.title;
      el.onclick = ()=>{ Audio.noteRustle(); entry.unread=false; el.classList.remove('unread');
        read.textContent = def.body; };
      list.appendChild(el);
    });
    show('journal');
  }
  function closeJournal(){ hide('journal'); }

  function openNote(id){
    const def = noteDef(id);
    $('note-content').innerHTML = `<h3>${def.title}</h3>${def.body}`;
    show('note-reader');
    Audio.noteRustle();
  }
  function closeNote(){ hide('note-reader'); }

  return {
    showHUD, setObjective, setChapter, setHint, meters, toast, subtitle, prompt,
    damageFlash, blink, vignette, hotbar, showJumpscare, hideJumpscare, screamer,
    show, hide, openInventory, closeInventory, openJournal, closeJournal,
    openNote, closeNote
  };
})();
