import React, { useState } from 'react';
import { Search, Check, Globe, ArrowUpDown, RefreshCw, Zap, X } from 'lucide-react';
import {
  filterAndSortServers,
  type ServerInfo,
} from '../utils/vpnLogic';
import { translations, type Language } from '../utils/i18n';
import { vpnBridge } from '../utils/wailsBridge';
import { CountryFlag } from './CountryFlag';

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

  // Calculate lowest latency among non-auto servers
  const validNonAuto = localServers.filter((s) => s.id !== 'auto' && s.latencyMs > 0);
  const minLatency = validNonAuto.length > 0 ? Math.min(...validNonAuto.map((s) => s.latencyMs)) : 24;
  const totalServerCount = validNonAuto.length;
  const totalCountryCount = new Set(validNonAuto.map((s) => s.countryCode)).size;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="server-modal-title"
      className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col p-0 overflow-hidden animate-in fade-in duration-150"
      style={{ boxSizing: 'border-box' }}
    >
      <div
        className={`w-full h-full p-3 flex flex-col overflow-hidden transition-colors ${
          isDark
            ? 'bg-[#0E1116] text-[#E8ECF1]'
            : 'bg-[#FAF9F5] text-[#111827]'
        }`}
        style={{ boxSizing: 'border-box' }}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between gap-2.5 pb-2.5 border-b shrink-0 ${
            isDark ? 'border-[#232A33]' : 'border-[#E2E8F0]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-[#FF7A1A] shrink-0">
              <Globe className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h2 id="server-modal-title" className="text-[13px] font-bold tracking-tight truncate leading-tight">
                {t.selectServerTitle}
              </h2>
              <p className={`text-[10.5px] truncate leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {lang === 'fa'
                  ? `${totalServerCount} سرور فعال در ${totalCountryCount} کشور · استخراج از Mozilla Remote Settings`
                  : `${totalServerCount} Active Nodes in ${totalCountryCount} Countries · Mozilla Remote Settings`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className={`p-1 rounded-md border transition-colors cursor-pointer shrink-0 ${
              isDark
                ? 'border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                : 'border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-black'
            }`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Featured Automatic Best Server Card */}
        <div className="mt-2 mb-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              onSelect(autoServer);
              onClose();
            }}
            className={`w-full p-2.5 rounded-[9px] border flex items-center justify-between gap-2 transition-all text-start cursor-pointer ${
              selectedServerId === 'auto'
                ? isDark
                  ? 'bg-orange-500/15 border-[#FF7A1A] text-orange-200 shadow-sm'
                  : 'bg-orange-50 border-[#FF7A1A] text-orange-950 shadow-sm'
                : isDark
                ? 'bg-[#151A21] border-[#232A33] hover:border-[#FF7A1A]/50 text-slate-200'
                : 'bg-white border-[#E2E8F0] hover:border-[#FF7A1A]/50 text-slate-900 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-[#FF7A1A] border border-orange-500/30 flex items-center justify-center shrink-0 text-sm">
                ⚡
              </div>
              <div className="min-w-0 flex flex-col flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12px] font-bold truncate">{t.autoServerTitle}</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    {lang === 'fa' ? 'پیشنهادی' : 'Best'}
                  </span>
                </div>
                <p className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {lang === 'fa' ? 'اتصال هوشمند به کمترین پینگ' : 'Fastest node connection'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span dir="ltr" className="font-mono tabular-nums text-[11px] font-bold text-emerald-400">
                {autoServer.latencyMs} ms
              </span>
              <div
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                  selectedServerId === 'auto'
                    ? 'bg-[#FF7A1A] border-[#FF7A1A] text-white'
                    : isDark
                    ? 'border-slate-700'
                    : 'border-slate-300'
                }`}
              >
                {selectedServerId === 'auto' && <Check className="w-2 h-2 stroke-[3]" />}
              </div>
            </div>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative my-1 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-2.5 pointer-events-none" />
          <input
            type="text"
            aria-label={t.searchServerPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchServerPlaceholder}
            className={`w-full py-1 text-[11px] border rounded-[7px] focus:outline-none focus:ring-1 focus:ring-[#FF7A1A] ${
              lang === 'fa' ? 'pr-7 pl-2.5' : 'pl-7 pr-2.5'
            } ${
              isDark
                ? 'bg-[#151A21] border-[#232A33] text-slate-100 placeholder:text-slate-500'
                : 'bg-white border-[#E2E8F0] text-slate-900 placeholder:text-slate-400'
            }`}
          />
        </div>

        {/* Action Toolbar: Sort and Ping Refresh */}
        <div className="flex items-center justify-between gap-1.5 my-1 shrink-0">
          <button
            type="button"
            onClick={() => setSortBy(sortBy === 'latency' ? 'country' : 'latency')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-[10.5px] font-semibold border whitespace-nowrap cursor-pointer transition-colors ${
              isDark
                ? 'bg-[#151A21] border-[#232A33] text-slate-300 hover:text-white'
                : 'bg-white border-[#E2E8F0] text-slate-700 hover:text-slate-900 shadow-2xs'
            }`}
          >
            <ArrowUpDown className="w-2.5 h-2.5 text-[#FF7A1A]" />
            <span>{sortBy === 'latency' ? t.sortLowestPing : t.sortCountry}</span>
          </button>

          <button
            type="button"
            onClick={handleRefreshPings}
            disabled={refreshing}
            title={t.refreshPings}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-[10.5px] font-semibold border whitespace-nowrap cursor-pointer transition-colors ${
              refreshing ? 'opacity-60 cursor-not-allowed' : ''
            } ${
              isDark
                ? 'bg-[#151A21] border-[#232A33] text-slate-300 hover:text-white'
                : 'bg-white border-[#E2E8F0] text-slate-700 hover:text-slate-900 shadow-2xs'
            }`}
          >
            <RefreshCw className={`w-2.5 h-2.5 text-emerald-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? t.refreshingPings : t.refreshPings}</span>
          </button>
        </div>

        {/* Server Table / List - Clean country names with flags, NO address/port, lowest ping highlighted in green */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-800/20 pr-0.5 space-y-1 mt-1">
          {visibleServers.filter((s) => s.id !== 'auto').length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              {t.noServersFound}
            </div>
          ) : (
            visibleServers
              .filter((s) => s.id !== 'auto')
              .map((srv) => {
                const isSelected = srv.id === selectedServerId;
                const isLowest = srv.latencyMs === minLatency;
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => {
                      onSelect(srv);
                      onClose();
                    }}
                    className={`w-full text-start px-2 py-2 flex items-center justify-between gap-2 transition-all rounded-[8px] border cursor-pointer ${
                      isSelected
                        ? isDark
                          ? 'bg-orange-500/15 border-[#FF7A1A] text-orange-200'
                          : 'bg-orange-50 border-[#FF7A1A] text-orange-950'
                        : isLowest
                        ? isDark
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-100 hover:bg-emerald-950/30'
                          : 'bg-emerald-50/60 border-emerald-400/50 text-slate-900 hover:bg-emerald-50'
                        : isDark
                        ? 'border-transparent hover:bg-slate-800/60 text-slate-200'
                        : 'border-transparent hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    {/* Country Flag & Country Name (Clean: No address or port) */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CountryFlag code={srv.countryCode} size={24} />
                      <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12.5px] font-semibold truncate leading-tight">
                            {srv.countryName}
                          </span>
                          {isLowest && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5 shrink-0">
                              <Zap className="w-2 h-2" />
                              {lang === 'fa' ? 'کمترین پینگ' : 'Lowest'}
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] truncate leading-tight ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {srv.cityName}
                        </span>
                      </div>
                    </div>

                    {/* Latency badge & selection circle */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        dir="ltr"
                        className={`font-mono tabular-nums text-[11px] font-bold flex items-center gap-1 ${
                          isLowest || srv.latencyMs < 50
                            ? 'text-emerald-400'
                            : srv.latencyMs < 100
                            ? 'text-amber-400'
                            : 'text-orange-400'
                        }`}
                      >
                        {isLowest && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                        )}
                        {srv.latencyMs} ms
                      </span>
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                          isSelected
                            ? 'bg-[#FF7A1A] border-[#FF7A1A] text-white'
                            : isDark
                            ? 'border-slate-700'
                            : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-2 h-2 stroke-[3]" />}
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
