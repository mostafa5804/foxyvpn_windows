import React from 'react';
import {
  ExternalLink,
  Github,
  Download,
  Shield,
  Zap,
  Globe2,
  Lock,
  Layers,
  Heart,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface AboutViewProps {
  isDark: boolean;
  onOpenSettings?: () => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ isDark, onOpenSettings }) => {
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
          className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl shadow-lg shadow-orange-500/20 shrink-0 border border-slate-800"
        />

        <div className="flex-1 text-center sm:text-left space-y-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">FoxyVPN Windows</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30">
              v1.0.2
            </span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Windows 10 / 11 (amd64)
            </span>
          </div>

          <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            کلاینت بومی، پرتابل و متن‌باز ویندوز برای استفاده از سهمیهٔ ۵۰ گیگابایت ترافیک ماهانهٔ رایگان موزیلا
            بر بستر سرورهای Fastly با پروتکل HTTP/2 CONNECT و کارت شبکهٔ مجازی Wintun.
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
            <a
              href="https://github.com/vauth/foxyvpn"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors border border-slate-700 cursor-pointer shadow-sm"
            >
              <Github className="w-4 h-4" />
              <span>مخزن گیت‌هاب (GitHub)</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <a
              href="https://github.com/vauth/foxyvpn/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm shadow-orange-500/25"
            >
              <Download className="w-4 h-4" />
              <span>دانلود نسخه‌های جدید (Releases)</span>
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
            <h2 className="text-sm font-semibold">سهمیه ۵۰ گیگابایت ماهانه موزیلا</h2>
          </div>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            استفاده مستقیم از ترافیک اختصاصی مرورگر فایرفاکس بدون نیاز به خرید اشتراک ماهانه، با قابلیت اتصال استخر چند اکانته (Token Pool) جهت افزایش سهمیه.
          </p>
        </div>

        <div
          className={`p-5 rounded-2xl border space-y-2.5 ${
            isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-cyan-400">
            <Shield className="w-4 h-4" />
            <h2 className="text-sm font-semibold">درایور اختصاصی Wintun + System Proxy</h2>
          </div>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            ایجاد کارت شبکه مجازی Wintun برای مسیریابی امن و پرسرعت لایه ۳ در کل ویندوز، همراه با راه‌اندازی پراکسی محلی WinINET برای سازگاری کامل نرم‌افزارها.
          </p>
        </div>

        <div
          className={`p-5 rounded-2xl border space-y-2.5 ${
            isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-emerald-400">
            <Lock className="w-4 h-4" />
            <h2 className="text-sm font-semibold">تکنولوژی ضد فیلترینگ TLS SNI Split</h2>
          </div>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            شکستن پکت‌های اولیه TLS ClientHello در نقطهٔ حساس SNI همراه با TCP_NODELAY جهت دور زدن موانع بازرسی عمیق بسته‌ها (DPI) در شبکه اینترنت.
          </p>
        </div>

        <div
          className={`p-5 rounded-2xl border space-y-2.5 ${
            isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-indigo-400">
            <Globe2 className="w-4 h-4" />
            <h2 className="text-sm font-semibold">DNS امن بر بستر DoH</h2>
          </div>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            هدایت تمام درخواست‌های DNS به سرورهای رمزنگاری‌شده Cloudflare و Quad9 از داخل تونل HTTP/2 جهت جلوگیری از مسمومیت و ردیابی DNS.
          </p>
        </div>
      </div>

      {/* Version & Technical Specs Card */}
      <div
        className={`p-6 rounded-2xl border space-y-4 ${
          isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between border-b pb-3 border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Info className="w-4 h-4 text-orange-400" />
            <span>مشخصات فنی و پکیج انتشار</span>
          </div>
          <span className="text-xs text-slate-400">Release v1.0.2</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>نسخه برنامه:</span>
            <p className="font-semibold mt-0.5">1.0.2 Stable</p>
          </div>
          <div>
            <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>فریم‌ورک هسته:</span>
            <p className="font-semibold mt-0.5">Wails v2 + Go 1.23</p>
          </div>
          <div>
            <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>درایور شبکه:</span>
            <p className="font-semibold mt-0.5">Wintun v0.14.1</p>
          </div>
          <div>
            <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>نوع توزیع:</span>
            <p className="font-semibold mt-0.5">Portable & Setup</p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-rose-500 inline fill-rose-500" />
            <span>توسعه‌یافته بر پایهٔ نسخه اندروید Vauth/FoxyVPN و هسته Go</span>
          </div>
          <span>مجوز متن‌باز MIT License</span>
        </div>
      </div>
    </div>
  );
};
