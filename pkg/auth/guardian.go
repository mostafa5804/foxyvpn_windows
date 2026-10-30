package auth

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/hkdf"
	"golang.org/x/crypto/pbkdf2"
	"golang.org/x/net/proxy"
)

const (
	FxaAuthServer           = "https://api.accounts.firefox.com/v1"
	FirefoxClientID         = "5882386c6d801776"
	OAuthScope              = "profile https://identity.mozilla.com/apps/vpn"
	GuardianEndpointDefault = "https://vpn.mozilla.org"
	RemoteSettingsURL       = "https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/vpn-serverlist/records"
	MozillaVPNUserAgent     = "MozillaVPN/2.35.0 (sys:windows; iap:true)"
	SolverUserAgent         = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0"

	protocolVersion            = "identity.mozilla.com/picl/v1/"
	pbkdf2Rounds               = 1000
	stretchedPWLen             = 32
	hkdfLen                    = 32
	maxChallengeAttempts       = 6
	maxPostBackRounds          = 6
	fxaCallMinBudget           = 90 * time.Second
	controlPlaneHTTPTimeout    = 30 * time.Second
	verificationMethodEmail2FA = "email-2fa"
	fxaErrnoInvalidParameter   = 107
	AccountBinRelPath          = "data/account.bin"
	legacyTokenFileName        = ".foxyvpn-tokens.json"
	binaryFileMagic            = "FOXYBIN1"
	DefaultMonthlyAllowance    = int64(50) * 1024 * 1024 * 1024 // 50 GB
)

var (
	ErrTokenInvalid      = errors.New("access token was rejected by Guardian (401/403)")
	ErrQuotaExceeded     = errors.New("monthly 50 GB VPN quota exceeded (429)")
	ErrVerificationNeede = errors.New("email 6-digit verification code required")

	challengePrefixRegex = regexp.MustCompile(`/_fs-ch-[A-Za-z0-9._-]+`)
	initCallRegex        = regexp.MustCompile(`init\(\s*(\[[\s\S]*?\])\s*,\s*["']([^"']+)["']`)
	powAlphabet          = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
)

// LoginResponse represents the FxA /account/login or /account/create response.
type LoginResponse struct {
	UID                string `json:"uid"`
	SessionToken       string `json:"sessionToken"`
	Verified           bool   `json:"verified"`
	AuthAt             int64  `json:"authAt"`
	VerificationMethod string `json:"verificationMethod,omitempty"`
	VerificationReason string `json:"verificationReason,omitempty"`
}

// TokenResponse represents the FxA /oauth/token response.
type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
	TokenType    string `json:"token_type"`
}

// PoolAccountRecord represents an authenticated Firefox Account stored inside data/account.bin.
type PoolAccountRecord struct {
	ID                  string `json:"id"`
	Email               string `json:"email"`
	UID                 string `json:"uid"`
	SessionToken        string `json:"session_token"`
	AccessToken         string `json:"access_token,omitempty"`
	QuotaGB             int    `json:"quota_gb"`
	QuotaRemainingBytes int64  `json:"quota_remaining_bytes,omitempty"`
	Active              bool   `json:"active"`
	AddedAt             string `json:"added_at"`
}

// SavedTokens persists encrypted OAuth, session, and multi-account pool credentials inside data/account.bin.
type SavedTokens struct {
	Email               string              `json:"email"`
	UID                 string              `json:"uid"`
	SessionToken        string              `json:"session_token,omitempty"`
	AccessToken         string              `json:"access_token"`
	RefreshToken        string              `json:"refresh_token"`
	Scope               string              `json:"scope"`
	ObtainedAt          time.Time           `json:"obtained_at"`
	ExpiresIn           int                 `json:"expires_in"`
	QuotaMaxBytes       int64               `json:"quota_max_bytes,omitempty"`
	QuotaRemainingBytes int64               `json:"quota_remaining_bytes,omitempty"`
	TokenPool           []string            `json:"token_pool,omitempty"`
	PoolAccounts        []PoolAccountRecord `json:"pool_accounts,omitempty"`
}

func (s *SavedTokens) AccessTokenValid() bool {
	if s == nil || s.AccessToken == "" {
		return false
	}
	expiry := s.ObtainedAt.Add(time.Duration(s.ExpiresIn) * time.Second)
	return time.Now().Before(expiry.Add(-60 * time.Second))
}

// Entitlement represents the user's Guardian FPN status.
type Entitlement struct {
	Subscribed       bool   `json:"subscribed"`
	UID              string `json:"uid"`
	MaxBytes         int64  `json:"maxBytes"`
	LimitedBandwidth bool   `json:"limited_bandwidth"`
	QuotaRemaining   int64  `json:"quotaRemaining"`
	HasLiveQuota     bool   `json:"hasLiveQuota,omitempty"`
	QuotaReset       int64  `json:"quotaReset"`
}

// ProxyPassInfo holds the short-lived JWT Bearer token for Fastly HTTP/2 CONNECT.
type ProxyPassInfo struct {
	Token          string `json:"token"`
	ExpiresAt      int64  `json:"expires_at"`
	QuotaMax       int64  `json:"quota_max"`
	QuotaRemaining int64  `json:"quota_remaining"`
	HasLiveQuota   bool   `json:"has_live_quota,omitempty"`
	QuotaReset     int64  `json:"quota_reset"`
}

// Protocol describes a server's tunneling endpoint (connect or masque).
type Protocol struct {
	Name           string `json:"name"`
	Host           string `json:"host"`
	Port           int    `json:"port"`
	Scheme         string `json:"scheme,omitempty"`
	TemplateString string `json:"templateString,omitempty"`
}

// ServerNode represents an individual Fastly edge host inside a city.
type ServerNode struct {
	Hostname    string     `json:"hostname"`
	Port        int        `json:"port"`
	Quarantined bool       `json:"quarantined"`
	Protocols   []Protocol `json:"protocols"`
}

// City groups servers inside a country.
type City struct {
	Name    string       `json:"name"`
	Code    string       `json:"code"`
	Servers []ServerNode `json:"servers"`
}

// Country represents a country record from Mozilla Remote Settings.
type Country struct {
	Name   string `json:"name"`
	Code   string `json:"code"`
	Cities []City `json:"cities"`
}

// FxaAPIError wraps an error response from Firefox Accounts API.
type FxaAPIError struct {
	Status  int    `json:"status"`
	Code    int    `json:"code"`
	Errno   int    `json:"errno"`
	ErrorMsg string `json:"error"`
	Message string `json:"message"`
}

func (e *FxaAPIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("FxA error (HTTP %d, errno %d): %s", e.Status, e.Errno, e.Message)
	}
	return fmt.Sprintf("FxA request failed (HTTP %d)", e.Status)
}

// GuardianService manages FxA authentication, Fastly challenge solving, Guardian tokens, and Server lists.
type GuardianService struct {
	mu              sync.RWMutex
	httpClient      *http.Client
	cookieJar       http.CookieJar
	guardianBaseURL string
	pendingSession  *pendingVerification
	savedTokens     *SavedTokens
	tokenPool       []string
	poolIndex       int
	logFunc         func(level, msg string)
}

type pendingVerification struct {
	Email        string
	UID          string
	SessionToken string
	IsSignUp     bool
}

// NewGuardianService creates a configured authentication & Guardian service.
func NewGuardianService(logFn func(level, msg string)) *GuardianService {
	jar, _ := cookiejar.New(nil)
	client := &http.Client{
		Timeout: controlPlaneHTTPTimeout,
		Jar:     jar,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12},
		},
	}
	svc := &GuardianService{
		httpClient:      client,
		cookieJar:       jar,
		guardianBaseURL: GuardianEndpointDefault,
		logFunc:         logFn,
	}
	if saved, err := svc.LoadTokens(); err == nil {
		svc.savedTokens = saved
	}
	return svc
}

func (g *GuardianService) log(level, format string, args ...any) {
	if g.logFunc != nil {
		g.logFunc(level, fmt.Sprintf(format, args...))
	}
}

