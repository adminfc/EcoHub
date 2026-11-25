package repository

import (
	"encoding/json"
	"log"

	"server/internal/config"
	"server/internal/infra/db"
	"server/internal/model"

	"gorm.io/gorm"
)

// GetTVBoxLiveConfig 获取 TVBox 直播电视频道配置（Redis 优先，MySQL 兜底）
func GetTVBoxLiveConfig() model.TVBoxLiveConfig {
	if db.Rdb != nil {
		if data := db.Rdb.Get(db.Cxt, config.TVBoxLiveConfigKey).Val(); data != "" {
			var cfg model.TVBoxLiveConfig
			if err := json.Unmarshal([]byte(data), &cfg); err == nil {
				return model.NormalizeTVBoxLiveConfig(cfg)
			}
			db.Rdb.Del(db.Cxt, config.TVBoxLiveConfigKey)
		}
	}

	cfg := model.DefaultTVBoxLiveConfig()
	if db.Mdb == nil {
		return cfg
	}
	var rec model.TVBoxLiveConfigRecord
	if err := db.Mdb.Order("id desc").First(&rec).Error; err != nil {
		return cfg
	}
	if rec.Payload != "" {
		_ = json.Unmarshal([]byte(rec.Payload), &cfg)
	}
	cfg = model.NormalizeTVBoxLiveConfig(cfg)
	cacheTVBoxLiveConfig(cfg)
	return cfg
}

// SaveTVBoxLiveConfig 保存 TVBox 直播电视频道配置并刷新缓存
func SaveTVBoxLiveConfig(cfg model.TVBoxLiveConfig) error {
	cfg = model.NormalizeTVBoxLiveConfig(cfg)
	raw, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	rec := model.TVBoxLiveConfigRecord{Payload: string(raw)}
	if err := db.Mdb.Transaction(func(tx *gorm.DB) error {
		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&model.TVBoxLiveConfigRecord{}).Error; err != nil {
			return err
		}
		return tx.Create(&rec).Error
	}); err != nil {
		return err
	}
	cacheTVBoxLiveConfig(cfg)
	return nil
}

func cacheTVBoxLiveConfig(cfg model.TVBoxLiveConfig) {
	if db.Rdb == nil {
		return
	}
	data, err := json.Marshal(cfg)
	if err != nil {
		return
	}
	if err := db.Rdb.Set(db.Cxt, config.TVBoxLiveConfigKey, data, config.ConfigCacheTTL).Err(); err != nil {
		log.Println("SaveTVBoxLiveConfig Redis Error:", err)
		_ = db.Rdb.Del(db.Cxt, config.TVBoxLiveConfigKey).Err()
	}
}
