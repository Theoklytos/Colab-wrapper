package com.colabwrapper

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Foreground service that keeps the app process alive when the user
 * switches to another app (e.g. SMS, browser, camera).
 *
 * Without this service, Android's memory manager (LMKD) can kill
 * the WebView process when RAM is needed, terminating the Colab session.
 *
 * A foreground service shows a persistent notification and protects
 * the process from being killed unless the user explicitly closes the app.
 *
 * Samsung A17 note: Samsung's proprietary "Device Care" optimizer
 * aggressively kills background apps. The foreground service raises
 * our process priority to prevent this.
 *
 * Additional tip for users (shown in README):
 * Settings → Apps → Colab Wrapper → Battery → Unrestricted
 * This prevents Samsung's battery optimizer from killing the process.
 */
class SessionService : Service() {

    companion object {
        const val CHANNEL_ID = "colab_session_channel"
        const val NOTIFICATION_ID = 1001
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        android.util.Log.d("ColabWrapper", "SessionService started — process protected from LMKD")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // START_STICKY: if the OS kills the service, restart it automatically
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        android.util.Log.d("ColabWrapper", "SessionService stopped")
    }

    private fun buildNotification(): Notification {
        // Tap the notification to return to the app
        val returnIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        }
        val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pendingIntent = PendingIntent.getActivity(this, 0, returnIntent, pendingFlags)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_view)  // Replace with custom icon
            .setContentTitle("Colab session active")
            .setContentText("Tap to return to your notebook")
            .setContentIntent(pendingIntent)
            .setOngoing(true)       // Cannot be dismissed by swiping
            .setShowWhen(true)
            .setWhen(System.currentTimeMillis())
            .setPriority(NotificationCompat.PRIORITY_LOW)   // Low priority = small icon, no sound
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Colab Session",
                NotificationManager.IMPORTANCE_LOW  // Low = no sound, no heads-up
            ).apply {
                description = "Shows while a Colab session is active"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}
