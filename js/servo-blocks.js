/**
 * Servo Blocks - Définition des blocs Blockly pour les servomoteurs
 * Section "Barrières" - Extension Servo standard micro:bit
 * Compatible avec l'export MakeCode (.mkcd) et Python (.hex)
 */

(function() {
    'use strict';
    
    if (typeof Blockly === 'undefined') {
        return;
    }

    // Couleur de la catégorie Servo (vert émeraude)
    const SERVO_COLOR = '#059669';
    
    // Liste des pins disponibles (limitée à P0, P1, P2)
    const PIN_OPTIONS = [
        ["P0", "P0"],
        ["P1", "P1"],
        ["P2", "P2"]
    ];

    // ============== DÉFINITIONS DES BLOCS ==============

    /**
     * Bloc: Définir l'angle du servo
     * servos.P0.setAngle(90)
     */
    Blockly.Blocks['servo_set_angle'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("⚙️ mettre servo")
                .appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN")
                .appendField("à l'angle");
            this.appendValueInput("ANGLE")
                .setCheck("Number");
            this.appendDummyInput()
                .appendField("°");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(SERVO_COLOR);
            this.setTooltip("Définir l'angle du servomoteur (0-180°)");
        }
    };

    /**
     * Bloc: Rotation continue du servo
     * servos.P0.run(50)
     */
    Blockly.Blocks['servo_run'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("⚙️ rotation servo")
                .appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN")
                .appendField("vitesse");
            this.appendValueInput("SPEED")
                .setCheck("Number");
            this.appendDummyInput()
                .appendField("%");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(SERVO_COLOR);
            this.setTooltip("Rotation continue du servo (-100 à 100%)");
        }
    };

    /**
     * Bloc: Arrêter le servo
     * servos.P0.stop()
     */
    Blockly.Blocks['servo_stop'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("⚙️ arrêter servo")
                .appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(SERVO_COLOR);
            this.setTooltip("Arrêter le servomoteur");
        }
    };

    /**
     * Bloc: Définir l'intervalle d'angle du servo
     * servos.P0.setRange(0, 180)
     */
    Blockly.Blocks['servo_set_range'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("⚙️ définir intervalle servo")
                .appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN")
                .appendField("de");
            this.appendValueInput("MIN")
                .setCheck("Number");
            this.appendDummyInput()
                .appendField("° à");
            this.appendValueInput("MAX")
                .setCheck("Number");
            this.appendDummyInput()
                .appendField("°");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(SERVO_COLOR);
            this.setTooltip("Définir l'intervalle d'angle du servo (par défaut 0-180°)");
        }
    };

    /**
     * Bloc: Mode d'arrêt du servo
     * servos.P0.setStopOnNeutral(true/false)
     */
    Blockly.Blocks['servo_set_stop_mode'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("⚙️ mettre arrêt servo")
                .appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN")
                .appendField("à")
                .appendField(new Blockly.FieldDropdown([
                    ["OFF", "false"],
                    ["ON", "true"]
                ]), "MODE");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(SERVO_COLOR);
            this.setTooltip("Définir si le servo s'arrête en position neutre");
        }
    };

    /**
     * Bloc: Définir la largeur d'impulsion
     * servos.P0.setPulse(1500)
     */
    Blockly.Blocks['servo_set_pulse'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("⚙️ impulsion servo")
                .appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN");
            this.appendValueInput("PULSE")
                .setCheck("Number");
            this.appendDummyInput()
                .appendField("µs");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(SERVO_COLOR);
            this.setTooltip("Définir la largeur d'impulsion du servo en microsecondes (500-2500µs)");
        }
    };

    // ============== GÉNÉRATEURS JAVASCRIPT ==============

    const jsGen = Blockly.JavaScript;

    jsGen.forBlock['servo_set_angle'] = function(block) {
        const pin = block.getFieldValue('PIN');
        const angle = jsGen.valueToCode(block, 'ANGLE', jsGen.ORDER_ATOMIC) || '90';
        return '__servoSetAngle("' + pin + '", ' + angle + ');\n';
    };

    jsGen.forBlock['servo_run'] = function(block) {
        const pin = block.getFieldValue('PIN');
        const speed = jsGen.valueToCode(block, 'SPEED', jsGen.ORDER_ATOMIC) || '0';
        return '__servoRun("' + pin + '", ' + speed + ');\n';
    };

    jsGen.forBlock['servo_stop'] = function(block) {
        const pin = block.getFieldValue('PIN');
        return '__servoStop("' + pin + '");\n';
    };

    jsGen.forBlock['servo_set_range'] = function(block) {
        const pin = block.getFieldValue('PIN');
        const min = jsGen.valueToCode(block, 'MIN', jsGen.ORDER_ATOMIC) || '0';
        const max = jsGen.valueToCode(block, 'MAX', jsGen.ORDER_ATOMIC) || '180';
        return '__servoSetRange("' + pin + '", ' + min + ', ' + max + ');\n';
    };

    jsGen.forBlock['servo_set_stop_mode'] = function(block) {
        const pin = block.getFieldValue('PIN');
        const mode = block.getFieldValue('MODE');
        return '__servoSetStopMode("' + pin + '", ' + mode + ');\n';
    };

    jsGen.forBlock['servo_set_pulse'] = function(block) {
        const pin = block.getFieldValue('PIN');
        const pulse = jsGen.valueToCode(block, 'PULSE', jsGen.ORDER_ATOMIC) || '1500';
        return '__servoSetPulse("' + pin + '", ' + pulse + ');\n';
    };

})();
