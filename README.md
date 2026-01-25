# 🎓 Micro:bit Simulator

Application web de programmation par blocs pour **micro:bit** avec simulateurs visuels intégrés. Conçue pour l'enseignement de la technologie au collège.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Web-brightgreen.svg)

## ✨ Fonctionnalités

### 🧱 Programmation par blocs
- Interface visuelle style MakeCode/Scratch
- Blocs en français
- Catégories : Base, Entrées, Musique, LED, Radio, Boucles, Logique, Variables, Mathématiques

### 📟 Simulateur micro:bit
- Matrice LED 5x5 interactive
- Boutons A, B et A+B
- Capteurs simulés (température, luminosité, accéléromètre, boussole)
- Gestes (secouer, incliner, chute libre...)

### 🤖 Simulateur Cutebot
- Robot virtuel avec déplacement en temps réel
- Capteurs de suivi de ligne
- Capteur ultrason
- LEDs RGB
- Servomoteurs
- Télécommande IR
- Pince (gripper)
- Piste de dessin personnalisable

### 🚧 Simulateur Barrière
- Servomoteur pour barrière automatique
- Scénarios de parking/péage

### 🚪 Simulateur Portillon RFID
- Module RFID MFRC522
- Badges virtuels à scanner
- Gestion d'accès

### 📡 Communication Radio
- Simulation de communication entre 2 cartes micro:bit
- Envoi/réception de nombres et textes
- Groupes radio configurables

### 🔌 Téléversement WebUSB
- **Chrome/Edge** : Téléversement direct sur micro:bit branché (sans copier de fichier !)
- **Firefox** : Téléchargement du fichier HEX à copier manuellement
- Détection automatique du micro:bit appairé

## 🚀 Installation

### Option 1 : Hébergement local (XAMPP/WAMP)

1. Téléchargez ou clonez ce dépôt
2. Copiez le dossier dans `htdocs/` (XAMPP) ou `www/` (WAMP)
3. Démarrez Apache
4. Ouvrez `http://localhost/microbit-simulator/`

### Option 2 : Serveur web

Uploadez simplement tous les fichiers sur votre serveur web. L'application fonctionne entièrement côté client (HTML/CSS/JS).

### Option 3 : Ouverture directe

Ouvrez `index.html` directement dans votre navigateur. 
> ⚠️ Certaines fonctionnalités (chargement des firmwares) peuvent ne pas fonctionner en mode fichier local.

## 📁 Structure du projet

```
microbit-simulator/
├── index.html                 # Page principale
├── README.md                  # Ce fichier
├── css/
│   ├── styles.css            # Styles principaux
│   ├── simulator-panels.css  # Styles des panneaux
│   └── ...
├── js/
│   ├── app.js                # Application principale
│   ├── blockly.min.js        # Bibliothèque Blockly
│   ├── microbit-blocks-*.js  # Définitions des blocs
│   ├── cutebot-blocks.js     # Blocs Cutebot
│   ├── rfid-blocks.js        # Blocs RFID
│   ├── servo-blocks.js       # Blocs Servo
│   ├── microbit-simulator.js # Simulateur micro:bit
│   ├── cutebot-simulator.js  # Simulateur Cutebot
│   ├── barrier-simulator.js  # Simulateur Barrière
│   ├── portillon-simulator.js# Simulateur Portillon
│   ├── radio-simulator.js    # Communication radio
│   ├── hex-generator.js      # Génération fichiers HEX
│   ├── webusb-flasher.js     # Téléversement WebUSB
│   └── microbit-fs-bundle.js # Gestion système fichiers micro:bit
├── firmware/
│   ├── micropython-v1.hex    # Firmware MicroPython V1
│   ├── micropython-v2.hex    # Firmware MicroPython V2
│   ├── Cutebot.py            # Bibliothèque Cutebot
│   └── MFRC522.py            # Bibliothèque RFID
├── images/
│   ├── Microbit.svg          # Image micro:bit
│   ├── Badge.svg             # Image badge RFID
│   └── ...
└── Documentation/
    └── ...
```

## 🎮 Guide d'utilisation

### Programmer

1. **Glissez-déposez** les blocs depuis la boîte à outils (gauche)
2. **Assemblez** les blocs dans l'espace de travail
3. Cliquez sur **▶ Exécuter** pour tester dans le simulateur

### Simulateur micro:bit

| Action | Comment faire |
|--------|---------------|
| Appuyer sur A | Cliquez sur le bouton A |
| Appuyer sur B | Cliquez sur le bouton B |
| Appuyer sur A+B | Cliquez sur les deux simultanément |
| Secouer | Cliquez sur le bouton "Secouer" |

### Simulateur Cutebot

| Action | Comment faire |
|--------|---------------|
| Déplacer le robot | Cliquez et glissez |
| Tourner le robot | Shift + clic et glissez |
| Dessiner une ligne | Mode "✏️ Ligne" puis dessinez |
| Effacer la piste | Bouton "🧹 Effacer" |

### Téléverser sur micro:bit

#### Avec Chrome/Edge (recommandé)
1. Branchez votre micro:bit en USB
2. Cliquez sur **"Télécharger mon programme"**
3. Si c'est la première fois, appairez votre micro:bit
4. Le programme est envoyé automatiquement ! ✨

#### Avec Firefox
1. Cliquez sur **"Télécharger mon programme"**
2. Un fichier `.hex` est téléchargé
3. Copiez-le sur le lecteur `MICROBIT`

## 🔧 Configuration requise

- **Navigateur moderne** : Chrome, Edge, Firefox, Safari
- **WebUSB** (optionnel) : Chrome 61+ ou Edge 79+ pour le téléversement direct
- **Résolution** : 1280x720 minimum recommandé

## 📦 Dépendances

- [Blockly](https://developers.google.com/blockly) - Éditeur de blocs visuel (Google)
- [@microbit/microbit-fs](https://github.com/microbit-foundation/microbit-fs) - Gestion fichiers micro:bit
- [@microbit/microbit-connection](https://github.com/microbit-foundation/microbit-connection) - WebUSB (chargé dynamiquement)

## 🎯 Cas d'usage pédagogiques

### Collège - Technologie
- **5ème** : Découverte de la programmation, LED, boutons
- **4ème** : Capteurs, boucles, conditions, robot Cutebot
- **3ème** : Communication radio, projets complets (barrière, portillon)

### Exemples de projets
- 🚗 Robot suiveur de ligne
- 🅿️ Barrière de parking automatique
- 🚪 Contrôle d'accès par badge RFID
- 🎮 Jeux sur matrice LED
- 📡 Communication entre micro:bits

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- 🐛 Signaler des bugs
- 💡 Proposer des améliorations
- 🔧 Soumettre des pull requests

## ❤️ Soutenir le projet

Si cette application vous est utile, vous pouvez soutenir son développement :

👉 **[Tipeee - MaxTechno](https://fr.tipeee.com/maxtechno/)**

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 👤 Auteur

**Max** - Professeur de Technologie

---

<p align="center">
  <i>Application créée avec ❤️ pour l'enseignement de la technologie</i>
</p>
