//go:build windows

package vpn

import (
	_ "embed"
	"encoding/binary"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
	"golang.zx2c4.com/wintun"
)

//go:embed wintun.dll
var embeddedWintunDLL []byte

const (
	AdapterName = "FoxyVPN-Adapter"
	TunnelType  = "FoxyVPN"
	RingCap     = 0x400000 // 4 MB Wintun ring buffer
)

// EnsureWintunDriver extracts the embedded official WireGuard Wintun v0.14.1 (amd64) driver
// lazily when a TUN session is initiated. In the git repository, pkg/vpn/wintun.dll is a 45-byte
// text placeholder replaced during CI build after verifying the official wintun-0.14.1.zip SHA-256 hash.
func EnsureWintunDriver() error {
	// Official wintun.dll (amd64 v0.14.1) is ~450 KB and starts with DOS/PE magic "MZ"
	if len(embeddedWintunDLL) < 64*1024 || embeddedWintunDLL[0] != 'M' || embeddedWintunDLL[1] != 'Z' {
		return nil
	}

	targetPaths := []string{"wintun.dll"}
	if exePath, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exePath)
		dllInExeDir := filepath.Join(exeDir, "wintun.dll")
		targetPaths = append([]string{dllInExeDir}, targetPaths...)
	}

	for _, p := range targetPaths {
		if info, err := os.Stat(p); err == nil && info.Size() == int64(len(embeddedWintunDLL)) {
			continue
		}
		_ = os.WriteFile(p, embeddedWintunDLL, 0600)
	}
	return nil
}

// WintunController manages the native Windows Wintun virtual adapter, routing table, and packet loop.
type WintunController struct {
	adapter         *wintun.Adapter
	session         wintun.Session
	readWait        windows.Handle
	engine          *Engine
	edgeIP          string
	routesInstalled bool
	stopOnce        sync.Once
	stopCh          chan struct{}
}

// StartWintunAdapter creates or opens "FoxyVPN-Adapter", assigns 10.0.0.2/24, configures split default routes, and launches packet processing.
func StartWintunAdapter(cfg TunnelConfig, eng *Engine) (*WintunController, error) {
	if err := EnsureWintunDriver(); err != nil {
		return nil, fmt.Errorf("ensuring Wintun driver: %w", err)
	}

	adapter, err := wintun.OpenAdapter(AdapterName)
	if err != nil {
		adapter, err = wintun.CreateAdapter(AdapterName, TunnelType, nil)
		if err != nil {
			return nil, fmt.Errorf("wintun.CreateAdapter failed (ensure Administrator privileges & wintun.dll present): %w", err)
		}
	}

	session, err := adapter.StartSession(RingCap)
	if err != nil {
		_ = adapter.Close()
		return nil, fmt.Errorf("wintun.StartSession failed: %w", err)
	}

	edgeIP := cfg.EdgeOverrideIP
	if edgeIP == "" {
		if ips, lookupErr := net.LookupIP(cfg.EdgeHost); lookupErr == nil && len(ips) > 0 {
			for _, ip := range ips {
				if v4 := ip.To4(); v4 != nil {
					edgeIP = v4.String()
					break
				}
			}
		}
	}

	ctrl := &WintunController{
		adapter:  adapter,
		session:  session,
		readWait: session.ReadWaitEvent(),
		engine:   eng,
		edgeIP:   edgeIP,
		stopCh:   make(chan struct{}),
	}

	if err := ctrl.configureNetworkInterface(cfg); err != nil {
		_ = ctrl.Close()
		return nil, err
	}

	go ctrl.packetProcessingLoop()
	return ctrl, nil
}

