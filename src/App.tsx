import React, { useEffect, useState } from 'react';
import {
  Power,
  Globe,
  Sliders,
  Terminal,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  UserCheck,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  FIFTY_GB_BYTES,
  calculateQuotaSummary,
  countryCodeToFlag,
  formatBytes,
  formatRate,
  formatUptime,
  type ClientSettings,
  type ConnectionStatus,
  type ServerInfo,
  type UserInfo,
} from './utils/vpnLogic';
import { DEFAULT_SERVERS, vpnBridge } from './utils/wailsBridge';
import { AuthView } from './components/AuthView';
import { ServerSelectorModal } from './components/ServerSelectorModal';
import { SettingsView } from './components/SettingsView';
import { BuildReleaseView } from './components/BuildReleaseView';

type ActiveSection = 'dashboard' | 'servers' | 'settings' | 'build' | 'auth';

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [user, setUser] = useState<UserInfo | null>({
    email: 'mostafa.fxa@firefox.com',
    uid: 'fxa-89f2c401a',
    verified: true,
    requiresVerification: false,
    subscribed: true,
    quotaMaxBytes: FIFTY_GB_BYTES,
    quotaRemainingBytes: Math.floor(FIFTY_GB_BYTES * 0.914),
    quotaResetEpoch: Math.floor(Date.now() / 1000) + 21 * 86400,
    tokenPoolCount: 1,
  });

  const [servers, setServers] = useState<ServerInfo[]>(DEFAULT_SERVERS);
  const [selectedServer, setSelectedServer] = useState<ServerInfo>(DEFAULT_SERVERS[0]);
  const [showServerModal, setShowServerModal] = useState(false);

  const [settings, setSettings] = useState<ClientSettings>({
    mode: 'tun',
    tlsSplitMode: 'record',
    dohProvider: '1.1.1.1',
    mtu: 1380,
    killSwitch: true,
    controlPlaneProxy: '',
    edgeOverrideIp: '',
  });

  const [status, setStatus] = useState<ConnectionStatus>({
    state: 'Disconnected',
    mode: 'tun',
    serverId: DEFAULT_SERVERS[0].id,
    serverLabel: `${DEFAULT_SERVERS[0].countryName} — ${DEFAULT_SERVERS[0].cityName}`,
    uptimeSeconds: 0,
    uploadedBytes: 0,
    downloadedBytes: 0,
    pingMs: DEFAULT_SERVERS[0].latencyMs,
    exitIp: '—',
    exitCountry: '—',
    exitVerified: false,
    quotaMaxBytes: FIFTY_GB_BYTES,
    quotaRemainingBytes: Math.floor(FIFTY_GB_BYTES * 0.914),
  });

  const [rxRate, setRxRate] = useState(0);
  const [txRate, setTxRate] = useState(0);
  const [speedHistory, setSpeedHistory] = useState<number[]>(
    Array.from({ length: 24 }, () => 8)
  );
  const [logs, setLogs] = useState<string[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(true);

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

  // Poll telemetry when connected
  useEffect(() => {
    const timer = setInterval(async () => {
      if (status.state === 'Connected') {
        const simRx = Math.floor(420_000 + Math.random() * 1_850_000);
        const simTx = Math.floor(85_000 + Math.random() * 340_000);
        const updated = vpnBridge.tickSimulation(simTx, simRx);
        setStatus(updated);
        setRxRate(simRx);
        setTxRate(simTx);
        setSpeedHistory((prev) => [
          ...prev.slice(1),
          Math.min(100, Math.max(12, Math.round((simRx / 2_400_000) * 100))),
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

  const quota = calculateQuotaSummary(
    status.quotaMaxBytes,
    status.quotaRemainingBytes
  );

  return (
    <div
      className={`min-h-screen transition-colors ${
        isDark ? 'bg-[#0B0F17] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* Top Bar Contract: 3 Zones (Brand Wordmark | 5 Single-Line Nav Links | 1 Primary Action) */}
      <header
        className={`flex flex-wrap items-center justify-between gap-y-3 gap-x-8 px-6 py-4 border-b ${
          isDark
            ? 'bg-slate-950/80 border-slate-800/80'
            : 'bg-white border-slate-200'
        }`}
      >
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('dashboard');
          }}
          className="text-base font-bold tracking-tight whitespace-nowrap shrink-0 order-1"
        >
          FoxyVPN Windows
        </a>

        <nav
          aria-label="Primary Workspace Navigation"
          className="w-full md:w-auto order-3 md:order-2 flex items-center gap-5 sm:gap-6 text-xs sm:text-sm font-medium overflow-x-auto pb-1 md:pb-0"
        >
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activeSection === 'dashboard'
                ? 'border-orange-500 text-orange-400 font-semibold'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-100'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('auth')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activeSection === 'auth'
                ? 'border-orange-500 text-orange-400 font-semibold'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-100'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In / Register
          </button>

          <button
            type="button"
            onClick={() => setShowServerModal(true)}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent transition-colors cursor-pointer ${
              isDark
                ? 'text-slate-400 hover:text-slate-100'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Edge Servers ({servers.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('settings')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activeSection === 'settings'
                ? 'border-orange-500 text-orange-400 font-semibold'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-100'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Tunnel Settings
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('build')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activeSection === 'build'
                ? 'border-orange-500 text-orange-400 font-semibold'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-100'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            GitHub CI Build
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0 order-2 md:order-3">
          <button
            type="button"
            onClick={handleToggleConnection}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              status.state === 'Connected'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            {status.state === 'Connected' ? 'Disconnect Tunnel' : 'Quick Connect'}
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Contextual Workspace Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs">
            <UserCheck className="w-4 h-4 text-orange-400" />
            {user ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{user.email}</span>
                <span aria-hidden="true">·</span>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  Mozilla Guardian 50 GB Plan Active
                </span>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setActiveSection('auth')}
                  className="text-orange-400 hover:text-orange-300 underline font-medium cursor-pointer"
                >
                  Switch or Create Account
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-amber-400">Not signed in</span>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setActiveSection('auth')}
                  className="text-orange-400 hover:text-orange-300 underline font-medium cursor-pointer"
                >
                  Sign In or Register Free Account
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              onClick={() => setIsDark(!isDark)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer ${
                isDark
                  ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900'
              }`}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
              <span>{isDark ? 'Light Theme' : 'Dark Theme'}</span>
            </button>
          </div>
        </div>

        {/* Active View Routing */}
        {activeSection === 'auth' && (
          <AuthView
            isDark={isDark}
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
        )}

        {activeSection === 'settings' && (
          <SettingsView
            settings={settings}
            isDark={isDark}
            onSave={async (updated) => {
              setSettings(updated);
              await vpnBridge.updateSettings(updated);
              const s = await vpnBridge.getStatus();
              setStatus(s);
              setLogs(await vpnBridge.getLogs());
            }}
          />
        )}

        {activeSection === 'build' && <BuildReleaseView isDark={isDark} />}

        {activeSection === 'dashboard' && (
          <>
            {/* Bento Grid Row 1: Primary Connection Control + Server & Mode + 50 GB Monthly Allowance */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Primary Visual Anchor: Connection Switch Card (5 cols) */}
              <section
                aria-label="VPN Connection Control"
                className={`lg:col-span-5 rounded-2xl border p-6 flex flex-col justify-between ${
                  isDark
                    ? 'bg-slate-900/85 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-400">
                      Tunnel Status
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`text-lg font-bold tracking-tight ${
                          status.state === 'Connected'
                            ? 'text-emerald-400'
                            : status.state === 'Connecting...'
                            ? 'text-amber-400'
                            : isDark
                            ? 'text-slate-200'
                            : 'text-slate-800'
                        }`}
                      >
                        {status.state}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="font-mono tabular-nums text-xs text-slate-400">
                        {formatUptime(status.uptimeSeconds)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    <span className="text-slate-400">Adapter Mode</span>
                    <div className="font-mono font-semibold text-orange-400">
                      {status.mode === 'tun' ? 'Wintun TUN' : 'WinINET Proxy'}
                    </div>
                  </div>
                </div>

                {/* Central Power Button */}
                <div className="my-8 flex flex-col items-center justify-center">
                  <button
                    type="button"
                    aria-label={
                      status.state === 'Connected'
                        ? 'Disconnect VPN Tunnel'
                        : 'Connect VPN Tunnel'
                    }
                    onClick={handleToggleConnection}
                    className={`w-36 h-36 rounded-full flex flex-col items-center justify-center gap-2 border-4 transition-transform active:scale-95 cursor-pointer ${
                      status.state === 'Connected'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-500/15'
                        : status.state === 'Connecting...'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                        : isDark
                        ? 'bg-slate-950 border-slate-700 hover:border-orange-500 text-slate-200'
                        : 'bg-slate-100 border-slate-300 hover:border-orange-500 text-slate-800'
                    }`}
                  >
                    <Power className="w-10 h-10" />
                    <span className="text-xs font-bold tracking-wide">
                      {status.state === 'Connected'
                        ? 'Connected'
                        : status.state === 'Connecting...'
                        ? 'Dialing...'
                        : 'Tap to Connect'}
                    </span>
                  </button>
                </div>

                {/* Exit Verification Footer */}
                <div
                  className={`pt-4 border-t flex items-center justify-between text-xs ${
                    isDark ? 'border-slate-800' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className={`w-4 h-4 ${
                        status.exitVerified ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    />
                    <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                      Exit IP (Cloudflare Trace):
                    </span>
                  </div>
                  <span className="font-mono tabular-nums font-semibold">
                    {status.exitVerified
                      ? `${status.exitIp} (${status.exitCountry})`
                      : 'Not Tunneled'}
                  </span>
                </div>
              </section>

              {/* Right 7 Cols: Server Selector + Mode Switcher + 50 GB Monthly Allowance */}
              <div className="lg:col-span-7 flex flex-col justify-between gap-6">
                {/* Active Fastly Edge Location & Tunnel Mode Selector */}
                <section
                  aria-label="Fastly Edge Server and Routing Mode"
                  className={`rounded-2xl border p-6 space-y-4 ${
                    isDark
                      ? 'bg-slate-900/85 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <span className="text-3xl leading-none select-none" aria-hidden="true">
                        {countryCodeToFlag(selectedServer.countryCode)}
                      </span>
                      <div>
                        <div className="text-xs text-slate-400">
                          Fastly Edge Endpoint
                        </div>
                        <div className="text-base font-bold tracking-tight">
                          {selectedServer.countryName} — {selectedServer.cityName}
                        </div>
                        <div className="text-xs font-mono text-slate-400">
                          {selectedServer.host}:{selectedServer.port} ·{' '}
                          <span className="text-emerald-400 tabular-nums">
                            {selectedServer.latencyMs} ms
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowServerModal(true)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 hover:border-orange-500 text-slate-100'
                          : 'bg-slate-50 border-slate-300 hover:border-orange-500 text-slate-900'
                      }`}
                    >
                      <Globe className="w-4 h-4 text-orange-400" />
                      <span>Change Location</span>
                    </button>
                  </div>

                  {/* Segmented Mode Switcher: Wintun TUN vs System Proxy */}
                  <div
                    className={`pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isDark ? 'border-slate-800' : 'border-slate-200'
                    }`}
                  >
                    <div className="text-xs">
                      <span className="font-semibold">Routing Engine:</span>{' '}
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                        {settings.mode === 'tun'
                          ? 'Wintun Layer-3 Adapter (10.0.0.2/24) + DoH'
                          : 'SOCKS5 (127.0.0.1:1080) + WinINET Registry'}
                      </span>
                    </div>

                    <div
                      role="group"
                      aria-label="Select Tunnel Routing Mode"
                      className={`inline-flex p-1 rounded-xl border ${
                        isDark
                          ? 'bg-slate-950 border-slate-800'
                          : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleModeQuickSwitch('tun')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
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

                {/* 50 GB Monthly Allowance Gauge Card */}
                <section
                  aria-label="Monthly 50 GB Traffic Quota"
                  className={`rounded-2xl border p-6 space-y-4 ${
                    isDark
                      ? 'bg-slate-900/85 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold tracking-tight">
                        Mozilla Guardian Monthly Traffic Allowance
                      </h3>
                      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Free 50 GB/month browser VPN quota · Auto-refreshes JWT ProxyPass
                      </p>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <span className="text-base font-bold text-orange-400">
                        {quota.remainingGB} GB
                      </span>
                      <span className="text-xs text-slate-400">
                        {' '}
                        / {quota.totalGB} GB left
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div
                    className={`w-full h-3 rounded-full overflow-hidden ${
                      isDark ? 'bg-slate-950' : 'bg-slate-200'
                    }`}
                  >
                    <div
                      className={`h-full transition-all duration-300 ${
                        quota.healthState === 'critical'
                          ? 'bg-red-500'
                          : quota.healthState === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(4, quota.remainingPercent)}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-mono tabular-nums">
                    <span>Used this cycle: {quota.usedGB} GB ({quota.usedPercent}%)</span>
                    <span>·</span>
                    <span>
                      TLS Split: {settings.tlsSplitMode.toUpperCase()} · DoH: {settings.dohProvider}
                    </span>
                  </div>
                </section>
              </div>
            </div>

            {/* Bento Grid Row 2: Live Throughput Telemetry & Sparkline */}
            <section
              aria-label="Live Network Throughput"
              className={`rounded-2xl border p-6 ${
                isDark
                  ? 'bg-slate-900/85 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                    <span>Download Rate</span>
                  </div>
                  <div className="font-mono tabular-nums text-xl font-bold">
                    {formatRate(rxRate)}
                  </div>
                  <div className="font-mono tabular-nums text-xs text-slate-400">
                    Session RX: {formatBytes(status.downloadedBytes)}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <ArrowUpRight className="w-4 h-4 text-orange-400" />
                    <span>Upload Rate</span>
                  </div>
                  <div className="font-mono tabular-nums text-xl font-bold">
                    {formatRate(txRate)}
                  </div>
                  <div className="font-mono tabular-nums text-xs text-slate-400">
                    Session TX: {formatBytes(status.uploadedBytes)}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Real-Time HTTP/2 Stream Throughput</span>
                    <span className="font-mono tabular-nums">
                      Ping RTT: {status.pingMs} ms
                    </span>
                  </div>
                  <div className="h-14 flex items-end gap-1">
                    {speedHistory.map((val, idx) => (
                      <div
                        key={idx}
                        className={`flex-1 rounded-t transition-all duration-300 ${
                          status.state === 'Connected'
                            ? 'bg-emerald-500/70'
                            : isDark
                            ? 'bg-slate-800'
                            : 'bg-slate-200'
                        }`}
                        style={{ height: `${ status.state === 'Connected' ? val : 12 }%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Bento Grid Row 3: Collapsible Connection Logs Console */}
            <section
              aria-label="Connection Diagnostics Log Console"
              className={`rounded-2xl border overflow-hidden ${
                isDark
                  ? 'bg-slate-900/90 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="px-6 py-4 flex items-center justify-between">
                <button
                  type="button"
                  aria-expanded={logsExpanded}
                  onClick={() => setLogsExpanded(!logsExpanded)}
                  className="flex items-center gap-2.5 text-sm font-semibold cursor-pointer"
                >
                  <Terminal className="w-4 h-4 text-orange-400" />
                  <span>Wintun & Guardian Control-Plane Logs ({logs.length})</span>
                  {logsExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => setLogs(await vpnBridge.getLogs())}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
                      isDark
                        ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      vpnBridge.clearLogs();
                      setLogs(await vpnBridge.getLogs());
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
                      isDark
                        ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {logsExpanded && (
                <div
                  className={`px-6 pb-5 pt-2 border-t font-mono text-xs space-y-1.5 max-h-56 overflow-y-auto ${
                    isDark
                      ? 'bg-slate-950/90 border-slate-800 text-slate-300'
                      : 'bg-slate-900 border-slate-200 text-slate-200'
                  }`}
                >
                  {logs.map((entry, idx) => (
                    <div key={idx} className="leading-relaxed break-all">
                      {entry}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Server Selector Modal */}
      {showServerModal && (
        <ServerSelectorModal
          servers={servers}
          selectedServerId={selectedServer.id}
          onSelect={handleSelectServer}
          onClose={() => setShowServerModal(false)}
          isDark={isDark}
        />
      )}
    </div>
  );
}
