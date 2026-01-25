/**
 * DIAGNOSTIC AVANCÉ - ARCHITECTURE DOM
 */

window.DeepDiagnostic = {
    
    /**
     * Analyse l'architecture DOM complète
     */
    analyzeDOMStructure(workspace) {
        console.log('\n' + '='.repeat(80));
        console.log('🏗️  COMPLETE DOM ARCHITECTURE');
        console.log('='.repeat(80));
        
        const injectionDiv = workspace.getInjectionDiv();
        const rect = injectionDiv.getBoundingClientRect();
        
        console.log(`\n📦 Injection Div:`);
        console.log(`   Position: left=${rect.left}px, width=${rect.width}px`);
        
        // Analyser tous les enfants directs
        console.log(`\n👶 Direct children of injection div:`);
        Array.from(injectionDiv.children).forEach((child, i) => {
            const childRect = child.getBoundingClientRect();
            const tag = child.tagName;
            const classes = child.className?.baseVal || child.className || 'no class';
            
            console.log(`\n[${i}] <${tag}> class="${classes}"`);
            console.log(`    Position: left=${childRect.left}px, top=${childRect.top}px`);
            console.log(`    Size: width=${childRect.width}px, height=${childRect.height}px`);
            
            // Si c'est un SVG, analyser ses enfants
            if (tag === 'svg' || tag === 'SVG') {
                console.log(`    📊 SVG children:`);
                Array.from(child.children).forEach((svgChild, j) => {
                    const svgChildClasses = svgChild.className?.baseVal || svgChild.className || 'no class';
                    console.log(`       [${j}] <${svgChild.tagName}> class="${svgChildClasses}"`);
                    
                    if (svgChild.tagName === 'g' || svgChild.tagName === 'G') {
                        const transform = svgChild.getAttribute('transform');
                        console.log(`           transform="${transform}"`);
                    }
                });
            }
        });
        
        console.log('\n' + '='.repeat(80));
    },
    
    /**
     * Trace la hiérarchie de positionnement
     */
    tracePositioning(workspace) {
        console.log('\n' + '='.repeat(80));
        console.log('📐 POSITIONING HIERARCHY');
        console.log('='.repeat(80));
        
        const toolbox = document.getElementById('customToolbox');
        if (toolbox) {
            const rect = toolbox.getBoundingClientRect();
            console.log(`\n1️⃣ Custom Toolbox (#customToolbox):`);
            console.log(`   Position: left=${rect.left}px, width=${rect.width}px`);
            console.log(`   Range: ${rect.left}px → ${rect.right}px`);
        }
        
        const blocklyDiv = document.getElementById('blocklyDiv');
        if (blocklyDiv) {
            const rect = blocklyDiv.getBoundingClientRect();
            console.log(`\n2️⃣ Blockly Container (#blocklyDiv):`);
            console.log(`   Position: left=${rect.left}px, width=${rect.width}px`);
            console.log(`   Range: ${rect.left}px → ${rect.right}px`);
        }
        
        const injectionDiv = workspace.getInjectionDiv();
        const rect = injectionDiv.getBoundingClientRect();
        console.log(`\n3️⃣ Injection Div:`);
        console.log(`   Position: left=${rect.left}px, width=${rect.width}px`);
        console.log(`   Range: ${rect.left}px → ${rect.right}px`);
        
        // Trouver tous les SVG
        const allSvgs = injectionDiv.querySelectorAll('svg');
        console.log(`\n4️⃣ All SVG elements (${allSvgs.length}):`);
        
        allSvgs.forEach((svg, i) => {
            const svgRect = svg.getBoundingClientRect();
            const classes = svg.className?.baseVal || svg.className || 'no class';
            
            console.log(`\n   [${i}] <svg> class="${classes}"`);
            console.log(`       Position: left=${svgRect.left}px, width=${svgRect.width}px`);
            console.log(`       Range: ${svgRect.left}px → ${svgRect.right}px`);
            
            // Identifier le type
            if (classes.includes('Trashcan')) {
                console.log(`       Type: 🗑️ TRASHCAN FLYOUT`);
            } else if (classes.includes('blocklyFlyout')) {
                console.log(`       Type: 📦 TOOLBOX FLYOUT`);
            } else if (classes.includes('blocklySvg')) {
                console.log(`       Type: 🖼️ MAIN WORKSPACE`);
            } else if (classes.includes('Scrollbar')) {
                console.log(`       Type: 📜 SCROLLBAR`);
            }
        });
        
        console.log('\n' + '='.repeat(80));
    },
    
    /**
     * Vérifie les superpositions
     */
    checkOverlaps(workspace) {
        console.log('\n' + '='.repeat(80));
        console.log('🔍 CHECKING FOR OVERLAPS');
        console.log('='.repeat(80));
        
        const injectionDiv = workspace.getInjectionDiv();
        const allSvgs = injectionDiv.querySelectorAll('svg');
        
        const elements = [];
        
        // Collecter tous les éléments avec leurs positions
        const toolbox = document.getElementById('customToolbox');
        if (toolbox) {
            const rect = toolbox.getBoundingClientRect();
            if (rect.width > 0) {
                elements.push({
                    name: 'Custom Toolbox',
                    left: rect.left,
                    right: rect.right,
                    width: rect.width
                });
            }
        }
        
        allSvgs.forEach((svg, i) => {
            const rect = svg.getBoundingClientRect();
            const classes = svg.className?.baseVal || svg.className || '';
            
            if (rect.width > 0) {
                let name = `SVG ${i}`;
                if (classes.includes('Trashcan')) name = 'Trashcan Flyout';
                else if (classes.includes('blocklyFlyout')) name = 'Toolbox Flyout';
                else if (classes.includes('blocklySvg')) name = 'Main Workspace';
                else if (classes.includes('Scrollbar')) name = 'Scrollbar';
                
                elements.push({
                    name: name,
                    left: rect.left,
                    right: rect.right,
                    width: rect.width
                });
            }
        });
        
        // Trier par position left
        elements.sort((a, b) => a.left - b.left);
        
        console.log('\n📊 Elements from left to right:');
        elements.forEach((el, i) => {
            console.log(`\n${i + 1}. ${el.name}`);
            console.log(`   Range: ${el.left}px → ${el.right}px (width: ${el.width}px)`);
        });
        
        // Détecter les superpositions
        console.log('\n⚠️  Overlaps detected:');
        let foundOverlap = false;
        
        for (let i = 0; i < elements.length - 1; i++) {
            for (let j = i + 1; j < elements.length; j++) {
                const el1 = elements[i];
                const el2 = elements[j];
                
                // Vérifier si el1 et el2 se superposent
                if (el1.right > el2.left) {
                    const overlapStart = el2.left;
                    const overlapEnd = Math.min(el1.right, el2.right);
                    const overlapWidth = overlapEnd - overlapStart;
                    
                    console.log(`\n   🚨 "${el1.name}" overlaps with "${el2.name}"`);
                    console.log(`      Overlap range: ${overlapStart}px → ${overlapEnd}px (${overlapWidth}px)`);
                    foundOverlap = true;
                }
            }
        }
        
        if (!foundOverlap) {
            console.log('\n   ✅ No overlaps detected!');
        }
        
        console.log('\n' + '='.repeat(80));
    },
    
    /**
     * Analyse comment Blockly calcule les métriques
     */
    analyzeMetrics(workspace) {
        console.log('\n' + '='.repeat(80));
        console.log('📏 BLOCKLY METRICS');
        console.log('='.repeat(80));
        
        const metrics = workspace.getMetrics();
        
        console.log('\nWorkspace metrics:');
        console.log('  absoluteTop:', metrics.absoluteTop);
        console.log('  absoluteLeft:', metrics.absoluteLeft);
        console.log('  viewTop:', metrics.viewTop);
        console.log('  viewLeft:', metrics.viewLeft);
        console.log('  viewWidth:', metrics.viewWidth);
        console.log('  viewHeight:', metrics.viewHeight);
        console.log('  contentTop:', metrics.contentTop);
        console.log('  contentLeft:', metrics.contentLeft);
        console.log('  contentWidth:', metrics.contentWidth);
        console.log('  contentHeight:', metrics.contentHeight);
        
        const flyout = workspace.getFlyout();
        if (flyout && flyout.workspace_) {
            const flyoutMetrics = flyout.workspace_.getMetrics();
            console.log('\nFlyout workspace metrics:');
            console.log('  absoluteTop:', flyoutMetrics.absoluteTop);
            console.log('  absoluteLeft:', flyoutMetrics.absoluteLeft);
            console.log('  viewTop:', flyoutMetrics.viewTop);
            console.log('  viewLeft:', flyoutMetrics.viewLeft);
            console.log('  viewWidth:', flyoutMetrics.viewWidth);
            console.log('  viewHeight:', flyoutMetrics.viewHeight);
            
            console.log('\n🔍 Analysis:');
            if (metrics.absoluteLeft === flyoutMetrics.absoluteLeft) {
                console.log('  ⚠️  Workspace and Flyout have SAME absoluteLeft!');
                console.log('  This means they start at the same horizontal position.');
                console.log('  Expected: Flyout should be BEFORE workspace (smaller absoluteLeft)');
            }
        }
        
        console.log('\n' + '='.repeat(80));
    },
    
    /**
     * Diagnostic complet avancé
     */
    fullAnalysis(workspace) {
        this.analyzeDOMStructure(workspace);
        this.tracePositioning(workspace);
        this.checkOverlaps(workspace);
        this.analyzeMetrics(workspace);
    }
};

window.DeepDiag = window.DeepDiagnostic;

console.log('');
console.log('='.repeat(80));
console.log('🔬 DEEP DIAGNOSTIC TOOL LOADED');
console.log('='.repeat(80));
console.log('');
console.log('Commands:');
console.log('  DeepDiag.fullAnalysis(workspace)      - Complete deep analysis');
console.log('  DeepDiag.analyzeDOMStructure(workspace) - DOM tree');
console.log('  DeepDiag.tracePositioning(workspace)   - Positioning hierarchy');
console.log('  DeepDiag.checkOverlaps(workspace)      - Find overlapping elements');
console.log('  DeepDiag.analyzeMetrics(workspace)     - Blockly metrics');
console.log('');
console.log('='.repeat(80));
console.log('');
