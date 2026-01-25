/**
 * FieldColorDropdown - Dropdown avec un carré de couleur devant chaque option
 */

(function() {
    'use strict';

    const SQUARE_SIZE = 12;
    const SQUARE_GAP = 4;

    class FieldColorDropdown extends Blockly.FieldDropdown {
        constructor(menuGenerator, validator) {
            super(menuGenerator, validator);
        }

        /**
         * Initialisation - ajouter le carré après l'init standard
         */
        initView() {
            super.initView();
            
            // Créer le carré de couleur (sera coloré dans render_)
            this.colorSquare_ = Blockly.utils.dom.createSvgElement('rect', {
                'width': SQUARE_SIZE,
                'height': SQUARE_SIZE,
                'rx': 2,
                'ry': 2,
                'stroke': '#00000033',
                'stroke-width': 1
            }, this.fieldGroup_);
        }

        /**
         * Après le rendu standard, décaler les éléments et positionner le carré
         */
        render_() {
            // Laisser Blockly faire son rendu normal
            super.render_();
            
            if (!this.colorSquare_) return;
            
            const value = this.getValue();
            const isColor = value && typeof value === 'string' && value.startsWith('#');
            
            if (!isColor) {
                this.colorSquare_.style.display = 'none';
                return;
            }
            
            this.colorSquare_.style.display = '';
            // Forcer la couleur avec !important pour éviter les overrides CSS
            this.colorSquare_.style.cssText = `fill: ${value} !important; display: block;`;
            
            // DEBUG - inspecter le carré dans le DOM
            console.log('Square element:', this.colorSquare_);
            console.log('Square parent:', this.colorSquare_.parentNode);
            console.log('Square computed style fill:', window.getComputedStyle(this.colorSquare_).fill);
            console.log('FieldGroup children:', Array.from(this.fieldGroup_.children).map(el => el.tagName));
            
            // Calculer le décalage nécessaire
            const offset = SQUARE_SIZE + SQUARE_GAP;
            const padding = this.getConstants().FIELD_BORDER_RECT_X_PADDING || 4;
            
            // Décaler le texte (en ajoutant l'offset au padding standard)
            if (this.textElement_) {
                const baseX = padding; // Position de base du texte
                this.textElement_.setAttribute('x', baseX + offset);
            }
            
            // Décaler la flèche SVG si présente
            if (this.svgArrow) {
                // Recalculer la position de la flèche
                const textWidth = this.textElement_ ? Blockly.utils.dom.getTextWidth(this.textElement_) : 0;
                const arrowPadding = this.getConstants().FIELD_DROPDOWN_SVG_ARROW_PADDING || 4;
                const newArrowX = padding + offset + textWidth + arrowPadding;
                const arrowY = (this.size_.height - this.getConstants().FIELD_DROPDOWN_SVG_ARROW_SIZE) / 2;
                this.svgArrow.setAttribute('transform', `translate(${newArrowX},${arrowY})`);
            }
            
            // Agrandir le borderRect
            if (this.borderRect_) {
                const baseWidth = parseFloat(this.borderRect_.getAttribute('width')) || 0;
                this.borderRect_.setAttribute('width', baseWidth + offset);
            }
            
            // Mettre à jour la taille interne
            this.size_.width += offset;
            
            // Positionner le carré de couleur (centré verticalement)
            const height = this.size_.height;
            const squareY = (height - SQUARE_SIZE) / 2;
            
            this.colorSquare_.setAttribute('x', padding);
            this.colorSquare_.setAttribute('y', squareY);
        }

        /**
         * Affiche le menu dropdown avec les carrés de couleur
         */
        showEditor_(e) {
            super.showEditor_(e);
            
            setTimeout(() => {
                this.addColorSquaresToMenu_();
            }, 0);
        }

        /**
         * Ajoute les carrés de couleur aux éléments du menu
         */
        addColorSquaresToMenu_() {
            const menu = this.menu_;
            if (!menu) return;
            
            const menuItems = menu.getMenuItems();
            const options = this.getOptions();
            
            menuItems.forEach((item, index) => {
                if (index < options.length) {
                    const value = options[index][1];
                    
                    if (value && typeof value === 'string' && value.startsWith('#')) {
                        const element = item.getElement();
                        if (element) {
                            const content = element.querySelector('.blocklyMenuItemContent');
                            if (content && !content.querySelector('.color-square')) {
                                const square = document.createElement('span');
                                square.className = 'color-square';
                                square.style.cssText = `
                                    display: inline-block;
                                    width: ${SQUARE_SIZE}px;
                                    height: ${SQUARE_SIZE}px;
                                    background-color: ${value};
                                    border: 1px solid rgba(0,0,0,0.2);
                                    border-radius: 2px;
                                    margin-right: 6px;
                                    vertical-align: middle;
                                `;
                                content.insertBefore(square, content.firstChild);
                            }
                        }
                    }
                }
            });
        }

        static fromJson(options) {
            return new FieldColorDropdown(options['options']);
        }
    }

    Blockly.fieldRegistry.register('field_color_dropdown', FieldColorDropdown);
    window.FieldColorDropdown = FieldColorDropdown;

})();
