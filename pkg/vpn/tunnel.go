package vpn

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/net/http2"
	"golang.org/x/net/proxy"
)

const (
	defaultExitCheckURL = "https://www.cloudflare.com/cdn-cgi/trace"
	keepAliveInterval   = 15 * time.Second
	keepAliveTimeout    = 15 * time.Second
)

// Fallback European/Regional Fastly MASQUE edge nodes (Port 2499) from Mozilla Remote Settings
// Fallback European/Regional Fastly MASQUE edge nodes (Port 2499) from Mozilla Remote Settings
// used automatically when the primary edge IP/host is filtered by the local ISP.
var fallbackEdgeHosts = []string{
	"muc139.m1.fastly-masque.net",  // Germany (Munich - 23.235.42.8)
	"ehrd229.m1.fastly-masque.net", // Netherlands (Rotterdam - 23.235.42.17)
	"vie63.m1.fastly-masque.net",   // Austria (Vienna - 23.235.42.31)
	"lfpb115.m1.fastly-masque.net", // France (Paris - 23.235.42.9)
	"bru148.m1.fastly-masque.net",  // Belgium (Brussels - 151.101.37.140)
	"eglc860.m1.fastly-masque.net", // UK (London - 151.101.17.209)
	"hel141.m1.fastly-masque.net",  // Finland (Helsinki - 151.101.112.88)
	"essb127.m1.fastly-masque.net", // Sweden (Stockholm - 151.101.85.77)
	"zrh.m1.fastly-masque.net",     // Switzerland (Zurich)
}

// Known clean Fastly Anycast IPs that serve *.m1.fastly-masque.net on port 2499
var cleanFastlyEdgeIPs = []string{
	"23.235.42.8",
	"23.235.42.17",
	"23.235.42.31",
	"23.235.42.9",
	"151.101.37.140",
	"151.101.17.209",
	"151.101.112.88",
	"151.101.85.77",
	"23.235.42.11",
}

// TunnelConfig configures the HTTP/2 CONNECT tunnel engine and Wintun/Proxy mode.
type TunnelConfig struct {
	EdgeHost       string // e.g., "muc139.m1.fastly-masque.net"
	EdgePort       int    // default 2499
	EdgeOverrideIP string // optional clean Fastly edge IP override
	BearerToken    string // short-lived Guardian ProxyPass JWT
	Mode           string // "tun" (Wintun + System Proxy) or "proxy" (SOCKS5 + WinINET)
	TlsSplitMode   string // "sni" (default) | "first-byte" | "off"
	DohProvider    string // "1.1.1.1" | "8.8.8.8" | "9.9.9.9"
	MTU            int    // default 1380
	KillSwitch     bool
	UpstreamProxy  string // optional socks5://127.0.0.1:10808 or http://127.0.0.1:7890
	SocksListen    string // default "127.0.0.1:1080"
	HttpListen     string // default "127.0.0.1:8080"
}

// ExitCheckResult holds the verified public exit IP and country code.
type ExitCheckResult struct {
	IP          string `json:"ip"`
	CountryCode string `json:"countryCode"`
	LatencyMs   int64  `json:"latencyMs"`
	Verified    bool   `json:"verified"`
}

// Engine manages the active HTTP/2 Fastly session, local SOCKS5/HTTP listeners, and Windows Wintun adapter.
type Engine struct {
	mu            sync.RWMutex
	cfg           TunnelConfig
	session       *H2Session
	socksListener net.Listener
	httpListener  net.Listener
	wintunAdapter *WintunController
	connectedAt   time.Time
	running       atomic.Bool
	txBytes       atomic.Int64
	rxBytes       atomic.Int64
	lastPingMs    atomic.Int64
	exitInfo      ExitCheckResult
	logFunc       func(level, msg string)
	stopCh        chan struct{}
}

// NewEngine creates a new VPN Tunnel Engine.
func NewEngine(logFn func(level, msg string)) *Engine {
	return &Engine{
		logFunc: logFn,
	}
}

func (e *Engine) log(level, format string, args ...any) {
	if e.logFunc != nil {
		e.logFunc(level, fmt.Sprintf(format, args...))
	}
}

