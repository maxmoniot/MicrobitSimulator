/**
 * Cutebot Simulator - Simulateur visuel du robot Cutebot
 * Grille : 1 carreau = 3cm (~13.3px pour 40px grid)
 */

class CutebotSimulator {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('❌ Canvas not found:', canvasId);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        
        // Échelle : 40px = 3cm, donc 1cm ≈ 13.3px
        this.pixelsPerCm = 13.33;
        this.gridSize = 40; // 3cm par carreau
        
        // Zoom et pan
        // zoom = 1.0 affiché correspond à 0.5 réel
        // zoom max = 2.0 affiché correspond à 1.0 réel
        this.zoom = 1.0;
        this.minZoom = 0.5;
        this.maxZoom = 2.0;
        this.panOffset = { x: 0, y: 0 };
        this.isPanning = false;
        this.lastPanPoint = null;
        this.baseZoom = 0.5; // Le zoom réel de base
        
        // État du robot - centré dans le canvas
        this.robot = {
            x: 1000, y: 1000, angle: -90,
            width: 55,
            height: 65,
            leftSpeed: 0, rightSpeed: 0,
            leftLed: { r: 0, g: 0, b: 0 },
            rightLed: { r: 0, g: 0, b: 0 },
            servo1: 10, servo2: 10,
            servo1Target: 10, // Cible pour l'animation du servo
            leftSensor: false, rightSensor: false,
            gripperEnabled: false
        };
        
        // Paramètres de réglage de la pince (valeurs finales)
        this.gripperSettings = {
            positionY: -29,
            armLength: 59,
            baseWidth: 50,
            leftAngle10: 143,   // Angle du bras gauche quand servo=10° (ouvert)
            rightAngle10: -143,  // Angle du bras droit quand servo=10° (ouvert)
            leftAngle80: 180,   // Angle du bras gauche quand servo=80° (fermé) - était -180
            rightAngle80: -180  // Angle du bras droit quand servo=80° (fermé)
        };
        
        // Système de pince et capture d'obstacles
        this.servoSpeed = 120; // Vitesse du servo en degrés/seconde
        this.grabbedObstacle = null; // L'obstacle actuellement attrapé
        this.grippingTarget = null; // L'obstacle en cours d'attraction (pas encore attrapé)
        this.grabOffset = { x: 0, y: 0 }; // Offset de l'obstacle par rapport au robot
        this.recentlyReleasedObstacle = null; // Obstacle récemment relâché (protection temporaire)
        this.releaseGraceTime = 0; // Temps restant de la période de grâce
        
        // Position de référence du robot (où il doit revenir lors des rafraîchissements)
        this.homePosition = { x: 1000, y: 1000, angle: -90 };
        
        // Obstacles (pour le capteur ultrason)
        this.obstacles = [];
        this.selectedObstacle = null;
        this.draggingObstacle = false;
        
        // Collisions
        this.collisionPoints = []; // Points où il y a eu collision (pour afficher les icônes)
        this.collisionMargin = 0; // Pas de marge - collision au contact exact
        this.debugCollisionPoints = false; // Afficher les points de collision pour debug
        
        // Canvas pour la piste (très grand pour ne jamais voir les bords)
        this.trackCanvas = document.createElement('canvas');
        this.trackCtx = this.trackCanvas.getContext('2d', { willReadFrequently: true });
        this.trackCanvas.width = 2000;
        this.trackCanvas.height = 2000;
        this.trackCanvasDirty = true; // Flag pour ne redessiner le trackCanvas que quand nécessaire
        this.clearTrack();
        
        // Cache du panneau pour éviter querySelector dans la boucle d'animation
        this._panelElement = null;
        
        // État
        this.irButton = null;
        this.irLastCode = 0; // Dernière valeur IR reçue (persiste)
        this.irCallback = null;
        this.trackEvents = {
            Left: { FindLine: null, LoseLine: null },
            Right: { FindLine: null, LoseLine: null }
        };
        this.drawMode = 'line';
        this.lineWidth = 23; // Taille du pinceau par défaut
        this.isDrawing = false;
        this.isCurrentlyDrawing = false;
        this.drawBuffer = null;
        this.allDrawnLines = []; // Stocker toutes les lignes dessinées
        this.isRunning = false;
        this.animationId = null;
        
        // Paramètres de calibration
        this.sensorCheckInterval = 166.67; // Intervalle de vérification des capteurs en ms (6 Hz - calibré)
        this.lastSensorCheck = 0;
        
