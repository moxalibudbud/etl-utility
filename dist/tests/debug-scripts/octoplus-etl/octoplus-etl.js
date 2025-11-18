"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OctoplusOutfileETL = void 0;
const etl_1 = require("../../../etl");
const octoplus_source_line_1 = require("./octoplus-source-line");
class OctoplusOutfileETL extends etl_1.ETL {
    constructor(args, outputFileWriter) {
        super(args, outputFileWriter);
    }
    onLineHandler(chunk) {
        var _a;
        try {
            this.lineIndex++;
            const options = Object.assign(Object.assign({}, this.options.line), { currentLineNumber: this.lineIndex });
            const lineModel = new octoplus_source_line_1.OctoplusSourceLine(chunk, options);
            this.populate(lineModel);
        }
        catch (error) {
            (_a = this.lineReader.readlineInterface) === null || _a === void 0 ? void 0 : _a.emit('error', error);
        }
    }
}
exports.OctoplusOutfileETL = OctoplusOutfileETL;
