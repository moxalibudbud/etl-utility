package writer

import (
	"strings"

	"flatfile-go/line"
	"flatfile-go/template"
)

const defaultLineSeparator = "|"

// renderer owns the destination-independent half of a writer: filename
// templating, header/row rendering, the raw footer, and uniqueKey
// de-duplication. It performs no I/O, so DefaultWriter (local disk) and
// AzureBlobWriter (blob upload) produce identical bytes for the same input.
type renderer struct {
	opts     OutputConfig
	filename string
	rowRefs  map[string]bool
}

func newRenderer(opts OutputConfig) *renderer {
	return &renderer{opts: opts, rowRefs: map[string]bool{}}
}

// Filename returns the rendered output filename, empty until the first row
// has been pushed.
func (r *renderer) Filename() string { return r.filename }

// setFilename renders the filename template against the first pushed row.
func (r *renderer) setFilename(sl *line.SourceLine) {
	r.filename = renderFilename(r.opts, sl)
}

// header renders the templated header, or "" when none is configured.
func (r *renderer) header(sl *line.SourceLine) string {
	if r.opts.Header == "" {
		return ""
	}
	return template.ReplaceWithFunction(r.opts.Header, buildTemplateMeta(r.opts, sl))
}

// row renders a data row. The ETL orchestrator filters source header rows
// before calling Writer.Push.
func (r *renderer) row(sl *line.SourceLine) string {
	var row string
	if r.opts.Template != "" {
		row = template.ReplaceWithFunction(
			template.ReplaceWithMap(r.opts.Template, sl.JSONLine),
			buildTemplateMeta(r.opts, sl),
		)
	} else {
		row = buildLineFromOutput(sl.Output(), r.opts.Separator)
	}

	return "\n" + row
}

// footer returns the configured footer verbatim; unlike the header it is not
// templated.
func (r *renderer) footer() string { return r.opts.Footer }

func renderFilename(opts OutputConfig, sl *line.SourceLine) string {
	return template.ReplaceWithFunction(
		template.ReplaceWithMap(opts.Filename, sl.JSONLine),
		buildTemplateMeta(opts, sl),
	)
}

func buildTemplateMeta(opts OutputConfig, sl *line.SourceLine) map[string]any {
	meta := make(map[string]any, len(sl.AllData())+1)
	for k, v := range sl.AllData() {
		meta[k] = v
	}
	meta["metadata"] = opts.Metadata
	return meta
}

func (r *renderer) isRowExist(sl *line.SourceLine) bool {
	if r.opts.UniqueKey == "" {
		return false
	}
	return r.rowRefs[sl.JSONLine[r.opts.UniqueKey]]
}

func (r *renderer) trackReference(sl *line.SourceLine) {
	if r.opts.UniqueKey == "" {
		return
	}
	r.rowRefs[sl.JSONLine[r.opts.UniqueKey]] = true
}

// buildLineFromOutput joins ordered output values by separator.
// Port of utils/line-builder-from-line-keys.ts.
func buildLineFromOutput(output []line.KV, separator string) string {
	if separator == "" {
		separator = defaultLineSeparator
	}
	values := make([]string, 0, len(output))
	for _, kv := range output {
		values = append(values, kv.Value)
	}
	return strings.Join(values, separator)
}
