"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LineSourceBase = void 0;
class LineSourceBase {
    constructor() {
        this.currentLineNumber = 1;
        this.errors = [];
    }
}
exports.LineSourceBase = LineSourceBase;
