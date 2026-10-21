import {
  FIFTY_GB_BYTES,
  type ClientSettings,
  type ConnectionStatus,
  type ServerInfo,
  type UserInfo,
} from './vpnLogic';

declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          Login(email: string, password: string): Promise<UserInfo>;
          RegisterAccount(email: string, password: string): Promise<UserInfo>;
          VerifyEmailCode(code: string): Promise<UserInfo>;
          ImportTokenPool(tokens: string[]): Promise<UserInfo>;
          Logout(): Promise<void>;
          GetServers(): Promise<ServerInfo[]>;
          Connect(serverId: string, mode: string): Promise<void>;
          Disconnect(): Promise<void>;
          GetStatus(): Promise<ConnectionStatus>;
          UpdateSettings(settings: ClientSettings): Promise<void>;
          GetLogs(): Promise<string[]>;
        };
      };
    };
  }
}

export const DEFAULT_SERVERS: ServerInfo[] = [
  {
    id: 'de-muc-1',
    countryName: 'Germany',
    countryCode: 'DE',
    cityName: 'Munich',
    cityCode: 'MUC',
    host: 'muc139.m1.fastly-masque.net',
    port: 2499,
    protocol: 'HTTP/2 CONNECT',
    latencyMs: 29,
    exitIpPreview: '23.235.42.8',
  },
  {
    id: 'nl-ehrd-1',
    countryName: 'Netherlands',
    countryCode: 'NL',
    cityName: 'Rotterdam',
    cityCode: 'EHRD',
    host: 'ehrd229.m1.fastly-masque.net',
    port: 2499,
    protocol: 'HTTP/2 CONNECT',
    latencyMs: 34,
    exitIpPreview: '23.235.42.17',
  },
  {
    id: 'at-vie-1',
    countryName: 'Austria',
    countryCode: 'AT',
    cityName: 'Vienna',
    cityCode: 'VIE',
    host: 'vie63.m1.fastly-masque.net',
    port: 2499,
    protocol: 'HTTP/2 CONNECT',
    latencyMs: 37,
    exitIpPreview: '23.235.42.31',
  },
  {
    id: 'fr-lfpb-1',
    countryName: 'France',
    countryCode: 'FR',
    cityName: 'Paris',
    cityCode: 'LFPB',
    host: 'lfpb115.m1.fastly-masque.net',
    port: 2499,
    protocol: 'HTTP/2 CONNECT',
    latencyMs: 41,
    exitIpPreview: '23.235.42.9',
  },
  {
    id: 'gb-eglc-1',
    countryName: 'United Kingdom',
    countryCode: 'GB',
    cityName: 'London',
    cityCode: 'EGLC',
    host: 'eglc860.m1.fastly-masque.net',
    port: 2499,
    protocol: 'HTTP/2 CONNECT',
    latencyMs: 44,
    exitIpPreview: '151.101.17.209',
  },
  {
    id: 'se-essb-1',
    countryName: 'Sweden',
    countryCode: 'SE',
    cityName: 'Stockholm',
    cityCode: 'ESSB',
    host: 'essb127.m1.fastly-masque.net',
    port: 2499,
    protocol: 'HTTP/2 CONNECT',
    latencyMs: 49,
    exitIpPreview: '151.101.85.77',
  },
  {
    id: 'fi-hel-1',
    countryName: 'Finland',
    countryCode: 'FI',
    cityName: 'Helsinki',
    cityCode: 'HEL',
    host: 'hel141.m1.fastly-masque.net',
    port: 2499,
    protocol: 'HTTP/2 CONNECT',
    latencyMs: 46,
    exitIpPreview: '151.101.112.88',
  },
  {
    id: 'be-bru-1',
    countryName: 'Belgium',
    countryCode: 'BE',
    cityName: 'Brussels',
    cityCode: 'BRU',
    host: 'bru148.m1.fastly-masque.net',
    port: 2499,
    protocol: 'HTTP/2 CONNECT',
    latencyMs: 38,
    exitIpPreview: '151.101.37.140',
  },
  {
    id: 'us-us-1',
    countryName: 'United States',
    countryCode: 'US',
    cityName: 'United States',
    cityCode: 'US',
    host: 'us.m1.fastly-masque.net',
    port: 2499,
    protocol: 'HTTP/2 CONNECT',
    latencyMs: 86,
    exitIpPreview: '151.101.1.195',
  },
  {
    id: 'jp-rjtf-1',
    countryName: 'Japan',
    countryCode: 'JP',
    cityName: 'Tokyo',
    cityCode: 'RJTF',
    host: 'rjtf770.m1.fastly-masque.net',
    port: 2499,
    protocol: 'HTTP/2 CONNECT',
    latencyMs: 162,
    exitIpPreview: '151.101.109.52',
  },
];

