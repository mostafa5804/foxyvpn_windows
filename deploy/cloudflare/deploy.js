#!/usr/bin/env node
/**
 * Automated 1-Click / CLI Deployer for FoxyVPN Mozilla Guardian Relay
 * 
 * Usage:
 *   npm run deploy:relay
 *   or: node deploy/cloudflare/deploy.js
 */

import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\x1b[38;5;208m%s\x1b[0m', '🦊 FoxyVPN Mozilla Guardian Relay — Automated Deployer v1.1.0');
console.log('------------------------------------------------------------');

// 1. Generate a secure random relay secret
const secret = crypto.randomBytes(16).toString('hex');
console.log(`🔑 Generated Secret Key: \x1b[32m${secret}\x1b[0m`);

// 2. Update wrangler.toml with this unique secret
const wranglerPath = path.join(__dirname, 'wrangler.toml');
const wranglerContent = `name = "foxyvpn-guardian-relay"
main = "worker.js"
compatibility_date = "2024-01-01"

[vars]
RELAY_SECRET = "${secret}"
`;
fs.writeFileSync(wranglerPath, wranglerContent, 'utf8');
console.log('📝 Updated deploy/cloudflare/wrangler.toml with your unique secret.');

// 3. Attempt automated deployment via Wrangler
console.log('🚀 Checking Cloudflare Wrangler CLI...');
try {
  console.log('⚡ Running: npx wrangler deploy deploy/cloudflare/worker.js...');
  const output = execSync('npx wrangler deploy deploy/cloudflare/worker.js --name foxyvpn-guardian-relay', {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  console.log(output);

  // Extract workers.dev URL from output
  const match = output.match(/https:\/\/[a-zA-Z0-9._-]+\.workers\.dev/);
  if (match) {
    const fullRelayUrl = `${match[0]}?secret=${secret}`;
    console.log('\n\x1b[32m%s\x1b[0m', '🎉 تبریک! رله اختصاصی شما با موفقیت مستقر شد:');
    console.log('\x1b[1m%s\x1b[0m', fullRelayUrl);
    console.log('\nاین آدرس را در تب «تنظیمات تونل» برنامه در بخش سرور رله وارد کنید.');
  }
} catch (err) {
  console.log('\n\x1b[33m%s\x1b[0m', '💡 برای تکمیل خودکار استقرار در Cloudflare:');
  console.log('۱. در ترمینال دستور زیر را اجرا کنید تا وارد اکانت کلادفلر خود شوید:');
  console.log('   \x1b[36mnpx wrangler login\x1b[0m');
  console.log('۲. سپس دستور زیر را بزنید:');
  console.log('   \x1b[36mnpx wrangler deploy deploy/cloudflare/worker.js\x1b[0m');
  console.log('\nیا از لینک استقرار با ۱ کلیک در مرورگر استفاده کنید:');
  console.log('🌐 \x1b[34mhttps://deploy.workers.cloudflare.com/?url=https://github.com/mostafa5804/foxyvpn_windows\x1b[0m');
}
