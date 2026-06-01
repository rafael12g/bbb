/* ============================================================
   BLACKWOOD — Item definitions
   ============================================================ */
const ITEMS = {
  battery:    { name:"Pile",            icon:"🔋", stack:true,  desc:"Recharge la lampe torche de ~35%." },
  medkit:     { name:"Trousse de soin", icon:"💊", stack:true,  desc:"Stabilise l'esprit : +40 de santé mentale." },
  pills:      { name:"Anxiolytiques",   icon:"💉", stack:true,  desc:"Calme la panique : +20 santé mentale." },
  match:      { name:"Allumettes",      icon:"🔥", stack:true,  desc:"Une lueur brève quand la lampe est morte." },

  key_ward:   { name:"Clé du quartier", icon:"🗝️", stack:false, desc:"Ouvre la porte du quartier des patients." },
  key_morgue: { name:"Clé de la morgue", icon:"🗝️", stack:false, desc:"Glaciale au toucher." },
  key_chapel: { name:"Clé de la chapelle", icon:"✝️", stack:false, desc:"Gravée d'une croix renversée." },
  key_master: { name:"Passe du directeur", icon:"🔐", stack:false, desc:"Ouvre presque tout. Presque." },

  fuse:       { name:"Fusible",         icon:"⚡", stack:true,  desc:"Pour rétablir le courant d'un tableau électrique." },
  crowbar:    { name:"Pied-de-biche",   icon:"⛏️", stack:false, desc:"Force certaines portes condamnées." },
  hand_crank: { name:"Manivelle",       icon:"🔧", stack:false, desc:"Pour le monte-charge." },
  doll:       { name:"Poupée d'Élise",  icon:"🧸", stack:false, desc:"Elle vous fixe. Quelqu'un la cherche." },
  amulet:     { name:"Amulette",        icon:"🔱", stack:false, desc:"Tiède. Elle semble le tenir à distance." },
  scalpel:    { name:"Scalpel",         icon:"🔪", stack:false, desc:"Coupant. De quoi vous défendre. Une fois." },
};

function itemDef(id){ return ITEMS[id] || { name:id, icon:"📦", stack:false, desc:"" }; }
