/**
 * Gestionnaire des panneaux de simulateurs
 * - Drag & drop pour réorganiser
 * - Collapse/expand avec flèche
 * - Redimensionnement vertical
 */

class SimulatorPanelsManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            return;
        }
        
        this.panels = [];
        this.draggedPanel = null;
        this.resizingPanel = null;
        this.resizeStartY = 0;
        this.resizeStartHeight = 0;
        this.initialPanelHeights = null; // Hauteurs sauvegardées au début du resize
        
        // Garder une trace des panneaux déjà configurés pour éviter les doublons
        this.configuredPanels = new WeakSet();
        
        this.init();
    }
    
    init() {
        // Collecter tous les panneaux
        this.panels = Array.from(this.container.querySelectorAll('.sim-panel'));
        
        this.panels.forEach(panel => {
            this.setupPanel(panel);
        });
        
        // Event listeners globaux pour le resize
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        
        // Distribuer l'espace initial
        this.distributeSpace();
    }
    
    setupPanel(panel) {
        // Éviter de configurer deux fois le même panneau
        if (this.configuredPanels.has(panel)) {
            return;
        }
        this.configuredPanels.add(panel);
        
        const header = panel.querySelector('.sim-panel-header');
        const collapseBtn = panel.querySelector('.collapse-btn');
        const resizeHandle = panel.querySelector('.sim-panel-resize');
        
        if (!header) return;
        
        // === CLICK TO TOGGLE (avec détection drag) ===
        let clickStartPos = null;
        let wasDragged = false;
        
        header.addEventListener('mousedown', (e) => {
            // Ignorer si c'est sur un bouton (collapse, edit, etc.)
            if (e.target.closest('.collapse-btn') || e.target.closest('button') || e.target.closest('.radio-panel-controls')) return;
            clickStartPos = { x: e.clientX, y: e.clientY };
            wasDragged = false;
        });
        
        header.addEventListener('mouseup', (e) => {
            // Ignorer si c'est sur un bouton (collapse, edit, etc.)
            if (e.target.closest('.collapse-btn') || e.target.closest('button') || e.target.closest('.radio-panel-controls')) return;
            
            if (clickStartPos && !wasDragged) {
                // Vérifier que la souris n'a pas trop bougé (tolérance de 5px)
                const dx = Math.abs(e.clientX - clickStartPos.x);
                const dy = Math.abs(e.clientY - clickStartPos.y);
                if (dx < 5 && dy < 5) {
                    this.togglePanel(panel);
                }
            }
            clickStartPos = null;
        });
        
        // === DRAG & DROP ===
        header.setAttribute('draggable', 'true');
        
        header.addEventListener('dragstart', (e) => {
            // Ne pas drag si on clique sur le bouton collapse
            if (e.target.closest('.collapse-btn')) {
                e.preventDefault();
                return;
            }
            wasDragged = true; // Marquer qu'un drag a eu lieu
            this.draggedPanel = panel;
            panel.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', panel.dataset.id);
        });
        
        header.addEventListener('dragend', () => {
            panel.classList.remove('dragging');
            this.draggedPanel = null;
            this.clearDropIndicators();
            clickStartPos = null; // Reset au cas où
        });
        
        panel.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!this.draggedPanel || this.draggedPanel === panel) return;
            
            e.dataTransfer.dropEffect = 'move';
            
            const rect = panel.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            
            this.clearDropIndicators();
            
            if (e.clientY < midY) {
                panel.classList.add('drop-before');
            } else {
                panel.classList.add('drop-after');
            }
        });
        
        panel.addEventListener('dragleave', () => {
            panel.classList.remove('drop-before', 'drop-after');
        });
        
        panel.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!this.draggedPanel || this.draggedPanel === panel) return;
            
            const rect = panel.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            
            if (e.clientY < midY) {
                this.container.insertBefore(this.draggedPanel, panel);
            } else {
                this.container.insertBefore(this.draggedPanel, panel.nextSibling);
            }
            
            this.clearDropIndicators();
            this.updatePanelsOrder();
        });
        
        // === COLLAPSE/EXPAND via bouton ===
        if (collapseBtn) {
            collapseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePanel(panel);
            });
        }
        
        // === RESIZE ===
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Récupérer le panneau parent au moment du clic
                const targetPanel = e.currentTarget.closest('.sim-panel');
                if (!targetPanel) return;
                
                // S'assurer qu'on n'est pas déjà en train de resize
                if (this.resizingPanel) {
                    this.resizingPanel.classList.remove('resizing');
                }
                
                // IMPORTANT: Sauvegarder les hauteurs initiales de TOUS les panneaux
                // avant de les fixer. Cela permet de calculer l'espace récupérable.
                this.initialPanelHeights = new Map();
                this.panels.forEach(p => {
                    if (p.style.display !== 'none' && !p.classList.contains('collapsed')) {
                        this.initialPanelHeights.set(p, p.offsetHeight);
                    }
                });
                
                // Fixer la hauteur de tous les panneaux visibles non-collapsed
                this.panels.forEach(p => {
                    if (p.style.display !== 'none' && !p.classList.contains('collapsed')) {
                        const currentHeight = p.offsetHeight;
                        p.style.flex = `0 0 ${currentHeight}px`;
                    }
                });
                
                this.resizingPanel = targetPanel;
                this.resizeStartY = e.clientY;
                this.resizeStartHeight = targetPanel.offsetHeight;
                
                document.body.style.cursor = 'ns-resize';
                document.body.style.userSelect = 'none';
                targetPanel.classList.add('resizing');
            });
        }
    }
    
    onMouseMove(e) {
        if (!this.resizingPanel) return;
        
        const deltaY = e.clientY - this.resizeStartY;
        const minExpandedHeight = 80;
        
        // Nouvelle hauteur souhaitée
        let desiredHeight = this.resizeStartHeight + deltaY;
        desiredHeight = Math.max(60, desiredHeight); // Minimum 60px
        
        // Calculer l'index du panneau en cours de resize
        const resizingIndex = this.panels.indexOf(this.resizingPanel);
        
        // Collecter les panneaux en dessous qui sont expanded et visibles
        const panelsBelow = [];
        for (let i = resizingIndex + 1; i < this.panels.length; i++) {
            const p = this.panels[i];
            if (p.style.display !== 'none' && !p.classList.contains('collapsed')) {
                panelsBelow.push(p);
            }
        }
        
        // Si on agrandit, il faut prendre de l'espace aux panneaux en dessous
        if (desiredHeight > this.resizeStartHeight) {
            const extraNeeded = desiredHeight - this.resizeStartHeight;
            
            // Calculer l'espace total récupérable des panneaux en dessous
            let totalRecoverable = 0;
            panelsBelow.forEach(p => {
                const initialHeight = this.initialPanelHeights.get(p) || minExpandedHeight;
                totalRecoverable += Math.max(0, initialHeight - minExpandedHeight);
            });
            
            // Limiter l'agrandissement à l'espace récupérable
            const actualExtra = Math.min(extraNeeded, totalRecoverable);
            desiredHeight = this.resizeStartHeight + actualExtra;
            
            // Répartir la réduction sur les panneaux en dessous
            let remainingToTake = actualExtra;
            panelsBelow.forEach(p => {
                const initialHeight = this.initialPanelHeights.get(p) || minExpandedHeight;
                const canTake = Math.max(0, initialHeight - minExpandedHeight);
                const take = Math.min(remainingToTake, canTake);
                
                const newHeight = initialHeight - take;
                p.style.flex = `0 0 ${newHeight}px`;
                remainingToTake -= take;
                
                // Callback pour le panneau redimensionné
                this.onPanelResize(p);
            });
        } else {
            // Si on réduit, restaurer les panneaux en dessous à leur taille initiale
            panelsBelow.forEach(p => {
                const initialHeight = this.initialPanelHeights.get(p);
                if (initialHeight) {
                    p.style.flex = `0 0 ${initialHeight}px`;
                    this.onPanelResize(p);
                }
            });
        }
        
        // Appliquer la nouvelle hauteur au panneau qu'on resize
        this.resizingPanel.style.flex = `0 0 ${desiredHeight}px`;
        
        // Callback pour redimensionner le contenu (canvas, etc.)
        this.onPanelResize(this.resizingPanel);
    }
    
    onMouseUp(e) {
        if (this.resizingPanel) {
            this.resizingPanel.classList.remove('resizing');
            this.resizingPanel = null;
            this.initialPanelHeights = null; // Nettoyer les hauteurs sauvegardées
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    }
    
    togglePanel(panel) {
        const content = panel.querySelector('.sim-panel-content');
        const collapseBtn = panel.querySelector('.collapse-btn');
        const resizeHandle = panel.querySelector('.sim-panel-resize');
        const isCollapsed = panel.classList.contains('collapsed');
        
        if (isCollapsed) {
            // Expand
            panel.classList.remove('collapsed');
            if (collapseBtn) collapseBtn.classList.remove('collapsed');
            if (resizeHandle) resizeHandle.style.display = '';
            
            // Temporairement mettre en flex auto pour calculer
            panel.style.flex = '1 1 auto';
            
            // Redistribuer l'espace équitablement entre tous les panneaux ouverts
            this.redistributeSpaceEqually();
            
            // Callback après expansion
            setTimeout(() => this.onPanelResize(panel), 50);
        } else {
            // Collapse - sauvegarder la hauteur actuelle
            panel.dataset.savedHeight = panel.offsetHeight;
            panel.classList.add('collapsed');
            if (collapseBtn) collapseBtn.classList.add('collapsed');
            if (resizeHandle) resizeHandle.style.display = 'none';
            
            // Hauteur minimale (juste le header)
            panel.style.flex = '0 0 auto';
            
            // Redistribuer l'espace libéré
            this.redistributeSpaceEqually();
        }
    }
    
    /**
     * Redistribue l'espace équitablement entre tous les panneaux ouverts
     */
    redistributeSpaceEqually() {
        const containerHeight = this.container.clientHeight;
        const gap = 2;
        const headerHeight = 36;
        const padding = 8; // padding top + bottom du container
        
        // Séparer les panneaux visibles en collapsed et expanded
        const visiblePanels = this.panels.filter(p => p.style.display !== 'none');
        const collapsedPanels = visiblePanels.filter(p => p.classList.contains('collapsed'));
        const expandedPanels = visiblePanels.filter(p => !p.classList.contains('collapsed'));
        
        if (expandedPanels.length === 0) return;
        
        // Calculer l'espace utilisé par les panneaux collapsed (juste le header)
        const collapsedSpace = collapsedPanels.length * headerHeight;
        
        // Calculer l'espace total pour les gaps entre panneaux
        const totalGaps = (visiblePanels.length - 1) * gap;
        
        // Espace disponible pour les panneaux expanded
        const availableSpace = containerHeight - collapsedSpace - padding - totalGaps;
        
        // Hauteur par panneau expanded
        const heightPerPanel = Math.floor(availableSpace / expandedPanels.length);
        
        // Appliquer la hauteur à chaque panneau expanded
        expandedPanels.forEach(panel => {
            const finalHeight = Math.max(80, heightPerPanel); // minimum 80px
            panel.style.flex = `0 0 ${finalHeight}px`;
        });
        
        // Callback pour chaque panneau redimensionné
        expandedPanels.forEach(panel => {
            this.onPanelResize(panel);
        });
    }
    
    distributeSpace() {
        // Utiliser la redistribution équitable
        this.redistributeSpaceEqually();
    }
    
    clearDropIndicators() {
        this.panels.forEach(p => {
            p.classList.remove('drop-before', 'drop-after');
        });
    }
    
    updatePanelsOrder() {
        // Mettre à jour la liste des panneaux selon l'ordre DOM actuel
        this.panels = Array.from(this.container.querySelectorAll('.sim-panel'));
    }
    
    onPanelResize(panel) {
        // Callbacks spécifiques selon le simulateur
        const panelId = panel.dataset.id;
        
        if (panelId === 'cutebot') {
            // Initialiser le simulateur s'il n'existe pas encore
            if (typeof simulator === 'undefined' || !simulator) {
                if (typeof initSimulator === 'function') {
                    initSimulator();
                }
            }
            // Redimensionner si le simulateur existe
            if (typeof simulator !== 'undefined' && simulator) {
                setTimeout(() => simulator.resizeCanvas(), 10);
            }
        }
        
        if (panelId === 'microbit' && typeof microbitSim !== 'undefined' && microbitSim) {
            // Le micro:bit SVG s'adapte automatiquement
        }
        
        if (panelId === 'barrier' && typeof barrierSimulator !== 'undefined' && barrierSimulator) {
            // Le SVG des barrières s'adapte automatiquement
        }
    }
    
    // API publique pour ajouter un nouveau simulateur
    addPanel(config) {
        const { id, title, icon, content } = config;
        
        const panel = document.createElement('div');
        panel.className = 'sim-panel';
        panel.dataset.id = id;
        
        panel.innerHTML = `
            <div class="sim-panel-header">
                <button class="collapse-btn" title="Réduire/Agrandir">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <span class="sim-panel-icon">${icon}</span>
                <span class="sim-panel-title">${title}</span>
                <span class="drag-hint">⋮⋮</span>
            </div>
            <div class="sim-panel-content">${content}</div>
            <div class="sim-panel-resize"><div class="resize-handle"></div></div>
        `;
        
        this.container.appendChild(panel);
        this.panels.push(panel);
        this.setupPanel(panel);
        this.distributeSpace();
        
        return panel;
    }
    
    // Récupérer un panneau par son ID
    getPanel(id) {
        return this.panels.find(p => p.dataset.id === id);
    }
    
    // Enregistrer un panneau existant créé dynamiquement
    registerPanel(panel) {
        if (!panel) return;
        
        // Vérifier si le panneau est déjà configuré
        if (this.configuredPanels.has(panel)) {
            // Même s'il est déjà configuré, s'assurer que le tableau est à jour
            if (!this.panels.includes(panel)) {
                this.updatePanelsOrder();
            }
            return;
        }
        
        // IMPORTANT: D'abord configurer le panneau avec les event listeners
        // AVANT de mettre à jour l'ordre des panneaux
        // Cela garantit que le resize handle est actif immédiatement
        this.setupPanel(panel);
        
        // Ensuite synchroniser le tableau avec l'ordre DOM actuel
        this.updatePanelsOrder();
        
        // Forcer un reflow pour s'assurer que le layout est calculé
        panel.offsetHeight;
        
        // Redistribuer l'espace
        this.distributeSpace();
        
        // Forcer encore un reflow pour stabiliser le layout
        void panel.offsetHeight;
    }
}

// Instance globale
let simulatorPanels = null;

function initSimulatorPanels() {
    simulatorPanels = new SimulatorPanelsManager('simulatorsContainer');
    window.simulatorPanels = simulatorPanels; // Exposer globalement
}

// Export
window.SimulatorPanelsManager = SimulatorPanelsManager;
window.initSimulatorPanels = initSimulatorPanels;
