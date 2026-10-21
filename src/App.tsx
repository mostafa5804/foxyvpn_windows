import React, { useEffect, useState } from 'react';
import {
  Power,
  Globe,
  Sun,
  Moon,
  Copy,
  Check,
  Languages,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  Trash2,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  Zap,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
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
import { DEFAULT_SERVERS, vpnBridge, openExternalUrl, type PoolAccountItem } from './utils/wailsBridge';
import { translations, type Language } from './utils/i18n';
import { ServerSelectorModal } from './components/ServerSelectorModal';

type ActiveTab = 'dashboard' | 'account' | 'settings' | 'about';

export default function App() {
  // Theme state: Default Light as requested ("تم پیش فرض هم روشن باشه")
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('foxyvpn_theme');
      if (saved) return saved === 'dark';
    }
    return false; // Default Light
  });

  // Language state: Default Persian ('fa')
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('foxyvpn_lang');
      if (saved === 'en' || saved === 'fa') return saved;
    }
    return 'fa';
  });

  const t = translations[lang];

  // Active bottom navigation tab: 'dashboard' | 'account' | 'settings' | 'about'
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // User state: Persistent, null if no account added yet
  const [user, setUser] = useState<UserInfo | null>(() => vpnBridge.getCurrentUser());

  // Multi-account pool state
  const [accountList, setAccountList] = useState<PoolAccountItem[]>(() => vpnBridge.getAccountPool());

  // Server state & selection (Auto is default)
  const [servers, setServers] = useState<ServerInfo[]>(DEFAULT_SERVERS);
  const [selectedServer, setSelectedServer] = useState<ServerInfo>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedId = window.localStorage.getItem('foxyvpn_server_id');
      if (savedId) {
        const found = DEFAULT_SERVERS.find((s) => s.id === savedId);
        if (found) return found;
      }
    }
    return AUTO_SERVER;
  });

  const [showServerModal, setShowServerModal] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<ClientSettings>({
    mode: 'tun',
    tlsSplitMode: 'sni',
    dohProvider: '1.1.1.1',
    mtu: 1380,
    killSwitch: true,
    controlPlaneProxy: '',
    edgeOverrideIp: '',
  });

  // Settings form draft state
  const [settingsDraft, setSettingsDraft] = useState<ClientSettings>({ ...settings });
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);
  const [showLogsInSettings, setShowLogsInSettings] = useState(false);

  // Connection status
  const [status, setStatus] = useState<ConnectionStatus>({
    state: 'Disconnected',
    mode: 'tun',
    serverId: AUTO_SERVER.id,
    serverLabel: `${AUTO_SERVER.countryName} — ${AUTO_SERVER.cityName}`,
    uptimeSeconds: 0,
    uploadedBytes: 0,
    downloadedBytes: 0,
    pingMs: AUTO_SERVER.latencyMs,
    exitIp: '2a00:8c40:f0c4::a0e4',
    exitCountry: 'FI',
    exitVerified: true,
    quotaMaxBytes: user ? user.quotaMaxBytes : FIFTY_GB_BYTES,
    quotaRemainingBytes: user ? user.quotaRemainingBytes : FIFTY_GB_BYTES,
  });

  // Live traffic & speed
  const [rxRate, setRxRate] = useState(0);
  const [txRate, setTxRate] = useState(0);
  const [speedHistory, setSpeedHistory] = useState<number[]>([
    12, 18, 25, 40, 30, 20, 15, 28, 45, 60, 50, 35, 42, 65, 55, 48, 52, 70, 60, 45, 50, 68, 80, 65, 58, 62, 75, 70,
  ]);
  const [logs, setLogs] = useState<string[]>([
    '11:18:05 INFO Client started · Wintun + H2 + DoH',
    '11:18:06 INFO Activating free 50 GB entitlement…',
    '11:18:57 INFO mode=tun · tls-split=sni · mtu=1380',
  ]);
  const [copiedLogs, setCopiedLogs] = useState(false);

  // Auth Form State (for Account Tab: Login, Register, Pool)
  const [authFormTab, setAuthFormTab] = useState<'signin' | 'signup' | 'pool'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Toggle Theme
  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('foxyvpn_theme', next ? 'dark' : 'light');
      }
      return next;
    });
  };

  // Toggle Language
  const toggleLanguage = () => {
    setLang((prev) => {
      const next: Language = prev === 'fa' ? 'en' : 'fa';
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('foxyvpn_lang', next);
      }
      return next;
    });
  };

  // Initial load: restore data & run immediate live ping test so ping is accurate right from app open
  useEffect(() => {
    let mounted = true;

    // Run live ping measurement immediately on open so accurate latency is shown right away
    vpnBridge.refreshAllPings().then((refreshed) => {
      if (!mounted) return;
      if (refreshed && refreshed.length > 0) {
        setServers(refreshed);
        setSelectedServer((prev) => {
          const match = refreshed.find((s) => s.id === prev.id);
          return match ? { ...prev, latencyMs: match.latencyMs } : prev;
        });
        setStatus((prev) => {
          const match = refreshed.find((s) => s.id === prev.serverId);
          return match ? { ...prev, pingMs: match.latencyMs } : prev;
        });
      }
    }).catch(() => {
      vpnBridge.getServers().then((list) => {
        if (mounted && list.length > 0) setServers(list);
      });
    });

    vpnBridge.getLogs().then((l) => {
      if (mounted && l.length > 0) setLogs(l);
    });
    const u = vpnBridge.getCurrentUser();
    if (u) {
      setUser(u);
      setStatus((prev) => ({
        ...prev,
        quotaMaxBytes: u.quotaMaxBytes,
        quotaRemainingBytes: u.quotaRemainingBytes,
      }));
    }
    setAccountList(vpnBridge.getAccountPool());
    return () => {
      mounted = false;
    };
  }, []);

  // 60-Second auto-refresh timer for server list latency when the app is idle
  useEffect(() => {
    let lastActivity = Date.now();
    const markActivity = () => {
      lastActivity = Date.now();
    };

    window.addEventListener('mousemove', markActivity, { passive: true });
    window.addEventListener('keydown', markActivity, { passive: true });
    window.addEventListener('click', markActivity, { passive: true });
    window.addEventListener('touchstart', markActivity, { passive: true });

    const pingTimer = setInterval(async () => {
      // Idle condition: no user interaction in the last 15s, and app is not connecting
      const isIdle = Date.now() - lastActivity >= 15000;
      if (isIdle && status.state !== 'Connecting...') {
        try {
          const refreshed = await vpnBridge.refreshAllPings();
          setServers(refreshed);
          setSelectedServer((prev) => {
            const match = refreshed.find((s) => s.id === prev.id);
            return match ? { ...prev, latencyMs: match.latencyMs } : prev;
          });
          setStatus((prev) => {
            const match = refreshed.find((s) => s.id === prev.serverId);
            return match ? { ...prev, pingMs: match.latencyMs } : prev;
          });
        } catch {
          // Ignore background ping errors
        }
      }
    }, 60000);

    return () => {
      clearInterval(pingTimer);
      window.removeEventListener('mousemove', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('click', markActivity);
      window.removeEventListener('touchstart', markActivity);
    };
  }, [status.state]);

  // Live Telemetry Loop
  useEffect(() => {
    let lastRx = status.downloadedBytes;
    let lastTx = status.uploadedBytes;

    const timer = setInterval(async () => {
      if (status.state === 'Connected') {
        let currentRx = 0;
        let currentTx = 0;
        if (vpnBridge.isNative) {
          const live = await vpnBridge.getStatus();
          setStatus(live);
          currentRx = Math.max(0, live.downloadedBytes - lastRx);
          currentTx = Math.max(0, live.uploadedBytes - lastTx);
          lastRx = live.downloadedBytes;
          lastTx = live.uploadedBytes;
        } else {
          const simRx = Math.floor(25_000 + Math.random() * 45_000);
          const simTx = Math.floor(2_000 + Math.random() * 8_000);
          const updated = vpnBridge.tickSimulation(simTx, simRx);
          setStatus(updated);
          currentRx = simRx;
          currentTx = simTx;
        }
        setRxRate(currentRx);
        setTxRate(currentTx);
        setSpeedHistory((prev) => [
          ...prev.slice(1),
          Math.min(95, Math.max(15, Math.round(((currentRx || 35000) / 100000) * 100))),
        ]);
      } else {
        setRxRate(0);
        setTxRate(0);
      }
      const curLogs = await vpnBridge.getLogs();
      if (curLogs.length > 0) setLogs(curLogs);
    }, 1000);

    return () => clearInterval(timer);
  }, [status.state]);

  // Connect / Disconnect Handler
  const handleToggleConnection = async () => {
    if (!user) {
      // If no account, switch to Account tab so user logs in or creates account
      setActiveTab('account');
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

  // Server selection
  const handleSelectServer = async (srv: ServerInfo) => {
    setSelectedServer(srv);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('foxyvpn_server_id', srv.id);
    }
    if (status.state === 'Connected') {
      await vpnBridge.connect(srv.id, settings.mode);
      const s = await vpnBridge.getStatus();
      setStatus(s);
      setLogs(await vpnBridge.getLogs());
    } else {
      setStatus((prev) => ({
        ...prev,
        serverId: srv.id,
        serverLabel: `${srv.countryName} — ${srv.cityName}`,
        pingMs: srv.latencyMs,
      }));
    }
  };

  // Mode quick switch (Tun / Proxy)
  const handleModeSwitch = async (newMode: 'tun' | 'proxy') => {
    const next: ClientSettings = { ...settings, mode: newMode };
    setSettings(next);
    setSettingsDraft((prev) => ({ ...prev, mode: newMode }));
    await vpnBridge.updateSettings(next);
    if (status.state === 'Connected') {
      await vpnBridge.connect(selectedServer.id, newMode);
    }
    const s = await vpnBridge.getStatus();
    setStatus(s);
    setLogs(await vpnBridge.getLogs());
  };

  // Copy logs
  const handleCopyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logs.join('\n'));
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    } catch {
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

  // Sign out
  const handleSignOut = async () => {
    await vpnBridge.logout();
    setUser(null);
    setStatus((prev) => ({
      ...prev,
      state: 'Disconnected',
      quotaMaxBytes: FIFTY_GB_BYTES,
      quotaRemainingBytes: FIFTY_GB_BYTES,
    }));
    setAccountList(vpnBridge.getAccountPool());
  };

  // Quick account generation helper (for fast testing / allowance adding)
  const handleQuickAddAccount = async (target: 'pool' | 'direct') => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      const randomId = Math.random().toString(36).substring(2, 8);
      const quickEmail = `foxy.${randomId}@rover.info`;
      const quickPass = `Pass!${randomId}#9`;
      let newUser: UserInfo;
      if (target === 'pool') {
        newUser = await vpnBridge.addAccountToPool(quickEmail, quickPass);
        const poolCountNow = vpnBridge.getAccountPool().length;
        setAuthSuccess(
          lang === 'fa'
            ? `اکانت ۵۰ گیگابایت خودکار (${quickEmail}) به استخر اضافه شد! سهمیه کل: ${poolCountNow * 50} گیگابایت`
            : `Auto 50 GB account (${quickEmail}) added to pool! Total quota: ${poolCountNow * 50} GB`
        );
      } else {
        newUser = await vpnBridge.registerAccount(quickEmail, quickPass);
        setAuthSuccess(
          lang === 'fa'
            ? `اکانت ۵۰ گیگابایت (${quickEmail}) ساخته و فعال شد!`
            : `Account (${quickEmail}) registered with 50 GB!`
        );
      }
      setUser(newUser);
      setAccountList(vpnBridge.getAccountPool());
      setStatus((prev) => ({
        ...prev,
        quotaMaxBytes: newUser.quotaMaxBytes,
        quotaRemainingBytes: newUser.quotaRemainingBytes,
      }));
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Error generating account');
    } finally {
      setAuthLoading(false);
    }
  };

  // Auth Form Submit (Supports Login, Register, Pool)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError(
        lang === 'fa'
          ? 'لطفاً نام کاربری / ایمیل و رمز عبور را وارد کنید'
          : 'Please enter username/email and password'
      );
      return;
    }

    setAuthLoading(true);
    try {
      let loggedUser: UserInfo;
      if (authFormTab === 'pool') {
        loggedUser = await vpnBridge.addAccountToPool(authEmail.trim(), authPassword);
        const count = vpnBridge.getAccountPool().length;
        setAuthSuccess(
          lang === 'fa'
            ? `اکانت جدید به استخر اضافه شد (+۵۰ گیگابایت). سهمیه تجمیعی استخر: ${count * 50} گیگابایت!`
            : `Account added to pool (+50 GB). Total combined quota: ${count * 50} GB!`
        );
      } else if (authFormTab === 'signup') {
        loggedUser = await vpnBridge.registerAccount(authEmail.trim(), authPassword);
        setAuthSuccess(
          lang === 'fa'
            ? 'ثبت‌نام انجام شد و اکانت با ۵۰ گیگابایت سهمیه فعال گردید'
            : 'Signed up successfully with 50 GB allowance'
        );
      } else {
        loggedUser = await vpnBridge.login(authEmail.trim(), authPassword);
        setAuthSuccess(
          lang === 'fa' ? 'ورود با موفقیت انجام شد' : 'Signed in successfully'
        );
      }
      setUser(loggedUser);
      setAccountList(vpnBridge.getAccountPool());
      setStatus((prev) => ({
        ...prev,
        quotaMaxBytes: loggedUser.quotaMaxBytes,
        quotaRemainingBytes: loggedUser.quotaRemainingBytes,
      }));
      setAuthEmail('');
      setAuthPassword('');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Switch to an account from the pool
  const handleSelectPoolAccount = async (accountItem: PoolAccountItem) => {
    if (accountItem.id) {
      const switched = await vpnBridge.switchActivePoolAccount(accountItem.id);
      setUser(switched);
      setAccountList(vpnBridge.getAccountPool());
      setStatus((prev) => ({
        ...prev,
        quotaMaxBytes: switched.quotaMaxBytes,
        quotaRemainingBytes: switched.quotaRemainingBytes,
      }));
    } else {
      const switchedUser: UserInfo = {
        uid: accountItem.id || 'usr_' + Math.random().toString(36).substring(2, 8),
        email: accountItem.email,
        verified: true,
        requiresVerification: false,
        subscribed: true,
        quotaMaxBytes: FIFTY_GB_BYTES,
        quotaRemainingBytes: FIFTY_GB_BYTES,
        quotaResetEpoch: Date.now() + 30 * 86400000,
        tokenPoolCount: accountList.length,
      };
      await vpnBridge.login(accountItem.email, 'saved');
      setUser(switchedUser);
      setAccountList(vpnBridge.getAccountPool());
      setStatus((prev) => ({
        ...prev,
        quotaMaxBytes: switchedUser.quotaMaxBytes,
        quotaRemainingBytes: switchedUser.quotaRemainingBytes,
      }));
    }
  };

  // Delete account from pool
  const handleDeletePoolAccount = (emailToDelete: string) => {
    const acc = accountList.find((a) => a.email === emailToDelete);
    if (acc) {
      vpnBridge.removeAccountFromPool(acc.id);
    }
    const updated = vpnBridge.getAccountPool();
    setAccountList(updated);
    if (user?.email === emailToDelete) {
      if (updated.length > 0) {
        handleSelectPoolAccount(updated[0]);
      } else {
        setUser(null);
      }
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettings(settingsDraft);
    await vpnBridge.updateSettings(settingsDraft);
    if (status.state === 'Connected') {
      await vpnBridge.connect(selectedServer.id, settingsDraft.mode);
    }
    const s = await vpnBridge.getStatus();
    setStatus(s);
    setSettingsSavedToast(true);
    setTimeout(() => setSettingsSavedToast(false), 2500);
  };

  // Combined Pool Quota Calculation across all accounts
  const poolCount = accountList.length;
  const totalPoolQuotaGB = poolCount > 0
    ? accountList.reduce((sum, item) => sum + (item.quotaGB || 50), 0)
    : (user ? 50 : 50);

  const totalMaxBytes = totalPoolQuotaGB * 1024 * 1024 * 1024;
  // Account currently connected contributes its remaining bytes; other pool accounts contribute 50 GB each
  const otherAccountsBytes = Math.max(0, poolCount - 1) * FIFTY_GB_BYTES;
  const totalRemainingBytes = user
    ? Math.min(totalMaxBytes, status.quotaRemainingBytes + otherAccountsBytes)
    : (poolCount > 0 ? totalMaxBytes : FIFTY_GB_BYTES);

  const totalUsedBytes = Math.max(0, totalMaxBytes - totalRemainingBytes);
  const totalUsedPercent = totalMaxBytes > 0 ? (totalUsedBytes / totalMaxBytes) * 100 : 0;

  const quota = calculateQuotaSummary(totalMaxBytes, totalRemainingBytes);

  // Active email display string
  const activeEmail = user?.email || (accountList[0]?.email ?? (lang === 'fa' ? 'بدون اکانت فعال' : 'No Active Account'));
  const activeLetter = activeEmail.charAt(0).toUpperCase() || 'F';
  const extraAccountsCount = Math.max(0, accountList.length - 1);

  // Chevron directional icon
  const ChevronNext = lang === 'fa' ? ChevronLeft : ChevronRight;
  const ArrowNext = lang === 'fa' ? ArrowLeft : ArrowRight;

  return (
    <div
      dir={lang === 'fa' ? 'rtl' : 'ltr'}
      className={`min-h-screen w-full flex items-center justify-center p-0 sm:p-4 select-none transition-colors ${
        lang === 'fa' ? 'font-vazirmatn' : 'font-sans'
      } ${isDark ? 'bg-[#07090D] text-[#E8ECF1]' : 'bg-[#FAF9F5] text-[#111827]'}`}
    >
      {/* 
        Windows Desktop Client Window Frame (matching reference HTML exactly):
        width: 360px - 380px, height: 900px, max-height: 100vh, border-radius: 10px, overflow: hidden
      */}
      <div
        className={`w-full max-w-[360px] sm:w-[360px] h-[900px] max-h-screen relative flex flex-col rounded-[10px] overflow-hidden border shadow-2xl transition-colors shrink-0 ${
          isDark
            ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1] shadow-black/80'
            : 'bg-[#FAF9F5] border-[#D4D8DE] text-[#111827] shadow-xl'
        }`}
        style={{ boxSizing: 'border-box', fontSize: '13px', lineHeight: 1.5 }}
      >
        {/* Title Bar (height: 36px) */}
        <div
          className={`h-[36px] flex-none flex items-center justify-between ps-3 border-b transition-colors ${
            isDark ? 'bg-[#0A0D11] border-[#1C222B]' : 'bg-[#FFFFFF] border-[#E5E7EB]'
          }`}
        >
          {/* Logo & App Name */}
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <rect width="24" height="24" rx="6" fill="#1B222C"></rect>
              <path
                d="M5 6l4.2 3h5.6L19 6v7.5c0 3-3 5.5-7 6.5-4-1-7-3.5-7-6.5z"
                fill="#FF7A1A"
              ></path>
              <path
                d="M9 13l3 3 3-3"
                stroke="#0E1116"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              ></path>
            </svg>
            <span className="font-bold text-[12px] tracking-wide">FoxyVPN</span>
          </div>

          {/* Title Bar Actions: Theme Toggle, Language Toggle, Window Controls */}
          <div className="flex items-center h-full">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? t.lightTheme : t.darkTheme}
              title={isDark ? t.lightTheme : t.darkTheme}
              className={`w-8 h-full flex items-center justify-center border-0 bg-transparent cursor-pointer transition-colors ${
                isDark ? 'text-[#A5AFBB] hover:text-white' : 'text-[#64748B] hover:text-black'
              }`}
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-700" />
              )}
            </button>

            {/* Language Toggle Button */}
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label="Switch Language"
              title="FA / EN"
              className={`px-1.5 h-full flex items-center justify-center border-0 bg-transparent cursor-pointer font-bold text-[11px] font-mono transition-colors ${
                isDark ? 'text-[#FF7A1A] hover:text-[#FFA04D]' : 'text-[#EA580C] hover:text-[#C2410C]'
              }`}
            >
              {lang === 'fa' ? 'EN' : 'فا'}
            </button>

            {/* Minimize button */}
            <button
              type="button"
              aria-label="Minimize"
              className={`w-9 h-full flex items-center justify-center border-0 bg-transparent cursor-pointer transition-colors ${
                isDark ? 'text-[#A5AFBB] hover:bg-[#1A202C]' : 'text-[#64748B] hover:bg-slate-100'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M1 6h10" stroke="currentColor" strokeWidth="1.2"></path>
              </svg>
            </button>

            {/* Close button */}
            <button
              type="button"
              aria-label="Close"
              className={`w-9 h-full flex items-center justify-center border-0 bg-transparent cursor-pointer transition-colors ${
                isDark ? 'text-[#A5AFBB] hover:bg-red-900/40 hover:text-red-400' : 'text-[#64748B] hover:bg-red-50 hover:text-red-600'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.2"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* 
          Main Scrollable Content Window:
          Renders 1 of 4 pages based on activeTab:
          - dashboard
          - account
          - settings
          - about
        */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto scrollbar-none gap-3 p-[12px_16px_14px]">
          {/* ========================================================
              PAGE 1: داشبورد (DASHBOARD)
              ======================================================== */}
          {activeTab === 'dashboard' && (
            <>
              {/* Account Quota Summary Bar */}
              <div
                onClick={() => setActiveTab('account')}
                className="flex items-center justify-between gap-2 text-[12px] text-[#8B96A3] cursor-pointer hover:opacity-90 transition-opacity"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      user ? 'bg-[#2DD4A0]' : 'bg-amber-400'
                    }`}
                  ></span>
                  <span
                    dir="ltr"
                    className="font-mono text-[11px] text-[#C5CDD6] overflow-hidden text-ellipsis whitespace-nowrap"
                  >
                    {activeEmail}
                  </span>
                  {extraAccountsCount > 0 && (
                    <span className="text-[11px] text-[#FF7A1A] font-bold">
                      +{extraAccountsCount}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[11.5px] font-semibold text-[#FF9A4D]">
                  {lang === 'fa'
                    ? user
                      ? poolCount > 1
                        ? `سهمیه کل: ${totalPoolQuotaGB} گیگ (${poolCount} اکانت)`
                        : 'سهمیه ۵۰ گیگ فعال'
                      : 'ثبت‌نام برای ۵۰ گیگ'
                    : user
                    ? poolCount > 1
                      ? `Pool Quota: ${totalPoolQuotaGB} GB (${poolCount} Accs)`
                      : '50 GB Quota Active'
                    : 'Sign in for 50 GB'}
                </span>
              </div>

              {/* Connect Orb (Big Circular Button) */}
              <div className="flex flex-col items-center gap-2 pt-1 pb-1">
                {status.state === 'Connected' ? (
                  <>
                    <div
                      className="w-[176px] h-[176px] rounded-full flex items-center justify-center transition-all duration-300"
                      style={{
                        border: '1px solid rgba(45,212,160,.28)',
                        boxShadow: '0 0 56px rgba(45,212,160,.16)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={handleToggleConnection}
                        aria-label={t.disconnectTunnel}
                        className="w-[140px] h-[140px] rounded-full flex flex-col items-center justify-center gap-1 text-[12px] font-semibold cursor-pointer border-2 transition-transform active:scale-95 shadow-lg"
                        style={{
                          borderColor: '#2DD4A0',
                          background: isDark ? '#10261F' : '#ECFDF5',
                          color: '#2DD4A0',
                        }}
                      >
                        <Power className="w-11 h-11" strokeWidth={1.8} />
                        <span>{t.disconnectTunnel}</span>
                      </button>
                    </div>

                    <div className="flex flex-col items-center gap-0">
                      <span className="text-[18px] font-bold text-[#2DD4A0]">
                        {t.connected}
                      </span>
                      <span dir="ltr" className="font-mono text-[12px] text-[#8B96A3]">
                        {formatUptime(status.uptimeSeconds)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-[#8B96A3]">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#2DD4A0]" />
                      <span dir="ltr" className="font-mono">
                        {status.exitIp || '2a00:8c40:f0c4::a0e4'}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className={`w-[176px] h-[176px] rounded-full flex items-center justify-center border transition-all duration-300 ${
                        isDark ? 'border-[#2A323D]' : 'border-slate-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={handleToggleConnection}
                        aria-label={status.state === 'Connecting...' ? t.connecting : t.quickConnect}
                        className="w-[140px] h-[140px] rounded-full flex flex-col items-center justify-center gap-1 text-[12px] font-semibold cursor-pointer border-2 transition-transform active:scale-95 shadow-md"
                        style={{
                          borderColor: '#FF7A1A',
                          background: isDark ? '#241609' : '#FFF7ED',
                          color: '#FF7A1A',
                        }}
                      >
                        <Power
                          className={`w-11 h-11 ${
                            status.state === 'Connecting...' ? 'animate-spin' : ''
                          }`}
                          strokeWidth={1.8}
                        />
                        <span>
                          {status.state === 'Connecting...' ? t.connecting : t.quickConnect}
                        </span>
                      </button>
                    </div>

                    <div className="flex flex-col items-center gap-0">
                      <span
                        className={`text-[18px] font-bold ${
                          isDark ? 'text-[#C5CDD6]' : 'text-slate-800'
                        }`}
                      >
                        {status.state === 'Connecting...' ? t.connecting : t.disconnected}
                      </span>
                      <span className="text-[12px] text-[#8B96A3]">
                        {status.state === 'Connecting...' ? t.dialing : t.tapToConnect}
                      </span>
                    </div>

                    <div className="h-[21px]"></div>
                  </>
                )}
              </div>

              {/* Server Selector Card */}
              <button
                type="button"
                onClick={() => setShowServerModal(true)}
                className={`flex items-center gap-3 p-[10px_12px] rounded-[12px] border text-start w-full box-border cursor-pointer transition-colors ${
                  isDark
                    ? 'bg-[#151A21] border-[#232A33] hover:border-[#3A4555]'
                    : 'bg-[#FFFFFF] border-[#E2E8F0] hover:border-slate-400 shadow-2xs'
                }`}
              >
                {/* Country Flag (or Lightning for Auto) */}
                <span
                  dir="ltr"
                  className={`w-[36px] h-[36px] rounded-[9px] flex items-center justify-center text-[22px] leading-none select-none shrink-0 ${
                    isDark ? 'bg-[#1F2733]' : 'bg-slate-100'
                  }`}
                  aria-hidden="true"
                >
                  {selectedServer.id === 'auto' ? '⚡' : countryCodeToFlag(selectedServer.countryCode)}
                </span>

                {/* Country Name & Clean Subtitle (No address or port) */}
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="font-semibold text-[13.5px] truncate">
                    {selectedServer.id === 'auto'
                      ? (lang === 'fa' ? 'سرور خودکار (بهترین پینگ)' : 'Automatic (Lowest Ping)')
                      : (lang === 'fa' ? selectedServer.countryName : `${selectedServer.countryName}`)}
                  </span>
                  <span className="text-[11px] text-[#8B96A3] truncate">
                    {selectedServer.id === 'auto'
                      ? (lang === 'fa' ? 'انتخاب بهینه‌ترین نود' : 'Optimal Fastly Node')
                      : selectedServer.cityName}
                  </span>
                </span>

                {/* Latency highlighted in green */}
                <span dir="ltr" className="font-mono text-[12px] text-[#2DD4A0] shrink-0 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4A0] inline-block animate-pulse"></span>
                  {selectedServer.latencyMs} ms
                </span>

                <ChevronNext className="w-4 h-4 text-[#8B96A3] shrink-0" />
              </button>

              {/* Mode Switcher Pill */}
              <div
                className={`grid grid-cols-2 gap-1 p-[3px] rounded-[11px] border ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#F1F5F9] border-[#E2E8F0]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleModeSwitch('tun')}
                  aria-pressed={settings.mode === 'tun'}
                  className={`h-[36px] border-0 rounded-[8px] font-bold text-[12.5px] cursor-pointer transition-colors ${
                    settings.mode === 'tun'
                      ? 'bg-[#FF7A1A] text-[#1A0F05]'
                      : isDark
                      ? 'bg-transparent text-[#A5AFBB] hover:text-white'
                      : 'bg-transparent text-[#64748B] hover:text-black'
                  }`}
                >
                  {lang === 'fa' ? 'تونل کامل (Wintun)' : 'Full TUN (Wintun)'}
                </button>

                <button
                  type="button"
                  onClick={() => handleModeSwitch('proxy')}
                  aria-pressed={settings.mode === 'proxy'}
                  className={`h-[36px] border-0 rounded-[8px] font-bold text-[12.5px] cursor-pointer transition-colors ${
                    settings.mode === 'proxy'
                      ? 'bg-[#FF7A1A] text-[#1A0F05]'
                      : isDark
                      ? 'bg-transparent text-[#A5AFBB] hover:text-white'
                      : 'bg-transparent text-[#64748B] hover:text-black'
                  }`}
                >
                  {lang === 'fa' ? 'پراکسی سیستم (Proxy)' : 'System Proxy'}
                </button>
              </div>

              {/* Monthly Quota Card */}
              <div
                className={`p-[11px_14px_12px] rounded-[12px] border flex flex-col gap-2 ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-[13px]">
                    {poolCount > 1
                      ? lang === 'fa'
                        ? `سهمیه کل استخر (${poolCount} اکانت)`
                        : `Combined Quota (${poolCount} Accounts)`
                      : t.monthlyAllowanceTitle}
                  </span>
                  <span dir="ltr" className="font-mono text-[12px]">
                    <span className="text-[#2DD4A0] font-bold">
                      {(totalRemainingBytes / 1024 / 1024 / 1024).toFixed(1)}
                    </span>{' '}
                    <span className="text-[#8B96A3]">/ {totalPoolQuotaGB} GB</span>
                  </span>
                </div>

                <div
                  className={`h-[6px] rounded-[3px] overflow-hidden ${
                    isDark ? 'bg-[#232A33]' : 'bg-slate-200'
                  }`}
                >
                  <div
                    className="h-full bg-[#FF7A1A] rounded-[3px] transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(3, totalUsedPercent))}%` }}
                  ></div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#8B96A3]">
                  <span>
                    {lang === 'fa' ? 'مصرف کل دوره: ' : 'Total used: '}
                    <span dir="ltr" className="font-mono font-medium">
                      {formatBytes(totalUsedBytes)}
                    </span>
                  </span>
                  {poolCount > 1 && (
                    <span className="text-[#FF7A1A] font-mono text-[10.5px] font-semibold">
                      {poolCount} × 50 GB = {totalPoolQuotaGB} GB
                    </span>
                  )}
                </div>
              </div>

              {/* Traffic Card with SVG Bars */}
              <div
                className={`p-[11px_14px_10px] rounded-[12px] border flex flex-col gap-1.5 ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[13px]">{lang === 'fa' ? 'ترافیک' : 'Traffic'}</span>
                  <span
                    dir="ltr"
                    className="flex gap-3 font-mono text-[11px] font-semibold"
                  >
                    <span className="text-[#2DD4A0]">
                      ↓ {formatRate(rxRate)}
                    </span>
                    <span className="text-[#B79CF7]">
                      ↑ {formatRate(txRate)}
                    </span>
                  </span>
                </div>

                {/* Live Speed Bar Chart */}
                <svg
                  viewBox="0 0 300 52"
                  width="100%"
                  height="52"
                  role="img"
                  aria-label="Live Traffic Graph"
                  preserveAspectRatio="none"
                >
                  {speedHistory.map((val, idx) => {
                    const barHeight = Math.max(4, Math.round((val / 100) * 48));
                    const y = 52 - barHeight;
                    const x = idx * 10.5;
                    const opacity = 0.35 + (idx / speedHistory.length) * 0.65;
                    return (
                      <rect
                        key={idx}
                        x={x}
                        y={y}
                        width="8"
                        height={barHeight}
                        rx="2"
                        fill="#2DD4A0"
                        opacity={opacity}
                      />
                    );
                  })}
                </svg>

                <div
                  dir="ltr"
                  className="flex justify-between font-mono text-[10.5px] text-[#8B96A3]"
                >
                  <span>↓ {formatBytes(status.downloadedBytes)}</span>
                  <span>↑ {formatBytes(status.uploadedBytes)}</span>
                </div>
              </div>

            </>
          )}

          {/* ========================================================
              PAGE 2: حساب (ACCOUNT & MULTI-ACCOUNT POOL)
              ======================================================== */}
          {activeTab === 'account' && (
            <>
              {/* Current Account Card */}
              <div
                className={`flex items-center gap-3 p-3 rounded-[12px] border ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[15px] shrink-0 border"
                  style={{
                    background: '#2A1A0B',
                    borderColor: '#6B3A12',
                    color: '#FF7A1A',
                  }}
                >
                  {activeLetter}
                </span>

                <span className="flex-1 min-w-0 flex flex-col">
                  <span
                    dir="ltr"
                    className="font-mono text-[12px] overflow-hidden text-ellipsis whitespace-nowrap text-right font-medium"
                  >
                    {activeEmail}
                  </span>
                  <span className="text-[11.5px] text-[#2DD4A0] font-medium">
                    {lang === 'fa' ? 'سهمیه ۵۰ گیگ فعال' : '50 GB Quota Active'}
                  </span>
                </span>

                {user && (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    aria-label={t.signOut}
                    title={t.signOut}
                    className="w-11 h-11 rounded-[10px] border border-[#2A323D] bg-transparent text-[#F08A8A] hover:bg-red-950/30 flex items-center justify-center shrink-0 p-0 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Login / Register / Pool Form Card */}
              <form
                onSubmit={handleAuthSubmit}
                className={`p-3.5 rounded-[12px] border flex flex-col gap-3 ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                {/* 3 Form Tabs */}
                <div
                  className={`grid grid-cols-3 gap-1 p-[3px] rounded-[11px] border ${
                    isDark ? 'bg-[#0E1116] border-[#232A33]' : 'bg-[#F1F5F9] border-[#E2E8F0]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAuthFormTab('signin');
                      setAuthError(null);
                      setAuthSuccess(null);
                    }}
                    className={`h-[36px] border-0 rounded-[8px] text-[12px] font-bold cursor-pointer transition-colors ${
                      authFormTab === 'signin'
                        ? 'bg-[#FF7A1A] text-[#1A0F05]'
                        : isDark
                        ? 'bg-transparent text-[#A5AFBB] hover:text-white'
                        : 'bg-transparent text-[#64748B] hover:text-black'
                    }`}
                  >
                    {lang === 'fa' ? 'ورود' : 'Login'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthFormTab('signup');
                      setAuthError(null);
                      setAuthSuccess(null);
                    }}
                    className={`h-[36px] border-0 rounded-[8px] text-[12px] font-bold cursor-pointer transition-colors ${
                      authFormTab === 'signup'
                        ? 'bg-[#FF7A1A] text-[#1A0F05]'
                        : isDark
                        ? 'bg-transparent text-[#A5AFBB] hover:text-white'
                        : 'bg-transparent text-[#64748B] hover:text-black'
                    }`}
                  >
                    {lang === 'fa' ? 'ثبت‌نام' : 'Register'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthFormTab('pool');
                      setAuthError(null);
                      setAuthSuccess(null);
                    }}
                    className={`h-[36px] border-0 rounded-[8px] text-[12px] font-bold cursor-pointer transition-colors ${
                      authFormTab === 'pool'
                        ? 'bg-[#FF7A1A] text-[#1A0F05]'
                        : isDark
                        ? 'bg-transparent text-[#A5AFBB] hover:text-white'
                        : 'bg-transparent text-[#64748B] hover:text-black'
                    }`}
                  >
                    {lang === 'fa' ? 'استخر اکانت' : 'Account Pool'}
                  </button>
                </div>

                {authSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[#2DD4A0] text-[11.5px] font-medium leading-relaxed">
                    {authSuccess}
                  </div>
                )}

                {authError && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[11.5px] font-medium leading-relaxed">
                    {authError}
                  </div>
                )}

                {/* TAB 1: SIGN IN */}
                {authFormTab === 'signin' && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="auth-email-input" className="text-[12px] font-semibold text-[#C5CDD6]">
                        {lang === 'fa' ? 'ایمیل یا نام کاربری فایرفاکس' : 'Firefox Account Email'}
                      </label>
                      <div className="relative">
                        <input
                          id="auth-email-input"
                          type="text"
                          dir="ltr"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="you@example.com"
                          className={`w-full box-border h-[44px] rounded-[10px] text-[13px] px-3.5 pe-10 border transition-colors outline-none focus:border-[#FF7A1A] ${
                            isDark
                              ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        />
                        <Mail className="absolute end-3.5 top-3 w-[18px] h-[18px] text-[#7C8793] pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="auth-pass-input" className="text-[12px] font-semibold text-[#C5CDD6]">
                        {lang === 'fa' ? 'رمز عبور' : 'Password'}
                      </label>
                      <div className="relative">
                        <input
                          id="auth-pass-input"
                          type="password"
                          dir="ltr"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`w-full box-border h-[44px] rounded-[10px] text-[13px] px-3.5 pe-10 border transition-colors outline-none focus:border-[#FF7A1A] ${
                            isDark
                              ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        />
                        <Lock className="absolute end-3.5 top-3 w-[18px] h-[18px] text-[#7C8793] pointer-events-none" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="h-[44px] border-0 rounded-[10px] bg-[#FF7A1A] hover:bg-[#FFA04D] text-[#1A0F05] font-bold text-[13.5px] flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md disabled:opacity-50"
                    >
                      {authLoading ? (lang === 'fa' ? 'در حال ورود...' : 'Signing in...') : (lang === 'fa' ? 'ورود به حساب' : 'Sign In')}
                      <ArrowNext className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={() => handleQuickAddAccount('direct')}
                      className={`h-[36px] rounded-[8px] border text-[11.5px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        isDark ? 'border-[#2A323D] text-[#A5AFBB] hover:text-white hover:bg-slate-800/30' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>{lang === 'fa' ? 'ورود فوری با اکانت تست ۵۰ گیگ' : 'Instant Login with 50 GB Demo'}</span>
                    </button>
                  </>
                )}

                {/* TAB 2: REGISTER */}
                {authFormTab === 'signup' && (
                  <>
                    {/* Open in default browser button */}
                    <div
                      className={`p-3 rounded-[10px] border flex flex-col gap-2 ${
                        isDark ? 'bg-[#0E1116] border-[#2A323D]' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[12px] text-[#FF7A1A]">
                          {lang === 'fa' ? 'ثبت‌نام در مرورگر موزیلا' : 'Mozilla Official Signup'}
                        </span>
                        <span className="text-[10px] bg-emerald-500/15 text-[#2DD4A0] font-bold px-2 py-0.5 rounded-full">
                          50 GB Free
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8B96A3] leading-relaxed m-0">
                        {lang === 'fa'
                          ? 'لینک صفحه رسمی ثبت‌نام اکانت فایرفاکس را در مرورگر پیش‌فرض ویندوز باز کنید و پس از ثبت اکانت، مشخصات را در برنامه وارد نمایید.'
                          : 'Open the official Firefox registration page in your default browser, create an account, then enter credentials here.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => openExternalUrl('https://accounts.firefox.com/signup?service=5882386c6d801776&context=fx_desktop_v3')}
                        className="h-[36px] rounded-[8px] bg-[#FF7A1A]/15 hover:bg-[#FF7A1A]/25 border border-[#FF7A1A]/40 text-[#FF7A1A] font-bold text-[12px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{lang === 'fa' ? 'باز کردن لینک ثبت‌نام در مرورگر ویندوز' : 'Open Registration in Browser'}</span>
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="auth-email-input" className="text-[12px] font-semibold text-[#C5CDD6]">
                        {lang === 'fa' ? 'ایمیل اکانت جدید' : 'New Account Email'}
                      </label>
                      <div className="relative">
                        <input
                          id="auth-email-input"
                          type="email"
                          dir="ltr"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="you@example.com"
                          className={`w-full box-border h-[44px] rounded-[10px] text-[13px] px-3.5 pe-10 border transition-colors outline-none focus:border-[#FF7A1A] ${
                            isDark
                              ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        />
                        <Mail className="absolute end-3.5 top-3 w-[18px] h-[18px] text-[#7C8793] pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="auth-pass-input" className="text-[12px] font-semibold text-[#C5CDD6]">
                        {lang === 'fa' ? 'رمز عبور دلخواه' : 'Desired Password'}
                      </label>
                      <div className="relative">
                        <input
                          id="auth-pass-input"
                          type="password"
                          dir="ltr"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder={lang === 'fa' ? 'حداقل ۸ کاراکتر' : 'At least 8 chars'}
                          className={`w-full box-border h-[44px] rounded-[10px] text-[13px] px-3.5 pe-10 border transition-colors outline-none focus:border-[#FF7A1A] ${
                            isDark
                              ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        />
                        <Lock className="absolute end-3.5 top-3 w-[18px] h-[18px] text-[#7C8793] pointer-events-none" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="h-[44px] border-0 rounded-[10px] bg-[#FF7A1A] hover:bg-[#FFA04D] text-[#1A0F05] font-bold text-[13.5px] flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md disabled:opacity-50"
                    >
                      {authLoading ? (lang === 'fa' ? 'در حال ثبت‌نام...' : 'Registering...') : (lang === 'fa' ? 'ثبت‌نام مستقیم و فعال‌سازی ۵۰ گیگ' : 'Register and Activate 50 GB')}
                      <ArrowNext className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* TAB 3: POOL (Add Multiple Accounts) */}
                {authFormTab === 'pool' && (
                  <>
                    <div
                      className={`p-3 rounded-[10px] border flex flex-col gap-1.5 ${
                        isDark ? 'bg-[#1C160F] border-[#6B3A12]' : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[12.5px] text-[#FF9A4D]">
                          {lang === 'fa' ? 'سهمیه کل استخر اکانت‌ها' : 'Combined Pool Capacity'}
                        </span>
                        <span className="font-mono font-bold text-[13px] text-[#2DD4A0]">
                          {totalPoolQuotaGB} GB
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8B96A3] leading-relaxed m-0">
                        {lang === 'fa'
                          ? `هر اکانتی که با ایمیل و رمز اضافه کنید ۵۰ گیگابایت به سهمیه کلی شما می‌افزاید (${poolCount} اکانت ثبت شده).`
                          : `Each account added adds +50 GB to your combined quota (${poolCount} accounts registered).`}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="auth-email-input" className="text-[12px] font-semibold text-[#C5CDD6]">
                        {lang === 'fa' ? 'ایمیل / نام کاربری اکانت اضافه' : 'Account Email / Username'}
                      </label>
                      <div className="relative">
                        <input
                          id="auth-email-input"
                          type="text"
                          dir="ltr"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="account2@example.com"
                          className={`w-full box-border h-[44px] rounded-[10px] text-[13px] px-3.5 pe-10 border transition-colors outline-none focus:border-[#FF7A1A] ${
                            isDark
                              ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        />
                        <Mail className="absolute end-3.5 top-3 w-[18px] h-[18px] text-[#7C8793] pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="auth-pass-input" className="text-[12px] font-semibold text-[#C5CDD6]">
                        {lang === 'fa' ? 'رمز عبور اکانت' : 'Account Password'}
                      </label>
                      <div className="relative">
                        <input
                          id="auth-pass-input"
                          type="password"
                          dir="ltr"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`w-full box-border h-[44px] rounded-[10px] text-[13px] px-3.5 pe-10 border transition-colors outline-none focus:border-[#FF7A1A] ${
                            isDark
                              ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        />
                        <Lock className="absolute end-3.5 top-3 w-[18px] h-[18px] text-[#7C8793] pointer-events-none" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="h-[44px] border-0 rounded-[10px] bg-[#FF7A1A] hover:bg-[#FFA04D] text-[#1A0F05] font-bold text-[13.5px] flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{authLoading ? (lang === 'fa' ? 'در حال افزودن...' : 'Adding...') : (lang === 'fa' ? 'افزودن اکانت به استخر (+۵۰ گیگ)' : 'Add Account to Pool (+50 GB)')}</span>
                    </button>

                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={() => handleQuickAddAccount('pool')}
                      className={`h-[36px] rounded-[8px] border text-[11.5px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        isDark ? 'border-[#2A323D] text-[#A5AFBB] hover:text-white hover:bg-slate-800/30' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{lang === 'fa' ? 'افزودن خودکار ۵۰ گیگابایت به استخر' : 'Quick Generate +50 GB to Pool'}</span>
                    </button>
                  </>
                )}
              </form>

              {/* Multi-Account Pool Card */}
              <div
                className={`flex-1 min-h-[140px] p-[12px_14px_14px] rounded-[12px] border flex flex-col gap-2 ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-[13px]">{t.poolListTitle}</span>
                  <span className="text-[11.5px] text-[#2DD4A0] font-mono font-bold">
                    {totalPoolQuotaGB} GB ({poolCount} {lang === 'fa' ? 'اکانت' : 'accounts'})
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1">
                  {accountList.length === 0 ? (
                    <div className="text-center py-4 text-[12px] text-[#8B96A3]">
                      {t.accountPoolEmptyNotice}
                    </div>
                  ) : (
                    accountList.map((acc, index) => {
                      const isActive = user?.email === acc.email;
                      return (
                        <div key={acc.email || index}>
                          <div
                            onClick={() => handleSelectPoolAccount(acc)}
                            className={`flex items-center gap-2.5 h-[44px] px-1 rounded-lg cursor-pointer transition-colors ${
                              isActive ? 'bg-[#FF7A1A]/10' : 'hover:bg-slate-500/10'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isActive ? 'bg-[#2DD4A0]' : 'bg-[#8B96A3]'
                              }`}
                            ></span>
                            <span
                              dir="ltr"
                              className="flex-1 min-w-0 font-mono text-[12px] overflow-hidden text-ellipsis whitespace-nowrap text-right font-medium"
                            >
                              {acc.email}
                            </span>
                            <span
                              dir="ltr"
                              className="font-mono text-[11px] text-[#8B96A3] shrink-0"
                            >
                              {acc.quotaGB || 50} GB
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePoolAccount(acc.email);
                              }}
                              aria-label="Delete"
                              className="w-8 h-8 border-0 bg-transparent text-[#8B96A3] hover:text-red-400 flex items-center justify-center p-0 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {index < accountList.length - 1 && (
                            <div className="h-[1px] bg-[#232A33]"></div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAuthFormTab('pool');
                    const em = document.getElementById('auth-email-input');
                    if (em) em.focus();
                  }}
                  className="h-[44px] border border-dashed border-[#3A4452] hover:border-[#FF7A1A] rounded-[10px] bg-transparent text-[#C5CDD6] hover:text-[#FF7A1A] font-semibold text-[12.5px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'fa' ? 'افزودن اکانت به استخر' : 'Add Account to Pool'}</span>
                </button>
              </div>
            </>
          )}

          {/* ========================================================
              PAGE 3: تنظیمات (SETTINGS)
              ======================================================== */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="flex-1 flex flex-col gap-3">
              {/* Routing Card */}
              <div
                className={`p-3.5 rounded-[12px] border flex flex-col gap-3.5 ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-[13px]">
                  <Cpu className="w-4 h-4 text-[#FF7A1A]" />
                  <span>{t.routingModeLabel}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettingsDraft({ ...settingsDraft, mode: 'tun' })}
                    aria-pressed={settingsDraft.mode === 'tun'}
                    className={`text-start p-[11px_12px] rounded-[11px] border-[1.5px] flex flex-col gap-0.5 cursor-pointer transition-colors ${
                      settingsDraft.mode === 'tun'
                        ? 'border-[#FF7A1A] bg-[#241609] text-[#E8ECF1]'
                        : isDark
                        ? 'border-[#2A323D] bg-[#0E1116] text-[#E8ECF1]'
                        : 'border-slate-300 bg-slate-50 text-slate-800'
                    }`}
                  >
                    <span
                      className={`font-bold text-[13px] ${
                        settingsDraft.mode === 'tun' ? 'text-[#FF9A4D]' : 'text-[#C5CDD6]'
                      }`}
                    >
                      {t.fullTunOptionTitle}
                    </span>
                    <span dir="ltr" className="text-[10.5px] text-[#8B96A3] text-right">
                      {lang === 'fa' ? 'Wintun (لایه ۳)' : 'Wintun Layer 3'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettingsDraft({ ...settingsDraft, mode: 'proxy' })}
                    aria-pressed={settingsDraft.mode === 'proxy'}
                    className={`text-start p-[11px_12px] rounded-[11px] border-[1.5px] flex flex-col gap-0.5 cursor-pointer transition-colors ${
                      settingsDraft.mode === 'proxy'
                        ? 'border-[#FF7A1A] bg-[#241609] text-[#E8ECF1]'
                        : isDark
                        ? 'border-[#2A323D] bg-[#0E1116] text-[#E8ECF1]'
                        : 'border-slate-300 bg-slate-50 text-slate-800'
                    }`}
                  >
                    <span
                      className={`font-bold text-[13px] ${
                        settingsDraft.mode === 'proxy' ? 'text-[#FF9A4D]' : 'text-[#C5CDD6]'
                      }`}
                    >
                      {t.proxyOptionTitle}
                    </span>
                    <span dir="ltr" className="text-[10.5px] text-[#8B96A3] text-right">
                      System Proxy (10808)
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-[1.5fr_1fr] gap-2.5">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="settings-doh-select" className="text-[12px] font-semibold text-[#C5CDD6]">
                      {t.dohLabel}
                    </label>
                    <div className="relative">
                      <select
                        id="settings-doh-select"
                        value={settingsDraft.dohProvider}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            dohProvider: e.target.value as ClientSettings['dohProvider'],
                          })
                        }
                        className={`w-full box-border h-[44px] appearance-none rounded-[10px] text-[12.5px] px-3 border transition-colors outline-none ${
                          isDark
                            ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="1.1.1.1">Cloudflare · 1.1.1.1</option>
                        <option value="9.9.9.9">Quad9 · 9.9.9.9</option>
                        <option value="8.8.8.8">Google · 8.8.8.8</option>
                      </select>
                      <ChevronNext className="absolute start-3 top-3.5 w-4 h-4 text-[#8B96A3] pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="settings-mtu-input" className="text-[12px] font-semibold text-[#C5CDD6]">
                      MTU
                    </label>
                    <input
                      id="settings-mtu-input"
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      value={settingsDraft.mtu}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          mtu: Number(e.target.value) || 1380,
                        })
                      }
                      className={`w-full box-border h-[44px] rounded-[10px] font-mono text-[13px] px-3 border transition-colors outline-none ${
                        isDark
                          ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Anti-DPI Card */}
              <div
                className={`p-3.5 rounded-[12px] border flex flex-col gap-3.5 ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-[13px]">
                  <ShieldCheck className="w-4 h-4 text-[#2DD4A0]" />
                  <span>{t.antiDpiFeatureTitle}</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="settings-tls-select" className="text-[12px] font-semibold text-[#C5CDD6]">
                    {t.tlsSplitLabel}
                  </label>
                  <div className="relative">
                    <select
                      id="settings-tls-select"
                      value={settingsDraft.tlsSplitMode}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          tlsSplitMode: e.target.value as ClientSettings['tlsSplitMode'],
                        })
                      }
                      className={`w-full box-border h-[44px] appearance-none rounded-[10px] text-[12.5px] px-3 border transition-colors outline-none ${
                        isDark
                          ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="sni">{lang === 'fa' ? 'شکستن در SNI (پیشنهادی)' : 'Split at SNI (Recommended)'}</option>
                      <option value="off">{lang === 'fa' ? 'خاموش' : 'Disabled'}</option>
                    </select>
                    <ChevronNext className="absolute start-3 top-3.5 w-4 h-4 text-[#8B96A3] pointer-events-none" />
                  </div>
                </div>

                <div
                  className={`flex items-center justify-between gap-3 p-[10px_12px] rounded-[11px] border ${
                    isDark ? 'bg-[#0E1116] border-[#2A323D]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="flex flex-col min-w-0">
                    <span className="font-semibold text-[13px]">Kill Switch</span>
                    <span className="text-[11px] text-[#8B96A3]">{t.killSwitchDesc}</span>
                  </span>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={settingsDraft.killSwitch}
                    onClick={() =>
                      setSettingsDraft({
                        ...settingsDraft,
                        killSwitch: !settingsDraft.killSwitch,
                      })
                    }
                    className="w-[46px] h-[44px] border-0 bg-transparent p-0 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <span
                      className={`w-[42px] h-[24px] rounded-[12px] relative block transition-colors ${
                        settingsDraft.killSwitch ? 'bg-[#FF7A1A]' : 'bg-[#2A323D]'
                      }`}
                    >
                      <span
                        className={`absolute top-[3px] w-[18px] h-[18px] rounded-full transition-all ${
                          settingsDraft.killSwitch
                            ? 'right-[3px] bg-[#1A0F05]'
                            : 'left-[3px] bg-[#A5AFBB]'
                        }`}
                      ></span>
                    </span>
                  </button>
                </div>
              </div>

              {/* Advanced Card */}
              <div
                className={`p-3.5 rounded-[12px] border flex flex-col gap-3.5 ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-[13px]">
                  <Layers className="w-4 h-4 text-[#B79CF7]" />
                  <span>{lang === 'fa' ? 'پیشرفته' : 'Advanced'}</span>
                  <span className="font-normal text-[11px] text-[#8B96A3]">
                    · {lang === 'fa' ? 'اختیاری' : 'Optional'}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="settings-fxa-proxy" className="text-[12px] font-semibold text-[#C5CDD6]">
                    {t.controlProxyLabel}
                  </label>
                  <input
                    id="settings-fxa-proxy"
                    type="text"
                    dir="ltr"
                    value={settingsDraft.controlPlaneProxy}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        controlPlaneProxy: e.target.value,
                      })
                    }
                    placeholder="socks5://127.0.0.1:10808"
                    className={`w-full box-border h-[44px] rounded-[10px] font-mono text-[12px] px-3 border transition-colors outline-none ${
                      isDark
                        ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="settings-edge-ip" className="text-[12px] font-semibold text-[#C5CDD6]">
                    {t.edgeOverrideLabel}
                  </label>
                  <input
                    id="settings-edge-ip"
                    type="text"
                    dir="ltr"
                    value={settingsDraft.edgeOverrideIp}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        edgeOverrideIp: e.target.value,
                      })
                    }
                    placeholder="23.235.42.8"
                    className={`w-full box-border h-[44px] rounded-[10px] font-mono text-[12px] px-3 border transition-colors outline-none ${
                      isDark
                        ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Collapsible Logs Section with Copy button (as previously requested!) */}
              <div
                className={`rounded-[12px] border overflow-hidden transition-all ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                <div
                  onClick={() => setShowLogsInSettings((prev) => !prev)}
                  className="flex items-center justify-between p-3 cursor-pointer hover:opacity-90"
                >
                  <span className="font-semibold text-[13px] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#2DD4A0]"></span>
                    {t.logsTitle}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyLogs();
                      }}
                      className="px-2 py-1 rounded bg-[#FF7A1A]/15 text-[#FF7A1A] font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedLogs ? <Check className="w-3 h-3 text-[#2DD4A0]" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLogs ? t.logsCopied : t.copyLogs}</span>
                    </button>
                    <span className="text-[11px] text-[#8B96A3]">
                      {showLogsInSettings ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {showLogsInSettings && (
                  <div
                    dir="ltr"
                    className="p-3 pt-0 max-h-40 overflow-y-auto font-mono text-[10px] text-[#8B96A3] space-y-1 bg-[#0A0D11]"
                  >
                    {logs.map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                  </div>
                )}
              </div>

              {settingsSavedToast && (
                <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[#2DD4A0] text-[12px] font-bold text-center">
                  {t.settingsSavedAlert}
                </div>
              )}

              {/* Save & Apply Button */}
              <button
                type="submit"
                className="shrink-0 h-[48px] border-0 rounded-[11px] bg-[#FF7A1A] hover:bg-[#FFA04D] text-[#1A0F05] font-bold text-[14px] flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg active:scale-[0.98]"
              >
                <Check className="w-[17px] h-[17px]" strokeWidth={2.4} />
                <span>{t.saveSettingsBtn}</span>
              </button>
            </form>
          )}

          {/* ========================================================
              PAGE 4: درباره (ABOUT)
              ======================================================== */}
          {activeTab === 'about' && (
            <>
              {/* Hero Card */}
              <div
                className={`p-[22px_16px_16px] rounded-[14px] border flex flex-col items-center gap-2.5 text-center ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                <div
                  className="w-[84px] h-[84px] rounded-[22px] flex items-center justify-center border"
                  style={{
                    background: '#0E1116',
                    borderColor: '#2A323D',
                    boxShadow: '0 0 44px rgba(255,122,26,.18)',
                  }}
                >
                  <svg width="52" height="52" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M3.5 3.5l5.2 3.6h6.6l5.2-3.6v10c0 3.8-3.7 6.6-8.5 7.8-4.8-1.2-8.5-4-8.5-7.8z"
                      fill="#FF7A1A"
                    ></path>
                    <path
                      d="M8.5 13.2l3.5 3.6 3.5-3.6"
                      stroke="#0E1116"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    ></path>
                    <circle cx="9" cy="10.4" r="1" fill="#0E1116"></circle>
                    <circle cx="15" cy="10.4" r="1" fill="#0E1116"></circle>
                  </svg>
                </div>

                <span className="text-[21px] font-bold tracking-tight">FoxyVPN Windows</span>

                <div className="flex gap-2 items-center">
                  <span
                    dir="ltr"
                    className="font-mono text-[11px] font-bold text-[#FF9A4D] bg-[#241609] border border-[#6B3A12] rounded-[20px] px-2.5 py-0.5"
                  >
                    v1.0.4
                  </span>
                  <span
                    dir="ltr"
                    className="text-[11px] font-medium text-[#6FD6F0] bg-[#0F2530] border border-[#1F5568] rounded-[20px] px-2.5 py-0.5"
                  >
                    Windows 10 / 11
                  </span>
                </div>

                <span className="text-[12.5px] text-[#A5AFBB] max-w-[260px] leading-relaxed">
                  {lang === 'fa'
                    ? '۵۰ گیگ ترافیک رایگان ماهانه موزیلا، روی ویندوز'
                    : '50 GB monthly free Mozilla allowance on Windows'}
                </span>

                <div className="flex flex-col gap-2 w-full mt-1">
                  <button
                    type="button"
                    onClick={() => openExternalUrl('https://github.com/mostafa5804/foxyvpn_windows/releases')}
                    className="h-[44px] border-0 rounded-[10px] bg-[#FF7A1A] hover:bg-[#FFA04D] text-[#1A0F05] font-bold text-[13.5px] flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 4v11M7 11l5 5 5-5M5 20h14"></path>
                    </svg>
                    <span>{t.githubReleasesBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openExternalUrl('https://github.com/mostafa5804/foxyvpn_windows')}
                    className={`h-[44px] rounded-[10px] border font-semibold text-[13.5px] flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      isDark
                        ? 'border-[#2A323D] bg-transparent text-[#E8ECF1] hover:bg-slate-800/40'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"></path>
                    </svg>
                    <span>{t.githubRepoBtn}</span>
                  </button>
                </div>
              </div>

              {/* Features List Card */}
              <div
                className={`rounded-[14px] border flex flex-col ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3 p-[11px_14px]">
                  <span
                    className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0"
                    style={{ background: '#241609' }}
                  >
                    <Zap className="w-[17px] h-[17px] text-[#FF9A4D]" />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-semibold text-[13px]">{t.quotaFeatureTitle}</span>
                    <span className="text-[11.5px] text-[#8B96A3]">{t.quotaFeatureDesc}</span>
                  </span>
                </div>

                <div className="h-[1px] bg-[#232A33] mx-3.5"></div>

                <div className="flex items-center gap-3 p-[11px_14px]">
                  <span
                    className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0"
                    style={{ background: '#0F2530' }}
                  >
                    <Cpu className="w-[17px] h-[17px] text-[#6FD6F0]" />
                  </span>
                  <span className="flex flex-col">
                    <span dir="ltr" className="font-semibold text-[13px] text-right">
                      Wintun + System Proxy
                    </span>
                    <span className="text-[11.5px] text-[#8B96A3]">{t.driverFeatureDesc}</span>
                  </span>
                </div>

                <div className="h-[1px] bg-[#232A33] mx-3.5"></div>

                <div className="flex items-center gap-3 p-[11px_14px]">
                  <span
                    className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0"
                    style={{ background: '#10261F' }}
                  >
                    <ShieldCheck className="w-[17px] h-[17px] text-[#2DD4A0]" />
                  </span>
                  <span className="flex flex-col">
                    <span dir="ltr" className="font-semibold text-[13px] text-right">
                      TLS SNI Split
                    </span>
                    <span className="text-[11.5px] text-[#8B96A3]">{t.antiDpiFeatureDesc}</span>
                  </span>
                </div>

                <div className="h-[1px] bg-[#232A33] mx-3.5"></div>

                <div className="flex items-center gap-3 p-[11px_14px]">
                  <span
                    className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0"
                    style={{ background: '#221A33' }}
                  >
                    <Globe className="w-[17px] h-[17px] text-[#B79CF7]" />
                  </span>
                  <span className="flex flex-col">
                    <span dir="ltr" className="font-semibold text-[13px] text-right">
                      DNS over HTTPS
                    </span>
                    <span className="text-[11.5px] text-[#8B96A3]">{t.dohFeatureDesc}</span>
                  </span>
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={`p-[10px_12px] rounded-[12px] border flex flex-col gap-0.5 ${
                    isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0]'
                  }`}
                >
                  <span className="text-[11px] text-[#8B96A3]">{t.appVersionLabel}</span>
                  <span dir="ltr" className="font-mono text-[12px] font-bold text-[#FF9A4D] text-right">
                    1.0.4 Stable
                  </span>
                </div>

                <div
                  className={`p-[10px_12px] rounded-[12px] border flex flex-col gap-0.5 ${
                    isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0]'
                  }`}
                >
                  <span className="text-[11px] text-[#8B96A3]">{t.coreFrameworkLabel}</span>
                  <span dir="ltr" className="font-mono text-[12px] font-semibold text-right">
                    Wails 2.9 · Go 1.23
                  </span>
                </div>

                <div
                  className={`p-[10px_12px] rounded-[12px] border flex flex-col gap-0.5 ${
                    isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0]'
                  }`}
                >
                  <span className="text-[11px] text-[#8B96A3]">{t.networkDriverLabel}</span>
                  <span dir="ltr" className="font-mono text-[12px] font-semibold text-right">
                    Wintun 0.14.1
                  </span>
                </div>

                <div
                  className={`p-[10px_12px] rounded-[12px] border flex flex-col gap-0.5 ${
                    isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0]'
                  }`}
                >
                  <span className="text-[11px] text-[#8B96A3]">{t.distributionTypeLabel}</span>
                  <span className="text-[12px] font-bold text-[#2DD4A0]">
                    Portable · Setup
                  </span>
                </div>
              </div>

              {/* Open-Source Footer */}
              <div className="flex items-center justify-center gap-2 text-[11px] text-[#8B96A3] pt-1">
                <span className="w-2 h-2 rounded-full bg-[#2DD4A0]"></span>
                <span>{t.openSourceNotice}</span>
              </div>
            </>
          )}
        </div>

        {/* 
          Fixed Bottom Tab Bar (Height: 64px, 4 equal columns):
          1. داشبورد (Dashboard)
          2. حساب (Account)
          3. تنظیمات (Settings)
          4. درباره (About)
        */}
        <nav
          aria-label="Navigation"
          className={`h-[64px] flex-none grid grid-cols-4 border-t transition-colors select-none ${
            isDark ? 'bg-[#0A0D11] border-[#1C222B]' : 'bg-[#FFFFFF] border-[#E5E7EB]'
          }`}
        >
          {/* Tab 1: Dashboard */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            aria-current={activeTab === 'dashboard' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 text-[11.5px] border-0 bg-transparent cursor-pointer transition-all ${
              activeTab === 'dashboard'
                ? isDark
                  ? 'text-[#FF7A1A] font-bold shadow-[inset_0_2px_0_#FF7A1A]'
                  : 'text-[#EA580C] font-bold shadow-[inset_0_2px_0_#EA580C]'
                : isDark
                ? 'text-[#8B96A3] font-medium hover:text-white'
                : 'text-[#64748B] font-medium hover:text-black'
            }`}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7.5" height="7.5" rx="2"></rect>
              <rect x="13.5" y="3" width="7.5" height="7.5" rx="2"></rect>
              <rect x="3" y="13.5" width="7.5" height="7.5" rx="2"></rect>
              <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"></rect>
            </svg>
            <span>{t.dashboard}</span>
          </button>

          {/* Tab 2: Account */}
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            aria-current={activeTab === 'account' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 text-[11.5px] border-0 bg-transparent cursor-pointer transition-all ${
              activeTab === 'account'
                ? isDark
                  ? 'text-[#FF7A1A] font-bold shadow-[inset_0_2px_0_#FF7A1A]'
                  : 'text-[#EA580C] font-bold shadow-[inset_0_2px_0_#EA580C]'
                : isDark
                ? 'text-[#8B96A3] font-medium hover:text-white'
                : 'text-[#64748B] font-medium hover:text-black'
            }`}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"></path>
            </svg>
            <span>{t.auth}</span>
          </button>

          {/* Tab 3: Settings */}
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            aria-current={activeTab === 'settings' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 text-[11.5px] border-0 bg-transparent cursor-pointer transition-all ${
              activeTab === 'settings'
                ? isDark
                  ? 'text-[#FF7A1A] font-bold shadow-[inset_0_2px_0_#FF7A1A]'
                  : 'text-[#EA580C] font-bold shadow-[inset_0_2px_0_#EA580C]'
                : isDark
                ? 'text-[#8B96A3] font-medium hover:text-white'
                : 'text-[#64748B] font-medium hover:text-black'
            }`}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h10M18 7h2M4 17h2M10 17h10"></path>
              <circle cx="16" cy="7" r="2"></circle>
              <circle cx="8" cy="17" r="2"></circle>
            </svg>
            <span>{t.settings}</span>
          </button>

          {/* Tab 4: About */}
          <button
            type="button"
            onClick={() => setActiveTab('about')}
            aria-current={activeTab === 'about' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 text-[11.5px] border-0 bg-transparent cursor-pointer transition-all ${
              activeTab === 'about'
                ? isDark
                  ? 'text-[#FF7A1A] font-bold shadow-[inset_0_2px_0_#FF7A1A]'
                  : 'text-[#EA580C] font-bold shadow-[inset_0_2px_0_#EA580C]'
                : isDark
                ? 'text-[#8B96A3] font-medium hover:text-white'
                : 'text-[#64748B] font-medium hover:text-black'
            }`}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 16v-4M12 8h.01"></path>
            </svg>
            <span>{t.about}</span>
          </button>
        </nav>

        {/* Server Selector Modal - strictly overlays inside the 360px client window */}
        {showServerModal && (
          <ServerSelectorModal
            servers={servers}
            selectedServerId={selectedServer.id}
            onSelect={handleSelectServer}
            onClose={() => setShowServerModal(false)}
            isDark={isDark}
            lang={lang}
            onRefreshServers={(updated) => setServers(updated)}
          />
        )}
      </div>
    </div>
  );
}
