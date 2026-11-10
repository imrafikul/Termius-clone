import React, { useState } from 'react';
import {
  Network,
  ShieldCheck,
  Power,
  RefreshCw,
  Terminal,
  Activity,
  Code2,
  Layers,
  Plus,
  LogIn,
  LogOut,
  UserCheck,
  Lock,
  ChevronDown,
  ShieldAlert,
  Clock,
  Sparkles,
} from 'lucide-react';
import { ConnectionState, VpnProfile } from '../types/vpn';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeTab: 'dashboard' | 'profiles' | 'terminal' | 'diagnostics' | 'source' | 'admin';
  setActiveTab: (tab: 'dashboard' | 'profiles' | 'terminal' | 'diagnostics' | 'source' | 'admin') => void;
  connectionState: ConnectionState;
  activeProfile: VpnProfile | null;
  onToggleConnect: () => void;
  onOpenAddProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  connectionState,
  activeProfile,
  onToggleConnect,
  onOpenAddProfile,
}) => {
  const { user, isAdmin, license, loginWithGoogle, logout, syncStatus } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isConnected = connectionState === 'CONNECTED';
  const isPending =
    connectionState === 'CONNECTING_TCP' ||
    connectionState === 'PPTP_HANDSHAKE' ||
    connectionState === 'PPP_LCP' ||
    connectionState === 'AUTHENTICATING' ||
    connectionState === 'IPCP_CONFIG';

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
            <Network className="w-5 h-5" />
          </div>
          <button
            onClick={() => setActiveTab('dashboard')}
            className="text-left group cursor-pointer focus:outline-none"
          >
            <span className="text-base font-bold text-white tracking-tight whitespace-nowrap block">
              PPTP Solution
            </span>
            <span className="text-[11px] text-slate-400 font-mono tracking-tight block">
              Android VpnService · Full &amp; Split VPN
            </span>
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('profiles')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'profiles'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Profiles</span>
          </button>

          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'terminal'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Diagnostics</span>
          </button>

          <button
            onClick={() => setActiveTab('source')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'source'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Source Code</span>
          </button>

          {/* Admin Panel Tab (Available to rafikul18285@gmail.com, merafikulus@gmail.com) */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                  : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Admin Panel</span>
            </button>
          )}
        </nav>

        {/* Zone 3: Actions + PWA Install + Google Auth */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 1-Month Trial Status Indicator */}
          {user && license && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] font-mono">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>{license.planName}: {license.daysRemaining}d left</span>
            </div>
          )}

          {/* Quick Add PPTP */}
          <button
            onClick={onOpenAddProfile}
            title="Add New PPTP VPN Profile"
            className="hidden sm:flex px-2.5 py-1.5 rounded-lg text-xs font-bold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/80 transition-colors items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add PPTP</span>
          </button>

          {/* 1-Click PWA App Download Button */}
          <PWAInstallButton variant="header" />

          {/* Google Sign-In / Account Dropdown */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs transition cursor-pointer"
                title={`Logged in as ${user.email} (Data Isolated)`}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-5 h-5 rounded-full border border-cyan-400/40"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-[10px]">
                    {user.email ? user.email[0].toUpperCase() : 'U'}
                  </div>
                )}
                <span className="max-w-[90px] truncate hidden md:inline font-mono text-[11px]">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    syncStatus === 'synced'
                      ? 'bg-emerald-400 ring-2 ring-emerald-500/20'
                      : syncStatus === 'syncing'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-400'
                  }`}
                  title={syncStatus === 'synced' ? 'Private Firestore Synced' : syncStatus}
                />
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* User Account Popover */}
              {showUserMenu && (
                <div
                  className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl z-50 text-xs"
                  onMouseLeave={() => setShowUserMenu(false)}
                >
                  <div className="flex items-start gap-2.5 pb-2.5 border-b border-slate-800">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full border border-cyan-500/30 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs shrink-0">
                        {user.email?.[0].toUpperCase()}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <p className="font-semibold text-slate-100 truncate">
                        {user.displayName || 'Network Engineer'}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate font-mono">{user.email}</p>
                    </div>
                  </div>

                  {/* 1 Month Free Trial Info */}
                  <div className="my-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
                    <div className="flex items-center justify-between text-emerald-300 font-semibold text-[11px]">
                      <span>1 Month Free Trial Active</span>
                      <span>{license?.daysRemaining || 30} days</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      কোনো ক্রেডিট কার্ড ছাড়াই ৩০ দিন সম্পূর্ণ ফ্রি ট্রায়াল চলছে।
                    </p>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setActiveTab('admin');
                      }}
                      className="w-full mb-2 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-bold transition cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>এডমিন প্যানেলে যান</span>
                    </button>
                  )}

                  <div className="my-2 bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
                      <Lock className="w-3 h-3" />
                      <span>Data Isolation Active</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      আপনার PPTP তথ্য ও রাউটার ক্রেডেনশিয়াল শুধু আপনার Google অ্যাকাউন্টে সীমাবদ্ধ।
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full mt-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-semibold transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer shadow-sm"
              title="Google অ্যাকাউন্ট দিয়ে লগইন করে ১ মাসের ফ্রি ট্রায়াল চালু করুন"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span className="hidden sm:inline">Google Login (1-Mo Trial Free)</span>
            </button>
          )}

          {/* Connect / Disconnect Toggle Button */}
          <button
            onClick={onToggleConnect}
            disabled={isPending || !activeProfile}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-tight transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-sm ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40'
                : isPending
                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-bold'
            }`}
          >
            {isPending ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Connecting...</span>
              </>
            ) : isConnected ? (
              <>
                <Power className="w-3.5 h-3.5 text-emerald-400" />
                <span>Disconnect</span>
              </>
            ) : (
              <>
                <Power className="w-3.5 h-3.5" />
                <span>Connect</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
