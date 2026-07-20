package writer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strings"

	"flatfile-go/line"
	"flatfile-go/template"
)

const DefaultJSONArrayField = "lines"

const renderedPreviewLimit = 200

var jsonFieldTokenRe = regexp.MustCompile(`^\{(\w+)\}`)

type jsonDocumentEncoder struct {
	opts        OutputConfig
	out         io.Writer
	arrayField  string
	started     bool
	finalized   bool
	rowsWritten int
}

func newJSONDocumentEncoder(opts OutputConfig, out io.Writer) (*jsonDocumentEncoder, error) {
	arrayField := opts.ArrayField
	if arrayField == "" {
		arrayField = DefaultJSONArrayField
	}
	if strings.TrimSpace(arrayField) == "" {
		return nil, fmt.Errorf("output.arrayField must not be empty for json-generator")
	}
	return &jsonDocumentEncoder{opts: opts, out: out, arrayField: arrayField}, nil
}

func (e *jsonDocumentEncoder) Start(sl *line.SourceLine) error {
	if e.finalized {
		return fmt.Errorf("json writer is already finalized")
	}
	if e.started {
		return nil
	}

	rendered := "{}"
	if e.opts.Header != "" {
		rendered = renderJSONTemplate(e.opts.Header, sl, e.opts)
	}
	root, err := decodeJSONObject(rendered)
	if err != nil {
		return renderedJSONError("render JSON root", sl, rendered, err)
	}
	if _, exists := root[e.arrayField]; exists {
		return fmt.Errorf("render JSON root at source line %d: root already contains arrayField %q", sl.CurrentLineNumber, e.arrayField)
	}

	if _, err := io.WriteString(e.out, "{"); err != nil {
		return err
	}
	keys := make([]string, 0, len(root))
	for key := range root {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for i, key := range keys {
		if i > 0 {
			if _, err := io.WriteString(e.out, ","); err != nil {
				return err
			}
		}
		if err := writeJSONProperty(e.out, key, root[key]); err != nil {
			return err
		}
	}
	if len(keys) > 0 {
		if _, err := io.WriteString(e.out, ","); err != nil {
			return err
		}
	}
	if err := writeJSONPropertyName(e.out, e.arrayField); err != nil {
		return err
	}
	if _, err := io.WriteString(e.out, ":["); err != nil {
		return err
	}
	e.started = true
	return nil
}

func (e *jsonDocumentEncoder) WriteRow(sl *line.SourceLine) error {
	if e.finalized {
		return fmt.Errorf("json writer is already finalized")
	}
	if !e.started {
		if err := e.Start(sl); err != nil {
			return err
		}
	}

	row, err := e.renderRow(sl)
	if err != nil {
		return err
	}
	if e.rowsWritten > 0 {
		if _, err := io.WriteString(e.out, ","); err != nil {
			return err
		}
	}
	if _, err := e.out.Write(row); err != nil {
		return err
	}
	e.rowsWritten++
	return nil
}

func (e *jsonDocumentEncoder) Finalize() error {
	if e.finalized {
		return nil
	}
	if !e.started {
		e.finalized = true
		return nil
	}
	if _, err := io.WriteString(e.out, "]}"); err != nil {
		return err
	}
	e.finalized = true
	return nil
}

func (e *jsonDocumentEncoder) renderRow(sl *line.SourceLine) ([]byte, error) {
	if e.opts.Template == "" {
		return marshalOutputObject(sl.Output())
	}
	rendered := renderJSONTemplate(e.opts.Template, sl, e.opts)
	row, err := compactJSONObject(rendered)
	if err != nil {
		return nil, renderedJSONError("render JSON row", sl, rendered, err)
	}
	return row, nil
}

func marshalOutputObject(output []line.KV) ([]byte, error) {
	var b bytes.Buffer
	b.WriteByte('{')
	for i, kv := range output {
		if i > 0 {
			b.WriteByte(',')
		}
		key, err := json.Marshal(kv.Key)
		if err != nil {
			return nil, err
		}
		value, err := json.Marshal(kv.Value)
		if err != nil {
			return nil, err
		}
		b.Write(key)
		b.WriteByte(':')
		b.Write(value)
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

func decodeJSONObject(rendered string) (map[string]json.RawMessage, error) {
	var obj map[string]json.RawMessage
	if err := json.Unmarshal([]byte(rendered), &obj); err != nil {
		return nil, err
	}
	if obj == nil {
		return nil, fmt.Errorf("value must be a JSON object")
	}
	return obj, nil
}

func compactJSONObject(rendered string) ([]byte, error) {
	if _, err := decodeJSONObject(rendered); err != nil {
		return nil, err
	}
	var b bytes.Buffer
	if err := json.Compact(&b, []byte(rendered)); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}

func writeJSONProperty(w io.Writer, key string, raw json.RawMessage) error {
	if err := writeJSONPropertyName(w, key); err != nil {
		return err
	}
	if _, err := io.WriteString(w, ":"); err != nil {
		return err
	}
	var compact bytes.Buffer
	if err := json.Compact(&compact, raw); err != nil {
		return err
	}
	_, err := w.Write(compact.Bytes())
	return err
}

func writeJSONPropertyName(w io.Writer, key string) error {
	b, err := json.Marshal(key)
	if err != nil {
		return err
	}
	_, err = w.Write(b)
	return err
}

func renderJSONTemplate(tpl string, sl *line.SourceLine, opts OutputConfig) string {
	var out strings.Builder
	meta := buildTemplateMeta(opts, sl)
	inString := false
	escaped := false

	for i := 0; i < len(tpl); {
		if match := jsonFieldTokenRe.FindStringSubmatch(tpl[i:]); match != nil {
			out.WriteString(jsonTemplateValue(sl.JSONLine[match[1]], inString))
			i += len(match[0])
			continue
		}
		if tpl[i] == '[' && startsJSONTemplateFunction(tpl[i:]) {
			if end := strings.IndexByte(tpl[i:], ']'); end >= 0 {
				match := tpl[i : i+end+1]
				replacement := template.ReplaceWithFunction(match, meta)
				out.WriteString(jsonTemplateValue(replacement, inString))
				i += end + 1
				continue
			}
		}

		ch := tpl[i]
		out.WriteByte(ch)
		if inString {
			if escaped {
				escaped = false
			} else if ch == '\\' {
				escaped = true
			} else if ch == '"' {
				inString = false
			}
		} else if ch == '"' {
			inString = true
		}
		i++
	}
	return out.String()
}

func startsJSONTemplateFunction(s string) bool {
	if len(s) < 3 || s[0] != '[' {
		return false
	}
	end := strings.IndexByte(s, ']')
	if end < 0 {
		return false
	}
	name := strings.Fields(s[1:end])
	if len(name) == 0 {
		return false
	}
	switch name[0] {
	case "timestamp", "dateTime", "sanitizeString", "removeWhiteSpaces", "replaceString":
		return true
	default:
		return false
	}
}

func jsonTemplateValue(value string, inString bool) string {
	if !inString {
		return value
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return value
	}
	if len(encoded) < 2 {
		return value
	}
	return string(encoded[1 : len(encoded)-1])
}

func renderedJSONError(op string, sl *line.SourceLine, rendered string, err error) error {
	return fmt.Errorf("%s at source line %d: %w; rendered value: %s",
		op,
		sl.CurrentLineNumber,
		err,
		previewRenderedValue(rendered),
	)
}

func previewRenderedValue(value string) string {
	value = strings.ReplaceAll(value, "\n", `\n`)
	value = strings.ReplaceAll(value, "\r", `\r`)
	if len(value) <= renderedPreviewLimit {
		return value
	}
	return value[:renderedPreviewLimit] + "..."
}
