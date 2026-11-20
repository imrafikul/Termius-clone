#!/usr/bin/env python3
"""
Real PPTP (RFC 2637: TCP 1723 + Enhanced GRE Protocol 47), L2TPv2 (UDP 1701, RFC 2661),
& MS-SSTP (TCP 443 TLS) VPN Client Daemon with full PPP (LCP + PAP / CHAP-MD5 / MS-CHAPv2 + IPCP)
and Linux /dev/net/tun routing.

Allows direct Ping, Traceroute, Port Scan, and Telnet/SSH to private LAN IPs
behind a MikroTik router using ONLY /ppp secret VPN credentials — NO MikroTik admin login needed!
"""

import fcntl
import hashlib
import hmac
import json
import os
import random
import select
import signal
import socket
import ssl
import struct
import subprocess
import sys
import time
import uuid

# ==============================================================================
# Pure-Python MD4 (RFC 1320) & DES (FIPS 46-3) for MS-CHAPv2 (RFC 2759)
# ==============================================================================

def _lrot32(x: int, n: int) -> int:
    x &= 0xFFFFFFFF
    return ((x << n) | (x >> (32 - n))) & 0xFFFFFFFF


def md4(data: bytes) -> bytes:
    orig_len_bits = (len(data) * 8) & 0xFFFFFFFFFFFFFFFF
    msg = bytearray(data)
    msg.append(0x80)
    while (len(msg) % 64) != 56:
        msg.append(0)
    msg += struct.pack("<Q", orig_len_bits)

    a, b, c, d = 0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476

    for offset in range(0, len(msg), 64):
        X = struct.unpack_from("<16I", msg, offset)
        aa, bb, cc, dd = a, b, c, d

        # Round 1
        s1 = (3, 7, 11, 19)
        for i in range(16):
            f = (b & c) | ((~b & 0xFFFFFFFF) & d)
            a = _lrot32(a + f + X[i], s1[i % 4])
            a, b, c, d = d, a, b, c

        # Round 2
        s2 = (3, 5, 9, 13)
        for i in range(16):
            k = (i % 4) * 4 + (i // 4)
            g = (b & c) | (b & d) | (c & d)
            a = _lrot32(a + g + X[k] + 0x5A827999, s2[i % 4])
            a, b, c, d = d, a, b, c

        # Round 3
        s3 = (3, 9, 11, 15)
        order3 = (0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15)
        for i in range(16):
            h = b ^ c ^ d
            a = _lrot32(a + h + X[order3[i]] + 0x6ED9EBA1, s3[i % 4])
            a, b, c, d = d, a, b, c

        a = (a + aa) & 0xFFFFFFFF
        b = (b + bb) & 0xFFFFFFFF
        c = (c + cc) & 0xFFFFFFFF
        d = (d + dd) & 0xFFFFFFFF

    return struct.pack("<4I", a, b, c, d)


# Standard DES tables
_IP = (
    58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
    62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
    57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
    61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7,
)
_FP = (
    40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31,
    38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
    36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
    34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25,
)
_E = (
    32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9,
    8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
    16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25,
    24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1,
)
_P = (
    16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
    2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25,
)
_PC1 = (
    57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18,
    10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
    63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22,
    14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4,
)
_PC2 = (
    14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10,
    23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
    41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48,
    44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32,
)
_SHIFTS = (1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1)
_SBOX = (
    (14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7,
     0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8,
     4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0,
     15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13),
    (15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10,
     3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5,
     0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15,
     13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9),
    (10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8,
     13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1,
     13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7,
     1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12),
    (7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15,
     13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9,
     10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4,
     3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14),
    (2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9,
     14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6,
     4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14,
     11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3),
    (12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11,
     10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8,
     9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6,
     4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13),
    (4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1,
     13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6,
     1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2,
     6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12),
    (13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7,
     1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2,
     7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8,
     2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11),
)


def _permute(val: int, width: int, table: tuple) -> int:
    out = 0
    for pos in table:
        out = (out << 1) | ((val >> (width - pos)) & 1)
    return out


def _des_key_from_7bytes(k7: bytes) -> int:
    b = list(k7)
    k8 = bytes([
        b[0] & 0xFE,
        ((b[0] << 7) | (b[1] >> 1)) & 0xFE,
        ((b[1] << 6) | (b[2] >> 2)) & 0xFE,
        ((b[2] << 5) | (b[3] >> 3)) & 0xFE,
        ((b[3] << 4) | (b[4] >> 4)) & 0xFE,
        ((b[4] << 3) | (b[5] >> 5)) & 0xFE,
        ((b[5] << 2) | (b[6] >> 6)) & 0xFE,
        (b[6] << 1) & 0xFE,
    ])
    return int.from_bytes(k8, "big")


def des_encrypt_block(key7: bytes, block8: bytes) -> bytes:
    key64 = _des_key_from_7bytes(key7)
    k56 = _permute(key64, 64, _PC1)
    C = (k56 >> 28) & 0x0FFFFFFF
    D = k56 & 0x0FFFFFFF
    subkeys = []
    for sh in _SHIFTS:
        C = ((C << sh) | (C >> (28 - sh))) & 0x0FFFFFFF
        D = ((D << sh) | (D >> (28 - sh))) & 0x0FFFFFFF
        subkeys.append(_permute((C << 28) | D, 56, _PC2))

    data = _permute(int.from_bytes(block8, "big"), 64, _IP)
    L = (data >> 32) & 0xFFFFFFFF
    R = data & 0xFFFFFFFF
    for sk in subkeys:
        er = _permute(R, 32, _E) ^ sk
        s_out = 0
        for i in range(8):
            chunk = (er >> (42 - i * 6)) & 0x3F
            row = ((chunk & 0x20) >> 4) | (chunk & 1)
            col = (chunk >> 1) & 0x0F
            s_out = (s_out << 4) | _SBOX[i][row * 16 + col]
        f_val = _permute(s_out, 32, _P)
        L, R = R, L ^ f_val

    pre = (R << 32) | L
    return _permute(pre, 64, _FP).to_bytes(8, "big")


def mschapv2_generate_response(auth_challenge: bytes, peer_challenge: bytes, username: str, password: str):
    """RFC 2759 MS-CHAPv2 NT-Response + RFC 3079 MPPE/SSTP HLAK."""
    user_bytes = username.encode("utf-8")
    ch_hash = hashlib.sha1(peer_challenge + auth_challenge + user_bytes).digest()[:8]
    nt_hash = md4(password.encode("utf-16-le"))
    z_hash = nt_hash + b"\x00" * 5
    nt_response = (
        des_encrypt_block(z_hash[0:7], ch_hash)
        + des_encrypt_block(z_hash[7:14], ch_hash)
        + des_encrypt_block(z_hash[14:21], ch_hash)
    )

    # RFC 3079 Master Key -> Send/Recv Keys -> 32-byte HLAK for MS-SSTP Crypto Binding
    nt_hash_hash = md4(nt_hash)
    magic1 = b"This is the MPPE Master Key"
    master_key = hashlib.sha1(nt_hash_hash + nt_response + magic1).digest()[:16]

    shs_pad1 = b"\x00" * 40
    shs_pad2 = b"\xf2" * 40
    magic_send = b"On the client side, this is the send key; on the server side, it is the receive key."
    magic_recv = b"On the client side, this is the receive key; on the server side, it is the send key."
    send_key = hashlib.sha1(master_key + shs_pad1 + magic_send + shs_pad2).digest()[:16]
    recv_key = hashlib.sha1(master_key + shs_pad1 + magic_recv + shs_pad2).digest()[:16]
    hlak = send_key + recv_key
    return nt_response, hlak


# ==============================================================================
# JSON IPC Logger
# ==============================================================================

def emit(obj: dict):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def log(component: str, level: str, message: str):
    emit({"event": "LOG", "component": component, "level": level, "message": message})


# ==============================================================================
# Linux TUN Interface Manager (/dev/net/tun + /usr/sbin/ip)
# ==============================================================================

TUNSETIFF = 0x400454CA
IFF_TUN = 0x0001
IFF_NO_PI = 0x1000


class TunDevice:
    def __init__(self, name: str = "vpn0"):
        self.name = name
        self.fd = None
        self.installed_routes = []

    def open_and_configure(self, client_ip: str, gateway_ip: str, subnets: list, mtu: int = 1360):
        self.fd = os.open("/dev/net/tun", os.O_RDWR | os.O_NONBLOCK)
        ifr = struct.pack("16sH", self.name.encode("ascii"), IFF_TUN | IFF_NO_PI)
        fcntl.ioctl(self.fd, TUNSETIFF, ifr)

        subprocess.run(["/usr/sbin/ip", "addr", "flush", "dev", self.name], capture_output=True)
        r1 = subprocess.run(
            ["/usr/sbin/ip", "addr", "add", f"{client_ip}/32", "peer", gateway_ip, "dev", self.name],
            capture_output=True, text=True
        )
        if r1.returncode != 0:
            raise RuntimeError(f"ip addr add failed: {r1.stderr.strip()}")

        r2 = subprocess.run(
            ["/usr/sbin/ip", "link", "set", self.name, "mtu", str(mtu), "up"],
            capture_output=True, text=True
        )
        if r2.returncode != 0:
            raise RuntimeError(f"ip link up failed: {r2.stderr.strip()}")

        # Determine safe kernel routes (NEVER override default or container 169.254.0.0/16!)
        target_cidrs = []
        has_full = any(s.strip() in ("0.0.0.0/0", "all", "full") for s in (subnets or []))
        if has_full or not subnets:
            target_cidrs = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "100.64.0.0/10"]
        else:
            for s in subnets:
                s = s.strip()
                if not s or s.startswith("169.254.") or s.startswith("127."):
                    continue
                if "/" not in s:
                    s = f"{s}/32"
                target_cidrs.append(s)
            # Always make sure gateway's /24 is reachable
            gw_parts = gateway_ip.split(".")
            if len(gw_parts) == 4:
                gw_net = f"{gw_parts[0]}.{gw_parts[1]}.{gw_parts[2]}.0/24"
                if gw_net not in target_cidrs and not gw_net.startswith("169.254."):
                    target_cidrs.append(gw_net)

        self.installed_routes = []
        for cidr in target_cidrs:
            r = subprocess.run(
                ["/usr/sbin/ip", "route", "replace", cidr, "dev", self.name],
                capture_output=True, text=True
            )
            if r.returncode == 0:
                self.installed_routes.append(cidr)
            else:
                log("ROUTE", "WARN", f"Skipped route {cidr}: {r.stderr.strip()}")

        return self.installed_routes

    def read_packet(self):
        if self.fd is None:
            return None
        try:
            return os.read(self.fd, 4096)
        except BlockingIOError:
            return None

    def write_packet(self, pkt: bytes):
        if self.fd is None or not pkt:
            return
        try:
            os.write(self.fd, pkt)
        except OSError:
            pass

    def close(self):
        if self.fd is not None:
            for cidr in self.installed_routes:
                subprocess.run(["/usr/sbin/ip", "route", "del", cidr, "dev", self.name], capture_output=True)
            try:
                os.close(self.fd)
            except OSError:
                pass
            self.fd = None
            self.installed_routes = []


