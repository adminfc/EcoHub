package handler

import (
	"net/http"
	"strings"

	"server/internal/config"
	"server/internal/infra/db"
	"server/internal/model/dto"
	"server/internal/repository"
	"server/internal/utils"

	"github.com/gin-gonic/gin"
)

// ViewHandler 私有化模式下的观看密码（即订阅密钥）校验
type ViewHandler struct{}

var ViewHd = new(ViewHandler)

type viewUnlockRequest struct {
	Password string `json:"password"`
}

func setViewPassCookie(c *gin.Context, token string) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(config.ViewPassCookieName, token, config.ViewPassCookieMaxAge, "/", "", useSecureCookie(c), true)
}

// hasValidLogin 是否携带有效登录态（与 PrivateAccessGuard 的判定保持一致）
func hasValidLogin(c *gin.Context) bool {
	token, _ := c.Cookie(config.AuthCookieName)
	if token == "" {
		return false
	}
	uc, err := utils.ParseToken(token)
	return err == nil && uc != nil && uc.ID != ""
}

// Status 当前访客是否可以观看：未开启私有化、已登录或已输入正确观看密码
func (h *ViewHandler) Status(c *gin.Context) {
	cfg := repository.GetSiteBasic()
	unlocked := !cfg.PrivateAccess || hasValidLogin(c)
	if !unlocked {
		viewPass, _ := c.Cookie(config.ViewPassCookieName)
		unlocked = utils.VerifyViewPassToken(viewPass, cfg.ProvideKey)
	}
	dto.Success(gin.H{"privateAccess": cfg.PrivateAccess, "unlocked": unlocked}, "ok", c)
}

// Unlock 校验观看密码，通过后写入长期有效的 Cookie 凭证
func (h *ViewHandler) Unlock(c *gin.Context) {
	var req viewUnlockRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Password) == "" {
		dto.Failed("请输入观看密码", c)
		return
	}

	cfg := repository.GetSiteBasic()
	if !cfg.PrivateAccess {
		dto.SuccessOnlyMsg("当前站点无需观看密码", c)
		return
	}

	failKey := config.ViewUnlockFailKey + ":" + c.ClientIP()
	if db.Rdb != nil {
		if fails, _ := db.Rdb.Get(db.Cxt, failKey).Int(); fails >= config.ViewUnlockMaxFails {
			dto.Failed("密码错误次数过多，请 10 分钟后再试", c)
			return
		}
	}

	if !utils.VerifyViewPassword(req.Password, cfg.ProvideKey) {
		if db.Rdb != nil {
			if n, err := db.Rdb.Incr(db.Cxt, failKey).Result(); err == nil && n == 1 {
				db.Rdb.Expire(db.Cxt, failKey, config.ViewUnlockFailWindow)
			}
		}
		dto.Failed("观看密码错误", c)
		return
	}

	if db.Rdb != nil {
		db.Rdb.Del(db.Cxt, failKey)
	}
	setViewPassCookie(c, utils.ViewPassToken(cfg.ProvideKey))
	dto.SuccessOnlyMsg("验证成功", c)
}
