package auth

import (
	"encoding/binary"
	"errors"
	"net"
	"sync/atomic"
)

// HelloSplitMode defines how TLS ClientHello packets are fragmented across TCP segments
// to bypass deep packet inspection (DPI) SNI filtering.
const (
	HelloSplitOff       = "off"
	HelloSplitSNI       = "sni"
	HelloSplitFirstByte = "first-byte"
	HelloSplitRecord    = "record"
)

var defaultHelloSplitMode atomic.Pointer[string]

func init() {
	mode := HelloSplitSNI
	defaultHelloSplitMode.Store(&mode)
}

// SetHelloSplitMode configures the process-wide ClientHello splitting mode.
func SetHelloSplitMode(mode string) {
	if mode == "" {
		mode = HelloSplitSNI
	}
	defaultHelloSplitMode.Store(&mode)
}

// GetHelloSplitMode returns the active ClientHello splitting mode.
func GetHelloSplitMode() string {
	if m := defaultHelloSplitMode.Load(); m != nil {
		return *m
	}
	return HelloSplitSNI
}

// WrapHelloSplit wraps a net.Conn so that outgoing TLS ClientHello messages
// are transparently split across multiple TCP segments or TLS records.
// This prevents Iranian DPI firewalls from matching SNI hostnames (e.g., *.workers.dev).
func WrapHelloSplit(conn net.Conn) net.Conn {
	mode := GetHelloSplitMode()
	if mode == HelloSplitOff || mode == "" {
		return conn
	}
	return &helloSplitConn{Conn: conn, mode: mode}
}

type helloSplitConn struct {
	net.Conn
	mode string
}

func (c *helloSplitConn) Write(p []byte) (int, error) {
	if !isTLSClientHello(p) {
		return c.Conn.Write(p)
	}

	if c.mode == HelloSplitRecord {
		return c.writeRecords(p)
	}

	segments, err := splitSegments(p, c.mode)
	if err != nil {
		return c.Conn.Write(p)
	}

	total := 0
	for _, seg := range segments {
		n, err := c.Conn.Write(seg)
		total += n
		if err != nil {
			return total, err
		}
	}
	return total, nil
}

func (c *helloSplitConn) writeRecords(p []byte) (int, error) {
	out, err := makeTwoRecords(p)
	if err != nil {
		return c.Conn.Write(p)
	}
	if _, err := c.Conn.Write(out); err != nil {
		return 0, err
	}
	return len(p), nil
}

func isTLSClientHello(p []byte) bool {
	return len(p) > 5 && p[0] == 0x16 && p[1] == 0x03 && p[5] == 0x01
}

func splitSegments(p []byte, mode string) ([][]byte, error) {
	switch mode {
	case HelloSplitFirstByte:
		if len(p) <= 1 {
			return [][]byte{p}, nil
		}
		return [][]byte{p[:1], p[1:]}, nil
	case HelloSplitSNI:
		start, err := findServerNameOffset(p)
		if err != nil {
			// Fallback: split after 64 bytes if SNI offset cannot be parsed
			if len(p) > 64 {
				return [][]byte{p[:64], p[64:]}, nil
			}
			return [][]byte{p}, nil
		}
		// Cut right after the first character of the server name
		return [][]byte{p[:start], p[start : start+1], p[start+1:]}, nil
	default:
		return [][]byte{p}, nil
	}
}

func makeTwoRecords(p []byte) ([]byte, error) {
	const headerLen = 5
	if len(p) <= headerLen {
		return nil, errors.New("record too short")
	}
	recordPayloadLen := int(binary.BigEndian.Uint16(p[3:]))
	if recordPayloadLen != len(p)-headerLen {
		return nil, errors.New("not a single record")
	}

	start, err := findServerNameOffset(p)
	if err != nil {
		return nil, err
	}
	cut := start + 1
	if cut <= headerLen || cut >= len(p) {
		return nil, errors.New("invalid cut point")
	}

	out := make([]byte, 0, len(p)+headerLen)
	// Record 1
	out = append(out, p[:3]...)
	out = binary.BigEndian.AppendUint16(out, uint16(cut-headerLen))
	out = append(out, p[headerLen:cut]...)
	// Record 2
	out = append(out, p[:3]...)
	out = binary.BigEndian.AppendUint16(out, uint16(len(p)-cut))
	out = append(out, p[cut:]...)
	return out, nil
}

func findServerNameOffset(p []byte) (int, error) {
	errBad := errors.New("not a valid ClientHello with SNI")
	at := 5 + 4 + 2 + 32 // Record header(5) + Handshake header(4) + Version(2) + Random(32)

	skip := func(lenBytes int) bool {
		if at+lenBytes > len(p) {
			return false
		}
		n := 0
		for _, b := range p[at : at+lenBytes] {
			n = (n << 8) | int(b)
		}
		at += lenBytes + n
		return at <= len(p)
	}

	// Session ID, Cipher Suites, Compression Methods
	if !skip(1) || !skip(2) || !skip(1) || at+2 > len(p) {
		return 0, errBad
	}

	extensionsLen := int(binary.BigEndian.Uint16(p[at:]))
	at += 2
	end := at + extensionsLen
	if end > len(p) {
		end = len(p)
	}

	for at+4 <= end {
		extType := binary.BigEndian.Uint16(p[at:])
		extSize := int(binary.BigEndian.Uint16(p[at+2:]))
		body := at + 4
		if body+extSize > end {
			return 0, errBad
		}
		if extType == 0 { // server_name extension
			if extSize < 6 || p[body+2] != 0 {
				return 0, errBad
			}
			nameLen := int(binary.BigEndian.Uint16(p[body+3:]))
			if nameLen == 0 || body+5+nameLen > end {
				return 0, errBad
			}
			return body + 5, nil
		}
		at = body + extSize
	}

	return 0, errBad
}
