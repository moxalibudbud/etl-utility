package writer

import (
	"encoding/json"
	"strings"
	"testing"

	"flatfile-go/line"
)

// structuredTestLine builds a source line whose columns cover the fields the
// structured-template tests resolve against.
func structuredTestLine(raw string, lineNumber int) *line.SourceLine {
	return line.New(raw, line.LineConfig{
		Columns:   []string{"SKU", "QTY", "NAME", "FLAG"},
		Separator: ";",
	}, lineNumber)
}

// mustNode builds a StructuredNode, parsing value from a JSON literal so tests
// can express booleans, strings, and literals the same way the wire form does.
func mustNode(t *testing.T, typ, valueJSON string) StructuredNode {
	t.Helper()
	node := StructuredNode{Type: typ}
	if valueJSON != "" {
		node.Value = json.RawMessage(valueJSON)
	}
	return node
}

func renderStructured(t *testing.T, st StructuredTemplate, sl *line.SourceLine, opts OutputConfig) ([]byte, error) {
	t.Helper()
	tpl, err := compileStructuredTemplate(st)
	if err != nil {
		return nil, err
	}
	return tpl.renderRow(opts, sl)
}

func TestStructuredTemplateRendersAllTypes(t *testing.T) {
	sl := structuredTestLine(`A"1;7;Widget;TRUE`, 2)
	st := StructuredTemplate{
		"SKU":      mustNode(t, structuredKindString, `"{SKU}"`),
		"Quantity": mustNode(t, structuredKindNumber, `"{QTY}"`),
		"Name":     mustNode(t, structuredKindString, `"{NAME}"`),
		"Flag":     mustNode(t, structuredKindBoolean, `"{FLAG}"`),
		"Received": mustNode(t, structuredKindBoolean, `true`),
		"Missing":  mustNode(t, structuredKindNull, ``),
		"Context": mustNode(t, structuredKindLiteral, `{
			"source": "etl",
			"tags": ["imported", "inventory"]
		}`),
	}

	row, err := renderStructured(t, st, sl, OutputConfig{})
	if err != nil {
		t.Fatalf("renderRow: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(row, &got); err != nil {
		t.Fatalf("row is not valid JSON: %v\n%s", err, row)
	}

	if got["SKU"] != `A"1` {
		t.Errorf("SKU = %#v, want the raw string with an embedded quote", got["SKU"])
	}
	if got["Quantity"] != float64(7) {
		t.Errorf("Quantity = %#v, want number 7", got["Quantity"])
	}
	if got["Flag"] != true {
		t.Errorf("Flag = %#v, want boolean true from \"TRUE\"", got["Flag"])
	}
	if got["Received"] != true {
		t.Errorf("Received = %#v, want boolean literal true", got["Received"])
	}
	if v, ok := got["Missing"]; !ok || v != nil {
		t.Errorf("Missing = %#v, want explicit null", v)
	}
	ctx, ok := got["Context"].(map[string]any)
	if !ok || ctx["source"] != "etl" {
		t.Errorf("Context = %#v, want the literal object preserved", got["Context"])
	}
}

func TestStructuredTemplateFieldsAreSortedAndDeterministic(t *testing.T) {
	sl := structuredTestLine(`X;1;N;true`, 2)
	st := StructuredTemplate{
		"Zeta":  mustNode(t, structuredKindString, `"{SKU}"`),
		"Alpha": mustNode(t, structuredKindString, `"{NAME}"`),
		"Mid":   mustNode(t, structuredKindNumber, `"{QTY}"`),
	}

	row, err := renderStructured(t, st, sl, OutputConfig{})
	if err != nil {
		t.Fatalf("renderRow: %v", err)
	}
	if got, want := string(row), `{"Alpha":"N","Mid":1,"Zeta":"X"}`; got != want {
		t.Fatalf("row = %s, want sorted %s", got, want)
	}
}

func TestStructuredTemplateStringEscaping(t *testing.T) {
	// A value containing a quote, backslash, newline, and a control character
	// must still produce valid JSON.
	sl := structuredTestLine("a\"b\\c;1;N;t", 2)
	st := StructuredTemplate{"S": mustNode(t, structuredKindString, `"{SKU}"`)}

	row, err := renderStructured(t, st, sl, OutputConfig{})
	if err != nil {
		t.Fatalf("renderRow: %v", err)
	}
	var got map[string]string
	if err := json.Unmarshal(row, &got); err != nil {
		t.Fatalf("row is not valid JSON: %v\n%s", err, row)
	}
	if got["S"] != "a\"b\\c" {
		t.Fatalf("S = %q, want the raw string round-tripped", got["S"])
	}
}

func TestStructuredTemplateMissingStringIsEmpty(t *testing.T) {
	sl := structuredTestLine(`X;1;N;t`, 2)
	st := StructuredTemplate{"S": mustNode(t, structuredKindString, `"{DoesNotExist}"`)}

	row, err := renderStructured(t, st, sl, OutputConfig{})
	if err != nil {
		t.Fatalf("renderRow: %v", err)
	}
	if got, want := string(row), `{"S":""}`; got != want {
		t.Fatalf("row = %s, want %s", got, want)
	}
}

func TestStructuredTemplateNumberConversionFailures(t *testing.T) {
	cases := map[string]string{
		"empty":           `X;;N;t`,
		"non-numeric":     `X;abc;N;t`,
		"trailing-text":   `X;12px;N;t`,
		"comma-only":      `X;,;N;t`,
		"space-thousands": `X;1 250;N;t`, // only a comma thousands separator is accepted, not a space
	}
	for name, raw := range cases {
		t.Run(name, func(t *testing.T) {
			sl := structuredTestLine(raw, 42)
			st := StructuredTemplate{"Quantity": mustNode(t, structuredKindNumber, `"{QTY}"`)}

			_, err := renderStructured(t, st, sl, OutputConfig{})
			if err == nil {
				t.Fatal("expected a conversion error")
			}
			if !strings.Contains(err.Error(), `field "Quantity"`) || !strings.Contains(err.Error(), "source line 42") {
				t.Fatalf("error is missing field/line context: %v", err)
			}
			if !strings.Contains(err.Error(), "to number") {
				t.Fatalf("error is missing the requested type: %v", err)
			}
		})
	}
}

func TestStructuredTemplateNumberAcceptsValidForms(t *testing.T) {
	cases := map[string]struct {
		raw  string
		want string
	}{
		"integer":                 {`X;7;N;t`, `{"N":7}`},
		"decimal":                 {`X;1.5;N;t`, `{"N":1.5}`},
		"negative":                {`X;-3;N;t`, `{"N":-3}`},
		"exponent":                {`X;1e3;N;t`, `{"N":1e3}`},
		"padded":                  {`X; 42 ;N;t`, `{"N":42}`},
		"comma-thousands":         {`X;1,250;N;t`, `{"N":1250}`},
		"comma-thousands-many":    {`X;-1,234,567;N;t`, `{"N":-1234567}`},
		"comma-thousands-decimal": {`X;1,250.50;N;t`, `{"N":1250.50}`},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			sl := structuredTestLine(tc.raw, 2)
			st := StructuredTemplate{"N": mustNode(t, structuredKindNumber, `"{QTY}"`)}
			row, err := renderStructured(t, st, sl, OutputConfig{})
			if err != nil {
				t.Fatalf("renderRow: %v", err)
			}
			if string(row) != tc.want {
				t.Fatalf("row = %s, want %s", row, tc.want)
			}
		})
	}
}