# ==============================================================================
# RFC 1661 PPP State Machine (LCP + PAP / CHAP-MD5 / MS-CHAPv2 + IPCP)
# ==============================================================================

PROTO_IP = 0x0021
PROTO_IPCP = 0x8021
PROTO_CCP = 0x80FD
PROTO_IPV6CP = 0x8057
PROTO_LCP = 0xC021
PROTO_PAP = 0xC023
PROTO_CHAP = 0xC223


class PppEngine:
    def __init__(self, username: str, password: str, send_ppp_cb, on_ipcp_up_cb, on_fatal_cb):
        self.username = username
        self.password = password
        self.send_ppp = send_ppp_cb
        self.on_ipcp_up = on_ipcp_up_cb
        self.on_fatal = on_fatal_cb

        self.local_magic = random.randint(1, 0xFFFFFFFE)
        self.next_id = 1

        self.lcp_local_acked = False
        self.lcp_remote_acked = False
        self.lcp_send_mru = True
        self.lcp_send_magic = True
        self.last_lcp_req_ts = 0.0

        self.auth_proto = None  # None, 'pap', 'chap-md5', 'mschapv2'
        self.auth_started = False
        self.auth_done = False
        self.mschapv2_hlak = b"\x00" * 32

        self.ipcp_started = False
        self.ipcp_local_acked = False
        self.ipcp_remote_acked = False
        self.ipcp_send_dns = True
        self.last_ipcp_req_ts = 0.0

        self.client_ip = "0.0.0.0"
        self.gateway_ip = "0.0.0.0"
        self.dns_ip = "0.0.0.0"
        self.up_notified = False
        self.last_echo_ts = time.time()

    def _id(self) -> int:
        val = self.next_id
        self.next_id = (self.next_id % 254) + 1
        return val

    def _send(self, proto: int, payload: bytes):
        self.send_ppp(b"\xff\x03" + struct.pack("!H", proto) + payload)

    def start(self):
        self._send_lcp_conf_req()

    def tick(self):
        now = time.time()
        if not self.lcp_local_acked and (now - self.last_lcp_req_ts) > 2.0:
            self._send_lcp_conf_req()
        elif self.auth_done and not self.ipcp_local_acked and (now - self.last_ipcp_req_ts) > 2.0:
            self._send_ipcp_conf_req()
        elif self.up_notified and (now - self.last_echo_ts) > 20.0:
            self.last_echo_ts = now
            # LCP Echo-Request
            pkt = struct.pack("!BBHI", 9, self._id(), 8, self.local_magic)
            self._send(PROTO_LCP, pkt)

    def _send_lcp_conf_req(self):
        self.last_lcp_req_ts = time.time()
        opts = b""
        if self.lcp_send_mru:
            opts += struct.pack("!BBH", 1, 4, 1360)
        if self.lcp_send_magic:
            opts += struct.pack("!BBI", 5, 6, self.local_magic)
        pkt = struct.pack("!BBH", 1, self._id(), 4 + len(opts)) + opts
        self._send(PROTO_LCP, pkt)

    def _send_ipcp_conf_req(self):
        self.ipcp_started = True
        self.last_ipcp_req_ts = time.time()
        opts = struct.pack("!BB", 3, 6) + socket.inet_aton(self.client_ip)
        if self.ipcp_send_dns:
            opts += struct.pack("!BB", 129, 6) + socket.inet_aton(self.dns_ip)
        pkt = struct.pack("!BBH", 1, self._id(), 4 + len(opts)) + opts
        self._send(PROTO_IPCP, pkt)

    def _maybe_start_auth_or_ipcp(self):
        if not (self.lcp_local_acked and self.lcp_remote_acked):
            return
        if self.auth_done:
            if not self.ipcp_started:
                self._send_ipcp_conf_req()
            return
        if self.auth_started:
            return
        self.auth_started = True
        if self.auth_proto == "pap":
            log("PPP", "INFO", f"Authenticating via PAP as '{self.username}'...")
            u = self.username.encode("utf-8")
            p = self.password.encode("utf-8")
            body = struct.pack("!B", len(u)) + u + struct.pack("!B", len(p)) + p
            pkt = struct.pack("!BBH", 1, self._id(), 4 + len(body)) + body
            self._send(PROTO_PAP, pkt)
        elif self.auth_proto in ("chap-md5", "mschapv2"):
            log("PPP", "INFO", f"Waiting for MikroTik {self.auth_proto.upper()} challenge...")
        else:
            log("PPP", "INFO", "LCP opened with no auth required, starting IPCP...")
            self.auth_done = True
            self._send_ipcp_conf_req()

    def _maybe_notify_up(self):
        if self.up_notified:
            return
        if self.ipcp_local_acked and self.ipcp_remote_acked and self.client_ip != "0.0.0.0":
            self.up_notified = True
            gw = self.gateway_ip if self.gateway_ip != "0.0.0.0" else self.client_ip
            self.on_ipcp_up(self.client_ip, gw, self.dns_ip, self.mschapv2_hlak)

    def handle_frame(self, frame: bytes, tun: TunDevice):
        if len(frame) < 2:
            return
        idx = 0
        if frame[0] == 0xFF and frame[1] == 0x03:
            idx = 2
        if idx >= len(frame):
            return
        if frame[idx] & 1:
            proto = frame[idx]
            idx += 1
        else:
            if idx + 2 > len(frame):
                return
            proto = struct.unpack_from("!H", frame, idx)[0]
            idx += 2
        payload = frame[idx:]

        if proto == PROTO_IP:
            if self.up_notified and len(payload) >= 20:
                tun.write_packet(payload)
            return
        elif proto == PROTO_LCP:
            self._handle_lcp(payload)
        elif proto == PROTO_PAP:
            self._handle_pap(payload)
        elif proto == PROTO_CHAP:
            self._handle_chap(payload)
        elif proto == PROTO_IPCP:
            self._handle_ipcp(payload)
        elif proto in (PROTO_CCP, PROTO_IPV6CP):
            # Reject CCP (MPPE) and IPv6CP cleanly via LCP Protocol-Reject
            rej = struct.pack("!BBHH", 8, self._id(), 6 + min(len(payload), 64), proto) + payload[:64]
            self._send(PROTO_LCP, rej)

    def _parse_options(self, data: bytes):
        opts = []
        pos = 0
        while pos + 2 <= len(data):
            otype = data[pos]
            olen = data[pos + 1]
            if olen < 2 or pos + olen > len(data):
                break
            opts.append((otype, data[pos : pos + olen]))
            pos += olen
        return opts

    def _handle_lcp(self, data: bytes):
        if len(data) < 4:
            return
        code, ident, length = struct.unpack_from("!BBH", data, 0)
        body = data[4:length]

        if code == 1:  # Configure-Request
            opts = self._parse_options(body)
            rejects = b""
            naks = b""
            for otype, raw in opts:
                if otype == 3 and len(raw) >= 4:  # Auth-Protocol
                    ap = struct.unpack_from("!H", raw, 2)[0]
                    if ap == PROTO_PAP:
                        self.auth_proto = "pap"
                    elif ap == PROTO_CHAP and len(raw) >= 5:
                        alg = raw[4]
                        if alg == 0x05:
                            self.auth_proto = "chap-md5"
                        elif alg == 0x81:
                            self.auth_proto = "mschapv2"
                        else:
                            # Suggest MS-CHAPv2 or CHAP-MD5
                            naks += struct.pack("!BBHB", 3, 5, PROTO_CHAP, 0x81)
                    else:
                        naks += struct.pack("!BBHB", 3, 5, PROTO_CHAP, 0x81)
                elif otype in (1, 2, 5, 7, 8):
                    pass  # Accept MRU, ACCM, Magic, PFC, ACFC
                else:
                    rejects += raw

            if rejects:
                self._send(PROTO_LCP, struct.pack("!BBH", 4, ident, 4 + len(rejects)) + rejects)
            elif naks:
                self._send(PROTO_LCP, struct.pack("!BBH", 3, ident, 4 + len(naks)) + naks)
            else:
                self._send(PROTO_LCP, struct.pack("!BBH", 2, ident, 4 + len(body)) + body)
                self.lcp_remote_acked = True
                self._maybe_start_auth_or_ipcp()

        elif code == 2:  # Configure-Ack
            self.lcp_local_acked = True
            self._maybe_start_auth_or_ipcp()

        elif code == 3:  # Configure-Nak
            self._send_lcp_conf_req()

        elif code == 4:  # Configure-Reject
            for otype, _ in self._parse_options(body):
                if otype == 1:
                    self.lcp_send_mru = False
                elif otype == 5:
                    self.lcp_send_magic = False
            self._send_lcp_conf_req()

        elif code == 5:  # Terminate-Request
            self._send(PROTO_LCP, struct.pack("!BBH", 6, ident, 4))
            self.on_fatal("MikroTik sent LCP Terminate-Request (check PPP secret/profile or encryption=required).")

        elif code == 9:  # Echo-Request
            reply = struct.pack("!BBHI", 10, ident, 8, self.local_magic)
            self._send(PROTO_LCP, reply)

    def _handle_pap(self, data: bytes):
        if len(data) < 4:
            return
        code, ident, length = struct.unpack_from("!BBH", data, 0)
        msg = data[5:length].decode("utf-8", errors="ignore") if length > 5 else ""
        if code == 2:  # Ack
            log("PPP", "INFO", f"PAP Authentication succeeded! {msg}".strip())
            self.auth_done = True
            self._send_ipcp_conf_req()
        elif code == 3:  # Nak
            self.on_fatal(f"PAP Authentication failed on MikroTik: {msg or 'Wrong username or password'}")

    def _handle_chap(self, data: bytes):
        if len(data) < 4:
            return
        code, ident, length = struct.unpack_from("!BBH", data, 0)
        body = data[4:length]

        if code == 1 and len(body) >= 1:  # Challenge
            val_len = body[0]
            challenge = body[1 : 1 + val_len]
            if self.auth_proto == "mschapv2" or val_len == 16 and self.auth_proto != "chap-md5":
                log("PPP", "INFO", f"Answering MikroTik MS-CHAPv2 challenge as '{self.username}'...")
                peer_ch = os.urandom(16)
                nt_resp, hlak = mschapv2_generate_response(challenge, peer_ch, self.username, self.password)
                self.mschapv2_hlak = hlak
                val = peer_ch + (b"\x00" * 8) + nt_resp + b"\x00"
                u = self.username.encode("utf-8")
                resp_body = struct.pack("!B", len(val)) + val + u
                self._send(PROTO_CHAP, struct.pack("!BBH", 2, ident, 4 + len(resp_body)) + resp_body)
            else:
                log("PPP", "INFO", f"Answering MikroTik CHAP-MD5 challenge as '{self.username}'...")
                digest = hashlib.md5(bytes([ident]) + self.password.encode("utf-8") + challenge).digest()
                u = self.username.encode("utf-8")
                resp_body = struct.pack("!B", len(digest)) + digest + u
                self._send(PROTO_CHAP, struct.pack("!BBH", 2, ident, 4 + len(resp_body)) + resp_body)

        elif code == 3:  # Success
            msg = body.decode("utf-8", errors="ignore").strip()
            log("PPP", "INFO", f"CHAP Authentication succeeded! ({msg[:48]})")
            self.auth_done = True
            self._send_ipcp_conf_req()

        elif code == 4:  # Failure
            msg = body.decode("utf-8", errors="ignore").strip()
            self.on_fatal(f"Authentication failed on MikroTik: {msg or 'Wrong PPP username/password'}")

    def _handle_ipcp(self, data: bytes):
        if len(data) < 4:
            return
        code, ident, length = struct.unpack_from("!BBH", data, 0)
        body = data[4:length]

        if code == 1:  # Configure-Request from MikroTik
            opts = self._parse_options(body)
            rejects = b""
            for otype, raw in opts:
                if otype == 3 and len(raw) == 6:
                    self.gateway_ip = socket.inet_ntoa(raw[2:6])
                else:
                    rejects += raw
            if rejects:
                self._send(PROTO_IPCP, struct.pack("!BBH", 4, ident, 4 + len(rejects)) + rejects)
            else:
                self._send(PROTO_IPCP, struct.pack("!BBH", 2, ident, 4 + len(body)) + body)
                self.ipcp_remote_acked = True
                self._maybe_notify_up()

        elif code == 2:  # Configure-Ack
            self.ipcp_local_acked = True
            self._maybe_notify_up()

        elif code == 3:  # Configure-Nak (MikroTik assigns our IP & DNS here!)
            for otype, raw in self._parse_options(body):
                if otype == 3 and len(raw) == 6:
                    self.client_ip = socket.inet_ntoa(raw[2:6])
                elif otype == 129 and len(raw) == 6:
                    self.dns_ip = socket.inet_ntoa(raw[2:6])
            self._send_ipcp_conf_req()

        elif code == 4:  # Configure-Reject
            for otype, _ in self._parse_options(body):
                if otype == 129:
                    self.ipcp_send_dns = False
            self._send_ipcp_conf_req()


