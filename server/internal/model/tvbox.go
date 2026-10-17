package model

import (
	"encoding/json"
	"strings"
)

const (
	MaxTVBoxNameLen            = 64
	MaxTVBoxURLLen             = 512
	TVBoxSourceNamePlaceholder = "{name}"
	DefaultTVBoxSiteName       = "🌟 EcoHub 私人影视库全量"
	DefaultTVBoxSourceName     = "📡 " + TVBoxSourceNamePlaceholder
)

// TVBoxConfig TVBox/影视仓 一键配置（/api/provide/tvbox）输出定制
type TVBoxConfig struct {
	SiteName    string `json:"siteName"`    // 全量线路名称
	SourceName  string `json:"sourceName"`  // 单个采集源线路名称模板，{name} 替换为采集源名称
	HideSources bool   `json:"hideSources"` // 不输出单个采集源线路，仅保留全量线路
	Spider      string `json:"spider"`      // 爬虫 jar 地址（可带 ;md5;xxx），部分客户端为空时会报 jar 下载失败
	Wallpaper   string `json:"wallpaper"`   // 壁纸地址
	Logo        string `json:"logo"`        // Logo 地址
}

// DefaultTVBoxConfig 与历史硬编码输出一致的默认配置
func DefaultTVBoxConfig() TVBoxConfig {
	return TVBoxConfig{
		SiteName:   DefaultTVBoxSiteName,
		SourceName: DefaultTVBoxSourceName,
	}
}

// NormalizeTVBoxConfig 清洗 TVBox 配置；名称为空回退默认，模板缺少 {name} 时按前缀处理
func NormalizeTVBoxConfig(t TVBoxConfig) TVBoxConfig {
	siteName := truncateRunes(strings.TrimSpace(t.SiteName), MaxTVBoxNameLen)
	if siteName == "" {
		siteName = DefaultTVBoxSiteName
	}

	sourceName := truncateRunes(strings.TrimSpace(t.SourceName), MaxTVBoxNameLen)
	if sourceName == "" {
		sourceName = DefaultTVBoxSourceName
	} else if !strings.Contains(sourceName, TVBoxSourceNamePlaceholder) {
		sourceName += " " + TVBoxSourceNamePlaceholder
	}

	return TVBoxConfig{
		SiteName:    siteName,
		SourceName:  sourceName,
		HideSources: t.HideSources,
		Spider:      truncateRunes(strings.TrimSpace(t.Spider), MaxTVBoxURLLen),
		Wallpaper:   truncateRunes(strings.TrimSpace(t.Wallpaper), MaxTVBoxURLLen),
		Logo:        truncateRunes(strings.TrimSpace(t.Logo), MaxTVBoxURLLen),
	}
}

// FormatSourceName 按模板生成单个采集源线路名称
func (t TVBoxConfig) FormatSourceName(name string) string {
	return strings.ReplaceAll(t.SourceName, TVBoxSourceNamePlaceholder, name)
}

// EncodeTVBoxJSON 将 TVBox 配置编码为持久化 JSON
func EncodeTVBoxJSON(t TVBoxConfig) string {
	raw, err := json.Marshal(NormalizeTVBoxConfig(t))
	if err != nil {
		return ""
	}
	return string(raw)
}

// DecodeTVBoxJSON 解析 TVBox 配置 JSON，非法或空值回退默认
func DecodeTVBoxJSON(raw string) TVBoxConfig {
	if strings.TrimSpace(raw) == "" {
		return DefaultTVBoxConfig()
	}
	var t TVBoxConfig
	if err := json.Unmarshal([]byte(raw), &t); err != nil {
		return DefaultTVBoxConfig()
	}
	return NormalizeTVBoxConfig(t)
}
