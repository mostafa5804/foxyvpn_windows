package auth

import (
	"bytes"
	"context"
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
	maxChallengeAttempts       = 5
	maxPostBackRounds          = 4
	fxaCallMinBudget           = 90 * time.Second
	controlPlaneHTTPTimeout    = 30 * time.Second
	verificationMethodEmail2FA = "email-2fa"
	fxaErrnoInvalidParameter   = 107
	tokenFileName              = ".foxyvpn-tokens.json"
	DefaultMonthlyAllowance    = int64(50) * 1024 * 1024 * 1024 // 50 GB
)

var (
	ErrTokenInvalid      = errors.New("access token was rejected by Guardian (401/403)")
	ErrQuotaExceeded     = errors.New("monthly 50 GB VPN quota exceeded (429)")
	ErrVerificationNeede = errors.New("email 6-digit verification code required")

	challengePrefixRegex = regexp.MustCompile(`/_fs-ch-[A-Za-z0-9._-]+`)
	initCallRegex        = regexp.MustCompile(`init\(\s*(\[[\s\S]*?\])\s*,\s*"([^"]+)"`)
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

// SavedTokens persists OAuth and session credentials on disk.
type SavedTokens struct {
	Email        string    `json:"email"`
	UID          string    `json:"uid"`
	SessionToken string    `json:"session_token,omitempty"`
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	Scope        string    `json:"scope"`
	ObtainedAt   time.Time `json:"obtained_at"`
	ExpiresIn    int       `json:"expires_in"`
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
	QuotaReset       int64  `json:"quotaReset"`
}

// ProxyPassInfo holds the short-lived JWT Bearer token for Fastly HTTP/2 CONNECT.
type ProxyPassInfo struct {
	Token          string `json:"token"`
	ExpiresAt      int64  `json:"expires_at"`
	QuotaMax       int64  `json:"quota_max"`
	QuotaRemaining int64  `json:"quota_remaining"`
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
	req.Header.Set("User-Agent", MozillaVPNUserAgent)
	req.Header.Set("Accept", "application/json")
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
		if resp.StatusCode != http.StatusNotAcceptable {
			return resp, nil
		}
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		_ = resp.Body.Close()

		g.log("WARN", "Fastly anti-bot challenge triggered (HTTP 406), solving challenge (attempt %d/%d)...", attempt, maxChallengeAttempts)
		if solveErr := g.solveFastlyChallenge(ctx, req.URL.Scheme+"://"+req.URL.Host); solveErr != nil {
			g.log("WARN", "Fastly challenge solver warning: %v", solveErr)
		}
	}
	return nil, fmt.Errorf("Fastly anti-bot challenge persisted after %d attempts (HTTP 406)", maxChallengeAttempts)
}

