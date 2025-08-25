"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorPrefix = void 0;
exports.validateLine = validateLine;
function isAlphanumeric(input) {
    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    return alphanumericRegex.test(input);
}
function isValidBarcode(barcode) {
    return isAlphanumeric(barcode);
}
const errorPrefix = (currentLineNumber) => `ERROR AT LINE ${currentLineNumber}:`;
exports.errorPrefix = errorPrefix;
function validateLine({ line, columns, mandatoryFields, lineData, currentLineNumber, barcode, isHeader, }) {
    const errors = [];
    if (line.length !== columns.length) {
        errors.push(`${(0, exports.errorPrefix)(currentLineNumber)} Expected total columns is ${columns.length} but received ${line.length} | Required columns are ${columns.toString()} but line data is ${line.toString()}`);
    }
    if (!isHeader && barcode !== undefined && !isValidBarcode(barcode)) {
        errors.push(`${(0, exports.errorPrefix)(currentLineNumber)} Invalid barcode column with value "${barcode}"`);
    }
    mandatoryFields.map((field) => {
        const value = lineData[field];
        if (!value) {
            errors.push(`${(0, exports.errorPrefix)(currentLineNumber)} Invalid ${field} value of "${value}"`);
        }
    });
    return errors;
}
