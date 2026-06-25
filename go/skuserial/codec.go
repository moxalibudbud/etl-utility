package skuserial

import "fmt"

// the "closure" becomes a struct holding the args
type SKUSerial struct {
	SKU    string
	Serial string
}

// constructor — equivalent to your exported skuSerial() function
func New(sku string, serial ...string) SKUSerial {
	serialStr := ""
	if len(serial) > 0 {
		serialStr = serial[0]
	}
	return SKUSerial{
		SKU:    sku,
		Serial: serialStr,
	}
}

// encode method — equivalent to encode: () => encodeMetadata(...)
func (s SKUSerial) Encode() string {
	return fmt.Sprintf("[%s][%s]", s.SKU, s.Serial)
}

// decode result — equivalent to the object returned by decodeMetadata
type SkuSerialResult struct {
	SKU          string
	Serial       string
	IsSerialized bool
}

// decode method — equivalent to decode: () => decodeMetadata(...)
func (s SKUSerial) Decode() SkuSerialResult {
	values := []string{}
	start := -1
	input := s.SKU // first arg is the encoded string when decoding

	for i := 0; i < len(input); i++ {
		if input[i] == '[' {
			start = i + 1
		} else if input[i] == ']' && start != -1 {
			values = append(values, input[start:i])
			start = -1
		}
	}

	sku := input
	serial := input
	isSerialized := false

	if len(values) > 0 && values[0] != "" {
		sku = values[0]
	}
	if len(values) > 1 && values[1] != "" {
		serial = values[1]
		isSerialized = true
	}

	return SkuSerialResult{
		SKU:          sku,
		Serial:       serial,
		IsSerialized: isSerialized,
	}
}
