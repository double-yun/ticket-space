package com.ticketing.app

import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        registerPlugin(SecureKeyPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