func TestStructuredTemplateBooleanConversionFailures(t *testing.T) {
	for _, value := range []string{"", "yes", "1", "TRUEISH"} {
		t.Run(value, func(t *testing.T) {
			sl := structuredTestLine("X;1;N;"+value, 9)
			st := StructuredTemplate{"Flag": mustNode(t, structuredKindBoolean, `"{FLAG}"`)}
			_, err := renderStructured(t, st, sl, OutputConfig{})
			if err == nil {
				t.Fatal("expected a conversion error")
			}
			if !strings.Contains(err.Error(), "to boolean") || !strings.Contains(err.Error(), "source line 9") {
				t.Fatalf("error is missing context: %v", err)
			}
		})
	}
}

func TestStructuredTemplateBooleanCaseInsensitive(t *testing.T) {
	for _, value := range []string{"true", "TRUE", "TrUe", "false", "FALSE"} {
		sl := structuredTestLine("X;1;N;"+value, 2)
		st := StructuredTemplate{"Flag": mustNode(t, structuredKindBoolean, `"{FLAG}"`)}
		row, err := renderStructured(t, st, sl, OutputConfig{})
		if err != nil {
			t.Fatalf("value %q: %v", value, err)
		}
		want := strings.ToLower(value)
		if got := string(row); got != `{"Flag":`+want+`}` {
			t.Fatalf("value %q: row = %s, want %s", value, got, want)
		}
	}
}

