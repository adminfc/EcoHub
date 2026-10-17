package utils

import (
	"testing"

	"server/internal/config"
)

func TestViewPassToken(t *testing.T) {
	config.JwtSecret = "test-secret"

	token := ViewPassToken("abc123")
	if !VerifyViewPassToken(token, "abc123") {
		t.Fatal("token should verify against the same password")
	}
	if VerifyViewPassToken(token, "changed") {
		t.Fatal("token must be invalid after the password changes")
	}
	if VerifyViewPassToken("", "abc123") || VerifyViewPassToken(token, "") {
		t.Fatal("empty token or password must never verify")
	}
	if token == "abc123" || len(token) != 64 {
		t.Fatalf("token should be a hex HMAC, got %q", token)
	}
}

func TestVerifyViewPassword(t *testing.T) {
	if !VerifyViewPassword(" abc123 ", "abc123") {
		t.Fatal("surrounding spaces should be ignored")
	}
	if VerifyViewPassword("abc12", "abc123") || VerifyViewPassword("", "") {
		t.Fatal("wrong or empty password must not verify")
	}
}
