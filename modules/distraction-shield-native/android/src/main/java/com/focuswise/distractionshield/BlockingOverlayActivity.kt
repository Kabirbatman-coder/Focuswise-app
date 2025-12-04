package com.focuswise.distractionshield

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import android.os.Build

/**
 * Full-screen blocking overlay shown when user tries to open a blocked app
 */
class BlockingOverlayActivity : Activity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Make it full screen and on top
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )
        
        setContentView(R.layout.blocking_overlay)
        
        val taskName = intent.getStringExtra("task_name") ?: "your task"
        
        // Set up the message
        findViewById<TextView>(R.id.blocking_message)?.text = 
            "You're in a focus session right now.\n\nGet back to: $taskName\n\nThis app is blocked until your session ends."
        
        // Go back button - returns to home screen
        findViewById<Button>(R.id.btn_go_back)?.setOnClickListener {
            goToHome()
        }
        
        // End session button
        findViewById<Button>(R.id.btn_end_session)?.setOnClickListener {
            endFocusSession()
        }
    }
    
    private fun goToHome() {
        val homeIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(homeIntent)
        finish()
    }
    
    private fun endFocusSession() {
        DistractionShieldManager.getInstance(this).endSession()
        goToHome()
    }
    
    override fun onBackPressed() {
        // Override back button to go home instead
        goToHome()
    }
}

