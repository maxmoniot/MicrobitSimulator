/**
 * Trouve où sont VRAIMENT les blocs visibles du flyout
 */
function findRealFlyout() {
    console.log('🔍 === SEARCHING FOR REAL FLYOUT ===');
    
    // 1. Trouver TOUS les blocs visibles à l'écran
    const allBlocks = document.querySelectorAll('.blocklyDraggable');
    console.log(`\n📦 Total blocks on page: ${allBlocks.length}`);
    
    const visibleBlocks = [];
    allBlocks.forEach((block, i) => {
        const rect = block.getBoundingClientRect();
        // Blocs visibles à gauche de l'écran (dans le flyout)
        if (rect.width > 0 && rect.left > 200 && rect.left < 700) {
            visibleBlocks.push({
                index: i,
                element: block,
                left: rect.left,
                top: rect.top,
                width: rect.width
            });
        }
    });
    
    console.log(`\n✅ Found ${visibleBlocks.length} visible blocks in flyout area`);
    
    if (visibleBlocks.length === 0) {
        console.log('❌ No visible blocks found. Flyout might be closed.');
        return;
    }
    
    // 2. Remonter la hiérarchie depuis le premier bloc visible
    const firstBlock = visibleBlocks[0].element;
    console.log(`\n🌲 DOM hierarchy from first visible block:`);
    
    let current = firstBlock;
    let level = 0;
    const hierarchy = [];
    
    while (current && level < 20) {
        const info = {
            level: level,
            tag: current.tagName,
            class: current.className?.baseVal || current.className,
            id: current.id,
            width: current.getBoundingClientRect?.().width,
            left: current.getBoundingClientRect?.().left,
            hasBlocklyFlyout: current.className?.baseVal?.includes?.('blocklyFlyout') || 
                             current.className?.includes?.('blocklyFlyout')
        };
        
        hierarchy.push(info);
        
        console.log(`${' '.repeat(level * 2)}${level}: <${info.tag}> class="${info.class}" ${info.hasBlocklyFlyout ? '⭐ HAS FLYOUT' : ''}`);
        console.log(`${' '.repeat(level * 2)}   width=${info.width}px left=${info.left}px`);
        
        current = current.parentElement;
        level++;
    }
    
    // 3. Identifier le conteneur du flyout
    console.log(`\n🎯 Finding flyout container:`);
    const flyoutContainer = hierarchy.find(h => h.hasBlocklyFlyout);
    
    if (flyoutContainer) {
        console.log(`   Found at level ${flyoutContainer.level}: <${flyoutContainer.tag}> width=${flyoutContainer.width}px left=${flyoutContainer.left}px`);
        
        // Retrouver l'élément réel
        current = firstBlock;
        for (let i = 0; i < flyoutContainer.level; i++) {
            current = current.parentElement;
        }
        
        console.log(`\n📐 Flyout container details:`);
        console.log(`   - Tag: ${current.tagName}`);
        console.log(`   - Class: ${current.className?.baseVal || current.className}`);
        console.log(`   - Position: left=${current.getBoundingClientRect().left}px`);
        console.log(`   - Width: ${current.getBoundingClientRect().width}px`);
        console.log(`   - Height: ${current.getBoundingClientRect().height}px`);
        
        // Vérifier les styles
        const computed = window.getComputedStyle(current);
        console.log(`\n🎨 Computed styles:`);
        console.log(`   - display: ${computed.display}`);
        console.log(`   - position: ${computed.position}`);
        console.log(`   - left: ${computed.left}`);
        console.log(`   - transform: ${computed.transform}`);
        
        // Vérifier les éléments SVG importants
        console.log(`\n🔧 SVG elements inside:`);
        const bg = current.querySelector('.blocklyFlyoutBackground');
        if (bg) {
            console.log(`   - Background: x=${bg.getAttribute('x')} width=${bg.getAttribute('width')}`);
        }
        
        const workspace = current.querySelector('g.blocklyWorkspace');
        if (workspace) {
            console.log(`   - Workspace group: transform="${workspace.getAttribute('transform')}"`);
        }
        
        const scrollbar = current.querySelector('.blocklyScrollbarVertical');
        if (scrollbar) {
            console.log(`   - Scrollbar: transform="${scrollbar.getAttribute('transform')}"`);
        }
        
        // Stocker globalement pour manipulation
        window.realFlyout = current;
        console.log(`\n✅ Real flyout stored in window.realFlyout`);
        
        return current;
    } else {
        console.log(`   ❌ No element with blocklyFlyout class found in hierarchy`);
    }
}

// Exposer la fonction
window.findRealFlyout = findRealFlyout;
console.log('✅ Use findRealFlyout() to analyze the DOM structure');
