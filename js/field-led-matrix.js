/**
 * FieldLEDMatrix - Champ personnalisé Blockly pour éditer une matrice LED 5x5
 * Permet de dessiner en maintenant le clic enfoncé
 */

(function() {
    'use strict';

    const LED_SIZE = 18;      // Taille d'une LED
    const LED_GAP = 2;        // Espace entre LEDs
    const LED_RADIUS = 2;     // Arrondi des coins
    const MATRIX_SIZE = 5;    // 5x5 LEDs
    const PADDING = 4;        // Padding autour de la matrice
    
    // Taille totale calculée
    const TOTAL_SIZE = MATRIX_SIZE * LED_SIZE + (MATRIX_SIZE - 1) * LED_GAP + PADDING * 2;
    
    const COLOR_OFF = '#374151';     // LED éteinte (gris foncé)
    const COLOR_ON = '#ef4444';      // LED allumée (rouge)
    const COLOR_BORDER = '#1f2937';  // Bordure

    class FieldLEDMatrix extends Blockly.Field {
        constructor(value, validator) {
            // Valeur par défaut: matrice 5x5 de 0
            const defaultValue = '0000000000000000000000000';
            
            // Initialiser matrix_ AVANT super() car setValue peut être appelé
            FieldLEDMatrix.tempMatrix_ = FieldLEDMatrix.parseValueStatic_(value || defaultValue);
            
            super(value || defaultValue, validator);
            
            this.SERIALIZABLE = true;
            this.CURSOR = 'default';
            
            // Définir la taille dès le constructeur
            this.size_ = new Blockly.utils.Size(TOTAL_SIZE, TOTAL_SIZE);
            
            // État de la matrice (25 booléens)
            this.matrix_ = FieldLEDMatrix.tempMatrix_ || this.parseValue_(this.getValue() || defaultValue);
            
            // État du dessin
            this.isDrawing_ = false;
            this.drawMode_ = true; // true = allumer, false = éteindre
            
            // Éléments SVG
            this.ledElements_ = [];
            
            // Bound handlers pour pouvoir les retirer
            this.boundMouseUp_ = this.onMouseUp_.bind(this);
            this.boundMouseMove_ = this.onGlobalMouseMove_.bind(this);
        }

        /**
         * Parse statique pour utilisation avant super()
         */
        static parseValueStatic_(value) {
            const matrix = [];
            const str = String(value || '').replace(/[^01]/g, '');
            for (let i = 0; i < 25; i++) {
                matrix.push(str.charAt(i) === '1');
            }
            return matrix;
        }

        /**
         * Parse la valeur string en tableau de booléens
         */
        parseValue_(value) {
            return FieldLEDMatrix.parseValueStatic_(value);
        }

        /**
         * Convertit la matrice en string
         */
        matrixToString_() {
            if (!this.matrix_) {
                return '0000000000000000000000000';
            }
            return this.matrix_.map(v => v ? '1' : '0').join('');
        }

        /**
         * Crée le rendu du champ
         */
        initView() {
            // Créer le borderRect
            this.createBorderRect_();
            
            // Configurer le borderRect comme fond
            if (this.borderRect_) {
                this.borderRect_.setAttribute('width', TOTAL_SIZE);
                this.borderRect_.setAttribute('height', TOTAL_SIZE);
                this.borderRect_.setAttribute('rx', 4);
                this.borderRect_.setAttribute('fill', '#111827');
                this.borderRect_.setAttribute('stroke', COLOR_BORDER);
                this.borderRect_.setAttribute('stroke-width', '1');
            }
            
            // Groupe pour la matrice
            this.matrixGroup_ = Blockly.utils.dom.createSvgElement('g', {
                'transform': `translate(${PADDING}, ${PADDING})`
            }, this.fieldGroup_);
            
            // Créer les LEDs
            this.ledElements_ = [];
            for (let y = 0; y < MATRIX_SIZE; y++) {
                for (let x = 0; x < MATRIX_SIZE; x++) {
                    const index = y * MATRIX_SIZE + x;
                    const ledX = x * (LED_SIZE + LED_GAP);
                    const ledY = y * (LED_SIZE + LED_GAP);
                    
                    const led = Blockly.utils.dom.createSvgElement('rect', {
                        'x': ledX,
                        'y': ledY,
                        'width': LED_SIZE,
                        'height': LED_SIZE,
                        'rx': LED_RADIUS,
                        'fill': this.matrix_[index] ? COLOR_ON : COLOR_OFF,
                        'stroke': COLOR_BORDER,
                        'stroke-width': 1,
                        'data-index': index
                    }, this.matrixGroup_);
                    
                    this.ledElements_.push(led);
                }
            }
            
            // Créer une couche invisible par-dessus pour capturer les événements
            const matrixWidth = MATRIX_SIZE * (LED_SIZE + LED_GAP) - LED_GAP;
            this.overlay_ = Blockly.utils.dom.createSvgElement('rect', {
                'x': 0,
                'y': 0,
                'width': matrixWidth,
                'height': matrixWidth,
                'fill': 'transparent',
                'style': 'cursor: pointer; touch-action: none;'
            }, this.matrixGroup_);
            
            // Gestionnaire pointerdown sur l'overlay (gère souris ET tactile)
            this.overlay_.addEventListener('pointerdown', this.onPointerDown_.bind(this));
            
            // Forcer la mise à jour de la taille
            this.updateSize_();
            
            // Forcer le bloc parent à recalculer sa taille après l'initialisation
            if (this.sourceBlock_ && this.sourceBlock_.rendered) {
                setTimeout(() => {
                    if (this.sourceBlock_) {
                        this.sourceBlock_.render();
                    }
                }, 0);
            }
        }

        /**
         * Met à jour la taille du champ - CRUCIAL pour que Blockly ajuste le bloc
         */
        updateSize_() {
            this.size_.width = TOTAL_SIZE;
            this.size_.height = TOTAL_SIZE;
            
            if (this.borderRect_) {
                this.borderRect_.setAttribute('width', TOTAL_SIZE);
                this.borderRect_.setAttribute('height', TOTAL_SIZE);
            }
        }

        /**
         * Rendu du champ - appelé par Blockly quand isDirty_ est true
         */
        render_() {
            this.updateDisplay_();
            this.updateSize_();
        }

        /**
         * Retourne la taille du champ
         */
        getSize() {
            if (!this.isVisible()) {
                return new Blockly.utils.Size(0, 0);
            }
            return this.size_;
        }

        /**
         * Trouve l'index de la LED sous le curseur
         * Utilise les coordonnées SVG natives pour plus de précision
         */
        getLedIndexAtPosition_(clientX, clientY) {
            // Obtenir le SVG parent
            const svg = this.fieldGroup_.ownerSVGElement;
            if (!svg) return -1;
            
            // Créer un point SVG et le convertir dans le système de coordonnées du groupe
            const point = svg.createSVGPoint();
            point.x = clientX;
            point.y = clientY;
            
            // Obtenir la matrice de transformation inverse du groupe
            const ctm = this.matrixGroup_.getScreenCTM();
            if (!ctm) return -1;
            
            const svgPoint = point.matrixTransform(ctm.inverse());
            
            const x = svgPoint.x;
            const y = svgPoint.y;
            
            const cellSize = LED_SIZE + LED_GAP;
            const col = Math.floor(x / cellSize);
            const row = Math.floor(y / cellSize);
            
            if (col >= 0 && col < MATRIX_SIZE && row >= 0 && row < MATRIX_SIZE) {
                return row * MATRIX_SIZE + col;
            }
            return -1;
        }

        /**
         * Active ou désactive une LED
         */
        setLed_(index, state) {
            if (index >= 0 && index < 25 && this.matrix_[index] !== state) {
                this.matrix_[index] = state;
                this.ledElements_[index].setAttribute('fill', state ? COLOR_ON : COLOR_OFF);
            }
        }

        /**
         * PointerDown - Début du dessin
         */
        onPointerDown_(e) {
            e.preventDefault();
            e.stopPropagation(); // Empêcher Blockly de démarrer un drag du bloc
            
            const index = this.getLedIndexAtPosition_(e.clientX, e.clientY);
            if (index >= 0) {
                this.isDrawing_ = true;
                this.pointerId_ = e.pointerId;
                
                // Capturer le pointeur sur l'overlay
                this.overlay_.setPointerCapture(e.pointerId);
                
                // Le mode dépend de l'état actuel de la LED cliquée
                this.drawMode_ = !this.matrix_[index];
                this.setLed_(index, this.drawMode_);
                this.lastIndex_ = index;
                
                // Écouter pointermove et pointerup sur l'overlay
                this.overlay_.addEventListener('pointermove', this.boundMouseMove_);
                this.overlay_.addEventListener('pointerup', this.boundMouseUp_);
                this.overlay_.addEventListener('pointercancel', this.boundMouseUp_);
                this.overlay_.addEventListener('lostpointercapture', this.boundMouseUp_);
            }
        }

        /**
         * PointerMove - Continuer le dessin
         */
        onGlobalMouseMove_(e) {
            if (!this.isDrawing_) return;
            
            const index = this.getLedIndexAtPosition_(e.clientX, e.clientY);
            if (index >= 0 && index !== this.lastIndex_) {
                this.setLed_(index, this.drawMode_);
                this.lastIndex_ = index;
            }
        }

        /**
         * PointerUp - Fin du dessin
         */
        onMouseUp_(e) {
            if (this.isDrawing_) {
                this.isDrawing_ = false;
                
                // Retirer les écouteurs
                this.overlay_.removeEventListener('pointermove', this.boundMouseMove_);
                this.overlay_.removeEventListener('pointerup', this.boundMouseUp_);
                this.overlay_.removeEventListener('pointercancel', this.boundMouseUp_);
                this.overlay_.removeEventListener('lostpointercapture', this.boundMouseUp_);
                
                // Libérer le pointeur
                if (this.pointerId_ !== undefined && this.overlay_) {
                    try {
                        this.overlay_.releasePointerCapture(this.pointerId_);
                    } catch (err) {}
                }
                
                // Sauvegarder la valeur
                this.setValue(this.matrixToString_());
            }
        }
        
        /**
         * Arrête le dessin et sauvegarde (pour touch events)
         */
        stopDrawing_() {
            if (this.isDrawing_) {
                this.isDrawing_ = false;
                this.setValue(this.matrixToString_());
            }
        }

        /**
         * TouchStart - Début du dessin tactile
         */
        onTouchStart_(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const touch = e.touches[0];
            const index = this.getLedIndexAtPosition_(touch.clientX, touch.clientY);
            
            if (index >= 0) {
                this.isDrawing_ = true;
                this.drawMode_ = !this.matrix_[index];
                this.setLed_(index, this.drawMode_);
                this.lastIndex_ = index;
            }
        }

        /**
         * TouchMove - Continuer le dessin tactile
         */
        onTouchMove_(e) {
            e.preventDefault();
            if (!this.isDrawing_) return;
            
            e.stopPropagation();
            
            const touch = e.touches[0];
            const index = this.getLedIndexAtPosition_(touch.clientX, touch.clientY);
            
            if (index >= 0 && index !== this.lastIndex_) {
                this.setLed_(index, this.drawMode_);
                this.lastIndex_ = index;
            }
        }

        /**
         * TouchEnd - Fin du dessin tactile
         */
        onTouchEnd_(e) {
            if (this.isDrawing_) {
                e.stopPropagation();
                this.isDrawing_ = false;
                this.setValue(this.matrixToString_());
            }
        }

        /**
         * Met à jour l'affichage depuis la valeur
         */
        doValueUpdate_(newValue) {
            super.doValueUpdate_(newValue);
            if (this.matrix_) {
                this.matrix_ = this.parseValue_(newValue);
                this.updateDisplay_();
            }
        }

        /**
         * Met à jour l'affichage des LEDs
         */
        updateDisplay_() {
            if (!this.ledElements_ || this.ledElements_.length === 0) return;
            
            for (let i = 0; i < 25; i++) {
                if (this.ledElements_[i]) {
                    this.ledElements_[i].setAttribute('fill', this.matrix_[i] ? COLOR_ON : COLOR_OFF);
                }
            }
        }

        /**
         * Retourne la valeur actuelle
         */
        getValue() {
            return this.matrixToString_();
        }

        /**
         * Sérialisation XML
         */
        toXml(fieldElement) {
            fieldElement.textContent = this.getValue();
            return fieldElement;
        }

        /**
         * Désérialisation XML
         */
        fromXml(fieldElement) {
            this.setValue(fieldElement.textContent || '0000000000000000000000000');
        }

        /**
         * Sérialisation JSON
         */
        saveState() {
            return this.getValue();
        }

        /**
         * Désérialisation JSON
         */
        loadState(state) {
            this.setValue(state || '0000000000000000000000000');
        }

        /**
         * Pas d'éditeur popup - édition directe
         */
        showEditor_() {
            // L'édition se fait directement sur le champ
        }

        /**
         * Nettoyage
         */
        dispose() {
            this.isDrawing_ = false;
            super.dispose();
        }

        /**
         * Enregistrement du champ depuis JSON
         */
        static fromJson(options) {
            return new FieldLEDMatrix(options['value']);
        }
    }

    // Enregistrer le champ
    Blockly.fieldRegistry.register('field_led_matrix', FieldLEDMatrix);
    
    // Exposer globalement
    window.FieldLEDMatrix = FieldLEDMatrix;

})();
