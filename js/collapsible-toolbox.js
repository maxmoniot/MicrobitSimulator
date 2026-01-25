/**
 * Gestionnaire de toolbox repliable style MakeCode
 */

class CollapsibleToolbox {
    constructor() {
        this.sections = new Map();
        this.collapsedSections = new Set();
    }

    /**
     * Initialise les catégories repliables après l'injection de Blockly
     */
    initialize(workspace) {
        // Attendre que le DOM soit prêt
        setTimeout(() => {
            this.setupCollapsibleCategories();
            this.addCategoryIcons();
            this.loadCollapsedState();
        }, 100);
    }

    /**
     * Configure les catégories avec sections repliables
     */
    setupCollapsibleCategories() {
        const toolbox = document.querySelector('.blocklyToolboxDiv');
        if (!toolbox) return;

        // Trouver toutes les catégories
        const categories = toolbox.querySelectorAll('.blocklyTreeRow');
        
        categories.forEach((category, index) => {
            const label = category.querySelector('.blocklyTreeLabel');
            if (!label) return;
            
            const text = label.textContent.trim();
            
            // Détecter les sections de haut niveau à rendre repliables
            if (this.isSectionCategory(text)) {
                this.makeCategoryCollapsible(category, index);
            }
            
            // Ajouter attributs data pour le styling
            const categoryKey = this.getCategoryKey(text);
            category.setAttribute('data-category', categoryKey);
        });
    }

    /**
     * Détermine si une catégorie doit être une section repliable
     */
    isSectionCategory(text) {
        const sections = [
            'MICRO:BIT',
            'PROGRAMMATION', 
            'CUTEBOT',
            'Avancé'
        ];
        
        return sections.some(section => text.toUpperCase().includes(section.toUpperCase()));
    }

    /**
     * Rend une catégorie repliable
     */
    makeCategoryCollapsible(category, index) {
        const label = category.querySelector('.blocklyTreeLabel');
        const text = label.textContent.trim();
        
        // Marquer comme repliable
        category.classList.add('blocklyTreeRowCollapsible');
        
        // Stocker l'état
        const sectionId = `section_${index}`;
        this.sections.set(sectionId, {
            element: category,
            label: text,
            children: []
        });
        
        // Ajouter le gestionnaire de clic
        category.addEventListener('click', (e) => {
            // Empêcher le comportement par défaut si c'est juste pour toggle
            if (e.target.closest('.blocklyTreeRowCollapsible')) {
                this.toggleSection(sectionId);
                e.stopPropagation();
            }
        });
    }

    /**
     * Toggle une section (ouvrir/fermer)
     */
    toggleSection(sectionId) {
        const section = this.sections.get(sectionId);
        if (!section) return;
        
        const isCollapsed = section.element.classList.contains('blocklyTreeRowCollapsed');
        
        if (isCollapsed) {
            section.element.classList.remove('blocklyTreeRowCollapsed');
            this.collapsedSections.delete(sectionId);
        } else {
            section.element.classList.add('blocklyTreeRowCollapsed');
            this.collapsedSections.add(sectionId);
        }
        
        // Sauvegarder l'état
        this.saveCollapsedState();
        
        // Animer les enfants
        this.animateChildren(section);
    }

    /**
     * Anime l'ouverture/fermeture des catégories enfants
     */
    animateChildren(section) {
        // Cette fonction pourrait gérer l'animation des sous-catégories
        // Pour l'instant, le CSS s'en charge
    }

    /**
     * Ajoute des icônes colorées aux catégories
     */
    addCategoryIcons() {
        const categories = document.querySelectorAll('.blocklyTreeRow');
        
        categories.forEach(category => {
            const label = category.querySelector('.blocklyTreeLabel');
            if (!label || label.querySelector('.blocklyTreeIcon')) return;
            
            // Créer l'icône
            const icon = document.createElement('span');
            icon.className = 'blocklyTreeIcon';
            
            // Insérer l'icône au début du label
            label.insertBefore(icon, label.firstChild);
        });
    }

    /**
     * Extrait la clé de catégorie du texte
     */
    getCategoryKey(text) {
        // Retirer les emojis et normaliser
        const cleaned = text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim().toLowerCase();
        
        const keyMap = {
            'base': 'basic',
            'entrées': 'input',
            'musique': 'music',
            'led': 'led',
            'radio': 'radio',
            'logique': 'logic',
            'boucles': 'loops',
            'math': 'math',
            'texte': 'text',
            'variables': 'variables',
            'fonctions': 'functions',
            'moteurs': 'motors',
            'leds rgb': 'leds',
            'capteurs': 'sensors',
            'servo': 'servo'
        };
        
        for (const [key, value] of Object.entries(keyMap)) {
            if (cleaned.includes(key)) return value;
        }
        
        return cleaned.replace(/\s+/g, '-');
    }

    /**
     * Sauvegarde l'état des sections dans localStorage
     */
    saveCollapsedState() {
        const state = Array.from(this.collapsedSections);
        localStorage.setItem('toolbox_collapsed_sections', JSON.stringify(state));
    }

    /**
     * Charge l'état sauvegardé
     */
    loadCollapsedState() {
        try {
            const saved = localStorage.getItem('toolbox_collapsed_sections');
            if (saved) {
                const state = JSON.parse(saved);
                state.forEach(sectionId => {
                    const section = this.sections.get(sectionId);
                    if (section) {
                        section.element.classList.add('blocklyTreeRowCollapsed');
                        this.collapsedSections.add(sectionId);
                    }
                });
            }
        } catch (e) {
            // Silent fail
        }
    }
}

// Instance globale
let collapsibleToolbox = null;

/**
 * Initialise la toolbox repliable
 */
function initCollapsibleToolbox(workspace) {
    if (!collapsibleToolbox) {
        collapsibleToolbox = new CollapsibleToolbox();
    }
    collapsibleToolbox.initialize(workspace);
}

/**
 * Reset la toolbox repliable
 */
function resetCollapsibleToolbox() {
    if (collapsibleToolbox) {
        collapsibleToolbox.collapsedSections.clear();
        collapsibleToolbox.saveCollapsedState();
    }
}
