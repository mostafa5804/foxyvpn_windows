import React from 'react';
import {
  ExternalLink,
  Github,
  Download,
  Shield,
  Zap,
  Lock,
  Globe2,
  CheckCircle2,
  Cpu,
  Layers,
  Heart,
} from 'lucide-react';
import { translations, type Language } from '../utils/i18n';

interface AboutViewProps {
  isDark: boolean;
  lang: Language;
  onOpenSettings?: () => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ isDark, lang }) => {
  const t = translations[lang];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 py-4 animate-in fade-in duration-300">
      {/* Hero Header Card */}
      <div
        className={`rounded-2xl p-6 sm:p-8 border flex flex-col sm:flex-row items-center sm:items-start gap-6 ${
          isDark
            ? 'bg-slate-900/80 border-slate-800 text-slate-100 shadow-xl shadow-black/40'
            : 'bg-white border-slate-200 text-slate-900 shadow-sm'
        }`}
      >
        <img
          src="/appicon.png"
          alt="FoxyVPN Windows Icon"
          className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl shadow-lg shadow-orange-500/20 shrink-0 border border-slate-700/50"
        />

        <div className="flex-1 text-center sm:text-start space-y-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{t.appName}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">
              v{t.version}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Windows 10 / 11 (amd64)
            </span>
          </div>

          <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {t.aboutHeroDesc}
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
            <a
              href="https://github.com/mostafa5804/foxyvpn_windows"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors border border-slate-700 cursor-pointer shadow-sm"
            >
              <Github className="w-4 h-4" />
              <span>{t.githubRepoBtn}</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <a
              href="https://github.com/mostafa5804/foxyvpn_windows/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm shadow-orange-500/25"
            >
              <Download className="w-4 h-4" />
              <span>{t.githubReleasesBtn}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Feature Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className={`p-5 rounded-2xl border space-y-2.5 ${
            isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-orange-400">
            <Zap className="w-4 h-4" />
            <h2 className="text-sm font-bold">{t.quotaFeatureTitle}</h2>
          </div>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t.quotaFeatureDesc}
          </p>
        </div>

        <div
          className={`p-5 rounded-2xl border space-y-2.5 ${
            isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-cyan-400">
            <Cpu className="w-4 h-4" />
            <h2 className="text-sm font-bold">{t.driverFeatureTitle}</h2>
          </div>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t.driverFeatureDesc}
          </p>
        </div>

        <div
          className={`p-5 rounded-2xl border space-y-2.5 ${
            isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-emerald-400">
            <Lock className="w-4 h-4" />
            <h2 className="text-sm font-bold">{t.antiDpiFeatureTitle}</h2>
          </div>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t.antiDpiFeatureDesc}
          </p>
        </div>

        <div
          className={`p-5 rounded-2xl border space-y-2.5 ${
            isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-purple-400">
            <Globe2 className="w-4 h-4" />
            <h2 className="text-sm font-bold">{t.dohFeatureTitle}</h2>
          </div>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t.dohFeatureDesc}
          </p>
        </div>
      </div>

      {/* Technical Specifications Panel */}
      <div
        className={`rounded-2xl p-6 border space-y-4 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-bold tracking-tight">{t.specsTitle}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div
            className={`p-3 rounded-xl border ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="text-slate-400 mb-1">{t.appVersionLabel}</div>
            <div className="font-mono font-bold text-orange-400">v{t.version} Stable</div>
          </div>

          <div
            className={`p-3 rounded-xl border ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="text-slate-400 mb-1">{t.coreFrameworkLabel}</div>
            <div className="font-mono font-semibold">Wails v2.9 + Go 1.23</div>
          </div>

          <div
            className={`p-3 rounded-xl border ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="text-slate-400 mb-1">{t.networkDriverLabel}</div>
            <div className="font-mono font-semibold">Wintun v0.14.1 (amd64)</div>
          </div>

          <div
            className={`p-3 rounded-xl border ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="text-slate-400 mb-1">{t.distributionTypeLabel}</div>
            <div className="font-medium text-emerald-400">{t.portableAndSetup}</div>
          </div>
        </div>

        <div
          className={`pt-4 border-t flex flex-wrap items-center justify-between gap-3 text-xs ${
            isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{t.openSourceNotice}</span>
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            <span>FoxyVPN Community</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          </div>
        </div>
      </div>
    </div>
  );
};
