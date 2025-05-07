"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LineSourceBase = exports.DEFAULT_OPTIONS = void 0;
exports.DEFAULT_OPTIONS = {
    identifierMappings: {},
    outputMappings: {},
    separator: ';',
};
class LineSourceBase {
    constructor() {
        this.currentLineNumber = 1;
        this.errors = [];
    }
}
exports.LineSourceBase = LineSourceBase;
