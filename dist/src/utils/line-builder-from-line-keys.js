"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLineFromLineKeys = buildLineFromLineKeys;
function buildLineFromLineKeys(line, options = {}) {
    const separator = options.separator || '|';
    const columns = Object.keys(line);
    return columns.map((key) => line[key]).join(separator) + '\n';
}