# ==============================================================================
# Transport 1: RFC 2661 L2TPv2 over UDP 1701
# ==============================================================================

def _avp(attr_type: int, value: bytes, mandatory: bool = True) -> bytes:
    flags_len = (0x8000 if mandatory else 0) | (6 + len(value))
    return struct.pack("!HHH", flags_len, 0, attr_type) + value


def _parse_avps(data: bytes) -> dict:
    avps = {}
    pos = 0
    while pos + 6 <= len(data):
        flags_len, vendor, atype = struct.unpack_from("!HHH", data, pos)
        alen = flags_len & 0x03FF
        if alen < 6 or pos + alen > len(data):
            break
        if vendor == 0:
            avps[atype] = data[pos + 6 : pos + alen]
        pos += alen
    return avps


class L2tpClient:
    def __init__(self, host: str, port: int, username: str, password: str, subnets: list):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.subnets = subnets
        self.sock = None
        self.tun = TunDevice("vpn0")

        self.local_tid = random.randint(100, 60000)
        self.remote_tid = 0
        self.local_sid = random.randint(100, 60000)
        self.remote_sid = 0
        self.ns = 0
        self.nr = 0
        self.stage = "INIT"  # INIT -> SCCRQ -> ICRQ -> PPP -> UP
        self.running = True
        self.fatal_error = None
        self.bytes_in = 0
        self.bytes_out = 0
        self.packets_in = 0
        self.packets_out = 0
        self.ppp = None

    def _send_ctrl(self, tid: int, sid: int, avps: bytes):
        length = 12 + len(avps)
        hdr = struct.pack("!HHHHHH", 0xC802, length, tid, sid, self.ns & 0xFFFF, self.nr & 0xFFFF)
        self.ns = (self.ns + 1) & 0xFFFF
        self.sock.send(hdr + avps)

    def _send_zlb(self):
        hdr = struct.pack("!HHHHHH", 0xC802, 12, self.remote_tid, 0, self.ns & 0xFFFF, self.nr & 0xFFFF)
        self.sock.send(hdr)

    def send_ppp_data(self, ppp_frame: bytes):
        if self.remote_tid == 0 or self.remote_sid == 0:
            return
        hdr = struct.pack("!HHH", 0x0002, self.remote_tid, self.remote_sid)
        try:
            self.sock.send(hdr + ppp_frame)
            self.bytes_out += len(ppp_frame)
            self.packets_out += 1
        except OSError:
            pass

    def _on_ipcp_up(self, client_ip: str, gateway_ip: str, dns_ip: str, _hlak: bytes):
        try:
            routes = self.tun.open_and_configure(client_ip, gateway_ip, self.subnets, mtu=1360)
            self.stage = "UP"
            log("TUN", "INFO", f"✓ Linux TUN {self.tun.name} UP: {client_ip} <-> {gateway_ip} | Routes: {', '.join(routes)}")
            emit({
                "event": "CONNECTED",
                "protocol": "l2tp",
                "clientIp": client_ip,
                "gatewayIp": gateway_ip,
                "dnsIp": dns_ip,
                "iface": self.tun.name,
                "routes": routes,
            })
        except Exception as exc:
            self._on_fatal(f"Failed to configure Linux TUN interface: {exc}")

    def _on_fatal(self, reason: str):
        self.fatal_error = reason
        self.running = False

    def stop(self):
        self.running = False

    def run(self):
        try:
            ip_addr = socket.gethostbyname(self.host)
        except OSError as exc:
            emit({"event": "ERROR", "message": f"DNS resolution failed for {self.host}: {exc}"})
            return

        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.setblocking(False)
        self.sock.connect((ip_addr, self.port))

        self.ppp = PppEngine(self.username, self.password, self.send_ppp_data, self._on_ipcp_up, self._on_fatal)

        log("CONTROL", "INFO", f"Sending RFC 2661 L2TPv2 SCCRQ to {ip_addr}:{self.port} (UDP)...")
        sccrq_avps = (
            _avp(0, struct.pack("!H", 1))
            + _avp(2, struct.pack("!H", 0x0100))
            + _avp(3, struct.pack("!I", 3))
            + _avp(7, b"UniversalWebUI")
            + _avp(9, struct.pack("!H", self.local_tid))
            + _avp(10, struct.pack("!H", 16))
        )
        self.stage = "SCCRQ"
        self._send_ctrl(0, 0, sccrq_avps)

        start_ts = time.time()
        last_retry = start_ts
        last_stats = start_ts
        retries = 0

        try:
            while self.running:
                rlist = [self.sock]
                if self.tun.fd is not None:
                    rlist.append(self.tun.fd)
                readable, _, _ = select.select(rlist, [], [], 0.25)

                for fd in readable:
                    if fd == self.sock:
                        try:
                            pkt = self.sock.recv(4096)
                        except OSError as exc:
                            self._on_fatal(f"L2TP UDP error (is L2TP Server enabled on MikroTik port {self.port}?): {exc}")
                            break
                        self._handle_udp_packet(pkt)
                    elif self.tun.fd is not None and fd == self.tun.fd:
                        ip_pkt = self.tun.read_packet()
                        if ip_pkt:
                            self.send_ppp_data(b"\xff\x03\x00\x21" + ip_pkt)

                now = time.time()
                if self.stage == "SCCRQ":
                    if (now - last_retry) > 2.0:
                        retries += 1
                        if retries >= 4:
                            self._on_fatal(
                                f"L2TP UDP {self.port} timed out on {self.host}. Enable L2TP on MikroTik: /interface l2tp-server server set enabled=yes use-ipsec=no (and allow UDP {self.port} in firewall)."
                            )
                            break
                        last_retry = now
                        self.ns = 0
                        self._send_ctrl(0, 0, sccrq_avps)
                elif self.stage in ("PPP", "UP"):
                    self.ppp.tick()
                    if self.stage == "PPP" and (now - start_ts) > 20.0:
                        self._on_fatal("PPP handshake timed out after L2TP session established.")
                        break

                if self.stage == "UP" and (now - last_stats) >= 2.0:
                    last_stats = now
                    emit({
                        "event": "STATS",
                        "bytesIn": self.bytes_in,
                        "bytesOut": self.bytes_out,
                        "packetsIn": self.packets_in,
                        "packetsOut": self.packets_out,
                    })
        finally:
            if self.remote_tid and self.sock:
                try:
                    if self.remote_sid:
                        cdn = (
                            _avp(0, struct.pack("!H", 14))
                            + _avp(1, struct.pack("!HH", 1, 0))
                            + _avp(14, struct.pack("!H", self.local_sid))
                        )
                        self._send_ctrl(self.remote_tid, self.remote_sid, cdn)
                    stop_ccn = (
                        _avp(0, struct.pack("!H", 4))
                        + _avp(9, struct.pack("!H", self.local_tid))
                        + _avp(1, struct.pack("!HH", 1, 0))
                    )
                    self._send_ctrl(self.remote_tid, 0, stop_ccn)
                except OSError:
                    pass
            self.tun.close()
            if self.sock:
                try:
                    self.sock.close()
                except OSError:
                    pass
            if self.fatal_error:
                emit({"event": "ERROR", "message": self.fatal_error})
            else:
                emit({"event": "DISCONNECTED", "message": "L2TP tunnel disconnected cleanly."})

    def _handle_udp_packet(self, pkt: bytes):
        if len(pkt) < 6:
            return
        flags = struct.unpack_from("!H", pkt, 0)[0]
        is_ctrl = bool(flags & 0x8000)

        if not is_ctrl:
            # L2TP Data Packet -> unwrap header & forward to PPP engine
            pos = 2
            if flags & 0x4000:  # Length present
                pos += 2
            pos += 4  # Tunnel ID + Session ID
            if flags & 0x0800:  # Sequence present
                pos += 4
            if flags & 0x0200:  # Offset present
                if pos + 2 > len(pkt):
                    return
                off_sz = struct.unpack_from("!H", pkt, pos)[0]
                pos += 2 + off_sz
            if pos < len(pkt):
                ppp_frame = pkt[pos:]
                self.bytes_in += len(ppp_frame)
                self.packets_in += 1
                self.ppp.handle_frame(ppp_frame, self.tun)
            return

        # L2TP Control Packet
        if len(pkt) < 12:
            return
        _flags, length, _tid, _sid, ns, _nr = struct.unpack_from("!HHHHHH", pkt, 0)
        if length <= 12:
            return  # ZLB ACK

        if ns == self.nr:
            self.nr = (self.nr + 1) & 0xFFFF

        avps = _parse_avps(pkt[12:length])
        mtype_raw = avps.get(0)
        if not mtype_raw or len(mtype_raw) < 2:
            self._send_zlb()
            return
        mtype = struct.unpack_from("!H", mtype_raw, 0)[0]

        if mtype == 2 and self.stage == "SCCRQ":  # SCCRP
            if 9 in avps and len(avps[9]) >= 2:
                self.remote_tid = struct.unpack_from("!H", avps[9], 0)[0]
            host_name = avps.get(7, b"").decode("utf-8", errors="ignore").strip("\x00")
            log("CONTROL", "INFO", f"✓ Received L2TP SCCRP from '{host_name or self.host}' (TID={self.remote_tid})")
            self._send_ctrl(self.remote_tid, 0, _avp(0, struct.pack("!H", 3)))  # SCCCN
            icrq = (
                _avp(0, struct.pack("!H", 10))
                + _avp(14, struct.pack("!H", self.local_sid))
                + _avp(15, struct.pack("!I", 1))
            )
            self.stage = "ICRQ"
            self._send_ctrl(self.remote_tid, 0, icrq)

        elif mtype == 11 and self.stage == "ICRQ":  # ICRP
            if 14 in avps and len(avps[14]) >= 2:
                self.remote_sid = struct.unpack_from("!H", avps[14], 0)[0]
            log("CONTROL", "INFO", f"✓ L2TP Session established (SID={self.remote_sid}), starting PPP...")
            iccn = (
                _avp(0, struct.pack("!H", 12))
                + _avp(24, struct.pack("!I", 100000000))
                + _avp(19, struct.pack("!I", 1))
            )
            self._send_ctrl(self.remote_tid, self.remote_sid, iccn)
            self.stage = "PPP"
            self.ppp.start()

        elif mtype == 6:  # HELLO keepalive
            self._send_zlb()

        elif mtype in (4, 14):  # StopCCN or CDN
            self._send_zlb()
            res_msg = ""
            if 1 in avps and len(avps[1]) >= 2:
                rcode = struct.unpack_from("!H", avps[1], 0)[0]
                res_msg = f" (code {rcode}: {avps[1][4:].decode('utf-8', errors='ignore').strip()})"
            self._on_fatal(f"MikroTik closed L2TP session{res_msg}")

        else:
            self._send_zlb()


