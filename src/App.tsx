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
  RefreshCw,
  Download,
  AppWindow,
  Network,
} from 'lucide-react';
import {
  APP_VERSION,
  FIFTY_GB_BYTES,
  calculateQuotaSummary,
  extractAuthErrorMessage,
  formatBytes,
  formatRate,
  formatUptime,
  AUTO_SERVER,
  type ClientSettings,
  type ConnectionStatus,
  type ServerInfo,
  type UserInfo,
  type UpdateCheckResult,
} from './utils/vpnLogic';
import { DEFAULT_SERVERS, vpnBridge, openExternalUrl, type PoolAccountItem } from './utils/wailsBridge';
import { translations, type Language } from './utils/i18n';
import { ServerSelectorModal } from './components/ServerSelectorModal';
import { FoxyLogo } from './components/FoxyLogo';
import { CountryFlag } from './components/CountryFlag';

const COMMON_WINDOWS_APPS: { exe: string; label: string }[] = [
  { exe: 'chrome.exe', label: 'Google Chrome' },
  { exe: 'firefox.exe', label: 'Mozilla Firefox' },
  { exe: 'msedge.exe', label: 'Microsoft Edge' },
  { exe: 'Telegram.exe', label: 'Telegram Desktop' },
  { exe: 'Discord.exe', label: 'Discord' },
  { exe: 'Spotify.exe', label: 'Spotify' },
  { exe: 'Code.exe', label: 'VS Code' },
  { exe: 'steam.exe', label: 'Steam' },
];

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
    transportProtocol: 'h2-connect-2499',
    tlsSplitMode: 'sni',
    fragmentSize: 24,
    fragmentDelayMs: 12,
    dohProvider: '1.1.1.1',
    mtu: 1380,
    killSwitch: true,
    blockIpv6: true,
    splitTunnelMode: 'all',
    splitTunnelApps: ['chrome.exe', 'firefox.exe', 'Telegram.exe'],
    localSocksPort: 1080,
    localHttpPort: 8080,
    allowLan: false,
    controlPlaneProxy: '',
    edgeOverrideIp: '',
  });

  // Settings form draft state
  const [settingsDraft, setSettingsDraft] = useState<ClientSettings>({ ...settings });
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);
  const [showLogsInSettings, setShowLogsInSettings] = useState(false);
  const [customAppInput, setCustomAppInput] = useState('');
  const [isRefreshingQuota, setIsRefreshingQuota] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);

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

  // Auth Form State (for Account Tab: Sign In & Account Pool)
  const [authFormTab, setAuthFormTab] = useState<'signin' | 'pool'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [needsOtpCode, setNeedsOtpCode] = useState(false);
  const [otpCode, setOtpCode] = useState('');
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
    vpnBridge.syncNativeSavedAccount().then((syncedUser) => {
      if (!mounted) return;
      const u = syncedUser || vpnBridge.getCurrentUser();
      if (u) {
        setUser(u);
        setStatus((prev) => ({
          ...prev,
          quotaMaxBytes: u.quotaMaxBytes,
          quotaRemainingBytes: u.quotaRemainingBytes,
        }));
      }
      setAccountList(vpnBridge.getAccountPool());
    });
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
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const syncConnectedServer = (liveStatus: ConnectionStatus) => {
    if (selectedServer.id !== 'auto' && liveStatus.serverId && liveStatus.serverId !== selectedServer.id) {
      const matched = servers.find((srv) => srv.id === liveStatus.serverId);
      if (matched) {
        setSelectedServer(matched);
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('foxyvpn_server_id', matched.id);
        }
      }
    }
  };

  const handleToggleConnection = async () => {
    if (!user) {
      // If no account, switch to Account tab so user logs in or creates account
      setActiveTab('account');
      return;
    }
    setConnectionError(null);
    if (status.state === 'Connected' || status.state === 'Connecting...') {
      await vpnBridge.disconnect();
      const s = await vpnBridge.getStatus();
      setStatus(s);
    } else {
      setStatus((prev) => ({ ...prev, state: 'Connecting...' }));
      try {
        await vpnBridge.connect(selectedServer.id, settings.mode);
        const s = await vpnBridge.getStatus();
        setStatus(s);
        syncConnectedServer(s);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setConnectionError(msg);
        const s = await vpnBridge.getStatus();
        setStatus({ ...s, state: 'Disconnected' });
      }
    }
    const latestLogs = await vpnBridge.getLogs();
    setLogs(latestLogs);
  };

  // Server selection
  const handleSelectServer = async (srv: ServerInfo) => {
    setSelectedServer(srv);
    setConnectionError(null);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('foxyvpn_server_id', srv.id);
    }
    if (status.state === 'Connected') {
      try {
        await vpnBridge.connect(srv.id, settings.mode);
        const s = await vpnBridge.getStatus();
        setStatus(s);
        syncConnectedServer(s);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setConnectionError(msg);
        const s = await vpnBridge.getStatus();
        setStatus({ ...s, state: 'Disconnected' });
      }
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
    setConnectionError(null);
    await vpnBridge.updateSettings(next);
    if (status.state === 'Connected') {
      try {
        await vpnBridge.connect(selectedServer.id, newMode);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setConnectionError(msg);
      }
    }
    const s = await vpnBridge.getStatus();
    setStatus(s);
    syncConnectedServer(s);
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

  // Auth Form Submit (Supports Real Sign-In, 6-Digit Email OTP Verification, and Multi-Account Pool)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (needsOtpCode) {
      if (!otpCode.trim() || otpCode.trim().length < 6) {
        setAuthError(
          lang === 'fa'
            ? 'لطفاً کد تایید ۶ رقمی ارسال‌شده به ایمیل را وارد کنید'
            : 'Please enter the 6-digit verification code sent to your email'
        );
        return;
      }
      setAuthLoading(true);
      try {
        const verifiedUser = await vpnBridge.verifyEmailCode(otpCode.trim());
        setUser(verifiedUser);
        setAccountList(vpnBridge.getAccountPool());
        setStatus((prev) => ({
          ...prev,
          quotaMaxBytes: verifiedUser.quotaMaxBytes,
          quotaRemainingBytes: verifiedUser.quotaRemainingBytes,
        }));
        setNeedsOtpCode(false);
        setOtpCode('');
        setAuthEmail('');
        setAuthPassword('');
        setAuthSuccess(
          lang === 'fa'
            ? 'کد تایید شد و اکانت شما به صورت خودکار ذخیره گردید'
            : 'Code verified and account saved automatically'
        );
      } catch (err: unknown) {
        const parsed = extractAuthErrorMessage(err, lang);
        setAuthError(parsed.message);
      } finally {
        setAuthLoading(false);
      }
      return;
    }

    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError(
        lang === 'fa'
          ? 'لطفاً ایمیل اکانت فایرفاکس و رمز عبور را وارد کنید'
          : 'Please enter your Firefox Account email and password'
      );
      return;
    }

    setAuthLoading(true);
    try {
      let loggedUser: UserInfo;
      if (authFormTab === 'pool') {
        loggedUser = await vpnBridge.addAccountToPool(authEmail.trim(), authPassword);
        if (loggedUser.requiresVerification) {
          setNeedsOtpCode(true);
          setAuthSuccess(
            lang === 'fa'
              ? `کد تایید ۶ رقمی موزیلا به ${authEmail.trim()} ارسال شد. کد را وارد کنید:`
              : `Mozilla sent a 6-digit verification code to ${authEmail.trim()}. Enter it below:`
          );
          return;
        }
        const count = vpnBridge.getAccountPool().length;
        setAuthSuccess(
          lang === 'fa'
            ? `اکانت جدید به استخر اضافه و ذخیره شد (+۵۰ گیگابایت). سهمیه کل: ${count * 50} گیگابایت`
            : `Account added to pool and saved (+50 GB). Total quota: ${count * 50} GB`
        );
      } else {
        loggedUser = await vpnBridge.login(authEmail.trim(), authPassword);
        if (loggedUser.requiresVerification) {
          setNeedsOtpCode(true);
          setAuthSuccess(
            lang === 'fa'
              ? `کد تایید ۶ رقمی موزیلا به ${authEmail.trim()} ارسال شد. کد را وارد کنید:`
              : `Mozilla sent a 6-digit verification code to ${authEmail.trim()}. Enter it below:`
          );
          return;
        }
        setAuthSuccess(
          lang === 'fa' ? 'ورود با موفقیت انجام شد و اکانت ذخیره گردید' : 'Signed in and saved automatically'
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
      const parsed = extractAuthErrorMessage(err, lang);
      if (parsed.requiresOtp) {
        setNeedsOtpCode(true);
        setAuthSuccess(parsed.message);
      } else {
        setAuthError(parsed.message);
      }
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

  // Refresh real quota from Mozilla Guardian server
  const handleRefreshQuota = async () => {
    if (isRefreshingQuota || !user) return;
    setIsRefreshingQuota(true);
    try {
      const updatedUser = await vpnBridge.refreshAccountQuota();
      if (updatedUser) {
        setUser(updatedUser);
        setStatus((prev) => ({
          ...prev,
          quotaMaxBytes: updatedUser.quotaMaxBytes,
          quotaRemainingBytes: updatedUser.quotaRemainingBytes,
        }));
      }
      setAccountList(vpnBridge.getAccountPool());
    } finally {
      setIsRefreshingQuota(false);
    }
  };

  // Check for new version on GitHub Releases
  const handleCheckForUpdates = async () => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    try {
      const res = await vpnBridge.checkForUpdates();
      setUpdateResult(res);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // Toggle app in Split Tunnel list
  const toggleSplitTunnelApp = (exeName: string) => {
    const current = settingsDraft.splitTunnelApps || [];
    const exists = current.some((item) => item.toLowerCase() === exeName.toLowerCase());
    const next = exists
      ? current.filter((item) => item.toLowerCase() !== exeName.toLowerCase())
      : [...current, exeName];
    setSettingsDraft({ ...settingsDraft, splitTunnelApps: next });
  };

  const handleAddCustomSplitApp = () => {
    const trimmed = customAppInput.trim();
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase().endsWith('.exe') ? trimmed : `${trimmed}.exe`;
    const current = settingsDraft.splitTunnelApps || [];
    if (!current.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
      setSettingsDraft({
        ...settingsDraft,
        splitTunnelApps: [...current, normalized],
      });
    }
    setCustomAppInput('');
  };

  // Combined Pool Quota Calculation across all accounts (preserving real per-account remaining quota)
  const poolCount = accountList.length;
  const totalPoolQuotaGB = poolCount > 0
    ? accountList.reduce((sum, item) => sum + (item.quotaGB || 50), 0)
    : 50;

  const totalMaxBytes = totalPoolQuotaGB * 1024 * 1024 * 1024;
  const totalRemainingBytes = (() => {
    if (!user && poolCount === 0) return FIFTY_GB_BYTES;
    if (poolCount <= 1) {
      return Math.min(totalMaxBytes, status.quotaRemainingBytes);
    }
    let sumRem = 0;
    for (const acc of accountList) {
      const isCurrentActive = user && acc.email.toLowerCase() === user.email.toLowerCase();
      if (isCurrentActive) {
        sumRem += status.quotaRemainingBytes;
      } else if (typeof acc.remainingBytes === 'number' && acc.remainingBytes >= 0) {
        sumRem += acc.remainingBytes;
      } else {
        sumRem += (acc.quotaGB || 50) * 1024 * 1024 * 1024;
      }
    }
    return Math.min(totalMaxBytes, sumRem);
  })();

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

  // Export data/account.bin binary file
  const handleExportAccountBin = () => {
    try {
      const bytes = vpnBridge.exportAccountBinBytes();
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'account.bin';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setAuthSuccess(t.sessionSavedToast);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Failed to export account.bin');
    }
  };

  // Restore from data/account.bin binary file
  const handleImportAccountBin = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buf = new Uint8Array(reader.result as ArrayBuffer);
        const restored = vpnBridge.importAccountBinBytes(buf);
        setUser(restored);
        setAccountList(vpnBridge.getAccountPool());
        if (restored) {
          setStatus((prev) => ({
            ...prev,
            quotaMaxBytes: restored.quotaMaxBytes,
            quotaRemainingBytes: restored.quotaRemainingBytes,
          }));
        }
        setAuthError(null);
        setAuthSuccess(t.sessionRestoredToast);
      } catch (err: unknown) {
        setAuthError(err instanceof Error ? err.message : 'Invalid account.bin file');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  return (
    <div
      dir={lang === 'fa' ? 'rtl' : 'ltr'}
      className={`w-screen h-screen m-0 p-0 overflow-hidden select-none transition-colors ${
        lang === 'fa' ? 'font-vazirmatn' : 'font-sans'
      } ${isDark ? 'bg-[#0E1116] text-[#E8ECF1]' : 'bg-[#FAF9F5] text-[#111827]'}`}
    >
      {/* 
        Full-Bleed Edge-to-Edge Window (Zero surrounding white borders or empty margins)
      */}
      <div
        className={`app-window w-full h-full relative flex flex-col rounded-none border-0 overflow-hidden transition-colors shrink-0 ${
          isDark
            ? 'bg-[#0E1116] text-[#E8ECF1]'
            : 'bg-[#FAF9F5] text-[#111827]'
        }`}
        style={{ boxSizing: 'border-box', fontSize: '13px', lineHeight: 1.5 }}
      >
        {/* Title Bar (height: 36px) — Native Windows frame handles Minimize/Close; only Logo, Title, Theme & Language here */}
        <div
          className={`h-[36px] flex-none flex items-center justify-between px-3 border-b transition-colors ${
            isDark ? 'bg-[#0A0D11] border-[#1C222B]' : 'bg-[#FFFFFF] border-[#E5E7EB]'
          }`}
        >
          {/* Logo & App Name */}
          <div className="flex items-center gap-2">
            <FoxyLogo size={22} />
            <span className="font-bold text-[12.5px] tracking-wide">FoxyVPN</span>
            <span
              dir="ltr"
              className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#FF7A1A]/15 text-[#FF7A1A]"
            >
              v{APP_VERSION}
            </span>
          </div>

          {/* Title Bar Actions: Theme Toggle & Language Toggle only (No duplicate Minimize/Close buttons) */}
          <div className="flex items-center gap-1 h-full">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? t.lightTheme : t.darkTheme}
              title={isDark ? t.lightTheme : t.darkTheme}
              className={`w-7 h-7 rounded-md flex items-center justify-center border-0 bg-transparent cursor-pointer transition-colors ${
                isDark ? 'text-[#A5AFBB] hover:text-white hover:bg-[#1A202C]' : 'text-[#64748B] hover:text-black hover:bg-slate-100'
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
              className={`px-2 h-7 rounded-md flex items-center justify-center border-0 bg-transparent cursor-pointer font-bold text-[11px] transition-colors ${
                isDark ? 'text-[#FF7A1A] hover:text-[#FFA04D] hover:bg-[#1A202C]' : 'text-[#EA580C] hover:text-[#C2410C] hover:bg-slate-100'
              }`}
            >
              {lang === 'fa' ? 'EN' : 'فا'}
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
                    dir={user || accountList.length > 0 ? 'ltr' : undefined}
                    className={`text-[11.5px] overflow-hidden text-ellipsis whitespace-nowrap ${
                      user || accountList.length > 0 ? 'font-mono' : 'font-semibold'
                    } ${isDark ? 'text-[#C5CDD6]' : 'text-slate-700'}`}
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

              {connectionError && (
                <div
                  className={`p-2.5 rounded-[10px] border text-[11.5px] flex items-start justify-between gap-2 ${
                    isDark
                      ? 'bg-red-950/40 border-red-800/60 text-red-300'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  <span className="leading-snug">{connectionError}</span>
                  <button
                    type="button"
                    onClick={() => setConnectionError(null)}
                    className="text-[11px] font-bold opacity-75 hover:opacity-100 cursor-pointer bg-transparent border-0 text-current shrink-0"
                  >
                    ✕
                  </button>
                </div>
              )}

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
                {/* SVG Country Flag (or Lightning for Auto) */}
                <span
                  dir="ltr"
                  className={`w-[38px] h-[38px] rounded-[9px] flex items-center justify-center leading-none select-none shrink-0 ${
                    isDark ? 'bg-[#1F2733]' : 'bg-slate-100'
                  }`}
                  aria-hidden="true"
                >
                  <CountryFlag
                    code={selectedServer.id === 'auto' ? 'AUTO' : selectedServer.countryCode}
                    size={26}
                  />
                </span>

                {/* Country Name & Clean Subtitle */}
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="font-semibold text-[13.5px] truncate">
                    {selectedServer.id === 'auto'
                      ? (lang === 'fa' ? 'سرور خودکار (بهترین پینگ)' : 'Automatic (Lowest Ping)')
                      : selectedServer.countryName}
                  </span>
                  <span className="text-[11px] text-[#8B96A3] truncate">
                    {selectedServer.id === 'auto'
                      ? (lang === 'fa'
                          ? `انتخاب هوشمند از بین ${servers.length} سرور`
                          : `Smart route across ${servers.length} nodes`)
                      : `${selectedServer.cityName} · ${servers.length} ${lang === 'fa' ? 'سرور فعال' : 'nodes'}`}
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

              {/* Monthly Quota Card with Live Server Quota Sync */}
              <div
                className={`p-[11px_14px_12px] rounded-[12px] border flex flex-col gap-2 ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[13px] flex items-center gap-1.5">
                    <span>
                      {poolCount > 1
                        ? lang === 'fa'
                          ? `سهمیه کل استخر (${poolCount} اکانت)`
                          : `Combined Quota (${poolCount} Accounts)`
                        : t.monthlyAllowanceTitle}
                    </span>
                    {user && (
                      <button
                        type="button"
                        onClick={handleRefreshQuota}
                        disabled={isRefreshingQuota}
                        title={t.syncQuotaBtn}
                        aria-label={t.syncQuotaBtn}
                        className={`p-1 rounded-md border-0 bg-transparent cursor-pointer transition-colors ${
                          isDark ? 'text-[#8B96A3] hover:text-[#FF7A1A]' : 'text-slate-500 hover:text-orange-600'
                        }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingQuota ? 'animate-spin text-[#FF7A1A]' : ''}`} />
                      </button>
                    )}
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
                  {poolCount > 1 ? (
                    <span className="text-[#FF7A1A] font-mono text-[10.5px] font-semibold">
                      {poolCount} × 50 GB = {totalPoolQuotaGB} GB
                    </span>
                  ) : (
                    <span className="text-[10.5px] text-[#2DD4A0]">
                      {lang === 'fa' ? 'همگام با سرور موزیلا' : 'Synced with Mozilla'}
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
                    dir={user || accountList.length > 0 ? 'ltr' : undefined}
                    className={`text-[12px] overflow-hidden text-ellipsis whitespace-nowrap font-medium ${
                      user || accountList.length > 0 ? 'font-mono text-right' : ''
                    }`}
                  >
                    {activeEmail}
                  </span>
                  <span className="text-[11px] text-[#2DD4A0] font-medium">
                    {user || accountList.length > 0
                      ? lang === 'fa'
                        ? 'ذخیره خودکار فعال (data/account.bin)'
                        : 'Auto-saved (data/account.bin)'
                      : lang === 'fa'
                      ? 'با اکانت فایرفاکس وارد شوید'
                      : 'Sign in with your Firefox Account'}
                  </span>
                </span>

                {user && (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    aria-label={t.signOut}
                    title={t.signOut}
                    className="w-10 h-10 rounded-[10px] border border-[#2A323D] bg-transparent text-[#F08A8A] hover:bg-red-950/30 flex items-center justify-center shrink-0 p-0 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Login / Pool Form Card (Real Mozilla FxA Authentication Only) */}
              <form
                onSubmit={handleAuthSubmit}
                className={`p-3 rounded-[12px] border flex flex-col gap-2.5 ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                {/* 2 Form Tabs: Sign In & Account Pool */}
                <div
                  className={`grid grid-cols-2 gap-1 p-[3px] rounded-[10px] border ${
                    isDark ? 'bg-[#0E1116] border-[#232A33]' : 'bg-[#F1F5F9] border-[#E2E8F0]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAuthFormTab('signin');
                      setNeedsOtpCode(false);
                      setAuthError(null);
                      setAuthSuccess(null);
                    }}
                    className={`h-[34px] border-0 rounded-[7px] text-[12px] font-bold cursor-pointer transition-colors ${
                      authFormTab === 'signin'
                        ? 'bg-[#FF7A1A] text-[#1A0F05]'
                        : isDark
                        ? 'bg-transparent text-[#A5AFBB] hover:text-white'
                        : 'bg-transparent text-[#64748B] hover:text-black'
                    }`}
                  >
                    {lang === 'fa' ? 'ورود به حساب' : 'Sign In'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthFormTab('pool');
                      setNeedsOtpCode(false);
                      setAuthError(null);
                      setAuthSuccess(null);
                    }}
                    className={`h-[34px] border-0 rounded-[7px] text-[12px] font-bold cursor-pointer transition-colors ${
                      authFormTab === 'pool'
                        ? 'bg-[#FF7A1A] text-[#1A0F05]'
                        : isDark
                        ? 'bg-transparent text-[#A5AFBB] hover:text-white'
                        : 'bg-transparent text-[#64748B] hover:text-black'
                    }`}
                  >
                    {lang === 'fa' ? 'افزودن به استخر (+۵۰ گیگ)' : 'Add to Pool (+50 GB)'}
                  </button>
                </div>

                {authSuccess && (
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[#2DD4A0] text-[11.5px] font-medium leading-relaxed">
                    {authSuccess}
                  </div>
                )}

                {authError && (
                  <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[11.5px] font-medium leading-relaxed">
                    {authError}
                  </div>
                )}

                {needsOtpCode ? (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="auth-otp-input" className="text-[12px] font-semibold text-[#C5CDD6]">
                        {lang === 'fa' ? 'کد تایید ۶ رقمی ایمیل موزیلا' : '6-Digit Mozilla Email Code'}
                      </label>
                      <input
                        id="auth-otp-input"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        dir="ltr"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className={`w-full box-border h-[42px] rounded-[10px] font-mono text-center tracking-[0.35em] text-[15px] font-bold px-3.5 border transition-colors outline-none focus:border-[#FF7A1A] ${
                          isDark
                            ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="h-[40px] border-0 rounded-[10px] bg-[#FF7A1A] hover:bg-[#FFA04D] text-[#1A0F05] font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md disabled:opacity-50"
                      >
                        {authLoading
                          ? lang === 'fa'
                            ? 'در حال تایید کد...'
                            : 'Verifying...'
                          : lang === 'fa'
                          ? 'تایید کد ۶ رقمی و فعال‌سازی'
                          : 'Verify 6-Digit Code'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNeedsOtpCode(false);
                          setOtpCode('');
                        }}
                        className={`h-[40px] px-3 rounded-[10px] border text-[12px] font-semibold cursor-pointer ${
                          isDark ? 'border-[#2A323D] bg-[#0E1116] text-[#A5AFBB]' : 'border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        {lang === 'fa' ? 'بازگشت' : 'Back'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="auth-email-input" className="text-[11.5px] font-semibold text-[#C5CDD6]">
                        {authFormTab === 'pool'
                          ? lang === 'fa'
                            ? 'ایمیل اکانت فایرفاکس جدید برای استخر'
                            : 'Additional Firefox Account Email'
                          : lang === 'fa'
                          ? 'ایمیل اکانت فایرفاکس'
                          : 'Firefox Account Email'}
                      </label>
                      <div className="relative">
                        <input
                          id="auth-email-input"
                          type="email"
                          dir="ltr"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="you@example.com"
                          className={`w-full box-border h-[40px] rounded-[10px] text-[13px] pl-3.5 pr-10 border transition-colors outline-none focus:border-[#FF7A1A] ${
                            isDark
                              ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        />
                        <Mail className="absolute right-3.5 top-2.5 w-[17px] h-[17px] text-[#7C8793] pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor="auth-pass-input" className="text-[11.5px] font-semibold text-[#C5CDD6]">
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
                          className={`w-full box-border h-[40px] rounded-[10px] text-[13px] pl-3.5 pr-10 border transition-colors outline-none focus:border-[#FF7A1A] ${
                            isDark
                              ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        />
                        <Lock className="absolute right-3.5 top-2.5 w-[17px] h-[17px] text-[#7C8793] pointer-events-none" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="h-[40px] border-0 rounded-[10px] bg-[#FF7A1A] hover:bg-[#FFA04D] text-[#1A0F05] font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md disabled:opacity-50"
                    >
                      {authFormTab === 'pool' ? (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>
                            {authLoading
                              ? lang === 'fa'
                                ? 'در حال احراز هویت...'
                                : 'Authenticating...'
                              : lang === 'fa'
                              ? 'افزودن اکانت به استخر (+۵۰ گیگ)'
                              : 'Add Account to Pool (+50 GB)'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>
                            {authLoading
                              ? lang === 'fa'
                                ? 'در حال ورود...'
                                : 'Signing in...'
                              : lang === 'fa'
                              ? 'ورود به حساب'
                              : 'Sign In'}
                          </span>
                          <ArrowNext className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    {/* Official Mozilla Website Registration Link */}
                    <button
                      type="button"
                      onClick={() =>
                        openExternalUrl(
                          'https://accounts.firefox.com/signup?service=5882386c6d801776&context=fx_desktop_v3'
                        )
                      }
                      className={`h-[34px] rounded-[8px] border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        isDark
                          ? 'border-[#2A323D] bg-[#0E1116] text-[#A5AFBB] hover:text-[#FF7A1A] hover:border-[#FF7A1A]/50'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-[#EA580C] hover:border-orange-300'
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#FF7A1A] shrink-0" />
                      <span>
                        {lang === 'fa'
                          ? 'اکانت ندارید؟ ثبت‌نام در سایت رسمی موزیلا (سپس اینجا وارد شوید)'
                          : 'No account? Register on Mozilla website, then sign in here'}
                      </span>
                    </button>
                  </>
                )}
              </form>

              {/* Multi-Account Pool Card (Immediately visible without scrolling) */}
              <div
                className={`flex-1 min-h-[150px] p-3 rounded-[12px] border flex flex-col gap-2 ${
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
                      const isActive = user?.email === acc.email || user?.email?.startsWith(acc.email);
                      return (
                        <div key={acc.email || index}>
                          <div
                            onClick={() => handleSelectPoolAccount(acc)}
                            className={`flex items-center gap-2.5 h-[40px] px-2 rounded-lg cursor-pointer transition-colors ${
                              isActive ? 'bg-[#FF7A1A]/15 border border-[#FF7A1A]/30' : 'hover:bg-slate-500/10'
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
                              className="font-mono text-[11px] text-[#2DD4A0] font-semibold shrink-0"
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
                              className="w-7 h-7 border-0 bg-transparent text-[#8B96A3] hover:text-red-400 flex items-center justify-center p-0 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {index < accountList.length - 1 && (
                            <div className="h-[1px] bg-[#232A33]/50 my-0.5"></div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}

          {/* ========================================================
              PAGE 3: تنظیمات (SETTINGS — Full Android-parity Tunnel & Protocol Controls)
              ======================================================== */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="flex-1 flex flex-col gap-3">
              {/* 1. Routing & Transport Protocol Card */}
              <div
                className={`p-3.5 rounded-[12px] border flex flex-col gap-3 ${
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
                    className={`text-start p-[10px_11px] rounded-[11px] border-[1.5px] flex flex-col gap-0.5 cursor-pointer transition-colors ${
                      settingsDraft.mode === 'tun'
                        ? 'border-[#FF7A1A] bg-[#241609] text-[#E8ECF1]'
                        : isDark
                        ? 'border-[#2A323D] bg-[#0E1116] text-[#E8ECF1]'
                        : 'border-slate-300 bg-slate-50 text-slate-800'
                    }`}
                  >
                    <span
                      className={`font-bold text-[12.5px] ${
                        settingsDraft.mode === 'tun' ? 'text-[#FF9A4D]' : isDark ? 'text-[#C5CDD6]' : 'text-slate-800'
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
                    className={`text-start p-[10px_11px] rounded-[11px] border-[1.5px] flex flex-col gap-0.5 cursor-pointer transition-colors ${
                      settingsDraft.mode === 'proxy'
                        ? 'border-[#FF7A1A] bg-[#241609] text-[#E8ECF1]'
                        : isDark
                        ? 'border-[#2A323D] bg-[#0E1116] text-[#E8ECF1]'
                        : 'border-slate-300 bg-slate-50 text-slate-800'
                    }`}
                  >
                    <span
                      className={`font-bold text-[12.5px] ${
                        settingsDraft.mode === 'proxy' ? 'text-[#FF9A4D]' : isDark ? 'text-[#C5CDD6]' : 'text-slate-800'
                      }`}
                    >
                      {t.proxyOptionTitle}
                    </span>
                    <span dir="ltr" className="text-[10.5px] text-[#8B96A3] text-right">
                      SOCKS5 ({settingsDraft.localSocksPort || 1080}) / HTTP ({settingsDraft.localHttpPort || 8080})
                    </span>
                  </button>
                </div>

                {/* Transport Protocol Selection (Restored from Android / v1.0.4) */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="settings-protocol-select" className="text-[12px] font-semibold text-[#8B96A3]">
                    {t.transportProtocolLabel}
                  </label>
                  <div className="relative">
                    <select
                      id="settings-protocol-select"
                      value={settingsDraft.transportProtocol || 'h2-connect-2499'}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          transportProtocol: e.target.value as ClientSettings['transportProtocol'],
                        })
                      }
                      className={`w-full box-border h-[40px] appearance-none rounded-[10px] text-[12px] ps-3 pe-8 border transition-colors outline-none ${
                        isDark
                          ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="h2-connect-2499">{t.protocolHttp2Connect}</option>
                      <option value="h2-tls-443">{t.protocolHttp2Tls}</option>
                      <option value="masque-quic">{t.protocolMasqueQuic}</option>
                      <option value="auto">{t.protocolAuto}</option>
                    </select>
                    <ChevronNext className="absolute end-2.5 top-3 w-4 h-4 text-[#8B96A3] pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-[1.5fr_1fr] gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="settings-doh-select" className="text-[11.5px] font-semibold text-[#8B96A3]">
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
                        className={`w-full box-border h-[40px] appearance-none rounded-[10px] text-[12px] ps-3 pe-8 border transition-colors outline-none ${
                          isDark
                            ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="1.1.1.1">Cloudflare · 1.1.1.1</option>
                        <option value="9.9.9.9">Quad9 · 9.9.9.9</option>
                        <option value="8.8.8.8">Google · 8.8.8.8</option>
                      </select>
                      <ChevronNext className="absolute end-2.5 top-3 w-4 h-4 text-[#8B96A3] pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="settings-mtu-input" className="text-[11.5px] font-semibold text-[#8B96A3]">
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
                      className={`w-full box-border h-[40px] rounded-[10px] font-mono text-[12.5px] px-3 border transition-colors outline-none ${
                        isDark
                          ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Per-App Split Tunneling Card (Restored Android Feature) */}
              <div
                className={`p-3.5 rounded-[12px] border flex flex-col gap-3 ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-[13px]">
                    <AppWindow className="w-4 h-4 text-[#6FD6F0]" />
                    <span>{t.splitTunnelTitle}</span>
                  </div>
                  <span className="text-[11px] text-[#2DD4A0] font-semibold">
                    {(settingsDraft.splitTunnelApps || []).length}{' '}
                    {lang === 'fa' ? 'برنامه' : 'apps'}
                  </span>
                </div>

                {/* Split Tunnel Mode 3-way selector */}
                <div
                  className={`grid grid-cols-3 gap-1 p-1 rounded-[10px] border ${
                    isDark ? 'bg-[#0E1116] border-[#232A33]' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  {(
                    [
                      { id: 'all', label: t.splitModeAll },
                      { id: 'include', label: t.splitModeInclude },
                      { id: 'exclude', label: t.splitModeExclude },
                    ] as const
                  ).map((modeOpt) => {
                    const active = (settingsDraft.splitTunnelMode || 'all') === modeOpt.id;
                    return (
                      <button
                        key={modeOpt.id}
                        type="button"
                        onClick={() =>
                          setSettingsDraft({ ...settingsDraft, splitTunnelMode: modeOpt.id })
                        }
                        className={`h-[32px] rounded-[7px] border-0 text-[11px] font-bold cursor-pointer transition-colors px-1 truncate ${
                          active
                            ? 'bg-[#FF7A1A] text-[#1A0F05]'
                            : isDark
                            ? 'bg-transparent text-[#A5AFBB] hover:text-white'
                            : 'bg-transparent text-slate-600 hover:text-black'
                        }`}
                      >
                        {modeOpt.label}
                      </button>
                    );
                  })}
                </div>

                {(settingsDraft.splitTunnelMode === 'include' ||
                  settingsDraft.splitTunnelMode === 'exclude') && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] text-[#8B96A3]">{t.splitTunnelDesc}</span>

                    {/* Quick Checkboxes for Popular Windows Apps */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {COMMON_WINDOWS_APPS.map((appItem) => {
                        const checked = (settingsDraft.splitTunnelApps || []).some(
                          (x) => x.toLowerCase() === appItem.exe.toLowerCase()
                        );
                        return (
                          <button
                            key={appItem.exe}
                            type="button"
                            onClick={() => toggleSplitTunnelApp(appItem.exe)}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-[8px] border text-[11px] cursor-pointer transition-colors ${
                              checked
                                ? 'border-[#FF7A1A] bg-[#FF7A1A]/15 text-[#FF9A4D] font-bold'
                                : isDark
                                ? 'border-[#2A323D] bg-[#0E1116] text-[#A5AFBB]'
                                : 'border-slate-200 bg-slate-50 text-slate-700'
                            }`}
                          >
                            <span className="truncate">{appItem.label}</span>
                            {checked ? (
                              <Check className="w-3.5 h-3.5 text-[#FF7A1A] shrink-0" strokeWidth={2.5} />
                            ) : (
                              <Plus className="w-3.5 h-3.5 opacity-60 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Add Custom .exe Process */}
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        dir="ltr"
                        value={customAppInput}
                        onChange={(e) => setCustomAppInput(e.target.value)}
                        placeholder={t.splitTunnelAppsPlaceholder}
                        className={`flex-1 h-[36px] rounded-[8px] text-[11.5px] px-2.5 border outline-none ${
                          isDark
                            ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomSplitApp}
                        className="px-3 h-[36px] rounded-[8px] border-0 bg-[#FF7A1A] text-[#1A0F05] font-bold text-[11.5px] cursor-pointer"
                      >
                        {t.addAppBtn}
                      </button>
                    </div>

                    {/* Active App Chips */}
                    {(settingsDraft.splitTunnelApps || []).length > 0 && (
                      <div dir="ltr" className="flex flex-wrap gap-1 pt-0.5">
                        {(settingsDraft.splitTunnelApps || []).map((exe) => (
                          <span
                            key={exe}
                            onClick={() => toggleSplitTunnelApp(exe)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] bg-[#2DD4A0]/15 text-[#2DD4A0] border border-[#2DD4A0]/30 cursor-pointer"
                          >
                            <span>{exe}</span>
                            <span className="text-[10px] opacity-80">✕</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Local Proxy Ports & LAN Sharing Card */}
              <div
                className={`p-3.5 rounded-[12px] border flex flex-col gap-3 ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-[13px]">
                  <Network className="w-4 h-4 text-[#FF9A4D]" />
                  <span>{t.localPortsTitle}</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="settings-socks-port" className="text-[11.5px] font-semibold text-[#8B96A3]">
                      {t.socksPortLabel}
                    </label>
                    <input
                      id="settings-socks-port"
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      value={settingsDraft.localSocksPort || 1080}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          localSocksPort: Number(e.target.value) || 1080,
                        })
                      }
                      className={`w-full box-border h-[38px] rounded-[9px] text-[12px] px-3 border outline-none ${
                        isDark
                          ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="settings-http-port" className="text-[11.5px] font-semibold text-[#8B96A3]">
                      {t.httpPortLabel}
                    </label>
                    <input
                      id="settings-http-port"
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      value={settingsDraft.localHttpPort || 8080}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          localHttpPort: Number(e.target.value) || 8080,
                        })
                      }
                      className={`w-full box-border h-[38px] rounded-[9px] text-[12px] px-3 border outline-none ${
                        isDark
                          ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div
                  className={`flex items-center justify-between gap-3 p-[9px_12px] rounded-[10px] border ${
                    isDark ? 'bg-[#0E1116] border-[#2A323D]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="flex flex-col min-w-0">
                    <span className="font-semibold text-[12.5px]">{t.allowLanLabel}</span>
                    <span className="text-[10.5px] text-[#8B96A3]">{t.allowLanDesc}</span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(settingsDraft.allowLan)}
                    onClick={() =>
                      setSettingsDraft({ ...settingsDraft, allowLan: !settingsDraft.allowLan })
                    }
                    className="w-[44px] h-[36px] border-0 bg-transparent p-0 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <span
                      className={`w-[40px] h-[22px] rounded-[11px] relative block transition-colors ${
                        settingsDraft.allowLan ? 'bg-[#FF7A1A]' : 'bg-[#2A323D]'
                      }`}
                    >
                      <span
                        className={`absolute top-[2px] w-[18px] h-[18px] rounded-full transition-all ${
                          settingsDraft.allowLan
                            ? 'right-[2px] bg-[#1A0F05]'
                            : 'left-[2px] bg-[#A5AFBB]'
                        }`}
                      ></span>
                    </span>
                  </button>
                </div>
              </div>

              {/* 4. Anti-DPI & Firewall Security Card */}
              <div
                className={`p-3.5 rounded-[12px] border flex flex-col gap-3 ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-[13px]">
                  <ShieldCheck className="w-4 h-4 text-[#2DD4A0]" />
                  <span>{t.antiDpiFeatureTitle}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="settings-tls-select" className="text-[11.5px] font-semibold text-[#8B96A3]">
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
                      className={`w-full box-border h-[40px] appearance-none rounded-[10px] text-[12px] ps-3 pe-8 border transition-colors outline-none ${
                        isDark
                          ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="sni">
                        {lang === 'fa' ? 'شکستن هوشمند در SNI (پیشنهادی)' : 'Split at SNI (Recommended)'}
                      </option>
                      <option value="first-byte">
                        {lang === 'fa' ? 'شکستن بایت اول (First-Byte Split)' : 'First-Byte Split'}
                      </option>
                      <option value="record">
                        {lang === 'fa' ? 'تکه‌تکه کردن رکورد TLS (Multi-Record)' : 'Multi-Record TLS Fragmentation'}
                      </option>
                      <option value="off">{lang === 'fa' ? 'خاموش' : 'Disabled'}</option>
                    </select>
                    <ChevronNext className="absolute end-2.5 top-3 w-4 h-4 text-[#8B96A3] pointer-events-none" />
                  </div>
                </div>

                {settingsDraft.tlsSplitMode !== 'off' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="settings-frag-size" className="text-[11px] font-semibold text-[#8B96A3]">
                        {t.fragmentSizeLabel}
                      </label>
                      <input
                        id="settings-frag-size"
                        type="text"
                        inputMode="numeric"
                        dir="ltr"
                        value={settingsDraft.fragmentSize || 24}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            fragmentSize: Number(e.target.value) || 24,
                          })
                        }
                        className={`w-full box-border h-[36px] rounded-[8px] text-[12px] px-2.5 border outline-none ${
                          isDark
                            ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="settings-frag-delay" className="text-[11px] font-semibold text-[#8B96A3]">
                        {t.fragmentDelayLabel}
                      </label>
                      <input
                        id="settings-frag-delay"
                        type="text"
                        inputMode="numeric"
                        dir="ltr"
                        value={settingsDraft.fragmentDelayMs ?? 12}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            fragmentDelayMs: Number(e.target.value) || 0,
                          })
                        }
                        className={`w-full box-border h-[36px] rounded-[8px] text-[12px] px-2.5 border outline-none ${
                          isDark
                            ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Kill Switch Toggle */}
                <div
                  className={`flex items-center justify-between gap-3 p-[9px_12px] rounded-[10px] border ${
                    isDark ? 'bg-[#0E1116] border-[#2A323D]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="flex flex-col min-w-0">
                    <span className="font-semibold text-[12.5px]">Kill Switch</span>
                    <span className="text-[10.5px] text-[#8B96A3]">{t.killSwitchDesc}</span>
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
                    className="w-[44px] h-[36px] border-0 bg-transparent p-0 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <span
                      className={`w-[40px] h-[22px] rounded-[11px] relative block transition-colors ${
                        settingsDraft.killSwitch ? 'bg-[#FF7A1A]' : 'bg-[#2A323D]'
                      }`}
                    >
                      <span
                        className={`absolute top-[2px] w-[18px] h-[18px] rounded-full transition-all ${
                          settingsDraft.killSwitch
                            ? 'right-[2px] bg-[#1A0F05]'
                            : 'left-[2px] bg-[#A5AFBB]'
                        }`}
                      ></span>
                    </span>
                  </button>
                </div>

                {/* Block IPv6 Leak Toggle */}
                <div
                  className={`flex items-center justify-between gap-3 p-[9px_12px] rounded-[10px] border ${
                    isDark ? 'bg-[#0E1116] border-[#2A323D]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="flex flex-col min-w-0">
                    <span className="font-semibold text-[12.5px]">{t.blockIpv6Label}</span>
                    <span className="text-[10.5px] text-[#8B96A3]">{t.blockIpv6Desc}</span>
                  </span>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={settingsDraft.blockIpv6 !== false}
                    onClick={() =>
                      setSettingsDraft({
                        ...settingsDraft,
                        blockIpv6: settingsDraft.blockIpv6 === false ? true : false,
                      })
                    }
                    className="w-[44px] h-[36px] border-0 bg-transparent p-0 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <span
                      className={`w-[40px] h-[22px] rounded-[11px] relative block transition-colors ${
                        settingsDraft.blockIpv6 !== false ? 'bg-[#FF7A1A]' : 'bg-[#2A323D]'
                      }`}
                    >
                      <span
                        className={`absolute top-[2px] w-[18px] h-[18px] rounded-full transition-all ${
                          settingsDraft.blockIpv6 !== false
                            ? 'right-[2px] bg-[#1A0F05]'
                            : 'left-[2px] bg-[#A5AFBB]'
                        }`}
                      ></span>
                    </span>
                  </button>
                </div>
              </div>

              {/* 5. Advanced Card */}
              <div
                className={`p-3.5 rounded-[12px] border flex flex-col gap-3 ${
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

                <div className="flex flex-col gap-1">
                  <label htmlFor="settings-fxa-proxy" className="text-[11.5px] font-semibold text-[#8B96A3]">
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
                    className={`w-full box-border h-[38px] rounded-[9px] text-[12px] px-3 border transition-colors outline-none ${
                      isDark
                        ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="settings-edge-ip" className="text-[11.5px] font-semibold text-[#8B96A3]">
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
                    placeholder="151.101.1.91"
                    className={`w-full box-border h-[38px] rounded-[9px] text-[12px] px-3 border transition-colors outline-none ${
                      isDark
                        ? 'bg-[#0E1116] border-[#2A323D] text-[#E8ECF1]'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Collapsible Logs Section with Copy button */}
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
                      className="px-2 py-1 rounded bg-[#FF7A1A]/15 text-[#FF7A1A] font-bold text-[11px] flex items-center gap-1 cursor-pointer border-0"
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
                    className="p-3 pt-0 max-h-40 overflow-y-auto text-[10.5px] text-[#8B96A3] space-y-1 bg-[#0A0D11]"
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
                className="shrink-0 h-[46px] border-0 rounded-[11px] bg-[#FF7A1A] hover:bg-[#FFA04D] text-[#1A0F05] font-bold text-[13.5px] flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg active:scale-[0.98]"
              >
                <Check className="w-[17px] h-[17px]" strokeWidth={2.4} />
                <span>{t.saveSettingsBtn}</span>
              </button>
            </form>
          )}

          {/* ========================================================
              PAGE 4: درباره (ABOUT — Sleek Logo, Concise Summary & Live Update Check)
              ======================================================== */}
          {activeTab === 'about' && (
            <>
              {/* Hero Card */}
              <div
                className={`p-[18px_16px_16px] rounded-[14px] border flex flex-col items-center gap-2 text-center ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0] shadow-2xs'
                }`}
              >
                <div
                  className="w-[78px] h-[78px] rounded-[20px] flex items-center justify-center border"
                  style={{
                    background: '#0E1116',
                    borderColor: '#2A323D',
                    boxShadow: '0 0 36px rgba(255,122,26,.22)',
                  }}
                >
                  <FoxyLogo size={58} />
                </div>

                <span className="text-[19px] font-bold tracking-tight">FoxyVPN Windows</span>

                <div className="flex gap-2 items-center">
                  <span
                    dir="ltr"
                    className="text-[11px] font-bold text-[#FF9A4D] bg-[#241609] border border-[#6B3A12] rounded-[20px] px-2.5 py-0.5"
                  >
                    v{APP_VERSION}
                  </span>
                  <span
                    dir="ltr"
                    className="text-[11px] font-medium text-[#6FD6F0] bg-[#0F2530] border border-[#1F5568] rounded-[20px] px-2.5 py-0.5"
                  >
                    Windows 10 / 11
                  </span>
                </div>

                <span className="text-[12px] text-[#8B96A3] max-w-[270px] leading-relaxed">
                  {t.aboutSummary}
                </span>

                {/* Check for Updates Status Banner */}
                {updateResult && (
                  <div
                    className={`w-full p-2.5 rounded-[10px] border text-[11.5px] flex flex-col gap-1.5 ${
                      updateResult.updateAvailable
                        ? 'bg-[#FF7A1A]/15 border-[#FF7A1A]/40 text-[#FF9A4D]'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-[#2DD4A0]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>
                        {updateResult.updateAvailable
                          ? `${t.updateAvailableTitle}: v${updateResult.latestVersion}`
                          : `${t.upToDateNotice} (v${APP_VERSION})`}
                      </span>
                      {updateResult.updateAvailable && (
                        <button
                          type="button"
                          onClick={() => openExternalUrl(updateResult.releaseUrl)}
                          className="px-2.5 py-1 rounded-md bg-[#FF7A1A] text-[#1A0F05] text-[11px] font-bold border-0 cursor-pointer flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>{t.downloadUpdateBtn}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 w-full mt-1">
                  {/* Live Check for New Version Button */}
                  <button
                    type="button"
                    onClick={handleCheckForUpdates}
                    disabled={isCheckingUpdate}
                    className="h-[42px] border-0 rounded-[10px] bg-[#FF7A1A] hover:bg-[#FFA04D] text-[#1A0F05] font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm disabled:opacity-60"
                  >
                    <RefreshCw className={`w-4 h-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                    <span>{isCheckingUpdate ? t.checkingUpdates : t.checkForUpdatesBtn}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openExternalUrl('https://github.com/mostafa5804/foxyvpn_windows/releases')}
                      className={`h-[38px] rounded-[9px] border font-semibold text-[12px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        isDark
                          ? 'border-[#2A323D] bg-[#0E1116] text-[#E8ECF1] hover:bg-slate-800/40'
                          : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5 text-[#FF7A1A]" />
                      <span>{t.githubReleasesBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openExternalUrl('https://github.com/mostafa5804/foxyvpn_windows')}
                      className={`h-[38px] rounded-[9px] border font-semibold text-[12px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        isDark
                          ? 'border-[#2A323D] bg-[#0E1116] text-[#E8ECF1] hover:bg-slate-800/40'
                          : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#2DD4A0]" />
                      <span>{t.githubRepoBtn}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Compact Core Capabilities Grid (Concise & Scannable) */}
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={`p-2.5 rounded-[12px] border flex items-center gap-2.5 ${
                    isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0]'
                  }`}
                >
                  <Zap className="w-4 h-4 text-[#FF9A4D] shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-[11.5px] truncate">
                      {lang === 'fa' ? 'سهمیه ۵۰ گیگ واقعی' : '50 GB Live Quota'}
                    </span>
                    <span className="text-[10.5px] text-[#8B96A3] truncate">
                      {lang === 'fa' ? 'همگام با سرور موزیلا' : 'Mozilla Guardian Sync'}
                    </span>
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-[12px] border flex items-center gap-2.5 ${
                    isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0]'
                  }`}
                >
                  <Cpu className="w-4 h-4 text-[#6FD6F0] shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-[11.5px] truncate">
                      {lang === 'fa' ? 'تونل برنامه‌ها و Wintun' : 'Wintun + App Split'}
                    </span>
                    <span className="text-[10.5px] text-[#8B96A3] truncate">
                      {lang === 'fa' ? 'لایه ۳ و تفکیک برنامه' : 'Layer-3 & Per-App'}
                    </span>
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-[12px] border flex items-center gap-2.5 ${
                    isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0]'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-[#2DD4A0] shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-[11.5px] truncate">
                      {lang === 'fa' ? 'ضد فیلترینگ TLS' : 'TLS Anti-DPI Split'}
                    </span>
                    <span className="text-[10.5px] text-[#8B96A3] truncate">
                      {lang === 'fa' ? 'SNI Split + Kill Switch' : 'SNI Split + Kill Switch'}
                    </span>
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-[12px] border flex items-center gap-2.5 ${
                    isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0]'
                  }`}
                >
                  <Globe className="w-4 h-4 text-[#B79CF7] shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-[11.5px] truncate">
                      {lang === 'fa' ? '۳۸ سرور فاستلی' : '38 Fastly Nodes'}
                    </span>
                    <span className="text-[10.5px] text-[#8B96A3] truncate">
                      {lang === 'fa' ? '۲۲ کشور · DoH امن' : '22 Countries · DoH'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Compact Build Specs */}
              <div
                className={`p-[10px_14px] rounded-[12px] border flex items-center justify-between text-[11px] ${
                  isDark ? 'bg-[#151A21] border-[#232A33]' : 'bg-[#FFFFFF] border-[#E2E8F0]'
                }`}
              >
                <span className="text-[#8B96A3]">
                  {t.appVersionLabel} <strong className="text-[#FF9A4D]">v{APP_VERSION}</strong>
                </span>
                <span dir="ltr" className="text-[#8B96A3]">Wails 2.9 · Wintun 0.14</span>
                <span dir="ltr" className="text-[#2DD4A0] font-bold">MIT Open Source</span>
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
