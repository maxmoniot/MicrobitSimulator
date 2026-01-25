/**
 * Micro:bit Blocks - Définition des blocs Blockly pour le micro:bit
 * Compatible avec MakeCode export
 */

(function() {
    'use strict';
    
    if (typeof Blockly === 'undefined') {
        return;
    }

    const jsGen = Blockly.JavaScript;

    // ==========================================================================
    // BASIC - Affichage et contrôle de base
    // ==========================================================================

    // --- show number ---
    Blockly.Blocks['basic_show_number'] = {
        init: function() {
            this.appendValueInput('NUM')
                .setCheck('Number')
                .appendField('🔢 afficher nombre');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setStyle('base_blocks');
            this.setTooltip('Affiche un nombre sur la matrice LED');
        }
    };

    jsGen.forBlock['basic_show_number'] = function(block) {
        const num = jsGen.valueToCode(block, 'NUM', jsGen.ORDER_ATOMIC) || '0';
        return `await __mbShowNumber(${num});\n`;
    };

    // --- show icon ---
    Blockly.Blocks['basic_show_icon'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('😀 afficher icône')
                .appendField(new Blockly.FieldDropdown([
                    ['❤️ Cœur', 'Heart'],
                    ['💗 Petit cœur', 'SmallHeart'],
                    ['😊 Content', 'Happy'],
                    ['😢 Triste', 'Sad'],
                    ['😕 Confus', 'Confused'],
                    ['😠 En colère', 'Angry'],
                    ['😴 Endormi', 'Asleep'],
                    ['😮 Surpris', 'Surprised'],
                    ['😜 Rigolo', 'Silly'],
                    ['😎 Fabuleux', 'Fabulous'],
                    ['😑 Bof', 'Meh'],
                    ['✓ Oui', 'Yes'],
                    ['✗ Non', 'No'],
                    ['△ Triangle', 'Triangle'],
                    ['◇ Diamant', 'Diamond'],
                    ['□ Carré', 'Square'],
                    ['◎ Cible', 'Target'],
                    ['♟ Damier', 'Chessboard'],
                    ['✂ Ciseaux', 'Scissors'],
                    ['👕 T-shirt', 'TShirt'],
                    ['🦆 Canard', 'Duck'],
                    ['🏠 Maison', 'House'],
                    ['🐢 Tortue', 'Tortoise'],
                    ['🦋 Papillon', 'Butterfly'],
                    ['👤 Bonhomme', 'StickFigure'],
                    ['👻 Fantôme', 'Ghost'],
                    ['⚔ Épée', 'Sword'],
                    ['🦒 Girafe', 'Giraffe'],
                    ['💀 Crâne', 'Skull'],
                    ['☂ Parapluie', 'Umbrella'],
                    ['🐍 Serpent', 'Snake'],
                    ['♪ Musique', 'Music'],
                    ['🔱 Fourche', 'Pitchfork'],
                    ['ᗧ Pacman', 'Pacman']
                ]), 'ICON');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setStyle('base_blocks');
            this.setTooltip('Affiche une icône sur la matrice LED');
        }
    };

    jsGen.forBlock['basic_show_icon'] = function(block) {
        const icon = block.getFieldValue('ICON');
        return `__mbShowIcon("${icon}");\n`;
    };

    // --- show leds ---
    Blockly.Blocks['basic_show_leds'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('💡 afficher LEDs');
            
            this.appendDummyInput()
                .appendField(new FieldLEDMatrix('0000000000000000000000000'), 'MATRIX');
            
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setStyle('base_blocks');
            this.setTooltip('Dessine un motif sur la matrice LED (maintenir clic pour dessiner)');
        }
    };

    jsGen.forBlock['basic_show_leds'] = function(block) {
        const matrixValue = block.getFieldValue('MATRIX') || '0000000000000000000000000';
        let pattern = '';
        for (let y = 0; y < 5; y++) {
            let row = '';
            for (let x = 0; x < 5; x++) {
                const index = y * 5 + x;
                row += matrixValue.charAt(index) === '1' ? '#' : '.';
            }
            pattern += row + '\\n';
        }
        return `__mbShowLeds(\`${pattern}\`);\n`;
    };

    // --- show string ---
    Blockly.Blocks['basic_show_string'] = {
        init: function() {
            this.appendValueInput('TEXT')
                .setCheck('String')
                .appendField('📝 afficher texte');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setStyle('base_blocks');
            this.setTooltip('Fait défiler du texte sur la matrice LED');
        }
    };

    jsGen.forBlock['basic_show_string'] = function(block) {
        const text = jsGen.valueToCode(block, 'TEXT', jsGen.ORDER_ATOMIC) || '""';
        return `await __mbShowString(${text});\n`;
    };

    // --- clear screen ---
    Blockly.Blocks['basic_clear_screen'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('🧹 effacer écran');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setStyle('base_blocks');
            this.setTooltip('Éteint toutes les LEDs');
        }
    };

    jsGen.forBlock['basic_clear_screen'] = function(block) {
        return '__mbClearScreen();\n';
    };

    // --- show arrow ---
    Blockly.Blocks['basic_show_arrow'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('➡️ afficher flèche')
                .appendField(new Blockly.FieldDropdown([
                    ['⬆ Nord', 'North'],
                    ['↗ Nord-Est', 'NorthEast'],
                    ['➡ Est', 'East'],
                    ['↘ Sud-Est', 'SouthEast'],
                    ['⬇ Sud', 'South'],
                    ['↙ Sud-Ouest', 'SouthWest'],
                    ['⬅ Ouest', 'West'],
                    ['↖ Nord-Ouest', 'NorthWest']
                ]), 'DIRECTION');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setStyle('base_blocks');
            this.setTooltip('Affiche une flèche directionnelle');
        }
    };

    jsGen.forBlock['basic_show_arrow'] = function(block) {
        const direction = block.getFieldValue('DIRECTION');
        return `__mbShowArrow("${direction}");\n`;
    };

    // ==========================================================================
    // INPUT - Entrées et capteurs
    // ==========================================================================

    // --- on button pressed ---
    Blockly.Blocks['input_on_button_pressed'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('🔘 quand bouton')
                .appendField(new Blockly.FieldDropdown([
                    ['A', 'A'],
                    ['B', 'B'],
                    ['A+B', 'AB']
                ]), 'BUTTON')
                .appendField('pressé');
            this.appendStatementInput('DO')
                .setCheck(null);
            this.setColour('#D400D4');
            this.setTooltip('Exécute le code quand le bouton est pressé');
        }
    };

    jsGen.forBlock['input_on_button_pressed'] = function(block) {
        const button = block.getFieldValue('BUTTON');
        const statements = jsGen.statementToCode(block, 'DO');
        return `__mbOnButtonPressed("${button}", async function() {\n${statements}});\n`;
    };

    // --- button is pressed ---
    Blockly.Blocks['input_button_is_pressed'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('bouton')
                .appendField(new Blockly.FieldDropdown([
                    ['A', 'A'],
                    ['B', 'B'],
                    ['A+B', 'AB']
                ]), 'BUTTON')
                .appendField('pressé ?');
            this.setOutput(true, 'Boolean');
            this.setColour('#D400D4');
            this.setTooltip('Vrai si le bouton est actuellement pressé');
        }
    };

    jsGen.forBlock['input_button_is_pressed'] = function(block) {
        const button = block.getFieldValue('BUTTON');
        return [`__mbButtonIsPressed("${button}")`, jsGen.ORDER_FUNCTION_CALL];
    };

    // --- on gesture ---
    Blockly.Blocks['input_on_gesture'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('🫨 quand')
                .appendField(new Blockly.FieldDropdown([
                    ['secouer', 'shake'],
                    ['logo en haut', 'logo up'],
                    ['logo en bas', 'logo down'],
                    ['écran en haut', 'screen up'],
                    ['écran en bas', 'screen down'],
                    ['pencher gauche', 'tilt left'],
                    ['pencher droite', 'tilt right'],
                    ['chute libre', 'free fall'],
                    ['3g', '3g'],
                    ['6g', '6g']
                ]), 'GESTURE');
            this.appendStatementInput('DO')
                .setCheck(null);
            this.setColour('#D400D4');
            this.setTooltip('Exécute le code lors d\'un geste');
        }
    };

    jsGen.forBlock['input_on_gesture'] = function(block) {
        const gesture = block.getFieldValue('GESTURE');
        const statements = jsGen.statementToCode(block, 'DO');
        return `__mbOnGesture("${gesture}", async function() {\n${statements}});\n`;
    };

    // --- temperature ---
    Blockly.Blocks['input_temperature'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('🌡️ température (°C)');
            this.setOutput(true, 'Number');
            this.setColour('#D400D4');
            this.setTooltip('Température en degrés Celsius');
        }
    };

    jsGen.forBlock['input_temperature'] = function(block) {
        return ['__mbTemperature()', jsGen.ORDER_FUNCTION_CALL];
    };

    // --- light level ---
    Blockly.Blocks['input_light_level'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('💡 niveau de lumière');
            this.setOutput(true, 'Number');
            this.setColour('#D400D4');
            this.setTooltip('Niveau de lumière (0-255)');
        }
    };

    jsGen.forBlock['input_light_level'] = function(block) {
        return ['__mbLightLevel()', jsGen.ORDER_FUNCTION_CALL];
    };

    // --- compass heading ---
    Blockly.Blocks['input_compass_heading'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('🧭 direction boussole (°)');
            this.setOutput(true, 'Number');
            this.setColour('#D400D4');
            this.setTooltip('Direction de la boussole en degrés (0-359)');
        }
    };

    jsGen.forBlock['input_compass_heading'] = function(block) {
        return ['__mbCompassHeading()', jsGen.ORDER_FUNCTION_CALL];
    };

    // --- magnetic force ---
    Blockly.Blocks['input_magnetic_force'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('🧲 force magnétique')
                .appendField(new Blockly.FieldDropdown([
                    ['x', 'x'],
                    ['y', 'y'],
                    ['z', 'z'],
                    ['force', 'strength']
                ]), 'DIMENSION');
            this.setOutput(true, 'Number');
            this.setColour('#D400D4');
            this.setTooltip('Force magnétique en microteslas (-2000 à 2000)');
        }
    };

    jsGen.forBlock['input_magnetic_force'] = function(block) {
        const dimension = block.getFieldValue('DIMENSION');
        return [`__mbMagneticForce("${dimension}")`, jsGen.ORDER_FUNCTION_CALL];
    };

    // --- acceleration ---
    Blockly.Blocks['input_acceleration'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('📐 accélération')
                .appendField(new Blockly.FieldDropdown([
                    ['x', 'x'],
                    ['y', 'y'],
                    ['z', 'z'],
                    ['force', 'strength']
                ]), 'DIMENSION');
            this.setOutput(true, 'Number');
            this.setColour('#D400D4');
            this.setTooltip('Accélération sur un axe (-1024 à 1024)');
        }
    };

    jsGen.forBlock['input_acceleration'] = function(block) {
        const dimension = block.getFieldValue('DIMENSION');
        return [`__mbAcceleration("${dimension}")`, jsGen.ORDER_FUNCTION_CALL];
    };

    // --- rotation ---
    Blockly.Blocks['input_rotation'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('↻ rotation')
                .appendField(new Blockly.FieldDropdown([
                    ['pitch', 'pitch'],
                    ['roll', 'roll']
                ]), 'AXIS');
            this.setOutput(true, 'Number');
            this.setColour('#D400D4');
            this.setTooltip('Rotation en degrés (-180 à 180)');
        }
    };

    jsGen.forBlock['input_rotation'] = function(block) {
        const axis = block.getFieldValue('AXIS');
        return [`__mbRotation("${axis}")`, jsGen.ORDER_FUNCTION_CALL];
    };

    // --- running time ---
    Blockly.Blocks['input_running_time'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('⏱️ temps écoulé (ms)');
            this.setOutput(true, 'Number');
            this.setColour('#D400D4');
            this.setTooltip('Temps depuis le démarrage en millisecondes');
        }
    };

    jsGen.forBlock['input_running_time'] = function(block) {
        return ['__mbRunningTime()', jsGen.ORDER_FUNCTION_CALL];
    };

    // --- on logo pressed (V2) ---
    Blockly.Blocks['input_on_logo_event'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('👆 quand logo')
                .appendField(new Blockly.FieldDropdown([
                    ['touché', 'pressed'],
                    ['relâché', 'released'],
                    ['appui long', 'long pressed']
                ]), 'EVENT');
            this.appendStatementInput('DO')
                .setCheck(null);
            this.setColour('#D400D4');
            this.setTooltip('Événement du logo tactile (V2 seulement)');
        }
    };

    jsGen.forBlock['input_on_logo_event'] = function(block) {
        const event = block.getFieldValue('EVENT');
        const statements = jsGen.statementToCode(block, 'DO');
        return `__mbOnLogoEvent("${event}", async function() {\n${statements}});\n`;
    };

    // --- logo is pressed (V2) ---
    Blockly.Blocks['input_logo_is_pressed'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('logo touché ?');
            this.setOutput(true, 'Boolean');
            this.setColour('#D400D4');
            this.setTooltip('Vrai si le logo est touché (V2 seulement)');
        }
    };

    jsGen.forBlock['input_logo_is_pressed'] = function(block) {
        return ['__mbLogoIsPressed()', jsGen.ORDER_FUNCTION_CALL];
    };

    // --- sound level (V2) ---
    Blockly.Blocks['input_sound_level'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('🎤 niveau sonore');
            this.setOutput(true, 'Number');
            this.setColour('#D400D4');
            this.setTooltip('Niveau sonore du microphone (0-255, V2 seulement)');
        }
    };

    jsGen.forBlock['input_sound_level'] = function(block) {
        return ['__mbSoundLevel()', jsGen.ORDER_FUNCTION_CALL];
    };

    // ==========================================================================
    // LED - Contrôle avancé des LEDs
    // ==========================================================================

    // --- plot ---
    Blockly.Blocks['led_plot'] = {
        init: function() {
            this.appendValueInput('X')
                .setCheck('Number')
                .appendField('💡 allumer LED x');
            this.appendValueInput('Y')
                .setCheck('Number')
                .appendField('y');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Allume une LED à la position x,y');
        }
    };

    jsGen.forBlock['led_plot'] = function(block) {
        const x = jsGen.valueToCode(block, 'X', jsGen.ORDER_ATOMIC) || '0';
        const y = jsGen.valueToCode(block, 'Y', jsGen.ORDER_ATOMIC) || '0';
        return `__mbPlot(${x}, ${y});\n`;
    };

    // --- unplot ---
    Blockly.Blocks['led_unplot'] = {
        init: function() {
            this.appendValueInput('X')
                .setCheck('Number')
                .appendField('🔳 éteindre LED x');
            this.appendValueInput('Y')
                .setCheck('Number')
                .appendField('y');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Éteint une LED à la position x,y');
        }
    };

    jsGen.forBlock['led_unplot'] = function(block) {
        const x = jsGen.valueToCode(block, 'X', jsGen.ORDER_ATOMIC) || '0';
        const y = jsGen.valueToCode(block, 'Y', jsGen.ORDER_ATOMIC) || '0';
        return `__mbUnplot(${x}, ${y});\n`;
    };

    // --- toggle ---
    Blockly.Blocks['led_toggle'] = {
        init: function() {
            this.appendValueInput('X')
                .setCheck('Number')
                .appendField('🔄 inverser LED x');
            this.appendValueInput('Y')
                .setCheck('Number')
                .appendField('y');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Inverse l\'état d\'une LED');
        }
    };

    jsGen.forBlock['led_toggle'] = function(block) {
        const x = jsGen.valueToCode(block, 'X', jsGen.ORDER_ATOMIC) || '0';
        const y = jsGen.valueToCode(block, 'Y', jsGen.ORDER_ATOMIC) || '0';
        return `__mbToggle(${x}, ${y});\n`;
    };

    // --- point ---
    Blockly.Blocks['led_point'] = {
        init: function() {
            this.appendValueInput('X')
                .setCheck('Number')
                .appendField('LED allumée ? x');
            this.appendValueInput('Y')
                .setCheck('Number')
                .appendField('y');
            this.setInputsInline(true);
            this.setOutput(true, 'Boolean');
            this.setColour('#E63022');
            this.setTooltip('Vrai si la LED est allumée');
        }
    };

    jsGen.forBlock['led_point'] = function(block) {
        const x = jsGen.valueToCode(block, 'X', jsGen.ORDER_ATOMIC) || '0';
        const y = jsGen.valueToCode(block, 'Y', jsGen.ORDER_ATOMIC) || '0';
        return [`__mbPoint(${x}, ${y})`, jsGen.ORDER_FUNCTION_CALL];
    };

    // --- brightness ---
    Blockly.Blocks['led_brightness'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('luminosité');
            this.setOutput(true, 'Number');
            this.setColour('#E63022');
            this.setTooltip('Luminosité actuelle (0-255)');
        }
    };

    jsGen.forBlock['led_brightness'] = function(block) {
        return ['__mbBrightness()', jsGen.ORDER_FUNCTION_CALL];
    };

    // --- set brightness ---
    Blockly.Blocks['led_set_brightness'] = {
        init: function() {
            this.appendValueInput('VALUE')
                .setCheck('Number')
                .appendField('☀️ définir luminosité');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Définit la luminosité (0-255)');
        }
    };

    jsGen.forBlock['led_set_brightness'] = function(block) {
        const value = jsGen.valueToCode(block, 'VALUE', jsGen.ORDER_ATOMIC) || '255';
        return `__mbSetBrightness(${value});\n`;
    };

    // --- stop animation ---
    Blockly.Blocks['led_stop_animation'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('⏹️ arrêter animation');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Arrête l\'animation en cours');
        }
    };

    jsGen.forBlock['led_stop_animation'] = function(block) {
        return '__mbStopAnimation();\n';
    };

    // --- plot bar graph ---
    Blockly.Blocks['led_plot_bar_graph'] = {
        init: function() {
            this.appendValueInput('VALUE')
                .setCheck('Number')
                .appendField('📊 graphique valeur');
            this.appendValueInput('MAX')
                .setCheck('Number')
                .appendField('max');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Affiche un graphique à barres');
        }
    };

    jsGen.forBlock['led_plot_bar_graph'] = function(block) {
        const value = jsGen.valueToCode(block, 'VALUE', jsGen.ORDER_ATOMIC) || '0';
        const max = jsGen.valueToCode(block, 'MAX', jsGen.ORDER_ATOMIC) || '100';
        return `__mbPlotBarGraph(${value}, ${max});\n`;
    };

    // --- enable ---
    Blockly.Blocks['led_enable'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('activer écran')
                .appendField(new Blockly.FieldDropdown([
                    ['oui', 'true'],
                    ['non', 'false']
                ]), 'ENABLED');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Active ou désactive l\'écran LED');
        }
    };

    jsGen.forBlock['led_enable'] = function(block) {
        const enabled = block.getFieldValue('ENABLED');
        return `__mbLedEnable(${enabled});\n`;
    };

})();
