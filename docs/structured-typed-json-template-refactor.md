---
title: Structured Typed JSON Template Refactor
---

# Structured Typed JSON Template Refactor

## Purpose

The current JSON generator builds each row from a string template such as:

```json
{"qty":{Quantity},"received":true}
```

This is flexible, but values are inserted into JSON text before the completed
row is validated. An empty number, an unexpected quote, or an invalid boolean
can therefore make the entire row fail.

A structured typed template describes both the output field and its intended
JSON type. The writer can then safely encode strings and report conversion
errors against the exact field that caused them.

This feature should be additive. Existing `template` configurations must keep
working without changes.

## Implementation progress

Phase 1 — Configuration contract:

- [x] Typed template node definitions (`StructuredTemplate` / `StructuredNode`)
      in [`go/writer/json_template.go`](../go/writer/json_template.go).
- [x] Template validation: unknown/missing type, missing `value`, bad value
      shape, and invalid literals fail at compile time and name the field.
- [x] Pre-validate and compact constant literal nodes.
- [x] Focused unit tests for every type and failure mode in
      [`go/writer/json_template_test.go`](../go/writer/json_template_test.go).
- [x] Add `StructuredTemplate` to `OutputConfig` and document precedence in
      [`go/writer/writer.go`](../go/writer/writer.go).
- [x] Enforce `template` / `structuredTemplate` precedence and compile the
      template during writer construction in
      [`go/writer/json_writer.go`](../go/writer/json_writer.go).
- [x] Config-decoding tests (wire shape, precedence conflict, invalid node)
      in [`go/writer/writer_test.go`](../go/writer/writer_test.go) and
      [`go/writer/json_writer_test.go`](../go/writer/json_writer_test.go).

Phase 2 — Typed row renderer:

- [x] Resolve source/metadata/function placeholders per field.
- [x] Strict conversion for string, number, boolean, null, and literal.
- [x] Encode rows with Go's JSON encoder; deterministic (sorted) field output.

Phase 3 — Writer integration:

- [x] Add the structured rendering path to `jsonDocumentEncoder.renderRow`
      (dispatches to the compiled structured template when configured).
- [x] Preserve the string-template and `outputMappings` paths.
- [x] Local writer integration tests: end-to-end row output, conversion
      failure removes the partial file, precedence rejection, invalid config
      rejected before output begins.
- [x] Azure Blob regression coverage: `TestJSONBlobWriterStructuredTemplateSuccessfulCompletion`
      in [`go/writer/blobwriter_test.go`](../go/writer/blobwriter_test.go)
      proves the same compiled template renders through the Azure sink.
- [x] End-to-end CSV-to-typed-JSON coverage:
      `TestProcessJSONGeneratorStructuredTemplateValidRows` (happy path,
      typed number/boolean in the output document) and
      `TestProcessJSONGeneratorStructuredTemplateOutput` (a conversion
      failure surfaces with field context and leaves no output file) in
      [`go/etl/etl_test.go`](../go/etl/etl_test.go).

**Phase 3 is complete.**

Phase 4 — Verification and documentation:

- [x] Full Go test suite, `go vet`, `go build`, and `-race` (writer + etl)
      pass.
- [ ] Samples (`sample-config/local/config.structured-json.json`,
      `sample-config/azure-blob/config.structured-json.json`).
- [ ] Update [`docs/usage.md`](usage.md) and
      [`docs/go-json-generator-design.md`](go-json-generator-design.md).

## Effort estimate

This is a medium-sized refactor.

| Scope | Estimated effort |
| --- | ---: |
| Agree on the configuration shape and conversion rules | 0.5 day |
| Add Go configuration types and validation | 0.5–1 day |
| Implement typed value resolution and JSON encoding | 1–1.5 days |
| Integrate the new renderer with the JSON document encoder | 0.5 day |
| Add unit and integration tests | 1–1.5 days |
| Add end-to-end and cloud-destination regression coverage | 0.5–1 day |
| Update samples and documentation | 0.5 day |
| **Production-ready total** | **4–6 engineering days** |

