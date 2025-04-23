"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceLine = void 0;
const line_source_base_1 = require("./line-source-base");
const utils_1 = require("../utils");
class SourceLine extends line_source_base_1.LineSourceBase {
    constructor(line, options) {
        super();
        this.options = Object.assign(Object.assign({}, line_source_base_1.DEFAULT_OPTIONS), options);
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
        return (0, utils_1.mapFields)(this.jsonLine || {}, this.options.outputMappings);
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
exports.SourceLine = SourceLine;
