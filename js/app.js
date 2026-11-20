/**
 * Micro:bit & Cutebot Simulator - Application principale
 * Version 2.0 - Support complet micro:bit V2 + Cutebot
 */

let workspace = null;
window.workspace = null; // Exposé globalement pour radio-simulator
let customToolbox = null;
let currentCode = '';
let programRunning = false;
let stopRequested = false;
let autoRefreshTimer = null;

// ============== EXECUTION GENERATION (annulation fiable) ==============
// Chaque run/stop incrémente ce compteur. Toutes les pauses vérifient
// si la génération a changé — si oui, elles lèvent __StopExecution pour
// tuer proprement toute la chaîne async.
let _execGeneration = 0;
window._execGeneration = 0;

class __StopExecution extends Error {
    constructor() { super('__StopExecution'); this.name = '__StopExecution'; }
}
window.__StopExecution = __StopExecution;

// Micro:bit simulator (simulator cutebot est déclaré dans cutebot-simulator.js)
let microbitSim = null;
window.microbitSim = null; // Exposé globalement pour radio-simulator

// ============== GESTION DES DEUX PROGRAMMES (Carte 1 et Carte 2) ==============
let currentCard = 1; // 1 ou 2
let card1Xml = null; // Programme de la carte 1
let card2Xml = null; // Programme de la carte 2 (copie initiale de carte 1)
let card2Initialized = false; // true si carte 2 a été initialisée
let card2DuplicateFromCard1 = true; // true = la carte 2 duplique automatiquement la carte 1

// Runtime
const runtime = { 
    onStartCallbacks: [], 
    foreverCallbacks: [], 
    reset() { 
        this.onStartCallbacks = []; 
        this.foreverCallbacks = []; 
    } 
};

// ============== FONCTIONS RUNTIME CUTEBOT ==============
function __onStart(fn) { runtime.onStartCallbacks.push(fn); }
function __forever(fn) { runtime.foreverCallbacks.push(fn); }

// Pause annulable : attente par morceaux de 50 ms max (pour réagir vite à l'arrêt), jusqu'à une
// HEURE DE FIN fixe. Avant, on additionnait 20 morceaux de 50 ms : chaque minuterie arrivant un peu en
// retard, « pause 1 s » durait 1,07 s (1,2 s sur un PC lent) et le Cutebot allait trop loin.
async function __pause(ms) {
    const gen = _execGeneration;
    const end = performance.now() + ms;
    for (let left = ms; left > 0; left = end - performance.now()) {
        await new Promise(r => setTimeout(r, Math.min(left, 50)));
        if (_execGeneration !== gen) throw new __StopExecution();
    }
}

async function __pauseSeconds(s) {
    // Gestion virgule francaise: "0,5" -> 0.5
    if (typeof s === 'string') s = parseFloat(s.replace(',', '.'));
    await __pause(Math.round(s * 1000));
}

function __motors(l, r) { if (simulator) simulator.setMotors(l, r); }
function __forward() { if (simulator) simulator.forward(); }
function __backward() { if (simulator) simulator.backward(); }
function __turnLeft() { if (simulator) simulator.turnLeft(); }
function __turnRight() { if (simulator) simulator.turnRight(); }
function __stop() { if (simulator) simulator.stopMotors(); }
async function __moveTime(dir, spd, t) { if (simulator) await simulator.moveTime(dir, spd, t); }
function __ledColor(s, c) { if (simulator) simulator.setLedColor(s, c); }
function __ledRGB(s, r, g, b) { if (simulator) simulator.setLedRGB(s, r, g, b); }
function __ledOff() { if (simulator) simulator.ledOff(); }
function __trackingState(s) { return simulator ? simulator.trackingState(s) : false; }
function __trackSide(s, e) { return simulator ? simulator.trackSide(s, e) : false; }
function __ultrasonic(u) { return simulator ? simulator.ultrasonic(u) : 0; }
function __servo(s, a) { if (simulator) simulator.setServo(s, a); }
function __onTrackEvent(s, e, fn) { if (simulator) simulator.onTrackEvent(s, e, fn); }
function __onIRReceive(fn) { if (simulator) simulator.onIRReceive(fn); }
function __irButtonPressed(b) { return simulator ? simulator.irButtonPressed(b) : false; }

// === No-op functions pour la carte 2 (neutralise les simulateurs physiques) ===
function __noop() {}
async function __noopAsync() {}
function __noopFalse() { return false; }
function __noopZero() { return 0; }
function __noopEmpty() { return ''; }

// ============== INITIALISATION ==============
document.addEventListener('DOMContentLoaded', function() {
    initBlockly();
    initMicrobitSimulator();
    
    // Initialiser le simulateur Cutebot (fonction définie dans cutebot-simulator.js)
    if (typeof initSimulator === 'function') {
        initSimulator();
    }
    
    // Initialiser le simulateur Double Barrière
    if (typeof initBarrierSimulator === 'function') {
        initBarrierSimulator();
    }
    
    // Initialiser le simulateur Portillon
    if (typeof portillonSimulator !== 'undefined' && portillonSimulator) {
        const portillonContainer = document.getElementById('portillonSimulatorContent');
        if (portillonContainer) {
            portillonSimulator.init(portillonContainer);
        }
    }
    
    initEventListeners();
    loadDefaultExample();
    
    // Lancer automatiquement le simulateur après un court délai
    setTimeout(() => {
        runProgram();
    }, 500);
    
    // Pré-charger les firmwares en arrière-plan pour diagnostiquer les problèmes de connexion
    preloadFirmwares();
    
    // Resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Réappliquer la marge des contrôles de zoom avant le resize
            if (workspace && workspace.zoomControls_) {
                workspace.zoomControls_.MARGIN_VERTICAL = 80;
            }
            if (workspace) Blockly.svgResize(workspace);
            if (simulator) simulator.resizeCanvas();
            // Recalculer la distribution des panneaux simulateur
            if (window.simulatorPanels) window.simulatorPanels.distributeSpace();
        }, 100);
    });
    
    // Remote modal
    setupRemoteModal();
    
    // Accel modal
    setupAccelModal();
});

/**
 * Pré-charge les firmwares MicroPython en arrière-plan
 * Affiche un avertissement si le chargement échoue
 */
async function preloadFirmwares() {
    try {
        const hexGen = new HexGenerator();
        const loaded = await hexGen.loadFirmwares();
        
        if (loaded) {
            console.log('✅ Firmwares pré-chargés avec succès');
            // Vérifier si les bibliothèques ont été chargées
            if (!hexGen.cutebotLib) {
                console.warn('⚠️ Bibliothèque Cutebot.py non chargée');
            }
            if (!hexGen.mfrc522Lib) {
                console.warn('⚠️ Bibliothèque MFRC522.py non chargée');
            }
            // Stocker pour réutilisation
            window._preloadedHexGen = hexGen;
        } else {
            console.warn('⚠️ Échec du pré-chargement des firmwares');
            showFirmwareWarning();
        }
    } catch (error) {
        console.error('Erreur pré-chargement firmwares:', error);
        showFirmwareWarning();
    }
}

/**
 * Affiche un avertissement discret si les firmwares n'ont pas pu être chargés
 */
function showFirmwareWarning() {
    // Créer un badge d'avertissement sur le bouton télécharger
    const downloadBtn = document.getElementById('btnDownloadHex');
    if (downloadBtn) {
        downloadBtn.title = '⚠️ Connexion lente - Le téléchargement pourrait échouer';
        downloadBtn.style.position = 'relative';
        
        // Ajouter un point d'avertissement
        const warningDot = document.createElement('span');
        warningDot.style.cssText = `
            position: absolute;
            top: -4px;
            right: -4px;
            width: 12px;
            height: 12px;
            background: #f59e0b;
            border-radius: 50%;
            border: 2px solid var(--bg-card, #1e293b);
        `;
        warningDot.title = 'Connexion lente détectée';
        downloadBtn.appendChild(warningDot);
    }
}

function initMicrobitSimulator() {
    if (typeof MicrobitSimulator !== 'undefined') {
        microbitSim = new MicrobitSimulator('microbitSimulator');
        window.microbitSim = microbitSim; // Exposer globalement pour radio-simulator
        if (typeof initMicrobitRuntime === 'function') {
            initMicrobitRuntime(microbitSim);
        }
    }
}

// ============== GESTION DES BLOCS CHAPEAUX DUPLIQUÉS ==============

/**
 * Configuration des blocs chapeaux (événements) et leurs champs distinctifs
 * Les blocs avec les mêmes valeurs de champs sont considérés comme dupliqués
 */
const HAT_BLOCKS_CONFIG = {
    // Blocs sans options (un seul autorisé)
    'on_start': [],
    'forever': [],
    'cutebot_on_ir_receive': [],
    'radio_on_received_number': [], // La variable ne différencie pas
    'radio_on_received_string': [], // La variable ne différencie pas
    
    // Blocs avec options (différenciés par les champs)
    'input_on_button_pressed': ['BUTTON'],
    'input_on_gesture': ['GESTURE'],
    'input_on_logo_event': ['EVENT'],
    'cutebot_on_track_event': ['SENSOR', 'EVENT']
};

/**
 * Vérifie et désactive les blocs chapeaux dupliqués
 * Un bloc dupliqué est mis en transparence (désactivé)
 * Il se réactive quand ses options le rendent unique
 * @param {string|null} newBlockId - L'ID du bloc nouvellement créé (si applicable)
 */
const DUPLICATE_HAT_REASON = 'DUPLICATE_HAT_BLOCK';

function checkDuplicateHatBlocks(newBlockId = null) {
    if (!workspace) return;
    
    // Collecter tous les blocs chapeaux du workspace
    const allBlocks = workspace.getAllBlocks(false);
    const hatBlocks = {};
    
    // Grouper les blocs par type
    allBlocks.forEach(block => {
        const blockType = block.type;
        if (HAT_BLOCKS_CONFIG.hasOwnProperty(blockType)) {
            if (!hatBlocks[blockType]) {
                hatBlocks[blockType] = [];
            }
            hatBlocks[blockType].push(block);
        }
    });
    
    // Pour chaque type de bloc chapeau
    Object.keys(hatBlocks).forEach(blockType => {
        const blocks = hatBlocks[blockType];
        const fields = HAT_BLOCKS_CONFIG[blockType];
        
        // Grouper par signature (valeurs des champs)
        const signatures = {};
        
        blocks.forEach(block => {
            // Construire la signature basée sur les valeurs des champs
            let signature = blockType;
            fields.forEach(fieldName => {
                const value = block.getFieldValue(fieldName);
                signature += '|' + (value || '');
            });
            
            if (!signatures[signature]) {
                signatures[signature] = [];
            }
            signatures[signature].push(block);
        });
        
        // Pour chaque groupe de blocs avec la même signature
        Object.values(signatures).forEach(blockGroup => {
            if (blockGroup.length <= 1) {
                // Un seul bloc avec cette signature
                // S'il était marqué comme doublon, le réactiver
                if (blockGroup.length === 1 && blockGroup[0].isDuplicateHat) {
                    blockGroup[0].setDisabledReason(false, DUPLICATE_HAT_REASON);
                    blockGroup[0].isDuplicateHat = false;
                }
                return;
            }
            
            // Plusieurs blocs avec la même signature
            // Le bloc nouvellement créé (s'il est dans ce groupe) doit être désactivé
            // Les blocs déjà là restent dans leur état actuel
            
            // D'abord, trouver s'il y a un bloc actif (non désactivé comme doublon)
            let hasActiveBlock = blockGroup.some(b => !b.isDuplicateHat);
            
            blockGroup.forEach(block => {
                const isNewBlock = (block.id === newBlockId);
                
                if (isNewBlock && hasActiveBlock) {
                    // C'est le nouveau bloc et il y a déjà un bloc actif → désactiver
                    if (!block.isDuplicateHat) {
                        block.setDisabledReason(true, DUPLICATE_HAT_REASON);
                        block.isDuplicateHat = true;
                    }
                } else if (!hasActiveBlock && !block.isDuplicateHat) {
                    // Pas de bloc actif, ce bloc devient l'actif
                    hasActiveBlock = true;
                } else if (!hasActiveBlock && block.isDuplicateHat) {
                    // Pas de bloc actif, réactiver ce doublon
                    block.setDisabledReason(false, DUPLICATE_HAT_REASON);
                    block.isDuplicateHat = false;
                    hasActiveBlock = true;
                }
            });
            
            // S'il y a plus d'un bloc actif (cas d'un BLOCK_CHANGE qui crée un conflit),
            // désactiver les blocs excédentaires sauf le premier trouvé
            let foundActive = false;
            blockGroup.forEach(block => {
                if (!block.isDuplicateHat) {
                    if (foundActive) {
                        // Un actif a déjà été trouvé, désactiver celui-ci
                        block.setDisabledReason(true, DUPLICATE_HAT_REASON);
                        block.isDuplicateHat = true;
                    } else {
                        foundActive = true;
                    }
                }
            });
        });
    });
}