A narrow proof of concept would take approximately **2–3 days**, but it would
not include the full validation, documentation, and regression coverage needed
for production use.

Allow an additional **2–3 days** if the first release must also include:

- Recursively templated nested objects and arrays.
- Typed root/header templates.
- Default values for missing source fields.
- Configurable coercion rules.
- TypeScript parity and shared cross-language fixtures.

## Recommended configuration

Add `structuredTemplate` under `output` and keep the existing string
`template` unchanged:

```json
{
  "output": {
    "fileGenerator": "json-generator",
    "filename": "receipts.json",
    "arrayField": "Lines",
    "structuredTemplate": {
      "Date": {
        "type": "string",
        "value": "{receiptDate}"
      },
      "Quantity": {
        "type": "number",
        "value": "{controlQuantityProcessed}"
      },
      "SKU": {
        "type": "string",
        "value": "[removeWhiteSpaces data.skuCode]"
      },
      "LocationID": {
        "type": "string",
        "value": "{toSiteCode}"
      },
      "Received": {
        "type": "boolean",
        "value": true
      }
    }
  }
}
```

### Initial supported types

| Type | Behavior |
| --- | --- |
| `string` | Resolve the value and encode it safely as a JSON string. |
| `number` | Resolve the value and require a valid JSON number. |
| `boolean` | Accept a boolean or a supported boolean string. |
| `null` | Always write JSON `null`. |
| `literal` | Write a preconfigured JSON object, array, or scalar after validating it during setup. |

A literal can add fixed nested content without constructing JSON text:

```json
{
  "Context": {
    "type": "literal",
    "value": {
      "source": "etl",
      "tags": ["imported", "inventory"]
    }
  }
}
```

## Compatibility and precedence

The recommended rules are:

1. `template` and `structuredTemplate` are mutually exclusive. Configuring
   both is an error rather than silently choosing one.
2. When `structuredTemplate` is present, it builds each JSON row.
3. When only `template` is present, the existing string renderer is used.
4. When neither is present, the existing `outputMappings` behavior is used.
5. The feature works with both local and Azure Blob destinations because the
   destination-independent JSON encoder is shared by both writers.

This preserves every existing configuration while giving new integrations a
safer format.

## Recommended conversion rules

The first version should use strict conversion rules:

- An empty or invalid number is an error.
- `NaN` and positive or negative infinity are errors because they are not
  valid JSON numbers.
- An empty or unrecognized boolean is an error.
- Boolean strings may be limited to case-insensitive `true` and `false`.
- A missing string resolves to an empty string, matching the current template
  lookup behavior.
- A JSON null must be explicitly requested with `type: "null"`.
- Locale-specific conversions such as `"1,250.50"` are not performed.

Strict conversion prevents the ETL job from silently changing source data.
More permissive rules can be introduced later as explicit configuration.

## Error reporting

Configuration problems should fail before output begins. Examples include:

- `template` and `structuredTemplate` are both set.
- A field has an unknown type.
- A node is missing its required `value`.
- A configured literal is not valid JSON-compatible data.

Data conversion errors happen while processing a source row. They should name
the output field, requested type, and source line, for example:

```text
render structured JSON field "Quantity" at source line 42:
cannot convert "" to number
```

Any value included in an error should use the existing bounded preview logic
so large or sensitive rows are not copied into logs in full.

## Files to change

### Core implementation

| File | Required change |
| --- | --- |
| [`go/writer/writer.go`](../go/writer/writer.go) | Add `StructuredTemplate` to `OutputConfig`, define or reference its configuration types, and validate the wire format. |
| [`go/writer/json_encoder.go`](../go/writer/json_encoder.go) | Select the structured renderer, encode typed values, and attach field-level context to conversion errors. |
| [`go/writer/json_writer.go`](../go/writer/json_writer.go) | Validate template precedence and compile or validate the structured template when the writer is created. |

### Recommended new files

| File | Purpose |
| --- | --- |
| `go/writer/json_template.go` | Typed node definitions, template validation, value resolution, and conversion. |
| `go/writer/json_template_test.go` | Focused tests for every supported type and failure mode. |