// SetControlPlaneProxy configures an optional HTTP/HTTPS/SOCKS5 proxy for FxA & Guardian API requests.
func (g *GuardianService) SetControlPlaneProxy(rawProxyURL string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	rawProxyURL = strings.TrimSpace(rawProxyURL)
	if rawProxyURL == "" {
		g.httpClient.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12},
		}
		g.log("INFO", "Control-plane proxy cleared (using direct connection)")
		return nil
	}
	if !strings.Contains(rawProxyURL, "://") {
		rawProxyURL = "http://" + rawProxyURL
	}
	parsed, err := url.Parse(rawProxyURL)
	if err != nil {
		return fmt.Errorf("invalid proxy URL: %w", err)
	}

	dialer := &net.Dialer{Timeout: 20 * time.Second}
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12},
	}

	switch strings.ToLower(parsed.Scheme) {
	case "http", "https":
		transport.Proxy = http.ProxyURL(parsed)
		transport.DialContext = dialer.DialContext
	case "socks5", "socks5h":
		var auth *proxy.Auth
		if parsed.User != nil {
			pw, _ := parsed.User.Password()
			auth = &proxy.Auth{User: parsed.User.Username(), Password: pw}
		}
		socksDialer, err := proxy.SOCKS5("tcp", parsed.Host, auth, dialer)
		if err != nil {
			return fmt.Errorf("creating SOCKS5 dialer: %w", err)
		}
		if ctxDialer, ok := socksDialer.(proxy.ContextDialer); ok {
			transport.DialContext = ctxDialer.DialContext
		} else {
			return errors.New("SOCKS5 dialer does not support context")
		}
	default:
		return fmt.Errorf("unsupported proxy scheme %q", parsed.Scheme)
	}

	g.httpClient.Transport = transport
	g.log("INFO", "Control-plane API routed via %s", parsed.Host)
	return nil
}

// deriveAuthPW performs FxA quickStretch (PBKDF2-HMAC-SHA256) + HKDF-SHA256.
func deriveAuthPW(email, password string) ([]byte, error) {
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	salt := []byte(protocolVersion + "quickStretch:" + normalizedEmail)
	quickStretchedPW := pbkdf2.Key([]byte(password), salt, pbkdf2Rounds, stretchedPWLen, sha256.New)

	hkdfSalt := []byte{0x00}
	info := []byte(protocolVersion + "authPW")
	hkdfReader := hkdf.New(sha256.New, quickStretchedPW, hkdfSalt, info)
	authPW := make([]byte, hkdfLen)
	if _, err := io.ReadFull(hkdfReader, authPW); err != nil {
		return nil, err
	}
	return authPW, nil
}

// deriveHawkCredentials derives Hawk ID and HMAC key from a hex sessionToken.
func deriveHawkCredentials(tokenHex, contextStr string) (id string, key []byte, err error) {
	tokenBytes, err := hex.DecodeString(strings.TrimSpace(tokenHex))
	if err != nil {
		return "", nil, fmt.Errorf("invalid token hex: %w", err)
	}
	info := []byte(protocolVersion + contextStr)
	hkdfReader := hkdf.New(sha256.New, tokenBytes, nil, info)
	out := make([]byte, 3*32)
	if _, err := io.ReadFull(hkdfReader, out); err != nil {
		return "", nil, err
	}
	return hex.EncodeToString(out[:32]), out[32:64], nil
}

// hawkHeader computes a Hawk Authorization header for FxA session endpoints.
func hawkHeader(method, rawURL, hawkID string, hawkKey []byte, payload string) (string, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, 6)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	nonceStr := hex.EncodeToString(nonce)
	ts := fmt.Sprintf("%d", time.Now().Unix())
	port := u.Port()
	if port == "" {
		if u.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}

	var payloadHash string
	if payload != "" {
		h := sha256.New()
		h.Write([]byte("hawk.1.payload\napplication/json\n"))
		h.Write([]byte(payload))
		h.Write([]byte("\n"))
		payloadHash = base64.StdEncoding.EncodeToString(h.Sum(nil))
	}

	normalized := strings.Join([]string{
		"hawk.1.header",
		ts,
		nonceStr,
		strings.ToUpper(method),
		u.RequestURI(),
		u.Hostname(),
		port,
		payloadHash,
		"",
		"",
	}, "\n")

	mac := hmac.New(sha256.New, hawkKey)
	mac.Write([]byte(normalized))
	macB64 := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	header := fmt.Sprintf(`Hawk id="%s", ts="%s", nonce="%s", mac="%s"`, hawkID, ts, nonceStr, macB64)
	if payloadHash != "" {
		header += fmt.Sprintf(`, hash="%s"`, payloadHash)
	}
	return header, nil
}

func applyMozillaHeaders(req *http.Request) {
	req.Header.Set("User-Agent", SolverUserAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	if req.URL != nil && strings.Contains(strings.ToLower(req.URL.Host), "firefox.com") {
		req.Header.Set("Origin", "https://accounts.firefox.com")
		req.Header.Set("Referer", "https://accounts.firefox.com/")
		req.Header.Set("Sec-Fetch-Dest", "empty")
		req.Header.Set("Sec-Fetch-Mode", "cors")
		req.Header.Set("Sec-Fetch-Site", "same-site")
	}
}

func (g *GuardianService) promoteCookiesToRoot(rawURL string, cookies []*http.Cookie) {
	if g.cookieJar == nil || len(cookies) == 0 {
		return
	}
	u, err := url.Parse(rawURL)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return
	}
	rootURL := &url.URL{Scheme: u.Scheme, Host: u.Host, Path: "/"}
	var promoted []*http.Cookie
	for _, c := range cookies {
		cp := *c
		cp.Path = "/"
		promoted = append(promoted, &cp)
	}
	g.cookieJar.SetCookies(rootURL, promoted)
}

// doWithChallenge executes an HTTP request and transparently solves Fastly HTTP 406 challenges.
func (g *GuardianService) doWithChallenge(ctx context.Context, buildReq func() (*http.Request, error)) (*http.Response, error) {
	for attempt := 1; attempt <= maxChallengeAttempts; attempt++ {
		req, err := buildReq()
		if err != nil {
			return nil, err
		}
		resp, err := g.httpClient.Do(req)
		if err != nil {
			return nil, err
		}
		g.promoteCookiesToRoot(req.URL.String(), resp.Cookies())
		if resp.StatusCode != http.StatusNotAcceptable {
			return resp, nil
		}
		challengeBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
		_ = resp.Body.Close()

		g.log("WARN", "Fastly anti-bot challenge triggered (HTTP 406), solving challenge (attempt %d/%d)...", attempt, maxChallengeAttempts)
		if solveErr := g.solveFastlyChallenge(ctx, req.URL.String(), string(challengeBytes)); solveErr != nil {
			g.log("WARN", "Fastly challenge solver warning: %v", solveErr)
		}
		if attempt < maxChallengeAttempts {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(time.Duration(attempt*150) * time.Millisecond):
			}
		}
	}
	return nil, fmt.Errorf("Fastly anti-bot challenge persisted after %d attempts (HTTP 406)", maxChallengeAttempts)
}

