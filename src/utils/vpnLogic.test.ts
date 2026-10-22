import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIFTY_GB_BYTES,
  formatBytes,
  formatRate,
  formatUptime,
  calculateQuotaSummary,
  parseTokenPool,
  validateAuthInput,
  filterAndSortServers,
  countryCodeToFlag,
  type ServerInfo,
} from './vpnLogic.ts';

test('formatBytes and formatRate format network telemetry accurately', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(10 * 1024 * 1024), '10.00 MB');
  assert.equal(formatBytes(FIFTY_GB_BYTES), '50.00 GB');
  assert.equal(formatRate(512 * 1024), '512.0 KB/s');
  assert.equal(formatRate(4.5 * 1024 * 1024), '4.50 MB/s');
  assert.equal(formatUptime(3665), '01:01:05');
});

test('calculateQuotaSummary computes 50 GB monthly allowance metrics and health states', () => {
  const full = calculateQuotaSummary(FIFTY_GB_BYTES, FIFTY_GB_BYTES);
  assert.equal(full.usedPercent, 0);
  assert.equal(full.remainingGB, '50.00');
  assert.equal(full.healthState, 'nominal');

  const eightyPercentUsed = calculateQuotaSummary(FIFTY_GB_BYTES, 10 * 1024 * 1024 * 1024);
  assert.equal(eightyPercentUsed.usedPercent, 80);
  assert.equal(eightyPercentUsed.remainingGB, '10.00');
  assert.equal(eightyPercentUsed.healthState, 'warning');

  const ninetyFivePercentUsed = calculateQuotaSummary(FIFTY_GB_BYTES, 2.5 * 1024 * 1024 * 1024);
  assert.equal(ninetyFivePercentUsed.usedPercent, 95);
  assert.equal(ninetyFivePercentUsed.healthState, 'critical');
});

test('validateAuthInput validates Sign-In, In-App Sign-Up, 6-digit OTP, and Token Pool', () => {
  assert.equal(validateAuthInput('signin', { email: 'bad-email', password: 'password123' }).valid, false);
  assert.equal(validateAuthInput('signin', { email: 'user@firefox.com', password: 'short' }).valid, false);
  assert.equal(validateAuthInput('signin', { email: 'user@firefox.com', password: 'password123' }).valid, true);

  // In-App Sign-Up requires matching confirmPassword
  assert.equal(
    validateAuthInput('signup', {
      email: 'newuser@firefox.com',
      password: 'password123',
      confirmPassword: 'differentPassword',
    }).valid,
    false
  );
  assert.equal(
    validateAuthInput('signup', {
      email: 'newuser@firefox.com',
      password: 'password123',
      confirmPassword: 'password123',
    }).valid,
    true
  );

  // 6-digit email OTP verification
  assert.equal(validateAuthInput('verify', { code: '12345' }).valid, false);
  assert.equal(validateAuthInput('verify', { code: '482910' }).valid, true);

  // Hex sessionToken pool
  const poolText = `
    # Primary account token
    a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90
    invalid_token_line
    f0e1d2c3b4a5968778695a4b3c2d1e0ff0e1d2c3b4a5968778695a4b3c2d1e0f
  `;
  const parsed = parseTokenPool(poolText);
  assert.equal(parsed.length, 2);
  assert.equal(validateAuthInput('token', { tokenPoolText: poolText }).valid, true);
});

test('filterAndSortServers filters by country/city and sorts by latency', () => {
  const sample: ServerInfo[] = [
    {
      id: 'us-nyc-1',
      countryName: 'United States',
      countryCode: 'US',
      cityName: 'New York',
      cityCode: 'NYC',
      host: 'us-nyc.m1.fastly-masque.net',
      port: 443,
      protocol: 'HTTP/2 CONNECT',
      latencyMs: 88,
    },
    {
      id: 'de-fra-1',
      countryName: 'Germany',
      countryCode: 'DE',
      cityName: 'Frankfurt',
      cityCode: 'FRA',
      host: 'de-fra.m1.fastly-masque.net',
      port: 443,
      protocol: 'HTTP/2 CONNECT',
      latencyMs: 31,
    },
  ];

  const sortedByLatency = filterAndSortServers(sample, '', 'latency');
  assert.equal(sortedByLatency[0].id, 'de-fra-1');

  const filtered = filterAndSortServers(sample, 'frankfurt', 'latency');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].countryCode, 'DE');
  assert.equal(countryCodeToFlag('DE'), '🇩🇪');
});

test('encodeAccountBinPayload and decodeAccountBinPayload round-trip data/account.bin binary store', async () => {
  const { encodeAccountBinPayload, decodeAccountBinPayload, ACCOUNT_BIN_MAGIC, APP_VERSION } = await import('./vpnLogic.ts');
  assert.equal(APP_VERSION, '1.0.5');

  const snapshot = {
    version: APP_VERSION,
    magic: ACCOUNT_BIN_MAGIC,
    savedAt: 1761000000000,
    user: {
      email: 'persistent@firefox.com',
      uid: 'uid-105',
      verified: true,
      requiresVerification: false,
      subscribed: true,
      quotaMaxBytes: FIFTY_GB_BYTES,
      quotaRemainingBytes: FIFTY_GB_BYTES,
      quotaResetEpoch: 1763592000,
      tokenPoolCount: 1,
    },
    pool: [
      {
        id: 'acc-1',
        email: 'persistent@firefox.com',
        token: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
        quotaGB: 50,
        active: true,
        addedAt: '12:00:00',
      },
    ],
  };

  const binary = encodeAccountBinPayload(snapshot);
  assert.equal(binary.length > 8, true);
  const decoded = decodeAccountBinPayload(binary);
  assert.ok(decoded);
  assert.equal(decoded.version, '1.0.5');
  assert.equal(decoded.user?.email, 'persistent@firefox.com');
  assert.equal(decoded.pool.length, 1);
});

