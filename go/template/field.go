// Package template ports the two templating layers used by the TypeScript ETL:
//   - ReplaceWithMap:      {field} substitution from a flat data map.
//   - ReplaceWithFunction: [func arg ...] computed expressions (timestamp, dateTime, ...).
package template

import "regexp"

var fieldRe = regexp.MustCompile(`\{(\w+)\}`)

// ReplaceWithMap substitutes every {field} token in template with data[field].
// Unknown fields resolve to an empty string, matching the TS replaceWithMap.
func ReplaceWithMap(template string, data map[string]string) string {
	return fieldRe.ReplaceAllStringFunc(template, func(match string) string {
		key := match[1 : len(match)-1] // strip the surrounding braces
		return data[key]
	})
}
