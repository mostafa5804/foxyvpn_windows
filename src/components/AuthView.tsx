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
      setErrorMsg(validation.error || 'Invalid input');
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
            `Account created for ${email.trim()}. Enter the 6-digit verification code sent to your email to activate your 50 GB monthly allowance.`
          );
          setStep('verify');
        } else {
          onAuthenticated(resp);
        }
      } else {
        const resp = await vpnBridge.login(email.trim(), password);
        if (resp.requiresVerification) {
          setStatusBanner(
            `Firefox Accounts sent a 6-digit security code to ${email.trim()} (verificationMethod: email-2fa).`
          );
          setStep('verify');
        } else {
          onAuthenticated(resp);
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = validateAuthInput('verify', { code: verificationCode });
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Invalid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const user = await vpnBridge.verifyEmailCode(verificationCode.trim());
      onAuthenticated(user);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification code rejected');
    } finally {
      setLoading(false);
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
    <div className="w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch py-6">
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
              src="/foxyvpn-windows-logo.svg"
              alt="FoxyVPN Windows Logo"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-xl shrink-0"
            />
            <div>
              <h1 className="text-lg font-bold tracking-tight">FoxyVPN Windows</h1>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Ported from Vauth/FoxyVPN · Fastly HTTP/2 · Wintun
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight leading-snug">
              50 GB Free Monthly VPN Traffic via Firefox Account
            </h2>
            <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Sign in with an existing Firefox account or register a new account directly inside the client.
              FoxyVPN automatically activates your free 50 GB monthly browser VPN entitlement on{' '}
              <code className="font-mono text-xs text-orange-400">vpn.mozilla.org</code>.
            </p>
          </div>

          <div className={`space-y-3 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-start gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">In-App Registration & Sign-In</span>
                <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  PBKDF2 quickStretch + HKDF key derivation & Fastly 406 PoW solver built in.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Full System Wintun TUN + WinINET Proxy</span>
                <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  Layer-3 virtual adapter (<span className="font-mono">10.0.0.2/24</span>) with DoH DNS & TLS SNI fragmentation.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Multi-Account Token Pool Rotation</span>
                <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  Automatically rotates session tokens when a 50 GB monthly cap reaches 100%.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={`pt-6 mt-6 border-t text-xs space-y-2 ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
          <div className="flex items-center justify-between">
            <span>Quick Test Presets:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fillDemoAccount('signin')}
                className="text-orange-400 hover:text-orange-300 font-medium underline cursor-pointer"
              >
                Fill Existing Account
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => fillDemoAccount('signup')}
                className="text-emerald-400 hover:text-emerald-300 font-medium underline cursor-pointer"
              >
                Fill New Sign-Up
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
                <span>Sign In (Existing)</span>
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
                <span>Create Account</span>
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
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="fxa-email" className="text-xs font-medium">
                        Firefox Account Email
                      </label>
                      <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {authTab === 'signup' ? 'New account registration' : 'Already registered account'}
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
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="fxa-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
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
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="fxa-confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
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
                      Session Token Pool (One Hex Token per Line)
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
                      Insert Sample Pool (100 GB Total)
                    </button>
                  </div>
                  <textarea
                    id="fxa-token-pool"
                    rows={5}
                    value={tokenPoolText}
                    onChange={(e) => setTokenPoolText(e.target.value)}
                    placeholder="Paste 64-character hex sessionToken(s)..."
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
                    <span>Communicating with Mozilla FxA...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {authTab === 'signin'
                        ? 'Sign In to Firefox Account'
                        : authTab === 'signup'
                        ? 'Create Account & Activate 50 GB'
                        : 'Activate Session Token Pool'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="fxa-otp-code" className="text-xs font-medium">
                    6-Digit Email Confirmation Code
                  </label>
                  <button
                    type="button"
                    onClick={() => setVerificationCode('482910')}
                    className="text-xs text-orange-400 hover:text-orange-300 underline cursor-pointer"
                  >
                    Fill Demo OTP (482910)
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="fxa-otp-code"
                    type="text"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="482910"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl font-mono text-base tracking-widest border focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setErrorMsg(null);
                  }}
                  className={`py-2.5 px-4 rounded-xl text-xs font-semibold border cursor-pointer ${
                    isDark
                      ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify Code & Unlock 50 GB VPN</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Bottom Helper Bar: Web Registration Fallback */}
        <div
          className={`mt-6 pt-4 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${
            isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
          }`}
        >
          <span>Need Mozilla's web portal instead?</span>
          <button
            type="button"
            onClick={() => setShowBrowserFallbackModal(true)}
            className="inline-flex items-center gap-1.5 text-orange-400 hover:text-orange-300 font-medium cursor-pointer"
          >
            <span>Open Mozilla Web Sign-Up Helper</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Embedded Mozilla Web Registration Instructions Modal */}
      {showBrowserFallbackModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="web-signup-modal-title"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            className={`w-full max-w-lg rounded-2xl p-6 border space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 id="web-signup-modal-title" className="text-base font-bold">
                Mozilla Account Registration Options
              </h3>
              <button
                type="button"
                onClick={() => setShowBrowserFallbackModal(false)}
                className="text-xs px-2.5 py-1 rounded-lg border border-slate-700 hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              FoxyVPN supports direct in-app registration via{' '}
              <code className="font-mono text-orange-400">POST /v1/account/create</code>. If Mozilla enforces an
              interactive web CAPTCHA on your current IP, you can either configure an upstream control-plane proxy in
              Settings or register at <code className="font-mono">https://accounts.firefox.com/signup</code> and sign
              in under the <strong>Sign In (Existing)</strong> tab.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowBrowserFallbackModal(false);
                  setAuthTab('signup');
                }}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold cursor-pointer"
              >
                Use In-App Registration Tab
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