// Start establishes the HTTP/2 session to the Fastly edge node and starts Wintun TUN + System Proxy mode.
func (e *Engine) Start(ctx context.Context, cfg TunnelConfig) error {
	e.mu.Lock()
	if e.running.Load() {
		e.mu.Unlock()
		_ = e.Stop()
		e.mu.Lock()
	}
	if cfg.EdgePort == 0 || cfg.EdgePort == 443 {
		// Mozilla Fastly MASQUE/CONNECT edge nodes listen on port 2499
		cfg.EdgePort = 2499
	}
	if cfg.SocksListen == "" {
		cfg.SocksListen = "127.0.0.1:1080"
	}
	if cfg.HttpListen == "" {
		cfg.HttpListen = "127.0.0.1:8080"
	}
	if cfg.MTU <= 0 {
		cfg.MTU = 1380
	}
	if cfg.DohProvider == "" {
		cfg.DohProvider = "1.1.1.1"
	}
	e.cfg = cfg
	e.stopCh = make(chan struct{})
	e.txBytes.Store(0)
	e.rxBytes.Store(0)
	e.exitInfo = ExitCheckResult{}
	e.mu.Unlock()

	dialStart := time.Now()
	sess, connectedHost, err := EstablishSmartH2Session(ctx, cfg, &e.txBytes, &e.rxBytes, e.log)
	if err != nil {
		return fmt.Errorf("establishing HTTP/2 edge session: %w", err)
	}
	e.lastPingMs.Store(time.Since(dialStart).Milliseconds())
	e.log("INFO", "Connected to Fastly HTTP/2 edge %s (%dms)", connectedHost, e.lastPingMs.Load())

	e.mu.Lock()
	e.session = sess
	e.mu.Unlock()

	// Start local SOCKS5 listener
	socksLn, err := net.Listen("tcp", cfg.SocksListen)
	if err != nil {
		_ = sess.Close()
		return fmt.Errorf("listening on SOCKS5 %s: %w", cfg.SocksListen, err)
	}
	e.socksListener = socksLn
	go e.acceptSOCKS5Loop(socksLn)
	e.log("INFO", "Local SOCKS5 server listening on %s", cfg.SocksListen)

	// Start local HTTP CONNECT proxy listener
	httpLn, err := net.Listen("tcp", cfg.HttpListen)
	if err != nil {
		_ = socksLn.Close()
		_ = sess.Close()
		return fmt.Errorf("listening on HTTP proxy %s: %w", cfg.HttpListen, err)
	}
	e.httpListener = httpLn
	go e.acceptHTTPProxyLoop(httpLn)
	e.log("INFO", "Local HTTP CONNECT proxy listening on %s", cfg.HttpListen)

	// Always enable Windows System Proxy (WinINET -> 127.0.0.1:8080) so browsers & apps tunnel traffic without routing loops
	if proxyErr := SetWindowsSystemProxy(cfg.HttpListen); proxyErr != nil {
		e.log("WARN", "Setting Windows WinINET proxy warning: %v", proxyErr)
	} else {
		e.log("INFO", "Enabled Windows System Proxy -> %s (SOCKS5 on %s)", cfg.HttpListen, cfg.SocksListen)
	}

	if strings.EqualFold(cfg.Mode, "tun") {
		e.log("INFO", "Initializing Wintun virtual adapter 'FoxyVPN-Adapter' (MTU %d)...", cfg.MTU)
		wt, err := StartWintunAdapter(cfg, e)
		if err != nil {
			e.log("WARN", "Wintun adapter note (%v); continuing with System Proxy + SOCKS5 tunnel", err)
		} else {
			e.wintunAdapter = wt
			e.log("INFO", "Wintun adapter 'FoxyVPN-Adapter' active (IP 10.0.0.2/24, DoH %s)", cfg.DohProvider)
		}
	}

	e.connectedAt = time.Now()
	e.running.Store(true)

	// Perform non-fatal exit verification probe in background
	go func() {
		res, err := e.VerifyExit(12 * time.Second)
		if err != nil {
			e.log("WARN", "Exit verification probe warning: %v", err)
			return
		}
		e.mu.Lock()
		e.exitInfo = res
		e.mu.Unlock()
		e.lastPingMs.Store(res.LatencyMs)
		e.log("INFO", "Exit verified: Public IP=%s Country=%s Latency=%dms", res.IP, res.CountryCode, res.LatencyMs)
	}()

	return nil
}

// UpdateToken hot-swaps the Guardian ProxyPass Bearer token on the active HTTP/2 session without dropping connections.
func (e *Engine) UpdateToken(newToken string) {
	e.mu.RLock()
	sess := e.session
	e.mu.RUnlock()
	if sess != nil {
		sess.UpdateToken(newToken)
		e.log("INFO", "Refreshed short-lived Guardian ProxyPass token on active HTTP/2 session")
	}
}

