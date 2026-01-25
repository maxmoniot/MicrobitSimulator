# Guide de modification de la Toolbox - Cutebot Simulator

## Architecture actuelle

```
js/
├── blockly.min.js      ← Blockly LOCAL (v12.3.1) - NE PAS MODIFIER
├── app.js              ← Configuration des sections + styles des boutons
├── cutebot-blocks.js   ← Définition des blocs personnalisés
└── ...

index.html              ← Définition des catégories (XML toolbox)
css/styles.css          ← Styles généraux (pas utilisé pour la toolbox)
```

---

## 1. AJOUTER UNE SECTION

Les sections sont les headers gris qui séparent les groupes de catégories (ex: "📚 Base", "🤖 Cutebot").

### Fichier à modifier : `js/app.js`

Trouver la configuration en haut du fichier :

```javascript
const TOOLBOX_SECTIONS = [
    { name: "📚 Base", firstCategory: "Base" },
    { name: "🤖 Cutebot", firstCategory: "Moteurs" }
];
```

### Pour ajouter une section :

```javascript
const TOOLBOX_SECTIONS = [
    { name: "📚 Base", firstCategory: "Base" },
    { name: "🤖 Cutebot", firstCategory: "Moteurs" },
    { name: "🎵 Audio", firstCategory: "Sons" }  // ← NOUVEAU
];
```

- `name` : Le texte affiché (avec emoji)
- `firstCategory` : Le nom de la PREMIÈRE catégorie de cette section (sans emoji)

---

## 2. AJOUTER UNE CATÉGORIE

### Étape 1 : Ajouter dans `index.html`

Trouver la section `<xml id="toolbox">` et ajouter la catégorie :

```xml
<category name="🎵 Sons" colour="#f59e0b">
    <block type="son_jouer"></block>
    <block type="son_stop"></block>
</category>
```

**Position importante** : L'ordre dans le XML = l'ordre d'affichage

### Étape 2 : Ajouter la couleur dans `js/app.js`

Trouver le tableau `categoryColors` dans la fonction `applyToolboxColors` :

```javascript
const categoryColors = [
    { bg: 'linear-gradient(135deg, #3b82f6, #2563eb)', text: '#ffffff' },  // Base
    { bg: 'linear-gradient(135deg, #14b8a6, #0d9488)', text: '#ffffff' },  // Logique
    // ... autres catégories ...
    { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', text: '#ffffff' }   // Sons ← NOUVEAU
];
```

**IMPORTANT** : L'ordre des couleurs DOIT correspondre à l'ordre des catégories dans `index.html`

### Étape 3 : Si nouvelle section, l'ajouter dans `TOOLBOX_SECTIONS`

Voir section 1 ci-dessus.

---

## 3. AJOUTER UN BLOC

### Fichier à modifier : `js/cutebot-blocks.js`

### Étape 1 : Définir le bloc

```javascript
Blockly.Blocks['mon_nouveau_bloc'] = {
    init: function() {
        this.appendDummyInput()
            .appendField("Mon action");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(230);
        this.setTooltip("Description du bloc");
    }
};
```

### Étape 2 : Créer le générateur de code

```javascript
javascript.javascriptGenerator.forBlock['mon_nouveau_bloc'] = function(block) {
    return '__monAction();\n';
};
```

### Étape 3 : Ajouter le bloc dans la catégorie (`index.html`)

```xml
<category name="🎵 Sons" colour="#f59e0b">
    <block type="mon_nouveau_bloc"></block>  <!-- ← ICI -->
</category>
```

### Étape 4 : Implémenter la fonction runtime (si nécessaire)

Dans `js/app.js`, ajouter la fonction appelée par le code généré :

```javascript
function __monAction() { 
    if (simulator) simulator.monAction(); 
}
```

---

## 4. RÉORGANISER LES CATÉGORIES

### Changer l'ordre des catégories

1. Dans `index.html` : Déplacer les balises `<category>` dans l'ordre voulu
2. Dans `js/app.js` : Réorganiser `categoryColors` dans le MÊME ordre

### Déplacer une catégorie vers une autre section

1. Dans `index.html` : Déplacer la balise `<category>` à la bonne position
2. Dans `js/app.js` : 
   - Réorganiser `categoryColors`
   - Modifier `TOOLBOX_SECTIONS` si nécessaire (changer `firstCategory`)

---

## 5. MODIFIER LE STYLE D'UNE CATÉGORIE

### Changer la couleur d'un bouton

Dans `js/app.js`, modifier l'entrée correspondante dans `categoryColors` :

```javascript
{ bg: 'linear-gradient(135deg, #COULEUR1, #COULEUR2)', text: '#ffffff' }
```

Générateur de dégradés : https://cssgradient.io/

### Changer le style des headers de section

