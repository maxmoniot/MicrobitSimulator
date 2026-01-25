/**
 * HEX Generator - Génération directe de fichiers HEX pour micro:bit
 * Version 3.0 - Export direct en Universal HEX (V1 + V2)
 * 
 * Utilise @microbit/microbit-fs pour injecter le code Python dans les firmwares MicroPython
 */

class HexGenerator {
    constructor() {
        this.firmwaresLoaded = false;
        this.v1Hex = null;
        this.v2Hex = null;
        this.cutebotLib = null;
        this.mfrc522Lib = null;
    }

    /**
     * Charge les firmwares MicroPython et les bibliothèques
     */
    async loadFirmwares() {
        if (this.firmwaresLoaded) return true;

        try {
            // Charger les firmwares et bibliothèques en parallèle
            const [v1Response, v2Response, cutebotResponse, mfrc522Response] = await Promise.all([
                fetch('firmware/micropython-v1.hex'),
                fetch('firmware/micropython-v2.hex'),
                fetch('firmware/Cutebot.py'),
                fetch('firmware/MFRC522.py')
            ]);

            // Vérifier que les réponses sont OK (pas 404, etc.)
            if (!v1Response.ok || !v2Response.ok) {
                console.log('Firmwares non trouvés (HTTP ' + v1Response.status + '/' + v2Response.status + ')');
                throw new Error('Firmwares non trouvés');
            }

            this.v1Hex = await v1Response.text();
            this.v2Hex = await v2Response.text();
            
            // Vérifier que les fichiers HEX sont valides (doivent commencer par ":")
            // Cela détecte aussi les pages 404 HTML qui commencent par "<"
            if (!this.v1Hex || !this.v2Hex || 
                !this.v1Hex.trim().startsWith(':') || 
                !this.v2Hex.trim().startsWith(':')) {
                console.log('Fichiers firmware invalides (ne commencent pas par ":")');
                throw new Error('Fichiers firmware invalides');
            }
            
            if (cutebotResponse.ok) {
                this.cutebotLib = await cutebotResponse.text();
            }
            
            if (mfrc522Response.ok) {
                this.mfrc522Lib = await mfrc522Response.text();
            }

            this.firmwaresLoaded = true;
            console.log('Firmwares chargés avec succès');
            return true;
        } catch (error) {
            console.error('Erreur chargement firmwares:', error);
            this.firmwaresLoaded = false;
            this.v1Hex = null;
            this.v2Hex = null;
            return false;
        }
    }

    /**
     * Convertit le code du simulateur en code Python MicroPython
     */
    generatePythonCode(simCode) {
        if (!simCode || simCode.trim() === '') {
            return 'from microbit import *\n\n# Programme vide\nwhile True:\n    sleep(100)\n';
        }

        let code = simCode;
        
        // Détecter si le code utilise Cutebot
        const usesCutebot = /__motors|__forward|__backward|__turnLeft|__turnRight|__stop|__ledColor|__ledRGB|__ledOff|__trackingState|__trackSide|__ultrasonic|__servo|__moveTime/.test(code);
        
        // Détecter si le code utilise l'extension Servo (Barrières)
        const usesServo = /__servoSetAngle|__servoRun|__servoStop|__servoSetRange|__servoSetStopMode|__servoSetPulse/.test(code);
        
        // Détecter si le code utilise l'extension RFID (Portillon)
        const usesRFID = /__rfidInit|__rfidGetId|__rfidRead|__rfidWrite|__rfidAntennaOff/.test(code);
        
        // Détecter si le code utilise des boutons IR
        const hasIRButtons = /__irButtonPressed\("([^"]+)"\)/.test(code);
        
        // Extraire onStart
        const onStartMatch = code.match(/__onStart\(async function\(\) \{([\s\S]*?)\}\);/);
        let onStartCode = onStartMatch ? onStartMatch[1].trim() : '';
        
        // Extraire forever
        const foreverMatch = code.match(/__forever\(async function\(\) \{([\s\S]*?)\}\);/);
        let foreverCode = foreverMatch ? foreverMatch[1].trim() : '';
        
        // Détecter les variables utilisateur
        const userVars = new Set();
        if (onStartMatch) {
            const assignRegex = /^\s*(\w+)\s*=\s*\d+\s*;/gm;
            let match;
            while ((match = assignRegex.exec(onStartMatch[1])) !== null) {
                const varName = match[1];
                const keywords = ['if', 'else', 'while', 'for', 'true', 'false', 'True', 'False', 'None', 'await', 'return', 'break', 'continue'];
                if (!keywords.includes(varName)) {
                    userVars.add(varName);
                }
            }
        }
        
