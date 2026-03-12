package com.colabwrapper

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Custom WebViewClient for the Colab WebView.
 *
 * Responsibilities:
 *  1. onPageFinished: inject mobile CSS and fix-up JavaScript
 *  2. shouldOverrideUrlLoading: keep Google OAuth flows inside the WebView
 */
class ColabWebViewClient(private val context: Context) : WebViewClient() {

    /**
     * CSS to inject into every Colab page.
     * This is the same CSS as colab-mobile.css + colab-amoled.css combined,
     * inlined here so the APK works offline without the PWA server.
     *
     * For development, you can also fetch from a local server:
     *   fetch('http://10.0.2.2:3000/colab-css/colab-mobile.css')
     *   (10.0.2.2 is the host machine from an Android emulator)
     */
    private val inlineCss = """
        /* Colab Mobile WebView CSS — Samsung Galaxy A17 */
        body, .notebook-container, #notebook {
            min-width: unset !important;
            max-width: 100vw !important;
            overflow-x: hidden !important;
        }
        #top-toolbar, .colab-notebook-toolbar {
            height: 52px !important;
            min-height: 52px !important;
        }
        .cell .inputarea .CodeMirror-gutters,
        .cell .inputarea .cm-gutters { display: none !important; }
        .cm-editor, .CodeMirror {
            font-size: 15px !important;
            line-height: 1.6 !important;
        }
        button:not([style*="width"]),
        [role="button"], [role="tab"], [role="menuitem"] {
            min-height: 44px !important;
            min-width: 44px !important;
        }
        .output, .output-area {
            font-size: 14px !important;
            max-height: 60vh !important;
            overflow-y: auto !important;
        }
        .output img, .output-area img {
            max-width: 100% !important;
            height: auto !important;
        }
        .cell.focused, .cell:focus-within {
            scroll-margin-bottom: 220px !important;
        }
        #notebook, .notebook-container {
            height: 100dvh !important;
            overflow-y: auto !important;
        }
        /* AMOLED true-black */
        body, .cell, .cm-editor, .CodeMirror {
            background: #000000 !important;
        }
        #top-toolbar, .colab-notebook-toolbar {
            background: #000000 !important;
            border-bottom-color: #1a1a1a !important;
        }
        .cm-gutters, .CodeMirror-gutters { background: #000000 !important; }
    """.trimIndent()

    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)

        if (url?.contains("colab.research.google.com") == true ||
            url?.contains("accounts.google.com") == true) {
            injectCss(view)
        }
    }

    private fun injectCss(view: WebView?) {
        if (view == null) return

        // Escape the CSS for JavaScript string injection
        val escapedCss = inlineCss
            .replace("\\", "\\\\")
            .replace("`", "\\`")
            .replace("$", "\\$")

        val script = """
            (function() {
                var STYLE_ID = 'colab-wrapper-mobile-css';
                if (document.getElementById(STYLE_ID)) return;
                var style = document.createElement('style');
                style.id = STYLE_ID;
                style.textContent = `$escapedCss`;
                document.head.appendChild(style);
                console.log('[ColabWrapper] Mobile CSS injected');
            })();
        """.trimIndent()

        view.evaluateJavascript(script, null)
    }

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val url = request?.url ?: return false
        val host = url.host ?: return false

        // Keep all Google auth and Colab URLs inside the WebView
        val allowedHosts = listOf(
            "colab.research.google.com",
            "accounts.google.com",
            "accounts.google.com",
            "oauth2.googleapis.com",
            "drive.google.com",
            "docs.google.com",
            "iam.googleapis.com",
            "www.google.com",
            "myaccount.google.com",
        )

        return if (allowedHosts.any { host.contains(it) }) {
            false // Let WebView handle it (return false = don't override)
        } else {
            // Open external URLs in the system browser
            try {
                val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse(url.toString()))
                context.startActivity(intent)
            } catch (_: Exception) {}
            true // We handled it
        }
    }
}
