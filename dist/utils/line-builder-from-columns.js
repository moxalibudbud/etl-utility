"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLineFromColumns = buildLineFromColumns;
function buildLineFromColumns(line, options) {
    const separator = options.separator || '|';
    return options.columns.map((key) => line[key]).join(separator);
}
