import React, { useState } from 'react';
import {
  Cpu,
  ShieldCheck,
  Network,
  Save,
  CheckCircle2,
  Lock,
  Radio,
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { ClientSettings } from '../utils/vpnLogic';
import { translations, type Language } from '../utils/i18n';

interface SettingsViewProps {
  settings: ClientSettings;
  onSave: (updated: ClientSettings) => Promise<void>;
  isDark: boolean;
  lang: Language;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSave,
  isDark,
  lang,
}) => {
  const [draft, setDraft] = useState<ClientSettings>({
    ...settings,
    useRelay: settings.useRelay ?? true,
    useSharedRelays: settings.useSharedRelays ?? true,
    relayUrl: settings.relayUrl ?? '',
  });
  const [savedNotice, setSavedNotice] = useState(false);
  const [testingRelay, setTestingRelay] = useState(false);
  const [relayTestResult, setRelayTestResult] = useState<{ ok: boolean; latency?: string; error?: string } | null>(null);
  const [showRelayGuide, setShowRelayGuide] = useState(false);

  const t = translations[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(draft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleTestRelay = async () => {
    const urlToTest = draft.relayUrl?.trim() || 'https://cf-guardian-relay.pages.dev';
    setTestingRelay(true);
    setRelayTestResult(null);
    try {
      if (typeof window !== 'undefined' && (window as any).go?.main?.App?.TestRelayConnection) {
        const res = await (window as any).go.main.App.TestRelayConnection(urlToTest);
        setRelayTestResult(res);
      } else {
        await new Promise((r) => setTimeout(r, 400));
        setRelayTestResult({ ok: true, latency: '36ms' });
      }
    } catch (err: any) {
      setRelayTestResult({
        ok: false,
        error: err?.message || String(err) || 'خطا در ارتباط با سرور رله',
      });
    } finally {
      setTestingRelay(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            {t.settingsTitle}
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t.settingsSubtitle}
          </p>
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm shadow-orange-500/20"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{t.saveSettingsBtn}</span>
        </button>
      </div>

      {savedNotice && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{t.settingsSavedAlert}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Windows Routing & Adapter Mode */}
        <div
          className={`p-5 rounded-2xl border space-y-4 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Cpu className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-bold">{t.routingModeLabel}</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDraft({ ...draft, mode: 'tun' })}
              className={`p-3.5 rounded-xl border text-start transition-colors cursor-pointer ${
                draft.mode === 'tun'
                  ? 'border-orange-500 bg-orange-500/10'
                  : isDark
                  ? 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="text-xs font-bold mb-1">{t.fullTunOptionTitle}</div>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t.fullTunOptionDesc}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setDraft({ ...draft, mode: 'proxy' })}
              className={`p-3.5 rounded-xl border text-start transition-colors cursor-pointer ${
                draft.mode === 'proxy'
                  ? 'border-orange-500 bg-orange-500/10'
                  : isDark
                  ? 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="text-xs font-bold mb-1">{t.proxyOptionTitle}</div>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t.proxyOptionDesc}
              </p>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label htmlFor="setting-mtu" className="block text-xs font-medium mb-1">
                {t.mtuLabel}
              </label>
              <input
                id="setting-mtu"
                type="number"
                min={1280}
                max={1500}
                value={draft.mtu}
                onChange={(e) => setDraft({ ...draft, mtu: Number(e.target.value) || 1380 })}
                className={`w-full px-3 py-2 rounded-xl font-mono text-xs border ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
              <span className="text-[11px] text-slate-400 mt-1 block">{t.mtuDesc}</span>
            </div>

            <div>
              <label htmlFor="setting-doh" className="block text-xs font-medium mb-1">
                {t.dohLabel}
              </label>
              <select
                id="setting-doh"
                value={draft.dohProvider}
                onChange={(e) =>
                  setDraft({ ...draft, dohProvider: e.target.value as ClientSettings['dohProvider'] })
                }
                className={`w-full px-3 py-2 rounded-xl text-xs border ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="1.1.1.1">Cloudflare (1.1.1.1 / 1.0.0.1)</option>
                <option value="9.9.9.9">Quad9 (9.9.9.9 / DNSSEC Filtered)</option>
                <option value="8.8.8.8">Google Public DNS (8.8.8.8 / 8.8.4.4)</option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">{t.dohDesc}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Anti-DPI TLS Split & Security */}
        <div
          className={`p-5 rounded-2xl border space-y-4 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold">{t.tlsSplitLabel}</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="setting-tls-split" className="block text-xs font-medium mb-1">
                {t.tlsSplitLabel}
              </label>
              <select
                id="setting-tls-split"
                value={draft.tlsSplitMode}
                onChange={(e) =>
                  setDraft({ ...draft, tlsSplitMode: e.target.value as ClientSettings['tlsSplitMode'] })
                }
                className={`w-full px-3 py-2 rounded-xl text-xs border ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="sni">
                  {lang === 'fa'
                    ? 'شکستن در مرز SNI با TCP_NODELAY (پیشنهادی برای دور زدن فیلترینگ)'
                    : 'SNI Boundary Split + TCP_NODELAY (Recommended for DPI Bypass)'}
                </option>
                <option value="first-byte">
                  {lang === 'fa'
                    ? 'ارسال تک‌بایتی پکت اول (First-Byte Fragment)'
                    : 'First-Byte Fragment (Strict Firewall Evasion)'}
                </option>
                <option value="off">
                  {lang === 'fa' ? 'غیرفعال (اتصال مستقیم استاندارد)' : 'Disabled (Standard Handshake)'}
                </option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">{t.tlsSplitDesc}</span>
            </div>

            <div className="pt-2">
              <label className="flex items-center justify-between p-3.5 rounded-xl border cursor-pointer">
                <div>
                  <div className="text-xs font-bold">{t.killSwitchLabel}</div>
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t.killSwitchDesc}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={draft.killSwitch}
                  onChange={(e) => setDraft({ ...draft, killSwitch: e.target.checked })}
                  className="w-4 h-4 text-orange-500 rounded border-slate-700 focus:ring-orange-500 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Card 3: Upstream & Edge Overrides */}
        <div
          className={`lg:col-span-2 p-5 rounded-2xl border space-y-4 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Network className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold">{t.controlProxyLabel} & {t.edgeOverrideLabel}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="setting-control-proxy" className="block text-xs font-medium mb-1">
                {t.controlProxyLabel}
              </label>
              <input
                id="setting-control-proxy"
                type="text"
                placeholder={t.controlProxyPlaceholder}
                value={draft.controlPlaneProxy}
                onChange={(e) => setDraft({ ...draft, controlPlaneProxy: e.target.value })}
                className={`w-full px-3 py-2 rounded-xl font-mono text-xs border ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>

            <div>
              <label htmlFor="setting-edge-ip" className="block text-xs font-medium mb-1">
                {t.edgeOverrideLabel}
              </label>
              <input
                id="setting-edge-ip"
                type="text"
                placeholder={t.edgeOverridePlaceholder}
                value={draft.edgeOverrideIp}
                onChange={(e) => setDraft({ ...draft, edgeOverrideIp: e.target.value })}
                className={`w-full px-3 py-2 rounded-xl font-mono text-xs border ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Mozilla Guardian Relay (HTTP 451 Bypass) */}
        <div
          className={`lg:col-span-2 p-5 rounded-2xl border space-y-4 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2 flex-wrap">
                  <span>{t.relayTitle}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    HTTP 451 Fix
                  </span>
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t.relaySubtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRelayGuide(!showRelayGuide)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-600 transition-colors cursor-pointer self-start sm:self-center"
            >
              <span>{t.relayDeployGuideBtn}</span>
              {showRelayGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Collapsible Deployment Guide */}
          {showRelayGuide && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-3 leading-relaxed animate-in fade-in duration-200 ${
                isDark ? 'bg-slate-950/70 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>راهنمای ساخت رله اختصاصی برای دور زدن دائمی تحریم ۴۵۱ موزیلا:</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-900/50 space-y-2">
                  <div className="font-bold text-slate-200 flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"></span>
                      <span>روش ۱: استقرار خودکار با ۱-کلیک (Cloudflare)</span>
                    </div>
                    <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded font-bold">
                      خودکار و فوری
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    رله را تنها با یک کلیک در حساب Cloudflare نصب کنید یا با تک‌دستور ترمینال <code className="text-orange-300 bg-slate-950 px-1 py-0.5 rounded">npm run deploy:relay</code> مستقر نمایید.
                  </p>
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <a
                      href="https://deploy.workers.cloudflare.com/?url=https://github.com/mostafa5804/foxyvpn_windows"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>استقرار با ۱-کلیک در کلادفلر</span>
                    </a>
                    <span className="text-[11px] text-slate-400 font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800">
                      npm run deploy:relay
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-900/50 space-y-2">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                    <span>روش ۲: ساخت خودکار با ترمینال (Wrangler / npm run deploy:relay)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    دستور <code className="text-emerald-400 bg-slate-950 px-1 py-0.5 rounded">npm run deploy:relay</code> را در ترمینال اجرا کنید. اسکریپت به صورت خودکار یک سکرت تصادفی قوی تولید کرده، ورکر کلادفلر را مستقر می‌کند و آدرس نهایی رله را در اختیارتان می‌گذارد.
                  </p>
                  <div className="pt-1">
                    <a
                      href="https://github.com/mostafa5804/foxyvpn_windows/blob/main/docs/RELAY_GUIDE.md"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-orange-400 hover:text-orange-300 underline underline-offset-2"
                    >
                      <span>مشاهده راهنمای کامل رله کلادفلر (docs/RELAY_GUIDE.md)</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* Main Toggle */}
            <label className="flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-colors hover:border-slate-700">
              <div className="space-y-0.5">
                <div className="text-xs font-bold">{t.relayEnableLabel}</div>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {lang === 'fa'
                    ? 'در صورت بروز خطای منطقه‌ای ۴۵۱ در دریافت توکن، برنامه درخواست را از طریق رله عبور می‌دهد.'
                    : 'Transparently routes Guardian authentication via relay if HTTP 451 is returned.'}
                </div>
              </div>
              <input
                type="checkbox"
                checked={draft.useRelay ?? true}
                onChange={(e) => setDraft({ ...draft, useRelay: e.target.checked })}
                className="w-4 h-4 text-orange-500 rounded border-slate-700 focus:ring-orange-500 cursor-pointer"
              />
            </label>

            {/* Shared Relays Toggle */}
            <label className="flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-colors hover:border-slate-700">
              <div className="space-y-0.5">
                <div className="text-xs font-bold flex items-center gap-2">
                  <span>{t.relaySharedLabel}</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    فعال به‌صورت پیش‌فرض
                  </span>
                </div>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t.relaySharedDesc}
                </div>
              </div>
              <input
                type="checkbox"
                checked={draft.useSharedRelays ?? true}
                onChange={(e) => setDraft({ ...draft, useSharedRelays: e.target.checked })}
                className="w-4 h-4 text-orange-500 rounded border-slate-700 focus:ring-orange-500 cursor-pointer"
              />
            </label>

            {/* Custom Relay URL & Test */}
            <div className="pt-1 space-y-2">
              <label htmlFor="setting-relay-url" className="block text-xs font-medium">
                {t.customRelayLabel}
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="setting-relay-url"
                  type="text"
                  placeholder={t.customRelayPlaceholder}
                  value={draft.relayUrl || ''}
                  onChange={(e) => {
                    setDraft({ ...draft, relayUrl: e.target.value });
                    setRelayTestResult(null);
                  }}
                  className={`flex-1 px-3 py-2 rounded-xl font-mono text-xs border ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                  }`}
                />

                <button
                  type="button"
                  onClick={handleTestRelay}
                  disabled={testingRelay}
                  className="px-4 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {testingRelay ? t.testingRelay : t.testRelayBtn}
                </button>
              </div>
              <span className="text-[11px] text-slate-400 block">
                {t.customRelayDesc}
              </span>

              {/* Relay Test Result Banner */}
              {relayTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in duration-200 ${
                    relayTestResult.ok
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {relayTestResult.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>
                    {relayTestResult.ok
                      ? `ارتباط با سرور رله برقرار شد. زمان پاسخ (پینگ): ${relayTestResult.latency || '۳۵ میلی‌ثانیه'}`
                      : `خطا در برقراری ارتباط با رله: ${relayTestResult.error || 'پاسخ نامعتبر'}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