# ==============================================================================
# Transport 2: Microsoft MS-SSTP over TCP 443 TLS
# ==============================================================================

class SstpClient:
    def __init__(self, host: str, port: int, username: str, password: str, subnets: list):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.subnets = subnets
        self.sock = None
        self.tun = TunDevice("vpn0")

        self.rx_buf = bytearray()
        self.server_nonce = b"\x00" * 32
        self.cert_hash = b"\x00" * 32
        self.stage = "INIT"
        self.running = True
        self.fatal_error = None
        self.bytes_in = 0
        self.bytes_out = 0
        self.packets_in = 0
        self.packets_out = 0
        self.ppp = None

    def _send_all(self, data: bytes):
        view = memoryview(data)
        sent = 0
        while sent < len(data):
            try:
                n = self.sock.send(view[sent:])
                if n <= 0:
                    raise OSError("SSTP socket closed")
                sent += n
            except ssl.SSLWantWriteError:
                select.select([], [self.sock], [], 1.0)
            except ssl.SSLWantReadError:
                select.select([self.sock], [], [], 1.0)

    def send_ppp_data(self, ppp_frame: bytes):
        total = 4 + len(ppp_frame)
        hdr = struct.pack("!BBH", 0x10, 0x00, total)
        try:
            self._send_all(hdr + ppp_frame)
            self.bytes_out += len(ppp_frame)
            self.packets_out += 1
        except OSError:
            pass

    def _send_sstp_call_connected(self, hlak: bytes):
        # MS-SSTP CALL_CONNECTED (0x0004) with Crypto Binding (attr 0x0003, 104 bytes)
        attr_body_zero = (
            b"\x00\x00\x00"  # Reserved
            + b"\x02"  # Hash Protocol: SHA-256
            + self.server_nonce
            + self.cert_hash
            + (b"\x00" * 32)  # Zeroed MAC for calculation
        )
        attr_zero = struct.pack("!BBH", 0x00, 0x03, 4 + len(attr_body_zero)) + attr_body_zero
        msg_zero = struct.pack("!BBHHH", 0x10, 0x01, 8 + len(attr_zero), 0x0004, 1) + attr_zero

        if hlak != (b"\x00" * 32):
            cmk_seed = b"SSTP inner method derived CMK" + struct.pack("<HB", 32, 1)
            cmk = hmac.new(hlak, cmk_seed, hashlib.sha256).digest()
            mac = hmac.new(cmk, msg_zero, hashlib.sha256).digest()
        else:
            mac = b"\x00" * 32

        final_msg = msg_zero[:-32] + mac
        self._send_all(final_msg)

    def _on_ipcp_up(self, client_ip: str, gateway_ip: str, dns_ip: str, hlak: bytes):
        try:
            self._send_sstp_call_connected(hlak)
            routes = self.tun.open_and_configure(client_ip, gateway_ip, self.subnets, mtu=1360)
            self.stage = "UP"
            log("TUN", "INFO", f"✓ Linux TUN {self.tun.name} UP via SSTP TLS: {client_ip} <-> {gateway_ip} | Routes: {', '.join(routes)}")
            emit({
                "event": "CONNECTED",
                "protocol": "sstp",
                "clientIp": client_ip,
                "gatewayIp": gateway_ip,
                "dnsIp": dns_ip,
                "iface": self.tun.name,
                "routes": routes,
            })
        except Exception as exc:
            self._on_fatal(f"Failed to finalize SSTP tunnel: {exc}")

    def _on_fatal(self, reason: str):
        self.fatal_error = reason
        self.running = False

    def stop(self):
        self.running = False

    def run(self):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        try:
            log("CONTROL", "INFO", f"Connecting TLS to MikroTik SSTP Server {self.host}:{self.port}...")
            raw = socket.create_connection((self.host, self.port), timeout=8.0)
            self.sock = ctx.wrap_socket(raw, server_hostname=self.host)
            der = self.sock.getpeercert(binary_form=True)
            if der:
                self.cert_hash = hashlib.sha256(der).digest()
        except Exception as exc:
            emit({
                "event": "ERROR",
                "message": f"SSTP TLS connection failed on {self.host}:{self.port}: {exc}. Enable SSTP on MikroTik (/interface sstp-server server set enabled=yes).",
            })
            return

        try:
            corr_id = str(uuid.uuid4()).upper()
            req = (
                f"SSTP_DUPLEX_POST /sra_{{BA195980-CD49-458b-9E23-C84EE0ADCD75}}/ HTTP/1.1\r\n"
                f"Host: {self.host}\r\n"
                f"SSTPCORRELATIONID: {{{corr_id}}}\r\n"
                f"Content-Length: 18446744073709551615\r\n\r\n"
            ).encode("ascii")
            self.sock.sendall(req)

            http_resp = b""
            self.sock.settimeout(8.0)
            while b"\r\n\r\n" not in http_resp and len(http_resp) < 4096:
                chunk = self.sock.recv(1024)
                if not chunk:
                    raise RuntimeError("SSTP server closed connection during HTTP handshake.")
                http_resp += chunk
            header_part, leftover = http_resp.split(b"\r\n\r\n", 1)
            status_line = header_part.split(b"\r\n", 1)[0].decode("ascii", errors="ignore")
            if "200" not in status_line:
                raise RuntimeError(f"SSTP HTTP rejected: {status_line}")
            self.rx_buf.extend(leftover)
            log("CONTROL", "INFO", f"✓ SSTP TLS Duplex established ({status_line}), requesting PPP call...")

            # Send SSTP_MSG_CALL_CONNECT_REQUEST (14 bytes)
            conn_req = struct.pack("!BBHHHBBHH", 0x10, 0x01, 14, 0x0001, 1, 0x00, 0x01, 6, 0x0001)
            self.sock.sendall(conn_req)
            self.sock.setblocking(False)

            self.ppp = PppEngine(self.username, self.password, self.send_ppp_data, self._on_ipcp_up, self._on_fatal)
            self.stage = "WAIT_ACK"
            start_ts = time.time()
            last_stats = start_ts

            while self.running:
                self._drain_sstp_frames()
                rlist = [self.sock]
                if self.tun.fd is not None:
                    rlist.append(self.tun.fd)
                readable, _, _ = select.select(rlist, [], [], 0.2)

                for fd in readable:
                    if fd == self.sock:
                        while True:
                            try:
                                chunk = self.sock.recv(4096)
                                if not chunk:
                                    self._on_fatal("MikroTik closed SSTP TLS stream.")
                                    break
                                self.rx_buf.extend(chunk)
                            except (ssl.SSLWantReadError, BlockingIOError):
                                break
                            except OSError as exc:
                                self._on_fatal(f"SSTP read error: {exc}")
                                break
                        self._drain_sstp_frames()
                    elif self.tun.fd is not None and fd == self.tun.fd:
                        ip_pkt = self.tun.read_packet()
                        if ip_pkt:
                            self.send_ppp_data(b"\xff\x03\x00\x21" + ip_pkt)

                now = time.time()
                if self.stage in ("PPP", "UP"):
                    self.ppp.tick()
                if self.stage != "UP" and (now - start_ts) > 20.0:
                    self._on_fatal("SSTP PPP handshake timed out.")
                    break
                if self.stage == "UP" and (now - last_stats) >= 2.0:
                    last_stats = now
                    emit({
                        "event": "STATS",
                        "bytesIn": self.bytes_in,
                        "bytesOut": self.bytes_out,
                        "packetsIn": self.packets_in,
                        "packetsOut": self.packets_out,
                    })
        except Exception as exc:
            self.fatal_error = str(exc)
        finally:
            try:
                if self.sock:
                    disc = struct.pack("!BBHHH", 0x10, 0x01, 8, 0x0005, 0)
                    self._send_all(disc)
            except Exception:
                pass
            self.tun.close()
            if self.sock:
                try:
                    self.sock.close()
                except OSError:
                    pass
            if self.fatal_error:
                emit({"event": "ERROR", "message": self.fatal_error})
            else:
                emit({"event": "DISCONNECTED", "message": "SSTP tunnel disconnected cleanly."})

    def _drain_sstp_frames(self):
        while len(self.rx_buf) >= 4:
            ver, flags, pkt_len = struct.unpack_from("!BBH", self.rx_buf, 0)
            pkt_len &= 0x0FFF
            if pkt_len < 4:
                self.rx_buf.clear()
                return
            if len(self.rx_buf) < pkt_len:
                return
            pkt = bytes(self.rx_buf[:pkt_len])
            del self.rx_buf[:pkt_len]

            if flags & 0x01:  # Control packet
                if len(pkt) < 8:
                    continue
                mtype, _nattr = struct.unpack_from("!HH", pkt, 4)
                if mtype == 0x0002:  # CALL_CONNECT_ACK
                    # Extract 32-byte server nonce from Crypto Binding Request attr (0x0004)
                    if len(pkt) >= 48:
                        self.server_nonce = pkt[16:48]
                    log("CONTROL", "INFO", "✓ SSTP Call Connect ACK received, starting PPP...")
                    self.stage = "PPP"
                    self.ppp.start()
                elif mtype == 0x0005:  # CALL_DISCONNECT
                    try:
                        self._send_all(struct.pack("!BBHHH", 0x10, 0x01, 8, 0x0006, 0))
                    except OSError:
                        pass
                    self._on_fatal("MikroTik sent SSTP CALL_DISCONNECT.")
                elif mtype == 0x0008:  # ECHO_REQUEST
                    try:
                        self._send_all(struct.pack("!BBHHH", 0x10, 0x01, 8, 0x0009, 0))
                    except OSError:
                        pass
            else:  # Data packet -> PPP
                ppp_frame = pkt[4:]
                self.bytes_in += len(ppp_frame)
                self.packets_in += 1
                self.ppp.handle_frame(ppp_frame, self.tun)


