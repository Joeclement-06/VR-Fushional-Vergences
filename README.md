# OptoMeasure — VR Fusional Vergence Testing System

> A two-device, WebRTC-based tool for measuring **fusional vergence ranges** using a smartphone and Google Cardboard VR headset. No app install, no server — open in any modern mobile browser.

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [How It Works — Optics](#how-it-works--optics)
3. [File Structure](#file-structure)
4. [Bug Fixes Applied](#bug-fixes-applied)
5. [Setup & Usage](#setup--usage)
6. [Calibration Procedure](#calibration-procedure)
7. [Device Customisation](#device-customisation)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Troubleshooting](#troubleshooting)
10. [Technical Reference](#technical-reference)

---

## What It Does

OptoMeasure presents a **split-screen binocular target** through VR cardboard lenses:

| Eye   | Target                        |
|-------|-------------------------------|
| Left  | Horizontal line + centre dot  |
| Right | Vertical line + centre dot    |

When properly fused through the +7.5 D lenses, the patient perceives a **single cross** at approximately 40 cm. The doctor then steps through 6 discrete prism levels by shifting both targets horizontally — inducing **convergence stress (Base-Out)** or **divergence stress (Base-In)**. Break and recovery points are recorded on the controller.

---

## How It Works — Optics

### Formula

```
y = 80x + 2
```

Where:
- `y` = induced prism in **diopters (Δ)**
- `x` = on-screen shift per eye in **centimetres**

The formula is derived from the VR optical chain:
- Object at 10 cm from lens
- Lens power: +7.5 D → focal length = 13.33 cm
- Image formed at ~40 cm (perceived fixation distance)
- Magnification factor: ~4×
- Effective prism = physical shift × magnification × (100 cm/m)

### Steps

| Step | Shift (cm) | Prism (Δ) | Clinical Use              |
|------|-----------|-----------|---------------------------|
| 0    | 0.000     | 0         | Baseline / no demand      |
| 1    | 0.075     | 8         | Mild convergence demand   |
| 2    | 0.150     | 15        | Moderate                  |
| 3    | 0.220     | 20        | Moderate–high             |
| 4    | 0.270     | 24        | High                      |
| 5    | 0.350     | 30        | Very high                 |
| 6    | 0.450     | 38        | Maximum                   |

---

## File Structure

```
optomeasure/
├── index.html        — Landing page (role selector)
├── styles.css        — Landing page styles
│
├── controller.html   — Doctor / examiner interface
├── controller.css    — Controller styles
├── controller.js     — Controller logic (PeerJS sender)
│
├── vr.html           — Patient VR split-screen
├── vr.css            — VR screen styles
├── vr.js             — VR logic (PeerJS receiver, rendering)
│
├── shared.js         — Shared constants, formulas, pixel helpers
│
└── README.md         — This file
```

> **Note:** `css2.css` (Google Fonts preload cache) is not required at runtime.  
> All font imports are already in each CSS file via `@import`.

### Dependency Map

```
index.html
  └── styles.css

controller.html
  ├── controller.css
  ├── peerjs@1.5.4 (CDN)
  ├── shared.js
  └── controller.js

vr.html
  ├── vr.css
  ├── peerjs@1.5.4 (CDN)
  ├── shared.js
  └── vr.js
```

---

## Bug Fixes Applied

### 1 — Wrong Physical Screen Dimensions (Critical)

**File:** `shared.js`

| Property | Old Value | Fixed Value | Error |
|---|---|---|---|
| `physicalWidthCm` | 14.6 cm | **15.93 cm** | −8.5% |
| `physicalHeightCm` | 6.8 cm | **7.47 cm** | −9.0% |

The Vivo Y3 (model 1938) active display is **6.27″ × 2.94″**.  
Converting: `6.27 × 2.54 = 15.93 cm`, `2.94 × 2.54 = 7.47 cm`.

With the old values, every shift was physically **~9% smaller** than intended, meaning prism values were systematically under-delivered.

---

### 2 — `screen.width` Returns Physical Pixels on Android (Critical)

**File:** `shared.js` → `getDevicePxPerCm()`

```js
// OLD — screen.width can be physical pixels (e.g. 1544) on Android Chrome
const sw = Math.max(screen.width, screen.height);

// FIXED — window.innerWidth is always CSS pixels
const sw = Math.max(window.innerWidth, window.innerHeight);
```

On many Android Chrome versions, `screen.width` returns the **native resolution** in physical pixels rather than CSS pixels. If the device pixel ratio (DPR) is 2.15 (Vivo Y3: 1544 / 720 CSS), using `screen.width` makes `pxPerCm` more than 2× too large — causing every shift to be physically **double** its intended value on screen.

---

### 3 — IPD and Shift Applied via Conflicting CSS Properties (Critical)

**File:** `vr.js`

Previously:
- **IPD** was applied via `element.style.marginLeft`
- **Shift** was applied via `element.style.transform = translate(...)`

These two positional systems operate on **different CSS box-model stages**, producing a non-linear combined offset that cannot be predicted or corrected without unifying them.

**Fix:** Both offsets are now composed inside a **single `transform: translate()`** call in `applyVisualState()`:

```js
// LEFT eye:  IPD pulls inward, shift pushes per mode
const leftX  = -ipdOff + (sign * shiftPx);
// RIGHT eye: mirror
const rightX =  ipdOff - (sign * shiftPx);

leftContent.style.transform  = `translate(calc(-50% + ${leftX}px), -50%)`;
rightContent.style.transform = `translate(calc(-50% + ${rightX}px), -50%)`;
```

---

### 4 — IPD Default Incorrect

**File:** `shared.js`

| Property | Old | Fixed |
|---|---|---|
| `defaultIPD` | 62 mm | **75 mm** |

With `eyeWidthCm = 7.965 cm` (half of 15.93 cm), the geometric centre of each half-screen is **39.825 mm** from the divider, giving a baseline IPD of **≈ 79.65 mm**. A default of 75 mm is now used (mid-range, appropriate for most adults), rather than 62 mm which was more than 17 mm below baseline and would have caused systematic inward offset.

---

### 5 — Post-Fullscreen Layout Not Recomputed

**File:** `vr.js`

`computeLayout()` was called before fullscreen was granted, so `window.innerWidth` still reflected the pre-fullscreen (browser-chrome-visible) viewport. After fullscreen resolves, the function is now called again with a 300 ms delay:

```js
rfs.call(el).then(function () {
    setTimeout(function () {
        computeLayout();
        renderLines();
        applyVisualState();
    }, 300);
});
```

---

### 6 — Minor Fixes

- `controller.js`: IPD slider min/max/value now set from `VR_CONFIG` at runtime (not hardcoded in HTML).
- `controller.js`: `btnConnect` is now always re-enabled on all error / timeout paths.
- `controller.js`: `conn.open` guard added to `sendCommand()` to prevent sending on a half-closed connection.
- `controller.html`: Added `<kbd>` shortcut hints for Break (`B`), Recovery (`V`), and Mode toggle (`I`).
- `vr.html`: Added hidden `#debugOverlay` element (press `d` on keyboard to reveal live calibration data).

---

## Setup & Usage

### Requirements

- Two smartphones with modern browsers (Chrome 80+ recommended)
- Shared Wi-Fi network **or** mobile hotspot (for PeerJS STUN signalling)
- VR cardboard with **+7.5 D lenses**
- HTTPS hosting (required for fullscreen and clipboard APIs)

### Hosting Options

#### Option A — Local HTTPS (development)

```bash
# Python with mkcert (recommended)
mkcert -install
mkcert localhost
python3 -m http.server 8443 --ssl-cert localhost.pem --ssl-key localhost-key.pem

# Or use the 'serve' package
npx serve . --ssl-cert localhost.pem --ssl-key localhost-key.pem
```

#### Option B — GitHub Pages (free, permanent)

1. Push the folder to a GitHub repository.
2. Settings → Pages → Source: `main` branch → `/ (root)`.
3. Access via `https://yourusername.github.io/repo-name/`.

#### Option C — Netlify Drop (instant)

1. Go to [netlify.com/drop](https://app.netlify.com/drop).
2. Drag the `optomeasure/` folder into the browser.
3. Get a live HTTPS URL immediately.

---

### Step-by-Step Usage

1. **Patient's phone** → Open `vr.html` → Note the **6-character room code** displayed.
2. **Doctor's phone** → Open `controller.html` → Type the code → Tap **Connect**.
3. A green dot on the VR phone confirms connection. The VR screen goes fullscreen.
4. Insert the patient's phone into the VR cardboard.
5. **Adjust IPD slider** on the controller to match the patient's pupillary distance.
6. Select **Base-Out** (convergence) or **Base-In** (divergence) mode.
7. Tap **+** to advance through prism steps one at a time.
8. When the patient reports diplopia (double vision): tap **Record Break**.
9. Tap **−** to reduce prism. When fusion returns: tap **Record Recovery**.
10. Repeat for the other mode if needed. Tap **Clear Results** between tests.

---

## Calibration Procedure

Run this before the first clinical use and after any lens or device change.

### Step 1 — Measure Physical Screen Size

1. Open `vr.html` on the VR phone.
2. The dashed border on `vr-container` marks the configured screen area.
3. Measure with a ruler: width and height of the active display area (not the phone body).
4. Update `shared.js`:
   ```js
   physicalWidthCm:  15.93,  // your measured value
   physicalHeightCm:  7.47,  // your measured value
   ```

### Step 2 — Verify Pixel Scale

1. Connect controller and VR phone.
2. On the VR phone, press **`d`** to open the debug overlay.
3. Check `pxPerCm x:` value. For the Vivo Y3 in fullscreen landscape:
   - Expected ≈ **`sw_css_px / 15.93`**
   - E.g., if CSS viewport width = 720 px → `720 / 15.93 ≈ 45.2 px/cm`
4. If the value is ~2× what is expected, `window.innerWidth` is returning physical pixels — file a browser-specific bug report.

### Step 3 — Physical Shift Verification

1. Set Step = 1 (shift = 0.075 cm = 0.75 mm).
2. Remove the phone from the headset.
3. Measure the horizontal displacement of the dot from the geometric centre of each half-screen with digital calipers.
4. Expected: **0.75 mm ± 0.1 mm** per side.

### Step 4 — IPD Baseline Check

1. Set IPD = 79.65 mm (theoretical baseline for this device).
2. The dot should sit exactly at the geometric centre of each half-screen (no horizontal offset from centre).
3. Adjust `defaultIPD` in `shared.js` to match what you measure for a centred dot position.

---

## Device Customisation

To use OptoMeasure with a **different phone**, update these fields in `shared.js`:

```js
device: {
    name: 'Your Device Name',
    physicalWidthCm:  /* measure active display width in cm  */,
    physicalHeightCm: /* measure active display height in cm */,
    resolutionW: /* landscape native width in px  */,
    resolutionH: /* landscape native height in px */,
    ppi: /* dots per inch — informational only */,
},

layout: {
    containerWidthCm:  /* same as physicalWidthCm  */,
    containerHeightCm: /* same as physicalHeightCm */,
    eyeWidthCm:        /* physicalWidthCm / 2      */,
    lineLengthCm: 3,   /* keep unless you have a reason to change */
},

defaultIPD: /* physicalWidthCm / 2 × 10 mm  (approximate) */,
```

If you use **different lenses**, recalculate the formula:

```
shift_cm = (prism_Δ − c) / m
where m = magnification × 100 / imageDistance_cm
      c = empirical intercept (measure at zero-shift)
```

---

## Keyboard Shortcuts

These work on the **Controller** page when the room-code input is not focused:

| Key | Action |
|-----|--------|
| `+` / `=` / `↑` / `→` | Step forward (increase prism) |
| `−` / `↓` / `←`       | Step backward (decrease prism) |
| `R`                    | Reset to Step 0 |
| `B`                    | Record Break point |
| `V`                    | Record Recovery point |
| `I`                    | Toggle BO ↔ BI mode |

On the **VR** page:

| Key | Action |
|-----|--------|
| `D` | Toggle debug overlay |

---

## Troubleshooting

### "Could not connect. Check the code and try again."

- Both phones must be online (Wi-Fi or data) — PeerJS uses STUN servers for signalling.
- The room code is case-insensitive but must match exactly.
- If the VR page was refreshed, a new code is generated — get the new code.
- PeerJS free tier may occasionally be congested; try again after 10 seconds.

### Dots appear offset or fused image is displaced

1. Run the calibration procedure above.
2. Check the debug overlay (`d` key on VR phone keyboard) for `pxPerCm` and `ipdOff` values.
3. Ensure `physicalWidthCm` and `physicalHeightCm` match your actual device.

### VR screen does not go fullscreen

- Fullscreen requires a user gesture; the first tap on the VR screen after connection will trigger it.
- Some Android browsers require HTTPS for `requestFullscreen()` — use HTTPS hosting.

### Portrait warning shown on VR phone

- Lock the phone to landscape before inserting it into the cardboard, or tap to trigger the fullscreen + landscape lock.

### Lines are invisible / white-on-white

- Ensure `vr.css` is loading. Check browser console for 404 errors.
- The VR background is intentionally white (#ffffff) with black (#000000) lines for maximum contrast through the lenses.

---

## Technical Reference

### PeerJS IDs

| Role       | Peer ID format            |
|------------|---------------------------|
| VR phone   | `optovr-{roomcode}`       |
| Controller | `optoctrl-{timestamp}`    |

### Message Protocol

All messages are plain JavaScript objects sent over a reliable PeerJS data channel.

**Controller → VR:**

```js
// Full state update
{ type: 'update', step: 3, shiftCm: 0.22, prism: 20, mode: 'BO', ipd: 72 }

// Reset to step 0
{ type: 'reset' }

// IPD-only update
{ type: 'ipd', value: 68 }
```

**VR → Controller:**

```js
// Confirmation on open
{ type: 'connected', roomCode: 'ABCD12' }
```

### CSS Custom Properties (VR Container)

Set by `computeLayout()` in `vr.js`:

| Property | Value | Description |
|---|---|---|
| `--container-w` | e.g. `720px` | Full VR container width in CSS px |
| `--container-h` | e.g. `336px` | Full VR container height in CSS px |
| `--eye-w`       | e.g. `360px` | Width of each eye-view half |

---

*OptoMeasure is a research/educational tool. It is not a certified medical device and should not replace formal clinical equipment for diagnostic purposes.*