Keeping the new renderer in its own file avoids making the existing document
encoder responsible for configuration parsing and type conversion.

### Tests to update

| File | Coverage to add |
| --- | --- |
| [`go/writer/json_writer_test.go`](../go/writer/json_writer_test.go) | Local writer integration, string escaping, conversion failures, precedence, cleanup, and legacy-template regression cases. |
| [`go/writer/writer_test.go`](../go/writer/writer_test.go) | Configuration decoding, invalid node types, and factory-time validation. |
| [`go/etl/etl_test.go`](../go/etl/etl_test.go) | End-to-end CSV-to-typed-JSON behavior. |
| [`go/writer/blobwriter_test.go`](../go/writer/blobwriter_test.go) | One regression case proving that structured output works through the Azure Blob sink. |

### Documentation and samples

| File | Required change |
| --- | --- |
| [`docs/usage.md`](usage.md) | Document `structuredTemplate`, supported types, precedence, conversion behavior, and examples. |
| [`docs/go-json-generator-design.md`](go-json-generator-design.md) | Move the feature out of the deferred list and record the accepted design and implementation status. |
| `sample-config/local/config.structured-json.json` | Add a runnable local example. |
| `sample-config/azure-blob/config.structured-json.json` | Optionally demonstrate the same template with an Azure destination. |

Generated documentation under `docs/docmd/` should be rebuilt through the
documentation build process and must not be edited by hand.

## Files that should not need changes

The change should remain inside the writer and configuration boundary. These
areas should not require production changes:

- `go/etl/etl.go`
- `go/etl/run.go`
- `go/writer/local_sink.go`
- `go/writer/azure_sink.go`
- Reader packages.
- Line parsing packages.

If the ETL orchestrator or destination sinks require JSON-template-specific
branches, that is a sign that the format and destination responsibilities have
become mixed.

## Implementation outline

### Phase 1: Configuration contract

- Add typed template node definitions.
- Decode `structuredTemplate` from JSON configuration.
- Reject conflicting or invalid configuration during writer construction.
- Pre-validate constant literal nodes.

### Phase 2: Typed row renderer

- Resolve source and metadata placeholders using the existing template data.
- Convert each resolved value according to its configured type.
- Encode the completed row with Go's JSON encoder instead of assembling JSON
  punctuation manually.
- Preserve deterministic field output if byte-for-byte stability is required;
  otherwise compare decoded JSON values in tests.

### Phase 3: Writer integration

- Add the structured rendering path to `jsonDocumentEncoder.renderRow`.
- Preserve the current string-template and `outputMappings` paths.
- Reuse the existing streaming document lifecycle and cleanup behavior.

### Phase 4: Verification and documentation

- Add focused unit tests and end-to-end tests.
- Run the full Go test, race, vet, and build checks.
- Add sample configurations and update usage documentation.
- Mark the feature complete in the JSON generator design after the acceptance
  criteria pass.

## Acceptance criteria

The refactor is complete when:

- Existing string-template configurations produce the same semantic JSON as
  before.
- A structured template can emit strings, numbers, booleans, nulls, and fixed
  literals.
- Quotes, backslashes, Unicode, and control characters in string values always
  produce valid JSON.
- Invalid typed values fail with the output field and source line in the error.
- Invalid static configuration fails before destination output begins.
- Local and Azure Blob outputs use the same structured renderer.
- Empty and all-invalid inputs retain the current no-output behavior.
- A failed row does not leave a final-looking partial output document.
- Memory use remains bounded; rows are still streamed and are not collected
  into one in-memory document.
- The full Go test suite, race checks, vet, and build pass.

## Main decision to confirm before implementation

The main product decision is how permissive type conversion should be. For
example, the implementation needs a clear answer on whether `"YES"` is a
boolean, whether `"1,250"` is a number, and whether an empty value becomes
`null` or fails.

The recommended starting point is strict conversion. It provides predictable
output and clear failures, while optional coercion rules can be added later
without breaking the initial contract.
