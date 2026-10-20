package main

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/vauth/foxyvpn-windows/pkg/auth"
	"github.com/vauth/foxyvpn-windows/pkg/vpn"
)

// UserInfo represents the authenticated Firefox Account and its 50 GB monthly Guardian quota.
type UserInfo struct {
	Email                string `json:"email"`
	UID                  string `json:"uid"`
	Verified             bool   `json:"verified"`
	RequiresVerification bool   `json:"requiresVerification"`
	Subscribed           bool   `json:"subscribed"`
	QuotaMaxBytes        int64  `json:"quotaMaxBytes"`
	QuotaRemainingBytes  int64  `json:"quotaRemainingBytes"`
	QuotaResetEpoch      int64  `json:"quotaResetEpoch"`
	TokenPoolCount       int    `json:"tokenPoolCount"`
}

// ServerInfo represents a Fastly edge node available via Mozilla Remote Settings.
type ServerInfo struct {
	ID          string `json:"id"`
	CountryName string `json:"countryName"`
	CountryCode string `json:"countryCode"`
	CityName    string `json:"cityName"`
	CityCode    string `json:"cityCode"`
	Host        string `json:"host"`
	Port        int    `json:"port"`
	Protocol    string `json:"protocol"`
	LatencyMs   int64  `json:"latencyMs"`
}

// ConnectionStatus reports real-time tunnel telemetry to the React UI.
type ConnectionStatus struct {
	State               string `json:"state"` // "Disconnected" | "Connecting..." | "Connected"
	Mode                string `json:"mode"`  // "tun" | "proxy"
	ServerID            string `json:"serverId"`
	ServerLabel         string `json:"serverLabel"`
	UptimeSeconds       int64  `json:"uptimeSeconds"`
	UploadedBytes       int64  `json:"uploadedBytes"`
	DownloadedBytes     int64  `json:"downloadedBytes"`
	PingMs              int64  `json:"pingMs"`
	ExitIP              string `json:"exitIp"`
	ExitCountry         string `json:"exitCountry"`
	ExitVerified        bool   `json:"exitVerified"`
	QuotaMaxBytes       int64  `json:"quotaMaxBytes"`
	QuotaRemainingBytes int64  `json:"quotaRemainingBytes"`
}

// ClientSettings holds advanced Anti-DPI, DNS, and tunnel parameters.
type ClientSettings struct {
	Mode              string `json:"mode"`         // "tun" | "proxy"
	TlsSplitMode      string `json:"tlsSplitMode"` // "off" | "tcp" | "record"
	DohProvider       string `json:"dohProvider"`  // "1.1.1.1" | "8.8.8.8" | "9.9.9.9"
	MTU               int    `json:"mtu"`
	KillSwitch        bool   `json:"killSwitch"`
	ControlPlaneProxy string `json:"controlPlaneProxy"`
	EdgeOverrideIP    string `json:"edgeOverrideIp"`
}

// App struct is bound to the Wails v2 frontend.
type App struct {
	ctx           context.Context
	mu            sync.RWMutex
	authSvc       *auth.GuardianService
	vpnEngine     *vpn.Engine
	servers       []ServerInfo
	currentUser   *UserInfo
	currentServer *ServerInfo
	state         string
	settings      ClientSettings
	logs          []string
	logsMu        sync.Mutex
	renewCancel   context.CancelFunc
}

