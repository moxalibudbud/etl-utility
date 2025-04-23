"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapFields = mapFields;
function mapFields(input, config) {
    const result = {};
    for (const [outputKey, rule] of Object.entries(config)) {
        result[outputKey] = typeof rule === 'function' ? rule(input) : input[rule];
    }
    return result;
}
