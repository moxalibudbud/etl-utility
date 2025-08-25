"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ETL = void 0;
const tslib_1 = require("tslib");
const error_report_1 = require("../file-generator/error-report");
const readline_interface_factory_1 = require("../file-reader/readline-interface-factory");
const line_data_1 = require("../line-data");
class ETL {
    constructor(args, outputFileWriter) {
        var _a;
        this.valid = true;
        this.lineIndex = 0;
        this.uniqueIdentifierList = [];
        this.options = args;
        this.fileSource = (_a = args.filesource.blobURL) !== null && _a !== void 0 ? _a : args.filesource.file;
        this.lineReader = this.initiateReadlineInterface(args.filesource.blobURL);
        this.errorReportWriter = this.initiateErrorReportWriter();
        this.outputFileWriter = outputFileWriter;
    }
    initiateReadlineInterface(blobUrl) {
        const lineReaderType = blobUrl ? readline_interface_factory_1.ReadLineInterfaceType.Blob : readline_interface_factory_1.ReadLineInterfaceType.File;
        return (0, readline_interface_factory_1.readLineInterface)(this.fileSource, lineReaderType);
    }
    initiateErrorReportWriter() {
        if (!this.lineReader)
            throw new Error('lineReader needs to instantiate first to generate error report writer');
        return new error_report_1.ErrorReport({ filename: this.lineReader.filename });
    }
    onLineHandler(chunk) {
        var _a;
        try {
            this.lineIndex++;
            const options = Object.assign(Object.assign({}, this.options.line), { currentLineNumber: this.lineIndex });
            const lineModel = new line_data_1.SourceLine(chunk, options);
            this.populate(lineModel);
        }
        catch (error) {
            (_a = this.lineReader.readlineInterface) === null || _a === void 0 ? void 0 : _a.emit('error', error);
        }
    }
    onCloseHandler(resolve) {
        resolve({});
        this.outputFileWriter.pushFooter();
    }
    populate(line) {
        line.validate();
        if (!line.isValid) {
            this.errorReportWriter.push(line.error);
        }
        if (line.isValid && !line.isHeader) {
            this.outputFileWriter.push(line);
        }
        if ((!this.sampleLineData || !this.identifiers) && line.isValid && !line.isHeader) {
            this.setSampleLineData(line.jsonLine);
            this.setIdentifier(line.identifiers);
        }
    }
    setSampleLineData(args) {
        this.sampleLineData = args;
    }
    setIdentifier(identifiers) {
        this.identifiers = identifiers;
    }
    processLines() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                var _a, _b, _c;
                try {
                    (_a = this.lineReader.readlineInterface) === null || _a === void 0 ? void 0 : _a.on('line', this.onLineHandler.bind(this));
                    (_b = this.lineReader.readlineInterface) === null || _b === void 0 ? void 0 : _b.on('close', () => this.onCloseHandler(resolve));
                    (_c = this.lineReader.readlineInterface) === null || _c === void 0 ? void 0 : _c.on('error', (e) => reject(e));
                }
                catch (e) {
                    reject(e);
                }
            });
        });
    }
    cleanUp() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.outputFileWriter.end();
            yield this.errorReportWriter.end();
            this.lineReader.cleanUpPreviousListeners();
            if (this.errorReportWriter.invalidRows === 0) {
                yield this.errorReportWriter.delete();
            }
            if (!this.valid) {
                yield this.outputFileWriter.delete();
            }
        });
    }
    validateFinalResult() {
        const withErrors = !!this.errorReportWriter.invalidRows;
        if (!this.sampleLineData || !this.identifiers || withErrors) {
            this.valid = false;
            this.errorReportWriter.push('Unable to get data. File content is empty or some rows are invalid');
        }
    }
    getResult() {
        return {
            valid: this.valid,
            withErrors: !!this.errorReportWriter.invalidRows,
            totalErrors: this.errorReportWriter.invalidRows,
            localOutputFile: this.outputFileWriter.filepath,
            localOutputFilename: this.outputFileWriter.filename,
            localErrorReportFile: this.errorReportWriter.filepath,
            localErrorReportFilename: this.errorReportWriter.filename,
            metadata: Object.assign(Object.assign({}, this.sampleLineData), this.identifiers),
        };
    }
    process() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                yield this.lineReader.initiateInterface();
                yield this.processLines();
                this.validateFinalResult();
                yield this.cleanUp();
                return this.getResult();
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.ETL = ETL;