// ============== BLOCKLY ==============
function initBlockly() {
    // Traductions françaises
    setupBlocklyTranslations();
    
    // Thème MakeCode
    const makeCodeTheme = createMakeCodeTheme();
    
    workspace = Blockly.inject('blocklyDiv', {
        toolbox: '<xml></xml>', // Toolbox vide pour créer le flyout
        theme: makeCodeTheme,
        grid: { spacing: 25, length: 3, colour: '#e5e7eb', snap: true },
        zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2, minScale: 0.3 },
        trashcan: false,
        sounds: false,
        renderer: 'zelos',
        collapse: true,
        comments: false,
        disable: true,
        maxBlocks: Infinity,
        horizontalLayout: false,
        toolboxPosition: 'start', // Flyout à gauche
        css: true,
        media: 'media/', // Media Blockly v12.3.1 servi EN LOCAL (dossier media/, version = blockly.min.js local). Aucune dépendance CDN : ne pas remettre une URL unpkg (le "latest" a déjà cassé sprites.png en passant à Blockly v13).
        rtl: false,
        scrollbars: true,
        oneBasedIndex: true,
        move: {
            scrollbars: {
                horizontal: true,
                vertical: true
            },
            drag: true,
            wheel: true
        }
    });
    
    // Exposer workspace globalement pour radio-simulator
    window.workspace = workspace;
    
    // Ajuster la position des contrôles de zoom pour éviter qu'ils soient coupés
    if (workspace.zoomControls_) {
        // Augmenter la marge verticale pour remonter les boutons
        workspace.zoomControls_.MARGIN_VERTICAL = 80;
    }

    // Garder les métriques de la workspace à jour quand blocklyDiv change de taille.
    // Sans ça, si le conteneur est redimensionné APRÈS l'injection (polices chargées
    // tardivement, apparition d'un panneau simulateur via runProgram(), reflow flex…),
    // Blockly conserve des métriques périmées (viewHeight = 0) et place les contrôles
    // de zoom hors écran → ils "disparaissent". Le ResizeObserver des panneaux
    // simulateurs n'observe que le conteneur des simulateurs, pas l'éditeur.
    const blocklyDivEl = document.getElementById('blocklyDiv');
    if (blocklyDivEl && typeof ResizeObserver !== 'undefined') {
        let _wsResizeRaf = null;
        const wsResizeObs = new ResizeObserver(() => {
            if (_wsResizeRaf) cancelAnimationFrame(_wsResizeRaf);
            _wsResizeRaf = requestAnimationFrame(() => {
                if (!workspace) return;
                if (workspace.zoomControls_) {
                    workspace.zoomControls_.MARGIN_VERTICAL = 80;
                }
                Blockly.svgResize(workspace);
            });
        });
        wsResizeObs.observe(blocklyDivEl);
    }

    // Corriger la zone fantôme de 60px causée par la toolbox XML vide
    // Blockly réserve 60px pour une toolbox inexistante
    // On corrige absoluteLeft et viewLeft mais on garde le reste intact
    const originalGetMetrics = workspace.getMetrics.bind(workspace);
    workspace.getMetrics = function() {
        const metrics = originalGetMetrics();
        
        // Soustraire les 60px de toolbox fantôme
        // Le flyout ajoutera sa propre largeur quand il s'ouvrira (comportement normal)
        if (metrics.absoluteLeft === 60) {
            metrics.absoluteLeft = 0;
        }
        if (metrics.viewLeft === 60) {
            metrics.viewLeft = 0;
        }
        
        // Agrandir la zone de contenu scrollable (canvas virtuel)
        // Ajouter une large marge autour du contenu existant pour permettre
        // de scroller bien au-delà des blocs actuels dans toutes les directions
        const EXTRA_MARGIN = 5000; // 5000px de marge supplémentaire
        if (metrics.contentHeight !== undefined) {
            metrics.contentTop -= EXTRA_MARGIN;
            metrics.contentLeft -= EXTRA_MARGIN;
            metrics.contentHeight += EXTRA_MARGIN * 2;
            metrics.contentWidth += EXTRA_MARGIN * 2;
        }
        
        return metrics;
    };
    
    // Initialiser la toolbox personnalisée
    if (typeof initCustomToolbox === 'function') {
        customToolbox = initCustomToolbox(workspace);
    }
    
    // Corriger la zone de suppression du flyout
    // Par défaut, Blockly utilise svgGroup_.getBoundingClientRect() qui inclut
    // des éléments invisibles, créant une zone de suppression trop large
    const flyout = workspace.getFlyout();
    if (flyout) {
        flyout.getClientRect = function() {
            if (!this.svgGroup_ || this.autoClose || !this.isVisible()) {
                return null;
            }
            
            // Utiliser svgBackground au lieu de svgGroup pour la vraie zone visible
            const bgRect = this.svgBackground_.getBoundingClientRect();
            
            // Position LEFT : zone de suppression de -infini à droite du flyout
            if (this.toolboxPosition_ === Blockly.utils.toolbox.Position.LEFT) {
                return new Blockly.utils.Rect(-1e9, 1e9, -1e9, bgRect.right);
            }
            // Position RIGHT : zone de suppression de gauche du flyout à +infini
            return new Blockly.utils.Rect(-1e9, 1e9, bgRect.left, 1e9);
        };
        
        // Corriger la zone invisible qui bloque les clics
        // Le SVG du flyout déborde de sa largeur visible et intercepte les clics
        // Solution: désactiver pointer-events sur le SVG parent, réactiver sur les enfants
        const svg = flyout.svgGroup_;
        if (svg) {
            svg.style.pointerEvents = 'none';
            
            const bg = flyout.svgBackground_;
            if (bg) bg.style.pointerEvents = 'auto';
            
            const ws = svg.querySelector('.blocklyWorkspace');
            if (ws) ws.style.pointerEvents = 'auto';
        }
    }
    
    // Post-init
    setTimeout(() => {
        addSearchBarToToolbox();
        applyToolboxColors();
        
        // S'assurer que la marge des contrôles de zoom est bien appliquée
        if (workspace && workspace.zoomControls_) {
            workspace.zoomControls_.MARGIN_VERTICAL = 80;
            // Faire un resize pour forcer le repositionnement
            Blockly.svgResize(workspace);
        }
    }, 500);
    
    // Personnaliser le menu contextuel (clic droit)
    if (Blockly.ContextMenuRegistry && Blockly.ContextMenuRegistry.registry) {
        const registry = Blockly.ContextMenuRegistry.registry;
        
        // Supprimer les options qu'on ne veut pas
        const optionsToRemove = [
            'blockComment',
            'blockInline', 
            'blockCollapseExpand',
            'blockDisable',
            'blockDelete',
            'blockHelp'
        ];
        
        optionsToRemove.forEach(id => {
            try {
                registry.unregister(id);
            } catch (e) {
                // Option déjà supprimée ou n'existe pas
            }
        });
        
        // Renommer "Duplicate" en "Dupliquer"
        const duplicateItem = registry.getItem('blockDuplicate');
        if (duplicateItem) {
            duplicateItem.displayText = function() { return 'Dupliquer'; };
        }
    }
    
    // Callback pour fonctions personnalisées
    setupProcedureCallbacks();
    
    // Fermer le flyout quand on clique sur le fond du workspace
    workspace.addChangeListener(e => {
        // Détecter les clics sur le workspace
        if (e.type === Blockly.Events.CLICK) {
            // Si on a cliqué sur le fond (pas sur un bloc)
            if (!e.blockId) {
                // Fermer le flyout s'il est ouvert (en utilisant la méthode du customToolbox)
                const flyout = workspace.getFlyout();
                if (flyout && flyout.isVisible() && customToolbox) {
                    customToolbox.closeFlyout();
                }
            }
        }
    });
    
    // Clic EN DEHORS de la zone des blocs (simulateurs, catégories, en-tête…) pendant
    // qu'un champ est en cours de saisie : valider la valeur et fermer le champ.
    // Blockly ne le fait lui-même que pour les clics DANS la zone des blocs : sinon le
    // champ restait ouvert, sans focus, et le clic suivant servait juste à le fermer.
    document.addEventListener('pointerdown', (e) => {
        const widgetOpen = Blockly.WidgetDiv.isVisible();
        const dropdownOpen = Blockly.DropDownDiv.isVisible();
        if (!widgetOpen && !dropdownOpen) return;
        const t = e.target;
        if (t && t.closest && (t.closest('.blocklyWidgetDiv') || t.closest('.blocklyDropDownDiv') || t.closest('.injectionDiv'))) return;
        if (widgetOpen) Blockly.WidgetDiv.hide();
        if (dropdownOpen) Blockly.DropDownDiv.hideWithoutAnimation();
    }, true);

    workspace.addChangeListener(e => {
        if (e.type !== Blockly.Events.UI) {
            // Vérifier les blocs chapeaux dupliqués
            if (e.type === Blockly.Events.BLOCK_CREATE || 
                e.type === Blockly.Events.BLOCK_DELETE || 
                e.type === Blockly.Events.BLOCK_MOVE ||
                e.type === Blockly.Events.BLOCK_CHANGE) {
                // Passer l'ID du bloc nouvellement créé pour le traiter comme doublon potentiel
                const newBlockId = (e.type === Blockly.Events.BLOCK_CREATE) ? e.blockId : null;
                checkDuplicateHatBlocks(newBlockId);
            }
            
            // Sauvegarder l'ancien code avant de générer le nouveau
            const oldCode = currentCode;
            updateGeneratedCode();
            
            // Synchroniser carte 2 si duplication active et qu'on est sur carte 1
            if (currentCard === 1 && card2DuplicateFromCard1) {
                const xml = Blockly.Xml.workspaceToDom(workspace);
                card2Xml = Blockly.Xml.domToText(xml);
                card1Xml = card2Xml;
                card2Initialized = true;
            }
            
            // Ne déclencher l'auto-refresh que si le code a vraiment changé
            if (currentCode !== oldCode) {
                // Auto-refresh : relancer automatiquement le programme après modification
                // avec un debounce de 1 seconde pour éviter trop de relances
                clearTimeout(autoRefreshTimer);
                autoRefreshTimer = setTimeout(() => {
                    if (programRunning) {
                        stopProgram(true); // Mode silencieux pour l'auto-refresh
                    }
                    // Petit délai pour laisser les microtasks se résoudre
                    setTimeout(() => runProgram(true), 50); // keepPosition=true
                }, 1000);
            }
            
            // Mettre à jour la visibilité du bouton Carte 2 si on est sur la carte 1
            if (currentCard === 1 && (e.type === Blockly.Events.BLOCK_CREATE || 
                e.type === Blockly.Events.BLOCK_DELETE || 
                e.type === Blockly.Events.BLOCK_MOVE)) {
                updateCard2ButtonVisibility();
            }
            
            // Auto-ouvrir le simulateur correspondant quand on pose un bloc
            if (e.type === Blockly.Events.BLOCK_CREATE && window.simulatorPanels) {
                const block = workspace.getBlockById(e.blockId);
                if (block) {
                    const type = block.type;
                    if (type.startsWith('cutebot_') && type !== 'cutebot_if') {
                        window.simulatorPanels.autoOpenPanel('cutebot');
                    } else if (type.startsWith('barrier_') || (type.startsWith('servo_') && !type.startsWith('portillon_'))) {
                        window.simulatorPanels.autoOpenPanel('barrier');
                    } else if (type.startsWith('portillon_') || type.startsWith('rfid_')) {
                        window.simulatorPanels.autoOpenPanel('portillon');
                    }
                }
            }
        }
    });

    // ===== COLLAPSE/EXPAND BOUTON SUR LES BLOCS FONCTIONS =====
    // Overlay HTML positionné dynamiquement à gauche du mot "fonction"
    const collapseOverlayContainer = document.createElement('div');
    collapseOverlayContainer.id = 'collapse-overlay-container';
    collapseOverlayContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;overflow:hidden;';
    document.getElementById('blocklyDiv').appendChild(collapseOverlayContainer);
    
    const collapseButtons = new Map(); // blockId -> HTMLElement
    
    function getBlockScreenPos(block) {
        // Obtenir la position du bloc dans le workspace, puis convertir en pixels écran
        const svgRoot = block.getSvgRoot();
        if (!svgRoot) return null;
        
        const blocklyMainSvg = workspace.getParentSvg();
        if (!blocklyMainSvg) return null;
        
        const svgRect = blocklyMainSvg.getBoundingClientRect();
        const divRect = document.getElementById('blocklyDiv').getBoundingClientRect();
        
        // Utiliser getRelativeToSurfaceXY pour la position dans le workspace
        const blockXY = block.getRelativeToSurfaceXY();
        const scale = workspace.scale;
        const wsMetrics = workspace.getMetrics();
        
        // Position pixel = (position_workspace - scroll) * scale + offset_svg
        const pixelX = (blockXY.x * scale) - wsMetrics.viewLeft * scale / 1 + (svgRect.left - divRect.left);
        const pixelY = (blockXY.y * scale) - wsMetrics.viewTop * scale / 1 + (svgRect.top - divRect.top);
        
        // En fait, utilisons directement le SVG transform pour plus de fiabilité
        const ctm = svgRoot.getScreenCTM();
        if (!ctm) return null;
        
        return {
            x: ctm.e - divRect.left,
            y: ctm.f - divRect.top,
            scale: ctm.a // scale factor
        };
    }
    
    function createCollapseBtn(block) {
        const btn = document.createElement('div');
        btn.className = 'proc-collapse-btn';
        btn.dataset.blockId = block.id;
        const collapsed = block.isCollapsed();
        btn.innerHTML = collapsed ? '▶' : '▼';
        btn.title = collapsed ? 'Déplier la fonction' : 'Plier la fonction';
        btn.style.cssText = `
            position: absolute;
            pointer-events: auto;
            cursor: pointer;
            width: 18px;
            height: 18px;
            border-radius: 4px;
            background: rgba(255,255,255,0.3);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            line-height: 1;
            user-select: none;
            transition: background 0.15s;
            border: 1px solid rgba(255,255,255,0.4);
        `;
        
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'rgba(255,255,255,0.55)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'rgba(255,255,255,0.3)';
        });
        btn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
        });
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const isCollapsed = block.isCollapsed();
            block.setCollapsed(!isCollapsed);
            btn.innerHTML = !isCollapsed ? '▶' : '▼';
            btn.title = !isCollapsed ? 'Déplier la fonction' : 'Plier la fonction';
            // Repositionner après collapse
            requestAnimationFrame(() => updateAllCollapseButtons());
        });
        
        collapseOverlayContainer.appendChild(btn);
        collapseButtons.set(block.id, btn);
        return btn;
    }
    
    function updateAllCollapseButtons() {
        // Supprimer les boutons pour les blocs qui n'existent plus
        for (const [blockId, btn] of collapseButtons) {
            const block = workspace.getBlockById(blockId);
            if (!block || block.isInFlyout || block.disposed) {
                btn.remove();
                collapseButtons.delete(blockId);
            }
        }
        
        // Mettre à jour / créer les boutons pour les blocs fonctions
        const allBlocks = workspace.getAllBlocks(false);
        for (const block of allBlocks) {
            if (block.type !== 'procedures_defnoreturn' && block.type !== 'procedures_defreturn') continue;
            if (block.isInFlyout) continue;
            
            let btn = collapseButtons.get(block.id);
            if (!btn) {
                btn = createCollapseBtn(block);
            }
            
            // Mettre à jour l'icône
            const collapsed = block.isCollapsed();
            btn.innerHTML = collapsed ? '▶' : '▼';
            btn.title = collapsed ? 'Déplier la fonction' : 'Plier la fonction';
            
            // Positionner le bouton
            const pos = getBlockScreenPos(block);
            if (pos) {
                // Positionner à gauche du texte "fonction", légèrement décalé dans le bloc
                // Le chapeau hat du renderer zelos a environ 16px de haut, le texte est ~au milieu
                const offsetX = 8 * pos.scale;  // à gauche dans le bloc
                const offsetY = 8 * pos.scale;  // aligné avec le texte du chapeau
                btn.style.left = (pos.x + offsetX) + 'px';
                btn.style.top = (pos.y + offsetY) + 'px';
                btn.style.transform = `scale(${pos.scale})`;
                btn.style.transformOrigin = 'top left';
                btn.style.display = 'flex';
            } else {
                btn.style.display = 'none';
            }
        }
    }
    
    // Écouter tous les changements pour repositionner
    let dragAnimFrame = null;
    
    function dragTrackLoop() {
        updateAllCollapseButtons();
        dragAnimFrame = requestAnimationFrame(dragTrackLoop);
    }
    
    workspace.addChangeListener((e) => {
        // Pendant le drag, lancer une boucle d'animation pour suivre le bloc en temps réel
        if (e.type === Blockly.Events.BLOCK_DRAG) {
            if (e.isStart) {
                // Début du drag : lancer la boucle de suivi
                if (!dragAnimFrame) {
                    dragAnimFrame = requestAnimationFrame(dragTrackLoop);
                }
            } else {
                // Fin du drag : arrêter la boucle
                if (dragAnimFrame) {
                    cancelAnimationFrame(dragAnimFrame);
                    dragAnimFrame = null;
                }
                requestAnimationFrame(updateAllCollapseButtons);
            }
        }
        
        // Mise à jour pour création, suppression, mouvement, changement, viewport
        if (e.type === Blockly.Events.BLOCK_CREATE ||
            e.type === Blockly.Events.BLOCK_DELETE ||
            e.type === Blockly.Events.BLOCK_MOVE ||
            e.type === Blockly.Events.BLOCK_CHANGE ||
            e.type === Blockly.Events.VIEWPORT_CHANGE) {
            requestAnimationFrame(updateAllCollapseButtons);
        }
    });
    
    // Aussi sur scroll/resize
    const blocklyDiv = document.getElementById('blocklyDiv');
    const resizeObs = new ResizeObserver(() => {
        requestAnimationFrame(updateAllCollapseButtons);
    });
    resizeObs.observe(blocklyDiv);
    
    // Init après un délai
    setTimeout(updateAllCollapseButtons, 500);
}


