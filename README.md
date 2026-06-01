# BLACKWOOD

**Un survival-horror jouable directement dans le navigateur. Aucune installation, aucune dépendance.**

Vous êtes Daniel Reyes, journaliste, enfermé pour la nuit dans l'Institut psychiatrique
abandonné de Blackwood. Quelque chose y vit encore — le « patient 0049 ». Trouvez la sortie,
chapitre après chapitre, en gérant votre lampe torche, votre santé mentale et le bruit que
vous faites. La lumière vous garde lucide... mais elle l'attire.

## ▶ Jouer

Ouvrez simplement **`index.html`** dans un navigateur moderne (Chrome, Firefox, Edge).

> Pour le son (généré en temps réel), cliquez une fois dans la page.
> Au casque et dans le noir pour l'expérience complète.

Aucun serveur n'est nécessaire, mais si vous préférez :

```bash
python3 -m http.server 8000
# puis ouvrez http://localhost:8000
```

## 🎮 Commandes

| Touche | Action |
|---|---|
| `Z Q S D` / Flèches | Se déplacer |
| Souris | Orienter la lampe torche |
| `Maj` | Courir (consomme l'endurance, fait du bruit) |
| `E` | Interagir / Ramasser / Ouvrir / Lire |
| `F` | Allumer / éteindre la lampe |
| `Espace` | Se cacher dans un casier / en sortir |
| `1`–`6` | Utiliser un objet de la barre |
| `I` | Inventaire · `J` Journal · `Échap` Pause |

## 🩸 Mécaniques

- **Lampe & batterie** — la lumière vous protège mentalement et révèle les lieux,
  mais attire la créature de loin. Les piles sont rares.
- **Santé mentale** — chute dans l'obscurité ; à bas niveau : hallucinations,
  murmures, distorsions. À zéro, l'esprit cède.
- **Le bruit** — courir et claquer les portes guide la créature, qui *entend* autant
  qu'elle *voit*. Marchez. Cachez-vous. Coupez la lampe quand elle approche.
- **IA de traque** — patrouille, enquête sur les bruits, poursuite avec recherche de
  chemin (BFS) et ligne de vue.
- **6 chapitres** — Accueil, Quartier des patients, Sous-sol, Morgue, Chapelle, Évasion.
  Clés, digicodes, vannes, fusibles, autel, monte-charge — et une histoire racontée
  par les documents trouvés. Sauvegarde automatique à chaque chapitre.

## 🛠 Technique

100 % client : moteur de jeu, **éclairage dynamique par lancer de rayons**, IA,
**audio synthétisé via la Web Audio API** et rendu **Canvas 2D**. Pas d'assets externes.

```
index.html        – structure & overlays
css/style.css     – ambiance visuelle (vignette, grain, écrans)
js/audio.js       – moteur audio procédural (drone, cœur, cris, stingers...)
js/lighting.js    – champ de vision & cône de lampe (raycast)
js/maps.js        – constructeur de cartes + 6 chapitres
js/entities.js    – joueur & IA de la créature
js/puzzles.js     – énigmes (digicode, vannes, fusibles, autel, manivelle)
js/game.js        – boucle, état, rendu, interactions, sauvegarde
js/ui.js · input.js · save.js · items.js · notes.js · pathfind.js
```

*Œuvre de fiction. Contient des thèmes et scènes pouvant heurter la sensibilité.*