// solveFastlyChallenge implements the Fastly PoW/PAT/ClientMetrics challenge solver.
func (g *GuardianService) solveFastlyChallenge(ctx context.Context, targetURL string, initialPage string) error {
	u, err := url.Parse(targetURL)
	if err != nil {
		return err
	}
	baseHost := u.Scheme + "://" + u.Host
	page := initialPage

	// If the 406 response body did not embed the /_fs-ch- challenge HTML directly, probe targetURL and baseHost
	if !strings.Contains(page, "/_fs-ch-") {
		for _, probeURL := range []string{targetURL, baseHost + "/"} {
			req, reqErr := http.NewRequestWithContext(ctx, http.MethodGet, probeURL, nil)
			if reqErr != nil {
				continue
			}
			req.Header.Set("User-Agent", SolverUserAgent)
			req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
			req.Header.Set("Accept-Language", "en-US,en;q=0.9")

			resp, doErr := g.httpClient.Do(req)
			if doErr != nil {
				continue
			}
			g.promoteCookiesToRoot(probeURL, resp.Cookies())
			bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
			_ = resp.Body.Close()
			if strings.Contains(string(bodyBytes), "/_fs-ch-") {
				page = string(bodyBytes)
				break
			}
		}
	}

	if !strings.Contains(page, "/_fs-ch-") {
		return errors.New("Fastly challenge prefix not found in 406 response or host root")
	}
	prefix := challengePrefixRegex.FindString(page)
	prefix = strings.TrimSuffix(prefix, "/script.js")
	if prefix == "" {
		return errors.New("Fastly challenge prefix regex did not match")
	}
	prefixURL := baseHost + prefix

	scriptReq, err := http.NewRequestWithContext(ctx, http.MethodGet, prefixURL+"/script.js?reload=true", nil)
	if err != nil {
		return err
	}
	scriptReq.Header.Set("User-Agent", SolverUserAgent)
	scriptReq.Header.Set("Accept", "*/*")
	scriptReq.Header.Set("Accept-Language", "en-US,en;q=0.9")
	scriptReq.Header.Set("Referer", targetURL)
	scriptReq.Header.Set("Sec-Fetch-Dest", "script")
	scriptReq.Header.Set("Sec-Fetch-Mode", "no-cors")
	scriptReq.Header.Set("Sec-Fetch-Site", "same-origin")

	scriptResp, err := g.httpClient.Do(scriptReq)
	if err != nil {
		return err
	}
	g.promoteCookiesToRoot(targetURL, scriptResp.Cookies())
	scriptBytes, _ := io.ReadAll(io.LimitReader(scriptResp.Body, 512*1024))
	_ = scriptResp.Body.Close()

	matches := initCallRegex.FindAllStringSubmatch(string(scriptBytes), -1)
	if len(matches) == 0 {
		return errors.New("Fastly challenge init() call not found in script.js")
	}
	lastMatch := matches[len(matches)-1]
	var challenges []map[string]any
	if err := json.Unmarshal([]byte(lastMatch[1]), &challenges); err != nil {
		return fmt.Errorf("parsing challenge array: %w", err)
	}
	token := lastMatch[2]

	for round := 0; round < maxPostBackRounds; round++ {
		var answers []map[string]any
		for _, ch := range challenges {
			ty, _ := ch["ty"].(string)
			dataMap, _ := ch["data"].(map[string]any)
			switch ty {
			case "pow":
				baseStr, _ := dataMap["base"].(string)
				hashHex, _ := dataMap["hash"].(string)
				hmacStr, _ := dataMap["hmac"].(string)
				expiresStr, _ := dataMap["expires"].(string)
				ans, ok := solvePoW(baseStr, hashHex)
				if !ok {
					return fmt.Errorf("no PoW solution found for %s", baseStr)
				}
				powAns := map[string]any{
					"ty":      "pow",
					"base":    baseStr,
					"answer":  ans,
					"hmac":    hmacStr,
					"expires": expiresStr,
				}
				if sc, hasSC := dataMap["sc"]; hasSC {
					powAns["sc"] = sc
				}
				answers = append(answers, powAns)
			case "pat":
				answers = append(answers, map[string]any{
					"ty":   "pat",
					"auth": "",
				})
			case "clientmetrics":
				answers = append(answers, map[string]any{
					"ty":        "clientmetrics",
					"webdriver": false,
					"bot_detection_result": map[string]any{
						"bot_detected": false,
						"bot_kind":     nil,
					},
					"browser_metrics": map[string]any{
						"client_data": `{"userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0","language":"en-US","languages":["en-US","en"],"platform":"Win32","hardwareConcurrency":8,"maxTouchPoints":0,"cookieEnabled":true}`,
						"error_trace": nil,
					},
					"detector_results": map[string]any{},
					"v":                2,
				})
			default:
				if ty != "" {
					answers = append(answers, map[string]any{
						"ty": ty,
					})
				}
			}
		}

		postPayload, _ := json.Marshal(map[string]any{
			"token": token,
			"data":  answers,
		})
		postReq, err := http.NewRequestWithContext(ctx, http.MethodPost, prefixURL+"/fst-post-back", bytes.NewReader(postPayload))
		if err != nil {
			return err
		}
		postReq.Header.Set("Content-Type", "application/json")
		postReq.Header.Set("Accept", "application/json, text/plain, */*")
		postReq.Header.Set("Accept-Language", "en-US,en;q=0.9")
		postReq.Header.Set("User-Agent", SolverUserAgent)
		postReq.Header.Set("Origin", baseHost)
		postReq.Header.Set("Referer", targetURL)
		postReq.Header.Set("Sec-Fetch-Dest", "empty")
		postReq.Header.Set("Sec-Fetch-Mode", "cors")
		postReq.Header.Set("Sec-Fetch-Site", "same-origin")

		postResp, err := g.httpClient.Do(postReq)
		if err != nil {
			return err
		}
		g.promoteCookiesToRoot(targetURL, postResp.Cookies())
		respData, _ := io.ReadAll(io.LimitReader(postResp.Body, 64*1024))
		_ = postResp.Body.Close()

		// Some Fastly edge nodes return 200 OK with empty body or redirect once clearance cookie is set
		if len(bytes.TrimSpace(respData)) == 0 && postResp.StatusCode >= 200 && postResp.StatusCode < 400 {
			g.log("INFO", "Fastly anti-bot challenge solved (cookie granted)")
			return nil
		}

		var parsed map[string]any
		if err := json.Unmarshal(respData, &parsed); err != nil {
			return err
		}
		if status, _ := parsed["status"].(string); strings.EqualFold(status, "success") || strings.EqualFold(status, "ok") {
			g.log("INFO", "Fastly anti-bot challenge solved successfully")
			return nil
		}
		nextCh, ok := parsed["ch"].([]any)
		nextTok, _ := parsed["tok"].(string)
		if !ok || len(nextCh) == 0 || nextTok == "" {
			break
		}
		challenges = nil
		for _, item := range nextCh {
			if m, ok := item.(map[string]any); ok {
				challenges = append(challenges, m)
			}
		}
		token = nextTok
	}

	return errors.New("Fastly challenge did not complete within max rounds")
}

func solvePoW(baseStr, targetHex string) (string, bool) {
	target, err := hex.DecodeString(strings.TrimSpace(targetHex))
	if err != nil || len(target) != 32 {
		return "", false
	}
	baseBytes := []byte(baseStr)
	// 1. Check 2-character suffixes first (most common Fastly PoW difficulty)
	buf2 := make([]byte, len(baseBytes)+2)
	copy(buf2, baseBytes)
	for i := 0; i < len(powAlphabet); i++ {
		buf2[len(baseBytes)] = powAlphabet[i]
		for j := 0; j < len(powAlphabet); j++ {
			buf2[len(baseBytes)+1] = powAlphabet[j]
			sum := sha256.Sum256(buf2)
			if bytes.Equal(sum[:], target) {
				return string(buf2[len(baseBytes):]), true
			}
		}
	}
	// 2. Check 1-character suffixes
	buf1 := make([]byte, len(baseBytes)+1)
	copy(buf1, baseBytes)
	for i := 0; i < len(powAlphabet); i++ {
		buf1[len(baseBytes)] = powAlphabet[i]
		sum := sha256.Sum256(buf1)
		if bytes.Equal(sum[:], target) {
			return string(buf1[len(baseBytes):]), true
		}
	}
	// 3. Check 3-character suffixes
	buf3 := make([]byte, len(baseBytes)+3)
	copy(buf3, baseBytes)
	for i := 0; i < len(powAlphabet); i++ {
		buf3[len(baseBytes)] = powAlphabet[i]
		for j := 0; j < len(powAlphabet); j++ {
			buf3[len(baseBytes)+1] = powAlphabet[j]
			for k := 0; k < len(powAlphabet); k++ {
				buf3[len(baseBytes)+2] = powAlphabet[k]
				sum := sha256.Sum256(buf3)
				if bytes.Equal(sum[:], target) {
					return string(buf3[len(baseBytes):]), true
				}
			}
		}
	}
	return "", false
}

