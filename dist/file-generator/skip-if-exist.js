"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipIfExistGenerator = void 0;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const flat_file_base_lazy_1 = require("./flat-file-base-lazy");
const utils_1 = require("../utils");
const replace_with_function_1 = require("../utils/replace-with-function");
const replace_with_map_1 = require("../utils/replace-with-map");
class SkipIfExistGenerator extends flat_file_base_lazy_1.FlatFileBaseLazy {
    constructor(options) {
        super(options);
        this.rowReferences = new Set();
        this.options = options;
        this.loadIndex();
    }
    loadIndex() {
        try {
            console.log('Loading index...');
            const indexArray = JSON.parse(fs_1.default.readFileSync(this.options.indexFile, 'utf8'));
            this.rowReferences = new Set(indexArray);
            console.log(`Loaded ${indexArray.length} SKUs into memory.`);
            return this.rowReferences;
        }
        catch (error) {
            console.error('Error loading SKU index:', error);
            throw new Error('SKU index not found. Please build index first.');
        }
    }
    setFilename(line) {
        const { filename } = this.options;
        if (typeof filename === 'function') {
            this.filename = filename(line);
        }
        else if (typeof filename === 'object' && filename !== null) {
            let name = (0, replace_with_map_1.replaceWithMap)(filename.template, line.jsonLine);
            name = (0, replace_with_function_1.replaceWithFunction)(name);
            this.filename = name;
        }
        else {
            this.filename = filename;
        }
    }
    pushFooter() {
        var _a, _b;
        const footer = (_a = this.options) === null || _a === void 0 ? void 0 : _a.footer;
        if (!footer)
            return;
        const footerRow = typeof footer === 'function' ? footer() : footer;
        (_b = this.writeStream) === null || _b === void 0 ? void 0 : _b.write(footerRow);
    }
    pushHeader(line) {
        const header = this.options.header;
        if (!header)
            return;
        const headerRow = typeof header === 'function' ? header(line) : header;
        this.createHeader(headerRow) + '\n';
    }
    buildRow(line) {
        let row = '';
        if (typeof this.options.template === 'string') {
            row = (0, replace_with_map_1.replaceWithMap)(this.options.template, line.jsonLine);
        }
        else if (typeof this.options.template === 'function') {
            row = this.options.template(line);
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
    push(sourceLine) {
        var _a;
        if (!this.filename) {
            this.setFilename(sourceLine);
        }
        if (!this.writeStream) {
            this.createStream();
            this.pushHeader(sourceLine);
        }
        if (this.isRowExist(sourceLine))
            return;
        const row = this.buildRow(sourceLine);
        (_a = this.writeStream) === null || _a === void 0 ? void 0 : _a.write(row);
    }
}
exports.SkipIfExistGenerator = SkipIfExistGenerator;