function setupBlocklyTranslations() {
    // Blocs IF
    Blockly.Msg['CONTROLS_IF_MSG_IF'] = 'si';
    Blockly.Msg['CONTROLS_IF_MSG_ELSEIF'] = 'sinon si';
    Blockly.Msg['CONTROLS_IF_MSG_ELSE'] = 'sinon';
    Blockly.Msg['CONTROLS_IF_MSG_THEN'] = 'alors';
    
    // Comparaison
    Blockly.Msg['LOGIC_COMPARE_TOOLTIP_EQ'] = 'Renvoie vrai si les deux entrées sont égales.';
    Blockly.Msg['LOGIC_COMPARE_TOOLTIP_NEQ'] = 'Renvoie vrai si les deux entrées sont différentes.';
    
    // Logique
    Blockly.Msg['LOGIC_OPERATION_AND'] = 'et';
    Blockly.Msg['LOGIC_OPERATION_OR'] = 'ou';
    Blockly.Msg['LOGIC_NEGATE_TITLE'] = 'non %1';
    Blockly.Msg['LOGIC_BOOLEAN_TRUE'] = 'vrai';
    Blockly.Msg['LOGIC_BOOLEAN_FALSE'] = 'faux';
    
    // Boucles
    Blockly.Msg['CONTROLS_REPEAT_TITLE'] = 'répéter %1 fois';
    Blockly.Msg['CONTROLS_REPEAT_INPUT_DO'] = 'faire';
    Blockly.Msg['CONTROLS_WHILEUNTIL_OPERATOR_WHILE'] = 'répéter tant que';
    Blockly.Msg['CONTROLS_WHILEUNTIL_OPERATOR_UNTIL'] = 'répéter jusqu\'à ce que';
    
    // Math
    Blockly.Msg['MATH_RANDOM_INT_TITLE'] = 'nombre aléatoire entre %1 et %2';
    Blockly.Msg['MATH_CHANGE_TITLE'] = 'change %1 en ajoutant %2';
    
    // Variables
    Blockly.Msg['VARIABLES_SET'] = 'définir %1 à %2';
    Blockly.Msg['NEW_VARIABLE'] = 'Créer une variable…';
    Blockly.Msg['NEW_VARIABLE_TITLE'] = 'Nom de la nouvelle variable :';
    Blockly.Msg['RENAME_VARIABLE'] = 'Renommer la variable…';
    Blockly.Msg['DELETE_VARIABLE'] = 'Supprimer la variable « %1 »';
    
    // Fonctions
    Blockly.Msg['PROCEDURES_DEFNORETURN_TITLE'] = 'fonction';
    Blockly.Msg['PROCEDURES_DEFNORETURN_PROCEDURE'] = 'faire quelque chose';
    Blockly.Msg['PROCEDURES_BEFORE_PARAMS'] = 'avec :';
    Blockly.Msg['PROCEDURES_DEFRETURN_RETURN'] = 'retourner';
    
    // Texte
    Blockly.Msg['TEXT_JOIN_TITLE_CREATEWITH'] = 'créer texte avec';
    Blockly.Msg['TEXT_LENGTH_TITLE'] = 'longueur de %1';
}

function createMakeCodeTheme() {
    return Blockly.Theme.defineTheme('makecode', {
        'base': Blockly.Themes.Classic,
        'blockStyles': {
            'motor_blocks': { 'colourPrimary': '#0ea5e9', 'colourSecondary': '#7dd3fc', 'colourTertiary': '#0284c7' },
            'led_blocks': { 'colourPrimary': '#f97316', 'colourSecondary': '#fdba74', 'colourTertiary': '#ea580c' },
            'sensor_blocks': { 'colourPrimary': '#a855f7', 'colourSecondary': '#d8b4fe', 'colourTertiary': '#9333ea' },
            'base_blocks': { 'colourPrimary': '#3b82f6', 'colourSecondary': '#60a5fa', 'colourTertiary': '#2563eb' },
            'input_blocks': { 'colourPrimary': '#D400D4', 'colourSecondary': '#F0A0F0', 'colourTertiary': '#A000A0' },
            'music_blocks': { 'colourPrimary': '#E63022', 'colourSecondary': '#F08080', 'colourTertiary': '#C02010' },
            'radio_blocks': { 'colourPrimary': '#E3008C', 'colourSecondary': '#F080C0', 'colourTertiary': '#B00070' },
            'logic_blocks': { 'colourPrimary': '#14b8a6', 'colourSecondary': '#5eead4', 'colourTertiary': '#0d9488' },
            'loop_blocks': { 'colourPrimary': '#84cc16', 'colourSecondary': '#bef264', 'colourTertiary': '#65a30d' },
            'math_blocks': { 'colourPrimary': '#6366f1', 'colourSecondary': '#a5b4fc', 'colourTertiary': '#4f46e5' },
            'variable_blocks': { 'colourPrimary': '#ec4899', 'colourSecondary': '#f9a8d4', 'colourTertiary': '#db2777' },
            'procedure_blocks': { 'colourPrimary': '#78716c', 'colourSecondary': '#a8a29e', 'colourTertiary': '#57534e' }
        },
        'componentStyles': {
            'workspaceBackgroundColour': '#e5e7eb',
            'toolboxBackgroundColour': '#ffffff',
            'flyoutBackgroundColour': '#ffffff',
            'flyoutForegroundColour': '#111827',
            'flyoutOpacity': 1,
            'scrollbarColour': '#d1d5db',
            'insertionMarkerColour': '#3b82f6'
        },
        'fontStyle': { 'family': 'Inter, -apple-system, sans-serif', 'weight': 'normal', 'size': 12 },
        'startHats': true
    });
}

function setupProcedureCallbacks() {
    workspace.registerToolboxCategoryCallback('PROCEDURE_CUSTOM', function(workspace) {
        const blockList = [];
        
        const button = document.createElement('button');
        button.setAttribute('text', '➕ Créer nouvelle fonction');
        button.setAttribute('callbackKey', 'CREATE_FUNCTION');
        blockList.push(button);
        
        const procedures = Blockly.Procedures.allProcedures(workspace);
        for (let i = 0; i < procedures[0].length; i++) {
            const name = procedures[0][i][0];
            const args = procedures[0][i][1];
            const block = Blockly.utils.xml.createElement('block');
            block.setAttribute('type', 'procedures_callnoreturn');
            block.setAttribute('gap', '16');
            const mutation = Blockly.utils.xml.createElement('mutation');
            mutation.setAttribute('name', name);
            for (let j = 0; j < args.length; j++) {
                const arg = Blockly.utils.xml.createElement('arg');
                arg.setAttribute('name', args[j]);
                mutation.appendChild(arg);
            }
            block.appendChild(mutation);
            blockList.push(block);
        }
        
        return blockList;
    });
    
    workspace.registerButtonCallback('CREATE_FUNCTION', function(button) {
        const funcName = prompt('Nom de la nouvelle fonction :');
        if (funcName && funcName.trim()) {
            // Créer le bloc via XML
            const blockXml = Blockly.utils.xml.textToDom(
                '<xml><block type="procedures_defnoreturn">' +
                '<field name="NAME">' + funcName.trim() + '</field>' +
                '</block></xml>'
            );
            
            // Importer le bloc dans le workspace
            const blockIds = Blockly.Xml.domToWorkspace(blockXml, workspace);
            
            if (blockIds.length > 0) {
                const block = workspace.getBlockById(blockIds[0]);
                if (block) {
                    // Positionner le bloc à un endroit visible
                    const metrics = workspace.getMetrics();
                    const x = (metrics.viewLeft + 50) / workspace.scale;
                    const y = (metrics.viewTop + 50) / workspace.scale;
                    block.moveBy(x, y);
                }
            }
        }
    });
    
    // Callback pour créer une nouvelle variable
    workspace.registerButtonCallback('CREATE_VARIABLE', function(button) {
        Blockly.Variables.createVariableButtonHandler(workspace, null, '');
    });
}

// ============== TOOLBOX STYLING ==============
function addSearchBarToToolbox() {
    const toolbox = document.querySelector('.blocklyToolboxDiv');
    if (!toolbox || toolbox.querySelector('.toolbox-search-container')) return;
    
    const searchContainer = document.createElement('div');
    searchContainer.className = 'toolbox-search-container';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '🔍 Rechercher...';
    searchInput.className = 'blocklySearchInputField';
    
    let allCategories = [];
    const collectBlocks = () => {
        allCategories = [];
        toolbox.querySelectorAll('.blocklyTreeRow').forEach((cat) => {
            const label = cat.querySelector('.blocklyTreeLabel');
            if (label) {
                allCategories.push({
                    element: cat.parentElement,
                    name: label.textContent.toLowerCase(),
                    labelElement: label
                });
            }
        });
    };
    
    collectBlocks();
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        allCategories.forEach(cat => {
            cat.element.style.display = !query || cat.name.includes(query) ? '' : 'none';
        });
    });
    
    searchContainer.appendChild(searchInput);
    
    const treeRoot = toolbox.querySelector('.blocklyTreeRoot');
    if (treeRoot) {
        toolbox.insertBefore(searchContainer, treeRoot);
    }
}