// Stop gracefully tears down Wintun routes, restores Windows System Proxy, and closes all HTTP/2 streams.
func (e *Engine) Stop() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.running.Swap(false) {
		return nil
	}
	if e.stopCh != nil {
		close(e.stopCh)
	}
	if e.wintunAdapter != nil {
		e.log("INFO", "Closing Wintun adapter...")
		_ = e.wintunAdapter.Close()
		e.wintunAdapter = nil
	}
	_ = ClearWindowsSystemProxy()
	if e.socksListener != nil {
		_ = e.socksListener.Close()
		e.socksListener = nil
	}
	if e.httpListener != nil {
		_ = e.httpListener.Close()
		e.httpListener = nil
	}
	if e.session != nil {
		_ = e.session.Close()
		e.session = nil
	}
	e.log("INFO", "Tunnel engine stopped and system network configuration restored")
	return nil
}

// Stats returns live byte counters, ping, uptime, and verified exit details.
func (e *Engine) Stats() (running bool, uptimeSec int64, tx, rx, pingMs int64, exit ExitCheckResult) {
	running = e.running.Load()
	if running && !e.connectedAt.IsZero() {
		uptimeSec = int64(time.Since(e.connectedAt).Seconds())
	}
	tx = e.txBytes.Load()
	rx = e.rxBytes.Load()
	pingMs = e.lastPingMs.Load()
	e.mu.RLock()
	exit = e.exitInfo
	e.mu.RUnlock()
	return
}

// OpenTunnel opens a multiplexed HTTP/2 CONNECT stream to authority ("host:port").
func (e *Engine) OpenTunnel(authority string) (net.Conn, error) {
	e.mu.RLock()
	sess := e.session
	e.mu.RUnlock()
	if sess == nil {
		return nil, errors.New("no active HTTP/2 session")
	}
	return sess.OpenTunnel(authority)
}

// ResolveDNSOverHTTPS sends a raw DNS wire-format query over the HTTP/2 tunnel to the configured DoH provider.
func (e *Engine) ResolveDNSOverHTTPS(dnsQuery []byte) ([]byte, error) {
	e.mu.RLock()
	dohHost := e.cfg.DohProvider
	e.mu.RUnlock()
	if dohHost == "" {
		dohHost = "1.1.1.1"
	}

	dohURL := fmt.Sprintf("https://%s/dns-query", dohHost)
	transport := &http.Transport{
		DisableKeepAlives: true,
		TLSClientConfig:   &tls.Config{MinVersion: tls.VersionTLS12},
		DialContext: func(ctx context.Context, _, addr string) (net.Conn, error) {
			return e.OpenTunnel(addr)
		},
	}
	client := &http.Client{
		Transport: transport,
		Timeout:   6 * time.Second,
	}
	req, err := http.NewRequest(http.MethodPost, dohURL, bytes.NewReader(dnsQuery))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/dns-message")
	req.Header.Set("Accept", "application/dns-message")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("DoH responder %s returned HTTP %d", dohHost, resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 4096))
}

// VerifyExit probes Cloudflare trace through the active HTTP/2 tunnel to verify exit IP and country.
func (e *Engine) VerifyExit(timeout time.Duration) (ExitCheckResult, error) {
	transport := &http.Transport{
		DisableKeepAlives: true,
		TLSClientConfig:   &tls.Config{MinVersion: tls.VersionTLS12},
		DialContext: func(ctx context.Context, _, authority string) (net.Conn, error) {
			return e.OpenTunnel(authority)
		},
	}
	client := &http.Client{
		Transport: transport,
		Timeout:   timeout,
	}
	req, err := http.NewRequest(http.MethodGet, defaultExitCheckURL, nil)
	if err != nil {
		return ExitCheckResult{}, err
	}
	req.Header.Set("User-Agent", "foxyvpn-windows-exit-check/1.2")

	start := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		return ExitCheckResult{}, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
	latency := time.Since(start).Milliseconds()

	var ip, loc string
	for _, line := range strings.Split(string(body), "\n") {
		k, v, ok := strings.Cut(strings.TrimSpace(line), "=")
		if !ok {
			continue
		}
		switch strings.ToLower(k) {
		case "ip":
			ip = v
		case "loc":
			loc = strings.ToUpper(v)
		}
	}
	if ip == "" {
		return ExitCheckResult{}, errors.New("exit check did not return a valid IP")
	}
	return ExitCheckResult{
		IP:          ip,
		CountryCode: loc,
		LatencyMs:   latency,
		Verified:    true,
	}, nil
}

