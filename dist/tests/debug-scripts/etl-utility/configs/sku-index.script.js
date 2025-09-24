"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const path_1 = tslib_1.__importDefault(require("path"));
const etl_1 = require("../../../../etl");
const file_generator_1 = require("../../../../file-generator");
const config = tslib_1.__importStar(require("./sku-index"));
const utils_1 = require("../../../../utils");
function run() {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        try {
            const etlOptions = {
                filesource: {
                    file: path_1.default.resolve('/var/tmp', 'xI_SKU_1757590395045.csv'),
                },
                line: config.line,
                destinationContainer: 'xxx',
                etlType: 'xxx',
            };
            const indexFile = path_1.default.resolve('/var/tmp/', config.output.filename);
            const rowReferences = yield getReferences(indexFile);
            const options = Object.assign(Object.assign({}, config.output), { uniqueKey: 'CODE_ARTICLE', indexFile,
                rowReferences });
            const fileGenerator = new file_generator_1.FileIndexGenerator(options);
            const etl = new etl_1.ETL(etlOptions, fileGenerator);
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
