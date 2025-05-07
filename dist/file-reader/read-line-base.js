"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadLineBase = void 0;
const tslib_1 = require("tslib");
const path_1 = tslib_1.__importDefault(require("path"));
const readline_1 = tslib_1.__importDefault(require("readline"));
class ReadLineBase {
    constructor(source) {
        this.source = source;
    }
    get filepath() {
        return this.source;
    }
    get url() {
        return this.source;
    }
    get extension() {
        return path_1.default.extname(this.source).replace('.', '');
    }
    get directory() {
        return path_1.default.dirname(this.source);
    }
    get filename() {
        return path_1.default.basename(this.source);
    }
    cleanUpPreviousListeners() {
        if (!this.readlineInterface)
            return;
        this.readlineInterface.removeAllListeners('line');
        this.readlineInterface.removeAllListeners('close');
        this.readlineInterface.removeAllListeners('error');
    }
    setInterface(readStream) {
        this.readlineInterface = readline_1.default.createInterface({
            input: readStream,
            crlfDelay: Infinity,
            terminal: false,
        });
    }
    readlinePromise(onLineHandler, onCloseHandler, onErrorHandler) {
        this.cleanUpPreviousListeners();
        return new Promise((resolve, reject) => {
            var _a, _b, _c;
            try {
                (_a = this.readlineInterface) === null || _a === void 0 ? void 0 : _a.on('line', onLineHandler);
                (_b = this.readlineInterface) === null || _b === void 0 ? void 0 : _b.on('close', () => onCloseHandler(resolve));
                (_c = this.readlineInterface) === null || _c === void 0 ? void 0 : _c.on('error', (e) => onErrorHandler(e));
            }
            catch (e) {
                reject(e);
            }
        });
    }
}
exports.ReadLineBase = ReadLineBase;
