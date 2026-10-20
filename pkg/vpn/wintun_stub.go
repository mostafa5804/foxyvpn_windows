//go:build !windows

package vpn

import "errors"

// WintunController is a cross-platform stub when building/testing on Linux or macOS.
type WintunController struct{}

func StartWintunAdapter(cfg TunnelConfig, eng *Engine) (*WintunController, error) {
	return nil, errors.New("Wintun driver is only supported on Windows (using SOCKS5/HTTP Proxy fallback)")
}

func (w *WintunController) Close() error {
	return nil
}

func SetWindowsSystemProxy(proxyServer string) error {
	return nil
}

func ClearWindowsSystemProxy() error {
	return nil
}
