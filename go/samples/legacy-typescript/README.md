# Legacy TypeScript configuration fixtures

Files in this directory are retained only as migration and compatibility
references. They are not runnable Go samples and must not be used as examples
of the canonical Go configuration format.

`config.with-template.json` depends on TypeScript behavior that the Go core
does not currently support:

- `fileGenerator: "json-generator"` and its JSON document/array semantics;
- `arrayField` and `dataset_type` generator options;
- the outer `{"config": {...}}` envelope rather than the canonical
  `etl.Config` shape.

Its object-form `filename` is temporarily accepted by Go for compatibility,
but support for that form is planned for removal. A future runnable Go version
should be introduced only alongside a native Go JSON generator and should use
the canonical configuration shape with `filename` as a flat string.
