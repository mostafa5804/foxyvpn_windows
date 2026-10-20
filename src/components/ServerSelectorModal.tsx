import React, { useState } from 'react';
import { Search, Check, Globe, ArrowUpDown } from 'lucide-react';
import {
  filterAndSortServers,
  countryCodeToFlag,
  type ServerInfo,
} from '../utils/vpnLogic';

interface ServerSelectorModalProps {
  servers: ServerInfo[];
  selectedServerId: string;
  onSelect: (server: ServerInfo) => void;
  onClose: () => void;
  isDark: boolean;
}

export const ServerSelectorModal: React.FC<ServerSelectorModalProps> = ({
  servers,
  selectedServerId,
  onSelect,
  onClose,
  isDark,
}) => {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latency' | 'country'>('latency');

  const visibleServers = filterAndSortServers(servers, query, sortBy);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="server-modal-title"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        className={`w-full max-w-2xl rounded-2xl border p-6 flex flex-col max-h-[82vh] ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-orange-400" />
            <div>
              <h2 id="server-modal-title" className="text-base font-bold tracking-tight">
                Select Fastly Edge Location
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Mozilla Remote Settings · HTTP/2 CONNECT Multiplexed Nodes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
              isDark
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Close
          </button>
        </div>

        {/* Search and Sort Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 my-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Filter servers by country, city, or hostname"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country, city, or Fastly edge host..."
              className={`w-full pl-10 pr-4 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-orange-500/40 ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSortBy(sortBy === 'latency' ? 'country' : 'latency')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border whitespace-nowrap cursor-pointer ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-orange-400" />
              <span>Sort: {sortBy === 'latency' ? 'Lowest Latency' : 'Country A–Z'}</span>
            </button>
          </div>
        </div>

        {/* Server Table */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-800/40 pr-1">
          {visibleServers.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No Fastly edge servers match "{query}".
            </div>
          ) : (
            visibleServers.map((srv) => {
              const isSelected = srv.id === selectedServerId;
              return (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => {
                    onSelect(srv);
                    onClose();
                  }}
                  className={`w-full text-left px-3.5 py-3 flex items-center justify-between gap-4 transition-colors rounded-xl cursor-pointer ${
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
                    <span className="text-xl leading-none select-none" aria-hidden="true">
                      {countryCodeToFlag(srv.countryCode)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {srv.countryName} — {srv.cityName}
                      </div>
                      <div className={`text-xs font-mono truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {srv.host}:{srv.port} · {srv.protocol}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span
                      className={`font-mono tabular-nums text-xs font-medium ${
                        srv.latencyMs < 50
                          ? 'text-emerald-400'
                          : srv.latencyMs < 110
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