# ==============================================================================
# RFC 2637 PPTP Client (TCP 1723 Control Plane + Enhanced GRE IP Protocol 47)
# ==============================================================================

PPTP_MAGIC = 0x1A2B3C4D
PPTP_SCCRQ = 1
PPTP_SCCRP = 2
PPTP_STOP_CCRQ = 3
PPTP_STOP_CCRP = 4
PPTP_ECHO_REQ = 5
PPTP_ECHO_REP = 6
PPTP_OCRQ = 7
PPTP_OCRP = 8
PPTP_CCR = 12
PPTP_CDN = 13
PPTP_SLI = 15


def _ip_checksum(data: bytes) -> int:
    if len(data) % 2 == 1:
        data += b"\x00"
    total = 0
    for i in range(0, len(data), 2):
        total += (data[i] << 8) + data[i + 1]
    while total >> 16:
        total = (total & 0xFFFF) + (total >> 16)
    return (~total) & 0xFFFF


def _find_iface_for_ip(local_ip: str) -> str:
    for ip_bin in ("/usr/sbin/ip", "/sbin/ip", "ip"):
        try:
            out = subprocess.check_output([ip_bin, "-o", "-4", "addr", "show"], text=True, stderr=subprocess.DEVNULL)
            for line in out.splitlines():
                parts = line.split()
                if len(parts) >= 4 and parts[3].startswith(local_ip + "/"):
                    return parts[1]
            # Fallback to first non-loopback interface
            for line in out.splitlines():
                parts = line.split()
                if len(parts) >= 2 and parts[1] != "lo" and not parts[1].startswith("vpn"):
                    return parts[1]
            break
        except Exception:
            continue
    return "eth1"


