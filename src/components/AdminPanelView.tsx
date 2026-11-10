import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  KeyRound,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Search,
  Sparkles,
  Lock,
  Smartphone,
  Calendar,
  Layers,
  Award,
} from 'lucide-react';
import { useAuth, ADMIN_EMAILS } from '../context/AuthContext';

export const AdminPanelView: React.FC = () => {
  const {
    user,
    isAdmin,
    adminUsers,
    adminLicenses,
    loadAdminData,
    createLicenseKey,
    adminExtendUserTrial,
    loginWithGoogle,
  } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form State for creating license
  const [targetEmail, setTargetEmail] = useState('');
  const [tier, setTier] = useState<'free_trial' | 'pro_engineer' | 'enterprise'>('pro_engineer');
  const [durationDays, setDurationDays] = useState(30);
  const [maxDevices, setMaxDevices] = useState(5);
  const [createdKeySuccess, setCreatedKeySuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      setIsLoading(true);
      loadAdminData().finally(() => setIsLoading(false));
    }
  }, [isAdmin]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await loadAdminData();
    setIsLoading(false);
  };

  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail.trim()) return;
    try {
      setIsLoading(true);
      const key = await createLicenseKey({
        assignedEmail: targetEmail.trim().toLowerCase(),
        tier,
        durationDays: Number(durationDays),
        maxDevices: Number(maxDevices),
      });
      setCreatedKeySuccess(key);
      setTargetEmail('');
    } catch (err: any) {
      alert('Error creating license: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredUsers = adminUsers.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // If user is not an authorized admin
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 mx-auto flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">এডমিন প্যানেল এক্সেস সংরক্ষিত (Admin Only)</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          এই এডমিন প্যানেল শুধুমাত্র অনুমোদিত Google অ্যাকাউন্ট দ্বারা নিয়ন্ত্রিত। লাইসেন্স তৈরি এবং ব্যবহারকারী তালিকা দেখতে নিচের যেকোনো একটি এডমিন অ্যাকাউন্ট দিয়ে লগইন করুন:
        </p>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 max-w-md mx-auto text-left mb-6 space-y-2">
          <div className="text-xs font-mono text-cyan-400 flex items-center gap-1.5 font-bold mb-2">
            <Lock className="w-3.5 h-3.5" />
            <span>অনুমোদিত এডমিন অ্যাকাউন্টসমূহ:</span>
          </div>
          {ADMIN_EMAILS.slice(0, 2).map((adm, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-mono text-slate-200 bg-slate-950 p-2 rounded-lg border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>{adm}</span>
            </div>
          ))}
        </div>

        {user ? (
          <div className="text-xs text-amber-300 font-mono bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg max-w-md mx-auto">
            বর্তমান লগইন: <strong>{user.email}</strong> (এই অ্যাকাউন্টে এডমিন পারমিশন নেই)
          </div>
        ) : (
          <button
            onClick={loginWithGoogle}
            className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer"
          >
            Google এডমিন লগইন করুন
          </button>
        )}
      </div>
    );
  }

  const totalUsers = adminUsers.length;
  const activeTrials = adminUsers.filter((u) => u.licenseTier === 'free_trial' && u.daysRemaining > 0).length;
  const totalProLicenses = adminUsers.filter((u) => u.licenseTier === 'pro_engineer' || u.licenseTier === 'enterprise').length;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 rounded-xl p-6 relative overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Admin Privileges Active</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Log: {user?.email}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              PPTP Solution — এডমিন ও লাইসেন্স কন্ট্রোল প্যানেল
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              সকল ব্যবহারকারী পর্যবেক্ষণ, ১ মাসের ফ্রি ট্রায়াল ট্র্যাকিং এবং নতুন কাস্টম লাইসেন্স কি তৈরি করুন।
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              <span>Refresh Data</span>
            </button>
            <button
              onClick={() => {
                setCreatedKeySuccess(null);
                setShowCreateModal(true);
              }}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create License</span>
            </button>
          </div>
        </div>

        {/* 2. Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5">
            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <span>Total Registered Users</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono mt-1">
              {totalUsers}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Google অ্যাকাউন্টে সংযুক্ত ইউজার
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5">
            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <span>1 Month Free Trials</span>
              <Clock className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
              {activeTrials}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              কার্ড ছাড়া ৩০ দিন ফ্রি ট্রায়াল চালু
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5">
            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <span>Pro / Enterprise Users</span>
              <Award className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-300 font-mono mt-1">
              {totalProLicenses}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              উন্নত বা বর্ধিত লাইসেন্স এক্টিভ
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5">
            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <span>Created License Keys</span>
              <KeyRound className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-300 font-mono mt-1">
              {adminLicenses.length}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              এডমিন দ্বারা ইস্যু করা লাইসেন্স কি
            </div>
          </div>
        </div>
      </div>

      {/* 3. Registered Users Directory */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>নিবন্ধিত ব্যবহারকারী ও লাইসেন্স স্ট্যাটাস ({filteredUsers.length})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              প্রতিটি ব্যবহারকারী লগইন করার সাথে সাথে স্বয়ংক্রিয়ভাবে ৩০ দিনের ফ্রি ট্রায়াল পান।
            </p>
          </div>

          <div className="w-full sm:w-64">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search user email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-medium">User Profile</th>
                <th className="pb-3 font-medium">License Tier</th>
                <th className="pb-3 font-medium">PPTP Profiles</th>
                <th className="pb-3 font-medium">Trial Validity</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    কোনো ব্যবহারকারী পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isExp = u.daysRemaining <= 0;
                  const isUserAdmin = ADMIN_EMAILS.some(
                    (adm) => adm.toLowerCase() === u.email.toLowerCase()
                  );

                  return (
                    <tr key={u.userId} className="text-slate-200 hover:bg-slate-800/30 transition">
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" className="w-7 h-7 rounded-full border border-slate-700" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs">
                              {u.email[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5 font-sans">
                              <span>{u.displayName}</span>
                              {isUserAdmin && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-red-500/20 text-red-300 border border-red-500/30">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            u.licenseTier === 'enterprise'
                              ? 'bg-purple-950 text-purple-300 border border-purple-800/80'
                              : u.licenseTier === 'pro_engineer'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800/80'
                              : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                          }`}
                        >
                          {u.licenseTier === 'enterprise'
                            ? 'Enterprise'
                            : u.licenseTier === 'pro_engineer'
                            ? 'Pro Engineer'
                            : '1-Mo Free Trial'}
                        </span>
                      </td>

                      <td className="py-3 text-cyan-300 font-bold">
                        {u.profilesCount} profiles
                      </td>

                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <Clock className={`w-3.5 h-3.5 ${isExp ? 'text-red-400' : 'text-emerald-400'}`} />
                          <span className={isExp ? 'text-red-400 font-bold' : 'text-slate-200'}>
                            {u.daysRemaining} days left
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Expires: {new Date(u.trialExpiresAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isExp
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isExp ? 'EXPIRED' : 'ACTIVE'}
                        </span>
                      </td>

                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => adminExtendUserTrial(u.userId, 30)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded text-[11px] transition cursor-pointer"
                            title="Add 30 days to user's trial"
                          >
                            +30 Days
                          </button>
                          <button
                            onClick={() => adminExtendUserTrial(u.userId, 90)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 rounded text-[11px] transition cursor-pointer"
                            title="Upgrade / Add 90 days"
                          >
                            +90 Days
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Issued License Keys Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>ইস্যুকৃত লাইসেন্স কি তালিকা ({adminLicenses.length})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              যেকোনো ইউজারকে দেওয়ার জন্য তৈরি করা লাইসেন্স কোডসমূহ।
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-medium">License Key</th>
                <th className="pb-3 font-medium">Assigned Email</th>
                <th className="pb-3 font-medium">Tier</th>
                <th className="pb-3 font-medium">Duration</th>
                <th className="pb-3 font-medium">Max Devices</th>
                <th className="pb-3 font-medium">Created By</th>
                <th className="pb-3 font-medium text-right">Copy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {adminLicenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    এখনও কোনো কাস্টম লাইসেন্স কি তৈরি করা হয়নি। উপরের <strong>&quot;+ Create License&quot;</strong> বাটনে চাপুন।
                  </td>
                </tr>
              ) : (
                adminLicenses.map((lic) => (
                  <tr key={lic.id} className="text-slate-200 hover:bg-slate-800/30">
                    <td className="py-3 font-bold text-cyan-300">
                      {lic.licenseKey}
                    </td>
                    <td className="py-3 text-slate-300">
                      {lic.assignedEmail}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                        {lic.tier.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3">{lic.durationDays} days</td>
                    <td className="py-3">{lic.maxDevices} devices</td>
                    <td className="py-3 text-slate-400 text-[11px]">{lic.createdBy}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleCopy(lic.licenseKey)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === lic.licenseKey ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Create License Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-cyan-400">
                <KeyRound className="w-5 h-5" />
                <h3 className="font-bold text-slate-100 text-base">Create New VPN License</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono p-1"
              >
                ✕
              </button>
            </div>

            {createdKeySuccess ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs text-emerald-300 font-semibold mb-1">
                    লাইসেন্স সফলভাবে তৈরি হয়েছে!
                  </p>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-sm font-bold text-cyan-300 flex items-center justify-between mt-2">
                    <span>{createdKeySuccess}</span>
                    <button
                      onClick={() => handleCopy(createdKeySuccess)}
                      className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setCreatedKeySuccess(null);
                    setShowCreateModal(false);
                  }}
                  className="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                >
                  সম্পন্ন করুন (Close)
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateLicense} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    গ্রাহকের Google ইমেইল (User Email):
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. engineer@gmail.com"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    ইউজার যখন এই ইমেইল দিয়ে লগইন করবেন, স্বয়ংক্রিয়ভাবে লাইসেন্স সক্রিয় হয়ে যাবে।
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">
                      লাইসেন্স প্ল্যান (Tier):
                    </label>
                    <select
                      value={tier}
                      onChange={(e) => setTier(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                    >
                      <option value="free_trial">Free Trial (১ মাস ফ্রি)</option>
                      <option value="pro_engineer">Pro Engineer</option>
                      <option value="enterprise">Enterprise NOC</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">
                      মেয়াদ (দিন সংখ্যা):
                    </label>
                    <select
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                    >
                      <option value={30}>30 Days (১ মাস)</option>
                      <option value={90}>90 Days (৩ মাস)</option>
                      <option value={180}>180 Days (৬ মাস)</option>
                      <option value={365}>365 Days (১ বছর)</option>
                      <option value={730}>730 Days (২ বছর)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    অনুমোদিত ডিভাইস সীমা (Max Devices):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={maxDevices}
                    onChange={(e) => setMaxDevices(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5"
                  >
                    {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                    <span>Generate License</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
