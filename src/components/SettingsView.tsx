import React, { useState } from 'react';
import {
  Cpu,
  ShieldCheck,
  Network,
  Save,
  CheckCircle2,
  Lock,
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
  const [draft, setDraft] = useState<ClientSettings>({ ...settings });
  const [savedNotice, setSavedNotice] = useState(false);

  const t = translations[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(draft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
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
      </div>
    </form>
  );
};