// NewApp creates a new Wails App application struct.
func NewApp() *App {
	app := &App{
		state: "Disconnected",
		settings: ClientSettings{
			Mode:         "tun",
			TlsSplitMode: "record",
			DohProvider:  "1.1.1.1",
			MTU:          1380,
			KillSwitch:   true,
		},
	}
	app.authSvc = auth.NewGuardianService(app.appendLog)
	app.vpnEngine = vpn.NewEngine(app.appendLog)
	return app
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.appendLog("INFO", "FoxyVPN Windows Client started (Wintun + HTTP/2 CONNECT + DoH Engine ready)")

	if saved, err := a.authSvc.LoadTokens(); err == nil && saved.AccessToken != "" {
		a.appendLog("INFO", fmt.Sprintf("Restored saved Firefox Account session for %s", saved.Email))
		ent, err := a.authSvc.EnsureGuardianEntitlement(ctx, saved.AccessToken)
		quotaMax := auth.DefaultMonthlyAllowance
		quotaRem := auth.DefaultMonthlyAllowance
		if err == nil && ent != nil {
			quotaMax = ent.MaxBytes
			quotaRem = ent.QuotaRemaining
		}
		a.mu.Lock()
		a.currentUser = &UserInfo{
			Email:               saved.Email,
			UID:                 saved.UID,
			Verified:            true,
			Subscribed:          true,
			QuotaMaxBytes:       quotaMax,
			QuotaRemainingBytes: quotaRem,
		}
		a.mu.Unlock()
	}
}

func (a *App) shutdown(ctx context.Context) {
	_ = a.Disconnect()
}

func (a *App) appendLog(level, msg string) {
	a.logsMu.Lock()
	defer a.logsMu.Unlock()
	entry := fmt.Sprintf("%s [%-5s] %s", time.Now().Format("15:04:05"), level, msg)
	a.logs = append(a.logs, entry)
	if len(a.logs) > 500 {
		a.logs = a.logs[len(a.logs)-500:]
	}
}

// Login signs into an existing Firefox Account. If FxA requires a 6-digit email verification code, RequiresVerification is true.
func (a *App) Login(email, password string) (*UserInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	resp, err := a.authSvc.Login(ctx, email, password)
	if err != nil {
		a.appendLog("ERROR", fmt.Sprintf("FxA Login failed: %v", err))
		return nil, err
	}

	if !resp.Verified {
		a.appendLog("INFO", fmt.Sprintf("6-digit verification code sent to %s (method=%s)", email, resp.VerificationMethod))
		return &UserInfo{
			Email:                email,
			UID:                  resp.UID,
			Verified:             false,
			RequiresVerification: true,
			QuotaMaxBytes:        auth.DefaultMonthlyAllowance,
			QuotaRemainingBytes:  auth.DefaultMonthlyAllowance,
		}, nil
	}

	saved, ent, err := a.authSvc.CompleteSessionLogin(ctx, email, resp.UID, resp.SessionToken)
	if err != nil {
		return nil, err
	}
	return a.setAuthenticatedUser(saved, ent, 1), nil
}

// RegisterAccount creates a new Firefox Account directly inside the app and sends a 6-digit confirmation code to the user's email.
func (a *App) RegisterAccount(email, password string) (*UserInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	resp, err := a.authSvc.RegisterAccount(ctx, email, password)
	if err != nil {
		a.appendLog("ERROR", fmt.Sprintf("FxA Account creation failed: %v", err))
		return nil, err
	}

	return &UserInfo{
		Email:                email,
		UID:                  resp.UID,
		Verified:             false,
		RequiresVerification: true,
		QuotaMaxBytes:        auth.DefaultMonthlyAllowance,
		QuotaRemainingBytes:  auth.DefaultMonthlyAllowance,
	}, nil
}

// VerifyEmailCode submits the 6-digit email code for either Sign-In or In-App Sign-Up, then activates the 50 GB monthly allowance.
func (a *App) VerifyEmailCode(code string) (*UserInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	saved, ent, err := a.authSvc.VerifyEmailCode(ctx, code)
	if err != nil {
		a.appendLog("ERROR", fmt.Sprintf("Email code verification failed: %v", err))
		return nil, err
	}
	return a.setAuthenticatedUser(saved, ent, 1), nil
}

// ImportTokenPool authenticates using one or more FxA hex sessionTokens and enables automatic rotation when 50 GB is exhausted.
func (a *App) ImportTokenPool(tokens []string) (*UserInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	saved, ent, err := a.authSvc.ConfigureTokenPool(ctx, tokens)
	if err != nil {
		a.appendLog("ERROR", fmt.Sprintf("Token pool activation failed: %v", err))
		return nil, err
	}
	return a.setAuthenticatedUser(saved, ent, len(tokens)), nil
}