// RegisterAccount creates a brand-new Firefox Account directly inside the app and triggers the 6-digit email verification code.
func (g *GuardianService) RegisterAccount(ctx context.Context, email, password string) (*LoginResponse, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || len(password) < 8 {
		return nil, errors.New("valid email and password (at least 8 characters) are required")
	}

	authPW, err := deriveAuthPW(email, password)
	if err != nil {
		return nil, fmt.Errorf("deriving authPW: %w", err)
	}

	payload := map[string]any{
		"email":              email,
		"authPW":             hex.EncodeToString(authPW),
		"verificationMethod": verificationMethodEmail2FA,
		"service":            FirefoxClientID,
	}
	bodyJSON, _ := json.Marshal(payload)
	createURL := FxaAuthServer + "/account/create?keys=true"

	g.log("INFO", "Creating new Firefox Account for %s...", email)
	resp, err := g.doWithChallenge(ctx, func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, createURL, bytes.NewReader(bodyJSON))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		applyMozillaHeaders(req)
		return req, nil
	})
	if err != nil {
		return nil, fmt.Errorf("account registration request failed: %w", err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(io.LimitReader(resp.Body, 32*1024))
	if resp.StatusCode != http.StatusOK {
		var apiErr FxaAPIError
		_ = json.Unmarshal(data, &apiErr)
		apiErr.Status = resp.StatusCode
		return nil, &apiErr
	}

	var createResp LoginResponse
	if err := json.Unmarshal(data, &createResp); err != nil {
		return nil, fmt.Errorf("parsing registration response: %w", err)
	}

	g.mu.Lock()
	g.pendingSession = &pendingVerification{
		Email:        email,
		UID:          createResp.UID,
		SessionToken: createResp.SessionToken,
		IsSignUp:     true,
	}
	g.mu.Unlock()

	g.log("INFO", "Firefox Account created (uid=%s). Verification code sent to %s", createResp.UID, email)
	return &createResp, nil
}

// Login authenticates an existing Firefox Account using email and password.
func (g *GuardianService) Login(ctx context.Context, email, password string) (*LoginResponse, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	loginResp, err := g.loginAttempt(ctx, email, password, verificationMethodEmail2FA)
	if err != nil {
		var apiErr *FxaAPIError
		if errors.As(err, &apiErr) && apiErr.Errno == fxaErrnoInvalidParameter {
			loginResp, err = g.loginAttempt(ctx, email, password, "")
		}
		if err != nil {
			return nil, err
		}
	}

	g.mu.Lock()
	g.pendingSession = &pendingVerification{
		Email:        email,
		UID:          loginResp.UID,
		SessionToken: loginResp.SessionToken,
		IsSignUp:     false,
	}
	g.mu.Unlock()

	return loginResp, nil
}

func (g *GuardianService) loginAttempt(ctx context.Context, email, password, verifyMethod string) (*LoginResponse, error) {
	authPW, err := deriveAuthPW(email, password)
	if err != nil {
		return nil, fmt.Errorf("deriving authPW: %w", err)
	}
	body := map[string]string{
		"email":  email,
		"authPW": hex.EncodeToString(authPW),
	}
	if verifyMethod != "" {
		body["verificationMethod"] = verifyMethod
	}
	bodyJSON, _ := json.Marshal(body)
	loginURL := FxaAuthServer + "/account/login"

	resp, err := g.doWithChallenge(ctx, func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, loginURL, bytes.NewReader(bodyJSON))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		applyMozillaHeaders(req)
		return req, nil
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(io.LimitReader(resp.Body, 32*1024))
	if resp.StatusCode != http.StatusOK {
		var apiErr FxaAPIError
		_ = json.Unmarshal(data, &apiErr)
		apiErr.Status = resp.StatusCode
		return nil, &apiErr
	}

	var loginResp LoginResponse
	if err := json.Unmarshal(data, &loginResp); err != nil {
		return nil, fmt.Errorf("parsing login response: %w", err)
	}
	return &loginResp, nil
}

// VerifyEmailCode verifies:
// 1. A 6-digit OTP code (Sign-In with existing account),
// 2. A pasted confirmation URL from Mozilla email (e.g., https://accounts.firefox.com/verify_email?uid=...&code=...), or
// 3. "LINK_CLICKED" when the user clicked the confirmation link in their browser.
func (g *GuardianService) VerifyEmailCode(ctx context.Context, code string) (*SavedTokens, *Entitlement, error) {
	g.mu.RLock()
	pending := g.pendingSession
	g.mu.RUnlock()

	if pending == nil || pending.SessionToken == "" {
		return nil, nil, errors.New("no pending login or registration session to verify")
	}

	code = strings.TrimSpace(code)
	extractedUID := pending.UID

	// Case 1: User pasted the full confirmation link from the Firefox verification email
	if strings.Contains(code, "code=") || strings.HasPrefix(strings.ToLower(code), "http") {
		if u, err := url.Parse(code); err == nil {
			q := u.Query()
			if c := q.Get("code"); c != "" {
				code = strings.TrimSpace(c)
			}
			if uidParam := q.Get("uid"); uidParam != "" {
				extractedUID = strings.TrimSpace(uidParam)
			}
		}
	}

	hawkID, hawkKey, err := deriveHawkCredentials(pending.SessionToken, "sessionToken")
	if err != nil {
		return nil, nil, err
	}

	// Case 2: User clicked the email confirmation link in their browser ("LINK_CLICKED" or "VERIFIED")
	if strings.EqualFold(code, "LINK_CLICKED") || strings.EqualFold(code, "VERIFIED") {
		statusURL := FxaAuthServer + "/recovery_email/status"
		statusResp, sErr := g.doWithChallenge(ctx, func() (*http.Request, error) {
			authHeader, err := hawkHeader(http.MethodGet, statusURL, hawkID, hawkKey, "")
			if err != nil {
				return nil, err
			}
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, statusURL, nil)
			if err != nil {
				return nil, err
			}
			req.Header.Set("Authorization", authHeader)
			applyMozillaHeaders(req)
			return req, nil
		})
		if sErr == nil {
			sData, _ := io.ReadAll(io.LimitReader(statusResp.Body, 8192))
			_ = statusResp.Body.Close()
			var st struct {
				Verified bool `json:"verified"`
			}
			_ = json.Unmarshal(sData, &st)
			if !st.Verified {
				return nil, nil, errors.New("ایمیل شما هنوز در سرور فایرفاکس تایید نشده است؛ ابتدا لینک داخل ایمیل را باز کنید یا لینک را در کادر بالا Paste نمایید")
			}
		}
		g.log("INFO", "Browser email verification confirmed for %s", pending.Email)
		return g.CompleteSessionLogin(ctx, pending.Email, extractedUID, pending.SessionToken)
	}

	// Case 3: Pasted 32-char hex code from link or SignUp recovery_email/verify_code
	if pending.IsSignUp || len(code) > 8 {
		altBody, _ := json.Marshal(map[string]string{
			"uid":  extractedUID,
			"code": code,
		})
		altURL := FxaAuthServer + "/recovery_email/verify_code"
		altResp, altErr := g.doWithChallenge(ctx, func() (*http.Request, error) {
			req, err := http.NewRequestWithContext(ctx, http.MethodPost, altURL, bytes.NewReader(altBody))
			if err != nil {
				return nil, err
			}
			req.Header.Set("Content-Type", "application/json")
			applyMozillaHeaders(req)
			return req, nil
		})
		if altErr == nil {
			altData, _ := io.ReadAll(io.LimitReader(altResp.Body, 16*1024))
			_ = altResp.Body.Close()
			if altResp.StatusCode == http.StatusOK {
				g.log("INFO", "Account creation email verified for %s", pending.Email)
				return g.CompleteSessionLogin(ctx, pending.Email, extractedUID, pending.SessionToken)
			}
			if len(code) > 8 {
				return nil, nil, fmt.Errorf("email link verification failed (HTTP %d): %s", altResp.StatusCode, string(altData))
			}
		}
	}

	// Case 4: Standard 6-digit OTP code via /v1/session/verify_code
	bodyJSON, _ := json.Marshal(map[string]string{"code": code})
	verifyURL := FxaAuthServer + "/session/verify_code"

	resp, err := g.doWithChallenge(ctx, func() (*http.Request, error) {
		authHeader, err := hawkHeader(http.MethodPost, verifyURL, hawkID, hawkKey, string(bodyJSON))
		if err != nil {
			return nil, err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, verifyURL, bytes.NewReader(bodyJSON))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", authHeader)
		applyMozillaHeaders(req)
		return req, nil
	})
	if err != nil {
		return nil, nil, fmt.Errorf("verify code request failed: %w", err)
	}
	respData, _ := io.ReadAll(io.LimitReader(resp.Body, 16*1024))
	_ = resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, nil, fmt.Errorf("verification code rejected (HTTP %d): %s", resp.StatusCode, string(respData))
	}

	g.log("INFO", "Email verification succeeded for %s", pending.Email)
	return g.CompleteSessionLogin(ctx, pending.Email, extractedUID, pending.SessionToken)
}

