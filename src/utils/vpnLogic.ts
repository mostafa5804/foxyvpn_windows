export interface ServerInfo {
  id: string;
  countryName: string;
  countryCode: string;
  cityName: string;
  cityCode: string;
  host: string;
  port: number;
  protocol: string;
  latencyMs: number;
  exitIpPreview?: string;
}

export interface UserInfo {
  email: string;
  uid: string;
  verified: boolean;
  requiresVerification: boolean;
  subscribed: boolean;
  quotaMaxBytes: number;
  quotaRemainingBytes: number;
  quotaResetEpoch: number;
  tokenPoolCount: number;
}

export interface ConnectionStatus {
  state: 'Disconnected' | 'Connecting...' | 'Connected';
  mode: 'tun' | 'proxy';
  serverId: string;
  serverLabel: string;
  uptimeSeconds: number;
  uploadedBytes: number;
  downloadedBytes: number;
  pingMs: number;
  exitIp: string;
  exitCountry: string;
  exitVerified: boolean;
  quotaMaxBytes: number;
  quotaRemainingBytes: number;
}

export interface ClientSettings {
  mode: 'tun' | 'proxy';
  transportProtocol?: 'h2-connect-2499' | 'h2-tls-443' | 'masque-quic' | 'auto';
  tlsSplitMode: 'sni' | 'first-byte' | 'record' | 'off';
  fragmentSize?: number;
  fragmentDelayMs?: number;
  dohProvider: '1.1.1.1' | '8.8.8.8' | '9.9.9.9' | 'adguard';
  mtu: number;
  killSwitch: boolean;
  blockIpv6?: boolean;
  splitTunnelMode?: 'all' | 'include' | 'exclude';
  splitTunnelApps?: string[];
  localSocksPort?: number;
  localHttpPort?: number;
  allowLan?: boolean;
  controlPlaneProxy: string;
  edgeOverrideIp: string;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
  releaseNotes?: string;
  publishedAt?: string;
}

export const FIFTY_GB_BYTES = 50 * 1024 * 1024 * 1024; // 53,687,091,200 bytes

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let val = bytes;
  let unitIdx = 0;
  while (val >= 1024 && unitIdx < units.length - 1) {
    val /= 1024;
    unitIdx++;
  }
  const decimals = unitIdx >= 2 ? 2 : unitIdx === 1 ? 1 : 0;
  return `${val.toFixed(decimals)} ${units[unitIdx]}`;
}

export function formatRate(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '0.0 KB/s';
  if (bytesPerSec < 1024 * 1024) {
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  }
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
}

export function formatUptime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, '0')).join(':');
}

export interface QuotaSummary {
  maxBytes: number;
  remainingBytes: number;
  usedBytes: number;
  usedGB: string;
  remainingGB: string;
  totalGB: string;
  usedPercent: number;
  remainingPercent: number;
  healthState: 'nominal' | 'warning' | 'critical';
}

export function calculateQuotaSummary(maxBytes: number, remainingBytes: number): QuotaSummary {
  const safeMax = maxBytes > 0 ? maxBytes : FIFTY_GB_BYTES;
  const safeRem = Math.min(safeMax, Math.max(0, remainingBytes));
  const usedBytes = Math.max(0, safeMax - safeRem);
  const usedPercent = Number(((usedBytes / safeMax) * 100).toFixed(1));
  const remainingPercent = Number((100 - usedPercent).toFixed(1));

  const gbDiv = 1024 * 1024 * 1024;
  let healthState: 'nominal' | 'warning' | 'critical' = 'nominal';
  if (usedPercent >= 90) {
    healthState = 'critical';
  } else if (usedPercent >= 75) {
    healthState = 'warning';
  }

  return {
    maxBytes: safeMax,
    remainingBytes: safeRem,
    usedBytes,
    usedGB: (usedBytes / gbDiv).toFixed(2),
    remainingGB: (safeRem / gbDiv).toFixed(2),
    totalGB: (safeMax / gbDiv).toFixed(0),
    usedPercent,
    remainingPercent,
    healthState,
  };
}

