## 0.2.0-beta (2025-09-24)

### Features

- Implement `push-if-exist` file generator to push only rows if exist from some reference
- Implement `file-index-generator` file generator that writes an index file as a reference. This reference is used by `push-if-exist` file generator
- A factory function that returns file generator based on the given key.

### Breaking Changes

n/a

## 0.1.0-beta (2025-09-11)

### Features

- Remove all `\n` in ETL config. Instaed, we move this in file generators. Example, in `DefaultGenerator.pushHeader()` and `DefaultGenerator.buildRow()`

### Breaking Changes

- All `\n` in ETL config stored in a external storage must be remove.
