package com.kabirkhan_2k.FocusWise.services

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.Button
import android.widget.TextView
import com.kabirkhan_2k.FocusWise.R

/**
 * DistractionShieldService - Accessibility Service for app blocking
 * 
 * This service monitors app launches and blocks access to distracting apps
 * when a focus session is active.
 */
class DistractionShieldService : AccessibilityService() {
    
    companion object {
        var isServiceEnabled = false
        var blockedApps: Set<String> = emptySet()
        var isFocusSessionActive = false
        var currentTaskTitle: String? = null
        var isStrictMode = false
        var shouldVibrate = true
        
        // Update blocked apps list from React Native
        fun updateBlockedApps(apps: List<String>) {
            blockedApps = apps.toSet()
        }
        
        // Start focus session
        fun startFocusSession(taskTitle: String?, strict: Boolean) {
            isFocusSessionActive = true
            currentTaskTitle = taskTitle
            isStrictMode = strict
        }
        
        // End focus session
        fun endFocusSession() {
            isFocusSessionActive = false
            currentTaskTitle = null
        }
    }
    
    private var windowManager: WindowManager? = null
    private var blockingOverlay: View? = null
    private var lastBlockedPackage: String? = null
    
    override fun onServiceConnected() {
        super.onServiceConnected()
        isServiceEnabled = true
        
        // Configure service info
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or 
                        AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                   AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
            notificationTimeout = 100
        }
        serviceInfo = info
        
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    }
    
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (!isFocusSessionActive) return
        
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                val packageName = event.packageName?.toString() ?: return
                
                // Skip our own app
                if (packageName == this.packageName) {
                    dismissBlockingOverlay()
                    return
                }
                
                // Skip system UI
                if (packageName == "com.android.systemui" ||
                    packageName == "com.android.launcher" ||
                    packageName.contains("launcher")) {
                    return
                }
                
                // Check if app should be blocked
                if (blockedApps.contains(packageName) && packageName != lastBlockedPackage) {
                    lastBlockedPackage = packageName
                    showBlockingOverlay(packageName)
                    logDistraction(packageName)
                    
                    if (shouldVibrate) {
                        vibrateDevice()
                    }
                }
            }
        }
    }
    
    override fun onInterrupt() {
        isServiceEnabled = false
    }
    
    override fun onDestroy() {
        super.onDestroy()
        isServiceEnabled = false
        dismissBlockingOverlay()
    }
    
    private fun showBlockingOverlay(blockedPackage: String) {
        if (blockingOverlay != null) return
        
        // Check for overlay permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && 
            !Settings.canDrawOverlays(this)) {
            return
        }
        
        try {
            val inflater = LayoutInflater.from(this)
            blockingOverlay = inflater.inflate(R.layout.blocking_overlay, null)
            
            // Configure overlay message
            blockingOverlay?.findViewById<TextView>(R.id.blocking_title)?.text = 
                "Stay Focused! 🎯"
            blockingOverlay?.findViewById<TextView>(R.id.blocking_message)?.text = 
                if (currentTaskTitle != null) {
                    "You're supposed to be working on:\n\"$currentTaskTitle\"\n\nGo back to your task."
                } else {
                    "You're in a focus session right now.\n\nGo back to your task."
                }
            
            // Configure dismiss button (if not strict mode)
            val dismissButton = blockingOverlay?.findViewById<Button>(R.id.dismiss_button)
            if (isStrictMode) {
                dismissButton?.visibility = View.GONE
            } else {
                dismissButton?.setOnClickListener {
                    dismissBlockingOverlay()
                    // Go back to home
                    val homeIntent = Intent(Intent.ACTION_MAIN).apply {
                        addCategory(Intent.CATEGORY_HOME)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    startActivity(homeIntent)
                }
            }
            
            // Configure window parameters
            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                } else {
                    WindowManager.LayoutParams.TYPE_PHONE
                },
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.CENTER
            }
            
            windowManager?.addView(blockingOverlay, params)
            
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
    
    private fun dismissBlockingOverlay() {
        try {
            blockingOverlay?.let {
                windowManager?.removeView(it)
                blockingOverlay = null
            }
            lastBlockedPackage = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
    
    private fun vibrateDevice() {
        val vibrator = getSystemService(VIBRATOR_SERVICE) as Vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(200, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(200)
        }
    }
    
    private fun logDistraction(packageName: String) {
        // TODO: Send distraction log to React Native via event emitter
        // This can be done using a ReactContext event
    }
}

