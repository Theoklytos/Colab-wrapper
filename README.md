# Colab Mobile Wrapper

Mobile-optimized Google Colab launcher for **Samsung Galaxy A17** (1080×2340px, 385 PPI, Super AMOLED, 90Hz).

Two independent approaches — use one or both:

| Approach | How it works | Best for |
|----------|-------------|----------|
| **PWA + Bookmarklet** | Node.js server in Termux. Chrome Custom Tab for Colab. Bookmarklet injects CSS. | Quick setup, no APK needed |
| **Android APK** | Custom WebView with CSS auto-injected. Foreground service keeps session alive. | Best persistence, offline CSS |

---

## Part 1: PWA + Bookmarklet (Termux)

### Setup

```bash
# In Termux on your Samsung A17:
pkg update && pkg upgrade
pkg install nodejs git

git clone <this-repo-url> ~/Colab-wrapper
cd ~/Colab-wrapper
npm install
```

### Run

```bash
cd ~/Colab-wrapper
node server.js
```

Leave this running in the background (or use Termux's "Acquire Wakelock" to keep Termux alive).

### Install as PWA

1. Open **Chrome** on your A17
2. Go to `http://localhost:3000`
3. Tap the Chrome ⋮ menu → **Add to Home Screen**
4. Name it "Colab Mobile" → tap **Add**

The icon appears on your home screen. Tap to open — it launches without browser chrome (standalone mode).

### Generate Icons (optional)

```bash
npm install --save-dev sharp
node scripts/generate-icons.js
```

This generates all PNG icon sizes from `pwa/icons/source/icon.svg`.

---

## Part 2: Mobile CSS Bookmarklet

The bookmarklet injects mobile-optimized CSS directly into Google Colab running in Chrome.

### What it does

- Removes Colab's desktop min-width constraints (content fits your screen)
- Increases code editor font to 15px (readable at 385 PPI)
- Makes all buttons 44px+ touch targets (Samsung HIG minimum)
- Collapses line number gutters to save horizontal space
- Adds AMOLED true-black option (saves battery on Super AMOLED)
- Limits output height with touchable scroll
- Makes dropdown menus fingertip-friendly

### Install the bookmarklet

1. Open **Colab Mobile** (from home screen) → **CSS Enhancer** section
2. Select variant: **Mobile** / **AMOLED** / **Font** / **All**
3. Tap **Copy Bookmarklet**
4. In Chrome, bookmark any page (e.g. google.com)
5. Tap the bookmark ⭐ → **Edit** → change Name to `Colab CSS`
6. Replace the URL with the copied bookmarklet code
7. Save

### Use the bookmarklet

1. Open Colab in Chrome
2. Tap the Chrome address bar
3. Type `Colab CSS`
4. Tap the bookmark

A toast confirms "Colab mobile CSS applied ✓". Tap again to toggle off.

---

## Part 3: Session Persistence

### Screen Wake Lock (in the PWA)

The PWA launcher has a **Wake Lock** toggle. When enabled:
- Chrome requests a screen wake lock via the Wake Lock API
- The screen stays on while the launcher is in the foreground
- If the screen is briefly locked and unlocked, the lock is re-acquired

**Also recommended:** In Chrome Settings → Performance → **Memory Saver**, add `colab.research.google.com` to the "Always keep these sites active" list.

### Heartbeat Timer

Enable **Session Heartbeat** in the PWA to start a background timer that records activity every 4 minutes.

Note: The Colab kernel runs on Google's servers and continues executing code as long as the session is alive server-side. The client (Chrome tab) just needs to stay in memory. The wake lock + foreground service (APK) handle this.

### Samsung Battery Settings (critical for long sessions)

Samsung's Device Care optimizer aggressively kills background processes:

1. **Settings → Apps → Google Chrome → Battery** → set to **Unrestricted**
2. If using the APK: **Settings → Apps → Colab Mobile → Battery** → **Unrestricted**
3. **Settings → Device Care → Battery → Background Usage Limits** → disable for Chrome

---

## Part 4: Android APK

See [`android/ANDROID_BUILD.md`](android/ANDROID_BUILD.md) for complete build instructions.

### What the APK offers vs PWA

| Feature | PWA | APK |
|---------|-----|-----|
| Home screen icon | ✅ | ✅ |
| Mobile CSS injection | Via bookmarklet (manual) | Automatic (injected on every page) |
| Session persistence | Wake Lock API | Foreground Service (stronger) |
| Desktop user-agent | Chrome uses its own | Custom UA (ensures full Colab UI) |
| AMOLED theme | In-launcher toggle | Always applied |
| Works offline | App shell only | App shell only (Colab needs internet) |

---

## Architecture

### Why not iframe Colab?

Colab sets `X-Frame-Options: DENY`. It cannot be embedded in any iframe.

### Why Chrome Custom Tab (not WebView)?

The PWA uses `window.open(colabUrl)` which opens Chrome Custom Tab on Android.
This means:
- The user's existing Google account session in Chrome is used
- No separate login required in the wrapper
- Full Chrome feature set (DevTools, extensions, flags)

### Why desktop user-agent in the APK?

Colab detects mobile user-agents and serves a stripped-down UI without:
- Cell toolbar (add code/text below)
- Variable inspector
- TOC panel
- Full keyboard shortcuts

The APK uses a Chrome desktop UA to get the full interface.

### Session persistence reality check

The Colab **kernel** (Python runtime) runs on Google's cloud. It continues execution even when your phone screen is off. What the wake lock protects is the **browser tab** — Android's LMKD may kill Chrome's renderer if RAM is needed. The foreground service in the APK and Wake Lock API in the PWA both raise process priority to reduce this risk.

---

## File Structure

```
Colab-wrapper/
├── package.json              # Express + sharp deps
├── server.js                 # Express server: http://localhost:3000
├── pwa/                      # PWA (served by Express)
│   ├── manifest.json         # Web App Manifest
│   ├── sw.js                 # Service Worker
│   ├── index.html            # App shell
│   ├── offline.html          # Offline fallback
│   ├── styles/
│   │   ├── tokens.css        # Design tokens (A17-tuned)
│   │   ├── main.css          # Launcher UI
│   │   └── animations.css    # 90Hz-safe animations
│   ├── src/
│   │   ├── app.js            # Main app logic
│   │   ├── session.js        # Wake Lock + heartbeat
│   │   ├── bookmarklet.js    # CSS bookmarklet generator
│   │   ├── theme.js          # Dark/AMOLED/light toggle
│   │   └── install-prompt.js # PWA install prompt
│   ├── colab-css/            # CSS injected into Colab
│   │   ├── colab-mobile.css  # Touch targets, layout, editor
│   │   ├── colab-amoled.css  # True-black AMOLED overlay
│   │   └── colab-font.css    # Font scaling for 385 PPI
│   └── icons/
│       ├── source/icon.svg   # Master SVG (run generate-icons.js)
│       └── *.png             # Generated PNG icons
├── scripts/
│   └── generate-icons.js     # Icon generation (requires sharp)
└── android/                  # WebView APK project
    ├── ANDROID_BUILD.md      # Build instructions
    └── app/src/main/java/com/colabwrapper/
        ├── MainActivity.kt
        ├── ColabWebViewClient.kt
        ├── ColabChromeClient.kt
        └── SessionService.kt
```

---

## Troubleshooting

**PWA install prompt doesn't appear**
- Chrome requires: `manifest.json` served with correct MIME type, Service Worker registered, valid icons
- Verify at: Chrome → DevTools → Application → Manifest

**Service Worker not registering**
- `http://localhost` is a secure context — SW should work
- Check: DevTools → Application → Service Workers → check for errors
- Ensure `server.js` sends `Cache-Control: no-cache` for `sw.js`

**Wake Lock fails**
- Wake Lock API requires the page to be visible (not backgrounded)
- It's automatically re-acquired when you return to the app

**Bookmarklet CORS error**
- The server sets `Access-Control-Allow-Origin: https://colab.research.google.com` on `/colab-css/`
- Verify the server is running (`node server.js`)
- The bookmarklet must use the same host the server is actually running on

**Colab loads mobile UI instead of desktop**
- APK only: check `DESKTOP_UA` constant in `MainActivity.kt`
- PWA: Colab in a Chrome Custom Tab uses Chrome's own UA (desktop mode can be toggled in Chrome settings)
