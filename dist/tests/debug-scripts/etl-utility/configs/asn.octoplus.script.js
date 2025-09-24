"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const path_1 = tslib_1.__importDefault(require("path"));
const etl_1 = require("../../../../etl");
const file_generator_1 = require("../../../../file-generator");
const config = tslib_1.__importStar(require("./asn.octoplus"));
const utils_1 = require("../../../../utils");
function run() {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        try {
            const etlOptions = {
                filesource: {
                    file: path_1.default.resolve('/var/tmp', 'HEN_ASN_21072025T082408.csv'),
                },
                line: config.line,
                destinationContainer: 'xxx',
                etlType: 'xxx',
            };
            const indexFile = '/var/tmp/sku-index.dat';
            const rowReferences = yield getReferences(indexFile);
            const options = Object.assign(Object.assign({}, config.output), { uniqueKey: 'SKU', indexFile,
                rowReferences });
            const PushIfExistGenerator = (0, file_generator_1.FileGeneratorFactory)('push-if-exist');
            const etl = new etl_1.ETL(etlOptions, new PushIfExistGenerator(options));
            const result = yield etl.process();
            console.log(result);
        }
        catch (error) {
            console.log(error);
        }
    });
}
function getReferences(indexPath) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const skuIndexSet = yield (0, utils_1.loadIndexAsSetAsync)(indexPath);
        return skuIndexSet;
    });
}
run();
