"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileIndexGenerator = void 0;
const tslib_1 = require("tslib");
const path_1 = tslib_1.__importDefault(require("path"));
const flat_file_base_lazy_1 = require("./flat-file-base-lazy");
const utils_1 = require("../utils");
const replace_with_function_1 = require("../utils/replace-with-function");
const replace_with_map_1 = require("../utils/replace-with-map");
class FileIndexGenerator extends flat_file_base_lazy_1.FlatFileBaseLazy {
    constructor(options) {
        options.path = path_1.default.dirname(options.indexFile);
        super(options);
        this.options = options;
        this.rowReferences = options.rowReferences;
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
    }
    trackReference({ jsonLine }) {
        const key = jsonLine[this.options.uniqueKey];
        this.rowReferences.add(key);
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
        return '\n' + row;
    }
    isRowExist({ jsonLine }) {
        return !!this.rowReferences.has(jsonLine[this.options.uniqueKey]);
    }
    push(sourceLine) {
        var _a;
        if (!this.filename) {
            this.setFilename(sourceLine);
        }
        if (!this.writeStream) {
            this.createStream({ flags: 'w' });
        }
        if (this.isRowExist(sourceLine))
            return;
        this.trackReference(sourceLine);
        const row = this.buildRow(sourceLine);
        (_a = this.writeStream) === null || _a === void 0 ? void 0 : _a.write(row);
    }
}
exports.FileIndexGenerator = FileIndexGenerator;