// CompleteSessionLogin exchanges a verified FxA sessionToken for OAuth tokens and fetches/activates the 50 GB Guardian entitlement.
func (g *GuardianService) CompleteSessionLogin(ctx context.Context, email, uid, sessionToken string) (*SavedTokens, *Entitlement, error) {
	tokResp, err := g.ExchangeOAuthToken(ctx, sessionToken)
	if err != nil {
		return nil, nil, err
	}

	g.mu.RLock()
	var existingPool []string
	var existingAccounts []PoolAccountRecord
	if g.savedTokens != nil {
		existingPool = append([]string(nil), g.savedTokens.TokenPool...)
		existingAccounts = append([]PoolAccountRecord(nil), g.savedTokens.PoolAccounts...)
	}
	g.mu.RUnlock()

	saved := &SavedTokens{
		Email:        email,
		UID:          uid,
		SessionToken: sessionToken,
		AccessToken:  tokResp.AccessToken,
		RefreshToken: tokResp.RefreshToken,
		Scope:        tokResp.Scope,
		ObtainedAt:   time.Now(),
		ExpiresIn:    tokResp.ExpiresIn,
		TokenPool:    existingPool,
		PoolAccounts: existingAccounts,
	}
	if err := g.SaveTokens(saved); err != nil {
		return nil, nil, fmt.Errorf("failed to persist account session to data/account.bin: %w", err)
	}

	g.mu.Lock()
	g.savedTokens = saved
	g.pendingSession = nil
	g.mu.Unlock()

	entitlement, err := g.EnsureGuardianEntitlement(ctx, saved.AccessToken)
	if err != nil {
		g.log("WARN", "Entitlement check warning: %v", err)
		entitlement = &Entitlement{
			Subscribed:       true,
			UID:              uid,
			MaxBytes:         DefaultMonthlyAllowance,
			LimitedBandwidth: true,
			QuotaRemaining:   DefaultMonthlyAllowance,
		}
	}

	saved.QuotaMaxBytes = entitlement.MaxBytes
	saved.QuotaRemainingBytes = entitlement.QuotaRemaining

	// Upsert authenticated account into PoolAccounts and TokenPool so both direct Login and 6-digit OTP verification persist to the pool
	if email != "" && !strings.HasSuffix(email, "@firefox.com") {
		foundAcc := false
		for i := range saved.PoolAccounts {
			if strings.EqualFold(saved.PoolAccounts[i].Email, email) {
				saved.PoolAccounts[i].SessionToken = sessionToken
				saved.PoolAccounts[i].AccessToken = saved.AccessToken
				saved.PoolAccounts[i].UID = uid
				saved.PoolAccounts[i].QuotaRemainingBytes = entitlement.QuotaRemaining
				saved.PoolAccounts[i].Active = true
				foundAcc = true
			} else {
				saved.PoolAccounts[i].Active = false
			}
		}
		if !foundAcc {
			saved.PoolAccounts = append(saved.PoolAccounts, PoolAccountRecord{
				ID:                  fmt.Sprintf("acc-%d", time.Now().UnixNano()),
				Email:               email,
				UID:                 uid,
				SessionToken:        sessionToken,
				AccessToken:         saved.AccessToken,
				QuotaGB:             50,
				QuotaRemainingBytes: entitlement.QuotaRemaining,
				Active:              true,
				AddedAt:             time.Now().Format("15:04:05"),
			})
		}
		hasTok := false
		for _, t := range saved.TokenPool {
			if t == sessionToken {
				hasTok = true
				break
			}
		}
		if !hasTok && sessionToken != "" {
			saved.TokenPool = append(saved.TokenPool, sessionToken)
		}
		g.mu.Lock()
		g.tokenPool = append([]string(nil), saved.TokenPool...)
		g.mu.Unlock()
	}

	_ = g.SaveTokens(saved)

	return saved, entitlement, nil
}

// ExchangeOAuthToken exchanges a hex sessionToken for an OAuth Bearer token using Hawk authentication.
func (g *GuardianService) ExchangeOAuthToken(ctx context.Context, sessionToken string) (*TokenResponse, error) {
	hawkID, hawkKey, err := deriveHawkCredentials(sessionToken, "sessionToken")
	if err != nil {
		return nil, err
	}
	payload := map[string]any{
		"client_id":   FirefoxClientID,
		"grant_type":  "fxa-credentials",
		"scope":       OAuthScope,
		"access_type": "offline",
	}
	bodyJSON, _ := json.Marshal(payload)
	tokenURL := FxaAuthServer + "/oauth/token"

	resp, err := g.doWithChallenge(ctx, func() (*http.Request, error) {
		authHeader, err := hawkHeader(http.MethodPost, tokenURL, hawkID, hawkKey, string(bodyJSON))
		if err != nil {
			return nil, err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, bytes.NewReader(bodyJSON))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", authHeader)
		applyMozillaHeaders(req)
		return req, nil
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(io.LimitReader(resp.Body, 32*1024))
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OAuth token exchange failed (HTTP %d): %s", resp.StatusCode, string(data))
	}

	var tok TokenResponse
	if err := json.Unmarshal(data, &tok); err != nil {
		return nil, err
	}
	return &tok, nil
}

// RefreshOAuthToken refreshes an expired OAuth access token using the stored refresh_token.
func (g *GuardianService) RefreshOAuthToken(ctx context.Context, refreshToken string) (*TokenResponse, error) {
	payload := map[string]any{
		"client_id":     FirefoxClientID,
		"grant_type":    "refresh_token",
		"refresh_token": refreshToken,
		"scope":         OAuthScope,
	}
	bodyJSON, _ := json.Marshal(payload)
	tokenURL := FxaAuthServer + "/oauth/token"

	resp, err := g.doWithChallenge(ctx, func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, bytes.NewReader(bodyJSON))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		applyMozillaHeaders(req)
		return req, nil
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(io.LimitReader(resp.Body, 32*1024))
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OAuth refresh failed (HTTP %d): %s", resp.StatusCode, string(data))
	}

	var tok TokenResponse
	if err := json.Unmarshal(data, &tok); err != nil {
		return nil, err
	}
	if tok.RefreshToken == "" {
		tok.RefreshToken = refreshToken
	}
	return &tok, nil
}

