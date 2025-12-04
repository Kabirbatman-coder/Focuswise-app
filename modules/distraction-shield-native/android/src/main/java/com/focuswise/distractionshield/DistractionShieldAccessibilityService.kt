package com.focuswise.distractionshield

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent

/**
 * Accessibility Service that detects when blocked apps are opened
 * and triggers the blocking overlay
 */
class DistractionShieldAccessibilityService : AccessibilityService() {
    
    companion object {
        private const val TAG = "DistractionShield"
    }
    
    private lateinit var manager: DistractionShieldManager
    private var lastBlockedPackage: String? = null
    private var lastBlockTime: Long = 0
    
    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "Accessibility Service Connected")
        
        manager = DistractionShieldManager.getInstance(this)
        
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                    AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            notificationTimeout = 100
        }
        serviceInfo = info
    }
    
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                val packageName = event.packageName?.toString() ?: return
                
                // Skip system UI and our own app
                if (packageName == "com.android.systemui" ||
                    packageName == this.packageName ||
                    packageName.startsWith("com.android.launcher")) {
                    return
                }
                
                // Check if this app should be blocked
                if (manager.isAppBlocked(packageName)) {
                    // Prevent rapid re-blocking
                    val now = System.currentTimeMillis()
                    if (packageName == lastBlockedPackage && (now - lastBlockTime) < 2000) {
                        return
                    }
                    
                    lastBlockedPackage = packageName
                    lastBlockTime = now
                    
                    Log.d(TAG, "Blocking app: $packageName")
                    showBlockingOverlay(packageName)
                }
            }
        }
    }
    
    private fun showBlockingOverlay(blockedPackage: String) {
        val intent = Intent(this, BlockingOverlayActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("blocked_package", blockedPackage)
            putExtra("task_name", manager.getTaskName())
        }
        startActivity(intent)
    }
    
    override fun onInterrupt() {
        Log.d(TAG, "Accessibility Service Interrupted")
    }
    
    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "Accessibility Service Destroyed")
    }
}

