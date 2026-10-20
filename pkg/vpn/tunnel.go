package vpn

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/binary"
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
)

const (
	defaultWriteBufSize = 1 << 20 // 1 MB tunnel write buffer
	keepAliveInterval   = 15 * time.Second
	keepAliveTimeout    = 7 * time.Second
	defaultExitCheckURL = "https://www.cloudflare.com/cdn-cgi/trace"
)

// TunnelConfig configures the HTTP/2 upstream tunnel, local proxy, and Wintun adapter.
type TunnelConfig struct {
	EdgeHost       string `json:"edgeHost"`
	EdgePort       int    `json:"edgePort"`
	EdgeOverrideIP string `json:"edgeOverrideIp"`
	BearerToken    string `json:"bearerToken"`
	Mode           string `json:"mode"`         // "tun" | "proxy"
	TlsSplitMode   string `json:"tlsSplitMode"` // "off" | "tcp" | "record"
	DohProvider    string `json:"dohProvider"`  // "1.1.1.1" | "8.8.8.8" | "9.9.9.9"
	MTU            int    `json:"mtu"`
	KillSwitch     bool   `json:"killSwitch"`
	SocksListen    string `json:"socksListen"`
	HttpListen     string `json:"httpListen"`
}

// ExitCheckResult holds the verified public IP, country code, and latency through the tunnel.
type ExitCheckResult struct {
	IP          string `json:"ip"`
	CountryCode string `json:"countryCode"`
	LatencyMs   int64  `json:"latencyMs"`
	Verified    bool   `json:"verified"`
}

// Engine manages the active HTTP/2 session, local SOCKS5/HTTP listeners, Wintun adapter, and traffic telemetry.
type Engine struct {
	mu            sync.RWMutex
	cfg           TunnelConfig
	session       *H2Session
	socksListener net.Listener
	httpListener  net.Listener
	wintunAdapter *WintunController
	stopCh        chan struct{}
	running       atomic.Bool
	txBytes       atomic.Int64
	rxBytes       atomic.Int64
	lastPingMs    atomic.Int64
	connectedAt   time.Time
	exitInfo      ExitCheckResult
	logFunc       func(level, msg string)
}

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