        // Initialiser
        this.resizeCanvas();
        this.initEvents();
        this.initZoomControls();
        this.setupResizeObserver();
        this.startRenderLoop();
    }
    
    setupResizeObserver() {
        // Observer pour détecter les changements de taille du wrapper
        // (par exemple quand on redimensionne les zones avec les barres)
        const wrapper = this.canvas.parentElement;
        if (!wrapper) return;
        
        let resizeTimeout = null;
        
        const resizeObserver = new ResizeObserver(entries => {
            // Debounce : attendre que le redimensionnement soit terminé
            if (resizeTimeout) {
                clearTimeout(resizeTimeout);
            }
            
            resizeTimeout = setTimeout(() => {
                for (let entry of entries) {
                    // Éviter les appels inutiles si la taille n'a pas vraiment changé
                    const newWidth = Math.floor(entry.contentRect.width);
                    const newHeight = Math.floor(entry.contentRect.height);
                    
                    if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
                        this.resizeCanvas();
                    }
                }
            }, 100); // 100ms : assez rapide mais sans lag
        });
        
        resizeObserver.observe(wrapper);
    }
    
    resizeCanvas() {
        const wrapper = this.canvas.parentElement;
        if (!wrapper) {
            return;
        }
        
        // Attendre que le wrapper ait des dimensions valides
        const wrapperWidth = wrapper.clientWidth;
        const wrapperHeight = wrapper.clientHeight;
        
        if (wrapperWidth === 0 || wrapperHeight === 0) {
            return;
        }
        
        // Définir les dimensions internes du canvas
        this.canvas.width = wrapperWidth;
        this.canvas.height = wrapperHeight;
        
        // Définir les MÊMES dimensions en CSS pour éviter l'étirement
        this.canvas.style.width = wrapperWidth + 'px';
        this.canvas.style.height = wrapperHeight + 'px';
        
        // Centrer la vue sur le robot après le resize
        this.centerView();
    }
    
    centerView() {
        // Centrer la vue sur le robot
        const realZoom = this.zoom * this.baseZoom;
        this.panOffset.x = this.canvas.width / 2 - this.robot.x * realZoom;
        this.panOffset.y = this.canvas.height / 2 - this.robot.y * realZoom;
    }
    
    getRealZoom() {
        return this.zoom * this.baseZoom;
    }
    
    clearTrack() {
        // Vider toutes les lignes stockées
        this.allDrawnLines = [];
        this.trackCanvasDirty = true;
        // Les lignes seront automatiquement absentes du prochain render()
        
        // Effacer aussi les points de collision
        this.clearCollisionPoints();
    }
    
    initZoomControls() {
        const wrapper = this.canvas.parentElement;
        if (!wrapper) return;
        
        const old = wrapper.querySelector('.sim-zoom-controls');
        if (old) old.remove();
        
        const controls = document.createElement('div');
        controls.className = 'sim-zoom-controls';
        controls.innerHTML = `
            <button class="btn" id="zoomOut" title="Dézoomer">−</button>
            <span class="zoom-level" id="zoomLevel">100%</span>
            <button class="btn" id="zoomIn" title="Zoomer">+</button>
            <button class="btn" id="zoomReset" title="Recentrer">⌖</button>
        `;
        wrapper.appendChild(controls);
        
        document.getElementById('zoomIn').onclick = () => this.setZoom(this.zoom + 0.1);
        document.getElementById('zoomOut').onclick = () => this.setZoom(this.zoom - 0.1);
        document.getElementById('zoomReset').onclick = () => {
            this.zoom = 1.0;
            this.centerView();
            document.getElementById('zoomLevel').textContent = '100%';
        };
        
        // Zoom avec molette centré sur la souris
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.setZoom(this.zoom + delta, e.offsetX, e.offsetY);
        }, { passive: false });
    }
    
    setZoom(newZoom, centerX = null, centerY = null) {
        const oldRealZoom = this.getRealZoom();
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
        const newRealZoom = this.getRealZoom();
        
        // Point de centre (écran)
        if (centerX === null) centerX = this.canvas.width / 2;
        if (centerY === null) centerY = this.canvas.height / 2;
        
        // Ajuster le pan pour garder le point central fixe
        // Avant: worldX = (centerX - panOffset.x) / oldRealZoom
        // Après: worldX = (centerX - newPanOffset.x) / newRealZoom
        // Donc: newPanOffset.x = centerX - worldX * newRealZoom
        const worldX = (centerX - this.panOffset.x) / oldRealZoom;
        const worldY = (centerY - this.panOffset.y) / oldRealZoom;
        this.panOffset.x = centerX - worldX * newRealZoom;
        this.panOffset.y = centerY - worldY * newRealZoom;
        
        const el = document.getElementById('zoomLevel');
        if (el) el.textContent = Math.round(this.zoom * 100) + '%';
    }
    
    initEvents() {
        let isDraggingRobot = false;
        let isRotatingRobot = false;
        let dragOffset = { x: 0, y: 0 };
        
        const getPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const realZoom = this.getRealZoom();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            // Convertir pixels écran en coordonnées monde
            return { 
                x: (screenX - this.panOffset.x) / realZoom, 
                y: (screenY - this.panOffset.y) / realZoom,
                screenX,
                screenY
            };
        };
        
        // Menu contextuel et pan avec clic droit
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // Le contextmenu se déclenche au relâchement du clic droit
            // On gère la suppression d'obstacle ici seulement si on n'était pas en train de panner
            if (this.isPanning) {
                return; // On était en train de déplacer la vue, ne rien faire
            }
            
            const pos = getPos(e);
            
            // Vérifier si on a cliqué sur un obstacle (rectangle)
            const clickedObstacle = this.obstacles.find(obs => {
                const halfW = obs.width / 2;
                const halfH = obs.height / 2;
                const inX = pos.x >= obs.x - halfW && pos.x <= obs.x + halfW;
                const inY = pos.y >= obs.y - halfH && pos.y <= obs.y + halfH;
                return inX && inY;
            });
            
            if (clickedObstacle) {
                // Supprimer l'obstacle
                const index = this.obstacles.indexOf(clickedObstacle);
                if (index > -1) {
                    this.obstacles.splice(index, 1);
                    if (this.selectedObstacle === clickedObstacle) {
                        this.selectedObstacle = null;
                    }
                }
            }
        });
        
        this.canvas.addEventListener('mousedown', (e) => {
            const pos = getPos(e);
            
            // Clic droit = pan (déplacement de la vue)
            if (e.button === 2) {
                this.isPanning = true;
                this.lastPanPoint = { x: pos.screenX, y: pos.screenY };
                this.canvas.style.cursor = 'grabbing';
                return;
            }
            
            // Clic gauche uniquement pour les autres interactions
            if (e.button !== 0) return;
            
            // Vérifier si on clique sur un obstacle
            const obstacle = this.getObstacleAt(pos.x, pos.y);
            if (obstacle) {
                this.selectedObstacle = obstacle;
                this.draggingObstacle = true;
                dragOffset = { x: pos.x - obstacle.x, y: pos.y - obstacle.y };
                return;
            }
            
            // Vérifier si on clique sur le robot
            if (this.isPointInRobot(pos.x, pos.y)) {
                // Effacer les collisions quand on commence à déplacer le robot
                this.clearCollisionPoints();
                
                if (e.shiftKey) {
                    isRotatingRobot = true;
                } else {
                    isDraggingRobot = true;
                    dragOffset = { x: pos.x - this.robot.x, y: pos.y - this.robot.y };
                }
                return;
            }
            
            // Sinon, dessiner
            this.isDrawing = true;
            this.drawOnTrack(pos.x, pos.y, true);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            const pos = getPos(e);
            
            // Pan avec clic droit
            if (this.isPanning && this.lastPanPoint) {
                this.panOffset.x += pos.screenX - this.lastPanPoint.x;
                this.panOffset.y += pos.screenY - this.lastPanPoint.y;
                this.lastPanPoint = { x: pos.screenX, y: pos.screenY };
                return;
            }
            
            if (this.draggingObstacle && this.selectedObstacle) {
                this.selectedObstacle.x = pos.x - dragOffset.x;
                this.selectedObstacle.y = pos.y - dragOffset.y;
            } else if (isDraggingRobot) {
                this.robot.x = pos.x - dragOffset.x;
                this.robot.y = pos.y - dragOffset.y;
            } else if (isRotatingRobot) {
                this.robot.angle = Math.atan2(pos.y - this.robot.y, pos.x - this.robot.x) * 180 / Math.PI;
            } else if (this.isDrawing) {
                this.drawOnTrack(pos.x, pos.y, false);
            }
        });
        
        const stopAll = () => { 
            if (this.isDrawing && this.isCurrentlyDrawing) {
                this.finishDrawing();
            }
            
            // Si l'utilisateur vient de déplacer ou pivoter le robot, sauvegarder sa nouvelle position de référence
            if (isDraggingRobot || isRotatingRobot) {
                this.homePosition.x = this.robot.x;
                this.homePosition.y = this.robot.y;
                this.homePosition.angle = this.robot.angle;
            }
            
            isDraggingRobot = isRotatingRobot = this.isDrawing = this.draggingObstacle = false;
            this.isPanning = false;
            this.lastPanPoint = null;
            this.drawBuffer = null;
            this.canvas.style.cursor = 'default';
        };
        this.canvas.addEventListener('mouseup', stopAll);
        this.canvas.addEventListener('mouseleave', stopAll);
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    isPointInRobot(x, y) {
        const dx = x - this.robot.x, dy = y - this.robot.y;
        const a = (-this.robot.angle + 90) * Math.PI / 180;
        const rx = dx * Math.cos(a) - dy * Math.sin(a);
        const ry = dx * Math.sin(a) + dy * Math.cos(a);
        return Math.abs(rx) < this.robot.width / 2 + 10 && Math.abs(ry) < this.robot.height / 2 + 10;
    }
    
    // ===== OBSTACLES =====
    
    addObstacle(x, y, width = 60, height = 60) {
        const obstacle = { 
            id: Date.now(), 
            x: x || this.robot.x + 150, 
            y: y || this.robot.y - 100, 
            width, 
            height 
        };
        this.obstacles.push(obstacle);
        return obstacle;
    }
    
    removeObstacle(obstacle) {
        const idx = this.obstacles.indexOf(obstacle);
        if (idx >= 0) this.obstacles.splice(idx, 1);
        if (this.selectedObstacle === obstacle) this.selectedObstacle = null;
    }
    
    removeSelectedObstacle() {
        if (this.selectedObstacle) {
            this.removeObstacle(this.selectedObstacle);
        }
    }
    
    clearObstacles() {
        this.obstacles = [];
        this.selectedObstacle = null;
    }
    
    getObstacleAt(x, y) {
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const o = this.obstacles[i];
            if (x >= o.x - o.width/2 && x <= o.x + o.width/2 &&
                y >= o.y - o.height/2 && y <= o.y + o.height/2) {
                return o;
            }
        }
        return null;
    }
    
    // ===== DESSIN =====
    
    drawOnTrack(x, y, isStart) {
        const isLine = this.drawMode === 'line';
        
        if (isStart) {
            // Initialiser le buffer de points
            this.drawBuffer = [{ x, y }];
            this.isCurrentlyDrawing = true;
            this.trackCanvasDirty = true;
        } else if (this.drawBuffer && this.isCurrentlyDrawing) {
            // Accumuler les points
            const lastPoint = this.drawBuffer[this.drawBuffer.length - 1];
            const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
            
            // N'ajouter que si le point est suffisamment éloigné (évite les doublons)
            if (distance > 2) {
                this.drawBuffer.push({ x, y });
                this.trackCanvasDirty = true;
            }
        }
        
        // La ligne en cours sera automatiquement dessinée dans le prochain render()
    }
    
    finishDrawing() {
        if (!this.drawBuffer || this.drawBuffer.length < 2) {
            this.isCurrentlyDrawing = false;
            return;
        }
        
        // Lisser et stocker la ligne
        const smoothed = this.smoothPoints(this.drawBuffer, 3);
        this.allDrawnLines.push({
            points: smoothed,
            isLine: this.drawMode === 'line',
            width: this.drawMode === 'line' ? this.lineWidth : this.lineWidth * 2
        });
        
        this.isCurrentlyDrawing = false;
        this.drawBuffer = null;
        this.trackCanvasDirty = true;
        // La ligne sera automatiquement dessinée dans le prochain render()
    }
    
    redrawAllLines() {
        // Cette méthode n'est plus nécessaire car les lignes sont dessinées
        // directement dans le render() de manière procédurale
        // On la garde vide pour éviter les erreurs si elle est appelée ailleurs
    }
    
    
    smoothPoints(points, passes = 3) {
        if (points.length < 3) return points;
        
        // Appliquer un filtre de lissage par moyenne mobile
        let smoothed = [...points];
        
        for (let pass = 0; pass < passes; pass++) {
            const result = [smoothed[0]]; // Garder le premier point
            
            for (let i = 1; i < smoothed.length - 1; i++) {
                // Moyenne pondérée avec les points voisins
                const prev = smoothed[i - 1];
                const curr = smoothed[i];
                const next = smoothed[i + 1];
                
                result.push({
                    x: prev.x * 0.25 + curr.x * 0.5 + next.x * 0.25,
                    y: prev.y * 0.25 + curr.y * 0.5 + next.y * 0.25
                });
            }
            
            result.push(smoothed[smoothed.length - 1]); // Garder le dernier point
            smoothed = result;
        }
        
        return smoothed;
    }
    
    // ===== CAPTEURS =====
    
    checkPixel(x, y) {
        // Optimisation : lire une zone en un seul appel getImageData au lieu de 80+ appels
        const checkRadius = 8;
        const size = checkRadius * 2 + 1;
        const px = Math.round(x - checkRadius);
        const py = Math.round(y - checkRadius);
        
        // Vérifier les limites
        if (px < 0 || py < 0 || px + size > this.trackCanvas.width || py + size > this.trackCanvas.height) {
            return false;
        }
        
        try {
            // UN SEUL appel getImageData pour toute la zone
            const imageData = this.trackCtx.getImageData(px, py, size, size);
            const data = imageData.data;
            
            let blackPixels = 0;
            let totalPixels = 0;
            
            // Parcourir les pixels (pas de 2 pour échantillonnage)
            for (let dy = 0; dy < size; dy += 2) {
                for (let dx = 0; dx < size; dx += 2) {
                    const idx = (dy * size + dx) * 4;
                    totalPixels++;
                    // Vérifier si le pixel est noir
                    if (data[idx] < 60 && data[idx + 1] < 60 && data[idx + 2] < 60) {
                        blackPixels++;
                    }
                }
            }
            
            return totalPixels > 0 && (blackPixels / totalPixels) > 0.12;
        } catch(e) {
            return false;
        }
    }
    
    getUltrasonicDistance() {
        // Direction vers l'avant du robot
        const moveAngle = this.robot.angle * Math.PI / 180;
        const startX = this.robot.x + Math.cos(moveAngle) * (this.robot.height / 2 + 10);
        const startY = this.robot.y + Math.sin(moveAngle) * (this.robot.height / 2 + 10);
        
        // Rayon de détection (max 400cm = 5333px, mais on limite à la taille du canvas)
        const maxDist = 400 * this.pixelsPerCm;
        
        for (let d = 0; d < maxDist; d += 5) {
            const checkX = startX + Math.cos(moveAngle) * d;
            const checkY = startY + Math.sin(moveAngle) * d;
            
            // Vérifier les bords du canvas
            if (checkX < 0 || checkX > this.trackCanvas.width ||
                checkY < 0 || checkY > this.trackCanvas.height) {
                return Math.round(d / this.pixelsPerCm);
            }
            
            // Vérifier les obstacles
            for (const obs of this.obstacles) {
                if (checkX >= obs.x - obs.width/2 && checkX <= obs.x + obs.width/2 &&
                    checkY >= obs.y - obs.height/2 && checkY <= obs.y + obs.height/2) {
                    return Math.round(d / this.pixelsPerCm);
                }
            }
        }
        
        return Math.round(maxDist / this.pixelsPerCm);
    }
    
    // ===== MISE À JOUR =====
    
    update(dt) {
        if (!this.isRunning) return;
        
        // ============================================
        // PARAMÈTRE DE VITESSE
        const BASE_SPEED = 798;
        const SPEED_MULTIPLIER = 0.7;
        const SPEED_PX_PER_SEC = BASE_SPEED * SPEED_MULTIPLIER;
        // ============================================
        
        const leftV = this.robot.leftSpeed / 100;
        const rightV = this.robot.rightSpeed / 100;
        const dtSec = dt / 1000;
        
        // Calculer le mouvement souhaité
        // wheelBase calibré pour correspondre au comportement réel du Cutebot :
        // - 50% pendant 1s ≈ 426° (1 tour + 66°)
        // - 100% pendant 1s ≈ 900° (2.5 tours)
        const wheelBase = 75;
        const angularSpeed = (leftV - rightV) * SPEED_PX_PER_SEC / wheelBase;
        const deltaAngle = angularSpeed * dtSec * (180 / Math.PI);
        
        const linearSpeed = (leftV + rightV) / 2 * SPEED_PX_PER_SEC;
        const moveAngle = (this.robot.angle + deltaAngle) * Math.PI / 180;
        const deltaX = Math.cos(moveAngle) * linearSpeed * dtSec;
        const deltaY = Math.sin(moveAngle) * linearSpeed * dtSec;
        
        // Position cible
        const targetX = this.robot.x + deltaX;
        const targetY = this.robot.y + deltaY;
        const targetAngle = this.robot.angle + deltaAngle;
        
        // Vérifier si la cible causerait une collision
        if (this.wouldCollideAt(targetX, targetY, targetAngle)) {
            // Collision détectée - recherche binaire pour trouver le point exact
            let minT = 0;  // Pas de collision
            let maxT = 1;  // Collision
            
            // 12 itérations = précision de 1/4096
            for (let i = 0; i < 12; i++) {
                const mid = (minT + maxT) / 2;
                const testX = this.robot.x + deltaX * mid;
                const testY = this.robot.y + deltaY * mid;
                const testAngle = this.robot.angle + deltaAngle * mid;
                
                if (this.wouldCollideAt(testX, testY, testAngle)) {
                    maxT = mid;  // Collision, chercher avant
                } else {
                    minT = mid;  // Pas de collision, peut aller plus loin
                }
            }
            
            // minT = dernier point sans collision
            // maxT = premier point avec collision
            // On va au milieu pour être au contact exact
            const contactT = (minT + maxT) / 2;
            
            // Appliquer le mouvement jusqu'au contact
            this.robot.x += deltaX * contactT;
            this.robot.y += deltaY * contactT;
            this.robot.angle += deltaAngle * contactT;
            
            // Trouver quel point du robot touche l'obstacle
            this.findAndMarkCollisionPoint();
        } else {
            // Pas de collision - mouvement normal
            this.robot.x = targetX;
            this.robot.y = targetY;
            this.robot.angle = targetAngle;
        }
        
        // Capteurs de ligne
        const now = Date.now();
        if (now - this.lastSensorCheck >= this.sensorCheckInterval) {
            this.lastSensorCheck = now;
            
            const oldLeft = this.robot.leftSensor;
            const oldRight = this.robot.rightSensor;
            
            const sensorAngle = this.robot.angle * Math.PI / 180;
            const sensorDist = this.robot.height / 2 + 12;
            const sensorSpacing = 12;
            
            const leftSensorX = this.robot.x + Math.cos(sensorAngle) * sensorDist + Math.sin(sensorAngle) * sensorSpacing;
            const leftSensorY = this.robot.y + Math.sin(sensorAngle) * sensorDist - Math.cos(sensorAngle) * sensorSpacing;
            this.robot.leftSensor = this.checkPixel(leftSensorX, leftSensorY);
            
            const rightSensorX = this.robot.x + Math.cos(sensorAngle) * sensorDist - Math.sin(sensorAngle) * sensorSpacing;
            const rightSensorY = this.robot.y + Math.sin(sensorAngle) * sensorDist + Math.cos(sensorAngle) * sensorSpacing;
            this.robot.rightSensor = this.checkPixel(rightSensorX, rightSensorY);
            
            if (oldLeft !== this.robot.leftSensor) {
                const cb = this.trackEvents.Left[this.robot.leftSensor ? 'FindLine' : 'LoseLine'];
                if (cb) try { cb(); } catch(e) { console.error(e); }
            }
            if (oldRight !== this.robot.rightSensor) {
                const cb = this.trackEvents.Right[this.robot.rightSensor ? 'FindLine' : 'LoseLine'];
                if (cb) try { cb(); } catch(e) { console.error(e); }
            }
        }
    }
    
    // ===== SYSTÈME DE PINCE =====
    
    /**
     * Anime le servo et gère la capture/relâchement d'obstacles
     */
    updateGripperAnimation(dt) {
        const r = this.robot;
        const dtSec = dt / 1000;
        const target = r.servo1Target;
        const current = r.servo1;
        
        // Si le servo est déjà à la cible, rien à faire
        if (Math.abs(current - target) < 0.5) {
            r.servo1 = target;
            // Si on n'a pas attrapé, effacer la cible en cours
            if (!this.grabbedObstacle) {
                this.grippingTarget = null;
            }
            return;
        }
        
        // Direction du mouvement
        const direction = target > current ? 1 : -1;
        const isClosing = direction > 0; // Le servo ferme quand il augmente (10° → 80°)
        
        // Calculer le nouveau angle du servo
        let newServo = current + direction * this.servoSpeed * dtSec;
        
        // Limiter à la cible
        if (direction > 0) {
            newServo = Math.min(newServo, target);
        } else {
            newServo = Math.max(newServo, target);
        }
        
        // Si on ferme la pince, vérifier les contacts avec les obstacles
        if (isClosing && !this.grabbedObstacle) {
            // Chercher un obstacle à attraper
            const contactInfo = this.findGripperContact(newServo);
            
            if (contactInfo.obstacle) {
                // Marquer cet obstacle comme cible en cours (pour ignorer les collisions)
                this.grippingTarget = contactInfo.obstacle;
                
                if (contactInfo.bothSides) {
                    // Les deux pinces touchent l'obstacle → attraper !
                    this.grabObstacle(contactInfo.obstacle);
                    this.grippingTarget = null; // Plus besoin, il est attrapé maintenant
                    // Bloquer le servo à cette position
                    r.servo1 = newServo;
                    r.servo1Target = newServo;
                    return;
                } else {
                    // Un seul côté touche → pousser l'obstacle vers le centre
                    this.pushObstacleToCenter(contactInfo.obstacle, contactInfo.side, newServo);
                }
            } else {
                // Plus de contact, effacer la cible
                this.grippingTarget = null;
            }
        }
        
        // Si on ouvre la pince
        if (!isClosing) {
            this.grippingTarget = null; // Pas de cible quand on ouvre
            
            if (this.grabbedObstacle) {
                // Vérifier si les pinces ne touchent plus l'obstacle
                const contactInfo = this.findGripperContact(newServo);
                if (!contactInfo.bothSides) {
                    this.releaseObstacle();
                }
            }
        }
        
        r.servo1 = newServo;
    }
    
    /**
     * Retourne les points de collision d'un seul bras de la pince
     */
    getGripperArmPoints(side, servoValue = null) {
        const points = [];
        const r = this.robot;
        const h = r.height;
        const robotAngleRad = (r.angle + 90) * Math.PI / 180;
        
        const gripperBaseY = -h/2 + this.gripperSettings.positionY;
        const baseWidth = this.gripperSettings.baseWidth;
        const baseHeight = 12;
        const armLength = this.gripperSettings.armLength;
        const armWidth = 10;
        const tipWidth = armWidth + 8;
        
        // Calculer l'angle du bras demandé
        const servo = servoValue !== null ? servoValue : r.servo1;
        const t = Math.max(0, Math.min(1, (servo - 10) / 70));
        
        let armAngle, baseLocal;
        if (side === 'left') {
            armAngle = this.gripperSettings.leftAngle10 + t * (this.gripperSettings.leftAngle80 - this.gripperSettings.leftAngle10);
            baseLocal = { x: -baseWidth/2 + 4, y: gripperBaseY + baseHeight };
        } else {
            armAngle = this.gripperSettings.rightAngle10 + t * (this.gripperSettings.rightAngle80 - this.gripperSettings.rightAngle10);
            baseLocal = { x: baseWidth/2 - 4, y: gripperBaseY + baseHeight };
        }
        
        const armAngleRad = armAngle * Math.PI / 180;
        
        // Fonction pour transformer un point local en point monde
        const transformToWorld = (localX, localY) => {
            const rotatedX = localX * Math.cos(robotAngleRad) - localY * Math.sin(robotAngleRad);
            const rotatedY = localX * Math.sin(robotAngleRad) + localY * Math.cos(robotAngleRad);
            return { x: r.x + rotatedX, y: r.y + rotatedY };
        };
        
        // Vecteur direction du bras
        const dirX = -Math.sin(armAngleRad);
        const dirY = Math.cos(armAngleRad);
        
        // Vecteur perpendiculaire
        const perpX = Math.cos(armAngleRad);
        const perpY = Math.sin(armAngleRad);
        
        // Points le long du bras
        for (let i = 0; i <= 8; i++) {
            const ratio = i / 8;
            const dist = ratio * armLength;
            const centerX = baseLocal.x + dirX * dist;
            const centerY = baseLocal.y + dirY * dist;
            
            points.push(transformToWorld(centerX, centerY));
            points.push(transformToWorld(centerX - perpX * armWidth/2, centerY - perpY * armWidth/2));
            points.push(transformToWorld(centerX + perpX * armWidth/2, centerY + perpY * armWidth/2));
        }
        
        // Points du bout de la pince
        const tipStartDist = armLength - 15;
        const tipEndDist = armLength + 3;
        for (const tipDist of [tipStartDist, (tipStartDist + tipEndDist) / 2, tipEndDist]) {
            const tipCenterX = baseLocal.x + dirX * tipDist;
            const tipCenterY = baseLocal.y + dirY * tipDist;
            points.push(transformToWorld(tipCenterX - perpX * tipWidth/2, tipCenterY - perpY * tipWidth/2));
            points.push(transformToWorld(tipCenterX + perpX * tipWidth/2, tipCenterY + perpY * tipWidth/2));
        }
        
        return points;
    }
    
    /**
     * Trouve si les pinces touchent un obstacle et de quel côté
     */
    findGripperContact(servoValue) {
        const result = { obstacle: null, side: null, bothSides: false };
        
        for (const obstacle of this.obstacles) {
            // Ignorer les obstacles déjà attrapés
            if (obstacle === this.grabbedObstacle) continue;
            
            const leftPoints = this.getGripperArmPoints('left', servoValue);
            const rightPoints = this.getGripperArmPoints('right', servoValue);
            
            let leftTouches = false;
            let rightTouches = false;
            
            // Vérifier le bras gauche
            for (const point of leftPoints) {
                if (this.isPointInRectangle(point, obstacle)) {
                    leftTouches = true;
                    break;
                }
            }
            
            // Vérifier le bras droit
            for (const point of rightPoints) {
                if (this.isPointInRectangle(point, obstacle)) {
                    rightTouches = true;
                    break;
                }
            }
            
            if (leftTouches || rightTouches) {
                result.obstacle = obstacle;
                result.bothSides = leftTouches && rightTouches;
                result.side = leftTouches ? 'left' : 'right';
                return result;
            }
        }
        
        return result;
    }
    
    /**
     * Pousse un obstacle vers le centre de la pince
     */
    pushObstacleToCenter(obstacle, touchingSide, servoValue) {
        const r = this.robot;
        const robotAngleRad = (r.angle + 90) * Math.PI / 180;
        
        // Direction vers l'avant du robot (où est la pince)
        const forwardX = -Math.sin(robotAngleRad);
        const forwardY = Math.cos(robotAngleRad);
        
        // Direction latérale
        const lateralX = Math.cos(robotAngleRad);
        const lateralY = Math.sin(robotAngleRad);
        
        // Pousser l'obstacle vers le centre (direction opposée au côté qui touche)
        const pushStrength = 2; // Pixels par frame
        if (touchingSide === 'left') {
            // Le bras gauche touche, pousser vers la droite (vers le centre)
            obstacle.x += lateralX * pushStrength;
            obstacle.y += lateralY * pushStrength;
        } else {
            // Le bras droit touche, pousser vers la gauche (vers le centre)
            obstacle.x -= lateralX * pushStrength;
            obstacle.y -= lateralY * pushStrength;
        }
    }
    
    /**
     * Attrape un obstacle avec la pince
     */
    grabObstacle(obstacle) {
        this.grabbedObstacle = obstacle;
        
        // Calculer l'offset dans le repère du robot
        const r = this.robot;
        const robotAngleRad = (r.angle + 90) * Math.PI / 180;
        
        // Position relative de l'obstacle par rapport au robot
        const dx = obstacle.x - r.x;
        const dy = obstacle.y - r.y;
        
        // Transformer dans le repère local du robot
        this.grabOffset = {
            x: dx * Math.cos(-robotAngleRad) - dy * Math.sin(-robotAngleRad),
            y: dx * Math.sin(-robotAngleRad) + dy * Math.cos(-robotAngleRad)
        };
        
        console.log('🤖 Obstacle attrapé !', obstacle.id);
    }
    
    /**
     * Relâche l'obstacle attrapé
     */
    releaseObstacle() {
        if (this.grabbedObstacle) {
            console.log('🤖 Obstacle relâché !', this.grabbedObstacle.id);
            // Sauvegarder l'obstacle pour la période de grâce
            this.recentlyReleasedObstacle = this.grabbedObstacle;
            this.releaseGraceTime = 500; // 500ms de grâce
            this.grabbedObstacle = null;
            this.grabOffset = { x: 0, y: 0 };
        }
    }
    
    /**
     * Met à jour la position de l'obstacle attrapé pour suivre le robot
     */
    updateGrabbedObstacle() {
        if (!this.grabbedObstacle) return;
        
        const r = this.robot;
        const robotAngleRad = (r.angle + 90) * Math.PI / 180;
        
        // Transformer l'offset local en position monde
        const worldOffsetX = this.grabOffset.x * Math.cos(robotAngleRad) - this.grabOffset.y * Math.sin(robotAngleRad);
        const worldOffsetY = this.grabOffset.x * Math.sin(robotAngleRad) + this.grabOffset.y * Math.cos(robotAngleRad);
        
        this.grabbedObstacle.x = r.x + worldOffsetX;
        this.grabbedObstacle.y = r.y + worldOffsetY;
    }
    
    // ===== SYSTÈME DE COLLISION =====
    
    /**
     * Retourne les points critiques du robot (coins + pinces) dans l'espace monde
     */
    getRobotCollisionPoints() {
        const points = [];
        const r = this.robot;
        const w = r.width;
        const h = r.height;
        const angleRad = (r.angle + 90) * Math.PI / 180; // +90 car le robot est dessiné avec cette rotation
        
        // Les 4 coins du robot
        const corners = [
            { x: -w/2, y: -h/2 },  // Coin avant-gauche
            { x: w/2, y: -h/2 },   // Coin avant-droit
            { x: -w/2, y: h/2 },   // Coin arrière-gauche
            { x: w/2, y: h/2 }     // Coin arrière-droit
        ];
        
        // Transformer les coins dans l'espace monde
        for (const corner of corners) {
            const rotatedX = corner.x * Math.cos(angleRad) - corner.y * Math.sin(angleRad);
            const rotatedY = corner.x * Math.sin(angleRad) + corner.y * Math.cos(angleRad);
            points.push({
                x: r.x + rotatedX,
                y: r.y + rotatedY
            });
        }
        
        // Ajouter des points intermédiaires sur les côtés pour une meilleure précision
        const midFrontLeft = { x: -w/4, y: -h/2 };
        const midFrontRight = { x: w/4, y: -h/2 };
        for (const mid of [midFrontLeft, midFrontRight]) {
            const rotatedX = mid.x * Math.cos(angleRad) - mid.y * Math.sin(angleRad);
            const rotatedY = mid.x * Math.sin(angleRad) + mid.y * Math.cos(angleRad);
            points.push({
                x: r.x + rotatedX,
                y: r.y + rotatedY
            });
        }
        
        // Si la pince est activée, ajouter les bouts des pinces
        if (r.gripperEnabled) {
            const gripperPoints = this.getGripperCollisionPoints();
            points.push(...gripperPoints);
        }
        
        return points;
    }
    
    /**
     * Retourne les points de collision des pinces (pour chaque bras séparément)
     * Chaque bras a ses propres points pour une détection précise
     */
    getGripperCollisionPoints() {
        const points = [];
        const r = this.robot;
        const h = r.height;
        const robotAngleRad = (r.angle + 90) * Math.PI / 180;
        
        const gripperBaseY = -h/2 + this.gripperSettings.positionY;
        const baseWidth = this.gripperSettings.baseWidth;
        const baseHeight = 12;
        const armLength = this.gripperSettings.armLength;
        const armWidth = 10; // Largeur du bras
        const tipWidth = armWidth + 8; // Largeur du bout de pince (18 pixels de large au total)
        const tipLength = 18; // Longueur du bout de pince
        
        // Calculer les angles des pinces
        const servoValue = r.servo1;
        const t = Math.max(0, Math.min(1, (servoValue - 10) / 70));
        const leftAngle = this.gripperSettings.leftAngle10 + t * (this.gripperSettings.leftAngle80 - this.gripperSettings.leftAngle10);
        const rightAngle = this.gripperSettings.rightAngle10 + t * (this.gripperSettings.rightAngle80 - this.gripperSettings.rightAngle10);
        
        // Position des bases des bras dans le repère du robot
        const leftBaseLocal = { 
            x: -baseWidth/2 + 4, 
            y: gripperBaseY + baseHeight 
        };
        const rightBaseLocal = { 
            x: baseWidth/2 - 4, 
            y: gripperBaseY + baseHeight 
        };
        
        // Fonction pour transformer un point local en point monde
        const transformToWorld = (localX, localY) => {
            const rotatedX = localX * Math.cos(robotAngleRad) - localY * Math.sin(robotAngleRad);
            const rotatedY = localX * Math.sin(robotAngleRad) + localY * Math.cos(robotAngleRad);
            return {
                x: r.x + rotatedX,
                y: r.y + rotatedY
            };
        };
        
        // Pour chaque bras, calculer les points de collision précis
        for (const [baseLocal, armAngle] of [[leftBaseLocal, leftAngle], [rightBaseLocal, rightAngle]]) {
            const armAngleRad = armAngle * Math.PI / 180;
            
            // Vecteur direction du bras (dans le repère local du robot)
            // Après ctx.rotate(angle), un point à (0, d) devient (-d*sin(angle), d*cos(angle))
            const dirX = -Math.sin(armAngleRad);
            const dirY = Math.cos(armAngleRad);
            
            // Vecteur perpendiculaire (pour la largeur du bras)
            const perpX = Math.cos(armAngleRad);
            const perpY = Math.sin(armAngleRad);
            
            // Points le long du bras (bord gauche et droit)
            const numPoints = 8; // Plus de points pour une meilleure précision
            for (let i = 0; i <= numPoints; i++) {
                const ratio = i / numPoints;
                const dist = ratio * armLength;
                
                // Point central le long du bras
                const centerX = baseLocal.x + dirX * dist;
                const centerY = baseLocal.y + dirY * dist;
                
                // Ajouter le point central
                points.push(transformToWorld(centerX, centerY));
                
                // Ajouter les bords gauche et droit du bras
                const halfWidth = armWidth / 2;
                points.push(transformToWorld(centerX - perpX * halfWidth, centerY - perpY * halfWidth));
                points.push(transformToWorld(centerX + perpX * halfWidth, centerY + perpY * halfWidth));
            }
            
            // Points du bout de la pince (rectangle plus large au bout)
            const tipStartDist = armLength - 15; // Le bout commence à armLength - 15
            const tipEndDist = armLength + 3; // Et finit à armLength + 3 (hauteur 18)
            const halfTipWidth = tipWidth / 2;
            
            // Coins du bout de la pince
            for (const tipDist of [tipStartDist, (tipStartDist + tipEndDist) / 2, tipEndDist]) {
                const tipCenterX = baseLocal.x + dirX * tipDist;
                const tipCenterY = baseLocal.y + dirY * tipDist;
                
                // Bord gauche et droit du bout
                points.push(transformToWorld(tipCenterX - perpX * halfTipWidth, tipCenterY - perpY * halfTipWidth));
                points.push(transformToWorld(tipCenterX + perpX * halfTipWidth, tipCenterY + perpY * halfTipWidth));
            }
        }
        
        return points;
    }
    
    /**
     * Vérifie si un point est dans un rectangle (avec marge de collision)
     * Note: rect.x et rect.y représentent le CENTRE du rectangle
     */
    isPointInRectangle(point, rect) {
        const margin = this.collisionMargin;
        return point.x >= rect.x - rect.width/2 - margin && 
               point.x <= rect.x + rect.width/2 + margin && 
               point.y >= rect.y - rect.height/2 - margin && 
               point.y <= rect.y + rect.height/2 + margin;
    }
    
    /**
     * Vérifie si le robot entre en collision avec un obstacle à une position donnée
     */
    wouldCollideAt(newX, newY, newAngle) {
        // Sauvegarder la position actuelle
        const oldX = this.robot.x;
        const oldY = this.robot.y;
        const oldAngle = this.robot.angle;
        
        // Temporairement déplacer le robot
        this.robot.x = newX;
        this.robot.y = newY;
        this.robot.angle = newAngle;
        
        // Obtenir les points de collision
        const collisionPoints = this.getRobotCollisionPoints();
        
        // Restaurer la position
        this.robot.x = oldX;
        this.robot.y = oldY;
        this.robot.angle = oldAngle;
        
        // Vérifier si un point est dans un obstacle
        for (const point of collisionPoints) {
            for (const obstacle of this.obstacles) {
                // Ignorer les obstacles gérés par la pince
                if (obstacle === this.grabbedObstacle || 
                    obstacle === this.grippingTarget || 
                    obstacle === this.recentlyReleasedObstacle) continue;
                
                if (this.isPointInRectangle(point, obstacle)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Ajoute un point de collision (pour afficher l'icône de choc)
     */
    addCollisionPoint(x, y) {
        // Vérifier si un point proche existe déjà (éviter les doublons)
        const exists = this.collisionPoints.some(p => 
            Math.abs(p.x - x) < 20 && Math.abs(p.y - y) < 20
        );
        
        if (!exists) {
            this.collisionPoints.push({ 
                x, 
                y, 
                time: Date.now() 
            });
        }
    }
    
    /**
     * Trouve quel point du robot est en collision et place l'icône là
     */
    findAndMarkCollisionPoint() {
        // Obtenir tous les points de collision du robot
        const collisionPoints = this.getRobotCollisionPoints();
        
        // Vérifier chaque point pour trouver celui qui touche un obstacle
        for (const point of collisionPoints) {
            for (const obstacle of this.obstacles) {
                // Ignorer les obstacles gérés par la pince
                if (obstacle === this.grabbedObstacle || 
                    obstacle === this.grippingTarget || 
                    obstacle === this.recentlyReleasedObstacle) continue;
                
                if (this.isPointInRectangle(point, obstacle)) {
                    // Ce point touche un obstacle - placer l'icône ici
                    this.addCollisionPoint(point.x, point.y);
                    return;
                }
            }
        }
    }
    
    /**
     * Efface tous les points de collision
     */
    clearCollisionPoints() {
        this.collisionPoints = [];
    }
    
    // ===== RENDU =====
    
    startRenderLoop() {
        let lastTimestamp = 0;
        
        const loop = (timestamp) => {
            // Utiliser le panel caché (mis à jour une seule fois)
            if (!this._panelElement) {
                this._panelElement = document.querySelector('[data-id="cutebot"]');
            }
            const panel = this._panelElement;
            const isVisible = panel && !panel.classList.contains('collapsed') && panel.style.display !== 'none';
            
            // Calculer dt en ms
            const dt = lastTimestamp ? (timestamp - lastTimestamp) : 16.67;
            lastTimestamp = timestamp;
            
            // Limiter dt à 50ms max (20fps min) pour éviter les gros sauts
            const cappedDt = Math.min(dt, 50);
            
            // Mise à jour de la physique seulement si visible ou si le robot bouge
            const isMoving = this.robot.leftSpeed !== 0 || this.robot.rightSpeed !== 0;
            
            if (isVisible || isMoving) {
                // Mise à jour de la physique (mouvement du robot)
                this.update(cappedDt);
                
                // Mise à jour de la pince (toujours actif, même à l'arrêt)
                if (this.robot.gripperEnabled) {
                    this.updateGripperAnimation(cappedDt);
                }
                
                // Mise à jour de l'obstacle attrapé
                this.updateGrabbedObstacle();
                
                // Mise à jour du temps de grâce après relâchement
                if (this.releaseGraceTime > 0) {
                    this.releaseGraceTime -= cappedDt;
                    if (this.releaseGraceTime <= 0) {
                        this.recentlyReleasedObstacle = null;
                        this.releaseGraceTime = 0;
                    }
                }
            }
            
            // Rendu seulement si visible
            if (isVisible) {
                this.render();
            }
            
            // Continuer la boucle
            this.animationId = requestAnimationFrame(loop);
        };
        
        this.animationId = requestAnimationFrame(loop);
    }
    
    render() {
        // Clear avec couleur de fond sombre (pour voir les limites du canvas en debug)
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const realZoom = this.getRealZoom();
        
        // Apply pan puis zoom
        this.ctx.save();
        this.ctx.translate(this.panOffset.x, this.panOffset.y);
        this.ctx.scale(realZoom, realZoom);
        
        // Dessiner un fond blanc dans la zone visible uniquement
        const viewLeft = -this.panOffset.x / realZoom;
        const viewTop = -this.panOffset.y / realZoom;
        const viewRight = (this.canvas.width - this.panOffset.x) / realZoom;
        const viewBottom = (this.canvas.height - this.panOffset.y) / realZoom;
        this.ctx.fillStyle = '#f8fafc';
        this.ctx.fillRect(viewLeft - 50, viewTop - 50, viewRight - viewLeft + 100, viewBottom - viewTop + 100);
        
        // Dessiner la grille procédurale infinie
        this.drawProceduralGrid();
        
        // Dessiner toutes les lignes dessinées par l'utilisateur
        this.drawAllUserLines();
        
        // Obstacles
        this.drawObstacles();
        
        // Icônes de collision
        this.drawCollisionIcons();
        
        // Robot
        this.drawRobot();
        
        // Rayon ultrason
        this.drawUltrasonicRay();
        
        // Debug: afficher les points de collision
        if (this.debugCollisionPoints) {
            this.drawDebugCollisionPoints();
        }
        
        this.ctx.restore();
    }
    
    drawAllUserLines() {
        // Dessiner toutes les lignes stockées directement dans le contexte principal
        for (const line of this.allDrawnLines) {
            this.drawUserLine(line);
        }
        
        // Dessiner la ligne en cours si elle existe
        if (this.isCurrentlyDrawing && this.drawBuffer && this.drawBuffer.length > 1) {
            const smoothed = this.smoothPoints(this.drawBuffer, 2);
            this.drawUserLine({
                points: smoothed,
                isLine: this.drawMode === 'line',
                width: this.drawMode === 'line' ? this.lineWidth : this.lineWidth * 2
            });
        }
        
        // Redessiner le trackCanvas UNIQUEMENT si les lignes ont changé
        if (this.trackCanvasDirty) {
            this.updateTrackCanvasForSensors();
            this.trackCanvasDirty = false;
        }
    }
    
    updateTrackCanvasForSensors() {
        // Effacer le trackCanvas
        this.trackCtx.fillStyle = '#f8fafc';
        this.trackCtx.fillRect(0, 0, this.trackCanvas.width, this.trackCanvas.height);
        
        // Dessiner toutes les lignes dans le trackCanvas pour la détection
        for (const line of this.allDrawnLines) {
            this.drawUserLineInTrackCanvas(line);
        }
        
        // Dessiner la ligne en cours
        if (this.isCurrentlyDrawing && this.drawBuffer && this.drawBuffer.length > 1) {
            const smoothed = this.smoothPoints(this.drawBuffer, 2);
            this.drawUserLineInTrackCanvas({
                points: smoothed,
                isLine: this.drawMode === 'line',
                width: this.drawMode === 'line' ? this.lineWidth : this.lineWidth * 2
            });
        }
    }
    
    drawUserLineInTrackCanvas(line) {
        const points = line.points;
        if (points.length < 2) return;
        
        this.trackCtx.strokeStyle = line.isLine ? '#000000' : '#f8fafc';
        this.trackCtx.fillStyle = line.isLine ? '#000000' : '#f8fafc';
        this.trackCtx.lineWidth = line.width;
        this.trackCtx.lineCap = 'round';
        this.trackCtx.lineJoin = 'round';
        
        this.trackCtx.beginPath();
        this.trackCtx.moveTo(points[0].x, points[0].y);
        
        if (points.length === 2) {
            this.trackCtx.lineTo(points[1].x, points[1].y);
        } else {
            for (let i = 1; i < points.length - 2; i++) {
                const xc = (points[i].x + points[i + 1].x) / 2;
                const yc = (points[i].y + points[i + 1].y) / 2;
                this.trackCtx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }
            
            // Derniers points
            this.trackCtx.quadraticCurveTo(
                points[points.length - 2].x,
                points[points.length - 2].y,
                points[points.length - 1].x,
                points[points.length - 1].y
            );
        }
        
        this.trackCtx.stroke();
    }
    
    drawUserLine(line) {
        const points = line.points;
        if (points.length < 2) return;
        
        this.ctx.strokeStyle = line.isLine ? '#000000' : '#f8fafc';
        this.ctx.fillStyle = line.isLine ? '#000000' : '#f8fafc';
        this.ctx.lineWidth = line.width;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        
        if (points.length === 2) {
            this.ctx.lineTo(points[1].x, points[1].y);
        } else {
            for (let i = 1; i < points.length - 2; i++) {
                const xc = (points[i].x + points[i + 1].x) / 2;
                const yc = (points[i].y + points[i + 1].y) / 2;
                this.ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }
            
            // Derniers points
            this.ctx.quadraticCurveTo(
                points[points.length - 2].x,
                points[points.length - 2].y,
                points[points.length - 1].x,
                points[points.length - 1].y
            );
        }
        
        this.ctx.stroke();
    }
    
    drawProceduralGrid() {
        // Calculer la zone visible dans les coordonnées monde
        const realZoom = this.getRealZoom();
        const viewLeft = -this.panOffset.x / realZoom;
        const viewTop = -this.panOffset.y / realZoom;
        const viewRight = (this.canvas.width - this.panOffset.x) / realZoom;
        const viewBottom = (this.canvas.height - this.panOffset.y) / realZoom;
        
        // Arrondir aux limites de la grille
        const startX = Math.floor(viewLeft / this.gridSize) * this.gridSize;
        const startY = Math.floor(viewTop / this.gridSize) * this.gridSize;
        const endX = Math.ceil(viewRight / this.gridSize) * this.gridSize;
        const endY = Math.ceil(viewBottom / this.gridSize) * this.gridSize;
        
        // Dessiner les lignes verticales
        this.ctx.strokeStyle = '#d0d7de';
        this.ctx.lineWidth = 1 / realZoom; // Compenser le zoom pour une épaisseur constante
        this.ctx.beginPath();
        for (let x = startX; x <= endX; x += this.gridSize) {
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
        }
        this.ctx.stroke();
        
        // Dessiner les lignes horizontales
        this.ctx.beginPath();
        for (let y = startY; y <= endY; y += this.gridSize) {
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
        }
        this.ctx.stroke();
    }
    
    drawObstacles() {
        for (const obs of this.obstacles) {
            this.ctx.save();
            this.ctx.translate(obs.x, obs.y);
            
            // Déterminer les couleurs selon l'état de l'obstacle
            const isGrabbed = obs === this.grabbedObstacle;
            const isSelected = obs === this.selectedObstacle;
            
            let fillColor, strokeColor;
            if (isGrabbed) {
                fillColor = '#22c55e'; // Vert pour attrapé
                strokeColor = '#16a34a';
            } else if (isSelected) {
                fillColor = '#ef4444'; // Rouge pour sélectionné
                strokeColor = '#dc2626';
            } else {
                fillColor = '#64748b'; // Gris par défaut
                strokeColor = '#475569';
            }
            
            // Ombre
            this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
            this.ctx.fillRect(-obs.width/2 + 3, -obs.height/2 + 3, obs.width, obs.height);
            
            // Obstacle
            this.ctx.fillStyle = fillColor;
            this.ctx.fillRect(-obs.width/2, -obs.height/2, obs.width, obs.height);
            
            // Bordure
            this.ctx.strokeStyle = strokeColor;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(-obs.width/2, -obs.height/2, obs.width, obs.height);
            
            // Icône
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 14px Inter, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(isGrabbed ? '🎯' : '📦', 0, 0);
            
            this.ctx.restore();
        }
    }
    
    drawCollisionIcons() {
        const now = Date.now();
        
        // Filtrer les points de collision trop anciens (plus de 2 secondes)
        this.collisionPoints = this.collisionPoints.filter(p => now - p.time < 2000);
        
        // Dessiner chaque point de collision
        for (const collision of this.collisionPoints) {
            const age = (now - collision.time) / 1000; // Age en secondes
            const opacity = Math.max(0, 1 - age / 2); // Fade out sur 2 secondes
            
            this.ctx.save();
            this.ctx.translate(collision.x, collision.y);
            
            // Animation de rotation
            const rotation = age * Math.PI * 2; // Une rotation par seconde
            this.ctx.rotate(rotation);
            
            // Dessiner une étoile de choc (x4 plus grande)
            this.ctx.fillStyle = `rgba(255, 68, 68, ${opacity})`;
            this.ctx.strokeStyle = `rgba(220, 38, 38, ${opacity})`;
            this.ctx.lineWidth = 3;
            
            // Étoile à 8 branches (dimensions x4)
            this.ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = (i * Math.PI) / 4;
                const radius = (i % 2 === 0) ? 48 : 20; // 12*4 et 5*4
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Centre de l'étoile (point d'impact) - x4
            this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 12, 0, Math.PI * 2); // 3*4
            this.ctx.fill();
            
            this.ctx.restore();
        }
    }
    
    drawUltrasonicRay() {
        const moveAngle = this.robot.angle * Math.PI / 180;
        const startX = this.robot.x + Math.cos(moveAngle) * (this.robot.height / 2 + 10);
        const startY = this.robot.y + Math.sin(moveAngle) * (this.robot.height / 2 + 10);
        const dist = this.getUltrasonicDistance() * this.pixelsPerCm;
        const endX = startX + Math.cos(moveAngle) * dist;
        const endY = startY + Math.sin(moveAngle) * dist;
        
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        // Point de détection
        this.ctx.fillStyle = '#3b82f6';
        this.ctx.beginPath();
        this.ctx.arc(endX, endY, 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }
    
    drawDebugCollisionPoints() {
        const ctx = this.ctx;
        const allPoints = this.getRobotCollisionPoints();
        
        // Dessiner tous les points de collision
        for (let i = 0; i < allPoints.length; i++) {
            const point = allPoints[i];
            
            // Vérifier si ce point est en collision avec un obstacle
            let isColliding = false;
            for (const obstacle of this.obstacles) {
                // Ignorer les obstacles gérés par la pince
                if (obstacle === this.grabbedObstacle || 
                    obstacle === this.grippingTarget || 
                    obstacle === this.recentlyReleasedObstacle) continue;
                if (this.isPointInRectangle(point, obstacle)) {
                    isColliding = true;
                    break;
                }
            }
            
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = isColliding ? '#ff0000' : '#00ff00';
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
    
    drawRobot() {
        const ctx = this.ctx;
        const r = this.robot;
        const w = r.width, h = r.height;
        
        ctx.save();
        ctx.translate(r.x, r.y);
        // Le robot est dessiné avec la flèche vers le haut (-h/2), 
        // mais angle=0 pointe vers la droite en trigonométrie
        // Donc on ajoute 90° pour aligner (flèche vers la direction de déplacement)
        ctx.rotate((this.robot.angle + 90) * Math.PI / 180);
        
        // Ombre
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(3, 3, w/2, h/2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Corps principal
        ctx.fillStyle = '#2d5016';
        ctx.beginPath();
        ctx.roundRect(-w/2, -h/2, w, h, 8);
        ctx.fill();
        
        // Partie avant (noire)
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.roundRect(-w/2 + 5, -h/2, w - 10, 20, [8, 8, 0, 0]);
        ctx.fill();
        
        // Roues
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(-w/2 - 7, -h/2 + 18, 9, 24);
        ctx.fillRect(w/2 - 2, -h/2 + 18, 9, 24);
        
        // Texture roues
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const ry = -h/2 + 20 + i * 5;
            ctx.beginPath();
            ctx.moveTo(-w/2 - 7, ry);
            ctx.lineTo(-w/2 + 2, ry);
            ctx.moveTo(w/2 - 2, ry);
            ctx.lineTo(w/2 + 7, ry);
            ctx.stroke();
        }
        
        // LEDs
        const ledY = -h/2 + 10;
        
        ctx.beginPath();
        ctx.arc(-w/4, ledY, 6, 0, Math.PI * 2);
        if (r.leftLed.r || r.leftLed.g || r.leftLed.b) {
            const c = `rgb(${r.leftLed.r},${r.leftLed.g},${r.leftLed.b})`;
            ctx.fillStyle = c;
        } else {
            ctx.fillStyle = '#333';
        }
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(w/4, ledY, 6, 0, Math.PI * 2);
        if (r.rightLed.r || r.rightLed.g || r.rightLed.b) {
            const c = `rgb(${r.rightLed.r},${r.rightLed.g},${r.rightLed.b})`;
            ctx.fillStyle = c;
        } else {
            ctx.fillStyle = '#333';
        }
        ctx.fill();
        
        // Capteurs de ligne
        const sensorY = -h/2 - 5;
        
        ctx.beginPath();
        ctx.arc(-10, sensorY, 5, 0, Math.PI * 2);
        ctx.fillStyle = r.leftSensor ? '#00ff88' : '#ff4444';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(10, sensorY, 5, 0, Math.PI * 2);
        ctx.fillStyle = r.rightSensor ? '#00ff88' : '#ff4444';
        ctx.fill();
        ctx.stroke();
        
        // Capteur ultrason
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.roundRect(-12, -h/2 - 12, 24, 10, 3);
        ctx.fill();
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(-5, -h/2 - 7, 4, 0, Math.PI * 2);
        ctx.arc(5, -h/2 - 7, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Flèche de direction
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(0, -h/2 - 20);
        ctx.lineTo(-10, -h/2 - 8);
        ctx.lineTo(10, -h/2 - 8);
        ctx.closePath();
        ctx.fill();
        
        // Dessiner la pince si activée
        if (r.gripperEnabled) {
            this.drawGripper(ctx, w, h);
        }
        
        ctx.restore();
    }
    
    drawGripper(ctx, w, h) {
        // Utiliser les paramètres de réglage
        const gripperBaseY = -h/2 + this.gripperSettings.positionY;
        const baseWidth = this.gripperSettings.baseWidth;
        const baseHeight = 12;
        
        // Base de la pince (fixation)
        ctx.fillStyle = '#4b5563';
        ctx.beginPath();
        ctx.roundRect(-baseWidth/2, gripperBaseY, baseWidth, baseHeight, 3);
        ctx.fill();
        
        // Calcul des angles d'ouverture
        // UN SEUL servo (S1) contrôle les DEUX pinces en même temps
        // Interpolation directe entre les angles définis par les curseurs
        
        const servoValue = this.robot.servo1; // Utiliser SEULEMENT servo1
        
        // t = 0 quand servo=10° (ouvert)
        // t = 1 quand servo=80° (fermé)
        const t = Math.max(0, Math.min(1, (servoValue - 10) / 70));
        
        // Interpolation linéaire pour chaque bras
        const leftAngle = this.gripperSettings.leftAngle10 + t * (this.gripperSettings.leftAngle80 - this.gripperSettings.leftAngle10);
        const rightAngle = this.gripperSettings.rightAngle10 + t * (this.gripperSettings.rightAngle80 - this.gripperSettings.rightAngle10);
        
        // Bras de la pince
        const armLength = this.gripperSettings.armLength;
        const armWidth = 10;
        
        // Bras gauche
        ctx.save();
        ctx.translate(-baseWidth/2 + 4, gripperBaseY + baseHeight);
        ctx.rotate(leftAngle * Math.PI / 180);
        
        // Corps du bras
        ctx.fillStyle = '#e91e63';
        ctx.fillRect(-armWidth/2, 0, armWidth, armLength);
        
        // Articulation
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#6b7280';
        ctx.fill();
        
        // Bout de la pince
        ctx.fillStyle = '#c2185b';
        ctx.beginPath();
        ctx.roundRect(-armWidth/2 - 4, armLength - 15, armWidth + 8, 18, 4);
        ctx.fill();
        
        ctx.restore();
        
        // Bras droit
        ctx.save();
        ctx.translate(baseWidth/2 - 4, gripperBaseY + baseHeight);
        ctx.rotate(rightAngle * Math.PI / 180);
        
        // Corps du bras
        ctx.fillStyle = '#e91e63';
        ctx.fillRect(-armWidth/2, 0, armWidth, armLength);
        
        // Articulation
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#6b7280';
        ctx.fill();
        
        // Bout de la pince
        ctx.fillStyle = '#c2185b';
        ctx.beginPath();
        ctx.roundRect(-armWidth/2 - 4, armLength - 15, armWidth + 8, 18, 4);
        ctx.fill();
        
        ctx.restore();
    }
    
    // ===== API PUBLIQUE =====
    
    setMotors(left, right) {
        // En dessous de 20%, le robot n'avance pas en réalité
        const adjustSpeed = (speed) => {
            const absSpeed = Math.abs(speed);
            if (absSpeed > 0 && absSpeed < 20) {
                return 0; // En dessous de 20%, le moteur ne tourne pas
            }
            return Math.max(-100, Math.min(100, Math.round(speed)));
        };
        
        this.robot.leftSpeed = adjustSpeed(left);
        this.robot.rightSpeed = adjustSpeed(right);
    }
    
    forward() { this.setMotors(80, 80); }
    backward() { this.setMotors(-80, -80); }
    turnLeft() { this.setMotors(-50, 50); }
    turnRight() { this.setMotors(50, -50); }
    stopMotors() { this.setMotors(0, 0); }
    
    async moveTime(dir, speed, time) {
        const dirs = {
            forward: [speed, speed],
            backward: [-speed, -speed],
            left: [-speed, speed],
            right: [speed, -speed]
        };
        const [l, r] = dirs[dir] || [0, 0];
        this.setMotors(l, r);
        await new Promise(resolve => setTimeout(resolve, time * 1000));
        this.stopMotors();
    }
    
    setLedColor(side, color) {
        const hex = String(color).replace(/['"#]/g, '');
        const r = parseInt(hex.substr(0, 2), 16) || 0;
        const g = parseInt(hex.substr(2, 2), 16) || 0;
        const b = parseInt(hex.substr(4, 2), 16) || 0;
        this.setLedRGB(side, r, g, b);
    }
    
    setLedRGB(side, r, g, b) {
        r = Math.max(0, Math.min(255, Math.round(r)));
        g = Math.max(0, Math.min(255, Math.round(g)));
        b = Math.max(0, Math.min(255, Math.round(b)));
        
        if (side === 'RGB_R' || side === 'ALL') this.robot.leftLed = { r, g, b };
        if (side === 'RGB_L' || side === 'ALL') this.robot.rightLed = { r, g, b };
    }
    
    ledOff() {
        this.robot.leftLed = { r: 0, g: 0, b: 0 };
        this.robot.rightLed = { r: 0, g: 0, b: 0 };
    }
    
    trackingState(state) {
        const left = this.robot.leftSensor;
        const right = this.robot.rightSensor;
        
        switch (state) {
            case 'L_R_line': return left && right;
            case 'L_unline_R_line': return !left && right;
            case 'L_line_R_unline': return left && !right;
            case 'L_R_unline': return !left && !right;
            default: return false;
        }
    }
    
    trackSide(side, event) {
        const sensor = side === 'Left' ? this.robot.leftSensor : this.robot.rightSensor;
        return event === 'FindLine' ? sensor : !sensor;
    }
    
    ultrasonic(unit) {
        const cm = this.getUltrasonicDistance();
        return unit === 'Inches' ? Math.round(cm * 0.3937) : cm;
    }
    
    setServo(servo, angle) {
        angle = Math.max(0, Math.min(180, Math.round(angle)));
        if (servo === 'S1') {
            this.robot.servo1Target = angle; // Définir la cible, l'animation se fait dans updateGripper()
        } else {
            this.robot.servo2 = angle;
        }
    }
    
    toggleGripper() {
        this.robot.gripperEnabled = !this.robot.gripperEnabled;
        return this.robot.gripperEnabled;
    }
    
    onTrackEvent(sensor, event, callback) {
        if (this.trackEvents[sensor]) this.trackEvents[sensor][event] = callback;
    }
    
    onIRReceive(callback) { this.irCallback = callback; }
    
    triggerIR(button) {
        this.irButton = button;
        this.irLastCode = button; // Garder la dernière valeur (ne reset pas à null)
        if (this.irCallback) try { this.irCallback(button); } catch(e) { console.error(e); }
        setTimeout(() => { this.irButton = null; }, 200);
    }
    
    irButtonPressed(button) {
        const buttonMap = {
            'Off': 6, 'Menu': 4, 'Up': 5, 'Left': 8, 'Right': 10,
            'Down': 13, 'OK': 9, 'Plus': 2, 'Minus': 1, 'Back': 14,
            'Zero': 12, 'One': 16, 'Two': 17, 'Three': 18,
            'Four': 20, 'Five': 21, 'Six': 22, 'Seven': 24,
            'Eight': 25, 'Nine': 26
        };
        // Utiliser irLastCode au lieu de irButton pour persister la valeur
        return this.irLastCode === buttonMap[button];
    }
    
    setDrawMode(mode) {
        this.drawMode = mode;
    }
    
    setLineWidth(width) {
        this.lineWidth = width;
    }
    
    start() {
        this.isRunning = true;
    }
    
    stopSimulation() {
        this.isRunning = false;
        this.setMotors(0, 0);
    }
    
    reset(keepPosition = false) {
        this.stopSimulation();
        
        if (keepPosition) {
            // Lors d'un rafraîchissement : restaurer la position de référence (là où l'utilisateur a placé le robot)
            this.robot.x = this.homePosition.x;
            this.robot.y = this.homePosition.y;
            this.robot.angle = this.homePosition.angle;
        } else {
            // Lors d'un vrai reset : remettre au centre
            this.robot.x = 1000;
            this.robot.y = 1000;
            this.robot.angle = -90;
            // Réinitialiser aussi la position de référence au centre
            this.homePosition.x = 1000;
            this.homePosition.y = 1000;
            this.homePosition.angle = -90;
        }
        
        this.robot.leftSpeed = 0;
        this.robot.rightSpeed = 0;
        this.robot.servo1 = 10;
        this.robot.servo1Target = 10;
        this.ledOff();
        this.irLastCode = 0; // Réinitialiser la variable IR
        this.irButton = null;
        this.trackEvents = {
            Left: { FindLine: null, LoseLine: null },
            Right: { FindLine: null, LoseLine: null }
        };
        this.irCallback = null;
        
        // Relâcher l'obstacle attrapé
        this.releaseObstacle();
        this.grippingTarget = null;
        this.recentlyReleasedObstacle = null;
        this.releaseGraceTime = 0;
        
        // Effacer les points de collision
        this.clearCollisionPoints();
    }
}

// Variable globale
let simulator = null;

function initSimulator() {
    // Vérifier que le canvas existe
    const canvas = document.getElementById('simulatorCanvas');
    if (!canvas) {
        return null;
    }
    
    // Vérifier que le parent a des dimensions
    const wrapper = canvas.parentElement;
    if (!wrapper) {
        return null;
    }
    
    // Si les dimensions sont nulles, attendre un peu
    if (wrapper.clientWidth === 0 || wrapper.clientHeight === 0) {
        setTimeout(initSimulator, 200);
        return null;
    }
    
    simulator = new CutebotSimulator('simulatorCanvas');
    
    // Boutons de dessin
    const btnDraw = document.getElementById('btnDrawLine');
    const btnErase = document.getElementById('btnEraseLine');
    const btnClear = document.getElementById('btnClearTrack');
    const sliderWidth = document.getElementById('lineWidth');
    const widthValue = document.getElementById('lineWidthValue');
    
    if (btnDraw) {
        btnDraw.onclick = function() {
            simulator.drawMode = 'line';
            this.classList.add('btn-active');
            if (btnErase) btnErase.classList.remove('btn-active');
        };
    }
    
    if (btnErase) {
        btnErase.onclick = function() {
            simulator.drawMode = 'erase';
            this.classList.add('btn-active');
            if (btnDraw) btnDraw.classList.remove('btn-active');
        };
    }
    
    if (btnClear) {
        btnClear.onclick = () => simulator.clearTrack();
    }
    
    if (sliderWidth) {
        sliderWidth.value = 23;
        if (widthValue) widthValue.textContent = '23px';
        sliderWidth.oninput = function() {
            simulator.lineWidth = parseInt(this.value);
            if (widthValue) widthValue.textContent = this.value + 'px';
        };
    }
    
    // Boutons obstacles
    const btnAddObstacle = document.getElementById('btnAddObstacle');
    const btnRemoveObstacle = document.getElementById('btnRemoveObstacle');
    
    if (btnAddObstacle) {
        btnAddObstacle.onclick = () => {
            simulator.addObstacle();
            showToast('📦 Obstacle ajouté - déplacez-le avec la souris', 'info');
        };
    }
    
    if (btnRemoveObstacle) {
        btnRemoveObstacle.onclick = () => {
            if (simulator.selectedObstacle) {
                simulator.removeSelectedObstacle();
                showToast('🗑️ Obstacle supprimé', 'info');
            } else {
                showToast('⚠️ Sélectionnez d\'abord un obstacle', 'warning');
            }
        };
    }
    
    // Boutons IR
    document.querySelectorAll('.ir-btn').forEach(btn => {
        btn.onclick = function() {
            const irCode = parseInt(this.dataset.ir);
            simulator.triggerIR(irCode);
            this.classList.add('pressed');
            setTimeout(() => this.classList.remove('pressed'), 200);
        };
    });
    
    return simulator;
}