function applyToolboxColors() {
    let attempts = 0;
    const maxAttempts = 10;
    
    // Configuration des sections
    const TOOLBOX_SECTIONS = [
        { name: "💻 MICRO:BIT", firstCategory: "Base" },
        { name: "🔧 PROGRAMMATION", firstCategory: "Logique" },
        { name: "🤖 CUTEBOT", firstCategory: "Moteurs" }
    ];
    
    const tryApply = () => {
        attempts++;
        
        // Essayer plusieurs sélecteurs possibles
        let toolbox = document.querySelector('.blocklyToolboxDiv');
        if (!toolbox) toolbox = document.querySelector('[class*="blocklyToolbox"]');
        
        if (!toolbox) {
            if (attempts < maxAttempts) {
                setTimeout(tryApply, 200);
            }
            return;
        }
        
        const rows = toolbox.querySelectorAll('.blocklyTreeRow, [class*="TreeRow"]');
        if (rows.length === 0) {
            if (attempts < maxAttempts) {
                setTimeout(tryApply, 200);
            }
            return;
        }
        
        // Couleurs MakeCode par catégorie (15 catégories)
        const categoryColors = [
            { bg: 'linear-gradient(135deg, #3b82f6, #2563eb)', text: '#ffffff' },  // 1. Base (bleu)
            { bg: 'linear-gradient(135deg, #D400D4, #A000A0)', text: '#ffffff' },  // 2. Entrées
            { bg: 'linear-gradient(135deg, #E63022, #C02010)', text: '#ffffff' },  // 3. Musique
            { bg: 'linear-gradient(135deg, #E63022, #C02010)', text: '#ffffff' },  // 4. LED
            { bg: 'linear-gradient(135deg, #E3008C, #B00070)', text: '#ffffff' },  // 5. Radio
            { bg: 'linear-gradient(135deg, #14b8a6, #0d9488)', text: '#ffffff' },  // 6. Logique
            { bg: 'linear-gradient(135deg, #84cc16, #65a30d)', text: '#ffffff' },  // 7. Boucles
            { bg: 'linear-gradient(135deg, #6366f1, #4f46e5)', text: '#ffffff' },  // 8. Math
            { bg: 'linear-gradient(135deg, #5ba58c, #459970)', text: '#ffffff' },  // 9. Texte
            { bg: 'linear-gradient(135deg, #ec4899, #db2777)', text: '#ffffff' },  // 10. Variables
            { bg: 'linear-gradient(135deg, #78716c, #57534e)', text: '#ffffff' },  // 11. Fonctions
            { bg: 'linear-gradient(135deg, #0ea5e9, #0284c7)', text: '#ffffff' },  // 12. Moteurs
            { bg: 'linear-gradient(135deg, #f97316, #ea580c)', text: '#ffffff' },  // 13. LEDs RGB
            { bg: 'linear-gradient(135deg, #a855f7, #9333ea)', text: '#ffffff' },  // 14. Capteurs
            { bg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', text: '#ffffff' }   // 15. Servo
        ];
        
        // Collecter les catégories avec leurs noms pour les sections
        const categoryByName = {};
        
        let colorIndex = 0;
        
        rows.forEach((row, idx) => {
            const text = row.textContent.trim();
            // Extraire le nom sans emoji
            const parts = text.split(' ');
            const name = parts.length > 1 ? parts.slice(1).join(' ') : text;
            
            // Stocker pour les sections
            categoryByName[name] = { row, index: idx };
            
            // Appliquer couleur
            if (colorIndex < categoryColors.length) {
                const colors = categoryColors[colorIndex];
                
                const parent = row.parentElement;
                const grandparent = parent?.parentElement;
                
                if (parent) {
                    parent.style.setProperty('height', 'auto', 'important');
                    parent.style.setProperty('margin', '3px 8px', 'important');
                    parent.style.setProperty('padding', '14px 16px', 'important');
                    parent.style.setProperty('background', colors.bg, 'important');
                    parent.style.setProperty('border-radius', '8px', 'important');
                    parent.style.setProperty('cursor', 'pointer', 'important');
                    parent.style.setProperty('outline', 'none', 'important');
                    parent.style.setProperty('border', 'none', 'important');
                }
                
                if (grandparent) {
                    grandparent.style.setProperty('margin-bottom', '2px', 'important');
                    grandparent.style.setProperty('outline', 'none', 'important');
                }
                
                const label = row.querySelector('.blocklyTreeLabel, [class*="TreeLabel"]');
                if (label) {
                    label.style.setProperty('color', colors.text, 'important');
                    label.style.setProperty('font-weight', '600', 'important');
                    label.style.setProperty('text-shadow', '0 1px 2px rgba(0, 0, 0, 0.2)', 'important');
                }
                
                // Effet hover sur le PARENT
                if (parent) {
                    parent.addEventListener('mouseenter', function() {
                        this.style.setProperty('opacity', '0.85', 'important');
                        this.style.setProperty('transform', 'translateX(2px)', 'important');
                    });
                    
                    parent.addEventListener('mouseleave', function() {
                        this.style.setProperty('opacity', '1', 'important');
                        this.style.setProperty('transform', 'translateX(0)', 'important');
                    });
                }
                
                colorIndex++;
            }
        });
        
        // Injecter les headers de section
        injectSectionHeaders(rows, categoryByName, TOOLBOX_SECTIONS);
    };
    
    setTimeout(tryApply, 500);
}

/**
 * Injecte les headers de section dans la toolbox
 */
function injectSectionHeaders(rows, categoryByName, sections) {
    sections.forEach(section => {
        const categoryData = categoryByName[section.firstCategory];
        
        if (!categoryData) {
            return;
        }
        
        const row = categoryData.row;
        const parent = row.parentElement;
        const grandparent = parent?.parentElement;
        
        if (!grandparent) {
            return;
        }
        
        // Vérifier si le header existe déjà
        const existingHeader = grandparent.parentElement?.querySelector(`.section-header-${section.firstCategory}`);
        if (existingHeader) {
            return;
        }
        
        // Créer le header
        const header = document.createElement('div');
        header.className = `toolbox-section-header section-header-${section.firstCategory}`;
        header.textContent = section.name;
        header.style.cssText = `
            display: block;
            margin: 16px 8px 8px 8px;
            padding: 10px 16px;
            background: linear-gradient(135deg, #1e293b, #334155);
            border-radius: 8px;
            border-left: 4px solid #8b5cf6;
            color: #e2e8f0;
            font-weight: 700;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            pointer-events: none;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        `;
        
        // Première section : moins de marge en haut
        if (categoryData.index === 0) {
            header.style.marginTop = '8px';
        }
        
        // Insérer le header AVANT le grandparent (le conteneur du bouton)
        grandparent.parentElement.insertBefore(header, grandparent);
    });
}

// ============== EVENT LISTENERS ==============
function initEventListeners() {
    document.getElementById('btnRun').onclick = runProgram;
    document.getElementById('btnStop').onclick = stopProgram;
    document.getElementById('btnReset').onclick = resetSimulator;
    document.getElementById('btnDownloadHex').onclick = downloadHex;
    document.getElementById('btnLoad').onclick = loadProject;
    document.getElementById('btnSettings').onclick = openSettingsDialog;
    
    // Bouton retour Carte 1
    const btnSwitchToCard1 = document.getElementById('btnSwitchToCard1');
    if (btnSwitchToCard1) {
        btnSwitchToCard1.onclick = () => switchToCard(1);
    }
    
    // Boutons Annuler / Répéter
    document.getElementById('btnUndo').onclick = () => {
        if (workspace) workspace.undo(false);
    };
    document.getElementById('btnRedo').onclick = () => {
        if (workspace) workspace.undo(true);
    };
    
    // Cutebot controls
    document.getElementById('btnDrawLine').onclick = () => {
        if (simulator) {
            simulator.setDrawMode('line');
            document.getElementById('btnDrawLine').classList.add('btn-active');
            document.getElementById('btnEraseLine').classList.remove('btn-active');
        }
    };
    
    document.getElementById('btnEraseLine').onclick = () => {
        if (simulator) {
            simulator.setDrawMode('erase');
            document.getElementById('btnEraseLine').classList.add('btn-active');
            document.getElementById('btnDrawLine').classList.remove('btn-active');
        }
    };
    
    document.getElementById('btnClearTrack').onclick = () => {
        if (simulator) simulator.clearTrack();
    };
    
    const lineWidthSlider = document.getElementById('lineWidth');
    const lineWidthValue = document.getElementById('lineWidthValue');
    if (lineWidthSlider && lineWidthValue) {
        lineWidthSlider.oninput = (e) => {
            lineWidthValue.textContent = e.target.value + 'px';
            if (simulator) simulator.setLineWidth(parseInt(e.target.value));
        };
    }
    
    document.getElementById('btnAddObstacle').onclick = () => {
        if (simulator) simulator.addObstacle();
    };
    
    initResizer();
    
    // Initialiser le nouveau gestionnaire de panneaux simulateurs
    if (typeof initSimulatorPanels === 'function') {
        initSimulatorPanels();
    }
    
    initMicrobitSliders();
    
    // Initialiser les contrôles dynamiques (cachés par défaut, affichés selon les blocs)
    initDynamicControls();
}

function setupRemoteModal() {
    const btnToggleRemote = document.getElementById('btnToggleRemote');
    const btnCloseRemote = document.getElementById('btnCloseRemote');
    const remoteModal = document.getElementById('remoteModal');
    
    // Fonction pour réinitialiser la position de la popup
    function resetRemotePosition() {
        if (remoteModal) {
            remoteModal.style.top = '50%';
            remoteModal.style.right = '16px';
            remoteModal.style.left = 'auto';
            remoteModal.style.transform = 'translateY(-50%)';
        }
    }
    
    if (btnToggleRemote && remoteModal) {
        btnToggleRemote.addEventListener('click', () => {
            if (remoteModal.style.display === 'block') {
                remoteModal.style.display = 'none';
                resetRemotePosition();
            } else {
                remoteModal.style.display = 'block';
            }
        });
    }
    
    if (btnCloseRemote && remoteModal) {
        btnCloseRemote.addEventListener('click', () => {
            remoteModal.style.display = 'none';
            resetRemotePosition();
        });
    }
    
    if (remoteModal) {
        remoteModal.addEventListener('click', (e) => {
            if (e.target === remoteModal) {
                remoteModal.style.display = 'none';
                resetRemotePosition();
            }
        });
    }
    
    // Bouton pince - utiliser un listener qui vérifie simulator au moment du clic
    const btnToggleGripper = document.getElementById('btnToggleGripper');
    if (btnToggleGripper) {
        btnToggleGripper.addEventListener('click', () => {
            if (simulator) {
                const isEnabled = simulator.toggleGripper();
                if (isEnabled) {
                    btnToggleGripper.classList.add('btn-active');
                } else {
                    btnToggleGripper.classList.remove('btn-active');
                }
            } else {
                console.warn('Simulator non initialisé - ouvrez le panneau Cutebot d\'abord');
            }
        });
    }
    
    // Drag de la popup télécommande
    const remoteHeader = document.querySelector('.remote-modal-header');
    if (remoteHeader && remoteModal) {
        let isDragging = false;
        let startX, startY, initialX, initialY;
        
        remoteHeader.addEventListener('mousedown', (e) => {
            // Ignorer si on clique sur le bouton fermer
            if (e.target.closest('.btn-close-remote')) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = remoteModal.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            
            // Désactiver le transform pour utiliser top/left
            remoteModal.style.transform = 'none';
            remoteModal.style.top = initialY + 'px';
            remoteModal.style.left = initialX + 'px';
            remoteModal.style.right = 'auto';
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            remoteModal.style.left = (initialX + dx) + 'px';
            remoteModal.style.top = (initialY + dy) + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }
}

function setupAccelModal() {
    const btnAccel = document.getElementById('btnAccel');
    const btnCloseAccel = document.getElementById('btnCloseAccel');
    const accelModal = document.getElementById('accelModal');
    const btnResetAccel = document.getElementById('btnResetAccel');
    
    // Sliders
    const accelXSlider = document.getElementById('accelXSlider');
    const accelYSlider = document.getElementById('accelYSlider');
    const accelZSlider = document.getElementById('accelZSlider');
    const accelForceSlider = document.getElementById('accelForceSlider');
    
    // Valeurs affichées
    const accelXValue = document.getElementById('accelXValue');
    const accelYValue = document.getElementById('accelYValue');
    const accelZValue = document.getElementById('accelZValue');
    const accelForceValue = document.getElementById('accelForceValue');
    
    // Fonction pour réinitialiser la position de la popup
    function resetAccelPosition() {
        if (accelModal) {
            accelModal.style.top = '50%';
            accelModal.style.right = '16px';
            accelModal.style.left = 'auto';
            accelModal.style.transform = 'translateY(-50%)';
        }
    }
    
    // Fonction pour calculer et afficher la force
    function updateForceDisplay() {
        const x = parseInt(accelXSlider?.value || 0);
        const y = parseInt(accelYSlider?.value || 0);
        const z = parseInt(accelZSlider?.value || 0);
        
        const strength = Math.round(Math.sqrt(x*x + y*y + z*z));
        
        if (accelForceSlider) accelForceSlider.value = Math.min(3500, strength);
        if (accelForceValue) accelForceValue.textContent = strength;
    }
    
    // Fonction pour mettre à jour les valeurs de l'accéléromètre
    function updateAccelValues() {
        if (!microbitSim) return;
        
        const x = parseInt(accelXSlider?.value || 0);
        const y = parseInt(accelYSlider?.value || 0);
        const z = parseInt(accelZSlider?.value || 0);
        
        microbitSim.acceleration = { x, y, z };
        
        if (accelXValue) accelXValue.textContent = x;
        if (accelYValue) accelYValue.textContent = y;
        if (accelZValue) accelZValue.textContent = z;
        
        updateForceDisplay();
    }
    
    // Bouton pour ouvrir/fermer la modal
    if (btnAccel && accelModal) {
        btnAccel.addEventListener('click', () => {
            if (accelModal.style.display === 'block') {
                accelModal.style.display = 'none';
                resetAccelPosition();
            } else {
                accelModal.style.display = 'block';
            }
        });
    }
    
    // Bouton fermer
    if (btnCloseAccel && accelModal) {
        btnCloseAccel.addEventListener('click', () => {
            accelModal.style.display = 'none';
            resetAccelPosition();
        });
    }
    
    // Fermer en cliquant à l'extérieur
    if (accelModal) {
        accelModal.addEventListener('click', (e) => {
            if (e.target === accelModal) {
                accelModal.style.display = 'none';
                resetAccelPosition();
            }
        });
    }
    
    // Événements des sliders X, Y, Z
    if (accelXSlider) {
        accelXSlider.oninput = () => updateAccelValues();
    }
    if (accelYSlider) {
        accelYSlider.oninput = () => updateAccelValues();
    }
    if (accelZSlider) {
        accelZSlider.oninput = () => updateAccelValues();
    }
    
    // Slider Force - augmente proportionnellement X, Y, Z
    if (accelForceSlider) {
        accelForceSlider.oninput = () => {
            const newStrength = parseInt(accelForceSlider.value);
            const x = parseInt(accelXSlider?.value || 0);
            const y = parseInt(accelYSlider?.value || 0);
            const z = parseInt(accelZSlider?.value || 0);
            
            const currentStrength = Math.sqrt(x*x + y*y + z*z);
            
            if (currentStrength > 0) {
                // Augmente/diminue proportionnellement
                const ratio = newStrength / currentStrength;
                const newX = Math.round(x * ratio);
                const newY = Math.round(y * ratio);
                const newZ = Math.round(z * ratio);
                
                // Clamp aux limites
                if (accelXSlider) accelXSlider.value = Math.max(-2048, Math.min(2048, newX));
                if (accelYSlider) accelYSlider.value = Math.max(-2048, Math.min(2048, newY));
                if (accelZSlider) accelZSlider.value = Math.max(-2048, Math.min(2048, newZ));
            } else {
                // Si tout est à 0, répartir également sur les 3 axes
                const perAxis = Math.round(newStrength / Math.sqrt(3));
                if (accelXSlider) accelXSlider.value = perAxis;
                if (accelYSlider) accelYSlider.value = perAxis;
                if (accelZSlider) accelZSlider.value = perAxis;
            }
            
            // Mettre à jour l'affichage
            if (accelForceValue) accelForceValue.textContent = newStrength;
            if (accelXValue) accelXValue.textContent = accelXSlider?.value || 0;
            if (accelYValue) accelYValue.textContent = accelYSlider?.value || 0;
            if (accelZValue) accelZValue.textContent = accelZSlider?.value || 0;
            
            // Mettre à jour le simulateur
            if (microbitSim) {
                microbitSim.acceleration = {
                    x: parseInt(accelXSlider?.value || 0),
                    y: parseInt(accelYSlider?.value || 0),
                    z: parseInt(accelZSlider?.value || 0)
                };
            }
        };
    }
    
    // Bouton réinitialiser
    if (btnResetAccel) {
        btnResetAccel.addEventListener('click', () => {
            if (accelXSlider) accelXSlider.value = 0;
            if (accelYSlider) accelYSlider.value = 0;
            if (accelZSlider) accelZSlider.value = 0;
            updateAccelValues();
        });
    }
    
    // Drag de la popup accéléromètre
    const accelHeader = document.querySelector('.accel-modal-header');
    if (accelHeader && accelModal) {
        let isDragging = false;
        let startX, startY, initialX, initialY;
        
        accelHeader.addEventListener('mousedown', (e) => {
            if (e.target.closest('.btn-close-remote')) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = accelModal.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            
            accelModal.style.transform = 'none';
            accelModal.style.top = initialY + 'px';
            accelModal.style.left = initialX + 'px';
            accelModal.style.right = 'auto';
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            accelModal.style.left = (initialX + dx) + 'px';
            accelModal.style.top = (initialY + dy) + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }
}

// ============== PROGRAM EXECUTION ==============
function updateGeneratedCode() {
    try {
        // Initialiser le générateur JavaScript avant de générer du code
        Blockly.JavaScript.init(workspace);
        
        // D'abord, retirer la classe orphan-block de TOUS les blocs
        const allBlocks = workspace.getAllBlocks(false);
        allBlocks.forEach(block => {
            const svgRoot = block.getSvgRoot();
            if (svgRoot) {
                svgRoot.classList.remove('orphan-block');
            }
        });
        
        // Parcourir tous les blocs de niveau supérieur
        const topBlocks = workspace.getTopBlocks(false);
        
        // Liste des types de blocs "événements" qui peuvent être exécutés (tous les blocs avec un chapeau)
        const eventBlockTypes = [
            'on_start',
            'forever',
            'input_on_button_pressed',
            'input_on_gesture',
            'input_on_logo_event',
            'radio_on_received_number',
            'radio_on_received_string',
            'cutebot_on_ir_receive',
            'cutebot_on_track_event',
            // Blocs de définition de fonction (ils sont valides en tant que blocs de niveau supérieur)
            'procedures_defnoreturn',
            'procedures_defreturn'
        ];
        
        let code = '';
        
        // Générer le code uniquement pour les blocs événements et définitions de fonctions
        // qui sont activés (pas les doublons désactivés)
        topBlocks.forEach(block => {
            if (eventBlockTypes.includes(block.type) && block.isEnabled()) {
                // Générer le code pour ce bloc
                // Note: les blocs procedures_def* retournent null mais stockent la définition dans definitions_
                const blockCode = Blockly.JavaScript.blockToCode(block);
                if (blockCode) {
                    code += blockCode;
                }
            } else if (!eventBlockTypes.includes(block.type)) {
                // Les autres blocs de niveau supérieur sont orphelins
                // Ajouter la classe CSS pour les griser visuellement
                const svgRoot = block.getSvgRoot();
                if (svgRoot) {
                    svgRoot.classList.add('orphan-block');
                }
            }
        });
        
        // Ajouter les définitions de fonctions au début du code
        const definitions = Blockly.JavaScript.definitions_;
        if (definitions) {
            let definitionsCode = '';
            for (const name in definitions) {
                definitionsCode += definitions[name];
            }
            if (definitionsCode) {
                code = definitionsCode + '\n' + code;
            }
        }
        
        currentCode = code;
    } catch (e) { 
        console.error('Error in updateGeneratedCode:', e);
    }
}

async function runProgram(keepPosition = false) {
    if (programRunning) return;
    
    programRunning = true;
    stopRequested = false;
    _execGeneration++;
    window._execGeneration = _execGeneration;
    const myGen = _execGeneration;
    
    runtime.reset();
    
    document.getElementById('btnRun').disabled = true;
    document.getElementById('btnStop').disabled = false;
    
    // Reset et démarrage des simulateurs
    if (microbitSim) {
        microbitSim.startNewExecution(); // Reset propre + prépare pour nouvelle exécution
    }
    
    if (simulator) {
        simulator.reset(keepPosition);
        simulator.start();
    }
    
    // Également exécuter la seconde carte radio si elle est activée
    let radioPromise = null;
    if (typeof window.radioSimulator !== 'undefined' && window.radioSimulator && window.radioSimulator.isEnabled()) {
        radioPromise = window.radioSimulator.runSecondProgram();
    }
    
    try {
        // Générer le code pour la carte 1
        let codeToRun;
        
        if (currentCard === 2) {
            if (card1Xml) {
                codeToRun = generateCodeFromXmlString(card1Xml);
            } else {
                updateGeneratedCode();
                codeToRun = currentCode;
            }
        } else {
            updateGeneratedCode();
            codeToRun = currentCode;
            const xml = Blockly.Xml.workspaceToDom(workspace);
            card1Xml = Blockly.Xml.domToText(xml);
        }
        
        if (!codeToRun || codeToRun.trim() === '') {
            showToast('⚠️ Programme vide', 'warning');
            programRunning = false;
            document.getElementById('btnRun').disabled = false;
            document.getElementById('btnStop').disabled = true;
            return;
        }
        
        // Execute code
        const asyncCode = `(async function() { ${codeToRun} })()`;
        await eval(asyncCode);
        
        // Vérifier si on a été annulé pendant l'eval
        if (_execGeneration !== myGen) throw new __StopExecution();
        
        // Run onStart callbacks
        for (const cb of runtime.onStartCallbacks) {
            if (_execGeneration !== myGen) throw new __StopExecution();
            await cb();
        }
        
        // Run forever loops
        while (_execGeneration === myGen && runtime.foreverCallbacks.length > 0) {
            for (const cb of runtime.foreverCallbacks) {
                if (_execGeneration !== myGen) throw new __StopExecution();
                await cb();
                await __pause(10);
            }
        }
    } catch (e) {
        if (e instanceof __StopExecution) {
            // Arrêt propre — pas d'erreur à afficher
        } else {
            console.error('🎯 Erreur exécution:', e);
            showToast('❌ Erreur: ' + e.message, 'error');
        }
    }
    
    // Seulement si c'est NOTRE exécution qui finit (pas une ancienne)
    if (_execGeneration === myGen) {
        programRunning = false;
        document.getElementById('btnRun').disabled = false;
        document.getElementById('btnStop').disabled = true;
    }
}

// Générer du code JavaScript depuis une chaîne XML
function generateCodeFromXmlString(xmlString) {
    try {
        if (!xmlString || xmlString.trim() === '') {
            return '';
        }
        
        // Workspace temporaire SANS affichage (headless).
        // Ne pas utiliser Blockly.inject ici : créer un workspace affiché vole le focus
        // du champ en cours de saisie (l'élève devait recliquer après chaque relance auto).
        const tempWorkspace = new Blockly.Workspace();
        try {
            const xml = Blockly.utils.xml.textToDom(xmlString);
            Blockly.Xml.domToWorkspace(xml, tempWorkspace);
            return Blockly.JavaScript.workspaceToCode(tempWorkspace);
        } finally {
            tempWorkspace.dispose();
        }
    } catch (e) {
        console.error('🔧 Erreur génération code depuis XML:', e);
        return '';
    }
}

function stopProgram(silent = false) {
    stopRequested = true;
    
    // Incrémenter la génération pour annuler toutes les pauses en cours
    _execGeneration++;
    window._execGeneration = _execGeneration;
    
    // Vider les callbacks pour arrêter les boucles
    runtime.reset();
    
    if (simulator) {
        simulator.stopSimulation();
    }
    
    if (microbitSim) {
        microbitSim.stopAllAnimations();
        microbitSim.clearScreen();
    }
    
    // Également arrêter la seconde carte radio
    if (typeof window.radioSimulator !== 'undefined' && window.radioSimulator) {
        window.radioSimulator.stopSecondProgram();
    }
    
    // Forcer programRunning à false (l'ancienne exécution verra le changement de génération)
    programRunning = false;
    document.getElementById('btnRun').disabled = false;
    document.getElementById('btnStop').disabled = true;
    
    if (!silent) {
        showToast('⏹️ Programme arrêté', 'info');
    }
}

function resetSimulator(forceRun = false) {
    // Si forceRun est un Event (appelé via onclick), le considérer comme false
    if (forceRun instanceof Event) {
        forceRun = false;
    }
    
    const wasRunning = programRunning || !document.getElementById('btnStop').disabled;
    
    // Arrêter proprement le programme en cours (incrémente la génération)
    stopProgram(true);
    
    if (simulator) {
        simulator.reset();
    }
    
    if (microbitSim) {
        microbitSim.startNewExecution(); // Reset complet + prêt pour nouvelle exécution
    }
    
    if (barrierSimulator) {
        barrierSimulator.reset();
    }
    
    if (typeof portillonSimulator !== 'undefined' && portillonSimulator) {
        portillonSimulator.reset();
    }
    
    // Réinitialiser également la seconde carte radio
    if (typeof window.radioSimulator !== 'undefined' && window.radioSimulator) {
        window.radioSimulator.resetSecondMicrobit();
    }
    
    showToast('🔄 Simulateurs réinitialisés', 'info');
    
    // Relancer — programRunning est déjà false grâce à stopProgram()
    if (wasRunning || forceRun) {
        // Petit délai pour laisser les microtasks se résoudre
        setTimeout(() => {
            runProgram();
        }, 50);
    }
}

// ============== CODE DISPLAY ==============
function showCode() {
    updateGeneratedCode();
    
    const hexGen = new HexGenerator();
    const tsCode = hexGen.generateMakeCodeTS(currentCode);
    
    document.getElementById('codeDisplay').textContent = tsCode;
    document.getElementById('codeModal').classList.add('active');
}

function closeCodeModal() {
    document.getElementById('codeModal').classList.remove('active');
}

function copyCode() {
    const code = document.getElementById('codeDisplay').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showToast('📋 Code copié!', 'success');
    });
}

function openInMakeCode() {
    updateGeneratedCode();
    // Utilise la fonction globale de hex-generator.js qui télécharge le .mkcd et affiche le dialog
    downloadHexFile(currentCode);
}

async function downloadHex(event) {
    updateGeneratedCode();

    // Programme avec erreurs (valeurs impossibles, cases vides, blocs non accrochés…) :
    // téléchargement bloqué et erreurs montrées sur les blocs (voir js/program-checker.js).
    if (window.ProgramChecker && !window.ProgramChecker.guardDownload(event)) {
        return;
    }

    // Préparer les métadonnées du projet (Blockly XML) pour les embarquer dans le HEX
    const currentXml = Blockly.Xml.workspaceToDom(workspace);
    const currentXmlText = Blockly.Xml.domToText(currentXml);
    if (currentCard === 1) {
        card1Xml = currentXmlText;
    } else {
        card2Xml = currentXmlText;
    }
    
    const projectMeta = {
        version: 2,
        card1: card1Xml || currentXmlText,
        card2: card2Xml || card1Xml || currentXmlText,
        card2DuplicateFromCard1: card2DuplicateFromCard1
    };
    
    // Utilise la fonction globale de hex-generator.js qui télécharge le HEX avec métadonnées embarquées
    await downloadHexFile(currentCode, projectMeta);
}

// ============== SAVE/LOAD ==============
function loadProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml,.json,.hex,.mkcd';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const content = ev.target.result;
                
                // ===== Détection fichier HEX avec métadonnées embarquées =====
                if (file.name.endsWith('.hex') || content.trimStart().startsWith(':')) {
                    const PBLOCKS_MARKER = '### PBLOCKS_PROJECT ###';
                    const markerIndex = content.indexOf(PBLOCKS_MARKER);
                    
                    if (markerIndex === -1) {
                        // Pas de données P-Blocks : c'est peut-être un .hex venant de
                        // makecode.microbit.org, qui embarque son projet autrement.
                        if (window.MakeCodeImport && MakeCodeImport.isMakeCodeHex(content)) {
                            try {
                                const res = MakeCodeImport.convertHex(content);

                                const xml = Blockly.utils.xml.textToDom(res.xml);
                                workspace.clear();
                                Blockly.Xml.domToWorkspace(xml, workspace);

                                // Un projet MakeCode ne concerne qu'une seule carte
                                card1Xml = res.xml;
                                card2Xml = null;
                                card2Initialized = false;

                                showToast(`📂 Projet MakeCode importé : ${res.count} bloc(s)`, 'success');
                                if (res.unsupported.length || res.warnings.length) {
                                    showMakeCodeImportReport(res);
                                }
                                updateCard2ButtonVisibility();
                                openRequiredPanelsAndRun();
                            } catch (mcErr) {
                                console.error('Erreur import MakeCode:', mcErr);
                                showToast('❌ ' + mcErr.message, 'error');
                            }
                            return;
                        }

                        showToast('❌ Ce fichier HEX ne contient pas de données P-Blocks', 'error');
                        return;
                    }
                    
                    const jsonStr = content.substring(markerIndex + PBLOCKS_MARKER.length).trim();
                    const projectData = JSON.parse(jsonStr);
                    
                    if (projectData.version === 2 && projectData.card1) {
                        card1Xml = projectData.card1;
                        card2Xml = projectData.card2 || null;
                        card2Initialized = !!card2Xml;
                        card2DuplicateFromCard1 = projectData.card2DuplicateFromCard1 !== undefined ? projectData.card2DuplicateFromCard1 : true;
                        
                        const xmlToLoad = currentCard === 1 ? card1Xml : card2Xml || card1Xml;
                        const xml = Blockly.utils.xml.textToDom(xmlToLoad);
                        workspace.clear();
                        Blockly.Xml.domToWorkspace(xml, workspace);
                        
                        const cardsMsg = card2Xml ? ' (2 cartes)' : '';
                        showToast('📂 Projet chargé depuis HEX' + cardsMsg, 'success');
                        updateCard2ButtonVisibility();
                        openRequiredPanelsAndRun();
                        return;
                    } else {
                        showToast('❌ Métadonnées HEX invalides', 'error');
                        return;
                    }
                }
                
                // ===== Détection fichier .mkcd (MakeCode project) =====
                if (file.name.endsWith('.mkcd')) {
                    try {
                        const mkcdData = JSON.parse(content);
                        
                        // Chercher les metadonnees Blockly embarquees
                        if (mkcdData['_blockly_project']) {
                            const projectData = JSON.parse(mkcdData['_blockly_project']);
                            
                            if (projectData.version === 2 && projectData.card1) {
                                card1Xml = projectData.card1;
                                card2Xml = projectData.card2 || null;
                                card2Initialized = !!card2Xml;
                                card2DuplicateFromCard1 = projectData.card2DuplicateFromCard1 !== undefined ? projectData.card2DuplicateFromCard1 : true;
                                
                                const xmlToLoad = currentCard === 1 ? card1Xml : card2Xml || card1Xml;
                                const xml = Blockly.utils.xml.textToDom(xmlToLoad);
                                workspace.clear();
                                Blockly.Xml.domToWorkspace(xml, workspace);
                                
                                const cardsMsg = card2Xml ? ' (2 cartes)' : '';
                                showToast('📂 Projet chargé depuis .mkcd' + cardsMsg, 'success');
                                updateCard2ButtonVisibility();
                                openRequiredPanelsAndRun();
                                return;
                            } else if (projectData.card1) {
                                // Format v1 simple
                                const xml = Blockly.utils.xml.textToDom(projectData.card1);
                                workspace.clear();
                                Blockly.Xml.domToWorkspace(xml, workspace);
                                showToast('📂 Projet chargé depuis .mkcd', 'success');
                                openRequiredPanelsAndRun();
                                return;
                            }
                        }
                        
                        // Pas de metadonnees Blockly : fichier mkcd sans blocs
                        showToast('⚠️ Ce fichier .mkcd ne contient pas de données de blocs.\nIl a peut-être été créé avec une ancienne version.', 'error');
                        return;
                        
                    } catch (mkcdErr) {
                        console.error('Erreur parsing mkcd:', mkcdErr);
                        showToast('❌ Fichier .mkcd invalide', 'error');
                        return;
                    }
                }
                
                // Essayer de parser comme nouveau format XML (version 2 avec deux cartes)
                if (content.includes('<project version="2">')) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(content, 'text/xml');
                    
                    const card1El = doc.querySelector('card1');
                    const card2El = doc.querySelector('card2');
                    
                    if (card1El && card2El) {
                        card1Xml = card1El.innerHTML;
                        card2Xml = card2El.innerHTML;
                        card2Initialized = true;
                        
                        // Charger le programme de la carte actuelle
                        const xmlToLoad = currentCard === 1 ? card1Xml : card2Xml;
                        const xml = Blockly.utils.xml.textToDom(xmlToLoad);
                        workspace.clear();
                        Blockly.Xml.domToWorkspace(xml, workspace);
                        
                        showToast('📂 Projet chargé (2 cartes)', 'success');
                        updateCard2ButtonVisibility();
                        
                        // Ouvrir les panneaux nécessaires et lancer la simulation
                        openRequiredPanelsAndRun();
                        return;
                    }
                }
                
                // Essayer de parser comme JSON (ancien format v2 JSON si existant)
                try {
                    const projectData = JSON.parse(content);
                    if (projectData.version === 2) {
                        card1Xml = projectData.card1;
                        card2Xml = projectData.card2;
                        card2Initialized = true;
                        card2DuplicateFromCard1 = projectData.card2DuplicateFromCard1 !== undefined ? projectData.card2DuplicateFromCard1 : true;
                        
                        const xmlToLoad = currentCard === 1 ? card1Xml : card2Xml;
                        const xml = Blockly.utils.xml.textToDom(xmlToLoad);
                        workspace.clear();
                        Blockly.Xml.domToWorkspace(xml, workspace);
                        
                        showToast('📂 Projet chargé (2 cartes)', 'success');
                        updateCard2ButtonVisibility();
                        
                        // Ouvrir les panneaux nécessaires et lancer la simulation
                        openRequiredPanelsAndRun();
                        return;
                    }
                } catch (jsonErr) {
                    // Ce n'est pas du JSON, continuer avec le format XML simple
                }
                
                // Ancien format XML simple (une seule carte)
                const xml = Blockly.utils.xml.textToDom(content);
                workspace.clear();
                Blockly.Xml.domToWorkspace(xml, workspace);
                
                // Stocker comme carte 1, réinitialiser carte 2
                card1Xml = content;
                card2Xml = null;
                card2Initialized = false;
                
                showToast('📂 Projet chargé', 'success');
                updateCard2ButtonVisibility();
                
                // Ouvrir les panneaux nécessaires et lancer la simulation
                openRequiredPanelsAndRun();
            } catch (err) {
                console.error('Erreur de chargement:', err);
                showToast('❌ Erreur de chargement', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

/**
 * Affiche ce qui n'a pas pu être importé depuis un projet MakeCode.
 * Mieux vaut le dire clairement que de laisser croire à un import complet.
 */
function showMakeCodeImportReport(res) {
    let msg = '';
    if (res.unsupported && res.unsupported.length) {
        msg += 'Blocs MakeCode sans équivalent (non importés) :\n  • '
            + res.unsupported.join('\n  • ') + '\n';
    }
    if (res.warnings && res.warnings.length) {
        if (msg) msg += '\n';
        msg += 'Adaptations effectuées :\n  • ' + res.warnings.join('\n  • ');
    }
    if (!msg) return;
    console.warn('[Import MakeCode]\n' + msg);
    setTimeout(() => {
        showToast('⚠️ Import partiel : voir le détail affiché', 'error');
        alert('Import MakeCode terminé\n\n' + msg
            + '\n\nLe reste du programme a été importé normalement.');
    }, 700);
}

/**
 * Ouvre les panneaux de simulateurs nécessaires selon les blocs présents
 * et ferme les autres (sauf micro:bit qui reste toujours ouvert)
 * puis lance la simulation
 */
function openRequiredPanelsAndRun() {
    const allBlocks = workspace.getAllBlocks(false);
    let needsCutebot = false;
    let needsBarrier = false;
    let needsPortillon = false;
    
    // Reinitialiser le suivi des fermetures utilisateur (chargement de projet)
    if (simulatorPanels) simulatorPanels.clearUserClosedPanels();
    
    // Détecter les types de blocs utilisés
    for (const block of allBlocks) {
        const type = block.type;
        if (type.startsWith('cutebot_') && type !== 'cutebot_if') needsCutebot = true;
        if (type.startsWith('barrier_') || (type.startsWith('servo_') && !type.startsWith('portillon_'))) needsBarrier = true;
        if (type.startsWith('portillon_') || type.startsWith('rfid_')) needsPortillon = true;
    }
    
    // Ouvrir/fermer les panneaux selon les besoins (mode auto)
    if (simulatorPanels) {
        const cutebotPanel = simulatorPanels.getPanel('cutebot');
        if (cutebotPanel) {
            const isCollapsed = cutebotPanel.classList.contains('collapsed');
            if (needsCutebot && isCollapsed) {
                simulatorPanels.togglePanel(cutebotPanel, true);
            } else if (!needsCutebot && !isCollapsed) {
                simulatorPanels.togglePanel(cutebotPanel, true);
            }
        }
        
        const barrierPanel = simulatorPanels.getPanel('barrier');
        if (barrierPanel) {
            const isCollapsed = barrierPanel.classList.contains('collapsed');
            if (needsBarrier && isCollapsed) {
                simulatorPanels.togglePanel(barrierPanel, true);
            } else if (!needsBarrier && !isCollapsed) {
                simulatorPanels.togglePanel(barrierPanel, true);
            }
        }
        
        const portillonPanel = simulatorPanels.getPanel('portillon');
        if (portillonPanel) {
            const isCollapsed = portillonPanel.classList.contains('collapsed');
            if (needsPortillon && isCollapsed) {
                simulatorPanels.togglePanel(portillonPanel, true);
            } else if (!needsPortillon && !isCollapsed) {
                simulatorPanels.togglePanel(portillonPanel, true);
            }
        }
    }
    
    // Attendre que les simulateurs soient initialisés puis lancer
    // Le délai permet aux panneaux de s'ouvrir et aux simulateurs de s'initialiser
    const checkAndRun = (attempts = 0) => {
        // Si on a besoin de Cutebot mais qu'il n'est pas encore initialisé
        if (needsCutebot && !simulator && attempts < 20) {
            setTimeout(() => checkAndRun(attempts + 1), 100);
            return;
        }
        
        // Lancer la simulation
        resetSimulator(true);
    };
    
    // Démarrer la vérification après un court délai pour laisser les panneaux s'ouvrir
    setTimeout(() => checkAndRun(), 300);
}

// ============== GESTION BASCULEMENT CARTE 1 / CARTE 2 ==============

function switchToCard(cardNumber) {
    if (currentCard === cardNumber) return;
    
    // Sauvegarder le programme actuel
    const currentXml = Blockly.Xml.workspaceToDom(workspace);
    const currentXmlText = Blockly.Xml.domToText(currentXml);
    
    if (currentCard === 1) {
        card1Xml = currentXmlText;
        // Si duplication active, synchroniser carte 2 aussi
        if (card2DuplicateFromCard1) {
            card2Xml = currentXmlText;
            card2Initialized = true;
        }
    } else {
        card2Xml = currentXmlText;
    }
    
    // Passer à l'autre carte
    currentCard = cardNumber;
    window.currentCard = currentCard; // Exposer globalement
    
    // Charger le programme de la nouvelle carte
    if (cardNumber === 2) {
        // Si duplication active ou première ouverture : dupliquer carte 1
        if (card2DuplicateFromCard1 || !card2Initialized) {
            card2Xml = card1Xml;
            card2Initialized = true;
        }
        
        if (card2Xml) {
            try {
                const xml = Blockly.utils.xml.textToDom(card2Xml);
                workspace.clear();
                Blockly.Xml.domToWorkspace(xml, workspace);
            } catch (e) {
                console.error('Erreur chargement carte 2:', e);
            }
        }
    } else {
        // Retour à carte 1
        if (card1Xml) {
            try {
                const xml = Blockly.utils.xml.textToDom(card1Xml);
                workspace.clear();
                Blockly.Xml.domToWorkspace(xml, workspace);
            } catch (e) {
                console.error('Erreur chargement carte 1:', e);
            }
        }
    }
    
    // Mettre à jour l'interface
    updateCardUI();
    
    // Relancer les programmes (carte 1 et carte 2)
    stopProgram(true); // Arrêter proprement l'ancien programme
    setTimeout(() => {
        runProgram(true); // keepPosition=true
    }, 50);
}

function updateCardUI() {
    const header = document.getElementById('editorPanelHeader');
    const title = document.getElementById('editorPanelTitle');
    const btnCard1 = document.getElementById('btnSwitchToCard1');
    const blocklyDiv = document.getElementById('blocklyDiv');
    const appHeader = document.querySelector('header.header');
    const btnMakeCode = document.getElementById('btnDownloadHex');
    const btnMakeCodeText = btnMakeCode ? btnMakeCode.querySelector('span') : null;
    
    if (currentCard === 2) {
        // Mode Carte 2 - Style rose
        header.classList.add('card2-mode');
        title.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            📻 Programme Carte 2 (carte distante)
            <label id="duplicateCard1Label" style="display:inline-flex;align-items:center;gap:5px;margin-left:16px;font-size:12px;font-weight:normal;cursor:pointer;opacity:0.9;background:rgba(255,255,255,0.15);padding:3px 10px;border-radius:12px;">
                <input type="checkbox" id="chkDuplicateCard1" ${card2DuplicateFromCard1 ? 'checked' : ''} 
                    style="cursor:pointer;accent-color:#e3008c;width:14px;height:14px;">
                Dupliquer le programme de la carte principale
            </label>
        `;
        
        // Brancher l'événement de la checkbox
        const chk = document.getElementById('chkDuplicateCard1');
        if (chk) {
            chk.addEventListener('change', (e) => {
                card2DuplicateFromCard1 = e.target.checked;
                if (card2DuplicateFromCard1) {
                    // Recocher = dupliquer immédiatement le programme de la carte 1
                    if (card1Xml) {
                        card2Xml = card1Xml;
                        try {
                            const xml = Blockly.utils.xml.textToDom(card2Xml);
                            workspace.clear();
                            Blockly.Xml.domToWorkspace(xml, workspace);
                        } catch (err) {
                            console.error('Erreur duplication carte 1 → carte 2:', err);
                        }
                        showToast('📻 Programme carte 1 dupliqué vers la carte distante', 'info');
                    }
                } else {
                    showToast('📻 La carte distante a maintenant son propre programme', 'info');
                }
            });
        }
        
        btnCard1.style.display = 'flex';
        blocklyDiv.classList.add('card2-workspace');
        
        // Mettre à jour le bouton "Éditer" dans le panneau radio
        const radioEditBtn = document.querySelector('.radio-edit-btn span');
        if (radioEditBtn) {
            radioEditBtn.textContent = 'Fermer le programme de la carte 2';
        }
        
        // Header de l'application en rose
        if (appHeader) {
            appHeader.classList.add('card2-mode');
        }
        
        // Bouton MakeCode en rose (style inline pour forcer)
        if (btnMakeCode) {
            btnMakeCode.classList.add('card2-mode');
            btnMakeCode.style.background = 'linear-gradient(135deg, #e3008c, #a855f7)';
            btnMakeCode.style.borderColor = '#e3008c';
            btnMakeCode.style.boxShadow = '0 0 10px rgba(227, 0, 140, 0.5)';
        }
        
        // Changer le texte du bouton télécharger
        if (btnMakeCodeText) {
            btnMakeCodeText.textContent = (window.WebUSBFlasher && window.WebUSBFlasher.checkSupport()) 
                ? 'Téléverser / Télécharger (carte 2)' 
                : 'Télécharger le programme de la carte 2';
        }
        
        // Changer la couleur de fond du workspace Blockly (rose plus prononcé)
        if (workspace) {
            const svgGroup = workspace.svgGroup_;
            if (svgGroup) {
                const bgRect = svgGroup.parentElement.querySelector('.blocklyMainBackground');
                if (bgRect) bgRect.style.fill = '#fbcfe8';
            }
        }
    } else {
        // Mode Carte 1 - Style normal
        header.classList.remove('card2-mode');
        title.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M20,6h-4V4c0-1.11-0.89-2-2-2h-4C8.89,2,8,2.89,8,4v2H4C2.89,6,2.01,6.89,2.01,8L2,19c0,1.11,0.89,2,2,2h16c1.11,0,2-0.89,2-2V8C22,6.89,21.11,6,20,6z M10,4h4v2h-4V4z"/>
            </svg>
            Programmation par blocs
        `;
        btnCard1.style.display = 'none';
        updateCard2ButtonVisibility();
        blocklyDiv.classList.remove('card2-workspace');
        
        // Remettre le texte du bouton "Éditer" dans le panneau radio
        const radioEditBtn = document.querySelector('.radio-edit-btn span');
        if (radioEditBtn) {
            radioEditBtn.textContent = 'Éditer le programme de la carte 2';
        }
        
        // Header de l'application normal
        if (appHeader) {
            appHeader.classList.remove('card2-mode');
        }
        
        // Bouton MakeCode normal (bleu) - retirer les styles inline
        if (btnMakeCode) {
            btnMakeCode.classList.remove('card2-mode');
            btnMakeCode.style.background = '';
            btnMakeCode.style.borderColor = '';
            btnMakeCode.style.boxShadow = '';
        }
        
        // Remettre le texte du bouton télécharger
        if (btnMakeCodeText) {
            btnMakeCodeText.textContent = (window.WebUSBFlasher && window.WebUSBFlasher.checkSupport())
                ? 'Téléverser / Télécharger'
                : 'Télécharger mon programme';
        }
        
        // Remettre la couleur de fond normale
        if (workspace) {
            const svgGroup = workspace.svgGroup_;
            if (svgGroup) {
                const bgRect = svgGroup.parentElement.querySelector('.blocklyMainBackground');
                if (bgRect) bgRect.style.fill = '#e5e7eb';
            }
        }
    }
}

function updateCard2ButtonVisibility() {
    // Vérifier s'il y a des blocs radio dans le workspace actuel (carte 1)
    const hasRadioBlocks = checkForRadioBlocks();
    
    if (currentCard === 1) {
        // Afficher ou masquer le simulateur de la carte 2 selon la présence de blocs radio
        if (window.radioSimulator) {
            if (hasRadioBlocks) {
                // S'assurer que le simulateur est activé
                if (!window.radioSimulator.isEnabled()) {
                    window.radioSimulator.enable();
                }
            } else {
                // Masquer le simulateur de la carte 2
                if (window.radioSimulator.isEnabled()) {
                    window.radioSimulator.disable();
                }
            }
            // Mettre à jour l'avertissement groupe radio
            if (window.radioSimulator.updateGroupWarning) {
                const hasGroupBlock = workspace && workspace.getAllBlocks().some(b => b.type === 'radio_set_group');
                window.radioSimulator.updateGroupWarning(hasRadioBlocks, hasGroupBlock);
            }
        }
    }
}

function checkForRadioBlocks() {
    if (!workspace) return false;
    
    const allBlocks = workspace.getAllBlocks();
    return allBlocks.some(block => {
        const type = block.type;
        return type && (
            type.startsWith('radio_') ||
            type === 'radio_send_number' ||
            type === 'radio_send_value' ||
            type === 'radio_send_string' ||
            type === 'radio_on_receive_number' ||
            type === 'radio_on_receive_string' ||
            type === 'radio_on_receive_value' ||
            type === 'radio_set_group' ||
            type === 'radio_received_number' ||
            type === 'radio_received_string'
        );
    });
}

function getCard2XmlForExecution() {
    // Retourne le XML de la carte 2 pour l'exécution
    if (currentCard === 2) {
        // On est sur la carte 2, prendre le workspace actuel
        const xml = Blockly.Xml.workspaceToDom(workspace);
        return Blockly.Xml.domToText(xml);
    }
    return card2Xml;
}

// Exposer globalement pour radio-simulator
window.getCard2XmlForExecution = getCard2XmlForExecution;
window.switchToCard = switchToCard;
window.currentCard = currentCard;

// ============== UI HELPERS ==============
// toggleSection - Remplacée par SimulatorPanelsManager
function toggleSection(section) {
    // Fonction conservée pour compatibilité - gérée par simulator-panels.js
    if (simulatorPanels) {
        const panel = simulatorPanels.getPanel(section);
        if (panel) simulatorPanels.togglePanel(panel);
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function initResizer() {
    const resizer = document.getElementById('resizer');
    const editorPanel = document.querySelector('.editor-panel');
    const simulatorPanel = document.querySelector('.simulator-panel');
    
    if (!resizer || !editorPanel || !simulatorPanel) return;
    
    let isResizing = false;
    
    // Creer le bouton de reouverture du simulateur
    let reopenBtn = document.getElementById('simulatorReopenBtn');
    if (!reopenBtn) {
        reopenBtn = document.createElement('button');
        reopenBtn.id = 'simulatorReopenBtn';
        reopenBtn.className = 'simulator-reopen-btn';
        reopenBtn.innerHTML = '◀ Simulateur';
        reopenBtn.title = 'Réouvrir le simulateur';
        reopenBtn.style.display = 'none';
        reopenBtn.addEventListener('click', () => {
            editorPanel.style.flex = '0 0 55%';
            simulatorPanel.style.flex = '0 0 44.5%';
            simulatorPanel.style.display = '';
            resizer.style.display = '';
            reopenBtn.style.display = 'none';
            Blockly.svgResize(workspace);
            if (window.simulatorPanels) window.simulatorPanels.distributeSpace();
        });
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.appendChild(reopenBtn);
    }
    
    function checkSimulatorVisible() {
        const container = document.querySelector('.main-content');
        if (!container) return;
        const containerWidth = container.getBoundingClientRect().width;
        const simWidth = simulatorPanel.getBoundingClientRect().width;
        
        if (simWidth < 30) {
            // Simulateur trop petit, le cacher et afficher le bouton
            simulatorPanel.style.display = 'none';
            resizer.style.display = 'none';
            editorPanel.style.flex = '1 1 100%';
            reopenBtn.style.display = '';
        } else {
            reopenBtn.style.display = 'none';
        }
    }
    
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });
    
    // Double-clic pour remettre 50/50
    resizer.addEventListener('dblclick', (e) => {
        editorPanel.style.flex = '0 0 55%';
        simulatorPanel.style.flex = '0 0 44.5%';
        Blockly.svgResize(workspace);
        if (window.simulatorPanels) window.simulatorPanels.distributeSpace();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const container = document.querySelector('.main-content');
        const containerRect = container.getBoundingClientRect();
        const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        
        // Permettre de reduire completement (0%) ou d'agrandir completement (100%)
        if (newWidth >= 0 && newWidth <= 100) {
            editorPanel.style.flex = `0 0 ${newWidth}%`;
            simulatorPanel.style.flex = `0 0 ${100 - newWidth - 0.5}%`;
            
            // Reappliquer la marge des controles de zoom avant le resize
            if (workspace && workspace.zoomControls_) {
                workspace.zoomControls_.MARGIN_VERTICAL = 80;
            }
            
            Blockly.svgResize(workspace);
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            // Recalculer les panneaux apres le redimensionnement
            if (window.simulatorPanels) window.simulatorPanels.distributeSpace();
            // Verifier si le simulateur est trop petit
            checkSimulatorVisible();
        }
    });
}

// Gestion dynamique des contrôles du simulateur micro:bit
// Les contrôles s'affichent uniquement quand les blocs correspondants sont utilisés
function initDynamicControls() {
    // Mapping des types de blocs vers les contrôles
    const blockToControl = {
        // Capteurs
        'input_temperature': ['temperature'],
        'input_light_level': ['light'],
        'input_compass_heading': ['compass'],
        'input_magnetic_force': ['magnetic'],
        'input_sound_level': ['sound'],
        'input_acceleration': ['accelerometer'],
        'input_rotation': ['rotation'],
        
        // Gestes (mapping vers contrôles)
        'input_on_gesture': [] // Géré spécialement selon le geste
        
        // Note: input_on_button_pressed et input_button_is_pressed sont gérés
        // spécialement plus bas pour ne montrer A+B que si "A+B" est sélectionné
    };
    
    // Mapping des gestes vers les contrôles
    const gestureToControl = {
        'shake': 'shake',
        'logo up': 'logo',
        'logo down': 'logo',
        'screen up': 'screen',
        'screen down': 'screen',
        'tilt left': 'rotation',
        'tilt right': 'rotation',
        'free fall': 'accelerometer',
        '3g': 'accelerometer',
        '6g': 'accelerometer'
    };
    
    // État actuel des contrôles visibles
    let visibleControls = new Set();
    let radioVisibleControls = new Set();
    
    // Calcule les contrôles visibles à partir d'un XML Blockly (sans workspace Blockly)
    function computeVisibleControlsFromXmlString(xmlString) {
        if (!xmlString) return new Set();
        const visible = new Set();
        try {
            const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
            doc.querySelectorAll('block').forEach(block => {
                const type = block.getAttribute('type');
                if (!type) return;
                if (blockToControl[type]) {
                    blockToControl[type].forEach(c => visible.add(c));
                }
                if (type === 'input_on_gesture') {
                    const field = block.querySelector('field[name="GESTURE"]');
                    if (field && gestureToControl[field.textContent]) {
                        visible.add(gestureToControl[field.textContent]);
                    }
                }
                if (type === 'input_on_button_pressed' || type === 'input_button_is_pressed') {
                    const field = block.querySelector('field[name="BUTTON"]');
                    if (field && field.textContent === 'AB') visible.add('buttonAB');
                }
            });
        } catch (e) {}
        return visible;
    }
    
    // Fonction pour scanner le workspace et déterminer les contrôles à afficher
    function updateVisibleControls() {
        const newVisibleControls = new Set();
        
        if (!workspace) return;
        
        // Parcourir tous les blocs du workspace
        const allBlocks = workspace.getAllBlocks(false);
        
        for (const block of allBlocks) {
            const blockType = block.type;
            
            // Vérifier si ce bloc a des contrôles associés
            if (blockToControl[blockType]) {
                blockToControl[blockType].forEach(ctrl => newVisibleControls.add(ctrl));
            }
            
            // Traitement spécial pour les gestes
            if (blockType === 'input_on_gesture') {
                const gesture = block.getFieldValue('GESTURE');
                if (gesture && gestureToControl[gesture]) {
                    newVisibleControls.add(gestureToControl[gesture]);
                }
            }
            
            // Traitement spécial pour les boutons A+B
            if (blockType === 'input_on_button_pressed' || blockType === 'input_button_is_pressed') {
                const button = block.getFieldValue('BUTTON');
                // La valeur interne est 'AB' (pas 'A+B')
                if (button === 'AB') {
                    newVisibleControls.add('buttonAB');
                }
            }
        }
        
        // Appliquer les changements seulement si nécessaire
        if (!setsEqual(visibleControls, newVisibleControls)) {
            visibleControls = newVisibleControls;
            applyControlVisibility(newVisibleControls);
        }
        
        // Mettre à jour les contrôles du panneau radio (carte distante)
        if (window.radioSimulator && window.radioSimulator.isEnabled()) {
            let card2VisibleControls;
            if (currentCard === 2) {
                // On édite la carte 2 : scanner le workspace directement
                card2VisibleControls = new Set(newVisibleControls);
            } else if (card2DuplicateFromCard1) {
                // Carte 2 = copie de carte 1
                card2VisibleControls = new Set(newVisibleControls);
            } else {
                // Carte 2 a son propre programme : parser son XML
                card2VisibleControls = computeVisibleControlsFromXmlString(card2Xml);
            }
            if (!setsEqual(radioVisibleControls, card2VisibleControls)) {
                radioVisibleControls = card2VisibleControls;
                applyRadioControlVisibility(card2VisibleControls);
            }
        }
    }
    
    // Comparer deux Sets
    function setsEqual(a, b) {
        if (a.size !== b.size) return false;
        for (const item of a) {
            if (!b.has(item)) return false;
        }
        return true;
    }
    
    // Appliquer la visibilité des contrôles
    function applyControlVisibility(visible) {
        const allControls = document.querySelectorAll('.sim-panel[data-id="microbit"] .control-item[data-control]');
        
        allControls.forEach(control => {
            const controlName = control.dataset.control;
            const shouldBeVisible = visible.has(controlName);
            const isCurrentlyHidden = control.classList.contains('hidden');
            
            if (shouldBeVisible && isCurrentlyHidden) {
                // Afficher avec animation
                control.classList.remove('hidden');
                control.classList.add('appearing');
                setTimeout(() => control.classList.remove('appearing'), 300);
            } else if (!shouldBeVisible && !isCurrentlyHidden) {
                // Cacher
                control.classList.add('hidden');
            }
        });
    }
    
    // Appliquer la visibilité des contrôles du panneau radio
    function applyRadioControlVisibility(visible) {
        const allControls = document.querySelectorAll('.radio-control-item[data-control]');
        allControls.forEach(control => {
            const controlName = control.dataset.control;
            const shouldBeVisible = visible.has(controlName);
            const isCurrentlyHidden = control.classList.contains('hidden');
            if (shouldBeVisible && isCurrentlyHidden) {
                control.classList.remove('hidden');
                control.classList.add('appearing');
                setTimeout(() => control.classList.remove('appearing'), 300);
            } else if (!shouldBeVisible && !isCurrentlyHidden) {
                control.classList.add('hidden');
            }
        });
    }
    
    // Cacher tous les contrôles au démarrage
    function hideAllControls() {
        const allControls = document.querySelectorAll('.sim-panel[data-id="microbit"] .control-item[data-control]');
        allControls.forEach(control => {
            control.classList.add('hidden');
        });
    }
    
    // Initialiser : cacher tous les contrôles
    hideAllControls();
    
    // Écouter les changements du workspace
    let _controlsDebounce = null;
    if (workspace) {
        workspace.addChangeListener((event) => {
            // Mettre à jour sur création/suppression/déplacement de blocs ou changement de champ
            if (event.type === Blockly.Events.BLOCK_CREATE ||
                event.type === Blockly.Events.BLOCK_DELETE ||
                event.type === Blockly.Events.BLOCK_MOVE ||
                event.type === Blockly.Events.BLOCK_CHANGE) {
                // Debounce : annuler le précédent timeout pour regrouper les rafales
                clearTimeout(_controlsDebounce);
                _controlsDebounce = setTimeout(updateVisibleControls, 150);
            }
        });
        
        // Mise à jour initiale
        setTimeout(updateVisibleControls, 500);
    }
    
    // Exposer la fonction pour les mises à jour manuelles
    window.updateSimulatorControls = updateVisibleControls;
}

// initSimulatorResizer - Remplacée par SimulatorPanelsManager
// Le resize est maintenant géré par le nouveau système de panneaux

// Sliders micro:bit
function initMicrobitSliders() {
    // Température
    const tempSlider = document.getElementById('tempSlider');
    const tempValue = document.getElementById('tempValue');
    if (tempSlider && tempValue) {
        tempSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            tempValue.textContent = val + '°C';
            if (microbitSim) microbitSim.setTemperature(val);
        };
    }
    
    // Lumière
    const lightSlider = document.getElementById('lightSlider');
    const lightValue = document.getElementById('lightValue');
    if (lightSlider && lightValue) {
        lightSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            lightValue.textContent = val;
            if (microbitSim) microbitSim.setLightLevel(val);
        };
    }
    
    // Boussole
    const compassSlider = document.getElementById('compassSlider');
    const compassValue = document.getElementById('compassValue');
    if (compassSlider && compassValue) {
        compassSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            compassValue.textContent = val + '°';
            if (microbitSim) microbitSim.setCompassHeading(val);
        };
    }
    
    // Force magnétique
    const magneticSlider = document.getElementById('magneticSlider');
    const magneticValue = document.getElementById('magneticValue');
    if (magneticSlider && magneticValue) {
        magneticSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            magneticValue.textContent = val + 'µT';
            if (microbitSim) microbitSim.setMagneticForce(val);
        };
    }
    
    // Niveau sonore
    const soundSlider = document.getElementById('soundSlider');
    const soundValue = document.getElementById('soundValue');
    if (soundSlider && soundValue) {
        soundSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            soundValue.textContent = val;
            if (microbitSim) microbitSim.setSoundLevel(val);
        };
    }
    
    // Pad rotation (pitch/roll)
    const rotationPad = document.getElementById('rotationPad');
    const rotationDot = document.getElementById('rotationDot');
    const rotationValue = document.getElementById('rotationValue');
    
    // Fonction pour mettre à jour l'effet 3D de la carte
    const updateMicrobitTilt = (pitch, roll) => {
        const microbitBoard = document.querySelector('.microbit-board');
        if (microbitBoard) {
            // Limiter les angles pour un effet visuel réaliste
            const maxTilt = 25;
            const tiltX = Math.max(-maxTilt, Math.min(maxTilt, -pitch * 0.3));
            const tiltY = Math.max(-maxTilt, Math.min(maxTilt, roll * 0.3));
            microbitBoard.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
        }
    };
    
    if (rotationPad && rotationDot && rotationValue) {
        let isDraggingRotation = false;
        
        const updateRotation = (e) => {
            const rect = rotationPad.getBoundingClientRect();
            let x = (e.clientX - rect.left) / rect.width;
            let y = (e.clientY - rect.top) / rect.height;
            
            // Clamp to 0-1
            x = Math.max(0, Math.min(1, x));
            y = Math.max(0, Math.min(1, y));
            
            // Convert to -90 to 90 (roll horizontal, pitch vertical)
            const roll = Math.round((x - 0.5) * 180);
            const pitch = Math.round((y - 0.5) * 180);
            
            // Update dot position
            rotationDot.style.left = (x * 100) + '%';
            rotationDot.style.top = (y * 100) + '%';
            
            // Update value display
            rotationValue.textContent = `P:${pitch} R:${roll}`;
            
            // Update 3D tilt effect
            updateMicrobitTilt(pitch, roll);
            
            // Update simulator
            if (microbitSim) {
                microbitSim.setRotation(pitch, roll);
            }
        };
        
        rotationPad.addEventListener('mousedown', (e) => {
            isDraggingRotation = true;
            updateRotation(e);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDraggingRotation) updateRotation(e);
        });
        
        document.addEventListener('mouseup', () => {
            if (isDraggingRotation) {
                isDraggingRotation = false;
                // Reset to center
                rotationDot.style.left = '50%';
                rotationDot.style.top = '50%';
                rotationValue.textContent = 'P:0 R:0';
                updateMicrobitTilt(0, 0);
                if (microbitSim) {
                    microbitSim.setRotation(0, 0);
                }
            }
        });
    }
    
    // Bouton Secouer
    const btnShake = document.getElementById('btnShake');
    if (btnShake) {
        btnShake.onclick = () => {
            if (microbitSim) {
                microbitSim.triggerGesture('shake');
            }
        };
    }
    
    // Bouton A+B
    const btnAB = document.getElementById('btnAB');
    if (btnAB) {
        btnAB.onmousedown = () => {
            if (microbitSim) {
                // Simuler l'appui simultané sur A et B visuellement
                microbitSim.pressButton('A');
                microbitSim.pressButton('B');
                btnAB.style.background = 'linear-gradient(135deg, #0f172a, #1e293b)';
            }
        };
        btnAB.onmouseup = () => {
            if (microbitSim) {
                microbitSim.releaseButton('A');
                microbitSim.releaseButton('B');
                btnAB.style.background = 'linear-gradient(135deg, #1e293b, #334155)';
            }
        };
        btnAB.onmouseleave = () => {
            if (microbitSim) {
                microbitSim.releaseButton('A');
                microbitSim.releaseButton('B');
                btnAB.style.background = 'linear-gradient(135deg, #1e293b, #334155)';
            }
        };
    }
    
    // Bouton Rotation 180°
    const btnRotate180 = document.getElementById('btnRotate180');
    if (btnRotate180) {
        btnRotate180.onclick = () => {
            if (microbitSim) {
                microbitSim.rotate180();
            }
        };
    }
    
    // Bouton Flip
    const btnFlip = document.getElementById('btnFlip');
    if (btnFlip) {
        btnFlip.onclick = () => {
            if (microbitSim) {
                microbitSim.flipBoard();
            }
        };
    }
}

