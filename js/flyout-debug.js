/**
 * Outil de debug pour le flyout Blockly
 * Permet d'inspecter la structure et les propriétés du flyout
 */

function debugFlyout(workspace) {
    const flyout = workspace.getFlyout();
    if (!flyout) {
        console.error('❌ No flyout found');
        return;
    }
    
    console.log('=== FLYOUT DEBUG ===');
    
    // Trouver TOUS les éléments possibles du flyout
    const injectionDiv = workspace.getInjectionDiv();
    
    console.log('🔍 Searching for flyout elements...');
    const allFlyoutElements = injectionDiv.querySelectorAll('[class*="flyout" i], [class*="Flyout" i]');
    console.log(`   Found ${allFlyoutElements.length} elements with "flyout" in class`);
    
    allFlyoutElements.forEach((el, i) => {
        console.log(`   ${i}: ${el.className} - ${el.tagName}`);
    });
    
    // Chercher l'élément principal
    const flyoutElement = injectionDiv.querySelector('.blocklyFlyout') || 
                         injectionDiv.querySelector('[class*="Flyout"]');
    
    if (flyoutElement) {
        console.log('\n📦 Flyout DOM Element:');
        const computed = window.getComputedStyle(flyoutElement);
        console.log('  - Width (style):', flyoutElement.style.width);
        console.log('  - Width (computed):', computed.width);
        console.log('  - Width (offset):', flyoutElement.offsetWidth + 'px');
        console.log('  - Left (computed):', computed.left);
        console.log('  - Transform:', computed.transform);
        console.log('  - Display:', computed.display);
        console.log('  - Visibility:', computed.visibility);
        console.log('  - Pointer events:', computed.pointerEvents);
    }
    
    // Chercher le SVG
    const svgElements = injectionDiv.querySelectorAll('.blocklyFlyout svg, [class*="Flyout"] svg');
    console.log(`\n📐 Found ${svgElements.length} SVG elements in flyout`);
    
    svgElements.forEach((svg, i) => {
        const rect = svg.getBoundingClientRect();
        console.log(`   SVG ${i}:`);
        console.log('     - Width attr:', svg.getAttribute('width'));
        console.log('     - Height attr:', svg.getAttribute('height'));
        console.log('     - Actual width:', rect.width);
        console.log('     - Actual height:', rect.height);
        console.log('     - Left:', rect.left);
    });
    
    // Chercher le background
    const backgrounds = injectionDiv.querySelectorAll('.blocklyFlyoutBackground, [class*="FlyoutBackground"]');
    console.log(`\n🎨 Found ${backgrounds.length} background elements`);
    
    backgrounds.forEach((bg, i) => {
        console.log(`   Background ${i}:`);
        console.log('     - X:', bg.getAttribute('x'));
        console.log('     - Y:', bg.getAttribute('y'));
        console.log('     - Width:', bg.getAttribute('width'));
        console.log('     - Height:', bg.getAttribute('height'));
    });
    
    // Chercher les groupes
    const groups = injectionDiv.querySelectorAll('.blocklyFlyout g');
    console.log(`\n📍 Found ${groups.length} <g> groups in flyout`);
    
    groups.forEach((g, i) => {
        if (i < 5) { // Limiter à 5 pour ne pas spam
            console.log(`   Group ${i}:`);
            console.log('     - Class:', g.getAttribute('class'));
            console.log('     - Transform:', g.getAttribute('transform'));
        }
    });
    
    // Chercher les blocs
    const blockCanvas = injectionDiv.querySelector('.blocklyFlyout .blocklyBlockCanvas');
    if (blockCanvas) {
        const blocks = blockCanvas.querySelectorAll('.blocklyDraggable, [class*="block" i]');
        console.log(`\n🧱 Blocks:`);
        console.log('  - Count:', blocks.length);
        console.log('  - Canvas transform:', blockCanvas.getAttribute('transform'));
        
        if (blocks.length > 0) {
            const firstBlock = blocks[0];
            const rect = firstBlock.getBoundingClientRect();
            console.log('  - First block position:', rect.left, rect.top);
        }
    }
    
    // Chercher la scrollbar
    const scrollbar = injectionDiv.querySelector('.blocklyFlyout .blocklyScrollbarVertical');
    if (scrollbar) {
        console.log('\n📜 Scrollbar:');
        const transform = scrollbar.getAttribute('transform');
        console.log('  - Transform:', transform);
        
        // Extraire la position X du transform
        const match = transform?.match(/translate\(([-\d.]+)/);
        if (match) {
            console.log('  - X position:', match[1]);
        }
    }
    
    console.log('\n==================');
}

// Fonction pour debug en continu
function startFlyoutDebug(workspace) {
    console.log('🔍 Starting flyout debug monitoring...');
    
    // Debug initial
    setTimeout(() => {
        console.log('\n🔷 INITIAL STATE (after load):');
        debugFlyout(workspace);
    }, 500);
    
    // Écouter les changements du flyout
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.classList?.contains('blocklyFlyout') || 
                mutation.target.closest('.blocklyFlyout')) {
                console.log('\n🔄 FLYOUT CHANGED:');
                debugFlyout(workspace);
            }
        });
    });
    
    // Observer le flyout
    const flyoutElement = workspace.getInjectionDiv().querySelector('.blocklyFlyout');
    if (flyoutElement) {
        observer.observe(flyoutElement, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ['style', 'width', 'height', 'transform']
        });
    }
    
    return observer;
}

// Fonction pour tester l'ouverture/fermeture
function testFlyoutToggle(workspace) {
    console.log('\n🧪 Testing flyout toggle...');
    
    const flyout = workspace.getFlyout();
    if (!flyout) return;
    
    console.log('1️⃣ Showing empty flyout:');
    flyout.show([]);
    setTimeout(() => debugFlyout(workspace), 100);
    
    setTimeout(() => {
        console.log('\n2️⃣ Showing flyout with test block:');
        const xml = Blockly.utils.xml.textToDom('<xml><block type="controls_if"></block></xml>');
        flyout.show(xml.childNodes);
        setTimeout(() => debugFlyout(workspace), 100);
    }, 1000);
    
    setTimeout(() => {
        console.log('\n3️⃣ Closing flyout:');
        flyout.show([]);
        setTimeout(() => debugFlyout(workspace), 100);
    }, 2000);
}

// Exposer globalement
window.debugFlyout = debugFlyout;
window.startFlyoutDebug = startFlyoutDebug;
window.testFlyoutToggle = testFlyoutToggle;

console.log('✅ Flyout debug tools loaded. Use:');
console.log('  - debugFlyout(workspace) : Inspect current state');
console.log('  - startFlyoutDebug(workspace) : Monitor changes');
console.log('  - testFlyoutToggle(workspace) : Test open/close');
