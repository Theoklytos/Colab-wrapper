# Building the Colab Wrapper Android APK

## Requirements

- **Android Studio** (latest stable) — [download](https://developer.android.com/studio)
- OR **Android SDK + Gradle** on the command line

Java/Kotlin toolchain is bundled with Android Studio.

---

## Quick Build (Android Studio)

1. Open Android Studio → **File → Open** → select the `android/` directory
2. Wait for Gradle sync to complete (first time downloads dependencies)
3. **Build → Build Bundle(s)/APK(s) → Build APK(s)**
4. Find APK at: `android/app/build/outputs/apk/debug/app-debug.apk`

## Install on Samsung A17 (USB)

```bash
# Enable USB Debugging on A17:
# Settings → About Phone → tap Build Number 7 times
# Settings → Developer Options → USB Debugging → ON

adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## Install on Samsung A17 (File Transfer)

1. Copy `app-debug.apk` to your phone (via USB file transfer or cloud storage)
2. On A17: **Settings → Apps → Install Unknown Apps** → allow your file manager
3. Open the APK file and tap **Install**

## Command Line Build (no Android Studio)

```bash
cd android

# First time: let Gradle download itself
chmod +x gradlew

# Build debug APK
./gradlew assembleDebug

# APK location
ls app/build/outputs/apk/debug/app-debug.apk
```

Requires: `ANDROID_HOME` environment variable set to your Android SDK path.

---

## Release Build (signed APK)

For sideloading, debug builds work fine. For Play Store:

```bash
# Generate a signing keystore (one time):
keytool -genkey -v \
  -keystore colab-release.keystore \
  -alias colab \
  -keyalg RSA -keysize 2048 \
  -validity 10000

# Build release APK
./gradlew assembleRelease

# Sign it
jarsigner -verbose \
  -sigalg SHA256withRSA \
  -digestalg SHA-256 \
  -keystore colab-release.keystore \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  colab

# Align it (required for Play Store)
zipalign -v 4 \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  app/build/outputs/apk/release/app-release.apk
```

---

## Samsung Battery Optimization (important!)

Samsung's "Device Care" optimizer can kill even foreground services if the user
hasn't whitelisted the app. After installing:

1. **Settings → Apps → Colab Mobile → Battery**
2. Set to **Unrestricted** (not "Optimized")

This prevents Samsung's proprietary LMKD extension from killing the process.

---

## How CSS Injection Works

`ColabWebViewClient.onPageFinished()` fires after each page load and runs:

```kotlin
webView.evaluateJavascript("""
    (function() {
        var style = document.createElement('style');
        style.id = 'colab-wrapper-mobile-css';
        style.textContent = `...css...`;
        document.head.appendChild(style);
    })();
""".trimIndent(), null)
```

The CSS is inlined in `ColabWebViewClient.kt` so the APK works without
the Node.js server running. Update it there if you modify `colab-mobile.css`.

---

## Architecture Notes

| Component | Description |
|-----------|-------------|
| `MainActivity.kt` | Hosts the WebView, sets desktop user-agent, handles back navigation |
| `ColabWebViewClient.kt` | Injects CSS after page load, keeps OAuth inside WebView |
| `ColabChromeClient.kt` | Handles console messages, media permissions |
| `SessionService.kt` | Foreground service — prevents Android from killing the process |
| `activity_main.xml` | Full-screen WebView, edge-to-edge |

**Why desktop user-agent?**
Colab detects mobile user-agents and serves a severely limited UI — no cell toolbar,
no variable inspector, limited keyboard shortcuts. The desktop UA gets the full interface.
The WebView renders it correctly because it's a modern Chromium engine.
