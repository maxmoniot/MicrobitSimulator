/**
 * Cutebot Blocks - Définition des blocs Blockly pour le Cutebot
 * Les générateurs doivent utiliser Blockly.JavaScript.forBlock[] pour les versions récentes
 */

// Attendre que Blockly soit chargé
(function() {
    'use strict';
    
    // Vérifier que Blockly est disponible
    if (typeof Blockly === 'undefined') {
        return;
    }

    // ============== SUPPORT VIRGULE FRANÇAISE DANS LES CHAMPS NUMÉRIQUES ==============
    // Permet aux élèves de taper 0,5 au lieu de 0.5
    const originalDoClassValidation = Blockly.FieldNumber.prototype.doClassValidation_;
    Blockly.FieldNumber.prototype.doClassValidation_ = function(newValue) {
        if (typeof newValue === 'string') {
            newValue = newValue.replace(',', '.');
        }
        return originalDoClassValidation.call(this, newValue);
    };

    // ============== BLOC IF PERSONNALISÉ (style MakeCode) ==============

    // Icônes + / - (SVG inline encodé en base64 au chargement)
    const IF_PLUS_ICON = 'data:image/svg+xml;base64,' + btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
        '<path fill="#fff" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>'
    );
    const IF_MINUS_ICON = 'data:image/svg+xml;base64,' + btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
        '<path fill="#fff" d="M19 13H5v-2h14v2z"/></svg>'
    );

    Blockly.Blocks['cutebot_if'] = {
        init: function() {
            this.setColour('#14b8a6');
            this.appendValueInput('IF0')
                .setCheck('Boolean')
                .appendField('si');
            this.appendStatementInput('DO0')
                .appendField('alors');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setTooltip('Condition si/sinon si/sinon');
            this.elseifCount_ = 0;
            this.elseCount_ = 0;
            this.updateShape_();
        },

        mutationToDom: function() {
            const container = document.createElement('mutation');
            container.setAttribute('elseif', this.elseifCount_);
            container.setAttribute('else', this.elseCount_);
            return container;
        },

        domToMutation: function(xmlElement) {
            this.elseifCount_ = parseInt(xmlElement.getAttribute('elseif'), 10) || 0;
            this.elseCount_ = parseInt(xmlElement.getAttribute('else'), 10) || 0;
            this.rebuildShape_();
        },

        // Ajoute la ligne de contrôles (+ et éventuellement -) en bas du bloc
        appendControls_: function() {
            const controls = this.appendDummyInput('PLUS')
                .appendField(new Blockly.FieldImage(
                    IF_PLUS_ICON, 15, 15, '+', this.onPlusClick_.bind(this)
                ));
            // Le "-" n'apparaît que s'il y a une branche à supprimer
            if (this.elseifCount_ > 0 || this.elseCount_ > 0) {
                controls.appendField('  ');
                controls.appendField(new Blockly.FieldImage(
                    IF_MINUS_ICON, 15, 15, '-', this.onMinusClick_.bind(this)
                ));
            }
        },

        // Reconstruction complète (utilisée par domToMutation)
        rebuildShape_: function() {
            // Supprimer les anciens inputs (sauf IF0 et DO0)
            let i = 1;
            while (this.getInput('IF' + i)) {
                this.removeInput('IF' + i);
                this.removeInput('DO' + i);
                i++;
            }
            if (this.getInput('ELSE')) {
                this.removeInput('ELSE');
            }
            if (this.getInput('PLUS')) {
                this.removeInput('PLUS');
            }

            // Ajouter les "sinon si"
            for (let i = 0; i < this.elseifCount_; i++) {
                this.appendValueInput('IF' + (i + 1))
                    .setCheck('Boolean')
                    .appendField('sinon si');
                this.appendStatementInput('DO' + (i + 1))
                    .appendField('alors');
            }

            // Ajouter le "sinon" si nécessaire
            if (this.elseCount_ > 0) {
                this.appendStatementInput('ELSE')
                    .appendField('sinon');
            }

            this.appendControls_();
        },

        // Mise à jour incrémentale (préserve les blocs connectés)
        // prevElseifCount / prevElseCount permettent de détecter une croissance
        // ou une réduction et de transférer le contenu de ELSE correctement.
        updateShape_: function(prevElseifCount, prevElseCount) {
            if (prevElseifCount === undefined) prevElseifCount = this.elseifCount_;
            if (prevElseCount === undefined) prevElseCount = this.elseCount_;
            // Croissance d'un "sinon si" : on transforme l'ancien "sinon" en "sinon si"
            // → son contenu doit migrer vers le nouveau dernier DO
            const isGrowingElseif = this.elseifCount_ > prevElseifCount && prevElseCount > 0;

            // Sauvegarder les blocs connectés
            const savedConnections = {};

            // Sauvegarder IF0 et DO0
            let ifInput = this.getInput('IF0');
            if (ifInput && ifInput.connection && ifInput.connection.targetConnection) {
                savedConnections['IF0'] = ifInput.connection.targetConnection;
            }
            let doInput = this.getInput('DO0');
            if (doInput && doInput.connection && doInput.connection.targetConnection) {
                savedConnections['DO0'] = doInput.connection.targetConnection;
            }

            // Sauvegarder les sinon si existants
            let i = 1;
            while (this.getInput('IF' + i)) {
                let ifInput = this.getInput('IF' + i);
                if (ifInput && ifInput.connection && ifInput.connection.targetConnection) {
                    savedConnections['IF' + i] = ifInput.connection.targetConnection;
                }
                let doInput = this.getInput('DO' + i);
                if (doInput && doInput.connection && doInput.connection.targetConnection) {
                    savedConnections['DO' + i] = doInput.connection.targetConnection;
                }
                i++;
            }

            // Sauvegarder le contenu du "sinon"
            let elseInput = this.getInput('ELSE');
            if (elseInput && elseInput.connection && elseInput.connection.targetConnection) {
                savedConnections['ELSE'] = elseInput.connection.targetConnection;
            }

            // Supprimer les inputs (sauf IF0 et DO0 qu'on garde toujours)
            i = 1;
            while (this.getInput('IF' + i)) {
                this.removeInput('IF' + i);
                this.removeInput('DO' + i);
                i++;
            }
            if (this.getInput('ELSE')) {
                this.removeInput('ELSE');
            }
            if (this.getInput('PLUS')) {
                this.removeInput('PLUS');
            }

            // Ajouter les "sinon si"
            for (let i = 0; i < this.elseifCount_; i++) {
                this.appendValueInput('IF' + (i + 1))
                    .setCheck('Boolean')
                    .appendField('sinon si');
                this.appendStatementInput('DO' + (i + 1))
                    .appendField('alors');
            }

            // Ajouter le "sinon" si nécessaire
            if (this.elseCount_ > 0) {
                this.appendStatementInput('ELSE')
                    .appendField('sinon');
            }

            this.appendControls_();

            // Reconnecter les blocs sauvegardés
            // IF0 et DO0
            if (savedConnections['IF0']) {
                const input = this.getInput('IF0');
                if (input && input.connection) {
                    input.connection.connect(savedConnections['IF0']);
                }
            }
            if (savedConnections['DO0']) {
                const input = this.getInput('DO0');
                if (input && input.connection) {
                    input.connection.connect(savedConnections['DO0']);
                }
            }

            // Reconnecter les sinon si existants (les branches en trop deviennent orphelines)
            for (let i = 1; i <= this.elseifCount_; i++) {
                if (savedConnections['IF' + i]) {
                    const input = this.getInput('IF' + i);
                    if (input && input.connection) {
                        input.connection.connect(savedConnections['IF' + i]);
                    }
                }
                if (savedConnections['DO' + i]) {
                    const input = this.getInput('DO' + i);
                    if (input && input.connection) {
                        input.connection.connect(savedConnections['DO' + i]);
                    }
                }
            }

            // Reconnexion du "sinon"
            if (savedConnections['ELSE']) {
                if (isGrowingElseif) {
                    // L'ancien "sinon" devient un "sinon si" → son contenu migre vers le dernier DO
                    const lastDoInput = this.getInput('DO' + this.elseifCount_);
                    if (lastDoInput && lastDoInput.connection && !savedConnections['DO' + this.elseifCount_]) {
                        lastDoInput.connection.connect(savedConnections['ELSE']);
                    }
                } else if (this.elseCount_ > 0) {
                    // Le "sinon" existe toujours → on y reconnecte le contenu
                    const newElseInput = this.getInput('ELSE');
                    if (newElseInput && newElseInput.connection) {
                        newElseInput.connection.connect(savedConnections['ELSE']);
                    }
                }
                // Sinon : le "sinon" a été retiré, son contenu devient orphelin
            }
        },

        onPlusClick_: function() {
            const prevElseif = this.elseifCount_;
            const prevElse = this.elseCount_;
            if (this.elseCount_ === 0) {
                // Première fois : ajouter "sinon"
                this.elseCount_ = 1;
            } else {
                // Transformer le dernier "sinon" en "sinon si" et ajouter un nouveau "sinon"
                this.elseifCount_++;
            }
            this.updateShape_(prevElseif, prevElse);
        },

        onMinusClick_: function() {
            const prevElseif = this.elseifCount_;
            const prevElse = this.elseCount_;
            if (this.elseifCount_ > 0) {
                // Retirer le dernier "sinon si" (le "sinon" reste)
                this.elseifCount_--;
            } else if (this.elseCount_ > 0) {
                // Plus de "sinon si" : retirer le "sinon"
                this.elseCount_ = 0;
            } else {
                return;
            }
            this.updateShape_(prevElseif, prevElse);
        }
    };

    // ============== BLOCS DE BASE ==============

    Blockly.Blocks['on_start'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("⚡ au démarrage");
            this.appendStatementInput("DO")
                .setCheck(null);
            this.setColour('#3b82f6');
            this.setTooltip("Code exécuté une fois au démarrage");
        }
    };

    Blockly.Blocks['forever'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🔄 toujours répéter");
            this.appendStatementInput("DO")
                .setCheck(null);
            this.setColour('#3b82f6');
            this.setTooltip("Boucle infinie");
        }
    };

    Blockly.Blocks['basic_pause'] = {
        init: function() {
            this.appendValueInput("MS")
                .setCheck("Number")
                .appendField("⏱️ pause");
            this.appendDummyInput()
                .appendField("seconde(s)");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#3b82f6');
            this.setTooltip("Pause en secondes (ex: 0.5 pour une demi-seconde)");
        }
    };

    // ============== BLOCS MOTEURS ==============

    Blockly.Blocks['cutebot_motors'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🚗 vitesse roues : gauche");
            this.appendValueInput("LEFT_SPEED")
                .setCheck("Number");
            this.appendDummyInput()
                .appendField("% droite");
            this.appendValueInput("RIGHT_SPEED")
                .setCheck("Number");
            this.appendDummyInput()
                .appendField("%");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#0ea5e9');
            this.setTooltip("Régler la vitesse des roues (-100 à 100)");
        },
        onchange: function() {
            if (!this.workspace) return;
            
            // Récupérer les valeurs des inputs
            const leftBlock = this.getInputTargetBlock('LEFT_SPEED');
            const rightBlock = this.getInputTargetBlock('RIGHT_SPEED');
            
            let warning = null;
            
            // Vérifier la vitesse gauche
            if (leftBlock && leftBlock.type === 'math_number') {
                const leftValue = Math.abs(Number(leftBlock.getFieldValue('NUM')));
                if (leftValue > 0 && leftValue < 25) {
                    warning = "⚠️ Attention : en dessous de 25%, les moteurs risquent de ne pas avoir assez de puissance pour faire avancer le Cutebot.";
                }
            }
            
            // Vérifier la vitesse droite
            if (!warning && rightBlock && rightBlock.type === 'math_number') {
                const rightValue = Math.abs(Number(rightBlock.getFieldValue('NUM')));
                if (rightValue > 0 && rightValue < 25) {
                    warning = "⚠️ Attention : en dessous de 25%, les moteurs risquent de ne pas avoir assez de puissance pour faire avancer le Cutebot.";
                }
            }
            
            this.setWarningText(warning);
        }
    };

    Blockly.Blocks['cutebot_move_time'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🚗 aller")
                .appendField(new Blockly.FieldDropdown([
                    ["⬆️ avant", "forward"],
                    ["⬇️ arrière", "backward"],
                    ["⬅️ gauche", "left"],
                    ["➡️ droite", "right"]
                ]), "DIRECTION");
            this.appendValueInput("SPEED")
                .setCheck("Number")
                .appendField("vitesse");
            this.appendValueInput("TIME")
                .setCheck("Number")
                .appendField("% pendant");
            this.appendDummyInput()
                .appendField("sec");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#0ea5e9');
            this.setTooltip("Avancer dans une direction pendant un temps donné");
        },
        onchange: function() {
            if (!this.workspace) return;
            
            // Récupérer la valeur de vitesse
            const speedBlock = this.getInputTargetBlock('SPEED');
            
            let warning = null;
            
            if (speedBlock && speedBlock.type === 'math_number') {
                const speedValue = Math.abs(Number(speedBlock.getFieldValue('NUM')));
                if (speedValue > 0 && speedValue < 25) {
                    warning = "⚠️ Attention : en dessous de 25%, les moteurs risquent de ne pas avoir assez de puissance pour faire avancer le Cutebot.";
                }
            }
            
            this.setWarningText(warning);
        }
    };

    Blockly.Blocks['cutebot_forward'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("⬆️ avancer pleine vitesse");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#0ea5e9');
            this.setTooltip("Avancer tout droit à 80%");
        }
    };

    Blockly.Blocks['cutebot_backward'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("⬇️ reculer pleine vitesse");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#0ea5e9');
            this.setTooltip("Reculer à 80%");
        }
    };

    Blockly.Blocks['cutebot_turn_left'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("⬅️ tourner à gauche");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#0ea5e9');
            this.setTooltip("Tourner à gauche");
        }
    };

    Blockly.Blocks['cutebot_turn_right'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("➡️ tourner à droite");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#0ea5e9');
            this.setTooltip("Tourner à droite");
        }
    };

    Blockly.Blocks['cutebot_stop'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🛑 arrêter");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#0ea5e9');
            this.setTooltip("Stopper les moteurs");
        }
    };

    // ============== BLOCS LEDs ==============

    Blockly.Blocks['cutebot_led_color'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("💡 LED")
                .appendField(new Blockly.FieldDropdown([
                    ["droite", "RGB_L"],
                    ["gauche", "RGB_R"],
                    ["les deux", "ALL"]
                ]), "LIGHT");
            this.appendValueInput("COLOR")
                .setCheck("Colour")
                .appendField("couleur");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#f97316');
            this.setTooltip("Régler la couleur d'une LED");
        }
    };

    Blockly.Blocks['cutebot_led_rgb'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("💡 LED")
                .appendField(new Blockly.FieldDropdown([
                    ["droite", "RGB_L"],
                    ["gauche", "RGB_R"],
                    ["les deux", "ALL"]
                ]), "LIGHT")
                .appendField("couleur")
                .appendField(new FieldColorDropdown([
                    ["rouge", "#ff0000"],
                    ["orange", "#ff8000"],
                    ["jaune", "#ffff00"],
                    ["vert", "#00ff00"],
                    ["bleu", "#0000ff"],
                    ["violet", "#8000ff"],
                    ["rose", "#ff00ff"],
                    ["blanc", "#ffffff"],
                    ["éteint", "#000000"]
                ]), "COLOR");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#f97316');
            this.setTooltip("Régler la couleur d'une LED");
        }
    };

    Blockly.Blocks['cutebot_led_off'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("💡 éteindre LEDs");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#f97316');
            this.setTooltip("Éteindre toutes les LEDs");
        }
    };

    // ============== BLOCS CAPTEURS ==============

    Blockly.Blocks['cutebot_tracking_state'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("📏 capteurs ligne =")
                .appendField(new Blockly.FieldDropdown([
                    ["● ●", "L_R_line"],
                    ["◌ ●", "L_unline_R_line"],
                    ["● ◌", "L_line_R_unline"],
                    ["◌ ◌", "L_R_unline"]
                ]), "STATE");
            this.setOutput(true, "Boolean");
            this.setColour('#a855f7');
            this.setTooltip("Vérifier l'état des capteurs de ligne");
        }
    };

    Blockly.Blocks['cutebot_track_side'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("📏 capteur")
                .appendField(new Blockly.FieldDropdown([
                    ["gauche", "Left"],
                    ["droit", "Right"]
                ]), "SIDE")
                .appendField("voit")
                .appendField(new Blockly.FieldDropdown([
                    ["la ligne ●", "FindLine"],
                    ["pas de ligne ◌", "LoseLine"]
                ]), "STATE");
            this.setOutput(true, "Boolean");
            this.setColour('#a855f7');
            this.setTooltip("Vérifier un capteur");
        }
    };

    Blockly.Blocks['cutebot_ultrasonic'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("📡 distance ultrason")
                .appendField(new Blockly.FieldDropdown([
                    ["cm", "Centimeters"],
                    ["pouces", "Inches"]
                ]), "UNIT");
            this.setOutput(true, "Number");
            this.setColour('#a855f7');
            this.setTooltip("Distance mesurée par le capteur ultrason");
        }
    };

    // ============== BLOCS ÉVÉNEMENTS ==============

    Blockly.Blocks['cutebot_on_track_event'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("📡 quand capteur")
                .appendField(new Blockly.FieldDropdown([
                    ["gauche", "Left"],
                    ["droit", "Right"]
                ]), "SENSOR")
                .appendField(new Blockly.FieldDropdown([
                    ["trouve ligne", "FindLine"],
                    ["perd ligne", "LoseLine"]
                ]), "EVENT");
            this.appendStatementInput("DO")
                .setCheck(null);
            this.setColour('#8b5cf6');
            this.setTooltip("Événement capteur de ligne");
        }
    };

    Blockly.Blocks['cutebot_on_ir_receive'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("📡 quand IR reçu");
            this.appendStatementInput("DO")
                .setCheck(null);
            this.setColour('#8b5cf6');
            this.setTooltip("Quand un signal IR est reçu");
        }
    };

    Blockly.Blocks['cutebot_ir_button_pressed'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🎮 bouton IR")
                .appendField(new Blockly.FieldDropdown([
                    ["▲ Haut", "Up"],
                    ["▼ Bas", "Down"],
                    ["◀ Gauche", "Left"],
                    ["▶ Droite", "Right"],
                    ["OK", "OK"],
                    ["Setup", "Menu"],
                    ["Vol+ Plus", "Plus"],
                    ["Vol− Moins", "Minus"],
                    ["0", "Zero"], ["1", "One"], ["2", "Two"], ["3", "Three"],
                    ["4", "Four"], ["5", "Five"], ["6", "Six"], ["7", "Seven"],
                    ["8", "Eight"], ["9", "Nine"],
                    ["↶ Retour", "Back"], ["Stop", "Off"]
                ]), "BUTTON")
                .appendField("pressé?");
            this.setOutput(true, "Boolean");
            this.setColour('#8b5cf6');
            this.setTooltip("Bouton IR pressé?");
        }
    };

    // ============== BLOCS SERVO ==============

    Blockly.Blocks['cutebot_servo'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("⚙️ servo")
                .appendField(new Blockly.FieldDropdown([
                    ["S1", "S1"],
                    ["S2", "S2"]
                ]), "SERVO");
            this.appendValueInput("ANGLE")
                .setCheck("Number")
                .appendField("angle");
            this.appendDummyInput()
                .appendField("°");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#8b5cf6');
            this.setTooltip("Angle du servo (0-180°)");
        }
    };

    // ============== GÉNÉRATEURS DE CODE JAVASCRIPT ==============
    // Utiliser forBlock[] pour compatibilité avec Blockly récent

    const jsGen = Blockly.JavaScript;

    // Surcharge du générateur controls_whileUntil pour éviter le blocage
    jsGen.forBlock['controls_whileUntil'] = function(block) {
        const until = block.getFieldValue('MODE') === 'UNTIL';
        let condition = jsGen.valueToCode(block, 'BOOL', until ? jsGen.ORDER_LOGICAL_NOT : jsGen.ORDER_NONE) || 'false';
        let branch = jsGen.statementToCode(block, 'DO');
        
        if (until) {
            condition = '!' + condition;
        }
        
        // Pause pour éviter blocage + vérification d'arrêt via __pause (qui check la génération)
        branch = branch + '  await __pause(1);\n';
        
        return 'while (' + condition + ') {\n' + branch + '}\n';
    };

    // Surcharge du générateur controls_repeat_ext pour éviter le blocage
    jsGen.forBlock['controls_repeat_ext'] = function(block) {
        let repeats = jsGen.valueToCode(block, 'TIMES', jsGen.ORDER_ASSIGNMENT) || '0';
        let branch = jsGen.statementToCode(block, 'DO');
        
        // Pause pour éviter blocage + vérification d'arrêt via __pause (qui check la génération)
        branch = branch + '  await __pause(1);\n';
        
        const loopVar = jsGen.nameDB_.getDistinctName('count', Blockly.VARIABLE_CATEGORY_NAME);
        return 'for (let ' + loopVar + ' = 0; ' + loopVar + ' < ' + repeats + '; ' + loopVar + '++) {\n' + branch + '}\n';
    };

    // Surcharge des générateurs de fonctions pour les rendre async
    jsGen.forBlock['procedures_defnoreturn'] = function(block) {
        const funcName = jsGen.nameDB_.getName(block.getFieldValue('NAME'), Blockly.PROCEDURE_CATEGORY_NAME);
        let branch = jsGen.statementToCode(block, 'STACK');
        if (jsGen.STATEMENT_PREFIX) {
            branch = jsGen.prefixLines(jsGen.STATEMENT_PREFIX.replace(/%1/g, '\'' + block.id + '\''), jsGen.INDENT) + branch;
        }
        if (jsGen.INFINITE_LOOP_TRAP) {
            branch = jsGen.INFINITE_LOOP_TRAP.replace(/%1/g, '\'' + block.id + '\'') + branch;
        }
        
        const args = [];
        const variables = block.getVars();
        for (let i = 0; i < variables.length; i++) {
            args[i] = jsGen.nameDB_.getName(variables[i], Blockly.VARIABLE_CATEGORY_NAME);
        }
        
        // IMPORTANT: Rendre la fonction async
        let code = 'async function ' + funcName + '(' + args.join(', ') + ') {\n' + branch + '}\n';
        code = jsGen.scrub_(block, code);
        jsGen.definitions_[funcName] = code;
        return null;
    };

    jsGen.forBlock['procedures_defreturn'] = function(block) {
        const funcName = jsGen.nameDB_.getName(block.getFieldValue('NAME'), Blockly.PROCEDURE_CATEGORY_NAME);
        let branch = jsGen.statementToCode(block, 'STACK');
        if (jsGen.STATEMENT_PREFIX) {
            branch = jsGen.prefixLines(jsGen.STATEMENT_PREFIX.replace(/%1/g, '\'' + block.id + '\''), jsGen.INDENT) + branch;
        }
        if (jsGen.INFINITE_LOOP_TRAP) {
            branch = jsGen.INFINITE_LOOP_TRAP.replace(/%1/g, '\'' + block.id + '\'') + branch;
        }
        
        let returnValue = jsGen.valueToCode(block, 'RETURN', jsGen.ORDER_NONE) || '';
        if (returnValue) {
            returnValue = jsGen.INDENT + 'return ' + returnValue + ';\n';
        }
        
        const args = [];
        const variables = block.getVars();
        for (let i = 0; i < variables.length; i++) {
            args[i] = jsGen.nameDB_.getName(variables[i], Blockly.VARIABLE_CATEGORY_NAME);
        }
        
        // IMPORTANT: Rendre la fonction async
        let code = 'async function ' + funcName + '(' + args.join(', ') + ') {\n' + branch + returnValue + '}\n';
        code = jsGen.scrub_(block, code);
        jsGen.definitions_[funcName] = code;
        return null;
    };

    jsGen.forBlock['procedures_callnoreturn'] = function(block) {
        const funcName = jsGen.nameDB_.getName(block.getFieldValue('NAME'), Blockly.PROCEDURE_CATEGORY_NAME);
        const args = [];
        const variables = block.getVars();
        for (let i = 0; i < variables.length; i++) {
            args[i] = jsGen.valueToCode(block, 'ARG' + i, jsGen.ORDER_NONE) || 'null';
        }
        // IMPORTANT: Ajouter await pour les appels de fonction
        return 'await ' + funcName + '(' + args.join(', ') + ');\n';
    };

    jsGen.forBlock['procedures_callreturn'] = function(block) {
        const funcName = jsGen.nameDB_.getName(block.getFieldValue('NAME'), Blockly.PROCEDURE_CATEGORY_NAME);
        const args = [];
        const variables = block.getVars();
        for (let i = 0; i < variables.length; i++) {
            args[i] = jsGen.valueToCode(block, 'ARG' + i, jsGen.ORDER_NONE) || 'null';
        }
        // IMPORTANT: Ajouter await pour les appels de fonction
        const code = 'await ' + funcName + '(' + args.join(', ') + ')';
        return [code, jsGen.ORDER_AWAIT];
    };

    // Bloc IF personnalisé
    jsGen.forBlock['cutebot_if'] = function(block) {
        let code = '';
        const condition0 = jsGen.valueToCode(block, 'IF0', jsGen.ORDER_NONE) || 'false';
        const branch0 = jsGen.statementToCode(block, 'DO0');
        
        code += 'if (' + condition0 + ') {\n' + branch0 + '}';
        
        // Ajouter les "sinon si"
        for (let i = 1; i <= block.elseifCount_; i++) {
            const condition = jsGen.valueToCode(block, 'IF' + i, jsGen.ORDER_NONE) || 'false';
            const branch = jsGen.statementToCode(block, 'DO' + i);
            code += ' else if (' + condition + ') {\n' + branch + '}';
        }
        
        // Ajouter le "sinon"
        if (block.elseCount_ > 0) {
            const elseBranch = jsGen.statementToCode(block, 'ELSE');
            code += ' else {\n' + elseBranch + '}';
        }
        
        return code + '\n';
    };

    // Base
    jsGen.forBlock['on_start'] = function(block) {
        const code = jsGen.statementToCode(block, 'DO');
        return '__onStart(async function() {\n' + code + '});\n';
    };

    jsGen.forBlock['forever'] = function(block) {
        const code = jsGen.statementToCode(block, 'DO');
        return '__forever(async function() {\n' + code + '});\n';
    };

    jsGen.forBlock['basic_pause'] = function(block) {
        const seconds = jsGen.valueToCode(block, 'MS', jsGen.ORDER_ATOMIC) || '0';
        return 'await __pauseSeconds(' + seconds + ');\n';
    };

    // Moteurs
    jsGen.forBlock['cutebot_motors'] = function(block) {
        const left = jsGen.valueToCode(block, 'LEFT_SPEED', jsGen.ORDER_ATOMIC) || '0';
        const right = jsGen.valueToCode(block, 'RIGHT_SPEED', jsGen.ORDER_ATOMIC) || '0';
        return '__motors(' + left + ', ' + right + ');\n';
    };

    jsGen.forBlock['cutebot_move_time'] = function(block) {
        const dir = block.getFieldValue('DIRECTION');
        const speed = jsGen.valueToCode(block, 'SPEED', jsGen.ORDER_ATOMIC) || '50';
        const time = jsGen.valueToCode(block, 'TIME', jsGen.ORDER_ATOMIC) || '1';
        return 'await __moveTime("' + dir + '", ' + speed + ', ' + time + ');\n';
    };

    jsGen.forBlock['cutebot_forward'] = function(block) {
        return '__forward();\n';
    };

    jsGen.forBlock['cutebot_backward'] = function(block) {
        return '__backward();\n';
    };

    jsGen.forBlock['cutebot_turn_left'] = function(block) {
        return '__turnLeft();\n';
    };

    jsGen.forBlock['cutebot_turn_right'] = function(block) {
        return '__turnRight();\n';
    };

    jsGen.forBlock['cutebot_stop'] = function(block) {
        return '__stop();\n';
    };

    // LEDs
    jsGen.forBlock['cutebot_led_color'] = function(block) {
        const light = block.getFieldValue('LIGHT');
        const color = jsGen.valueToCode(block, 'COLOR', jsGen.ORDER_ATOMIC) || '"#ff0000"';
        return '__ledColor("' + light + '", ' + color + ');\n';
    };

    jsGen.forBlock['cutebot_led_rgb'] = function(block) {
        const light = block.getFieldValue('LIGHT');
        const color = block.getFieldValue('COLOR') || '#ff0000';
        
        // Convertir la couleur hex en RGB
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        return '__ledRGB("' + light + '", ' + r + ', ' + g + ', ' + b + ');\n';
    };

    jsGen.forBlock['cutebot_led_off'] = function(block) {
        return '__ledOff();\n';
    };

    // Capteurs
    jsGen.forBlock['cutebot_tracking_state'] = function(block) {
        const state = block.getFieldValue('STATE');
        return ['__trackingState("' + state + '")', jsGen.ORDER_ATOMIC];
    };

    jsGen.forBlock['cutebot_track_side'] = function(block) {
        const side = block.getFieldValue('SIDE');
        const state = block.getFieldValue('STATE');
        return ['__trackSide("' + side + '", "' + state + '")', jsGen.ORDER_ATOMIC];
    };

    jsGen.forBlock['cutebot_ultrasonic'] = function(block) {
        const unit = block.getFieldValue('UNIT');
        return ['__ultrasonic("' + unit + '")', jsGen.ORDER_ATOMIC];
    };

    // Événements
    jsGen.forBlock['cutebot_on_track_event'] = function(block) {
        const sensor = block.getFieldValue('SENSOR');
        const event = block.getFieldValue('EVENT');
        const code = jsGen.statementToCode(block, 'DO');
        return '__onTrackEvent("' + sensor + '", "' + event + '", async function() {\n' + code + '});\n';
    };

    jsGen.forBlock['cutebot_on_ir_receive'] = function(block) {
        const code = jsGen.statementToCode(block, 'DO');
        return '__onIRReceive(async function(irCode) {\n' + code + '});\n';
    };

    jsGen.forBlock['cutebot_ir_button_pressed'] = function(block) {
        const button = block.getFieldValue('BUTTON');
        return ['__irButtonPressed("' + button + '")', jsGen.ORDER_ATOMIC];
    };

    // Servo
    jsGen.forBlock['cutebot_servo'] = function(block) {
        const servo = block.getFieldValue('SERVO');
        const angle = jsGen.valueToCode(block, 'ANGLE', jsGen.ORDER_ATOMIC) || '90';
        return '__servo("' + servo + '", ' + angle + ');\n';
    };

})();
