import React, { useState } from 'react';
import { Search, Check, Globe, ArrowUpDown, RefreshCw, Zap } from 'lucide-react';
import {
  filterAndSortServers,
  countryCodeToFlag,
  type ServerInfo,
} from '../utils/vpnLogic';
import { translations, type Language } from '../utils/i18n';
import { vpnBridge } from '../utils/wailsBridge';

interface ServerSelectorModalProps {
  servers: ServerInfo[];
  selectedServerId: string;
  onSelect: (server: ServerInfo) => void;
  onClose: () => void;
  isDark: boolean;
  lang: Language;
  onRefreshServers?: (updated: ServerInfo[]) => void;
}

export const ServerSelectorModal: React.FC<ServerSelectorModalProps> = ({
  servers,
  selectedServerId,
  onSelect,
  onClose,
  isDark,
  lang,
  onRefreshServers,
}) => {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latency' | 'country'>('latency');
  const [refreshing, setRefreshing] = useState(false);
  const [localServers, setLocalServers] = useState<ServerInfo[]>(servers);

  const t = translations[lang];

  const handleRefreshPings = async () => {
    setRefreshing(true);
    try {
      const refreshed = await vpnBridge.refreshAllPings();
      setLocalServers(refreshed);
      if (onRefreshServers) {
        onRefreshServers(refreshed);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const visibleServers = filterAndSortServers(localServers, query, sortBy);
  const autoServer = localServers.find((s) => s.id === 'auto') || localServers[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="server-modal-title"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-2xl rounded-2xl border p-6 flex flex-col max-h-[85vh] shadow-2xl ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 id="server-modal-title" className="text-base font-bold tracking-tight">
                {t.selectServerTitle}
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t.selectServerSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              isDark
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {t.close}
          </button>
        </div>

        {/* Featured Automatic Best Server Card */}
        <div className="mt-4 mb-2">
          <button
            type="button"
            onClick={() => {
              onSelect(autoServer);
              onClose();
            }}
            className={`w-full p-4 rounded-xl border flex items-center justify-between gap-4 transition-all text-start cursor-pointer ${
              selectedServerId === 'auto'
                ? isDark
                  ? 'bg-orange-500/15 border-orange-500 text-orange-200 shadow-sm'
                  : 'bg-orange-50 border-orange-500 text-orange-950 shadow-sm'
                : isDark
                ? 'bg-slate-950/70 border-slate-800 hover:border-orange-500/50 text-slate-200'
                : 'bg-slate-50 border-slate-200 hover:border-orange-500/50 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold truncate">{t.autoServerTitle}</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {lang === 'fa' ? 'پیش‌فرض پیشنهادی' : 'Recommended Default'}
                  </span>
                </div>
                <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t.autoServerDesc}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono tabular-nums text-xs font-bold text-emerald-400">
                {autoServer.latencyMs} ms
              </span>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                  selectedServerId === 'auto'
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : isDark
                    ? 'border-slate-700'
                    : 'border-slate-300'
                }`}
              >
                {selectedServerId === 'auto' && <Check className="w-3 h-3" />}
              </div>
            </div>
          </button>
        </div>

        {/* Search, Sort, and Live Ping Refresh Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 my-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3 pointer-events-none" />
            <input
              type="text"
              aria-label={t.searchServerPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchServerPlaceholder}
              className={`w-full py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/40 ${
                lang === 'fa' ? 'pr-9 pl-4' : 'pl-9 pr-4'
              } ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSortBy(sortBy === 'latency' ? 'country' : 'latency')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap cursor-pointer transition-colors ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:text-slate-900'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-orange-400" />
              <span>{sortBy === 'latency' ? t.sortLowestPing : t.sortCountry}</span>
            </button>

            <button
              type="button"
              onClick={handleRefreshPings}
              disabled={refreshing}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap cursor-pointer transition-colors ${
                refreshing ? 'opacity-60 cursor-not-allowed' : ''
              } ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:text-slate-900'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? t.refreshingPings : t.refreshPings}</span>
            </button>
          </div>
        </div>

        {/* Server Table / List */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-800/30 pr-1 space-y-1 mt-1">
          {visibleServers.filter((s) => s.id !== 'auto').length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              {t.noServersFound}
            </div>
          ) : (
            visibleServers
              .filter((s) => s.id !== 'auto')
              .map((srv) => {
                const isSelected = srv.id === selectedServerId;
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => {
                      onSelect(srv);
                      onClose();
                    }}
                    className={`w-full text-start px-3.5 py-3 flex items-center justify-between gap-4 transition-colors rounded-xl cursor-pointer ${
                      isSelected
                        ? isDark
                          ? 'bg-orange-500/15 text-orange-200'
                          : 'bg-orange-50 text-orange-950'
                        : isDark
                        ? 'hover:bg-slate-800/60 text-slate-200'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl leading-none select-none shrink-0" aria-hidden="true">
                        {countryCodeToFlag(srv.countryCode)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {srv.countryName} — {srv.cityName}
                        </div>
                        <div
                          className={`text-xs font-mono truncate ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {srv.host}:{srv.port} · {srv.protocol}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 shrink-0">
                      <span
                        className={`font-mono tabular-nums text-xs font-bold ${
                          srv.latencyMs < 50
                            ? 'text-emerald-400'
                            : srv.latencyMs < 120
                            ? 'text-amber-400'
                            : 'text-orange-400'
                        }`}
                      >
                        {srv.latencyMs} ms
                      </span>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                          isSelected
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : isDark
                            ? 'border-slate-700'
                            : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  </button>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
};
