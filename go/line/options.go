// Package line ports the SourceLine model: parsing a raw delimited line into a
// keyed record, validating it, and deriving output/identifier projections.
package line

// DefaultSeparator matches DEFAULT_OPTIONS in source-line-base.ts.
const DefaultSeparator = ";"

// Mapping is one ordered output->source rule. Order is preserved so delimited
// output is deterministic (Go maps are unordered, JS object key order is not).
type Mapping struct {
	// Out is the resulting key.
	Out string `json:"out"`
	// Src is either a source column name, a literal default, or a [func ...]
	// template (only honoured by OutputMappings via mapWithDefault).
	Src string `json:"src"`
}

// Options is the port of LineSourceBaseOptions.
type Options struct {
	Columns            []string  `json:"columns"`
	MandatoryFields    []string  `json:"mandatoryFields"`
	IdentifierMappings []Mapping `json:"identifierMappings"`
	OutputMappings     []Mapping `json:"outputMappings"`
	Separator          string    `json:"separator"`
	WithHeader         bool      `json:"withHeader"`
}
