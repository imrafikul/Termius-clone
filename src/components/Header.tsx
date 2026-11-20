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
  LogOut,
  Lock,
  ChevronDown,
  ShieldAlert,
  Sparkles,
  Share2,
  Server,
  Globe,
} from 'lucide-react';
import { ConnectionState, VpnProfile } from '../types/vpn';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeTab: 'dashboard' | 'profiles' | 'terminal' | 'webui' | 'huawei-olt' | 'topology' | 'diagnostics' | 'source' | 'admin';
  setActiveTab: (tab: 'dashboard' | 'profiles' | 'terminal' | 'webui' | 'huawei-olt' | 'topology' | 'diagnostics' | 'source' | 'admin') => void;
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

  const isVpnConnected = connectionState === 'CONNECTED';
  const isGatewayReady = connectionState === 'GATEWAY_READY';
  const isPending =
    connectionState === 'CONNECTING_TCP' ||
    connectionState === 'PPTP_HANDSHAKE' ||
    connectionState === 'PPP_LCP' ||
    connectionState === 'AUTHENTICATING' ||
    connectionState === 'IPCP_CONFIG';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center text-black shadow-xs">
            <Network className="w-5 h-5" />
          </div>
          <button
            onClick={() => setActiveTab('dashboard')}
            className="text-left group cursor-pointer focus:outline-none min-w-0"
          >
            <span className="text-sm sm:text-base font-bold text-black tracking-tight block leading-tight truncate max-w-[200px] sm:max-w-[260px] xl:max-w-none">
              Universal WebUI for Network Engineer
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-600 font-mono tracking-tight block truncate">
              Multi-Vendor OLT · Router · Switch · Telnet/SSH
            </span>
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'bg-black text-white shadow-xs'
                : 'text-slate-700 hover:text-black hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('webui')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'webui'
                ? 'bg-black text-white shadow-xs'
                : 'text-slate-700 hover:text-black hover:bg-slate-100'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Device WebUI</span>
          </button>

          <button
            onClick={() => setActiveTab('profiles')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'profiles'
                ? 'bg-black text-white shadow-xs'
                : 'text-slate-700 hover:text-black hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Profiles</span>
          </button>

          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'terminal'
                ? 'bg-black text-white shadow-xs'
                : 'text-slate-700 hover:text-black hover:bg-slate-100'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Telnet / SSH</span>
          </button>

          <button
            onClick={() => setActiveTab('huawei-olt')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'huawei-olt'
                ? 'bg-black text-white shadow-xs'
                : 'text-slate-700 hover:text-black hover:bg-slate-100'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>OLT &amp; Router</span>
          </button>

          <button
            onClick={() => setActiveTab('topology')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'topology'
                ? 'bg-black text-white shadow-xs'
                : 'text-slate-700 hover:text-black hover:bg-slate-100'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Topology CLI</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'bg-black text-white shadow-xs'
                : 'text-slate-700 hover:text-black hover:bg-slate-100'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Ping &amp; Trace</span>
          </button>

          <button
            onClick={() => setActiveTab('source')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'source'
                ? 'bg-black text-white shadow-xs'
                : 'text-slate-700 hover:text-black hover:bg-slate-100'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Source Code</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-red-700 hover:text-red-900 hover:bg-red-50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          )}
        </nav>

        {/* Zone 3: Actions + PWA Install + Google Auth */}
        <div className="flex items-center gap-2 shrink-0">
          {user && license && (
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>{license.planName}: {license.daysRemaining}d left</span>
            </div>
          )}

          {/* Quick Add PPTP */}
          <button
            onClick={onOpenAddProfile}
            title="Add New PPTP VPN Profile"
            className="hidden sm:flex px-2.5 py-1.5 rounded-lg text-xs font-bold text-black bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add PPTP</span>
          </button>

          {/* 1-Click PWA App Download Button */}
          <PWAInstallButton variant="header" />

          {/* Google Sign-In / Account Dropdown + Direct 1-Tap Logout */}
          {user ? (
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-black text-xs transition cursor-pointer"
                  title={`Logged in as ${user.email} (Data Isolated)`}
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      referrerPolicy="no-referrer"
                      className="w-5 h-5 rounded-full border border-slate-300"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-[10px]">
                      {user.email ? user.email[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  <span className="max-w-[90px] truncate hidden md:inline font-mono text-[11px] text-black">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      syncStatus === 'synced'
                        ? 'bg-emerald-500'
                        : syncStatus === 'syncing'
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-slate-400'
                    }`}
                    title={syncStatus === 'synced' ? 'Private Firestore Synced' : syncStatus}
                  />
                  <ChevronDown className="w-3 h-3 text-slate-600" />
                </button>

                {/* User Account Popover */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-50 text-xs text-black">
                    <div className="flex items-start gap-2.5 pb-2.5 border-b border-slate-200">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt="Avatar"
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full border border-slate-300 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-black text-white font-bold flex items-center justify-center text-xs shrink-0">
                          {user.email?.[0].toUpperCase()}
                        </div>
                      )}
                      <div className="overflow-hidden flex-1">
                        <p className="font-semibold text-black truncate">
                          {user.displayName || 'Network Engineer'}
                        </p>
                        <p className="text-[11px] text-slate-600 truncate font-mono">{user.email}</p>
                      </div>
                      <button
                        onClick={() => setShowUserMenu(false)}
                        className="text-slate-500 hover:text-black px-1 cursor-pointer"
                        aria-label="Close account menu"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="my-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                      <div className="flex items-center justify-between text-emerald-800 font-semibold text-[11px]">
                        <span>1 Month Free Trial Active</span>
                        <span>{license?.daysRemaining || 30} days</span>
                      </div>
                      <p className="text-[10px] text-slate-700 mt-0.5">
                        কোনো ক্রেডিট কার্ড ছাড়াই ৩০ দিন সম্পূর্ণ ফ্রি ট্রায়াল চলছে।
                      </p>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setActiveTab('admin');
                        }}
                        className="w-full mb-2 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition cursor-pointer"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>এডমিন প্যানেলে যান</span>
                      </button>
                    )}

                    <div className="my-2 bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-semibold">
                        <Lock className="w-3 h-3" />
                        <span>Data Isolation Active</span>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-tight">
                        আপনার PPTP প্রোফাইল ও সেভ করা Telnet/SSH ক্রেডেনশিয়াল শুধু আপনার Google অ্যাকাউন্টে সীমাবদ্ধ।
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="w-full mt-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Account Logout</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Always-visible 1-Tap Logout Button */}
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                }}
                title="Account Logout"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 text-xs font-bold transition cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-black text-xs font-semibold transition cursor-pointer shadow-xs whitespace-nowrap"
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
              <span className="hidden sm:inline">Google Login</span>
            </button>
          )}

          {/* Real PPTP/L2TP/SSTP VPN Tunnel Connect / Disconnect Button */}
          <button
            onClick={onToggleConnect}
            disabled={isPending || !user || !activeProfile}
            title={
              !user
                ? 'Google Login required to access or connect saved PPTP profiles'
                : isVpnConnected
                ? 'Real VPN Tunnel Connected (Private IP Ping/Trace/Telnet live)'
                : isGatewayReady
                ? 'MikroTik Jump-Gateway Verified'
                : 'Connect real PPTP / L2TP / SSTP VPN Tunnel'
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-tight transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${
              isVpnConnected
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-400 hover:bg-red-50 hover:text-red-700 hover:border-red-400'
                : isGatewayReady
                ? 'bg-blue-50 text-blue-900 border border-blue-400 hover:bg-red-50 hover:text-red-700 hover:border-red-400'
                : isPending
                ? 'bg-amber-50 text-amber-800 border border-amber-400'
                : 'bg-black text-white hover:bg-slate-800'
            }`}
          >
            {isPending ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Connecting...</span>
              </>
            ) : isVpnConnected ? (
              <>
                <Power className="w-3.5 h-3.5 text-emerald-600" />
                <span>Disconnect VPN</span>
              </>
            ) : isGatewayReady ? (
              <>
                <Power className="w-3.5 h-3.5 text-blue-700" />
                <span>Jump-GW Active</span>
              </>
            ) : (
              <>
                <Power className="w-3.5 h-3.5" />
                <span>Connect VPN</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Navigation Bar */}
      <nav className="lg:hidden border-t border-slate-200 bg-slate-50 px-3 py-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 border ${
              activeTab === 'dashboard'
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('webui')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 border ${
              activeTab === 'webui'
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Device WebUI</span>
          </button>

          <button
            onClick={() => setActiveTab('huawei-olt')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 border ${
              activeTab === 'huawei-olt'
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Huawei · MT · BDCOM · VSOL</span>
          </button>

          <button
            onClick={() => setActiveTab('topology')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 border ${
              activeTab === 'topology'
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Topology CLI</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 border ${
              activeTab === 'diagnostics'
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Ping · Speed · Trace</span>
          </button>

          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 border ${
              activeTab === 'terminal'
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Telnet / SSH</span>
          </button>

          <button
            onClick={() => setActiveTab('profiles')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 border ${
              activeTab === 'profiles'
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-slate-300 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Profiles</span>
          </button>

          <button
            onClick={() => setActiveTab('source')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 border ${
              activeTab === 'source'
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Source / APK</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 border ${
                activeTab === 'admin'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-red-700 border-red-300 hover:bg-red-50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          )}
        </div>
      </nav>
    </header>
  );
};
