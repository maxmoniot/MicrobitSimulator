/**
 * Éléa-Auto : Protocole d'automation pour Microbit Simulator
 * (éditeur Blockly + simulateur micro:bit + simulateur Cutebot)
 * 
 * Ajouter dans index.html : <script src="elea-auto-microbit.js"></script>
 * 
 * Utilisé par Puppeteer pour :
 * - Manipuler les blocs Blockly
 * - Piloter les simulateurs micro:bit et Cutebot
 * - Capturer les zones d'intérêt (zoom, plan large)
 * - Afficher un pointeur rose animé
 */

(function() {
    'use strict';

    // =========================================================================
    // OVERLAY : Pointeur rose + surbrillance
    // =========================================================================

    let overlayContainer = null;
    let pointerEl = null;
    let highlightEl = null;

    function ensureOverlay() {
        if (overlayContainer) return;
        overlayContainer = document.createElement('div');
        overlayContainer.id = 'elea-auto-overlay';
        Object.assign(overlayContainer.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            pointerEvents: 'none', zIndex: '999999'
        });
        document.body.appendChild(overlayContainer);

        const style = document.createElement('style');
        style.textContent = `
            @keyframes elea-bounce {
                0%, 100% { transform: translate(-15%, -85%) scale(1); }
                50% { transform: translate(-15%, -95%) scale(1.08); }
            }
            @keyframes elea-pulse {
                0%, 100% { opacity: 0.35; }
                50% { opacity: 0.55; }
            }
            #elea-pointer {
                position: absolute; width: 64px; height: 64px;
                animation: elea-bounce 1s ease-in-out infinite;
                filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));
                transition: left 0.3s ease, top 0.3s ease;
                display: none;
            }
            #elea-highlight {
                position: absolute;
                border: 3px dashed #ff4da6; border-radius: 8px;
                background: rgba(255, 77, 166, 0.12);
                animation: elea-pulse 1.5s ease-in-out infinite;
                transition: all 0.3s ease;
                display: none;
            }
        `;
        document.head.appendChild(style);

        // Pointeur : flèche rose SVG
        pointerEl = document.createElement('div');
        pointerEl.id = 'elea-pointer';
        pointerEl.innerHTML = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#ff69b4"/><stop offset="100%" stop-color="#ff1493"/>
            </linearGradient></defs>
            <path d="M8 4 L8 52 L20 40 L32 58 L40 54 L28 36 L44 36 Z" 
                  fill="url(#pg)" stroke="#c0106a" stroke-width="2.5" stroke-linejoin="round"/>
        </svg>`;
        overlayContainer.appendChild(pointerEl);

        highlightEl = document.createElement('div');
        highlightEl.id = 'elea-highlight';
        overlayContainer.appendChild(highlightEl);
    }

    function showPointer(x, y) {
        ensureOverlay();
        pointerEl.style.display = 'block';
        pointerEl.style.left = x + 'px';
        pointerEl.style.top = y + 'px';
    }

    function showPointerOn(target) {
        const b = getBounds(target);
        if (!b) return;
        showPointer(b.x + b.width / 2, b.y + 4);
    }

    function showHighlight(target, padding) {
        padding = padding || 8;
        const b = (typeof target === 'string') ? getBounds(target) : target;
        if (!b) return;
        ensureOverlay();
        highlightEl.style.display = 'block';
        highlightEl.style.left = (b.x - padding) + 'px';
        highlightEl.style.top = (b.y - padding) + 'px';
        highlightEl.style.width = (b.width + padding * 2) + 'px';
        highlightEl.style.height = (b.height + padding * 2) + 'px';
    }

    function hideOverlay() {
        if (pointerEl) pointerEl.style.display = 'none';
        if (highlightEl) highlightEl.style.display = 'none';
    }

    // =========================================================================
    // SCREENSHOT : Zones de capture
    // =========================================================================

    /**
     * Cibles microbit-simulator :
     * 
     * --- Blockly ---
     *   "workspace"                → zone Blockly (#blocklyDiv)
     *   "toolbox"                  → boîte à outils Blockly
     *   "category:Basique"         → catégorie spécifique dans la toolbox
     *   "flyout"                   → tiroir de blocs ouvert
     *   "block:0"                  → 1er bloc top-level du workspace
     *   "block:device_forever"     → bloc par type
     *   "block:cutebot_move"       → bloc cutebot par type
     * 
     * --- Simulateur micro:bit ---
     *   "microbit"                 → panneau simulateur micro:bit complet
     *   "microbit:canvas"          → canvas micro:bit (#microbitCanvas)
     *   "microbit:leds"            → zone LEDs (= canvas)
     *   "microbit:buttonA"         → bouton A
     *   "microbit:buttonB"         → bouton B
     *   "microbit:header"          → header du panneau micro:bit
     * 
     * --- Simulateur Cutebot ---
     *   "cutebot"                  → panneau simulateur Cutebot complet
     *   "cutebot:canvas"           → canvas Cutebot (#simulatorCanvas)
     *   "cutebot:controls"         → barre de contrôles (dessiner, gomme, etc.)
     *   "cutebot:draw"             → bouton dessiner ligne (#btnDrawLine)
     *   "cutebot:erase"            → bouton gomme (#btnEraseLine)
     *   "cutebot:clear"            → bouton tout effacer (#btnClearTrack)
     *   "cutebot:obstacle"         → bouton ajouter obstacle (#btnAddObstacle)
     *   "cutebot:remote"           → bouton télécommande (#btnToggleRemote)
     *   "cutebot:linewidth"        → slider largeur de ligne (#lineWidth)
     *   "cutebot:header"           → header du panneau cutebot
     * 
     * --- Barre d'outils ---
     *   "toolbar"                  → barre d'outils complète
     *   "button:run"               → bouton exécuter (#btnRun)
     *   "button:stop"              → bouton arrêter (#btnStop)
     *   "button:reset"             → bouton réinitialiser (#btnReset)
     *   "button:download"          → bouton télécharger HEX (#btnDownloadHex)
     *   "button:save"              → bouton sauvegarder (#btnSave)
     *   "button:load"              → bouton charger (#btnLoad)
     *   "button:code"              → bouton voir le code (#btnShowCode)
     */
    function getBounds(target) {
        if (typeof target === 'object' && target.x !== undefined) return target;

        const parts = target.split(':');
        const type = parts[0];
        const id = parts[1];

        let el = null;

        switch (type) {

            // --- Blockly ---

            case 'workspace': {
                el = document.getElementById('blocklyDiv');
                return el ? rectOf(el) : null;
            }

            case 'toolbox': {
                el = document.querySelector('.blocklyToolboxDiv');
                return el ? rectOf(el) : null;
            }

            case 'category': {
                if (!id) return getBounds('toolbox');
                const rows = document.querySelectorAll('.blocklyTreeRow');
                el = Array.from(rows).find(r => r.textContent.toLowerCase().includes(id.toLowerCase()));
                return el ? rectOf(el) : null;
            }

            case 'flyout': {
                el = document.querySelector('.blocklyFlyout');
                return el ? rectOf(el) : null;
            }

            case 'block': {
                if (!window.Blockly) return null;
                const ws = Blockly.getMainWorkspace();
                if (!ws) return null;
                let block;
                if (/^\d+$/.test(id)) {
                    block = ws.getTopBlocks(true)[parseInt(id)];
                } else {
                    block = ws.getTopBlocks(true).find(b => b.type === id)
                        || ws.getAllBlocks(false).find(b => b.type === id);
                }
                if (!block) return null;
                const svg = block.getSvgRoot();
                return svg ? rectOf(svg) : null;
            }

            // --- Simulateur micro:bit ---

            case 'microbit': {
                if (!id) {
                    el = document.querySelector('.sim-panel[data-id="microbit"]');
                    return el ? rectOf(el) : null;
                }
                switch (id) {
                    case 'canvas':
                    case 'leds':
                        el = document.getElementById('microbitCanvas')
                            || document.querySelector('.sim-panel[data-id="microbit"] canvas');
                        return el ? rectOf(el) : null;
                    case 'buttonA':
                    case 'btnA':
                        el = document.querySelector('#microbit-btnA, .microbit-btn-a, [data-button="A"]');
                        return el ? rectOf(el) : null;
                    case 'buttonB':
                    case 'btnB':
                        el = document.querySelector('#microbit-btnB, .microbit-btn-b, [data-button="B"]');
                        return el ? rectOf(el) : null;
                    case 'header':
                        el = document.querySelector('.sim-panel[data-id="microbit"] .sim-panel-header');
                        return el ? rectOf(el) : null;
                    default: return null;
                }
            }

            // --- Simulateur Cutebot ---

            case 'cutebot': {
                if (!id) {
                    el = document.querySelector('.sim-panel[data-id="cutebot"]');
                    return el ? rectOf(el) : null;
                }
                switch (id) {
                    case 'canvas':
                        el = document.getElementById('simulatorCanvas')
                            || document.querySelector('.sim-panel[data-id="cutebot"] canvas');
                        return el ? rectOf(el) : null;
                    case 'controls':
                        el = document.querySelector('.cutebot-controls');
                        return el ? rectOf(el) : null;
                    case 'draw':
                        el = document.getElementById('btnDrawLine');
                        return el ? rectOf(el) : null;
                    case 'erase':
                        el = document.getElementById('btnEraseLine');
                        return el ? rectOf(el) : null;
                    case 'clear':
                        el = document.getElementById('btnClearTrack');
                        return el ? rectOf(el) : null;
                    case 'obstacle':
                        el = document.getElementById('btnAddObstacle');
                        return el ? rectOf(el) : null;
                    case 'remote':
                        el = document.getElementById('btnToggleRemote');
                        return el ? rectOf(el) : null;
                    case 'linewidth':
                        el = document.getElementById('lineWidth');
                        return el ? rectOf(el) : null;
                    case 'header':
                        el = document.querySelector('.sim-panel[data-id="cutebot"] .sim-panel-header');
                        return el ? rectOf(el) : null;
                    default: return null;
                }
            }

            // --- Barre d'outils ---

            case 'toolbar': {
                el = document.querySelector('.toolbar, header, .header');
                return el ? rectOf(el) : null;
            }

            case 'button': {
                const btnMap = {
                    'run':      '#btnRun',
                    'stop':     '#btnStop',
                    'reset':    '#btnReset',
                    'download': '#btnDownloadHex',
                    'save':     '#btnSave',
                    'load':     '#btnLoad',
                    'code':     '#btnShowCode'
                };
                const sel = btnMap[id];
                if (sel) {
                    el = document.querySelector(sel);
                    return el ? rectOf(el) : null;
                }
                // Fallback : chercher par texte
                el = findButtonByText(id);
                return el ? rectOf(el) : null;
            }

            default:
                // Sélecteur CSS direct
                el = document.querySelector(target);
                return el ? rectOf(el) : null;
        }
    }

    function getScreenshotRegion(target, padding) {
        padding = padding || 40;
        const b = getBounds(target);
        if (!b) return null;
        return {
            x: Math.max(0, b.x - padding),
            y: Math.max(0, b.y - padding),
            width: b.width + padding * 2,
            height: b.height + padding * 2
        };
    }

    // =========================================================================
    // ACTIONS : Blockly
    // =========================================================================

    function openCategory(name) {
        const rows = document.querySelectorAll('.blocklyTreeRow');
        const row = Array.from(rows).find(r => r.textContent.toLowerCase().includes(name.toLowerCase()));
        if (row) { row.click(); return true; }
        return false;
    }

    function addBlock(blockType, x, y) {
        if (!window.Blockly) return false;
        const ws = Blockly.getMainWorkspace();
        if (!ws) return false;
        const block = ws.newBlock(blockType);
        block.initSvg();
        block.render();
        if (x !== undefined && y !== undefined) block.moveBy(x, y);
        return true;
    }

    function connectBlocks(parentType, childType, inputName) {
        if (!window.Blockly) return false;
        const ws = Blockly.getMainWorkspace();
        const parent = ws.getAllBlocks(false).find(b => b.type === parentType);
        const child = ws.getAllBlocks(false).find(b => b.type === childType && !b.getParent());
        if (!parent || !child) return false;
        const conn = inputName
            ? parent.getInput(inputName)?.connection
            : (parent.nextConnection || parent.getInput('STACK')?.connection || parent.getInput('DO')?.connection);
        if (conn && child.previousConnection) {
            conn.connect(child.previousConnection);
            return true;
        }
        return false;
    }

    function setBlockField(blockType, fieldName, value) {
        if (!window.Blockly) return false;
        const ws = Blockly.getMainWorkspace();
        const block = ws.getAllBlocks(false).find(b => b.type === blockType);
        if (!block) return false;
        const field = block.getField(fieldName);
        if (field) { field.setValue(String(value)); return true; }
        return false;
    }

    function getBlockCount() {
        if (!window.Blockly) return 0;
        const ws = Blockly.getMainWorkspace();
        return ws ? ws.getAllBlocks(false).length : 0;
    }

    // =========================================================================
    // ACTIONS : Toolbar
    // =========================================================================

    function clickRun() {
        const btn = document.getElementById('btnRun');
        if (btn) { btn.click(); return true; }
        return false;
    }

    function clickStop() {
        const btn = document.getElementById('btnStop');
        if (btn) { btn.click(); return true; }
        return false;
    }

    function clickReset() {
        const btn = document.getElementById('btnReset');
        if (btn) { btn.click(); return true; }
        return false;
    }

    function clickDownload() {
        const btn = document.getElementById('btnDownloadHex');
        if (btn) { btn.click(); return true; }
        return false;
    }

    // =========================================================================
    // ACTIONS : Simulateur micro:bit
    // =========================================================================

    function pressButton(which) {
        // Simuler appui bouton A ou B
        const selectors = {
            'A': '#microbit-btnA, .microbit-btn-a, [data-button="A"]',
            'B': '#microbit-btnB, .microbit-btn-b, [data-button="B"]'
        };
        const el = document.querySelector(selectors[which.toUpperCase()] || selectors['A']);
        if (el) {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            setTimeout(() => el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })), 200);
            return true;
        }
        // Fallback via le runtime
        if (window.microbitRuntime) {
            if (which.toUpperCase() === 'A') {
                microbitRuntime.buttonAPressed = true;
                setTimeout(() => { microbitRuntime.buttonAPressed = false; }, 200);
            } else {
                microbitRuntime.buttonBPressed = true;
                setTimeout(() => { microbitRuntime.buttonBPressed = false; }, 200);
            }
            return true;
        }
        return false;
    }

    function shakeDevice() {
        if (window.microbitRuntime && microbitRuntime.triggerGesture) {
            microbitRuntime.triggerGesture('shake');
            return true;
        }
        const btn = findButtonByText('secouer');
        if (btn) { btn.click(); return true; }
        return false;
    }

    // =========================================================================
    // ACTIONS : Simulateur Cutebot
    // =========================================================================

    function setDrawMode(mode) {
        // mode = 'line' ou 'erase'
        if (mode === 'line') {
            const btn = document.getElementById('btnDrawLine');
            if (btn) { btn.click(); return true; }
        } else {
            const btn = document.getElementById('btnEraseLine');
            if (btn) { btn.click(); return true; }
        }
        if (window.simulator && simulator.setDrawMode) {
            simulator.setDrawMode(mode);
            return true;
        }
        return false;
    }

    function clearTrack() {
        const btn = document.getElementById('btnClearTrack');
        if (btn) { btn.click(); return true; }
        if (window.simulator && simulator.clearTrack) {
            simulator.clearTrack();
            return true;
        }
        return false;
    }

    function addObstacle() {
        const btn = document.getElementById('btnAddObstacle');
        if (btn) { btn.click(); return true; }
        if (window.simulator && simulator.addObstacle) {
            simulator.addObstacle();
            return true;
        }
        return false;
    }

    function setLineWidth(px) {
        const slider = document.getElementById('lineWidth');
        if (slider) {
            setInputValue(slider, px);
            return true;
        }
        return false;
    }

    function toggleRemote() {
        const btn = document.getElementById('btnToggleRemote');
        if (btn) { btn.click(); return true; }
        return false;
    }

    // =========================================================================
    // UTILITAIRES
    // =========================================================================

    function rectOf(el) {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
    }

    function findButtonByText(text) {
        if (!text) return null;
        const lower = text.toLowerCase();
        const buttons = document.querySelectorAll('button, [role="button"], .btn');
        return Array.from(buttons).find(b => b.textContent.toLowerCase().includes(lower));
    }

    function setInputValue(el, value) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
        ).set;
        nativeSetter.call(el, String(value));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // =========================================================================
    // EXPORT : window.eleaAuto
    // =========================================================================

    window.eleaAuto = {
        app: 'microbit-simulator',

        // --- Overlay ---
        showPointer: showPointer,
        showPointerOn: showPointerOn,
        showHighlight: showHighlight,
        hideOverlay: hideOverlay,

        // --- Capture ---
        getBounds: getBounds,
        getScreenshotRegion: getScreenshotRegion,

        // --- Blockly ---
        openCategory: openCategory,
        addBlock: addBlock,
        connectBlocks: connectBlocks,
        setBlockField: setBlockField,
        getBlockCount: getBlockCount,

        // --- Toolbar ---
        clickRun: clickRun,
        clickStop: clickStop,
        clickReset: clickReset,
        clickDownload: clickDownload,

        // --- Micro:bit ---
        pressButton: pressButton,
        shakeDevice: shakeDevice,

        // --- Cutebot ---
        setDrawMode: setDrawMode,
        clearTrack: clearTrack,
        addObstacle: addObstacle,
        setLineWidth: setLineWidth,
        toggleRemote: toggleRemote,

        // --- Raccourcis pour le JSON ---
        exec: function(cmd, args) {
            args = args || {};
            switch (cmd) {
                // Blockly
                case 'openCategory':   return openCategory(args.name);
                case 'addBlock':       return addBlock(args.type, args.x, args.y);
                case 'connectBlocks':  return connectBlocks(args.parent, args.child, args.input);
                case 'setField':       return setBlockField(args.block, args.field, args.value);
                // Toolbar
                case 'run':            return clickRun();
                case 'stop':           return clickStop();
                case 'reset':          return clickReset();
                case 'download':       return clickDownload();
                // Micro:bit
                case 'pressButton':    return pressButton(args.button || 'A');
                case 'shake':          return shakeDevice();
                // Cutebot
                case 'drawMode':       return setDrawMode(args.mode || 'line');
                case 'clearTrack':     return clearTrack();
                case 'addObstacle':    return addObstacle();
                case 'setLineWidth':   return setLineWidth(args.width || 20);
                case 'toggleRemote':   return toggleRemote();
                // Générique
                case 'click': {
                    const el = document.querySelector(args.selector);
                    if (el) { el.click(); return true; }
                    return false;
                }
                default:
                    console.warn('[eleaAuto] Commande inconnue:', cmd);
                    return false;
            }
        }
    };

    console.log('✅ [eleaAuto] Microbit Simulator - protocole d\'automation chargé');
})();
