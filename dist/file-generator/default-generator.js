"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultGenerator = void 0;
const flat_file_base_lazy_1 = require("./flat-file-base-lazy");
const utils_1 = require("../utils");
class DefaultGenerator extends flat_file_base_lazy_1.FlatFileBaseLazy {
    constructor(options) {
        super(options);
        this.options = options;
    }
    setFilename(line) {
        const filename = this.options.filename;
        this.filename = typeof filename === 'function' ? filename(line) : filename;
    }
    pushFooter() {
        var _a, _b;
        const footer = (_a = this.options) === null || _a === void 0 ? void 0 : _a.footer;
        if (!footer)
            return;
        const footerRow = typeof footer === 'function' ? footer({}) : footer;
        (_b = this.writeStream) === null || _b === void 0 ? void 0 : _b.write(footerRow);
    }
    pushHeader(line) {
        const header = this.options.header;
        if (!header)
            return;
        const headerRow = typeof header === 'function' ? header(line) : header;
        this.createHeader(headerRow);
    }
    buildRow(line) {
        if (!this.options.template && !this.options.rowMap) {
            throw new Error('Either template or rowMap must be provided');
        }
        let row = '';
        if (this.options.template) {
            row = (0, utils_1.buildLineFromTemplate)(line.jsonLine, { template: this.options.template });
        }
        else {
            const { separator, columns } = this.options;
            row = (0, utils_1.buildLineFromColumns)(line.output, { separator, columns });
        }
        return row;
    }
    push(SourceLine) {
        var _a;
        if (!this.filename) {
            this.setFilename(SourceLine);
        }
        if (!this.writeStream) {
            this.createStream();
            this.pushHeader(SourceLine);
        }
        const row = this.buildRow(SourceLine);
        (_a = this.writeStream) === null || _a === void 0 ? void 0 : _a.write(row);
    }
}
exports.DefaultGenerator = DefaultGenerator;
