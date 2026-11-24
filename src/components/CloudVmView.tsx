import React, { useMemo, useRef, useState } from 'react';
import {
  Monitor,
  Smartphone,
  Power,
  RotateCw,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  Shield,
  Terminal,
  Globe,
  Activity,
  ExternalLink,
  AlertTriangle,
  Server,
  X,
  Lock,
  Play,
  Square,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CloudVmNode, CloudVmOsType, CloudVmStreamProtocol, VpnProfile } from '../types/vpn';

type DrawerTab = 'pptp-inside-vm' | 'vps-installer' | 'https-tunnel';
type DeployTemplate = 'ubuntu-chrome-pptp' | 'android-redroid-playstore';

interface ProbeStatus {
  loading: boolean;
  reachable?: boolean;
  resolvedIp?: string;
  port?: number;
  latencyMs?: number;
  error?: string;
  checkedAt?: string;
}

const OS_META: Record<
  CloudVmOsType,
  { label: string; shortLabel: string; apps: string; defaultPort: number; defaultProto: CloudVmStreamProtocol }
> = {
  'ubuntu-chrome-novnc': {
    label: 'Ubuntu Desktop + Chrome + YouTube + PPTP',
    shortLabel: 'Ubuntu Chrome VM',
    apps: 'Google Chrome · YouTube Audio · PPTP/L2TP Client',
    defaultPort: 6901,
    defaultProto: 'novnc',
  },
  'android-redroid': {
    label: 'Android 13 + Play Store + YouTube + Chrome (Redroid)',
    shortLabel: 'Android 13 VM',
    apps: 'Google Play Store · YouTube · Chrome · PPTP VPN',
    defaultPort: 8000,
    defaultProto: 'ws-scrcpy',
  },
  'kasm-webrtc': {
    label: 'KasmVNC / WebRTC 60fps Chrome Workspace',
    shortLabel: 'Kasm WebRTC VM',
    apps: '60fps Chrome · Audio · YouTube · PPTP Tunnel',
    defaultPort: 6901,
    defaultProto: 'webrtc',
  },
  'windows-novnc': {
    label: 'Windows / VirtualBox / Proxmox noVNC',
    shortLabel: 'Windows / Proxmox',
    apps: 'Full Desktop · Native PPTP · Chrome · Winbox',
    defaultPort: 6080,
    defaultProto: 'novnc',
  },
  custom: {
    label: 'Custom noVNC / WebRTC Stream',
    shortLabel: 'Custom VM',
    apps: 'Custom KVM / Docker / VirtualBox Display',
    defaultPort: 6080,
    defaultProto: 'novnc',
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

function buildUbuntuChromePptpScript(opts: {
  vncPassword: string;
  pptp?: VpnProfile | null;
}): string {
  const safePass = (opts.vncPassword || 'NetEng@2026').replace(/["'`$\\]/g, '');
  const pptpEnv = opts.pptp
    ? `      - PPTP_SERVER=${opts.pptp.server}
      - PPTP_USER=${opts.pptp.username}
      - PPTP_PASS=${opts.pptp.password}`
    : `      - PPTP_SERVER=YOUR_MIKROTIK_PUBLIC_IP
      - PPTP_USER=YOUR_PPP_USER
      - PPTP_PASS=YOUR_PPP_PASSWORD`;

  return `#!/usr/bin/env bash
# ==============================================================================
# 1-Click Cloud VirtualBox VM: Ubuntu Desktop + Google Chrome + YouTube Audio
# + Real PPTP/L2TP Tunnel + KasmVNC/noVNC + Instant Free HTTPS (Cloudflare Tunnel)
# Run on any Ubuntu 22.04 / 24.04 KVM VPS (2+ vCPU, 2-4 GB RAM) as root:
# ==============================================================================
set -e

apt-get update -y
apt-get install -y docker.io docker-compose-plugin curl

# Load PPP / PPTP kernel modules on the host KVM kernel
modprobe ppp_generic || true
modprobe ppp_mppe || true
modprobe nf_conntrack_pptp || true

mkdir -p /opt/neteng-cloud-vm && cd /opt/neteng-cloud-vm

cat <<'EOF' > docker-compose.yml
services:
  ubuntu-desktop:
    image: lscr.io/linuxserver/webtop:ubuntu-xfce
    container_name: neteng-ubuntu-vm
    security_opt:
      - seccomp:unconfined
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    devices:
      - /dev/ppp:/dev/ppp
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Asia/Dhaka
      - CUSTOM_USER=engineer
      - PASSWORD=${safePass}
      - TITLE=Universal-WebUI-Cloud-VM
${pptpEnv}
    ports:
      - "127.0.0.1:3001:3001"
      - "127.0.0.1:3000:3000"
    shm_size: "2gb"
    restart: unless-stopped
EOF

docker compose up -d

# Install Google Chrome + pptp-linux directly inside the running Virtual Desktop VM
sleep 5
docker exec -u root neteng-ubuntu-vm bash -lc '
  apt-get update -y &&
  apt-get install -y pptp-linux ppp wget gnupg2 curl iproute2 &&
  wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb &&
  apt-get install -y /tmp/chrome.deb && rm -f /tmp/chrome.deb
'

# Install Cloudflared to create an instant HTTPS URL (zero domain needed, works in WebUI iframe!)
if ! command -v cloudflared >/dev/null 2>&1; then
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
  dpkg -i /tmp/cloudflared.deb && rm -f /tmp/cloudflared.deb
fi

echo ""
echo "==================================================================="
echo "  VM READY! Login -> User: engineer | Password: ${safePass}"
echo "  Copy the https://xxxx.trycloudflare.com URL below & paste into"
echo "  Universal WebUI -> Cloud VM -> + Add Cloud VM!"
echo "==================================================================="
cloudflared tunnel --url http://127.0.0.1:3000`;
}

function buildAndroidRedroidPlayStoreScript(): string {
  return `#!/usr/bin/env bash
# ==============================================================================
# 1-Click Cloud Android 13 VM (Redroid + Google Play Store + YouTube + Chrome)
# + ws-scrcpy Web Display + Instant Free HTTPS Tunnel
# Requirements: Ubuntu 22.04 / 24.04 KVM VPS (4+ vCPU, 4-8 GB RAM)
# ==============================================================================
set -e

apt-get update -y
apt-get install -y docker.io docker-compose-plugin curl adb linux-modules-extra-$(uname -r)

# Enable Android binder & ashmem kernel modules on KVM VPS
modprobe binder_linux devices="binder,hwbinder,vndbinder" || true
modprobe ashmem_linux || true
modprobe ppp_generic || true
modprobe ppp_mppe || true

mkdir -p /opt/neteng-android-vm && cd /opt/neteng-android-vm

cat <<'EOF' > docker-compose.yml
services:
  android13:
    # Includes Android 13 + OpenGApps / Play Store support (widevine & ARM translation)
    image: redroid/redroid:13.0.0-latest
    container_name: neteng-android13
    privileged: true
    volumes:
      - ./android-data:/data
    ports:
      - "127.0.0.1:5555:5555"
    command:
      - androidboot.redroid_width=720
      - androidboot.redroid_height=1280
      - androidboot.redroid_dpi=320
      - androidboot.redroid_fps=30
      - androidboot.redroid_gpu_mode=guest
    restart: unless-stopped

  ws-scrcpy:
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

# Tip: For full Google Play Store + YouTube + Chrome APK install via ADB:
#   Use redroid/redroid:13.0.0_gapps (custom GApps image) or install Aurora Store + Chrome + YouTube APK via:
#   adb -s 127.0.0.1:5555 install -r AuroraStore.apk

if ! command -v cloudflared >/dev/null 2>&1; then
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
  dpkg -i /tmp/cloudflared.deb && rm -f /tmp/cloudflared.deb
fi

echo "==================================================================="
echo "  Android 13 Web Display running on http://127.0.0.1:8000"
echo "  Copy the https://xxxx.trycloudflare.com URL below & paste into"
echo "  Universal WebUI -> Cloud VM -> + Add Cloud VM!"
echo "==================================================================="
cloudflared tunnel --url http://127.0.0.1:8000`;
}

function buildInsideVmPptpScript(profile: VpnProfile | null, osType: CloudVmOsType): string {
  const srv = profile?.server || 'MIKROTIK_PUBLIC_IP';
  const usr = profile?.username || 'pptp_user';
  const pwd = profile?.password || 'pptp_password';

  if (osType === 'android-redroid') {
    return `# Inside Android 13 Cloud VM — Route Chrome, YouTube & Play Store through MikroTik PPTP/L2TP
# Option 1 (Built-in Android VPN Settings inside the VM screen):
#   1. Open Settings -> Network & Internet -> VPN -> (+) Add VPN
#   2. Name: ${profile?.name || 'MikroTik VPN'}
#   3. Type: ${profile?.protocol === 'l2tp' ? 'L2TP/IPSec PSK or PPTP' : 'PPTP'}
#   4. Server address: ${srv}
#   5. Username: ${usr}  |  Password: ${pwd}
#   6. Enable "Always-on VPN" -> Connect!

# Option 2 (Host-level PPTP Gateway so ALL Android VM apps automatically get PPTP IP):
sudo pptpsetup --create mikrotik_vm --server "${srv}" --username "${usr}" --password "${pwd}" --encrypt --start
sudo ip route replace default dev ppp0
curl -s https://api.ipify.org && echo " <- New VM Public IP (Chrome/YouTube/PlayStore)"`;
  }

  return `# Run inside your Cloud VM Terminal (Ubuntu Desktop / Kasm WebRTC):
# Connects REAL PPTP (TCP 1723 + GRE 47 + MPPE-128) & routes Chrome + YouTube through MikroTik IP!

sudo pptpsetup --create mikrotik_vm \\
  --server "${srv}" \\
  --username "${usr}" \\
  --password "${pwd}" \\
  --encrypt --start

# Wait for ppp0 interface, keep VPS SSH/noVNC reachable via original GW, then route all web traffic via ppp0:
sleep 3
ORIG_GW=$(ip route | awk '/default/ {print $3; exit}')
VPS_DEV=$(ip route | awk '/default/ {print $5; exit}')
sudo ip route add ${srv}/32 via "$ORIG_GW" dev "$VPS_DEV" 2>/dev/null || true
sudo ip route replace default dev ppp0

# Verify Google Chrome & YouTube now exit through your MikroTik PPTP IP:
echo "Current VM Public IP:"
curl -s https://api.ipify.org && echo ""

# To disconnect PPTP inside VM later:
# sudo poff mikrotik_vm && sudo ip route replace default via "$ORIG_GW" dev "$VPS_DEV"`;
}

export const CloudVmView: React.FC = () => {
  const { cloudVms, saveCloudVm, deleteCloudVm, profiles, activeProfileId } = useAuth();

  const [selectedVmId, setSelectedVmId] = useState<string>('');
  const [isPoweredOn, setIsPoweredOn] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resolutionMode, setResolutionMode] = useState<'fit' | '1280x720' | '1366x768' | '1920x1080'>('fit');
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('pptp-inside-vm');
  const [deployTemplate, setDeployTemplate] = useState<DeployTemplate>('ubuntu-chrome-pptp');
  const [vncPassword, setVncPassword] = useState('NetEng@2026');
  const [selectedPptpId, setSelectedPptpId] = useState<string>(activeProfileId || '');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [probeMap, setProbeMap] = useState<Record<string, ProbeStatus>>({});

  // Add / Edit VM modal state
  const [showModal, setShowModal] = useState(false);
  const [editingVmId, setEditingVmId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formOsType, setFormOsType] = useState<CloudVmOsType>('ubuntu-chrome-novnc');
  const [formProtocol, setFormProtocol] = useState<CloudVmStreamProtocol>('novnc');
  const [formUrl, setFormUrl] = useState('');
  const [formHostIp, setFormHostIp] = useState('');
  const [formPort, setFormPort] = useState('6901');
  const [formPptpId, setFormPptpId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);

  const selectedVm: CloudVmNode | null = useMemo(() => {
    if (!cloudVms.length) return null;
    return cloudVms.find((v) => v.id === selectedVmId) || cloudVms[0];
  }, [cloudVms, selectedVmId]);

  const linkedProfile: VpnProfile | null = useMemo(() => {
    const targetId = selectedPptpId || selectedVm?.pptpProfileId || activeProfileId;
    return profiles.find((p) => p.id === targetId) || profiles[0] || null;
  }, [profiles, selectedPptpId, selectedVm?.pptpProfileId, activeProfileId]);

  const isCurrentPageHttps =
    typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isMixedContent = Boolean(
    selectedVm &&
      isCurrentPageHttps &&
      selectedVm.streamUrl.trim().toLowerCase().startsWith('http://')
  );

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const openAddModal = (presetOs: CloudVmOsType = 'ubuntu-chrome-novnc') => {
    const meta = OS_META[presetOs];
    setEditingVmId(null);
    setFormName(presetOs === 'android-redroid' ? 'Android 13 + Play Store VM' : 'Ubuntu Chrome + PPTP VM');
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

  const openEditModal = (vm: CloudVmNode) => {
    setEditingVmId(vm.id);
    setFormName(vm.name);
    setFormOsType(vm.osType);
    setFormProtocol(vm.streamProtocol);
    setFormUrl(vm.streamUrl);
    setFormHostIp(vm.hostIp);
    setFormPort(String(vm.port));
    setFormPptpId(vm.pptpProfileId || '');
    setFormNotes(vm.notes || '');
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
      // ignore partial URL while typing
    }
  };

  const handleSaveVm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedUrl = formUrl.trim();
    if (!isSafeHttpUrl(trimmedUrl)) {
      setFormError('সঠিক https:// বা http:// noVNC / WebRTC URL দিন (যেমন https://xxx.trycloudflare.com)');
      return;
    }
    setSaving(true);
    try {
      const parsedUrl = new URL(trimmedUrl);
      const saved = await saveCloudVm({
        id: editingVmId || undefined,
        name: formName.trim() || OS_META[formOsType].shortLabel,
        osType: formOsType,
        streamProtocol: formProtocol,
        streamUrl: trimmedUrl,
        hostIp: formHostIp.trim() || parsedUrl.hostname,
        port: Number(formPort) || (parsedUrl.protocol === 'https:' ? 443 : 6080),
        pptpProfileId: formPptpId,
        resolution: resolutionMode === 'fit' ? '1280x720' : resolutionMode,
        notes: formNotes.trim(),
      });
      setSelectedVmId(saved.id);
      setShowModal(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'VM সেভ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVm = async (vm: CloudVmNode) => {
    if (selectedVm?.id === vm.id) {
      setIsPoweredOn(false);
    }
    await deleteCloudVm(vm.id);
  };

  const handleProbeVm = async (vm: CloudVmNode) => {
    setProbeMap((prev) => ({ ...prev, [vm.id]: { loading: true } }));
    try {
      const resp = await fetch('/api/cloud-vm/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamUrl: vm.streamUrl }),
      });
      const data = await resp.json();
      setProbeMap((prev) => ({
        ...prev,
        [vm.id]: {
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
        [vm.id]: {
          loading: false,
          reachable: false,
          error: err instanceof Error ? err.message : 'Probe request failed.',
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

  const activeProbe = selectedVm ? probeMap[selectedVm.id] : undefined;
  const pptpInsideScript = useMemo(
    () => buildInsideVmPptpScript(linkedProfile, selectedVm?.osType || 'ubuntu-chrome-novnc'),
    [linkedProfile, selectedVm?.osType]
  );
  const deployScript = useMemo(
    () =>
      deployTemplate === 'ubuntu-chrome-pptp'
        ? buildUbuntuChromePptpScript({ vncPassword, pptp: linkedProfile })
        : buildAndroidRedroidPlayStoreScript(),
    [deployTemplate, vncPassword, linkedProfile]
  );

  return (
    <div className="space-y-5">
      {/* Top Workbench Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-950 text-white flex items-center justify-center shrink-0">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-950 tracking-tight">
              Cloud VM Console · VirtualBox Screen (noVNC / WebRTC)
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              আপনার KVM VPS-এ চলমান আসল Ubuntu Desktop (Chrome + YouTube + PPTP) অথবা Android 13 (Play Store + YouTube + Chrome) সরাসরি এই ওয়েব অ্যাপের ভেতরেই চালান।
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => openAddModal('ubuntu-chrome-novnc')}
            className="px-3.5 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Cloud VM</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDeployTemplate('android-redroid-playstore');
              setDrawerTab('vps-installer');
            }}
            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android Play Store Script</span>
          </button>
        </div>
      </div>

      {/* Main Split: VM Inventory Sidebar + VirtualBox Display Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Sidebar: Saved Cloud VMs (Isolated per Google Account in Firestore) */}
        <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-950">My Cloud VMs</h2>
              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                {cloudVms.length} machine{cloudVms.length === 1 ? '' : 's'} · Private Firestore
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAddModal()}
              title="Add New Cloud VM"
              className="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-900 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {cloudVms.length === 0 ? (
            <div className="p-5 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
                <Server className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-900">কোনো Cloud VM যোগ করা হয়নি</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  নিচের <strong>1-Click VPS Setup Script</strong> চালিয়ে পাওয়া noVNC বা WebRTC URL এখানে সেভ করুন।
                </p>
              </div>
              <button
                type="button"
                onClick={() => openAddModal('ubuntu-chrome-novnc')}
                className="w-full py-2 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                + Connect First Cloud VM
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[540px] overflow-y-auto">
              {cloudVms.map((vm) => {
                const isSelected = selectedVm?.id === vm.id;
                const probe = probeMap[vm.id];
                const meta = OS_META[vm.osType] || OS_META.custom;
                return (
                  <div
                    key={vm.id}
                    onClick={() => {
                      if (selectedVm?.id !== vm.id) {
                        setSelectedVmId(vm.id);
                        setIsPoweredOn(false);
                      }
                    }}
                    className={`p-3.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-950 truncate">{vm.name}</div>
                        <div className="text-[11px] text-slate-600 mt-0.5 truncate">
                          {meta.shortLabel} · {vm.streamProtocol.toUpperCase()}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-1 truncate tabular-nums">
                          {vm.hostIp}:{vm.port}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(vm);
                          }}
                          title="Edit VM"
                          className="p-1 rounded text-slate-500 hover:text-slate-950 hover:bg-white cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteVm(vm);
                          }}
                          title="Delete VM"
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
                          ? `Reachable · ${probe.latencyMs} ms (${probe.resolvedIp})`
                          : probe.error || 'Unreachable'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Privacy Guarantee */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>শুধুমাত্র আপনার Google অ্যাকাউন্টে সেভ থাকে</span>
          </div>
        </aside>

        {/* Main Stage: VirtualBox Machine Bezel + Live noVNC / WebRTC Screen */}
        <section
          ref={stageRef}
          className={`lg:col-span-9 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col ${
            isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
          }`}
        >
          {/* VirtualBox Machine Control Bar */}
          <div className="bg-slate-900 border-b border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-slate-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <Monitor className="w-4 h-4 text-slate-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {selectedVm ? selectedVm.name : 'VirtualBox Display · Standby'}
                </div>
                <div className="text-[11px] font-mono text-slate-400 truncate tabular-nums">
                  {selectedVm
                    ? `${OS_META[selectedVm.osType]?.shortLabel || 'VM'} · ${selectedVm.streamProtocol.toUpperCase()} · ${isPoweredOn ? 'POWERED ON' : 'POWERED OFF'}`
                    : 'Add a noVNC / WebRTC / ws-scrcpy Cloud VM to boot screen'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedVm && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleProbeVm(selectedVm)}
                    disabled={activeProbe?.loading}
                    className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-mono flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-60"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>{activeProbe?.loading ? 'Probing...' : 'Check Online'}</span>
                  </button>

                  <select
                    value={resolutionMode}
                    onChange={(e) =>
                      setResolutionMode(e.target.value as 'fit' | '1280x720' | '1366x768' | '1920x1080')
                    }
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-mono rounded-md px-2 py-1.5 cursor-pointer focus:outline-none"
                    aria-label="Display Scale"
                  >
                    <option value="fit">Scale: Fit Window</option>
                    <option value="1280x720">1280 × 720 (HD)</option>
                    <option value="1366x768">1366 × 768</option>
                    <option value="1920x1080">1920 × 1080 (FHD)</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPoweredOn((prev) => !prev);
                      setIframeKey((k) => k + 1);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      isPoweredOn
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {isPoweredOn ? (
                      <>
                        <Square className="w-3 h-3 fill-current" />
                        <span>Power Off</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Power On Screen</span>
                      </>
                    )}
                  </button>

                  {isPoweredOn && (
                    <button
                      type="button"
                      onClick={() => setIframeKey((k) => k + 1)}
                      title="Reload noVNC / WebRTC Display"
                      className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isSafeHttpUrl(selectedVm.streamUrl) && (
                    <a
                      href={selectedVm.streamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open VM Display in Dedicated Tab"
                      className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen VirtualBox Screen'}
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Mixed Content Notice if user enters http:// on https:// portal */}
          {isMixedContent && (
            <div className="bg-amber-950/80 border-b border-amber-800 px-4 py-2 text-xs text-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  এই পেজটি <strong>HTTPS</strong>, কিন্তু আপনার VM URL-টি <strong>HTTP</strong>। ব্রাউজার HTTPS-এর ভেতর HTTP iframe ব্লক করতে পারে—ফ্রি HTTPS পেতে নিচের <strong>HTTPS Tunnel</strong> ট্যাব থেকে <code className="font-mono bg-amber-900 px-1 rounded">cloudflared</code> চালান।
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerTab('https-tunnel')}
                className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-semibold text-[11px] whitespace-nowrap cursor-pointer self-start sm:self-center"
              >
                Get Free HTTPS
              </button>
            </div>
          )}

          {/* Actual VirtualBox Monitor Canvas */}
          <div
            className={`relative bg-black flex items-center justify-center overflow-auto ${
              isFullscreen ? 'flex-1' : 'h-[520px] sm:h-[600px]'
            }`}
          >
            {selectedVm && isPoweredOn && isSafeHttpUrl(selectedVm.streamUrl) ? (
              <iframe
                key={`${selectedVm.id}_${iframeKey}`}
                src={selectedVm.streamUrl}
                title={`${selectedVm.name} Live Remote Display`}
                allow="clipboard-read; clipboard-write; fullscreen; autoplay; microphone; camera"
                className="bg-black border-0"
                style={
                  resolutionMode === 'fit'
                    ? { width: '100%', height: '100%' }
                    : resolutionMode === '1280x720'
                    ? { width: '1280px', height: '720px', maxWidth: '100%', maxHeight: '100%' }
                    : resolutionMode === '1366x768'
                    ? { width: '1366px', height: '768px', maxWidth: '100%', maxHeight: '100%' }
                    : { width: '1920px', height: '1080px', maxWidth: '100%', maxHeight: '100%' }
                }
              />
            ) : (
              <div className="max-w-lg mx-auto px-6 py-10 text-center space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-300">
                  <Power className="w-7 h-7" />
                </div>

                {selectedVm ? (
                  <>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-bold text-white">{selectedVm.name}</h3>
                      <p className="text-xs font-mono text-slate-400 break-all">
                        {selectedVm.streamUrl}
                      </p>
                      <p className="text-xs text-slate-400 pt-1">
                        {OS_META[selectedVm.osType]?.apps}
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPoweredOn(true);
                          setIframeKey((k) => k + 1);
                        }}
                        className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Power On VirtualBox Screen</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleProbeVm(selectedVm)}
                        disabled={activeProbe?.loading}
                        className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        <span>{activeProbe?.loading ? 'Checking...' : 'Test Connection'}</span>
                      </button>
                    </div>
                    {activeProbe && !activeProbe.loading && (
                      <div
                        className={`text-xs font-mono px-3 py-2 rounded-lg border tabular-nums ${
                          activeProbe.reachable
                            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                            : 'bg-red-950/60 border-red-800 text-red-300'
                        }`}
                      >
                        {activeProbe.reachable
                          ? `TCP ${activeProbe.port} OPEN · ${activeProbe.latencyMs} ms · IP ${activeProbe.resolvedIp} (Checked ${activeProbe.checkedAt})`
                          : `Offline / Blocked: ${activeProbe.error} (Checked ${activeProbe.checkedAt})`}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-white">
                        VirtualBox Cloud Display Ready
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        একটি Ubuntu KVM VPS-এ নিচের <strong>1-Click Script</strong> রান করে পাওয়া <strong>https://</strong> noVNC/WebRTC লিংক এখানে যোগ করলে—ঠিক এই স্ক্রিনের ভেতরেই আসল <strong>PPTP VPN + Google Chrome + YouTube + Play Store</strong> চলবে।
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openAddModal('ubuntu-chrome-novnc')}
                        className="px-4 py-2.5 rounded-lg bg-white hover:bg-slate-200 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Existing noVNC / WebRTC VM</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeployTemplate('ubuntu-chrome-pptp');
                          setDrawerTab('vps-installer');
                        }}
                        className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Get 1-Click KVM VPS Script</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* VirtualBox Bottom Status Strip */}
          <div className="bg-slate-900 border-t border-slate-800 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 tabular-nums">
            <span>
              Protocol: <strong className="text-slate-200">{selectedVm ? selectedVm.streamProtocol.toUpperCase() : '—'}</strong>
              {' · '}
              PPTP Link: <strong className="text-slate-200">{linkedProfile ? `${linkedProfile.name} (${linkedProfile.server})` : 'Not Linked'}</strong>
            </span>
            <span>
              {activeProbe?.reachable
                ? `RTT: ${activeProbe.latencyMs} ms · ${activeProbe.resolvedIp}:${activeProbe.port}`
                : selectedVm
                ? `${selectedVm.hostIp}:${selectedVm.port}`
                : 'No VM Selected'}
            </span>
          </div>
        </section>
      </div>

      {/* Engineering Companion Drawer: PPTP Inside VM + 1-Click KVM VPS Scripts + HTTPS Tunnel */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="border-b border-slate-200 px-4 pt-3 flex items-center gap-1 overflow-x-auto">
          {(
            [
              { id: 'pptp-inside-vm' as const, label: '01. PPTP Inside VM (Chrome & YouTube IP)', icon: Shield },
              { id: 'vps-installer' as const, label: '02. 1-Click KVM VPS Setup (Ubuntu / Android Play Store)', icon: Terminal },
              { id: 'https-tunnel' as const, label: '03. Free HTTPS Embed Tunnel (Cloudflare / Caddy)', icon: Globe },
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
          {drawerTab === 'pptp-inside-vm' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    VM-এর ভেতরে আসল PPTP কানেক্ট করুন (Chrome, YouTube ও Play Store-এর IP চেঞ্জ হবে)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    আপনার সেভ করা যেকোনো PPTP প্রোফাইল সিলেক্ট করলে অটোমেটিক রেডি কমান্ড তৈরি হবে—VM-এর টার্মিনালে পেস্ট করলেই ফুল ট্রাফিক MikroTik PPTP দিয়ে যাবে।
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
                    onClick={() => handleCopy('pptp-script', pptpInsideScript)}
                    className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    {copiedId === 'pptp-script' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'pptp-script' ? 'Copied' : 'Copy Command'}</span>
                  </button>
                </div>
              </div>

              <pre className="bg-slate-950 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-x-auto leading-relaxed">
                <code>{pptpInsideScript}</code>
              </pre>
            </div>
          )}

          {drawerTab === 'vps-installer' && (
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => setDeployTemplate('ubuntu-chrome-pptp')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      deployTemplate === 'ubuntu-chrome-pptp'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    Ubuntu Desktop + Chrome + YouTube + PPTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeployTemplate('android-redroid-playstore')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      deployTemplate === 'android-redroid-playstore'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    Android 13 + Play Store + YouTube (Redroid)
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {deployTemplate === 'ubuntu-chrome-pptp' && (
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-slate-600 font-medium whitespace-nowrap">
                        VM Password:
                      </label>
                      <input
                        type="text"
                        value={vncPassword}
                        onChange={(e) => setVncPassword(e.target.value)}
                        className="w-36 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-950 focus:outline-none focus:border-slate-950"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleCopy('deploy-script', deployScript)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    {copiedId === 'deploy-script' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'deploy-script' ? 'Script Copied' : 'Copy 1-Click Script'}</span>
                  </button>
                </div>
              </div>

              <pre className="bg-slate-950 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-80 leading-relaxed">
                <code>{deployScript}</code>
              </pre>
            </div>
          )}

          {drawerTab === 'https-tunnel' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-200 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-950">
                    Option A: Zero-Domain Free HTTPS (Cloudflare Quick Tunnel)
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy('cf-cmd', 'cloudflared tunnel --url http://127.0.0.1:3000')
                    }
                    className="text-[11px] font-mono text-slate-700 hover:text-black flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === 'cf-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'cf-cmd' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  কোনো ডোমেইন না থাকলেও আপনার VPS-এ নিচের ১ লাইন চালালে ফ্রি <code className="font-mono">https://xxxx.trycloudflare.com</code> লিংক পাবেন—সেটি সরাসরি উপরের VirtualBox স্ক্রিনে এম্বেড হয়ে চলবে।
                </p>
                <pre className="bg-slate-950 text-slate-100 rounded-md p-3 text-xs font-mono overflow-x-auto">
                  <code>{`# Ubuntu Webtop / noVNC (port 3000) বা Android ws-scrcpy (port 8000):
cloudflared tunnel --url http://127.0.0.1:3000`}</code>
                </pre>
              </div>

              <div className="rounded-lg border border-slate-200 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-950">
                    Option B: Custom Domain Permanent HTTPS (Caddy)
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        'caddy-cmd',
                        'vm.yourdomain.com {\n  reverse_proxy 127.0.0.1:3000\n}'
                      )
                    }
                    className="text-[11px] font-mono text-slate-700 hover:text-black flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === 'caddy-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'caddy-cmd' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  নিজের ডোমেইন থাকলে Caddy দিয়ে অটোমেটিক Let&apos;s Encrypt SSL চালু করে স্থায়ী <code className="font-mono">https://vm.yourdomain.com</code> ব্যবহার করুন।
                </p>
                <pre className="bg-slate-950 text-slate-100 rounded-md p-3 text-xs font-mono overflow-x-auto">
                  <code>{`vm.yourdomain.com {
  reverse_proxy 127.0.0.1:3000
}`}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Cloud VM Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden text-slate-950">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-slate-900" />
                <h3 className="text-sm font-bold">
                  {editingVmId ? 'Edit Cloud VM Connection' : 'Add Cloud VM (noVNC / WebRTC)'}
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

            <form onSubmit={handleSaveVm} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">VM Name</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Android 13 Play Store VM"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-slate-950"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Guest OS / Stack</label>
                  <select
                    value={formOsType}
                    onChange={(e) => {
                      const next = e.target.value as CloudVmOsType;
                      setFormOsType(next);
                      setFormProtocol(OS_META[next].defaultProto);
                      setFormPort(String(OS_META[next].defaultPort));
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-slate-950"
                  >
                    {Object.entries(OS_META).map(([key, meta]) => (
                      <option key={key} value={key}>
                        {meta.shortLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  noVNC / WebRTC / ws-scrcpy Stream URL (HTTPS recommended)
                </label>
                <input
                  type="url"
                  required
                  maxLength={512}
                  value={formUrl}
                  onChange={(e) => handleUrlAutoExtract(e.target.value)}
                  placeholder="https://xxxx.trycloudflare.com or https://vm.yourdomain.com"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-slate-950"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Protocol</label>
                  <select
                    value={formProtocol}
                    onChange={(e) => setFormProtocol(e.target.value as CloudVmStreamProtocol)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-slate-950"
                  >
                    <option value="novnc">noVNC / Webtop</option>
                    <option value="webrtc">Kasm WebRTC</option>
                    <option value="ws-scrcpy">ws-scrcpy (Android)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">VPS Host / IP</label>
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
                  Linked PPTP Profile (for Inside-VM VPN routing)
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
                  placeholder="e.g. Singapore KVM VPS · Chrome + YouTube + Play Store"
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
                  {saving ? 'Saving...' : editingVmId ? 'Save Changes' : 'Save Cloud VM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
