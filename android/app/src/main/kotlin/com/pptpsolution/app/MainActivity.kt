package com.pptpsolution.app

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    companion object {
        private const val METHOD_CHANNEL = "com.pptpsolution.app/vpn_control"
        private const val EVENT_CHANNEL = "com.pptpsolution.app/vpn_status"
        private const val VPN_PERMISSION_REQUEST_CODE = 10042
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var eventSink: EventChannel.EventSink? = null
    private var pendingStartArgs: Map<String, Any?>? = null
    private var pendingMethodResult: MethodChannel.Result? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        EventChannel(flutterEngine.dartExecutor.binaryMessenger, EVENT_CHANNEL)
            .setStreamHandler(object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    eventSink = events
                    PPTPVpnService.statusListener = { statusMap ->
                        mainHandler.post {
                            eventSink?.success(statusMap)
                        }
                    }
                    // Immediately emit current state on attach
                    mainHandler.post {
                        eventSink?.success(PPTPVpnService.currentStatusSnapshot())
                    }
                }

                override fun onCancel(arguments: Any?) {
                    PPTPVpnService.statusListener = null
                    eventSink = null
                }
            })

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, METHOD_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "startVpn" -> {
                        val args = call.arguments as? Map<String, Any?>
                        if (args == null) {
                            result.error("INVALID_ARGS", "Missing VPN configuration arguments", null)
                            return@setMethodCallHandler
                        }
                        val prepareIntent = VpnService.prepare(this)
                        if (prepareIntent != null) {
                            pendingStartArgs = args
                            pendingMethodResult = result
                            @Suppress("DEPRECATION")
                            startActivityForResult(prepareIntent, VPN_PERMISSION_REQUEST_CODE)
                        } else {
                            launchVpnService(args)
                            result.success(true)
                        }
                    }

                    "stopVpn" -> {
                        val stopIntent = Intent(this, PPTPVpnService::class.java).apply {
                            action = PPTPVpnService.ACTION_STOP
                        }
                        startService(stopIntent)
                        result.success(true)
                    }

                    "isVpnRunning" -> {
                        result.success(PPTPVpnService.isRunning.get())
                    }

                    else -> result.notImplemented()
                }
            }
    }

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == VPN_PERMISSION_REQUEST_CODE) {
            val args = pendingStartArgs
            val res = pendingMethodResult
            pendingStartArgs = null
            pendingMethodResult = null

            if (resultCode == Activity.RESULT_OK && args != null) {
                launchVpnService(args)
                res?.success(true)
            } else {
                res?.error("VPN_DENIED", "User denied Android VPN permission", null)
            }
        }
    }

    private fun launchVpnService(args: Map<String, Any?>) {
        val rawSubnets = (args["targetSubnets"] as? List<*>)
            ?.mapNotNull { it?.toString()?.trim() }
            ?.filter { it.isNotEmpty() }
            ?: listOf("192.168.88.0/24")

        val intent = Intent(this, PPTPVpnService::class.java).apply {
            action = PPTPVpnService.ACTION_START
            putExtra(PPTPVpnService.EXTRA_HOST, args["host"]?.toString() ?: "")
            putExtra(PPTPVpnService.EXTRA_PORT, (args["port"] as? Number)?.toInt() ?: 1723)
            putExtra(PPTPVpnService.EXTRA_USERNAME, args["username"]?.toString() ?: "")
            putExtra(PPTPVpnService.EXTRA_PASSWORD, args["password"]?.toString() ?: "")
            putExtra(PPTPVpnService.EXTRA_MTU, (args["mtu"] as? Number)?.toInt() ?: 1400)
            putExtra(PPTPVpnService.EXTRA_PROFILE_NAME, args["profileName"]?.toString() ?: "PPTP Tunnel")
            putStringArrayListExtra(PPTPVpnService.EXTRA_SUBNETS, ArrayList(rawSubnets))
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }
}
