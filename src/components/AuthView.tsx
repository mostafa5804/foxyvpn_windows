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
  Trash2,
  PlusCircle,
  HelpCircle,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  validateAuthInput,
  parseTokenPool,
  extractTokenOrCodeFromUrl,
  type UserInfo,
} from '../utils/vpnLogic';
import { vpnBridge, type PoolAccountItem } from '../utils/wailsBridge';
import { translations, type Language } from '../utils/i18n';

interface AuthViewProps {
  onAuthenticated: (user: UserInfo) => void;
  isDark: boolean;
  lang: Language;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthenticated, isDark, lang }) => {
  const [authTab, setAuthTab] = useState<'signin' | 'signup' | 'token'>('signin');
  const [step, setStep] = useState<'credentials' | 'verify'>('credentials');
  const [verifyMode, setVerifyMode] = useState<'manual' | 'code' | 'browser'>('manual');

  // Credentials fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Verification fields
  const [manualToken, setManualToken] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // Multi-account / Token Pool fields
  const [poolInputMode, setPoolInputMode] = useState<'email' | 'token'>('email');
  const [poolEmail, setPoolEmail] = useState('');
  const [poolPassword, setPoolPassword] = useState('');
  const [tokenPoolText, setTokenPoolText] = useState('');
  const [accountList, setAccountList] = useState<PoolAccountItem[]>(() => vpnBridge.getAccountPool());

  // UI status
  const [loading, setLoading] = useState(false);
  const [checkingBrowser, setCheckingBrowser] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const t = translations[lang];

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
      setErrorMsg(validation.error || (lang === 'fa' ? 'اطلاعات واردشده نامعتبر است' : 'Invalid input'));
      return;
    }

    setLoading(true);
    try {
      if (authTab === 'signup') {
        const resp = await vpnBridge.registerAccount(email.trim(), password);
        if (resp.requiresVerification) {
          setStatusBanner(
            lang === 'fa'
              ? `اکانت فایرفاکس ایجاد شد. ایمیل تایید به ${email.trim()} ارسال گردید. اکنون می‌توانید لینک ایمیل را در مرورگر باز کرده و با «تایید دستی» یا وارد کردن کد ۶ رقمی ادامه دهید.`
              : `Firefox Account created! Verification email dispatched to ${email.trim()}. You can open the link in your browser and use Manual Verification or enter the 6-digit OTP.`
          );
          setStep('verify');
          setVerifyMode('manual');
        } else {
          onAuthenticated(resp);
        }
      } else {
        const resp = await vpnBridge.login(email.trim(), password);
        if (resp.requiresVerification) {
          setStatusBanner(
            lang === 'fa'
              ? `کد تایید امنیتی به ایمیل ${email.trim()} ارسال شد. کد ۶ رقمی یا لینک تایید را وارد نمایید.`
              : `Security verification code sent to ${email.trim()}. Enter the 6-digit code or paste the verification link.`
          );
          setStep('verify');
          setVerifyMode('code');
        } else {
          onAuthenticated(resp);
        }
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : lang === 'fa'
          ? 'خطا در ارتباط با سرور فایرفاکس'
          : 'Error connecting to Firefox servers'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleManualVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = validateAuthInput('manual-verify', { manualToken });
    if (!validation.valid) {
      setErrorMsg(
        validation.error ||
          (lang === 'fa'
            ? 'توکن احراز هویت یا نشانی مرورگر را وارد نمایید'
            : 'Please enter authentication token or browser URL')
      );
      return;
    }

    setLoading(true);
    try {
      const user = await vpnBridge.verifyManualToken(manualToken.trim());
      setStatusBanner(
        lang === 'fa'
          ? 'تایید دستی با موفقیت انجام شد و ۵۰ گیگابایت سهمیه فعال گردید!'
          : 'Manual verification succeeded! 50 GB allowance active.'
      );
      onAuthenticated(user);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : lang === 'fa'
          ? 'تایید دستی توکن توسط سرور موزیلا پذیرفته نشد'
          : 'Manual token verification was rejected'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = validateAuthInput('verify', { code: verificationCode });
    if (!validation.valid) {
      setErrorMsg(
        validation.error ||
          (lang === 'fa' ? 'کد ۶ رقمی یا لینک تایید را وارد کنید' : 'Please enter 6-digit code or link')
      );
      return;
    }

    setLoading(true);
    try {
      const user = await vpnBridge.verifyEmailCode(verificationCode.trim());
      onAuthenticated(user);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : lang === 'fa'
          ? 'کد یا لینک تایید مورد پذیرش قرار نگرفت'
          : 'Verification code was not accepted'
      );
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
          : lang === 'fa'
          ? 'هنوز تایید در فایرفاکس تکمیل نشده است. لطفاً لینک ایمیل را در مرورگر باز کنید یا توکن/آدرس صفحه را در تب تایید دستی Paste کنید.'
          : 'Verification in browser not completed yet. Please open email link or paste the redirected URL into Manual Verify.'
      );
    } finally {
      setCheckingBrowser(false);
    }
  };

  // Multi-Account Pool Handlers
  const handleAddEmailAccountToPool = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusBanner(null);

    const validation = validateAuthInput('pool-account', {
      email: poolEmail,
      password: poolPassword,
    });

    if (!validation.valid) {
      setErrorMsg(
        validation.error ||
          (lang === 'fa' ? 'ایمیل و رمز عبور معتبر وارد کنید' : 'Please enter valid email and password')
      );
      return;
    }

    setLoading(true);
    try {
      const user = await vpnBridge.addAccountToPool(poolEmail.trim(), poolPassword);
      setAccountList(vpnBridge.getAccountPool());
      setPoolEmail('');
      setPoolPassword('');
      setStatusBanner(
        lang === 'fa'
          ? `اکانت ${poolEmail.trim()} با موفقیت به استخر اضافه شد! سهمیه کل تجمیعی: ${user.tokenPoolCount * 50} GB.`
          : `Account ${poolEmail.trim()} added to pool! Total quota: ${user.tokenPoolCount * 50} GB.`
      );
      onAuthenticated(user);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : lang === 'fa'
          ? 'خطا در احراز هویت و افزودن اکانت به استخر'
          : 'Error adding account to pool'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImportRawTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusBanner(null);

    const tokens = parseTokenPool(tokenPoolText);
    if (tokens.length === 0) {
      setErrorMsg(
        lang === 'fa'
          ? 'حداقل یک توکن هگزادسیمال معتبر ۳۲ یا ۶۴ کاراکتری وارد کنید'
          : 'Please enter at least one valid 32 or 64 character hex token'
      );
      return;
    }

    setLoading(true);
    try {
      const user = await vpnBridge.importTokenPool(tokens);
      setAccountList(vpnBridge.getAccountPool());
      setStatusBanner(
        lang === 'fa'
          ? `تعداد ${tokens.length} توکن فعال شد! سهمیه کل: ${tokens.length * 50} GB.`
          : `${tokens.length} token(s) activated! Total capacity: ${tokens.length * 50} GB.`
      );
      onAuthenticated(user);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error importing tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = async (id: string) => {
    setLoading(true);
    try {
      const user = await vpnBridge.switchActivePoolAccount(id);
      setAccountList(vpnBridge.getAccountPool());
      onAuthenticated(user);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAccount = async (id: string) => {
    setLoading(true);
    try {
      const user = await vpnBridge.removeAccountFromPool(id);
      setAccountList(vpnBridge.getAccountPool());
      if (user) {
        onAuthenticated(user);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start py-2 animate-in fade-in duration-300">
      {/* Left Column: Educational & Feature Overview Card */}
      <div
        className={`lg:col-span-5 rounded-2xl p-6 border flex flex-col justify-between space-y-6 ${
          isDark
            ? 'bg-slate-900/80 border-slate-800 text-slate-100 shadow-xl shadow-black/40'
            : 'bg-white border-slate-200 text-slate-900 shadow-sm'
        }`}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">{t.appName}</h2>
              <span className="text-xs font-semibold text-orange-400">
                {t.fxaHeroTitle}
              </span>
            </div>
          </div>

          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {t.fxaHeroSubtitle}
          </p>

          <div className={`space-y-3 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-start gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{t.featureSignInTitle}</span>
                <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  {t.featureSignInDesc}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{t.featureManualTitle}</span>
                <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  {t.featureManualDesc}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{t.featurePoolTitle}</span>
                <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  {t.featurePoolDesc}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`pt-4 border-t text-xs flex items-center justify-between ${
            isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
          }`}
        >
          <span>{t.webSignUpNotice}</span>
          <a
            href="https://accounts.firefox.com/signup"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 font-semibold underline cursor-pointer"
          >
            <span>accounts.firefox.com</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Right Column: Interactive Auth / Registration / Manual Verification / Pool Card */}
      <div
        className={`lg:col-span-7 rounded-2xl p-6 border flex flex-col justify-between ${
          isDark
            ? 'bg-slate-900/90 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div>
          {/* Primary Mode Selector Tabs */}
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
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  authTab === 'signin'
                    ? 'bg-orange-500 text-white'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t.signInTab}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'signup'}
                onClick={() => {
                  setAuthTab('signup');
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  authTab === 'signup'
                    ? 'bg-orange-500 text-white'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t.signUpTab}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'token'}
                onClick={() => {
                  setAuthTab('token');
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  authTab === 'token'
                    ? 'bg-orange-500 text-white'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t.tokenPoolTab}</span>
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

          {/* STEP 1: CREDENTIALS INPUT (Sign In / Register) */}
          {step === 'credentials' && (authTab === 'signin' || authTab === 'signup') && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">{t.emailLabel}</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    required
                    dir="ltr"
                    className={`w-full py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/40 text-start ${
                      lang === 'fa' ? 'pr-9 pl-4' : 'pl-9 pr-4'
                    } ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">{t.passwordLabel}</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3 pointer-events-none" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.passwordPlaceholder}
                    required
                    minLength={8}
                    dir="ltr"
                    className={`w-full py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/40 text-start ${
                      lang === 'fa' ? 'pr-9 pl-4' : 'pl-9 pr-4'
                    } ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>
              </div>

              {authTab === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5">{t.confirmPasswordLabel}</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3 pointer-events-none" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t.confirmPasswordPlaceholder}
                      required
                      minLength={8}
                      dir="ltr"
                      className={`w-full py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/40 text-start ${
                        lang === 'fa' ? 'pr-9 pl-4' : 'pl-9 pr-4'
                      } ${
                        isDark
                          ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-orange-500/25 ${
                  loading
                    ? 'bg-orange-500/70 text-white cursor-wait'
                    : 'bg-orange-500 hover:bg-orange-600 text-white'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t.connectingServer}</span>
                  </>
                ) : (
                  <>
                    <span>{authTab === 'signup' ? t.signUpBtn : t.signInBtn}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 1 (Alternative): MULTI-ACCOUNT / TOKEN POOL */}
          {step === 'credentials' && authTab === 'token' && (
            <div className="space-y-4">
              <div
                className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-orange-400 mb-1">
                  <HelpCircle className="w-4 h-4" />
                  <span>{t.poolInfoTitle}</span>
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t.poolInfoDesc}
                </p>
              </div>

              {/* Pool Subtabs: Email/Password (Easy) vs Raw Tokens (Advanced) */}
              <div
                className={`flex items-center gap-1 p-1 rounded-xl text-xs font-semibold ${
                  isDark ? 'bg-slate-950 border border-slate-800' : 'bg-slate-100 border border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setPoolInputMode('email')}
                  className={`flex-1 py-1.5 px-3 rounded-lg transition-colors cursor-pointer text-center ${
                    poolInputMode === 'email'
                      ? 'bg-orange-500 text-white'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.poolEmailModeBtn}
                </button>
                <button
                  type="button"
                  onClick={() => setPoolInputMode('token')}
                  className={`flex-1 py-1.5 px-3 rounded-lg transition-colors cursor-pointer text-center ${
                    poolInputMode === 'token'
                      ? 'bg-orange-500 text-white'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.poolTokenModeBtn}
                </button>
              </div>

              {poolInputMode === 'email' ? (
                <form onSubmit={handleAddEmailAccountToPool} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">{t.poolEmailLabel}</label>
                      <input
                        type="email"
                        value={poolEmail}
                        onChange={(e) => setPoolEmail(e.target.value)}
                        placeholder="account2@firefox.com"
                        required
                        dir="ltr"
                        className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/40 ${
                          isDark
                            ? 'bg-slate-950 border-slate-800 text-slate-100'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">{t.poolPasswordLabel}</label>
                      <input
                        type="password"
                        value={poolPassword}
                        onChange={(e) => setPoolPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={8}
                        dir="ltr"
                        className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/40 ${
                          isDark
                            ? 'bg-slate-950 border-slate-800 text-slate-100'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      loading
                        ? 'bg-orange-500/70 text-white cursor-wait'
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{t.poolAddAccountBtn}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleImportRawTokens} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">{t.poolRawTokensLabel}</label>
                    <textarea
                      value={tokenPoolText}
                      onChange={(e) => setTokenPoolText(e.target.value)}
                      placeholder={t.poolRawTokensPlaceholder}
                      rows={3}
                      dir="ltr"
                      className={`w-full p-3 font-mono text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/40 ${
                        isDark
                          ? 'bg-slate-950 border-slate-800 text-slate-100'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      loading
                        ? 'bg-orange-500/70 text-white cursor-wait'
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{t.poolRawTokensSubmitBtn}</span>
                  </button>
                </form>
              )}

              {/* Pool Accounts List */}
              <div className="pt-3 border-t border-slate-800/40 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>{t.poolListTitle}</span>
                  <span className="text-orange-400 font-mono">
                    {t.poolTotalCapacity} {accountList.reduce((acc, c) => acc + c.quotaGB, 0)} GB
                  </span>
                </div>

                {accountList.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 rounded-xl border border-dashed border-slate-700/60">
                    {t.accountPoolEmptyNotice}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {accountList.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                          item.active
                            ? isDark
                              ? 'bg-orange-500/15 border-orange-500/40 text-orange-200'
                              : 'bg-orange-50 border-orange-300 text-orange-950'
                            : isDark
                            ? 'bg-slate-950/60 border-slate-800 text-slate-300'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{item.email}</div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {item.quotaGB} GB · {item.addedAt}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.active ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {t.poolActiveAccountBadge}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSwitchAccount(item.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                            >
                              {t.poolActivateAccountBtn}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveAccount(item.id)}
                            title={t.poolDeleteAccountTitle}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: VERIFICATION MODES (Manual Token, OTP Code, Browser Direct Link) */}
          {step === 'verify' && (
            <div className="space-y-4">
              <div
                role="tablist"
                aria-label="Verification Mode"
                className={`grid grid-cols-3 gap-1 p-1 rounded-xl mb-4 ${
                  isDark ? 'bg-slate-950 border border-slate-800' : 'bg-slate-100 border border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setVerifyMode('manual')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center truncate ${
                    verifyMode === 'manual'
                      ? 'bg-orange-500 text-white'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.manualVerifyTab}
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyMode('code')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center truncate ${
                    verifyMode === 'code'
                      ? 'bg-orange-500 text-white'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.otpCodeTab}
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyMode('browser')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center truncate ${
                    verifyMode === 'browser'
                      ? 'bg-orange-500 text-white'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.browserLinkTab}
                </button>
              </div>

              {verifyMode === 'manual' && (
                <form onSubmit={handleManualVerifySubmit} className="space-y-3">
                  <div
                    className={`p-3 rounded-xl border ${
                      isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <span className="font-bold text-xs block mb-1">{t.manualVerifyTitle}</span>
                    <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {t.manualVerifyDesc}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {t.manualVerifyInputLabel}
                    </label>
                    <textarea
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      placeholder={t.manualVerifyPlaceholder}
                      rows={3}
                      dir="ltr"
                      className={`w-full p-3 font-mono text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/40 ${
                        isDark
                          ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-orange-500/25"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t.manualVerifySubmitBtn}</span>
                  </button>
                </form>
              )}

              {verifyMode === 'code' && (
                <form onSubmit={handleVerifyCodeSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">{t.otpInputLabel}</label>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder={t.otpPlaceholder}
                      maxLength={6}
                      dir="ltr"
                      className={`w-full py-2.5 px-4 font-mono text-center tracking-widest text-base font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/40 ${
                        isDark
                          ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-orange-500/25"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t.otpSubmitBtn}</span>
                  </button>
                </form>
              )}

              {verifyMode === 'browser' && (
                <div className="space-y-4">
                  <div
                    className={`p-4 rounded-xl border ${
                      isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <span className="font-bold text-xs block mb-1">{t.browserLinkTitle}</span>
                    <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {t.browserLinkDesc}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleBrowserLinkClicked}
                    disabled={checkingBrowser}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-emerald-600/25"
                  >
                    {checkingBrowser ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{t.checkingStatus}</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4" />
                        <span>{t.browserLinkBtn}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setErrorMsg(null);
                }}
                className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {t.backBtn}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