// resolveEdgeIPViaDoH queries Cloudflare/Quad9/Google DoH (JSON/Wire) to bypass local ISP DNS poisoning.
func resolveEdgeIPViaDoH(ctx context.Context, hostname string) string {
	endpoints := []string{
		"https://1.1.1.1/dns-query?name=" + url.QueryEscape(hostname) + "&type=A",
		"https://9.9.9.9:5053/dns-query?name=" + url.QueryEscape(hostname) + "&type=A",
		"https://8.8.8.8/resolve?name=" + url.QueryEscape(hostname) + "&type=A",
	}
	client := &http.Client{
		Timeout: 3500 * time.Millisecond,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				MinVersion:       tls.VersionTLS12,
				CurvePreferences: []tls.CurveID{tls.X25519, tls.CurveP256},
			},
		},
	}

	type dohAnswer struct {
		Type int    `json:"type"`
		Data string `json:"data"`
	}
	type dohResp struct {
		Answer []dohAnswer `json:"Answer"`
	}

	resCh := make(chan string, len(endpoints))
	for _, ep := range endpoints {
		go func(u string) {
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
			if err != nil {
				resCh <- ""
				return
			}
			req.Header.Set("Accept", "application/dns-json")
			resp, err := client.Do(req)
			if err != nil {
				resCh <- ""
				return
			}
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				resCh <- ""
				return
			}
			var parsed dohResp
			if err := json.NewDecoder(io.LimitReader(resp.Body, 8192)).Decode(&parsed); err == nil {
				for _, ans := range parsed.Answer {
					if ans.Type == 1 && net.ParseIP(ans.Data) != nil {
						resCh <- ans.Data
						return
					}
				}
			}
			resCh <- ""
		}(ep)
	}

	for i := 0; i < len(endpoints); i++ {
		if ip := <-resCh; ip != "" {
			return ip
		}
	}
	return ""
}

// H2Session manages a persistent TLS + HTTP/2 connection to a Fastly edge server.
type H2Session struct {
	raw           net.Conn
	cc            *http2.ClientConn
	proxyHost     string
	token         string
	tokenMu       sync.RWMutex
	alive         atomic.Bool
	stopKeepAlive context.CancelFunc
	txBytes       *atomic.Int64
	rxBytes       *atomic.Int64
	logFunc       func(level, format string, args ...any)
}

type edgeCandidate struct {
	sniHost   string
	dialIP    string
	port      int
	splitMode string
}

