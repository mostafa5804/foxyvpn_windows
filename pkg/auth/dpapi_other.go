//go:build !windows

package auth

func platformProtectBytes(plaintext []byte) ([]byte, error) {
	return plaintext, nil
}

func platformUnprotectBytes(ciphertext []byte) ([]byte, error) {
	return ciphertext, nil
}
