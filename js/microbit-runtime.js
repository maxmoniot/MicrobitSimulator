/**
 * Micro:bit Runtime Functions
 * Fonctions appelées par le code généré Blockly
 * Fait le pont entre le code généré et le simulateur
 */

// microbitSim est déclaré dans app.js, on utilise cette variable globale

// Initialiser le runtime micro:bit
function initMicrobitRuntime(simulator) {
    microbitSim = simulator;
}

// =============================================================================
// BASIC - Affichage
// =============================================================================

async function __mbShowNumber(num) {
    // Ignorer les valeurs vides/null (ex: RFID sans badge retourne '')
    if (num === '' || num === null || num === undefined) return;
    if (microbitSim) await microbitSim.showNumber(num);
}

function __mbShowIcon(iconName) {
    if (microbitSim) microbitSim.showIcon(iconName);
}

function __mbShowLeds(pattern) {
    if (microbitSim) microbitSim.showLeds(pattern);
}

async function __mbShowString(text) {
    if (microbitSim) await microbitSim.showString(text);
}

function __mbClearScreen() {
    if (microbitSim) microbitSim.clearScreen();
}

function __mbShowArrow(direction) {
    if (microbitSim) microbitSim.showArrow(direction);
}

// =============================================================================
// INPUT - Boutons et capteurs
// =============================================================================

function __mbOnButtonPressed(button, callback) {
    if (microbitSim) microbitSim.onButtonPressed(button, callback);
}

function __mbButtonIsPressed(button) {
    return microbitSim ? microbitSim.isButtonPressed(button) : false;
}

function __mbOnGesture(gesture, callback) {
    if (microbitSim) microbitSim.onGesture(gesture, callback);
}

function __mbTemperature() {
    return microbitSim ? microbitSim.getTemperature() : 21;
}

function __mbLightLevel() {
    return microbitSim ? microbitSim.getLightLevel() : 128;
}

function __mbCompassHeading() {
    return microbitSim ? microbitSim.getCompassHeading() : 0;
}

function __mbMagneticForce(dimension) {
    return microbitSim ? microbitSim.getMagneticForce(dimension) : 0;
}

function __mbAcceleration(dimension) {
    return microbitSim ? microbitSim.getAcceleration(dimension) : 0;
}

function __mbRotation(axis) {
    return microbitSim ? microbitSim.getRotation(axis) : 0;
}

function __mbRunningTime() {
    return microbitSim ? microbitSim.getRunningTime() : 0;
}

function __mbOnLogoEvent(event, callback) {
    if (microbitSim) microbitSim.onLogoEvent(event, callback);
}

function __mbLogoIsPressed() {
    return microbitSim ? microbitSim.isLogoPressed() : false;
}

function __mbSoundLevel() {
    return microbitSim ? microbitSim.getSoundLevel() : 0;
}

// =============================================================================
// LED - Contrôle avancé
// =============================================================================

function __mbPlot(x, y) {
    if (microbitSim) microbitSim.plot(x, y);
}

function __mbUnplot(x, y) {
    if (microbitSim) microbitSim.unplot(x, y);
}

function __mbToggle(x, y) {
    if (microbitSim) microbitSim.toggle(x, y);
}

function __mbPoint(x, y) {
    return microbitSim ? microbitSim.point(x, y) : false;
}

function __mbBrightness() {
    return microbitSim ? microbitSim.getBrightness() : 255;
}

function __mbSetBrightness(value) {
    if (microbitSim) microbitSim.setBrightness(value);
}

function __mbStopAnimation() {
    if (microbitSim) microbitSim.stopAllAnimations();
}

function __mbPlotBarGraph(value, max) {
    if (microbitSim) microbitSim.plotBarGraph(value, max);
}

function __mbLedEnable(enabled) {
    if (microbitSim) microbitSim.enableLeds(enabled);
}

// =============================================================================
// MUSIC - Sons
// =============================================================================

async function __mbPlayTone(frequency, duration) {
    if (microbitSim) await microbitSim.playTone(frequency, duration);
}

function __mbRingTone(frequency) {
    if (microbitSim) microbitSim.ringTone(frequency);
}

async function __mbRest(duration) {
    if (microbitSim) await microbitSim.rest(duration);
}

function __mbStopAllSounds() {
    if (microbitSim) microbitSim.stopSound();
}

function __mbSetTempo(bpm) {
    if (microbitSim) microbitSim.setTempo(bpm);
}

function __mbChangeTempoBy(delta) {
    if (microbitSim) {
        const current = microbitSim.getTempo();
        microbitSim.setTempo(current + delta);
    }
}

function __mbTempo() {
    return microbitSim ? microbitSim.getTempo() : 120;
}

function __mbBeat(fraction) {
    return microbitSim ? microbitSim.getBeatMs(fraction) : 500;
}

function __mbSetSpeakerEnabled(enabled) {
    if (microbitSim) microbitSim.setSpeakerEnabled(enabled);
}