// EstablishSmartH2Session races/rotates across SNI split modes, DoH-resolved IPs, and regional Fastly edges
// so connections succeed directly without needing an external VPN even on DPI-filtered ISPs.
func EstablishSmartH2Session(
	ctx context.Context,
	cfg TunnelConfig,
	txCounter, rxCounter *atomic.Int64,
	logFn func(level, format string, args ...any),
) (*H2Session, string, error) {
	primaryHost := cfg.EdgeHost
	if primaryHost == "" || primaryHost == "p.m1.fastly-masque.net" {
		primaryHost = "muc139.m1.fastly-masque.net"
	}
	port := cfg.EdgePort
	if port == 0 || port == 443 {
		port = 2499
	}

	splitMode := strings.ToLower(cfg.TlsSplitMode)
	if splitMode == "" || splitMode == "record" || splitMode == "sni-record" || splitMode == "tcp" {
		splitMode = "sni" // True SNI 3-segment TCP fragmentation matching Vauth/FoxyVPN
	}

	// Resolve primary host via DoH first to avoid poisoned local ISP DNS
	dohCtx, dohCancel := context.WithTimeout(ctx, 3500*time.Millisecond)
	dohIP := cfg.EdgeOverrideIP
	if dohIP == "" {
		dohIP = resolveEdgeIPViaDoH(dohCtx, primaryHost)
	}
	dohCancel()

	var candidates []edgeCandidate
	// Candidate 1: Primary host with DoH IP or override IP
	if dohIP != "" {
		candidates = append(candidates, edgeCandidate{
			sniHost:   primaryHost,
			dialIP:    dohIP,
			port:      port,
			splitMode: splitMode,
		})
	}

	// Candidates 2..N: Try known clean Fastly Anycast IPs for primary host
	for _, ip := range cleanFastlyEdgeIPs {
		if ip != dohIP {
			candidates = append(candidates, edgeCandidate{
				sniHost:   primaryHost,
				dialIP:    ip,
				port:      port,
				splitMode: splitMode,
			})
		}
	}

	// Candidates N+1: Fallback regional Fastly edge hosts (Munich, Rotterdam, Vienna, Paris, Brussels)
	for _, h := range fallbackEdgeHosts {
		if !strings.EqualFold(h, primaryHost) {
			candidates = append(candidates, edgeCandidate{
				sniHost:   h,
				dialIP:    "",
				port:      port,
				splitMode: "sni",
			})
		}
	}

	// Fallback split mode attempts
	candidates = append(candidates,
		edgeCandidate{sniHost: primaryHost, dialIP: dohIP, port: port, splitMode: "first-byte"},
		edgeCandidate{sniHost: primaryHost, dialIP: dohIP, port: port, splitMode: "off"},
	)

	var lastErr error
	maxAttempts := 7
	if len(candidates) < maxAttempts {
		maxAttempts = len(candidates)
	}

	for i := 0; i < maxAttempts; i++ {
		cand := candidates[i]
		targetDisplay := cand.sniHost
		if cand.dialIP != "" {
			targetDisplay = fmt.Sprintf("%s [%s]", cand.sniHost, cand.dialIP)
		}
		logFn("INFO", "Dialing Fastly edge %s:%d (Anti-DPI: %s, attempt %d/%d)...",
			targetDisplay, cand.port, cand.splitMode, i+1, maxAttempts)

		singleCfg := cfg
		singleCfg.EdgeHost = cand.sniHost
		singleCfg.EdgeOverrideIP = cand.dialIP
		singleCfg.EdgePort = cand.port
		singleCfg.TlsSplitMode = cand.splitMode

		// 3.8s dial timeout per attempt for fast failover
		sess, err := dialSingleH2Session(singleCfg, txCounter, rxCounter, logFn, 3800*time.Millisecond)
		if err == nil {
			return sess, fmt.Sprintf("%s:%d", cand.sniHost, cand.port), nil
		}
		lastErr = err
		logFn("WARN", "Edge attempt %d (%s:%d, %s) failed: %v", i+1, cand.sniHost, cand.port, cand.splitMode, err)
	}

	return nil, "", lastErr
}

func dialSingleH2Session(
	cfg TunnelConfig,
	txCounter, rxCounter *atomic.Int64,
	logFn func(level, format string, args ...any),
	timeout time.Duration,
) (*H2Session, error) {
	targetHost := cfg.EdgeHost
	if cfg.EdgeOverrideIP != "" {
		targetHost = cfg.EdgeOverrideIP
	}
	dialAddr := net.JoinHostPort(targetHost, fmt.Sprintf("%d", cfg.EdgePort))

	var rawTCP net.Conn
	var err error

	// Support optional upstream proxy (e.g. SOCKS5 127.0.0.1:10808)
	if cfg.UpstreamProxy != "" {
		if u, parseErr := url.Parse(cfg.UpstreamProxy); parseErr == nil && strings.HasPrefix(u.Scheme, "socks5") {
			dialer, dErr := proxy.SOCKS5("tcp", u.Host, nil, &net.Dialer{Timeout: timeout})
			if dErr == nil {
				rawTCP, err = dialer.Dial("tcp", dialAddr)
			}
		}
	}

	if rawTCP == nil {
		dialer := &net.Dialer{Timeout: timeout, KeepAlive: 20 * time.Second}
		rawTCP, err = dialer.Dial("tcp", dialAddr)
		if err != nil {
			return nil, err
		}
	}

	if tcpConn, ok := rawTCP.(*net.TCPConn); ok {
		// Disable Nagle's algorithm so split ClientHello segments are transmitted in separate TCP packets immediately
		_ = tcpConn.SetNoDelay(true)
	}

	var baseConn net.Conn = rawTCP
	if cfg.TlsSplitMode != "" && cfg.TlsSplitMode != "off" {
		baseConn = &tlsSplitConn{
			Conn: rawTCP,
			mode: cfg.TlsSplitMode,
		}
	}

	tlsConn := tls.Client(baseConn, &tls.Config{
		ServerName: cfg.EdgeHost,
		MinVersion: tls.VersionTLS12,
		NextProtos: []string{"h2"},
		// Keep ClientHello compact (~300 bytes) by avoiding 1200-byte post-quantum X25519MLKEM768 key share
		CurvePreferences: []tls.CurveID{tls.X25519, tls.CurveP256},
	})
	if err := tlsConn.SetDeadline(time.Now().Add(timeout)); err != nil {
		_ = rawTCP.Close()
		return nil, err
	}
	if err := tlsConn.Handshake(); err != nil {
		_ = rawTCP.Close()
		return nil, fmt.Errorf("TLS handshake failed: %w", err)
	}
	_ = tlsConn.SetDeadline(time.Time{})

	if tlsConn.ConnectionState().NegotiatedProtocol != "h2" {
		_ = tlsConn.Close()
		return nil, errors.New("Fastly edge did not negotiate HTTP/2 (ALPN h2)")
	}

	tr := &http2.Transport{
		ReadIdleTimeout:  20 * time.Second,
		PingTimeout:      12 * time.Second,
		WriteByteTimeout: 30 * time.Second,
	}
	cc, err := tr.NewClientConn(tlsConn)
	if err != nil {
		_ = tlsConn.Close()
		return nil, err
	}

	ctx, cancel := context.WithCancel(context.Background())
	sess := &H2Session{
		raw:           tlsConn,
		cc:            cc,
		proxyHost:     net.JoinHostPort(cfg.EdgeHost, fmt.Sprintf("%d", cfg.EdgePort)),
		token:         cfg.BearerToken,
		stopKeepAlive: cancel,
		txBytes:       txCounter,
		rxBytes:       rxCounter,
		logFunc:       logFn,
	}
	sess.alive.Store(true)
	go sess.keepAliveLoop(ctx)
	return sess, nil
}

