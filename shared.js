/**
 * OptoMeasure — Shared Constants & Calculations
 *
 * Device: Vivo 1938 (model Y3, 6.27" × 2.94" active display)
 * VR Lens: +8.0D, Magnification: 4×
 * Formula: y = 65x + 2  (recalibrated for +8.0D — was 80x+2 for +7.5D)
 *
 * CONVERSION LOG (+7.5D → +8.0D):
 *  1. lensPower: 7.5 → 8.0
 *  2. imageDistance: 40 → 36 cm  (1/8 = 0.125 D⁻¹, object at 10cm → 1/0.1=10,
 *     image at 1/(8-10) → perceived closer; approx 36 cm effective)
 *  3. formula.m: 80 → 65  (higher magnification means same shift = more prism,
 *     so we reduce m to avoid over-driving divergence demand)
 *  4. Steps recalculated via prismToShift() with new m=65
 */

const VR_CONFIG = {
    magnification: 4,
    lensPower: 8.0,           // CHANGED: was 7.5
    objectDistance: 10,
    imageDistance: 36,        // CHANGED: was 40 (image appears closer with +8.0D)

    // ── Device: Vivo Y3 (Vivo 1938) ─────────────────────────────────────────
    device: {
        name: 'Vivo Y3 (1938)',
        physicalWidthCm:  15.93,
        physicalHeightCm:  7.47,
        resolutionW: 1544,
        resolutionH:  720,
        ppi: 270,
    },

    // ── Layout ───────────────────────────────────────────────────────────────
    layout: {
        containerWidthCm:  15.93,
        containerHeightCm:  7.47,
        eyeWidthCm:         7.965,
        lineLengthCm:       3,
    },

    lineLengthCm:    3,
    lineThicknessPx: 4,
    dotSizePx:       12,

    // ── IPD ──────────────────────────────────────────────────────────────────
    defaultIPD: 75,
    minIPD: 50,
    maxIPD: 90,

    // ── Formula y = 65x + 2 (recalibrated for +8.0D) ─────────────────────────
    formula: { m: 65, c: 2 }, // CHANGED: m was 80

    // ── 7 steps recalculated with m=65 ───────────────────────────────────────
    // shiftCm = (prism - 2) / 65
    steps: [
        { index: 0, shiftCm: 0,      prism: 0  }, // (0-2)/65  → clamped to 0
        { index: 1, shiftCm: 0.092,  prism: 8  }, // (8-2)/65
        { index: 2, shiftCm: 0.200,  prism: 15 }, // (15-2)/65
        { index: 3, shiftCm: 0.277,  prism: 20 }, // (20-2)/65
        { index: 4, shiftCm: 0.338,  prism: 24 }, // (24-2)/65
        { index: 5, shiftCm: 0.431,  prism: 30 }, // (30-2)/65
        { index: 6, shiftCm: 0.554,  prism: 38 }, // (38-2)/65
    ],
};

// ── Utility: prism ↔ shift ────────────────────────────────────────────────────
function shiftToPrism(shiftCm) {
    return VR_CONFIG.formula.m * shiftCm + VR_CONFIG.formula.c;
}
function prismToShift(prism) {
    return (prism - VR_CONFIG.formula.c) / VR_CONFIG.formula.m;
}

function getDevicePxPerCm() {
    const sw = Math.max(window.innerWidth,  window.innerHeight);
    const sh = Math.min(window.innerWidth,  window.innerHeight);
    const physW = VR_CONFIG.device.physicalWidthCm;
    const physH = VR_CONFIG.device.physicalHeightCm;
    return {
        x: sw / physW,
        y: sh / physH,
    };
}

function cmToPixels(cm)  { return cm * getDevicePxPerCm().x; }
function cmToPixelsY(cm) { return cm * getDevicePxPerCm().y; }
function mmToPixels(mm)  { return (mm / 10) * getDevicePxPerCm().x; }

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}