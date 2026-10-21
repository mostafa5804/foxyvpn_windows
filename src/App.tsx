import React, { useEffect, useState } from 'react';
import {
  Power,
  Globe,
  Terminal,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Sun,
  Moon,
  UserCheck,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Languages,
  LogOut,
  Zap,
} from 'lucide-react';
import {
  FIFTY_GB_BYTES,
  calculateQuotaSummary,
  countryCodeToFlag,
  formatBytes,
  formatRate,
  formatUptime,
  AUTO_SERVER,
  type ClientSettings,
  type ConnectionStatus,
  type ServerInfo,
  type UserInfo,
} from './utils/vpnLogic';
import { DEFAULT_SERVERS, vpnBridge } from './utils/wailsBridge';
import { translations, type Language } from './utils/i18n';
import { AuthView } from './components/AuthView';
import { ServerSelectorModal } from './components/ServerSelectorModal';
import { SettingsView } from './components/SettingsView';
import { AboutView } from './components/AboutView';

type ActiveSection = 'dashboard' | 'auth' | 'settings' | 'about';

export default function App() {
  // Theme state: Default is Light as requested ("تم پیش فرض هم روشن باشه")
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('foxyvpn_theme');
      if (saved) return saved === 'dark';
    }
    return false; // Default Light
  });

  // Language state: Default is Persian ('fa') with full English toggle
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('foxyvpn_lang');
      if (saved === 'en' || saved === 'fa') return saved;
    }
    return 'fa';
  });

  const t = translations[lang];

  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');

  // No hardcoded demo account: restored from persistent storage, null if fresh
  const [user, setUser] = useState<UserInfo | null>(() => vpnBridge.getCurrentUser());

  const [servers, setServers] = useState<ServerInfo[]>(DEFAULT_SERVERS);

  // Automatic Server selection as the smart default
  const [selectedServer, setSelectedServer] = useState<ServerInfo>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedId = window.localStorage.getItem('foxyvpn_server_id');
      if (savedId) {
        const found = DEFAULT_SERVERS.find((s) => s.id === savedId);
        if (found) return found;
      }
    }
    return AUTO_SERVER; // Default Auto
  });

  const [showServerModal, setShowServerModal] = useState(false);

  const [settings, setSettings] = useState<ClientSettings>({
    mode: 'tun',
    tlsSplitMode: 'sni',
    dohProvider: '1.1.1.1',
    mtu: 1380,
    killSwitch: true,
    controlPlaneProxy: '',
    edgeOverrideIp: '',
  });

  const [status, setStatus] = useState<ConnectionStatus>({
    state: 'Disconnected',
    mode: 'tun',
    serverId: AUTO_SERVER.id,
    serverLabel: `${AUTO_SERVER.countryName} — ${AUTO_SERVER.cityName}`,
    uptimeSeconds: 0,
    uploadedBytes: 0,
    downloadedBytes: 0,
    pingMs: AUTO_SERVER.latencyMs,
    exitIp: '—',
    exitCountry: '—',
    exitVerified: false,
    quotaMaxBytes: user ? user.quotaMaxBytes : FIFTY_GB_BYTES,
    quotaRemainingBytes: user ? user.quotaRemainingBytes : FIFTY_GB_BYTES,
  });

  const [rxRate, setRxRate] = useState(0);
  const [txRate, setTxRate] = useState(0);
  const [speedHistory, setSpeedHistory] = useState<number[]>(
    Array.from({ length: 28 }, () => 8)
  );
  const [logs, setLogs] = useState<string[]>([]);
  const [copiedLogs, setCopiedLogs] = useState(false);

  // Theme & Language persistence
  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('foxyvpn_theme', next ? 'dark' : 'light');
      }
      return next;
    });
  };

  const toggleLanguage = () => {
    setLang((prev) => {
      const next: Language = prev === 'fa' ? 'en' : 'fa';
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('foxyvpn_lang', next);
      }
      return next;
    });
  };

  // Initial load of servers and logs
  useEffect(() => {
    let mounted = true;
    vpnBridge.getServers().then((list) => {
      if (mounted && list.length > 0) {
        setServers(list);
      }
    });
    vpnBridge.getLogs().then((initialLogs) => {
      if (mounted) setLogs(initialLogs);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Sync user state with vpnBridge
  useEffect(() => {
    const u = vpnBridge.getCurrentUser();
    if (u) {
      setUser(u);
      setStatus((prev) => ({
        ...prev,
        quotaMaxBytes: u.quotaMaxBytes,
        quotaRemainingBytes: u.quotaRemainingBytes,
      }));
    }
  }, []);

  // Poll telemetry when connected
  useEffect(() => {
    let lastRx = status.downloadedBytes;
    let lastTx = status.uploadedBytes;

    const timer = setInterval(async () => {
      if (status.state === 'Connected') {
        let currentRx = 0;
        let currentTx = 0;
        if (vpnBridge.isNative) {
          const liveStatus = await vpnBridge.getStatus();
          setStatus(liveStatus);
          currentRx = Math.max(0, liveStatus.downloadedBytes - lastRx);
          currentTx = Math.max(0, liveStatus.uploadedBytes - lastTx);
          lastRx = liveStatus.downloadedBytes;
          lastTx = liveStatus.uploadedBytes;
        } else {
          const simRx = Math.floor(420_000 + Math.random() * 1_850_000);
          const simTx = Math.floor(85_000 + Math.random() * 340_000);
          const updated = vpnBridge.tickSimulation(simTx, simRx);
          setStatus(updated);
          currentRx = simRx;
          currentTx = simTx;
        }
        setRxRate(currentRx);
        setTxRate(currentTx);
        setSpeedHistory((prev) => [
          ...prev.slice(1),
          Math.min(100, Math.max(12, Math.round(((currentRx || 300000) / 2_400_000) * 100))),
        ]);
      } else {
        setRxRate(0);
        setTxRate(0);
      }
      const currentLogs = await vpnBridge.getLogs();
      setLogs(currentLogs);
    }, 1000);

    return () => clearInterval(timer);
  }, [status.state]);

  const handleToggleConnection = async () => {
    if (!user) {
      setActiveSection('auth');
      return;
    }
    if (status.state === 'Connected' || status.state === 'Connecting...') {
      await vpnBridge.disconnect();
      const s = await vpnBridge.getStatus();
      setStatus(s);
    } else {
      setStatus((prev) => ({ ...prev, state: 'Connecting...' }));
      await vpnBridge.connect(selectedServer.id, settings.mode);
      const s = await vpnBridge.getStatus();
      setStatus(s);
    }
    const latestLogs = await vpnBridge.getLogs();
    setLogs(latestLogs);
  };

  const handleSelectServer = async (srv: ServerInfo) => {
    setSelectedServer(srv);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('foxyvpn_server_id', srv.id);
    }
    if (status.state === 'Connected') {
      await vpnBridge.connect(srv.id, settings.mode);
      const s = await vpnBridge.getStatus();
      setStatus(s);
      const latestLogs = await vpnBridge.getLogs();
      setLogs(latestLogs);
    } else {
      setStatus((prev) => ({
        ...prev,
        serverId: srv.id,
        serverLabel: `${srv.countryName} — ${srv.cityName}`,
        pingMs: srv.latencyMs,
      }));
    }
  };

  const handleModeQuickSwitch = async (newMode: 'tun' | 'proxy') => {
    const nextSettings: ClientSettings = { ...settings, mode: newMode };
    setSettings(nextSettings);
    await vpnBridge.updateSettings(nextSettings);
    if (status.state === 'Connected') {
      await vpnBridge.connect(selectedServer.id, newMode);
    }
    const s = await vpnBridge.getStatus();
    setStatus(s);
    setLogs(await vpnBridge.getLogs());
  };

  const handleSignOut = async () => {
    await vpnBridge.logout();
    setUser(null);
    setStatus((prev) => ({
      ...prev,
      state: 'Disconnected',
      quotaMaxBytes: FIFTY_GB_BYTES,
      quotaRemainingBytes: FIFTY_GB_BYTES,
    }));
    setActiveSection('dashboard');
  };

  const handleCopyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logs.join('\n'));
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = logs.join('\n');
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    }
  };

  const quota = calculateQuotaSummary(
    status.quotaMaxBytes,
    status.quotaRemainingBytes
  );

  return (
    <div
      dir={lang === 'fa' ? 'rtl' : 'ltr'}
      className={`h-screen max-h-screen flex flex-col overflow-hidden transition-colors ${
        lang === 'fa' ? 'font-vazirmatn' : 'font-sans'
      } ${
        isDark ? 'bg-[#0B0F17] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* Top Bar: Brand Wordmark | Navigation Tabs | Actions (Theme, Language, Quick Connect) */}
      <header
        className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2.5 border-b shrink-0 ${
          isDark
            ? 'bg-slate-950/90 border-slate-800/80'
            : 'bg-white border-slate-200 shadow-2xs'
        }`}
      >
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('dashboard');
          }}
          className="text-sm font-bold tracking-tight whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <img src="/appicon.png" alt="Logo" className="w-5 h-5 rounded-md" />
          <span>{t.appName}</span>
        </a>

        <nav
          aria-label="Primary Workspace Navigation"
          className="flex items-center gap-4 sm:gap-6 text-xs font-semibold overflow-x-auto py-0.5"
        >
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activeSection === 'dashboard'
                ? 'border-orange-500 text-orange-500 font-bold'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-100'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.dashboard}
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('auth')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activeSection === 'auth'
                ? 'border-orange-500 text-orange-500 font-bold'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-100'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.auth}
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('settings')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activeSection === 'settings'
                ? 'border-orange-500 text-orange-500 font-bold'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-100'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.settings}
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('about')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activeSection === 'about'
                ? 'border-orange-500 text-orange-500 font-bold'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-100'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.about}
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {/* Theme Toggle (Light / Dark) */}
          <button
            type="button"
            aria-label={isDark ? t.lightTheme : t.darkTheme}
            onClick={toggleTheme}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-slate-200 hover:text-white'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900'
            }`}
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-slate-700" />
            )}
            <span className="hidden sm:inline">{isDark ? t.lightTheme : t.darkTheme}</span>
          </button>

          {/* Language Toggle (FA / EN) placed right beside theme button */}
          <button
            type="button"
            aria-label="Switch Language"
            onClick={toggleLanguage}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-slate-200 hover:text-white'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900'
            }`}
          >
            <Languages className="w-3.5 h-3.5 text-orange-400" />
            <span>{t.languageToggle}</span>
          </button>

          {/* Primary Quick Connect Action */}
          <button
            type="button"
            onClick={handleToggleConnection}
            className={`px-3.5 py-1 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm ${
              status.state === 'Connected'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/25'
            }`}
          >
            {status.state === 'Connected' ? t.disconnectTunnel : t.quickConnect}
          </button>
        </div>
      </header>

      {/* Main Content Area: Fits perfectly in single viewport without page-level scrollbar */}
      <main className="flex-1 p-3.5 sm:p-4 flex flex-col justify-between overflow-hidden gap-3 max-w-7xl mx-auto w-full">
        {/* Contextual Account Status Toolbar */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-1.5 rounded-xl border text-xs shrink-0 ${
            isDark
              ? 'bg-slate-900/60 border-slate-800/80 text-slate-300'
              : 'bg-white border-slate-200 text-slate-700 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-2">
            <UserCheck className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            {user ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-xs">{user.email}</span>
                <span aria-hidden="true">·</span>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  {t.planActive}
                </span>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setActiveSection('auth')}
                  className="text-orange-400 hover:text-orange-300 underline font-semibold cursor-pointer"
                >
                  {t.switchOrAddAccount}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-amber-500 font-bold">{t.notSignedIn}</span>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setActiveSection('auth')}
                  className="text-orange-400 hover:text-orange-300 underline font-semibold cursor-pointer"
                >
                  {t.signInOrRegister}
                </button>
              </div>
            )}
          </div>

          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.signOut}</span>
            </button>
          )}
        </div>

        {/* View Switcher: Subviews have internal smooth scrolling if needed */}
        {activeSection === 'auth' && (
          <div className="flex-1 overflow-y-auto pr-1">
            <AuthView
              isDark={isDark}
              lang={lang}
              onAuthenticated={(authenticatedUser) => {
                setUser(authenticatedUser);
                setStatus((prev) => ({
                  ...prev,
                  quotaMaxBytes: authenticatedUser.quotaMaxBytes,
                  quotaRemainingBytes: authenticatedUser.quotaRemainingBytes,
                }));
                setActiveSection('dashboard');
              }}
            />
          </div>
        )}

        {activeSection === 'settings' && (
          <div className="flex-1 overflow-y-auto pr-1">
            <SettingsView
              settings={settings}
              isDark={isDark}
              lang={lang}
              onSave={async (updated) => {
                setSettings(updated);
                await vpnBridge.updateSettings(updated);
                const s = await vpnBridge.getStatus();
                setStatus(s);
                setLogs(await vpnBridge.getLogs());
              }}
            />
          </div>
        )}

        {activeSection === 'about' && (
          <div className="flex-1 overflow-y-auto pr-1">
            <AboutView
              isDark={isDark}
              lang={lang}
              onOpenSettings={() => setActiveSection('settings')}
            />
          </div>
        )}

        {activeSection === 'dashboard' && (
          <div className="flex-1 flex flex-col justify-between gap-3 overflow-hidden">
            {/* Bento Grid Row 1: Primary Connection Switch + Fastly Edge & Mode + 50 GB Quota */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch shrink-0">
              {/* Primary Anchor: Connection Switch Card (5 cols) */}
              <section
                aria-label="VPN Connection Control"
                className={`lg:col-span-5 rounded-2xl border p-4 flex flex-col justify-between ${
                  isDark
                    ? 'bg-slate-900/85 border-slate-800'
                    : 'bg-white border-slate-200 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400">
                      {t.tunnelStatus}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`text-base font-bold tracking-tight ${
                          status.state === 'Connected'
                            ? 'text-emerald-400'
                            : status.state === 'Connecting...'
                            ? 'text-amber-400'
                            : isDark
                            ? 'text-slate-200'
                            : 'text-slate-800'
                        }`}
                      >
                        {status.state === 'Connected'
                          ? t.connected
                          : status.state === 'Connecting...'
                          ? t.connecting
                          : t.disconnected}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="font-mono tabular-nums text-xs text-slate-400" dir="ltr">
                        {formatUptime(status.uptimeSeconds)}
                      </span>
                    </div>
                  </div>

                  <div className="text-end text-xs">
                    <span className="text-slate-400 text-[11px]">{t.adapterMode}</span>
                    <div className="font-mono font-bold text-orange-400 text-xs">
                      {status.mode === 'tun' ? 'Wintun TUN' : 'WinINET Proxy'}
                    </div>
                  </div>
                </div>

                {/* Central Power Button: Scaled to fit perfectly */}
                <div className="my-2.5 flex flex-col items-center justify-center">
                  <button
                    type="button"
                    aria-label={status.state === 'Connected' ? t.disconnectTunnel : t.quickConnect}
                    onClick={handleToggleConnection}
                    className={`w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1.5 border-4 transition-all active:scale-95 cursor-pointer ${
                      status.state === 'Connected'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-500/20'
                        : status.state === 'Connecting...'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 animate-pulse'
                        : isDark
                        ? 'bg-slate-950 border-slate-700 hover:border-orange-500 text-slate-200 shadow-md'
                        : 'bg-slate-100 border-slate-300 hover:border-orange-500 text-slate-800 shadow-sm'
                    }`}
                  >
                    <Power className="w-8 h-8" />
                    <span className="text-[11px] font-bold tracking-wide">
                      {status.state === 'Connected'
                        ? t.connected
                        : status.state === 'Connecting...'
                        ? t.dialing
                        : t.tapToConnect}
                    </span>
                  </button>
                </div>

                {/* Exit Verification Footer */}
                <div
                  className={`pt-2.5 border-t flex items-center justify-between text-xs ${
                    isDark ? 'border-slate-800' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck
                      className={`w-3.5 h-3.5 ${
                        status.exitVerified ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    />
                    <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                      {t.exitVerifiedNotice}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-xs" dir="ltr">
                    {status.exitVerified
                      ? `${status.exitIp} (${status.exitCountry})`
                      : t.notTunneled}
                  </span>
                </div>
              </section>

              {/* Right 7 Cols: Server Selector & Mode + 50 GB Monthly Allowance */}
              <div className="lg:col-span-7 flex flex-col justify-between gap-3">
                {/* Active Fastly Edge Location & Tunnel Mode Selector */}
                <section
                  aria-label="Fastly Edge Server and Routing Mode"
                  className={`rounded-2xl border p-3.5 space-y-2.5 ${
                    isDark
                      ? 'bg-slate-900/85 border-slate-800'
                      : 'bg-white border-slate-200 shadow-2xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl leading-none select-none" aria-hidden="true">
                        {countryCodeToFlag(selectedServer.countryCode)}
                      </span>
                      <div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <span>{lang === 'fa' ? 'نود اتصال Fastly' : 'Fastly Edge Endpoint'}</span>
                          {selectedServer.id === 'auto' && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">
                              AUTO
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold tracking-tight">
                          {selectedServer.id === 'auto'
                            ? t.autoServerTitle
                            : `${selectedServer.countryName} — ${selectedServer.cityName}`}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400" dir="ltr">
                          {selectedServer.host}:{selectedServer.port} ·{' '}
                          <span className="text-emerald-400 tabular-nums font-bold">
                            {selectedServer.latencyMs} ms
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowServerModal(true)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 hover:border-orange-500 text-slate-100'
                          : 'bg-slate-50 border-slate-300 hover:border-orange-500 text-slate-900'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5 text-orange-400" />
                      <span>{t.changeLocation}</span>
                    </button>
                  </div>

                  {/* Segmented Mode Switcher: Wintun TUN vs System Proxy */}
                  <div
                    className={`pt-2.5 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      isDark ? 'border-slate-800' : 'border-slate-200'
                    }`}
                  >
                    <div className="text-xs">
                      <span className="font-bold">{t.routingEngine}</span>{' '}
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                        {settings.mode === 'tun' ? t.wintunTunMode : t.systemProxyMode}
                      </span>
                    </div>

                    <div
                      role="group"
                      aria-label="Select Tunnel Routing Mode"
                      className={`inline-flex p-0.5 rounded-xl border ${
                        isDark
                          ? 'bg-slate-950 border-slate-800'
                          : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleModeQuickSwitch('tun')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                          settings.mode === 'tun'
                            ? 'bg-orange-500 text-white'
                            : isDark
                            ? 'text-slate-400 hover:text-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Wintun Full TUN
                      </button>
                      <button
                        type="button"
                        onClick={() => handleModeQuickSwitch('proxy')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                          settings.mode === 'proxy'
                            ? 'bg-orange-500 text-white'
                            : isDark
                            ? 'text-slate-400 hover:text-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        System Proxy
                      </button>
                    </div>
                  </div>
                </section>

                {/* 50 GB Monthly Allowance Progress Card */}
                <section
                  aria-label="Monthly Quota Card"
                  className={`rounded-2xl border p-3.5 space-y-2.5 ${
                    isDark
                      ? 'bg-slate-900/85 border-slate-800'
                      : 'bg-white border-slate-200 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold tracking-tight">
                        {t.monthlyAllowanceTitle}
                      </h2>
                      <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {t.monthlyAllowanceSubtitle}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                        quota.healthState === 'nominal'
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          : quota.healthState === 'warning'
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                          : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {quota.remainingGB} GB {t.leftOfTotal} {quota.totalGB} GB
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div
                      className={`h-2.5 rounded-full overflow-hidden p-0.5 border ${
                        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          quota.healthState === 'nominal'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : quota.healthState === 'warning'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                            : 'bg-gradient-to-r from-rose-500 to-red-400'
                        }`}
                        style={{ width: `${Math.min(100, quota.usedPercent)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400" dir="ltr">
                      <span>{t.usedThisCycle} {quota.usedGB} GB ({quota.usedPercent}%)</span>
                      <span className="font-bold text-slate-200">{quota.remainingPercent}% Available</span>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Bento Grid Row 2: Live Network Telemetry & Diagnostics Log */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch flex-1 min-h-0">
              {/* Left 6 cols: Live Throughput Graph */}
              <section
                aria-label="Throughput Monitoring"
                className={`lg:col-span-6 rounded-2xl border p-3 flex flex-col justify-between space-y-2 ${
                  isDark
                    ? 'bg-slate-900/85 border-slate-800'
                    : 'bg-white border-slate-200 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xs font-bold tracking-tight">
                      {t.realtimeThroughput}
                    </h2>
                    <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t.pingRtt} <span className="font-mono font-bold text-emerald-400">{status.pingMs} ms</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono" dir="ltr">
                    <div className="flex items-center gap-1 text-emerald-400">
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span className="font-bold">{formatRate(rxRate)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-purple-400">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span className="font-bold">{formatRate(txRate)}</span>
                    </div>
                  </div>
                </div>

                {/* Sparkline Canvas: Compact height to fit in viewport */}
                <div
                  className={`h-16 rounded-xl border p-1.5 flex items-end gap-1 overflow-hidden ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                  dir="ltr"
                >
                  {speedHistory.map((val, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-xs bg-gradient-to-t from-orange-500/30 to-orange-400 transition-all duration-300"
                      style={{ height: `${val}%` }}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400" dir="ltr">
                  <span>{t.sessionRx} {formatBytes(status.downloadedBytes)}</span>
                  <span>{t.sessionTx} {formatBytes(status.uploadedBytes)}</span>
                </div>
              </section>

              {/* Right 6 cols: Control-Plane Diagnostics Console with COPY button */}
              <section
                aria-label="Diagnostic Logs"
                className={`lg:col-span-6 rounded-2xl border p-3 flex flex-col justify-between space-y-1.5 min-h-0 ${
                  isDark
                    ? 'bg-slate-900/85 border-slate-800'
                    : 'bg-white border-slate-200 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-orange-400" />
                    <h2 className="text-xs font-bold tracking-tight">
                      {t.logsTitle}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Copy Logs Button */}
                    <button
                      type="button"
                      onClick={handleCopyLogs}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        copiedLogs
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                          : isDark
                          ? 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900'
                      }`}
                      title={t.copyLogs}
                    >
                      {copiedLogs ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>{t.logsCopied}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-orange-400" />
                          <span>{t.copyLogs}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const l = await vpnBridge.getLogs();
                        setLogs(l);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-100 cursor-pointer"
                      title={t.refresh}
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogs([])}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                      title={t.clear}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Console Log Terminal with Internal Scroll */}
                <div
                  className={`h-20 sm:h-24 rounded-xl p-2 font-mono text-[10px] overflow-y-auto space-y-0.5 border ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-300'
                      : 'bg-slate-950 border-slate-800 text-slate-200'
                  }`}
                  dir="ltr"
                >
                  {logs.length === 0 ? (
                    <div className="text-slate-500 italic">No logs recorded yet.</div>
                  ) : (
                    logs.map((line, idx) => (
                      <div
                        key={idx}
                        className={
                          line.includes('[ERROR]')
                            ? 'text-rose-400'
                            : line.includes('[WARN ]')
                            ? 'text-amber-400'
                            : 'text-slate-300'
                        }
                      >
                        {line}
                      </div>
                    ))
                  )}
                </div>

                <div className="text-end text-[10px] font-mono text-slate-400">
                  Wintun v0.14.1 · HTTP/2 Multiplexed Tunnel
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Server Selection Modal */}
      {showServerModal && (
        <ServerSelectorModal
          servers={servers}
          selectedServerId={selectedServer.id}
          isDark={isDark}
          lang={lang}
          onSelect={handleSelectServer}
          onClose={() => setShowServerModal(false)}
          onRefreshServers={(updated) => setServers(updated)}
        />
      )}
    </div>
  );
}
