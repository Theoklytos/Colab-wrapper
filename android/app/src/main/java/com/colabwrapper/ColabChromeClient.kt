package com.colabwrapper

import android.content.Context
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView

/**
 * Custom WebChromeClient for Colab.
 * Handles: title updates, console messages (debug), media permissions.
 */
class ColabChromeClient(private val context: Context) : WebChromeClient() {

    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
        // Forward Colab console output to Android logcat for debugging
        val level = consoleMessage?.messageLevel()?.name ?: "LOG"
        val msg = consoleMessage?.message() ?: ""
        val src = consoleMessage?.sourceId()?.substringAfterLast('/') ?: ""
        val line = consoleMessage?.lineNumber() ?: 0
        android.util.Log.d("ColabJS", "[$level] $src:$line — $msg")
        return true
    }

    override fun onPermissionRequest(request: PermissionRequest?) {
        // Colab may request camera/microphone for some ML features.
        // For now we deny all — modify here if you want to allow specific permissions.
        request?.deny()
    }

    override fun onProgressChanged(view: WebView?, newProgress: Int) {
        super.onProgressChanged(view, newProgress)
        // Progress is 0–100. Could update a loading indicator here.
        if (newProgress == 100) {
            android.util.Log.d("ColabWrapper", "Page fully loaded")
        }
    }
}
