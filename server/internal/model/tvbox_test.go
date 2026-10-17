package model

import "testing"

func TestNormalizeTVBoxConfigDefaults(t *testing.T) {
	got := NormalizeTVBoxConfig(TVBoxConfig{})
	if got.SiteName != DefaultTVBoxSiteName || got.SourceName != DefaultTVBoxSourceName {
		t.Fatalf("empty config should fall back to defaults, got %+v", got)
	}
	if got.FormatSourceName("非凡(FF)") != "📡 非凡(FF)" {
		t.Fatalf("default source name mismatch: %q", got.FormatSourceName("非凡(FF)"))
	}
}

func TestNormalizeTVBoxConfigSourceName(t *testing.T) {
	cases := map[string]string{
		"{name}":       "非凡",
		"[源] {name}":   "[源] 非凡",
		"{name} - 备用":  "非凡 - 备用",
		"🎬":            "🎬 非凡",
		"  ▶ {name}  ": "▶ 非凡",
	}
	for tpl, want := range cases {
		got := NormalizeTVBoxConfig(TVBoxConfig{SourceName: tpl}).FormatSourceName("非凡")
		if got != want {
			t.Errorf("template %q: got %q, want %q", tpl, got, want)
		}
	}
}

func TestDecodeTVBoxJSON(t *testing.T) {
	if got := DecodeTVBoxJSON(""); got != DefaultTVBoxConfig() {
		t.Fatalf("empty json should return defaults, got %+v", got)
	}
	if got := DecodeTVBoxJSON("{bad"); got != DefaultTVBoxConfig() {
		t.Fatalf("invalid json should return defaults, got %+v", got)
	}
	raw := EncodeTVBoxJSON(TVBoxConfig{SiteName: " 我的影视 ", HideSources: true, Spider: " https://a.b/s.jar "})
	got := DecodeTVBoxJSON(raw)
	if got.SiteName != "我的影视" || !got.HideSources || got.Spider != "https://a.b/s.jar" || got.SourceName != DefaultTVBoxSourceName {
		t.Fatalf("round trip mismatch: %+v", got)
	}
}