Dans la fonction `injectSectionHeaders` de `js/app.js`, modifier le `header.style.cssText` :

```javascript
header.style.cssText = `
    background: linear-gradient(135deg, #1e293b, #334155);
    border-left: 4px solid #8b5cf6;
    color: #e2e8f0;
    // ... autres styles
`;
```

---

## 6. CORRESPONDANCE DES NOMS

**CRITIQUE** : Les noms doivent correspondre EXACTEMENT entre les fichiers.

| Emplacement | Format du nom | Exemple |
|-------------|---------------|---------|
| `index.html` (category name) | Avec emoji | `🚗 Moteurs` |
| `app.js` (TOOLBOX_SECTIONS.firstCategory) | Sans emoji | `Moteurs` |
| `app.js` (categoryColors) | Commentaire seulement | `// Moteurs` |
| `cutebot-blocks.js` (block type) | Snake case | `moteurs_avancer` |

---

## 7. DEBUG

### Logs dans la console

L'application affiche des logs détaillés :

```
✅ Found 10 categories
🏷️ Injecting section headers...
  📁 Category "Base" at index 0
  📁 Category "Logique" at index 1
  ...
  ✅ Section "📚 Base" inserted before "Base"
  ✅ Section "🤖 Cutebot" inserted before "Moteurs"
✅ Section headers injection complete
```

### Problèmes courants

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| Boutons sans couleur | Ordre incorrect dans `categoryColors` | Vérifier l'ordre vs `index.html` |
| Section non affichée | `firstCategory` incorrect | Vérifier le nom exact (sans emoji) |
| Bloc non visible | Bloc non ajouté dans `index.html` | Ajouter `<block type="...">` |
| Erreur JS au runtime | Fonction `__xxx` manquante | Ajouter dans `app.js` |

---

## 8. STRUCTURE DES FICHIERS CLÉS

### TOOLBOX_SECTIONS (app.js ligne ~8)
```javascript
const TOOLBOX_SECTIONS = [
    { name: "📚 Base", firstCategory: "Base" },
    { name: "🤖 Cutebot", firstCategory: "Moteurs" }
];
```

### categoryColors (app.js dans applyToolboxColors)
```javascript
const categoryColors = [
    { bg: '...', text: '#ffffff' },  // 1. Base
    { bg: '...', text: '#ffffff' },  // 2. Logique
    { bg: '...', text: '#ffffff' },  // 3. Boucles
    { bg: '...', text: '#ffffff' },  // 4. Math
    { bg: '...', text: '#ffffff' },  // 5. Variables
    { bg: '...', text: '#ffffff' },  // 6. Fonctions
    { bg: '...', text: '#ffffff' },  // 7. Moteurs
    { bg: '...', text: '#ffffff' },  // 8. LEDs
    { bg: '...', text: '#ffffff' },  // 9. Capteurs
    { bg: '...', text: '#ffffff' }   // 10. Servo
];
```

### XML Toolbox (index.html)
```xml
<xml id="toolbox">
    <!-- Section Base -->
    <category name="🎯 Base" colour="#4a90d9">...</category>
    <category name="🔀 Logique" colour="#5ba55b">...</category>
    <category name="🔄 Boucles" colour="#5ba55b">...</category>
    <category name="🔢 Math" colour="#5b67a5">...</category>
    <category name="📦 Variables" colour="#a55b80" custom="VARIABLE">...</category>
    <category name="🔧 Fonctions" colour="#9a5ca5" custom="PROCEDURE">...</category>
    
    <!-- Section Cutebot -->
    <category name="🚗 Moteurs" colour="#00bcd4">...</category>
    <category name="💡 LEDs" colour="#ff9800">...</category>
    <category name="📏 Capteurs" colour="#9c27b0">...</category>
    <category name="⚙️ Servo" colour="#795548">...</category>
</xml>
```

---

## 9. CHECKLIST RAPIDE

### Ajouter une catégorie
- [ ] `index.html` : Ajouter `<category>` avec blocs
- [ ] `app.js` : Ajouter couleur dans `categoryColors` (bon index)
- [ ] `app.js` : Modifier `TOOLBOX_SECTIONS` si nouvelle section

### Ajouter un bloc
- [ ] `cutebot-blocks.js` : Définir `Blockly.Blocks['nom']`
- [ ] `cutebot-blocks.js` : Définir `javascriptGenerator.forBlock['nom']`
- [ ] `index.html` : Ajouter `<block type="nom">` dans la catégorie
- [ ] `app.js` : Ajouter fonction `__xxx()` si nécessaire

### Ajouter une section
- [ ] `app.js` : Ajouter dans `TOOLBOX_SECTIONS`
- [ ] Vérifier que `firstCategory` correspond au nom exact (sans emoji)
