/* ============================================================
   BLACKWOOD — Map builder + chapter definitions
   Tiles: 0 = wall, 1 = floor
   ============================================================ */

class MapBuilder {
  constructor(id, w, h) {
    this.id = id;
    this.W = w; this.H = h;
    this.grid = [];
    for (let y = 0; y < h; y++) this.grid.push(new Uint8Array(w)); // all walls
    this.doors = {};      // "x,y" -> {locked, key, open, label}
    this.lockers = [];    // {x,y,occupied}
    this.items = [];      // {x,y,id,count,taken,note}
    this.notes = [];      // {x,y,id,read}
    this.puzzles = [];    // {x,y,type,...,solved,onSolve,label,prompt}
    this.triggers = [];   // {x,y,r,once,fired,when,action}
    this.decor = [];      // {x,y,type}
    this.playerStart = { x: 2, y: 2, facing: 0 };
    this.monster = null;
    this.exit = null;
    this.name = id; this.title = ""; this.intro = []; this.objective = "";
    this.dread = 0.3;
  }
  inBounds(x,y){ return x>=0 && y>=0 && x<this.W && y<this.H; }
  setFloor(x,y){ if(this.inBounds(x,y)) this.grid[y][x]=1; }
  isFloor(x,y){ return this.inBounds(x,y) && this.grid[y][x]===1; }

  room(x,y,w,h){ for(let j=0;j<h;j++) for(let i=0;i<w;i++) this.setFloor(x+i,y+j); return this; }
  hcorr(x1,x2,y){ const a=Math.min(x1,x2),b=Math.max(x1,x2); for(let x=a;x<=b;x++) this.setFloor(x,y); return this; }
  vcorr(y1,y2,x){ const a=Math.min(y1,y2),b=Math.max(y1,y2); for(let y=a;y<=b;y++) this.setFloor(x,y); return this; }
  corridor(x1,y1,x2,y2){ this.hcorr(x1,x2,y1); this.vcorr(y1,y2,x2); return this; }

  door(x,y,opts={}){ this.setFloor(x,y); this.doors[x+","+y]={locked:!!opts.locked,key:opts.key||null,open:false,label:opts.label||"Porte"}; return this; }
  locker(x,y){ this.setFloor(x,y); this.lockers.push({x,y,occupied:false}); return this; }
  item(x,y,id,count=1,note=null){ this.setFloor(x,y); this.items.push({x,y,id,count,taken:false,note}); return this; }
  note(x,y,id){ this.setFloor(x,y); this.notes.push({x,y,id,read:false}); return this; }
  puzzle(x,y,def){ this.setFloor(x,y); this.puzzles.push(Object.assign({x,y,solved:false},def)); return this; }
  trigger(t){ this.triggers.push(Object.assign({once:true,fired:false,r:1.3},t)); return this; }
  deco(x,y,type){ this.decor.push({x,y,type}); return this; }
  start(x,y,facing=0){ this.playerStart={x,y,facing}; return this; }
  mob(x,y,opts={}){ this.monster={x,y,enabled:opts.enabled!==false,speed:opts.speed||3.0,roam:opts.roam||[]}; return this; }
  setExit(x,y,requires=null){ this.setFloor(x,y); this.exit={x,y,requires}; return this; }
}

/* ------------------------------------------------------------------
   CHAPTERS — each returns a fresh MapBuilder
   ------------------------------------------------------------------ */
