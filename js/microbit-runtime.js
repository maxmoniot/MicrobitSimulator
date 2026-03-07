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
    if (!microbitSim) return;
    if (!microbitSim.speakerEnabled) return;
    microbitSim.initAudio();
    const ctx = microbitSim.audioContext;
    if (!ctx) return;
    
    // Arreter le son precedent
    if (microbitSim.currentOscillator) {
        try { microbitSim.currentOscillator.stop(); } catch(_) {}
        microbitSim.currentOscillator = null;
    }
    
    // Synthese des sons integres micro:bit V2
    // Chaque son est defini par: freq_start, freq_end, duration, vol_start, vol_end,
    // waveform (sine/square/triangle/sawtooth/noise), fx (none/vibrato/tremolo/warble)
    const sounds = {
        'giggle': [
            { fs: 1600, fe: 2200, d: 150, vs: 1, ve: 0.8, w: 'square', fx: 'vibrato' },
            { fs: 2000, fe: 2600, d: 100, vs: 0.8, ve: 0.6, w: 'square', fx: 'vibrato' },
            { fs: 1800, fe: 2400, d: 120, vs: 0.7, ve: 0.5, w: 'square', fx: 'vibrato' },
            { fs: 2200, fe: 2800, d: 80, vs: 0.6, ve: 0.3, w: 'square', fx: 'vibrato' },
            { fs: 1500, fe: 2000, d: 100, vs: 0.5, ve: 0, w: 'square', fx: 'vibrato' }
        ],
        'happy': [
            { fs: 500, fe: 1000, d: 200, vs: 1, ve: 0.8, w: 'square', fx: 'none' },
            { fs: 800, fe: 1500, d: 200, vs: 0.8, ve: 0.6, w: 'square', fx: 'none' },
            { fs: 1200, fe: 2000, d: 300, vs: 0.7, ve: 0, w: 'square', fx: 'vibrato' }
        ],
        'hello': [
            { fs: 500, fe: 800, d: 200, vs: 1, ve: 0.9, w: 'triangle', fx: 'none' },
            { fs: 800, fe: 600, d: 150, vs: 0.9, ve: 0.8, w: 'triangle', fx: 'none' },
            { fs: 600, fe: 900, d: 200, vs: 0.8, ve: 0.7, w: 'triangle', fx: 'none' },
            { fs: 900, fe: 1200, d: 300, vs: 0.7, ve: 0, w: 'triangle', fx: 'vibrato' }
        ],
        'mysterious': [
            { fs: 400, fe: 200, d: 400, vs: 0.8, ve: 0.6, w: 'sine', fx: 'vibrato' },
            { fs: 300, fe: 150, d: 400, vs: 0.6, ve: 0.4, w: 'sine', fx: 'vibrato' },
            { fs: 200, fe: 100, d: 500, vs: 0.4, ve: 0, w: 'sine', fx: 'vibrato' }
        ],
        'sad': [
            { fs: 800, fe: 400, d: 300, vs: 1, ve: 0.7, w: 'triangle', fx: 'none' },
            { fs: 500, fe: 300, d: 300, vs: 0.7, ve: 0.4, w: 'triangle', fx: 'none' },
            { fs: 350, fe: 200, d: 400, vs: 0.4, ve: 0, w: 'triangle', fx: 'none' }
        ],
        'slide': [
            { fs: 200, fe: 2000, d: 600, vs: 0.8, ve: 0.8, w: 'sawtooth', fx: 'none' },
            { fs: 2000, fe: 200, d: 600, vs: 0.8, ve: 0, w: 'sawtooth', fx: 'none' }
        ],
        'soaring': [
            { fs: 200, fe: 400, d: 200, vs: 0.6, ve: 0.7, w: 'sine', fx: 'none' },
            { fs: 400, fe: 800, d: 200, vs: 0.7, ve: 0.8, w: 'sine', fx: 'none' },
            { fs: 800, fe: 1600, d: 300, vs: 0.8, ve: 0.9, w: 'sine', fx: 'vibrato' },
            { fs: 1600, fe: 2500, d: 400, vs: 0.9, ve: 0, w: 'sine', fx: 'vibrato' }
        ],
        'spring': [
            { fs: 600, fe: 1200, d: 100, vs: 1, ve: 0.5, w: 'square', fx: 'none' },
            { fs: 1200, fe: 800, d: 100, vs: 0.5, ve: 0.8, w: 'square', fx: 'none' },
            { fs: 800, fe: 1400, d: 100, vs: 0.8, ve: 0.4, w: 'square', fx: 'none' },
            { fs: 1400, fe: 1000, d: 100, vs: 0.4, ve: 0.7, w: 'square', fx: 'none' },
            { fs: 1000, fe: 1600, d: 100, vs: 0.7, ve: 0, w: 'square', fx: 'none' }
        ],
        'twinkle': [
            { fs: 1000, fe: 1500, d: 150, vs: 0.8, ve: 0.2, w: 'sine', fx: 'none' },
            { fs: 1500, fe: 1000, d: 150, vs: 0.2, ve: 0.8, w: 'sine', fx: 'none' },
            { fs: 1200, fe: 1800, d: 150, vs: 0.8, ve: 0.2, w: 'sine', fx: 'none' },
            { fs: 1800, fe: 1200, d: 150, vs: 0.2, ve: 0.8, w: 'sine', fx: 'none' },
            { fs: 1000, fe: 2000, d: 200, vs: 0.8, ve: 0, w: 'sine', fx: 'none' }
        ],
        'yawn': [
            { fs: 800, fe: 600, d: 300, vs: 0.8, ve: 0.7, w: 'triangle', fx: 'vibrato' },
            { fs: 600, fe: 400, d: 400, vs: 0.7, ve: 0.5, w: 'triangle', fx: 'vibrato' },
            { fs: 400, fe: 200, d: 500, vs: 0.5, ve: 0, w: 'triangle', fx: 'vibrato' }
        ]
    };
    
    const segments = sounds[sound] || [{ fs: 440, fe: 440, d: 300, vs: 0.5, ve: 0, w: 'square', fx: 'none' }];
    
    for (const seg of segments) {
        const t0 = ctx.currentTime;
        const dur = seg.d / 1000;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = seg.w === 'noise' ? 'sawtooth' : seg.w;
        osc.frequency.setValueAtTime(seg.fs, t0);
        osc.frequency.linearRampToValueAtTime(seg.fe, t0 + dur);
        
        gain.gain.setValueAtTime(seg.vs * 0.1, t0);
        gain.gain.linearRampToValueAtTime(seg.ve * 0.1, t0 + dur);
        
        // Effet vibrato
        if (seg.fx === 'vibrato') {
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            lfo.frequency.value = 8;
            lfoGain.gain.value = (seg.fs + seg.fe) / 2 * 0.05;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start(t0);
            lfo.stop(t0 + dur);
        }
        
        microbitSim.currentOscillator = osc;
        osc.start(t0);
        osc.stop(t0 + dur);
        
        try {
            await microbitSim.pause(seg.d);
        } catch (e) {
            try { osc.stop(); } catch(_) {}
            microbitSim.currentOscillator = null;
            throw e;
        }
        microbitSim.currentOscillator = null;
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
            // P1 contrôle la barrière droite (0° = ouverte, 90° = fermée)
            barrierSimulator.setRightAngle(state.angle);
        } else if (pin === 'P2') {
            // P2 contrôle la barrière gauche (180° = ouverte, 90° = fermée)
            barrierSimulator.setLeftAngle(state.angle);
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
