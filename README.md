# Micro:bit Simulator

Environnement de programmation par blocs pour le micro:bit V2, avec simulateurs visuels intégrés pour plusieurs maquettes pédagogiques : robot Cutebot, double barrière, portillon automatique et module RFID.

Développé pour un usage en classe de technologie au collège. Les élèves programment en blocs (style MakeCode), testent dans le simulateur, puis exportent directement sur le micro:bit réel via USB ou fichier HEX.

## Fonctionnalités principales

**Programmation par blocs** — Éditeur Blockly avec une toolbox organisée par catégories (Base, Entrées, Musique, Radio, LEDs, Logique, Boucles, Variables, Maths, Moteurs, Capteurs, Servo, IR, RFID). Les blocs sont visuellement proches de MakeCode pour faciliter la transition.

**Simulateur micro:bit** — Carte micro:bit V2 interactive avec matrice LED 5×5, boutons A/B, capteurs (température, luminosité, boussole, son, accéléromètre, force magnétique), haut-parleur et broche tactile.

**Simulateur Cutebot** — Robot mobile avec moteurs indépendants, capteurs de suivi de ligne, capteur ultrason, LEDs RGB et servomoteurs. Canvas de simulation avec dessin de pistes.

**Simulateur Double Barrière** — Maquette de parking avec deux barrières motorisées, capteurs de présence et engrenages animés.

**Simulateur Portillon** — Portillon automatique avec servomoteur, badge RFID et capteur de passage.

**Module RFID (MFRC522)** — Lecture/écriture de badges RFID en simulation et sur matériel réel. Bibliothèque MicroPython compatible avec le module MFRC522 connecté en SPI.

**Système radio** — Communication entre deux cartes micro:bit simulées. La carte 2 (distante) peut être programmée indépendamment ou dupliquer la carte 1.

**Télécommande IR** — Support des télécommandes infrarouges (IRC389 et autres) pour le pilotage du Cutebot.

**Export multi-format** — Génération de fichier HEX universel (V1+V2) avec MicroPython, téléversement direct via WebUSB (Chrome/Edge), ou export .mkcd pour MakeCode.

**Correction automatique** — Page dédiée (correction.html) pour comparer le programme d'un élève à une référence, avec système de notation par critères.

## Structure du projet

```
microbit-simulator/
├── index.html                 # Application principale
├── correction.html            # Outil de correction enseignant
├── css/
│   ├── styles.css             # Styles généraux
│   ├── simulator-panels.css   # Styles des panneaux simulateurs
│   ├── microbit-styles.css    # Styles spécifiques micro:bit
│   ├── custom-toolbox.css     # Toolbox Blockly personnalisée
│   └── ...
├── js/
│   ├── app.js                 # Application principale, gestion des cartes, sauvegarde/chargement
│   ├── cutebot-blocks.js      # Définition de tous les blocs Blockly + générateurs de code
│   ├── microbit-simulator.js  # Simulateur de la carte micro:bit (SVG, LEDs, capteurs)
│   ├── microbit-runtime.js    # Runtime d'exécution (fonctions __mb* appelées par le code généré)
│   ├── cutebot-simulator.js   # Simulateur du robot Cutebot (canvas, moteurs, capteurs)
│   ├── barrier-simulator.js   # Simulateur double barrière
│   ├── portillon-simulator.js # Simulateur portillon automatique
│   ├── radio-simulator.js     # Système radio et gestion de la carte 2
│   ├── simulator-panels.js    # Gestion des panneaux redimensionnables
│   ├── hex-generator.js       # Génération HEX, export mkcd, dialogues WebUSB
│   ├── webusb-flasher.js      # Téléversement WebUSB via @microbit/microbit-connection
│   ├── ir-remote-config.js    # Configuration des télécommandes IR
│   ├── rfid-blocks.js         # Blocs RFID
│   ├── servo-blocks.js        # Blocs servo
│   ├── microbit-blocks-basic.js       # Blocs micro:bit de base
│   ├── microbit-blocks-music-radio.js # Blocs musique et radio
│   ├── field-led-matrix.js    # Champ personnalisé matrice LED 5×5
│   ├── field-color-dropdown.js # Sélecteur de couleur pour LEDs
│   ├── microbit-fs-bundle.js  # Librairie @microbit/microbit-fs (filesystem HEX)
│   ├── blockly.min.js         # Blockly (Google)
│   └── ...
├── firmware/
│   ├── micropython-v1.hex     # Firmware MicroPython micro:bit V1
│   ├── micropython-v2.hex     # Firmware MicroPython micro:bit V2
│   ├── Cutebot.py             # Librairie MicroPython Cutebot
│   └── MFRC522.py             # Librairie MicroPython RFID MFRC522
├── images/
│   ├── Microbit.svg           # SVG de la carte micro:bit
│   ├── Portillon.svg          # SVG du portillon
│   ├── ModuleRFID.svg         # SVG du module RFID
│   └── ...
└── README.md
```

