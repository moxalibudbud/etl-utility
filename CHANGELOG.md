## 0.2.4-alpha (2025-11-18)

### Features

- Re-write source-line-base.ts to make it extensible for child classes. Ability for clients to define their own Source line logic.
- This re-write gives the ability to create ETL specifically for Octo+ out files
- This re-write gives the ability to clients to extend as well the default ETL class and pass
- All sample implementation is in ./tests/debug-scripts/octoplus-etl

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