func (w *WintunController) configureNetworkInterface(cfg TunnelConfig) error {
	// 1. Set IPv4 address 10.0.0.2/24 on FoxyVPN-Adapter and propagate failure if both syntaxes fail
	if err := runHiddenCmd("netsh", "interface", "ip", "set", "address",
		fmt.Sprintf("name=%s", AdapterName), "source=static",
		"addr=10.0.0.2", "mask=255.255.255.0", "none"); err != nil {
		if fallbackErr := runHiddenCmd("netsh", "interface", "ip", "set", "address",
			fmt.Sprintf("name=%s", AdapterName), "static", "10.0.0.2", "255.255.255.0"); fallbackErr != nil {
			return fmt.Errorf("failed to assign IPv4 address 10.0.0.2/24 on %s: %w", AdapterName, err)
		}
	}

	// 2. Set DNS server on the adapter and propagate failure
	dnsServer := cfg.DohProvider
	if dnsServer == "" {
		dnsServer = "1.1.1.1"
	}
	if err := runHiddenCmd("netsh", "interface", "ip", "set", "dns",
		fmt.Sprintf("name=%s", AdapterName), "source=static", fmt.Sprintf("addr=%s", dnsServer), "register=none"); err != nil {
		if fallbackErr := runHiddenCmd("netsh", "interface", "ip", "set", "dns",
			fmt.Sprintf("name=%s", AdapterName), "static", dnsServer); fallbackErr != nil {
			return fmt.Errorf("failed to configure DNS server (%s) on %s: %w", dnsServer, AdapterName, err)
		}
	}

	// 3. Set MTU and propagate failure
	mtu := cfg.MTU
	if mtu <= 0 {
		mtu = 1380
	}
	if err := runHiddenCmd("netsh", "interface", "ipv4", "set", "subinterface",
		AdapterName, fmt.Sprintf("mtu=%d", mtu), "store=active"); err != nil {
		return fmt.Errorf("failed to configure MTU (%d) on %s: %w", mtu, AdapterName, err)
	}

	// 4. Install the two split default routes (0.0.0.0/1 and 128.0.0.0/1 via 10.0.0.1) so TUN mode routes system traffic
	_ = runHiddenCmd("route", "delete", "0.0.0.0", "mask", "128.0.0.0", "10.0.0.1")
	_ = runHiddenCmd("route", "delete", "128.0.0.0", "mask", "128.0.0.0", "10.0.0.1")

	if err := runHiddenCmd("netsh", "interface", "ipv4", "add", "route",
		"0.0.0.0/1", AdapterName, "10.0.0.1", "metric=5", "store=active"); err != nil {
		if fallbackErr := runHiddenCmd("route", "add", "0.0.0.0", "mask", "128.0.0.0", "10.0.0.1", "metric", "5"); fallbackErr != nil {
			return fmt.Errorf("failed to add split default route 0.0.0.0/1 on %s: %w", AdapterName, err)
		}
	}

	if err := runHiddenCmd("netsh", "interface", "ipv4", "add", "route",
		"128.0.0.0/1", AdapterName, "10.0.0.1", "metric=5", "store=active"); err != nil {
		if fallbackErr := runHiddenCmd("route", "add", "128.0.0.0", "mask", "128.0.0.0", "10.0.0.1", "metric", "5"); fallbackErr != nil {
			_ = runHiddenCmd("route", "delete", "0.0.0.0", "mask", "128.0.0.0", "10.0.0.1")
			return fmt.Errorf("failed to add split default route 128.0.0.0/1 on %s: %w", AdapterName, err)
		}
	}

	w.routesInstalled = true
	return nil
}

func (w *WintunController) packetProcessingLoop() {
	for {
		select {
		case <-w.stopCh:
			return
		default:
		}

		pkt, err := w.session.ReceivePacket()
		if err != nil {
			_, _ = windows.WaitForSingleObject(w.readWait, 50)
			continue
		}

		raw := make([]byte, len(pkt))
		copy(raw, pkt)
		w.session.ReleaseReceivePacket(pkt)

		if len(raw) < 20 {
			continue
		}
		version := raw[0] >> 4
		if version != 4 {
			continue
		}
		ihl := int(raw[0]&0x0F) * 4
		if len(raw) < ihl {
			continue
		}
		proto := raw[9]

		// Intercept UDP DNS queries (port 53) and resolve via DoH over the HTTP/2 tunnel
		if proto == 17 && len(raw) >= ihl+8 {
			dstPort := binary.BigEndian.Uint16(raw[ihl+2 : ihl+4])
			if dstPort == 53 {
				go w.handleUDPDNSQuery(raw, ihl)
			}
		}
	}
}

func (w *WintunController) handleUDPDNSQuery(ipPkt []byte, ihl int) {
	udpPayload := ipPkt[ihl+8:]
	if len(udpPayload) < 12 {
		return
	}
	dnsResp, err := w.engine.ResolveDNSOverHTTPS(udpPayload)
	if err != nil || len(dnsResp) == 0 {
		return
	}

	srcIP := ipPkt[12:16]
	dstIP := ipPkt[16:20]
	srcPort := ipPkt[ihl : ihl+2]
	dstPort := ipPkt[ihl+2 : ihl+4]

	totalLen := 20 + 8 + len(dnsResp)
	reply := make([]byte, totalLen)
	reply[0] = 0x45
	binary.BigEndian.PutUint16(reply[2:4], uint16(totalLen))
	reply[8] = 64
	reply[9] = 17 // UDP
	copy(reply[12:16], dstIP)
	copy(reply[16:20], srcIP)
	binary.BigEndian.PutUint16(reply[10:12], ipv4Checksum(reply[:20]))

	copy(reply[20:22], dstPort)
	copy(reply[22:24], srcPort)
	binary.BigEndian.PutUint16(reply[24:26], uint16(8+len(dnsResp)))
	copy(reply[28:], dnsResp)

	sendPkt, err := w.session.AllocateSendPacket(totalLen)
	if err == nil {
		copy(sendPkt, reply)
		w.session.SendPacket(sendPkt)
	}
}

