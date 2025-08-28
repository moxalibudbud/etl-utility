"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonETL = void 0;
const tslib_1 = require("tslib");
const error_report_1 = require("../file-generator/error-report");
const line_data_1 = require("../line-data");
class JsonETL {
    constructor(args, outputFileWriter) {
        this.json = [];
        this.valid = true;
        this.lineIndex = 0;
        this.options = args;
        this.errorReportWriter = this.initiateErrorReportWriter();
        this.outputFileWriter = outputFileWriter;
    }
    initiateErrorReportWriter() {
        return new error_report_1.ErrorReport({ filename: this.options.errorFilename });
    }
    onLineHandler(json) {
        this.lineIndex++;
        const options = Object.assign(Object.assign({}, this.options.line), { currentLineNumber: this.lineIndex });
        const lineModel = new line_data_1.JSONSourceLine(json, options);
        this.populate(lineModel);
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
            for (const element of this.options.json) {
                this.onLineHandler(element);
            }
        });
    }
    forceCleanUp() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.outputFileWriter.end();
            yield this.errorReportWriter.end();
            yield this.errorReportWriter.delete();
            yield this.outputFileWriter.delete();
        });
    }
    cleanUp() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.outputFileWriter.end();
            yield this.errorReportWriter.end();
            if (this.errorReportWriter.invalidRows === 0) {
                yield this.errorReportWriter.delete();
            }
            if (!this.valid) {
                yield this.outputFileWriter.delete();
            }
        });
    }
    validateFinalResult() {
        if (!this.sampleLineData || !this.identifiers) {
            this.valid = false;
            this.errorReportWriter.push('Unable to get data. File content is empty');
        }
        else if (this.options.rejectOnInvalidRow && !!this.errorReportWriter.invalidRows) {
            this.valid = false;
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
                yield this.processLines();
                this.validateFinalResult();
                yield this.cleanUp();
                return this.getResult();
            }
            catch (error) {
                this.forceCleanUp();
                throw error;
            }
        });
    }
}
exports.JsonETL = JsonETL;
