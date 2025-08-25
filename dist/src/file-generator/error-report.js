"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorReport = void 0;
const flat_file_base_1 = require("./flat-file-base");
class ErrorReport extends flat_file_base_1.FlatFileBase {
    constructor(options) {
        super(Object.assign(Object.assign({}, options), { filename: `${options.filename}.error.txt` }));
        this.invalidRows = 0;
    }
    push(line) {
        this.writeStream.write(`${line}\n`);
        this.incrementInvalidRowsCount();
    }
    incrementInvalidRowsCount() {
        this.invalidRows++;
    }
}
exports.ErrorReport = ErrorReport;
