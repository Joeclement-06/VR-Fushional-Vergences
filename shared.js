/**
 * OptoMeasure — Shared Constants & Calculations (FOR +8.0D LENS)
 *
 * Key Fixes:
 * 1. lensPower updated to 8.0D
 * 2. imageDistance reduced (stronger lens → closer image)
 * 3. Formula corrected (m reduced, not increased)
 * 4. Steps dynamically generated (no mismatch)
 * 5. Base-In compensation added
 */

const VR_CONFIG = {
    magnification: 4,
    lensPower: 8.0,

    objectDistance: 10, // cm
    imageDistance: 36,  // adjusted from 40 → closer due to +8.0D

    // ── Device: Vivo Y3 (Vivo 1938) ─────────────────────────────────────────
    device: {
        name: 'Vivo Y3 (1938)',
        physicalWidthCm: 15.93,
        physicalHeightCm: 7.47,
        resolutionW: 1544,
        resolutionH: 720,
        ppi: 270,
    },

    // ── Layout (physical cm on screen) ──────────────────────────────────────
    layout: {
        containerWidthCm: 15.93,
        containerHeightCm: 7.47,
        eyeWidthCm: 7.965,
        lineLengthCm: 3,
    },

    // ── Line / dot appearance ────────────────────────────────────────────────
    lineLengthCm: 3,
    lineThicknessPx: 4,
    dotSizePx: 12,

    // ── IPD ──────────────────────────────────────────────────────────────────
    defaultIPD: 75,
    minIPD: 50,
    maxIPD: 90,

    // ── Corrected Formula for +8.0D ──────────────────────────────────────────
    // Reduced from 80 → 62 to compensate stronger lens
    formula: { m: 62, c: 2 },
};

// ── Utility: prism ↔ shift ────────────────────────────────────────────────────
function shiftToPrism(shiftCm) {
    return VR_CONFIG.formula.m * shiftCm + VR_CONFIG.formula.c;
}

function prismToShift(prism) {
    return (prism - VR_CONFIG.formula.c) / VR_CONFIG.formula.m;
}

// ── Dynamic Steps (avoids mismatch errors) ───────────────────────────────────
const PRISM_LEVELS = [0, 8, 15, 20, 24, 30, 38];

const STEPS = PRISM_LEVELS.map((p, i) => ({
    index: i,
    prism: p,
    shiftCm: prismToShift(p),
}));

// ── Base-In Compensation (VERY IMPORTANT) ────────────────────────────────────
// Helps overcome convergence bias caused by +8.0D lens
const BASE_IN_OFFSET = 2;

function getAdjustedPrism(prism, mode) {
    if (mode === "BI") {
        return prism - BASE_IN_OFFSET;
    }
    return prism;
}

/**
 * getDevicePxPerCm()
 *
 * Uses window.innerWidth / innerHeight (CSS pixels)
 * Must be called AFTER fullscreen/orientation lock
 */
function getDevicePxPerCm() {
    const sw = Math.max(window.innerWidth, window.innerHeight);
    const sh = Math.min(window.innerWidth, window.innerHeight);

    const physW = VR_CONFIG.device.physicalWidthCm;
    const physH = VR_CONFIG.device.physicalHeightCm;

    return {
        x: sw / physW,
        y: sh / physH,
    };
}

// ── Converters ───────────────────────────────────────────────────────────────
function cmToPixels(cm) {
    return cm * getDevicePxPerCm().x;
}

function cmToPixelsY(cm) {
    return cm * getDevicePxPerCm().y;
}

function mmToPixels(mm) {
    return (mm / 10) * getDevicePxPerCm().x;
}

// ── Utility: Generate Room Code ──────────────────────────────────────────────
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}