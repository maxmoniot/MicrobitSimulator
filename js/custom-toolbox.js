/**
 * Custom Toolbox System - Remplace la toolbox Blockly par une interface HTML
 * Design style MakeCode avec sections repliables
 */

class CustomToolbox {
    constructor(workspace, toolboxData) {
        this.workspace = workspace;
        this.toolboxData = toolboxData;
        this.currentCategory = null;
        this.collapsedSections = new Set(this.loadCollapsedState());
        this.flyoutBlocks = new Map();
        
        this.init();
    }

    init() {
        // Créer le conteneur de la toolbox
        this.container = document.getElementById('customToolbox');
        if (!this.container) {
            return;
        }

        // Attendre que le flyout soit prêt
        setTimeout(() => {
            // Vérifier que le flyout existe
            const flyout = this.workspace.getFlyout();
            if (!flyout) {
                return;
            }
            
            // Afficher le flyout vide au démarrage
            flyout.show([]);
            
            // Parser les catégories depuis le XML
            this.parseToolboxXML();
            
            // Générer le HTML
            this.render();
            
            // Configurer la suppression par glisser sur la toolbox
            this.setupDropToDelete();
            
            // Écouter les créations/suppressions de variables pour rafraîchir le flyout
            this.setupVariableListener();
            
            // Ajuster la position du flyout après un court délai
            setTimeout(() => {
                this.adjustFlyoutPosition();
                
                const flyoutElements = this.workspace.getInjectionDiv().querySelectorAll('.blocklyFlyout');
                if (flyoutElements[1]) {
                    flyoutElements[1].style.display = 'none';
                }
            }, 200);
        }, 100);
    }
    
    /**
     * Configure un listener pour rafraîchir le flyout quand les variables ou procédures changent
     */
    setupVariableListener() {
        this.workspace.addChangeListener((event) => {
            // Rafraîchir si une variable est créée ou supprimée et que le flyout Variables est ouvert
            if ((event.type === Blockly.Events.VAR_CREATE || event.type === Blockly.Events.VAR_DELETE || event.type === Blockly.Events.VAR_RENAME) && 
                this.currentCategory && this.currentCategory.custom === 'VARIABLE') {
                // Petit délai pour laisser Blockly mettre à jour son état
                setTimeout(() => {
                    this.showVariablesFlyout();
                }, 50);
            }
            
            // Rafraîchir si une procédure est créée, modifiée ou supprimée et que le flyout Fonctions est ouvert
            if ((event.type === Blockly.Events.BLOCK_CREATE || 
                 event.type === Blockly.Events.BLOCK_DELETE || 
                 event.type === Blockly.Events.BLOCK_CHANGE) && 
                this.currentCategory && 
                (this.currentCategory.custom === 'PROCEDURE' || this.currentCategory.custom === 'PROCEDURE_CUSTOM')) {
                // Vérifier si c'est un bloc de procédure
                const block = this.workspace.getBlockById(event.blockId);
                if (block && (block.type === 'procedures_defnoreturn' || block.type === 'procedures_defreturn') ||
                    event.type === Blockly.Events.BLOCK_DELETE) {
                    setTimeout(() => {
                        this.showProceduresFlyout();
                    }, 50);
                }
            }
        });
    }

