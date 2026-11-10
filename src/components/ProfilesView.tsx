import React, { useState } from 'react';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  Download,
  Upload,
  AlertTriangle,
  Server,
  Lock,
  Eye,
  EyeOff,
  Globe,
  Radio,
  Sparkles,
  UserCheck,
  CheckCircle2,
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

  // Form State
  const [formName, setFormName] = useState('');
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
    setFormHost('');
    setFormPort(1723);
    setFormUsername('');
    setFormPassword('');
    setFormRoutingMode('full');
    setFormSubnets('0.0.0.0/0');
    setFormMtu(1400);
    setFormMppe('mppe-128');
    setFormTags('MikroTik, Global VPN');
    setSubnetError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (profile: VpnProfile) => {
    setEditingProfile(profile);
    setFormName(profile.name);
    setFormHost(profile.server);
    setFormPort(profile.port);
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
    } else {
      if (formSubnets === '0.0.0.0/0') {
        setFormSubnets('192.168.88.0/24');
      }
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
      server: formHost.trim(),
      port: formPort || 1723,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">PPTP VPN Profiles</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Full Internet VPN (ফোন আইপি পরিবর্তন) ও স্প্লিট-টানেল মোড সমর্থন করে।
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportProfilesJson}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={openAddModal}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Profile</span>
          </button>
        </div>
      </div>

      {/* Account Isolation Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            {user ? (
              <p className="text-slate-200">
                <strong className="text-emerald-400 font-semibold">প্রাইভেট ডাটা সুরক্ষা সক্রিয়: </strong>
                আপনার সব PPTP প্রোফাইল Google অ্যাকাউন্ট (<span className="text-cyan-300 font-mono">{user.email}</span>) এর সাথে ক্লাউড ফায়ারস্টোরে আইসোলেটেড। অন্য কোনো ডিভাইস বা ইউজার এই তথ্য দেখতে বা অ্যাক্সেস করতে পারবে না।
              </p>
            ) : (
              <p className="text-slate-300">
                <strong className="text-amber-400 font-semibold">গেস্ট লোকাল মোড: </strong>
                আপনার প্রোফাইল ক্লাউডে ব্যাকআপ এবং অন্য ডিভাইস বা ব্যক্তির অ্যাক্সেস থেকে সুরক্ষিত রাখতে Google দিয়ে লগইন করুন।
              </p>
            )}
          </div>
        </div>
        {!user && (
          <button
            onClick={loginWithGoogle}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/60 font-semibold text-xs transition cursor-pointer"
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
              className={`bg-slate-900 border rounded-xl p-5 flex flex-col justify-between transition-all duration-150 relative ${
                isActive
                  ? 'border-cyan-500/60 ring-1 ring-cyan-500/40 shadow-lg shadow-cyan-500/5'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      {profile.name}
                    </h3>
                    <p className="text-xs text-cyan-400 font-mono mt-0.5">
                      {profile.server}:{profile.port}
                    </p>
                  </div>
                  {isActive && (
                    <span className="text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/80 px-2 py-0.5 rounded">
                      ACTIVE
                    </span>
                  )}
                </div>

                {/* Routing Mode Badge & Tags */}
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      isFullTunnel
                        ? 'bg-blue-950/80 text-blue-300 border-blue-700'
                        : 'bg-cyan-950/80 text-cyan-300 border-cyan-700'
                    }`}
                  >
                    {isFullTunnel ? '🌐 Full Internet VPN (Change IP)' : '⚡ Split Tunnel'}
                  </span>
                  {profile.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Subnet rules */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 mb-4">
                  <div className="text-[10px] font-mono text-slate-400 mb-1 flex items-center justify-between">
                    <span>Routing Policy</span>
                    <span className={isFullTunnel ? 'text-blue-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                      {isFullTunnel ? '0.0.0.0/0 (All Traffic)' : 'Private Subnets'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {profile.remoteSubnets.map((sub, i) => (
                      <div key={i} className="text-xs font-mono text-slate-200 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isFullTunnel ? 'bg-blue-400' : 'bg-cyan-400'}`}></span>
                        <span>{sub}</span>
                        {sub === '0.0.0.0/0' && (
                          <span className="text-[9px] text-emerald-300 font-sans ml-1">(Changes Phone IP)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(profile)}
                    className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Edit Profile"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteProfile(profile.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Delete Profile"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {!isActive && (
                    <button
                      onClick={() => setActiveProfileId(profile.id)}
                      className="px-2.5 py-1 text-slate-400 hover:text-slate-200 text-xs font-mono rounded hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Select
                    </button>
                  )}
                  <button
                    onClick={() => onConnectProfile(profile)}
                    className="px-3 py-1 text-xs font-bold rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 cursor-pointer transition-colors"
                  >
                    {isActive && isConnected ? 'Connected' : 'Connect'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Profile Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingProfile ? 'Edit PPTP Profile' : 'Add PPTP VPN Profile'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              {/* Routing Mode Choice */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <label className="block text-xs font-semibold text-slate-200 mb-2">
                  VPN Routing Mode (ভিপিএন মোড নির্বাচন করুন):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRoutingModeChange('full')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                      formRoutingMode === 'full'
                        ? 'bg-blue-950/60 border-blue-500 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs text-blue-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Full Internet VPN</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      সাধারণ VPN-এর মতো ফোনের আইপি পরিবর্তন হবে (0.0.0.0/0)। সব ট্রাফিক ভিপিএন দিয়ে যাবে।
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoutingModeChange('split')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                      formRoutingMode === 'split'
                        ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs text-cyan-300 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5" />
                      <span>Split Tunnel</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      ফোনের নিজস্ব ইন্টারনেট দ্রুত থাকবে, শুধুমাত্র নির্দিষ্ট মাইক্রোটিক সাবনেট টানেল হবে।
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Profile / Site Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. North Tower Core · MikroTik RB4011"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    PPTP Server Host / IP
                  </label>
                  <input
                    type="text"
                    required
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                    placeholder="vpn.isp-core.net or 103.45.89.12"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Port (Default 1723)
                  </label>
                  <input
                    type="number"
                    value={formPort}
                    onChange={(e) => setFormPort(parseInt(e.target.value) || 1723)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="noc_admin"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Target Subnets */}
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
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
                  className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none ${
                    subnetError ? 'border-red-500 focus:border-red-400' : 'border-slate-700 focus:border-cyan-500'
                  }`}
                />
                {subnetError ? (
                  <p className="text-[11px] text-red-400 font-sans mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{subnetError}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    {formRoutingMode === 'full'
                      ? '✓ 0.0.0.0/0 সেট করা হয়েছে। কানেক্ট করলে আপনার ফোনের পাবলিক আইপি পরিবর্তন হয়ে যাবে।'
                      : '✓ স্প্লিট টানেলিং। শুধু নির্দিষ্ট সাবনেট টানেল হবে।'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    MTU / MRU
                  </label>
                  <input
                    type="number"
                    value={formMtu}
                    onChange={(e) => setFormMtu(parseInt(e.target.value) || 1400)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Encryption
                  </label>
                  <select
                    value={formMppe}
                    onChange={(e: any) => setFormMppe(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="mppe-128">MPPE 128-bit (Standard)</option>
                    <option value="mppe-40">MPPE 40-bit</option>
                    <option value="none">None (Plain GRE)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer"
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
