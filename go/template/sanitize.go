package template

import "regexp"

var (
	bareBackslashRe = regexp.MustCompile(`\\\\|\\[^"\\/bfnrtu]`)
	controlCharRe   = regexp.MustCompile(`[\x00-\x1F\x7F]`)
	whitespaceRe    = regexp.MustCompile(`\s+`)
)

// SanitizeString escapes bare backslashes and turns control characters into
// spaces. Port of utils/santize-string.ts:sanitizeString.
func SanitizeString(s string) string {
	s = bareBackslashRe.ReplaceAllStringFunc(s, func(m string) string {
		if len(m) == 2 { // a valid escape pair such as \\ is kept as-is
			return m
		}
		return `\\`
	})
	return controlCharRe.ReplaceAllString(s, " ")
}

// RemoveWhiteSpaces strips every whitespace run from the value.
func RemoveWhiteSpaces(s string) string {
	return whitespaceRe.ReplaceAllString(s, "")
}

// ReplaceString replaces every literal occurrence of char with replacement.
// char is treated literally (regex metacharacters are escaped), matching the TS
// replaceString which builds a RegExp from an escaped string.
func ReplaceString(value, char, replacement string) string {
	if char == "" {
		return value
	}
	re := regexp.MustCompile(regexp.QuoteMeta(char))
	return re.ReplaceAllString(value, replacement)
}