// extractQuotaFromGuardianResponse inspects JSON fields (camelCase & snake_case), HTTP headers, and JWT claims
// to extract real server-reported quota limits and remaining bytes.
func extractQuotaFromGuardianResponse(data []byte, hdr http.Header, jwtToken string) (maxBytes int64, remBytes int64, hasRem bool, resetEpoch int64) {
	maxBytes = DefaultMonthlyAllowance
	remBytes = -1

	parseAnyInt64 := func(v any) (int64, bool) {
		switch val := v.(type) {
		case float64:
			return int64(val), true
		case int64:
			return val, true
		case string:
			if n, err := strconv.ParseInt(strings.TrimSpace(val), 10, 64); err == nil {
				return n, true
			}
		}
		return 0, false
	}

	var rawMap map[string]any
	if len(data) > 0 && json.Unmarshal(data, &rawMap) == nil {
		for _, k := range []string{"maxBytes", "max_bytes", "quotaMax", "quota_max", "limit_bytes", "bandwidth_limit"} {
			if v, ok := rawMap[k]; ok {
				if n, ok2 := parseAnyInt64(v); ok2 && n > 0 {
					maxBytes = n
					break
				}
			}
		}
		for _, k := range []string{"quotaRemaining", "quota_remaining", "remainingBytes", "remaining_bytes", "bytes_remaining", "available_bytes"} {
			if v, ok := rawMap[k]; ok {
				if n, ok2 := parseAnyInt64(v); ok2 && n >= 0 {
					remBytes = n
					hasRem = true
					break
				}
			}
		}
		if !hasRem {
			for _, k := range []string{"usedBytes", "used_bytes", "bytes_used", "quota_used", "consumed_bytes"} {
				if v, ok := rawMap[k]; ok {
					if used, ok2 := parseAnyInt64(v); ok2 && used >= 0 {
						rem := maxBytes - used
						if rem < 0 {
							rem = 0
						}
						remBytes = rem
						hasRem = true
						break
					}
				}
			}
		}
		for _, k := range []string{"quotaReset", "quota_reset", "reset_at", "expires_at"} {
			if v, ok := rawMap[k]; ok {
				if n, ok2 := parseAnyInt64(v); ok2 && n > 0 {
					resetEpoch = n
					break
				}
			}
		}
	}

	if hdr != nil {
		for _, hk := range []string{"X-Quota-Limit", "X-Quota-Max", "Quota-Limit"} {
			if hv := strings.TrimSpace(hdr.Get(hk)); hv != "" {
				if n, err := strconv.ParseInt(hv, 10, 64); err == nil && n > 0 {
					maxBytes = n
					break
				}
			}
		}
		for _, hk := range []string{"X-Quota-Remaining", "Quota-Remaining", "X-RateLimit-Remaining-Bytes"} {
			if hv := strings.TrimSpace(hdr.Get(hk)); hv != "" {
				if n, err := strconv.ParseInt(hv, 10, 64); err == nil && n >= 0 {
					remBytes = n
					hasRem = true
					break
				}
			}
		}
		if !hasRem {
			for _, hk := range []string{"X-Quota-Used", "Quota-Used"} {
				if hv := strings.TrimSpace(hdr.Get(hk)); hv != "" {
					if used, err := strconv.ParseInt(hv, 10, 64); err == nil && used >= 0 {
						rem := maxBytes - used
						if rem < 0 {
							rem = 0
						}
						remBytes = rem
						hasRem = true
						break
					}
				}
			}
		}
		for _, hk := range []string{"X-Quota-Reset", "Quota-Reset"} {
			if hv := strings.TrimSpace(hdr.Get(hk)); hv != "" {
				if n, err := strconv.ParseInt(hv, 10, 64); err == nil && n > 0 {
					resetEpoch = n
					break
				}
			}
		}
	}

	if !hasRem && jwtToken != "" {
		parts := strings.Split(jwtToken, ".")
		if len(parts) >= 2 {
			if decoded, err := base64.RawURLEncoding.DecodeString(parts[1]); err == nil {
				var claims map[string]any
				if json.Unmarshal(decoded, &claims) == nil {
					for _, k := range []string{"quota_remaining", "remaining_bytes", "quotaRemaining"} {
						if v, ok := claims[k]; ok {
							if n, ok2 := parseAnyInt64(v); ok2 && n >= 0 {
								remBytes = n
								hasRem = true
								break
							}
						}
					}
					if !hasRem {
						for _, k := range []string{"used_bytes", "bytes_used"} {
							if v, ok := claims[k]; ok {
								if used, ok2 := parseAnyInt64(v); ok2 && used >= 0 {
									rem := maxBytes - used
									if rem < 0 {
										rem = 0
									}
									remBytes = rem
									hasRem = true
									break
								}
							}
						}
					}
				}
			}
		}
	}

	return maxBytes, remBytes, hasRem, resetEpoch
}

// EnsureGuardianEntitlement checks /api/v1/fpn/status and calls /api/v1/fpn/activate if needed,
// then queries /api/v1/fpn/token to read live quota headers/claims from Mozilla Guardian.
func (g *GuardianService) EnsureGuardianEntitlement(ctx context.Context, accessToken string) (*Entitlement, error) {
	ent, err := g.FetchUserInfo(ctx, accessToken)
	if err != nil {
		g.log("INFO", "Activating free 50 GB Mozilla Guardian FPN entitlement on account...")
		ent, err = g.ActivateGuardian(ctx, accessToken)
		if err != nil {
			return nil, err
		}
	}
	if pass, passErr := g.FetchProxyPass(ctx, accessToken); passErr == nil {
		if pass.QuotaMax > 0 {
			ent.MaxBytes = pass.QuotaMax
		}
		if pass.HasLiveQuota && pass.QuotaRemaining >= 0 {
			ent.QuotaRemaining = pass.QuotaRemaining
			ent.HasLiveQuota = true
		}
		if pass.QuotaReset > 0 {
			ent.QuotaReset = pass.QuotaReset
		}
	}
	if !ent.HasLiveQuota && ent.QuotaRemaining <= 0 {
		// Fall back to previously persisted remaining bytes if available, otherwise 50 GB
		g.mu.RLock()
		if g.savedTokens != nil && g.savedTokens.QuotaRemainingBytes > 0 {
			ent.QuotaRemaining = g.savedTokens.QuotaRemainingBytes
		} else {
			ent.QuotaRemaining = ent.MaxBytes
		}
		g.mu.RUnlock()
	}
	return ent, nil
}

// FetchUserInfo queries GET https://vpn.mozilla.org/api/v1/fpn/status.
func (g *GuardianService) FetchUserInfo(ctx context.Context, accessToken string) (*Entitlement, error) {
	statusURL := strings.TrimRight(g.guardianBaseURL, "/") + "/api/v1/fpn/status"
	resp, err := g.doWithChallenge(ctx, func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, statusURL, nil)
		if err != nil {
			return nil, err
		}
		applyMozillaHeaders(req)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		return req, nil
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(io.LimitReader(resp.Body, 16*1024))
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fpn/status returned HTTP %d: %s", resp.StatusCode, string(data))
	}

	var ent Entitlement
	if err := json.Unmarshal(data, &ent); err != nil {
		return nil, err
	}
	maxB, remB, hasRem, resetEp := extractQuotaFromGuardianResponse(data, resp.Header, "")
	if maxB > 0 {
		ent.MaxBytes = maxB
	} else if ent.MaxBytes <= 0 {
		ent.MaxBytes = DefaultMonthlyAllowance
	}
	if hasRem && remB >= 0 {
		ent.QuotaRemaining = remB
		ent.HasLiveQuota = true
	}
	if resetEp > 0 {
		ent.QuotaReset = resetEp
	}
	return &ent, nil
}

// ActivateGuardian calls POST https://vpn.mozilla.org/api/v1/fpn/activate to enable the free 50 GB tier.
func (g *GuardianService) ActivateGuardian(ctx context.Context, accessToken string) (*Entitlement, error) {
	activateURL := strings.TrimRight(g.guardianBaseURL, "/") + "/api/v1/fpn/activate"
	resp, err := g.doWithChallenge(ctx, func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, activateURL, bytes.NewReader(nil))
		if err != nil {
			return nil, err
		}
		applyMozillaHeaders(req)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+accessToken)
		return req, nil
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(io.LimitReader(resp.Body, 16*1024))
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fpn/activate returned HTTP %d: %s", resp.StatusCode, string(data))
	}

	var ent Entitlement
	if err := json.Unmarshal(data, &ent); err != nil {
		return nil, err
	}
	maxB, remB, hasRem, resetEp := extractQuotaFromGuardianResponse(data, resp.Header, "")
	if maxB > 0 {
		ent.MaxBytes = maxB
	} else if ent.MaxBytes <= 0 {
		ent.MaxBytes = DefaultMonthlyAllowance
	}
	if hasRem && remB >= 0 {
		ent.QuotaRemaining = remB
		ent.HasLiveQuota = true
	} else {
		ent.QuotaRemaining = ent.MaxBytes
	}
	if resetEp > 0 {
		ent.QuotaReset = resetEp
	}
	return &ent, nil
}

// FetchProxyPass calls GET https://vpn.mozilla.org/api/v1/fpn/token and reads quota headers, body fields, and JWT claims.
func (g *GuardianService) FetchProxyPass(ctx context.Context, accessToken string) (*ProxyPassInfo, error) {
	tokenURL := strings.TrimRight(g.guardianBaseURL, "/") + "/api/v1/fpn/token"
	resp, err := g.doWithChallenge(ctx, func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, tokenURL, nil)
		if err != nil {
			return nil, err
		}
		applyMozillaHeaders(req)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		return req, nil
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusUnauthorized, http.StatusForbidden:
		return nil, ErrTokenInvalid
	case http.StatusTooManyRequests:
		return nil, ErrQuotaExceeded
	}

	data, _ := io.ReadAll(io.LimitReader(resp.Body, 16*1024))
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fpn/token returned HTTP %d: %s", resp.StatusCode, string(data))
	}

	var parsed struct {
		Token     string `json:"token"`
		ExpiresAt int64  `json:"expires_at"`
	}
	if err := json.Unmarshal(data, &parsed); err != nil {
		return nil, err
	}
	if parsed.Token == "" {
		return nil, errors.New("Guardian response did not include a proxy token")
	}

	expiresAt := parsed.ExpiresAt
	if expiresAt <= 0 {
		expiresAt = parseJWTExpiry(parsed.Token)
	}

	quotaMax, quotaRem, hasRem, quotaReset := extractQuotaFromGuardianResponse(data, resp.Header, parsed.Token)

	return &ProxyPassInfo{
		Token:          parsed.Token,
		ExpiresAt:      expiresAt,
		QuotaMax:       quotaMax,
		QuotaRemaining: quotaRem,
		HasLiveQuota:   hasRem,
		QuotaReset:     quotaReset,
	}, nil
}

