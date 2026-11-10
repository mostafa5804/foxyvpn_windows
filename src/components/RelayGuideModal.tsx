import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, Zap, ShieldCheck, ArrowRight, ArrowLeft, Terminal, HelpCircle } from 'lucide-react';
import { CLOUDFLARE_WORKER_CODE } from '../utils/cloudflareWorkerCode';
import { openExternalUrl } from '../utils/wailsBridge';

interface RelayGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  lang: 'fa' | 'en';
}

export const RelayGuideModal: React.FC<RelayGuideModalProps> = ({
  isOpen,
  onClose,
  isDark,
  lang,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedSampleUrl, setCopiedSampleUrl] = useState(false);
  const [showCodePreview, setShowCodePreview] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(CLOUDFLARE_WORKER_CODE);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleCopySampleUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText('https://YOUR-WORKER.workers.dev?secret=foxyvpn_secret_relay_key');
      setCopiedSampleUrl(true);
      setTimeout(() => setCopiedSampleUrl(false), 2500);
    }
  };

  const isFa = lang === 'fa';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-[360px] max-h-[90vh] rounded-[16px] border flex flex-col overflow-hidden shadow-2xl transition-all ${
          isDark
            ? 'bg-[#151A21] border-[#2A323D] text-[#E8ECF1]'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`p-3.5 border-b flex items-center justify-between gap-2 shrink-0 ${
            isDark ? 'border-[#232A33] bg-[#12161D]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#FF7A1A]/15 text-[#FF7A1A] flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[13px] truncate">
                {isFa ? 'آموزش ساخت ورکر کلادفلر' : 'Cloudflare Worker Setup'}
              </span>
              <span className="text-[10px] text-[#8B96A3] truncate">
                {isFa ? 'بدون نیاز به گیت‌هاب و بدون سرور (رایگان)' : 'No GitHub or server required (Free)'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8B96A3] hover:text-white hover:bg-white/10 cursor-pointer border-0 bg-transparent transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-[11.5px] leading-relaxed">
          {/* Why Explanation */}
          <div className="p-2.5 rounded-[10px] bg-[#FF7A1A]/10 border border-[#FF7A1A]/25 text-[11px] text-[#FF9A4D]">
            {isFa
              ? 'موزیلا برای کاربران داخل ایران خطای ۴۵۱ می‌دهد. این ورکر فقط درخواست چند کیلوبایتی توکن را واسطه می‌کند و ترافیک اصلی دانلود و وبگردی شما مستقیماً از تونل پرسرعت موزیلا رد خواهد شد.'
              : 'Mozilla returns HTTP 451 in your region. This worker only proxies the tiny license token request; all primary browsing flows directly through Mozilla Fastly.'}
          </div>

          {/* Step 1: Copy Code */}
          <div
            className={`p-3 rounded-[10px] border space-y-2 ${
              isDark ? 'bg-[#0E1116] border-[#232A33]' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[12px] flex items-center gap-1.5 text-[#2DD4A0]">
                <span className="w-4 h-4 rounded-full bg-[#2DD4A0]/20 flex items-center justify-center text-[10px]">
                  ۱
                </span>
                <span>{isFa ? 'کپی کد جاوااسکریپت ورکر' : 'Copy Worker JavaScript Code'}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowCodePreview((prev) => !prev)}
                className="text-[10px] text-[#8B96A3] hover:text-[#FF7A1A] cursor-pointer bg-transparent border-0"
              >
                {showCodePreview ? (isFa ? 'بستن کد' : 'Hide') : (isFa ? 'مشاهده کد' : 'Preview')}
              </button>
            </div>

            <p className="text-[11px] text-[#8B96A3]">
              {isFa
                ? 'کد کامل و آماده ورکر را با دکمه زیر در کلیپ‌بورد کپی کنید:'
                : 'Copy the ready-to-use worker script to your clipboard:'}
            </p>

            <button
              type="button"
              onClick={handleCopyCode}
              className="w-full h-[36px] rounded-[8px] bg-[#FF7A1A] hover:bg-[#FF8D36] text-[#1A0F05] font-bold text-[11.5px] flex items-center justify-center gap-1.5 cursor-pointer border-0 transition-colors shadow-xs"
            >
              {copiedCode ? <Check className="w-4 h-4 text-[#1A0F05]" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? (isFa ? 'کد ورکر با موفقیت کپی شد!' : 'Worker Code Copied!') : (isFa ? 'کپی کد ورکر (worker.js)' : 'Copy worker.js Code')}</span>
            </button>

            {showCodePreview && (
              <pre
                dir="ltr"
                className="p-2 rounded bg-black/60 border border-[#232A33] text-[9.5px] font-mono text-[#A5AFBB] max-h-36 overflow-y-auto whitespace-pre-wrap select-all"
              >
                {CLOUDFLARE_WORKER_CODE.slice(0, 500)}...
              </pre>
            )}
          </div>

          {/* Step 2: Open Cloudflare Dashboard */}
          <div
            className={`p-3 rounded-[10px] border space-y-2 ${
              isDark ? 'bg-[#0E1116] border-[#232A33]' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="font-bold text-[12px] flex items-center gap-1.5 text-[#FF9A4D]">
              <span className="w-4 h-4 rounded-full bg-[#FF7A1A]/20 flex items-center justify-center text-[10px]">
                ۲
              </span>
              <span>{isFa ? 'ساخت در پنل رایگان کلادفلر' : 'Create in Cloudflare Dashboard'}</span>
            </span>

            <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#A5AFBB] ps-0.5">
              <li>
                {isFa
                  ? 'سایت کلادفلر را باز کنید (ثبت‌نام کاملاً رایگان است):'
                  : 'Open the Cloudflare Dashboard (Free registration):'}
              </li>
              <div className="pt-0.5 pb-1">
                <button
                  type="button"
                  onClick={() => openExternalUrl('https://dash.cloudflare.com')}
                  className="w-full h-[34px] rounded-[8px] bg-[#1F2733] hover:bg-[#2A3444] text-[#E8ECF1] border border-[#2A323D] font-bold text-[11.5px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#FF7A1A]" />
                  <span>{isFa ? 'ورود به dash.cloudflare.com' : 'Open dash.cloudflare.com'}</span>
                </button>
              </div>
              <li>
                {isFa
                  ? 'از منوی چپ روی Workers & Pages ← دکمه Create بزنید و Deploy کنید.'
                  : 'In left menu, click Workers & Pages → Create Worker → Deploy.'}
              </li>
              <li>
                {isFa
                  ? 'روی Edit Code کلیک کنید، تمام کدهای قبلی را پاک کرده و کدهای کپی‌شده را Paste نمایید و Deploy را بزنید.'
                  : 'Click Edit Code, paste the copied code, and click Deploy.'}
              </li>
            </ol>
          </div>

          {/* Step 3: Put Link in App */}
          <div
            className={`p-3 rounded-[10px] border space-y-2 ${
              isDark ? 'bg-[#0E1116] border-[#232A33]' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="font-bold text-[12px] flex items-center gap-1.5 text-[#2DD4A0]">
              <span className="w-4 h-4 rounded-full bg-[#2DD4A0]/20 flex items-center justify-center text-[10px]">
                ۳
              </span>
              <span>{isFa ? 'قرار دادن آدرس در برنامه' : 'Paste Address in FoxyVPN'}</span>
            </span>

            <p className="text-[11px] text-[#8B96A3]">
              {isFa
                ? 'آدرس ورکر با پسوند workers.dev را همراه با secret پیش‌فرض در کادر رله برنامه بگذارید:'
                : 'Append ?secret=foxyvpn_secret_relay_key to your worker URL:'}
            </p>

            <div
              dir="ltr"
              className="p-2 rounded bg-black/50 border border-[#232A33] font-mono text-[10px] text-[#2DD4A0] flex items-center justify-between gap-1 overflow-x-auto"
            >
              <span className="truncate">https://YOUR-WORKER.workers.dev?secret=foxyvpn_secret_relay_key</span>
              <button
                type="button"
                onClick={handleCopySampleUrl}
                className="p-1 rounded text-[#8B96A3] hover:text-white cursor-pointer bg-transparent border-0 shrink-0"
              >
                {copiedSampleUrl ? <Check className="w-3 h-3 text-[#2DD4A0]" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Quick Alternative: Control-Plane Proxy */}
          <div className="p-2.5 rounded-[10px] bg-[#12161D] border border-[#232A33] text-[10.5px] text-[#8B96A3] space-y-1">
            <span className="font-bold text-[#E8ECF1] block">
              {isFa ? '💡 راهکار دوم: استفاده از پروکسی کمکی موقت' : '💡 Alternative: Temporary Control-Plane Proxy'}
            </span>
            <p>
              {isFa
                ? 'اگر روی سیستم فیلترشکن دیگری (مثل V2Ray روی پورت 10808) فعال دارید، کافیست در تب تنظیمات در بخش Control-Plane Proxy آدرس socks5://127.0.0.1:10808 را بنویسید تا توکن موزیلا بدون نیاز به ساخت ورکر دریافت شود.'
                : 'If you have an active proxy (like V2Ray on port 10808), enter socks5://127.0.0.1:10808 into Control-Plane Proxy to fetch the token.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`p-3 border-t flex items-center justify-between gap-2 shrink-0 ${
            isDark ? 'border-[#232A33] bg-[#12161D]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <button
            type="button"
            onClick={() =>
              openExternalUrl('https://github.com/mostafa5804/foxyvpn_windows/blob/main/docs/RELAY_GUIDE.md')
            }
            className="text-[11px] text-[#8B96A3] hover:text-[#FF7A1A] flex items-center gap-1 cursor-pointer border-0 bg-transparent"
          >
            <span>{isFa ? 'راهنمای کامل گیت‌هاب' : 'GitHub Guide'}</span>
            <ExternalLink className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-[8px] bg-[#FF7A1A] text-[#1A0F05] font-bold text-[11.5px] cursor-pointer border-0 hover:bg-[#FF8D36]"
          >
            {isFa ? 'متوجه شدم' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