def build_pptp_sccrq() -> bytes:
    hostname = b"UniversalWebUI".ljust(64, b"\x00")
    vendor = b"UniversalNetworkEngineer".ljust(64, b"\x00")
    return (
        struct.pack(
            "!HHIHHHHIIHH",
            156,           # Length
            1,             # PPTP Message Type (Control)
            PPTP_MAGIC,    # Magic Cookie
            PPTP_SCCRQ,    # Control Message Type
            0,             # Reserved0
            0x0100,        # Protocol Version 1.0
            0,             # Reserved1
            3,             # Framing Capabilities (Async + Sync)
            3,             # Bearer Capabilities (Analog + Digital)
            0,             # Maximum Channels
            1,             # Firmware Revision
        )
        + hostname
        + vendor
    )


def build_pptp_ocrq(local_call_id: int, call_serial: int) -> bytes:
    return (
        struct.pack(
            "!HHIHHHHIIIIHHHH",
            168,             # Length
            1,               # Control Message
            PPTP_MAGIC,      # Magic Cookie
            PPTP_OCRQ,       # Outgoing-Call-Request
            0,               # Reserved0
            local_call_id,   # Call ID
            call_serial,     # Call Serial Number
            300,             # Minimum BPS
            100000000,       # Maximum BPS
            3,               # Bearer Type (Any)
            3,               # Framing Type (Any)
            64,              # Packet Recv Window Size
            0,               # Packet Processing Delay
            0,               # Phone Number Length
            0,               # Reserved1
        )
        + (b"\x00" * 64)     # Phone Number
        + (b"\x00" * 64)     # Subaddress
    )


def build_enhanced_gre(
    peer_call_id: int,
    ppp_payload: bytes,
    tx_seq,
    ack_num,
) -> bytes:
    flags = 0x2001  # K=1, Ver=1 (RFC 2637 Enhanced GRE)
    if tx_seq is not None:
        flags |= 0x1000  # S=1
    if ack_num is not None:
        flags |= 0x0080  # A=1
    parts = [struct.pack("!HHHH", flags, 0x880B, len(ppp_payload), peer_call_id)]
    if tx_seq is not None:
        parts.append(struct.pack("!I", tx_seq & 0xFFFFFFFF))
    if ack_num is not None:
        parts.append(struct.pack("!I", ack_num & 0xFFFFFFFF))
    if ppp_payload:
        parts.append(ppp_payload)
    return b"".join(parts)


def build_ipv4_gre_packet(src_ip: str, dst_ip: str, ip_id: int, gre_payload: bytes) -> bytes:
    total_len = 20 + len(gre_payload)
    src_b = socket.inet_aton(src_ip)
    dst_b = socket.inet_aton(dst_ip)
    hdr_no_cksum = struct.pack(
        "!BBHHHBBH4s4s",
        0x45,
        0,
        total_len,
        ip_id & 0xFFFF,
        0,
        64,
        47,  # IP Protocol 47 = GRE
        0,
        src_b,
        dst_b,
    )
    cksum = _ip_checksum(hdr_no_cksum)
    hdr = struct.pack(
        "!BBHHHBBH4s4s",
        0x45,
        0,
        total_len,
        ip_id & 0xFFFF,
        0,
        64,
        47,
        cksum,
        src_b,
        dst_b,
    )
    return hdr + gre_payload


def parse_ipv4_gre_packet(raw_ipv4: bytes, expected_src_bytes: bytes, expected_call_id: int):
    """Returns (seq_or_None, ack_or_None, ppp_payload_bytes) or None if not matching our PPTP call."""
    if len(raw_ipv4) < 28:
        return None
    if (raw_ipv4[0] >> 4) != 4:
        return None
    ihl = (raw_ipv4[0] & 0x0F) * 4
    if ihl < 20 or len(raw_ipv4) < ihl + 8:
        return None
    if raw_ipv4[9] != 47:  # Must be IP Protocol 47 (GRE)
        return None
    if raw_ipv4[12:16] != expected_src_bytes:
        return None

    gre = raw_ipv4[ihl:]
    flags_ver, proto_type, payload_len, call_id = struct.unpack_from("!HHHH", gre, 0)
    if proto_type != 0x880B or (flags_ver & 0x0007) != 1:
        return None
    if call_id != expected_call_id:
        return None

    off = 8
    seq = None
    ack = None
    if flags_ver & 0x1000:  # S bit
        if off + 4 > len(gre):
            return None
        seq = struct.unpack_from("!I", gre, off)[0]
        off += 4
    if flags_ver & 0x0080:  # A bit
        if off + 4 > len(gre):
            return None
        ack = struct.unpack_from("!I", gre, off)[0]
        off += 4

    if payload_len == 0:
        return (seq, ack, b"")
    if off + payload_len > len(gre):
        # Some implementations pad or clamp IP total length; take available slice if valid
        payload = gre[off:]
    else:
        payload = gre[off : off + payload_len]
    return (seq, ack, payload)


