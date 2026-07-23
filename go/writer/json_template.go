package writer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"sort"
	"strconv"
	"strings"

	"flatfile-go/line"
	"flatfile-go/template"
)

// Structured template node types. Each field in a structuredTemplate declares
// one of these, controlling how the resolved value is converted before it is
// encoded as JSON.
const (
	structuredKindString  = "string"
	structuredKindNumber  = "number"
	structuredKindBoolean = "boolean"
	structuredKindNull    = "null"
	structuredKindLiteral = "literal"
)

// StructuredTemplate is the wire form of output.structuredTemplate: a mapping
// from output field name to a typed node. It is an additive alternative to the
// string Template; the two are mutually exclusive and precedence is enforced by
// the writer during construction.
type StructuredTemplate map[string]StructuredNode

// StructuredNode is a single typed field in a StructuredTemplate. Value is kept
// raw so it can be a template-expression string ("{field}" / "[func ...]"), a
// JSON boolean, or — for literal nodes — an arbitrary JSON object, array, or
// scalar. The concrete shape allowed depends on Type and is validated when the
// template is compiled.
type StructuredNode struct {
	Type  string          `json:"type"`
	Value json.RawMessage `json:"value"`
}

// configured reports whether a structuredTemplate was supplied at all. An
// absent or empty map leaves the existing template / outputMappings paths in
// control.
func (st StructuredTemplate) configured() bool { return len(st) > 0 }

// compiledStructuredTemplate is the validated, render-ready form of a
// StructuredTemplate. Fields are sorted by name so row output is deterministic,
// matching how the document root sorts its keys.
type compiledStructuredTemplate struct {
	fields []compiledStructuredField
}

// compiledStructuredField is one validated node. Constant nodes (null, literal,
// and boolean literals) carry their pre-validated JSON in constRaw and need no
// per-row work. Dynamic nodes (string, number, and string-form booleans) carry
// the template expression in expr and are resolved and converted for each row
// according to kind.
type compiledStructuredField struct {
	name     string
	kind     string
	expr     string
	constRaw json.RawMessage
}

// compileStructuredTemplate validates every node and returns a render-ready
// template. Errors are configuration errors: they depend only on the template
// shape, so they fail fast during writer construction, before any output. Every
// error names the offending field.
func compileStructuredTemplate(st StructuredTemplate) (*compiledStructuredTemplate, error) {
	names := make([]string, 0, len(st))
	for name := range st {
		names = append(names, name)
	}
	sort.Strings(names)

	fields := make([]compiledStructuredField, 0, len(st))
	for _, name := range names {
		field, err := compileStructuredNode(name, st[name])
		if err != nil {
			return nil, err
		}
		fields = append(fields, field)
	}
	return &compiledStructuredTemplate{fields: fields}, nil
}

func compileStructuredNode(name string, node StructuredNode) (compiledStructuredField, error) {
	field := compiledStructuredField{name: name, kind: node.Type}
	switch node.Type {
	case structuredKindNull:
		field.constRaw = json.RawMessage("null")
		return field, nil
	case structuredKindString, structuredKindNumber:
		expr, err := stringNodeValue(name, node.Type, node.Value)
		if err != nil {
			return field, err
		}
		field.expr = expr
		return field, nil
	case structuredKindBoolean:
		return compileBooleanNode(name, node.Value)
	case structuredKindLiteral:
		return compileLiteralNode(name, node.Value)
	case "":
		return field, structuredConfigError(name, fmt.Errorf(`missing "type"`))
	default:
		return field, structuredConfigError(name, fmt.Errorf("unknown type %q", node.Type))
	}
}

// stringNodeValue extracts the template expression for a string or number node.
// Both require a JSON string value; a constant number is written as its string
// form ("5") or via a literal node.
func stringNodeValue(name, kind string, raw json.RawMessage) (string, error) {
	if len(raw) == 0 {
		return "", structuredConfigError(name, fmt.Errorf(`%s node is missing its "value"`, kind))
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return "", structuredConfigError(name, fmt.Errorf(`%s node "value" must be a string`, kind))
	}
	return s, nil
}

// compileBooleanNode accepts either a JSON boolean literal (stored as a
// constant) or a template-expression string (resolved and converted per row).
func compileBooleanNode(name string, raw json.RawMessage) (compiledStructuredField, error) {
	field := compiledStructuredField{name: name, kind: structuredKindBoolean}
	if len(raw) == 0 {
		return field, structuredConfigError(name, fmt.Errorf(`boolean node is missing its "value"`))
	}
	var b bool
	if err := json.Unmarshal(raw, &b); err == nil {
		field.constRaw = json.RawMessage(strconv.FormatBool(b))
		return field, nil
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		field.expr = s
		return field, nil
	}
	return field, structuredConfigError(name, fmt.Errorf(`boolean node "value" must be a boolean or a string`))
}

