/**
 * OptoMeasure — Patient VR View (vr.js)
 *
 * CHANGE LOG (Base-In fix for +8.0D):
 *  1. activeSteps() helper — mirrors controller.js; picks VR_CONFIG.stepsBI
 *     when vrState.mode === 'BI', VR_CONFIG.steps otherwise.
 *  2. handleCommand() reads activeStepTable from the update payload and sets
 *     vrState.mode before indexing steps, so shift is always from the
 *     correct table.
 *  3. applyVisualState() uses activeSteps() so shiftCm is always from the
 *     right table. No other geometry logic changed.
 *  4. Debug overlay updated to show which step table is active.
 */
(function () {
    'use strict';

    // ── State ─────────────────────────────────────────────────────────────────
    const vrState = {
        currentStep: 0,
        ipd:  VR_CONFIG.defaultIPD,
        mode: 'BO',
        shiftCmOverride: null,
        connected: false,
        peer: null,
        conn: null,
        roomCode: '',
    };

    // ── DOM helper ────────────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);

    // ── Active step table ─────────────────────────────────────────────────────
    function activeSteps() {
        return (vrState.mode === 'BI') ? VR_CONFIG.stepsBI : VR_CONFIG.steps;
    }

    // ── Layout ────────────────────────────────────────────────────────────────
    function computeLayout() {
        const L       = VR_CONFIG.layout;
        const pxPerCm = getDevicePxPerCm();

        const containerW = L.containerWidthCm  * pxPerCm.x;
        const containerH = L.containerHeightCm * pxPerCm.y;
        const eyeW       = L.eyeWidthCm        * pxPerCm.x;

        const c = $('vrContainer');
        c.style.setProperty('--container-w', containerW + 'px');
        c.style.setProperty('--container-h', containerH + 'px');
        c.style.setProperty('--eye-w',       eyeW       + 'px');

        console.log('[VR] computeLayout pxPerCm:', pxPerCm,
            '| container:', containerW.toFixed(1) + '×' + containerH.toFixed(1),
            '| eyeW:', eyeW.toFixed(1),
            '| viewport:', window.innerWidth + '×' + window.innerHeight);
    }

    // ── Render static line geometry ───────────────────────────────────────────
    function renderLines() {
        const lineLenPxH = cmToPixels (VR_CONFIG.layout.lineLengthCm);
        const lineLenPxV = cmToPixelsY(VR_CONFIG.layout.lineLengthCm);
        const thick   = VR_CONFIG.lineThicknessPx;
        const dotSize = VR_CONFIG.dotSizePx;
        const halfDot = dotSize / 2;

        const hLineLeft  = $('hLineLeft');
        const hLineRight = $('hLineRight');
        hLineLeft.style.cssText  = `width:${lineLenPxH}px;height:${thick}px;right:${halfDot}px;left:auto;`;
        hLineRight.style.cssText = `width:${lineLenPxH}px;height:${thick}px;left:${halfDot}px;right:auto;`;

        const vLineTop    = $('vLineTop');
        const vLineBottom = $('vLineBottom');
        vLineTop.style.cssText    = `height:${lineLenPxV}px;width:${thick}px;bottom:${halfDot}px;top:auto;`;
        vLineBottom.style.cssText = `height:${lineLenPxV}px;width:${thick}px;top:${halfDot}px;bottom:auto;`;

        ['dotLeft','dotRight'].forEach(id => {
            $(id).style.cssText = `width:${dotSize}px;height:${dotSize}px;`;
        });
    }

    /**
     * applyVisualState()
     *
     * Reads shiftCm from the ACTIVE step table (BI or BO).
     * Single transform encodes both shift and IPD offset — no margin conflict.
     *
     * Geometry:
     *   eyeWPx   = physical pixel width of one half-screen
     *   baseHalf = eyeWPx / 2  → dot CSS centre from divider at baseline
     *   halfIPD  = (ipd_mm / 10) * pxPerCm → desired dot-to-divider distance
     *   ipdOff   = halfIPD - baseHalf
     *     positive → dot moves INWARD (toward divider)
     *     negative → dot moves OUTWARD
     *
     *   shiftPx from active step table (BI table has smaller shifts)
     *   BO: left dot shifts right (+), right shifts left  (convergence)
     *   BI: left dot shifts left  (-), right shifts right (divergence)
     *
     *   LEFT  eye: translateX = -ipdOff + sign*shiftPx
     *   RIGHT eye: translateX =  ipdOff - sign*shiftPx
     */
    function applyVisualState() {
        const steps    = activeSteps();
        const stepIdx  = Math.max(0, Math.min(vrState.currentStep, steps.length - 1));
        const step     = steps[stepIdx];

        //const pxPerCm  = getDevicePxPerCm();
         const shiftCm  = (typeof vrState.shiftCmOverride === 'number')
            ? vrState.shiftCmOverride
            : getEffectiveShiftCm(step, vrState.mode);
        const shiftPx  = shiftCm * pxPerCm.x;
       

        const eyeWPx    = VR_CONFIG.layout.eyeWidthCm * pxPerCm.x;
        const baseHalf  = eyeWPx / 2;
        const halfIPDpx = mmToPixels(vrState.ipd) / 2;
        const ipdOff    = halfIPDpx - baseHalf;

        // BO → sign = +1 (dots move inward = convergence)
        // BI → sign = -1 (dots move outward = divergence)
        const sign = (vrState.mode === 'BO') ? 1 : -1;

        const leftX  = -ipdOff + (sign * shiftPx);
        const rightX =  ipdOff - (sign * shiftPx);

        // Clear any legacy margin
        const lc = $('leftContent');
        const rc = $('rightContent');
        lc.style.marginLeft = '';
        rc.style.marginLeft = '';

        lc.style.transform = `translate(calc(-50% + ${leftX}px), -50%)`;
        rc.style.transform = `translate(calc(-50% + ${rightX}px), -50%)`;

        updateDebugOverlay(shiftPx, ipdOff, leftX, rightX, step, shiftCm);
    }

    // ── Debug overlay (press 'd' to toggle) ───────────────────────────────────
    let debugVisible = false;
    function updateDebugOverlay(shiftPx, ipdOff, leftX, rightX, step, shiftCm) {
        const el = $('debugOverlay');
        if (!el || !debugVisible) return;
        const p = getDevicePxPerCm();
        el.textContent =
            `pxPerCm x:${p.x.toFixed(2)} y:${p.y.toFixed(2)}\n` +
            `Mode: ${vrState.mode} | Table: ${vrState.mode === 'BI' ? 'stepsBI' : 'steps'}\n` +
             `Step ${vrState.currentStep} | shift:${shiftCm.toFixed(3)}cm = ${shiftPx.toFixed(1)}px | prism:${step.prism}Δ\n` +
            `IPD:${vrState.ipd}mm | ipdOff:${ipdOff.toFixed(1)}px\n` +
            `leftX:${leftX.toFixed(1)}px  rightX:${rightX.toFixed(1)}px\n` +
            `viewport:${window.innerWidth}×${window.innerHeight}`;
    }

    // ── Handle commands from controller ───────────────────────────────────────
    function handleCommand(data) {
        switch (data.type) {
            case 'update':
                // Set mode FIRST so activeSteps() returns the right table
                if (data.mode)            vrState.mode = data.mode;
                if (data.activeStepTable) vrState.mode = data.activeStepTable;
                if (data.ipd)             vrState.ipd  = data.ipd;
                 if (typeof data.shiftCm === 'number') vrState.shiftCmOverride = data.shiftCm;
                else vrState.shiftCmOverride = null;
                // Clamp step to the active table length
                vrState.currentStep = Math.max(
                    0,
                    Math.min(data.step, activeSteps().length - 1)
                );
                applyVisualState();
                break;

            case 'reset':
                vrState.currentStep = 0;
                vrState.shiftCmOverride = null;
                applyVisualState();
                break;

            case 'ipd':
                vrState.ipd = data.value;
                vrState.shiftCmOverride = null;
                applyVisualState();
                break;

            case 'mode':
                vrState.mode = data.value;
                vrState.shiftCmOverride = null;
                vrState.currentStep = 0;
                applyVisualState();
                break;
        }
    }

    // ── Fullscreen ────────────────────────────────────────────────────────────
    function requestFullscreen() {
        const el  = document.documentElement;
        const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
        if (!rfs) return;

        rfs.call(el)
            .then(function () {
                setTimeout(function () {
                    computeLayout();
                    renderLines();
                    applyVisualState();
                }, 300);
            })
            .catch(function () { /* user denied — ignore */ });

        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(function () {});
        }
    }

    // ── PeerJS ────────────────────────────────────────────────────────────────
    function initPeer() {
        vrState.roomCode = generateRoomCode();
        $('roomCode').textContent = vrState.roomCode;

        const peerId = 'optovr-' + vrState.roomCode.toLowerCase();
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

        vrState.peer = new Peer(peerId, peerOpts);

        vrState.peer.on('open', function () {
            console.log('[VR] Peer ready:', peerId);
        });

        vrState.peer.on('connection', function (conn) {
            vrState.conn = conn;

            conn.on('open', function () {
                vrState.connected = true;
                $('connectOverlay').classList.add('hidden');
                $('connIndicator').classList.add('connected');
                conn.send({ type: 'connected', roomCode: vrState.roomCode });
                requestFullscreen();
            });

            conn.on('data',  function (data) { handleCommand(data); });

            conn.on('close', function () {
                vrState.connected = false;
                $('connIndicator').classList.remove('connected');
                $('connectOverlay').classList.remove('hidden');
                const dot = $('connectOverlay').querySelector('.status-dot');
                const txt = $('connectStatus');
                if (dot) dot.className = 'status-dot waiting';
                if (txt) txt.innerHTML = '<span class="status-dot waiting"></span> Controller disconnected. Waiting…';
            });
        });

        vrState.peer.on('error', function (err) {
            console.error('[VR] Peer error:', err);
            const txt = $('connectStatus');
            if (txt) txt.innerHTML = `<span class="status-dot waiting"></span> Error: ${err.type}. Retrying…`;
            setTimeout(initPeer, 3000);
        });
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function init() {
        computeLayout();
        renderLines();
        applyVisualState();
        initPeer();

        window.addEventListener('resize', function () {
            computeLayout();
            renderLines();
            applyVisualState();
        });

        // Tap screen → fullscreen (only when connected)
        document.addEventListener('click', function (e) {
            if (e.target.closest('#btnCopy')) return;
            if (vrState.connected) requestFullscreen();
        });

        // Copy code button
        const btnCopy = $('btnCopy');
        if (btnCopy) {
            btnCopy.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(vrState.roomCode);
                    btnCopy.textContent = '✅';
                    setTimeout(() => btnCopy.textContent = '📋', 2000);
                } catch (e) { console.warn('Clipboard copy failed', e); }
            });
        }

        // Debug overlay toggle
        document.addEventListener('keydown', function (e) {
            if (e.key === 'd' || e.key === 'D') {
                debugVisible = !debugVisible;
                const el = $('debugOverlay');
                if (el) el.style.display = debugVisible ? 'block' : 'none';
                if (debugVisible) applyVisualState();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();