func ipv4Checksum(header []byte) uint16 {
	var sum uint32
	for i := 0; i < len(header)-1; i += 2 {
		sum += uint32(binary.BigEndian.Uint16(header[i : i+2]))
	}
	for (sum >> 16) > 0 {
		sum = (sum & 0xFFFF) + (sum >> 16)
	}
	return ^uint16(sum)
}

// Close resets Windows routes created by this session and closes the Wintun session and adapter.
func (w *WintunController) Close() error {
	w.stopOnce.Do(func() {
		close(w.stopCh)
		if w.routesInstalled {
			_ = runHiddenCmd("route", "delete", "0.0.0.0", "mask", "128.0.0.0", "10.0.0.1")
			_ = runHiddenCmd("route", "delete", "128.0.0.0", "mask", "128.0.0.0", "10.0.0.1")
			w.routesInstalled = false
		}
		w.session.End()
		_ = w.adapter.Close()
	})
	return nil
}

// SetWindowsSystemProxy saves any existing user proxy configuration before enabling FoxyVPN's WinINET proxy in HKCU registry.
func SetWindowsSystemProxy(proxyServer string) error {
	k, err := registry.OpenKey(
		registry.CURRENT_USER,
		`Software\Microsoft\Windows\CurrentVersion\Internet Settings`,
		registry.QUERY_VALUE|registry.SET_VALUE,
	)
	if err != nil {
		return err
	}
	defer k.Close()

	// Save existing user proxy settings once before FoxyVPN modifies them
	if backupActive, _, bErr := k.GetIntegerValue("FoxyVPN_BackupActive"); bErr != nil || backupActive != 1 {
		origEnable, _, enErr := k.GetIntegerValue("ProxyEnable")
		if enErr != nil {
			origEnable = 0
		}
		_ = k.SetDWordValue("FoxyVPN_OrigProxyEnable", uint32(origEnable))

		if origSrv, _, sErr := k.GetStringValue("ProxyServer"); sErr == nil {
			_ = k.SetDWordValue("FoxyVPN_OrigHasProxyServer", 1)
			_ = k.SetStringValue("FoxyVPN_OrigProxyServer", origSrv)
		} else {
			_ = k.SetDWordValue("FoxyVPN_OrigHasProxyServer", 0)
		}

		if origOvr, _, oErr := k.GetStringValue("ProxyOverride"); oErr == nil {
			_ = k.SetDWordValue("FoxyVPN_OrigHasProxyOverride", 1)
			_ = k.SetStringValue("FoxyVPN_OrigProxyOverride", origOvr)
		} else {
			_ = k.SetDWordValue("FoxyVPN_OrigHasProxyOverride", 0)
		}

		if origAuto, _, aErr := k.GetStringValue("AutoConfigURL"); aErr == nil {
			_ = k.SetDWordValue("FoxyVPN_OrigHasAutoConfigURL", 1)
			_ = k.SetStringValue("FoxyVPN_OrigAutoConfigURL", origAuto)
		} else {
			_ = k.SetDWordValue("FoxyVPN_OrigHasAutoConfigURL", 0)
		}

		_ = k.SetDWordValue("FoxyVPN_BackupActive", 1)
	}

	if err := k.SetDWordValue("ProxyEnable", 1); err != nil {
		return err
	}
	if err := k.SetStringValue("ProxyServer", proxyServer); err != nil {
		return err
	}
	_ = k.SetStringValue("ProxyOverride", "localhost;127.*;10.*;192.168.*;<local>")
	refreshWinINET()
	return nil
}

