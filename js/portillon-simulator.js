/**
 * Portillon Simulator - Simulateur de portillon avec module RFID
 * Gère l'animation 3D de la porte et la détection du badge RFID
 */

(function() {
    'use strict';

    // État du simulateur
    let portillonState = {
        doorAngle: 90,           // 90° = fermé, 180° = ouvert
        targetDoorAngle: 90,
        rfidInitialized: false,
        badgeOnReader: false,
        badgeId: '12345678',     // ID = uniquement des chiffres
        badgeData: 'Badge 1',
        animationFrame: null
    };

    // Éléments DOM
    let elements = {
        door: null,
        badge: null,
        rfidModule: null,
        rfidDetectionZone: null,
        badgeHalo: null,
        idInput: null,
        dataInput: null,
        statusIndicator: null
    };

    // Position initiale du badge
    let badgeInitialPos = { x: 0, y: 0 };
    let badgeDragOffset = { x: 0, y: 0 };
    let isDragging = false;

    /**
     * Initialise le simulateur de portillon
     */
    function initPortillonSimulator(container) {
        if (!container) return;

        // Créer le contenu HTML
        container.innerHTML = createPortillonHTML();

        // Récupérer les éléments
        elements.door = container.querySelector('.portillon-door');
        elements.badge = container.querySelector('.rfid-badge');
        elements.rfidModule = container.querySelector('.rfid-module');
        elements.rfidDetectionZone = container.querySelector('.rfid-detection-zone');
        elements.badgeHalo = container.querySelector('.badge-halo');
        elements.idInput = container.querySelector('#rfid-badge-id');
        elements.dataInput = container.querySelector('#rfid-badge-data');
        elements.statusIndicator = container.querySelector('.rfid-status');

        // Initialiser les événements
        setupBadgeDrag();
        setupInputEvents();

        // Mettre à jour l'état initial
        updateDoorAngle(90, true);
        updateRfidStatus();

        console.log('🚪 Portillon Simulator initialisé');
    }

    /**
     * Crée le HTML du simulateur
     */
    function createPortillonHTML() {
        return `
            <div class="portillon-simulator-content">
                <!-- Zone principale avec portillon et RFID côte à côte -->
                <div class="portillon-main-area">
                    <!-- Portillon -->
                    <div class="portillon-section">
                        <div class="portillon-wrapper">
                            <!-- Arrière-plan (fixe) -->
                            <svg class="portillon-background" viewBox="0 0 752.47 542.12">
                                <defs>
                                    <style>
                                        .port-bg { fill: #8c8c8c; }
                                        .port-axis { fill: #3a3a3a; }
                                    </style>
                                </defs>
                                <path class="port-bg" d="M199.78,37.47v430.73c0,1.81,7.47,7.8,9.29,7.8h240.45v-11.52l1.11-1.11h30.1v-29.36l-31.22-31.22v-79.16h30.1l1.11-1.11v-26.01l-31.22-31.22v-86.22l1.11-1.11h30.1v-26.39l-30.09-30.12c-.13-4.3-.98-8.69-1.16-12.96s-.65-14.15.04-17.87c.15-.83.38-1.39,1.11-1.86h260.15l1.11,1.11v417.73l-1.11,1.11H40.72V38.58l1.11-1.11h157.95Z"/>
                                <rect class="port-axis" x="458.35" y="88.76" width="9.88" height="410.18"/>
                            </svg>
                            
                            <!-- Porte (animée en 3D) -->
                            <div class="portillon-door-container">
                                <svg class="portillon-door" viewBox="0 0 752.47 542.12">
                                    <defs>
                                        <style>
                                            .port-door { fill: #fab511; }
                                        </style>
                                    </defs>
                                    <path class="port-door" d="M449.81,150.53h30.44v26.36l-1.11,1.11h-29.33v118.05l30.44.74v25.61l-1.11,1.11h-29.33v109.88l30.44.74v28.96h-30.44l-.7,7.84-402.86.36-5.54-.78V117.86h407.98l1.11,1.11v31.55ZM214.45,377.72h22.64l1.11-1.11v-225.71l-1.11-1.11h-22.27c-1.69,1.03-.37,1.6-.37,1.86v226.08ZM283.5,149.79h-22.64l-1.11,1.11v77.96l1.11,1.11h22.64v-80.19ZM329.53,149.79h-22.64l-1.11,1.11v79.07h23.76v-80.19ZM375.56,229.97v-79.07l-1.11-1.11h-21.53l-1.11,1.11v79.07h23.76ZM421.59,377.72v-226.82l-1.11-1.11h-21.53c-.25,0-1.13.98-1.86.74v226.08l1.11,1.11h23.39ZM283.5,283.43h-23.76v93.18l1.11,1.11h22.64v-94.29ZM329.53,283.43h-23.76v94.29h23.76v-94.29ZM375.56,283.43h-23.76v94.29h23.76v-94.29Z"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Module RFID + Badge -->
                    <div class="rfid-section">
                        <div class="rfid-module-wrapper">
                            <!-- Module RFID -->
                            <div class="rfid-module">
                                <img src="images/ModuleRFID.svg" alt="Module RFID" class="rfid-module-img">
                                <!-- Zone de détection (invisible mais interactive) -->
                                <div class="rfid-detection-zone"></div>
                            </div>
                            
                            <!-- Badge RFID (draggable) -->
                            <div class="rfid-badge-container">
                                <div class="badge-halo"></div>
                                <img src="images/Badge.svg" alt="Badge RFID" class="rfid-badge">
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Zone de contrôle -->
                <div class="portillon-controls">
                    <div class="rfid-status">
                        <span class="status-dot"></span>
                        <span class="status-text">RFID non initialisé</span>
                    </div>
                    <div class="rfid-inputs">
                        <div class="rfid-input-group">
                            <label for="rfid-badge-id">ID Badge :</label>
                            <input type="text" id="rfid-badge-id" value="12345678" maxlength="16" pattern="[0-9]*" inputmode="numeric">
                        </div>
                        <div class="rfid-input-group">
                            <label for="rfid-badge-data">Data :</label>
                            <input type="text" id="rfid-badge-data" value="Badge 1" maxlength="32">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Configure le drag & drop du badge
     */
    function setupBadgeDrag() {
        const badge = elements.badge;
        if (!badge) return;

        const container = badge.closest('.rfid-badge-container');
        
        // Stocker la position initiale après le rendu
        setTimeout(() => {
            badgeInitialPos.x = container.offsetLeft;
            badgeInitialPos.y = container.offsetTop;
        }, 200);

        // Mouse events
        badge.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);

        // Touch events
        badge.addEventListener('touchstart', startDrag, { passive: false });
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', endDrag);
    }

    function startDrag(e) {
        e.preventDefault();
        isDragging = true;

        const badge = elements.badge;
        const container = badge.closest('.rfid-badge-container');
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const rect = container.getBoundingClientRect();
        badgeDragOffset.x = clientX - rect.left;
        badgeDragOffset.y = clientY - rect.top;

        // Convertir la position CSS en position absolue pour le drag
        const parent = container.parentElement;
        const parentRect = parent.getBoundingClientRect();
        container.style.position = 'absolute';
        container.style.left = (rect.left - parentRect.left) + 'px';
        container.style.top = (rect.top - parentRect.top) + 'px';
        container.style.transform = 'none';

        container.style.zIndex = '100';
        container.style.cursor = 'grabbing';
        badge.style.cursor = 'grabbing';
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();

        const badge = elements.badge;
        const container = badge.closest('.rfid-badge-container');
        const parent = container.parentElement;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const parentRect = parent.getBoundingClientRect();
        
        let newX = clientX - parentRect.left - badgeDragOffset.x;
        let newY = clientY - parentRect.top - badgeDragOffset.y;

        container.style.left = newX + 'px';
        container.style.top = newY + 'px';

        // Vérifier si le badge est sur la zone de détection
        checkBadgeOnReader();
    }

    function endDrag(e) {
        if (!isDragging) return;
        isDragging = false;

        const badge = elements.badge;
        const container = badge.closest('.rfid-badge-container');

        container.style.cursor = 'grab';
        badge.style.cursor = 'grab';
        container.style.zIndex = '';

        // Animation de retour à la position initiale (position relative dans le flex)
        container.style.transition = 'left 0.3s ease, top 0.3s ease, transform 0.3s ease';
        container.style.position = '';
        container.style.left = '';
        container.style.top = '';
        container.style.transform = '';

        setTimeout(() => {
            container.style.transition = '';
            checkBadgeOnReader();
        }, 300);
    }

    /**
     * Vérifie si le badge est sur la zone de détection du module RFID
     */
    function checkBadgeOnReader() {
        const badge = elements.badge;
        const detectionZone = elements.rfidDetectionZone;
        const halo = elements.badgeHalo;

        if (!badge || !detectionZone) return;

        const badgeRect = badge.getBoundingClientRect();
        const zoneRect = detectionZone.getBoundingClientRect();

        // Centre du badge
        const badgeCenterX = badgeRect.left + badgeRect.width / 2;
        const badgeCenterY = badgeRect.top + badgeRect.height / 2;

        // Centre de la zone de détection
        const zoneCenterX = zoneRect.left + zoneRect.width / 2;
        const zoneCenterY = zoneRect.top + zoneRect.height / 2;

        // Distance entre les centres
        const distance = Math.sqrt(
            Math.pow(badgeCenterX - zoneCenterX, 2) +
            Math.pow(badgeCenterY - zoneCenterY, 2)
        );

        // Le badge est détecté si assez proche
        const isOnReader = distance < zoneRect.width / 2 + 20;

        if (isOnReader !== portillonState.badgeOnReader) {
            portillonState.badgeOnReader = isOnReader;
            updateBadgeHalo();
            console.log(`🏷️ Badge ${isOnReader ? 'détecté' : 'retiré'} du lecteur`);
        }
    }

    /**
     * Met à jour le halo autour du badge
     */
    function updateBadgeHalo() {
        const halo = elements.badgeHalo;
        if (!halo) return;

        if (portillonState.badgeOnReader && portillonState.rfidInitialized) {
            halo.classList.add('active');
        } else {
            halo.classList.remove('active');
        }
    }

    /**
     * Configure les événements des inputs
     */
    function setupInputEvents() {
        if (elements.idInput) {
            // N'autoriser que les chiffres dans l'ID
            elements.idInput.addEventListener('input', (e) => {
                // Supprimer tout ce qui n'est pas un chiffre
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
                portillonState.badgeId = e.target.value;
            });
        }
        if (elements.dataInput) {
            elements.dataInput.addEventListener('input', (e) => {
                portillonState.badgeData = e.target.value;
            });
        }
    }

    /**
     * Met à jour l'indicateur de statut RFID
     */
    function updateRfidStatus() {
        const status = elements.statusIndicator;
        if (!status) return;

        const dot = status.querySelector('.status-dot');
        const text = status.querySelector('.status-text');

        if (portillonState.rfidInitialized) {
            dot.classList.add('active');
            text.textContent = 'RFID initialisé';
        } else {
            dot.classList.remove('active');
            text.textContent = 'RFID non initialisé';
        }

        updateBadgeHalo();
    }

    /**
     * Met à jour l'angle de la porte avec animation
     */
    function updateDoorAngle(angle, immediate = false) {
        portillonState.targetDoorAngle = Math.max(90, Math.min(180, angle));

        if (immediate) {
            portillonState.doorAngle = portillonState.targetDoorAngle;
            applyDoorTransform();
        } else {
            animateDoor();
        }
    }

    /**
     * Anime la porte vers l'angle cible
     */
    function animateDoor() {
        if (portillonState.animationFrame) {
            cancelAnimationFrame(portillonState.animationFrame);
        }

        const animate = () => {
            const diff = portillonState.targetDoorAngle - portillonState.doorAngle;
            
            if (Math.abs(diff) < 0.5) {
                portillonState.doorAngle = portillonState.targetDoorAngle;
                applyDoorTransform();
                portillonState.animationFrame = null;
                return;
            }

            // Easing
            portillonState.doorAngle += diff * 0.1;
            applyDoorTransform();

            portillonState.animationFrame = requestAnimationFrame(animate);
        };

        animate();
    }

    /**
     * Applique la transformation 3D à la porte
     */
    function applyDoorTransform() {
        const door = elements.door;
        if (!door) return;

        // L'angle va de 90° (fermé) à 180° (ouvert)
        // On limite la rotation max à 85° pour que la porte reste visible
        const maxRotation = 85;
        const rotationY = Math.min((portillonState.doorAngle - 90), maxRotation);

        door.style.transform = `rotateY(${rotationY}deg)`;
    }

    // =========================================================================
    // API PUBLIQUE - Fonctions appelées par les blocs
    // =========================================================================

    /**
     * Initialise le module RFID
     */
    function rfidInit() {
        portillonState.rfidInitialized = true;
        updateRfidStatus();
        console.log('🏷️ RFID: Module initialisé');
    }

    /**
     * Lit l'ID du badge (si présent sur le lecteur)
     */
    function rfidGetId() {
        if (!portillonState.rfidInitialized) {
            console.warn('🏷️ RFID: Module non initialisé !');
            return '';
        }
        if (portillonState.badgeOnReader) {
            console.log(`🏷️ RFID: ID lu = ${portillonState.badgeId}`);
            return portillonState.badgeId;
        }
        return '';
    }

    /**
     * Lit les données du badge (si présent sur le lecteur)
     */
    function rfidRead() {
        if (!portillonState.rfidInitialized) {
            console.warn('🏷️ RFID: Module non initialisé !');
            return '';
        }
        if (portillonState.badgeOnReader) {
            console.log(`🏷️ RFID: Data lue = ${portillonState.badgeData}`);
            return portillonState.badgeData;
        }
        return '';
    }

    /**
     * Écrit des données sur le badge (si présent sur le lecteur)
     */
    function rfidWrite(data) {
        if (!portillonState.rfidInitialized) {
            console.warn('🏷️ RFID: Module non initialisé !');
            return;
        }
        if (portillonState.badgeOnReader) {
            portillonState.badgeData = data;
            if (elements.dataInput) {
                elements.dataInput.value = data;
            }
            console.log(`🏷️ RFID: Data écrite = ${data}`);
        } else {
            console.warn('🏷️ RFID: Aucun badge sur le lecteur');
        }
    }

    /**
     * Éteint l'antenne RFID
     */
    function rfidAntennaOff() {
        // Pour la simulation, on désactive juste l'état initialisé
        portillonState.rfidInitialized = false;
        updateRfidStatus();
        console.log('🏷️ RFID: Antenne éteinte');
    }

    /**
     * Définit l'angle du servo de la porte (P2)
     */
    function setDoorServoAngle(angle) {
        updateDoorAngle(angle);
    }

    /**
     * Réinitialise le simulateur
     */
    function reset() {
        portillonState.doorAngle = 90;
        portillonState.targetDoorAngle = 90;
        portillonState.rfidInitialized = false;
        portillonState.badgeOnReader = false;
        
        updateDoorAngle(90, true);
        updateRfidStatus();
    }

    // =========================================================================
    // EXPORT
    // =========================================================================

    window.portillonSimulator = {
        init: initPortillonSimulator,
        reset: reset,
        rfidInit: rfidInit,
        rfidGetId: rfidGetId,
        rfidRead: rfidRead,
        rfidWrite: rfidWrite,
        rfidAntennaOff: rfidAntennaOff,
        setDoorServoAngle: setDoorServoAngle,
        getState: () => portillonState
    };

})();