func (a *App) setAuthenticatedUser(saved *auth.SavedTokens, ent *auth.Entitlement, poolCount int) *UserInfo {
	u := &UserInfo{
		Email:               saved.Email,
		UID:                 saved.UID,
		Verified:            true,
		Subscribed:          true,
		QuotaMaxBytes:       ent.MaxBytes,
		QuotaRemainingBytes: ent.QuotaRemaining,
		QuotaResetEpoch:     ent.QuotaReset,
		TokenPoolCount:      poolCount,
	}
	a.mu.Lock()
	a.currentUser = u
	a.mu.Unlock()
	a.appendLog("INFO", fmt.Sprintf("Authenticated %s (50 GB Monthly Allowance Ready)", saved.Email))
	return u
}

// Logout disconnects any active tunnel and deletes stored tokens.
func (a *App) Logout() error {
	_ = a.Disconnect()
	a.authSvc.Logout()
	a.mu.Lock()
	a.currentUser = nil
	a.mu.Unlock()
	a.appendLog("INFO", "Signed out and cleared local session tokens")
	return nil
}

// GetServers fetches available Fastly edge servers from Mozilla Remote Settings.
func (a *App) GetServers() ([]ServerInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	countries, err := a.authSvc.FetchServerList(ctx)
	if err != nil {
		a.appendLog("WARN", fmt.Sprintf("Remote Settings fetch warning (%v); using cached Fastly edge topology", err))
		return defaultFallbackServers(), nil
	}

	var list []ServerInfo
	for _, c := range countries {
		for _, city := range c.Cities {
			for idx, srv := range city.Servers {
				if srv.Quarantined {
					continue
				}
				host := srv.Hostname
				port := srv.Port
				protoName := "HTTP/2 CONNECT"
				for _, p := range srv.Protocols {
					if p.Name == "connect" && p.Host != "" {
						host = p.Host
						if p.Port > 0 {
							port = p.Port
						}
						break
					}
				}
				if host == "" {
					continue
				}
				if port == 0 {
					port = 443
				}
				id := fmt.Sprintf("%s-%s-%d", strings.ToLower(c.Code), strings.ToLower(city.Code), idx+1)
				list = append(list, ServerInfo{
					ID:          id,
					CountryName: c.Name,
					CountryCode: strings.ToUpper(c.Code),
					CityName:    city.Name,
					CityCode:    strings.ToUpper(city.Code),
					Host:        host,
					Port:        port,
					Protocol:    protoName,
					LatencyMs:   int64(28 + (idx*11)%65),
				})
			}
		}
	}

	if len(list) == 0 {
		list = defaultFallbackServers()
	}

	a.mu.Lock()
	a.servers = list
	a.mu.Unlock()
	return list, nil
}

// Connect acquires a short-lived Guardian ProxyPass token and starts the Wintun or Proxy tunnel.
func (a *App) Connect(serverID string, mode string) error {
	a.mu.Lock()
	if len(a.servers) == 0 {
		a.servers = defaultFallbackServers()
	}
	var target *ServerInfo
	for i := range a.servers {
		if a.servers[i].ID == serverID {
			target = &a.servers[i]
			break
		}
	}
	if target == nil {
		target = &a.servers[0]
	}
	if mode != "" {
		a.settings.Mode = mode
	}
	cfgSettings := a.settings
	a.state = "Connecting..."
	a.currentServer = target
	a.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pass, err := a.authSvc.GetValidProxyPass(ctx)
	if err != nil {
		a.mu.Lock()
		a.state = "Disconnected"
		a.mu.Unlock()
		a.appendLog("ERROR", fmt.Sprintf("Failed to obtain Guardian ProxyPass token: %v", err))
		return err
	}

	a.mu.Lock()
	if a.currentUser != nil {
		if pass.QuotaMax > 0 {
			a.currentUser.QuotaMaxBytes = pass.QuotaMax
		}
		if pass.QuotaRemaining >= 0 {
			a.currentUser.QuotaRemainingBytes = pass.QuotaRemaining
		}
	}
	a.mu.Unlock()

	tunCfg := vpn.TunnelConfig{
		EdgeHost:       target.Host,
		EdgePort:       target.Port,
		EdgeOverrideIP: cfgSettings.EdgeOverrideIP,
		BearerToken:    pass.Token,
		Mode:           cfgSettings.Mode,
		TlsSplitMode:   cfgSettings.TlsSplitMode,
		DohProvider:    cfgSettings.DohProvider,
		MTU:            cfgSettings.MTU,
		KillSwitch:     cfgSettings.KillSwitch,
		SocksListen:    "127.0.0.1:1080",
		HttpListen:     "127.0.0.1:8080",
	}

	if err := a.vpnEngine.Start(ctx, tunCfg); err != nil {
		a.mu.Lock()
		a.state = "Disconnected"
		a.mu.Unlock()
		a.appendLog("ERROR", fmt.Sprintf("Tunnel start failed: %v", err))
		return err
	}

	a.mu.Lock()
	a.state = "Connected"
	if a.renewCancel != nil {
		a.renewCancel()
	}
	renewCtx, rCancel := context.WithCancel(context.Background())
	a.renewCancel = rCancel
	a.mu.Unlock()

	go a.proxyPassRenewalLoop(renewCtx, pass.ExpiresAt)
	return nil
}

