/**
 * WebUSB Flasher - Téléversement direct sur micro:bit via WebUSB
 * Utilise @microbit/microbit-connection pour le flashage
 * 
 * Note: WebUSB fonctionne uniquement sur Chrome/Edge, pas sur Firefox
 */

// État global de la connexion WebUSB
const WebUSBFlasher = {
    // Indique si WebUSB est supporté par le navigateur
    isSupported: false,
    
    // Connexion USB active
    connection: null,
    
    // État de connexion
    isConnected: false,
    
    // Module chargé dynamiquement
    microbitConnection: null,
    
    // Callbacks pour les événements
    onStatusChange: null,
    onProgress: null,
    
    // USB Vendor ID du micro:bit
    MICROBIT_VENDOR_ID: 0x0d28,
    
    /**
     * Vérifie si WebUSB est supporté par le navigateur
     */
    checkSupport() {
        this.isSupported = !!(navigator.usb);
        return this.isSupported;
    },
    
    /**
     * Vérifie si un micro:bit déjà appairé est connecté
     * Ne nécessite pas d'interaction utilisateur
     * @returns {Promise<boolean>} true si un micro:bit appairé est connecté
     */
    async hasPairedMicrobit() {
        if (!this.checkSupport()) {
            return false;
        }
        
        try {
            // Récupérer les périphériques déjà appairés
            const devices = await navigator.usb.getDevices();
            
            // Chercher un micro:bit parmi les périphériques appairés
            const microbit = devices.find(device => device.vendorId === this.MICROBIT_VENDOR_ID);
            
            if (microbit) {
                console.log('✅ micro:bit appairé détecté:', microbit.productName);
                return true;
            }
            
            console.log('ℹ️ Aucun micro:bit appairé détecté');
            return false;
            
        } catch (error) {
            console.error('Erreur vérification micro:bit:', error);
            return false;
        }
    },
    
    /**
     * Charge dynamiquement la librairie @microbit/microbit-connection depuis esm.sh
     */
    async loadLibrary() {
        if (this.microbitConnection) {
            return true;
        }
        
        // @microbit/microbit-connection : bundle LOCAL en priorité (auto-suffisant, voir
        // js/microbit-connection/), puis CDN en secours si le fichier local venait à manquer.
        // URL absolue (pas 'js/...' seul : un import() sans ./ est traité comme un bare
        // specifier de module et échoue). document.baseURI => marche même en sous-dossier.
        const localMc = new URL('js/microbit-connection/microbit-connection.bundle.mjs', document.baseURI).href;
        const urls = [
            localMc,
            'https://esm.sh/@microbit/microbit-connection@0.0.0-alpha.39',
            'https://cdn.jsdelivr.net/npm/@microbit/microbit-connection@0.0.0-alpha.39/+esm'
        ];
        
        for (const url of urls) {
            try {
                this.microbitConnection = await import(url);
                console.log('✅ Librairie microbit-connection chargée depuis', url);
                return true;
            } catch (e) {
                console.warn('⚠️ Echec chargement depuis', url, e.message);
            }
        }
        
        console.error('❌ Impossible de charger la librairie microbit-connection depuis aucun CDN');
        return false;
    },
    
    /**
     * Connecte au micro:bit via WebUSB
     * @param {boolean} useExisting - Si true, utilise un périphérique déjà appairé sans ouvrir le dialogue
     * @returns {Promise<boolean>} true si connecté avec succès
     */
    async connect(useExisting = false) {
        if (!this.isSupported) {
            console.warn('WebUSB non supporté');
            return false;
        }
        
        // Charger la librairie si nécessaire
        if (!await this.loadLibrary()) {
            return false;
        }
        
        try {
            // Créer une nouvelle connexion
            const { createWebUSBConnection } = this.microbitConnection;
            this.connection = createWebUSBConnection();
            
            // Écouter les changements de statut
            this.connection.addEventListener('status', (event) => {
                this.isConnected = (event.status === 'CONNECTED');
                console.log('📡 Statut connexion:', event.status);
                if (this.onStatusChange) {
                    this.onStatusChange(event.status);
                }
            });
            
            // Tenter la connexion
            const status = await this.connection.connect();
            this.isConnected = (status === 'CONNECTED');
            
            if (this.isConnected) {
                console.log('✅ Connecté au micro:bit');
            }
            
            return this.isConnected;
            
        } catch (error) {
            console.error('❌ Erreur connexion WebUSB:', error);
            this.isConnected = false;
            return false;
        }
    },
    
    /**
     * Déconnecte du micro:bit
     */
    async disconnect() {
        if (this.connection) {
            try {
                await this.connection.disconnect();
            } catch (e) {
                // Ignorer les erreurs de déconnexion
            }
            this.connection = null;
            this.isConnected = false;
        }
    },
    
    /**
     * Flash un fichier HEX sur le micro:bit connecté
     * @param {string} hexContent - Contenu du fichier HEX
     * @param {function} onProgress - Callback de progression (0-100)
     * @returns {Promise<boolean>} true si flashé avec succès
     */
    async flash(hexContent, onProgress) {
        if (!this.isConnected || !this.connection) {
            console.error('❌ Non connecté au micro:bit');
            return false;
        }
        
        try {
            const { createUniversalHexFlashDataSource } = this.microbitConnection;
            
            // Créer la source de données pour le flash
            const flashDataSource = createUniversalHexFlashDataSource(hexContent);
            
            // Flasher avec progression
            await this.connection.flash(flashDataSource, {
                partial: true, // Flash partiel (plus rapide si possible)
                progress: (percentage) => {
                    const pct = percentage !== undefined ? Math.round(percentage) : null;
                    console.log(`📥 Flash: ${pct !== null ? pct + '%' : 'en cours...'}`);
                    if (onProgress && pct !== null) {
                        onProgress(pct);
                    }
                }
            });
            
            console.log('✅ Programme flashé avec succès !');
            return true;
            
        } catch (error) {
            console.error('❌ Erreur flash:', error);
            throw error;
        }
    },
    
    /**
     * Connecte et flash en une seule opération
     * @param {string} hexContent - Contenu du fichier HEX
     * @param {function} onProgress - Callback de progression
     * @param {function} onStatus - Callback de statut
     * @returns {Promise<{success: boolean, error?: string, cancelled?: boolean}>}
     */
    async connectAndFlash(hexContent, onProgress, onStatus) {
        // Vérifier le support
        if (!this.checkSupport()) {
            return { 
                success: false, 
                error: 'WebUSB non supporté par ce navigateur. Utilisez Chrome ou Edge.' 
            };
        }
        
        // Mettre à jour le statut
        if (onStatus) onStatus('loading');
        
        // Charger la librairie
        if (!await this.loadLibrary()) {
            return { 
                success: false, 
                error: 'Impossible de charger la librairie de connexion.' 
            };
        }
        
        // Connecter
        if (onStatus) onStatus('connecting');
        
        try {
            const connected = await this.connect();
            
            if (!connected) {
                return { 
                    success: false, 
                    cancelled: true,
                    error: 'Connexion annulée ou échouée.' 
                };
            }
            
            // Flasher
            if (onStatus) onStatus('flashing');
            
            await this.flash(hexContent, onProgress);
            
            // Déconnecter proprement
            await this.disconnect();
            
            if (onStatus) onStatus('done');
            
            return { success: true };
            
        } catch (error) {
            // Nettoyer en cas d'erreur
            await this.disconnect();
            
            let errorMessage = 'Erreur lors du téléversement.';
            let cancelled = false;
            
            if (error.message) {
                if (error.message.includes('No device selected')) {
                    errorMessage = 'Aucun micro:bit sélectionné.';
                    cancelled = true;
                } else if (error.message.includes('Unable to claim interface')) {
                    errorMessage = 'Le micro:bit est utilisé par un autre programme. Fermez MakeCode ou l\'éditeur Python.';
                } else {
                    errorMessage = error.message;
                }
            }
            
            return { 
                success: false, 
                cancelled: cancelled,
                error: errorMessage 
            };
        }
    },
    
    /**
     * Retourne des informations sur le support WebUSB
     */
    getSupportInfo() {
        const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
        const isEdge = /Edg/.test(navigator.userAgent);
        const isFirefox = /Firefox/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
        
        return {
            supported: this.checkSupport(),
            browser: isChrome ? 'Chrome' : isEdge ? 'Edge' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Autre',
            message: this.checkSupport() 
                ? '✅ Téléversement direct disponible (WebUSB)'
                : '⚠️ WebUSB non disponible - téléchargement classique'
        };
    }
};

// Export pour utilisation globale
window.WebUSBFlasher = WebUSBFlasher;

// Vérifier le support au chargement et precharger la librairie
document.addEventListener('DOMContentLoaded', () => {
    const support = WebUSBFlasher.getSupportInfo();
    console.log(`🔌 WebUSB: ${support.message} (${support.browser})`);
    
    if (support.supported) {
        const btn = document.getElementById('btnDownloadHex');
        if (btn) {
            const span = btn.querySelector('span');
            if (span) {
                span.textContent = 'Téléverser / Télécharger';
            }
            btn.title = 'Téléverser sur le micro:bit (WebUSB) ou télécharger le fichier';
        }
        // Precharger la librairie en arriere-plan pour eviter le delai async au moment du clic
        WebUSBFlasher.loadLibrary().then(ok => {
            if (ok) console.log('🔌 Librairie WebUSB pré-chargée');
            else console.warn('🔌 Pré-chargement librairie WebUSB échoué (sera retentée au clic)');
        });
    }
});
