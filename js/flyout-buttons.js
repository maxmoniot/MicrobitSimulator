/**
 * Personnalisation des boutons de flyout Blockly
 * - Boutons plus gros
 * - Couleurs des catégories Variables et Fonctions
 */

(function() {
    'use strict';
    
    // Augmenter la taille des boutons de flyout
    // Ces constantes contrôlent le padding autour du texte
    if (Blockly && Blockly.FlyoutButton) {
        // Valeurs par défaut : TEXT_MARGIN_X=5, TEXT_MARGIN_Y=2
        // On les augmente pour des boutons plus gros
        Blockly.FlyoutButton.TEXT_MARGIN_X = 16;  // Plus large (était 5)
        Blockly.FlyoutButton.TEXT_MARGIN_Y = 10;  // Plus haut (était 2)
        Blockly.FlyoutButton.BORDER_RADIUS = 8;   // Coins plus arrondis (était 4)
    }
    
    // Couleurs des catégories (identiques à celles de la toolbox)
    const COLORS = {
        variables: {
            background: '#ec4899',  // Rose (comme la catégorie Variables)
            shadow: '#db2777'
        },
        procedures: {
            background: '#9333ea',  // Violet (comme la catégorie Fonctions)
            shadow: '#57534e'
        }
    };
    
    /**
     * Détecte le type de bouton par son texte
     */
    function getButtonType(buttonElement) {
        const textElement = buttonElement.querySelector('text');
        if (!textElement) return null;
        
        const text = textElement.textContent || '';
        
        // Bouton de création de variable
        if (text.includes('variable') || text.includes('Variable')) {
            return 'variables';
        }
        
        // Bouton de création de fonction
        if (text.includes('fonction') || text.includes('Fonction') || text.includes('function')) {
            return 'procedures';
        }
        
        return null;
    }
    
    /**
     * Applique les styles aux boutons de flyout
     */
    function styleButton(button, type) {
        if (!button || !type) return;
        
        const colors = COLORS[type];
        if (!colors) return;
        
        // Trouver les éléments SVG du bouton
        const background = button.querySelector('.blocklyFlyoutButtonBackground');
        const shadow = button.querySelector('.blocklyFlyoutButtonShadow');
        const text = button.querySelector('text');
        
        if (background) {
            background.style.fill = colors.background;
        }
        if (shadow) {
            shadow.style.fill = colors.shadow;
        }
        if (text) {
            text.style.fill = '#ffffff';
            text.style.fontWeight = '600';
            text.style.fontSize = '14px';
        }
    }
    
    /**
     * Traite un bouton de flyout
     */
    function processButton(button) {
        if (!button.classList.contains('blocklyFlyoutButton')) return;
        
        // D'abord vérifier les classes CSS
        if (button.classList.contains('variableButton')) {
            styleButton(button, 'variables');
            return;
        }
        if (button.classList.contains('procedureButton')) {
            styleButton(button, 'procedures');
            return;
        }
        
        // Sinon, détecter par le texte
        const type = getButtonType(button);
        if (type) {
            styleButton(button, type);
        }
    }
    
    /**
     * Observer pour détecter les nouveaux boutons
     */
    function setupButtonObserver() {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    
                    // Vérifier si c'est un bouton de flyout
                    if (node.classList && node.classList.contains('blocklyFlyoutButton')) {
                        processButton(node);
                    }
                    
                    // Aussi chercher dans les enfants
                    const buttons = node.querySelectorAll ? node.querySelectorAll('.blocklyFlyoutButton') : [];
                    buttons.forEach(processButton);
                });
            });
        });
        
        // Observer tout le document pour capturer les boutons dès leur création
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Initialiser l'observer quand le DOM est prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupButtonObserver);
    } else {
        setupButtonObserver();
    }
    
})();