export function parseTokenPool(rawText: string): string[] {
  if (!rawText) return [];
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 16 && !line.startsWith('#') && /^[0-9a-fA-F]+$/.test(line));
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function extractTokenOrCodeFromUrl(input: string): { type: 'code' | 'token' | 'bearer' | 'raw'; value: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { type: 'raw', value: '' };
  }

  // Check if it's a URL
  if (/^https?:\/\//i.test(trimmed) || /^[a-zA-Z0-9_-]+:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed.replace(/^foxyvpn:\/\//i, 'https://dummy.local/'));
      // Search params first
      const codeParam = url.searchParams.get('code') || url.searchParams.get('verification_code');
      if (codeParam) {
        return { type: 'code', value: codeParam };
      }
      const tokenParam = url.searchParams.get('token') || url.searchParams.get('sessionToken') || url.searchParams.get('access_token');
      if (tokenParam) {
        return { type: 'token', value: tokenParam };
      }

      // Check hash fragment (#token=... or #code=...)
      if (url.hash) {
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
        const hashToken = hashParams.get('token') || hashParams.get('access_token') || hashParams.get('sessionToken');
        if (hashToken) {
          return { type: 'token', value: hashToken };
        }
        const hashCode = hashParams.get('code');
        if (hashCode) {
          return { type: 'code', value: hashCode };
        }
      }
    } catch {
      // Fallback regex if URL constructor fails
      const codeMatch = trimmed.match(/[?&#](?:code|verification_code)=([^&#\s]+)/i);
      if (codeMatch) return { type: 'code', value: decodeURIComponent(codeMatch[1]) };

      const tokenMatch = trimmed.match(/[?&#](?:token|sessionToken|access_token)=([^&#\s]+)/i);
      if (tokenMatch) return { type: 'token', value: decodeURIComponent(tokenMatch[1]) };
    }
  }

  // Check if JWT Bearer
  if (trimmed.startsWith('ey') && trimmed.includes('.')) {
    return { type: 'bearer', value: trimmed };
  }

  // Check if 6-digit OTP code
  if (/^\d{6}$/.test(trimmed)) {
    return { type: 'code', value: trimmed };
  }

  // Check if hex token
  if (/^[0-9a-fA-F]{32,128}$/.test(trimmed)) {
    return { type: 'token', value: trimmed };
  }

  return { type: 'raw', value: trimmed };
}

export function validateAuthInput(
  mode: 'signin' | 'signup' | 'token' | 'verify' | 'manual-verify' | 'pool-account',
  fields: {
    email?: string;
    password?: string;
    confirmPassword?: string;
    code?: string;
    manualToken?: string;
    tokenPoolText?: string;
  }
): ValidationResult {
  if (mode === 'manual-verify') {
    const raw = (fields.manualToken || fields.code || '').trim();
    if (!raw) {
      return {
        valid: false,
        error: 'لطفاً توکن احراز هویت، کد تایید یا لینک تغییر مسیر مرورگر را وارد نمایید.',
      };
    }
    const extracted = extractTokenOrCodeFromUrl(raw);
    if (!extracted.value || extracted.value.length < 4) {
      return {
        valid: false,
        error: 'فرمت توکن یا لینک نامعتبر است. لطفاً توکن نشست، کد ۶ رقمی، یا لینک کامل بازشده در مرورگر را Paste کنید.',
      };
    }
    return { valid: true };
  }

  if (mode === 'verify') {
    const code = (fields.code || '').trim();
    const isSixDigitOtp = /^\d{6}$/.test(code);
    const isVerificationUrl = code.includes('code=') || /^https?:\/\//i.test(code);
    const isHexVerifyCode = /^[0-9a-fA-F]{16,64}$/.test(code);
    const isBrowserConfirmed = code === 'LINK_CLICKED' || code === 'VERIFIED';
    if (!isSixDigitOtp && !isVerificationUrl && !isHexVerifyCode && !isBrowserConfirmed) {
      return {
        valid: false,
        error: 'کد ۶ رقمی یا لینک تایید ایمیل را وارد کنید، یا از تب تایید دستی با توکن استفاده نمایید.',
      };
    }
    return { valid: true };
  }

  if (mode === 'token') {
    const tokens = parseTokenPool(fields.tokenPoolText || '');
    if (tokens.length === 0) {
      return {
        valid: false,
        error: 'حداقل یک توکن هگزادسیمال معتبر ۳۲ الی ۶۴ کاراکتری نشست فایرفاکس را وارد کنید.',
      };
    }
    return { valid: true };
  }

  const email = (fields.email || '').trim();
  const password = fields.password || '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'لطفاً یک آدرس ایمیل معتبر فایرفاکس وارد نمایید.' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'رمز عبور اکانت فایرفاکس باید حداقل ۸ کاراکتر باشد.' };
  }

  if (mode === 'signup') {
    if (password !== (fields.confirmPassword || '')) {
      return { valid: false, error: 'رمز عبور و تکرار آن همخوانی ندارند.' };
    }
  }

  return { valid: true };
}

export const AUTO_SERVER: ServerInfo = {
  id: 'auto',
  countryName: 'Automatic (Optimal)',
  countryCode: 'AUTO',
  cityName: 'Lowest Latency',
  cityCode: 'AUTO',
  host: 'muc139.m1.fastly-masque.net',
  port: 2499,
  protocol: 'HTTP/2 CONNECT',
  latencyMs: 24,
  exitIpPreview: '23.235.42.8',
};

export function filterAndSortServers(
  servers: ServerInfo[],
  query: string,
  sortBy: 'latency' | 'country' = 'latency'
): ServerInfo[] {
  const q = query.trim().toLowerCase();
  const autoServer = servers.find((s) => s.id === 'auto');
  const otherServers = servers.filter((s) => s.id !== 'auto');

  const filtered = otherServers.filter((srv) => {
    if (!q) return true;
    return (
      srv.countryName.toLowerCase().includes(q) ||
      srv.countryCode.toLowerCase().includes(q) ||
      srv.cityName.toLowerCase().includes(q) ||
      srv.cityCode.toLowerCase().includes(q) ||
      srv.host.toLowerCase().includes(q)
    );
  });

  filtered.sort((a, b) => {
    if (sortBy === 'latency') {
      return a.latencyMs - b.latencyMs;
    }
    const cmp = a.countryName.localeCompare(b.countryName);
    if (cmp !== 0) return cmp;
    return a.cityName.localeCompare(b.cityName);
  });

  if (autoServer && (!q || 'automatic بهترین اتوماتیک optimal'.includes(q))) {
    return [autoServer, ...filtered];
  }
  return filtered;
}

export function countryCodeToFlag(countryCode: string): string {
  if (!countryCode) return '🌐';
  if (countryCode.toUpperCase() === 'AUTO') return '⚡';
  if (countryCode.length !== 2) return '🌐';
  const upper = countryCode.toUpperCase();
  const c1 = upper.charCodeAt(0);
  const c2 = upper.charCodeAt(1);
  if (c1 < 65 || c1 > 90 || c2 < 65 || c2 > 90) return '🌐';
  return String.fromCodePoint(0x1f1e6 + (c1 - 65), 0x1f1e6 + (c2 - 65));
}

export const ACCOUNT_BIN_PATH = 'data/account.bin';
export const ACCOUNT_BIN_MAGIC = 'FOXYBIN1';
export const APP_VERSION = '1.0.6';

export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').trim().split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').trim().split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export interface AccountBinarySnapshot {
  version: string;
  magic: string;
  savedAt: number;
  user: UserInfo | null;
  pool: Array<{
    id: string;
    email: string;
    token: string;
    quotaGB: number;
    remainingBytes?: number;
    active: boolean;
    addedAt: string;
  }>;
  settings?: ClientSettings;
}

