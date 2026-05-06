/**
 * OptoMeasure — Controller (Doctor's Phone) — controller.js
 *
 * CHANGE LOG (Base-In fix for +8.0D):
 *  1. activeSteps() helper — returns VR_CONFIG.stepsBI in BI mode,
 *     VR_CONFIG.steps in BO mode. All step references use this helper.
 *  2. sendUpdate() sends the correct shiftCm from the active step table.
 *  3. updateUI() reads step count from activeSteps() so ± buttons
 *     clamp correctly against the BI table (7 steps, max 24Δ).
 *  4. Displayed prism uses getAdjustedPrism() in BI mode (subtracts
 *     BASE_IN_OFFSET=4) so the shown value reflects net divergence demand.
 *  5. Toast messages updated to show BI max (24Δ) vs BO max (38Δ).
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

    /**
     * sendUpdate()
     * Sends complete state. Includes:
     *  - activeStepTable: 'BI' or 'BO' so vr.js knows which step array to use
     *  - shiftCm from the correct step table
     *  - adjustedPrism (display value with BASE_IN_OFFSET applied in BI mode)
     */
    function sendUpdate() {
        const steps = activeSteps();
        const step  = steps[ctrl.currentStep];
        sendCommand({
            type:            'update',
            step:            ctrl.currentStep,
            shiftCm:         getEffectiveShiftCm(step, ctrl.mode),
            prism:           step.prism,
            adjustedPrism:   getAdjustedPrism(step.prism, ctrl.mode),
            mode:            ctrl.mode,
            ipd:             ctrl.ipd,
            activeStepTable: ctrl.mode,   // tells VR which table to index into
        });
    }

    // ── UI ────────────────────────────────────────────────────────────────────
    function updateUI() {
        const steps = activeSteps();
        const step  = steps[ctrl.currentStep];
        const displayPrism = getAdjustedPrism(step.prism, ctrl.mode);

        $('prismValue').textContent = displayPrism;
        $('stepNum').textContent    = ctrl.currentStep;
        $('shiftValue').textContent = getEffectiveShiftCm(step, ctrl.mode).toFixed(3);

        renderStepTable();

        // Highlight step table rows
        document.querySelectorAll('.step-row[data-step]').forEach(row => {
            const s = parseInt(row.dataset.step, 10);
            row.classList.remove('active', 'passed');
            if (s === ctrl.currentStep)   row.classList.add('active');
            else if (s < ctrl.currentStep) row.classList.add('passed');
        });

        // Mode buttons
        $('btnBO').classList.toggle('active', ctrl.mode === 'BO');
        $('btnBI').classList.toggle('active', ctrl.mode === 'BI');

        // IPD
        $('ipdValue').textContent = ctrl.ipd;
        $('ipdSlider').value      = ctrl.ipd;

        // Disable ± buttons at limits of the ACTIVE step table
        $('btnMinus').disabled = ctrl.currentStep <= 0;
        $('btnPlus').disabled  = ctrl.currentStep >= steps.length - 1;
    }

    // ── Actions ───────────────────────────────────────────────────────────────
    function stepForward() {
        const maxStep = activeSteps().length - 1;
        if (ctrl.currentStep >= maxStep) {
            const maxPrism = activeSteps()[maxStep].prism;
            showToast('Maximum step reached (' + maxPrism + 'Δ)');
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
        ctrl.currentStep = 0;   // always reset to step 0 on mode change
        updateUI();
        sendUpdate();
        if (mode === 'BO') {
            showToast('◀▶  Base-Out (Convergence) — max 38Δ');
        } else {
            showToast('▶◀  Base-In (Divergence) — max 24Δ, gentle steps');
        }
    }

    function setIPD(value) {
        ctrl.ipd = parseInt(value, 10);
        $('ipdValue').textContent = ctrl.ipd;
        sendCommand({ type: 'ipd', value: ctrl.ipd });
    }

    function recordBreak() {
        const step = activeSteps()[ctrl.currentStep];
        const displayPrism = getAdjustedPrism(step.prism, ctrl.mode);
        $('breakVal').textContent = displayPrism + 'Δ (Step ' + ctrl.currentStep + ')';
        showToast('Break point recorded: ' + displayPrism + 'Δ');
    }

    function recordRecovery() {
        const step = activeSteps()[ctrl.currentStep];
        const displayPrism = getAdjustedPrism(step.prism, ctrl.mode);
        $('recoveryVal').textContent = displayPrism + 'Δ (Step ' + ctrl.currentStep + ')';
        showToast('Recovery point recorded: ' + displayPrism + 'Δ');
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

        $('btnBreak').addEventListener('click',        recordBreak);
        $('btnRecovery').addEventListener('click',     recordRecovery);
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

        // Touch support
        document.querySelectorAll('.btn-move, .btn-record, .mode-btn').forEach(btn => {
            btn.addEventListener('touchend', function (e) {
                e.preventDefault();
                btn.click();
            }, { passive: false });
        });
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function init() {
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