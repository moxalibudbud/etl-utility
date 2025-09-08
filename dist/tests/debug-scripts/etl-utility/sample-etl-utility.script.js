"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const path_1 = tslib_1.__importDefault(require("path"));
const etl_1 = require("../../../etl");
const file_generator_1 = require("../../../file-generator");
const goldItemMasterConfig = tslib_1.__importStar(require("./configs/config.gold-item-master.stoksmart"));
const MOCKDATA_DIR = 'mockdata';
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
        file: path_1.default.resolve('/var/tmp', 'VIF_ITEMMASTER_LEG_102048243_22052025093031MERGED'),
    },
    line: goldItemMasterConfig.line,
    destinationContainer: 'datascan-item-master',
    etlType: 'item-master',
};
const etl = new etl_1.ETL(etlOptions, new file_generator_1.DefaultGenerator(goldItemMasterConfig.output));
run(etl);
