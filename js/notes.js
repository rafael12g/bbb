/* ============================================================
   BLACKWOOD — Notes & lore (the story is told through documents)
   ============================================================ */
const NOTES = {
  // ---- Chapter 1 ----
  n_intro: { title:"Ton propre carnet", body:
`28 octobre.

Je m'appelle Daniel Reyes. Journaliste. On m'a payé pour entrer
ici et photographier ce qui reste de l'Institut Blackwood avant
la démolition.

La grille était ouverte. Ça ne va pas. Et la voiture ne démarre
plus.

Tant pis. Je prends mes photos, et je sors avant la nuit.

...Il fait déjà nuit.` },

  n_admission: { title:"Registre d'admission", body:
`INSTITUT BLACKWOOD — REGISTRE D'ADMISSION

Patient #0049 — admis le 03/02
Diagnostic : "états dissociatifs sévères, hallucinations
collectives". Transféré du pavillon E sur ordre du Dr Hale.

Note manuscrite en marge :
« Ce n'est pas un patient. Ne le laissez JAMAIS dans le noir. »` },

  n_keyhint1: { title:"Mémo du gardien", body:
`Pour Tom —

J'en ai marre de chercher la clé du quartier des patients
toutes les nuits. Je l'ai laissée dans le tiroir du bureau
d'accueil, derrière le comptoir.

Et arrête de couper les lumières du couloir pour économiser.
Tu sais pourquoi.
                                              — R.` },

  n_rules: { title:"Affiche — Règlement du personnel", body:
`RÈGLEMENT INTÉRIEUR — À AFFICHER

1. Les lumières des couloirs restent allumées EN PERMANENCE.
2. Ne jamais répondre si on vous appelle par votre prénom.
3. Le sous-sol est interdit après 20h00.
4. En cas d'extinction générale : rejoignez la chapelle.
   NE COUREZ PAS. Il suit le bruit.
5. Si vous le voyez : ne le regardez pas. Éteignez votre lampe.` },

  // ---- Chapter 2 ----
  n_diary1: { title:"Journal d'une infirmière (1/3)", body:
`Ils l'appellent le 0049 mais il n'a pas de nom dans le dossier.
Pas de photo non plus. Quand on le photographie, la pellicule
ressort noire.

La nuit, les autres patients récitent les mêmes mots, en même
temps, dans des chambres séparées :
« Il a faim. Il a faim. Il a faim. »

Je n'arrive plus à dormir.` },

  n_diary2: { title:"Journal d'une infirmière (2/3)", body:
`Le Dr Hale a ordonné les "séances". Il croit qu'on peut le
nourrir avec autre chose que de la peur. Il se trompe.

Trois patients ont disparu cette semaine. Le registre dit
"sortis guéris". Personne n'est jamais sorti d'ici guéri.

Code de la pharmacie, si jamais : la date de naissance
d'Élise. Hale l'a choisi. 0-3-1-2.` },

  n_diary3: { title:"Journal d'une infirmière (3/3)", body:
`Dernière entrée.

Je pars cette nuit. J'ai pris une clé de la morgue, c'est le
seul chemin vers le quai de chargement.

Si tu lis ça : la lumière ne le tue pas. Elle l'attire, mais
elle te garde lucide. Le vrai danger, c'est le noir dans ta
tête. Reste toi-même.

Et l'amulette dans la chapelle — elle est réelle. Prends-la.` },

  n_child: { title:"Dessin d'enfant", body:
`(Un dessin au crayon. Une grande silhouette noire, trop de
bras, sans visage. À côté, une petite fille la tient par la
main.)

En haut, d'une écriture maladroite :
« MON AMI N'AIME PAS QUE JE PARTE »

En bas :
« Élise — chambre 7 »` },

  n_padcode: { title:"Bout de papier froissé", body:
`pharmacie — 0312
ne pas oublier
(il regarde quand j'écris)` },

  // ---- Chapter 3 ----
  n_maint: { title:"Carnet de maintenance", body:
`Générateur principal : H.S. depuis trois jours.

Pour le redémarrer : remettre les TROIS fusibles dans le
tableau, PUIS tirer le levier rouge. Pas l'inverse, ou ça
saute encore.

Les fusibles ont disparu. Je parie que ce sont les patients.
Ils n'aiment pas la lumière non plus, maintenant.` },

  n_valvenote: { title:"Note tachée d'eau", body:
`Le sous-sol est inondé. La pompe ne tourne pas tant que les
vannes ne sont pas dans le bon ordre.

De mémoire : ENTRÉE d'abord, puis PURGE, puis SORTIE.
Bleu, puis rouge, puis vert. Sinon les tuyaux explosent.` },

  n_hale1: { title:"Journal du Dr Hale (1/2)", body:
`Je l'ai compris trop tard. Le 0049 n'est pas malade.
C'est ce que deviennent les autres quand on les laisse seuls
avec lui assez longtemps. Il se nourrit. Et il grandit.

J'ai tenté de l'enfermer dans la chambre froide de la morgue.
Le froid le ralentit. Mais il faut le courant pour le froid.
Et le courant attire les patients vers lui.

Quel cercle parfait j'ai construit.` },

  // ---- Chapter 4 ----
  n_morgue1: { title:"Étiquette d'orteil", body:
`CASIER 4 — NON IDENTIFIÉ
"Présentait des plaies impossibles à recoudre.
Le corps a disparu de la table à 03h12.
Cesser d'ouvrir le casier 4."` },

  n_morgue2: { title:"Procès-verbal", body:
`Nous avons scellé la chambre froide n°9. Le directeur a
ordonné qu'on n'y entre plus.

La clé de la chapelle est avec lui, dans son bureau au dernier
étage. Il dit qu'il y prie. On ne l'a pas revu depuis six jours.

On entend frapper, parfois. De l'intérieur du n°9.` },

  // ---- Chapter 5 ----
  n_chapel1: { title:"Sermon inachevé", body:
`« ...et nous avons cru pouvoir le contenir entre quatre murs
et une prière. Mais on ne marchande pas avec la faim.

J'ai caché l'amulette sous l'autel. C'est la seule chose qu'il
craigne — un vieux symbole, plus ancien que cet hôpital.

Pour l'autel, l'ordre des symboles est celui du vitrail :
l'ŒIL, la FLAMME, la CROIX, la MAIN.

Posez l'amulette sur lui. Forcez-le à reculer. Puis fuyez. »` },

  n_hale2: { title:"Journal du Dr Hale (2/2)", body:
`Dernière entrée.

Il connaît mon prénom maintenant. Il l'a dit avec ma propre
voix, derrière la porte.

Le passe est sur moi. Il ouvre le bureau, et le bureau ouvre
le toit. De là, l'échelle de secours mène au quai.

Si vous trouvez ce carnet, c'est que vous êtes vivant. Pas pour
longtemps. Prenez le passe. Ne vous arrêtez pas. Et quoi qu'il
arrive — ne répondez pas quand il vous appellera Daniel.` },

  n_elise: { title:"Lettre d'Élise", body:
`Pour le monsieur qui lit.

Mon ami dit que tu veux partir. Il est triste. Il veut juste
que quelqu'un reste avec lui dans le noir, pour toujours.

Moi je suis restée. C'est pas si mal. On ne sent plus le froid
après.

Si tu pars, rends-moi ma poupée. S'il te plaît.` },

  // ---- Chapter 6 ----
  n_final: { title:"Mot griffonné sur le mur", body:
`IL N'Y A PAS DE DEHORS
IL N'Y A PAS DE DEHORS
IL N'Y A PAS DE DEHORS

(plus bas, d'une autre main, presque effacé :)
si. le toit. cours.` },

  // ---- flavor notes ----
  f1:{title:"Graffiti", body:`« 49 nous regarde dormir »`},
  f2:{title:"Ordonnance", body:`Patient agité — augmenter la sédation.\nNe fonctionne pas. Rien ne le fait dormir.`},
  f3:{title:"Carte postale", body:`"Vivement les vacances. Je déteste les gardes de nuit ici.\nHier j'ai compté treize patients au réfectoire.\nIl n'y en a que douze d'admis."`},
  f4:{title:"Liste de courses", body:`- ampoules (BEAUCOUP)\n- piles\n- sel (pour les portes ?? - R. insiste)\n- somnifères`},
  f5:{title:"Bulletin scolaire", body:`Élise H. — 6 ans.\n"Élève rêveuse. Parle souvent d'un ami invisible. À surveiller."\nSigné : son père, le Directeur.`},
  f6:{title:"Étiquette de médicament", body:`HALOPÉRIDOL — ne pas dépasser la dose.\n(sous l'étiquette, gravé dans le plastique : "ça l'entend")`},
};

function noteDef(id){ return NOTES[id] || { title:"Document", body:"(illisible)" }; }
