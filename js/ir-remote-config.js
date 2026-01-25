/**
 * Configuration de la télécommande IR
 * 
 * Ce fichier contient les configurations pour différentes télécommandes IR.
 * - IRC389 : Télécommande alternative (par défaut)
 * - Originale IR : Télécommande officielle Cutebot/Elecfreaks
 */

// Configurations pré-définies des télécommandes
const IR_PRESETS = {
    // Télécommande IRC389 (alternative)
    'IRC389': {
        name: 'IRC389',
        description: 'Télécommande alternative',
        // Mapping simplifié (valeurs brutes)
        mapping: {
            'Off': 68,
            'Menu': 71,
            'Plus': 64,
            'Up': 64,
            'Back': 13,
            'Left': 8,
            'OK': 28,
            'Right': 22,
            'Minus': 67,
            'Down': 25,
            'Zero': 82,
            'One': 12,
            'Two': 24,
            'Three': 94,
            'Four': 66,
            'Five': 74,
            'Six': 82,
            'Seven': 7,
            'Eight': 21,
            'Nine': 69
        },
        // Pour MakeCode, l'extension Cutebot utilise des valeurs différentes
        // Ces valeurs correspondent aux IrButton de l'extension
        makecodeMapping: {
            'Off': 6,
            'Menu': 4,
            'Plus': 2,
            'Up': 5,
            'Back': 14,
            'Left': 8,
            'OK': 9,
            'Right': 10,
            'Minus': 1,
            'Down': 13,
            'Zero': 12,
            'One': 16,
            'Two': 17,
            'Three': 18,
            'Four': 20,
            'Five': 21,
            'Six': 22,
            'Seven': 24,
            'Eight': 25,
            'Nine': 26
        }
    },
    
    // Télécommande officielle Cutebot/Elecfreaks
    'Originale IR': {
        name: 'Originale IR',
        description: 'Télécommande officielle Cutebot',
        // Mapping officiel (identique pour Python et MakeCode)
        mapping: {
            'Off': 11,
            'Menu': 12,
            'Plus': 13,
            'Up': 14,
            'Back': 15,
            'Left': 16,
            'OK': 17,
            'Right': 18,
            'Minus': 19,
            'Down': 20,
            'Zero': 0,
            'One': 1,
            'Two': 2,
            'Three': 3,
            'Four': 4,
            'Five': 5,
            'Six': 6,
            'Seven': 7,
            'Eight': 8,
            'Nine': 9
        },
        // Pour la télécommande officielle, MakeCode utilise les mêmes valeurs
        makecodeMapping: {
            'Off': 11,
            'Menu': 12,
            'Plus': 13,
            'Up': 14,
            'Back': 15,
            'Left': 16,
            'OK': 17,
            'Right': 18,
            'Minus': 19,
            'Down': 20,
            'Zero': 0,
            'One': 1,
            'Two': 2,
            'Three': 3,
            'Four': 4,
            'Five': 5,
            'Six': 6,
            'Seven': 7,
            'Eight': 8,
            'Nine': 9
        }
    }
};

// Télécommande sélectionnée par défaut
const DEFAULT_REMOTE = 'IRC389';

// Configuration actuelle (format interne pour hex-generator)
window.IRRemoteConfig = {
    name: DEFAULT_REMOTE,
    version: "2.0",
    preset: DEFAULT_REMOTE, // 'IRC389', 'Originale IR', ou 'custom'
    python: {},
    typescript: {}
};

/**
 * Applique une configuration pré-définie
 * @param {string} presetName - Nom du preset ('IRC389' ou 'Originale IR')
 */
window.applyIRPreset = function(presetName) {
    const preset = IR_PRESETS[presetName];
    if (!preset) {
        console.error('Preset IR inconnu:', presetName);
        return false;
    }
    
    window.IRRemoteConfig.name = preset.name;
    window.IRRemoteConfig.preset = presetName;
    
    // Convertir le mapping simplifié vers le format interne
    window.IRRemoteConfig.python = { ...preset.mapping };
    window.IRRemoteConfig.typescript = { ...preset.makecodeMapping };
    
    console.log('Télécommande IR sélectionnée:', preset.name);
    return true;
};

/**
 * Charge une configuration IR depuis un objet JSON simplifié
 * Format attendu : { "name": "Ma config", "Up": 14, "Down": 20, ... }
 * @param {Object} config - Configuration à charger
 * @returns {boolean} - true si chargement réussi
 */
window.loadIRConfig = function(config) {
    if (!config) {
        console.error('Configuration IR invalide');
        return false;
    }
    
    // Nouveau format simplifié
    if (!config.python && !config.typescript) {
        const name = config.name || 'Configuration personnalisée';
        const mapping = {};
        
        // Extraire les valeurs du mapping (tout sauf 'name' et 'version')
        for (const key in config) {
            if (key !== 'name' && key !== 'version') {
                mapping[key] = config[key];
            }
        }
        
        if (Object.keys(mapping).length === 0) {
            console.error('Aucun mapping trouvé dans la configuration');
            return false;
        }
        
        window.IRRemoteConfig.name = name;
        window.IRRemoteConfig.preset = 'custom';
        window.IRRemoteConfig.python = { ...mapping };
        window.IRRemoteConfig.typescript = { ...mapping }; // Même valeurs pour les deux
        
        console.log('Configuration IR personnalisée chargée:', name);
        return true;
    }
    
    // Ancien format (rétrocompatibilité)
    window.IRRemoteConfig.name = config.name || 'Configuration personnalisée';
    window.IRRemoteConfig.preset = 'custom';
    window.IRRemoteConfig.python = { ...config.python };
    window.IRRemoteConfig.typescript = { ...config.typescript };
    
    console.log('Configuration IR chargée (ancien format):', window.IRRemoteConfig.name);
    return true;
};

/**
 * Exporte la configuration IR actuelle au format simplifié
 * @returns {Object} - Configuration exportable
 */
window.exportIRConfig = function() {
    // Export au format simplifié : juste le nom et les valeurs
    const config = {
        name: window.IRRemoteConfig.name
    };
    
    // Utiliser le mapping Python comme référence
    for (const key in window.IRRemoteConfig.python) {
        config[key] = window.IRRemoteConfig.python[key];
    }
    
    return config;
};

/**
 * Retourne la liste des presets disponibles
 */
window.getIRPresets = function() {
    return Object.keys(IR_PRESETS).map(key => ({
        id: key,
        name: IR_PRESETS[key].name,
        description: IR_PRESETS[key].description
    }));
};

/**
 * Retourne le preset actuellement sélectionné
 */
window.getCurrentIRPreset = function() {
    return window.IRRemoteConfig.preset;
};

// Initialiser avec la télécommande par défaut
window.applyIRPreset(DEFAULT_REMOTE);

console.log('Configuration IR initialisée:', window.IRRemoteConfig.name);