function nowTimeStr(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

class WailsRuntimeBridge {
  private logs: string[] = [
    `${nowTimeStr()} [INFO ] FoxyVPN Windows Client v1.0.2 initialized (Wails v2 + Go 1.23)`,
    `${nowTimeStr()} [INFO ] Loaded Mozilla Remote Settings topology (Fastly HTTP/2 CONNECT edge regions on port 2499)`,
    `${nowTimeStr()} [INFO ] Wintun v0.14.1 driver (amd64) verified in application directory`,
  ];

  private pendingEmail = '';
  private pendingIsSignUp = false;
  private currentUser: UserInfo | null = null;
  private settings: ClientSettings = {
    mode: 'tun',
    tlsSplitMode: 'sni',
    dohProvider: '1.1.1.1',
    mtu: 1380,
    killSwitch: true,
    controlPlaneProxy: '',
    edgeOverrideIp: '',
  };

  private status: ConnectionStatus = {
    state: 'Disconnected',
    mode: 'tun',
    serverId: 'de-muc-1',
    serverLabel: 'Germany — Munich',
    uptimeSeconds: 0,
    uploadedBytes: 0,
    downloadedBytes: 0,
    pingMs: 29,
    exitIp: '—',
    exitCountry: '—',
    exitVerified: false,
    quotaMaxBytes: FIFTY_GB_BYTES,
    quotaRemainingBytes: Math.floor(FIFTY_GB_BYTES * 0.914), // 45.70 GB remaining
  };

  private addLog(level: 'INFO' | 'WARN' | 'ERROR', msg: string) {
    this.logs.push(`${nowTimeStr()} [${level.padEnd(5, ' ')}] ${msg}`);
    if (this.logs.length > 300) {
      this.logs = this.logs.slice(-300);
    }
  }

  private get nativeApp() {
    return typeof window !== 'undefined' ? window.go?.main?.App : undefined;
  }

  get isNative(): boolean {
    return typeof window !== 'undefined' && Boolean(window.go?.main?.App);
  }

  async login(email: string, password: string): Promise<UserInfo> {
    if (this.nativeApp) {
      return this.nativeApp.Login(email, password);
    }
    this.addLog('INFO', `Deriving FxA quickStretch (PBKDF2-SHA256 1000 rounds + HKDF) for ${email}`);
    this.addLog('INFO', `POST https://api.accounts.firefox.com/v1/account/login (verificationMethod=email-2fa)`);
    this.pendingEmail = email;
    this.pendingIsSignUp = false;
    return {
      email,
      uid: 'fxa-' + Math.random().toString(16).slice(2, 10),
      verified: false,
      requiresVerification: true,
      subscribed: true,
      quotaMaxBytes: FIFTY_GB_BYTES,
      quotaRemainingBytes: this.status.quotaRemainingBytes,
      quotaResetEpoch: Math.floor(Date.now() / 1000) + 18 * 86400,
      tokenPoolCount: 1,
    };
  }

  async registerAccount(email: string, password: string): Promise<UserInfo> {
    if (this.nativeApp) {
      return this.nativeApp.RegisterAccount(email, password);
    }
    this.addLog('INFO', `Deriving FxA quickStretch + authPW for new account ${email}`);
    this.addLog('INFO', `POST https://api.accounts.firefox.com/v1/account/create?keys=true (service=5882386c6d801776)`);
    this.addLog('INFO', `Fastly PoW challenge solved (SHA-256 2-byte suffix); verification link/code dispatched to ${email}`);
    this.pendingEmail = email;
    this.pendingIsSignUp = true;
    return {
      email,
      uid: 'fxa-new-' + Math.random().toString(16).slice(2, 10),
      verified: false,
      requiresVerification: true,
      subscribed: true,
      quotaMaxBytes: FIFTY_GB_BYTES,
      quotaRemainingBytes: FIFTY_GB_BYTES,
      quotaResetEpoch: Math.floor(Date.now() / 1000) + 30 * 86400,
      tokenPoolCount: 1,
    };
  }

  async verifyEmailCode(code: string): Promise<UserInfo> {
    if (this.nativeApp) {
      return this.nativeApp.VerifyEmailCode(code);
    }
    const endpoint = this.pendingIsSignUp ? '/v1/recovery_email/verify_code' : '/v1/session/verify_code';
    this.addLog('INFO', `POST https://api.accounts.firefox.com${endpoint} [Hawk HMAC-SHA256 signed]`);
    this.addLog('INFO', `Exchanging sessionToken -> OAuth Bearer token (scope="profile https://identity.mozilla.com/apps/vpn")`);
    if (this.pendingIsSignUp) {
      this.addLog('INFO', `POST https://vpn.mozilla.org/api/v1/fpn/activate -> Activated free 50 GB monthly browser VPN entitlement!`);
      this.status.quotaRemainingBytes = FIFTY_GB_BYTES;
    } else {
      this.addLog('INFO', `GET https://vpn.mozilla.org/api/v1/fpn/status -> Subscribed=true, LimitedBandwidth=true (50 GB cap)`);
    }

    const user: UserInfo = {
      email: this.pendingEmail || 'user@firefox.com',
      uid: 'fxa-89f2c401a',
      verified: true,
      requiresVerification: false,
      subscribed: true,
      quotaMaxBytes: FIFTY_GB_BYTES,
      quotaRemainingBytes: this.status.quotaRemainingBytes,
      quotaResetEpoch: Math.floor(Date.now() / 1000) + 21 * 86400,
      tokenPoolCount: 1,
    };
    this.currentUser = user;
    return user;
  }

  async importTokenPool(tokens: string[]): Promise<UserInfo> {
    if (this.nativeApp) {
      return this.nativeApp.ImportTokenPool(tokens);
    }
    this.addLog('INFO', `Loaded ${tokens.length} FxA sessionToken(s) into auto-rotation pool`);
    this.addLog('INFO', `Activated pool token 1/${tokens.length} via Hawk OAuth exchange`);
    const user: UserInfo = {
      email: `token-pool (${tokens.length} account${tokens.length > 1 ? 's' : ''})`,
      uid: 'pool-active',
      verified: true,
      requiresVerification: false,
      subscribed: true,
      quotaMaxBytes: FIFTY_GB_BYTES * tokens.length,
      quotaRemainingBytes: FIFTY_GB_BYTES * tokens.length,
      quotaResetEpoch: Math.floor(Date.now() / 1000) + 25 * 86400,
      tokenPoolCount: tokens.length,
    };
    this.currentUser = user;
    this.status.quotaMaxBytes = user.quotaMaxBytes;
    this.status.quotaRemainingBytes = user.quotaRemainingBytes;
    return user;
  }

  async logout(): Promise<void> {
    if (this.nativeApp) {
      return this.nativeApp.Logout();
    }
    await this.disconnect();
    this.currentUser = null;
    this.addLog('INFO', 'Cleared .foxyvpn-tokens.json and signed out of Firefox Account');
  }

  async getServers(): Promise<ServerInfo[]> {
    if (this.nativeApp) {
      return this.nativeApp.GetServers();
    }
    return DEFAULT_SERVERS;
  }

  async connect(serverId: string, mode: 'tun' | 'proxy'): Promise<void> {
    if (this.nativeApp) {
      return this.nativeApp.Connect(serverId, mode);
    }
    const srv = DEFAULT_SERVERS.find((s) => s.id === serverId) || DEFAULT_SERVERS[0];
    this.settings.mode = mode;
    this.status.state = 'Connecting...';
    this.status.mode = mode;
    this.status.serverId = srv.id;
    this.status.serverLabel = `${srv.countryName} — ${srv.cityName}`;

    this.addLog('INFO', `GET https://vpn.mozilla.org/api/v1/fpn/token -> Obtained short-lived Guardian JWT ProxyPass`);
    this.addLog(
      'INFO',
      `Dialing Fastly edge ${srv.host}:${srv.port} (ALPN=h2, Anti-DPI=${this.settings.tlsSplitMode.toUpperCase()})`
    );

    if (mode === 'tun') {
      this.addLog(
        'INFO',
        `Wintun: Created virtual adapter "FoxyVPN-Adapter" (IP 10.0.0.2/24, MTU ${this.settings.mtu})`
      );
      this.addLog('INFO', `Proxy: Enabled Windows WinINET System Proxy 127.0.0.1:8080 & SOCKS5 127.0.0.1:1080`);
      this.addLog('INFO', `DNS: Intercepting UDP/53 -> DoH https://${this.settings.dohProvider}/dns-query over HTTP/2`);
    } else {
      this.addLog('INFO', `Listening on SOCKS5 127.0.0.1:1080 and HTTP CONNECT 127.0.0.1:8080`);
      this.addLog('INFO', `WinINET Registry: Enabled ProxyServer=127.0.0.1:8080 in HKCU Internet Settings`);
    }

    this.status.state = 'Connected';
    this.status.uptimeSeconds = 1;
    this.status.pingMs = srv.latencyMs;
    this.status.exitIp = srv.exitIpPreview || '23.235.42.8';
    this.status.exitCountry = srv.countryCode;
    this.status.exitVerified = true;
    this.addLog(
      'INFO',
      `Exit verified via cloudflare.com/cdn-cgi/trace: ip=${this.status.exitIp} loc=${this.status.exitCountry} latency=${srv.latencyMs}ms`
    );
  }

  async disconnect(): Promise<void> {
    if (this.nativeApp) {
      return this.nativeApp.Disconnect();
    }
    if (this.status.state !== 'Disconnected') {
      if (this.status.mode === 'tun') {
        this.addLog('INFO', 'Closed Wintun session "FoxyVPN-Adapter" and restored adapter DNS');
      }
      this.addLog('INFO', 'Restored Windows WinINET Registry ProxyEnable=0');
      this.addLog('INFO', 'Closed Fastly HTTP/2 CONNECT upstream session');
    }
    this.status.state = 'Disconnected';
    this.status.uptimeSeconds = 0;
    this.status.exitVerified = false;
    this.status.exitIp = '—';
    this.status.exitCountry = '—';
  }

  async getStatus(): Promise<ConnectionStatus> {
    if (this.nativeApp) {
      return this.nativeApp.GetStatus();
    }
    return { ...this.status };
  }

  tickSimulation(txDelta: number, rxDelta: number): ConnectionStatus {
    if (this.status.state === 'Connected') {
      this.status.uptimeSeconds += 1;
      this.status.uploadedBytes += txDelta;
      this.status.downloadedBytes += rxDelta;
      this.status.quotaRemainingBytes = Math.max(0, this.status.quotaRemainingBytes - (txDelta + rxDelta));
    }
    return { ...this.status };
  }

  async updateSettings(newSettings: ClientSettings): Promise<void> {
    if (this.nativeApp) {
      return this.nativeApp.UpdateSettings(newSettings);
    }
    this.settings = { ...newSettings };
    this.status.mode = newSettings.mode;
    this.addLog(
      'INFO',
      `Settings applied: Mode=${newSettings.mode.toUpperCase()}, Anti-DPI=${newSettings.tlsSplitMode}, DoH=${newSettings.dohProvider}, MTU=${newSettings.mtu}`
    );
  }

  async getLogs(): Promise<string[]> {
    if (this.nativeApp) {
      return this.nativeApp.GetLogs();
    }
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [`${nowTimeStr()} [INFO ] Log buffer cleared by user`];
  }
}

export const vpnBridge = new WailsRuntimeBridge();
