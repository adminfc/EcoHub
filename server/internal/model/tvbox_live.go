package model

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
)

const (
	MaxTVBoxLives          = 20
	MaxTVBoxLiveURLLen     = 1024
	MaxTVBoxLiveUALen      = 256
	MaxTVBoxChannelsBytes  = 256 * 1024 // 自定义频道列表上限（字节）
	DefaultTVBoxLiveName   = "📺 直播"
	DefaultTVBoxCustomName = "📺 EcoHub 直播频道"
)

// TVBoxLive 一条外部直播源（对应 TVBox config.json 的 lives[]，type=0：TXT / M3U）
type TVBoxLive struct {
	Enabled bool   `json:"enabled"`
	Name    string `json:"name"` // 直播线路名称
	URL     string `json:"url"`  // 直播源地址（txt / m3u），以 / 开头时补全为订阅域名
	EPG     string `json:"epg"`  // 节目单地址，支持 {name} {date} 占位符
	Logo    string `json:"logo"` // 台标地址，支持 {name} 占位符
	UA      string `json:"ua"`   // 播放请求 User-Agent
}

// TVBoxCustomChannels 站内托管的自定义频道列表，经 /api/provide/tvbox/live 输出
type TVBoxCustomChannels struct {
	Enabled bool   `json:"enabled"`
	Name    string `json:"name"`
	EPG     string `json:"epg"`
	Logo    string `json:"logo"`
	UA      string `json:"ua"`
	Content string `json:"content"` // TXT（分组,#genre# / 频道名,地址）或 M3U（#EXTM3U）
}

// TVBoxLiveConfig TVBox 直播电视频道配置（独立存储，避免放大每次请求都会读取的站点基础配置）
type TVBoxLiveConfig struct {
	Lives  []TVBoxLive         `json:"lives"`
	Custom TVBoxCustomChannels `json:"custom"`
}

// TVBoxLiveConfigRecord 直播配置持久化模型
type TVBoxLiveConfigRecord struct {
	gorm.Model
	Payload string `gorm:"type:mediumtext"`
}

func (TVBoxLiveConfigRecord) TableName() string {
	return TableTVBoxLiveConfig
}

// DefaultTVBoxLiveConfig 默认不输出任何直播线路
func DefaultTVBoxLiveConfig() TVBoxLiveConfig {
	return TVBoxLiveConfig{
		Lives:  []TVBoxLive{},
		Custom: TVBoxCustomChannels{Name: DefaultTVBoxCustomName},
	}
}

func trimLimit(raw string, max int) string {
	return truncateRunes(strings.TrimSpace(raw), max)
}

// NormalizeTVBoxChannels 统一换行并限制大小（按字节截断到完整行）
func NormalizeTVBoxChannels(raw string) string {
	raw = strings.ReplaceAll(raw, "\r\n", "\n")
	raw = strings.ReplaceAll(raw, "\r", "\n")
	raw = strings.TrimPrefix(raw, "\uFEFF")
	raw = strings.TrimSpace(raw)
	if len(raw) > MaxTVBoxChannelsBytes {
		raw = raw[:MaxTVBoxChannelsBytes]
		if i := strings.LastIndexByte(raw, '\n'); i > 0 {
			raw = raw[:i]
		}
		raw = strings.ToValidUTF8(raw, "")
	}
	return raw
}

// NormalizeTVBoxLiveConfig 清洗直播配置：丢弃无地址的线路，名称为空时按序号补全
func NormalizeTVBoxLiveConfig(c TVBoxLiveConfig) TVBoxLiveConfig {
	lives := make([]TVBoxLive, 0, len(c.Lives))
	for _, l := range c.Lives {
		if len(lives) >= MaxTVBoxLives {
			break
		}
		l = TVBoxLive{
			Enabled: l.Enabled,
			Name:    trimLimit(l.Name, MaxTVBoxNameLen),
			URL:     trimLimit(l.URL, MaxTVBoxLiveURLLen),
			EPG:     trimLimit(l.EPG, MaxTVBoxLiveURLLen),
			Logo:    trimLimit(l.Logo, MaxTVBoxLiveURLLen),
			UA:      trimLimit(l.UA, MaxTVBoxLiveUALen),
		}
		if l.URL == "" {
			continue
		}
		if l.Name == "" {
			l.Name = fmt.Sprintf("%s %d", DefaultTVBoxLiveName, len(lives)+1)
		}
		lives = append(lives, l)
	}

	custom := TVBoxCustomChannels{
		Enabled: c.Custom.Enabled,
		Name:    trimLimit(c.Custom.Name, MaxTVBoxNameLen),
		EPG:     trimLimit(c.Custom.EPG, MaxTVBoxLiveURLLen),
		Logo:    trimLimit(c.Custom.Logo, MaxTVBoxLiveURLLen),
		UA:      trimLimit(c.Custom.UA, MaxTVBoxLiveUALen),
		Content: NormalizeTVBoxChannels(c.Custom.Content),
	}
	if custom.Name == "" {
		custom.Name = DefaultTVBoxCustomName
	}
	return TVBoxLiveConfig{Lives: lives, Custom: custom}
}

// HasCustomChannels 自定义频道列表是否需要输出
func (c TVBoxLiveConfig) HasCustomChannels() bool {
	return c.Custom.Enabled && c.Custom.Content != ""
}
