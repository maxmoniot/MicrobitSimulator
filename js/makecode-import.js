/**
 * makecode-import.js — Import des fichiers .hex générés par makecode.microbit.org
 *
 * MakeCode embarque le projet source DANS le fichier .hex, sous forme d'un bloc
 * de records Intel-HEX de type 0x0E, repéré par le magic 41140E2FB82FA2BB :
 *
 *   [magic 8o][metaLen u16 LE][textLen u16 LE][réservé 4o][meta JSON][texte LZMA]
 *
 * Le texte LZMA décompressé donne : [header JSON][fichiers du projet JSON],
 * dont "main.blocks" = du XML Blockly utilisant les types de blocs MakeCode
 * (device_forever, pxt-on-start, basic_show_icon…). Ce module traduit ces types
 * vers ceux de cette application (forever, on_start, …).
 *
 * Ce module est AUTONOME : il ne modifie aucun comportement existant. Il est
 * appelé par loadProject() dans app.js uniquement quand un .hex ne contient PAS
 * le marqueur ### PBLOCKS_PROJECT ### (donc quand l'import habituel échouerait).
 *
 * Dépendance : js/lzma-d-min.js (LZMA-JS, MIT) chargé en local.
 */
(function () {
    'use strict';

    const SOURCE_MAGIC = '41140E2FB82FA2BB';

    // ===================== Icônes MakeCode -> app =====================
    // Les icônes portant le même nom des deux côtés sont gérées automatiquement.
    // Ici on ne liste que celles de l'app, plus les équivalences approchées.
    const APP_ICONS = new Set([
        'Heart', 'SmallHeart', 'Happy', 'Sad', 'Confused', 'Angry', 'Asleep',
        'Surprised', 'Silly', 'Fabulous', 'Meh', 'Yes', 'No', 'Triangle',
        'Diamond', 'Square', 'Target', 'Chessboard', 'Scissors', 'TShirt',
        'Duck', 'House', 'Tortoise', 'Butterfly', 'StickFigure', 'Ghost',
        'Sword', 'Giraffe', 'Skull', 'Umbrella', 'Snake', 'Music',
        'Pitchfork', 'Pacman'
    ]);
    // Icônes MakeCode sans équivalent exact -> approximation raisonnable
    const ICON_FALLBACK = {
        'SmallDiamond': 'Diamond',
        'SmallSquare': 'Square',
        'LeftTriangle': 'Triangle',
        'TriangleLeft': 'Triangle',
        'QuarterNote': 'Music',
        'EighthNote': 'Music'
    };

    const GESTURES = {
        'Gesture.Shake': 'shake',
        'Gesture.LogoUp': 'logo up',
        'Gesture.LogoDown': 'logo down',
        'Gesture.ScreenUp': 'screen up',
        'Gesture.ScreenDown': 'screen down',
        'Gesture.TiltLeft': 'tilt left',
        'Gesture.TiltRight': 'tilt right',
        'Gesture.FreeFall': 'free fall',
        'Gesture.ThreeG': '3g',
        'Gesture.SixG': '6g'
    };

    const BUTTONS = { 'Button.A': 'A', 'Button.B': 'B', 'Button.AB': 'AB' };

    // Effets sonores : mêmes identifiants des deux côtés (giggle, happy, …)
    const APP_SOUNDS = new Set([
        'giggle', 'happy', 'hello', 'mysterious', 'sad', 'slide',
        'soaring', 'spring', 'twinkle', 'yawn'
    ]);

    /**
     * Table de conversion des blocs.
     *   type      : type de bloc dans cette application
     *   inputs    : renommage des <statement>/<value>
     *   transform : ajustements spécifiques (champs, unités…)
     * Un type absent de cette table ET inconnu de l'app est signalé à
     * l'utilisateur puis retiré (le programme importé reste cohérent).
     */
    const MAP = {
        // ---------- Structure / événements ----------
        'pxt-on-start':        { type: 'on_start',  inputs: { HANDLER: 'DO' } },
        'device_forever':      { type: 'forever',   inputs: { HANDLER: 'DO' } },
        'basic_forever':       { type: 'forever',   inputs: { HANDLER: 'DO' } },
        'device_button_event': {
            type: 'input_on_button_pressed', inputs: { HANDLER: 'DO' },
            transform: (el, ctx) => {
                const v = getField(el, 'NAME');
                setField(el, 'BUTTON', BUTTONS[v] || 'A');
                removeField(el, 'NAME');
                if (!BUTTONS[v]) ctx.warn(`bouton « ${v} » inconnu → A`);
            }
        },
        'device_gesture_event': {
            type: 'input_on_gesture', inputs: { HANDLER: 'DO' },
            transform: (el, ctx) => {
                const v = getField(el, 'NAME');
                setField(el, 'GESTURE', GESTURES[v] || 'shake');
                removeField(el, 'NAME');
                if (!GESTURES[v]) ctx.warn(`geste « ${v} » inconnu → secouer`);
            }
        },

        // ---------- Base / affichage ----------
        'basic_show_icon': {
            type: 'basic_show_icon',
            transform: (el, ctx) => {
                let v = (getField(el, 'i') || getField(el, 'ICON') || '').replace(/^IconNames\./, '');
                if (!APP_ICONS.has(v)) {
                    const fb = ICON_FALLBACK[v];
                    if (fb) { ctx.warn(`icône « ${v} » non disponible → ${fb}`); v = fb; }
                    else { ctx.warn(`icône « ${v} » non disponible → Cœur`); v = 'Heart'; }
                }
                removeField(el, 'i');
                setField(el, 'ICON', v);
            }
        },
        'device_show_leds':  { type: 'basic_show_leds', transform: ledsTransform },
        'basic_show_leds':   { type: 'basic_show_leds', transform: ledsTransform },
        'device_print_message': { type: 'basic_show_string', inputs: { text: 'TEXT' } },
        'basic_show_string':    { type: 'basic_show_string', inputs: { text: 'TEXT' } },
        'device_show_number':   { type: 'basic_show_number', inputs: { number: 'NUM' } },
        'basic_show_number':    { type: 'basic_show_number', inputs: { number: 'NUM' } },
        'device_clear_display': { type: 'basic_clear_screen' },
        'basic_clear_screen':   { type: 'basic_clear_screen' },
        // MakeCode compte en millisecondes, cette app en secondes -> conversion
        'device_pause': { type: 'basic_pause', inputs: { pause: 'MS' }, transform: msToSeconds },
        'basic_pause':  { type: 'basic_pause', inputs: { pause: 'MS' }, transform: msToSeconds },

        // ---------- Musique ----------
        'music_playable_play': {
            type: 'music_play_sound_effect',
            transform: (el, ctx) => {
                // <value name="toPlay"><shadow type="soundExpression_..."><field name="soundExpression">soundExpression.giggle
                let sound = null;
                el.querySelectorAll('field').forEach(f => {
                    if (f.getAttribute('name') === 'soundExpression') {
                        sound = (f.textContent || '').replace(/^soundExpression\./, '');
                    }
                });
                // Retirer les entrées : le bloc de l'app n'a qu'une liste déroulante
                Array.from(el.children).forEach(c => {
                    if (c.tagName === 'value') el.removeChild(c);
                });
                removeField(el, 'playbackMode');
                if (!sound || !APP_SOUNDS.has(sound)) {
                    ctx.warn(`son « ${sound || '?'} » non disponible → rire`);
                    sound = 'giggle';
                }
                setField(el, 'SOUND', sound);
            }
        },
        'music_stop_all_sounds': { type: 'music_stop_all_sounds' },

        // ---------- Variables ----------
        // MakeCode : variables_change / app (Blockly standard) : math_change
        'variables_change': { type: 'math_change', inputs: { VALUE: 'DELTA' } },

        // ---------- Blocs standard Blockly (types identiques) ----------
        'variables_set': { type: 'variables_set' },
        'variables_get': { type: 'variables_get' },
        'math_number': { type: 'math_number' },
        'math_arithmetic': { type: 'math_arithmetic' },
        'math_modulo': { type: 'math_modulo' },
        'math_random_int': { type: 'math_random_int' },
        'text': { type: 'text' },
        'text_join': { type: 'text_join' },
        'text_length': { type: 'text_length' },
        'logic_boolean': { type: 'logic_boolean' },
        'logic_compare': { type: 'logic_compare' },
        'logic_operation': { type: 'logic_operation' },
        'logic_negate': { type: 'logic_negate' },
        'controls_if': { type: 'controls_if' },
        'controls_repeat_ext': { type: 'controls_repeat_ext' },
        'controls_whileUntil': { type: 'controls_whileUntil' },
        // Sélecteur de durée MakeCode -> simple nombre
        'timePicker': { type: 'math_number', transform: timePickerToNumber }
    };

    // ===================== Helpers champs =====================
    function getField(el, name) {
        for (const c of el.children) {
            if (c.tagName === 'field' && c.getAttribute('name') === name) return c.textContent;
        }
        return null;
    }
    function setField(el, name, value) {
        for (const c of el.children) {
            if (c.tagName === 'field' && c.getAttribute('name') === name) { c.textContent = value; return; }
        }
        // Créer le champ dans le MÊME namespace que le bloc parent, sinon le
        // sérialiseur ajoute un xmlns="" parasite sur le <field>.
        const ns = el.namespaceURI;
        const f = ns ? el.ownerDocument.createElementNS(ns, 'field')
                     : el.ownerDocument.createElement('field');
        f.setAttribute('name', name);
        f.textContent = value;
        el.insertBefore(f, el.firstChild);
    }
    function removeField(el, name) {
        for (const c of Array.from(el.children)) {
            if (c.tagName === 'field' && c.getAttribute('name') === name) el.removeChild(c);
        }
    }

    // Motif LEDs MakeCode (`. . # . .`) -> 25 caractères 0/1 attendus par l'app
    function ledsTransform(el) {
        const raw = getField(el, 'LEDS') || getField(el, 'MATRIX') || '';
        const cells = raw.replace(/[^#.]/g, '');       // ne garder que # et .
        let matrix = '';
        for (let i = 0; i < 25; i++) matrix += cells.charAt(i) === '#' ? '1' : '0';
        removeField(el, 'LEDS');
        setField(el, 'MATRIX', matrix);
    }

    // device_pause : millisecondes (MakeCode) -> secondes (cette app)
    function msToSeconds(el) {
        el.querySelectorAll('field').forEach(f => {
            const n = f.getAttribute('name');
            if (n === 'ms' || n === 'NUM') {
                const v = parseFloat(f.textContent);
                if (!isNaN(v)) {
                    const sec = v / 1000;
                    // éviter 0.30000000000000004
                    f.textContent = String(Math.round(sec * 1000) / 1000);
                }
            }
        });
    }

    function timePickerToNumber(el) {
        const ms = getField(el, 'ms');
        removeField(el, 'ms');
        if (ms !== null && getField(el, 'NUM') === null) setField(el, 'NUM', ms);
    }

    // ===================== Extraction du .hex =====================
    /** Le contenu ressemble-t-il à un .hex MakeCode contenant un projet ? */
    function isMakeCodeHex(content) {
        return typeof content === 'string' && content.indexOf(SOURCE_MAGIC) !== -1;
    }

    /** Récupère les octets du bloc source (records 0x0E à partir du magic). */
    function extractSourceBytes(content) {
        const lines = content.split(/\r?\n/);
        let started = false;
        const bytes = [];
        for (const ln of lines) {
            if (ln.charAt(0) !== ':') continue;
            const len = parseInt(ln.substr(1, 2), 16);
            const type = ln.substr(7, 2);
            const data = ln.substr(9, len * 2);
            if (!started) {
                if (data.indexOf(SOURCE_MAGIC) === 0) started = true;
                else continue;
            }
            if (type === '01') break;               // fin de fichier
            if (type !== '00' && type !== '0E') continue;  // ignorer le remplissage
            for (let i = 0; i < data.length; i += 2) bytes.push(parseInt(data.substr(i, 2), 16));
        }
        return bytes.length ? new Uint8Array(bytes) : null;
    }

    /** Décompresse et renvoie les fichiers du projet MakeCode. */
    function extractProject(content) {
        const buf = extractSourceBytes(content);
        if (!buf || buf.length < 16) return null;

        const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        const metaLen = dv.getUint16(8, true);
        const textLen = dv.getUint16(10, true);
        if (!metaLen || !textLen || 16 + metaLen + textLen > buf.length) return null;

        const dec = new TextDecoder('utf-8');
        let meta;
        try { meta = JSON.parse(dec.decode(buf.subarray(16, 16 + metaLen))); }
        catch (e) { return null; }

        const compressed = buf.subarray(16 + metaLen, 16 + metaLen + textLen);
        if ((meta.compression || '').toUpperCase() !== 'LZMA') {
            throw new Error('Compression « ' + meta.compression + ' » non prise en charge');
        }
        if (typeof LZMA === 'undefined' || !LZMA.decompress) {
            throw new Error('Décompresseur LZMA absent (js/lzma-d-min.js non chargé)');
        }

        const out = LZMA.decompress(compressed);
        const text = typeof out === 'string'
            ? out
            : dec.decode(new Uint8Array(out));

        // [header JSON de headerSize octets][fichiers JSON]
        const hdrLen = meta.headerSize || 0;
        const filesJson = text.slice(hdrLen);
        let files;
        try { files = JSON.parse(filesJson); }
        catch (e) { throw new Error('Projet MakeCode illisible après décompression'); }

        return { meta: meta, files: files };
    }

    // ===================== Conversion du XML =====================
    /** Remplace un bloc par sa suite (<next>) pour ne pas casser la chaîne. */
    function spliceOut(el) {
        const parent = el.parentNode;
        let nextBlock = null;
        for (const c of el.children) {
            if (c.tagName === 'next') { nextBlock = c.firstElementChild; break; }
        }
        if (nextBlock) parent.replaceChild(nextBlock, el);
        else parent.removeChild(el);
        return nextBlock;
    }

    /**
     * Convertit le XML MakeCode vers le XML de cette application.
     * @returns {{xml: string, warnings: string[], unsupported: string[], count: number}}
     */
    function convertBlocksXml(makecodeXml) {
        const doc = new DOMParser().parseFromString(makecodeXml, 'text/xml');
        if (doc.querySelector('parsererror')) throw new Error('XML MakeCode invalide');

        const warnings = [];
        const unsupported = [];
        const ctx = { warn: (m) => { if (warnings.indexOf(m) === -1) warnings.push(m); } };
        let count = 0;

        // Traite un <block>/<shadow>. Renvoie l'élément qui occupe désormais
        // sa place (lui-même, ou son <next> s'il a été retiré), ou null.
        function handleBlock(el) {
            const type = el.getAttribute('type');
            const rule = MAP[type];
            if (!rule) {
                // Bloc non pris en charge : on le retire sans casser la chaîne.
                if (unsupported.indexOf(type) === -1) unsupported.push(type);
                return spliceOut(el);
            }
            // Renommer les entrées AVANT de descendre dedans
            if (rule.inputs) {
                for (const c of el.children) {
                    if (c.tagName === 'value' || c.tagName === 'statement') {
                        const n = c.getAttribute('name');
                        if (rule.inputs[n]) c.setAttribute('name', rule.inputs[n]);
                    }
                }
            }
            if (rule.transform) rule.transform(el, ctx);
            el.setAttribute('type', rule.type);
            count++;
            walk(el);   // descendre dans value/statement/next
            return el;
        }

        // Parcourt TOUS les éléments : les blocs imbriqués se trouvent sous
        // <statement>, <value> et <next>, il faut donc y descendre aussi.
        function walk(node) {
            let child = node.firstElementChild;
            while (child) {
                const next = child.nextElementSibling;
                if (child.tagName === 'block' || child.tagName === 'shadow') {
                    // Si le bloc est retiré, son remplaçant doit être traité à son tour.
                    let cur = child;
                    while (cur && (cur.tagName === 'block' || cur.tagName === 'shadow')) {
                        const res = handleBlock(cur);
                        if (res === cur) break;      // traité, on s'arrête
                        cur = res;                    // remplaçant : re-traiter
                    }
                } else if (child.tagName !== 'field' && child.tagName !== 'mutation') {
                    walk(child);                      // statement / value / next / variables
                }
                child = next;
            }
        }

        const root = doc.documentElement;
        walk(root);

        // Sérialiser en gardant le namespace Blockly attendu
        root.setAttribute('xmlns', 'https://developers.google.com/blockly/xml');
        const xml = new XMLSerializer().serializeToString(root);
        return { xml: xml, warnings: warnings, unsupported: unsupported, count: count };
    }

    /**
     * Chaîne complète : contenu .hex -> XML prêt pour Blockly.
     * @returns {{xml, warnings, unsupported, count, name}}
     */
    function convertHex(content) {
        const project = extractProject(content);
        if (!project) {
            throw new Error("Ce fichier .hex ne contient pas de projet MakeCode "
                + "(il a peut-être été produit par un autre outil, ou compilé sans le code source).");
        }
        const blocks = project.files && project.files['main.blocks'];
        if (!blocks || !blocks.trim()) {
            const hasTs = project.files && project.files['main.ts'];
            throw new Error(hasTs
                ? "Ce projet MakeCode est écrit en JavaScript/Python (pas en blocs) : il n'y a pas de blocs à importer."
                : "Ce projet MakeCode ne contient pas de blocs.");
        }
        const res = convertBlocksXml(blocks);
        res.name = (project.meta && project.meta.name) || 'MakeCode';
        return res;
    }

    window.MakeCodeImport = {
        isMakeCodeHex: isMakeCodeHex,
        extractProject: extractProject,
        convertBlocksXml: convertBlocksXml,
        convertHex: convertHex
    };
})();
