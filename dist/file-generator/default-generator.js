"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultGenerator = void 0;
const flat_file_base_lazy_1 = require("./flat-file-base-lazy");
const utils_1 = require("../utils");
const replace_with_function_1 = require("../utils/replace-with-function");
const replace_with_map_1 = require("../utils/replace-with-map");
class DefaultGenerator extends flat_file_base_lazy_1.FlatFileBaseLazy {
    constructor(options) {
        super(options);
        this.rowReferences = new Set();
        this.options = options;
    }
    setFilename(line) {
        const { filename } = this.options;
        if (typeof filename === 'object' && filename !== null) {
            const metadata = Object.assign(Object.assign({}, line.allData), { metadata: this.options.metadata });
            this.filename = (0, replace_with_function_1.replaceWithFunction)((0, replace_with_map_1.replaceWithMap)(filename.template, line.jsonLine), metadata);
        }
        else {
            this.filename = filename;
        }
    }
    pushFooter() {
        var _a, _b, _c;
        if ((_a = this.options) === null || _a === void 0 ? void 0 : _a.footer) {
            (_b = this.writeStream) === null || _b === void 0 ? void 0 : _b.write((_c = this.options) === null || _c === void 0 ? void 0 : _c.footer);
        }
    }
    pushHeader(line) {
        if (!this.options.header)
            return;
        const metadata = Object.assign(Object.assign({}, line.allData), { metadata: this.options.metadata });
        const headerRow = (0, replace_with_function_1.replaceWithFunction)(this.options.header, metadata);
        this.createHeader(headerRow) + '\n';
    }
    buildRow(line) {
        let row = '';
        if (typeof this.options.template === 'string') {
            const metadata = Object.assign(Object.assign({}, line.allData), { metadata: this.options.metadata || {} });
            row = (0, replace_with_function_1.replaceWithFunction)((0, replace_with_map_1.replaceWithMap)(this.options.template, line.jsonLine), metadata);
        }
        else {
            const { separator } = this.options;
            row = (0, utils_1.buildLineFromLineKeys)(line.output, { separator });
        }
        return line.isHeader ? row : '\n' + row;
    }
    isRowExist({ jsonLine }) {
        if (this.options.uniqueKey) {
            return !!this.rowReferences.has(jsonLine[this.options.uniqueKey]);
        }
    }
    accumulateNumberValue({ jsonLine }) {
        if (this.options.uniqueKey) {
            return !!this.rowReferences.has(jsonLine[this.options.uniqueKey]);
        }
    }
    trackReference({ jsonLine }) {
        if (this.options.uniqueKey) {
            const key = jsonLine[this.options.uniqueKey];
            this.rowReferences.add(key);
        }
    }
    push(sourceLine) {
        var _a;
        const isRowExist = this.isRowExist(sourceLine);
        if (!this.filename) {
            this.setFilename(sourceLine);
        }
        if (!this.writeStream) {
            this.createStream();
            this.pushHeader(sourceLine);
        }
        if (isRowExist)
            return;
        const row = this.buildRow(sourceLine);
        (_a = this.writeStream) === null || _a === void 0 ? void 0 : _a.write(row);
        this.trackReference(sourceLine);
    }
}
exports.DefaultGenerator = DefaultGenerator;
