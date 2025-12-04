package com.focuswise.distractionshield

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class DistractionShieldModule : Module() {
    
    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context is null")
    
    override fun definition() = ModuleDefinition {
        Name("DistractionShield")
        
        // Check if all required permissions are granted
        Function("checkPermissions") {
            val hasUsageStats = hasUsageStatsPermission()
            val hasOverlay = hasOverlayPermission()
            val hasAccessibility = isAccessibilityServiceEnabled()
            
            mapOf(
                "usageStats" to hasUsageStats,
                "overlay" to hasOverlay,
                "accessibility" to hasAccessibility,
                "allGranted" to (hasUsageStats && hasOverlay && hasAccessibility)
            )
        }
        
        // Request Usage Stats permission
        Function("requestUsageStatsPermission") {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
        
        // Request Overlay permission
        Function("requestOverlayPermission") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    android.net.Uri.parse("package:${context.packageName}")
                )
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
            }
        }
        
        // Request Accessibility permission
        Function("requestAccessibilityPermission") {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
        
        // Start focus session with blocked apps
        Function("startFocusSession") { blockedApps: List<String>, taskName: String ->
            DistractionShieldManager.getInstance(context).startSession(blockedApps, taskName)
            true
        }
        
        // End focus session
        Function("endFocusSession") {
            DistractionShieldManager.getInstance(context).endSession()
            true
        }
        
        // Check if session is active
        Function("isSessionActive") {
            DistractionShieldManager.getInstance(context).isSessionActive()
        }
        
        // Get blocked apps list
        Function("getBlockedApps") {
            DistractionShieldManager.getInstance(context).getBlockedApps()
        }
        
        // Add app to blocked list
        Function("addBlockedApp") { packageName: String ->
            DistractionShieldManager.getInstance(context).addBlockedApp(packageName)
            true
        }
        
        // Remove app from blocked list
        Function("removeBlockedApp") { packageName: String ->
            DistractionShieldManager.getInstance(context).removeBlockedApp(packageName)
            true
        }
        
        // Get installed apps (for selection)
        Function("getInstalledApps") {
            getInstalledAppsList()
        }
    }
    
    private fun hasUsageStatsPermission(): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }
    
    private fun hasOverlayPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true
        }
    }
    
    private fun isAccessibilityServiceEnabled(): Boolean {
        val serviceName = "${context.packageName}/${DistractionShieldAccessibilityService::class.java.canonicalName}"
        val enabledServices = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return enabledServices.contains(serviceName)
    }
    
    private fun getInstalledAppsList(): List<Map<String, String>> {
        val pm = context.packageManager
        val apps = mutableListOf<Map<String, String>>()
        
        val intent = Intent(Intent.ACTION_MAIN, null)
        intent.addCategory(Intent.CATEGORY_LAUNCHER)
        
        val resolveInfos = pm.queryIntentActivities(intent, 0)
        
        for (resolveInfo in resolveInfos) {
            val packageName = resolveInfo.activityInfo.packageName
            // Skip our own app
            if (packageName == context.packageName) continue
            
            apps.add(mapOf(
                "packageName" to packageName,
                "appName" to resolveInfo.loadLabel(pm).toString(),
                "icon" to "" // Icons would need base64 encoding, skipping for simplicity
            ))
        }
        
        return apps.sortedBy { it["appName"] }
    }
}

