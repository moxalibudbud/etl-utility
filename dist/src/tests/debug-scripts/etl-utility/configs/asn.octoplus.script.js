"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const path_1 = tslib_1.__importDefault(require("path"));
const etl_1 = require("../../../../etl");
const default_generator_1 = require("../../../../file-generator/default-generator");
const config = tslib_1.__importStar(require("./asn.octoplus"));
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
        file: path_1.default.resolve('/var/tmp', 'HEN_ASN_21072025T082408.csv'),
    },
    line: config.line,
    destinationContainer: 'xxx',
    etlType: 'xxx',
};
const etl = new etl_1.ETL(etlOptions, new default_generator_1.DefaultGenerator(config.output));
run(etl);
