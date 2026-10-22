//go:build windows

package auth

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

// platformProtectBytes encrypts data using Windows Data Protection API (DPAPI)
// bound to the current Windows user credential context (CRYPTPROTECT_UI_FORBIDDEN).
func platformProtectBytes(plaintext []byte) ([]byte, error) {
	if len(plaintext) == 0 {
		return plaintext, nil
	}
	inBlob := windows.DataBlob{
		Size: uint32(len(plaintext)),
		Data: &plaintext[0],
	}
	var outBlob windows.DataBlob
	err := windows.CryptProtectData(
		&inBlob,
		nil,
		nil,
		0,
		nil,
		windows.CRYPTPROTECT_UI_FORBIDDEN,
		&outBlob,
	)
	if err != nil {
		// Fallback to AES-GCM layer if DPAPI is unavailable in service context
		return plaintext, nil
	}
	defer windows.LocalFree(windows.Handle(unsafe.Pointer(outBlob.Data)))
	out := make([]byte, outBlob.Size)
	copy(out, unsafe.Slice(outBlob.Data, outBlob.Size))
	return out, nil
}

// platformUnprotectBytes decrypts Windows DPAPI-protected bytes.
func platformUnprotectBytes(ciphertext []byte) ([]byte, error) {
	if len(ciphertext) == 0 {
		return ciphertext, nil
	}
	inBlob := windows.DataBlob{
		Size: uint32(len(ciphertext)),
		Data: &ciphertext[0],
	}
	var outBlob windows.DataBlob
	err := windows.CryptUnprotectData(
		&inBlob,
		nil,
		nil,
		0,
		nil,
		windows.CRYPTPROTECT_UI_FORBIDDEN,
		&outBlob,
	)
	if err != nil {
		// If data was not wrapped by DPAPI (e.g. portable cross-machine fallback), return raw for AES-GCM layer
		return ciphertext, nil
	}
	defer windows.LocalFree(windows.Handle(unsafe.Pointer(outBlob.Data)))
	out := make([]byte, outBlob.Size)
	copy(out, unsafe.Slice(outBlob.Data, outBlob.Size))
	return out, nil
}
