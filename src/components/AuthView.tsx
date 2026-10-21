import React, { useState } from 'react';
import {
  Shield,
  Mail,
  Lock,
  KeyRound,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  LogIn,
  Layers,
  ExternalLink,
  RefreshCw,
  Link2,
} from 'lucide-react';
import {
  validateAuthInput,
  parseTokenPool,
  type UserInfo,
} from '../utils/vpnLogic';
import { vpnBridge } from '../utils/wailsBridge';

interface AuthViewProps {
  onAuthenticated: (user: UserInfo) => void;
  isDark: boolean;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthenticated, isDark }) => {
  const [authTab, setAuthTab] = useState<'signin' | 'signup' | 'token'>('signin');
  const [step, setStep] = useState<'credentials' | 'verify'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [tokenPoolText, setTokenPoolText] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingBrowser, setCheckingBrowser] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [showBrowserFallbackModal, setShowBrowserFallbackModal] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusBanner(null);

    const validation = validateAuthInput(authTab, {
      email,
      password,
      confirmPassword,
      tokenPoolText,
    });

    if (!validation.valid) {
      setErrorMsg(validation.error || 'اطلاعات واردشده نامعتبر است');
      return;
    }

    setLoading(true);
    try {
      if (authTab === 'token') {
        const tokens = parseTokenPool(tokenPoolText);
        const user = await vpnBridge.importTokenPool(tokens);
        onAuthenticated(user);
        return;
      }

      if (authTab === 'signup') {
        const resp = await vpnBridge.registerAccount(email.trim(), password);
        if (resp.requiresVerification) {
          setStatusBanner(
            `اکانت فایرفاکس ساخته شد. موزیلا یک ایمیل تایید به ${email.trim()} ارسال کرد. شما می‌توانید لینک داخل ایمیل را در مرورگر باز کنید یا لینک/کد را در کادر زیر قرار دهید.`
          );
          setStep('verify');
        } else {
          onAuthenticated(resp);
        }
      } else {
        const resp = await vpnBridge.login(email.trim(), password);
        if (resp.requiresVerification) {
          setStatusBanner(
            `کد تایید امنیتی به ایمیل ${email.trim()} ارسال شد. کد ۶ رقمی را وارد کنید.`
          );
          setStep('verify');
        } else {
          onAuthenticated(resp);
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ارتباط با سرور فایرفاکس');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = validateAuthInput('verify', { code: verificationCode });
    if (!validation.valid) {
      setErrorMsg(validation.error || 'کد ۶ رقمی یا لینک تایید را وارد کنید');
      return;
    }

    setLoading(true);
    try {
      const user = await vpnBridge.verifyEmailCode(verificationCode.trim());
      onAuthenticated(user);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'کد یا لینک تایید مورد پذیرش قرار نگرفت');
    } finally {
      setLoading(false);
    }
  };

  const handleBrowserLinkClicked = async () => {
    setErrorMsg(null);
    setCheckingBrowser(true);
    try {
      const user = await vpnBridge.verifyEmailCode('LINK_CLICKED');
      onAuthenticated(user);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'هنوز تایید در فایرفاکس تکمیل نشده است. لطفاً لینک ایمیل را در مرورگر باز کنید یا آدرس آن را در کادر بالا Paste کنید.'
      );
    } finally {
      setCheckingBrowser(false);
    }
  };

  const fillDemoAccount = (targetMode: 'signin' | 'signup') => {
    setAuthTab(targetMode);
    setStep('credentials');
    setErrorMsg(null);
    setEmail(targetMode === 'signup' ? 'new.user@firefox.com' : 'mostafa.fxa@firefox.com');
    setPassword('FirefoxVpn#2026');
    setConfirmPassword('FirefoxVpn#2026');
  };

  return (
    <div className="w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch py-4">
      {/* Left Column: Protocol Architecture & 50 GB Allowance Overview */}
      <div
        className={`lg:col-span-5 rounded-2xl p-6 flex flex-col justify-between border ${
          isDark
            ? 'bg-slate-900/70 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="space-y-6">
          <div className="flex items-center gap-3.5">
            <img
              src="/appicon.png"
              alt="FoxyVPN Windows Logo"
              className="w-12 h-12 rounded-xl shrink-0 border border-slate-800"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight">FoxyVPN Windows</h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-semibold">
                  v1.0.2
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Ported from Vauth/FoxyVPN · Fastly HTTP/2 · Wintun
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight leading-snug">
              سهمیه ۵۰ گیگابایت ترافیک ماهانه رایگان با اکانت فایرفاکس
            </h2>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              با اکانت قبلی فایرفاکس وارد شوید یا مستقیماً از داخل برنامه اکانت بسازید. سهمیه ۵۰ گیگابایت ماهانه موزیلا به صورت خودکار فعال می‌شود.
            </p>
          </div>

          <div className={`space-y-3 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-start gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">ورود با اکانت قبلی (پیشنهادی)</span>
                <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  کافیست در تب Sign In مشخصات اکانت فایرفاکس خود را وارد کنید تا کد ۶ رقمی ایمیل شود.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">ثبت‌نام مستقیم و تایید لینک ایمیل</span>
                <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  برای اکانت جدید، موزیلا لینک فعال‌سازی ایمیل می‌کند؛ می‌توانید لینک را در کادر Paste کنید یا در مرورگر باز نمایید.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">استخر چند اکانته (Token Pool)</span>
                <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  سوئیچ نامحسوس به اکانت بعدی با اتمام هر سهمیه ۵۰ گیگابایتی بدون قطعی اینترنت.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={`pt-4 mt-6 border-t text-xs space-y-2 ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
          <div className="flex items-center justify-between">
            <span>تست دمو سریع:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fillDemoAccount('signin')}
                className="text-orange-400 hover:text-orange-300 font-medium underline cursor-pointer"
              >
                اکانت نمونه
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Interactive Auth / Registration / OTP Card */}
      <div
        className={`lg:col-span-7 rounded-2xl p-6 border flex flex-col justify-between ${
          isDark
            ? 'bg-slate-900/90 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div>
          {/* Mode Selector Tabs */}
          {step === 'credentials' && (
            <div
              role="tablist"
              aria-label="Authentication Mode"
              className={`grid grid-cols-3 gap-1 p-1 rounded-xl mb-6 ${
                isDark ? 'bg-slate-950 border border-slate-800' : 'bg-slate-100 border border-slate-200'
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'signin'}
                onClick={() => {
                  setAuthTab('signin');
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  authTab === 'signin'
                    ? 'bg-orange-500 text-white'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>ورود با اکانت قبلی</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'signup'}
                onClick={() => {
                  setAuthTab('signup');
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  authTab === 'signup'
                    ? 'bg-orange-500 text-white'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>ساخت اکانت جدید</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'token'}
                onClick={() => {
                  setAuthTab('token');
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  authTab === 'token'
                    ? 'bg-orange-500 text-white'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Token Pool</span>
              </button>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusBanner && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusBanner}</span>
            </div>
          )}

          {step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              {authTab !== 'token' ? (
                <>
                  {authTab === 'signup' && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-2 ${
                        isDark
                          ? 'bg-orange-500/10 border-orange-500/25 text-orange-200'
                          : 'bg-orange-50 border-orange-200 text-orange-950'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-orange-400">
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>راهنمای ساخت اکانت جدید موزیلا</span>
                      </div>
                      <p className="text-[11px]">
                        موزیلا برای اکانت‌های جدید لینک تایید ایمیل ارسال می‌کند. توصیه می‌شود ابتدا در وبسایت رسمی ثبت‌نام کرده، لینک فعال‌سازی ایمیل را باز کنید و سپس از تب <strong>«ورود با اکانت قبلی»</strong> وارد شوید:
                      </p>
                      <a
                        href="https://accounts.firefox.com/signup"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs transition-colors shadow-sm"
                      >
                        <span>باز کردن صفحه ثبت‌نام موزیلا در مرورگر</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="fxa-email" className="text-xs font-medium">
                        ایمیل اکانت فایرفاکس (Firefox Account Email)
                      </label>
                      <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {authTab === 'signup' ? 'ساخت اکانت جدید' : 'اکانت از قبل ثبت‌شده'}
                      </span>
                    </div>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="fxa-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                          isDark
                            ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500'
                            : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="fxa-password" className="block text-xs font-medium mb-1.5">
                      رمز عبور (Password)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="fxa-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="حداقل ۸ کاراکتر"
                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                          isDark
                            ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500'
                            : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                        }`}
                      />
                    </div>
                  </div>

                  {authTab === 'signup' && (
                    <div>
                      <label htmlFor="fxa-confirm-password" className="block text-xs font-medium mb-1.5">
                        تکرار رمز عبور (Confirm Password)
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="fxa-confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="تکرار همان رمز عبور"
                          className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                            isDark
                              ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500'
                              : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="fxa-token-pool" className="text-xs font-medium">
                      استخر توکن نشست (Session Token Pool)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setTokenPoolText(
                          '# Primary 50 GB Account\na1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90\n# Backup 50 GB Account\nf0e1d2c3b4a5968778695a4b3c2d1e0ff0e1d2c3b4a5968778695a4b3c2d1e0f'
                        )
                      }
                      className="text-xs text-orange-400 hover:text-orange-300 underline cursor-pointer"
                    >
                      نمونه توکن (100 GB)
                    </button>
                  </div>
                  <textarea
                    id="fxa-token-pool"
                    rows={5}
                    value={tokenPoolText}
                    onChange={(e) => setTokenPoolText(e.target.value)}
                    placeholder="توکن‌های هگزادسیمال ۶۴ کاراکتری sessionToken..."
                    className={`w-full p-3 rounded-xl font-mono text-xs border focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>ارتباط با سرورهای فایرفاکس...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {authTab === 'signin'
                        ? 'ورود به اکانت فایرفاکس'
                        : authTab === 'signup'
                        ? 'ثبت‌نام اکانت جدید و فعال‌سازی ۵۰ گیگابایت'
                        : 'فعال‌سازی استخر توکن'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleVerifySubmit} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="fxa-otp-code" className="text-xs font-medium">
                      کد تایید ۶ رقمی یا لینک تایید ایمیل
                    </label>
                    <span className="text-[11px] text-slate-400">
                      پشتیبانی از کد ۶ رقمی یا Paste لینک
                    </span>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="fxa-otp-code"
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.trim())}
                      placeholder="کد ۶ رقمی (مثل 482910) یا لینک ایمیل (https://...)"
                      className={`w-full pl-10 pr-4 py-2.5 rounded-xl font-mono text-sm border focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                        isDark
                          ? 'bg-slate-950 border-slate-800 text-slate-100'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">
                    💡 نکته: اگر لینک داخل ایمیل برایتان آمده، می‌توانید آدرس لینک را Copy کرده و مستقیماً در این کادر Paste نمایید.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('credentials');
                      setErrorMsg(null);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border cursor-pointer ${
                      isDark
                        ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    بازگشت
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !verificationCode}
                    className="flex-1 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تایید کد و بازگشایی ۵۰ گیگابایت VPN</span>
                  </button>
                </div>
              </form>

              {/* Alternative 1-click option if the user opened the link in Firefox or any browser */}
              <div className={`p-3.5 rounded-xl border space-y-2 text-xs ${isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2 text-orange-400 font-semibold">
                  <Link2 className="w-4 h-4" />
                  <span>اگر لینک ایمیل را در مرورگر یا گوشی باز کردید:</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  نیازی به وارد کردن کد نیست! کافیست دکمهٔ زیر را بزنید تا برنامه تایید شدن نشست در سرور موزیلا را به صورت خودکار بررسی و شما را وارد کند:
                </p>
                <button
                  type="button"
                  onClick={handleBrowserLinkClicked}
                  disabled={checkingBrowser}
                  className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium text-xs border border-cyan-500/30 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {checkingBrowser ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>بررسی وضعیت تایید در سرور فایرفاکس...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>لینک ایمیل را در مرورگر باز کردم — ادامه و ورود خودکار</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Helper Bar: Web Registration Fallback */}
        <div
          className={`mt-6 pt-4 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${
            isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
          }`}
        >
          <span>ثبت‌نام مستقیم در سایت فایرفاکس:</span>
          <a
            href="https://accounts.firefox.com/signup"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-orange-400 hover:text-orange-300 font-medium cursor-pointer"
          >
            <span>accounts.firefox.com/signup</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
