package template

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

var funcRe = regexp.MustCompile(`\[([^\]]+)\]`)

// ReplaceWithFunction evaluates every [func arg ...] expression in template.
//
// Supported functions mirror utils/replace-with-function.ts:
//   - timestamp                -> milliseconds since epoch
//   - dateTime [format] [tz]   -> formatted current time (moment-style tokens)
//   - sanitizeString <s>       -> SanitizeString
//   - removeWhiteSpaces <s>    -> RemoveWhiteSpaces
//   - replaceString <s> a b    -> ReplaceString
//
// Arguments beginning with "data." are resolved against the data map (dot path).
// Unknown functions are left untouched (the TS customFunction JS-eval fallback is
// intentionally not ported). data may be nil.
func ReplaceWithFunction(template string, data map[string]any) string {
	return funcRe.ReplaceAllStringFunc(template, func(match string) string {
		content := match[1 : len(match)-1] // strip the surrounding brackets
		parts := strings.Fields(content)
		if len(parts) == 0 {
			return match
		}

		name := parts[0]
		args := make([]string, 0, len(parts)-1)
		for _, arg := range parts[1:] {
			if strings.HasPrefix(arg, "data.") {
				if v, ok := resolvePath(data, arg[len("data."):]); ok {
					args = append(args, v)
					continue
				}
			}
			args = append(args, arg)
		}

		switch name {
		case "timestamp":
			return fmt.Sprintf("%d", time.Now().UnixMilli())
		case "dateTime":
			return dateTime(args)
		case "sanitizeString":
			return SanitizeString(firstArg(args))
		case "removeWhiteSpaces":
			return RemoveWhiteSpaces(firstArg(args))
		case "replaceString":
			value := firstArg(args)
			char, replacement := "", ""
			if len(args) > 1 {
				char = args[1]
			}
			if len(args) > 2 {
				replacement = args[2]
			}
			return ReplaceString(value, char, replacement)
		default:
			return match // keep the original placeholder for unsupported functions
		}
	})
}

func firstArg(args []string) string {
	if len(args) > 0 {
		return args[0]
	}
	return ""
}

// resolvePath walks a dotted path (e.g. "metadata.stores.0.region") through
// nested maps and arrays. Only scalar leaves are resolved; nil and container
// leaves retain the caller's unresolved-argument fallback.
func resolvePath(data map[string]any, path string) (string, bool) {
	if data == nil {
		return "", false
	}
	var current any = data
	for _, key := range strings.Split(path, ".") {
		switch m := current.(type) {
		case map[string]any:
			v, ok := m[key]
			if !ok {
				return "", false
			}
			current = v
		case map[string]string:
			v, ok := m[key]
			if !ok {
				return "", false
			}
			current = v
		case []any:
			index, err := strconv.Atoi(key)
			if err != nil || index < 0 || index >= len(m) {
				return "", false
			}
			current = m[index]
		default:
			return "", false
		}
	}
	switch value := current.(type) {
	case string:
		return value, true
	case bool:
		return strconv.FormatBool(value), true
	case float64:
		return strconv.FormatFloat(value, 'f', -1, 64), true
	case float32:
		return strconv.FormatFloat(float64(value), 'f', -1, 32), true
	case int:
		return strconv.Itoa(value), true
	case int8:
		return strconv.FormatInt(int64(value), 10), true
	case int16:
		return strconv.FormatInt(int64(value), 10), true
	case int32:
		return strconv.FormatInt(int64(value), 10), true
	case int64:
		return strconv.FormatInt(value, 10), true
	case uint:
		return strconv.FormatUint(uint64(value), 10), true
	case uint8:
		return strconv.FormatUint(uint64(value), 10), true
	case uint16:
		return strconv.FormatUint(uint64(value), 10), true
	case uint32:
		return strconv.FormatUint(uint64(value), 10), true
	case uint64:
		return strconv.FormatUint(value, 10), true
	default:
		return "", false
	}
}

// dateTime formats the current time using moment-style tokens. Port of the
// dateTime helper in replace-with-function.ts. Tokens are replaced longest-first
// to avoid partial overlaps.
func dateTime(args []string) string {
	format := "YYYY-MM-DDTHH:mm:ssZ"
	tz := "UTC"
	if len(args) > 0 && args[0] != "" {
		format = args[0]
	}
	if len(args) > 1 && args[1] != "" {
		tz = args[1]
	}

	loc, err := time.LoadLocation(tz)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)

	zone := ""
	if tz == "UTC" {
		zone = "Z"
	}

	tokens := []struct{ tok, val string }{
		{"YYYY", now.Format("2006")},
		{"YY", now.Format("06")},
		{"MMMM", now.Format("January")},
		{"MMM", now.Format("Jan")},
		{"MM", now.Format("01")},
		{"DD", now.Format("02")},
		{"HH", now.Format("15")},
		{"hh", now.Format("03")},
		{"mm", now.Format("04")},
		{"ss", now.Format("05")},
		{"SSS", fmt.Sprintf("%03d", now.Nanosecond()/1e6)},
		{"SS", now.Format("05")},
		{"A", now.Format("PM")},
		{"a", now.Format("pm")},
		{"Z", zone},
	}
	sort.SliceStable(tokens, func(i, j int) bool {
		return len(tokens[i].tok) > len(tokens[j].tok)
	})

	out := format
	for _, t := range tokens {
		out = strings.ReplaceAll(out, t.tok, t.val)
	}
	return out
}
