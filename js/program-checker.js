/**
 * Vérification du programme avant téléchargement
 * ------------------------------------------------
 * Bloque le bouton « Télécharger » quand le programme contient une erreur qui
 * empêcherait la carte (ou le Cutebot, la barrière, le portillon) de fonctionner,
 * et montre aux élèves OÙ sont les erreurs :
 *   - le bloc fautif est entouré de rouge et porte une icône ⚠ avec le message ;
 *   - la valeur fautive (nombre) passe en rouge ;
 *   - un panneau liste les erreurs ; un clic amène au bloc.
 * Les marques se mettent à jour en direct pendant que l'élève corrige.
 *
 * Astuce enseignant (non affichée) : Ctrl + clic (Cmd + clic sur Mac) sur le
 * bouton force le téléchargement sans vérification.
 *
 * API : ProgramChecker.check(workspace) → [{ blocks, valueBlock, message }]
 *       ProgramChecker.guardDownload(event) → true si le téléchargement peut partir
 *       ProgramChecker.reset()
 */
(function () {
    'use strict';
    if (typeof Blockly === 'undefined') return;

    // Blocs de départ réellement exécutés (même liste que updateGeneratedCode() dans app.js)
    const ROOT_TYPES = [
        'on_start', 'forever',
        'input_on_button_pressed', 'input_on_gesture', 'input_on_logo_event',
        'radio_on_received_number', 'radio_on_received_string',
        'cutebot_on_ir_receive', 'cutebot_on_track_event',
        'procedures_defnoreturn', 'procedures_defreturn'
    ];
    const PROCEDURE_DEFS = ['procedures_defnoreturn', 'procedures_defreturn'];

    // Entrées qui peuvent rester vides sans gêner la carte
    const OPTIONAL_INPUTS = {
        text_join: /^ADD\d+$/
    };

    const WARNING_ID = 'pb-check';

    // ---------------------------------------------------------------------
    // Règles sur les valeurs (vérifiées seulement quand la case contient un
    // nombre écrit directement ; une variable ou un calcul n'est pas vérifiable)
    // ---------------------------------------------------------------------
    const fr = (v) => String(v).replace('.', ',');

    function range(input, min, max, msg, opts = {}) {
        return { input, min, max, msg, integer: !!opts.integer, minExclusive: !!opts.minExclusive };
    }

    const SPEED_MSG = (qui) => (v) => `La vitesse ${qui}doit être comprise entre -100 et 100 % (ici ${fr(v)}).`;
    const SERVO_ANGLE = range('ANGLE', 0, 180, v => `L'angle du servomoteur doit être compris entre 0 et 180° (ici ${fr(v)}°).`);
    const SERVO_SPEED = range('SPEED', -100, 100, v => `La vitesse de rotation doit être comprise entre -100 et 100 (ici ${fr(v)}).`);
    const SERVO_MIN = range('MIN', 0, 180, v => `L'angle minimum doit être compris entre 0 et 180° (ici ${fr(v)}°).`);
    const SERVO_MAX = range('MAX', 0, 180, v => `L'angle maximum doit être compris entre 0 et 180° (ici ${fr(v)}°).`);
    const SERVO_PULSE = range('PULSE', 500, 2500, v => `Un servomoteur se règle avec une impulsion entre 500 et 2500 µs (ici ${fr(v)}).`);
    const LED_XY = [
        range('X', 0, 4, v => `La colonne (x) doit être un nombre entier entre 0 et 4 (ici ${fr(v)}).`, { integer: true }),
        range('Y', 0, 4, v => `La ligne (y) doit être un nombre entier entre 0 et 4 (ici ${fr(v)}).`, { integer: true })
    ];

    const RULES = {
        basic_pause: [
            range('MS', 0, Infinity, v => `Une pause ne peut pas être négative (${fr(v)} s) : mets 0 ou plus.`)
        ],
        cutebot_move_time: [
            range('TIME', 0, Infinity, v => `La durée ne peut pas être négative (${fr(v)} s) : mets 0 ou plus. Pour reculer, choisis « arrière ».`),
            range('SPEED', -100, 100, SPEED_MSG(''))
        ],
        cutebot_motors: [
            range('LEFT_SPEED', -100, 100, SPEED_MSG('de la roue gauche ')),
            range('RIGHT_SPEED', -100, 100, SPEED_MSG('de la roue droite '))
        ],
        cutebot_servo: [
            range('ANGLE', 0, 180, v => `L'angle de la pince doit être compris entre 0 et 180° (ici ${fr(v)}°).`)
        ],
        led_plot: LED_XY, led_unplot: LED_XY, led_toggle: LED_XY, led_point: LED_XY,
        led_set_brightness: [
            range('VALUE', 0, 255, v => `La luminosité doit être comprise entre 0 et 255 (ici ${fr(v)}).`)
        ],
        led_plot_bar_graph: [
            range('MAX', 0, Infinity, v => `Le maximum du graphique doit être plus grand que 0 (ici ${fr(v)}).`, { minExclusive: true })
        ],
        music_play_tone: [
            range('DURATION', 0, Infinity, v => `La durée de la note ne peut pas être négative (ici ${fr(v)} ms).`)
        ],
        music_play_tone_freq: [
            range('FREQ', 0, Infinity, v => `La fréquence doit être plus grande que 0 Hz (ici ${fr(v)}).`, { minExclusive: true }),
            range('DURATION', 0, Infinity, v => `La durée du son ne peut pas être négative (ici ${fr(v)} ms).`)
        ],
        music_rest: [
            range('DURATION', 0, Infinity, v => `La durée du silence ne peut pas être négative (ici ${fr(v)} ms).`)
        ],
        music_set_tempo: [
            range('BPM', 0, Infinity, v => `Le tempo doit être plus grand que 0 battement par minute (ici ${fr(v)}).`, { minExclusive: true })
        ],
        radio_set_group: [
            range('GROUP', 0, 255, v => `Le groupe radio doit être un nombre entier entre 0 et 255 (ici ${fr(v)}).`, { integer: true })
        ],
        radio_set_transmit_power: [
            range('POWER', 0, 7, v => `La puissance radio doit être un nombre entier entre 0 et 7 (ici ${fr(v)}).`, { integer: true })
        ],
        controls_repeat_ext: [
            range('TIMES', 0, Infinity, v => `Le nombre de répétitions doit être un nombre entier, 0 ou plus (ici ${fr(v)}).`, { integer: true })
        ],
        servo_set_angle: [SERVO_ANGLE], portillon_servo_set_angle: [SERVO_ANGLE],
        servo_run: [SERVO_SPEED], portillon_servo_run: [SERVO_SPEED],
        servo_set_range: [SERVO_MIN, SERVO_MAX], portillon_servo_set_range: [SERVO_MIN, SERVO_MAX],
        servo_set_pulse: [SERVO_PULSE], portillon_servo_set_pulse: [SERVO_PULSE]
    };

    // Règles qui comparent deux cases d'un même bloc
    const PAIR_RULES = {
        math_random_int: (b) => {
            const a = literal(b, 'FROM'), c = literal(b, 'TO');
            if (a && c && a.value > c.value) {
                return { valueBlock: a.block, message: `Le premier nombre (${fr(a.value)}) doit être plus petit que le second (${fr(c.value)}) : la carte s'arrêterait.` };
            }
            return null;
        },
        math_arithmetic: (b) => {
            if (b.getFieldValue('OP') !== 'DIVIDE') return null;
            const d = literal(b, 'B');
            if (d && d.value === 0) {
                return { valueBlock: d.block, message: 'Division par zéro impossible : la carte s\'arrêterait. Change le nombre par lequel tu divises.' };
            }
            return null;
        },
        servo_set_range: rangeOrder,
        portillon_servo_set_range: rangeOrder
    };

    function rangeOrder(b) {
        const lo = literal(b, 'MIN'), hi = literal(b, 'MAX');
        if (lo && hi && lo.value >= hi.value) {
            return { valueBlock: lo.block, message: `L'angle minimum (${fr(lo.value)}°) doit être plus petit que l'angle maximum (${fr(hi.value)}°).` };
        }
        return null;
    }

    // Nombre écrit directement dans la case (bloc « nombre »), sinon null
    function literal(block, inputName) {
        const t = block.getInputTargetBlock(inputName);
        if (!t || t.type !== 'math_number') return null;
        const v = Number(t.getFieldValue('NUM'));
        return Number.isFinite(v) ? { value: v, block: t } : null;
    }

    function inputLabel(block) {
        return block.type === 'cutebot_if' || block.type === 'controls_if' ? '« si »' : 'de ce bloc';
    }

    // ---------------------------------------------------------------------
    // Analyse
    // ---------------------------------------------------------------------
    function check(ws) {
        const errors = [];
        if (!ws) return errors;

        const tops = ws.getTopBlocks(true);
        const roots = [];

        for (const top of tops) {
            if (top.isShadow()) continue;
            if (!ROOT_TYPES.includes(top.type)) {
                errors.push({ blocks: [top], message: 'Ce bloc n\'est accroché à aucun bloc de départ (« au démarrage », « toujours répéter », « quand… ») : il ne sera jamais exécuté. Accroche-le ou supprime-le.' });
                continue;
            }
            if (!top.isEnabled()) {
                errors.push({ blocks: [top], message: 'Ce bloc est en double : la carte n\'en garde qu\'un seul, celui-ci est ignoré. Mets tout son contenu dans le premier, puis supprime-le.' });
                continue;
            }
            roots.push(top);
        }

        // Programme vide : aucun bloc d'action dans les blocs de départ
        const hasAction = roots.some(r => !PROCEDURE_DEFS.includes(r.type) &&
            r.getDescendants(false).some(d => d !== r && !d.isShadow()));
        if (!hasAction) {
            errors.unshift({ blocks: [], message: 'Ton programme est vide : place des blocs dans « au démarrage » ou « toujours répéter ».' });
        }

        const executed = [];
        for (const r of roots) executed.push(...r.getDescendants(false).filter(b => !b.isShadow()));

        // Variables : lues mais jamais définies → la vraie carte s'arrête (NameError)
        const assigned = new Set();
        const reads = new Map(); // nom → [blocs]
        for (const b of executed) {
            if (PROCEDURE_DEFS.includes(b.type) && typeof b.getVars === 'function') {
                b.getVars().forEach(n => assigned.add(String(n)));
            }
            for (const input of b.inputList) {
                for (const field of input.fieldRow) {
                    if (!(field instanceof Blockly.FieldVariable)) continue;
                    const name = field.getText();
                    if (b.type === 'variables_get') {
                        if (!reads.has(name)) reads.set(name, []);
                        reads.get(name).push(b);
                    } else {
                        assigned.add(name);
                    }
                }
            }
        }

        for (const b of executed) {
            // Cases vides
            for (const input of b.inputList) {
                if (!input.connection || input.connection.type !== Blockly.ConnectionType.INPUT_VALUE) continue;
                if (!input.isVisible()) continue;
                if (OPTIONAL_INPUTS[b.type] && OPTIONAL_INPUTS[b.type].test(input.name)) continue;
                if (input.connection.targetBlock()) continue;
                const check = input.connection.getCheck();
                if (check && check.includes('Boolean')) {
                    errors.push({ blocks: [b], message: `La condition ${inputLabel(b)} est vide : glisse une condition (bloc pointu) dans la case.` });
                } else {
                    errors.push({ blocks: [b], message: 'Une case de ce bloc est vide : glisse un nombre ou une valeur dedans.' });
                }
            }

            // Valeurs hors limites
            for (const rule of (RULES[b.type] || [])) {
                const lit = literal(b, rule.input);
                if (!lit) continue;
                const v = lit.value;
                const bad = (rule.minExclusive ? v <= rule.min : v < rule.min) || v > rule.max ||
                    (rule.integer && !Number.isInteger(v));
                if (bad) errors.push({ blocks: [b], valueBlock: lit.block, message: rule.msg(v) });
            }
            const pair = PAIR_RULES[b.type] && PAIR_RULES[b.type](b);
            if (pair) errors.push({ blocks: [b], valueBlock: pair.valueBlock, message: pair.message });
        }

        for (const [name, blocks] of reads) {
            if (assigned.has(name)) continue;
            errors.push({ blocks, message: `La variable « ${name} » est utilisée mais ne reçoit jamais de valeur : ajoute un bloc « définir ${name} à … » (par exemple dans « au démarrage »).` });
        }

        // Ordre de lecture : de haut en bas, puis de gauche à droite
        const pos = (e) => {
            if (!e.blocks.length) return { x: -Infinity, y: -Infinity };
            try { return e.blocks[0].getRelativeToSurfaceXY(); } catch (_) { return { x: 0, y: 0 }; }
        };
        return errors
            .map((e, i) => ({ e, i, p: pos(e) }))
            .sort((a, b) => (a.p.y - b.p.y) || (a.p.x - b.p.x) || (a.i - b.i))
            .map(o => o.e);
    }

    // ---------------------------------------------------------------------
    // Marques sur les blocs
    // ---------------------------------------------------------------------
    let marked = [];       // { block, cls }
    let warned = [];       // blocs portant notre message ⚠
    let lastErrors = [];
    let active = false;    // vérification en direct après un téléchargement bloqué
    let signature = '';

    function alive(b) { return b && !(b.isDeadOrDying && b.isDeadOrDying()) && b.getSvgRoot && b.getSvgRoot(); }

    function clearMarks() {
        for (const m of marked) if (alive(m.block)) m.block.getSvgRoot().classList.remove(m.cls);
        for (const b of warned) if (alive(b)) b.setWarningText(null, WARNING_ID);
        marked = []; warned = [];
    }

    function applyMarks(errors) {
        clearMarks();
        const msgs = new Map();
        for (const err of errors) {
            for (const b of err.blocks) {
                if (!alive(b)) continue;
                b.getSvgRoot().classList.add('pb-check-error');
                marked.push({ block: b, cls: 'pb-check-error' });
                if (!msgs.has(b)) msgs.set(b, []);
                msgs.get(b).push(err.message);
            }
            if (alive(err.valueBlock)) {
                err.valueBlock.getSvgRoot().classList.add('pb-check-value');
                marked.push({ block: err.valueBlock, cls: 'pb-check-value' });
            }
        }
        for (const [b, list] of msgs) {
            b.setWarningText('❌ ' + list.join('\n❌ '), WARNING_ID);
            warned.push(b);
        }
    }

    // ---------------------------------------------------------------------
    // Panneau des erreurs
    // ---------------------------------------------------------------------
    let panel = null, hideTimer = null;

    function blockLabel(b) {
        let t = '';
        try { t = b.toString(48); } catch (e) { t = b.type; }
        return t.replace(/\s+/g, ' ').trim();
    }

    function ensurePanel() {
        if (panel) return panel;
        panel = document.createElement('div');
        panel.id = 'pbCheckPanel';
        panel.className = 'pb-check-panel';
        panel.setAttribute('role', 'alert');
        // Bandeau SOUS la zone des blocs (dans le panneau éditeur) : il réduit la zone
        // au lieu de la recouvrir, donc il ne cache jamais un bloc fautif.
        const host = document.querySelector('.editor-panel') || document.body;
        host.appendChild(panel);
        return panel;
    }

    function esc(s) {
        return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    function renderPanel(errors) {
        const p = ensurePanel();
        clearTimeout(hideTimer);
        p.classList.remove('pb-check-ok', 'pb-check-hidden');
        const n = errors.length;
        p.innerHTML = `
            <div class="pb-check-head">
                <span class="pb-check-icon">⛔</span>
                <div class="pb-check-titles">
                    <div class="pb-check-title">Téléchargement bloqué</div>
                    <div class="pb-check-sub">${n} erreur${n > 1 ? 's' : ''} à corriger avant de télécharger</div>
                </div>
                <button type="button" class="pb-check-close" title="Masquer">×</button>
            </div>
            <ol class="pb-check-list">
                ${errors.map((e, i) => `
                    <li class="pb-check-item${e.blocks.length ? '' : ' pb-check-global'}" data-i="${i}" ${e.blocks.length ? 'title="Voir le bloc"' : ''}>
                        <span class="pb-check-num">${i + 1}</span>
                        <div class="pb-check-body">
                            ${e.blocks.length ? `<div class="pb-check-where">${esc(blockLabel(e.blocks[0]))}</div>` : ''}
                            <div class="pb-check-msg">${esc(e.message)}</div>
                        </div>
                    </li>`).join('')}
            </ol>
            <div class="pb-check-foot">Clique sur une erreur pour aller au bloc. Les blocs en rouge sont à corriger.</div>`;
        p.querySelector('.pb-check-close').onclick = () => p.classList.add('pb-check-hidden');
        p.querySelectorAll('.pb-check-item').forEach(li => {
            li.onclick = () => {
                const err = lastErrors[Number(li.dataset.i)];
                if (err && err.blocks.length) goToBlock(err.blocks[0]);
                p.querySelectorAll('.pb-check-item').forEach(x => x.classList.toggle('pb-check-current', x === li));
            };
        });
    }

    function renderSuccess() {
        const p = ensurePanel();
        p.classList.remove('pb-check-hidden');
        p.classList.add('pb-check-ok');
        p.innerHTML = `
            <div class="pb-check-head">
                <span class="pb-check-icon">✅</span>
                <div class="pb-check-titles">
                    <div class="pb-check-title">Tout est corrigé !</div>
                    <div class="pb-check-sub">Tu peux télécharger ton programme.</div>
                </div>
                <button type="button" class="pb-check-close" title="Fermer">×</button>
            </div>`;
        p.querySelector('.pb-check-close').onclick = hidePanel;
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hidePanel, 5000);
    }

    function hidePanel() {
        clearTimeout(hideTimer);
        if (panel) panel.classList.add('pb-check-hidden');
    }

    function goToBlock(block) {
        const ws = block.workspace;
        if (!ws || !alive(block)) return;
        // Déplier les blocs repliés qui le cachent
        for (let p = block.getParent(); p; p = p.getParent()) {
            if (p.isCollapsed()) p.setCollapsed(false);
        }
        ws.centerOnBlock(block.id, true);
        try {
            if (Blockly.getFocusManager) Blockly.getFocusManager().focusNode(block);
            else block.select();
        } catch (e) { try { block.select(); } catch (_) { /* ignore */ } }
        const icon = block.getIcon && block.getIcon(Blockly.icons.IconType.WARNING);
        if (icon && icon.setBubbleVisible) {
            try { icon.setBubbleVisible(true); } catch (e) { /* ignore */ }
        }
        const root = block.getSvgRoot();
        root.classList.remove('pb-check-flash');
        void root.getBoundingClientRect();
        root.classList.add('pb-check-flash');
        setTimeout(() => root.classList.remove('pb-check-flash'), 1600);
    }

    // ---------------------------------------------------------------------
    // Mise à jour en direct pendant que l'élève corrige
    // ---------------------------------------------------------------------
    let recheckTimer = null;

    function editing() {
        return (Blockly.WidgetDiv && Blockly.WidgetDiv.isVisible()) ||
            (Blockly.DropDownDiv && Blockly.DropDownDiv.isVisible());
    }

    function scheduleRecheck(delay = 250) {
        clearTimeout(recheckTimer);
        recheckTimer = setTimeout(recheck, delay);
    }

    function recheck() {
        if (!active) return;
        // Ne pas redessiner le bloc pendant qu'un champ est en cours de saisie
        if (editing()) { scheduleRecheck(300); return; }
        const ws = window.workspace;
        const errors = check(ws);
        const sig = errors.map(e => e.message + '@' + e.blocks.map(b => b.id).join(',') + '@' + (e.valueBlock ? e.valueBlock.id : '')).join('|');
        if (sig === signature) return;
        signature = sig;
        lastErrors = errors;
        if (!errors.length) {
            clearMarks();
            active = false;
            renderSuccess();
            return;
        }
        applyMarks(errors);
        const wasHidden = panel && panel.classList.contains('pb-check-hidden');
        renderPanel(errors);
        if (wasHidden) panel.classList.add('pb-check-hidden');
    }

    function onWorkspaceEvent(e) {
        if (e.type === Blockly.Events.FINISHED_LOADING) { reset(); return; }
        if (!active || e.isUiEvent) return;
        scheduleRecheck();
    }

    let listenedWs = null;
    function listen() {
        const ws = window.workspace;
        if (!ws || ws === listenedWs) return;
        listenedWs = ws;
        ws.addChangeListener(onWorkspaceEvent);
    }

    // ---------------------------------------------------------------------
    // API
    // ---------------------------------------------------------------------
    function reset() {
        active = false;
        signature = '';
        lastErrors = [];
        clearTimeout(recheckTimer);
        clearMarks();
        hidePanel();
    }

    function guardDownload(evt) {
        // Astuce enseignant : Ctrl/Cmd + clic = téléchargement sans vérification
        if (evt && (evt.ctrlKey || evt.metaKey)) return true;
        const ws = window.workspace;
        if (!ws) return true;
        listen();
        const errors = check(ws);
        if (!errors.length) { reset(); return true; }

        active = true;
        lastErrors = errors;
        signature = '';
        applyMarks(errors);
        renderPanel(errors);
        signature = errors.map(e => e.message + '@' + e.blocks.map(b => b.id).join(',') + '@' + (e.valueBlock ? e.valueBlock.id : '')).join('|');

        // Amener la première erreur à l'écran si elle est cachée (après le
        // redimensionnement de la zone des blocs par le bandeau)
        const first = errors.find(e => e.blocks.length);
        if (first) {
            const b = first.blocks[0];
            setTimeout(() => {
                if (!alive(b)) return;
                const r = b.getSvgRoot().getBoundingClientRect();
                const d = document.getElementById('blocklyDiv').getBoundingClientRect();
                const inside = r.left >= d.left && r.right <= d.right && r.top >= d.top && r.bottom <= d.bottom;
                if (!inside) b.workspace.centerOnBlock(b.id, true);
            }, 250);
        }

        const btn = document.getElementById('btnDownloadHex');
        if (btn) {
            btn.classList.remove('pb-shake');
            void btn.offsetWidth;
            btn.classList.add('pb-shake');
            setTimeout(() => btn.classList.remove('pb-shake'), 600);
        }
        return false;
    }

    // ---------------------------------------------------------------------
    // Styles
    // ---------------------------------------------------------------------
    const css = `
    .pb-check-error:not(.blocklySelected) > .blocklyPath {
        stroke: #dc2626 !important; stroke-width: 3px !important;
        filter: drop-shadow(0 0 4px rgba(220, 38, 38, 0.85));
    }
    .orphan-block.pb-check-error { opacity: 0.8 !important; filter: none !important; }
    .pb-check-value > .blocklyPath {
        fill: #fee2e2 !important; stroke: #dc2626 !important; stroke-width: 2.5px !important;
    }
    .pb-check-value .blocklyText, .pb-check-value .blocklyEditableText > text { fill: #b91c1c !important; font-weight: 700 !important; }
    .pb-check-flash > .blocklyPath { animation: pbCheckFlash 0.4s ease-in-out 4 alternate; }
    @keyframes pbCheckFlash {
        from { filter: drop-shadow(0 0 2px rgba(220, 38, 38, 0.6)); }
        to   { filter: drop-shadow(0 0 14px rgba(220, 38, 38, 1)); }
    }
    .pb-check-panel {
        flex: none; max-height: 38%; min-height: 0;
        display: flex; flex-direction: column;
        background: var(--bg-card, #1e293b); color: var(--text-primary, #f1f5f9);
        border-top: 4px solid var(--danger, #ef4444);
        font-family: 'Inter', system-ui, sans-serif; font-size: 13px; line-height: 1.4;
        animation: pbCheckIn 0.25s ease;
    }
    .pb-check-panel.pb-check-ok { border-top-color: var(--success, #10b981); }
    .pb-check-panel.pb-check-hidden { display: none; }
    @keyframes pbCheckIn { from { opacity: 0; } to { opacity: 1; } }
    .pb-check-head { display: flex; align-items: center; gap: 10px; padding: 8px 10px 6px 14px; }
    .pb-check-icon { font-size: 22px; line-height: 1; }
    .pb-check-titles { flex: 1; min-width: 0; }
    .pb-check-title { font-weight: 700; font-size: 14px; }
    .pb-check-sub { color: var(--text-secondary, #cbd5e1); font-size: 12px; }
    .pb-check-close {
        background: transparent; border: 0; color: var(--text-muted, #94a3b8);
        font-size: 20px; line-height: 1; cursor: pointer; padding: 2px 6px; border-radius: 6px;
    }
    .pb-check-close:hover { background: var(--bg-elevated, #334155); color: var(--text-primary, #f1f5f9); }
    .pb-check-list {
        list-style: none; margin: 0; padding: 0 10px; overflow-y: auto; flex: 1; min-height: 0;
        display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 6px; align-content: start;
    }
    .pb-check-item {
        display: flex; gap: 10px; align-items: flex-start; padding: 8px;
        background: var(--bg-elevated, #334155); border-radius: 8px; cursor: pointer;
        border: 1px solid transparent; transition: border-color 0.15s, background 0.15s;
    }
    .pb-check-item:hover, .pb-check-item.pb-check-current { border-color: var(--danger, #ef4444); background: #3b2330; }
    .pb-check-item.pb-check-global { cursor: default; }
    .pb-check-num {
        flex: none; width: 22px; height: 22px; border-radius: 50%; background: var(--danger, #ef4444);
        color: #fff; font-weight: 700; font-size: 12px; display: flex; align-items: center; justify-content: center;
    }
    .pb-check-body { min-width: 0; }
    .pb-check-where { font-size: 11px; color: var(--text-muted, #94a3b8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pb-check-msg { color: var(--text-primary, #f1f5f9); }
    .pb-check-foot { padding: 6px 14px 8px; color: var(--text-muted, #94a3b8); font-size: 11px; }
    #btnDownloadHex.pb-shake { animation: pbShake 0.5s ease; background: var(--danger, #ef4444) !important; }
    @keyframes pbShake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-6px); } 40% { transform: translateX(6px); }
        60% { transform: translateX(-4px); } 80% { transform: translateX(4px); }
    }`;
    const style = document.createElement('style');
    style.id = 'pb-check-style';
    style.textContent = css;
    document.head.appendChild(style);

    // Brancher l'écoute du workspace dès qu'il existe
    document.addEventListener('DOMContentLoaded', () => setTimeout(listen, 0));

    window.ProgramChecker = { check, guardDownload, reset };
})();