async function __mbPlaySoundEffect(sound) {
    // Les effets sonores V2 - à implémenter avec des sons pré-enregistrés
    // Pour l'instant, joue une simple mélodie
    if (!microbitSim) return;
    
    const effects = {
        'giggle': [523, 659, 784, 659, 523],
        'happy': [262, 330, 392, 523],
        'hello': [523, 392, 330, 262, 330, 392],
        'mysterious': [262, 247, 220, 196],
        'sad': [392, 330, 262, 196],
        'slide': [262, 294, 330, 349, 392, 440, 494, 523],
        'soaring': [262, 330, 392, 523, 659, 784],
        'spring': [262, 392, 330, 440, 349, 494],
        'twinkle': [262, 262, 392, 392, 440, 440, 392],
        'yawn': [523, 440, 349, 262, 196]
    };
    
    const notes = effects[sound] || [440];
    for (const freq of notes) {
        await microbitSim.playTone(freq, 100);
        await microbitSim.pause(20);
    }
}

// =============================================================================
// RADIO - Communication
// =============================================================================

function __mbRadioSetGroup(group) {
    if (microbitSim) {
        microbitSim.setRadioGroup(group);
        
        // Activer automatiquement le système radio
        if (typeof window.radioSimulator !== 'undefined' && window.radioSimulator) {
            window.radioSimulator.enable();
        }
    }
}

function __mbRadioSendNumber(value) {
    if (microbitSim) microbitSim.radioSendNumber(value);
}

function __mbRadioSendString(value) {
    if (microbitSim) microbitSim.radioSendString(value);
}

function __mbRadioSendValue(name, value) {
    if (microbitSim) microbitSim.radioSendValue(name, value);
}

function __mbOnRadioReceivedNumber(callback) {
    if (microbitSim) microbitSim.onRadioReceived('number', callback);
}

function __mbOnRadioReceivedString(callback) {
    if (microbitSim) microbitSim.onRadioReceived('string', callback);
}

function __mbRadioSetTransmitPower(power) {
    // Simulated - no effect in browser
}

function __mbRadioReceivedPacket(property) {
    // Simulated values
    return 0;
}

// =============================================================================
// SERVO - Servomoteurs (Extension Barrières)
// =============================================================================

// État des servos pour la simulation
const servoState = {};

function getServoState(pin) {
    if (!servoState[pin]) {
        servoState[pin] = {
            angle: 90,
            minAngle: 0,
            maxAngle: 180,
            pulse: 1500,
            stopOnNeutral: false,
            running: false,
            speed: 0
        };
    }
    return servoState[pin];
}

function __servoSetAngle(pin, angle) {
    const state = getServoState(pin);
    // Limiter l'angle à l'intervalle défini
    state.angle = Math.max(state.minAngle, Math.min(state.maxAngle, angle));
    state.running = false;
    console.log(`⚙️ Servo ${pin}: angle = ${state.angle}°`);
    
    // Mettre à jour le simulateur de barrières si disponible
    if (typeof barrierSimulator !== 'undefined' && barrierSimulator) {
        if (pin === 'P1') {
            // P1 contrôle la barrière gauche
            barrierSimulator.setLeftAngle(state.angle);
        } else if (pin === 'P2') {
            // P2 contrôle la barrière droite
            barrierSimulator.setRightAngle(state.angle);
        }
    }
    
    // Mettre à jour le simulateur de portillon si disponible
    if (typeof portillonSimulator !== 'undefined' && portillonSimulator) {
        if (pin === 'P2') {
            // P2 contrôle la porte du portillon
            portillonSimulator.setDoorServoAngle(state.angle);
        }
    }
}

function __servoRun(pin, speed) {
    const state = getServoState(pin);
    // Limiter la vitesse entre -100 et 100
    state.speed = Math.max(-100, Math.min(100, speed));
    state.running = true;
    console.log(`⚙️ Servo ${pin}: rotation continue à ${state.speed}%`);
}

function __servoStop(pin) {
    const state = getServoState(pin);
    state.running = false;
    state.speed = 0;
    console.log(`⚙️ Servo ${pin}: arrêté`);
}

function __servoSetRange(pin, minAngle, maxAngle) {
    const state = getServoState(pin);
    state.minAngle = minAngle;
    state.maxAngle = maxAngle;
    console.log(`⚙️ Servo ${pin}: intervalle = ${minAngle}° à ${maxAngle}°`);
}

function __servoSetStopMode(pin, stopOnNeutral) {
    const state = getServoState(pin);
    state.stopOnNeutral = stopOnNeutral;
    console.log(`⚙️ Servo ${pin}: arrêt sur neutre = ${stopOnNeutral ? 'ON' : 'OFF'}`);
}

function __servoSetPulse(pin, pulse) {
    const state = getServoState(pin);
    state.pulse = pulse;
    console.log(`⚙️ Servo ${pin}: impulsion = ${pulse}µs`);
}

