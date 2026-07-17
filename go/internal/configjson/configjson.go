package configjson

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"flatfile-go/etl"
)

// Decode reads the canonical etl.Config JSON shape shared by every entrypoint.
func Decode(r io.Reader) (etl.Config, error) {
	var cfg etl.Config

	dec := json.NewDecoder(r)
	dec.DisallowUnknownFields()

	if err := dec.Decode(&cfg); err != nil {
		return etl.Config{}, fmt.Errorf("invalid config JSON: %w", err)
	}

	// Reject multiple JSON values such as "{}{}".
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		if err == nil {
			return etl.Config{}, errors.New("invalid config JSON: body must contain one JSON object")
		}
		return etl.Config{}, fmt.Errorf("invalid config JSON: %w", err)
	}

	return cfg, nil
}