function loadDefaultExample() {
    // Charger un exemple par défaut simple
    const defaultXml = `
    <xml>
        <block type="on_start" x="200" y="50">
            <statement name="DO">
                <block type="basic_show_icon">
                    <field name="ICON">Heart</field>
                </block>
            </statement>
        </block>
        <block type="forever" x="200" y="200">
        </block>
    </xml>`;
    
    try {
        const xml = Blockly.utils.xml.textToDom(defaultXml);
        Blockly.Xml.domToWorkspace(xml, workspace);
        // Vérifier les doublons après chargement
        checkDuplicateHatBlocks();
    } catch (e) {
        // Silently ignore if default example fails to load
    }
}

// ============== PARAMÈTRES ==============

/**
 * Ouvre la popup de paramètres
 */
function openSettingsDialog() {
    // Créer la popup si elle n'existe pas
    let modal = document.getElementById('settingsModal');
    if (modal) {
        modal.remove();
    }
    
    modal = document.createElement('div');
    modal.id = 'settingsModal';
    modal.className = 'modal show';
    
    const currentPreset = window.getCurrentIRPreset ? window.getCurrentIRPreset() : 'IRC389';
    const presets = window.getIRPresets ? window.getIRPresets() : [];
    
    // Générer les options du sélecteur
    const presetsOptions = presets.map(p => 
        `<option value="${p.id}" ${currentPreset === p.id ? 'selected' : ''}>${p.name}</option>`
    ).join('');
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>⚙️ Paramètres</h3>
                <button class="modal-close" onclick="closeSettingsDialog()">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                
                <div class="settings-section">
                    <h4 style="margin: 0 0 12px 0; color: #374151; display: flex; align-items: center; gap: 8px;">
                        📱 Télécommande IR
                    </h4>
                    
                    <!-- Sélecteur de télécommande -->
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 13px; color: #6b7280; margin-bottom: 6px;">
                            Télécommande utilisée :
                        </label>
                        <select id="irPresetSelect" onchange="onIRPresetChange(this.value)" 
                                style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; 
                                       font-size: 14px; background: white; cursor: pointer;">
                            ${presetsOptions}
                            ${currentPreset === 'custom' ? '<option value="custom" selected>Configuration personnalisée</option>' : ''}
                        </select>
                    </div>
                    
                    <div id="irPresetStatus" style="background: #f3f4f6; padding: 12px; border-radius: 8px; margin-bottom: 16px; display: ${currentPreset === 'custom' ? 'block' : 'none'};">
                        <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Configuration active :</div>
                        <div id="irConfigName" style="font-weight: 600; color: #111827;">${window.IRRemoteConfig ? window.IRRemoteConfig.name : 'Non chargée'}</div>
                    </div>
                    
                    <!-- Séparateur -->
                    <div style="border-top: 1px solid #e5e7eb; margin: 16px 0; position: relative;">
                        <span style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); 
                                     background: white; padding: 0 10px; font-size: 12px; color: #9ca3af;">
                            Configuration personnalisée
                        </span>
                    </div>
                    
                    <p style="font-size: 13px; color: #6b7280; margin: 0 0 16px 0;">
                        Téléchargez un modèle de configuration ou chargez votre propre fichier pour adapter l'application à une autre télécommande.
                    </p>
                    
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button onclick="downloadIRConfigTemplate()" class="btn btn-outline" style="flex: 1; min-width: 140px;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Télécharger modèle
                        </button>
                        <button onclick="document.getElementById('irConfigInput').click()" class="btn btn-outline" style="flex: 1; min-width: 140px;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            Charger fichier
                        </button>
                        <input type="file" id="irConfigInput" accept=".json" style="display: none;" onchange="loadIRConfigFromFile(this)">
                    </div>
                    
                    <div id="irLoadStatus" style="margin-top: 12px; display: none;"></div>
                </div>
                
            </div>
            <div class="modal-footer" style="padding: 16px 20px; border-top: 1px solid #e5e7eb; text-align: right;">
                <button onclick="closeSettingsDialog()" class="btn btn-primary">Fermer</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fermer en cliquant en dehors
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeSettingsDialog();
        }
    });
}

