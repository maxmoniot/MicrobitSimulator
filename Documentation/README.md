# Micro:bit & Cutebot Simulator V2

## 🎯 Nouvelles fonctionnalités

Cette version ajoute un **simulateur micro:bit V2 complet** à l'application existante, avec tous les blocs MakeCode de base.

### ✅ Blocs micro:bit implémentés

#### 📺 Basic (Affichage)
- `afficher nombre` - Affiche un nombre sur la matrice LED
- `afficher icône` - Affiche une icône prédéfinie (cœur, smiley, etc.)
- `afficher LEDs` - Dessine un motif personnalisé (grille 5x5)
- `afficher texte` - Fait défiler du texte
- `afficher flèche` - Affiche une flèche directionnelle
- `effacer écran` - Éteint toutes les LEDs
- `au démarrage` - Code exécuté une fois
- `toujours répéter` - Boucle infinie
- `pause` - Attend un nombre de millisecondes

#### 🎮 Entrées (Input)
- `quand bouton A/B/A+B pressé` - Événement bouton
- `bouton A/B/A+B pressé ?` - Test si bouton enfoncé
- `quand secouer/pencher/...` - Événements gestes
- `quand logo touché` - Logo tactile (V2)
- `logo touché ?` - Test logo (V2)
- `température` - Capteur de température (°C)
- `niveau de lumière` - Capteur de lumière (0-255)
- `direction boussole` - Boussole (0-359°)
- `accélération x/y/z/force` - Accéléromètre
- `rotation pitch/roll` - Inclinaison
- `temps écoulé` - Millisecondes depuis démarrage
- `niveau sonore` - Microphone (V2)

#### 🎵 Musique
- `jouer note` - Joue une note musicale
- `jouer fréquence` - Joue une fréquence personnalisée
- `jouer en continu` - Note continue
- `silence` - Pause silencieuse
- `arrêter tous les sons` - Stop audio
- `tempo / définir tempo / modifier tempo` - Gestion du tempo
- `durée d'un temps` - Calcul durée selon tempo
- `haut-parleur activé/désactivé` - Contrôle speaker (V2)
- `jouer son` - Effets sonores prédéfinis (V2)

#### 💡 LED (Contrôle avancé)
- `allumer LED x y` - Allume un pixel
- `éteindre LED x y` - Éteint un pixel
- `inverser LED x y` - Toggle un pixel
- `LED allumée ? x y` - Test état pixel
- `luminosité / définir luminosité` - Gestion luminosité
- `arrêter animation` - Stop animation en cours
- `graphique valeur max` - Affiche un bar graph
- `activer écran oui/non` - Active/désactive écran

#### 📻 Radio
- `définir groupe radio` - Configure le groupe (0-255)
- `envoyer nombre/texte/valeur` - Émission radio
- `quand nombre/texte reçu` - Réception radio
- `puissance émission` - Régler puissance (0-7)
- `paquet reçu` - Propriétés du paquet

---

## 🖥️ Simulateur Micro:bit V2

Le simulateur inclut :

### Matrice LED 5x5
- Affichage rouge avec effet de lueur
- Animation fluide
- Support luminosité variable

### Boutons A et B
- Cliquables à la souris
- Raccourcis clavier (A et B)
- Support A+B simultané

### Logo tactile (V2)
- Zone dorée cliquable
- Événements toucher/relâcher

### Capteurs simulés
- **Température** : Slider -5°C à 50°C
- **Lumière** : Slider 0-255
- **Boussole** : Slider 0-359°
- **Accéléromètre** : Pad 2D draggable
- **Bouton Secouer** : Déclenche le geste shake

### Audio (V2)
- Haut-parleur avec Web Audio API
- Notes musicales réelles
- Effets sonores basiques

---

## 🤖 Simulateur Cutebot (existant)

Toutes les fonctionnalités existantes sont conservées :
- Moteurs avec vitesse variable
- LEDs RGB
- Capteurs de ligne
- Capteur ultrasonique
- Servomoteurs
- Télécommande IR

---

## 📁 Structure des fichiers

```
microbit-complete/
├── index.html              # Page principale
├── css/
│   └── styles.css          # Styles combinés
├── js/
│   ├── blockly.min.js      # Blockly v12.3.1
│   ├── app.js              # Application principale
│   ├── cutebot-blocks.js   # Blocs Cutebot
│   ├── cutebot-simulator.js # Simulateur Cutebot
│   ├── microbit-blocks-basic.js    # Blocs Basic/Input/LED
│   ├── microbit-blocks-music-radio.js # Blocs Music/Radio
│   ├── microbit-simulator.js # Simulateur micro:bit
│   ├── microbit-runtime.js # Runtime micro:bit
│   └── hex-generator.js    # Export MakeCode
└── Documentation/
    └── README.md           # Ce fichier
```

---

## 🚀 Export vers MakeCode

Le code est automatiquement converti en TypeScript MakeCode :

1. Cliquez sur **"Code"** pour voir le code généré
2. Cliquez sur **"MakeCode"** pour ouvrir dans l'éditeur en ligne
3. Dans MakeCode, téléchargez le fichier HEX
4. Copiez le HEX sur votre micro:bit

### Dépendances automatiques
- Extension **cutebot** ajoutée si blocs cutebot utilisés
- Extension **radio** ajoutée si blocs radio utilisés

---

## ⚠️ Limitations

### Simulation
- **Radio** : Pas de communication réelle entre simulateurs (local seulement)
- **Bluetooth** : Non supporté
- **Pins GPIO** : Partiellement supporté
- **Serial** : Non supporté

### V2 spécifique
- Sons basiques (pas les vrais effets MakeCode)
- Microphone simulé (toujours 0)

---

## 🔧 Personnalisation

### Ajouter une icône
Dans `microbit-simulator.js`, ajoutez au dictionnaire `icons` :
```javascript
'MonIcone': `
    #.#.#
    .#.#.
    #.#.#
    .#.#.
    #.#.#
`
```

### Ajouter un bloc
1. Définir le bloc dans le fichier blocks approprié
2. Ajouter le générateur JavaScript
3. Ajouter la fonction runtime
4. Ajouter au toolbox XML
5. Mettre à jour hex-generator.js pour l'export

---

## 📝 Changelog

### Version 2.0
- Ajout du simulateur micro:bit V2 complet
- 50+ nouveaux blocs MakeCode
- Interface avec 2 simulateurs côte à côte
- Export MakeCode amélioré avec dépendances auto
- Support audio avec Web Audio API