    /**
     * Configure la suppression de blocs en les glissant sur la toolbox
     */
    setupDropToDelete() {
        // Stocker l'état comme propriétés de l'instance pour pouvoir le réinitialiser
        this.dragState = {
            isDragging: false,
            draggedBlock: null,
            lastMouseX: 0,
            lastMouseY: 0
        };
        
        // Créer l'overlay de suppression avec icône poubelle
        this.deleteOverlay = document.createElement('div');
        this.deleteOverlay.className = 'toolbox-delete-overlay';
        this.deleteOverlay.innerHTML = `
            <div class="delete-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </div>
            <div class="delete-text">Supprimer</div>
        `;
        this.container.appendChild(this.deleteOverlay);
        
        // Suivre la position de la souris globalement
        document.addEventListener('pointermove', (e) => {
            this.dragState.lastMouseX = e.clientX;
            this.dragState.lastMouseY = e.clientY;
            
            // Vérifier que le bloc existe toujours (pas supprimé)
            if (this.dragState.isDragging && this.dragState.draggedBlock) {
                // Vérifier si le bloc existe encore dans le workspace
                const blockStillExists = this.workspace.getBlockById(this.dragState.draggedBlock.id);
                if (blockStillExists) {
                    this.checkDeleteZone(this.dragState.lastMouseX, this.dragState.lastMouseY);
                } else {
                    // Le bloc a été supprimé, réinitialiser l'état
                    this.resetDragState();
                }
            }
        });
        
        // Réinitialiser l'état quand on relâche le bouton de la souris (sécurité)
        document.addEventListener('pointerup', () => {
            // Petit délai pour laisser Blockly traiter l'événement de fin de drag d'abord
            setTimeout(() => {
                if (this.dragState.isDragging) {
                    this.resetDragState();
                }
            }, 100);
        });
        
        // Écouter les événements de drag de Blockly
        this.workspace.addChangeListener((event) => {
            // Début du drag
            if (event.type === Blockly.Events.BLOCK_DRAG && event.isStart) {
                this.dragState.isDragging = true;
                this.dragState.draggedBlock = this.workspace.getBlockById(event.blockId);
                
                // Vérifier immédiatement si on est dans la zone de suppression
                if (this.dragState.draggedBlock) {
                    this.checkDeleteZone(this.dragState.lastMouseX, this.dragState.lastMouseY);
                }
            }
            
            // Fin du drag
            if (event.type === Blockly.Events.BLOCK_DRAG && !event.isStart) {
                if (this.dragState.isDragging && this.dragState.draggedBlock) {
                    // Vérifier si la souris est au-dessus de la toolbox
                    const toolboxRect = this.container.getBoundingClientRect();
                    
                    // Utiliser la dernière position connue de la souris
                    if (this.dragState.lastMouseX >= toolboxRect.left && 
                        this.dragState.lastMouseX <= toolboxRect.right &&
                        this.dragState.lastMouseY >= toolboxRect.top && 
                        this.dragState.lastMouseY <= toolboxRect.bottom) {
                        
                        // Supprimer le bloc et tous les blocs attachés en dessous
                        this.dragState.draggedBlock.dispose(false);
                    }
                }
                
                // Réinitialiser l'état
                this.resetDragState();
            }
            
            // Si un bloc est supprimé pendant le drag, réinitialiser l'état
            if (event.type === Blockly.Events.BLOCK_DELETE && this.dragState.isDragging) {
                if (this.dragState.draggedBlock && event.blockId === this.dragState.draggedBlock.id) {
                    this.resetDragState();
                }
            }
        });
    }
    
    /**
     * Réinitialise l'état du drag et cache l'overlay
     */
    resetDragState() {
        this.dragState.isDragging = false;
        this.dragState.draggedBlock = null;
        this.hideDeleteOverlay();
    }
    
    /**
     * Vérifie si la souris est dans la zone de suppression et affiche/cache l'overlay
     */
    checkDeleteZone(mouseX, mouseY) {
        const toolboxRect = this.container.getBoundingClientRect();
        
        if (mouseX >= toolboxRect.left && 
            mouseX <= toolboxRect.right &&
            mouseY >= toolboxRect.top && 
            mouseY <= toolboxRect.bottom) {
            this.showDeleteOverlay();
        } else {
            this.hideDeleteOverlay();
        }
    }
    
    /**
     * Affiche l'overlay de suppression
     */
    showDeleteOverlay() {
        if (this.deleteOverlay) {
            this.deleteOverlay.classList.add('visible');
        }
    }
    
