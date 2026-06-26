package line

import "fmt"

// ErrorPrefix matches the prefix produced by utils/line-validator.ts:errorPrefix.
func ErrorPrefix(lineNumber int) string {
	return fmt.Sprintf("ERROR AT LINE %d:", lineNumber)
}

// ValidateLine returns one error per empty/missing mandatory field.
// Port of the active branch of utils/line-validator.ts:validateLine (the
// column-count and barcode checks are commented out / out of scope upstream).
func ValidateLine(mandatoryFields []string, lineData map[string]string, lineNumber int) []string {
	var errs []string
	for _, field := range mandatoryFields {
		value := lineData[field]
		if value == "" {
			errs = append(errs, fmt.Sprintf("%s Invalid %s value of %q", ErrorPrefix(lineNumber), field, value))
		}
	}
	return errs
}
