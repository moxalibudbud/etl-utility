// Package template ports the two templating layers used by the TypeScript ETL:
//   - ReplaceWithMap:      legacy {field} substitution from a flat data map.
//   - ReplaceWithData:     {path} substitution from row/output/metadata data.
//   - ReplaceWithFunction: [func arg ...] computed expressions (timestamp, dateTime, ...).
package template

import "regexp"

var fieldRe = regexp.MustCompile(`\{([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\}`)

// ReplaceWithMap substitutes every legacy {field} token in template with
// data[field]. Unknown fields resolve to an empty string, matching the TS
// replaceWithMap.
func ReplaceWithMap(template string, data map[string]string) string {
	anyData := make(map[string]any, len(data))
	for k, v := range data {
		anyData[k] = v
	}
	return ReplaceWithData(template, anyData)
}

// ReplaceWithData substitutes every {path} token in template with a scalar
// value from data. A leading data. prefix is optional, so {SKU} and {data.SKU}
// both resolve the same top-level field. Unknown paths, nulls, objects, and
// arrays resolve to an empty string.
func ReplaceWithData(template string, data map[string]any) string {
	return fieldRe.ReplaceAllStringFunc(template, func(match string) string {
		path := match[1 : len(match)-1] // strip the surrounding braces
		value, _ := ResolveValue(data, path)
		return value
	})
}

// ResolveValue resolves a scalar path from data. Paths may optionally start
// with data. to mirror function arguments such as data.metadata.store.code.
func ResolveValue(data map[string]any, path string) (string, bool) {
	if len(path) > len("data.") && path[:len("data.")] == "data." {
		path = path[len("data."):]
	}
	return resolvePath(data, path)
}
