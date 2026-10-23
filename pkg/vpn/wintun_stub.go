//go:build !windows

package vpn

import "errors"

// WintunController is a cross-platform stub when building/testing on Linux or macOS.
type WintunController struct{}

func EnsureWintunDriver() error {
	return nil
}

func StartWintunAdapter(cfg TunnelConfig, eng *Engine) (*WintunController, error) {
	return nil, errors.New("Wintun virtual adapter is only supported on Windows")
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

func EngageKillSwitch(edgeIP string) error {
	return nil
}

func DisengageKillSwitch() error {
	return nil
}