// GetValidProxyPass returns a fresh ProxyPassInfo, automatically refreshing OAuth tokens or rotating token pools on 401/429.
func (g *GuardianService) GetValidProxyPass(ctx context.Context) (*ProxyPassInfo, error) {
	g.mu.Lock()
	saved := g.savedTokens
	g.mu.Unlock()

	if saved == nil {
		return nil, errors.New("not authenticated")
	}

	if !saved.AccessTokenValid() && saved.RefreshToken != "" {
		if refreshed, err := g.RefreshOAuthToken(ctx, saved.RefreshToken); err == nil {
			saved.AccessToken = refreshed.AccessToken
			saved.RefreshToken = refreshed.RefreshToken
			saved.ExpiresIn = refreshed.ExpiresIn
			saved.ObtainedAt = time.Now()
			_ = g.SaveTokens(saved)
		}
	}

	pass, err := g.FetchProxyPass(ctx, saved.AccessToken)
	if errors.Is(err, ErrTokenInvalid) {
		// Attempt to activate Guardian entitlement first, then refresh OAuth token
		if _, actErr := g.ActivateGuardian(ctx, saved.AccessToken); actErr == nil {
			if retryPass, retryErr := g.FetchProxyPass(ctx, saved.AccessToken); retryErr == nil {
				return retryPass, nil
			}
		}
		if saved.RefreshToken != "" {
			if refreshed, refErr := g.RefreshOAuthToken(ctx, saved.RefreshToken); refErr == nil {
				saved.AccessToken = refreshed.AccessToken
				saved.RefreshToken = refreshed.RefreshToken
				saved.ExpiresIn = refreshed.ExpiresIn
				saved.ObtainedAt = time.Now()
				_ = g.SaveTokens(saved)
				return g.FetchProxyPass(ctx, saved.AccessToken)
			}
		}
	}

	if errors.Is(err, ErrQuotaExceeded) {
		// Rotate to next token in pool if configured
		if rotatedPass, rotErr := g.rotateNextTokenInPool(ctx); rotErr == nil {
			return rotatedPass, nil
		}
	}

	return pass, err
}

// ConfigureTokenPool sets a list of hex sessionTokens that automatically rotate when 50 GB is exhausted.
func (g *GuardianService) ConfigureTokenPool(ctx context.Context, rawTokens []string) (*SavedTokens, *Entitlement, error) {
	var clean []string
	for _, t := range rawTokens {
		trimmed := strings.TrimSpace(t)
		if trimmed != "" && !strings.HasPrefix(trimmed, "#") {
			clean = append(clean, trimmed)
		}
	}
	if len(clean) == 0 {
		return nil, nil, errors.New("no valid session tokens provided")
	}
	g.mu.Lock()
	g.tokenPool = clean
	g.poolIndex = 0
	g.mu.Unlock()

	g.log("INFO", "Configured session token pool with %d token(s)", len(clean))
	return g.CompleteSessionLogin(ctx, "token-pool@firefox.com", "pool-active", clean[0])
}

func (g *GuardianService) rotateNextTokenInPool(ctx context.Context) (*ProxyPassInfo, error) {
	g.mu.Lock()
	if len(g.tokenPool) <= 1 || g.poolIndex+1 >= len(g.tokenPool) {
		g.mu.Unlock()
		return nil, ErrQuotaExceeded
	}
	g.poolIndex++
	nextTok := g.tokenPool[g.poolIndex]
	idx := g.poolIndex + 1
	total := len(g.tokenPool)
	g.mu.Unlock()

	g.log("WARN", "Monthly 50 GB quota exhausted on current token; rotating to pool token %d/%d", idx, total)
	if _, _, err := g.CompleteSessionLogin(ctx, fmt.Sprintf("pool-%d@firefox.com", idx), fmt.Sprintf("pool-%d", idx), nextTok); err != nil {
		return nil, err
	}
	return g.FetchProxyPass(ctx, g.savedTokens.AccessToken)
}

// FetchServerList retrieves the global Fastly edge server list from Mozilla Remote Settings.
func (g *GuardianService) FetchServerList(ctx context.Context) ([]Country, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, RemoteSettingsURL, nil)
	if err != nil {
		return nil, err
	}
	applyMozillaHeaders(req)

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching Remote Settings server list: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Remote Settings returned HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return nil, err
	}

	var envelope struct {
		Data []json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil, err
	}

	var countries []Country
	isExcludedCountry := func(c *Country) bool {
		if c == nil || c.Code == "" || len(c.Cities) == 0 {
			return true
		}
		if strings.EqualFold(c.Code, "REC") || strings.EqualFold(c.Name, "CatchAll Anycast") || strings.Contains(strings.ToLower(c.Name), "recomended") {
			return true
		}
		return false
	}
	for _, raw := range envelope.Data {
		var wrapper struct {
			Country *Country `json:"country"`
		}
		if err := json.Unmarshal(raw, &wrapper); err == nil && !isExcludedCountry(wrapper.Country) {
			countries = append(countries, *wrapper.Country)
			continue
		}
		var c Country
		if err := json.Unmarshal(raw, &c); err == nil && !isExcludedCountry(&c) {
			countries = append(countries, c)
		}
	}
	return countries, nil
}

func parseJWTExpiry(jwt string) int64 {
	parts := strings.Split(jwt, ".")
	if len(parts) < 2 {
		return time.Now().Add(55 * time.Minute).Unix()
	}
	decoded, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return time.Now().Add(55 * time.Minute).Unix()
	}
	var claims struct {
		Exp int64 `json:"exp"`
	}
	if err := json.Unmarshal(decoded, &claims); err != nil || claims.Exp <= 0 {
		return time.Now().Add(55 * time.Minute).Unix()
	}
	return claims.Exp
}

// AddAccountToPool authenticates a secondary Firefox Account via PBKDF2-SHA256 + HKDF and stores it in data/account.bin.
func (g *GuardianService) AddAccountToPool(ctx context.Context, email, password string) (*SavedTokens, *Entitlement, error) {
	// Snapshot prior state so in-memory pool is rolled back if persistence fails
	g.mu.RLock()
	var prevSaved *SavedTokens
	if g.savedTokens != nil {
		cp := *g.savedTokens
		cp.TokenPool = append([]string(nil), g.savedTokens.TokenPool...)
		cp.PoolAccounts = append([]PoolAccountRecord(nil), g.savedTokens.PoolAccounts...)
		prevSaved = &cp
	}
	prevPool := append([]string(nil), g.tokenPool...)
	g.mu.RUnlock()

	resp, err := g.Login(ctx, email, password)
	if err != nil {
		return nil, nil, err
	}
	if !resp.Verified {
		return nil, nil, ErrVerificationNeede
	}
	saved, ent, err := g.CompleteSessionLogin(ctx, email, resp.UID, resp.SessionToken)
	if err != nil {
		return nil, nil, err
	}

	g.mu.RLock()
	candidate := *saved
	candidate.PoolAccounts = append([]PoolAccountRecord(nil), saved.PoolAccounts...)
	updatedPool := append([]string(nil), g.tokenPool...)
	g.mu.RUnlock()

	found := false
	for i := range candidate.PoolAccounts {
		if strings.EqualFold(candidate.PoolAccounts[i].Email, email) {
			candidate.PoolAccounts[i].SessionToken = resp.SessionToken
			candidate.PoolAccounts[i].AccessToken = saved.AccessToken
			candidate.PoolAccounts[i].UID = resp.UID
			candidate.PoolAccounts[i].QuotaRemainingBytes = ent.QuotaRemaining
			candidate.PoolAccounts[i].Active = true
			found = true
		} else {
			candidate.PoolAccounts[i].Active = false
		}
	}
	if !found {
		candidate.PoolAccounts = append(candidate.PoolAccounts, PoolAccountRecord{
			ID:                  fmt.Sprintf("acc-%d", time.Now().Unix()),
			Email:               email,
			UID:                 resp.UID,
			SessionToken:        resp.SessionToken,
			AccessToken:         saved.AccessToken,
			QuotaGB:             50,
			QuotaRemainingBytes: ent.QuotaRemaining,
			Active:              true,
			AddedAt:             time.Now().Format("15:04:05"),
		})
	}
	updatedPool = append(updatedPool, resp.SessionToken)
	candidate.TokenPool = updatedPool

	if err := g.SaveTokens(&candidate); err != nil {
		g.mu.Lock()
		g.savedTokens = prevSaved
		g.tokenPool = prevPool
		g.mu.Unlock()
		return nil, nil, fmt.Errorf("failed to persist account pool to data/account.bin: %w", err)
	}

	g.mu.Lock()
	g.savedTokens = &candidate
	g.tokenPool = updatedPool
	g.mu.Unlock()

	return &candidate, ent, nil
}

