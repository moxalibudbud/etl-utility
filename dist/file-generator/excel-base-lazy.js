"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelBaseLazy = void 0;
const tslib_1 = require("tslib");
const fs_1 = require("fs");
const ExcelJS = tslib_1.__importStar(require("exceljs"));
class ExcelBaseLazy {
    constructor(options) {
        this._filename = '';
        this.path = (options === null || options === void 0 ? void 0 : options.path) ? options.path : '/var/tmp';
    }
    createStream() {
        this.writeStream = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: (0, fs_1.createWriteStream)(this.filepath),
            useSharedStrings: true,
            useStyles: true,
        });
        this.createWorksheet();
    }
    createWorksheet() {
        if (this.writeStream) {
            this.worksheet = this.writeStream.addWorksheet('Sheet 1');
        }
    }
    createHeader(header) {
        if (this.worksheet) {
            this.worksheet.addRow(header).commit();
        }
    }
    end() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            var _a;
            yield ((_a = this.writeStream) === null || _a === void 0 ? void 0 : _a.commit());
        });
    }
    delete() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const removeFile = (resolve) => {
                (0, fs_1.unlink)(this.filepath, (e) => {
                    resolve(e);
                });
            };
            return new Promise((resolve, reject) => {
                try {
                    removeFile(resolve);
                }
                catch (e) {
                    reject(e);
                }
            });
        });
    }
    get filepath() {
        return `${this.path}/${this._filename}`;
    }
    get filename() {
        return this._filename;
    }
    set filename(filename) {
        this._filename = filename;
    }
}
exports.ExcelBaseLazy = ExcelBaseLazy;
