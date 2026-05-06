/**
 * OptoMeasure — Shared Constants & Calculations
 *
 * Device : Vivo 1938 (model Y3, 6.27" × 2.94" active display)
 * VR Lens: +8.0D, Magnification: 4×
 *
 * Formula (Base-Out) : y = 65x + 2   (recalibrated from 80 for +8.0D)
 * Formula (Base-In)  : y = 55x + 2   (gentler — fights +8.0D convergence bias)
 *
 * CHANGE LOG (+7.5D → +8.0D):
 *  1. lensPower       : 7.5  → 8.0
 *  2. imageDistance   : 40   → 36 cm  (+8.0D brings image closer)
 *  3. formula.m (BO)  : 80   → 65     (same shift = more prism with stronger lens)
 *  4. VR_CONFIG.stepsBI added — slower, smaller steps for divergence
 *  5. BASE_IN_OFFSET  : 2    → 4      (extra headroom against convergence lock)
 */

const VR_CONFIG = {
    magnification: 4,
    lensPower:     8.0,          // +8.0D lens
    objectDistance: 10,          // cm
    imageDistance:  36,          // cm — perceived closer with +8.0D

    // ── Device: Vivo Y3 (Vivo 1938) ─────────────────────────────────────────
    device: {
        name:             'Vivo Y3 (1938)',
        physicalWidthCm:  15.93,   // 6.27" × 2.54
        physicalHeightCm:  7.47,   // 2.94" × 2.54
        resolutionW:      1544,
        resolutionH:       720,
        ppi:               270,
    },

    // ── Layout (physical cm on screen) ──────────────────────────────────────
    layout: {
        containerWidthCm:  15.93,
        containerHeightCm:  7.47,
        eyeWidthCm:         7.965, // containerWidth / 2
        lineLengthCm:       3,
    },

    // ── Line / dot appearance ────────────────────────────────────────────────
    lineLengthCm:    3,
    lineThicknessPx: 4,
    dotSizePx:       12,

    // ── IPD ──────────────────────────────────────────────────────────────────
    defaultIPD: 75,   // mm
    minIPD:     50,
    maxIPD:     90,

    // ── Formula (Base-Out) y = 65x + 2 ───────────────────────────────────────
    formula: { m: 65, c: 2 },

    // ── Formula (Base-In)  y = 55x + 2 ───────────────────────────────────────
    // Lower m = smaller physical shift per prism step.
    // This is intentional: +8.0D locks eyes inward, so BI needs gentler steps.
    formulaBI: { m: 55, c: 2 },
};

// ── Base-In compensation offset ───────────────────────────────────────────────
// Subtracted from displayed prism in BI mode to reduce net divergence demand.
// Increased from 2 → 4 to counteract +8.0D convergence bias.
const BASE_IN_OFFSET = 4;

// ── Utility: prism ↔ shift (uses active formula by mode) ─────────────────────
function shiftToPrism(shiftCm, mode) {
    const f = (mode === 'BI') ? VR_CONFIG.formulaBI : VR_CONFIG.formula;
    return f.m * shiftCm + f.c;
}
function prismToShift(prism, mode) {
    const f = (mode === 'BI') ? VR_CONFIG.formulaBI : VR_CONFIG.formula;
    return (prism - f.c) / f.m;
}

// ── Base-Out steps (m = 65) ───────────────────────────────────────────────────
// shiftCm = (prism - 2) / 65
VR_CONFIG.steps = [
    { index: 0, shiftCm: 0,      prism: 0  },
    { index: 1, shiftCm: 0.092,  prism: 8  },
    { index: 2, shiftCm: 0.200,  prism: 15 },
    { index: 3, shiftCm: 0.277,  prism: 20 },
    { index: 4, shiftCm: 0.338,  prism: 24 },
    { index: 5, shiftCm: 0.431,  prism: 30 },
    { index: 6, shiftCm: 0.554,  prism: 38 },
];

// ── Base-In steps (m = 55, gentler) ──────────────────────────────────────────
// shiftCm = (prism - 2) / 55
// Extra intermediate steps at 5Δ and 11Δ let eyes adapt gradually.
VR_CONFIG.stepsBI = [
    { index: 0, shiftCm: 0,      prism: 0  },
    { index: 1, shiftCm: 0.055,  prism: 5  },  // gentle entry step
    { index: 2, shiftCm: 0.109,  prism: 8  },
    { index: 3, shiftCm: 0.164,  prism: 11 },  // intermediate
    { index: 4, shiftCm: 0.236,  prism: 15 },
    { index: 5, shiftCm: 0.327,  prism: 20 },
    { index: 6, shiftCm: 0.400,  prism: 24 },
];

// ── Adjusted prism display (subtracts BASE_IN_OFFSET in BI mode) ──────────────
function getAdjustedPrism(prism, mode) {
    if (mode === 'BI') return Math.max(0, prism - BASE_IN_OFFSET);
    return prism;
}

function getEffectiveShiftCm(step, mode) {
    if (!step) return 0;
    if (mode !== 'BI') return step.shiftCm;
    const effectivePrism = getAdjustedPrism(step.prism, mode);
    return Math.max(0, prismToShift(effectivePrism, mode));
}

// ── Device scaling ────────────────────────────────────────────────────────────
function getDevicePxPerCm() {
    // Use CSS pixels (window.innerWidth), NOT screen.width (physical px on Android)
    const sw = Math.max(window.innerWidth,  window.innerHeight);
    const sh = Math.min(window.innerWidth,  window.innerHeight);
    return {
        x: sw / VR_CONFIG.device.physicalWidthCm,
        y: sh / VR_CONFIG.device.physicalHeightCm,
    };
}

// ── Converters ────────────────────────────────────────────────────────────────
function cmToPixels(cm)  { return cm * getDevicePxPerCm().x; }
function cmToPixelsY(cm) { return cm * getDevicePxPerCm().y; }
function mmToPixels(mm)  { return (mm / 10) * getDevicePxPerCm().x; }

// ── Room code ─────────────────────────────────────────────────────────────────
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}