const Chapters = [

// ====================== CHAPTER 1 — ACCUEIL ======================
function ch1() {
  const m = new MapBuilder('ch1', 46, 32);
  m.name = "Chapitre I — L'Accueil";
  m.title = "L'ACCUEIL";
  m.dread = 0.25;
  m.intro = [
    "Institut psychiatrique Blackwood. Fermé depuis 1987.",
    "Vous êtes Daniel Reyes, journaliste.",
    "La grille s'est refermée derrière vous. Votre voiture est morte.",
    "Trouvez une autre sortie. Et faites vite — il fait déjà nuit."
  ];
  m.objective = "Trouver la clé du quartier des patients et atteindre la porte verrouillée.";

  m.room(18,25,10,5);
  m.start(22,28,-Math.PI/2);
  m.vcorr(25,22,22); m.vcorr(25,22,23);
  m.room(14,16,18,7);
  m.room(5,17,7,5);
  m.door(12,19,{label:"Porte de l'accueil"});
  m.hcorr(12,14,19);
  m.item(7,19,'key_ward',1,'n_keyhint1');
  m.note(9,20,'n_intro');
  m.room(34,16,7,6);
  m.door(32,18,{}); m.hcorr(32,34,18);
  m.note(37,18,'n_admission');
  m.item(38,20,'battery',2);
  m.deco(35,17,'chair'); m.deco(36,17,'chair'); m.deco(37,17,'chair');
  m.vcorr(16,8,23);
  m.room(8,6,30,3);
  m.hcorr(23,9,7); m.hcorr(23,37,7);
  m.note(10,7,'n_rules');
  m.item(34,7,'pills',1);
  m.room(8,2,6,4);
  m.door(10,6,{});
  m.note(10,3,'n_padcode');
  m.room(40,5,4,5);
  m.door(39,7,{locked:true,key:'key_ward',label:"Quartier des patients"});
  m.hcorr(37,40,7);
  m.setExit(42,5);
  m.locker(30,22);
  m.trigger({ x:23,y:14, r:1.6, action:[
    {type:'subtitle', text:"Une porte claque, quelque part au-dessus de vous."},
    {type:'sound', name:'doorOpen'} ] });
  m.trigger({ x:22,y:9, r:1.6, action:[
    {type:'stinger', intensity:0.6},
    {type:'subtitle', text:"Une ombre traverse le couloir. Vous êtes seul. ...n'est-ce pas ?"},
    {type:'sanity', amount:-8} ] });
  m.mob(43,8,{enabled:false});
  return m;
},

// ================== CHAPTER 2 — LE QUARTIER ==================
function ch2() {
  const m = new MapBuilder('ch2', 52, 34);
  m.name = "Chapitre II — Le Quartier des Patients";
  m.title = "LE QUARTIER";
  m.dread = 0.45;
  m.intro = [
    "Le quartier des patients. Douze chambres. Des murs griffés.",
    "Quelque chose bouge ici. Ne courez que si vous y êtes forcé —",
    "il suit le bruit.",
    "Trouvez la clé de la morgue. C'est votre chemin vers le bas."
  ];
  m.objective = "Fouiller les chambres, ouvrir la pharmacie (digicode) et trouver la clé de la morgue.";

  m.room(4,16,44,2);
  m.start(5,16, 0);
  for (let i=0;i<6;i++){
    const x=6+i*7;
    m.room(x,8,5,6);
    m.door(x+2,15,{}); m.vcorr(16,14,x+2);
    m.deco(x+1,9,'bed'); m.deco(x+3,9,'bed');
  }
  for (let i=0;i<6;i++){
    const x=6+i*7;
    m.room(x,20,5,6);
    m.door(x+2,18,{}); m.vcorr(18,20,x+2);
    m.deco(x+1,24,'bed');
  }
  m.note(8,9,'n_diary1');
  m.note(15,9,'n_child');
  m.item(16,24,'medkit',1);
  m.item(23,9,'battery',2);
  m.note(29,24,'f1');
  m.note(36,9,'n_diary2');
  m.item(37,24,'pills',1);
  m.item(44,9,'doll',1,'f5');
  m.note(9,24,'f3');
  m.room(44,18,6,6);
  m.door(46,18,{locked:true,key:null,label:"Pharmacie (digicode)"});
  m.vcorr(18,17,46);
  m.puzzle(46,16,{
    type:'keypad', code:'0312', label:"Clavier de la pharmacie",
    prompt:"Entrer le code de la pharmacie",
    onSolve:[{type:'unlockDoor',x:46,y:18},{type:'toast',text:"La serrure cède.",kind:'good'},
             {type:'sound',name:'powerOn'}] });
  m.item(47,21,'key_morgue',1,'n_diary3');
  m.item(46,22,'medkit',1);
  m.room(2,26,4,5);
  m.door(4,28,{locked:true,key:'key_morgue',label:"Escalier vers le sous-sol"});
  m.hcorr(4,5,28); m.vcorr(17,28,5);
  m.setExit(3,29);
  m.locker(20,16); m.locker(33,17); m.locker(7,21);
  m.mob(46,16,{enabled:true,speed:2.9,roam:[[46,16],[6,16],[25,9],[25,24]]});
  m.trigger({ x:12,y:16, r:1.4, action:[
    {type:'stinger',intensity:0.7},
    {type:'subtitle',text:"Un patient était assis là. Vous clignez des yeux. La chaise est vide."},
    {type:'sanity',amount:-6} ] });
  m.trigger({ x:25,y:16, r:1.4, action:[
    {type:'subtitle',text:"« Il a faim », murmurent les murs. Tous en même temps."},
    {type:'sound',name:'whisper'},{type:'sanity',amount:-5} ] });
  return m;
},

// ================== CHAPTER 3 — LE SOUS-SOL ==================
function ch3() {
  const m = new MapBuilder('ch3', 48, 34);
  m.name = "Chapitre III — Le Sous-sol";
  m.title = "LE SOUS-SOL";
  m.dread = 0.6;
  m.intro = [
    "Le sous-sol est noyé dans le noir et l'eau croupie.",
    "Le générateur est mort. Sans courant, la chambre froide se réchauffe —",
    "et ce qu'elle contient se réveille.",
    "Rétablissez le courant : trois fusibles, puis le levier rouge."
  ];
  m.objective = "Réamorcer la pompe (vannes), placer les 3 fusibles et tirer le levier du générateur.";

  m.room(3,3,4,4); m.start(4,4,0);
  m.room(8,3,30,5);
  m.hcorr(6,8,4);
  m.room(40,3,6,6);
  m.door(38,5,{}); m.hcorr(38,40,5);
  m.note(42,4,'n_valvenote');
  m.puzzle(43,7,{
    type:'valves', solution:['blue','red','green'], label:"Vannes de la pompe",
    prompt:"Régler les vannes (voir la note)",
    onSolve:[{type:'flag',name:'pump'},{type:'toast',text:"La pompe gronde. L'eau commence à se retirer.",kind:'good'},
             {type:'sound',name:'powerOn'}] });
  m.vcorr(8,30,12);
  m.room(4,12,7,5); m.door(11,14,{}); m.hcorr(11,12,14);
  m.item(6,14,'fuse',1,'n_maint');
  m.room(4,20,7,5); m.door(11,22,{}); m.hcorr(11,12,22);
  m.item(6,22,'fuse',1); m.note(8,23,'f4');
  m.hcorr(12,40,14); m.hcorr(12,40,22);
  m.room(34,11,6,5); m.door(34,14,{});
  m.item(37,13,'fuse',1); m.note(36,12,'n_hale1');
  m.room(34,19,6,6); m.door(34,22,{});
  m.item(37,21,'crowbar',1);
  m.item(36,23,'battery',3);
  m.room(16,27,16,5);
  m.vcorr(22,32,20); m.hcorr(12,20,30); m.vcorr(22,30,12);
  m.door(20,27,{});
  m.puzzle(24,29,{
    type:'fusebox', needFuses:3, label:"Tableau électrique & générateur",
    prompt:"Installer les fusibles et tirer le levier",
    onSolve:[{type:'flag',name:'power'},{type:'toast',text:"Le générateur rugit. La lumière revient... et l'attire.",kind:'good'},
             {type:'sound',name:'powerOn'},{type:'unlockDoor',x:38,y:29},{type:'enrage'},
             {type:'subtitle',text:"Quelque part au-dessus, une porte de fer s'ouvre."}] });
  m.room(40,27,5,5);
  m.door(38,29,{locked:true,key:null,label:"Porte de la morgue (alimentée)"});
  m.hcorr(32,40,29);
  m.setExit(42,29,(st)=>st.flags.power);
  m.locker(15,14); m.locker(28,22); m.locker(18,30);
  m.mob(45,5,{enabled:true,speed:3.0,roam:[[45,5],[12,14],[24,30],[6,22]]});
  m.trigger({ x:12,y:14, r:1.4, action:[
    {type:'sound',name:'whisper'},{type:'subtitle',text:"De l'eau goutte. Puis des pas. Lourds. Mouillés."},{type:'sanity',amount:-6} ] });
  return m;
},

// ================== CHAPTER 4 — LA MORGUE ==================
function ch4() {
  const m = new MapBuilder('ch4', 46, 30);
  m.name = "Chapitre IV — La Morgue";
  m.title = "LA MORGUE";
  m.dread = 0.72;
  m.intro = [
    "La morgue. Des casiers d'acier, du sol au plafond.",
    "Le froid vous mord. Quelque chose frappe — de l'intérieur du casier n°9.",
    "Le directeur a la clé de la chapelle. On dit qu'il y prie encore.",
    "Trouvez le passage vers les étages."
  ];
  m.objective = "Traverser la morgue, récupérer la clé de la chapelle et le scalpel.";

  m.room(3,13,6,4); m.start(4,14,0);
  m.room(9,6,30,18);
  m.hcorr(8,9,14);
  for(let i=0;i<5;i++){
    const x=12+i*5;
    for(let y=8;y<=11;y++) m.grid[y][x]=0;
    for(let y=18;y<=21;y++) m.grid[y][x]=0;
    m.deco(x,8,'cabinet'); m.deco(x,21,'cabinet');
  }
  m.hcorr(9,38,14); m.hcorr(9,38,15);
  m.note(13,14,'n_morgue1');
  m.item(17,15,'scalpel',1);
  m.note(23,15,'n_morgue2');
  m.item(28,14,'battery',2);
  m.item(33,15,'pills',1);
  m.room(40,11,4,6);
  m.door(39,13,{locked:true,key:null,label:"Chambre froide n°9 (scellée)"});
  m.room(20,24,8,5); m.door(23,23,{}); m.vcorr(23,24,23);
  m.item(24,26,'key_chapel',1,'f6');
  m.note(26,27,'f2');
  m.room(40,22,5,5);
  m.door(38,24,{locked:true,key:'key_chapel',label:"Monte-charge — montée"});
  m.hcorr(38,40,24); m.vcorr(15,24,38);
  m.setExit(42,24);
  m.locker(10,20); m.locker(35,9); m.locker(30,16);
  m.mob(38,9,{enabled:true,speed:3.15,roam:[[38,9],[12,14],[24,20],[33,9]]});
  m.trigger({ x:38,y:14, r:1.8, action:[
    {type:'stinger',intensity:1.0},
    {type:'subtitle',text:"Le casier n°9 explose de l'intérieur. La table est vide. Cours."},
    {type:'sanity',amount:-14},{type:'enrage'} ] });
  m.trigger({ x:24,y:14, r:1.4, action:[
    {type:'sound',name:'whisper'},{type:'subtitle',text:"On vous appelle Daniel. Ne répondez pas."},{type:'sanity',amount:-6} ] });
  return m;
},

// ================== CHAPTER 5 — LA CHAPELLE ==================
function ch5() {
  const m = new MapBuilder('ch5', 44, 32);
  m.name = "Chapitre V — La Chapelle";
  m.title = "LA CHAPELLE & LE BUREAU";
  m.dread = 0.82;
  m.intro = [
    "La chapelle. Le seul endroit où le personnel se réfugiait.",
    "Sous l'autel : une amulette. La seule chose qu'il craigne.",
    "Le bureau du directeur, au-dessus, garde le passe du toit.",
    "Prenez l'amulette. Prenez le passe. Préparez-vous à courir."
  ];
  m.objective = "Récupérer l'amulette à l'autel, puis le passe du directeur dans son bureau.";

  m.room(3,27,5,4); m.start(4,28,0);
  m.room(6,8,12,22);
  m.hcorr(5,8,28);
  m.deco(8,12,'pew');m.deco(8,16,'pew');m.deco(8,20,'pew');
  m.deco(15,12,'pew');m.deco(15,16,'pew');m.deco(15,20,'pew');
  m.room(8,4,8,4);
  m.vcorr(4,8,12);
  m.note(11,5,'n_chapel1');
  m.puzzle(12,6,{
    type:'altar', label:"Autel — symboles", solution:[1,2,3,4],
    prompt:"Aligner les symboles du sermon",
    onSolve:[{type:'give',id:'amulet'},{type:'flag',name:'amulet'},
             {type:'toast',text:"Vous saisissez l'amulette. Elle est tiède, vivante.",kind:'good'},
             {type:'sound',name:'pulse'}] });
  m.room(20,8,8,6); m.door(18,10,{}); m.hcorr(18,20,10);
  m.note(23,10,'n_elise'); m.item(24,12,'medkit',1);
  m.room(20,18,8,6); m.door(18,20,{}); m.hcorr(18,20,20);
  m.item(23,20,'battery',3); m.note(25,22,'n_final');
  m.hcorr(18,32,15); m.vcorr(10,15,18);
  m.room(30,6,7,6); m.door(32,12,{}); m.vcorr(12,15,32); m.hcorr(28,32,15);
  m.note(33,7,'n_hale2');
  m.item(34,9,'key_master',1);
  m.item(35,9,'hand_crank',1);
  m.room(34,24,6,5);
  m.door(32,26,{locked:true,key:'key_master',label:"Escalier vers le toit"});
  m.hcorr(28,34,26); m.vcorr(15,26,28);
  m.setExit(37,26,(st)=>st.inv.has('hand_crank'));
  m.locker(10,24); m.locker(22,10); m.locker(26,20);
  m.mob(35,15,{enabled:true,speed:3.25,roam:[[35,15],[12,20],[12,6],[24,20]]});
  m.trigger({ x:31,y:9, r:1.6, action:[
    {type:'subtitle',text:"L'ombre tassée sur le fauteuil se lève. Le directeur n'a plus de visage."},
    {type:'sanity',amount:-10},{type:'enrage'} ] });
  m.trigger({ x:12,y:18, r:1.6, action:[
    {type:'sound',name:'whisper'},{type:'subtitle',text:"Les bancs sont pleins. Vous regardez à nouveau : vides."},{type:'sanity',amount:-8} ] });
  return m;
},

// ================== CHAPTER 6 — L'ÉVASION ==================
function ch6() {
  const m = new MapBuilder('ch6', 42, 30);
  m.name = "Chapitre VI — Le Toit";
  m.title = "L'ÉVASION";
  m.dread = 1.0;
  m.intro = [
    "Dernier étage. Il sait que vous partez. Il est juste derrière.",
    "Le monte-charge mène au toit, mais il faut la manivelle.",
    "Tenez l'amulette. Ne vous arrêtez pas. Ne répondez pas.",
    "Atteignez le monte-charge. Survivez."
  ];
  m.objective = "Atteindre le monte-charge et le manœuvrer avec la manivelle pour fuir par le toit.";

  m.room(2,14,5,4); m.start(3,15,0);
  m.room(7,14,26,3);
  m.hcorr(6,7,15);
  m.room(12,6,6,8); m.vcorr(8,14,14); m.hcorr(12,17,8);
  m.room(20,18,6,8); m.vcorr(17,24,22);
  m.note(14,7,'n_final');
  m.item(15,10,'battery',3);
  m.item(23,22,'medkit',1);
  m.room(26,10,7,12); m.hcorr(33,33,16);
  m.item(29,12,'pills',2);
  m.item(28,20,'battery',2);
  m.room(34,12,6,8);
  m.door(33,16,{label:"Monte-charge"});
  m.puzzle(37,17,{
    type:'crank', label:"Monte-charge", needItem:'hand_crank',
    prompt:"Tourner la manivelle du monte-charge",
    onSolve:[{type:'flag',name:'lift'},{type:'toast',text:"Le monte-charge s'ébranle vers le toit.",kind:'good'},
             {type:'sound',name:'powerOn'}] });
  m.setExit(38,13,(st)=>st.flags.lift);
  m.locker(10,15); m.locker(28,12); m.locker(22,24);
  m.mob(8,15,{enabled:true,speed:3.4,roam:[[8,15],[30,15],[14,8],[22,24]]});
  m.trigger({ x:8,y:15, r:1.3, action:[
    {type:'growl'},{type:'subtitle',text:"IL EST DERRIÈRE VOUS. COUREZ."},{type:'enrage'} ] });
  return m;
}

];

function buildChapter(i){ return Chapters[i](); }
const CHAPTER_COUNT = Chapters.length;
