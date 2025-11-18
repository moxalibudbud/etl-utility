"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const path_1 = tslib_1.__importDefault(require("path"));
const etl_1 = require("../../../../etl");
const json_generator_1 = require("../../../../file-generator/json-generator");
const octoplus_po_receiving_cin7_1 = tslib_1.__importDefault(require("./octoplus.po_receiving.cin7"));
function run(etl) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield etl.process();
            console.log(result);
        }
        catch (error) {
            console.log(error);
        }
    });
}
const etlOptions = {
    filesource: {
        file: path_1.default.resolve('/var/tmp', 'O_DSU.csv'),
    },
    line: octoplus_po_receiving_cin7_1.default.line,
};
const etl = new etl_1.JsonOutETL(etlOptions, new json_generator_1.JSONGenerator(octoplus_po_receiving_cin7_1.default.output));
run(etl);