// solveFastlyChallenge implements the Fastly PoW/PAT/ClientMetrics challenge solver.
func (g *GuardianService) solveFastlyChallenge(ctx context.Context, baseHost string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseHost+"/", nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", SolverUserAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return err
	}
	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	_ = resp.Body.Close()
	page := string(bodyBytes)

	if !strings.Contains(page, "/_fs-ch-") {
		return nil
	}
	prefix := challengePrefixRegex.FindString(page)
	if prefix == "" {
		return errors.New("Fastly challenge prefix not found in HTML")
	}
	prefixURL := baseHost + prefix

	scriptReq, err := http.NewRequestWithContext(ctx, http.MethodGet, prefixURL+"/script.js?reload=true", nil)
	if err != nil {
		return err
	}
	scriptReq.Header.Set("User-Agent", SolverUserAgent)
	scriptResp, err := g.httpClient.Do(scriptReq)
	if err != nil {
		return err
	}
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
				answers = append(answers, map[string]any{
					"ty":      "pow",
					"base":    baseStr,
					"answer":  ans,
					"hmac":    hmacStr,
					"expires": expiresStr,
				})
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
						"client_data": "{}",
						"error_trace": nil,
					},
					"detector_results": map[string]any{},
					"v":                2,
				})
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
		postReq.Header.Set("Accept", "application/json")
		postReq.Header.Set("User-Agent", SolverUserAgent)
		postReq.Header.Set("Origin", baseHost)

		postResp, err := g.httpClient.Do(postReq)
		if err != nil {
			return err
		}
		respData, _ := io.ReadAll(io.LimitReader(postResp.Body, 64*1024))
		_ = postResp.Body.Close()

		var parsed map[string]any
		if err := json.Unmarshal(respData, &parsed); err != nil {
			return err
		}
		if status, _ := parsed["status"].(string); status == "success" {
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
	target, err := hex.DecodeString(targetHex)
	if err != nil || len(target) != 32 {
		return "", false
	}
	for i := 0; i < len(powAlphabet); i++ {
		for j := 0; j < len(powAlphabet); j++ {
			suffix := string([]byte{powAlphabet[i], powAlphabet[j]})
			sum := sha256.Sum256([]byte(baseStr + suffix))
			if bytes.Equal(sum[:], target) {
				return suffix, true
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

// VerifyEmailCode verifies a 6-digit code sent to the user's email for either Sign-In or Sign-Up,
// exchanges the sessionToken for OAuth tokens, and activates the 50 GB Guardian FPN entitlement.
func (g *GuardianService) VerifyEmailCode(ctx context.Context, code string) (*SavedTokens, *Entitlement, error) {
	g.mu.RLock()
	pending := g.pendingSession
	g.mu.RUnlock()

	if pending == nil || pending.SessionToken == "" {
		return nil, nil, errors.New("no pending login or registration session to verify")
	}

	code = strings.TrimSpace(code)
	hawkID, hawkKey, err := deriveHawkCredentials(pending.SessionToken, "sessionToken")
	if err != nil {
		return nil, nil, err
	}

	// Try session/verify_code first; for newly registered accounts, also support recovery_email/verify_code
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

	if resp.StatusCode != http.StatusOK && pending.IsSignUp {
		// Fallback for new account creation verification endpoint
		altBody, _ := json.Marshal(map[string]string{
			"uid":  pending.UID,
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
		if altErr != nil {
			return nil, nil, altErr
		}
		altData, _ := io.ReadAll(io.LimitReader(altResp.Body, 16*1024))
		_ = altResp.Body.Close()
		if altResp.StatusCode != http.StatusOK {
			return nil, nil, fmt.Errorf("email verification failed (HTTP %d): %s", altResp.StatusCode, string(altData))
		}
	} else if resp.StatusCode != http.StatusOK {
		return nil, nil, fmt.Errorf("verification code rejected (HTTP %d): %s", resp.StatusCode, string(respData))
	}

	g.log("INFO", "Email verification succeeded for %s", pending.Email)
	return g.CompleteSessionLogin(ctx, pending.Email, pending.UID, pending.SessionToken)
}

// CompleteSessionLogin exchanges a verified FxA sessionToken for OAuth tokens and fetches/activates the 50 GB Guardian entitlement.
func (g *GuardianService) CompleteSessionLogin(ctx context.Context, email, uid, sessionToken string) (*SavedTokens, *Entitlement, error) {
	tokResp, err := g.ExchangeOAuthToken(ctx, sessionToken)
	if err != nil {
		return nil, nil, err
	}

	saved := &SavedTokens{
		Email:        email,
		UID:          uid,
		SessionToken: sessionToken,
		AccessToken:  tokResp.AccessToken,
		RefreshToken: tokResp.RefreshToken,
		Scope:        tokResp.Scope,
		ObtainedAt:   time.Now(),
		ExpiresIn:    tokResp.ExpiresIn,
	}
	_ = g.SaveTokens(saved)

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

// EnsureGuardianEntitlement checks /api/v1/fpn/status and calls /api/v1/fpn/activate if needed.
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
		if pass.QuotaRemaining >= 0 {
			ent.QuotaRemaining = pass.QuotaRemaining
		}
		ent.QuotaReset = pass.QuotaReset
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
	if ent.MaxBytes <= 0 {
		ent.MaxBytes = DefaultMonthlyAllowance
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
	if ent.MaxBytes <= 0 {
		ent.MaxBytes = DefaultMonthlyAllowance
	}
	return &ent, nil
}

// FetchProxyPass calls GET https://vpn.mozilla.org/api/v1/fpn/token and reads X-Quota-* headers.
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

	quotaMax, _ := strconv.ParseInt(resp.Header.Get("X-Quota-Limit"), 10, 64)
	quotaRem, _ := strconv.ParseInt(resp.Header.Get("X-Quota-Remaining"), 10, 64)
	quotaReset, _ := strconv.ParseInt(resp.Header.Get("X-Quota-Reset"), 10, 64)
	if quotaMax <= 0 {
		quotaMax = DefaultMonthlyAllowance
	}

	return &ProxyPassInfo{
		Token:          parsed.Token,
		ExpiresAt:      expiresAt,
		QuotaMax:       quotaMax,
		QuotaRemaining: quotaRem,
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
	for _, raw := range envelope.Data {
		var wrapper struct {
			Country *Country `json:"country"`
		}
		if err := json.Unmarshal(raw, &wrapper); err == nil && wrapper.Country != nil && wrapper.Country.Code != "" {
			if !strings.EqualFold(wrapper.Country.Name, "CatchAll Anycast") && len(wrapper.Country.Cities) > 0 {
				countries = append(countries, *wrapper.Country)
				continue
			}
		}
		var c Country
		if err := json.Unmarshal(raw, &c); err == nil && c.Code != "" && len(c.Cities) > 0 {
			if !strings.EqualFold(c.Name, "CatchAll Anycast") {
				countries = append(countries, c)
			}
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

func tokenPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return tokenFileName
	}
	return filepath.Join(home, tokenFileName)
}

func (g *GuardianService) SaveTokens(tokens *SavedTokens) error {
	data, err := json.MarshalIndent(tokens, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(tokenPath(), data, 0600)
}

func (g *GuardianService) LoadTokens() (*SavedTokens, error) {
	data, err := os.ReadFile(tokenPath())
	if err != nil {
		return nil, err
	}
	var saved SavedTokens
	if err := json.Unmarshal(data, &saved); err != nil {
		return nil, err
	}
	return &saved, nil
}

func (g *GuardianService) Logout() {
	g.mu.Lock()
	g.savedTokens = nil
	g.pendingSession = nil
	g.tokenPool = nil
	g.mu.Unlock()
	_ = os.Remove(tokenPath())
}