class PptpClient:
    def __init__(self, host: str, port: int, username: str, password: str, subnets):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.subnets = subnets

        self.local_call_id = random.randint(1000, 60000)
        self.call_serial = random.randint(1, 65000)
        self.peer_call_id = 0
        self.tx_seq = 0
        self.last_rx_seq = None
        self.gre_ack_needed = False
        self.ip_id = random.randint(1, 60000)

        self.server_ip = ""
        self.server_ip_bytes = b""
        self.local_ip = ""
        self.egress_iface = "eth1"

        self.tcp_sock = None
        self.raw_tx = None
        self.gre_rx = None
        self.rx_tcp_buf = bytearray()

        self.tun = TunDevice("vpn0")
        self.ppp = None
        self.running = True
        self.stage = "INIT"
        self.fatal_error = None

        self.gre_rx_packets = 0
        self.gre_tx_packets = 0
        self.bytes_in = 0
        self.bytes_out = 0
        self.packets_in = 0
        self.packets_out = 0

    def _on_fatal(self, reason: str):
        self.fatal_error = reason
        self.running = False

    def stop(self):
        self.running = False

    def _send_tcp_all(self, data: bytes):
        if not self.tcp_sock:
            return
        mv = memoryview(data)
        sent = 0
        while sent < len(data):
            try:
                n = self.tcp_sock.send(mv[sent:])
                if n <= 0:
                    raise OSError("PPTP TCP control socket closed")
                sent += n
            except BlockingIOError:
                select.select([], [self.tcp_sock], [], 0.2)

    def _send_gre(self, ppp_payload: bytes, include_seq: bool = True):
        if not self.raw_tx or not self.peer_call_id:
            return
        seq_val = None
        if include_seq:
            seq_val = self.tx_seq
            self.tx_seq = (self.tx_seq + 1) & 0xFFFFFFFF
        ack_val = None
        if self.gre_ack_needed and self.last_rx_seq is not None:
            ack_val = self.last_rx_seq
            self.gre_ack_needed = False
        gre = build_enhanced_gre(self.peer_call_id, ppp_payload, seq_val, ack_val)
        self.ip_id = (self.ip_id + 1) & 0xFFFF
        ipv4 = build_ipv4_gre_packet(self.local_ip, self.server_ip, self.ip_id, gre)
        try:
            self.raw_tx.sendto(ipv4, (self.server_ip, 0))
            self.gre_tx_packets += 1
            if ppp_payload:
                self.bytes_out += len(ppp_payload)
                self.packets_out += 1
        except OSError as exc:
            log("GRE", "WARN", f"GRE send warning: {exc}")

    def send_ppp_data(self, ppp_frame: bytes):
        self._send_gre(ppp_frame, include_seq=True)

    def _on_ipcp_up(self, client_ip: str, gateway_ip: str, dns_ip: str, _hlak: bytes):
        try:
            routes = self.tun.open_and_configure(client_ip, gateway_ip, self.subnets, mtu=1360)
            self.stage = "UP"
            log("TUN", "INFO", f"✓ REAL PPTP TUN {self.tun.name} UP: {client_ip} <-> {gateway_ip} | Routes: {', '.join(routes)}")
            emit({
                "event": "CONNECTED",
                "protocol": "pptp",
                "clientIp": client_ip,
                "gatewayIp": gateway_ip,
                "dnsIp": dns_ip,
                "iface": self.tun.name,
                "routes": routes,
            })
        except Exception as exc:
            self._on_fatal(f"Failed to configure Linux TUN interface: {exc}")

    def _open_gre_sockets(self):
        # TX socket: raw IPv4 with custom IP header (proto=47). Works on both Linux and gVisor.
        self.raw_tx = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_RAW)
        self.raw_tx.setsockopt(socket.IPPROTO_IP, socket.IP_HDRINCL, 1)
        self.raw_tx.setblocking(False)

        # RX socket: prefer native SOCK_RAW(47) on standard Linux; fallback to AF_PACKET on gVisor
        try:
            rx = socket.socket(socket.AF_INET, socket.SOCK_RAW, 47)
            rx.setblocking(False)
            self.gre_rx = rx
            log("GRE", "INFO", "Opened native Linux raw IP Protocol 47 (GRE) receiver socket.")
        except OSError:
            self.egress_iface = _find_iface_for_ip(self.local_ip)
            rx = socket.socket(socket.AF_PACKET, socket.SOCK_DGRAM, socket.htons(0x0800))
            rx.bind((self.egress_iface, 0))
            rx.setblocking(False)
            self.gre_rx = rx
            log("GRE", "INFO", f"Opened raw AF_PACKET IPv4/GRE (Protocol 47) receiver on {self.egress_iface} ({self.local_ip}).")

    def _read_exact_tcp_ctrl(self, timeout: float = 6.0) -> bytes:
        deadline = time.time() + timeout
        buf = bytearray()
        while len(buf) < 2:
            rem = deadline - time.time()
            if rem <= 0:
                raise TimeoutError("Timed out waiting for PPTP control response on TCP 1723.")
            self.tcp_sock.settimeout(rem)
            chunk = self.tcp_sock.recv(2 - len(buf))
            if not chunk:
                raise ConnectionError("MikroTik closed PPTP TCP 1723 control connection.")
            buf.extend(chunk)
        msg_len = struct.unpack_from("!H", buf, 0)[0]
        if msg_len < 12 or msg_len > 1024:
            raise ValueError(f"Invalid PPTP control message length: {msg_len}")
        while len(buf) < msg_len:
            rem = deadline - time.time()
            if rem <= 0:
                raise TimeoutError("Timed out reading PPTP control packet body.")
            self.tcp_sock.settimeout(rem)
            chunk = self.tcp_sock.recv(msg_len - len(buf))
            if not chunk:
                raise ConnectionError("MikroTik closed PPTP TCP 1723 while sending control packet.")
            buf.extend(chunk)
        return bytes(buf)

    def _drain_tcp_control(self):
        while len(self.rx_tcp_buf) >= 2:
            msg_len = struct.unpack_from("!H", self.rx_tcp_buf, 0)[0]
            if msg_len < 12 or msg_len > 1024:
                self.rx_tcp_buf.clear()
                return
            if len(self.rx_tcp_buf) < msg_len:
                return
            msg = bytes(self.rx_tcp_buf[:msg_len])
            del self.rx_tcp_buf[:msg_len]

            _, _, magic, ctrl_type = struct.unpack_from("!HHIH", msg, 0)
            if magic != PPTP_MAGIC:
                continue
            if ctrl_type == PPTP_ECHO_REQ and len(msg) >= 16:
                ident = struct.unpack_from("!I", msg, 12)[0]
                reply = struct.pack("!HHIHHIBBH", 20, 1, PPTP_MAGIC, PPTP_ECHO_REP, 0, ident, 1, 0, 0)
                try:
                    self._send_tcp_all(reply)
                except OSError:
                    pass
            elif ctrl_type == PPTP_CDN:
                self._on_fatal("MikroTik sent PPTP Call-Disconnect-Notify (CDN).")
            elif ctrl_type == PPTP_STOP_CCRQ:
                try:
                    rep = struct.pack("!HHIHHBBH", 16, 1, PPTP_MAGIC, PPTP_STOP_CCRP, 0, 1, 0, 0)
                    self._send_tcp_all(rep)
                except OSError:
                    pass
                self._on_fatal("MikroTik sent PPTP Stop-Control-Connection-Request.")

    def run(self):
        try:
            self.server_ip = socket.gethostbyname(self.host)
            self.server_ip_bytes = socket.inet_aton(self.server_ip)
        except OSError as exc:
            emit({"event": "ERROR", "message": f"DNS resolution failed for {self.host}: {exc}"})
            return

        try:
            log("PPTP_HANDSHAKE", "INFO", f"Connecting TCP {self.port} to {self.server_ip} (RFC 2637 PPTP)...")
            self.tcp_sock = socket.create_connection((self.server_ip, self.port), timeout=6.0)
            self.local_ip = self.tcp_sock.getsockname()[0]

            # 1. SCCRQ -> SCCRP
            self.tcp_sock.sendall(build_pptp_sccrq())
            sccrp = self._read_exact_tcp_ctrl(6.0)
            if len(sccrp) < 28:
                raise ValueError("Short PPTP SCCRP packet received.")
            _, _, magic, ctrl_type = struct.unpack_from("!HHIH", sccrp, 0)
            if magic != PPTP_MAGIC or ctrl_type != PPTP_SCCRP:
                raise ValueError(f"Expected PPTP SCCRP (type 2), got type {ctrl_type}.")
            res_code = sccrp[14]
            if res_code != 1:
                raise RuntimeError(f"MikroTik rejected PPTP SCCRQ (result_code={res_code}, err={sccrp[15]}).")
            peer_host = sccrp[28:92].split(b"\x00", 1)[0].decode("utf-8", errors="ignore").strip()
            peer_vendor = sccrp[92:156].split(b"\x00", 1)[0].decode("utf-8", errors="ignore").strip()
            log(
                "PPTP_HANDSHAKE",
                "INFO",
                f"✓ PPTP SCCRP OK from {peer_host or self.server_ip} ({peer_vendor or 'MikroTik'}) — sending OCRQ (Call ID {self.local_call_id})...",
            )

            # 2. OCRQ -> OCRP
            self.tcp_sock.sendall(build_pptp_ocrq(self.local_call_id, self.call_serial))
            ocrp = self._read_exact_tcp_ctrl(6.0)
            if len(ocrp) < 32:
                raise ValueError("Short PPTP OCRP packet received.")
            _, _, magic, ctrl_type = struct.unpack_from("!HHIH", ocrp, 0)
            if magic != PPTP_MAGIC or ctrl_type != PPTP_OCRP:
                raise ValueError(f"Expected PPTP OCRP (type 8), got type {ctrl_type}.")
            self.peer_call_id, _echo_call, call_res, call_err = struct.unpack_from("!HHBB", ocrp, 12)
            if call_res != 1:
                raise RuntimeError(f"MikroTik rejected PPTP Outgoing-Call-Request (result={call_res}, err={call_err}).")
            log(
                "PPTP_HANDSHAKE",
                "INFO",
                f"✓ PPTP OCRP Connected! Local Call ID: {self.local_call_id} <-> Peer Call ID: {self.peer_call_id}. Starting Enhanced GRE (IP Proto 47) + PPP...",
            )

            # Send Set-Link-Info (SLI) to clear ACCM masks cleanly
            sli = struct.pack("!HHIHHHHII", 24, 1, PPTP_MAGIC, PPTP_SLI, 0, self.peer_call_id, 0, 0xFFFFFFFF, 0xFFFFFFFF)
            self.tcp_sock.sendall(sli)
            self.tcp_sock.setblocking(False)

            # 3. Open Raw GRE TX + RX sockets & start PPP (LCP -> MS-CHAPv2/CHAP/PAP -> IPCP)
            self._open_gre_sockets()
            self.ppp = PppEngine(self.username, self.password, self.send_ppp_data, self._on_ipcp_up, self._on_fatal)
            self.stage = "PPP"
            self.ppp.start()

            ppp_start_ts = time.time()
            last_stats = ppp_start_ts
            last_echo_ts = ppp_start_ts

            while self.running:
                rlist = [self.tcp_sock, self.gre_rx]
                if self.tun.fd is not None:
                    rlist.append(self.tun.fd)
                readable, _, _ = select.select(rlist, [], [], 0.15)

                for fd in readable:
                    if fd == self.tcp_sock:
                        while True:
                            try:
                                chunk = self.tcp_sock.recv(4096)
                                if not chunk:
                                    self._on_fatal("MikroTik closed PPTP TCP 1723 control channel.")
                                    break
                                self.rx_tcp_buf.extend(chunk)
                            except BlockingIOError:
                                break
                            except OSError as exc:
                                self._on_fatal(f"PPTP TCP error: {exc}")
                                break
                        self._drain_tcp_control()
                    elif fd == self.gre_rx:
                        while True:
                            try:
                                pkt = self.gre_rx.recv(4096)
                            except BlockingIOError:
                                break
                            except OSError:
                                break
                            parsed = parse_ipv4_gre_packet(pkt, self.server_ip_bytes, self.local_call_id)
                            if parsed is None:
                                continue
                            seq, _ack, ppp_payload = parsed
                            if seq is not None:
                                self.last_rx_seq = seq
                                self.gre_ack_needed = True
                            if ppp_payload:
                                self.gre_rx_packets += 1
                                self.bytes_in += len(ppp_payload)
                                self.packets_in += 1
                                self.ppp.handle_frame(ppp_payload, self.tun)
                        # Send pure GRE ACK if peer sent data and we didn't piggyback an ACK yet
                        if self.gre_ack_needed and self.running:
                            self._send_gre(b"", include_seq=False)
                    elif self.tun.fd is not None and fd == self.tun.fd:
                        ip_pkt = self.tun.read_packet()
                        if ip_pkt:
                            self.send_ppp_data(b"\xff\x03\x00\x21" + ip_pkt)

                now = time.time()
                if self.stage in ("PPP", "UP"):
                    self.ppp.tick()

                # Keep PPTP TCP control channel alive
                if self.stage == "UP" and (now - last_echo_ts) >= 25.0:
                    last_echo_ts = now
                    echo_req = struct.pack("!HHIHHI", 16, 1, PPTP_MAGIC, PPTP_ECHO_REQ, 0, int(now) & 0xFFFFFFFF)
                    try:
                        self._send_tcp_all(echo_req)
                    except OSError:
                        pass

                # Honest GRE Protocol 47 timeout diagnosis
                if self.stage == "PPP" and self.gre_rx_packets == 0 and (now - ppp_start_ts) > 8.5:
                    self._on_fatal(
                        f"PPTP TCP 1723 SCCRP+OCRP succeeded (Peer Call ID {self.peer_call_id}) and {self.gre_tx_packets} Enhanced GRE (IP Proto 47) LCP packets were sent to {self.server_ip}, "
                        f"but 0 GRE packets returned! Cloud Run external NAT / firewall dropped incoming GRE Protocol 47. "
                        f"Download & run the Windows Desktop App (.exe) on your PC (no Cloud NAT) for direct PPTP, OR switch protocol to L2TP/SSTP here."
                    )
                    break

                if self.stage == "PPP" and (now - ppp_start_ts) > 20.0:
                    self._on_fatal("PPTP PPP handshake timed out after GRE frames were exchanged.")
                    break

                if self.stage == "UP" and (now - last_stats) >= 2.0:
                    last_stats = now
                    emit({
                        "event": "STATS",
                        "bytesIn": self.bytes_in,
                        "bytesOut": self.bytes_out,
                        "packetsIn": self.packets_in,
                        "packetsOut": self.packets_out,
                    })
        except Exception as exc:
            self.fatal_error = str(exc)
        finally:
            try:
                if self.tcp_sock:
                    self.tcp_sock.setblocking(True)
                    self.tcp_sock.settimeout(1.0)
                    if self.peer_call_id:
                        ccr = struct.pack("!HHIHHHH", 16, 1, PPTP_MAGIC, PPTP_CCR, 0, self.local_call_id, 0)
                        self.tcp_sock.sendall(ccr)
                    stop_req = struct.pack("!HHIHHBBH", 16, 1, PPTP_MAGIC, PPTP_STOP_CCRQ, 0, 1, 0, 0)
                    self.tcp_sock.sendall(stop_req)
            except Exception:
                pass
            self.tun.close()
            for s in (self.raw_tx, self.gre_rx, self.tcp_sock):
                if s:
                    try:
                        s.close()
                    except OSError:
                        pass
            if self.fatal_error:
                emit({"event": "ERROR", "message": self.fatal_error})
            else:
                emit({"event": "DISCONNECTED", "message": "PPTP tunnel disconnected cleanly."})


def main():
    raw_cfg = sys.stdin.read()
    cfg = json.loads(raw_cfg)
    proto = str(cfg.get("protocol", "pptp")).lower()
    host = str(cfg["host"]).strip()
    default_port = 1723 if proto == "pptp" else (443 if proto == "sstp" else 1701)
    port = int(cfg.get("port") or default_port)
    username = str(cfg.get("username") or "").strip()
    password = str(cfg.get("password") or "")
    subnets = cfg.get("subnets") or ["0.0.0.0/0"]

    if proto == "pptp":
        client = PptpClient(host, port, username, password, subnets)
    elif proto == "sstp":
        client = SstpClient(host, port, username, password, subnets)
    else:
        client = L2tpClient(host, port, username, password, subnets)

    def _sig_handler(_signum, _frame):
        client.stop()

    signal.signal(signal.SIGTERM, _sig_handler)
    signal.signal(signal.SIGINT, _sig_handler)
    client.run()


if __name__ == "__main__":
    main()