// ClearWindowsSystemProxy restores the user's prior WinINET system proxy configuration in HKCU registry.
func ClearWindowsSystemProxy() error {
	k, err := registry.OpenKey(
		registry.CURRENT_USER,
		`Software\Microsoft\Windows\CurrentVersion\Internet Settings`,
		registry.QUERY_VALUE|registry.SET_VALUE,
	)
	if err != nil {
		return err
	}
	defer k.Close()

	if backupActive, _, bErr := k.GetIntegerValue("FoxyVPN_BackupActive"); bErr == nil && backupActive == 1 {
		origEnable, _, enErr := k.GetIntegerValue("FoxyVPN_OrigProxyEnable")
		if enErr != nil {
			origEnable = 0
		}
		_ = k.SetDWordValue("ProxyEnable", uint32(origEnable))

		if hasSrv, _, _ := k.GetIntegerValue("FoxyVPN_OrigHasProxyServer"); hasSrv == 1 {
			if origSrv, _, sErr := k.GetStringValue("FoxyVPN_OrigProxyServer"); sErr == nil {
				_ = k.SetStringValue("ProxyServer", origSrv)
			}
		} else {
			_ = k.DeleteValue("ProxyServer")
		}

		if hasOvr, _, _ := k.GetIntegerValue("FoxyVPN_OrigHasProxyOverride"); hasOvr == 1 {
			if origOvr, _, oErr := k.GetStringValue("FoxyVPN_OrigProxyOverride"); oErr == nil {
				_ = k.SetStringValue("ProxyOverride", origOvr)
			}
		} else {
			_ = k.DeleteValue("ProxyOverride")
		}

		if hasAuto, _, _ := k.GetIntegerValue("FoxyVPN_OrigHasAutoConfigURL"); hasAuto == 1 {
			if origAuto, _, aErr := k.GetStringValue("FoxyVPN_OrigAutoConfigURL"); aErr == nil {
				_ = k.SetStringValue("AutoConfigURL", origAuto)
			}
		}

		_ = k.DeleteValue("FoxyVPN_BackupActive")
		_ = k.DeleteValue("FoxyVPN_OrigProxyEnable")
		_ = k.DeleteValue("FoxyVPN_OrigHasProxyServer")
		_ = k.DeleteValue("FoxyVPN_OrigProxyServer")
		_ = k.DeleteValue("FoxyVPN_OrigHasProxyOverride")
		_ = k.DeleteValue("FoxyVPN_OrigProxyOverride")
		_ = k.DeleteValue("FoxyVPN_OrigHasAutoConfigURL")
		_ = k.DeleteValue("FoxyVPN_OrigAutoConfigURL")
		refreshWinINET()
		return nil
	}

	// If no snapshot is active, only disable ProxyEnable if ProxyServer still points to FoxyVPN's local loopback listener
	if curSrv, _, sErr := k.GetStringValue("ProxyServer"); sErr == nil &&
		(curSrv == "127.0.0.1:8080" || curSrv == "127.0.0.1:1080") {
		_ = k.SetDWordValue("ProxyEnable", 0)
		refreshWinINET()
	}
	return nil
}

// EngageKillSwitch blocks direct non-tunnel outbound internet traffic via Windows Firewall when an active tunnel drops unexpectedly.
func EngageKillSwitch(edgeIP string) error {
	_ = DisengageKillSwitch()

	_ = runHiddenCmd("netsh", "advfirewall", "firewall", "add", "rule",
		"name=FoxyVPN-KillSwitch-AllowLoopback", "dir=out", "action=allow", "remoteip=127.0.0.0/8", "enable=yes")

	if edgeIP != "" {
		_ = runHiddenCmd("netsh", "advfirewall", "firewall", "add", "rule",
			"name=FoxyVPN-KillSwitch-AllowEdge", "dir=out", "action=allow", fmt.Sprintf("remoteip=%s", edgeIP), "enable=yes")
	}

	if err := runHiddenCmd("netsh", "advfirewall", "firewall", "add", "rule",
		"name=FoxyVPN-KillSwitch-BlockAll", "dir=out", "action=block", "remoteip=0.0.0.0/0", "enable=yes"); err != nil {
		return fmt.Errorf("failed to engage Windows Firewall Kill Switch: %w", err)
	}
	return nil
}

// DisengageKillSwitch removes FoxyVPN Kill Switch firewall rules on intentional disconnect or reconnect.
func DisengageKillSwitch() error {
	_ = runHiddenCmd("netsh", "advfirewall", "firewall", "delete", "rule", "name=FoxyVPN-KillSwitch-BlockAll")
	_ = runHiddenCmd("netsh", "advfirewall", "firewall", "delete", "rule", "name=FoxyVPN-KillSwitch-AllowEdge")
	_ = runHiddenCmd("netsh", "advfirewall", "firewall", "delete", "rule", "name=FoxyVPN-KillSwitch-AllowLoopback")
	return nil
}

func refreshWinINET() {
	wininet := syscall.NewLazyDLL("wininet.dll")
	proc := wininet.NewProc("InternetSetOptionW")
	_, _, _ = proc.Call(0, 39, 0, 0) // INTERNET_OPTION_SETTINGS_CHANGED
	_, _, _ = proc.Call(0, 37, 0, 0) // INTERNET_OPTION_REFRESH
}

func runHiddenCmd(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Run()
}

