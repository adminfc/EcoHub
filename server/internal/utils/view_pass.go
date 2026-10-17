package utils

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"strings"

	"server/internal/config"
)

// ViewPassToken 由观看密码（即订阅密钥）派生 Cookie 凭证：
// 不在 Cookie 中保存明文密码；管理员修改密码后旧凭证自动失效。
func ViewPassToken(password string) string {
	mac := hmac.New(sha256.New, []byte(config.JwtSecret))
	mac.Write([]byte("ecohub-view-pass:" + strings.TrimSpace(password)))
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifyViewPassToken 校验 Cookie 凭证是否对应当前观看密码
func VerifyViewPassToken(token, password string) bool {
	password = strings.TrimSpace(password)
	token = strings.TrimSpace(token)
	if password == "" || token == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(token), []byte(ViewPassToken(password))) == 1
}

// VerifyViewPassword 恒定时间校验观看密码
func VerifyViewPassword(input, password string) bool {
	input = strings.TrimSpace(input)
	password = strings.TrimSpace(password)
	if input == "" || password == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(input), []byte(password)) == 1
}
