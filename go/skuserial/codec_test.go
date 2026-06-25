package skuserial

import (
	"strings"
	"testing"
)

func TestEncode(t *testing.T) {
	tests := []struct {
		name   string
		sku    string
		serial string
		want   string
	}{
		{"SKU and serial into bracketed format", "ABC123", "SN-001", "[ABC123][SN-001]"},
		{"empty strings", "", "", "[][]"},
		{"special characters", "SKU-@#$", "SER!@#", "[SKU-@#$][SER!@#]"},
		{"numeric values as strings", "12345", "67890", "[12345][67890]"},
		{"values with spaces", "ABC 123", "SN 001", "[ABC 123][SN 001]"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := New(tt.sku, tt.serial).Encode(); got != tt.want {
				t.Errorf("Encode(%q, %q) = %q, want %q", tt.sku, tt.serial, got, tt.want)
			}
		})
	}
}

func TestDecode(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  SkuSerialResult
	}{
		{
			"bracketed format back into SKU and serial",
			"[ABC123][SN-001]",
			SkuSerialResult{SKU: "ABC123", Serial: "SN-001", IsSerialized: true},
		},
		{
			"empty brackets",
			"[][]",
			SkuSerialResult{SKU: "[][]", Serial: "[][]", IsSerialized: false},
		},
		{
			"original input if no brackets present",
			"PLAINSKU",
			SkuSerialResult{SKU: "PLAINSKU", Serial: "PLAINSKU", IsSerialized: false},
		},
		{
			"single bracketed value",
			"[ABC123]",
			SkuSerialResult{SKU: "ABC123", Serial: "[ABC123]", IsSerialized: false},
		},
		{
			"more than two bracketed values",
			"[ABC][123][XYZ]",
			SkuSerialResult{SKU: "ABC", Serial: "123", IsSerialized: true},
		},
		{
			"special characters in brackets",
			"[SKU-@#$][SER!@#]",
			SkuSerialResult{SKU: "SKU-@#$", Serial: "SER!@#", IsSerialized: true},
		},
		{
			"spaces inside brackets",
			"[ABC 123][SN 001]",
			SkuSerialResult{SKU: "ABC 123", Serial: "SN 001", IsSerialized: true},
		},
		{
			"brackets in the middle of unformatted string",
			"ABC[123]XYZ",
			SkuSerialResult{SKU: "123", Serial: "ABC[123]XYZ", IsSerialized: false},
		},
		{
			"only opening brackets",
			"[[[",
			SkuSerialResult{SKU: "[[[", Serial: "[[[", IsSerialized: false},
		},
		{
			"only closing brackets",
			"]]]",
			SkuSerialResult{SKU: "]]]", Serial: "]]]", IsSerialized: false},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := New(tt.input, "").Decode(); got != tt.want {
				t.Errorf("Decode(%q) = %+v, want %+v", tt.input, got, tt.want)
			}
		})
	}
}

func TestEncodeDecodeRoundTrip(t *testing.T) {
	sku, serial := "TEST-SKU", "SERIAL-123"

	decoded := New(sku, serial).Decode()
	if decoded.SKU != sku {
		t.Errorf("round-trip SKU = %q, want %q", decoded.SKU, sku)
	}
	if decoded.Serial != sku {
		t.Errorf("round-trip Serial = %q, want %q", decoded.Serial, serial)
	}
}

func TestRoundTripLongStrings(t *testing.T) {
	longSku := strings.Repeat("A", 1000)
	longSerial := strings.Repeat("B", 1000)

	decoded := New(longSku, longSerial).Decode()
	if decoded.SKU != longSku {
		t.Errorf("long SKU did not round-trip")
	}
	if decoded.Serial != longSku {
		t.Errorf("long Serial did not round-trip")
	}
}

// Tests for the optional SkuSerial factory wrapper.
func TestSkuSerialFactory(t *testing.T) {
	t.Run("encode with two args", func(t *testing.T) {
		if got := New("ABC123", "SN-001").Encode(); got != "[ABC123][SN-001]" {
			t.Errorf("Encode() = %q", got)
		}
	})

	t.Run("decode with one arg", func(t *testing.T) {
		got := New("[ABC123][SN-001]").Decode()
		if got.SKU != "ABC123" || got.Serial != "SN-001" {
			t.Errorf("Decode() = %+v", got)
		}
	})

	t.Run("missing args default to empty", func(t *testing.T) {
		if got := New("", "").Encode(); got != "[][]" {
			t.Errorf("New().Encode() = %q, want %q", got, "[][]")
		}
	})
}
