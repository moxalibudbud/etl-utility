"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileReader = void 0;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const read_line_base_1 = require("./read-line-base");
class FileReader extends read_line_base_1.ReadLineBase {
    constructor(filepath) {
        super(filepath);
    }
    getReadStream() {
        const exists = fs_1.default.existsSync(this.filepath);
        if (!exists)
            throw new Error(`File ${this.filepath} doesn't exist`);
        return fs_1.default.createReadStream(this.filepath);
    }
    initiateInterface() {
        const readStream = this.getReadStream();
        this.setInterface(readStream);
        this.cleanUpPreviousListeners();
    }
}
exports.FileReader = FileReader;