    /**
     * Cache l'overlay de suppression
     */
    hideDeleteOverlay() {
        if (this.deleteOverlay) {
            this.deleteOverlay.classList.remove('visible');
        }
    }

    /**
     * Parse le XML de la toolbox pour extraire les catégories et blocs
     */
    parseToolboxXML() {
        const toolboxXML = document.getElementById('toolbox');
        if (!toolboxXML) {
            return;
        }

        this.categories = [];
        let currentSection = null;

        // Parcourir les enfants directs du XML
        for (let i = 0; i < toolboxXML.childNodes.length; i++) {
            const node = toolboxXML.childNodes[i];
            
            // Détecter les commentaires de section
            if (node.nodeType === Node.COMMENT_NODE) {
                const match = node.textContent.match(/SECTION\s+([A-ZÉ:À-ÿ\s-]+)/);
                if (match) {
                    const sectionName = match[1].trim();
                    
                    currentSection = {
                        type: 'section',
                        name: sectionName,
                        collapsed: this.collapsedSections.has(sectionName)
                    };
                    this.categories.push(currentSection);
                }
            }
            
            // Ignorer les séparateurs (ils sont juste des marqueurs)
            else if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'sep') {
                continue;
            }
            
            // Traiter les catégories
            else if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'category') {
                const category = {
                    type: 'category',
                    name: node.getAttribute('name'),
                    colour: node.getAttribute('colour'),
                    custom: node.getAttribute('custom'),
                    section: currentSection ? currentSection.name : null,
                    blocks: this.extractBlocks(node)
                };
                
                this.categories.push(category);
                
                // Stocker les blocs pour le flyout
                this.flyoutBlocks.set(category.name, category.blocks);
            }
        }
    }

    /**
     * Extrait les blocs d'une catégorie
     */
    extractBlocks(categoryElement) {
        const blocks = [];
        
        // Parcourir tous les enfants de la catégorie
        for (let i = 0; i < categoryElement.childNodes.length; i++) {
            const child = categoryElement.childNodes[i];
            
            // Chercher les éléments <block>
            if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'block') {
                blocks.push(child.cloneNode(true));
            }
        }
        
        return blocks;
    }

    /**
     * Génère le HTML de la toolbox
     */
    render() {
        this.container.innerHTML = '';
        let currentSectionElement = null;
        let currentSectionContainer = null;

        this.categories.forEach((item, index) => {
            if (item.type === 'section') {
                // Créer un header de section
                const sectionHeader = this.createSectionHeader(item, index);
                this.container.appendChild(sectionHeader);
                
                // Conteneur pour les catégories de cette section
                currentSectionContainer = document.createElement('div');
                currentSectionContainer.className = 'custom-toolbox-section-content';
                currentSectionContainer.dataset.section = item.name;
                
                if (item.collapsed) {
                    currentSectionContainer.style.display = 'none';
                }
                
                this.container.appendChild(currentSectionContainer);
                currentSectionElement = item;
                
            } else if (item.type === 'category') {
                // Créer un bouton de catégorie
                const categoryButton = this.createCategoryButton(item, index);
                
                if (currentSectionContainer) {
                    currentSectionContainer.appendChild(categoryButton);
                } else {
                    this.container.appendChild(categoryButton);
                }
            }
        });
    }

    /**
     * Crée un header de section repliable
     */
    createSectionHeader(section, index) {
        const header = document.createElement('div');
        header.className = 'custom-toolbox-section-header';
        header.dataset.section = section.name;
        
        const icon = document.createElement('span');
        icon.className = 'section-toggle-icon';
        icon.textContent = section.collapsed ? '▶' : '▼';
        
        const label = document.createElement('span');
        label.className = 'section-label';
        label.textContent = section.name;
        
        header.appendChild(icon);
        header.appendChild(label);
        
        // Gestionnaire de clic pour toggle
        header.addEventListener('click', () => {
            this.toggleSection(section.name);
        });
        
        return header;
    }

    /**
     * Crée un bouton de catégorie
     */
    createCategoryButton(category, index) {
        const button = document.createElement('div');
        button.className = 'custom-toolbox-category';
        button.dataset.category = category.name;
        
        // Icône colorée
        const icon = document.createElement('div');
        icon.className = 'category-icon';
        icon.style.background = this.getCategoryGradient(category.colour);
        
        // Label avec emoji
        const label = document.createElement('span');
        label.className = 'category-label';
        label.textContent = category.name;
        
        button.appendChild(icon);
        button.appendChild(label);
        
        // Gestionnaire de clic
        button.addEventListener('click', () => {
            this.showCategory(category);
        });
        
        return button;
    }

    /**
     * Génère un gradient basé sur la couleur
     */
    getCategoryGradient(colour) {
        if (!colour) return '#999';
        
        // Convertir la couleur hex en HSL pour créer un gradient
        const darken = -20;
        return `linear-gradient(135deg, ${colour} 0%, ${this.adjustBrightness(colour, darken)} 100%)`;
    }

    /**
     * Ajuste la luminosité d'une couleur hex
     */
    adjustBrightness(hex, percent) {
        // Convertir hex en RGB
        const num = parseInt(hex.replace('#', ''), 16);
        let r = (num >> 16) + percent;
        let g = ((num >> 8) & 0x00FF) + percent;
        let b = (num & 0x0000FF) + percent;
        
        // Limiter les valeurs
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }

    /**
     * Toggle une section (ouvrir/fermer)
     */
    toggleSection(sectionName) {
        const header = this.container.querySelector(`.custom-toolbox-section-header[data-section="${sectionName}"]`);
        const content = this.container.querySelector(`.custom-toolbox-section-content[data-section="${sectionName}"]`);
        
        if (!header || !content) return;
        
        const icon = header.querySelector('.section-toggle-icon');
        const isCollapsed = content.style.display === 'none';
        
        if (isCollapsed) {
            content.style.display = 'block';
            icon.textContent = '▼';
            this.collapsedSections.delete(sectionName);
        } else {
            content.style.display = 'none';
            icon.textContent = '▶';
            this.collapsedSections.add(sectionName);
        }
        
        this.saveCollapsedState();
    }

    /**
     * Ajuste la position du flyout pour éliminer les marges
     */
    adjustFlyoutPosition() {
        const flyout = this.workspace.getFlyout();
        if (!flyout) return;
        
        const injectionDiv = this.workspace.getInjectionDiv();
        const workspaceDiv = injectionDiv.querySelector('div:not(.blockly-container)');
        
        if (workspaceDiv) {
            const rect = workspaceDiv.getBoundingClientRect();
            const currentLeft = rect.left;
            const toolboxWidth = 240;
            const offset = toolboxWidth - currentLeft;
            
            if (Math.abs(offset) > 1) {
                workspaceDiv.style.transform = `translateX(${offset}px)`;
            }
        }
    }

    /**
     * Affiche les blocs d'une catégorie dans le flyout
     */
    showCategory(category) {
        // Si on reclique sur la même catégorie, fermer le flyout
        if (this.currentCategory && this.currentCategory.name === category.name) {
            this.closeFlyout();
            return;
        }
        
        // Mettre à jour la catégorie active
        const allButtons = this.container.querySelectorAll('.custom-toolbox-category');
        allButtons.forEach(btn => btn.classList.remove('active'));
        
        const activeButton = this.container.querySelector(`.custom-toolbox-category[data-category="${category.name}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
        
        this.currentCategory = category;
        
        // Afficher les blocs dans le flyout
        if (category.custom) {
            // Catégories spéciales (variables, fonctions)
            this.showCustomCategory(category);
        } else {
            this.showBlocksInFlyout(category.blocks);
        }
    }

    /**
     * Ferme le flyout
     */
    closeFlyout() {
        const flyout = this.workspace.getFlyout();
        if (flyout) {
            // Afficher vide au lieu de hide() pour qu'il puisse se rouvrir
            flyout.show([]);
            
            // Ajuster pour mettre la largeur à 0
            setTimeout(() => this.adjustFlyoutPosition(), 50);
        }
        
        // Désélectionner toutes les catégories
        const allButtons = this.container.querySelectorAll('.custom-toolbox-category');
        allButtons.forEach(btn => btn.classList.remove('active'));
        
        this.currentCategory = null;
    }

    /**
     * Affiche les blocs dans le flyout de Blockly
     */
    showBlocksInFlyout(blocks) {
        if (!blocks || blocks.length === 0) {
            // Afficher un flyout vide
            const flyout = this.workspace.getFlyout();
            if (flyout) {
                flyout.show([]);
            }
            return;
        }

        // Créer un XML avec les blocs
        const flyoutXML = Blockly.utils.xml.createElement('xml');
        blocks.forEach(block => {
            flyoutXML.appendChild(block.cloneNode(true));
        });

        // Afficher dans le flyout
        const flyout = this.workspace.getFlyout();
        if (flyout) {
            try {
                // Passer le XML element directement
                const xmlDom = Blockly.utils.xml.textToDom(flyoutXML.outerHTML);
                flyout.show(xmlDom);
                
            } catch (e) {
                // Silent fail
            }
            
            // Ajuster la position après affichage
            setTimeout(() => this.adjustFlyoutPosition(), 50);
        }
    }

    /**
     * Gère les catégories spéciales (variables, fonctions)
     */
    showCustomCategory(category) {
        const flyout = this.workspace.getFlyout();
        if (!flyout) return;
        
        if (category.custom === 'VARIABLE') {
            // Générer les blocs de variables personnalisés avec shadow block
            this.showVariablesFlyout();
        } else if (category.custom === 'PROCEDURE' || category.custom === 'PROCEDURE_CUSTOM') {
            this.showProceduresFlyout();
        }
    }
    
    /**
     * Affiche le flyout des variables avec shadow block pour le champ numérique
     */
    showVariablesFlyout() {
        const flyout = this.workspace.getFlyout();
        if (!flyout) return;
        
        // Récupérer les éléments du flyout (format XML/DOM)
        const flyoutContents = Blockly.Variables.flyoutCategory(this.workspace);
        
        // Modifier les blocs pour ajouter des shadow blocks
        if (Array.isArray(flyoutContents)) {
            for (let i = 0; i < flyoutContents.length; i++) {
                const item = flyoutContents[i];
                
                // Traiter les éléments DOM de type block
                if (item.nodeType === Node.ELEMENT_NODE && item.tagName.toLowerCase() === 'block') {
                    const blockType = item.getAttribute('type');
                    
                    // Pour variables_set : ajouter shadow sur VALUE
                    if (blockType === 'variables_set') {
                        this.addShadowToBlock(item, 'VALUE', '0');
                    }
                    
                    // Pour math_change : ajouter shadow sur DELTA
                    if (blockType === 'math_change') {
                        this.addShadowToBlock(item, 'DELTA', '1');
                    }
                }
            }
        }
        
        flyout.show(flyoutContents);
        setTimeout(() => this.adjustFlyoutPosition(), 50);
    }
    
    /**
     * Ajoute une shadow block math_number à un bloc si elle n'existe pas
     */
    addShadowToBlock(blockNode, inputName, defaultValue) {
        // Vérifier s'il y a déjà une value avec ce nom
        for (let j = 0; j < blockNode.childNodes.length; j++) {
            if (blockNode.childNodes[j].nodeName === 'value' && 
                blockNode.childNodes[j].getAttribute('name') === inputName) {
                return; // Déjà présent
            }
        }
        
        // Ajouter la shadow block
        const valueInput = Blockly.utils.xml.createElement('value');
        valueInput.setAttribute('name', inputName);
        const shadow = Blockly.utils.xml.createElement('shadow');
        shadow.setAttribute('type', 'math_number');
        const numField = Blockly.utils.xml.createElement('field');
        numField.setAttribute('name', 'NUM');
        numField.textContent = defaultValue;
        shadow.appendChild(numField);
        valueInput.appendChild(shadow);
        blockNode.appendChild(valueInput);
    }
    
    /**
     * Affiche le flyout des fonctions avec bouton de création
     */
    showProceduresFlyout() {
        const flyout = this.workspace.getFlyout();
        if (!flyout) return;
        
        // Créer le XML du flyout
        const flyoutXML = Blockly.utils.xml.createElement('xml');
        
        // Bouton "Créer une fonction" avec classe CSS personnalisée
        const button = Blockly.utils.xml.createElement('button');
        button.setAttribute('text', '➕ Créer une fonction');
        button.setAttribute('callbackKey', 'CREATE_FUNCTION');
        button.setAttribute('web-class', 'procedureButton');
        flyoutXML.appendChild(button);
        
        // Récupérer toutes les procédures définies
        const procedures = Blockly.Procedures.allProcedures(this.workspace);
        const proceduresNoReturn = procedures[0]; // Fonctions sans retour
        const proceduresWithReturn = procedures[1]; // Fonctions avec retour
        
        // Ajouter les blocs d'appel pour chaque fonction sans retour
        for (const proc of proceduresNoReturn) {
            const name = proc[0];
            const args = proc[1];
            
            // Bloc d'appel (procedures_callnoreturn)
            const callBlock = Blockly.utils.xml.createElement('block');
            callBlock.setAttribute('type', 'procedures_callnoreturn');
            callBlock.setAttribute('gap', '16');
            const callMutation = Blockly.utils.xml.createElement('mutation');
            callMutation.setAttribute('name', name);
            for (const arg of args) {
                const argElement = Blockly.utils.xml.createElement('arg');
                argElement.setAttribute('name', arg);
                callMutation.appendChild(argElement);
            }
            callBlock.appendChild(callMutation);
            flyoutXML.appendChild(callBlock);
        }
        
        // Ajouter les blocs d'appel pour les fonctions avec retour
        for (const proc of proceduresWithReturn) {
            const name = proc[0];
            const args = proc[1];
            
            // Bloc d'appel (procedures_callreturn)
            const callBlock = Blockly.utils.xml.createElement('block');
            callBlock.setAttribute('type', 'procedures_callreturn');
            callBlock.setAttribute('gap', '16');
            const callMutation = Blockly.utils.xml.createElement('mutation');
            callMutation.setAttribute('name', name);
            for (const arg of args) {
                const argElement = Blockly.utils.xml.createElement('arg');
                argElement.setAttribute('name', arg);
                callMutation.appendChild(argElement);
            }
            callBlock.appendChild(callMutation);
            flyoutXML.appendChild(callBlock);
        }
        
        flyout.show(flyoutXML);
        setTimeout(() => this.adjustFlyoutPosition(), 50);
    }

    /**
     * Sauvegarde l'état des sections repliées
     */
    saveCollapsedState() {
        const state = Array.from(this.collapsedSections);
        localStorage.setItem('custom_toolbox_collapsed', JSON.stringify(state));
    }

    /**
     * Charge l'état sauvegardé
     */
    loadCollapsedState() {
        try {
            const saved = localStorage.getItem('custom_toolbox_collapsed');
            if (saved) {
                return JSON.parse(saved);
            } else {
                // Par défaut, fermer les sections Cutebot, Barrières et Portillon
                return ['CUTEBOT', 'BARRIÈRES', 'PORTILLON'];
            }
        } catch (e) {
            return ['CUTEBOT', 'BARRIÈRES', 'PORTILLON'];
        }
    }
}

// Instance globale (déclarée dans app.js)

/**
 * Initialise la toolbox personnalisée
 */
function initCustomToolbox(workspace) {
    const instance = new CustomToolbox(workspace);
    return instance;
}
