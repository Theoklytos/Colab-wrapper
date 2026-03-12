package com.colabwrapper

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.WindowManager
import android.webkit.WebView
import android.webkit.WebSettings
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    companion object {
        // Colab start URL
        const val COLAB_URL = "https://colab.research.google.com"

        // Desktop Chrome UA — critical: Colab serves a limited mobile UI with mobile UAs.
        // Using the desktop UA gives the full notebook interface.
        // Update the Chrome version string periodically if needed.
        const val DESKTOP_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Edge-to-edge: let content draw behind system bars (gesture bar, status bar)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // Keep screen on (backup mechanism — Wake Lock API handles it in JS,
        // but FLAG_KEEP_SCREEN_ON works at the activity level too)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        setupWebView()
        webView.loadUrl(COLAB_URL)

        // Start foreground service to prevent Android killing our process
        startSessionService()
    }

    private fun setupWebView() {
        val settings: WebSettings = webView.settings

        // Enable JavaScript — Colab requires it
        settings.javaScriptEnabled = true

        // Storage APIs — Colab uses localStorage and IndexedDB
        settings.domStorageEnabled = true
        settings.databaseEnabled = true

        // Desktop user agent — gets full Colab UI instead of stripped mobile version
        settings.userAgentString = DESKTOP_UA

        // Request desktop site mode (affects viewport and UA together)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.loadWithOverviewMode = true
            settings.useWideViewPort = true
        }

        // Media (audio in Colab outputs, video)
        settings.mediaPlaybackRequiresUserGesture = false

        // File access — needed for some Colab file operations
        settings.allowFileAccess = false  // Disable for security

        // Zoom
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false

        // Cache
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        // Set up the custom WebViewClient (CSS injection + nav handling)
        webView.webViewClient = ColabWebViewClient(this)
        webView.webChromeClient = ColabChromeClient(this)

        // Enable hardware acceleration for smooth scrolling at 90Hz
        webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // Handle back button — navigate WebView history instead of closing app
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        // Resume JS timers (paused when activity is backgrounded)
        webView.resumeTimers()
    }

    override fun onPause() {
        webView.onPause()
        // Pause JS timers to save battery when backgrounded
        // Note: we do NOT call pauseTimers() because that would stop
        // any running Colab cell execution from updating the UI.
        super.onPause()
    }

    override fun onDestroy() {
        // Stop foreground service
        stopSessionService()
        webView.destroy()
        super.onDestroy()
    }

    private fun startSessionService() {
        val intent = Intent(this, SessionService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun stopSessionService() {
        stopService(Intent(this, SessionService::class.java))
    }
}
