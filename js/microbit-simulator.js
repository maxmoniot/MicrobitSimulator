/**
 * Micro:bit V2 Simulator
 * Simulateur complet de la carte micro:bit V2
 */

class MicrobitSimulator {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            return;
        }
        
        // État de la matrice LED 5x5
        this.leds = Array(5).fill(null).map(() => Array(5).fill(0));
        this.brightness = 255;
        this.ledEnabled = true;
        
        // État des boutons
        this.buttonA = false;
        this.buttonB = false;
        this.logoTouched = false;
        
        // Capteurs
        this.temperature = 21;
        this.lightLevel = 128;
        this.compassHeading = 0;
        this.magneticForce = 0;
        this.soundLevel = 0;
        this.acceleration = { x: 0, y: 0, z: -1024 };
        this.rotation = { pitch: 0, roll: 0 };
        this.lastRotationState = null;
        
        // Musique
        this.speakerEnabled = true;
        this.audioContext = null;
        this.currentOscillator = null;
        this.tempo = 120;
        
        // Radio
        this.radioGroup = 0;
        this.radioEnabled = false;
        this.radioCallbacks = [];
        
        // Animation
        this.animationQueue = [];
        this.isAnimating = false;
        this.stopAnimationFlag = false;
        
        // Événements
        this.eventHandlers = {
            buttonA: [],
            buttonB: [],
            buttonAB: [],
            gesture: {},
            logoTouch: [],
            pinTouch: {}
        };
        
        // Temps de démarrage
        this.startTime = Date.now();
        
        // Promise pour savoir quand le simulateur est prêt
        this.readyPromise = this.init();
        
        // Exposer l'instance globalement pour le debug
        if (typeof window !== 'undefined') {
            window.microbit = this;
        }
    }
    
    async init() {
        await this.loadSVG();
        // Attendre suffisamment pour que le SVG soit rendu
        await new Promise(resolve => setTimeout(resolve, 300));
        this.cacheElements();
        this.setupInteractions();
    }
    
    // Méthode pour attendre que le simulateur soit prêt
    async ready() {
        await this.readyPromise;
        return this;
    }
    
    async loadSVG() {
        try {
            const response = await fetch('images/Microbit.svg');
            const svgText = await response.text();
            this.container.innerHTML = `<div class="microbit-board">${svgText}</div>`;
            // Forcer le SVG a etre responsive
            const svg = this.container.querySelector('svg');
            if (svg) {
                svg.setAttribute('width', '100%');
                svg.setAttribute('height', '100%');
                svg.setAttribute('overflow', 'visible');
                svg.style.display = 'block';
            }
            await new Promise(resolve => requestAnimationFrame(resolve));
            await new Promise(resolve => requestAnimationFrame(resolve));
        } catch (error) {
            console.error('Erreur SVG:', error);
        }
    }
    
    /**
     * Crée l'interface visuelle du micro:bit
     */
    
    /**
     * Cache les références aux éléments DOM
     */
    cacheElements() {
        this.elements = {
            svg: this.container.querySelector('#MicrobitSVG'),
            buttonA: this.container.querySelector('#BoutonA'),
            buttonB: this.container.querySelector('#BoutonB'),
            logoTouch: this.container.querySelector('#Logo'),
            micLed: this.container.querySelector('#micro')
        };
        
        // Injecter le filtre SVG de lueur dans les <defs> du SVG (une seule fois)
        if (this.elements.svg && !this.elements.svg.querySelector('#ledGlow')) {
            let defs = this.elements.svg.querySelector('defs');
            if (!defs) {
                defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                this.elements.svg.insertBefore(defs, this.elements.svg.firstChild);
            }
            defs.insertAdjacentHTML('beforeend',
                '<filter id="ledGlow" x="-80%" y="-80%" width="260%" height="260%">' +
                '<feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>' +
                '<feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="redBlur"/>' +
                '<feMerge><feMergeNode in="redBlur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
                '</filter>'
            );
        }
        
        // Cache des LEDs : paths (.st18) + groupe parent (<g>) pour le filtre
        this.ledCache = {};
        this.ledGroupCache = {};
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                const ledId = `led_x5F_${x}-${y}`;
                const led = this.container.querySelector(`#${ledId}`);
                if (led) {
                    this.ledCache[`${x}-${y}`] = led.querySelectorAll('.st18');
                    this.ledGroupCache[`${x}-${y}`] = led;
                }
            }
        }
        
        if (this.elements.buttonA) this.elements.buttonA.style.cursor = 'pointer';
        if (this.elements.buttonB) this.elements.buttonB.style.cursor = 'pointer';
        if (this.elements.logoTouch) this.elements.logoTouch.style.cursor = 'pointer';
    }
    
    /**
     * Configure les interactions utilisateur
     */
    setupInteractions(retryCount = 0) {
        if (!this.elements.buttonA || !this.elements.buttonB || !this.elements.logoTouch) {
            if (retryCount < 10) {
                setTimeout(() => {
                    this.cacheElements();
                    this.setupInteractions(retryCount + 1);
                }, 100);
            } else {
                console.error('Impossible de trouver les éléments après 10 tentatives');
            }
            return;
        }
        
        // Bouton A
        this.elements.buttonA.addEventListener('mousedown', () => this.pressButton('A'));
        this.elements.buttonA.addEventListener('mouseup', () => this.releaseButton('A'));
        this.elements.buttonA.addEventListener('mouseleave', () => this.releaseButton('A'));
        
        // Bouton B
        this.elements.buttonB.addEventListener('mousedown', () => this.pressButton('B'));
        this.elements.buttonB.addEventListener('mouseup', () => this.releaseButton('B'));
        this.elements.buttonB.addEventListener('mouseleave', () => this.releaseButton('B'));
        
        // Logo tactile
        this.elements.logoTouch.addEventListener('mousedown', () => this.touchLogo(true));
        this.elements.logoTouch.addEventListener('mouseup', () => this.touchLogo(false));
        this.elements.logoTouch.addEventListener('mouseleave', () => this.touchLogo(false));
        
        // Clavier
        document.addEventListener('keydown', (e) => {
            if (e.key === 'a' || e.key === 'A') this.pressButton('A');
            if (e.key === 'b' || e.key === 'B') this.pressButton('B');
        });
        document.addEventListener('keyup', (e) => {
            if (e.key === 'a' || e.key === 'A') this.releaseButton('A');
            if (e.key === 'b' || e.key === 'B') this.releaseButton('B');
        });
    }
    
    
    // ========== MÉTHODES BOUTONS ==========
    
    pressButton(button) {
        const btnElement = button === 'A' ? this.elements.buttonA : this.elements.buttonB;
        const buttonCircle = btnElement?.querySelector('.st11');
        if (buttonCircle) {
            buttonCircle.style.fill = '#ff0000';
        }
        
        if (button === 'A') {
            this.buttonA = true;
            this.triggerEvent('buttonA');
        } else {
            this.buttonB = true;
            this.triggerEvent('buttonB');
        }
        
        if (this.buttonA && this.buttonB) {
            const otherBtnElement = button === 'A' ? this.elements.buttonB : this.elements.buttonA;
            const otherButtonCircle = otherBtnElement?.querySelector('.st11');
            if (otherButtonCircle) {
                otherButtonCircle.style.fill = '#ff0000';
            }
            this.triggerEvent('buttonAB');
        }
    }
    
    releaseButton(button) {
        const btnElement = button === 'A' ? this.elements.buttonA : this.elements.buttonB;
        const buttonCircle = btnElement?.querySelector('.st11');
        if (buttonCircle) {
            buttonCircle.style.fill = '#333';
        }
        
        if (button === 'A') this.buttonA = false;
        else this.buttonB = false;
    }
    
    isButtonPressed(button) {
        if (button === 'A') return this.buttonA;
        if (button === 'B') return this.buttonB;
        if (button === 'A+B') return this.buttonA && this.buttonB;
        return false;
    }
    
    // ========== MÉTHODES LOGO ==========
    
    touchLogo(touched) {
        this.logoTouched = touched;
        const logoPath = this.elements.logoTouch?.querySelector('.st21');
        if (logoPath) {
            logoPath.style.fill = touched ? '#ff0000' : '#ffbf00';
        }
        
        if (touched) {
            this.triggerEvent('logoTouch');
        }
    }
    
    isLogoPressed() {
        return this.logoTouched;
    }
    
    // ========== MÉTHODES LED ==========
    
    /**
     * Définit la luminosité d'une LED
     */
    setLed(x, y, brightness) {
        if (x < 0 || x > 4 || y < 0 || y > 4) return;
        
        this.leds[y][x] = Math.max(0, Math.min(255, brightness));
        this.updateLedDisplay(x, y);
    }
    
    /**
     * Allume une LED
     */
    plot(x, y) {
        this.setLed(x, y, this.brightness);
    }
    
    /**
     * Éteint une LED
     */
    unplot(x, y) {
        this.setLed(x, y, 0);
    }
    
    /**
     * Inverse l'état d'une LED
     */
    toggle(x, y) {
        if (x < 0 || x > 4 || y < 0 || y > 4) return;
        
        if (this.leds[y][x] > 0) {
            this.unplot(x, y);
        } else {
            this.plot(x, y);
        }
    }
    
    /**
     * Retourne l'état d'une LED
     */
    point(x, y) {
        if (x < 0 || x > 4 || y < 0 || y > 4) return false;
        return this.leds[y][x] > 0;
    }
    
    /**
     * Met à jour l'affichage d'une LED
     */
    updateLedDisplay(x, y) {
        // Utiliser le cache si disponible, sinon requête DOM directe (fallback)
        let ledPaths = this.ledCache && this.ledCache[`${x}-${y}`];
        let ledGroup = this.ledGroupCache && this.ledGroupCache[`${x}-${y}`];
        if (!ledPaths) {
            const ledId = `led_x5F_${x}-${y}`;
            const led = this.container.querySelector(`#${ledId}`);
            if (!led) return;
            ledPaths = led.querySelectorAll('.st18');
            ledGroup = led;
            // Stocker dans le cache pour les prochains appels
            if (!this.ledCache) this.ledCache = {};
            if (!this.ledGroupCache) this.ledGroupCache = {};
            this.ledCache[`${x}-${y}`] = ledPaths;
            this.ledGroupCache[`${x}-${y}`] = led;
        }
        if (ledPaths.length === 0) return;
        
        const brightness = this.leds[y][x];
        
        if (brightness > 0 && this.ledEnabled) {
            const normalizedBrightness = brightness / 255;
            const r = Math.round(51 + 204 * normalizedBrightness);
            const color = `rgb(${r}, 0, 0)`;
            // Lueur : stroke semi-transparent derrière le fill (paint-order)
            const glowOpacity = (0.3 + 0.5 * normalizedBrightness).toFixed(2);
            const glowColor = `rgba(255, 0, 0, ${glowOpacity})`;
            
            for (let i = 0; i < ledPaths.length; i++) {
                const s = ledPaths[i].style;
                s.fill = color;
                s.opacity = normalizedBrightness;
                s.stroke = glowColor;
                s.strokeWidth = '5';
                s.paintOrder = 'stroke';
            }
            // Appliquer le filtre de halo SVG sur le groupe
            if (ledGroup) ledGroup.setAttribute('filter', 'url(#ledGlow)');
        } else {
            for (let i = 0; i < ledPaths.length; i++) {
                const s = ledPaths[i].style;
                s.fill = '#999';
                s.opacity = '1';
                s.stroke = 'none';
            }
            // Retirer le filtre de halo
            if (ledGroup) ledGroup.removeAttribute('filter');
        }
    }
    
    /**
     * Définit la luminosité globale
     */
    setBrightness(value) {
        this.brightness = Math.max(0, Math.min(255, value));
    }
    
    /**
     * Retourne la luminosité globale
     */
    getBrightness() {
        return this.brightness;
    }
    
    /**
     * Active/désactive les LEDs
     */
    enableLeds(enabled) {
        this.ledEnabled = enabled;
        this.refreshAllLeds();
    }
    
    /**
     * Efface l'écran
     */
    clearScreen() {
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                this.leds[y][x] = 0;
                this.updateLedDisplay(x, y);
            }
        }
    }
    
    /**
     * Rafraîchit toutes les LEDs
     */
    refreshAllLeds() {
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                this.updateLedDisplay(x, y);
            }
        }
    }
    
    /**
     * Affiche un motif LED (matrice 5x5)
     */
    showLeds(pattern) {
        // pattern est une chaîne avec . et # ou une matrice 2D
        if (typeof pattern === 'string') {
            const rows = pattern.trim().split('\n').map(r => r.trim());
            for (let y = 0; y < 5 && y < rows.length; y++) {
                const chars = rows[y].replace(/\s/g, '').split('');
                for (let x = 0; x < 5 && x < chars.length; x++) {
                    this.setLed(x, y, chars[x] === '#' || chars[x] === '1' ? this.brightness : 0);
                }
            }
        } else if (Array.isArray(pattern)) {
            for (let y = 0; y < 5 && y < pattern.length; y++) {
                for (let x = 0; x < 5 && x < pattern[y].length; x++) {
                    this.setLed(x, y, pattern[y][x] ? this.brightness : 0);
                }
            }
        }
    }
    
    /**
     * Affiche une icône prédéfinie
     */
    showIcon(iconName) {
        const icons = {
            'Heart': `
                .#.#.
                #####
                #####
                .###.
                ..#..
            `,
            'SmallHeart': `
                .....
                .#.#.
                .###.
                ..#..
                .....
            `,
            'Happy': `
                .....
                .#.#.
                .....
                #...#
                .###.
            `,
            'Sad': `
                .....
                .#.#.
                .....
                .###.
                #...#
            `,
            'Confused': `
                .....
                .#.#.
                .....
                .#.#.
                #.#.#
            `,
            'Angry': `
                #...#
                .#.#.
                .....
                #####
                #.#.#
            `,
            'Asleep': `
                .....
                ##.##
                .....
                .###.
                .....
            `,
            'Surprised': `
                .#.#.
                .....
                ..#..
                .#.#.
                ..#..
            `,
            'Silly': `
                #...#
                .....
                #####
                ...##
                ...##
            `,
            'Fabulous': `
                #####
                ##.##
                .....
                .#.#.
                .###.
            `,
            'Meh': `
                .#.#.
                .....
                ...#.
                ..#..
                .#...
            `,
            'Yes': `
                .....
                ....#
                ...#.
                #.#..
                .#...
            `,
            'No': `
                #...#
                .#.#.
                ..#..
                .#.#.
                #...#
            `,
            'Triangle': `
                ..#..
                ..#..
                .#.#.
                .#.#.
                #####
            `,
            'Diamond': `
                ..#..
                .#.#.
                #...#
                .#.#.
                ..#..
            `,
            'DiamondSmall': `
                .....
                ..#..
                .#.#.
                ..#..
                .....
            `,
            'Square': `
                #####
                #...#
                #...#
                #...#
                #####
            `,
            'SquareSmall': `
                .....
                .###.
                .#.#.
                .###.
                .....
            `,
            'Target': `
                ..#..
                .###.
                ##.##
                .###.
                ..#..
            `,
            'Chessboard': `
                #.#.#
                .#.#.
                #.#.#
                .#.#.
                #.#.#
            `,
            'Scissors': `
                ##..#
                ##.#.
                ..#..
                ##.#.
                ##..#
            `,
            'TShirt': `
                ##.##
                #####
                .###.
                .###.
                .###.
            `,
            'Rollerskate': `
                ....#
                ....#
                #####
                #####
                .#.#.
            `,
            'Duck': `
                .##..
                ###..
                .####
                .###.
                .....
            `,
            'House': `
                ..#..
                .###.
                #####
                .###.
                .#.#.
            `,
            'Tortoise': `
                .....
                .###.
                #####
                .#.#.
                .....
            `,
            'Butterfly': `
                ##.##
                #####
                ..#..
                #####
                ##.##
            `,
            'StickFigure': `
                ..#..
                #####
                ..#..
                .#.#.
                #...#
            `,
            'Ghost': `
                .###.
                #.#.#
                #####
                #####
                #.#.#
            `,
            'Sword': `
                ..#..
                ..#..
                ..#..
                .###.
                ..#..
            `,
            'Giraffe': `
                ##...
                .#...
                .#...
                .####
                .#.#.
            `,
            'Skull': `
                .###.
                #.#.#
                #####
                .###.
                .###.
            `,
            'Umbrella': `
                .###.
                #####
                ..#..
                #.#..
                .##..
            `,
            'Snake': `
                ##...
                ##.##
                .#.#.
                .###.
                .....
            `,
            'Music': `
                ..#..
                ..##.
                ..#.#
                ###..
                ###..
            `,
            'Pitchfork': `
                #.#.#
                #.#.#
                #####
                ..#..
                ..#..
            `,
            'Pacman': `
                .####
                ##...
                ####.
                #####
                .####
            `,
            'ArrowN': `
                ..#..
                .###.
                #.#.#
                ..#..
                ..#..
            `,
            'ArrowNE': `
                .####
                ..###
                .#.##
                #..#.
                ....#
            `,
            'ArrowE': `
                ..#..
                ...#.
                #####
                ...#.
                ..#..
            `,
            'ArrowSE': `
                #....
                .#..#
                ..#.#
                ...##
                ..###
            `,
            'ArrowS': `
                ..#..
                ..#..
                #.#.#
                .###.
                ..#..
            `,
            'ArrowSW': `
                ....#
                #..#.
                #.#..
                ##...
                ###..
            `,
            'ArrowW': `
                ..#..
                .#...
                #####
                .#...
                ..#..
            `,
            'ArrowNW': `
                ###..
                ##...
                #.#..
                #..#.
                ....#
            `
        };
        
        if (icons[iconName]) {
            this.showLeds(icons[iconName]);
        }
    }
    
    /**
     * Affiche une flèche
     */
    showArrow(direction) {
        const arrows = {
            'North': 'ArrowN',
            'NorthEast': 'ArrowNE',
            'East': 'ArrowE',
            'SouthEast': 'ArrowSE',
            'South': 'ArrowS',
            'SouthWest': 'ArrowSW',
            'West': 'ArrowW',
            'NorthWest': 'ArrowNW'
        };
        
        if (arrows[direction]) {
            this.showIcon(arrows[direction]);
        }
    }
    
    /**
     * Affiche un nombre (avec défilement si > 1 chiffre)
     */
    async showNumber(num, interval = 150) {
        const str = num.toString();
        if (str.length === 1) {
            this.showDigit(parseInt(str));
        } else {
            await this.showString(str, interval);
        }
    }
    
    /**
     * Affiche un chiffre (0-9)
     */
    showDigit(digit) {
        const digits = {
            0: `
                .###.
                #...#
                #...#
                #...#
                .###.
            `,
            1: `
                ..#..
                .##..
                ..#..
                ..#..
                .###.
            `,
            2: `
                .###.
                #...#
                ..##.
                .#...
                #####
            `,
            3: `
                #####
                ...#.
                ..##.
                #...#
                .###.
            `,
            4: `
                ...#.
                ..##.
                .#.#.
                #####
                ...#.
            `,
            5: `
                #####
                #....
                ####.
                ....#
                ####.
            `,
            6: `
                .###.
                #....
                ####.
                #...#
                .###.
            `,
            7: `
                #####
                ....#
                ...#.
                ..#..
                ..#..
            `,
            8: `
                .###.
                #...#
                .###.
                #...#
                .###.
            `,
            9: `
                .###.
                #...#
                .####
                ....#
                .###.
            `
        };
        
        if (digits[digit] !== undefined) {
            this.showLeds(digits[digit]);
        }
    }
    
    /**
     * Affiche une chaîne avec défilement
     */
    async showString(str, interval = 150) {
        // Caractères de base pour le défilement
        const charPatterns = this.getCharPatterns();
        
        // Créer le buffer complet
        let buffer = [];
        for (const char of str) {
            const pattern = charPatterns[char.toUpperCase()] || charPatterns[' '];
            buffer.push(...pattern);
            buffer.push([0, 0, 0, 0, 0]); // Espace entre caractères
        }
        
        // Défiler
        for (let offset = 0; offset < buffer.length; offset++) {
            if (this.stopAnimationFlag) return;
            
            for (let x = 0; x < 5; x++) {
                const bufferX = offset + x;
                for (let y = 0; y < 5; y++) {
                    if (bufferX < buffer.length) {
                        this.setLed(x, y, buffer[bufferX][y] ? this.brightness : 0);
                    } else {
                        this.setLed(x, y, 0);
                    }
                }
            }
            
            try {
                await this.pause(interval);
            } catch (e) {
                if (e && e.name === '__StopExecution') { this.clearScreen(); throw e; }
                throw e;
            }
            
            if (this.stopAnimationFlag) { this.clearScreen(); return; }
        }
        
        this.clearScreen();
    }
    
    /**
     * Retourne les motifs de caractères pour le défilement
     */
    getCharPatterns() {
        // Chaque caractère est un tableau de 5 colonnes, chaque colonne a 5 valeurs (haut en bas)
        return {
            'A': [[0,1,1,1,1], [1,0,1,0,0], [1,0,1,0,0], [1,0,1,0,0], [0,1,1,1,1]],
            'B': [[1,1,1,1,1], [1,0,1,0,1], [1,0,1,0,1], [1,0,1,0,1], [0,1,0,1,0]],
            'C': [[0,1,1,1,0], [1,0,0,0,1], [1,0,0,0,1], [1,0,0,0,1], [0,1,0,1,0]],
            'D': [[1,1,1,1,1], [1,0,0,0,1], [1,0,0,0,1], [1,0,0,0,1], [0,1,1,1,0]],
            'E': [[1,1,1,1,1], [1,0,1,0,1], [1,0,1,0,1], [1,0,0,0,1], [1,0,0,0,1]],
            'F': [[1,1,1,1,1], [1,0,1,0,0], [1,0,1,0,0], [1,0,0,0,0], [1,0,0,0,0]],
            'G': [[0,1,1,1,0], [1,0,0,0,1], [1,0,1,0,1], [1,0,1,0,1], [0,0,1,1,0]],
            'H': [[1,1,1,1,1], [0,0,1,0,0], [0,0,1,0,0], [0,0,1,0,0], [1,1,1,1,1]],
            'I': [[1,0,0,0,1], [1,1,1,1,1], [1,0,0,0,1]],
            'J': [[0,0,0,1,0], [0,0,0,0,1], [1,0,0,0,1], [1,1,1,1,1], [1,0,0,0,0]],
            'K': [[1,1,1,1,1], [0,0,1,0,0], [0,1,0,1,0], [1,0,0,0,1]],
            'L': [[1,1,1,1,1], [0,0,0,0,1], [0,0,0,0,1], [0,0,0,0,1]],
            'M': [[1,1,1,1,1], [0,1,0,0,0], [0,0,1,0,0], [0,1,0,0,0], [1,1,1,1,1]],
            'N': [[1,1,1,1,1], [0,1,0,0,0], [0,0,1,0,0], [0,0,0,1,0], [1,1,1,1,1]],
            'O': [[0,1,1,1,0], [1,0,0,0,1], [1,0,0,0,1], [1,0,0,0,1], [0,1,1,1,0]],
            'P': [[1,1,1,1,1], [1,0,1,0,0], [1,0,1,0,0], [1,0,1,0,0], [0,1,0,0,0]],
            'Q': [[0,1,1,1,0], [1,0,0,0,1], [1,0,0,1,1], [1,0,0,0,1], [0,1,1,1,0]],
            'R': [[1,1,1,1,1], [1,0,1,0,0], [1,0,1,1,0], [1,0,1,0,1], [0,1,0,0,0]],
            'S': [[0,1,0,0,1], [1,0,1,0,1], [1,0,1,0,1], [1,0,1,0,1], [1,0,0,1,0]],
            'T': [[1,0,0,0,0], [1,0,0,0,0], [1,1,1,1,1], [1,0,0,0,0], [1,0,0,0,0]],
            'U': [[1,1,1,1,0], [0,0,0,0,1], [0,0,0,0,1], [0,0,0,0,1], [1,1,1,1,0]],
            'V': [[1,1,1,0,0], [0,0,0,1,0], [0,0,0,0,1], [0,0,0,1,0], [1,1,1,0,0]],
            'W': [[1,1,1,1,1], [0,0,0,1,0], [0,0,1,0,0], [0,0,0,1,0], [1,1,1,1,1]],
            'X': [[1,0,0,0,1], [0,1,0,1,0], [0,0,1,0,0], [0,1,0,1,0], [1,0,0,0,1]],
            'Y': [[1,1,0,0,0], [0,0,1,0,0], [0,0,0,1,1], [0,0,1,0,0], [1,1,0,0,0]],
            'Z': [[1,0,0,1,1], [1,0,1,0,1], [1,0,1,0,1], [1,1,0,0,1]],
            '0': [[0,1,1,1,0], [1,0,0,0,1], [1,0,0,0,1], [1,0,0,0,1], [0,1,1,1,0]],
            '1': [[0,1,0,0,1], [1,1,1,1,1], [0,0,0,0,1]],
            '2': [[0,1,0,1,1], [1,0,0,1,1], [1,0,1,0,1], [1,0,1,0,1], [0,1,0,0,1]],
            '3': [[1,0,0,0,1], [1,0,1,0,1], [1,0,1,0,1], [1,1,1,1,1]],
            '4': [[1,1,1,0,0], [0,0,1,0,0], [0,0,1,0,0], [1,1,1,1,1]],
            '5': [[1,1,1,0,1], [1,0,1,0,1], [1,0,1,0,1], [1,0,1,1,0]],
            '6': [[0,1,1,1,0], [1,0,1,0,1], [1,0,1,0,1], [0,0,1,1,0]],
            '7': [[1,0,0,0,0], [1,0,0,1,1], [1,0,1,0,0], [1,1,0,0,0]],
            '8': [[0,1,0,1,0], [1,0,1,0,1], [1,0,1,0,1], [0,1,0,1,0]],
            '9': [[0,1,1,0,0], [1,0,1,0,1], [1,0,1,0,1], [0,1,1,1,0]],
            ' ': [[0,0,0,0,0], [0,0,0,0,0]],
            '.': [[0,0,0,0,1]],
            '!': [[1,1,1,0,1]],
            '?': [[0,1,0,0,0], [1,0,1,0,1], [0,1,0,0,0]],
            '-': [[0,0,1,0,0], [0,0,1,0,0], [0,0,1,0,0]],
            '+': [[0,0,1,0,0], [0,1,1,1,0], [0,0,1,0,0]],
            '=': [[0,1,0,1,0], [0,1,0,1,0], [0,1,0,1,0]]
        };
    }
    
    /**
     * Plot bar graph
     */
    plotBarGraph(value, max) {
        const normalized = Math.max(0, Math.min(1, value / max));
        const ledsToLight = Math.round(normalized * 25);
        
        this.clearScreen();
        
        for (let i = 0; i < ledsToLight; i++) {
            const x = i % 5;
            const y = 4 - Math.floor(i / 5);
            this.plot(x, y);
        }
    }
    
    // ========== MÉTHODES CAPTEURS ==========
    
    getTemperature() {
        return this.temperature;
    }
    
    getLightLevel() {
        return this.lightLevel;
    }
    
    getCompassHeading() {
        return this.compassHeading;
    }
    
    getMagneticForce(dimension) {
        // Pour l'instant, on utilise une valeur unique (magneticForce) pour tous les axes
        // En réalité, le magnétomètre mesure sur 3 axes
        const force = this.magneticForce || 0;
        switch (dimension) {
            case 'x': return force;
            case 'y': return 0;
            case 'z': return 0;
            case 'strength': return Math.abs(force);
            default: return 0;
        }
    }
    
    getAcceleration(dimension) {
        switch (dimension) {
            case 'x': return this.acceleration.x;
            case 'y': return this.acceleration.y;
            case 'z': return this.acceleration.z;
            case 'strength': 
                return Math.round(Math.sqrt(
                    this.acceleration.x ** 2 + 
                    this.acceleration.y ** 2 + 
                    this.acceleration.z ** 2
                ));
            default: return 0;
        }
    }
    
    getRotation(axis) {
        return axis === 'pitch' ? this.rotation.pitch : this.rotation.roll;
    }
    
    getRunningTime() {
        return Date.now() - this.startTime;
    }
    
    getSoundLevel() {
        if (this.elements.micLed) {
            this.elements.micLed.style.stroke = '#ff0000';
            setTimeout(() => {
                if (this.elements.micLed) {
                    this.elements.micLed.style.stroke = '#ffbf00';
                }
            }, 200);
        }
        return this.soundLevel;
    }
    
    // Setters pour les capteurs (appelés depuis app.js)
    setTemperature(value) {
        this.temperature = Math.max(-5, Math.min(50, parseInt(value)));
    }
    
    setLightLevel(value) {
        this.lightLevel = Math.max(0, Math.min(255, parseInt(value)));
    }
    
    setCompassHeading(value) {
        this.compassHeading = Math.max(0, Math.min(359, parseInt(value)));
    }
    
    setMagneticForce(value) {
        this.magneticForce = Math.max(-2000, Math.min(2000, parseInt(value)));
    }
    
    setAcceleration(axis, value) {
        if (axis === 'x') {
            this.acceleration.x = Math.max(-1024, Math.min(1024, parseInt(value)));
        } else if (axis === 'y') {
            this.acceleration.y = Math.max(-1024, Math.min(1024, parseInt(value)));
        } else if (axis === 'z') {
            this.acceleration.z = Math.max(-1024, Math.min(1024, parseInt(value)));
        }
    }
    
    setSoundLevel(value) {
        // Simulated sound level
        this.soundLevel = Math.max(0, Math.min(255, parseInt(value)));
    }
    
    setRotation(pitch, roll) {
        // Pitch: -90 à 90 (bas vers haut)
        // Roll: -90 à 90 (gauche vers droite)
        this.rotation.pitch = Math.max(-90, Math.min(90, parseInt(pitch)));
        this.rotation.roll = Math.max(-90, Math.min(90, parseInt(roll)));
        
        // Déclencher les événements de geste aux bouts de course
        // Pitch en haut (> 70) = logo down
        if (this.rotation.pitch > 70 && (!this.lastRotationState || this.lastRotationState.pitch <= 70)) {
            this.triggerGesture('logo down');
        }
        // Pitch en bas (< -70) = logo up
        else if (this.rotation.pitch < -70 && (!this.lastRotationState || this.lastRotationState.pitch >= -70)) {
            this.triggerGesture('logo up');
        }
        
        // Roll à gauche (< -70) = tilt left
        if (this.rotation.roll < -70 && (!this.lastRotationState || this.lastRotationState.roll >= -70)) {
            this.triggerGesture('tilt left');
        }
        // Roll à droite (> 70) = tilt right
        else if (this.rotation.roll > 70 && (!this.lastRotationState || this.lastRotationState.roll <= 70)) {
            this.triggerGesture('tilt right');
        }
        
        // Sauvegarder l'état précédent
        this.lastRotationState = { pitch: this.rotation.pitch, roll: this.rotation.roll };
    }
    
    // ========== MÉTHODES MUSIQUE ==========
    
    initAudio() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    
    async playTone(frequency, duration) {
        if (!this.speakerEnabled) return;
        
        this.initAudio();
        
        // Arrêter le son précédent
        if (this.currentOscillator) {
            this.currentOscillator.stop();
            this.currentOscillator = null;
        }
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        
        this.currentOscillator = oscillator;
        oscillator.start();
        
        try {
            await this.pause(duration);
        } catch (e) {
            // Arrêter le son immédiatement en cas de StopExecution
            try { oscillator.stop(); } catch(_) {}
            this.currentOscillator = null;
            throw e;
        }
        
        oscillator.stop();
        this.currentOscillator = null;
    }
    
    ringTone(frequency) {
        if (!this.speakerEnabled) return;
        
        this.initAudio();
        
        if (this.currentOscillator) {
            this.currentOscillator.stop();
        }
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        
        this.currentOscillator = oscillator;
        oscillator.start();
    }
    
    rest(duration) {
        if (this.currentOscillator) {
            this.currentOscillator.stop();
            this.currentOscillator = null;
        }
        return this.pause(duration);
    }
    
    stopSound() {
        if (this.currentOscillator) {
            this.currentOscillator.stop();
            this.currentOscillator = null;
        }
    }
    
    setTempo(bpm) {
        this.tempo = Math.max(4, Math.min(400, bpm));
    }
    
    getTempo() {
        return this.tempo;
    }
    
    getBeatMs(fraction = 1) {
        // 1 beat = 60000ms / tempo
        return (60000 / this.tempo) * fraction;
    }
    
    setSpeakerEnabled(enabled) {
        this.speakerEnabled = enabled;
        if (!enabled) this.stopSound();
    }
    
    // ========== MÉTHODES ÉVÉNEMENTS ==========
    
    onButtonPressed(button, callback) {
        const event = button === 'A' ? 'buttonA' : button === 'B' ? 'buttonB' : 'buttonAB';
        this.eventHandlers[event].push(callback);
    }
    
    onGesture(gesture, callback) {
        if (!this.eventHandlers.gesture[gesture]) {
            this.eventHandlers.gesture[gesture] = [];
        }
        this.eventHandlers.gesture[gesture].push(callback);
    }
    
    onLogoEvent(event, callback) {
        this.eventHandlers.logoTouch.push(callback);
    }
    
    triggerEvent(event) {
        if (this.eventHandlers[event]) {
            const gen = window._execGeneration || 0;
            this.eventHandlers[event].forEach(cb => {
                // Wrapper qui catch __StopExecution silencieusement
                Promise.resolve().then(async () => {
                    if ((window._execGeneration || 0) !== gen) return;
                    try { await cb(); } catch (e) {
                        if (e && e.name === '__StopExecution') return;
                        console.error(e);
                    }
                });
            });
        }
    }
    
    triggerGesture(gesture) {
        if (this.eventHandlers.gesture[gesture]) {
            const gen = window._execGeneration || 0;
            this.eventHandlers.gesture[gesture].forEach(cb => {
                Promise.resolve().then(async () => {
                    if ((window._execGeneration || 0) !== gen) return;
                    try { await cb(); } catch (e) {
                        if (e && e.name === '__StopExecution') return;
                        console.error(e);
                    }
                });
            });
        }
        
        // Animation visuelle du shake - animer le conteneur pas le SVG
        if (gesture === 'shake') {
            const board = this.container.querySelector('.microbit-board');
            if (board) {
                board.classList.add('shaking');
                setTimeout(() => board.classList.remove('shaking'), 500);
            }
        }
    }
    
    /**
     * Rotation de 180° (écran en bas/haut)
     */
    rotate180() {
        const svg = this.elements.svg || this.container.querySelector('#MicrobitSVG');
        if (!svg) return;
        
        const board = this.container.querySelector('.microbit-board');
        const isFlipped = board && board.classList.contains('flipped');
        
        const currentRotation = parseInt(svg.dataset.rotation || '0');
        const newRotation = (currentRotation + 180) % 360;
        
        svg.style.transition = 'transform 0.5s ease';
        
        // Préserver le flip si actif
        if (isFlipped) {
            svg.style.transform = `rotate(${newRotation}deg) rotateY(180deg) scaleX(-1)`;
        } else {
            svg.style.transform = `rotate(${newRotation}deg)`;
        }
        
        svg.dataset.rotation = newRotation;
        
        // Déclencher l'événement "screen down" si rotation = 180, "screen up" si 0
        if (newRotation === 180) {
            this.triggerGesture('screen down');
        } else if (newRotation === 0) {
            this.triggerGesture('screen up');
        }
    }
    
    /**
     * Retourner la carte (flip) - logo up/down
     */
    flipBoard() {
        const board = this.container.querySelector('.microbit-board');
        const svg = this.elements.svg || this.container.querySelector('#MicrobitSVG');
        
        if (!svg) return;
        
        const currentRotation = parseInt(svg.dataset.rotation || '0');
        const rotationTransform = currentRotation !== 0 ? `rotate(${currentRotation}deg) ` : '';
        
        if (board.classList.contains('flipped')) {
            // Retour face avant - logo up
            board.classList.remove('flipped');
            svg.classList.remove('flipped');
            svg.style.transition = 'transform 0.6s ease';
            svg.style.transform = `${rotationTransform}rotateY(0deg)`;
            
            // Réafficher les contrôles après l'animation
            setTimeout(() => {
                board.style.pointerEvents = 'auto';
                this.triggerGesture('logo up');
            }, 600);
        } else {
            // Flip vers l'arrière - logo down
            board.classList.add('flipped');
            svg.classList.add('flipped');
            board.style.pointerEvents = 'none';
            svg.style.transition = 'transform 0.6s ease';
            svg.style.transform = `${rotationTransform}rotateY(180deg) scaleX(-1)`;
            
            setTimeout(() => {
                this.triggerGesture('logo down');
            }, 300);
        }
    }
    
    // ========== MÉTHODES RADIO ==========
    
    setRadioGroup(group) {
        this.radioGroup = group;
        this.radioEnabled = true;
    }
    
    radioSendNumber(value) {
        if (!this.radioEnabled) return;
        this.broadcastRadio({ type: 'number', value, group: this.radioGroup });
    }
    
    radioSendString(value) {
        if (!this.radioEnabled) return;
        this.broadcastRadio({ type: 'string', value, group: this.radioGroup });
    }
    
    radioSendValue(name, value) {
        if (!this.radioEnabled) return;
        this.broadcastRadio({ type: 'value', name, value, group: this.radioGroup });
    }
    
    onRadioReceived(type, callback) {
        this.radioCallbacks.push({ type, callback });
    }
    
    broadcastRadio(message) {
        // Pour la simulation locale, on peut émettre un événement custom
        window.dispatchEvent(new CustomEvent('microbit-radio', { detail: message }));
    }
    
    // ========== UTILITAIRES ==========
    
    async pause(ms) {
        const gen = window._execGeneration || 0;
        const StopExec = window.__StopExecution || Error;
        let remaining = ms;
        while (remaining > 0) {
            const chunk = Math.min(remaining, 50);
            await new Promise(r => setTimeout(r, chunk));
            if ((window._execGeneration || 0) !== gen) {
                throw new StopExec('__StopExecution');
            }
            remaining -= chunk;
        }
    }
    
    stopAllAnimations() {
        this.stopAnimationFlag = true;
        this.stopSound();
    }
    
    // Appelé au début de chaque nouvelle exécution
    startNewExecution() {
        this.stopAllAnimations();
        this.clearScreen();
        // Remettre le flag à false SEULEMENT ici (début d'exécution),
        // pas dans reset() qui peut être appelé pendant qu'on arrête
        this.stopAnimationFlag = false;
        this.buttonA = false;
        this.buttonB = false;
        this.startTime = Date.now();
        
        // Reset event handlers
        this.eventHandlers = {
            buttonA: [],
            buttonB: [],
            buttonAB: [],
            gesture: {},
            logoTouch: [],
            pinTouch: {}
        };
        this.radioCallbacks = [];
    }
    
    reset() {
        this.stopAllAnimations();
        this.clearScreen();
        // NE PAS remettre stopAnimationFlag à false ici !
        // Les callbacks async en arrière-plan doivent voir le flag = true
        this.buttonA = false;
        this.buttonB = false;
        this.startTime = Date.now();
        
        // Reset event handlers
        this.eventHandlers = {
            buttonA: [],
            buttonB: [],
            buttonAB: [],
            gesture: {},
            logoTouch: [],
            pinTouch: {}
        };
        this.radioCallbacks = [];
    }
}

// Export
window.MicrobitSimulator = MicrobitSimulator;
