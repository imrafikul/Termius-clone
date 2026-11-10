package com.pptpsolution.app

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel
import java.util.ArrayList

class MainActivity : FlutterActivity() {

    companion object {
        const val METHOD_CHANNEL = "com.pptpsolution.app/vpn_control"
        const val EVENT_CHANNEL = "com.pptpsolution.app/vpn_status"
        const val VPN_REQUEST_CODE = 0x24
    }

    private var eventSink: EventChannel.EventSink? = null
    private var pendingConnectArgs: Map<String, Any>? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // MethodChannel for commands
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, METHOD_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "startVpn" -> {
                    val args = call.arguments as? Map<String, Any>
                    if (args == null) {
                        result.error("INVALID_ARGS", "Missing connection parameters", null)
                        return@setMethodCallHandler
                    }
                    startVpnWithPermissionCheck(args, result)
                }
                "stopVpn" -> {
                    val stopIntent = Intent(this, PPTPVpnService::class.java).apply {
                        action = PPTPVpnService.ACTION_DISCONNECT
                    }
                    startService(stopIntent)
                    result.success(true)
                }
                "isVpnRunning" -> {
                    result.success(PPTPVpnService.isServiceRunning())
                }
                else -> {
                    result.notImplemented()
                }
            }
        }

        // EventChannel for real-time status updates
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, EVENT_CHANNEL).setStreamHandler(
            object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    eventSink = events
                    // Wire listener from PPTPVpnService
                    PPTPVpnService.statusListener = { status, details ->
                        runOnUiThread {
                            val payload = HashMap<String, Any>(details)
                            payload["status"] = status
                            eventSink?.success(payload)
                        }
                    }
                }

                override fun onCancel(arguments: Any?) {
                    eventSink = null
                    PPTPVpnService.statusListener = null
                }
            }
        )
    }

    private fun startVpnWithPermissionCheck(args: Map<String, Any>, result: MethodChannel.Result) {
        val prepareIntent = VpnService.prepare(this)
        if (prepareIntent != null) {
            // User consent dialog needed
            pendingConnectArgs = args
            startActivityForResult(prepareIntent, VPN_REQUEST_CODE)
            result.success(false) // Pending user permission dialog
        } else {
            // Already authorized, start service immediately
            launchVpnService(args)
            result.success(true)
        }
    }

    private fun launchVpnService(args: Map<String, Any>) {
        val intent = Intent(this, PPTPVpnService::class.java).apply {
            action = PPTPVpnService.ACTION_CONNECT
            putExtra(PPTPVpnService.EXTRA_HOST, args["host"] as? String ?: "")
            putExtra(PPTPVpnService.EXTRA_PORT, (args["port"] as? Number)?.toInt() ?: 1723)
            putExtra(PPTPVpnService.EXTRA_USERNAME, args["username"] as? String ?: "")
            putExtra(PPTPVpnService.EXTRA_PASSWORD, args["password"] as? String ?: "")
            putExtra(PPTPVpnService.EXTRA_MTU, (args["mtu"] as? Number)?.toInt() ?: 1400)
            putExtra(PPTPVpnService.EXTRA_PROFILE_NAME, args["profileName"] as? String ?: "ISP PPTP")

            val subnetsList = args["targetSubnets"] as? List<*>
            val stringList = ArrayList<String>()
            subnetsList?.forEach { if (it is String) stringList.add(it) }
            putStringArrayListExtra(PPTPVpnService.EXTRA_TARGET_SUBNETS, stringList)
        }

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == VPN_REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK) {
                pendingConnectArgs?.let { args ->
                    launchVpnService(args)
                    pendingConnectArgs = null
                }
            } else {
                runOnUiThread {
                    eventSink?.success(mapOf(
                        "status" to "ERROR",
                        "error" to "VPN permission was declined by the user."
                    ))
                }
            }
        }
    }
}