func TestStructuredTemplateLiteralScalar(t *testing.T) {
	sl := structuredTestLine(`X;1;N;t`, 2)
	st := StructuredTemplate{
		"Count": mustNode(t, structuredKindLiteral, `5`),
		"Name":  mustNode(t, structuredKindLiteral, `"fixed"`),
	}
	row, err := renderStructured(t, st, sl, OutputConfig{})
	if err != nil {
		t.Fatalf("renderRow: %v", err)
	}
	if got, want := string(row), `{"Count":5,"Name":"fixed"}`; got != want {
		t.Fatalf("row = %s, want %s", got, want)
	}
}

func TestStructuredTemplateConfigErrors(t *testing.T) {
	cases := map[string]StructuredTemplate{
		"unknown type":         {"F": mustNode(t, "int", `"{QTY}"`)},
		"missing type":         {"F": {Value: json.RawMessage(`"{QTY}"`)}},
		"string missing value": {"F": {Type: structuredKindString}},
		"number missing value": {"F": {Type: structuredKindNumber}},
		"number wrong value":   {"F": mustNode(t, structuredKindNumber, `5`)},
		"boolean bad value":    {"F": mustNode(t, structuredKindBoolean, `{"a":1}`)},
		"literal invalid":      {"F": mustNode(t, structuredKindLiteral, `{invalid}`)},
		"literal missing":      {"F": {Type: structuredKindLiteral}},
	}
	for name, st := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := compileStructuredTemplate(st)
			if err == nil {
				t.Fatal("expected a configuration error")
			}
			if !strings.Contains(err.Error(), `field "F"`) {
				t.Fatalf("error is missing field context: %v", err)
			}
		})
	}
}

func TestStructuredTemplateResolvesFunctionsAndMetadata(t *testing.T) {
	sl := structuredTestLine(`  spaced  ;1;N;t`, 2)
	opts := OutputConfig{Metadata: map[string]any{"store": map[string]any{"code": "DXB01"}}}
	st := StructuredTemplate{
		"SKU":      mustNode(t, structuredKindString, `"[removeWhiteSpaces data.SKU]"`),
		"Location": mustNode(t, structuredKindString, `"{metadata.store.code}"`),
	}
	row, err := renderStructured(t, st, sl, opts)
	if err != nil {
		t.Fatalf("renderRow: %v", err)
	}
	var got map[string]string
	if err := json.Unmarshal(row, &got); err != nil {
		t.Fatalf("row is not valid JSON: %v\n%s", err, row)
	}
	if got["SKU"] != "spaced" {
		t.Errorf("SKU = %q, want whitespace removed", got["SKU"])
	}
	if got["Location"] != "DXB01" {
		t.Errorf("Location = %q, want metadata resolved", got["Location"])
	}
}
