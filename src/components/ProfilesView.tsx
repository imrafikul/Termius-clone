import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Download,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Globe,
  Radio,
} from 'lucide-react';
import { VpnProfile } from '../types/vpn';
import { useAuth } from '../context/AuthContext';

interface ProfilesViewProps {
  profiles: VpnProfile[];
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  onSaveProfile: (profile: VpnProfile) => void;
  onDeleteProfile: (id: string) => void;
  onConnectProfile: (profile: VpnProfile) => void;
  isConnected: boolean;
  externalOpenAddModal?: boolean;
  onResetExternalOpenAdd?: () => void;
}

export const ProfilesView: React.FC<ProfilesViewProps> = ({
  profiles,
  activeProfileId,
  setActiveProfileId,
  onSaveProfile,
  onDeleteProfile,
  onConnectProfile,
  isConnected,
  externalOpenAddModal,
  onResetExternalOpenAdd,
}) => {
  const { user, loginWithGoogle } = useAuth();
  const [editingProfile, setEditingProfile] = useState<VpnProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [subnetError, setSubnetError] = useState<string | null>(null);

  React.useEffect(() => {
    if (externalOpenAddModal) {
      openAddModal();
      onResetExternalOpenAdd?.();
    }
  }, [externalOpenAddModal]);

  const [formName, setFormName] = useState('');
  const [formProtocol, setFormProtocol] = useState<'l2tp' | 'sstp' | 'pptp'>('pptp');
  const [formHost, setFormHost] = useState('');
  const [formPort, setFormPort] = useState(1723);
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRoutingMode, setFormRoutingMode] = useState<'full' | 'split'>('full');
  const [formSubnets, setFormSubnets] = useState('0.0.0.0/0');
  const [formMtu, setFormMtu] = useState(1400);
  const [formMppe, setFormMppe] = useState<'mppe-128' | 'mppe-40' | 'none'>('mppe-128');
  const [formTags, setFormTags] = useState('');

  const openAddModal = () => {
    setEditingProfile(null);
    setFormName('');
    setFormProtocol('pptp');
    setFormHost('');
    setFormPort(1723);
    setFormUsername('');
    setFormPassword('');
    setFormRoutingMode('full');
    setFormSubnets('0.0.0.0/0');
    setFormMtu(1400);
    setFormMppe('mppe-128');
    setFormTags('MikroTik, PPTP VPN');
    setSubnetError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (profile: VpnProfile) => {
    setEditingProfile(profile);
    const proto = profile.protocol || 'pptp';
    setFormName(profile.name);
    setFormProtocol(proto);
    setFormHost(profile.server);
    setFormPort(profile.port || (proto === 'sstp' ? 443 : proto === 'l2tp' ? 1701 : 1723));
    setFormUsername(profile.username);
    setFormPassword(profile.password);
    const isFull = profile.routingMode === 'full' || profile.remoteSubnets.includes('0.0.0.0/0');
    setFormRoutingMode(isFull ? 'full' : 'split');
    setFormSubnets(profile.remoteSubnets.join(', '));
    setFormMtu(profile.mtu);
    setFormMppe(profile.encryption);
    setFormTags(profile.tags.join(', '));
    setSubnetError(null);
    setIsModalOpen(true);
  };

  const handleRoutingModeChange = (mode: 'full' | 'split') => {
    setFormRoutingMode(mode);
    if (mode === 'full') {
      setFormSubnets('0.0.0.0/0');
      setSubnetError(null);
    } else if (formSubnets === '0.0.0.0/0') {
      setFormSubnets('192.168.88.0/24');
    }
  };

  const validateSubnets = (val: string, mode: 'full' | 'split'): boolean => {
    if (mode === 'split' && (val.includes('0.0.0.0/0') || val === '0.0.0.0')) {
      setSubnetError('স্প্লিট টানেল মোডে 0.0.0.0/0 ব্যবহার করা যাবে না। নির্দিষ্ট লোকাল সাবনেট (যেমন: 192.168.88.0/24) দিন অথবা উপরে "Full Internet VPN (Change IP)" মোড বেছে নিন।');
      return false;
    }
    const subnets = val.split(',').map((s) => s.trim()).filter(Boolean);
    if (subnets.length === 0) {
      setSubnetError('কমপক্ষে একটি সাবনেট দেওয়া আবশ্যক (যেমন: 0.0.0.0/0 অথবা 192.168.88.0/24)।');
      return false;
    }
    setSubnetError(null);
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSubnets(formSubnets, formRoutingMode)) return;

    const subnets = formSubnets
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const tags = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const updatedProfile: VpnProfile = {
      id: editingProfile ? editingProfile.id : 'prof_' + Date.now().toString(36),
      name: formName.trim(),
      protocol: formProtocol,
      server: formHost.trim(),
      port: formPort || (formProtocol === 'sstp' ? 443 : formProtocol === 'l2tp' ? 1701 : 1723),
      username: formUsername.trim(),
      password: formPassword.trim(),
      routingMode: formRoutingMode,
      remoteSubnets: formRoutingMode === 'full' ? ['0.0.0.0/0'] : subnets,
      mtu: formMtu || 1400,
      mru: formMtu || 1400,
      encryption: formMppe,
      keepaliveInterval: 30,
      autoReconnect: true,
      dnsServers: ['1.1.1.1', '8.8.8.8'],
      tags: tags.length ? tags : ['VPN-Node'],
      lastConnected: editingProfile?.lastConnected,
    };

    onSaveProfile(updatedProfile);
    setIsModalOpen(false);
  };

  const exportProfilesJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(profiles, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'pptp_solution_profiles.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-black tracking-tight">PPTP VPN Profiles</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Full Internet VPN (ফোন আইপি পরিবর্তন) ও স্প্লিট-টানেল মোড সমর্থন করে।
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportProfilesJson}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-300"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={openAddModal}
            className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Profile</span>
          </button>
        </div>
      </div>

      {/* Account Isolation Notice */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            {user ? (
              <p className="text-black">
                <strong className="text-emerald-800 font-semibold">প্রাইভেট ডাটা সুরক্ষা সক্রিয়: </strong>
                আপনার সব PPTP প্রোফাইল Google অ্যাকাউন্ট (<span className="font-mono font-semibold">{user.email}</span>) এর সাথে ক্লাউড ফায়ারস্টোরে আইসোলেটেড। অন্য কোনো ডিভাইস বা ইউজার এই তথ্য দেখতে বা অ্যাক্সেস করতে পারবে না।
              </p>
            ) : (
              <p className="text-black">
                <strong className="text-amber-800 font-semibold">গেস্ট লোকাল মোড: </strong>
                আপনার প্রোফাইল ক্লাউডে ব্যাকআপ এবং অন্য ডিভাইস বা ব্যক্তির অ্যাক্সেস থেকে সুরক্ষিত রাখতে Google দিয়ে লগইন করুন।
              </p>
            )}
          </div>
        </div>
        {!user && (
          <button
            onClick={loginWithGoogle}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white font-semibold text-xs transition cursor-pointer"
          >
            Google লগইন
          </button>
        )}
      </div>

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {profiles.map((profile) => {
          const isActive = profile.id === activeProfileId;
          const isFullTunnel = profile.routingMode === 'full' || profile.remoteSubnets.includes('0.0.0.0/0');

          return (
            <div
              key={profile.id}
              className={`bg-white border rounded-xl p-5 flex flex-col justify-between transition-all duration-150 relative ${
                isActive ? 'border-black ring-1 ring-black' : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-black tracking-tight">
                      {profile.name}
                    </h3>
                    <p className="text-xs text-slate-700 font-mono mt-0.5">
                      {profile.server}:{profile.port}
                    </p>
                  </div>
                  {isActive && (
                    <span className="text-[10px] font-mono font-bold text-emerald-800">
                      ACTIVE
                    </span>
                  )}
                </div>

                {/* Routing Mode & Tags as clean inline metadata */}
                <div className="flex flex-wrap items-center gap-2 mb-4 text-[11px] font-mono text-slate-700">
                  <span className={isFullTunnel ? 'text-blue-700 font-bold' : 'text-emerald-700 font-bold'}>
                    {isFullTunnel ? 'Full Internet VPN (Change IP)' : 'Split Tunnel'}
                  </span>
                  {profile.tags.map((tag, idx) => (
                    <React.Fragment key={idx}>
                      <span className="text-slate-400">·</span>
                      <span>{tag}</span>
                    </React.Fragment>
                  ))}
                </div>

                {/* Subnet rules */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-4">
                  <div className="text-[10px] font-mono text-slate-600 mb-1 flex items-center justify-between">
                    <span>Routing Policy</span>
                    <span className={isFullTunnel ? 'text-blue-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                      {isFullTunnel ? '0.0.0.0/0 (All Traffic)' : 'Private Subnets'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {profile.remoteSubnets.map((sub, i) => (
                      <div key={i} className="text-xs font-mono text-black flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isFullTunnel ? 'bg-blue-600' : 'bg-emerald-600'}`}></span>
                        <span>{sub}</span>
                        {sub === '0.0.0.0/0' && (
                          <span className="text-[10px] text-emerald-700 font-sans ml-1">(Changes Phone IP)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(profile)}
                    className="p-1.5 text-slate-600 hover:text-black rounded hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Edit Profile"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteProfile(profile.id)}
                    className="p-1.5 text-slate-600 hover:text-red-700 rounded hover:bg-red-50 transition-colors cursor-pointer"
                    title="Delete Profile"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {!isActive && (
                    <button
                      onClick={() => setActiveProfileId(profile.id)}
                      className="px-2.5 py-1 text-slate-700 hover:text-black text-xs font-mono rounded hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Select
                    </button>
                  )}
                  <button
                    onClick={() => onConnectProfile(profile)}
                    className="px-3 py-1 text-xs font-bold rounded bg-black hover:bg-slate-800 text-white cursor-pointer transition-colors"
                  >
                    {isActive && isConnected ? 'Connected' : `Connect ${(profile.protocol || 'pptp').toUpperCase()}`}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Profile Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-black">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-black">
                {editingProfile ? 'Edit PPTP Profile' : 'Add PPTP VPN Profile'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-600 hover:text-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              {/* Protocol Choice */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="block text-xs font-semibold text-black mb-2">
                  VPN Protocol (MikroTik /ppp secret — লগইন ছাড়াই Direct Private Ping/Telnet):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'l2tp', label: 'L2TP (UDP 1701)', port: 1701, sub: 'Web + APK Live ✓' },
                      { id: 'sstp', label: 'SSTP (TCP 443)', port: 443, sub: 'Web + APK Live ✓' },
                      { id: 'pptp', label: 'PPTP (TCP 1723)', port: 1723, sub: 'Android APK Only' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setFormProtocol(p.id);
                        setFormPort(p.port);
                      }}
                      className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                        formProtocol === p.id
                          ? 'bg-emerald-50 border-emerald-600 text-black'
                          : 'bg-white border-slate-300 text-slate-700 hover:border-black'
                      }`}
                    >
                      <div className="font-bold text-[11px] font-mono text-black">{p.label}</div>
                      <div className="text-[10px] text-slate-600 mt-0.5">{p.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Routing Mode Choice */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="block text-xs font-semibold text-black mb-2">
                  VPN Routing Mode (ভিপিএন মোড নির্বাচন করুন):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRoutingModeChange('full')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                      formRoutingMode === 'full'
                        ? 'bg-blue-50 border-blue-600 text-black'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-black'
                    }`}
                  >
                    <div className="font-bold text-xs text-blue-800 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Full Internet / All LANs</span>
                    </div>
                    <p className="text-[10px] text-slate-700 mt-1">
                      সব Private LAN (10/172/192) ও APK-এ 0.0.0.0/0 রাউট হবে।
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoutingModeChange('split')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                      formRoutingMode === 'split'
                        ? 'bg-emerald-50 border-emerald-600 text-black'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-black'
                    }`}
                  >
                    <div className="font-bold text-xs text-emerald-800 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5" />
                      <span>Split Tunnel</span>
                    </div>
                    <p className="text-[10px] text-slate-700 mt-1">
                      শুধুমাত্র নির্দিষ্ট মাইক্রোটিক সাবনেট টানেল হবে।
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-black font-semibold mb-1">
                  Profile / Site Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. North Tower Core · MikroTik RB4011"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-black focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-mono text-black font-semibold mb-1">
                    MikroTik Server Public IP / Host
                  </label>
                  <input
                    type="text"
                    required
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                    placeholder="vpn.isp-core.net or 103.238.114.208"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-black font-semibold mb-1">
                    Port ({formProtocol === 'sstp' ? 443 : formProtocol === 'l2tp' ? 1701 : 1723})
                  </label>
                  <input
                    type="number"
                    value={formPort}
                    onChange={(e) => setFormPort(parseInt(e.target.value) || 1701)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-black font-semibold mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="noc_admin"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-black font-semibold mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 text-slate-600 hover:text-black cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Target Subnets */}
              <div>
                <label className="block text-xs font-mono text-black font-semibold mb-1">
                  Target Routes / Subnets (CIDRs)
                </label>
                <input
                  type="text"
                  required
                  value={formSubnets}
                  onChange={(e) => {
                    setFormSubnets(e.target.value);
                    validateSubnets(e.target.value, formRoutingMode);
                  }}
                  placeholder={formRoutingMode === 'full' ? '0.0.0.0/0' : '192.168.88.0/24, 10.99.0.0/16'}
                  className={`w-full bg-white border rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none ${
                    subnetError ? 'border-red-600 focus:border-red-700' : 'border-slate-300 focus:border-black'
                  }`}
                />
                {subnetError ? (
                  <p className="text-[11px] text-red-700 font-sans mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{subnetError}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-600 mt-1 font-mono">
                    {formRoutingMode === 'full'
                      ? '✓ 0.0.0.0/0 সেট করা হয়েছে। কানেক্ট করলে আপনার ফোনের পাবলিক আইপি পরিবর্তন হয়ে যাবে।'
                      : '✓ স্প্লিট টানেলিং। শুধু নির্দিষ্ট সাবনেট টানেল হবে।'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-black font-semibold mb-1">
                    MTU / MRU
                  </label>
                  <input
                    type="number"
                    value={formMtu}
                    onChange={(e) => setFormMtu(parseInt(e.target.value) || 1400)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-black font-semibold mb-1">
                    Encryption
                  </label>
                  <select
                    value={formMppe}
                    onChange={(e: any) => setFormMppe(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                  >
                    <option value="mppe-128">MPPE 128-bit (Standard)</option>
                    <option value="mppe-40">MPPE 40-bit</option>
                    <option value="none">None (Plain GRE)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs text-slate-700 hover:text-black cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-black hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
                >
                  {editingProfile ? 'Save Changes' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
