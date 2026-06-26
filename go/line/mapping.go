package line

import (
	"strings"

	"flatfile-go/template"
)

// KV is one ordered key/value pair of projected output.
type KV struct {
	Key   string
	Value string
}

// lineDataToJSON zips columns to values by index. Missing values become "".
// Port of utils/line-data-to-json.ts.
func lineDataToJSON(columns, values []string) map[string]string {
	out := make(map[string]string, len(columns))
	for i, col := range columns {
		if i < len(values) {
			out[col] = values[i]
		} else {
			out[col] = ""
		}
	}
	return out
}

// mapWithDefault projects input through config, preserving config order.
// Port of utils/map.ts:mapWithDefault. With no config it returns input in
// inputOrder. A [func ...] src is evaluated; a src matching an input key is
// looked up; otherwise src is used as a literal default.
func mapWithDefault(input map[string]string, inputOrder []string, config []Mapping) []KV {
	if len(config) == 0 {
		out := make([]KV, 0, len(inputOrder))
		for _, k := range inputOrder {
			out = append(out, KV{Key: k, Value: input[k]})
		}
		return out
	}

	out := make([]KV, 0, len(config))
	for _, m := range config {
		switch {
		case strings.HasPrefix(m.Src, "[") && strings.HasSuffix(m.Src, "]"):
			out = append(out, KV{Key: m.Out, Value: template.ReplaceWithFunction(m.Src, toAny(input))})
		default:
			if v, ok := input[m.Src]; ok {
				out = append(out, KV{Key: m.Out, Value: v})
			} else {
				out = append(out, KV{Key: m.Out, Value: m.Src})
			}
		}
	}
	return out
}

// mapFields projects input through config keyed lookups (no defaults).
// Port of utils/map.ts:mapFields.
func mapFields(input map[string]string, config []Mapping) map[string]string {
	out := make(map[string]string, len(config))
	for _, m := range config {
		out[m.Out] = input[m.Src]
	}
	return out
}

func toAny(m map[string]string) map[string]any {
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}
