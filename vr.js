/**
 * OptoMeasure — Patient VR View (vr.js)
 * Receives commands from Controller via PeerJS.
 *
 * FIX LOG:
 *  1. applyShift() and applyIPD() merged into applyVisualState() so that
 *     IPD offset and prism shift are composed inside a single CSS translate().
 *     Previously, marginLeft (IPD) fought with transform (shift) on the same
 *     element, producing a non-linear combined offset.
 *  2. computeLayout() is called again 300 ms after fullscreen is granted so
 *     window.innerWidth reflects the final fullscreen viewport dimensions.
 *  3. All legacy marginLeft calls removed.
 *  4. Added calibration debug overlay (toggle with 'd' key).
 */
(function () {
    'use strict';

    // ── State ─────────────────────────────────────────────────────────────────
    const vrState = {
        currentStep: 0,
        ipd:  VR_CONFIG.defaultIPD,
        mode: 'BO',
        connected: false,
        peer: null,
        conn: null,
        roomCode: '',
    };

    // ── DOM helper ────────────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);

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

        // Left eye — horizontal line
        const hLineLeft  = $('hLineLeft');
        const hLineRight = $('hLineRight');
        hLineLeft.style.cssText  = `width:${lineLenPxH}px;height:${thick}px;right:${halfDot}px;left:auto;`;
        hLineRight.style.cssText = `width:${lineLenPxH}px;height:${thick}px;left:${halfDot}px;right:auto;`;

        // Right eye — vertical line
        const vLineTop    = $('vLineTop');
        const vLineBottom = $('vLineBottom');
        vLineTop.style.cssText    = `height:${lineLenPxV}px;width:${thick}px;bottom:${halfDot}px;top:auto;`;
        vLineBottom.style.cssText = `height:${lineLenPxV}px;width:${thick}px;top:${halfDot}px;bottom:auto;`;

        // Dots
        ['dotLeft','dotRight'].forEach(id => {
            $( id).style.cssText = `width:${dotSize}px;height:${dotSize}px;`;
        });
    }

    /**
     * applyVisualState()
     *
     * FIX: Single transform encodes BOTH shift and IPD offset, eliminating
     * the margin+transform conflict.
     *
     * Geometry:
     *   • eyeWPx   = physical pixel width of one half-screen
     *   • baseHalf = eyeWPx / 2  → dot CSS centre from divider at baseline
     *   • halfIPD  = (ipd_mm / 10) * pxPerCm  → desired dot-to-divider distance
     *   • ipdOff   = halfIPD - baseHalf
     *       positive → dot moves INWARD (toward divider)
     *       negative → dot moves OUTWARD
     *
     *   • shiftPx  = step.shiftCm * pxPerCm
     *   • BO (convergence): left dot shifts right (+shiftPx), right shifts left
     *   • BI (divergence) : left dot shifts left  (-shiftPx), right shifts right
     *
     * Combined for LEFT  eye: translateX = -ipdOff + sign*shiftPx
     * Combined for RIGHT eye: translateX =  ipdOff - sign*shiftPx
     * (The -50%,-50% base centring is preserved in the translate call.)
     */
    function applyVisualState() {
        const steps    = activeSteps();
        const stepIdx  = Math.max(0, Math.min(vrState.currentStep, steps.length - 1));
        const step     = steps[stepIdx];

        const pxPerCm  = getDevicePxPerCm();
        const shiftCm  = (typeof vrState.shiftCmOverride === 'number')
            ? vrState.shiftCmOverride
            : getEffectiveShiftCm(step, vrState.mode);
        const shiftPx  = shiftCm * pxPerCm.x;

        const eyeWPx    = VR_CONFIG.layout.eyeWidthCm * pxPerCm.x;
        const baseHalf  = eyeWPx / 2;
        const halfIPDpx = mmToPixels(vrState.ipd) / 2;
        const ipdOff    = halfIPDpx - baseHalf;

        const sign = vrState.mode === 'BO' ? 1 : -1;

        const leftX  = -ipdOff + (sign * shiftPx);
        const rightX =  ipdOff - (sign * shiftPx);

        // Clear any legacy margin that might remain from old code
        const lc = $('leftContent');
        const rc = $('rightContent');
        lc.style.marginLeft = '';
        rc.style.marginLeft = '';

        lc.style.transform = `translate(calc(-50% + ${leftX}px), -50%)`;
        rc.style.transform = `translate(calc(-50% + ${rightX}px), -50%)`;

        updateDebugOverlay(shiftPx, ipdOff, leftX, rightX);
    }

    // ── Debug overlay (press 'd' to toggle) ───────────────────────────────────
    let debugVisible = false;
    function updateDebugOverlay(shiftPx, ipdOff, leftX, rightX) {
        const el = $('debugOverlay');
        if (!el || !debugVisible) return;
        const step = VR_CONFIG.steps[vrState.currentStep];
        const p    = getDevicePxPerCm();
        el.textContent =
            `pxPerCm x:${p.x.toFixed(2)} y:${p.y.toFixed(2)}\n` +
            `Mode: ${vrState.mode} | Table: ${vrState.mode === 'BI' ? 'stepsBI' : 'steps'}\n` +
            `Step ${vrState.currentStep} | shift:${shiftCm.toFixed(3)}cm = ${shiftPx.toFixed(1)}px | prism:${step.prism}Δ\n` +
            `IPD:${vrState.ipd}mm | ipdOff:${ipdOff.toFixed(1)}px\n` +
            `leftX:${leftX.toFixed(1)}px  rightX:${rightX.toFixed(1)}px\n` +
            `Mode:${vrState.mode} | viewport:${window.innerWidth}×${window.innerHeight}`;
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
                applyVisualState();
                break;
            case 'ipd':
                vrState.ipd = data.value;
                applyVisualState();
                break;
            case 'mode':
                vrState.mode = data.value;
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
                // FIX: Recompute after fullscreen resolves so window.innerWidth
                // reflects the actual fullscreen viewport (not the pre-FS value).
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
        if (typeof Peer === 'undefined') {
            const txt = $('connectStatus');
            if (txt) txt.innerHTML = '<span class="status-dot waiting"></span> PeerJS failed to load. Check internet/CDN.';
            return;
        }

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
                const dot  = $('connectOverlay').querySelector('.status-dot');
                const txt  = $('connectStatus');
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
                if (debugVisible) applyVisualState(); // refresh overlay text
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
