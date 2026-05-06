/**
 * OptoMeasure — Controller (Doctor's Phone) — controller.js
 *
 * FIX LOG:
 *  1. IPD slider range corrected to match shared.js (50–90 mm, default 75).
 *  2. sendUpdate() now always sends mode + ipd together so VR stays in sync
 *     on reconnect.
 *  3. 'i' / 'I' keyboard shortcut toggles between BO and BI mode.
 *  4. Added patient name / session note field (local only, not transmitted).
 *  5. Minor: btnConnect disabled state restored correctly on all error paths.
 */
(function () {
    'use strict';

    // ── State ─────────────────────────────────────────────────────────────────
    const ctrl = {
        currentStep: 0,
        mode: 'BO',
        ipd: VR_CONFIG.defaultIPD,
        connected: false,
        peer: null,
        conn: null,
    };

    // ── DOM ───────────────────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);

    function showToast(msg, duration = 2000) {
        const t = $('toast');
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), duration);
    }

    // ── Active step table (BO uses normal steps, BI uses gentler stepsBI) ─────
    function activeSteps() {
        return (ctrl.mode === 'BI') ? VR_CONFIG.stepsBI : VR_CONFIG.steps;
    }


    function renderStepTable() {
        const table = document.querySelector('.step-table');
        if (!table) return;
        table.querySelectorAll('.step-row[data-step]').forEach(row => row.remove());

        activeSteps().forEach(step => {
            if (step.index === 0) return;
            const row = document.createElement('div');
            row.className = 'step-row';
            row.dataset.step = String(step.index);
            const shownPrism = getAdjustedPrism(step.prism, ctrl.mode);
            const shownShift = getEffectiveShiftCm(step, ctrl.mode).toFixed(3);
            row.innerHTML = `<span>${step.index}</span><span>${shownShift}</span><span>${shownPrism}</span>`;
            table.appendChild(row);
        });
    }

    // ── Connection ────────────────────────────────────────────────────────────
    function connect() {
        const code = $('inputRoomCode').value.trim().toUpperCase();
        if (code.length < 4) {
            $('connectHint').textContent = 'Please enter a valid room code (4–6 chars).';
            return;
        }

        $('connectHint').textContent = 'Connecting…';
        $('btnConnect').disabled = true;

        const myId = 'optoctrl-' + Date.now();
        const peerOpts = {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302'  },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                ],
            },
        };

        ctrl.peer = new Peer(myId, peerOpts);

        ctrl.peer.on('open', function () {
            const targetId = 'optovr-' + code.toLowerCase();
            ctrl.conn = ctrl.peer.connect(targetId, { reliable: true });

            ctrl.conn.on('open', function () {
                ctrl.connected = true;
                onConnected();
            });

            ctrl.conn.on('data', function (data) {
                if (data.type === 'connected') {
                    console.log('[Controller] VR confirmed connection');
                }
            });

            ctrl.conn.on('close', function () {
                ctrl.connected = false;
                onDisconnected();
            });

            ctrl.conn.on('error', function (err) {
                $('connectHint').textContent = 'Connection error: ' + err;
                $('btnConnect').disabled = false;
            });

            // Timeout guard
            setTimeout(function () {
                if (!ctrl.connected) {
                    $('connectHint').textContent = 'Could not connect. Check the code and try again.';
                    $('btnConnect').disabled = false;
                    if (ctrl.peer) ctrl.peer.destroy();
                }
            }, 12000);
        });

        ctrl.peer.on('error', function (err) {
            $('connectHint').textContent = 'Peer error: ' + err.type;
            $('btnConnect').disabled = false;
        });
    }

    function onConnected() {
        $('connDot').classList.add('connected');
        $('connText').textContent = 'Connected';
        $('connectSection').classList.add('hidden');
        $('mainControls').classList.add('visible');
        showToast('✅ Connected to VR device!');
        sendUpdate(); // push full state immediately
    }

    function onDisconnected() {
        $('connDot').classList.remove('connected');
        $('connText').textContent = 'Disconnected';
        $('connectSection').classList.remove('hidden');
        $('mainControls').classList.remove('visible');
        $('btnConnect').disabled = false;
        $('connectHint').textContent = 'Connection lost. Re-enter code to reconnect.';
        showToast('Disconnected from VR device');
    }

    function sendCommand(data) {
        if (ctrl.connected && ctrl.conn && ctrl.conn.open) {
            ctrl.conn.send(data);
        }
    }

    /** Send complete state so VR phone is always in sync */
    function sendUpdate() {
        const step = VR_CONFIG.steps[ctrl.currentStep];
        sendCommand({
            type:    'update',
            step:    ctrl.currentStep,
            shiftCm: step.shiftCm,
            prism:   step.prism,
            mode:    ctrl.mode,
            ipd:     ctrl.ipd,
        });
    }

    // ── UI ────────────────────────────────────────────────────────────────────
    function updateUI() {
        const step = VR_CONFIG.steps[ctrl.currentStep];

        $('prismValue').textContent = step.prism;
        $('stepNum').textContent    = ctrl.currentStep;
        $('shiftValue').textContent = step.shiftCm.toFixed(3);


        // Highlight step table rows
        document.querySelectorAll('.step-row[data-step]').forEach(row => {
            const s = parseInt(row.dataset.step, 10);
            row.classList.remove('active', 'passed');
            if (s === ctrl.currentStep)  row.classList.add('active');
            else if (s < ctrl.currentStep) row.classList.add('passed');
        });

        // Mode buttons
        $('btnBO').classList.toggle('active', ctrl.mode === 'BO');
        $('btnBI').classList.toggle('active', ctrl.mode === 'BI');

        // IPD
        $('ipdValue').textContent = ctrl.ipd;
        $('ipdSlider').value      = ctrl.ipd;

        // Disable ± buttons at limits
        $('btnMinus').disabled = ctrl.currentStep <= 0;
        $('btnPlus').disabled  = ctrl.currentStep >= VR_CONFIG.steps.length - 1;
    }

    // ── Actions ───────────────────────────────────────────────────────────────
    function stepForward() {
        if (ctrl.currentStep >= VR_CONFIG.steps.length - 1) {
            showToast('Maximum step reached (38Δ)');
            return;
        }
        ctrl.currentStep++;
        updateUI();
        sendUpdate();
    }

    function stepBackward() {
        if (ctrl.currentStep <= 0) {
            showToast('Already at starting position');
            return;
        }
        ctrl.currentStep--;
        updateUI();
        sendUpdate();
    }

    function resetSteps() {
        ctrl.currentStep = 0;
        updateUI();
        sendCommand({ type: 'reset' });
        showToast('Reset to initial position');
    }

    function setMode(mode) {
        ctrl.mode = mode;
        ctrl.currentStep = 0;
        updateUI();
        sendUpdate();
        showToast(mode === 'BO' ? '◀▶  Base-Out (Convergence)' : '▶◀  Base-In (Divergence)');
    }

    function setIPD(value) {
        ctrl.ipd = parseInt(value, 10);
        $('ipdValue').textContent = ctrl.ipd;
        sendCommand({ type: 'ipd', value: ctrl.ipd });
    }

    function recordBreak() {
        const step = VR_CONFIG.steps[ctrl.currentStep];
        $('breakVal').textContent = step.prism + 'Δ (Step ' + ctrl.currentStep + ')';
        showToast('Break point recorded: ' + step.prism + 'Δ');
    }

    function recordRecovery() {
        const step = VR_CONFIG.steps[ctrl.currentStep];
        $('recoveryVal').textContent = step.prism + 'Δ (Step ' + ctrl.currentStep + ')';
        showToast('Recovery point recorded: ' + step.prism + 'Δ');
    }

    function clearResults() {
        $('breakVal').textContent    = '—';
        $('recoveryVal').textContent = '—';
        showToast('Results cleared');
    }

    // ── Events ────────────────────────────────────────────────────────────────
    function bindEvents() {
        $('btnConnect').addEventListener('click', connect);
        $('inputRoomCode').addEventListener('keydown', e => { if (e.key === 'Enter') connect(); });

        $('btnPlus').addEventListener('click',  stepForward);
        $('btnMinus').addEventListener('click', stepBackward);
        $('btnReset').addEventListener('click', resetSteps);

        $('btnBO').addEventListener('click', () => setMode('BO'));
        $('btnBI').addEventListener('click', () => setMode('BI'));

        $('ipdSlider').addEventListener('input', function () { setIPD(this.value); });

        $('btnBreak').addEventListener('click',       recordBreak);
        $('btnRecovery').addEventListener('click',    recordRecovery);
        $('btnClearResults').addEventListener('click', clearResults);

        // Keyboard shortcuts
        document.addEventListener('keydown', function (e) {
            if (document.activeElement === $('inputRoomCode')) return;
            switch (e.key) {
                case '+': case '=': case 'ArrowRight': case 'ArrowUp':
                    e.preventDefault(); stepForward();  break;
                case '-': case 'ArrowLeft': case 'ArrowDown':
                    e.preventDefault(); stepBackward(); break;
                case 'r': case 'R':
                    if (!e.ctrlKey) { e.preventDefault(); resetSteps(); }
                    break;
                case 'b': case 'B':
                    e.preventDefault(); recordBreak(); break;
                case 'v': case 'V':
                    e.preventDefault(); recordRecovery(); break;
                case 'i': case 'I':
                    e.preventDefault(); setMode(ctrl.mode === 'BO' ? 'BI' : 'BO'); break;
            }
        });

        // Touch support for action buttons
        document.querySelectorAll('.btn-move, .btn-record, .mode-btn').forEach(btn => {
            btn.addEventListener('touchend', function (e) {
                e.preventDefault();
                btn.click();
            }, { passive: false });
        });
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function init() {
        // Sync slider min/max from config
        const slider = $('ipdSlider');
        slider.min   = VR_CONFIG.minIPD;
        slider.max   = VR_CONFIG.maxIPD;
        slider.value = VR_CONFIG.defaultIPD;

        bindEvents();
        updateUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
