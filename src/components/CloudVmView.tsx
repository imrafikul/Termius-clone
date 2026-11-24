import React, { useMemo, useRef, useState } from 'react';
import {
  Smartphone,
  Tablet,
  Power,
  RotateCw,
  RotateCcw,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  Shield,
  Terminal,
  Activity,
  ExternalLink,
  AlertTriangle,
  X,
  Lock,
  Play,
  Square,
  Wrench,
  Cpu,
  Globe,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CloudVmNode, CloudVmOsType, CloudVmStreamProtocol, VpnProfile } from '../types/vpn';

type DrawerTab = 'pptp-vpn' | 'android-deploy' | 'adb-tools';
type AndroidTemplate = 'docker-android-playstore' | 'redroid-scrcpy';
type DevicePreset = 'pixel' | 'galaxy' | 'tablet' | 'fit';

interface ProbeStatus {
  loading: boolean;
  reachable?: boolean;
  resolvedIp?: string;
  port?: number;
  latencyMs?: number;
  error?: string;
  checkedAt?: string;
}

const EMULATOR_ENGINES: Record<
  CloudVmOsType,
  {
    label: string;
    shortLabel: string;
    apps: string;
    defaultPort: number;
    defaultProto: CloudVmStreamProtocol;
  }
> = {
  'android-redroid': {
    label: 'Redroid Android 13 (Fast Multi-Instance + ws-scrcpy)',
    shortLabel: 'Redroid Android 13',
    apps: 'Google Play Store / Aurora · Chrome · YouTube · PPTP',
    defaultPort: 8000,
    defaultProto: 'ws-scrcpy',
  },
  'ubuntu-chrome-novnc': {
    label: 'Docker-Android Emulator (Official Play Store + Chrome + YouTube)',
    shortLabel: 'Docker-Android Play',
    apps: 'Official Google Play Store · Chrome · YouTube · PPTP',
    defaultPort: 6080,
    defaultProto: 'novnc',
  },
  'kasm-webrtc': {
    label: 'Genymotion / WebRTC Cloud Android (60fps + Audio)',
    shortLabel: 'WebRTC Android 60fps',
    apps: '60fps Android · Audio · Play Store · Chrome · YouTube',
    defaultPort: 443,
    defaultProto: 'webrtc',
  },
  'windows-novnc': {
    label: 'Remote LDPlayer / BlueStacks Host Stream',
    shortLabel: 'Remote PC Emulator',
    apps: 'LDPlayer / BlueStacks Stream · Native PPTP',
    defaultPort: 6080,
    defaultProto: 'novnc',
  },
  custom: {
    label: 'Custom Android Emulator Stream (scrcpy / WebRTC / noVNC)',
    shortLabel: 'Custom Emulator',
    apps: 'Custom Android Stream Endpoint',
    defaultPort: 8000,
    defaultProto: 'ws-scrcpy',
  },
};

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function buildDockerAndroidPlayStoreScript(deviceModel: string): string {
  const safeDevice = (deviceModel || 'Samsung Galaxy S10').replace(/["'`$\\]/g, '');
  return `#!/usr/bin/env bash
# ==============================================================================
# 1-Click Cloud Android Emulator (Official Google Play Store + Chrome + YouTube)
# Uses real Android x86_64 Emulator + KVM + Web Screen + Free HTTPS URL
# Requirements: Ubuntu 22.04 / 24.04 KVM VPS with Nested Virtualization (/dev/kvm)
# ==============================================================================
set -e

apt-get update -y
apt-get install -y docker.io docker-compose-plugin curl pptp-linux ppp

if [ ! -e /dev/kvm ]; then
  echo "[WARNING] /dev/kvm not found on this VPS. Use the 'Redroid Android 13' script instead (works without nested KVM)!"
fi

mkdir -p /opt/android-emulator && cd /opt/android-emulator

cat <<'EOF' > docker-compose.yml
services:
  android-emulator:
    image: budtmo/docker-android:emulator_13.0
    container_name: neteng-android-emulator
    privileged: true
    devices:
      - /dev/kvm:/dev/kvm
    environment:
      - EMULATOR_DEVICE=${safeDevice}
      - WEB_VNC=true
      - APPIUM=false
      - EMULATOR_ARGS=-gpu swiftshader_indirect -no-snapshot
    ports:
      - "127.0.0.1:6080:6080"
      - "127.0.0.1:5555:5555"
    restart: unless-stopped
EOF

docker compose up -d

# Free instant HTTPS URL (no domain needed — works straight inside Universal WebUI Android Emulator frame!)
if ! command -v cloudflared >/dev/null 2>&1; then
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
  dpkg -i /tmp/cloudflared.deb && rm -f /tmp/cloudflared.deb
fi

echo ""
echo "==================================================================="
echo "  ANDROID EMULATOR BOOTING (Google Play Store + Chrome + YouTube)"
echo "  Copy the https://xxxx.trycloudflare.com URL below & paste into:"
echo "  Universal WebUI -> Emulator -> + Add Emulator Instance"
echo "==================================================================="
cloudflared tunnel --url http://127.0.0.1:6080`;
}

function buildRedroidScrcpyScript(): string {
  return `#!/usr/bin/env bash
# ==============================================================================
# 1-Click Lightweight Cloud Android 13 Emulator (Redroid + ws-scrcpy Web Touch)
# Works on standard Ubuntu 22.04 / 24.04 KVM VPS (even WITHOUT nested /dev/kvm!)
# Includes Google Chrome, YouTube, Play Store / Aurora Store & Full Touch UI
# ==============================================================================
set -e

apt-get update -y
apt-get install -y docker.io docker-compose-plugin curl adb pptp-linux ppp linux-modules-extra-$(uname -r)

# Load Android binder & PPP kernel modules
modprobe binder_linux devices="binder,hwbinder,vndbinder" || true
modprobe ashmem_linux || true
modprobe ppp_generic || true
modprobe ppp_mppe || true

mkdir -p /opt/redroid-emulator && cd /opt/redroid-emulator

cat <<'EOF' > docker-compose.yml
services:
  android13:
    image: redroid/redroid:13.0.0-latest
    container_name: neteng-redroid13
    privileged: true
    volumes:
      - ./android-data:/data
    ports:
      - "127.0.0.1:5555:5555"
    command:
      - androidboot.redroid_width=720
      - androidboot.redroid_height=1520
      - androidboot.redroid_dpi=320
      - androidboot.redroid_fps=60
      - androidboot.redroid_gpu_mode=guest
    restart: unless-stopped

  scrcpy-web:
    image: emptysuns/scrcpy-web:latest
    container_name: neteng-scrcpy-web
    network_mode: host
    environment:
      - ADB_CONNECT=127.0.0.1:5555
    depends_on:
      - android13
    restart: unless-stopped
EOF

docker compose up -d
sleep 8
adb connect 127.0.0.1:5555 || true

# Free instant HTTPS URL for embedding inside the phone frame
if ! command -v cloudflared >/dev/null 2>&1; then
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
  dpkg -i /tmp/cloudflared.deb && rm -f /tmp/cloudflared.deb
fi

echo ""
echo "==================================================================="
echo "  ANDROID 13 EMULATOR READY (ws-scrcpy Touch Screen on port 8000)"
echo "  Copy the https://xxxx.trycloudflare.com URL below & paste into:"
echo "  Universal WebUI -> Emulator -> + Add Emulator Instance"
echo "==================================================================="
cloudflared tunnel --url http://127.0.0.1:8000`;
}

function buildEmulatorPptpGatewayScript(profile: VpnProfile | null): string {
  const srv = profile?.server || 'YOUR_MIKROTIK_PUBLIC_IP';
  const usr = profile?.username || 'pptp_user';
  const pwd = profile?.password || 'pptp_password';

  return `# Run on your Android Emulator VPS Host (Routes ALL Emulator Apps via MikroTik PPTP!)
# Play Store + Google Chrome + YouTube inside the Android Emulator will get your MikroTik IP.

sudo modprobe ppp_generic ppp_mppe nf_conntrack_pptp || true

sudo pptpsetup --create mikrotik_emu \\
  --server "${srv}" \\
  --username "${usr}" \\
  --password "${pwd}" \\
  --encrypt --start

sleep 3
ORIG_GW=$(ip route | awk '/default/ {print $3; exit}')
HOST_DEV=$(ip route | awk '/default/ {print $5; exit}')

# Keep VPS SSH & Cloudflare HTTPS tunnel reachable while routing Android Emulator traffic through ppp0
sudo ip route add ${srv}/32 via "$ORIG_GW" dev "$HOST_DEV" 2>/dev/null || true
sudo iptables -t nat -A POSTROUTING -o ppp0 -j MASQUERADE
sudo ip route replace default dev ppp0

echo "Verified Android Emulator Outbound IP (Chrome / YouTube / Play Store):"
curl -s https://api.ipify.org && echo ""

# Disconnect PPTP later:
# sudo poff mikrotik_emu && sudo ip route replace default via "$ORIG_GW" dev "$HOST_DEV"`;
}

function buildAdbQuickCommands(profile: VpnProfile | null): string {
  return `# Connect ADB to your Cloud Android Emulator (on VPS host):
adb connect 127.0.0.1:5555

# 1. Open Google Play Store inside Emulator:
adb -s 127.0.0.1:5555 shell am start -a android.intent.action.VIEW -d "market://details?id=com.google.android.youtube"

# 2. Open Google Chrome directly to IP Check (verify PPTP IP is active):
adb -s 127.0.0.1:5555 shell am start -a android.intent.action.VIEW -d "https://whatismyipaddress.com"

# 3. Launch YouTube App directly inside Emulator:
adb -s 127.0.0.1:5555 shell monkey -p com.google.android.youtube -c android.intent.category.LAUNCHER 1

# 4. Open Android VPN Settings screen (to add ${profile?.name || 'MikroTik'} PPTP/L2TP manually):
adb -s 127.0.0.1:5555 shell am start -a android.settings.VPN_SETTINGS

# 5. Install any APK (Chrome / YouTube / Aurora Store / Custom App) into Emulator:
adb -s 127.0.0.1:5555 install -r app.apk`;
}

export const CloudVmView: React.FC = () => {
  const { cloudVms, saveCloudVm, deleteCloudVm, profiles, activeProfileId } = useAuth();

  const [selectedId, setSelectedId] = useState<string>('');
  const [isBooted, setIsBooted] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [devicePreset, setDevicePreset] = useState<DevicePreset>('pixel');
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('pptp-vpn');
  const [androidTemplate, setAndroidTemplate] = useState<AndroidTemplate>('docker-android-playstore');
  const [deviceModelName, setDeviceModelName] = useState('Samsung Galaxy S10');
  const [selectedPptpId, setSelectedPptpId] = useState<string>(activeProfileId || '');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [probeMap, setProbeMap] = useState<Record<string, ProbeStatus>>({});

  // Add / Edit Emulator Instance modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formOsType, setFormOsType] = useState<CloudVmOsType>('android-redroid');
  const [formProtocol, setFormProtocol] = useState<CloudVmStreamProtocol>('ws-scrcpy');
  const [formUrl, setFormUrl] = useState('');
  const [formHostIp, setFormHostIp] = useState('');
  const [formPort, setFormPort] = useState('8000');
  const [formPptpId, setFormPptpId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);

  const selectedEmu: CloudVmNode | null = useMemo(() => {
    if (!cloudVms.length) return null;
    return cloudVms.find((v) => v.id === selectedId) || cloudVms[0];
  }, [cloudVms, selectedId]);

  const linkedProfile: VpnProfile | null = useMemo(() => {
    const targetId = selectedPptpId || selectedEmu?.pptpProfileId || activeProfileId;
    return profiles.find((p) => p.id === targetId) || profiles[0] || null;
  }, [profiles, selectedPptpId, selectedEmu?.pptpProfileId, activeProfileId]);

  const isCurrentPageHttps =
    typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isMixedContent = Boolean(
    selectedEmu &&
      isCurrentPageHttps &&
      selectedEmu.streamUrl.trim().toLowerCase().startsWith('http://')
  );

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const openAddModal = (presetOs: CloudVmOsType = 'android-redroid') => {
    const meta = EMULATOR_ENGINES[presetOs];
    setEditingId(null);
    setFormName(
      presetOs === 'ubuntu-chrome-novnc'
        ? 'Pixel Play Store Emulator'
        : 'Android 13 Cloud Phone'
    );
    setFormOsType(presetOs);
    setFormProtocol(meta.defaultProto);
    setFormUrl('');
    setFormHostIp('');
    setFormPort(String(meta.defaultPort));
    setFormPptpId(activeProfileId || '');
    setFormNotes('');
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (emu: CloudVmNode) => {
    setEditingId(emu.id);
    setFormName(emu.name);
    setFormOsType(emu.osType);
    setFormProtocol(emu.streamProtocol);
    setFormUrl(emu.streamUrl);
    setFormHostIp(emu.hostIp);
    setFormPort(String(emu.port));
    setFormPptpId(emu.pptpProfileId || '');
    setFormNotes(emu.notes || '');
    setFormError(null);
    setShowModal(true);
  };

  const handleUrlAutoExtract = (val: string) => {
    setFormUrl(val);
    try {
      const parsed = new URL(val.trim());
      if (parsed.hostname) setFormHostIp(parsed.hostname);
      if (parsed.port) {
        setFormPort(parsed.port);
      } else if (parsed.protocol === 'https:') {
        setFormPort('443');
      } else if (parsed.protocol === 'http:') {
        setFormPort('80');
      }
    } catch {
      // typing in progress
    }
  };

  const handleSaveInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedUrl = formUrl.trim();
    if (!isSafeHttpUrl(trimmedUrl)) {
      setFormError(
        'সঠিক https:// বা http:// Android Emulator Stream URL দিন (যেমন https://xxx.trycloudflare.com)'
      );
      return;
    }
    setSaving(true);
    try {
      const parsedUrl = new URL(trimmedUrl);
      const saved = await saveCloudVm({
        id: editingId || undefined,
        name: formName.trim() || 'Android Emulator',
        osType: formOsType,
        streamProtocol: formProtocol,
        streamUrl: trimmedUrl,
        hostIp: formHostIp.trim() || parsedUrl.hostname,
        port: Number(formPort) || (parsedUrl.protocol === 'https:' ? 443 : 8000),
        pptpProfileId: formPptpId,
        resolution: devicePreset,
        notes: formNotes.trim(),
      });
      setSelectedId(saved.id);
      setShowModal(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Emulator সেভ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInstance = async (emu: CloudVmNode) => {
    if (selectedEmu?.id === emu.id) {
      setIsBooted(false);
    }
    await deleteCloudVm(emu.id);
  };

  const handleProbeInstance = async (emu: CloudVmNode) => {
    setProbeMap((prev) => ({ ...prev, [emu.id]: { loading: true } }));
    try {
      const resp = await fetch('/api/cloud-vm/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamUrl: emu.streamUrl }),
      });
      const data = await resp.json();
      setProbeMap((prev) => ({
        ...prev,
        [emu.id]: {
          loading: false,
          reachable: Boolean(data.reachable),
          resolvedIp: data.resolvedIp,
          port: data.port,
          latencyMs: data.latencyMs,
          error: data.error,
          checkedAt: new Date().toLocaleTimeString(),
        },
      }));
    } catch (err: unknown) {
      setProbeMap((prev) => ({
        ...prev,
        [emu.id]: {
          loading: false,
          reachable: false,
          error: err instanceof Error ? err.message : 'Connection test failed.',
          checkedAt: new Date().toLocaleTimeString(),
        },
      }));
    }
  };

  const toggleFullscreen = async () => {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  // Compute authentic phone / tablet screen geometry inside the Android Emulator chassis
  const screenDimensions = useMemo(() => {
    if (devicePreset === 'fit') {
      return { width: '100%', height: isFullscreen ? '100%' : '620px', maxWidth: '100%' };
    }
    const base =
      devicePreset === 'pixel'
        ? { w: 360, h: 700 }
        : devicePreset === 'galaxy'
        ? { w: 390, h: 740 }
        : { w: 780, h: 490 };

    const widthPx = isLandscape ? Math.max(base.w, base.h) : Math.min(base.w, base.h);
    const heightPx = isLandscape ? Math.min(base.w, base.h) : Math.max(base.w, base.h);
    return {
      width: `${widthPx}px`,
      height: `${heightPx}px`,
      maxWidth: '100%',
    };
  }, [devicePreset, isLandscape, isFullscreen]);

  const activeProbe = selectedEmu ? probeMap[selectedEmu.id] : undefined;
  const pptpScript = useMemo(() => buildEmulatorPptpGatewayScript(linkedProfile), [linkedProfile]);
  const deployScript = useMemo(
    () =>
      androidTemplate === 'docker-android-playstore'
        ? buildDockerAndroidPlayStoreScript(deviceModelName)
        : buildRedroidScrcpyScript(),
    [androidTemplate, deviceModelName]
  );
  const adbScript = useMemo(() => buildAdbQuickCommands(linkedProfile), [linkedProfile]);

  return (
    <div className="space-y-5">
      {/* Top Emulator Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-950 tracking-tight">
              Cloud Android Emulator · Play Store, Chrome, YouTube &amp; PPTP
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              LDPlayer / Android Studio Emulator-এর মতো ফোন স্ক্রিনেই আসল Android 13, Google Play Store, Chrome, YouTube ও আপনার MikroTik PPTP VPN চালান।
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => openAddModal('android-redroid')}
            className="px-3.5 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Emulator Instance</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAndroidTemplate('docker-android-playstore');
              setDrawerTab('android-deploy');
            }}
            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>1-Click Android Setup</span>
          </button>
        </div>
      </div>

      {/* Multi-Instance Manager + Android Phone Emulator Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Sidebar: Multi-Instance Android Device Manager (Private per Google Account) */}
        <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-950">Emulator Instances</h2>
              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                {cloudVms.length} device{cloudVms.length === 1 ? '' : 's'} · Private Account
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAddModal('android-redroid')}
              title="Add Android Emulator Instance"
              className="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-900 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {cloudVms.length === 0 ? (
            <div className="p-5 text-center space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-600">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-900">কোনো Android Emulator নেই</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  নিচের <strong>1-Click Android Setup</strong> স্ক্রিপ্ট রান করে পাওয়া HTTPS লিংক এখানে যোগ করলেই ফোন স্ক্রিন চালু হবে।
                </p>
              </div>
              <button
                type="button"
                onClick={() => openAddModal('android-redroid')}
                className="w-full py-2 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                + Connect Android Emulator
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[600px] overflow-y-auto">
              {cloudVms.map((emu) => {
                const isSelected = selectedEmu?.id === emu.id;
                const probe = probeMap[emu.id];
                const meta = EMULATOR_ENGINES[emu.osType] || EMULATOR_ENGINES.custom;
                return (
                  <div
                    key={emu.id}
                    onClick={() => {
                      if (selectedEmu?.id !== emu.id) {
                        setSelectedId(emu.id);
                        setIsBooted(false);
                      }
                    }}
                    className={`p-3.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-950 truncate flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <span className="truncate">{emu.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5 truncate">
                          {meta.shortLabel} · {emu.streamProtocol.toUpperCase()}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-1 truncate tabular-nums">
                          {emu.hostIp}:{emu.port}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(emu);
                          }}
                          title="Edit Instance"
                          className="p-1 rounded text-slate-500 hover:text-slate-950 hover:bg-white cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteInstance(emu);
                          }}
                          title="Delete Instance"
                          className="p-1 rounded text-slate-500 hover:text-red-700 hover:bg-white cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {probe && !probe.loading && (
                      <div
                        className={`mt-2 text-[10px] font-mono tabular-nums ${
                          probe.reachable ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {probe.reachable
                          ? `Online · ${probe.latencyMs} ms (${probe.resolvedIp})`
                          : probe.error || 'Offline'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>শুধু আপনার Google অ্যাকাউন্টে সেভ থাকে</span>
          </div>
        </aside>

        {/* Center/Right: Authentic Android Emulator Studio Canvas + Phone Frame + Side Hardware Rail */}
        <section
          ref={stageRef}
          className={`lg:col-span-9 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col ${
            isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
          }`}
        >
          {/* Emulator Top Device Selector Strip */}
          <div className="bg-slate-900 border-b border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-slate-100">
            <div className="flex items-center gap-2.5 min-w-0">
              {devicePreset === 'tablet' ? (
                <Tablet className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {selectedEmu ? selectedEmu.name : 'Android Emulator · Ready to Boot'}
                </div>
                <div className="text-[11px] font-mono text-slate-400 truncate tabular-nums">
                  {selectedEmu
                    ? `${EMULATOR_ENGINES[selectedEmu.osType]?.shortLabel || 'Android'} · ${
                        isBooted ? 'RUNNING' : 'POWERED OFF'
                      } · ${isLandscape ? 'Landscape' : 'Portrait'}`
                    : 'Connect your Cloud Android Emulator URL to boot phone screen'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Device Chassis Size Selector */}
              <div className="flex items-center bg-slate-800 border border-slate-700 rounded-md p-0.5 text-[11px] font-mono">
                {(
                  [
                    { id: 'pixel' as const, label: 'Pixel' },
                    { id: 'galaxy' as const, label: 'S24' },
                    { id: 'tablet' as const, label: 'Tab' },
                    { id: 'fit' as const, label: 'Full' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDevicePreset(p.id)}
                    className={`px-2 py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                      devicePreset === p.id
                        ? 'bg-white text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {selectedEmu && (
                <button
                  type="button"
                  onClick={() => {
                    setIsBooted((prev) => !prev);
                    setIframeKey((k) => k + 1);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isBooted
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isBooted ? (
                    <>
                      <Square className="w-3 h-3 fill-current" />
                      <span>Power Off</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Boot Android</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Mixed Content Alert for HTTP on HTTPS */}
          {isMixedContent && (
            <div className="bg-amber-950/90 border-b border-amber-800 px-4 py-2 text-xs text-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  HTTPS ওয়েবে HTTP স্ট্রিম ব্লক হতে পারে—ফ্রি HTTPS পেতে আপনার VPS-এ <code className="font-mono bg-amber-900 px-1 rounded">cloudflared tunnel --url http://127.0.0.1:8000</code> চালিয়ে পাওয়া <strong>https://</strong> লিংক বসান।
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerTab('android-deploy')}
                className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-semibold text-[11px] whitespace-nowrap cursor-pointer self-start sm:self-center"
              >
                View HTTPS Command
              </button>
            </div>
          )}

          {/* Emulator Workspace Stage: Realistic Phone Bezel + LDPlayer-Style Side Control Rail */}
          <div
            className={`relative bg-slate-950 flex flex-col sm:flex-row items-center justify-center gap-4 p-4 sm:p-6 overflow-auto ${
              isFullscreen ? 'flex-1' : 'min-h-[640px]'
            }`}
          >
            {/* Realistic Android Phone / Tablet Chassis */}
            <div
              className={`bg-neutral-900 border-[3px] border-neutral-700 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
                devicePreset === 'fit' ? 'rounded-xl w-full' : 'rounded-[32px]'
              }`}
              style={{
                width: screenDimensions.width,
                maxWidth: screenDimensions.maxWidth,
              }}
            >
              {/* Top Phone Bezel / Punch-Hole Camera (hidden in Full mode) */}
              {devicePreset !== 'fit' && (
                <div className="bg-black px-5 py-2 flex items-center justify-between text-[10px] font-mono text-neutral-400 select-none">
                  <span>{linkedProfile ? `VPN: ${linkedProfile.protocol?.toUpperCase() || 'PPTP'}` : 'Android 13'}</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-neutral-800 border border-neutral-700" aria-hidden="true" />
                  <span className="tabular-nums">
                    {activeProbe?.reachable ? `${activeProbe.latencyMs}ms` : '4G / WiFi'}
                  </span>
                </div>
              )}

              {/* Live Android Display Viewport */}
              <div
                className="bg-black relative flex items-center justify-center overflow-hidden"
                style={{ height: screenDimensions.height }}
              >
                {selectedEmu && isBooted && isSafeHttpUrl(selectedEmu.streamUrl) ? (
                  <iframe
                    key={`${selectedEmu.id}_${iframeKey}`}
                    src={selectedEmu.streamUrl}
                    title={`${selectedEmu.name} Live Android Screen`}
                    allow="clipboard-read; clipboard-write; fullscreen; autoplay; microphone; camera"
                    className="w-full h-full border-0 bg-black"
                  />
                ) : (
                  <div className="px-6 py-8 text-center space-y-5 max-w-xs mx-auto">
                    <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-emerald-400">
                      <Smartphone className="w-8 h-8" />
                    </div>

                    {selectedEmu ? (
                      <>
                        <div className="space-y-1.5">
                          <h3 className="text-sm font-bold text-white">{selectedEmu.name}</h3>
                          <p className="text-[11px] font-mono text-neutral-400 break-all">
                            {selectedEmu.streamUrl}
                          </p>
                          <p className="text-[11px] text-neutral-400 pt-1">
                            Play Store · Chrome · YouTube · PPTP
                          </p>
                        </div>

                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsBooted(true);
                              setIframeKey((k) => k + 1);
                            }}
                            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Power className="w-4 h-4" />
                            <span>Power On Android Phone</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleProbeInstance(selectedEmu)}
                            disabled={activeProbe?.loading}
                            className="w-full py-2 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Activity className="w-3.5 h-3.5" />
                            <span>{activeProbe?.loading ? 'Testing...' : 'Check Emulator Online'}</span>
                          </button>
                        </div>

                        {activeProbe && !activeProbe.loading && (
                          <div
                            className={`text-[11px] font-mono px-3 py-2 rounded-lg border tabular-nums ${
                              activeProbe.reachable
                                ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                                : 'bg-red-950/70 border-red-800 text-red-300'
                            }`}
                          >
                            {activeProbe.reachable
                              ? `Online · ${activeProbe.latencyMs} ms · ${activeProbe.resolvedIp}:${activeProbe.port}`
                              : `Offline: ${activeProbe.error}`}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <h3 className="text-sm font-bold text-white">
                            Android Phone Emulator Ready
                          </h3>
                          <p className="text-xs text-neutral-400 leading-relaxed">
                            আসল <strong>Google Play Store, Chrome, YouTube</strong> ও <strong>PPTP VPN</strong> চালাতে নিচের ১-ক্লিক Android স্ক্রিপ্ট রান করে পাওয়া HTTPS লিংক এখানে অ্যাড করুন।
                          </p>
                        </div>

                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => openAddModal('android-redroid')}
                            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Android Emulator URL</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAndroidTemplate('docker-android-playstore');
                              setDrawerTab('android-deploy');
                            }}
                            className="w-full py-2 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Cpu className="w-3.5 h-3.5" />
                            <span>Get Play Store Emulator Script</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Android Gesture Pill Bar (hidden in Full mode) */}
              {devicePreset !== 'fit' && (
                <div className="bg-black py-2 flex items-center justify-center">
                  <div className="w-24 h-1 rounded-full bg-neutral-700" aria-hidden="true" />
                </div>
              )}
            </div>

            {/* Classic Android Emulator Physical Side Control Rail (LDPlayer / Android Studio Style) */}
            <div className="flex sm:flex-col items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2 shrink-0">
              <button
                type="button"
                disabled={!selectedEmu}
                onClick={() => {
                  setIsBooted((prev) => !prev);
                  setIframeKey((k) => k + 1);
                }}
                title={isBooted ? 'Power Off Emulator' : 'Power On Emulator'}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${
                  isBooted
                    ? 'bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-800'
                    : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-800'
                }`}
              >
                <Power className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsLandscape((prev) => !prev)}
                title="Rotate Portrait / Landscape"
                className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center cursor-pointer"
              >
                {isLandscape ? <RotateCcw className="w-4 h-4" /> : <RotateCw className="w-4 h-4" />}
              </button>

              <button
                type="button"
                disabled={!selectedEmu || !isBooted}
                onClick={() => setIframeKey((k) => k + 1)}
                title="Reload Android Screen"
                className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center cursor-pointer disabled:opacity-40"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={!selectedEmu || activeProbe?.loading}
                onClick={() => selectedEmu && void handleProbeInstance(selectedEmu)}
                title="Check Emulator Reachability & Ping"
                className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center cursor-pointer disabled:opacity-40"
              >
                <Activity className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Emulator'}
                className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {selectedEmu && isSafeHttpUrl(selectedEmu.streamUrl) && (
                <a
                  href={selectedEmu.streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open Emulator in Dedicated Browser Tab"
                  className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Emulator Bottom Telemetry Strip */}
          <div className="bg-slate-900 border-t border-slate-800 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 tabular-nums">
            <span>
              Linked PPTP:{' '}
              <strong className="text-slate-200">
                {linkedProfile ? `${linkedProfile.name} (${linkedProfile.server})` : 'Not Linked'}
              </strong>
            </span>
            <span>
              {activeProbe?.reachable
                ? `RTT: ${activeProbe.latencyMs} ms · ${activeProbe.resolvedIp}:${activeProbe.port}`
                : selectedEmu
                ? `${selectedEmu.streamProtocol.toUpperCase()} · ${selectedEmu.hostIp}:${selectedEmu.port}`
                : 'No Emulator Connected'}
            </span>
          </div>
        </section>
      </div>

      {/* Android Emulator Setup, PPTP Routing & ADB Drawer */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="border-b border-slate-200 px-4 pt-3 flex items-center gap-1 overflow-x-auto">
          {(
            [
              { id: 'pptp-vpn' as const, label: '01. PPTP VPN Inside Emulator (Play Store / Chrome / YouTube IP)', icon: Shield },
              { id: 'android-deploy' as const, label: '02. 1-Click Cloud Android Emulator Setup (Play Store + Free HTTPS)', icon: Cpu },
              { id: 'adb-tools' as const, label: '03. ADB Quick Launch (Play Store · Chrome · YouTube · APK)', icon: Terminal },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = drawerTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDrawerTab(tab.id)}
                className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-slate-950 text-slate-950'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {drawerTab === 'pptp-vpn' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    Android Emulator-এ MikroTik PPTP কানেক্ট করুন
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    আপনার সেভ করা PPTP প্রোফাইল সিলেক্ট করলে অটোমেটিক কমান্ড ও Android VPN ক্রেডেনশিয়াল রেডি হয়ে যাবে—ফলে এমুলেটরের ভেতর <strong>Play Store, Chrome ও YouTube</strong> সরাসরি আপনার MikroTik IP-তে চলবে।
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={linkedProfile?.id || ''}
                    onChange={(e) => setSelectedPptpId(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-950"
                  >
                    {profiles.length === 0 ? (
                      <option value="">No Saved PPTP Profile</option>
                    ) : (
                      profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.server})
                        </option>
                      ))
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleCopy('emu-pptp', pptpScript)}
                    className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    {copiedId === 'emu-pptp' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'emu-pptp' ? 'Copied' : 'Copy PPTP Script'}</span>
                  </button>
                </div>
              </div>

              {linkedProfile && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-500">Android VPN Server</div>
                      <div className="font-mono font-semibold text-slate-950 truncate">{linkedProfile.server}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('srv', linkedProfile.server)}
                      className="p-1.5 rounded bg-white border border-slate-200 hover:border-black cursor-pointer"
                      title="Copy Server IP"
                    >
                      {copiedId === 'srv' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-500">PPP Username</div>
                      <div className="font-mono font-semibold text-slate-950 truncate">{linkedProfile.username}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('usr', linkedProfile.username)}
                      className="p-1.5 rounded bg-white border border-slate-200 hover:border-black cursor-pointer"
                      title="Copy Username"
                    >
                      {copiedId === 'usr' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-500">PPP Password</div>
                      <div className="font-mono font-semibold text-slate-950 truncate">••••••••</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('pwd', linkedProfile.password)}
                      className="p-1.5 rounded bg-white border border-slate-200 hover:border-black cursor-pointer"
                      title="Copy Password"
                    >
                      {copiedId === 'pwd' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              <pre className="bg-slate-950 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-x-auto leading-relaxed">
                <code>{pptpScript}</code>
              </pre>
            </div>
          )}

          {drawerTab === 'android-deploy' && (
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => setAndroidTemplate('docker-android-playstore')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      androidTemplate === 'docker-android-playstore'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    Official Play Store Emulator (Docker-Android)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAndroidTemplate('redroid-scrcpy')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      androidTemplate === 'redroid-scrcpy'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    Lightweight Android 13 (Redroid + ws-scrcpy)
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {androidTemplate === 'docker-android-playstore' && (
                    <select
                      value={deviceModelName}
                      onChange={(e) => setDeviceModelName(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-950 focus:outline-none"
                    >
                      <option value="Samsung Galaxy S10">Samsung Galaxy S10</option>
                      <option value="Nexus 5">Google Nexus 5</option>
                      <option value="Samsung Galaxy S9">Samsung Galaxy S9</option>
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={() => handleCopy('deploy-android', deployScript)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    {copiedId === 'deploy-android' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'deploy-android' ? 'Script Copied' : 'Copy 1-Click Script'}</span>
                  </button>
                </div>
              </div>

              <pre className="bg-slate-950 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-80 leading-relaxed">
                <code>{deployScript}</code>
              </pre>
            </div>
          )}

          {drawerTab === 'adb-tools' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    ADB App Launcher &amp; APK Installer Commands
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Cloud Android Emulator-এ সরাসরি Play Store, Google Chrome, YouTube, VPN Settings ওপেন বা যেকোনো APK ইনস্টল করার কমান্ড।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('adb-cmds', adbScript)}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  {copiedId === 'adb-cmds' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'adb-cmds' ? 'Copied' : 'Copy ADB Commands'}</span>
                </button>
              </div>
              <pre className="bg-slate-950 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-x-auto leading-relaxed">
                <code>{adbScript}</code>
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Android Emulator Instance Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden text-slate-950">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-slate-900" />
                <h3 className="text-sm font-bold">
                  {editingId ? 'Edit Android Emulator Instance' : 'Add Cloud Android Emulator'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-500 hover:text-slate-950 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveInstance} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Emulator Name</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Android 13 Play Store Phone"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-slate-950"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Emulator Engine</label>
                  <select
                    value={formOsType}
                    onChange={(e) => {
                      const next = e.target.value as CloudVmOsType;
                      setFormOsType(next);
                      setFormProtocol(EMULATOR_ENGINES[next].defaultProto);
                      setFormPort(String(EMULATOR_ENGINES[next].defaultPort));
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-slate-950"
                  >
                    {Object.entries(EMULATOR_ENGINES).map(([key, meta]) => (
                      <option key={key} value={key}>
                        {meta.shortLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Android Stream URL (HTTPS Cloudflare Tunnel / ws-scrcpy / WebRTC / noVNC)
                </label>
                <div className="relative">
                  <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="url"
                    required
                    maxLength={512}
                    value={formUrl}
                    onChange={(e) => handleUrlAutoExtract(e.target.value)}
                    placeholder="https://xxxx.trycloudflare.com"
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs font-mono focus:outline-none focus:border-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Protocol</label>
                  <select
                    value={formProtocol}
                    onChange={(e) => setFormProtocol(e.target.value as CloudVmStreamProtocol)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-slate-950"
                  >
                    <option value="ws-scrcpy">ws-scrcpy (Touch)</option>
                    <option value="webrtc">WebRTC (60fps)</option>
                    <option value="novnc">Docker-Android noVNC</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Host / Domain</label>
                  <input
                    type="text"
                    maxLength={255}
                    value={formHostIp}
                    onChange={(e) => setFormHostIp(e.target.value)}
                    placeholder="auto from URL"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-slate-950"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Port</label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={formPort}
                    onChange={(e) => setFormPort(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono tabular-nums focus:outline-none focus:border-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Linked PPTP Profile (Play Store / Chrome / YouTube VPN)
                </label>
                <select
                  value={formPptpId}
                  onChange={(e) => setFormPptpId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-slate-950"
                >
                  <option value="">None (Choose later)</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.server} ({p.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  maxLength={300}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Android 13 · Play Store + Chrome + YouTube"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-slate-950"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold cursor-pointer"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Save Emulator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