const BIN_OBFUSCATION_KEY = [0x46, 0x4f, 0x58, 0x59, 0x56, 0x50, 0x4e, 0x35, 0xa5, 0x5a, 0xc3, 0x3c];

/**
 * Encodes an AccountBinarySnapshot into the binary `data/account.bin` format
 * starting with the 8-byte ASCII magic header `FOXYBIN1`.
 */
export function encodeAccountBinPayload(snapshot: AccountBinarySnapshot): Uint8Array {
  const jsonStr = JSON.stringify({
    ...snapshot,
    version: APP_VERSION,
    magic: ACCOUNT_BIN_MAGIC,
  });
  const encoder = new TextEncoder();
  const magicBytes = encoder.encode(ACCOUNT_BIN_MAGIC);
  const payloadBytes = encoder.encode(jsonStr);
  const out = new Uint8Array(magicBytes.length + payloadBytes.length);
  out.set(magicBytes, 0);
  for (let i = 0; i < payloadBytes.length; i++) {
    out[magicBytes.length + i] = payloadBytes[i] ^ BIN_OBFUSCATION_KEY[i % BIN_OBFUSCATION_KEY.length];
  }
  return out;
}

/**
 * Decodes a binary `data/account.bin` byte array back into an AccountBinarySnapshot.
 */