func (s *H2Session) keepAliveLoop(ctx context.Context) {
	ticker := time.NewTicker(keepAliveInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			pingCtx, cancel := context.WithTimeout(ctx, keepAliveTimeout)
			err := s.cc.Ping(pingCtx)
			cancel()
			if err != nil {
				s.alive.Store(false)
				return
			}
		}
	}
}

func (s *H2Session) UpdateToken(token string) {
	s.tokenMu.Lock()
	s.token = token
	s.tokenMu.Unlock()
}

func (s *H2Session) getToken() string {
	s.tokenMu.RLock()
	defer s.tokenMu.RUnlock()
	return s.token
}

func (s *H2Session) OpenTunnel(authority string) (net.Conn, error) {
	if !s.alive.Load() || !s.cc.CanTakeNewRequest() {
		return nil, errors.New("HTTP/2 upstream session is closed or saturated")
	}

	pr, pw := io.Pipe()
	ctx, cancel := context.WithCancel(context.Background())

	req, err := http.NewRequestWithContext(ctx, http.MethodConnect, "http://"+authority, pr)
	if err != nil {
		cancel()
		return nil, err
	}
	req.Host = authority
	req.URL.Host = s.proxyHost
	req.Header.Set("Proxy-Authorization", "Bearer "+s.getToken())

	resp, err := s.cc.RoundTrip(req)
	if err != nil {
		cancel()
		_ = pw.Close()
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		cancel()
		_ = pw.Close()
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		_ = resp.Body.Close()
		return nil, fmt.Errorf("Fastly HTTP/2 CONNECT %s returned %d: %s", authority, resp.StatusCode, strings.TrimSpace(string(body)))
	}

	return &h2StreamConn{
		reader:  resp.Body,
		writer:  pw,
		cancel:  cancel,
		txBytes: s.txBytes,
		rxBytes: s.rxBytes,
	}, nil
}

func (s *H2Session) Close() error {
	s.alive.Store(false)
	if s.stopKeepAlive != nil {
		s.stopKeepAlive()
	}
	if s.cc != nil {
		_ = s.cc.Close()
	}
	if s.raw != nil {
		return s.raw.Close()
	}
	return nil
}

type h2StreamConn struct {
	reader  io.ReadCloser
	writer  *io.PipeWriter
	cancel  context.CancelFunc
	txBytes *atomic.Int64
	rxBytes *atomic.Int64
}

func (c *h2StreamConn) Read(b []byte) (int, error) {
	n, err := c.reader.Read(b)
	if n > 0 && c.rxBytes != nil {
		c.rxBytes.Add(int64(n))
	}
	return n, err
}

func (c *h2StreamConn) Write(b []byte) (int, error) {
	n, err := c.writer.Write(b)
	if n > 0 && c.txBytes != nil {
		c.txBytes.Add(int64(n))
	}
	return n, err
}

func (c *h2StreamConn) Close() error {
	c.cancel()
	_ = c.writer.Close()
	return c.reader.Close()
}

