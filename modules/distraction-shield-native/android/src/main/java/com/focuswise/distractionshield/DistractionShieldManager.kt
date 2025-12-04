package com.focuswise.distractionshield

import android.content.Context
import android.content.SharedPreferences

/**
 * Singleton manager for distraction shield state
 */
class DistractionShieldManager private constructor(private val context: Context) {
    
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    
    companion object {
        private const val PREFS_NAME = "distraction_shield_prefs"
        private const val KEY_SESSION_ACTIVE = "session_active"
        private const val KEY_BLOCKED_APPS = "blocked_apps"
        private const val KEY_TASK_NAME = "task_name"
        private const val KEY_SESSION_START = "session_start"
        
        @Volatile
        private var instance: DistractionShieldManager? = null
        
        fun getInstance(context: Context): DistractionShieldManager {
            return instance ?: synchronized(this) {
                instance ?: DistractionShieldManager(context.applicationContext).also { instance = it }
            }
        }
    }
    
    fun startSession(blockedApps: List<String>, taskName: String) {
        prefs.edit().apply {
            putBoolean(KEY_SESSION_ACTIVE, true)
            putStringSet(KEY_BLOCKED_APPS, blockedApps.toSet())
            putString(KEY_TASK_NAME, taskName)
            putLong(KEY_SESSION_START, System.currentTimeMillis())
            apply()
        }
    }
    
    fun endSession() {
        prefs.edit().apply {
            putBoolean(KEY_SESSION_ACTIVE, false)
            remove(KEY_TASK_NAME)
            remove(KEY_SESSION_START)
            apply()
        }
    }
    
    fun isSessionActive(): Boolean {
        return prefs.getBoolean(KEY_SESSION_ACTIVE, false)
    }
    
    fun getBlockedApps(): List<String> {
        return prefs.getStringSet(KEY_BLOCKED_APPS, emptySet())?.toList() ?: emptyList()
    }
    
    fun addBlockedApp(packageName: String) {
        val current = getBlockedApps().toMutableSet()
        current.add(packageName)
        prefs.edit().putStringSet(KEY_BLOCKED_APPS, current).apply()
    }
    
    fun removeBlockedApp(packageName: String) {
        val current = getBlockedApps().toMutableSet()
        current.remove(packageName)
        prefs.edit().putStringSet(KEY_BLOCKED_APPS, current).apply()
    }
    
    fun getTaskName(): String {
        return prefs.getString(KEY_TASK_NAME, "your task") ?: "your task"
    }
    
    fun isAppBlocked(packageName: String): Boolean {
        return isSessionActive() && getBlockedApps().contains(packageName)
    }
}

