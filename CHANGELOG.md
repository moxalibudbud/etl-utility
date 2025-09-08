## 0.1.0-beta (2025-09-11)

### Features

- Remove all `\n` in ETL config. Instaed, we move this in file generators. Example, in `DefaultGenerator.pushHeader()` and `DefaultGenerator.buildRow()`
- dasda

### Breaking Changes

- All `\n` in ETL config stored in a external storage must be remove.
