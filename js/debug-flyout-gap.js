/**
 * DEBUG TOTAL - Problème de décalage du flyout (~60px)
 * Ce fichier trace TOUT ce qui se passe pour trouver la source du problème
 */

(function() {
    'use strict';
    
    // Stocker toutes les traces
    const TRACE = [];
    const startTime = performance.now();
    
    function log(category, message, data = null) {
        const timestamp = (performance.now() - startTime).toFixed(2);
        const entry = { timestamp, category, message, data };
        TRACE.push(entry);
        console.log(`[${timestamp}ms] [${category}] ${message}`, data || '');
    }
    
    // ============================================================
    // 1. OBSERVATION DU DOM AU CHARGEMENT
    // ============================================================
    
    log('INIT', '🚀 Debug flyout gap - démarrage');
    
    // Observer les mutations DOM
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            // On s'intéresse aux éléments Blockly
            const target = mutation.target;
            const classes = target.className?.baseVal || target.className || '';
            
            // Filtrer uniquement les éléments blockly pertinents
            if (classes.includes('blockly') || 
                classes.includes('flyout') ||
                target.id === 'blocklyDiv' ||
                target.closest?.('#blocklyDiv')) {
                
                if (mutation.type === 'attributes') {
                    // Changement d'attribut intéressant
                    const attr = mutation.attributeName;
                    if (['style', 'transform', 'width', 'x', 'class', 'd'].includes(attr)) {
                        const newValue = target.getAttribute(attr);
                        // Log uniquement si c'est un changement de position/taille
                        if (attr === 'style' || attr === 'transform' || attr === 'x' || attr === 'width') {
                            log('DOM-ATTR', `${target.tagName}.${classes} : ${attr} changé`, newValue);
                        }
                    }
                }
                else if (mutation.type === 'childList') {
                    // Nouveau child ajouté - on log si c'est un SVG ou un groupe
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            const nodeClasses = node.className?.baseVal || node.className || '';
                            if (node.tagName === 'svg' || node.tagName === 'g' || nodeClasses.includes('flyout')) {
                                log('DOM-ADD', `Ajout ${node.tagName}.${nodeClasses}`, null);
                            }
                        }
                    });
                }
            }
        });
    });
    
    // ============================================================
    // 2. FONCTIONS D'ANALYSE
    // ============================================================
    
    window.DebugFlyoutGap = {
        /**
         * Analyse complète de l'état actuel
         */
        analyzeNow: function() {
            console.log('\n' + '='.repeat(70));
            console.log('📊 ANALYSE COMPLÈTE DU DÉCALAGE FLYOUT');
            console.log('='.repeat(70));
            
            // 1. Position du conteneur Blockly
            const blocklyDiv = document.getElementById('blocklyDiv');
            if (blocklyDiv) {
                const rect = blocklyDiv.getBoundingClientRect();
                console.log('\n1️⃣ #blocklyDiv');
                console.log(`   BoundingRect: left=${rect.left.toFixed(1)}px, width=${rect.width.toFixed(1)}px`);
            }
            
            // 2. Position de la toolbox custom
            const customToolbox = document.getElementById('customToolbox');
            if (customToolbox) {
                const rect = customToolbox.getBoundingClientRect();
                console.log('\n2️⃣ #customToolbox');
                console.log(`   BoundingRect: left=${rect.left.toFixed(1)}px, right=${rect.right.toFixed(1)}px, width=${rect.width.toFixed(1)}px`);
            }
            
            // 3. Injection div
            const injectionDiv = document.querySelector('.injectionDiv');
            if (injectionDiv) {
                const rect = injectionDiv.getBoundingClientRect();
                const computed = getComputedStyle(injectionDiv);
                console.log('\n3️⃣ .injectionDiv');
                console.log(`   BoundingRect: left=${rect.left.toFixed(1)}px, width=${rect.width.toFixed(1)}px`);
                console.log(`   Computed: marginLeft=${computed.marginLeft}, paddingLeft=${computed.paddingLeft}`);
            }
            
            // 4. TOUS les SVG dans blocklyDiv
            const svgs = document.querySelectorAll('#blocklyDiv svg');
            console.log(`\n4️⃣ Tous les SVG dans #blocklyDiv (${svgs.length} trouvés)`);
            svgs.forEach((svg, i) => {
                const rect = svg.getBoundingClientRect();
                const classes = svg.className?.baseVal || '';
                // Identifier le type de SVG
                let type = '?';
                if (classes.includes('blocklySvg')) type = 'MAIN';
                else if (svg.closest('.blocklyFlyout')) type = 'FLYOUT';
                else if (svg.closest('.blocklyScrollbar')) type = 'SCROLLBAR';
                
                console.log(`   [${i}] ${type} : left=${rect.left.toFixed(1)}px, width=${rect.width.toFixed(1)}px (${classes.substring(0, 30)})`);
            });
            
            // 5. Éléments avec classe flyout
            const flyouts = document.querySelectorAll('[class*="flyout"], [class*="Flyout"]');
            console.log(`\n5️⃣ Éléments avec "flyout" dans la classe (${flyouts.length} trouvés)`);
            flyouts.forEach((el, i) => {
                const rect = el.getBoundingClientRect();
                const classes = el.className?.baseVal || el.className || '';
                const tag = el.tagName;
                const display = getComputedStyle(el).display;
                console.log(`   [${i}] <${tag}> left=${rect.left.toFixed(1)}px, width=${rect.width.toFixed(1)}px, display=${display}`);
                console.log(`       classes: ${classes.substring(0, 60)}`);
            });
            
            // 6. Recherche du décalage de 60px
            console.log('\n6️⃣ RECHERCHE DU DÉCALAGE DE 60px');
            const customRight = customToolbox ? customToolbox.getBoundingClientRect().right : 0;
            console.log(`   Bord droit de la toolbox custom: ${customRight.toFixed(1)}px`);
            
            // Chercher tout élément dont le bord gauche est à ~60px après la toolbox
            document.querySelectorAll('#blocklyDiv *').forEach(el => {
                const rect = el.getBoundingClientRect();
                const gap = rect.left - customRight;
                // Si gap proche de 60px et élément visible
                if (Math.abs(gap - 60) < 10 && rect.width > 50) {
                    const classes = el.className?.baseVal || el.className || '';
                    const tag = el.tagName;
                    console.log(`   ⚠️ GAP ~60px trouvé: <${tag}> left=${rect.left.toFixed(1)}px (gap=${gap.toFixed(1)}px)`);
                    console.log(`      classes: ${classes.substring(0, 60)}`);
                }
            });
            
            // 7. Background du flyout
            const flyoutBgs = document.querySelectorAll('.blocklyFlyoutBackground');
            console.log(`\n7️⃣ Backgrounds de flyout (${flyoutBgs.length} trouvés)`);
            flyoutBgs.forEach((bg, i) => {
                const x = bg.getAttribute('x');
                const width = bg.getAttribute('width');
                const fill = bg.getAttribute('fill');
                const rect = bg.getBoundingClientRect();
                console.log(`   [${i}] x=${x}, width=${width}, fill=${fill}`);
                console.log(`       BoundingRect: left=${rect.left.toFixed(1)}px, width=${rect.width.toFixed(1)}px`);
            });
            
            // 8. Transform des groupes SVG
            const groups = document.querySelectorAll('#blocklyDiv g[transform]');
            console.log(`\n8️⃣ Groupes avec transform (${groups.length} trouvés, max 20 affichés)`);
            let count = 0;
            groups.forEach(g => {
                if (count >= 20) return;
                const transform = g.getAttribute('transform');
                if (transform && transform.includes('translate')) {
                    const classes = g.className?.baseVal || '';
                    // Extraire le translate
                    const match = transform.match(/translate\(([-\d.]+),?\s*([-\d.]+)?\)/);
                    if (match) {
                        const x = parseFloat(match[1]);
                        // Afficher si translation X significative
                        if (Math.abs(x) > 5) {
                            console.log(`   <g> translateX=${x.toFixed(1)}px (${classes.substring(0, 30)})`);
                            count++;
                        }
                    }
                }
            });
            
            console.log('\n' + '='.repeat(70));
            console.log('📋 Tapez DebugFlyoutGap.showTrace() pour voir l\'historique complet');
            console.log('='.repeat(70) + '\n');
        },
        
        /**
         * Affiche la trace complète
         */
        showTrace: function() {
            console.log('\n📜 TRACE COMPLÈTE (' + TRACE.length + ' entrées):');
            TRACE.forEach(entry => {
                console.log(`[${entry.timestamp}ms] [${entry.category}] ${entry.message}`, entry.data || '');
            });
        },
        
        /**
         * Mesure précise du gap
         */
        measureGap: function() {
            const customToolbox = document.getElementById('customToolbox');
            const flyoutBgs = document.querySelectorAll('.blocklyFlyoutBackground');
            
            if (!customToolbox || flyoutBgs.length === 0) {
                console.log('❌ Éléments non trouvés');
                return;
            }
            
            const toolboxRight = customToolbox.getBoundingClientRect().right;
            
            console.log('\n📏 MESURE PRÉCISE DU GAP');
            console.log(`Bord droit toolbox: ${toolboxRight.toFixed(1)}px`);
            
            flyoutBgs.forEach((bg, i) => {
                const rect = bg.getBoundingClientRect();
                const gap = rect.left - toolboxRight;
                console.log(`\nFlyout background [${i}]:`);
                console.log(`  Bord gauche: ${rect.left.toFixed(1)}px`);
                console.log(`  GAP = ${gap.toFixed(1)}px`);
                
                // Trouver la source du gap en remontant le DOM
                console.log('  Remontée DOM pour trouver la source:');
                let current = bg;
                while (current && current !== document.body) {
                    const rect = current.getBoundingClientRect();
                    const tag = current.tagName;
                    const classes = current.className?.baseVal || current.className || '';
                    const transform = current.getAttribute?.('transform') || '';
                    const style = current.getAttribute?.('style') || '';
                    
                    // Si c'est un élément intéressant
                    if (tag === 'g' || tag === 'svg' || classes.includes('blockly') || classes.includes('flyout')) {
                        let info = `    ${tag}.${classes.substring(0, 20)}`;
                        if (transform) info += ` transform="${transform.substring(0, 40)}"`;
                        if (rect.left > toolboxRight + 5) {
                            info += ` ← left=${rect.left.toFixed(1)}px`;
                        }
                        console.log(info);
                    }
                    current = current.parentElement;
                }
            });
        },
        
        /**
         * Analyse quand le flyout s'ouvre
         */
        watchFlyoutOpen: function() {
            console.log('👁️ Surveillance activée. Ouvrez une catégorie...');
            
            const customToolbox = document.getElementById('customToolbox');
            const toolboxRight = customToolbox ? customToolbox.getBoundingClientRect().right : 0;
            
            const obs = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    const target = mutation.target;
                    const classes = target.className?.baseVal || target.className || '';
                    
                    // Surveiller les changements de transform ou width sur les éléments flyout
                    if (classes.includes('flyout') || classes.includes('Flyout')) {
                        if (mutation.type === 'attributes') {
                            const attr = mutation.attributeName;
                            const newValue = target.getAttribute(attr);
                            console.log(`🔄 ${target.tagName}.${classes.substring(0, 20)}: ${attr}="${newValue}"`);
                            
                            // Mesurer le gap à chaque changement
                            const rect = target.getBoundingClientRect();
                            const gap = rect.left - toolboxRight;
                            console.log(`   → Position: left=${rect.left.toFixed(1)}px, gap=${gap.toFixed(1)}px`);
                        }
                    }
                });
            });
            
            const blocklyDiv = document.getElementById('blocklyDiv');
            if (blocklyDiv) {
                obs.observe(blocklyDiv, {
                    attributes: true,
                    attributeFilter: ['style', 'transform', 'width', 'x', 'd'],
                    subtree: true
                });
            }
            
            window._flyoutWatcher = obs;
            console.log('✅ Pour arrêter: DebugFlyoutGap.stopWatch()');
        },
        
        stopWatch: function() {
            if (window._flyoutWatcher) {
                window._flyoutWatcher.disconnect();
                console.log('⏹️ Surveillance arrêtée');
            }
        },
        
        /**
         * Analyse l'état du flyout quand il est "fermé"
         */
        analyzeClosed: function() {
            console.log('\n' + '='.repeat(60));
            console.log('🔍 ANALYSE DU FLYOUT "FERMÉ"');
            console.log('='.repeat(60));
            
            const customToolbox = document.getElementById('customToolbox');
            const toolboxRight = customToolbox ? customToolbox.getBoundingClientRect().right : 0;
            console.log(`Bord droit toolbox: ${toolboxRight.toFixed(1)}px`);
            
            // Trouver tous les flyouts
            const flyouts = document.querySelectorAll('.blocklyFlyout');
            console.log(`\n${flyouts.length} flyout(s) trouvé(s):`);
            
            flyouts.forEach((flyout, i) => {
                const rect = flyout.getBoundingClientRect();
                const computed = getComputedStyle(flyout);
                const classes = flyout.className?.baseVal || '';
                const isTrashcan = classes.includes('Trashcan');
                
                console.log(`\n[${i}] ${isTrashcan ? '🗑️ TRASHCAN' : '📦 TOOLBOX'} flyout:`);
                console.log(`   Classes: ${classes}`);
                console.log(`   Display: ${computed.display}`);
                console.log(`   Width attr: ${flyout.getAttribute('width')}`);
                console.log(`   BoundingRect: left=${rect.left.toFixed(1)}px, width=${rect.width.toFixed(1)}px, right=${rect.right.toFixed(1)}px`);
                console.log(`   Transform: ${computed.transform}`);
                console.log(`   Visibility: ${computed.visibility}`);
                console.log(`   Overflow: ${computed.overflow}`);
                
                // Dépassement par rapport à la toolbox
                const overflow = rect.right - toolboxRight;
                if (overflow > 0 && !isTrashcan) {
                    console.log(`   ⚠️ DÉPASSEMENT: ${overflow.toFixed(1)}px au-delà de la toolbox`);
                }
                
                // Analyser les enfants
                const bg = flyout.querySelector('.blocklyFlyoutBackground');
                if (bg) {
                    const bgRect = bg.getBoundingClientRect();
                    console.log(`   Background: left=${bgRect.left.toFixed(1)}px, width=${bgRect.width.toFixed(1)}px`);
                }
                
                const scrollbar = flyout.querySelector('.blocklyFlyoutScrollbar, .blocklyScrollbarVertical');
                if (scrollbar) {
                    const sbRect = scrollbar.getBoundingClientRect();
                    const sbDisplay = getComputedStyle(scrollbar).display;
                    console.log(`   Scrollbar: left=${sbRect.left.toFixed(1)}px, width=${sbRect.width.toFixed(1)}px, display=${sbDisplay}`);
                }
                
                // Workspace du flyout
                const workspace = flyout.querySelector('.blocklyWorkspace');
                if (workspace) {
                    const wsRect = workspace.getBoundingClientRect();
                    console.log(`   Workspace: left=${wsRect.left.toFixed(1)}px, width=${wsRect.width.toFixed(1)}px`);
                }
            });
            
            // Chercher tout élément visible entre toolbox et workspace
            console.log('\n🔎 Éléments visibles entre toolbox et workspace principal:');
            const mainSvg = document.querySelector('.blocklySvg');
            const mainLeft = mainSvg ? mainSvg.getBoundingClientRect().left : 1000;
            
            document.querySelectorAll('#blocklyDiv *').forEach(el => {
                const rect = el.getBoundingClientRect();
                // Élément dans la zone suspecte (entre toolbox et workspace)
                if (rect.width > 0 && rect.right > toolboxRight && rect.left < mainLeft) {
                    const tag = el.tagName;
                    const classes = el.className?.baseVal || el.className || '';
                    // Ignorer les éléments trop petits
                    if (rect.width >= 10) {
                        console.log(`   <${tag}> left=${rect.left.toFixed(1)}px, right=${rect.right.toFixed(1)}px, width=${rect.width.toFixed(1)}px`);
                        console.log(`      classes: ${classes.substring(0, 50)}`);
                    }
                }
            });
            
            console.log('\n' + '='.repeat(60));
        }
    };
    
    // Démarrer l'observation DOM
    document.addEventListener('DOMContentLoaded', () => {
        log('DOM', 'DOMContentLoaded');
        
        const blocklyDiv = document.getElementById('blocklyDiv');
        if (blocklyDiv) {
            observer.observe(blocklyDiv, {
                attributes: true,
                attributeFilter: ['style', 'transform', 'width', 'x'],
                childList: true,
                subtree: true
            });
            log('DOM', 'Observer attaché à #blocklyDiv');
        }
        
        // Analyser après un délai
        setTimeout(() => {
            log('INIT', 'Analyse initiale après 2s');
            window.DebugFlyoutGap.analyzeNow();
        }, 2000);
    });
    
    console.log('');
    console.log('='.repeat(60));
    console.log('🔬 DEBUG FLYOUT GAP - CHARGÉ');
    console.log('='.repeat(60));
    console.log('Commandes disponibles:');
    console.log('  DebugFlyoutGap.analyzeNow()    - Analyse complète');
    console.log('  DebugFlyoutGap.measureGap()    - Mesure précise du gap');
    console.log('  DebugFlyoutGap.analyzeClosed() - Analyser flyout fermé');
    console.log('  DebugFlyoutGap.watchFlyoutOpen() - Surveiller ouverture');
    console.log('  DebugFlyoutGap.showTrace()     - Historique complet');
    console.log('='.repeat(60));
    console.log('');
    
})();