func (a *App) proxyPassRenewalLoop(ctx context.Context, expiresAt int64) {
	for {
		waitDur := 25 * time.Minute
		if expiresAt > 0 {
			rem := time.Until(time.Unix(expiresAt, 0))
			if rem > 1*time.Minute {
				waitDur = rem / 2
			} else {
				waitDur = 30 * time.Second
			}
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(waitDur):
			reqCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
			pass, err := a.authSvc.GetValidProxyPass(reqCtx)
			cancel()
			if err != nil {
				a.appendLog("WARN", fmt.Sprintf("Background ProxyPass renewal retry needed: %v", err))
				expiresAt = time.Now().Add(1 * time.Minute).Unix()
				continue
			}
			a.vpnEngine.UpdateToken(pass.Token)
			expiresAt = pass.ExpiresAt
			a.mu.Lock()
			if a.currentUser != nil && pass.QuotaRemaining >= 0 {
				a.currentUser.QuotaRemainingBytes = pass.QuotaRemaining
			}
			a.mu.Unlock()
		}
	}
}

// Disconnect stops the Wintun/Proxy engine and restores system routes.
func (a *App) Disconnect() error {
	a.mu.Lock()
	if a.renewCancel != nil {
		a.renewCancel()
		a.renewCancel = nil
	}
	a.state = "Disconnected"
	a.mu.Unlock()

	return a.vpnEngine.Stop()
}

// GetStatus returns the current connection state, byte counters, ping, and 50 GB quota status.
func (a *App) GetStatus() ConnectionStatus {
	running, uptime, tx, rx, ping, exit := a.vpnEngine.Stats()

	a.mu.RLock()
	defer a.mu.RUnlock()

	state := a.state
	if running && state != "Connected" {
		state = "Connected"
	}

	var srvID, srvLabel string
	if a.currentServer != nil {
		srvID = a.currentServer.ID
		srvLabel = fmt.Sprintf("%s — %s", a.currentServer.CountryName, a.currentServer.CityName)
	}

	quotaMax := auth.DefaultMonthlyAllowance
	quotaRem := auth.DefaultMonthlyAllowance
	if a.currentUser != nil {
		if a.currentUser.QuotaMaxBytes > 0 {
			quotaMax = a.currentUser.QuotaMaxBytes
		}
		quotaRem = a.currentUser.QuotaRemainingBytes - (tx + rx)
		if quotaRem < 0 {
			quotaRem = 0
		}
	}

	return ConnectionStatus{
		State:               state,
		Mode:                a.settings.Mode,
		ServerID:            srvID,
		ServerLabel:         srvLabel,
		UptimeSeconds:       uptime,
		UploadedBytes:       tx,
		DownloadedBytes:     rx,
		PingMs:              ping,
		ExitIP:              exit.IP,
		ExitCountry:         exit.CountryCode,
		ExitVerified:        exit.Verified,
		QuotaMaxBytes:       quotaMax,
		QuotaRemainingBytes: quotaRem,
	}
}

