# 🤖 Cutebot Simulator

Application de programmation par blocs pour le robot Cutebot avec simulateur visuel intégré.

## 📁 Structure des fichiers

```
cutebot-simulator/
├── index.html          # Page principale
├── css/
│   └── styles.css      # Styles de l'application
├── js/
│   ├── cutebot-blocks.js    # Définition des blocs Blockly
│   ├── cutebot-simulator.js # Simulateur du robot
│   ├── hex-generator.js     # Générateur de fichier HEX
│   └── app.js               # Application principale
└── README.md           # Ce fichier
```

## 🚀 Installation avec XAMPP

1. **Copiez le dossier** `cutebot-simulator` dans `C:\xampp\htdocs\`

2. **Démarrez Apache** dans le panneau de contrôle XAMPP

3. **Ouvrez votre navigateur** : `http://localhost/cutebot-simulator/`

## 🎮 Utilisation

### Éditeur de blocs (gauche)
- Glissez-déposez les blocs depuis la boîte à outils
- Les catégories contiennent tous les blocs Cutebot

### Simulateur (droite)
- **Déplacer le robot** : Cliquez et glissez
- **Tourner le robot** : Shift + clic et glissez
- **Dessiner une ligne** : Cliquez sur "✏️ Ligne" puis dessinez
- **Effacer** : Cliquez sur "🧹 Effacer"
- **Largeur de trait** : Ajustez avec le curseur (18-20px recommandé)

### Boutons
| Bouton | Action |
|--------|--------|
| ▶ Exécuter | Lance le programme |
| ⏹ Arrêter | Stoppe l'exécution |
| ↺ Réinitialiser | Remet le robot à zéro |
| Voir le code | Affiche le TypeScript |
| Télécharger HEX | Génère le fichier pour micro:bit |

## 📦 Blocs disponibles

### 🚗 Moteurs
- Vitesse roue gauche/droite (-100 à 100%)
- Avancer/reculer pendant X secondes
- Avancer/reculer pleine vitesse
- Tourner gauche/droite
- Arrêter

### 💡 LEDs
- Couleur avec sélecteur
- Couleur RGB (0-255)
- Éteindre

### 📏 Capteurs
- État des capteurs de ligne (● ● / ◌ ● / ● ◌ / ◌ ◌)
- Capteur gauche/droit trouve/perd ligne
- Distance ultrason (cm ou pouces)

### 📡 Événements
- Quand capteur trouve/perd ligne
- Quand signal IR reçu
- Bouton IR pressé

### ⚙️ Servo
- Angle servo S1/S2 (0-180°)

## 📥 Obtenir le fichier HEX

1. Cliquez sur **"Télécharger HEX"**
2. Un fichier `cutebot-program.mkcd` est téléchargé
3. Ouvrez [makecode.microbit.org](https://makecode.microbit.org)
4. Cliquez sur **"Importer"** → **"Importer un fichier..."**
5. Sélectionnez le fichier `.mkcd`
6. Cliquez sur **"Télécharger"** pour obtenir le `.hex`
7. Copiez le fichier `.hex` sur le micro:bit

## 💡 Conseils

- **Ligne de suivi** : Tracez des lignes noires de 15-20 pixels d'épaisseur
- **Capteurs** : Les deux capteurs sont très rapprochés (comme le vrai robot)
- **Testez** toujours dans le simulateur avant de transférer sur le micro:bit

## 🐛 Dépannage

### Le simulateur ne démarre pas
- Vérifiez la console (F12) pour les erreurs
- Rafraîchissez la page

### Les capteurs ne détectent pas la ligne
- Augmentez l'épaisseur de la ligne
- La ligne doit être bien noire

### Le fichier HEX ne fonctionne pas
- Vérifiez que vous avez importé le `.mkcd` dans MakeCode
- L'extension Cutebot doit être automatiquement ajoutée

---

© 2025 - Application éducative pour le robot Cutebot (ELECFREAKS)