// Start establishes the HTTP/2 session to the Fastly edge node and starts either Wintun TUN or System Proxy mode.
func (e *Engine) Start(ctx context.Context, cfg TunnelConfig) error {
	e.mu.Lock()
	if e.running.Load() {
		e.mu.Unlock()
		_ = e.Stop()
		e.mu.Lock()
	}
	if cfg.EdgePort == 0 {
		cfg.EdgePort = 443
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

	e.log("INFO", "Dialing Fastly HTTP/2 edge %s:%d (TLS Split: %s)...", cfg.EdgeHost, cfg.EdgePort, cfg.TlsSplitMode)
	dialStart := time.Now()
	sess, err := NewH2Session(cfg, &e.txBytes, &e.rxBytes, e.log)
	if err != nil {
		return fmt.Errorf("establishing HTTP/2 edge session: %w", err)
	}
	e.lastPingMs.Store(time.Since(dialStart).Milliseconds())

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

	if strings.EqualFold(cfg.Mode, "tun") {
		e.log("INFO", "Initializing Wintun virtual adapter 'FoxyVPN-Adapter' (MTU %d)...", cfg.MTU)
		wt, err := StartWintunAdapter(cfg, e)
		if err != nil {
			e.log("WARN", "Wintun initialization failed (%v); falling back to Windows System Proxy mode", err)
			if proxyErr := SetWindowsSystemProxy(cfg.HttpListen); proxyErr != nil {
				e.log("WARN", "Setting Windows WinINET proxy warning: %v", proxyErr)
			}
		} else {
			e.wintunAdapter = wt
			e.log("INFO", "Wintun adapter 'FoxyVPN-Adapter' active (IP 10.0.0.2/24, Gateway 10.0.0.1, DoH %s)", cfg.DohProvider)
		}
	} else {
		e.log("INFO", "Enabling Windows WinINET System Proxy -> %s", cfg.HttpListen)
		if err := SetWindowsSystemProxy(cfg.HttpListen); err != nil {
			e.log("WARN", "WinINET registry update warning: %v", err)
		}
	}

	e.connectedAt = time.Now()
	e.running.Store(true)

	// Perform non-fatal exit verification probe in background
	go func() {
		res, err := e.VerifyExit(10 * time.Second)
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
		e.log("INFO", "Closing Wintun adapter and restoring Windows default routes...")
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
	req.Header.Set("User-Agent", "foxyvpn-windows-exit-check/1.0")

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

func NewH2Session(cfg TunnelConfig, txCounter, rxCounter *atomic.Int64, logFn func(level, format string, args ...any)) (*H2Session, error) {
	targetHost := cfg.EdgeHost
	if cfg.EdgeOverrideIP != "" {
		targetHost = cfg.EdgeOverrideIP
	}
	dialAddr := net.JoinHostPort(targetHost, fmt.Sprintf("%d", cfg.EdgePort))

	dialer := &net.Dialer{Timeout: 15 * time.Second, KeepAlive: 30 * time.Second}
	rawTCP, err := dialer.Dial("tcp", dialAddr)
	if err != nil {
		return nil, err
	}

	// Wrap TCP socket with TLS ClientHello Splitter if anti-DPI fragmentation is enabled
	var baseConn net.Conn = rawTCP
	if cfg.TlsSplitMode == "tcp" || cfg.TlsSplitMode == "record" {
		baseConn = &tlsSplitConn{
			Conn: rawTCP,
			mode: cfg.TlsSplitMode,
		}
	}

	tlsConn := tls.Client(baseConn, &tls.Config{
		ServerName: cfg.EdgeHost,
		MinVersion: tls.VersionTLS12,
		NextProtos: []string{"h2"},
	})
	if err := tlsConn.SetDeadline(time.Now().Add(15 * time.Second)); err != nil {
		_ = rawTCP.Close()
		return nil, err
	}
	if err := tlsConn.Handshake(); err != nil {
		_ = rawTCP.Close()
		return nil, fmt.Errorf("TLS handshake with Fastly edge failed: %w", err)
	}
	_ = tlsConn.SetDeadline(time.Time{})

	if tlsConn.ConnectionState().NegotiatedProtocol != "h2" {
		_ = tlsConn.Close()
		return nil, errors.New("Fastly edge did not negotiate HTTP/2 (ALPN h2)")
	}

	tr := &http2.Transport{
		ReadIdleTimeout:  30 * time.Second,
		PingTimeout:      15 * time.Second,
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

// tlsSplitConn fragments the initial TLS ClientHello packet at the SNI midpoint to evade DPI filters.
type tlsSplitConn struct {
	net.Conn
	mode      string
	splitDone bool
}

func (c *tlsSplitConn) Write(b []byte) (int, error) {
	if c.splitDone || len(b) < 48 || b[0] != 0x16 || b[5] != 0x01 {
		return c.Conn.Write(b)
	}
	c.splitDone = true

	mid := len(b) / 2
	if c.mode == "record" && len(b) > 5 {
		payload := b[5:]
		if len(payload) > 16 {
			p1 := payload[:len(payload)/2]
			p2 := payload[len(payload)/2:]
			rec1 := make([]byte, 5+len(p1))
			copy(rec1[:3], b[:3])
			binary.BigEndian.PutUint16(rec1[3:5], uint16(len(p1)))
			copy(rec1[5:], p1)

			rec2 := make([]byte, 5+len(p2))
			copy(rec2[:3], b[:3])
			binary.BigEndian.PutUint16(rec2[3:5], uint16(len(p2)))
			copy(rec2[5:], p2)

			if _, err := c.Conn.Write(rec1); err != nil {
				return 0, err
			}
			if _, err := c.Conn.Write(rec2); err != nil {
				return 0, err
			}
			return len(b), nil
		}
	}

	// Default TCP segment split
	if _, err := c.Conn.Write(b[:mid]); err != nil {
		return 0, err
	}
	if _, err := c.Conn.Write(b[mid:]); err != nil {
		return mid, err
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
