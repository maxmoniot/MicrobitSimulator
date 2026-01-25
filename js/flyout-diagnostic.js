/**
 * DIAGNOSTIC COMPLET DU PROBLÈME DE FLYOUT
 * Ne modifie RIEN - juste observe et trace
 */

window.FlyoutDiagnostic = {
    
    /**
     * Liste TOUS les flyouts dans le DOM
     */
    listAllFlyouts() {
        console.log('\n' + '='.repeat(80));
        console.log('📋 LISTING ALL FLYOUT ELEMENTS IN DOM');
        console.log('='.repeat(80));
        
        const allFlyouts = document.querySelectorAll('[class*="flyout" i], [class*="Flyout" i]');
        console.log(`\n Found ${allFlyouts.length} elements with "flyout" in class name:\n`);
        
        allFlyouts.forEach((el, index) => {
            const rect = el.getBoundingClientRect();
            const computed = window.getComputedStyle(el);
            const classes = el.className?.baseVal || el.className || 'no class';
            
            console.log(`[${index}] ${el.tagName}`);
            console.log(`    Classes: ${classes}`);
            console.log(`    Position: left=${rect.left}px, top=${rect.top}px`);
            console.log(`    Size: width=${rect.width}px, height=${rect.height}px`);
            console.log(`    Display: ${computed.display}`);
            console.log(`    Visibility: ${computed.visibility}`);
            console.log(`    Z-index: ${computed.zIndex}`);
            
            // Identifier le type
            if (classes.includes('Trashcan')) {
                console.log(`    🗑️  TYPE: TRASHCAN FLYOUT`);
            } else if (classes.includes('flyout')) {
                console.log(`    📦 TYPE: TOOLBOX FLYOUT (probably)`);
            }
            
            // Trouver le parent SVG
            let svg = el;
            while (svg && svg.tagName !== 'svg') {
                svg = svg.parentElement;
            }
            if (svg && svg.tagName === 'svg') {
                const svgRect = svg.getBoundingClientRect();
                console.log(`    SVG parent: left=${svgRect.left}px, width=${svgRect.width}px`);
            }
            
            console.log('');
        });
        
        console.log('='.repeat(80) + '\n');
    },
    
    /**
     * Trace l'état du workspace principal
     */
    traceWorkspace(workspace) {
        console.log('\n' + '='.repeat(80));
        console.log('🖼️  WORKSPACE STATE');
        console.log('='.repeat(80));
        
        const injectionDiv = workspace.getInjectionDiv();
        const svg = injectionDiv.querySelector('svg.blocklySvg');
        
        if (svg) {
            const svgRect = svg.getBoundingClientRect();
            console.log(`Main SVG: left=${svgRect.left}px, width=${svgRect.width}px`);
            
            const workspaceGroup = svg.querySelector('g.blocklyWorkspace');
            if (workspaceGroup) {
                const transform = workspaceGroup.getAttribute('transform');
                console.log(`Workspace group transform: ${transform}`);
                
                if (transform) {
                    const match = transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
                    if (match) {
                        console.log(`  ⚠️  X offset: ${match[1]}px (should be 0)`);
                        console.log(`  Y offset: ${match[2]}px`);
                    }
                }
            }
        }
        
        console.log('='.repeat(80) + '\n');
    },
    
    /**
     * Trace l'objet flyout de Blockly
     */
    traceFlyoutObject(workspace) {
        console.log('\n' + '='.repeat(80));
        console.log('🔍 BLOCKLY FLYOUT OBJECT');
        console.log('='.repeat(80));
        
        const flyout = workspace.getFlyout();
        
        if (!flyout) {
            console.log('❌ No flyout object found');
            return;
        }
        
        console.log('✅ Flyout object exists');
        console.log(`Type: ${flyout.constructor.name}`);
        
        // Propriétés importantes
        console.log('\nProperties:');
        console.log(`  - autoClose: ${flyout.autoClose}`);
        console.log(`  - isVisible_: ${flyout.isVisible_}`);
        console.log(`  - targetWorkspace_:`, flyout.targetWorkspace_ ? '✅' : '❌');
        console.log(`  - workspace_:`, flyout.workspace_ ? '✅' : '❌');
        console.log(`  - svgGroup_:`, flyout.svgGroup_ ? '✅' : '❌');
        
        // Trouver le DOM element via svgGroup_
        if (flyout.svgGroup_) {
            console.log('\nFinding DOM element via svgGroup_:');
            
            let currentElement = flyout.svgGroup_;
            let depth = 0;
            
            while (currentElement && depth < 10) {
                const classes = currentElement.className?.baseVal || currentElement.className || 'no class';
                console.log(`  ${depth}: <${currentElement.tagName}> class="${classes}"`);
                
                if (currentElement.tagName === 'svg') {
                    const rect = currentElement.getBoundingClientRect();
                    console.log(`       📍 SVG position: left=${rect.left}px, width=${rect.width}px`);
                    
                    if (classes.includes('Trashcan')) {
                        console.log(`       🗑️  This is the TRASHCAN flyout!`);
                    } else {
                        console.log(`       📦 This is the TOOLBOX flyout!`);
                    }
                    break;
                }
                
                currentElement = currentElement.parentElement;
                depth++;
            }
        }
        
        console.log('='.repeat(80) + '\n');
    },
    
    /**
     * Moniteur en temps réel des changements
     */
    startMonitoring(workspace) {
        console.log('\n🔍 STARTING REAL-TIME MONITORING...');
        console.log('This will log every change to flyout elements.\n');
        
        const injectionDiv = workspace.getInjectionDiv();
        
        // Observer tous les changements dans injection div
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                const target = mutation.target;
                const classes = target.className?.baseVal || target.className || '';
                
                // On ne s'intéresse qu'aux flyouts
                if (typeof classes === 'string' && classes.toLowerCase().includes('flyout')) {
                    console.log(`\n🔄 MUTATION DETECTED`);
                    console.log(`   Element: <${target.tagName}> class="${classes}"`);
                    console.log(`   Type: ${mutation.type}`);
                    
                    if (mutation.type === 'attributes') {
                        console.log(`   Attribute: ${mutation.attributeName}`);
                        console.log(`   New value: ${target.getAttribute(mutation.attributeName)}`);
                    }
                    
                    const rect = target.getBoundingClientRect();
                    console.log(`   Position: left=${rect.left}px, width=${rect.width}px`);
                }
            });
        });
        
        observer.observe(injectionDiv, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeOldValue: true
        });
        
        this.observer = observer;
        
        console.log('✅ Monitoring active. Open a category to see what happens.\n');
    },
    
    /**
     * Stop le monitoring
     */
    stopMonitoring() {
        if (this.observer) {
            this.observer.disconnect();
            console.log('\n❌ Monitoring stopped.\n');
        }
    },
    
    /**
     * Diagnostic complet
     */
    fullDiagnostic(workspace) {
        this.listAllFlyouts();
        this.traceWorkspace(workspace);
        this.traceFlyoutObject(workspace);
    },
    
    /**
     * Compare avant/après l'ouverture d'un flyout
     */
    async compareBeforeAfter(workspace, categoryShowFunction) {
        console.log('\n' + '='.repeat(80));
        console.log('📸 BEFORE/AFTER COMPARISON');
        console.log('='.repeat(80));
        
        console.log('\n--- BEFORE opening flyout ---');
        this.fullDiagnostic(workspace);
        
        // Attendre que l'utilisateur ouvre manuellement
        console.log('\n⏳ Now open a category...');
        console.log('   Then call: FlyoutDiagnostic.captureAfter(workspace)\n');
    },
    
    captureAfter(workspace) {
        console.log('\n--- AFTER opening flyout ---');
        this.fullDiagnostic(workspace);
        
        console.log('\n🔍 ANALYSIS:');
        console.log('Compare the two states above to find what changed!');
        console.log('Pay special attention to:');
        console.log('  - Which flyout is visible (Trashcan vs Toolbox)');
        console.log('  - Position values (left, transform)');
        console.log('  - Any element that moved 60px\n');
    }
};

// Exposer globalement
window.FlyoutDiag = window.FlyoutDiagnostic;

console.log('');
console.log('='.repeat(80));
console.log('🔬 FLYOUT DIAGNOSTIC TOOL LOADED');
console.log('='.repeat(80));
console.log('');
console.log('Available commands:');
console.log('  FlyoutDiag.fullDiagnostic(workspace)  - Complete diagnostic');
console.log('  FlyoutDiag.listAllFlyouts()           - List all flyout elements');
console.log('  FlyoutDiag.traceWorkspace(workspace)  - Check workspace state');
console.log('  FlyoutDiag.traceFlyoutObject(workspace) - Check Blockly flyout object');
console.log('  FlyoutDiag.startMonitoring(workspace) - Monitor changes in real-time');
console.log('  FlyoutDiag.stopMonitoring()           - Stop monitoring');
console.log('');
console.log('BEFORE/AFTER WORKFLOW:');
console.log('  1. FlyoutDiag.compareBeforeAfter(workspace)');
console.log('  2. Open a category manually');
console.log('  3. FlyoutDiag.captureAfter(workspace)');
console.log('');
console.log('='.repeat(80));
console.log('');
