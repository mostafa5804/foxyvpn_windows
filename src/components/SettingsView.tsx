import React, { useState } from 'react';
import {
  Cpu,
  ShieldCheck,
  Network,
  Save,
  CheckCircle2,
} from 'lucide-react';
import type { ClientSettings } from '../utils/vpnLogic';

interface SettingsViewProps {
  settings: ClientSettings;
  onSave: (updated: ClientSettings) => Promise<void>;
  isDark: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSave,
  isDark,
}) => {
  const [draft, setDraft] = useState<ClientSettings>({ ...settings });
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(draft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            Tunnel Engine & Anti-DPI Configuration
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Configure Windows Wintun adapter, WinINET System Proxy, DoH DNS, and TLS fragmentation
          </p>
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Configuration</span>
        </button>
      </div>

      {savedNotice && (
        <div
          role="status"
          className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Configuration saved and applied to Go tunnel engine.</span>
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
            <h3 className="text-sm font-semibold">Windows Network Mode</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDraft({ ...draft, mode: 'tun' })}
              className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                draft.mode === 'tun'
                  ? 'border-orange-500 bg-orange-500/10'
                  : isDark
                  ? 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="text-xs font-bold mb-1">Full System (Wintun TUN)</div>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Spawns <code className="font-mono">FoxyVPN-Adapter</code> (<span className="font-mono">10.0.0.2/24</span>)
                and routes all system traffic (<span className="font-mono">0.0.0.0/0</span>).
              </p>
            </button>

            <button
              type="button"
              onClick={() => setDraft({ ...draft, mode: 'proxy' })}
              className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                draft.mode === 'proxy'
                  ? 'border-orange-500 bg-orange-500/10'
                  : isDark
                  ? 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="text-xs font-bold mb-1">System Proxy (SOCKS5 / WinINET)</div>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Listens on <code className="font-mono">127.0.0.1:1080</code> & updates Windows Registry Proxy without
                requiring Wintun driver.
              </p>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label htmlFor="setting-mtu" className="block text-xs font-medium mb-1">
                Wintun Adapter MTU
              </label>
              <input
                id="setting-mtu"
                type="number"
                min={1280}
                max={1500}
                value={draft.mtu}
                onChange={(e) => setDraft({ ...draft, mtu: Number(e.target.value) || 1380 })}
                className={`w-full px-3 py-2 rounded-xl font-mono text-xs border ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label htmlFor="setting-doh" className="block text-xs font-medium mb-1">
                Encrypted DoH DNS Resolver
              </label>
              <select
                id="setting-doh"
                value={draft.dohProvider}
                onChange={(e) =>
                  setDraft({ ...draft, dohProvider: e.target.value as ClientSettings['dohProvider'] })
                }
                className={`w-full px-3 py-2 rounded-xl font-mono text-xs border ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="1.1.1.1">Cloudflare (1.1.1.1 /dns-query)</option>
                <option value="8.8.8.8">Google (8.8.8.8 /dns-query)</option>
                <option value="9.9.9.9">Quad9 (9.9.9.9 /dns-query)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="text-xs font-semibold">Route Kill Switch & Safe Exit</div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Prevent non-tunneled traffic leak and auto-restore routes on crash/exit
              </p>
            </div>
            <input
              type="checkbox"
              aria-label="Enable Route Kill Switch"
              checked={draft.killSwitch}
              onChange={(e) => setDraft({ ...draft, killSwitch: e.target.checked })}
              className="w-4 h-4 accent-orange-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Card 2: Anti-DPI TLS Fragmentation & Upstream Chaining */}
        <div
          className={`p-5 rounded-2xl border space-y-4 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold">Anti-DPI & Censorship Circumvention</h3>
          </div>

          <div>
            <label htmlFor="setting-tls-split" className="block text-xs font-medium mb-1">
              TLS ClientHello Fragmentation Mode
            </label>
            <select
              id="setting-tls-split"
              value={draft.tlsSplitMode}
              onChange={(e) =>
                setDraft({ ...draft, tlsSplitMode: e.target.value as ClientSettings['tlsSplitMode'] })
              }
              className={`w-full px-3 py-2 rounded-xl text-xs border ${
                isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="sni">SNI Hostname TCP Segment Split (پیش‌فرض پیشنهادی - ضد فیلترینگ DPI)</option>
              <option value="first-byte">First Byte Fragmentation (شکست بایت اول)</option>
              <option value="off">Disabled (اتصال مستقیم استاندارد TLS 1.3)</option>
            </select>
          </div>

          <div>
            <label htmlFor="setting-control-proxy" className="block text-xs font-medium mb-1">
              Control-Plane / Upstream Proxy (Optional)
            </label>
            <input
              id="setting-control-proxy"
              type="text"
              value={draft.controlPlaneProxy}
              onChange={(e) => setDraft({ ...draft, controlPlaneProxy: e.target.value })}
              placeholder="e.g. socks5://127.0.0.1:2080 or http://127.0.0.1:8081"
              className={`w-full px-3 py-2 rounded-xl font-mono text-xs border ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
              }`}
            />
            <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Routes FxA login & Guardian token requests through an auxiliary proxy if blocked by ISP.
            </p>
          </div>

          <div>
            <label htmlFor="setting-edge-ip" className="block text-xs font-medium mb-1">
              Custom Fastly Edge Anycast IP Override (Optional)
            </label>
            <div className="relative">
              <Network className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="setting-edge-ip"
                type="text"
                value={draft.edgeOverrideIp}
                onChange={(e) => setDraft({ ...draft, edgeOverrideIp: e.target.value })}
                placeholder="e.g. 151.101.1.194 (Leave blank for automatic DNS)"
                className={`w-full pl-9 pr-3 py-2 rounded-xl font-mono text-xs border ${
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
