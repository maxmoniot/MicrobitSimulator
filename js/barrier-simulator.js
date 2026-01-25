/**
 * Double Barrière Simulator
 * Simulateur de deux barrières indépendantes avec engrenages animés
 * - Barrière gauche : contrôlée par servo P1 (180°=ouverte vers le haut, 90°=fermée horizontale)
 * - Barrière droite : contrôlée par servo P2 (0°=ouverte vers le haut, 90°=fermée horizontale)
 */

class BarrierSimulator {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.warn('BarrierSimulator: container not found:', containerId);
            return;
        }
        
        // État des barrières (angles servo)
        this.leftAngle = 90;   // Servo P1 - barrière gauche
        this.rightAngle = 90;  // Servo P2 - barrière droite
        
        // Angles cibles pour l'animation
        this.leftTargetAngle = 90;
        this.rightTargetAngle = 90;
        
        // Vitesse d'animation (degrés par frame)
        this.animationSpeed = 2;
        
        // Animation frame ID
        this.animationFrameId = null;
        
        // Éléments SVG
        this.svgElement = null;
        this.leftBarrier = null;
        this.rightBarrier = null;
        this.leftGear = null;
        this.rightGear = null;
        
        // Centres de rotation (extraits du SVG)
        this.centers = {
            leftBarrier: { x: 258.90, y: 439.42 },
            rightBarrier: { x: 554.61, y: 439.42 },
            leftGear: { x: 353.04, y: 439.42 },
            rightGear: { x: 458.41, y: 439.42 }
        };
        
        this.init();
    }
    
    async init() {
        // Charger le SVG
        await this.loadSVG();
        
        // Démarrer la boucle d'animation
        this.startAnimation();
    }
    
    async loadSVG() {
        // SVG inline de la double barrière - viewBox élargi pour inclure les barrières fermées (horizontales)
        const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg id="DoubleBarriereSVG" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="50 210 710 300">
  <defs>
    <style>
      .st0 { fill: #111; }
      .st1 { stroke: #f5c542; }
      .st1, .st2, .st3 { fill: none; stroke-width: 4px; }
      .st2 { stroke: #d6304c; }
      .st4 { fill: #1c2e1c; stroke: #0f1a0f; }
      .st3, .st5 { stroke: #111; }
      .st6 { fill: #3a3a3a; }
      .st7 { fill: #cca300; }
      .st8 { fill: url(#barrierGradient); }
      .st5 { fill: #222; }
      .st9 { fill: #333; }
      .st10 { fill: #e1534f; }
    </style>
    <linearGradient id="barrierGradient" x1="204.04" y1=".91" x2="204.04" y2="1.71" gradientTransform="translate(-89376 8) scale(440 280)" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#4a4a4a"/>
      <stop offset="1" stop-color="#2b2b2b"/>
    </linearGradient>
  </defs>
  <g id="Arriere_Plan">
    <rect class="st8" x="225.32" y="264.38" width="351.23" height="223.51" rx="8" ry="8"/>
    <rect class="st5" x="209.36" y="432.01" width="383.16" height="55.88" rx="5" ry="5"/>
    <g>
      <rect class="st4" x="321.11" y="288.33" width="159.65" height="119.74"/>
      <rect class="st9" x="329.09" y="296.31" width="143.69" height="23.95"/>
      <rect class="st7" x="337.08" y="328.24" width="127.72" height="7.98"/>
      <rect class="st0" x="361.02" y="352.19" width="31.93" height="31.93"/>
      <path class="st2" d="M345.06,400.08c0,31.93,95.79,31.93,95.79,0"/>
      <path class="st1" d="M353.04,400.08c0,23.95,79.83,23.95,79.83,0"/>
      <path class="st3" d="M361.02,400.08c0,15.97,63.86,15.97,63.86,0"/>
    </g>
    <circle class="st0" cx="257.25" cy="296.31" r="7.98"/>
    <circle class="st0" cx="544.62" cy="296.31" r="7.98"/>
  </g>
  <g id="GaucheGear" style="transform-origin: 353.04px 439.42px;">
    <path id="tracé" class="st10" d="M379.3,409.29l5,4.89c1.52.42,4.92-1.51,6.1-.97.66.3,4.55,6.97,4.59,7.77.07,1.28-3.58,3.48-4.02,4.85l1.72,6.8c1.23,1.1,5.62.98,5.95,2.7.21,1.09.22,7.54-.14,8.33-.67,1.44-4.48,1.22-5.65,2.36-.25,1.4-2.21,6.48-1.73,7.44.41.81,3.86,2.6,3.85,4.15,0,.52-3.68,7.2-4.13,7.58-1.36,1.13-5.1-1.46-6.59-.59s-3.37,3.98-5.09,4.96c-.24,1.6,1.72,4.61,1.1,5.93-.34.74-7.47,4.95-8.29,4.88-1.94-.7-2.87-2.83-4.61-3.73-.42-.07-5.95,1.37-6.66,1.63-2.04.75-1.34,4.3-2.75,5.84-.89.62-5.08.64-6.34.57-.65-.04-2.63-.19-3.09-.35-1.01-.34-1.55-4.82-2.2-5.82l-7.14-2.03c-1.47.4-3.78,3.87-5.03,3.86-1.37,0-6.27-3.78-7.87-4.42-1.25-1.51,1.48-5.06.59-6.59-.22-.38-4.75-4.85-5.09-4.95-1.52-.3-4.85,1.58-6.09.97-.4-.2-4.11-6.59-4.24-7.23-.42-2.14,4.07-4.06,3.91-5.58-.19-1.76-1.74-4.5-1.83-6.51-.61-.9-4.26-1.08-5.28-1.87-1.53-1.18-.76-7.38-.43-9.31.99-1.22,5.25-1.29,5.81-2.49.78-1.66.93-4.89,1.74-6.75-.8-1.4-4.12-3.31-3.97-4.89.04-.41,3.64-6.87,3.99-7.2,1.41-1.34,5.05,1.46,6.76.46.38-.22,4.86-4.75,4.95-5.09.16-1.52-1.55-4.53-.96-5.8.28-.61,7.35-4.84,8.05-4.88,1.08-.06,3.62,3.25,4.85,3.74.34.05,6.07-1.4,6.67-1.63,1.73-.65,1.45-4.25,2.31-5.63.56-.9,8.29-.41,9.76-.34l2.12,5.6,7,2.14c1.52.14,3.65-4.46,5.96-3.66.89.31,5.81,3.29,6.64,3.95,2.13,1.7-.8,4.58-.21,6.94v-.02Z"/>
    <circle class="st6" cx="353.04" cy="439.42" r="6.34"/>
  </g>
  <g id="droiteGear" style="transform-origin: 458.41px 439.42px;">
    <path id="tracé1" class="st10" d="M484.67,409.29l5,4.89c1.52.42,4.92-1.51,6.1-.97.66.3,4.55,6.97,4.59,7.77.07,1.28-3.58,3.48-4.02,4.85l1.72,6.8c1.23,1.1,5.62.98,5.95,2.7.21,1.09.22,7.54-.14,8.33-.67,1.44-4.48,1.22-5.65,2.36-.25,1.4-2.21,6.48-1.73,7.44.41.81,3.86,2.6,3.85,4.15,0,.52-3.68,7.2-4.13,7.58-1.36,1.13-5.1-1.46-6.59-.59s-3.37,3.98-5.09,4.96c-.24,1.6,1.72,4.61,1.1,5.93-.34.74-7.47,4.95-8.29,4.88-1.94-.7-2.87-2.83-4.61-3.73-.42-.07-5.95,1.37-6.66,1.63-2.04.75-1.34,4.3-2.75,5.84-.89.62-5.08.64-6.34.57-.65-.04-2.63-.19-3.09-.35-1.01-.34-1.55-4.82-2.2-5.82l-7.14-2.03c-1.47.4-3.78,3.87-5.03,3.86-1.37,0-6.27-3.78-7.87-4.42-1.25-1.51,1.48-5.06.59-6.59-.22-.38-4.75-4.85-5.09-4.95-1.52-.3-4.85,1.58-6.09.97-.4-.2-4.11-6.59-4.24-7.23-.42-2.14,4.07-4.06,3.91-5.58-.19-1.76-1.74-4.5-1.83-6.51-.61-.9-4.26-1.08-5.28-1.87-1.53-1.18-.76-7.38-.43-9.31.99-1.22,5.25-1.29,5.81-2.49.78-1.66.93-4.89,1.74-6.75-.8-1.4-4.12-3.31-3.97-4.89.04-.41,3.64-6.87,3.99-7.2,1.41-1.34,5.05,1.46,6.76.46.38-.22,4.86-4.75,4.95-5.09.16-1.52-1.55-4.53-.96-5.8.28-.61,7.35-4.84,8.05-4.88,1.08-.06,3.62,3.25,4.85,3.74.34.05,6.07-1.4,6.67-1.63,1.73-.65,1.45-4.25,2.31-5.63.56-.9,8.29-.41,9.76-.34l2.12,5.6,7,2.14c1.52.14,3.65-4.46,5.96-3.66.89.31,5.81,3.29,6.64,3.95,2.13,1.7-.8,4.58-.21,6.94v-.02Z"/>
    <circle class="st6" cx="458.41" cy="439.42" r="6.34"/>
  </g>
  <g id="gaucheBarriere" style="transform-origin: 258.90px 439.42px;">
    <path class="st10" d="M283.51,409.29l5,4.89c1.52.42,4.92-1.51,6.1-.97.66.3,4.55,6.97,4.59,7.77.07,1.28-3.58,3.48-4.02,4.85l1.72,6.8c1.23,1.1,5.62.98,5.95,2.7.21,1.09.22,7.54-.14,8.33-.67,1.44-4.48,1.22-5.65,2.36-.25,1.4-2.21,6.48-1.73,7.44.41.81,3.86,2.6,3.85,4.15,0,.52-3.68,7.2-4.13,7.58-1.36,1.13-5.1-1.46-6.59-.59s-3.37,3.98-5.09,4.96c-.24,1.6,1.72,4.61,1.1,5.93-.34.74-7.47,4.95-8.29,4.88-1.94-.7-2.87-2.83-4.61-3.73-.42-.07-5.95,1.37-6.66,1.63-2.04.75-1.34,4.3-2.75,5.84-.89.62-5.08.64-6.34.57-.65-.04-2.63-.19-3.09-.35-1.01-.34-1.55-4.82-2.2-5.82l-7.14-2.03c-1.47.4-3.78,3.87-5.03,3.86-1.37,0-6.27-3.78-7.87-4.42-1.25-1.51,1.48-5.06.59-6.59-.22-.38-4.75-4.85-5.09-4.95-1.52-.3-4.85,1.58-6.09.97-.4-.2-4.11-6.59-4.24-7.23-.42-2.14,4.07-4.06,3.91-5.58-.19-1.76-1.74-4.5-1.83-6.51-.61-.9-4.26-1.08-5.28-1.87-1.53-1.18-.76-7.38-.43-9.31.99-1.22,5.25-1.29,5.81-2.49.78-1.66.93-4.89,1.74-6.75-.8-1.4-4.12-3.31-3.97-4.89.04-.41,3.64-6.87,3.99-7.2,1.41-1.34,5.05,1.46,6.76.46.38-.22,4.86-4.75,4.95-5.09.16-1.52-1.55-4.53-.96-5.8.28-.61,7.35-4.84,8.05-4.88,1.08-.06,3.62,3.25,4.85,3.74.34.05,6.07-1.4,6.67-1.63,1.73-.65,1.45-4.25,2.31-5.63.56-.9,8.29-.41,9.76-.34l2.12,5.6,7,2.14c1.52.14,3.65-4.46,5.96-3.66.89.31,5.81,3.29,6.64,3.95,2.13,1.7-.8,4.58-.21,6.94v-.02Z"/>
    <rect class="st10" x="240.44" y="238.89" width="36.91" height="207.36"/>
    <circle class="st6" cx="258.9" cy="439.42" r="6.34"/>
  </g>
  <g id="droiteBarriere" style="transform-origin: 554.61px 439.42px;">
    <path class="st10" d="M580.46,409.29l5,4.89c1.52.42,4.92-1.51,6.1-.97.66.3,4.55,6.97,4.59,7.77.07,1.28-3.58,3.48-4.02,4.85l1.72,6.8c1.23,1.1,5.62.98,5.95,2.7.21,1.09.22,7.54-.14,8.33-.67,1.44-4.48,1.22-5.65,2.36-.25,1.4-2.21,6.48-1.73,7.44.41.81,3.86,2.6,3.85,4.15,0,.52-3.68,7.2-4.13,7.58-1.36,1.13-5.1-1.46-6.59-.59s-3.37,3.98-5.09,4.96c-.24,1.6,1.72,4.61,1.1,5.93-.34.74-7.47,4.95-8.29,4.88-1.94-.7-2.87-2.83-4.61-3.73-.42-.07-5.96,1.37-6.66,1.63-2.04.75-1.34,4.3-2.75,5.84-.89.62-5.08.64-6.34.57-.65-.04-2.63-.19-3.09-.35-1.01-.34-1.55-4.82-2.2-5.82l-7.14-2.03c-1.47.4-3.78,3.87-5.03,3.86-1.37,0-6.27-3.78-7.87-4.42-1.25-1.51,1.48-5.06.59-6.59-.22-.38-4.75-4.85-5.09-4.95-1.52-.3-4.85,1.58-6.09.97-.4-.2-4.11-6.59-4.24-7.23-.42-2.14,4.07-4.06,3.91-5.58-.19-1.76-1.74-4.5-1.83-6.51-.61-.9-4.26-1.08-5.28-1.87-1.53-1.18-.76-7.38-.43-9.31.99-1.22,5.25-1.29,5.81-2.49.78-1.66.93-4.89,1.74-6.75-.8-1.4-4.12-3.31-3.97-4.89.04-.41,3.64-6.87,3.99-7.2,1.41-1.34,5.05,1.46,6.76.46.38-.22,4.86-4.75,4.95-5.09.16-1.52-1.55-4.53-.96-5.8.28-.61,7.35-4.84,8.05-4.88,1.08-.06,3.62,3.25,4.85,3.74.34.05,6.07-1.4,6.67-1.63,1.73-.65,1.45-4.25,2.31-5.63.56-.9,8.29-.41,9.76-.34l2.12,5.6,7,2.14c1.52.14,3.65-4.46,5.96-3.66.89.31,5.81,3.29,6.64,3.95,2.13,1.7-.8,4.58-.21,6.94v-.02Z"/>
    <rect class="st10" x="536.15" y="238.89" width="36.91" height="207.36"/>
    <circle class="st6" cx="554.61" cy="439.42" r="6.34"/>
  </g>
</svg>`;
        
        this.container.innerHTML = svgContent;
        
        // Récupérer les éléments SVG
        this.svgElement = this.container.querySelector('svg');
        this.leftBarrier = this.container.querySelector('#gaucheBarriere');
        this.rightBarrier = this.container.querySelector('#droiteBarriere');
        this.leftGear = this.container.querySelector('#GaucheGear');
        this.rightGear = this.container.querySelector('#droiteGear');
        
        // Appliquer les rotations initiales
        this.updateVisuals();
    }
    
    /**
     * Définit l'angle cible pour la barrière gauche (Servo P1)
     * @param {number} angle - Angle du servo (180=ouverte vers le haut, 90=fermée horizontale)
     */
    setLeftAngle(angle) {
        this.leftTargetAngle = Math.max(0, Math.min(180, angle));
        console.log(`🚧 Barrière gauche (P1): cible = ${this.leftTargetAngle}°`);
    }
    
    /**
     * Définit l'angle cible pour la barrière droite (Servo P2)
     * @param {number} angle - Angle du servo (0=ouverte vers le haut, 90=fermée horizontale)
     */
    setRightAngle(angle) {
        this.rightTargetAngle = Math.max(0, Math.min(180, angle));
        console.log(`🚧 Barrière droite (P2): cible = ${this.rightTargetAngle}°`);
    }
    
    /**
     * Démarre la boucle d'animation
     */
    startAnimation() {
        const animate = () => {
            this.updateAngles();
            this.updateVisuals();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        animate();
    }
    
    /**
     * Arrête la boucle d'animation
     */
    stopAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    /**
     * Mise à jour progressive des angles vers les cibles
     */
    updateAngles() {
        // Animation barrière gauche
        if (this.leftAngle !== this.leftTargetAngle) {
            const diff = this.leftTargetAngle - this.leftAngle;
            if (Math.abs(diff) <= this.animationSpeed) {
                this.leftAngle = this.leftTargetAngle;
            } else {
                this.leftAngle += Math.sign(diff) * this.animationSpeed;
            }
        }
        
        // Animation barrière droite
        if (this.rightAngle !== this.rightTargetAngle) {
            const diff = this.rightTargetAngle - this.rightAngle;
            if (Math.abs(diff) <= this.animationSpeed) {
                this.rightAngle = this.rightTargetAngle;
            } else {
                this.rightAngle += Math.sign(diff) * this.animationSpeed;
            }
        }
    }
    
    /**
     * Met à jour l'affichage visuel des barrières et engrenages
     */
    updateVisuals() {
        if (!this.leftBarrier || !this.rightBarrier || !this.leftGear || !this.rightGear) {
            return;
        }
        
        // Calcul des rotations visuelles (0° = vers le bas, 180° = vers le haut)
        // Barrière gauche (P1): 180° servo = vers le haut (ouverte), 90° servo = horizontale extérieur (fermée)
        const leftBarrierRotation = -this.leftAngle;
        
        // Barrière droite (P2): 0° servo = vers le haut (ouverte), 90° servo = horizontale extérieur (fermée)
        const rightBarrierRotation = 180 - this.rightAngle;
        
        // Les engrenages tournent en sens inverse des barrières
        // Et on multiplie par un facteur pour un effet visuel plus prononcé
        const gearMultiplier = 3; // L'engrenage tourne 3x plus vite visuellement
        const leftGearRotation = -leftBarrierRotation * gearMultiplier;
        const rightGearRotation = -rightBarrierRotation * gearMultiplier;
        
        // Appliquer les transformations
        this.leftBarrier.style.transform = `rotate(${leftBarrierRotation}deg)`;
        this.rightBarrier.style.transform = `rotate(${rightBarrierRotation}deg)`;
        this.leftGear.style.transform = `rotate(${leftGearRotation}deg)`;
        this.rightGear.style.transform = `rotate(${rightGearRotation}deg)`;
    }
    
    /**
     * Réinitialise les barrières à la position fermée (horizontale)
     */
    reset() {
        this.leftAngle = 90;
        this.rightAngle = 90;
        this.leftTargetAngle = 90;
        this.rightTargetAngle = 90;
        this.updateVisuals();
        console.log('🚧 Barrières réinitialisées (position fermée)');
    }
    
    /**
     * Définit immédiatement les angles (sans animation)
     */
    setAnglesImmediate(leftAngle, rightAngle) {
        this.leftAngle = Math.max(0, Math.min(180, leftAngle));
        this.rightAngle = Math.max(0, Math.min(180, rightAngle));
        this.leftTargetAngle = this.leftAngle;
        this.rightTargetAngle = this.rightAngle;
        this.updateVisuals();
    }
}

// Instance globale du simulateur de barrières
let barrierSimulator = null;

/**
 * Initialise le simulateur de barrières
 */
function initBarrierSimulator() {
    barrierSimulator = new BarrierSimulator('barrierSimulatorContent');
    console.log('🚧 Simulateur Double Barrière initialisé');
}

// Export global
window.BarrierSimulator = BarrierSimulator;
window.barrierSimulator = null;
window.initBarrierSimulator = initBarrierSimulator;
