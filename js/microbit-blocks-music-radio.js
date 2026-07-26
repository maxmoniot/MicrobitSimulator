/**
 * Micro:bit Blocks - Music et Radio
 */

(function() {
    'use strict';
    
    if (typeof Blockly === 'undefined') {
        return;
    }

    const jsGen = Blockly.JavaScript;

    // ==========================================================================
    // MUSIC - Sons et mélodies
    // ==========================================================================

    const NOTES = [
        ['Do grave (C3)', '131'],
        ['Ré (D3)', '147'],
        ['Mi (E3)', '165'],
        ['Fa (F3)', '175'],
        ['Sol (G3)', '196'],
        ['La (A3)', '220'],
        ['Si (B3)', '247'],
        ['Do (C4)', '262'],
        ['Ré (D4)', '294'],
        ['Mi (E4)', '330'],
        ['Fa (F4)', '349'],
        ['Sol (G4)', '392'],
        ['La (A4)', '440'],
        ['Si (B4)', '494'],
        ['Do aigu (C5)', '523'],
        ['Ré (D5)', '587'],
        ['Mi (E5)', '659'],
        ['Fa (F5)', '698'],
        ['Sol (G5)', '784'],
        ['La (A5)', '880'],
        ['Si (B5)', '988'],
        ['Do très aigu (C6)', '1047']
    ];

    // --- play tone ---
    Blockly.Blocks['music_play_tone'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('🎵 jouer note')
                .appendField(new Blockly.FieldDropdown(NOTES), 'NOTE');
            this.appendValueInput('DURATION')
                .setCheck('Number')
                .appendField('pendant');
            this.appendDummyInput()
                .appendField('ms');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Joue une note pendant une durée');
        }
    };

    jsGen.forBlock['music_play_tone'] = function(block) {
        const note = block.getFieldValue('NOTE');
        const duration = jsGen.valueToCode(block, 'DURATION', jsGen.ORDER_ATOMIC) || '500';
        return `await __mbPlayTone(${note}, ${duration});\n`;
    };

    // --- play tone with frequency input ---
    Blockly.Blocks['music_play_tone_freq'] = {
        init: function() {
            this.appendValueInput('FREQ')
                .setCheck('Number')
                .appendField('🎵 jouer fréquence');
            this.appendValueInput('DURATION')
                .setCheck('Number')
                .appendField('Hz pendant');
            this.appendDummyInput()
                .appendField('ms');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Joue une fréquence pendant une durée');
        }
    };

    jsGen.forBlock['music_play_tone_freq'] = function(block) {
        const freq = jsGen.valueToCode(block, 'FREQ', jsGen.ORDER_ATOMIC) || '440';
        const duration = jsGen.valueToCode(block, 'DURATION', jsGen.ORDER_ATOMIC) || '500';
        return `await __mbPlayTone(${freq}, ${duration});\n`;
    };

    // --- ring tone ---
    Blockly.Blocks['music_ring_tone'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('🔊 jouer en continu')
                .appendField(new Blockly.FieldDropdown(NOTES), 'NOTE');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Joue une note en continu');
        }
    };

    jsGen.forBlock['music_ring_tone'] = function(block) {
        const note = block.getFieldValue('NOTE');
        return `__mbRingTone(${note});\n`;
    };

    // --- rest ---
    Blockly.Blocks['music_rest'] = {
        init: function() {
            this.appendValueInput('DURATION')
                .setCheck('Number')
                .appendField('🔇 silence');
            this.appendDummyInput()
                .appendField('ms');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Pause silencieuse');
        }
    };

    jsGen.forBlock['music_rest'] = function(block) {
        const duration = jsGen.valueToCode(block, 'DURATION', jsGen.ORDER_ATOMIC) || '500';
        return `await __mbRest(${duration});\n`;
    };

    // --- stop all sounds ---
    Blockly.Blocks['music_stop_all_sounds'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('🔇 arrêter tous les sons');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Arrête tous les sons');
        }
    };

    jsGen.forBlock['music_stop_all_sounds'] = function(block) {
        return '__mbStopAllSounds();\n';
    };

    // --- set tempo ---
    Blockly.Blocks['music_set_tempo'] = {
        init: function() {
            this.appendValueInput('BPM')
                .setCheck('Number')
                .appendField('🎼 tempo');
            this.appendDummyInput()
                .appendField('bpm');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Définit le tempo en battements par minute');
        }
    };

    jsGen.forBlock['music_set_tempo'] = function(block) {
        const bpm = jsGen.valueToCode(block, 'BPM', jsGen.ORDER_ATOMIC) || '120';
        return `__mbSetTempo(${bpm});\n`;
    };

    // --- change tempo by ---
    Blockly.Blocks['music_change_tempo_by'] = {
        init: function() {
            this.appendValueInput('DELTA')
                .setCheck('Number')
                .appendField('🎼 modifier tempo de');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Modifie le tempo');
        }
    };

    jsGen.forBlock['music_change_tempo_by'] = function(block) {
        const delta = jsGen.valueToCode(block, 'DELTA', jsGen.ORDER_ATOMIC) || '20';
        return `__mbChangeTempoBy(${delta});\n`;
    };

    // --- tempo ---
    Blockly.Blocks['music_tempo'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('tempo (bpm)');
            this.setOutput(true, 'Number');
            this.setColour('#E63022');
            this.setTooltip('Tempo actuel');
        }
    };

    jsGen.forBlock['music_tempo'] = function(block) {
        return ['__mbTempo()', jsGen.ORDER_FUNCTION_CALL];
    };

    // --- beat ---
    Blockly.Blocks['music_beat'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('durée d\'un')
                .appendField(new Blockly.FieldDropdown([
                    ['temps entier', '1'],
                    ['demi temps', '0.5'],
                    ['quart de temps', '0.25'],
                    ['huitième de temps', '0.125'],
                    ['double temps', '2'],
                    ['quadruple temps', '4']
                ]), 'FRACTION')
                .appendField('(ms)');
            this.setOutput(true, 'Number');
            this.setColour('#E63022');
            this.setTooltip('Durée d\'un temps en millisecondes');
        }
    };

    jsGen.forBlock['music_beat'] = function(block) {
        const fraction = block.getFieldValue('FRACTION');
        return [`__mbBeat(${fraction})`, jsGen.ORDER_FUNCTION_CALL];
    };

    // --- set speaker enabled (V2) ---
    Blockly.Blocks['music_set_speaker_enabled'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('🔊 haut-parleur')
                .appendField(new Blockly.FieldDropdown([
                    ['activé', 'true'],
                    ['désactivé', 'false']
                ]), 'ENABLED');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Active/désactive le haut-parleur (V2)');
        }
    };

    jsGen.forBlock['music_set_speaker_enabled'] = function(block) {
        const enabled = block.getFieldValue('ENABLED');
        return `__mbSetSpeakerEnabled(${enabled});\n`;
    };

    // --- play sound expression (V2) ---
    Blockly.Blocks['music_play_sound_effect'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('🎭 jouer son')
                .appendField(new Blockly.FieldDropdown([
                    ['rire', 'giggle'],
                    ['content', 'happy'],
                    ['bonjour', 'hello'],
                    ['mystérieux', 'mysterious'],
                    ['triste', 'sad'],
                    ['glissade', 'slide'],
                    ['soupir', 'soaring'],
                    ['printemps', 'spring'],
                    ['scintillement', 'twinkle'],
                    ['bâillement', 'yawn']
                ]), 'SOUND');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E63022');
            this.setTooltip('Joue un effet sonore (V2)');
        }
    };

    jsGen.forBlock['music_play_sound_effect'] = function(block) {
        const sound = block.getFieldValue('SOUND');
        return `await __mbPlaySoundEffect("${sound}");\n`;
    };

    // ==========================================================================
    // RADIO - Communication sans fil
    // ==========================================================================

    // --- radio set group ---
    Blockly.Blocks['radio_set_group'] = {
        init: function() {
            this.appendValueInput('GROUP')
                .setCheck('Number')
                .appendField('📻 définir groupe radio');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E3008C');
            this.setTooltip('Définit le groupe radio (0-255)');
        }
    };

    jsGen.forBlock['radio_set_group'] = function(block) {
        const group = jsGen.valueToCode(block, 'GROUP', jsGen.ORDER_ATOMIC) || '0';
        return `__mbRadioSetGroup(${group});\n`;
    };

    // --- radio send number ---
    Blockly.Blocks['radio_send_number'] = {
        init: function() {
            this.appendValueInput('VALUE')
                .setCheck('Number')
                .appendField('📡 envoyer nombre');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E3008C');
            this.setTooltip('Envoie un nombre par radio');
        }
    };

    jsGen.forBlock['radio_send_number'] = function(block) {
        const value = jsGen.valueToCode(block, 'VALUE', jsGen.ORDER_ATOMIC) || '0';
        return `__mbRadioSendNumber(${value});\n`;
    };

    // --- radio send string ---
    Blockly.Blocks['radio_send_string'] = {
        init: function() {
            this.appendValueInput('VALUE')
                .setCheck('String')
                .appendField('📡 envoyer texte');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E3008C');
            this.setTooltip('Envoie un texte par radio');
        }
    };

    jsGen.forBlock['radio_send_string'] = function(block) {
        const value = jsGen.valueToCode(block, 'VALUE', jsGen.ORDER_ATOMIC) || '""';
        return `__mbRadioSendString(${value});\n`;
    };

    // --- radio send value ---
    Blockly.Blocks['radio_send_value'] = {
        init: function() {
            this.appendValueInput('NAME')
                .setCheck('String')
                .appendField('📡 envoyer valeur');
            this.appendValueInput('VALUE')
                .setCheck('Number')
                .appendField('=');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E3008C');
            this.setTooltip('Envoie une valeur nommée');
        }
    };

    jsGen.forBlock['radio_send_value'] = function(block) {
        const name = jsGen.valueToCode(block, 'NAME', jsGen.ORDER_ATOMIC) || '"x"';
        const value = jsGen.valueToCode(block, 'VALUE', jsGen.ORDER_ATOMIC) || '0';
        return `__mbRadioSendValue(${name}, ${value});\n`;
    };

    // --- on radio received number ---
    Blockly.Blocks['radio_on_received_number'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('📻 quand nombre reçu')
                .appendField(new Blockly.FieldVariable('NombreReçu'), 'VAR');
            this.appendStatementInput('DO')
                .setCheck(null);
            this.setColour('#E3008C');
            this.setTooltip('Exécute le code quand un nombre est reçu');
        }
    };

    jsGen.forBlock['radio_on_received_number'] = function(block) {
        const varName = jsGen.nameDB_.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE);
        const statements = jsGen.statementToCode(block, 'DO');
        return `__mbOnRadioReceivedNumber(async function(${varName}) {\n${statements}});\n`;
    };

    // --- on radio received string ---
    Blockly.Blocks['radio_on_received_string'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('📻 quand texte reçu')
                .appendField(new Blockly.FieldVariable('TexteReçu'), 'VAR');
            this.appendStatementInput('DO')
                .setCheck(null);
            this.setColour('#E3008C');
            this.setTooltip('Exécute le code quand un texte est reçu');
        }
    };

    jsGen.forBlock['radio_on_received_string'] = function(block) {
        const varName = jsGen.nameDB_.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE);
        const statements = jsGen.statementToCode(block, 'DO');
        return `__mbOnRadioReceivedString(async function(${varName}) {\n${statements}});\n`;
    };

    // --- set transmit power ---
    Blockly.Blocks['radio_set_transmit_power'] = {
        init: function() {
            this.appendValueInput('POWER')
                .setCheck('Number')
                .appendField('📡 puissance émission');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#E3008C');
            this.setTooltip('Définit la puissance d\'émission (0-7)');
        }
    };

    jsGen.forBlock['radio_set_transmit_power'] = function(block) {
        const power = jsGen.valueToCode(block, 'POWER', jsGen.ORDER_ATOMIC) || '7';
        return `__mbRadioSetTransmitPower(${power});\n`;
    };

    // --- received packet property ---
    Blockly.Blocks['radio_received_packet'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('paquet reçu')
                .appendField(new Blockly.FieldDropdown([
                    ['signal (dBm)', 'signal strength'],
                    ['numéro série', 'serial number'],
                    ['temps', 'time']
                ]), 'PROPERTY');
            this.setOutput(true, 'Number');
            this.setColour('#E3008C');
            this.setTooltip('Propriété du dernier paquet reçu');
        }
    };

    jsGen.forBlock['radio_received_packet'] = function(block) {
        const property = block.getFieldValue('PROPERTY');
        return [`__mbRadioReceivedPacket("${property}")`, jsGen.ORDER_FUNCTION_CALL];
    };

})();
