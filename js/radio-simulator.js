/**
 * Radio Simulator - Communication entre deux micro:bits
 * Gère la seconde carte micro:bit pour tester la communication radio
 */

(function() {
    'use strict';

    // ========== ÉTAT GLOBAL ==========
    let radioEnabled = false;
    let secondMicrobit = null;
    let secondWorkspace = null;
    let secondRuntime = null;
    let secondProgramRunning = false;
    let secondStopRequested = false;
    let useMainProgram = true;
    let secondProgramXml = null;
    let editorWindow = null;

    // ========== INITIALISATION ==========
    
    function initRadioSimulator() {
        window.addEventListener('microbit-radio', handleRadioMessage);
        window.addEventListener('microbit-radio-second', handleRadioMessageFromSecond);
        
        window.radioSimulator = {
            enable: enableRadio,
            disable: disableRadio,
            isEnabled: () => radioEnabled,
            openProgramEditor: openProgramEditor,
            closeProgramEditor: closeProgramEditor,
            togglePanel: toggleSecondMicrobitPanel,
            runSecondProgram: runSecondProgram,
            stopSecondProgram: stopSecondProgram,
            resetSecondMicrobit: resetSecondMicrobit,
            setUseMainProgram: setUseMainProgram,
            getSecondMicrobit: () => secondMicrobit
        };
        
    }

    /**
     * Crée le panneau pour la seconde carte micro:bit avec tous les contrôles
     */
    function createSecondMicrobitPanel() {
        const container = document.getElementById('simulatorsContainer');
        if (!container) return;
        
        if (document.getElementById('radioMicrobitPanel')) return;
        
        const panel = document.createElement('div');
        panel.id = 'radioMicrobitPanel';
        panel.className = 'sim-panel';
        panel.setAttribute('data-id', 'radio-microbit');
        panel.style.display = 'none';
        
        panel.innerHTML = `
            <div class="sim-panel-header">
                <button class="collapse-btn" title="Réduire/Agrandir">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <span class="sim-panel-icon">📻</span>
                <span class="sim-panel-title">Micro:bit Radio (carte distante)</span>
                <div class="radio-panel-controls">
                    <button class="radio-ctrl-btn radio-edit-btn" onclick="window.switchToCard(window.currentCard === 2 ? 1 : 2)" title="Modifier le programme de la Carte 2">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <span>Éditer le programme de la carte 2</span>
                    </button>
                </div>
            </div>
            <div class="sim-panel-content">
                <div class="microbit-layout">
                    <!-- Contrôles à gauche (identiques à la carte principale) -->
                    <div class="microbit-controls-left">
                        <div class="controls-left-column">
                            <!-- Curseurs -->
                            <div class="controls-row">
                                <div class="v-slider-group">
                                    <label>🌡️</label>
                                    <input type="range" id="radio-tempSlider" min="-5" max="50" value="21">
                                    <span class="v-slider-val" id="radio-tempValue">21°C</span>
                                </div>
                                <div class="v-slider-group">
                                    <label>💡</label>
                                    <input type="range" id="radio-lightSlider" min="0" max="255" value="128">
                                    <span class="v-slider-val" id="radio-lightValue">128</span>
                                </div>
                                <div class="v-slider-group">
                                    <label>🧭</label>
                                    <input type="range" id="radio-compassSlider" min="0" max="359" value="0">
                                    <span class="v-slider-val" id="radio-compassValue">0°</span>
                                </div>
                                <div class="v-slider-group">
                                    <label>🎤</label>
                                    <input type="range" id="radio-soundSlider" min="0" max="255" value="0">
                                    <span class="v-slider-val" id="radio-soundValue">0</span>
                                </div>
                            </div>
                            
                            <!-- Pads -->
                            <div class="controls-row pads-row">
                                <div class="mb-btn-group accel-btn-group">
                                    <button class="mb-btn" id="radio-btnAccel" title="Accéléromètre">
                                        <span style="font-size: 18px;">📐</span>
                                    </button>
                                    <span class="mb-btn-label">Accél.</span>
                                </div>
                                <div class="rotation-group">
                                    <label>🔄</label>
                                    <div class="rotation-pad" id="radio-rotationPad">
                                        <div class="rotation-dot" id="radio-rotationDot"></div>
                                    </div>
                                    <span class="rotation-val" id="radio-rotationValue">P:0 R:0</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Boutons -->
                        <div class="controls-right-column">
                            <div class="mb-btn-group">
                                <button class="mb-btn" id="radio-btnShake" title="Secouer">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                                        <polyline points="17 6 23 6 23 12"/>
                                    </svg>
                                </button>
                                <span class="mb-btn-label">Secouer</span>
                            </div>
                            <div class="mb-btn-group">
                                <button class="mb-btn" id="radio-btnAB" title="A+B">
                                    <span style="font-size: 10px; font-weight: bold; color: white;">A+B</span>
                                </button>
                                <span class="mb-btn-label">A+B</span>
                            </div>
                            <div class="mb-btn-group">
                                <button class="mb-btn" id="radio-btnRotate180" title="Rotation 180°">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                        <path d="M7.11 8.53L5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z"/>
                                    </svg>
                                </button>
                                <span class="mb-btn-label">180°</span>
                            </div>
                            <div class="mb-btn-group">
                                <button class="mb-btn" id="radio-btnFlip" title="Retourner">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                        <path d="M15 21h2v-2h-2v2zm4-12h2V7h-2v2zM3 5v14c0 1.1.9 2 2 2h4v-2H5V5h4V3H5c-1.1 0-2 .9-2 2zm16-2v2h2c0-1.1-.9-2-2-2zm-8 20h2V1h-2v22zm8-6h2v-2h-2v2zM15 5h2V3h-2v2zm4 8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2z"/>
                                    </svg>
                                </button>
                                <span class="mb-btn-label">Flip</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Carte micro:bit -->
                    <div class="microbit-board-wrapper">
                        <div id="secondMicrobitSimulator"></div>
                    </div>
                </div>
                
                <!-- Barre de statut radio -->
                <div class="radio-status-bar">
                    <span class="radio-indicator" id="radioIndicator">
                        <span class="radio-dot"></span>
                        <span class="radio-status-text">Radio inactive</span>
                    </span>
                    <span class="radio-group-info" id="radioGroupInfo">Groupe: --</span>
                </div>
            </div>
            <div class="sim-panel-resize"><div class="resize-handle"></div></div>
            
            <!-- Popup Accéléromètre Carte 2 -->
            <div id="radioAccelModal" class="accel-modal" style="display: none;">
                <div class="accel-modal-content">
                    <div class="accel-modal-header">
                        <h3>📐 Accéléromètre (Carte 2)</h3>
                        <button id="btnCloseRadioAccel" class="btn-close-remote">&times;</button>
                    </div>
                    <div class="accel-sliders-container">
                        <div class="accel-slider-row">
                            <label>X</label>
                            <input type="range" id="radioAccelXSlider" min="-2048" max="2048" value="0">
                            <span class="accel-slider-val" id="radioAccelXValue">0</span>
                        </div>
                        <div class="accel-slider-row">
                            <label>Y</label>
                            <input type="range" id="radioAccelYSlider" min="-2048" max="2048" value="0">
                            <span class="accel-slider-val" id="radioAccelYValue">0</span>
                        </div>
                        <div class="accel-slider-row">
                            <label>Z</label>
                            <input type="range" id="radioAccelZSlider" min="-2048" max="2048" value="-1024">
                            <span class="accel-slider-val" id="radioAccelZValue">-1024</span>
                        </div>
                        <div class="accel-slider-row force-row">
                            <label>Force</label>
                            <input type="range" id="radioAccelForceSlider" min="0" max="3500" value="1024" disabled>
                            <span class="accel-slider-val" id="radioAccelForceValue">1024</span>
                        </div>
                        <button id="btnResetRadioAccel" class="btn btn-small btn-outline" style="margin-top: 4px; width: 100%;">🔄 Réinitialiser</button>
                    </div>
                </div>
            </div>
        `;
        
        // Insérer juste après le panneau micro:bit principal
        const microbitPanel = container.querySelector('[data-id="microbit"]');
        if (microbitPanel && microbitPanel.nextSibling) {
            container.insertBefore(panel, microbitPanel.nextSibling);
        } else if (microbitPanel) {
            microbitPanel.after(panel);
        } else {
            container.insertBefore(panel, container.firstChild);
        }
        
        // Note: registerPanel sera appelé dans enableRadio après que le panneau soit visible
        
        // Les contrôles seront configurés après initSecondMicrobit via ready()
    }

    /**
     * Configure les contrôles interactifs de la seconde carte
     * Appelé uniquement après que secondMicrobit soit complètement prêt
     */
    function setupRadioControls() {
        
        if (!secondMicrobit) {
            return;
        }
        
        const panel = document.getElementById('radioMicrobitPanel');
        if (!panel) {
            return;
        }
        
        // Récupérer le board de la seconde carte (dans son container spécifique)
        const secondContainer = document.getElementById('secondMicrobitSimulator');
        const secondBoard = secondContainer ? secondContainer.querySelector('.microbit-board') : null;
        const secondSvg = secondContainer ? secondContainer.querySelector('svg') : null;
        
        
        // ========== CURSEURS ==========
        const tempSlider = document.getElementById('radio-tempSlider');
        const lightSlider = document.getElementById('radio-lightSlider');
        const compassSlider = document.getElementById('radio-compassSlider');
        const soundSlider = document.getElementById('radio-soundSlider');
        
        if (tempSlider) {
            tempSlider.oninput = (e) => {
                const val = parseInt(e.target.value);
                secondMicrobit.temperature = val;
                document.getElementById('radio-tempValue').textContent = val + '°C';
            };
        }
        
        if (lightSlider) {
            lightSlider.oninput = (e) => {
                const val = parseInt(e.target.value);
                secondMicrobit.lightLevel = val;
                document.getElementById('radio-lightValue').textContent = val;
            };
        }
        
        if (compassSlider) {
            compassSlider.oninput = (e) => {
                const val = parseInt(e.target.value);
                secondMicrobit.compassHeading = val;
                document.getElementById('radio-compassValue').textContent = val + '°';
            };
        }
        
        if (soundSlider) {
            soundSlider.oninput = (e) => {
                const val = parseInt(e.target.value);
                secondMicrobit.soundLevel = val;
                document.getElementById('radio-soundValue').textContent = val;
            };
        }
        
        // ========== BOUTON SECOUER ==========
        const btnShake = document.getElementById('radio-btnShake');
        if (btnShake) {
            btnShake.onclick = () => {
                secondMicrobit.triggerGesture('shake');
            };
        }
        
        // ========== BOUTON A+B ==========
        const btnAB = document.getElementById('radio-btnAB');
        if (btnAB) {
            btnAB.onmousedown = () => {
                secondMicrobit.pressButton('A');
                secondMicrobit.pressButton('B');
            };
            btnAB.onmouseup = () => {
                secondMicrobit.releaseButton('A');
                secondMicrobit.releaseButton('B');
            };
            btnAB.onmouseleave = () => {
                secondMicrobit.releaseButton('A');
                secondMicrobit.releaseButton('B');
            };
        }
        
        // ========== BOUTON 180° ==========
        const btnRotate180 = document.getElementById('radio-btnRotate180');
        if (btnRotate180 && secondSvg) {
            btnRotate180.onclick = () => {
                
                const currentRotation = parseInt(secondSvg.dataset.rotation || '0');
                const newRotation = (currentRotation + 180) % 360;
                
                secondSvg.style.transition = 'transform 0.5s ease';
                secondSvg.style.transform = `rotate(${newRotation}deg)`;
                secondSvg.dataset.rotation = newRotation;
                
                // Déclencher le geste
                if (newRotation === 180) {
                    secondMicrobit.triggerGesture('screen down');
                } else if (newRotation === 0) {
                    secondMicrobit.triggerGesture('screen up');
                }
            };
        }
        
        // ========== BOUTON FLIP ==========
        const btnFlip = document.getElementById('radio-btnFlip');
        if (btnFlip && secondBoard && secondSvg) {
            btnFlip.onclick = () => {
                
                const currentRotation = parseInt(secondSvg.dataset.rotation || '0');
                const rotationTransform = currentRotation !== 0 ? `rotate(${currentRotation}deg) ` : '';
                
                if (secondBoard.classList.contains('flipped')) {
                    // Retour face avant
                    secondBoard.classList.remove('flipped');
                    secondSvg.style.transition = 'transform 0.6s ease';
                    secondSvg.style.transform = `${rotationTransform}rotateY(0deg)`;
                    setTimeout(() => secondMicrobit.triggerGesture('logo up'), 600);
                } else {
                    // Flip vers l'arrière
                    secondBoard.classList.add('flipped');
                    secondSvg.style.transition = 'transform 0.6s ease';
                    secondSvg.style.transform = `${rotationTransform}rotateY(180deg) scaleX(-1)`;
                    setTimeout(() => secondMicrobit.triggerGesture('logo down'), 600);
                }
            };
        }
        
        // ========== PAD DE ROTATION ==========
        const rotationPad = document.getElementById('radio-rotationPad');
        const rotationDot = document.getElementById('radio-rotationDot');
        const rotationValue = document.getElementById('radio-rotationValue');
        
        if (rotationPad && rotationDot && rotationValue && secondBoard) {
            let isDragging = false;
            
            // Fonction pour appliquer l'effet 3D sur la carte 2
            const updateTilt = (pitch, roll) => {
                const maxTilt = 25;
                const tiltX = Math.max(-maxTilt, Math.min(maxTilt, -pitch * 0.3));
                const tiltY = Math.max(-maxTilt, Math.min(maxTilt, roll * 0.3));
                secondBoard.style.transform = `perspective(500px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
            };
            
            const updateRotation = (e) => {
                if (!isDragging) return;
                
                const rect = rotationPad.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                
                let x = (clientX - rect.left) / rect.width;
                let y = (clientY - rect.top) / rect.height;
                
                x = Math.max(0, Math.min(1, x));
                y = Math.max(0, Math.min(1, y));
                
                const roll = Math.round((x - 0.5) * 180);
                const pitch = Math.round((y - 0.5) * 180);
                
                // Mettre à jour le point
                rotationDot.style.left = (x * 100) + '%';
                rotationDot.style.top = (y * 100) + '%';
                
                // Mettre à jour l'affichage
                rotationValue.textContent = `P:${pitch} R:${roll}`;
                
                // Appliquer l'effet 3D
                updateTilt(pitch, roll);
                
                // Mettre à jour le simulateur
                secondMicrobit.setRotation(pitch, roll);
            };
            
            const resetRotation = () => {
                if (!isDragging) return;
                isDragging = false;
                
                rotationDot.style.left = '50%';
                rotationDot.style.top = '50%';
                rotationValue.textContent = 'P:0 R:0';
                updateTilt(0, 0);
                secondMicrobit.setRotation(0, 0);
            };
            
            rotationPad.onmousedown = (e) => {
                isDragging = true;
                updateRotation(e);
            };
            
            rotationPad.ontouchstart = (e) => {
                isDragging = true;
                updateRotation(e);
                e.preventDefault();
            };
            
            document.addEventListener('mousemove', updateRotation);
            document.addEventListener('touchmove', updateRotation);
            document.addEventListener('mouseup', resetRotation);
            document.addEventListener('touchend', resetRotation);
        }
        
        // ========== BOUTON ACCÉLÉROMÈTRE ==========
        const btnAccel = document.getElementById('radio-btnAccel');
        const accelModal = document.getElementById('radioAccelModal');
        const btnCloseAccel = document.getElementById('btnCloseRadioAccel');
        const btnResetAccel = document.getElementById('btnResetRadioAccel');
        
        const accelXSlider = document.getElementById('radioAccelXSlider');
        const accelYSlider = document.getElementById('radioAccelYSlider');
        const accelZSlider = document.getElementById('radioAccelZSlider');
        const accelForceSlider = document.getElementById('radioAccelForceSlider');
        
        const accelXValue = document.getElementById('radioAccelXValue');
        const accelYValue = document.getElementById('radioAccelYValue');
        const accelZValue = document.getElementById('radioAccelZValue');
        const accelForceValue = document.getElementById('radioAccelForceValue');
        
        // Fonction pour calculer et afficher la force
        const updateForceDisplay = () => {
            const x = parseInt(accelXSlider?.value || 0);
            const y = parseInt(accelYSlider?.value || 0);
            const z = parseInt(accelZSlider?.value || -1024);
            const strength = Math.round(Math.sqrt(x*x + y*y + z*z));
            if (accelForceSlider) accelForceSlider.value = Math.min(3500, strength);
            if (accelForceValue) accelForceValue.textContent = strength;
        };
        
        // Fonction pour mettre à jour les valeurs de l'accéléromètre
        const updateAccelValues = () => {
            const x = parseInt(accelXSlider?.value || 0);
            const y = parseInt(accelYSlider?.value || 0);
            const z = parseInt(accelZSlider?.value || -1024);
            
            secondMicrobit.acceleration = { x, y, z };
            
            if (accelXValue) accelXValue.textContent = x;
            if (accelYValue) accelYValue.textContent = y;
            if (accelZValue) accelZValue.textContent = z;
            
            updateForceDisplay();
        };
        
        // Bouton pour ouvrir/fermer la popup
        if (btnAccel && accelModal) {
            btnAccel.onclick = () => {
                if (accelModal.style.display === 'block') {
                    accelModal.style.display = 'none';
                } else {
                    accelModal.style.display = 'block';
                }
            };
        }
        
        // Bouton fermer
        if (btnCloseAccel && accelModal) {
            btnCloseAccel.onclick = () => {
                accelModal.style.display = 'none';
            };
        }
        
        // Événements des sliders
        if (accelXSlider) accelXSlider.oninput = updateAccelValues;
        if (accelYSlider) accelYSlider.oninput = updateAccelValues;
        if (accelZSlider) accelZSlider.oninput = updateAccelValues;
        
        // Bouton reset
        if (btnResetAccel) {
            btnResetAccel.onclick = () => {
                if (accelXSlider) accelXSlider.value = 0;
                if (accelYSlider) accelYSlider.value = 0;
                if (accelZSlider) accelZSlider.value = -1024;
                updateAccelValues();
            };
        }
        
        // Rendre la popup déplaçable
        if (accelModal) {
            const header = accelModal.querySelector('.accel-modal-header');
            if (header) {
                makeDraggable(accelModal, header);
            }
        }
        
    }

    /**
     * Active la radio et affiche la seconde carte
     */
    function enableRadio() {
        if (radioEnabled) return;
        
        radioEnabled = true;
        
        // Créer le panneau s'il n'existe pas
        createSecondMicrobitPanel();
        
        const panel = document.getElementById('radioMicrobitPanel');
        if (panel) {
            panel.style.display = 'flex';
            panel.classList.remove('collapsed');
            
            const collapseBtn = panel.querySelector('.collapse-btn');
            if (collapseBtn) collapseBtn.classList.remove('collapsed');
            
            // Forcer un reflow immédiat pour que le panneau soit rendu
            panel.offsetHeight;
            
            // Enregistrer le panneau dans le gestionnaire
            // Un seul requestAnimationFrame suffit car registerPanel
            // configure le panneau de manière synchrone
            requestAnimationFrame(() => {
                if (window.simulatorPanels) {
                    window.simulatorPanels.registerPanel(panel);
                }
            });
        }
        
        // Initialiser la seconde carte
        if (!secondMicrobit) {
            initSecondMicrobit();
        }
        
        updateRadioStatus(true);
    }

    function disableRadio() {
        radioEnabled = false;
        stopSecondProgram();
        updateRadioStatus(false);
        
        // Masquer le panneau
        const panel = document.getElementById('radioMicrobitPanel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    function initSecondMicrobit() {
        if (typeof MicrobitSimulator === 'undefined') {
            console.error('MicrobitSimulator non disponible');
            return;
        }
        
        secondMicrobit = new MicrobitSimulator('secondMicrobitSimulator');
        
        // Attendre que le micro:bit soit prêt
        secondMicrobit.ready().then(() => {
            // Configurer les contrôles après que le SVG soit chargé
            setupRadioControls();
        });
        
        secondRuntime = {
            onStartCallbacks: [],
            foreverCallbacks: [],
            radioCallbacks: { number: [], string: [], value: [] },
            reset() {
                this.onStartCallbacks = [];
                this.foreverCallbacks = [];
                this.radioCallbacks = { number: [], string: [], value: [] };
            }
        };
        
    }

    function toggleSecondMicrobitPanel() {
        const panel = document.getElementById('radioMicrobitPanel');
        if (!panel) return;
        
        const isCollapsed = panel.classList.contains('collapsed');
        const collapseBtn = panel.querySelector('.collapse-btn');
        
        if (isCollapsed) {
            panel.classList.remove('collapsed');
            if (collapseBtn) collapseBtn.classList.remove('collapsed');
        } else {
            panel.classList.add('collapsed');
            if (collapseBtn) collapseBtn.classList.add('collapsed');
        }
    }

    function updateRadioStatus(active, group = null) {
        const indicator = document.getElementById('radioIndicator');
        const groupInfo = document.getElementById('radioGroupInfo');
        
        if (indicator) {
            const dot = indicator.querySelector('.radio-dot');
            const text = indicator.querySelector('.radio-status-text');
            
            if (active) {
                dot?.classList.add('active');
                if (text) text.textContent = 'Radio active';
            } else {
                dot?.classList.remove('active');
                if (text) text.textContent = 'Radio inactive';
            }
        }
        
        if (groupInfo && group !== null) {
            groupInfo.textContent = `Groupe: ${group}`;
        }
    }

    function updateRadioGroup(group) {
        const groupInfo = document.getElementById('radioGroupInfo');
        if (groupInfo) {
            groupInfo.textContent = `Groupe: ${group}`;
        }
    }

    // ========== ANIMATION D'ÉMISSION RADIO ==========
    
    let radioAnimationState = { 
        1: { running: false, pending: false, timer: null },
        2: { running: false, pending: false, timer: null }
    };
    
    function animateRadioTransmit(fromCard) {
        // fromCard: 1 = carte principale, 2 = carte secondaire
        const state = radioAnimationState[fromCard];
        
        // Si une animation est en cours, marquer qu'il y a une communication en attente
        if (state.running) {
            state.pending = true;
            return;
        }
        
        // Démarrer l'animation
        startRadioAnimation(fromCard);
    }
    
    function startRadioAnimation(fromCard) {
        const state = radioAnimationState[fromCard];
        const sourceId = fromCard === 1 ? 'microbitSimulator' : 'secondMicrobitSimulator';
        const sourceElement = document.getElementById(sourceId);
        
        if (!sourceElement) return;
        
        state.running = true;
        state.pending = false;
        
        const svgEl = sourceElement.querySelector('svg');
        if (!svgEl) return;
        
        const ns = 'http://www.w3.org/2000/svg';
        
        // Supprimer l'ancien groupe d'animation
        const oldGroup = svgEl.querySelector('.radio-wifi-group');
        if (oldGroup) oldGroup.remove();
        
        // Creer un groupe SVG positionne en haut a droite du viewBox (0 0 538.67 434.4)
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'radio-wifi-group');
        g.setAttribute('transform', 'translate(500, 40)');
        
        // Point central (dot)
        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('cx', '0');
        dot.setAttribute('cy', '0');
        dot.setAttribute('r', '10');
        dot.setAttribute('fill', '#e3008c');
        dot.setAttribute('class', 'wifi-svg-dot');
        g.appendChild(dot);
        
        // 3 arcs (quarts de cercle vers haut-droite)
        const radii = [28, 46, 64];
        const delays = [0.1, 0.2, 0.3];
        radii.forEach((r, i) => {
            const arc = document.createElementNS(ns, 'path');
            arc.setAttribute('d', `M 0,${-r} A ${r},${r} 0 0,1 ${r},0`);
            arc.setAttribute('fill', 'none');
            arc.setAttribute('stroke', '#e3008c');
            arc.setAttribute('stroke-width', '8');
            arc.setAttribute('stroke-linecap', 'round');
            arc.setAttribute('class', `wifi-svg-arc wifi-svg-arc-${i + 1}`);
            g.appendChild(arc);
        });
        
        svgEl.appendChild(g);
        
        if (state.timer) clearTimeout(state.timer);
        
        state.timer = setTimeout(() => {
            state.running = false;
            
            if (state.pending) {
                startRadioAnimation(fromCard);
            } else {
                if (g.parentNode) g.remove();
            }
            state.timer = null;
        }, 1100);
    }

    // ========== GESTION DES MESSAGES RADIO ==========

    // File d'attente de messages radio (pour connexion lente)
    let radioMessageQueue = [];
    let secondCardReady = false;

    function queueRadioMessage(message) {
        radioMessageQueue.push(message);
    }

    function flushRadioQueue() {
        if (!secondRuntime || radioMessageQueue.length === 0) return;
        const queued = radioMessageQueue.splice(0);
        for (const msg of queued) {
            triggerRadioCallbacks(secondRuntime, msg);
        }
    }

    function handleRadioMessage(event) {
        if (!radioEnabled) return;
        
        const message = event.detail;
        
        // Animation d'émission depuis la carte 1
        animateRadioTransmit(1);

        // Si la carte 2 n'est pas encore prête, mettre en file d'attente
        if (!secondCardReady || !secondMicrobit) {
            queueRadioMessage(message);
            return;
        }
        
        if (secondMicrobit.radioGroup !== message.group) return;
        
        triggerRadioCallbacks(secondRuntime, message);
    }

    function handleRadioMessageFromSecond(event) {
        if (!radioEnabled || !window.microbitSim) return;
        
        const message = event.detail;
        if (window.microbitSim.radioGroup !== message.group) return;
        
        // Animation d'émission depuis la carte 2
        animateRadioTransmit(2);
        
        if (window.microbitSim.radioCallbacks) {
            const gen = window._execGeneration || 0;
            window.microbitSim.radioCallbacks.forEach(cb => {
                if (cb.type === message.type) {
                    Promise.resolve().then(async () => {
                        if ((window._execGeneration || 0) !== gen) return;
                        try {
                            if (message.type === 'number') await cb.callback(message.value);
                            else if (message.type === 'string') await cb.callback(message.value);
                            else if (message.type === 'value') await cb.callback(message.name, message.value);
                        } catch (e) {
                            if (e && e.name === '__StopExecution') return;
                            console.error('Erreur callback radio:', e);
                        }
                    });
                }
            });
        }
    }

    function triggerRadioCallbacks(runtime, message) {
        if (!runtime || !runtime.radioCallbacks) return;
        
        const callbacks = runtime.radioCallbacks[message.type];
        if (!callbacks) return;
        
        const gen = window._execGeneration || 0;
        callbacks.forEach(cb => {
            Promise.resolve().then(async () => {
                if ((window._execGeneration || 0) !== gen) return;
                try {
                    if (message.type === 'number') await cb(message.value);
                    else if (message.type === 'string') await cb(message.value);
                    else if (message.type === 'value') await cb(message.name, message.value);
                } catch (e) {
                    if (e && e.name === '__StopExecution') return;
                    console.error('Erreur callback radio:', e);
                }
            });
        });
    }

    // ========== EXÉCUTION DU PROGRAMME ==========

    async function runSecondProgram() {
        
        if (!secondMicrobit) {
            initSecondMicrobit();
        }
        
        secondCardReady = false;
        radioMessageQueue = [];
        
        // Afficher indicateur de chargement
        showSecondCardLoading(true);
        
        // CRITIQUE : attendre que le SVG soit chargé et les éléments DOM prêts
        // Sur connexion lente, fetch('Microbit.svg') peut prendre plusieurs secondes
        if (secondMicrobit) {
            try {
                await secondMicrobit.ready();
            } catch (e) {
                console.error('Erreur initialisation carte 2:', e);
                showSecondCardLoading(false);
                return;
            }
        }
        
        showSecondCardLoading(false);
        
        if (!secondMicrobit || !secondRuntime) {
            return;
        }
        
        if (secondProgramRunning) {
            await stopSecondProgram();
            await new Promise(r => setTimeout(r, 100));
        }
        
        if (secondMicrobit.startNewExecution) {
            secondMicrobit.startNewExecution();
        } else {
            secondMicrobit.reset();
        }
        secondRuntime.reset();
        secondStopRequested = false;
        secondProgramRunning = true;
        
        updateRunningState(true);
        
        let code = '';
        
        // Utiliser getCard2XmlForExecution si disponible (nouvelle méthode)
        if (window.getCard2XmlForExecution) {
            const card2Xml = window.getCard2XmlForExecution();
            if (card2Xml) {
                code = generateCodeFromXml(card2Xml);
            } else {
                // Pas de XML carte 2, utiliser le workspace principal
                if (window.workspace) {
                    code = Blockly.JavaScript.workspaceToCode(window.workspace);
                }
            }
        } else if (window.workspace) {
            // Fallback : utiliser le workspace principal
            code = Blockly.JavaScript.workspaceToCode(window.workspace);
        }
        
        if (!code || code.trim() === '') {
            secondProgramRunning = false;
            updateRunningState(false);
            return;
        }
        
        code = adaptCodeForSecondMicrobit(code);
        
        
        try {
            const asyncCode = `
                (async function() {
                    try {
                        ${code}
                        
                        for (const cb of __secondRuntime.onStartCallbacks) {
                            await cb();
                        }
                        
                        while (__secondRuntime.foreverCallbacks.length > 0) {
                            for (const cb of __secondRuntime.foreverCallbacks) {
                                await cb();
                            }
                            await __pause(20);
                        }
                    } catch(e) {
                        if (e && e.name === '__StopExecution') return;
                        throw e;
                    }
                })();
            `;
            
            window.__secondMicrobit = secondMicrobit;
            window.__secondRuntime = secondRuntime;
            window.__secondStopRequested = false;
            
            eval(asyncCode);
            
            // À ce point, les callbacks (onRadioReceived, etc.) sont enregistrés
            // synchroniquement par le code eval'd. On peut rejouer les messages en attente.
            secondCardReady = true;
            flushRadioQueue();
            
        } catch (error) {
            console.error('Erreur exécution carte 2:', error);
        }
    }

    function showSecondCardLoading(show) {
        const panel = document.getElementById('radioMicrobitPanel');
        if (!panel) return;
        let loader = panel.querySelector('.radio-loading-overlay');
        if (show) {
            if (!loader) {
                loader = document.createElement('div');
                loader.className = 'radio-loading-overlay';
                loader.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;
                        position:absolute;inset:0;background:rgba(15,12,50,0.85);z-index:50;
                        display:flex;justify-content:center;border-radius:8px;">
                        <div style="width:24px;height:24px;border:3px solid rgba(139,92,246,0.3);
                            border-top-color:#a78bfa;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
                        <span style="color:#c4b5fd;font-size:12px;">Chargement carte 2…</span>
                    </div>
                `;
                const content = panel.querySelector('.sim-panel-content');
                if (content) {
                    content.style.position = 'relative';
                    content.appendChild(loader);
                }
            }
        } else {
            if (loader) loader.remove();
        }
    }

    async function stopSecondProgram() {
        secondStopRequested = true;
        window.__secondStopRequested = true;
        secondCardReady = false;
        radioMessageQueue = [];
        
        if (secondMicrobit) {
            secondMicrobit.stopAllAnimations();
            secondMicrobit.clearScreen();
        }
        
        if (secondRuntime) {
            secondRuntime.reset();
        }
        
        secondProgramRunning = false;
        updateRunningState(false);
    }

    function resetSecondMicrobit() {
        stopSecondProgram();
        
        if (secondMicrobit) {
            secondMicrobit.reset();
            secondMicrobit.clearScreen();
        }
        
        if (secondRuntime) {
            secondRuntime.reset();
        }
    }

    function adaptCodeForSecondMicrobit(code) {
        let adapted = code;
        
        // Runtime
        adapted = adapted.replace(/\b__onStart\b/g, '__secondOnStart');
        adapted = adapted.replace(/\b__forever\b/g, '__secondForever');
        adapted = adapted.replace(/\bruntime\b/g, '__secondRuntime');
        adapted = adapted.replace(/\bmicrobitSim\b/g, '__secondMicrobit');
        
        // Affichage
        adapted = adapted.replace(/__mbShowNumber/g, '__secondMbShowNumber');
        adapted = adapted.replace(/__mbShowIcon/g, '__secondMbShowIcon');
        adapted = adapted.replace(/__mbShowLeds/g, '__secondMbShowLeds');
        adapted = adapted.replace(/__mbShowString/g, '__secondMbShowString');
        adapted = adapted.replace(/__mbClearScreen/g, '__secondMbClearScreen');
        adapted = adapted.replace(/__mbShowArrow/g, '__secondMbShowArrow');
        
        // Entrées
        adapted = adapted.replace(/__mbOnButtonPressed/g, '__secondMbOnButtonPressed');
        adapted = adapted.replace(/__mbButtonIsPressed/g, '__secondMbButtonIsPressed');
        adapted = adapted.replace(/__mbOnGesture/g, '__secondMbOnGesture');
        adapted = adapted.replace(/__mbOnLogoEvent/g, '__secondMbOnLogoEvent');
        adapted = adapted.replace(/__mbLogoIsPressed/g, '__secondMbLogoIsPressed');
        
        // Capteurs
        adapted = adapted.replace(/__mbTemperature/g, '__secondMbTemperature');
        adapted = adapted.replace(/__mbLightLevel/g, '__secondMbLightLevel');
        adapted = adapted.replace(/__mbCompassHeading/g, '__secondMbCompassHeading');
        adapted = adapted.replace(/__mbAcceleration/g, '__secondMbAcceleration');
        adapted = adapted.replace(/__mbRotation/g, '__secondMbRotation');
        adapted = adapted.replace(/__mbRunningTime/g, '__secondMbRunningTime');
        adapted = adapted.replace(/__mbSoundLevel/g, '__secondMbSoundLevel');
        
        // LED avancées
        adapted = adapted.replace(/__mbPlot\b/g, '__secondMbPlot');
        adapted = adapted.replace(/__mbUnplot/g, '__secondMbUnplot');
        adapted = adapted.replace(/__mbToggle/g, '__secondMbToggle');
        adapted = adapted.replace(/__mbPoint/g, '__secondMbPoint');
        adapted = adapted.replace(/__mbBrightness/g, '__secondMbBrightness');
        adapted = adapted.replace(/__mbSetBrightness/g, '__secondMbSetBrightness');
        adapted = adapted.replace(/__mbPlotBarGraph/g, '__secondMbPlotBarGraph');
        
        // Musique
        adapted = adapted.replace(/__mbPlayTone/g, '__secondMbPlayTone');
        adapted = adapted.replace(/__mbRingTone/g, '__secondMbRingTone');
        adapted = adapted.replace(/__mbRest/g, '__secondMbRest');
        adapted = adapted.replace(/__mbStopAllSounds/g, '__secondMbStopAllSounds');
        adapted = adapted.replace(/__mbSetTempo/g, '__secondMbSetTempo');
        adapted = adapted.replace(/__mbTempo\b/g, '__secondMbTempo');
        adapted = adapted.replace(/__mbBeat/g, '__secondMbBeat');
        
        // Radio
        adapted = adapted.replace(/__mbRadioSendNumber/g, '__secondRadioSendNumber');
        adapted = adapted.replace(/__mbRadioSendString/g, '__secondRadioSendString');
        adapted = adapted.replace(/__mbRadioSendValue/g, '__secondRadioSendValue');
        adapted = adapted.replace(/__mbOnRadioReceivedNumber/g, '__secondOnRadioReceivedNumber');
        adapted = adapted.replace(/__mbOnRadioReceivedString/g, '__secondOnRadioReceivedString');
        adapted = adapted.replace(/__mbRadioSetGroup/g, '__secondRadioSetGroup');
        
        // === NEUTRALISER les simulateurs physiques (cutebot, barrière, portillon) ===
        // Dans la réalité, seule la carte 1 est branchée aux maquettes.
        // La carte 2 ne doit PAS contrôler les simulateurs cutebot, barrière ni portillon.
        
        // Cutebot : moteurs, LEDs, capteurs, servos, IR
        adapted = adapted.replace(/\b__motors\b/g, '__noop');
        adapted = adapted.replace(/\b__forward\b/g, '__noop');
        adapted = adapted.replace(/\b__backward\b/g, '__noop');
        adapted = adapted.replace(/\b__turnLeft\b/g, '__noop');
        adapted = adapted.replace(/\b__turnRight\b/g, '__noop');
        adapted = adapted.replace(/\b__stop\b/g, '__noop');
        adapted = adapted.replace(/\b__moveTime\b/g, '__noopAsync');
        adapted = adapted.replace(/\b__ledColor\b/g, '__noop');
        adapted = adapted.replace(/\b__ledRGB\b/g, '__noop');
        adapted = adapted.replace(/\b__ledOff\b/g, '__noop');
        adapted = adapted.replace(/\b__trackingState\b/g, '__noopFalse');
        adapted = adapted.replace(/\b__trackSide\b/g, '__noopFalse');
        adapted = adapted.replace(/\b__ultrasonic\b/g, '__noopZero');
        adapted = adapted.replace(/\b__servo\b/g, '__noop');
        adapted = adapted.replace(/\b__onTrackEvent\b/g, '__noop');
        adapted = adapted.replace(/\b__onIRReceive\b/g, '__noop');
        adapted = adapted.replace(/\b__irButtonPressed\b/g, '__noopFalse');
        
        // Servo (contrôle barrière et portillon via pins P1/P2)
        adapted = adapted.replace(/\b__servoSetAngle\b/g, '__noop');
        adapted = adapted.replace(/\b__servoRun\b/g, '__noop');
        adapted = adapted.replace(/\b__servoStop\b/g, '__noop');
        adapted = adapted.replace(/\b__servoSetRange\b/g, '__noop');
        adapted = adapted.replace(/\b__servoSetStopMode\b/g, '__noop');
        adapted = adapted.replace(/\b__servoSetPulse\b/g, '__noop');
        
        // RFID (portillon)
        adapted = adapted.replace(/\b__rfidInit\b/g, '__noop');
        adapted = adapted.replace(/\b__rfidGetId\b/g, '__noopEmpty');
        adapted = adapted.replace(/\b__rfidRead\b/g, '__noopEmpty');
        adapted = adapted.replace(/\b__rfidWrite\b/g, '__noop');
        adapted = adapted.replace(/\b__rfidAntennaOff\b/g, '__noop');
        
        return adapted;
    }

    function updateRunningState(running) {
        const runBtn = document.querySelector('.radio-run-btn');
        const stopBtn = document.querySelector('.radio-stop-btn');
        
        if (runBtn) runBtn.classList.toggle('active', running);
        if (stopBtn) stopBtn.classList.toggle('active', running);
    }

    // ========== ÉDITEUR DE PROGRAMME (FENÊTRE FLOTTANTE) ==========

    function openProgramEditor() {
        // Fermer si déjà ouvert
        if (editorWindow) {
            closeProgramEditor();
            return;
        }
        
        // Créer la fenêtre flottante
        editorWindow = document.createElement('div');
        editorWindow.id = 'radioEditorWindow';
        editorWindow.className = 'radio-editor-floating';
        
        editorWindow.innerHTML = `
            <div class="radio-editor-header" id="radioEditorHeader">
                <span class="radio-editor-title">📻 Programme Carte Radio</span>
                <div class="radio-editor-buttons">
                    <button class="radio-editor-btn" onclick="radioEditorNew()" title="Nouveau">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="12" y1="18" x2="12" y2="12"></line>
                            <line x1="9" y1="15" x2="15" y2="15"></line>
                        </svg>
                    </button>
                    <button class="radio-editor-btn" onclick="radioEditorLoad()" title="Charger">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </button>
                    <button class="radio-editor-btn" onclick="radioEditorSave()" title="Sauvegarder">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                    </button>
                    <button class="radio-editor-btn radio-editor-apply" onclick="radioEditorApply()" title="Appliquer">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </button>
                    <button class="radio-editor-btn radio-editor-close" onclick="radioSimulator.closeProgramEditor()" title="Fermer">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
            <div id="radioBlocklyDiv" class="radio-blockly-area"></div>
            <div class="radio-editor-resize" id="radioEditorResize"></div>
            <input type="file" id="radioFileInput" accept=".xml,.json" style="display: none;" onchange="radioEditorLoadFile(this)">
        `;
        
        document.body.appendChild(editorWindow);
        
        // Rendre la fenêtre déplaçable
        makeDraggable(editorWindow, document.getElementById('radioEditorHeader'));
        
        // Rendre la fenêtre redimensionnable
        makeResizable(editorWindow, document.getElementById('radioEditorResize'));
        
        // Initialiser Blockly
        setTimeout(() => initRadioBlockly(), 50);
        
        // Passer en mode programme personnalisé
        useMainProgram = false;
    }

    function closeProgramEditor() {
        if (!editorWindow) return;
        
        // Sauvegarder le programme avant de fermer
        if (secondWorkspace) {
            const xml = Blockly.Xml.workspaceToDom(secondWorkspace);
            secondProgramXml = Blockly.Xml.domToText(xml);
            secondWorkspace.dispose();
            secondWorkspace = null;
        }
        
        editorWindow.remove();
        editorWindow = null;
    }

    function initRadioBlockly() {
        const container = document.getElementById('radioBlocklyDiv');
        if (!container) return;
        
        // Utiliser la même toolbox que le workspace principal
        const mainToolbox = document.getElementById('toolbox');
        
        secondWorkspace = Blockly.inject('radioBlocklyDiv', {
            toolbox: mainToolbox,
            theme: Blockly.Theme.defineTheme('radioTheme', {
                'base': Blockly.Themes.Classic,
                'componentStyles': {
                    'workspaceBackgroundColour': '#1e293b',
                    'toolboxBackgroundColour': '#0f172a',
                    'flyoutBackgroundColour': '#1e293b',
                    'flyoutForegroundColour': '#ccc',
                    'scrollbarColour': '#475569'
                }
            }),
            grid: { spacing: 20, length: 3, colour: '#334155', snap: true },
            zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 2, minScale: 0.3 },
            trashcan: true,
            sounds: false,
            renderer: 'zelos'
        });
        
        // Charger le programme existant ou par défaut
        if (secondProgramXml) {
            try {
                const xml = Blockly.utils.xml.textToDom(secondProgramXml);
                Blockly.Xml.domToWorkspace(xml, secondWorkspace);
            } catch (e) {
                loadDefaultRadioProgram();
            }
        } else {
            loadDefaultRadioProgram();
        }
    }

    function loadDefaultRadioProgram() {
        if (!secondWorkspace) return;
        
        const defaultXml = `
            <xml>
                <block type="on_start" x="50" y="50">
                    <statement name="DO">
                        <block type="radio_set_group">
                            <value name="GROUP"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
                        </block>
                    </statement>
                </block>
                <block type="radio_on_received_number" x="50" y="200">
                    <statement name="DO">
                        <block type="basic_show_number">
                            <value name="NUM">
                                <block type="variables_get">
                                    <field name="VAR">receivedNumber</field>
                                </block>
                            </value>
                        </block>
                    </statement>
                </block>
            </xml>
        `;
        
        try {
            const xml = Blockly.utils.xml.textToDom(defaultXml);
            Blockly.Xml.domToWorkspace(xml, secondWorkspace);
        } catch (e) {
            console.error('Erreur chargement programme par défaut:', e);
        }
    }

    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        handle.onmousedown = dragMouseDown;
        
        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
        
        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
            element.style.right = 'auto';
            element.style.bottom = 'auto';
        }
        
        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    function makeResizable(element, handle) {
        handle.onmousedown = function(e) {
            e.preventDefault();
            document.onmousemove = resize;
            document.onmouseup = stopResize;
        };
        
        function resize(e) {
            const rect = element.getBoundingClientRect();
            element.style.width = (e.clientX - rect.left) + 'px';
            element.style.height = (e.clientY - rect.top) + 'px';
            
            if (secondWorkspace) {
                Blockly.svgResize(secondWorkspace);
            }
        }
        
        function stopResize() {
            document.onmousemove = null;
            document.onmouseup = null;
        }
    }

    function setUseMainProgram(value) {
        useMainProgram = value;
    }

    // Fonctions globales pour l'éditeur
    window.radioEditorNew = function() {
        if (!secondWorkspace) return;
        if (confirm('Créer un nouveau programme ?')) {
            secondWorkspace.clear();
            loadDefaultRadioProgram();
        }
    };

    window.radioEditorLoad = function() {
        document.getElementById('radioFileInput')?.click();
    };

    window.radioEditorLoadFile = function(input) {
        const file = input.files[0];
        if (!file || !secondWorkspace) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                let content = e.target.result;
                if (file.name.endsWith('.json')) {
                    const data = JSON.parse(content);
                    content = data.xml || data.blocks;
                }
                secondWorkspace.clear();
                const xml = Blockly.utils.xml.textToDom(content);
                Blockly.Xml.domToWorkspace(xml, secondWorkspace);
            } catch (error) {
                alert('Erreur : ' + error.message);
            }
        };
        reader.readAsText(file);
        input.value = '';
    };

    window.radioEditorSave = function() {
        if (!secondWorkspace) return;
        
        const xml = Blockly.Xml.workspaceToDom(secondWorkspace);
        const xmlText = Blockly.Xml.domToText(xml);
        
        const data = { name: 'Programme Radio', date: new Date().toISOString(), xml: xmlText };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'programme-radio.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    window.radioEditorApply = function() {
        if (secondWorkspace) {
            const xml = Blockly.Xml.workspaceToDom(secondWorkspace);
            secondProgramXml = Blockly.Xml.domToText(xml);
        }
        
        // Relancer si radio active
        if (radioEnabled) {
            runSecondProgram();
        }
    };

    function generateCodeFromXml(xmlText) {
        if (!xmlText) return '';
        
        const tempDiv = document.createElement('div');
        tempDiv.style.display = 'none';
        document.body.appendChild(tempDiv);
        
        const tempWorkspace = Blockly.inject(tempDiv, { readOnly: true });
        
        try {
            const xml = Blockly.utils.xml.textToDom(xmlText);
            Blockly.Xml.domToWorkspace(xml, tempWorkspace);
            return Blockly.JavaScript.workspaceToCode(tempWorkspace);
        } finally {
            tempWorkspace.dispose();
            tempDiv.remove();
        }
    }

    // ========== FONCTIONS RUNTIME POUR LA SECONDE CARTE ==========

    window.__secondOnStart = function(fn) {
        if (window.__secondRuntime) window.__secondRuntime.onStartCallbacks.push(fn);
    };

    window.__secondForever = function(fn) {
        if (window.__secondRuntime) window.__secondRuntime.foreverCallbacks.push(fn);
    };

    // Basic
    window.__secondMbShowNumber = async function(num) {
        if (window.__secondMicrobit) await window.__secondMicrobit.showNumber(num);
    };
    window.__secondMbShowIcon = function(iconName) {
        if (window.__secondMicrobit) window.__secondMicrobit.showIcon(iconName);
    };
    window.__secondMbShowLeds = function(pattern) {
        if (window.__secondMicrobit) window.__secondMicrobit.showLeds(pattern);
    };
    window.__secondMbShowString = async function(text) {
        if (window.__secondMicrobit) await window.__secondMicrobit.showString(text);
    };
    window.__secondMbClearScreen = function() {
        if (window.__secondMicrobit) window.__secondMicrobit.clearScreen();
    };
    window.__secondMbShowArrow = function(direction) {
        if (window.__secondMicrobit) window.__secondMicrobit.showArrow(direction);
    };

    // Input
    window.__secondMbOnButtonPressed = function(button, callback) {
        if (window.__secondMicrobit) window.__secondMicrobit.onButtonPressed(button, callback);
    };
    window.__secondMbButtonIsPressed = function(button) {
        return window.__secondMicrobit ? window.__secondMicrobit.isButtonPressed(button) : false;
    };
    window.__secondMbOnGesture = function(gesture, callback) {
        if (window.__secondMicrobit) window.__secondMicrobit.onGesture(gesture, callback);
    };
    window.__secondMbTemperature = function() {
        return window.__secondMicrobit ? window.__secondMicrobit.getTemperature() : 21;
    };
    window.__secondMbLightLevel = function() {
        return window.__secondMicrobit ? window.__secondMicrobit.getLightLevel() : 128;
    };
    window.__secondMbCompassHeading = function() {
        return window.__secondMicrobit ? window.__secondMicrobit.getCompassHeading() : 0;
    };
    window.__secondMbAcceleration = function(dimension) {
        return window.__secondMicrobit ? window.__secondMicrobit.getAcceleration(dimension) : 0;
    };
    window.__secondMbRotation = function(axis) {
        return window.__secondMicrobit ? window.__secondMicrobit.getRotation(axis) : 0;
    };
    window.__secondMbRunningTime = function() {
        return window.__secondMicrobit ? window.__secondMicrobit.getRunningTime() : 0;
    };
    window.__secondMbOnLogoEvent = function(event, callback) {
        if (window.__secondMicrobit) window.__secondMicrobit.onLogoEvent(event, callback);
    };
    window.__secondMbLogoIsPressed = function() {
        return window.__secondMicrobit ? window.__secondMicrobit.isLogoPressed() : false;
    };
    window.__secondMbSoundLevel = function() {
        return window.__secondMicrobit ? window.__secondMicrobit.getSoundLevel() : 0;
    };

    // LED
    window.__secondMbPlot = function(x, y) {
        if (window.__secondMicrobit) window.__secondMicrobit.plot(x, y);
    };
    window.__secondMbUnplot = function(x, y) {
        if (window.__secondMicrobit) window.__secondMicrobit.unplot(x, y);
    };
    window.__secondMbToggle = function(x, y) {
        if (window.__secondMicrobit) window.__secondMicrobit.toggle(x, y);
    };
    window.__secondMbPoint = function(x, y) {
        return window.__secondMicrobit ? window.__secondMicrobit.point(x, y) : false;
    };
    window.__secondMbBrightness = function() {
        return window.__secondMicrobit ? window.__secondMicrobit.getBrightness() : 255;
    };
    window.__secondMbSetBrightness = function(value) {
        if (window.__secondMicrobit) window.__secondMicrobit.setBrightness(value);
    };
    window.__secondMbPlotBarGraph = function(value, max) {
        if (window.__secondMicrobit) window.__secondMicrobit.plotBarGraph(value, max);
    };

    // Music
    window.__secondMbPlayTone = async function(frequency, duration) {
        if (window.__secondMicrobit) await window.__secondMicrobit.playTone(frequency, duration);
    };
    window.__secondMbRingTone = function(frequency) {
        if (window.__secondMicrobit) window.__secondMicrobit.ringTone(frequency);
    };
    window.__secondMbRest = async function(duration) {
        if (window.__secondMicrobit) await window.__secondMicrobit.rest(duration);
    };
    window.__secondMbStopAllSounds = function() {
        if (window.__secondMicrobit) window.__secondMicrobit.stopSound();
    };
    window.__secondMbSetTempo = function(bpm) {
        if (window.__secondMicrobit) window.__secondMicrobit.setTempo(bpm);
    };
    window.__secondMbTempo = function() {
        return window.__secondMicrobit ? window.__secondMicrobit.getTempo() : 120;
    };
    window.__secondMbBeat = function(fraction) {
        return window.__secondMicrobit ? window.__secondMicrobit.getBeatMs(fraction) : 500;
    };

    // Radio
    window.__secondRadioSetGroup = function(group) {
        if (window.__secondMicrobit) {
            window.__secondMicrobit.setRadioGroup(group);
            updateRadioGroup(group);
        }
    };
    window.__secondRadioSendNumber = function(value) {
        if (!window.__secondMicrobit || !window.__secondMicrobit.radioEnabled) return;
        const message = { type: 'number', value: value, group: window.__secondMicrobit.radioGroup };
        window.dispatchEvent(new CustomEvent('microbit-radio-second', { detail: message }));
    };
    window.__secondRadioSendString = function(value) {
        if (!window.__secondMicrobit || !window.__secondMicrobit.radioEnabled) return;
        const message = { type: 'string', value: value, group: window.__secondMicrobit.radioGroup };
        window.dispatchEvent(new CustomEvent('microbit-radio-second', { detail: message }));
    };
    window.__secondRadioSendValue = function(name, value) {
        if (!window.__secondMicrobit || !window.__secondMicrobit.radioEnabled) return;
        const message = { type: 'value', name: name, value: value, group: window.__secondMicrobit.radioGroup };
        window.dispatchEvent(new CustomEvent('microbit-radio-second', { detail: message }));
    };
    window.__secondOnRadioReceivedNumber = function(callback) {
        if (window.__secondRuntime) window.__secondRuntime.radioCallbacks.number.push(callback);
    };
    window.__secondOnRadioReceivedString = function(callback) {
        if (window.__secondRuntime) window.__secondRuntime.radioCallbacks.string.push(callback);
    };

    // ========== AUTO-DÉTECTION DES BLOCS RADIO ==========

    function checkForRadioBlocks(workspace) {
        if (!workspace) return false;
        
        const radioBlockTypes = [
            'radio_set_group', 'radio_send_number', 'radio_send_string',
            'radio_send_value', 'radio_on_received_number', 'radio_on_received_string',
            'radio_set_transmit_power', 'radio_received_packet'
        ];
        
        const allBlocks = workspace.getAllBlocks(false);
        return allBlocks.some(block => radioBlockTypes.includes(block.type));
    }

    function autoEnableRadio() {
        if (window.workspace && checkForRadioBlocks(window.workspace)) {
            if (!radioEnabled) enableRadio();
        }
    }

    window.addEventListener('load', () => {
        setTimeout(() => {
            if (window.workspace) {
                window.workspace.addChangeListener((event) => {
                    if (event.type === Blockly.Events.BLOCK_CREATE ||
                        event.type === Blockly.Events.BLOCK_DELETE ||
                        event.type === Blockly.Events.BLOCK_CHANGE) {
                        autoEnableRadio();
                    }
                });
            }
        }, 1000);
    });

    // ========== INITIALISATION ==========
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRadioSimulator);
    } else {
        initRadioSimulator();
    }

})();
