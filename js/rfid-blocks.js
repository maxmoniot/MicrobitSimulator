/**
 * RFID Blocks - Définition des blocs Blockly pour le module RFID MFRC522
 * Section "Portillon" - Extension joy-it/pxt-rfid-mfrc522
 * Compatible avec l'export MakeCode (.mkcd) et Python (.hex)
 */

(function() {
    'use strict';
    
    if (typeof Blockly === 'undefined') {
        return;
    }

    // Couleur de la catégorie RFID (violet)
    const RFID_COLOR = '#7c3aed';
    
    // Couleur de la catégorie Servo Portillon (cyan foncé)
    const SERVO_PORTILLON_COLOR = '#0891b2';

    // Liste des pins disponibles pour servo portillon
    const PIN_OPTIONS = [
        ["P0", "P0"],
        ["P1", "P1"],
        ["P2", "P2"]
    ];

    // ============== BLOCS SERVO PORTILLON (DUPLIQUÉS) ==============

    /**
     * Bloc: Définir l'angle du servo portillon
     */
    Blockly.Blocks['portillon_servo_set_angle'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🚪 mettre servo")
                .appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN")
                .appendField("à l'angle");
            this.appendValueInput("ANGLE")
                .setCheck("Number");
            this.appendDummyInput()
                .appendField("°");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(SERVO_PORTILLON_COLOR);
            this.setTooltip("Définir l'angle du servomoteur du portillon (0-180°)");
        }
    };

    /**
     * Bloc: Rotation continue du servo portillon
     */
    Blockly.Blocks['portillon_servo_run'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🚪 rotation servo")
                .appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN")
                .appendField("vitesse");
            this.appendValueInput("SPEED")
                .setCheck("Number");
            this.appendDummyInput()
                .appendField("%");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(SERVO_PORTILLON_COLOR);
            this.setTooltip("Rotation continue du servo (-100 à 100%)");
        }
    };

    /**
     * Bloc: Arrêter le servo portillon
     */
    Blockly.Blocks['portillon_servo_stop'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🚪 arrêter servo")
                .appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(SERVO_PORTILLON_COLOR);
            this.setTooltip("Arrêter le servomoteur du portillon");
        }
    };

    /**
     * Bloc: Définir l'intervalle d'angle du servo portillon
     */
    Blockly.Blocks['portillon_servo_set_range'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🚪 définir intervalle servo")
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
            this.setColour(SERVO_PORTILLON_COLOR);
            this.setTooltip("Définir l'intervalle d'angle du servo (par défaut 0-180°)");
        }
    };

    /**
     * Bloc: Mode d'arrêt du servo portillon
     */
    Blockly.Blocks['portillon_servo_set_stop_mode'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🚪 mettre arrêt servo")
                .appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN")
                .appendField("à")
                .appendField(new Blockly.FieldDropdown([
                    ["OFF", "false"],
                    ["ON", "true"]
                ]), "MODE");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(SERVO_PORTILLON_COLOR);
            this.setTooltip("Définir si le servo s'arrête en position neutre");
        }
    };

    /**
     * Bloc: Définir la largeur d'impulsion du servo portillon
     */
    Blockly.Blocks['portillon_servo_set_pulse'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🚪 impulsion servo")
                .appendField(new Blockly.FieldDropdown(PIN_OPTIONS), "PIN");
            this.appendValueInput("PULSE")
                .setCheck("Number");
            this.appendDummyInput()
                .appendField("µs");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(SERVO_PORTILLON_COLOR);
            this.setTooltip("Définir la largeur d'impulsion du servo en microsecondes (500-2500µs)");
        }
    };

    // ============== BLOCS RFID ==============

    /**
     * Bloc: Initialiser le module RFID
     * MFRC522.Init()
     */
    Blockly.Blocks['rfid_init'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🏷️ initialiser RFID");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(RFID_COLOR);
            this.setTooltip("Initialiser le module RFID MFRC522. À appeler au démarrage.");
        }
    };

    /**
     * Bloc: Lire l'ID de la carte RFID
     * MFRC522.getID()
     */
    Blockly.Blocks['rfid_get_id'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🏷️ lire ID carte RFID");
            this.setOutput(true, null); // Accepte connexion à tout type (Number ou String)
            this.setColour(RFID_COLOR);
            this.setTooltip("Retourne l'identifiant unique de la carte RFID détectée");
        }
    };

    /**
     * Bloc: Lire les données de la carte RFID
     * MFRC522.read()
     */
    Blockly.Blocks['rfid_read'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🏷️ lire données carte RFID");
            this.setOutput(true, null); // Accepte connexion à tout type (Number ou String)
            this.setColour(RFID_COLOR);
            this.setTooltip("Lire les données stockées sur la carte RFID");
        }
    };

    /**
     * Bloc: Écrire des données sur la carte RFID
     * MFRC522.write("data")
     */
    Blockly.Blocks['rfid_write'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🏷️ écrire sur carte RFID");
            this.appendValueInput("DATA")
                .setCheck("String");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(RFID_COLOR);
            this.setTooltip("Écrire des données sur la carte RFID (texte)");
        }
    };

    /**
     * Bloc: Éteindre l'antenne RFID
     * MFRC522.AntennaOff()
     */
    Blockly.Blocks['rfid_antenna_off'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🏷️ éteindre antenne RFID");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(RFID_COLOR);
            this.setTooltip("Éteindre l'antenne du module RFID pour économiser l'énergie");
        }
    };

    // ============== GÉNÉRATEURS JAVASCRIPT ==============

    const jsGen = Blockly.JavaScript;

    // Générateurs Servo Portillon (identiques aux servo barrière)
    jsGen.forBlock['portillon_servo_set_angle'] = function(block) {
        const pin = block.getFieldValue('PIN');
        const angle = jsGen.valueToCode(block, 'ANGLE', jsGen.ORDER_ATOMIC) || '90';
        return '__servoSetAngle("' + pin + '", ' + angle + ');\n';
    };

    jsGen.forBlock['portillon_servo_run'] = function(block) {
        const pin = block.getFieldValue('PIN');
        const speed = jsGen.valueToCode(block, 'SPEED', jsGen.ORDER_ATOMIC) || '0';
        return '__servoRun("' + pin + '", ' + speed + ');\n';
    };

    jsGen.forBlock['portillon_servo_stop'] = function(block) {
        const pin = block.getFieldValue('PIN');
        return '__servoStop("' + pin + '");\n';
    };

    jsGen.forBlock['portillon_servo_set_range'] = function(block) {
        const pin = block.getFieldValue('PIN');
        const min = jsGen.valueToCode(block, 'MIN', jsGen.ORDER_ATOMIC) || '0';
        const max = jsGen.valueToCode(block, 'MAX', jsGen.ORDER_ATOMIC) || '180';
        return '__servoSetRange("' + pin + '", ' + min + ', ' + max + ');\n';
    };

    jsGen.forBlock['portillon_servo_set_stop_mode'] = function(block) {
        const pin = block.getFieldValue('PIN');
        const mode = block.getFieldValue('MODE');
        return '__servoSetStopMode("' + pin + '", ' + mode + ');\n';
    };

    jsGen.forBlock['portillon_servo_set_pulse'] = function(block) {
        const pin = block.getFieldValue('PIN');
        const pulse = jsGen.valueToCode(block, 'PULSE', jsGen.ORDER_ATOMIC) || '1500';
        return '__servoSetPulse("' + pin + '", ' + pulse + ');\n';
    };

    // Générateurs RFID
    jsGen.forBlock['rfid_init'] = function(block) {
        return '__rfidInit();\n';
    };

    jsGen.forBlock['rfid_get_id'] = function(block) {
        return ['__rfidGetId()', jsGen.ORDER_FUNCTION_CALL];
    };

    jsGen.forBlock['rfid_read'] = function(block) {
        return ['__rfidRead()', jsGen.ORDER_FUNCTION_CALL];
    };

    jsGen.forBlock['rfid_write'] = function(block) {
        const data = jsGen.valueToCode(block, 'DATA', jsGen.ORDER_ATOMIC) || '""';
        return '__rfidWrite(' + data + ');\n';
    };

    jsGen.forBlock['rfid_antenna_off'] = function(block) {
        return '__rfidAntennaOff();\n';
    };

})();