// compileLiteralNode validates that the configured value is JSON-compatible and
// stores its compact form to be written verbatim on every row.
func compileLiteralNode(name string, raw json.RawMessage) (compiledStructuredField, error) {
	field := compiledStructuredField{name: name, kind: structuredKindLiteral}
	if len(raw) == 0 {
		return field, structuredConfigError(name, fmt.Errorf(`literal node is missing its "value"`))
	}
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return field, structuredConfigError(name, fmt.Errorf("literal node has an invalid JSON value: %w", err))
	}
	var compact bytes.Buffer
	if err := json.Compact(&compact, raw); err != nil {
		return field, structuredConfigError(name, fmt.Errorf("literal node has an invalid JSON value: %w", err))
	}
	field.constRaw = append(json.RawMessage(nil), compact.Bytes()...)
	return field, nil
}

// renderRow resolves and converts every field for one source line and returns
// the encoded JSON object. String values are always encoded through Go's JSON
// encoder, so quotes, backslashes, Unicode, and control characters are escaped
// safely. Conversion failures name the field and source line.
func (t *compiledStructuredTemplate) renderRow(opts OutputConfig, sl *line.SourceLine) ([]byte, error) {
	meta := buildTemplateMeta(opts, sl)

	var b bytes.Buffer
	b.WriteByte('{')
	for i, field := range t.fields {
		raw, err := field.render(meta)
		if err != nil {
			return nil, fmt.Errorf("render structured JSON field %q at source line %d: %w", field.name, sl.CurrentLineNumber, err)
		}
		if i > 0 {
			b.WriteByte(',')
		}
		key, err := json.Marshal(field.name)
		if err != nil {
			return nil, err
		}
		b.Write(key)
		b.WriteByte(':')
		b.Write(raw)
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

// render produces the JSON value for one field. Constant fields are emitted
// verbatim; dynamic fields resolve their template expression against meta and
// convert the result according to kind.
func (f compiledStructuredField) render(meta map[string]any) (json.RawMessage, error) {
	if f.constRaw != nil {
		return f.constRaw, nil
	}

	resolved := template.ReplaceWithFunction(template.ReplaceWithData(f.expr, meta), meta)
	switch f.kind {
	case structuredKindString:
		encoded, err := json.Marshal(resolved)
		if err != nil {
			return nil, err
		}
		return json.RawMessage(encoded), nil
	case structuredKindNumber:
		return toJSONNumber(resolved)
	case structuredKindBoolean:
		return toJSONBoolean(resolved)
	default:
		return nil, fmt.Errorf("unsupported structured type %q", f.kind)
	}
}

// toJSONNumber applies the strict number rules: the resolved value must be a
// single, valid JSON number. Empty values, trailing content, and non-numeric
// values are errors, as are NaN and ±Inf, which are not valid JSON.
func toJSONNumber(resolved string) (json.RawMessage, error) {
	trimmed := strings.TrimSpace(resolved)
	if trimmed == "" {
		return nil, fmt.Errorf("cannot convert %q to number: value is empty", previewRenderedValue(resolved))
	}

	dec := json.NewDecoder(strings.NewReader(trimmed))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return nil, fmt.Errorf("cannot convert %q to number", previewRenderedValue(resolved))
	}
	num, ok := v.(json.Number)
	if !ok {
		return nil, fmt.Errorf("cannot convert %q to number", previewRenderedValue(resolved))
	}
	if _, err := dec.Token(); err != io.EOF {
		return nil, fmt.Errorf("cannot convert %q to number", previewRenderedValue(resolved))
	}
	if f, err := num.Float64(); err == nil && (math.IsInf(f, 0) || math.IsNaN(f)) {
		return nil, fmt.Errorf("%q is not a valid JSON number", previewRenderedValue(resolved))
	}
	return json.RawMessage(num.String()), nil
}

// toJSONBoolean applies the strict boolean rules: only case-insensitive "true"
// and "false" convert. Empty and unrecognized values are errors.
func toJSONBoolean(resolved string) (json.RawMessage, error) {
	switch strings.ToLower(strings.TrimSpace(resolved)) {
	case "true":
		return json.RawMessage("true"), nil
	case "false":
		return json.RawMessage("false"), nil
	default:
		return nil, fmt.Errorf("cannot convert %q to boolean", previewRenderedValue(resolved))
	}
}

func structuredConfigError(field string, err error) error {
	return fmt.Errorf("structured template field %q: %w", field, err)
}
