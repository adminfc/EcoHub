package model

import (
	"strings"
	"testing"
)

func TestNormalizeTVBoxLiveConfig(t *testing.T) {
	got := NormalizeTVBoxLiveConfig(TVBoxLiveConfig{
		Lives: []TVBoxLive{
			{Enabled: true, Name: "  ", URL: " https://a.b/live.m3u "},
			{Enabled: true, Name: "无地址", URL: "  "},
			{Enabled: false, Name: "央视", URL: "/live.txt", UA: " okhttp "},
		},
		Custom: TVBoxCustomChannels{Enabled: true, Content: "\uFEFF央视,#genre#\r\nCCTV1,http://x/1.m3u8\r\n"},
	})
	if len(got.Lives) != 2 {
		t.Fatalf("lives without url should be dropped, got %+v", got.Lives)
	}
	if got.Lives[0].Name != DefaultTVBoxLiveName+" 1" || got.Lives[0].URL != "https://a.b/live.m3u" {
		t.Fatalf("unexpected first live: %+v", got.Lives[0])
	}
	if got.Lives[1].Enabled || got.Lives[1].UA != "okhttp" {
		t.Fatalf("unexpected second live: %+v", got.Lives[1])
	}
	if got.Custom.Name != DefaultTVBoxCustomName {
		t.Fatalf("custom name should default, got %q", got.Custom.Name)
	}
	if got.Custom.Content != "央视,#genre#\nCCTV1,http://x/1.m3u8" {
		t.Fatalf("content not normalized: %q", got.Custom.Content)
	}
	if !got.HasCustomChannels() {
		t.Fatalf("custom channels should be output")
	}
	if NormalizeTVBoxLiveConfig(TVBoxLiveConfig{Custom: TVBoxCustomChannels{Content: "a,b"}}).HasCustomChannels() {
		t.Fatalf("disabled custom channels should not be output")
	}
}

func TestNormalizeTVBoxLiveConfigLimits(t *testing.T) {
	lives := make([]TVBoxLive, MaxTVBoxLives+5)
	for i := range lives {
		lives[i] = TVBoxLive{URL: "https://a.b/x.txt"}
	}
	line := "频道,http://example.com/stream.m3u8\n"
	content := strings.Repeat(line, MaxTVBoxChannelsBytes/len(line)+10)
	got := NormalizeTVBoxLiveConfig(TVBoxLiveConfig{Lives: lives, Custom: TVBoxCustomChannels{Content: content}})
	if len(got.Lives) != MaxTVBoxLives {
		t.Fatalf("lives should be capped at %d, got %d", MaxTVBoxLives, len(got.Lives))
	}
	if len(got.Custom.Content) > MaxTVBoxChannelsBytes {
		t.Fatalf("content should be capped, got %d bytes", len(got.Custom.Content))
	}
	if !strings.HasSuffix(got.Custom.Content, "stream.m3u8") {
		t.Fatalf("content should be cut at a full line")
	}
}