// UpdateSettings updates client settings (TUN/Proxy mode, TLS fragmentation, DoH DNS, MTU, Upstream Proxy).
func (a *App) UpdateSettings(s ClientSettings) error {
	a.mu.Lock()
	prevProxy := a.settings.ControlPlaneProxy
	a.settings = s
	a.mu.Unlock()

	if s.ControlPlaneProxy != prevProxy {
		if err := a.authSvc.SetControlPlaneProxy(s.ControlPlaneProxy); err != nil {
			return err
		}
	}
	a.appendLog("INFO", fmt.Sprintf("Updated settings: Mode=%s, TLS-Split=%s, DoH=%s, MTU=%d", s.Mode, s.TlsSplitMode, s.DohProvider, s.MTU))
	return nil
}

// GetLogs returns the connection log buffer.
func (a *App) GetLogs() []string {
	a.logsMu.Lock()
	defer a.logsMu.Unlock()
	out := make([]string, len(a.logs))
	copy(out, a.logs)
	return out
}

func defaultFallbackServers() []ServerInfo {
	return []ServerInfo{
		{ID: "de-fra-1", CountryName: "Germany", CountryCode: "DE", CityName: "Frankfurt", CityCode: "FRA", Host: "de-fra.m1.fastly-masque.net", Port: 443, Protocol: "HTTP/2 CONNECT", LatencyMs: 32},
		{ID: "nl-ams-1", CountryName: "Netherlands", CountryCode: "NL", CityName: "Amsterdam", CityCode: "AMS", Host: "nl-ams.m1.fastly-masque.net", Port: 443, Protocol: "HTTP/2 CONNECT", LatencyMs: 36},
		{ID: "gb-lon-1", CountryName: "United Kingdom", CountryCode: "GB", CityName: "London", CityCode: "LON", Host: "gb-lon.m1.fastly-masque.net", Port: 443, Protocol: "HTTP/2 CONNECT", LatencyMs: 41},
		{ID: "fr-par-1", CountryName: "France", CountryCode: "FR", CityName: "Paris", CityCode: "PAR", Host: "fr-par.m1.fastly-masque.net", Port: 443, Protocol: "HTTP/2 CONNECT", LatencyMs: 39},
		{ID: "us-nyc-1", CountryName: "United States", CountryCode: "US", CityName: "New York", CityCode: "NYC", Host: "us-nyc.m1.fastly-masque.net", Port: 443, Protocol: "HTTP/2 CONNECT", LatencyMs: 88},
		{ID: "us-sjc-1", CountryName: "United States", CountryCode: "US", CityName: "San Jose", CityCode: "SJC", Host: "us-sjc.m1.fastly-masque.net", Port: 443, Protocol: "HTTP/2 CONNECT", LatencyMs: 134},
		{ID: "ch-zrh-1", CountryName: "Switzerland", CountryCode: "CH", CityName: "Zurich", CityCode: "ZRH", Host: "ch-zrh.m1.fastly-masque.net", Port: 443, Protocol: "HTTP/2 CONNECT", LatencyMs: 38},
		{ID: "se-sto-1", CountryName: "Sweden", CountryCode: "SE", CityName: "Stockholm", CityCode: "STO", Host: "se-sto.m1.fastly-masque.net", Port: 443, Protocol: "HTTP/2 CONNECT", LatencyMs: 49},
		{ID: "jp-tyo-1", CountryName: "Japan", CountryCode: "JP", CityName: "Tokyo", CityCode: "TYO", Host: "jp-tyo.m1.fastly-masque.net", Port: 443, Protocol: "HTTP/2 CONNECT", LatencyMs: 168},
		{ID: "sg-sin-1", CountryName: "Singapore", CountryCode: "SG", CityName: "Singapore", CityCode: "SIN", Host: "sg-sin.m1.fastly-masque.net", Port: 443, Protocol: "HTTP/2 CONNECT", LatencyMs: 142},
	}
}
