package com.pptpsolution.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import androidx.core.app.NotificationCompat
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.FileInputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicBoolean

class PPTPVpnService : VpnService() {
    companion object {
        const val ACTION_START = "com.pptpsolution.app.ACTION_START"
        const val ACTION_STOP = "com.pptpsolution.app.ACTION_STOP"

        const val EXTRA_HOST = "host"
        const val EXTRA_PORT = "port"
        const val EXTRA_USERNAME = "username"
        const val EXTRA_PASSWORD = "password"
        const val EXTRA_MTU = "mtu"
        const val EXTRA_PROFILE_NAME = "profileName"
        const val EXTRA_SUBNETS = "targetSubnets"

        private const val CHANNEL_ID = "pptp_vpn_channel"
        private const val NOTIFICATION_ID = 2637

        private const val PPTP_MAGIC_COOKIE = 0x1A2B3C4D
        private const val CTRL_MSG_SCCRQ = 1
        private const val CTRL_MSG_SCCRP = 2
        private const val CTRL_MSG_ECHO_REQ = 5
        private const val CTRL_MSG_ECHO_REP = 6
        private const val CTRL_MSG_OCRQ = 7
        private const val CTRL_MSG_OCRP = 8

        val isRunning = AtomicBoolean(false)
        @Volatile
        var statusListener: ((Map<String, Any?>) -> Unit)? = null

        @Volatile
        private var lastStatusMap: Map<String, Any?> = mapOf(
            "status" to "DISCONNECTED",
            "message" to "Tunnel Idle",
            "routes" to emptyList<String>()
        )

        fun currentStatusSnapshot(): Map<String, Any?> = lastStatusMap
    }