export function decodeAccountBinPayload(bytes: Uint8Array): AccountBinarySnapshot | null {
  if (!bytes || bytes.length <= 8) return null;
  const decoder = new TextDecoder();
  const magic = decoder.decode(bytes.slice(0, 8));
  if (magic !== ACCOUNT_BIN_MAGIC) {
    try {
      const legacy = JSON.parse(decoder.decode(bytes));
      if (legacy && typeof legacy === 'object') return legacy as AccountBinarySnapshot;
    } catch {
      return null;
    }
    return null;
  }
  const body = new Uint8Array(bytes.length - 8);
  for (let i = 0; i < body.length; i++) {
    body[i] = bytes[8 + i] ^ BIN_OBFUSCATION_KEY[i % BIN_OBFUSCATION_KEY.length];
  }
  try {
    const parsed = JSON.parse(decoder.decode(body));
    return parsed as AccountBinarySnapshot;
  } catch {
    return null;
  }
}

/**
 * Computes remaining quota bytes using the post-renewal traffic delta
 * `(cumulativeTxRxBytes - baselineTxRxBytes)` so background ProxyPass renewals
 * never double-deduct traffic already accounted for by the server (Issue #8).
 */
export function computeQuotaRemainingFromBaseline(
  serverRemainingBytes: number,
  cumulativeTxRxBytes: number,
  baselineTxRxBytes: number
): number {
  const safeServerRem = Math.max(0, serverRemainingBytes);
  const safeCumulative = Math.max(0, cumulativeTxRxBytes);
  const safeBaseline = Math.max(0, baselineTxRxBytes);
  const delta = safeCumulative >= safeBaseline ? safeCumulative - safeBaseline : safeCumulative;
  return Math.max(0, safeServerRem - delta);
}

/**
 * Resolves a requested server ID against the available server list.
 * If `requestedId` is `'auto'` or not found, selects the lowest-latency server
 * and marks `usedFallback = true` when a specific non-auto server ID was missing (Issue #6).
 */
export function resolveServerSelection(
  servers: ServerInfo[],
  requestedId: string
): { server: ServerInfo; usedFallback: boolean } {
  const nonAuto = servers.filter((s) => s.id !== 'auto');
  if (requestedId && requestedId !== 'auto') {
    const exact = nonAuto.find((s) => s.id === requestedId);
    if (exact) {
      return { server: exact, usedFallback: false };
    }
  }
  const sorted = [...nonAuto].sort((a, b) => {
    const la = a.latencyMs > 0 ? a.latencyMs : Number.MAX_SAFE_INTEGER;
    const lb = b.latencyMs > 0 ? b.latencyMs : Number.MAX_SAFE_INTEGER;
    return la - lb;
  });
  const best = sorted[0] || servers[0] || AUTO_SERVER;
  const usedFallback = Boolean(requestedId && requestedId !== 'auto');
  return { server: best, usedFallback };
}