        // Pattern d'incrémentation Blockly
        const incrRegex = /\b(\w+)\s*=\s*\(typeof\s+\1\s*===\s*['"]number['"]/g;
        let incrMatch;
        while ((incrMatch = incrRegex.exec(code)) !== null) {
            userVars.add(incrMatch[1]);
        }
        
        // Détecter les variables des événements radio (elles peuvent être utilisées ailleurs)
        const radioVarRegex = /__mbOnRadioReceived(?:Number|String)\(async function\((\w+)\)/g;
        let radioVarMatch;
        while ((radioVarMatch = radioVarRegex.exec(code)) !== null) {
            userVars.add(radioVarMatch[1]);
        }
        
        // Table de correspondance des boutons IR (depuis la configuration externe)
        const irButtonMap = window.IRRemoteConfig ? window.IRRemoteConfig.python : {
            'Up': 64, 'Down': 25, 'Right': 22, 'Left': 8,
            'OK': 28, 'Back': 13, 'Zero': 82, 'One': 12,
            'Two': 24, 'Three': 94, 'Four': 66, 'Five': 74,
            'Six': 82, 'Seven': 7, 'Eight': 21, 'Nine': 69,
            'Off': 68, 'Menu': 71, 'Plus': 64, 'Minus': 67
        };

        // Table des icônes
        const iconMap = {
            'Heart': 'Image.HEART', 'SmallHeart': 'Image.HEART_SMALL',
            'Happy': 'Image.HAPPY', 'Sad': 'Image.SAD',
            'Confused': 'Image.CONFUSED', 'Angry': 'Image.ANGRY',
            'Asleep': 'Image.ASLEEP', 'Surprised': 'Image.SURPRISED',
            'Silly': 'Image.SILLY', 'Fabulous': 'Image.FABULOUS',
            'Meh': 'Image.MEH', 'Yes': 'Image.YES', 'No': 'Image.NO',
            'Triangle': 'Image.TRIANGLE', 'Diamond': 'Image.DIAMOND',
            'DiamondSmall': 'Image.DIAMOND_SMALL', 'Square': 'Image.SQUARE',
            'SquareSmall': 'Image.SQUARE_SMALL', 'Target': 'Image.TARGET',
            'Chessboard': 'Image.CHESSBOARD', 'Rabbit': 'Image.RABBIT',
            'Cow': 'Image.COW', 'Duck': 'Image.DUCK', 'House': 'Image.HOUSE',
            'Tortoise': 'Image.TORTOISE', 'Butterfly': 'Image.BUTTERFLY',
            'StickFigure': 'Image.STICKFIGURE', 'Ghost': 'Image.GHOST',
            'Sword': 'Image.SWORD', 'Giraffe': 'Image.GIRAFFE',
            'Skull': 'Image.SKULL', 'Umbrella': 'Image.UMBRELLA',
            'Snake': 'Image.SNAKE', 'Scissors': 'Image.SCISSORS',
            'Pacman': 'Image.PACMAN', 'Pitchfork': 'Image.PITCHFORK',
            'Music': 'Image.MUSIC_CROTCHET', 'TShirt': 'Image.TSHIRT',
            'Rollerskate': 'Image.ROLLERSKATE'
        };

        // Table des flèches
        const arrowMap = {
            'North': 'Image.ARROW_N', 'NorthEast': 'Image.ARROW_NE',
            'East': 'Image.ARROW_E', 'SouthEast': 'Image.ARROW_SE',
            'South': 'Image.ARROW_S', 'SouthWest': 'Image.ARROW_SW',
            'West': 'Image.ARROW_W', 'NorthWest': 'Image.ARROW_NW'
        };

        // Table des états de tracking - La bibliothèque Cutebot.py retourne des entiers
        // Note: la lib retourne 0, 1, 10, 11 (pas des strings)
        // 0 = blanc-blanc, 1 = blanc-noir, 10 = noir-blanc, 11 = noir-noir
        const trackingStateMap = {
            'L_R_line': '11', 'LeftBlack_RightBlack': '11',           // noir-noir
            'L_unline_R_line': '1', 'LeftWhite_RightBlack': '1',      // blanc-noir (bug lib: retourne 1 au lieu de 01)
            'L_line_R_unline': '10', 'LeftBlack_RightWhite': '10',    // noir-blanc
            'L_R_unline': '0', 'LeftWhite_RightWhite': '0'            // blanc-blanc
        };
        
        /**
         * Convertit le code JavaScript en Python avec gestion de l'indentation
         */
        const convertToPython = (jsCode, baseIndent = '') => {
            if (!jsCode) return '';
            
            let c = jsCode;
            
            // ===== ÉTAPE 1: Remplacer les fonctions spécifiques =====
            
            // Variables - Pattern d'incrémentation Blockly
            c = c.replace(/(\w+)\s*=\s*\(typeof\s+\1\s*===\s*['"]number['"]\s*\?\s*\1\s*:\s*0\)\s*\+\s*(-?\d+)\s*;?/g, (match, varName, num) => {
                const n = parseInt(num);
                return n < 0 ? `${varName} = ${varName} - ${Math.abs(n)}` : `${varName} = ${varName} + ${n}`;
            });
            
            // BASIC MICRO:BIT
            c = c.replace(/await __pause\(([^)]+)\);?/g, 'sleep($1)');
            // Cas spécial: showNumber(rfidGetId()) - ne pas afficher si ID=0
            // Note: Blockly peut ajouter des parenthèses supplémentaires
            c = c.replace(/await __mbShowNumber\(\(?__rfidGetId\(\)\)?\);?/g, '_rfid_id = rfid.getID();\nif (_rfid_id != 0) {\ndisplay.scroll(_rfid_id);\n}');
            c = c.replace(/await __mbShowNumber\(([^)]+)\);?/g, 'display.scroll($1)');
            c = c.replace(/__mbShowIcon\("([^"]+)"\);?/g, (m, icon) => `display.show(${iconMap[icon] || 'Image.HEART'})`);
            c = c.replace(/__mbShowLeds\(`([^`]+)`\);?/g, (m, pattern) => {
                const lines = pattern.trim().split('\n').map(l => l.trim().replace(/\./g, '0').replace(/#/g, '9').replace(/\s+/g, ''));
                return `display.show(Image("${lines.join(':')}"))`;
            });
            c = c.replace(/await __mbShowString\(([^)]+)\);?/g, 'display.scroll($1)');
            c = c.replace(/__mbClearScreen\(\);?/g, 'display.clear()');
            c = c.replace(/__mbShowArrow\("([^"]+)"\);?/g, (m, dir) => `display.show(${arrowMap[dir] || 'Image.ARROW_N'})`);
            
            // INPUT
            c = c.replace(/__mbButtonIsPressed\("AB"\)/g, '(button_a.is_pressed() and button_b.is_pressed())');
            c = c.replace(/__mbButtonIsPressed\("([^"]+)"\)/g, (m, btn) => `button_${btn.toLowerCase()}.is_pressed()`);
            c = c.replace(/__mbTemperature\(\)/g, 'temperature()');
            c = c.replace(/__mbLightLevel\(\)/g, 'display.read_light_level()');
            c = c.replace(/__mbCompassHeading\(\)/g, 'compass.heading()');
            c = c.replace(/__mbMagneticForce\("x"\)/g, 'compass.get_x()');
            c = c.replace(/__mbMagneticForce\("y"\)/g, 'compass.get_y()');
            c = c.replace(/__mbMagneticForce\("z"\)/g, 'compass.get_z()');
            c = c.replace(/__mbMagneticForce\("strength"\)/g, 'compass.get_field_strength()');
            c = c.replace(/__mbAcceleration\("([^"]+)"\)/g, (m, dim) => `accelerometer.get_${dim.toLowerCase()}()`);
            c = c.replace(/__mbRotation\("pitch"\)/g, 'int(math.degrees(math.atan2(accelerometer.get_y(), math.sqrt(accelerometer.get_x()**2 + accelerometer.get_z()**2))))');
            c = c.replace(/__mbRotation\("roll"\)/g, 'int(math.degrees(math.atan2(accelerometer.get_x(), math.sqrt(accelerometer.get_y()**2 + accelerometer.get_z()**2))))');
            c = c.replace(/__mbRunningTime\(\)/g, 'running_time()');
            c = c.replace(/__mbLogoIsPressed\(\)/g, 'pin_logo.is_touched()');
            c = c.replace(/__mbSoundLevel\(\)/g, 'microphone.sound_level()');
            
            // LED
            c = c.replace(/__mbPlot\(([^,]+),\s*([^)]+)\);?/g, 'display.set_pixel($1, $2, 9)');
            c = c.replace(/__mbUnplot\(([^,]+),\s*([^)]+)\);?/g, 'display.set_pixel($1, $2, 0)');
            c = c.replace(/__mbToggle\(([^,]+),\s*([^)]+)\);?/g, 'display.set_pixel($1, $2, 0 if display.get_pixel($1, $2) else 9)');
            c = c.replace(/__mbPoint\(([^,]+),\s*([^)]+)\)/g, 'display.get_pixel($1, $2)');
            c = c.replace(/__mbSetBrightness\(([^)]+)\);?/g, 'pass  # brightness non supporté');
            c = c.replace(/__mbStopAnimation\(\);?/g, 'display.clear()');
            
            // MUSIC
            c = c.replace(/await __mbPlayTone\(([^,]+),\s*([^)]+)\);?/g, 'music.pitch(int($1), int($2))');
            c = c.replace(/__mbRingTone\(([^)]+)\);?/g, 'music.pitch(int($1), -1)');
            c = c.replace(/await __mbRest\(([^)]+)\);?/g, 'sleep($1)');
            c = c.replace(/__mbStopAllSounds\(\);?/g, 'music.stop()');
            c = c.replace(/__mbSetTempo\(([^)]+)\);?/g, 'music.set_tempo(bpm=int($1))');
            
            // RADIO
            c = c.replace(/__mbRadioSetGroup\(([^)]+)\);?/g, 'radio.config(group=$1)\nradio.on()');
            c = c.replace(/__mbRadioSendNumber\(([^)]+)\);?/g, 'radio.send(str($1))');
            c = c.replace(/__mbRadioSendString\(([^)]+)\);?/g, 'radio.send($1)');
            c = c.replace(/__mbRadioSendValue\(([^,]+),\s*([^)]+)\);?/g, 'radio.send($1 + "=" + str($2))');
            c = c.replace(/__mbRadioSetTransmitPower\(([^)]+)\);?/g, 'radio.config(power=$1)');
            
            // CUTEBOT - Moteurs
            c = c.replace(/__motors\(([^,]+),\s*([^)]+)\);?/g, 'robot.set_motors_speed($1, $2)');
            c = c.replace(/__forward\(\);?/g, 'robot.set_motors_speed(50, 50)');
            c = c.replace(/__backward\(\);?/g, 'robot.set_motors_speed(-50, -50)');
            c = c.replace(/__turnLeft\(\);?/g, 'robot.set_motors_speed(-30, 30)');
            c = c.replace(/__turnRight\(\);?/g, 'robot.set_motors_speed(30, -30)');
            c = c.replace(/__stop\(\);?/g, 'robot.set_motors_speed(0, 0)');
            c = c.replace(/await __moveTime\("[Ff]orward",\s*([^,]+),\s*([^)]+)\);?/g, 
                'robot.set_motors_speed($1, $1)\nsleep(int($2 * 1000))\nrobot.set_motors_speed(0, 0)');
            c = c.replace(/await __moveTime\("[Bb]ackward",\s*([^,]+),\s*([^)]+)\);?/g, 
                'robot.set_motors_speed(-$1, -$1)\nsleep(int($2 * 1000))\nrobot.set_motors_speed(0, 0)');
            c = c.replace(/await __moveTime\("[Ll]eft",\s*([^,]+),\s*([^)]+)\);?/g, 
                'robot.set_motors_speed(-$1, $1)\nsleep(int($2 * 1000))\nrobot.set_motors_speed(0, 0)');
            c = c.replace(/await __moveTime\("[Rr]ight",\s*([^,]+),\s*([^)]+)\);?/g, 
                'robot.set_motors_speed($1, -$1)\nsleep(int($2 * 1000))\nrobot.set_motors_speed(0, 0)');
            
            // Aussi sans await (pour le corps des fonctions après suppression await)
            c = c.replace(/__moveTime\("[Ff]orward",\s*([^,]+),\s*([^)]+)\);?/g, 
                'robot.set_motors_speed($1, $1)\nsleep(int($2 * 1000))\nrobot.set_motors_speed(0, 0)');
            c = c.replace(/__moveTime\("[Bb]ackward",\s*([^,]+),\s*([^)]+)\);?/g, 
                'robot.set_motors_speed(-$1, -$1)\nsleep(int($2 * 1000))\nrobot.set_motors_speed(0, 0)');
            c = c.replace(/__moveTime\("[Ll]eft",\s*([^,]+),\s*([^)]+)\);?/g, 
                'robot.set_motors_speed(-$1, $1)\nsleep(int($2 * 1000))\nrobot.set_motors_speed(0, 0)');
            c = c.replace(/__moveTime\("[Rr]ight",\s*([^,]+),\s*([^)]+)\);?/g, 
                'robot.set_motors_speed($1, -$1)\nsleep(int($2 * 1000))\nrobot.set_motors_speed(0, 0)');
            
            // CUTEBOT - LEDs (left=0x04, right=0x08 selon la lib)
            c = c.replace(/__ledColor\("([^"]+)",\s*"#([^"]+)"\);?/g, (m, side, hex) => {
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                if (side === 'Both') {
                    return `robot.set_car_light(0x04, ${r}, ${g}, ${b})\nrobot.set_car_light(0x08, ${r}, ${g}, ${b})`;
                }
                const light = side === 'Left' ? '0x04' : '0x08';
                return `robot.set_car_light(${light}, ${r}, ${g}, ${b})`;
            });
            c = c.replace(/__ledRGB\("([^"]+)",\s*([^,]+),\s*([^,]+),\s*([^)]+)\);?/g, (m, side, r, g, b) => {
                if (side === 'Both') {
                    return `robot.set_car_light(0x04, ${r}, ${g}, ${b})\nrobot.set_car_light(0x08, ${r}, ${g}, ${b})`;
                }
                const light = side === 'Left' ? '0x04' : '0x08';
                return `robot.set_car_light(${light}, ${r}, ${g}, ${b})`;
            });
            c = c.replace(/__ledOff\(\);?/g, 'robot.set_car_light(0x04, 0, 0, 0)\nrobot.set_car_light(0x08, 0, 0, 0)');
            
            // CUTEBOT - Capteurs
            c = c.replace(/__trackingState\("([^"]+)"\)/g, (m, state) => {
                return `(robot.get_tracking() == ${trackingStateMap[state] || '0'})`;
            });
            // trackSide: convertir en comparaison d'entier basée sur le côté
            c = c.replace(/__trackSide\("([^"]+)",\s*"([^"]+)"\)/g, (m, side, event) => {
                // La lib retourne: 0=blanc-blanc, 1=blanc-noir, 10=noir-blanc, 11=noir-noir
                // Pour gauche noir: valeurs 10 ou 11 (>= 10)
                // Pour gauche blanc: valeurs 0 ou 1 (< 10)
                // Pour droite noir: valeurs 1 ou 11 (impair, % 10 == 1)
                // Pour droite blanc: valeurs 0 ou 10 (pair, % 10 == 0)
                if (side === 'Left') {
                    return event === 'Black' ? '(robot.get_tracking() >= 10)' : '(robot.get_tracking() < 10)';
                } else {
                    return event === 'Black' ? '(robot.get_tracking() % 10 == 1)' : '(robot.get_tracking() % 10 == 0)';
                }
            });
            c = c.replace(/__ultrasonic\("Inches"\)/g, 'robot.get_distance(1)');
            c = c.replace(/__ultrasonic\("([^"]+)"\)/g, 'robot.get_distance(0)');
            
            // CUTEBOT - Servo (la lib utilise 1 et 2, pas 0 et 1)
            c = c.replace(/__servo\("S1",\s*([^)]+)\);?/g, 'robot.set_servo(1, $1)');
            c = c.replace(/__servo\("S2",\s*([^)]+)\);?/g, 'robot.set_servo(2, $1)');
            
            // SERVO Extension (Barrières) - Utilise pin.write_analog avec PWM
            // setAngle: convertit angle (0-180) en valeur analogique (26-128 pour 500-2500µs sur période 20ms)
            c = c.replace(/__servoSetAngle\("P(\d+)",\s*([^)]+)\);?/g, (match, pin, angle) => {
                // Formule: val = 26 + (angle * 102 / 180) pour mapper 0-180° sur 26-128
                return `pin${pin}.write_analog(int(26 + (${angle}) * 102 / 180))`;
            });
            // run: vitesse -100 à 100 convertie en valeur analogique (26=gauche, 77=stop, 128=droite)
            c = c.replace(/__servoRun\("P(\d+)",\s*([^)]+)\);?/g, (match, pin, speed) => {
                return `pin${pin}.write_analog(int(77 + (${speed}) * 51 / 100))`;
            });
            // stop: met à 0 pour arrêter le signal PWM
            c = c.replace(/__servoStop\("P(\d+)"\);?/g, 'pin$1.write_analog(0)');
            // setRange: pas d'équivalent direct en MicroPython, on ajoute un commentaire
            c = c.replace(/__servoSetRange\("P(\d+)",\s*([^,]+),\s*([^)]+)\);?/g, '# servo P$1: range $2-$3 (géré par le code)');
            // setStopMode: pas d'équivalent direct
            c = c.replace(/__servoSetStopMode\("P(\d+)",\s*([^)]+)\);?/g, '# servo P$1: stopOnNeutral = $2');
            // setPulse: convertit µs en valeur analogique (période 20ms = 20000µs, résolution 1024)
            c = c.replace(/__servoSetPulse\("P(\d+)",\s*([^)]+)\);?/g, (match, pin, pulse) => {
                // Formule: val = pulse * 1024 / 20000 = pulse * 0.0512
                return `pin${pin}.write_analog(int((${pulse}) * 1024 / 20000))`;
            });
            
            // RFID Extension (Portillon) - Module MFRC522
            c = c.replace(/__rfidInit\(\);?/g, 'rfid.Init()');
            c = c.replace(/__rfidGetId\(\)/g, 'rfid.getID()');
            c = c.replace(/__rfidRead\(\)/g, 'rfid.read()');
            c = c.replace(/__rfidWrite\(([^)]+)\);?/g, 'rfid.write($1)');
            c = c.replace(/__rfidAntennaOff\(\);?/g, 'rfid.AntennaOff()');
            
            // IR
            c = c.replace(/__irButtonPressed\("([^"]+)"\)/g, (m, button) => {
                const irCode = irButtonMap[button];
                return irCode !== undefined ? `(ir_code == ${irCode})` : 'False';
            });
            
            // ===== ÉTAPE 2: Convertir les opérateurs logiques =====
            c = c.replace(/\btrue\b/g, 'True');
            c = c.replace(/\bfalse\b/g, 'False');
            c = c.replace(/\bnull\b/g, 'None');
            c = c.replace(/&&/g, ' and ');
            c = c.replace(/\|\|/g, ' or ');
            c = c.replace(/!(?!=)/g, 'not ');
            c = c.replace(/===/g, '==');
            c = c.replace(/!==/g, '!=');
            
            // Supprimer await
            c = c.replace(/await\s+/g, '');
            
            // Convertir les boucles for AVANT de supprimer les points-virgules
            // Pattern Blockly: for (let count = 0; count < N; count++)
            c = c.replace(/for\s*\(\s*let\s+(\w+)\s*=\s*0\s*;\s*\1\s*<\s*(\d+)\s*;\s*\1\+\+\s*\)/g, 
                'for $1 in range($2):');
            // Pattern avec variable: for (let i = 0; i < variable; i++)
            c = c.replace(/for\s*\(\s*let\s+(\w+)\s*=\s*0\s*;\s*\1\s*<\s*(\w+)\s*;\s*\1\+\+\s*\)/g, 
                'for $1 in range($2):');
            
            // Supprimer les points-virgules
            c = c.replace(/;/g, '');
            
            // ===== ÉTAPE 3: Convertir les structures de contrôle avec indentation =====
            const lines = [];
            let indentLevel = 0;
            
            // Découper le code en lignes et tokens
            const tokens = c.split(/(\{|\}|\n)/).filter(t => t.trim() !== '');
            
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i].trim();
                
                if (token === '{') {
                    indentLevel++;
                    continue;
                }
                
                if (token === '}') {
                    indentLevel--;
                    if (indentLevel < 0) indentLevel = 0;
                    continue;
                }
                
                if (!token) continue;
                
                // Convertir if/else if/else/while
                let line = token;
                
                // while (condition) -> while condition:
                line = line.replace(/^while\s*\((.+)\)\s*$/, 'while $1:');
                
                // if (condition) -> if condition:
                line = line.replace(/^if\s*\((.+)\)\s*$/, 'if $1:');
                
                // else if (condition) -> elif condition:
                line = line.replace(/^else\s+if\s*\((.+)\)\s*$/, 'elif $1:');
                
                // else -> else:
                line = line.replace(/^else\s*$/, 'else:');
                
                // for (init; cond; incr) - conversion basique vers while
                const forMatch = line.match(/^for\s*\(([^;]+);\s*([^;]+);\s*([^)]+)\)\s*$/);
                if (forMatch) {
                    const [, init, cond, incr] = forMatch;
                    lines.push(baseIndent + '    '.repeat(indentLevel) + init.trim());
                    line = `while ${cond.trim()}:`;
                    // Note: l'incrémentation devra être ajoutée manuellement à la fin du bloc
                }
                
                // Ajouter la ligne avec l'indentation appropriée
                if (line) {
                    lines.push(baseIndent + '    '.repeat(indentLevel) + line);
                }
            }
            
            return lines.join('\n');
        };
        
        // ===== Extraire les événements =====
        
        // Événements boutons micro:bit
        const buttonEvents = [];
        const buttonRegex = /__mbOnButtonPressed\("([^"]+)",\s*async function\(\) \{([\s\S]*?)\}\);/g;
        let buttonMatch;
        while ((buttonMatch = buttonRegex.exec(code)) !== null) {
            buttonEvents.push({
                button: buttonMatch[1],
                code: buttonMatch[2].trim()
            });
        }
        
        // Événements gestes
        const gestureEvents = [];
        const gestureRegex = /__mbOnGesture\("([^"]+)",\s*async function\(\) \{([\s\S]*?)\}\);/g;
        let gestureMatch;
        while ((gestureMatch = gestureRegex.exec(code)) !== null) {
            gestureEvents.push({
                gesture: gestureMatch[1],
                code: gestureMatch[2].trim()
            });
        }
        
        // Événements radio - nombre reçu
        const radioNumberEvents = [];
        const radioNumberRegex = /__mbOnRadioReceivedNumber\(async function\((\w+)\) \{([\s\S]*?)\}\);/g;
        let radioNumberMatch;
        while ((radioNumberMatch = radioNumberRegex.exec(code)) !== null) {
            radioNumberEvents.push({
                varName: radioNumberMatch[1],
                code: radioNumberMatch[2].trim()
            });
        }
        
        // Événements radio - texte reçu
        const radioStringEvents = [];
        const radioStringRegex = /__mbOnRadioReceivedString\(async function\((\w+)\) \{([\s\S]*?)\}\);/g;
        let radioStringMatch;
        while ((radioStringMatch = radioStringRegex.exec(code)) !== null) {
            radioStringEvents.push({
                varName: radioStringMatch[1],
                code: radioStringMatch[2].trim()
            });
        }
        
        // ===== Extraire les fonctions utilisateur =====
        const userFunctions = [];
        
        // Trouver toutes les définitions de fonction "async function nom(...) {"
        const funcStartRegex = /async function (\w+)\s*\(([^)]*)\)\s*\{/g;
        let funcStartMatch;
        
        while ((funcStartMatch = funcStartRegex.exec(code)) !== null) {
            const funcName = funcStartMatch[1];
            const args = funcStartMatch[2].trim();
            const startIndex = funcStartMatch.index + funcStartMatch[0].length;
            
            // Compter les accolades pour trouver la fin de la fonction
            let braceCount = 1;
            let endIndex = startIndex;
            
            for (let i = startIndex; i < code.length && braceCount > 0; i++) {
                if (code[i] === '{') braceCount++;
                else if (code[i] === '}') braceCount--;
                endIndex = i;
            }
            
            const body = code.substring(startIndex, endIndex).trim();
            
            // Vérifier si c'est une fonction utilisateur (pas une fonction interne)
            // Les fonctions internes sont celles passées à __onStart, __forever, etc.
            const beforeFunc = code.substring(Math.max(0, funcStartMatch.index - 30), funcStartMatch.index);
            const isInternalFunc = /\(\s*$/.test(beforeFunc); // Précédé par une parenthèse ouvrante
            
            if (!isInternalFunc) {
                userFunctions.push({
                    name: funcName,
                    args: args,
                    body: body
                });
            }
        }

        // ===== Construire le code Python final =====
        let result = '# Programme généré par Micro:bit Simulator\n';
        result += 'from microbit import *\n';
        
        if (usesCutebot) {
            result += 'from Cutebot import CUTEBOT, read_ir\n';
        }
        
        // Imports additionnels
        if (code.includes('__mbPlayTone') || code.includes('__mbRingTone')) {
            result += 'import music\n';
        }
        if (code.includes('__mbRadio') || radioNumberEvents.length > 0 || radioStringEvents.length > 0) {
            result += 'import radio\n';
        }
        if (code.includes('__mbRotation')) {
            result += 'import math\n';
        }
        
        result += '\n';
        
        // Initialiser Cutebot si utilisé
        if (usesCutebot) {
            result += 'robot = CUTEBOT()\n\n';
        }
        
        // Initialiser les pins servo si utilisées (période PWM de 20ms)
        if (usesServo) {
            // Extraire les pins servo utilisées
            const servoPins = new Set();
            const servoPinRegex = /__servo(?:SetAngle|Run|Stop|SetRange|SetStopMode|SetPulse)\("P(\d+)"/g;
            let servoPinMatch;
            while ((servoPinMatch = servoPinRegex.exec(code)) !== null) {
                servoPins.add(servoPinMatch[1]);
            }
            if (servoPins.size > 0) {
                result += '# Initialisation des pins servo (période PWM 20ms)\n';
                for (const pin of servoPins) {
                    result += `pin${pin}.set_analog_period(20)\n`;
                }
                result += '\n';
            }
        }
        
        // Initialiser le module RFID si utilisé
        if (usesRFID) {
            result += '# Module RFID MFRC522 (nécessite la bibliothèque MFRC522.py)\n';
            result += 'from MFRC522 import MFRC522\n';
            result += 'rfid = MFRC522()\n\n';
        }
        
        // Déclarer les variables
        for (const varName of userVars) {
            result += `${varName} = 0\n`;
        }
        if (userVars.size > 0) result += '\n';
        
        // Variable IR si utilisée
        if (hasIRButtons) {
            result += 'ir_code = 0\n\n';
        }
        
        // Générer les fonctions utilisateur
        if (userFunctions.length > 0) {
            result += '# Fonctions utilisateur\n';
            for (const func of userFunctions) {
                const args = func.args; // Les arguments sont déjà au bon format
                result += `def ${func.name}(${args}):\n`;
                const bodyCode = convertToPython(func.body, '    ');
                if (bodyCode.trim()) {
                    result += bodyCode + '\n';
                } else {
                    result += '    pass\n';
                }
                result += '\n';
            }
        }
        
        // Générer la fonction _check_events() si nécessaire
        const hasEvents = buttonEvents.length > 0 || gestureEvents.length > 0 || 
                          radioNumberEvents.length > 0 || radioStringEvents.length > 0 || hasIRButtons;
        const hasWhileInForever = foreverCode && /\bwhile\s*\(/.test(foreverCode);
        
        if (hasEvents && hasWhileInForever) {
            result += '# Fonction pour vérifier les événements (appelée dans les boucles)\n';
            result += 'def _check_events():\n';
            
            // Déclarer les variables globales modifiées
            const globalVars = new Set();
            for (const evt of radioNumberEvents) globalVars.add(evt.varName);
            for (const evt of radioStringEvents) globalVars.add(evt.varName);
            if (hasIRButtons) globalVars.add('ir_code');
            
            if (globalVars.size > 0) {
                result += `    global ${Array.from(globalVars).join(', ')}\n`;
            }
            
            // IR
            if (hasIRButtons) {
                result += '    _ir = read_ir()\n';
                result += '    if _ir > 0:\n';
                result += '        ir_code = _ir\n';
            }
            
            // Boutons
            for (const evt of buttonEvents) {
                let btnCheck;
                if (evt.button === 'AB') {
                    btnCheck = 'button_a.is_pressed() and button_b.is_pressed()';
                } else {
                    btnCheck = `button_${evt.button.toLowerCase()}.was_pressed()`;
                }
                result += `    if ${btnCheck}:\n`;
                const evtCode = convertToPython(evt.code, '        ');
                if (evtCode.trim()) {
                    result += evtCode + '\n';
                } else {
                    result += '        pass\n';
                }
            }
            
            // Gestes
            for (const evt of gestureEvents) {
                const gestureMap = {
                    'shake': 'shaken', 'logo up': 'face up', 'logo down': 'face down',
                    'screen up': 'up', 'screen down': 'down',
                    'tilt left': 'left', 'tilt right': 'right',
                    'free fall': 'freefall', '3g': '3g', '6g': '6g'
                };
                const gesturePython = gestureMap[evt.gesture] || 'shaken';
                result += `    if accelerometer.was_gesture("${gesturePython}"):\n`;
                const evtCode = convertToPython(evt.code, '        ');
                if (evtCode.trim()) {
                    result += evtCode + '\n';
                } else {
                    result += '        pass\n';
                }
            }
            
            // Radio
            if (radioNumberEvents.length > 0 || radioStringEvents.length > 0) {
                result += `    _radio_msg = radio.receive()\n`;
                result += `    if _radio_msg is not None:\n`;
                
                for (const evt of radioNumberEvents) {
                    result += `        try:\n`;
                    result += `            ${evt.varName} = int(_radio_msg)\n`;
                    const evtCode = convertToPython(evt.code, '            ');
                    if (evtCode.trim()) {
                        result += evtCode + '\n';
                    }
                    result += `        except:\n`;
                    result += `            pass\n`;
                }
                
                for (const evt of radioStringEvents) {
                    result += `        ${evt.varName} = _radio_msg\n`;
                    const evtCode = convertToPython(evt.code, '        ');
                    if (evtCode.trim()) {
                        result += evtCode + '\n';
                    }
                }
            }
            
            result += '\n';
        }
        
        // Code au démarrage
        if (onStartCode) {
            result += '# Au démarrage\n';
            const converted = convertToPython(onStartCode);
            if (converted.trim()) {
                result += converted + '\n\n';
            }
        }
        
        // Boucle forever avec événements intégrés
        result += '# Boucle principale\n';
        result += 'while True:\n';
        
        // Lire l'IR si utilisé
        if (hasIRButtons) {
            result += '    # Lire la télécommande IR\n';
            result += '    _ir = read_ir()\n';
            result += '    if _ir > 0:\n';
            result += '        ir_code = _ir\n';
        }
        
        // Ajouter les vérifications de boutons
        for (const evt of buttonEvents) {
            let btnCheck;
            if (evt.button === 'AB') {
                btnCheck = 'button_a.is_pressed() and button_b.is_pressed()';
            } else {
                btnCheck = `button_${evt.button.toLowerCase()}.was_pressed()`;
            }
            result += `    # Bouton ${evt.button}\n`;
            result += `    if ${btnCheck}:\n`;
            const evtCode = convertToPython(evt.code, '        ');
            if (evtCode.trim()) {
                result += evtCode + '\n';
            } else {
                result += '        pass\n';
            }
        }
        
        // Ajouter les vérifications de gestes
        for (const evt of gestureEvents) {
            const gestureMap = {
                'shake': 'shaken', 'logo up': 'face up', 'logo down': 'face down',
                'screen up': 'up', 'screen down': 'down',
                'tilt left': 'left', 'tilt right': 'right',
                'free fall': 'freefall', '3g': '3g', '6g': '6g'
            };
            const gesturePython = gestureMap[evt.gesture] || 'shaken';
            result += `    # Geste ${evt.gesture}\n`;
            result += `    if accelerometer.was_gesture("${gesturePython}"):\n`;
            const evtCode = convertToPython(evt.code, '        ');
            if (evtCode.trim()) {
                result += evtCode + '\n';
            } else {
                result += '        pass\n';
            }
        }
        
        // Ajouter la gestion des messages radio reçus
        if (radioNumberEvents.length > 0 || radioStringEvents.length > 0) {
            result += `    # Radio - vérifier les messages reçus\n`;
            result += `    _radio_msg = radio.receive()\n`;
            result += `    if _radio_msg is not None:\n`;
            
            // Événements nombre
            for (const evt of radioNumberEvents) {
                result += `        # Traiter comme nombre\n`;
                result += `        try:\n`;
                result += `            ${evt.varName} = int(_radio_msg)\n`;
                const evtCode = convertToPython(evt.code, '            ');
                if (evtCode.trim()) {
                    result += evtCode + '\n';
                }
                result += `        except:\n`;
                result += `            pass\n`;
            }
            
            // Événements texte
            for (const evt of radioStringEvents) {
                result += `        # Traiter comme texte\n`;
                result += `        ${evt.varName} = _radio_msg\n`;
                const evtCode = convertToPython(evt.code, '        ');
                if (evtCode.trim()) {
                    result += evtCode + '\n';
                }
            }
        }
        
        // Ajouter le code forever avec injection de _check_events() dans les while
        if (foreverCode) {
            let convertedForever = convertToPython(foreverCode, '    ');
            
            // Si on a des événements et des while dans le forever, injecter _check_events()
            if (hasEvents && hasWhileInForever) {
                // Injecter _check_events() et sleep(10) à la fin de chaque bloc while
                // Pattern: trouver "while condition:" suivi d'un bloc indenté
                convertedForever = convertedForever.replace(
                    /(while [^:]+:)\n((?:[ ]{8,}[^\n]*\n)+)/g,
                    (match, whileLine, body) => {
                        // Déterminer l'indentation du corps
                        const bodyIndentMatch = body.match(/^([ ]+)/);
                        const bodyIndent = bodyIndentMatch ? bodyIndentMatch[1] : '        ';
                        return `${whileLine}\n${body}${bodyIndent}_check_events()\n${bodyIndent}sleep(10)\n`;
                    }
                );
            }
            
            if (convertedForever.trim()) {
                result += convertedForever + '\n';
            }
        }
        
        // Ajouter un sleep à la fin pour éviter de bloquer le CPU
        if (!foreverCode || (!foreverCode.includes('__pause') && !foreverCode.includes('sleep'))) {
            result += '    sleep(10)\n';
        }
        
        return result;
    }

    /**
     * Génère le fichier HEX universel
     */
    async generateHex(simCode) {
        // Vérifier que MicropythonFsHex est disponible
        if (typeof window.MicropythonFsHex === 'undefined') {
            throw new Error('MicropythonFsHex non chargé. Vérifiez que microbit-fs-bundle.js est inclus.');
        }

        // Charger les firmwares si nécessaire
        if (!this.firmwaresLoaded) {
            const loaded = await this.loadFirmwares();
            if (!loaded) {
                throw new Error('Impossible de charger les firmwares MicroPython.');
            }
        }

        // Générer le code Python
        const pythonCode = this.generatePythonCode(simCode);
        console.log('=== HEX GENERATION ===');
        console.log('Code Python généré:');
        console.log(pythonCode);
        
        // Créer l'instance MicropythonFsHex avec les deux firmwares
        const micropythonFs = new window.MicropythonFsHex([
            { hex: this.v1Hex, boardId: window.microbitBoardId.V1 },
            { hex: this.v2Hex, boardId: window.microbitBoardId.V2 }
        ]);

        // Ajouter la bibliothèque Cutebot si disponible et nécessaire
        if (this.cutebotLib && pythonCode.includes('from Cutebot import')) {
            micropythonFs.write('Cutebot.py', this.cutebotLib);
        }
        
        // Ajouter la bibliothèque MFRC522 si disponible et nécessaire
        if (this.mfrc522Lib && pythonCode.includes('from MFRC522 import')) {
            micropythonFs.write('MFRC522.py', this.mfrc522Lib);
        }

        // Écrire le programme principal
        micropythonFs.write('main.py', pythonCode);
        console.log('Fichiers dans HEX:', micropythonFs.ls());
        console.log('=== FIN ===');

        // Générer le Universal HEX
        return micropythonFs.getUniversalHex();
    }

    /**
     * Génère le code MakeCode TypeScript (méthode legacy pour compatibilité)
     */
    generateMakeCodeTS(simCode) {
        if (!simCode || simCode.trim() === '') return '// Programme vide\n';
        
        let code = simCode;
        
        // Table de correspondance des boutons IR (depuis la configuration externe)
        const irButtonMap = window.IRRemoteConfig ? window.IRRemoteConfig.typescript : {
            'Up': 5, 'Down': 13, 'Right': 10, 'Left': 8,
            'OK': 9, 'Back': 14, 'Zero': 12, 'One': 16,
            'Two': 17, 'Three': 18, 'Four': 20, 'Five': 21,
            'Six': 22, 'Seven': 24, 'Eight': 25, 'Nine': 26,
            'Off': 6, 'Menu': 4, 'Plus': 2, 'Minus': 1
        };
        
        // Détecter si le code utilise des boutons IR
        const hasIRButtons = /__irButtonPressed\("([^"]+)"\)/.test(code);
        
        // Extraire onStart
        const onStartMatch = code.match(/__onStart\(async function\(\) \{([\s\S]*?)\}\);/);
        let onStartCode = onStartMatch ? onStartMatch[1].trim() : '';
        
        // Extraire forever
        const foreverMatch = code.match(/__forever\(async function\(\) \{([\s\S]*?)\}\);/);
        let foreverCode = foreverMatch ? foreverMatch[1].trim() : '';
        
        // Détecter les variables utilisateur
        const userVars = new Set();
        if (onStartMatch) {
            const assignRegex = /^\s*(\w+)\s*=\s*\d+\s*;/gm;
            let match;
            while ((match = assignRegex.exec(onStartMatch[1])) !== null) {
                const varName = match[1];
                const keywords = ['if', 'else', 'while', 'for', 'true', 'false', 'null', 'await', 'return', 'break', 'continue'];
                if (!keywords.includes(varName)) {
                    userVars.add(varName);
                }
            }
        }
        
        const incrRegex = /\b(\w+)\s*=\s*\(typeof\s+\1\s*===\s*['"]number['"]/g;
        let incrMatch;
        while ((incrMatch = incrRegex.exec(code)) !== null) {
            userVars.add(incrMatch[1]);
        }
        
        // Détecter les variables des événements radio
        const radioVarRegexTS = /__mbOnRadioReceived(?:Number|String)\(async function\((\w+)\)/g;
        let radioVarMatchTS;
        while ((radioVarMatchTS = radioVarRegexTS.exec(code)) !== null) {
            userVars.add(radioVarMatchTS[1]);
        }
        
        // ===== Extraire les fonctions utilisateur =====
        const userFunctionsTS = [];
        const funcStartRegexTS = /async function (\w+)\s*\(([^)]*)\)\s*\{/g;
        let funcStartMatchTS;
        
        while ((funcStartMatchTS = funcStartRegexTS.exec(code)) !== null) {
            const funcName = funcStartMatchTS[1];
            const args = funcStartMatchTS[2].trim();
            const startIndex = funcStartMatchTS.index + funcStartMatchTS[0].length;
            
            // Compter les accolades pour trouver la fin de la fonction
            let braceCount = 1;
            let endIndex = startIndex;
            
            for (let i = startIndex; i < code.length && braceCount > 0; i++) {
                if (code[i] === '{') braceCount++;
                else if (code[i] === '}') braceCount--;
                endIndex = i;
            }
            
            const body = code.substring(startIndex, endIndex).trim();
            
            // Vérifier si c'est une fonction utilisateur (pas une fonction interne)
            const beforeFunc = code.substring(Math.max(0, funcStartMatchTS.index - 30), funcStartMatchTS.index);
            const isInternalFunc = /\(\s*$/.test(beforeFunc);
            
            if (!isInternalFunc) {
                userFunctionsTS.push({
                    name: funcName,
                    args: args,
                    body: body
                });
            }
        }
        
        // Fonction de conversion
        const convert = (c) => {
            if (!c) return '';
            
            c = c.replace(/(\w+)\s*=\s*\(typeof\s+\1\s*===\s*['"]number['"]\s*\?\s*\1\s*:\s*0\)\s*\+\s*(-?\d+)\s*;?/g, (match, varName, num) => {
                const n = parseInt(num);
                if (n < 0) return `${varName} = ${varName} - ${Math.abs(n)}`;
                return `${varName} = ${varName} + ${n}`;
            });
            
            // BASIC
            c = c.replace(/await __pause\(([^)]+)\);?/g, 'basic.pause($1)');
            c = c.replace(/await __mbShowNumber\(([^)]+)\);?/g, 'basic.showNumber($1)');
            c = c.replace(/__mbShowIcon\("([^"]+)"\);?/g, 'basic.showIcon(IconNames.$1)');
            c = c.replace(/__mbShowLeds\(`([^`]+)`\);?/g, 'basic.showLeds(`$1`)');
            c = c.replace(/await __mbShowString\(([^)]+)\);?/g, 'basic.showString($1)');
            c = c.replace(/__mbClearScreen\(\);?/g, 'basic.clearScreen()');
            c = c.replace(/__mbShowArrow\("([^"]+)"\);?/g, 'basic.showArrow(ArrowNames.$1)');
            
            // INPUT
            c = c.replace(/__mbButtonIsPressed\("([^"]+)"\)/g, (m, btn) => {
                if (btn === 'AB') return 'input.buttonIsPressed(Button.AB)';
                return `input.buttonIsPressed(Button.${btn})`;
            });
            c = c.replace(/__mbTemperature\(\)/g, 'input.temperature()');
            c = c.replace(/__mbLightLevel\(\)/g, 'input.lightLevel()');
            c = c.replace(/__mbCompassHeading\(\)/g, 'input.compassHeading()');
            c = c.replace(/__mbMagneticForce\("([^"]+)"\)/g, (m, dim) => {
                const dimMap = { 'x': 'X', 'y': 'Y', 'z': 'Z', 'strength': 'Strength' };
                return `input.magneticForce(Dimension.${dimMap[dim] || 'X'})`;
            });
            c = c.replace(/__mbAcceleration\("([^"]+)"\)/g, (m, dim) => {
                const dimMap = { 'x': 'X', 'y': 'Y', 'z': 'Z', 'strength': 'Strength' };
                return `input.acceleration(Dimension.${dimMap[dim] || 'X'})`;
            });
            c = c.replace(/__mbRotation\("([^"]+)"\)/g, (m, axis) => {
                return `input.rotation(Rotation.${axis === 'pitch' ? 'Pitch' : 'Roll'})`;
            });
            c = c.replace(/__mbRunningTime\(\)/g, 'input.runningTime()');
            c = c.replace(/__mbLogoIsPressed\(\)/g, 'input.logoIsPressed()');
            c = c.replace(/__mbSoundLevel\(\)/g, 'input.soundLevel()');
            
            // LED
            c = c.replace(/__mbPlot\(([^,]+),\s*([^)]+)\);?/g, 'led.plot($1, $2)');
            c = c.replace(/__mbUnplot\(([^,]+),\s*([^)]+)\);?/g, 'led.unplot($1, $2)');
            c = c.replace(/__mbToggle\(([^,]+),\s*([^)]+)\);?/g, 'led.toggle($1, $2)');
            c = c.replace(/__mbPoint\(([^,]+),\s*([^)]+)\)/g, 'led.point($1, $2)');
            c = c.replace(/__mbBrightness\(\)/g, 'led.brightness()');
            c = c.replace(/__mbSetBrightness\(([^)]+)\);?/g, 'led.setBrightness($1)');
            c = c.replace(/__mbStopAnimation\(\);?/g, 'led.stopAnimation()');
            c = c.replace(/__mbPlotBarGraph\(([^,]+),\s*([^)]+)\);?/g, 'led.plotBarGraph($1, $2)');
            c = c.replace(/__mbLedEnable\(([^)]+)\);?/g, 'led.enable($1)');
            
            // MUSIC
            c = c.replace(/await __mbPlayTone\(([^,]+),\s*([^)]+)\);?/g, 'music.playTone($1, $2)');
            c = c.replace(/__mbRingTone\(([^)]+)\);?/g, 'music.ringTone($1)');
            c = c.replace(/await __mbRest\(([^)]+)\);?/g, 'music.rest($1)');
            c = c.replace(/__mbStopAllSounds\(\);?/g, 'music.stopAllSounds()');
            c = c.replace(/__mbSetTempo\(([^)]+)\);?/g, 'music.setTempo($1)');
            c = c.replace(/__mbChangeTempoBy\(([^)]+)\);?/g, 'music.changeTempoBy($1)');
            c = c.replace(/__mbTempo\(\)/g, 'music.tempo()');
            c = c.replace(/__mbBeat\(([^)]+)\)/g, 'music.beat(BeatFraction.Whole) * $1');
            c = c.replace(/__mbSetSpeakerEnabled\(([^)]+)\);?/g, 'music.setBuiltInSpeakerEnabled($1)');
            c = c.replace(/await __mbPlaySoundEffect\("([^"]+)"\);?/g, 'soundExpression.$1.playUntilDone()');
            
            // RADIO
            c = c.replace(/__mbRadioSetGroup\(([^)]+)\);?/g, 'radio.setGroup($1)');
            c = c.replace(/__mbRadioSendNumber\(([^)]+)\);?/g, 'radio.sendNumber($1)');
            c = c.replace(/__mbRadioSendString\(([^)]+)\);?/g, 'radio.sendString($1)');
            c = c.replace(/__mbRadioSendValue\(([^,]+),\s*([^)]+)\);?/g, 'radio.sendValue($1, $2)');
            c = c.replace(/__mbRadioSetTransmitPower\(([^)]+)\);?/g, 'radio.setTransmitPower($1)');
            
            // CUTEBOT
            c = c.replace(/__motors\(([^,]+),\s*([^)]+)\);?/g, 'cuteBot.motors($1, $2)');
            c = c.replace(/__forward\(\);?/g, 'cuteBot.forward()');
            c = c.replace(/__backward\(\);?/g, 'cuteBot.backforward()');
            c = c.replace(/__turnLeft\(\);?/g, 'cuteBot.turnleft()');
            c = c.replace(/__turnRight\(\);?/g, 'cuteBot.turnright()');
            c = c.replace(/__stop\(\);?/g, 'cuteBot.stopcar()');
            c = c.replace(/await __moveTime\("([^"]+)",\s*([^,]+),\s*([^)]+)\);?/g, 
                'cuteBot.moveTime(cuteBot.Direction.$1, $2, $3)');
            c = c.replace(/__ledColor\("([^"]+)",\s*"#([^"]+)"\);?/g, 
                'cuteBot.colorLight(cuteBot.RGBLights.$1, 0x$2)');
            c = c.replace(/__ledRGB\("([^"]+)",\s*([^,]+),\s*([^,]+),\s*([^)]+)\);?/g, 
                'cuteBot.singleheadlights(cuteBot.RGBLights.$1, $2, $3, $4)');
            c = c.replace(/__ledOff\(\);?/g, 'cuteBot.closeheadlights()');
            c = c.replace(/__trackingState\("([^"]+)"\)/g, 'cuteBot.tracking(cuteBot.TrackingState.$1)');
            c = c.replace(/__trackSide\("([^"]+)",\s*"([^"]+)"\)/g, 
                'cuteBot.trackSide(cuteBot.MbPins.$1, cuteBot.MbEvents.$2)');
            c = c.replace(/__ultrasonic\("([^"]+)"\)/g, 'cuteBot.ultrasonic(cuteBot.SonarUnit.$1)');
            c = c.replace(/__servo\("([^"]+)",\s*([^)]+)\);?/g, 'cuteBot.setServo(cuteBot.ServoList.$1, $2)');
            
            // SERVO Extension (Barrières) - API servos.*
            c = c.replace(/__servoSetAngle\("P(\d+)",\s*([^)]+)\);?/g, 'servos.P$1.setAngle($2)');
            c = c.replace(/__servoRun\("P(\d+)",\s*([^)]+)\);?/g, 'servos.P$1.run($2)');
            c = c.replace(/__servoStop\("P(\d+)"\);?/g, 'servos.P$1.stop()');
            c = c.replace(/__servoSetRange\("P(\d+)",\s*([^,]+),\s*([^)]+)\);?/g, 'servos.P$1.setRange($2, $3)');
            c = c.replace(/__servoSetStopMode\("P(\d+)",\s*([^)]+)\);?/g, 'servos.P$1.setStopOnNeutral($2)');
            c = c.replace(/__servoSetPulse\("P(\d+)",\s*([^)]+)\);?/g, 'servos.P$1.setPulse($2)');
            
            // RFID Extension (Portillon) - API MFRC522.*
            c = c.replace(/__rfidInit\(\);?/g, 'MFRC522.Init()');
            c = c.replace(/__rfidGetId\(\)/g, 'MFRC522.getID()');
            c = c.replace(/__rfidRead\(\)/g, 'MFRC522.read()');
            c = c.replace(/__rfidWrite\(([^)]+)\);?/g, 'MFRC522.write($1)');
            c = c.replace(/__rfidAntennaOff\(\);?/g, 'MFRC522.AntennaOff()');
            
            // IR
            c = c.replace(/__irButtonPressed\("([^"]+)"\)/g, (match, button) => {
                const irCode = irButtonMap[button];
                return irCode !== undefined ? `(IR == ${irCode})` : 'false';
            });
            
            // Supprimer les await restants (appels de fonctions utilisateur)
            c = c.replace(/await\s+/g, '');
            
            return c;
        };
        
        // Construire le code final
        let result = '';
        
        for (const varName of userVars) {
            result += `let ${varName} = 0\n`;
        }
        
        // Générer les fonctions utilisateur
        if (userFunctionsTS.length > 0) {
            for (const func of userFunctionsTS) {
                const args = func.args; // Les arguments sont déjà au bon format
                result += `function ${func.name}(${args}) {\n`;
                const bodyCode = convert(func.body);
                if (bodyCode.trim()) {
                    result += bodyCode;
                }
                result += '}\n';
            }
        }
        
        if (hasIRButtons) {
            result += 'let IR = 0\n';
            result += 'cuteBot.IR_callback(function (code) {\n';
            result += '    IR = code\n';
            result += '})\n';
        }
        
        if (onStartCode) {
            const lines = onStartCode.split('\n').map(line => line.replace(/^\s+/, ''));
            const cleanedOnStart = lines.join('\n');
            const converted = convert(cleanedOnStart).trim();
            if (converted) {
                result += converted + '\n';
            }
        }
        
        if (foreverCode) {
            result += 'basic.forever(function () {\n';
            result += convert(foreverCode);
            result += '})\n';
        }
        
        // Événements
        const buttonEvents = code.matchAll(/__mbOnButtonPressed\("([^"]+)",\s*async function\(\) \{([\s\S]*?)\}\);/g);
        for (const m of buttonEvents) {
            const btn = m[1] === 'AB' ? 'Button.AB' : `Button.${m[1]}`;
            result += `input.onButtonPressed(${btn}, function () {\n${convert(m[2])}})\n`;
        }
        
        const gestureEvents = code.matchAll(/__mbOnGesture\("([^"]+)",\s*async function\(\) \{([\s\S]*?)\}\);/g);
        for (const m of gestureEvents) {
            const gestureMap = {
                'shake': 'Shake', 'logo up': 'LogoUp', 'logo down': 'LogoDown',
                'screen up': 'ScreenUp', 'screen down': 'ScreenDown',
                'tilt left': 'TiltLeft', 'tilt right': 'TiltRight',
                'free fall': 'FreeFall', '3g': 'ThreeG', '6g': 'SixG'
            };
            const gesture = gestureMap[m[1]] || 'Shake';
            result += `input.onGesture(Gesture.${gesture}, function () {\n${convert(m[2])}})\n`;
        }
        
        const logoEvents = code.matchAll(/__mbOnLogoEvent\("([^"]+)",\s*async function\(\) \{([\s\S]*?)\}\);/g);
        for (const m of logoEvents) {
            const eventMap = { 'pressed': 'Pressed', 'released': 'Released', 'long pressed': 'LongPressed' };
            const event = eventMap[m[1]] || 'Pressed';
            result += `input.onLogoEvent(TouchButtonEvent.${event}, function () {\n${convert(m[2])}})\n`;
        }
        
        // Événements radio - nombre reçu
        const radioNumberEvents = code.matchAll(/__mbOnRadioReceivedNumber\(async function\((\w+)\) \{([\s\S]*?)\}\);/g);
        for (const m of radioNumberEvents) {
            const varName = m[1];
            result += `radio.onReceivedNumber(function (${varName}) {\n${convert(m[2])}})\n`;
        }
        
        // Événements radio - texte reçu
        const radioStringEvents = code.matchAll(/__mbOnRadioReceivedString\(async function\((\w+)\) \{([\s\S]*?)\}\);/g);
        for (const m of radioStringEvents) {
            const varName = m[1];
            result += `radio.onReceivedString(function (${varName}) {\n${convert(m[2])}})\n`;
        }
        
        return result;
    }
}

// ============== FONCTIONS GLOBALES ==============

/**
 * Télécharge le fichier .mkcd et ouvre MakeCode
 * Comportement original qui fonctionne
 */
async function downloadHexFile(simCode) {
    const hexGen = new HexGenerator();
    
    // Stocker le code pour l'option mkcd
    window._currentSimCode = simCode;
    window._currentTsCode = hexGen.generateMakeCodeTS(simCode);
    
    // Stocker pour utilisation dans les callbacks
    window._pendingHexGen = hexGen;
    window._pendingSimCode = simCode;
    
    // Détecter si le code utilise des boutons IR
    const usesIRButtons = /__irButtonPressed\(/.test(simCode);
    
    if (usesIRButtons) {
        // Les boutons IR ne fonctionnent pas en HEX MicroPython direct
        // Forcer le fallback mkcd qui fonctionne parfaitement
        console.log('Programme avec IR détecté - utilisation du fallback mkcd');
        showLoading(false);
        downloadMkcdAndShowInstructions(hexGen, simCode, true); // true = IR détecté
        return;
    }
    
    // Vérifier si WebUSB est disponible (Chrome/Edge)
    const webUSBAvailable = window.WebUSBFlasher && window.WebUSBFlasher.checkSupport();
    
    if (webUSBAvailable) {
        // Vérifier si un micro:bit appairé est connecté (sans interaction utilisateur)
        const hasMicrobit = await window.WebUSBFlasher.hasPairedMicrobit();
        
        if (hasMicrobit) {
            // micro:bit détecté → tenter le téléversement direct
            console.log('🔌 micro:bit appairé détecté - téléversement direct');
            await attemptWebUSBFlash(hexGen, simCode);
        } else {
            // Pas de micro:bit appairé → téléchargement classique
            console.log('📥 Pas de micro:bit appairé - téléchargement du fichier');
            await performClassicDownload(hexGen, simCode);
        }
    } else {
        // Firefox ou autre : téléchargement classique directement
        await performClassicDownload(hexGen, simCode);
    }
}

/**
 * Tente automatiquement le téléversement WebUSB
 * Si échec ou annulation → télécharge le fichier HEX
 */
async function attemptWebUSBFlash(hexGen, simCode) {
    // Afficher le dialogue de progression
    showWebUSBProgressDialog();
    
    try {
        // Générer le HEX d'abord
        updateWebUSBStatus('generation', 'Génération du programme...');
        
        hexGen.firmwaresLoaded = false;
        const hexContent = await hexGen.generateHex(simCode);
        
        // Tenter la connexion WebUSB
        updateWebUSBStatus('connecting', 'Connexion au micro:bit...');
        
        const result = await window.WebUSBFlasher.connectAndFlash(
            hexContent,
            (progress) => {
                updateWebUSBProgress(progress);
            },
            (status) => {
                switch(status) {
                    case 'connecting':
                        updateWebUSBStatus('connecting', 'Connexion au micro:bit...');
                        break;
                    case 'flashing':
                        updateWebUSBStatus('flashing', 'Téléversement en cours...');
                        updateWebUSBInfo('Ne débranchez pas le micro:bit');
                        break;
                    case 'done':
                        updateWebUSBStatus('done', 'Terminé !');
                        break;
                }
            }
        );
        
        if (result.success) {
            // Succès !
            showWebUSBSuccessDialog();
        } else {
            // Échec → Télécharger le fichier HEX à la place
            console.log('WebUSB échoué, fallback téléchargement:', result.error);
            closeMakeCodeDialog();
            
            // Télécharger le HEX généré directement (on l'a déjà)
            downloadHexContent(hexContent);
            showHexSuccessDialog();
        }
        
    } catch (error) {
        console.error('Erreur WebUSB:', error);
        closeMakeCodeDialog();
        
        // Fallback : téléchargement classique
        await performClassicDownload(hexGen, simCode);
    }
}

/**
 * Télécharge un contenu HEX déjà généré
 */
function downloadHexContent(hexContent) {
    const blob = new Blob([hexContent], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'microbit-program.hex';
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Fichier HEX téléchargé !', 'success');
}

/**
 * Réessaye le flash WebUSB (depuis le dialogue d'erreur)
 */
async function retryWebUSBFlash() {
    const hexGen = window._pendingHexGen;
    const simCode = window._pendingSimCode;
    
    if (!hexGen || !simCode) {
        showToast('❌ Erreur interne', 'error');
        return;
    }
    
    closeMakeCodeDialog();
    await attemptWebUSBFlash(hexGen, simCode);
}

/**
 * Démarre le téléchargement classique (fallback)
 */
async function startClassicDownload() {
    const hexGen = window._pendingHexGen;
    const simCode = window._pendingSimCode;
    
    closeMakeCodeDialog();
    
    if (hexGen && simCode) {
        await performClassicDownload(hexGen, simCode);
    }
}

/**
 * Effectue le téléchargement classique du fichier HEX
 */
async function performClassicDownload(hexGen, simCode) {
    try {
        showLoading(true);
        
        // Forcer le rechargement des firmwares (ne pas utiliser le cache)
        hexGen.firmwaresLoaded = false;
        
        // Essayer d'abord la génération directe HEX
        const hexContent = await hexGen.generateHex(simCode);
        
        // Télécharger le fichier HEX
        const blob = new Blob([hexContent], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'microbit-program.hex';
        a.click();
        URL.revokeObjectURL(url);
        
        showLoading(false);
        showToast('✅ Fichier HEX téléchargé !', 'success');
        showHexSuccessDialog();
        
    } catch (error) {
        console.error('Erreur génération HEX:', error);
        showLoading(false);
        
        // Fallback : télécharger directement le .mkcd et afficher les instructions
        downloadMkcdAndShowInstructions(hexGen, simCode, false);
    }
}

/**
 * Affiche le dialogue de progression WebUSB
 */
function showWebUSBProgressDialog() {
    const old = document.getElementById('makeCodeModal');
    if (old) old.remove();
    
    const modal = document.createElement('div');
    modal.id = 'makeCodeModal';
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <div class="modal-header">
                <h2>🔌 Téléversement sur micro:bit</h2>
            </div>
            <div class="modal-body" style="padding: 24px; text-align: center;">
                <div id="webusb-status-icon" style="font-size: 64px; margin-bottom: 16px;">🔄</div>
                <div id="webusb-status-text" style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 16px;">
                    Préparation...
                </div>
                
                <!-- Instructions (même style que l'appairage) -->
                <div id="webusb-instructions" style="background: #dbeafe; border-radius: 10px; padding: 16px; color: #1e40af; font-size: 15px; line-height: 1.8; margin-bottom: 16px; display: none;">
                    <strong>1.</strong> Cliquez sur<br>
                    <strong style="font-size: 14px;">« BBC micro:bit CMSIS-DAP »</strong><br>
                    <strong>2.</strong> Cliquez sur <strong>« Connexion »</strong>
                </div>
                
                <div id="webusb-status-info" style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px; min-height: 20px;">
                    
                </div>
                <div id="webusb-progress-container" style="display: none; margin-top: 20px;">
                    <div style="background: var(--bg-input); border-radius: 10px; height: 20px; overflow: hidden;">
                        <div id="webusb-progress-bar" style="background: linear-gradient(90deg, #10b981, #3b82f6); height: 100%; width: 0%; transition: width 0.3s ease; border-radius: 10px;"></div>
                    </div>
                    <div id="webusb-progress-text" style="margin-top: 8px; font-size: 14px; color: var(--text-secondary);">0%</div>
                </div>
            </div>
            <div class="modal-footer" id="webusb-footer">
                <button class="btn btn-outline" onclick="cancelWebUSBAndDownload()" style="font-size: 13px;">
                    Télécharger le fichier à la place
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/**
 * Annule le WebUSB et télécharge le fichier à la place
 */
async function cancelWebUSBAndDownload() {
    // Déconnecter si en cours
    if (window.WebUSBFlasher) {
        await window.WebUSBFlasher.disconnect();
    }
    
    closeMakeCodeDialog();
    
    const hexGen = window._pendingHexGen;
    const simCode = window._pendingSimCode;
    
    if (hexGen && simCode) {
        await performClassicDownload(hexGen, simCode);
    }
}

/**
 * Met à jour le statut du dialogue WebUSB
 */
function updateWebUSBStatus(status, text) {
    const iconEl = document.getElementById('webusb-status-icon');
    const textEl = document.getElementById('webusb-status-text');
    const progressContainer = document.getElementById('webusb-progress-container');
    const instructionsEl = document.getElementById('webusb-instructions');
    
    if (!iconEl) return;
    
    const icons = {
        'generation': '⚙️',
        'connecting': '🔌',
        'flashing': '📥',
        'done': '✅',
        'error': '❌'
    };
    
    iconEl.textContent = icons[status] || '🔄';
    textEl.textContent = text || '';
    
    // Afficher les instructions uniquement lors de la connexion
    if (instructionsEl) {
        instructionsEl.style.display = (status === 'connecting') ? 'block' : 'none';
    }
    
    if (status === 'flashing') {
        progressContainer.style.display = 'block';
    }
}

/**
 * Met à jour le texte d'info secondaire
 */
function updateWebUSBInfo(text) {
    const infoEl = document.getElementById('webusb-status-info');
    if (infoEl) {
        infoEl.textContent = text || '';
    }
}

/**
 * Met à jour la barre de progression WebUSB
 */
function updateWebUSBProgress(percent) {
    const bar = document.getElementById('webusb-progress-bar');
    const text = document.getElementById('webusb-progress-text');
    
    if (bar) bar.style.width = percent + '%';
    if (text) text.textContent = percent + '%';
}

/**
 * Affiche le dialogue de succès WebUSB
 */
function showWebUSBSuccessDialog() {
    const old = document.getElementById('makeCodeModal');
    if (old) old.remove();
    
    const modal = document.createElement('div');
    modal.id = 'makeCodeModal';
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h2>✅ Téléversement réussi !</h2>
                <button class="modal-close" onclick="closeMakeCodeDialog()">&times;</button>
            </div>
            <div class="modal-body" style="text-align: center; padding: 24px;">
                <div style="font-size: 80px; margin-bottom: 16px;">🎉</div>
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 20px; color: white;">
                    <p style="margin: 0; font-size: 18px; font-weight: 600;">
                        Le programme a été envoyé<br>sur votre micro:bit !
                    </p>
                </div>
                <p style="margin-top: 16px; color: var(--text-secondary); font-size: 14px;">
                    Votre micro:bit exécute maintenant le nouveau programme.
                </p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="closeMakeCodeDialog()" style="width: 100%;">
                    👍 Super !
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeMakeCodeDialog();
        }
    });
    
    showToast('✅ Programme téléversé !', 'success');
}

/**
 * Affiche le dialogue d'erreur WebUSB avec option de fallback
 */
function showWebUSBErrorDialog(errorMessage) {
    const old = document.getElementById('makeCodeModal');
    if (old) old.remove();
    
    const modal = document.createElement('div');
    modal.id = 'makeCodeModal';
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <div class="modal-header">
                <h2>⚠️ Téléversement impossible</h2>
                <button class="modal-close" onclick="closeMakeCodeDialog()">&times;</button>
            </div>
            <div class="modal-body" style="padding: 24px;">
                <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <span style="font-size: 24px;">⚠️</span>
                        <div>
                            <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">Erreur de connexion</div>
                            <div style="color: #78350f; font-size: 14px;">${escapeHtml(errorMessage)}</div>
                        </div>
                    </div>
                </div>
                
                <div style="background: var(--bg-card); border-radius: 10px; padding: 16px;">
                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">💡 Solutions :</div>
                    <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8;">
                        <li>Vérifiez que le micro:bit est bien branché en USB</li>
                        <li>Fermez MakeCode ou l'éditeur Python s'ils sont ouverts</li>
                        <li>Essayez de débrancher et rebrancher le micro:bit</li>
                        <li>Utilisez le téléchargement classique ci-dessous</li>
                    </ul>
                </div>
            </div>
            <div class="modal-footer" style="flex-direction: column; gap: 8px;">
                <button class="btn btn-primary" onclick="retryWebUSBFlash()" style="width: 100%;">
                    🔄 Réessayer
                </button>
                <button class="btn btn-outline" onclick="startClassicDownload()" style="width: 100%;">
                    💾 Télécharger le fichier à la place
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeMakeCodeDialog();
        }
    });
}

/**
 * Fallback : télécharge le .mkcd et affiche les instructions MakeCode
 * @param {boolean} isIRProgram - true si le programme utilise des boutons IR
 */
function downloadMkcdAndShowInstructions(hexGen, simCode, isIRProgram = false) {
    // Générer le code TypeScript pour MakeCode
    const tsCode = hexGen.generateMakeCodeTS(simCode);
    const pythonCode = hexGen.generatePythonCode(simCode);
    
    // Stocker pour utilisation ultérieure
    window._currentSimCode = simCode;
    window._currentTsCode = tsCode;
    window._currentPythonCode = pythonCode;
    
    // Télécharger automatiquement le .mkcd
    downloadMkcdFile(tsCode);
    
    // Afficher les instructions (avec message spécial pour IR)
    showMkcdInstructions(tsCode, pythonCode, isIRProgram);
}

/**
 * Télécharge le fichier .mkcd
 */
function downloadMkcdFile(tsCode) {
    // Déterminer les dépendances
    const deps = { "core": "*" };
    if (/cuteBot\./.test(tsCode)) {
        deps["cutebot"] = "github:elecfreaks/pxt-cutebot#v6.2.4";
    }
    if (/radio\./.test(tsCode)) {
        deps["radio"] = "*";
    }
    
    // Créer le projet au format MakeCode (minimal)
    const project = {
        "main.ts": tsCode,
        "main.blocks": "",
        "pxt.json": JSON.stringify({
            "name": "microbit-program",
            "dependencies": deps,
            "files": ["main.ts"],
            "preferredEditor": "tsprj"
        }, null, 4)
    };
    
    const blob = new Blob([JSON.stringify(project, null, 2)], { 
        type: 'application/octet-stream' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cutebot-program.mkcd';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Affiche les instructions pour importer le .mkcd dans MakeCode
 * @param {boolean} isIRProgram - true si le programme utilise des boutons IR
 */
function showMkcdInstructions(tsCode, pythonCode, isIRProgram = false) {
    const old = document.getElementById('makeCodeModal');
    if (old) old.remove();
    
    // Message spécial pour les programmes IR
    const irMessage = isIRProgram ? `
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 16px; text-align: left;">
            <div style="display: flex; align-items: flex-start; gap: 10px;">
                <span style="font-size: 20px;">📡</span>
                <div>
                    <strong style="color: #92400e;">Programme avec télécommande IR</strong>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #92400e;">
                        Les programmes utilisant la télécommande IR nécessitent MakeCode pour fonctionner correctement sur le micro:bit.
                    </p>
                </div>
            </div>
        </div>
    ` : '';
    
    const modal = document.createElement('div');
    modal.id = 'makeCodeModal';
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h2>📥 Fichier téléchargé !</h2>
                <button class="modal-close" onclick="closeMakeCodeDialog()">&times;</button>
            </div>
            <div class="modal-body" style="padding: 24px; text-align: center;">
                
                <div style="font-size: 56px; margin-bottom: 16px;">${isIRProgram ? '📡' : '📦'}</div>
                
                ${irMessage}
                
                <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 12px; padding: 20px; margin-bottom: 20px; color: white;">
                    <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">
                        Importez ce fichier dans MakeCode :
                    </p>
                    <ol style="text-align: left; margin: 0 0 0 20px; font-size: 14px; line-height: 2;">
                        <li>Ouvrez <strong>makecode.microbit.org</strong></li>
                        <li>Cliquez sur <strong>Importer</strong></li>
                        <li>Sélectionnez le fichier téléchargé</li>
                        <li>Cliquez sur <strong>Télécharger</strong></li>
                    </ol>
                </div>
                
                <button class="btn btn-primary" onclick="window.open('https://makecode.microbit.org/', '_blank');" style="font-size: 15px; padding: 12px 24px; margin-bottom: 16px;">
                    🚀 Ouvrir MakeCode
                </button>
                
                <p style="color: var(--text-muted); font-size: 12px; margin: 0;">
                    💡 Vous pouvez aussi glisser-déposer le fichier sur MakeCode
                </p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="downloadMkcdFallback()" style="font-size: 13px;">
                    📥 Re-télécharger
                </button>
                <button class="btn btn-primary" onclick="closeMakeCodeDialog()">
                    👍 Compris !
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fermer en cliquant en dehors
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeMakeCodeDialog();
        }
    });
    
    showToast(isIRProgram ? '📡 Programme IR - Fichier .mkcd téléchargé' : '📥 Fichier .mkcd téléchargé', 'success');
}

/**
 * Affiche les instructions de glisser-déposer
 */
function showDragDropInstructions(tsCode, makeCodeOpened) {
    const old = document.getElementById('makeCodeModal');
    if (old) old.remove();
    
    const modal = document.createElement('div');
    modal.id = 'makeCodeModal';
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2>📥 3 étapes simples</h2>
                <button class="modal-close" onclick="closeMakeCodeDialog()">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                
                <!-- Étape 1 -->
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; color: white;">
                    <div style="font-size: 36px; font-weight: bold; opacity: 0.9;">1</div>
                    <div>
                        <div style="font-weight: 600; font-size: 16px;">✅ Fichier téléchargé !</div>
                        <div style="opacity: 0.9; font-size: 14px;">cutebot-program.mkcd dans vos téléchargements</div>
                    </div>
                </div>
                
                <!-- Étape 2 -->
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px; padding: 16px; background: ${makeCodeOpened ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}; border-radius: 12px; color: white;">
                    <div style="font-size: 36px; font-weight: bold; opacity: 0.9;">2</div>
                    <div>
                        <div style="font-weight: 600; font-size: 16px;">${makeCodeOpened ? '✅ MakeCode ouvert !' : '⚠️ Ouvrez MakeCode'}</div>
                        <div style="opacity: 0.9; font-size: 14px;">${makeCodeOpened ? 'Dans le nouvel onglet' : 'Cliquez sur le bouton ci-dessous'}</div>
                    </div>
                </div>
                
                <!-- Étape 3 - La plus importante -->
                <div style="padding: 20px; background: var(--bg-card); border-radius: 12px; border: 3px solid var(--accent-primary);">
                    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                        <div style="font-size: 36px; font-weight: bold; color: var(--accent-primary);">3</div>
                        <div style="font-weight: 600; font-size: 18px; color: var(--text-primary);">
                            Glissez-déposez le fichier dans MakeCode
                        </div>
                    </div>
                    
                    <div style="text-align: center; padding: 20px; background: var(--bg-input); border-radius: 10px; border: 2px dashed var(--accent-primary);">
                        <div style="font-size: 48px; margin-bottom: 10px;">📁 → 🖥️</div>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
                            Prenez le fichier <strong>cutebot-program.mkcd</strong><br>
                            et déposez-le sur la page MakeCode
                        </p>
                    </div>
                    
                    <div style="margin-top: 16px; padding: 12px; background: #dbeafe; border-radius: 8px; color: #1e40af; font-size: 13px;">
                        💡 <strong>Astuce :</strong> Ouvrez le dossier Téléchargements à côté de MakeCode, puis glissez le fichier !
                    </div>
                </div>
                
                <!-- Ensuite -->
                <div style="margin-top: 20px; padding: 16px; background: var(--bg-input); border-radius: 10px; text-align: center;">
                    <p style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 14px;">
                        Ensuite, cliquez sur <span style="background: #7c3aed; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600;">Télécharger</span> dans MakeCode
                    </p>
                    <p style="margin: 0; color: var(--text-muted); font-size: 12px;">
                        Le fichier .hex sera prêt à copier sur votre micro:bit !
                    </p>
                </div>
                
                <details style="background: var(--bg-input); border-radius: 10px; padding: 12px; margin-top: 16px;">
                    <summary style="cursor: pointer; font-weight: 600; color: var(--text-secondary); font-size: 13px;">
                        📋 Voir le code TypeScript
                    </summary>
                    <pre style="margin-top: 12px; padding: 12px; background: var(--bg-dark); border-radius: 8px; font-size: 11px; overflow-x: auto; color: #e2e8f0; white-space: pre-wrap; max-height: 150px;">${escapeHtml(tsCode)}</pre>
                    <button class="btn btn-outline btn-small" style="margin-top: 10px; font-size: 12px;" onclick="copyToClipboard(\`${escapeForJs(tsCode)}\`)">
                        📋 Copier
                    </button>
                </details>
            </div>
            <div class="modal-footer">
                ${!makeCodeOpened ? `<button class="btn btn-primary" onclick="window.open('https://makecode.microbit.org/', '_blank');">
                    🚀 Ouvrir MakeCode
                </button>` : ''}
                <button class="btn ${makeCodeOpened ? 'btn-primary' : 'btn-outline'}" onclick="closeMakeCodeDialog()">
                    👍 Compris !
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fermer en cliquant en dehors
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeMakeCodeDialog();
        }
    });
}

/**
 * Affiche le dialog quand les firmwares sont manquants
 */
function showFirmwareMissingDialog(hexGen, simCode) {
    const old = document.getElementById('makeCodeModal');
    if (old) old.remove();
    
    const pythonCode = hexGen.generatePythonCode(simCode);
    const tsCode = hexGen.generateMakeCodeTS(simCode);
    
    const modal = document.createElement('div');
    modal.id = 'makeCodeModal';
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h2>⚠️ Firmwares non trouvés</h2>
                <button class="modal-close" onclick="closeMakeCodeDialog()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
                    <h3 style="color: #92400e; margin: 0 0 12px 0; font-size: 16px;">
                        📁 Pour activer l'export direct en .hex
                    </h3>
                    <p style="color: #78350f; margin: 0 0 12px 0; font-size: 14px;">
                        Téléchargez ces fichiers et placez-les dans le dossier <code>firmware/</code> :
                    </p>
                    <ol style="margin: 0 0 0 20px; color: #78350f; font-size: 14px; line-height: 2;">
                        <li><a href="https://github.com/bbcmicrobit/micropython/releases" target="_blank" style="color: #1d4ed8;">micropython-v1.hex</a> (micro:bit V1)</li>
                        <li><a href="https://github.com/microbit-foundation/micropython-microbit-v2/releases" target="_blank" style="color: #1d4ed8;">micropython-v2.hex</a> (micro:bit V2)</li>
                        <li><a href="https://github.com/elecfreaks/EF_Produce_MicroPython" target="_blank" style="color: #1d4ed8;">Cutebot.py</a> (optionnel, pour Cutebot)</li>
                    </ol>
                </div>
                
                <div style="background: var(--bg-card); border-radius: 10px; padding: 16px; margin-bottom: 16px;">
                    <h3 style="color: var(--accent-primary); margin: 0 0 12px 0; font-size: 16px;">
                        🔄 Alternative : Utiliser MakeCode
                    </h3>
                    <ol style="margin: 0 0 0 20px; color: var(--text-primary); font-size: 14px; line-height: 2;">
                        <li>Téléchargez le fichier .mkcd ci-dessous</li>
                        <li>Ouvrez <a href="https://makecode.microbit.org/" target="_blank" style="color: #1d4ed8;">MakeCode</a></li>
                        <li>Cliquez sur <strong>Importer</strong> → <strong>Importer un fichier...</strong></li>
                        <li>Sélectionnez le fichier .mkcd</li>
                        <li>Cliquez sur <strong>Télécharger</strong></li>
                    </ol>
                    <button class="btn btn-primary" style="margin-top: 12px;" onclick="downloadMkcdFallback()">
                        📥 Télécharger le .mkcd
                    </button>
                </div>
                
                <details style="background: var(--bg-input); border-radius: 10px; padding: 12px;">
                    <summary style="cursor: pointer; font-weight: 600; color: var(--text-secondary);">
                        🐍 Voir le code Python généré
                    </summary>
                    <pre style="margin-top: 12px; padding: 12px; background: var(--bg-dark); border-radius: 8px; font-size: 12px; overflow-x: auto; color: #e2e8f0; white-space: pre-wrap; max-height: 200px;">${escapeHtml(pythonCode)}</pre>
                    <button class="btn btn-outline btn-small" style="margin-top: 10px;" onclick="copyToClipboard(\`${escapeForJs(pythonCode)}\`)">
                        📋 Copier le Python
                    </button>
                </details>
                
                <details style="background: var(--bg-input); border-radius: 10px; padding: 12px; margin-top: 10px;">
                    <summary style="cursor: pointer; font-weight: 600; color: var(--text-secondary);">
                        📋 Voir le code TypeScript (MakeCode)
                    </summary>
                    <pre style="margin-top: 12px; padding: 12px; background: var(--bg-dark); border-radius: 8px; font-size: 12px; overflow-x: auto; color: #e2e8f0; white-space: pre-wrap; max-height: 200px;">${escapeHtml(tsCode)}</pre>
                    <button class="btn btn-outline btn-small" style="margin-top: 10px;" onclick="copyToClipboard(\`${escapeForJs(tsCode)}\`)">
                        📋 Copier le TypeScript
                    </button>
                </details>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeMakeCodeDialog()">Fermer</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fermer en cliquant en dehors
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeMakeCodeDialog();
        }
    });
    
    // Stocker le code pour le fallback
    window._currentSimCode = simCode;
    window._currentTsCode = tsCode;
}

/**
 * Fallback : télécharge un fichier .mkcd pour MakeCode
 */
function downloadMkcdFallback() {
    const tsCode = window._currentTsCode || '';
    
    // Déterminer les dépendances
    const deps = { "core": "*" };
    if (/cuteBot\./.test(tsCode)) {
        deps["cutebot"] = "github:elecfreaks/pxt-cutebot#v6.2.4";
    }
    if (/radio\./.test(tsCode)) {
        deps["radio"] = "*";
    }
    if (/servos\./.test(tsCode)) {
        deps["servo"] = "*";
    }
    if (/MFRC522\./.test(tsCode)) {
        deps["mfrc522"] = "github:joy-it/pxt-rfid-mfrc522#1.0.1";
    }
    
    // Créer le projet au format MakeCode
    const pxtJson = {
        "name": "microbit-program",
        "version": "0.0.1",
        "description": "",
        "dependencies": deps,
        "files": [
            "main.blocks",
            "main.ts"
        ],
        "testFiles": [],
        "supportedTargets": [
            "microbit"
        ],
        "preferredEditor": "blocksprj"
    };
    
    const project = {
        "main.ts": tsCode,
        "main.blocks": "",
        "pxt.json": JSON.stringify(pxtJson, null, 4)
    };
    
    const blob = new Blob([JSON.stringify(project, null, 2)], { 
        type: 'application/octet-stream' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'microbit-program.mkcd';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('📥 Fichier .mkcd téléchargé', 'success');
}

/**
 * Affiche le dialog de succès après téléchargement HEX
 */
function showHexSuccessDialog() {
    const old = document.getElementById('makeCodeModal');
    if (old) old.remove();
    
    // Vérifier si WebUSB est supporté pour proposer l'appairage
    const webUSBSupported = window.WebUSBFlasher && window.WebUSBFlasher.checkSupport();
    
    const modal = document.createElement('div');
    modal.id = 'makeCodeModal';
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 420px;">
            <div class="modal-header">
                <h2>✅ C'est prêt !</h2>
                <button class="modal-close" onclick="closeMakeCodeDialog()">&times;</button>
            </div>
            <div class="modal-body" style="text-align: center; padding: 24px;">
                <div style="font-size: 72px; margin-bottom: 16px;">🎉</div>
                
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 20px; margin-bottom: 20px; color: white;">
                    <p style="margin: 0; font-size: 18px; font-weight: 600;">
                        📁 Copiez le fichier téléchargé<br>dans votre micro:bit !
                    </p>
                </div>
                
                ${webUSBSupported ? `
                <div style="background: var(--bg-input); border-radius: 10px; padding: 16px; text-align: left;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <span style="font-size: 20px;">💡</span>
                        <strong style="color: var(--text-primary); font-size: 14px;">Astuce pour la prochaine fois</strong>
                    </div>
                    <p style="margin: 0 0 12px 0; font-size: 13px; color: var(--text-secondary);">
                        Appairez votre micro:bit pour téléverser directement sans copier de fichier !
                    </p>
                    <button class="btn btn-outline btn-small" onclick="pairMicrobitForNextTime()" style="width: 100%; font-size: 13px;">
                        🔌 Appairer mon micro:bit
                    </button>
                </div>
                ` : ''}
            </div>
            <div class="modal-footer" style="flex-direction: column; gap: 8px;">
                <button class="btn btn-primary" onclick="closeMakeCodeDialog()" style="width: 100%; display: flex; justify-content: center; align-items: center;">
                    👍 Compris !
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fermer en cliquant en dehors
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeMakeCodeDialog();
        }
    });
}

/**
 * Permet à l'utilisateur d'appairer son micro:bit pour les prochaines fois
 */
async function pairMicrobitForNextTime() {
    // Afficher les instructions avant d'ouvrir le dialogue
    const infoDiv = document.createElement('div');
    infoDiv.id = 'pairing-instructions';
    infoDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--bg-card, #1e293b); border: 2px solid #3b82f6; border-radius: 16px; padding: 24px; z-index: 10001; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); max-width: 400px;';
    infoDiv.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">🔌</div>
        <div style="font-size: 16px; font-weight: 600; color: var(--text-primary, #f1f5f9); margin-bottom: 12px;">
            Une fenêtre va s'ouvrir
        </div>
        <div style="background: #dbeafe; border-radius: 10px; padding: 16px; color: #1e40af; font-size: 15px; line-height: 1.8;">
            <strong>1.</strong> Cliquez sur<br>
            <strong style="font-size: 14px;">« BBC micro:bit CMSIS-DAP »</strong><br>
            <strong>2.</strong> Cliquez sur <strong>« Connexion »</strong>
        </div>
        <div style="margin-top: 12px; font-size: 13px; color: var(--text-secondary, #94a3b8);">
            🔌 Connecte ta carte micro:bit à l'ordinateur
        </div>
    `;
    document.body.appendChild(infoDiv);
    
    // Petit délai pour que l'utilisateur lise les instructions
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
        // Ouvrir le dialogue d'appairage WebUSB
        const device = await navigator.usb.requestDevice({
            filters: [{ vendorId: 0x0d28 }] // micro:bit vendor ID
        });
        
        // Supprimer les instructions
        const instructions = document.getElementById('pairing-instructions');
        if (instructions) instructions.remove();
        
        if (device) {
            closeMakeCodeDialog();
            showToast('✅ micro:bit appairé ! Le téléversement direct fonctionnera maintenant.', 'success');
        }
    } catch (error) {
        // Supprimer les instructions
        const instructions = document.getElementById('pairing-instructions');
        if (instructions) instructions.remove();
        
        if (error.name === 'NotFoundError') {
            showToast('ℹ️ Appairage annulé', 'info');
        } else {
            console.error('Erreur appairage:', error);
            showToast('⚠️ Erreur lors de l\'appairage', 'error');
        }
    }
}

function closeMakeCodeDialog() {
    const m = document.getElementById('makeCodeModal');
    if (m) m.remove();
}

function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

function escapeForJs(t) {
    return t.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function copyToClipboard(t) {
    navigator.clipboard.writeText(t).then(() => showToast('📋 Copié !', 'success'));
}

function showLoading(show) {
    const o = document.getElementById('loadingOverlay');
    if (o) o.classList.toggle('show', show);
}

function showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

/**
 * Affiche la popup de soutien
 */
function showSupportDialog() {
    const old = document.getElementById('makeCodeModal');
    if (old) old.remove();
    
    const modal = document.createElement('div');
    modal.id = 'makeCodeModal';
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h2>❤️ Soutenir ce projet</h2>
                <button class="modal-close" onclick="closeMakeCodeDialog()">&times;</button>
            </div>
            <div class="modal-body" style="text-align: center; padding: 24px;">
                <div style="font-size: 64px; margin-bottom: 16px;">💖</div>
                <p style="font-size: 16px; color: var(--text-primary); margin-bottom: 16px;">
                    Application créée par <strong>Max</strong>.
                </p>
                <p style="font-size: 15px; color: var(--text-secondary); margin-bottom: 20px;">
                    Si cette application vous plaît, vous pouvez soutenir mon travail ici :
                </p>
                <a href="https://fr.tipeee.com/maxtechno/" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #e91e63 0%, #ff5722 100%); color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 8px 25px rgba(233, 30, 99, 0.4)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none';">
                    🎁 Soutenir sur Tipeee
                </a>
                <p style="font-size: 18px; color: var(--text-primary); margin-top: 20px;">
                    Merci ! 🙏
                </p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeMakeCodeDialog()" style="width: 100%; display: flex; justify-content: center; align-items: center;">
                    Fermer
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeMakeCodeDialog();
        }
    });
}
