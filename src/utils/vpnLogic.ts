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
  tlsSplitMode: 'off' | 'tcp' | 'record';
  dohProvider: '1.1.1.1' | '8.8.8.8' | '9.9.9.9';
  mtu: number;
  killSwitch: boolean;
  controlPlaneProxy: string;
  edgeOverrideIp: string;
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

export function validateAuthInput(
  mode: 'signin' | 'signup' | 'token' | 'verify',
  fields: {
    email?: string;
    password?: string;
    confirmPassword?: string;
    code?: string;
    tokenPoolText?: string;
  }
): ValidationResult {
  if (mode === 'verify') {
    const code = (fields.code || '').trim();
    if (!/^\d{6}$/.test(code)) {
      return { valid: false, error: 'Please enter the 6-digit verification code sent to your email.' };
    }
    return { valid: true };
  }

  if (mode === 'token') {
    const tokens = parseTokenPool(fields.tokenPoolText || '');
    if (tokens.length === 0) {
      return {
        valid: false,
        error: 'Enter at least one valid hexadecimal FxA sessionToken (32–64 hex characters).',
      };
    }
    return { valid: true };
  }

  const email = (fields.email || '').trim();
  const password = fields.password || '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid Firefox Account email address.' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Firefox Account password must be at least 8 characters long.' };
  }

  if (mode === 'signup') {
    if (password !== (fields.confirmPassword || '')) {
      return { valid: false, error: 'Passwords do not match. Please confirm your password.' };
    }
  }

  return { valid: true };
}

export function filterAndSortServers(
  servers: ServerInfo[],
  query: string,
  sortBy: 'latency' | 'country' = 'latency'
): ServerInfo[] {
  const q = query.trim().toLowerCase();
  const filtered = servers.filter((srv) => {
    if (!q) return true;
    return (
      srv.countryName.toLowerCase().includes(q) ||
      srv.countryCode.toLowerCase().includes(q) ||
      srv.cityName.toLowerCase().includes(q) ||
      srv.cityCode.toLowerCase().includes(q) ||
      srv.host.toLowerCase().includes(q)
    );
  });

  return [...filtered].sort((a, b) => {
    if (sortBy === 'latency') {
      return a.latencyMs - b.latencyMs;
    }
    const cmp = a.countryName.localeCompare(b.countryName);
    if (cmp !== 0) return cmp;
    return a.cityName.localeCompare(b.cityName);
  });
}

export function countryCodeToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const upper = countryCode.toUpperCase();
  const c1 = upper.charCodeAt(0);
  const c2 = upper.charCodeAt(1);
  if (c1 < 65 || c1 > 90 || c2 < 65 || c2 > 90) return '🌐';
  return String.fromCodePoint(0x1f1e6 + (c1 - 65), 0x1f1e6 + (c2 - 65));
}