/**
 * Gère le changement de télécommande pré-configurée
 */
function onIRPresetChange(presetId) {
    if (presetId === 'custom') return; // Ne rien faire si c'est déjà custom
    
    if (window.applyIRPreset && window.applyIRPreset(presetId)) {
        const statusDiv = document.getElementById('irLoadStatus');
        const presetStatus = document.getElementById('irPresetStatus');
        
        if (presetStatus) {
            presetStatus.style.display = 'none';
        }
        
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.innerHTML = `
                <div style="background: #d1fae5; color: #065f46; padding: 10px 12px; border-radius: 6px; font-size: 13px;">
                    ✅ Télécommande "${presetId}" sélectionnée !
                </div>
            `;
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }
    }
}

/**
 * Ferme la popup de paramètres
 */
function closeSettingsDialog() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Télécharge un modèle de configuration IR (télécommande officielle par défaut)
 */
function downloadIRConfigTemplate() {
    // Modèle basé sur la télécommande officielle (plus simple à comprendre)
    const template = {
        "name": "Ma télécommande personnalisée",
        "Off": 11,
        "Menu": 12,
        "Plus": 13,
        "Up": 14,
        "Back": 15,
        "Left": 16,
        "OK": 17,
        "Right": 18,
        "Minus": 19,
        "Down": 20,
        "Zero": 0,
        "One": 1,
        "Two": 2,
        "Three": 3,
        "Four": 4,
        "Five": 5,
        "Six": 6,
        "Seven": 7,
        "Eight": 8,
        "Nine": 9
    };
    
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'telecommande-ir-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Charge une configuration IR depuis un fichier
 */
function loadIRConfigFromFile(input) {
    const file = input.files[0];
    if (!file) return;
    
    const statusDiv = document.getElementById('irLoadStatus');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const config = JSON.parse(e.target.result);
            
            // Charger la configuration (le nouveau loadIRConfig gère les deux formats)
            if (window.loadIRConfig(config)) {
                // Mettre à jour l'affichage
                const nameDiv = document.getElementById('irConfigName');
                const presetStatus = document.getElementById('irPresetStatus');
                const presetSelect = document.getElementById('irPresetSelect');
                
                if (nameDiv) {
                    nameDiv.textContent = config.name || 'Configuration personnalisée';
                }
                
                if (presetStatus) {
                    presetStatus.style.display = 'block';
                }
                
                // Mettre à jour le sélecteur pour montrer "custom"
                if (presetSelect) {
                    // Ajouter l'option custom si elle n'existe pas
                    let customOption = presetSelect.querySelector('option[value="custom"]');
                    if (!customOption) {
                        customOption = document.createElement('option');
                        customOption.value = 'custom';
                        customOption.textContent = 'Configuration personnalisée';
                        presetSelect.appendChild(customOption);
                    }
                    presetSelect.value = 'custom';
                }
                
                if (statusDiv) {
                    statusDiv.style.display = 'block';
                    statusDiv.innerHTML = `
                        <div style="background: #d1fae5; color: #065f46; padding: 10px 12px; border-radius: 6px; font-size: 13px;">
                            ✅ Configuration "${config.name || 'personnalisée'}" chargée !<br>
                            <small style="opacity: 0.8;">Cette configuration sera utilisée jusqu'au rechargement de la page.</small>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('Erreur chargement config IR:', error);
            if (statusDiv) {
                statusDiv.style.display = 'block';
                statusDiv.innerHTML = `
                    <div style="background: #fee2e2; color: #991b1b; padding: 10px 12px; border-radius: 6px; font-size: 13px;">
                        ❌ Erreur : ${error.message}
                    </div>
                `;
            }
        }
    };
    
    reader.onerror = function() {
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.innerHTML = `
                <div style="background: #fee2e2; color: #991b1b; padding: 10px 12px; border-radius: 6px; font-size: 13px;">
                    ❌ Erreur de lecture du fichier
                </div>
            `;
        }
    };
    
    reader.readAsText(file);
    
    // Reset l'input pour permettre de recharger le même fichier
    input.value = '';
}

// Export pour les modals
window.closeCodeModal = closeCodeModal;
window.copyCode = copyCode;
window.openInMakeCode = openInMakeCode;
window.toggleSection = toggleSection;
window.openSettingsDialog = openSettingsDialog;
window.closeSettingsDialog = closeSettingsDialog;
window.downloadIRConfigTemplate = downloadIRConfigTemplate;
window.loadIRConfigFromFile = loadIRConfigFromFile;
window.onIRPresetChange = onIRPresetChange;
