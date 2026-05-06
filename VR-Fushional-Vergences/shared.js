/**
 * OptoMeasure — Shared Constants & Calculations
 *
 * Device: Vivo 1938 (model Y3, 6.27" × 2.94" active display)
 * VR Lens: +7.5D, Magnification: 4×
 * Formula: y = 80x + 2  (y = prism diopters, x = shift in cm)
 *
 * FIX LOG:
 *  1. physicalWidthCm corrected from 14.6 → 15.93 cm  (6.27" × 2.54)
 *     physicalHeightCm corrected from 6.8  → 7.47  cm  (2.94" × 2.54)
 *  2. getDevicePxPerCm() now uses window.innerWidth/innerHeight (true CSS px)
 *     instead of screen.width which may return physical pixels on Android.
 *  3. IPD default corrected: with eyeWidth = 7.5 cm, centre-to-divider = 3.75 cm
 *     → baseline IPD = 75 mm. Default changed from 62 → 75.
 */

const VR_CONFIG = {
    magnification: 4,
    lensPower: 7.5,
    objectDistance: 10, // cm
    imageDistance: 40,  // cm

    // ── Device: Vivo Y3 (Vivo 1938) ─────────────────────────────────────────
    device: {
        name: 'Vivo Y3 (1938)',
        // Physical ACTIVE display area — measured with ruler on device
        // 6.27" wide × 2.94" tall  →  × 2.54 = cm
        physicalWidthCm:  15.93, // FIX: was 14.6
        physicalHeightCm:  7.47, // FIX: was 6.8
        // Native pixel resolution (landscape)
        resolutionW: 1544,
        resolutionH:  720,
        ppi: 270, // actual ppi = sqrt(1544²+720²)/6.53" ≈ 270 (not 400)
    },

    // ── Layout (physical cm on screen) ──────────────────────────────────────
    layout: {
        containerWidthCm:  15.93, // full display width
        containerHeightCm:  7.47, // full display height
        eyeWidthCm:         7.965, // each half = containerWidth / 2
        lineLengthCm:       3,    // 3 cm each side of dot
    },

    // ── Line / dot appearance ────────────────────────────────────────────────
    lineLengthCm:    3,
    lineThicknessPx: 4,
    dotSizePx:       12,

    // ── IPD ──────────────────────────────────────────────────────────────────
    // Baseline: dot sits at geometric centre of each half-screen (eyeWidthCm/2
    // from the divider).  eyeWidthCm/2 = 3.9825 cm ≈ 39.8 mm per eye
    // → baseline IPD = 2 × 39.8 = 79.6 mm.  Default set to 75 (mid-range).
    defaultIPD: 75, // mm  FIX: was 62
    minIPD: 50,
    maxIPD: 90,

    // ── Formula y = 80x + 2 ──────────────────────────────────────────────────
    formula: { m: 80, c: 2 },

    // ── 7 steps (step 0 = baseline, no prism) ────────────────────────────────
    steps: [
        { index: 0, shiftCm: 0,     prism: 0  },
        { index: 1, shiftCm: 0.075, prism: 8  },
        { index: 2, shiftCm: 0.15,  prism: 15 },
        { index: 3, shiftCm: 0.22,  prism: 20 },
        { index: 4, shiftCm: 0.27,  prism: 24 },
        { index: 5, shiftCm: 0.35,  prism: 30 },
        { index: 6, shiftCm: 0.45,  prism: 38 },
    ],
};

// ── Utility: prism ↔ shift ────────────────────────────────────────────────────
function shiftToPrism(shiftCm) {
    return VR_CONFIG.formula.m * shiftCm + VR_CONFIG.formula.c;
}
function prismToShift(prism) {
    return (prism - VR_CONFIG.formula.c) / VR_CONFIG.formula.m;
}

/**
 * getDevicePxPerCm()
 *
 * FIX: Use window.innerWidth / innerHeight (CSS pixels) NOT screen.width.
 * On many Android Chrome builds, screen.width returns PHYSICAL pixels,
 * making pxPerCm ~2× too large and every shift physically double its
 * intended value.
 *
 * Must be called AFTER the page reaches its final orientation/fullscreen
 * state (vr.js calls this from a post-fullscreen callback).
 *
 * Returns { x: cssPixelsPerCmH, y: cssPixelsPerCmV }
 */
function getDevicePxPerCm() {
    // Use the larger dimension as landscape width
    const sw = Math.max(window.innerWidth,  window.innerHeight);
    const sh = Math.min(window.innerWidth,  window.innerHeight);

    const physW = VR_CONFIG.device.physicalWidthCm;
    const physH = VR_CONFIG.device.physicalHeightCm;

    return {
        x: sw / physW,
        y: sh / physH,
    };
}

// Convenience converters
function cmToPixels(cm)  { return cm * getDevicePxPerCm().x; }
function cmToPixelsY(cm) { return cm * getDevicePxPerCm().y; }
function mmToPixels(mm)  { return (mm / 10) * getDevicePxPerCm().x; }

/** Generate a random 6-char room code */
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
