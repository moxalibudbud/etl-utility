package line

import "strings"

// SourceLine is the port of the SourceLine class (line-data/source-line.ts).
type SourceLine struct {
	Line              []string
	Separator         string
	Columns           []string
	JSONLine          map[string]string
	Opts              Options
	CurrentLineNumber int
	Errors            []string
}

// New parses a raw delimited line into a SourceLine. Fields are split on the
// separator and a single pair of surrounding double quotes is stripped, matching
// `line.split(sep).map(v => v.replace(/^"|"$/g, ”))`.
func New(raw string, opts Options, lineNumber int) *SourceLine {
	if opts.Separator == "" {
		opts.Separator = DefaultSeparator
	}

	fields := strings.Split(raw, opts.Separator)
	for i, f := range fields {
		fields[i] = stripQuotes(f)
	}

	sl := &SourceLine{
		Line:              fields,
		Separator:         opts.Separator,
		Columns:           opts.Columns,
		Opts:              opts,
		CurrentLineNumber: lineNumber,
	}
	sl.JSONLine = lineDataToJSON(opts.Columns, fields)
	return sl
}

// stripQuotes removes at most one leading and one trailing double quote,
// mirroring the global anchored regex /^"|"$/g.
func stripQuotes(s string) string {
	s = strings.TrimPrefix(s, `"`)
	s = strings.TrimSuffix(s, `"`)
	return s
}

// Validate appends any mandatory-field errors for this line.
func (sl *SourceLine) Validate() {
	sl.Errors = append(sl.Errors, ValidateLine(sl.Opts.MandatoryFields, sl.JSONLine, sl.CurrentLineNumber)...)
}

// IsValid reports whether the line accumulated no errors.
func (sl *SourceLine) IsValid() bool {
	return len(sl.Errors) == 0
}

// Error joins the accumulated errors with a comma (matches errors.toString()).
func (sl *SourceLine) Error() string {
	return strings.Join(sl.Errors, ",")
}

// IsHeader reports whether this is the header row.
func (sl *SourceLine) IsHeader() bool {
	return sl.Opts.WithHeader && sl.CurrentLineNumber == 1
}

// Output returns the ordered output projection (mapWithDefault).
func (sl *SourceLine) Output() []KV {
	return mapWithDefault(sl.JSONLine, sl.Columns, sl.Opts.OutputMappings)
}

// AllData merges the parsed record with the output projection (output wins),
// matching the `allData` getter. Used to feed templating metadata.
func (sl *SourceLine) AllData() map[string]string {
	out := make(map[string]string, len(sl.JSONLine))
	for k, v := range sl.JSONLine {
		out[k] = v
	}
	for _, kv := range sl.Output() {
		out[kv.Key] = kv.Value
	}
	return out
}

// Identifiers returns the identifier projection (mapFields). With no configured
// mappings this is an empty map, matching the default {} identifierMappings.
func (sl *SourceLine) Identifiers() map[string]string {
	return mapFields(sl.JSONLine, sl.Opts.IdentifierMappings)
}