// =============================================================================
// RFID (PORTILLON) - Fonctions pour le module MFRC522
// =============================================================================

function __rfidInit() {
    // Utiliser le simulateur de portillon s'il est disponible
    if (typeof portillonSimulator !== 'undefined' && portillonSimulator) {
        portillonSimulator.rfidInit();
    } else {
        console.log('🏷️ RFID: Module initialisé (pas de simulateur)');
    }
}

function __rfidGetId() {
    // Utiliser le simulateur de portillon s'il est disponible
    if (typeof portillonSimulator !== 'undefined' && portillonSimulator) {
        return portillonSimulator.rfidGetId();
    }
    console.warn('🏷️ RFID: Simulateur non disponible');
    return '';
}

function __rfidRead() {
    // Utiliser le simulateur de portillon s'il est disponible
    if (typeof portillonSimulator !== 'undefined' && portillonSimulator) {
        return portillonSimulator.rfidRead();
    }
    console.warn('🏷️ RFID: Simulateur non disponible');
    return '';
}

function __rfidWrite(data) {
    // Utiliser le simulateur de portillon s'il est disponible
    if (typeof portillonSimulator !== 'undefined' && portillonSimulator) {
        portillonSimulator.rfidWrite(data);
    } else {
        console.log(`🏷️ RFID: Données écrites: ${data} (pas de simulateur)`);
    }
}

function __rfidAntennaOff() {
    // Utiliser le simulateur de portillon s'il est disponible
    if (typeof portillonSimulator !== 'undefined' && portillonSimulator) {
        portillonSimulator.rfidAntennaOff();
    } else {
        console.log('🏷️ RFID: Antenne éteinte (pas de simulateur)');
    }
}

// =============================================================================
// EXPORT
// =============================================================================

window.initMicrobitRuntime = initMicrobitRuntime;
window.__mbShowNumber = __mbShowNumber;
window.__mbShowIcon = __mbShowIcon;
window.__mbShowLeds = __mbShowLeds;
window.__mbShowString = __mbShowString;
window.__mbClearScreen = __mbClearScreen;
window.__mbShowArrow = __mbShowArrow;
window.__mbOnButtonPressed = __mbOnButtonPressed;
window.__mbButtonIsPressed = __mbButtonIsPressed;
window.__mbOnGesture = __mbOnGesture;
window.__mbTemperature = __mbTemperature;
window.__mbLightLevel = __mbLightLevel;
window.__mbCompassHeading = __mbCompassHeading;
window.__mbAcceleration = __mbAcceleration;
window.__mbRotation = __mbRotation;
window.__mbRunningTime = __mbRunningTime;
window.__mbOnLogoEvent = __mbOnLogoEvent;
window.__mbLogoIsPressed = __mbLogoIsPressed;
window.__mbSoundLevel = __mbSoundLevel;
window.__mbPlot = __mbPlot;
window.__mbUnplot = __mbUnplot;
window.__mbToggle = __mbToggle;
window.__mbPoint = __mbPoint;
window.__mbBrightness = __mbBrightness;
window.__mbSetBrightness = __mbSetBrightness;
window.__mbStopAnimation = __mbStopAnimation;
window.__mbPlotBarGraph = __mbPlotBarGraph;
window.__mbLedEnable = __mbLedEnable;
window.__mbPlayTone = __mbPlayTone;
window.__mbRingTone = __mbRingTone;
window.__mbRest = __mbRest;
window.__mbStopAllSounds = __mbStopAllSounds;
window.__mbSetTempo = __mbSetTempo;
window.__mbChangeTempoBy = __mbChangeTempoBy;
window.__mbTempo = __mbTempo;
window.__mbBeat = __mbBeat;
window.__mbSetSpeakerEnabled = __mbSetSpeakerEnabled;
window.__mbPlaySoundEffect = __mbPlaySoundEffect;
window.__mbRadioSetGroup = __mbRadioSetGroup;
window.__mbRadioSendNumber = __mbRadioSendNumber;
window.__mbRadioSendString = __mbRadioSendString;
window.__mbRadioSendValue = __mbRadioSendValue;
window.__mbOnRadioReceivedNumber = __mbOnRadioReceivedNumber;
window.__mbOnRadioReceivedString = __mbOnRadioReceivedString;
window.__mbRadioSetTransmitPower = __mbRadioSetTransmitPower;
window.__mbRadioReceivedPacket = __mbRadioReceivedPacket;

// Servo
window.__servoSetAngle = __servoSetAngle;
window.__servoRun = __servoRun;
window.__servoStop = __servoStop;
window.__servoSetRange = __servoSetRange;
window.__servoSetStopMode = __servoSetStopMode;
window.__servoSetPulse = __servoSetPulse;

// RFID
window.__rfidInit = __rfidInit;
window.__rfidGetId = __rfidGetId;
window.__rfidRead = __rfidRead;
window.__rfidWrite = __rfidWrite;
window.__rfidAntennaOff = __rfidAntennaOff;
