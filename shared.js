/**
 * OptoMeasure — Shared Constants & Calculations
 * 
 * UPDATED FOR +8.0D LENSES:
 *  1. lensPower updated to 8.0D.
 *  2. Formula m-value increased to 85 (higher magnification).
 *  3. step.shiftCm values reduced to maintain clinical prism accuracy.
 */

const VR_CONFIG = {
    magnification: 4.2, // Slightly increased for +8.0D
    lensPower: 8.0,      // Updated
    objectDistance: 10, 
    imageDistance: 38,   // Image is perceived closer with stronger lens[cite: 7]

    // ── Device: Vivo Y3 (Vivo 1938) ─────────────────────────────────────────
    device: {
        name: 'Vivo Y3 (1938)',
        physicalWidthCm:  15.93,[cite: 8]
        physicalHeightCm:  7.47,[cite: 8]
        resolutionW: 1544,[cite: 8]
        resolutionH:  720,[cite: 8]
        ppi: 270,[cite: 8]
    },

    // ── Layout (physical cm on screen) ──────────────────────────────────────
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
    defaultIPD: 75, // Baseline mid-range[cite: 8]
    minIPD: 50,
    maxIPD: 90,

    // ── Formula y = 85x + 2 ──────────────────────────────────────────────────
    // Increased m to 85 because +8.0D lens bends light more per cm
    formula: { m: 85, c: 2 }, 

    // ── 7 steps (Adjusted shifts for +8.0D) ──────────────────────────────────
    // Shifts are reduced to ensure the prism demand isn't too high
    steps: [
        { index: 0, shiftCm: 0.000, prism: 0  },
        { index: 1, shiftCm: 0.070, prism: 8  }, // Reduced from 0.075
        { index: 2, shiftCm: 0.150, prism: 15 }, 
        { index: 3, shiftCm: 0.210, prism: 20 }, // Reduced from 0.220
        { index: 4, shiftCm: 0.260, prism: 24 }, // Reduced from 0.270
        { index: 5, shiftCm: 0.330, prism: 30 }, // Reduced from 0.350
        { index: 6, shiftCm: 0.420, prism: 38 }, // Reduced from 0.450
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
    const sw = Math.max(window.innerWidth,  window.innerHeight);[cite: 8]
    const sh = Math.min(window.innerWidth,  window.innerHeight);[cite: 8]

    const physW = VR_CONFIG.device.physicalWidthCm;[cite: 8]
    const physH = VR_CONFIG.device.physicalHeightCm;[cite: 8]

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