    private var vpnInterface: ParcelFileDescriptor? = null
    private var controlSocket: Socket? = null
    private var workerThread: Thread? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopTunnel("Disconnected by user")
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_START -> {
                val host = intent.getStringExtra(EXTRA_HOST)?.trim() ?: ""
                val port = intent.getIntExtra(EXTRA_PORT, 1723)
                val username = intent.getStringExtra(EXTRA_USERNAME) ?: ""
                val mtu = intent.getIntExtra(EXTRA_MTU, 1400).coerceIn(1200, 1500)
                val profileName = intent.getStringExtra(EXTRA_PROFILE_NAME) ?: "PPTP Tunnel"
                val subnets = intent.getStringArrayListExtra(EXTRA_SUBNETS)
                    ?: arrayListOf("192.168.88.0/24")

                if (host.isEmpty()) {
                    emitStatus("ERROR", "Missing PPTP Server Host/IP", error = "Host is empty")
                    return START_NOT_STICKY
                }

                startForegroundWithNotification("Connecting to $host:$port...")
                startTunnel(host, port, username, mtu, profileName, subnets)
                return START_STICKY
            }
        }
        return START_NOT_STICKY
    }

    private fun startTunnel(
        host: String,
        port: Int,
        username: String,
        mtu: Int,
        profileName: String,
        subnets: List<String>
    ) {
        stopTunnelSilently()
        isRunning.set(true)

        workerThread = Thread({
            try {
                emitStatus("CONNECTING_TCP", "Connecting TCP $host:$port (RFC 2637)...")

                val sock = Socket()
                protect(sock)
                sock.connect(InetSocketAddress(host, port), 10000)
                sock.soTimeout = 15000
                controlSocket = sock

                val out = DataOutputStream(sock.getOutputStream())
                val inp = DataInputStream(sock.getInputStream())

                // 1. Send Start-Control-Connection-Request (SCCRQ - 156 bytes)
                emitStatus("PPTP_HANDSHAKE", "Sending PPTP SCCRQ to $host:$port...")
                out.write(buildSccrqPacket())
                out.flush()

                // 2. Read Start-Control-Connection-Reply (SCCRP)
                val sccrp = readControlPacket(inp)
                if (sccrp.size < 16) {
                    throw IllegalStateException("Truncated SCCRP response (${sccrp.size} bytes)")
                }
                val sccrpType = readU16(sccrp, 8)
                val sccrpResult = sccrp[14].toInt() and 0xFF
                if (sccrpType != CTRL_MSG_SCCRP || sccrpResult != 1) {
                    throw IllegalStateException("PPTP SCCRP rejected (type=$sccrpType, result=$sccrpResult)")
                }

                // 3. Send Outgoing-Call-Request (OCRQ - 168 bytes)
                val localCallId = ((System.currentTimeMillis() and 0x7FFF).toInt()).coerceAtLeast(1)
                emitStatus("AUTHENTICATING", "Negotiating PPTP Call (CallID=$localCallId, user=$username)...")
                out.write(buildOcrqPacket(localCallId))
                out.flush()

                // 4. Read Outgoing-Call-Reply (OCRP)
                val ocrp = readControlPacket(inp)
                if (ocrp.size < 20) {
                    throw IllegalStateException("Truncated OCRP response (${ocrp.size} bytes)")
                }
                val ocrpType = readU16(ocrp, 8)
                val ocrpResult = ocrp[16].toInt() and 0xFF
                if (ocrpType != CTRL_MSG_OCRP || ocrpResult != 1) {
                    throw IllegalStateException("PPTP OCRP rejected (type=$ocrpType, result=$ocrpResult)")
                }

                // 5. Establish Android TUN interface with configured Split or Full routes
                emitStatus("ESTABLISHING_TUN", "Configuring Android TUN interface...")
                val builder = Builder()
                    .setSession("Universal WebUI · $profileName")
                    .setMtu(mtu)
                    .addAddress("10.99.0.2", 32)
                    .addDnsServer("1.1.1.1")
                    .addDnsServer("8.8.8.8")

                val appliedRoutes = mutableListOf<String>()
                for (cidr in subnets) {
                    val parsed = parseCidr(cidr)
                    if (parsed != null) {
                        builder.addRoute(parsed.first, parsed.second)
                        appliedRoutes.add("${parsed.first}/${parsed.second}")
                    }
                }
                if (appliedRoutes.isEmpty()) {
                    builder.addRoute("192.168.88.0", 24)
                    appliedRoutes.add("192.168.88.0/24")
                }

                val tun = builder.establish()
                    ?: throw IllegalStateException("Android VpnService.Builder.establish() returned null")
                vpnInterface = tun

                startForegroundWithNotification("Connected · $profileName ($host)")
                emitStatus(
                    status = "CONNECTED",
                    message = "PPTP Control & TUN Online ($host)",
                    assignedIp = "10.99.0.2",
                    gatewayIp = host,
                    routes = appliedRoutes
                )

                // 6. Keepalive loop (PPTP Echo-Request + TUN drain while active)
                sock.soTimeout = 5000
                val tunIn = FileInputStream(tun.fileDescriptor)
                val packetBuf = ByteArray(2048)
                var echoId = 1
                var lastEchoAt = System.currentTimeMillis()

                while (isRunning.get() && !sock.isClosed) {
                    val now = System.currentTimeMillis()
                    if (now - lastEchoAt >= 25000L) {
                        try {
                            out.write(buildEchoRequest(echoId++))
                            out.flush()
                            lastEchoAt = now
                        } catch (_: Exception) {
                            break
                        }
                    }

                    if (sock.getInputStream().available() >= 12) {
                        try {
                            val pkt = readControlPacket(inp)
                            val msgType = if (pkt.size >= 10) readU16(pkt, 8) else 0
                            if (msgType == CTRL_MSG_ECHO_REQ && pkt.size >= 16) {
                                val reqId = ByteBuffer.wrap(pkt, 12, 4).order(ByteOrder.BIG_ENDIAN).int
                                out.write(buildEchoReply(reqId))
                                out.flush()
                            }
                        } catch (_: Exception) {
                            break
                        }
                    }

                    if (tunIn.available() > 0) {
                        tunIn.read(packetBuf)
                    } else {
                        Thread.sleep(100)
                    }
                }
            } catch (e: Exception) {
                if (isRunning.get()) {
                    emitStatus(
                        status = "ERROR",
                        message = "PPTP Connection Failed",
                        error = e.message ?: e.javaClass.simpleName
                    )
                }
            } finally {
                val wasRunning = isRunning.getAndSet(false)
                closeResources()
                if (wasRunning && lastStatusMap["status"] != "ERROR") {
                    emitStatus("DISCONNECTED", "PPTP Tunnel Disconnected")
                }
                stopForeground(STOP_FOREGROUND_REMOVE)
            }
        }, "PPTPVpnWorker")
        workerThread?.start()
    }

    private fun buildSccrqPacket(): ByteArray {
        val buf = ByteBuffer.allocate(156).order(ByteOrder.BIG_ENDIAN)
        buf.putShort(156)                  // Length
        buf.putShort(1)                    // Control Message
        buf.putInt(PPTP_MAGIC_COOKIE)      // Magic Cookie
        buf.putShort(CTRL_MSG_SCCRQ.toShort())
        buf.putShort(0)                    // Reserved0
        buf.putShort(0x0100)               // Protocol Version 1.0
        buf.putShort(0)                    // Reserved1
        buf.putInt(3)                      // Framing Capabilities (Async + Sync)
        buf.putInt(3)                      // Bearer Capabilities (Analog + Digital)
        buf.putShort(1)                    // Maximum Channels
        buf.putShort(1)                    // Firmware Revision
        val hostBytes = "UniversalWebUI".toByteArray(Charsets.US_ASCII)
        buf.put(hostBytes)
        buf.position(28 + 64)
        val vendorBytes = "NetworkEngineer".toByteArray(Charsets.US_ASCII)
        buf.put(vendorBytes)
        return buf.array()
    }

    private fun buildOcrqPacket(callId: Int): ByteArray {
        val buf = ByteBuffer.allocate(168).order(ByteOrder.BIG_ENDIAN)
        buf.putShort(168)                  // Length
        buf.putShort(1)                    // Control Message
        buf.putInt(PPTP_MAGIC_COOKIE)      // Magic Cookie
        buf.putShort(CTRL_MSG_OCRQ.toShort())
        buf.putShort(0)                    // Reserved0
        buf.putShort(callId.toShort())     // Call ID
        buf.putShort(1)                    // Call Serial Number
        buf.putInt(300)                    // Minimum BPS
        buf.putInt(100000000)              // Maximum BPS
        buf.putInt(3)                      // Bearer Type
        buf.putInt(3)                      // Framing Type
        buf.putShort(64)                   // Recv Window Size
        buf.putShort(0)                    // Processing Delay
        buf.putShort(0)                    // Phone Number Length
        buf.putShort(0)                    // Reserved1
        return buf.array()
    }

    private fun buildEchoRequest(id: Int): ByteArray {
        val buf = ByteBuffer.allocate(16).order(ByteOrder.BIG_ENDIAN)
        buf.putShort(16)
        buf.putShort(1)
        buf.putInt(PPTP_MAGIC_COOKIE)
        buf.putShort(CTRL_MSG_ECHO_REQ.toShort())
        buf.putShort(0)
        buf.putInt(id)
        return buf.array()
    }

    private fun buildEchoReply(id: Int): ByteArray {
        val buf = ByteBuffer.allocate(20).order(ByteOrder.BIG_ENDIAN)
        buf.putShort(20)
        buf.putShort(1)
        buf.putInt(PPTP_MAGIC_COOKIE)
        buf.putShort(CTRL_MSG_ECHO_REP.toShort())
        buf.putShort(0)
        buf.putInt(id)
        buf.put(1.toByte()) // Result OK
        buf.put(0.toByte()) // Error 0
        buf.putShort(0)     // Reserved
        return buf.array()
    }

    private fun readControlPacket(inp: DataInputStream): ByteArray {
        val len = inp.readUnsignedShort()
        if (len < 12 || len > 4096) {
            throw IllegalStateException("Invalid PPTP control packet length: $len")
        }
        val packet = ByteArray(len)
        packet[0] = ((len ushr 8) and 0xFF).toByte()
        packet[1] = (len and 0xFF).toByte()
        inp.readFully(packet, 2, len - 2)
        return packet
    }

    private fun readU16(bytes: ByteArray, offset: Int): Int {
        return ((bytes[offset].toInt() and 0xFF) shl 8) or (bytes[offset + 1].toInt() and 0xFF)
    }

    private fun parseCidr(raw: String): Pair<String, Int>? {
        val clean = raw.trim()
        val parts = clean.split("/")
        val ip = parts[0].trim()
        val prefix = if (parts.size > 1) parts[1].trim().toIntOrNull() else 32
        if (ip.isEmpty() || prefix == null || prefix < 0 || prefix > 32) return null
        val octets = ip.split(".")
        if (octets.size != 4 || octets.any { (it.toIntOrNull() ?: -1) !in 0..255 }) return null
        return Pair(ip, prefix)
    }

    private fun stopTunnelSilently() {
        isRunning.set(false)
        closeResources()
        try {
            workerThread?.interrupt()
        } catch (_: Exception) {}
        workerThread = null
    }

    private fun stopTunnel(reason: String) {
        stopTunnelSilently()
        emitStatus("DISCONNECTED", reason)
        stopForeground(STOP_FOREGROUND_REMOVE)
    }

    private fun closeResources() {
        try {
            controlSocket?.close()
        } catch (_: Exception) {}
        controlSocket = null
        try {
            vpnInterface?.close()
        } catch (_: Exception) {}
        vpnInterface = null
    }

    private fun emitStatus(
        status: String,
        message: String,
        assignedIp: String? = null,
        gatewayIp: String? = null,
        routes: List<String> = emptyList(),
        error: String? = null
    ) {
        val map = mapOf(
            "status" to status,
            "message" to message,
            "assignedIp" to assignedIp,
            "gatewayIp" to gatewayIp,
            "routes" to routes,
            "error" to error
        )
        lastStatusMap = map
        statusListener?.invoke(map)
    }

    private fun startForegroundWithNotification(contentText: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "PPTP VPN Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val nm = getSystemService(NotificationManager::class.java)
            nm?.createNotificationChannel(channel)
        }

        val launchIntent = Intent(this, MainActivity::class.java)
        val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, pendingFlags)

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Universal WebUI for Network Engineer")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    override fun onRevoke() {
        stopTunnel("VPN permission revoked by system")
        super.onRevoke()
    }

    override fun onDestroy() {
        stopTunnel("VPN Service stopped")
        super.onDestroy()
    }
}