// accountBinPaths returns ordered candidate paths for data/account.bin:
// 1. <exe_dir>/data/account.bin (Portable mode: persists alongside FoxyVPN-Portable.exe across updates)
// 2. ./data/account.bin (Working directory data/account.bin)
// 3. %LOCALAPPDATA%\FoxyVPN\data\account.bin (Installer mode: persists across NSIS Setup upgrades even when Program Files is read-only)
func accountBinPaths() []string {
	var paths []string
	seen := make(map[string]bool)
	addPath := func(p string) {
		clean := filepath.Clean(p)
		if !seen[clean] {
			seen[clean] = true
			paths = append(paths, clean)
		}
	}

	if exePath, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exePath)
		addPath(filepath.Join(exeDir, "data", "account.bin"))
	}
	addPath(filepath.Join("data", "account.bin"))

	if cfgDir, err := os.UserConfigDir(); err == nil && cfgDir != "" {
		addPath(filepath.Join(cfgDir, "FoxyVPN", "data", "account.bin"))
	}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		addPath(filepath.Join(home, ".foxyvpn", "data", "account.bin"))
	}
	return paths
}

func legacyTokenPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return legacyTokenFileName
	}
	return filepath.Join(home, legacyTokenFileName)
}

func deriveBinaryStorageKey() []byte {
	host, _ := os.Hostname()
	seed := "foxyvpn-v1.0.5-account-bin-key|" + host
	sum := sha256.Sum256([]byte(seed))
	return sum[:]
}

func encryptAccountBinary(tokens *SavedTokens) ([]byte, error) {
	rawJSON, err := json.Marshal(tokens)
	if err != nil {
		return nil, err
	}

	key := deriveBinaryStorageKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	sealed := gcm.Seal(nonce, nonce, rawJSON, []byte(binaryFileMagic))
	protected, err := platformProtectBytes(sealed)
	if err != nil {
		protected = sealed
	}

	var buf bytes.Buffer
	buf.WriteString(binaryFileMagic)
	buf.Write(protected)
	return buf.Bytes(), nil
}

func decryptAccountBinary(data []byte) (*SavedTokens, error) {
	if !bytes.HasPrefix(data, []byte(binaryFileMagic)) {
		// Legacy JSON fallback
		var legacy SavedTokens
		if err := json.Unmarshal(data, &legacy); err != nil {
			return nil, errors.New("unrecognized account.bin binary header")
		}
		return &legacy, nil
	}

	payload := data[len(binaryFileMagic):]
	unprotected, err := platformUnprotectBytes(payload)
	if err == nil && len(unprotected) > 0 {
		payload = unprotected
	}

	key := deriveBinaryStorageKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(payload) < gcm.NonceSize() {
		return nil, errors.New("corrupted account.bin payload")
	}

	nonce := payload[:gcm.NonceSize()]
	ciphertext := payload[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ciphertext, []byte(binaryFileMagic))
	if err != nil {
		return nil, err
	}

	var saved SavedTokens
	if err := json.Unmarshal(plain, &saved); err != nil {
		return nil, err
	}
	return &saved, nil
}

// SaveTokens encrypts and saves account credentials to data/account.bin for both Portable and Setup editions.
func (g *GuardianService) SaveTokens(tokens *SavedTokens) error {
	if tokens == nil {
		return nil
	}
	g.mu.RLock()
	if len(tokens.TokenPool) == 0 && len(g.tokenPool) > 0 {
		tokens.TokenPool = append([]string(nil), g.tokenPool...)
	}
	g.mu.RUnlock()

	binData, err := encryptAccountBinary(tokens)
	if err != nil {
		return err
	}

	var wroteAny bool
	var lastErr error
	for _, target := range accountBinPaths() {
		dir := filepath.Dir(target)
		if err := os.MkdirAll(dir, 0700); err != nil {
			lastErr = err
			continue
		}
		if err := os.WriteFile(target, binData, 0600); err != nil {
			lastErr = err
			continue
		}
		wroteAny = true
	}

	// Remove any legacy plaintext .foxyvpn-tokens.json if present
	secureWipeFile(legacyTokenPath())

	if wroteAny {
		g.log("INFO", "Saved encrypted account session to binary store (data/account.bin)")
		return nil
	}
	return lastErr
}

// LoadTokens loads and decrypts the persistent account session from data/account.bin (or migrates legacy tokens).
func (g *GuardianService) LoadTokens() (*SavedTokens, error) {
	for _, candidate := range accountBinPaths() {
		data, err := os.ReadFile(candidate)
		if err != nil || len(data) == 0 {
			continue
		}
		saved, err := decryptAccountBinary(data)
		if err != nil || saved == nil || (saved.AccessToken == "" && saved.SessionToken == "") {
			continue
		}
		g.mu.Lock()
		g.savedTokens = saved
		if len(saved.TokenPool) > 0 {
			g.tokenPool = append([]string(nil), saved.TokenPool...)
		}
		g.mu.Unlock()
		// Ensure all portable/installer paths are synced
		_ = g.SaveTokens(saved)
		return saved, nil
	}

	// Migrate legacy .foxyvpn-tokens.json if found
	if legacyData, err := os.ReadFile(legacyTokenPath()); err == nil && len(legacyData) > 0 {
		var saved SavedTokens
		if err := json.Unmarshal(legacyData, &saved); err == nil && saved.AccessToken != "" {
			g.mu.Lock()
			g.savedTokens = &saved
			g.mu.Unlock()
			_ = g.SaveTokens(&saved)
			secureWipeFile(legacyTokenPath())
			g.log("INFO", "Migrated legacy session into encrypted binary file data/account.bin")
			return &saved, nil
		}
	}

	return nil, os.ErrNotExist
}

func secureWipeFile(path string) {
	if info, err := os.Stat(path); err == nil && !info.IsDir() {
		size := info.Size()
		if size > 0 && size < 10*1024*1024 {
			zeros := make([]byte, size)
			_ = os.WriteFile(path, zeros, 0600)
		}
		_ = os.Remove(path)
	}
}

// Logout invalidates the active FxA session token and securely wipes data/account.bin across all paths.
func (g *GuardianService) Logout() {
	g.mu.Lock()
	var sessTok string
	if g.savedTokens != nil {
		sessTok = g.savedTokens.SessionToken
	}
	g.savedTokens = nil
	g.pendingSession = nil
	g.tokenPool = nil
	g.mu.Unlock()

	if sessTok != "" && len(sessTok) >= 32 {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if hawkID, hawkKey, err := deriveHawkCredentials(sessTok, "sessionToken"); err == nil {
			destroyURL := FxaAuthServer + "/session/destroy"
			bodyJSON := []byte("{}")
			resp, reqErr := g.doWithChallenge(ctx, func() (*http.Request, error) {
				authHeader, hErr := hawkHeader(http.MethodPost, destroyURL, hawkID, hawkKey, string(bodyJSON))
				if hErr != nil {
					return nil, hErr
				}
				req, rErr := http.NewRequestWithContext(ctx, http.MethodPost, destroyURL, bytes.NewReader(bodyJSON))
				if rErr != nil {
					return nil, rErr
				}
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Authorization", authHeader)
				applyMozillaHeaders(req)
				return req, nil
			})
			if reqErr == nil && resp != nil && resp.Body != nil {
				_ = resp.Body.Close()
			}
		}
		cancel()
	}

	for _, p := range accountBinPaths() {
		secureWipeFile(p)
	}
	secureWipeFile(legacyTokenPath())
}