## Installation

L'application est entièrement côté client (HTML/CSS/JS). Aucun serveur applicatif n'est nécessaire.

Placez le dossier sur un serveur web (Apache, Nginx, ou tout hébergement statique) et ouvrez `index.html` dans un navigateur. L'application fonctionne aussi en local via `file://` pour la plupart des fonctionnalités, sauf WebUSB qui nécessite HTTPS ou localhost.

## Utilisation

### Programmation

L'éditeur de blocs occupe la partie gauche. La toolbox à gauche contient les catégories de blocs. Glissez-déposez les blocs pour construire votre programme. Le bloc « au démarrage » s'exécute une fois, le bloc « toujours » tourne en boucle.

Le bloc **pause** est en secondes (pas en millisecondes). Les élèves peuvent utiliser la virgule française : `0,5` est accepté pour une demi-seconde.

### Simulateurs

Les simulateurs occupent la partie droite, dans des panneaux redimensionnables et réorganisables par glisser-déposer. Chaque panneau peut être réduit ou agrandi. Le séparateur vertical entre l'éditeur et les simulateurs se déplace par glisser (double-clic pour réinitialiser).

Les panneaux de simulateurs s'ouvrent automatiquement en fonction des blocs utilisés dans le programme. Par exemple, utiliser un bloc moteur ouvre le simulateur Cutebot.

### Système deux cartes

Pour les projets radio, une deuxième carte micro:bit est disponible dans le panneau Radio. Par défaut elle duplique le programme de la carte 1. Décochez « Dupliquer le programme de la carte principale » pour la programmer indépendamment. Le passage entre les cartes se fait via les boutons en haut de l'éditeur.

### Export vers le micro:bit réel

Cliquez sur le bouton de téléchargement en haut de l'éditeur.

Sur **Chrome ou Edge**, un dialogue propose deux options : téléverser directement via USB (WebUSB) ou télécharger le fichier HEX. Pour le téléversement direct, connectez le micro:bit en USB et sélectionnez « BBC micro:bit CMSIS-DAP » dans la fenêtre du navigateur.

Sur **Firefox** ou autres navigateurs, le fichier HEX est téléchargé automatiquement. Copiez-le sur le lecteur MICROBIT qui apparaît quand le micro:bit est branché.

Les programmes utilisant la **télécommande IR** sont exportés en fichier `.mkcd` (incompatible HEX MicroPython). Ce fichier s'importe dans MakeCode (makecode.microbit.org → Importer → Importer un fichier).

### Sauvegarde et chargement

Le bouton « Charger » accepte les formats `.xml`, `.json`, `.hex` et `.mkcd`. Les fichiers HEX et mkcd exportés par l'application embarquent les données Blockly et peuvent être rechargés ultérieurement.

### Correction

La page `correction.html` permet à l'enseignant de comparer le programme d'un élève à une référence. Elle charge deux fichiers XML/HEX et évalue la correspondance par critères configurables.

## Notes techniques

Le code généré par les blocs est du JavaScript exécuté dans le navigateur via `eval()`. Les fonctions préfixées `__mb` et `__` servent de pont entre le code généré et les simulateurs.

Pour l'export matériel, le JavaScript est converti en MicroPython (via des regex dans `hex-generator.js`) puis intégré dans un fichier HEX universel grâce à la librairie `@microbit/microbit-fs`. Les firmwares MicroPython V1 et V2 sont embarqués dans le dossier `firmware/`.

Le module RFID utilise le protocole SPI (mode 0, 1MHz) sur les broches P13-P16. La bibliothèque `MFRC522.py` est un portage fidèle de l'extension MakeCode `pxt-rfid-mfrc522` de Joy-IT, compatible avec les blocs RFID du simulateur.

## Licence

Application éducative développée pour l'enseignement de la technologie au collège.

© 2025-2026