func (c *h2StreamConn) LocalAddr() net.Addr                { return &net.TCPAddr{IP: net.IPv4(10, 0, 0, 2), Port: 0} }
func (c *h2StreamConn) RemoteAddr() net.Addr               { return &net.TCPAddr{IP: net.IPv4(10, 0, 0, 1), Port: 443} }
func (c *h2StreamConn) SetDeadline(t time.Time) error      { return nil }
func (c *h2StreamConn) SetReadDeadline(t time.Time) error  { return nil }
func (c *h2StreamConn) SetWriteDeadline(t time.Time) error { return nil }

// findSNIOffset locates the exact start and end byte offsets of the SNI hostname inside a TLS ClientHello record.
// Ported directly from Vauth/FoxyVPN's TlsClientHelloSplitter.kt.
func findSNIOffset(b []byte) (start int, end int, ok bool) {
	if len(b) < 44 || b[0] != 0x16 || b[5] != 0x01 {
		return 0, 0, false
	}
	curr := 5 + 4 + 2 + 32 // skip record header(5) + handshake header(4) + version(2) + random(32)
	if curr >= len(b) {
		return 0, 0, false
	}
	sessionIDLen := int(b[curr])
	curr += 1 + sessionIDLen
	if curr+2 > len(b) {
		return 0, 0, false
	}
	cipherSuitesLen := int(binary.BigEndian.Uint16(b[curr : curr+2]))
	curr += 2 + cipherSuitesLen
	if curr >= len(b) {
		return 0, 0, false
	}
	compMethodsLen := int(b[curr])
	curr += 1 + compMethodsLen
	if curr+2 > len(b) {
		return 0, 0, false
	}
	extTotalLen := int(binary.BigEndian.Uint16(b[curr : curr+2]))
	curr += 2
	extEnd := curr + extTotalLen
	if extEnd > len(b) {
		extEnd = len(b)
	}

	for curr+4 <= extEnd {
		extType := binary.BigEndian.Uint16(b[curr : curr+2])
		extLen := int(binary.BigEndian.Uint16(b[curr+2 : curr+4]))
		body := curr + 4
		if body+extLen > extEnd {
			return 0, 0, false
		}
		if extType == 0x0000 { // server_name extension
			if extLen < 5 {
				return 0, 0, false
			}
			listLen := int(binary.BigEndian.Uint16(b[body : body+2]))
			listPos := body + 2
			if listPos+listLen > body+extLen || b[listPos] != 0x00 {
				return 0, 0, false
			}
			nameLen := int(binary.BigEndian.Uint16(b[listPos+1 : listPos+3]))
			s := listPos + 3
			e := s + nameLen
			if e > listPos+listLen || e > len(b) || s >= e {
				return 0, 0, false
			}
			return s, e, true
		}
		curr = body + extLen
	}
	return 0, 0, false
}

// tlsSplitConn fragments the initial TLS ClientHello packet right inside the SNI hostname to defeat ISP DPI.
type tlsSplitConn struct {
	net.Conn
	mode      string
	splitDone bool
}

func (c *tlsSplitConn) Write(b []byte) (int, error) {
	if c.splitDone || len(b) < 44 || b[0] != 0x16 || b[5] != 0x01 {
		return c.Conn.Write(b)
	}
	c.splitDone = true

	// First byte mode: splits 0x16 record header byte
	if c.mode == "first-byte" {
		if _, err := c.Conn.Write(b[:1]); err != nil {
			return 0, err
		}
		time.Sleep(2 * time.Millisecond)
		if _, err := c.Conn.Write(b[1:]); err != nil {
			return 1, err
		}
		return len(b), nil
	}

	// Default "sni" mode (Exact match to Vauth/FoxyVPN TlsClientHelloSplitter.kt SNI mode):
	// Splits the TLS ClientHello across 3 separate TCP segments:
	// 1. [0 .. sniStart] (record header + handshake up to start of SNI hostname)
	// 2. [sniStart .. sniStart+1] (exactly 1 character of SNI hostname)
	// 3. [sniStart+1 .. end] (rest of SNI hostname + extensions)
	// Delivered with TCP_NODELAY so each segment travels in its own TCP packet, defeating ISP DPI inspection without invalidating TLS record structure.
	sniStart, _, foundSNI := findSNIOffset(b)
	if foundSNI && sniStart > 0 && sniStart+1 < len(b) {
		if _, err := c.Conn.Write(b[:sniStart]); err != nil {
			return 0, err
		}
		time.Sleep(2 * time.Millisecond)
		if _, err := c.Conn.Write(b[sniStart : sniStart+1]); err != nil {
			return sniStart, err
		}
		time.Sleep(2 * time.Millisecond)
		if _, err := c.Conn.Write(b[sniStart+1:]); err != nil {
			return sniStart + 1, err
		}
		return len(b), nil
	}

	// Fallback 2-segment split if SNI offset couldn't be parsed
	splitPos := len(b) / 2
	if _, err := c.Conn.Write(b[:splitPos]); err != nil {
		return 0, err
	}
	time.Sleep(2 * time.Millisecond)
	if _, err := c.Conn.Write(b[splitPos:]); err != nil {
		return splitPos, err
	}
	return len(b), nil
}

