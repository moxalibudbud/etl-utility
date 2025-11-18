"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceLineBase = exports.DEFAULT_OPTIONS = void 0;
const utils_1 = require("../utils");
exports.DEFAULT_OPTIONS = {
    identifierMappings: {},
    outputMappings: {},
    separator: ';',
};
class SourceLineBase {
    constructor(line, options) {
        this.currentLineNumber = 1;
        this.errors = [];
        this.options = Object.assign(Object.assign({}, exports.DEFAULT_OPTIONS), options);
        this.currentLineNumber = options.currentLineNumber;
        this.separator = options.separator;
        this.columns = options.columns;
        this.line = line.split(this.separator).map((value) => value.replace(/^"|"$/g, ''));
        this.jsonLine = this.toJSON();
    }
    toJSON() {
        var _a;
        if ((_a = this.options) === null || _a === void 0 ? void 0 : _a.toJSON) {
            return this.options.toJSON(this.line);
        }
        return (0, utils_1.lineDataToJSON)(this.options.columns, this.line);
    }
    validate() {
        const validationErrors = (0, utils_1.validateLine)({
            line: this.line,
            columns: this.columns,
            mandatoryFields: this.options.mandatoryFields,
            lineData: this.jsonLine,
            currentLineNumber: this.currentLineNumber,
        });
        if (validationErrors.length) {
            this.errors.push(...validationErrors);
        }
    }
    get isValid() {
        return !this.errors.length;
    }
    get error() {
        return this.errors.toString();
    }
    get output() {
        return (0, utils_1.mapWithDefault)(this.jsonLine || {}, this.options.outputMappings);
    }
    get isHeader() {
        if (this.options.withHeader)
            return this.currentLineNumber === 1;
        return false;
    }
    get identifiers() {
        var _a;
        if ((_a = this.options) === null || _a === void 0 ? void 0 : _a.identifierMappings) {
            return (0, utils_1.mapFields)(this.jsonLine || {}, this.options.identifierMappings);
        }
        return this.jsonLine;
    }
}
exports.SourceLineBase = SourceLineBase;