// SOCKS5 & HTTP Proxy Listeners
func (e *Engine) acceptSOCKS5Loop(ln net.Listener) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		go e.handleSOCKS5Conn(conn)
	}
}

func (e *Engine) handleSOCKS5Conn(conn net.Conn) {
	defer conn.Close()
	buf := make([]byte, 262)
	if _, err := io.ReadFull(conn, buf[:2]); err != nil || buf[0] != 0x05 {
		return
	}
	nMethods := int(buf[1])
	if _, err := io.ReadFull(conn, buf[:nMethods]); err != nil {
		return
	}
	_, _ = conn.Write([]byte{0x05, 0x00}) // No auth

	if _, err := io.ReadFull(conn, buf[:4]); err != nil || buf[0] != 0x05 {
		return
	}
	cmd := buf[1]
	atyp := buf[3]
	if cmd != 0x01 { // Only CONNECT
		_, _ = conn.Write([]byte{0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0})
		return
	}

	var host string
	switch atyp {
	case 0x01:
		if _, err := io.ReadFull(conn, buf[:4]); err != nil {
			return
		}
		host = net.IP(buf[:4]).String()
	case 0x03:
		if _, err := io.ReadFull(conn, buf[:1]); err != nil {
			return
		}
		dLen := int(buf[0])
		if _, err := io.ReadFull(conn, buf[:dLen]); err != nil {
			return
		}
		host = string(buf[:dLen])
	case 0x04:
		if _, err := io.ReadFull(conn, buf[:16]); err != nil {
			return
		}
		host = net.IP(buf[:16]).String()
	default:
		return
	}

	if _, err := io.ReadFull(conn, buf[:2]); err != nil {
		return
	}
	port := binary.BigEndian.Uint16(buf[:2])
	authority := net.JoinHostPort(host, fmt.Sprintf("%d", port))

	upstream, err := e.OpenTunnel(authority)
	if err != nil {
		_, _ = conn.Write([]byte{0x05, 0x04, 0x00, 0x01, 0, 0, 0, 0, 0, 0})
		return
	}
	defer upstream.Close()

	_, _ = conn.Write([]byte{0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0})
	pipeBidirectional(conn, upstream)
}

func (e *Engine) acceptHTTPProxyLoop(ln net.Listener) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		go e.handleHTTPProxyConn(conn)
	}
}

func (e *Engine) handleHTTPProxyConn(conn net.Conn) {
	defer conn.Close()
	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	if err != nil || n == 0 {
		return
	}
	reqText := string(buf[:n])
	firstLine, _, _ := strings.Cut(reqText, "\r\n")
	parts := strings.Fields(firstLine)
	if len(parts) < 2 {
		return
	}
	method := strings.ToUpper(parts[0])
	target := parts[1]

	if method == http.MethodConnect {
		if !strings.Contains(target, ":") {
			target += ":443"
		}
		upstream, err := e.OpenTunnel(target)
		if err != nil {
			_, _ = conn.Write([]byte("HTTP/1.1 502 Bad Gateway\r\n\r\n"))
			return
		}
		defer upstream.Close()
		_, _ = conn.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n"))
		pipeBidirectional(conn, upstream)
		return
	}

	u, err := url.Parse(target)
	if err != nil || u.Host == "" {
		return
	}
	authority := u.Host
	if u.Port() == "" {
		authority = net.JoinHostPort(u.Hostname(), "80")
	}
	upstream, err := e.OpenTunnel(authority)
	if err != nil {
		return
	}
	defer upstream.Close()
	_, _ = upstream.Write(buf[:n])
	pipeBidirectional(conn, upstream)
}

func pipeBidirectional(a, b net.Conn) {
	done := make(chan struct{}, 2)
	go func() {
		_, _ = io.Copy(a, b)
		done <- struct{}{}
	}()
	go func() {
		_, _ = io.Copy(b, a)
		done <- struct{}{}
	}()
	<-done
}
