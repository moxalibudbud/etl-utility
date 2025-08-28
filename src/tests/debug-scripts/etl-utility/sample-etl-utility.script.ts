import path from 'path';
import { ETL, JsonETL } from '../../../etl';
import { DefaultGenerator } from '../../../file-generator';
import * as goldItemMasterConfig from './configs/config.gold-item-master.stoksmart';
import * as rmsItemMasterConfig from './configs/config.rms-item-master';

const MOCKDATA_DIR = 'mockdata';

async function run(etl: any) {
  try {
    const result = await etl.process();
    console.log(result);
  } catch (error) {
    console.log(error);
  }
}

// const rmsOnhandETL = new DatascanOnhandETL({
//   file: path.resolve(MOCKDATA_DIR, 'als_stock_count_snapshot_export_30030_03012025130031_AME.out'),
//   fileType: AzureBlobContainers.RMS_SOH,
// });

// run(rmsOnhandETL);

// const siocsOnhandETL = new DatascanOnhandETL({
//   file: path.resolve(MOCKDATA_DIR, 'als_stock_count_snapshot_export_63103_33112_03012025130031_AME.out'),
//   fileType: AzureBlobContainers.SIOCS_SOH,
// });

// run(siocsOnhandETL);

// const goldGoodETL = new DatascanOnhandETL({
//   file: path.resolve(MOCKDATA_DIR, 'gold-snapshot-good.csv'),
//   fileType: AzureBlobContainers.GOLD_SOH
// });

// run(goldGoodETL);

// const goldCountFile = new AlshayaCountFileETL({
//   file: path.resolve(MOCKDATA_DIR, 'datascan-count-file-empty.txt'),
//   // file: path.resolve(MOCKDATA_DIR, 'SA_Final Count File_RB2-S605-AME_2222_20241231201010.txt'),
//   destinationContainer: AzureBlobContainers.GOLD_COUNT_FILE,
//   outputFileWriter: new GoldCountFile(),
//   fileType: AzureBlobContainers.DATASCAN_COUNT_FILE,
// });

// run(goldCountFile);

// const rmsCountFile = new AlshayaCountFileETL({
//   // file: path.resolve(MOCKDATA_DIR, 'datascan-count-file-empty.txt'),
//   file: path.resolve(MOCKDATA_DIR, 'SA_Final Count File_RB2-S605-AME_2222_20241231201010.txt'),
//   destinationContainer: AzureBlobContainers.RMS_COUNT_FILE,
//   outputFileWriter: new RmsCountFile({ countDate: '2024-09-30' }),
//   fileType: AzureBlobContainers.DATASCAN_COUNT_FILE,
// });

// run(rmsCountFile);

// const siocsCountFile = new AlshayaCountFileETL({
//   file: path.resolve(MOCKDATA_DIR, 'SA_Final Count File_RB2-S605-AME_2222_20241231201010.txt'),
//   destinationContainer: AzureBlobContainers.SIOCS_COUNT_FILE,
//   outputFileWriter: new SiocsCountFile({ countDate: '20241231201010' }),
//   fileType: AzureBlobContainers.DATASCAN_COUNT_FILE,
// });

// run(siocsCountFile);

// const rmsItemMaster = new DatascanItemMasterETL({
//   file: path.resolve('/var/tmp', 'als_product_master_delta_BOO_20241219.out'),
//   // file: path.resolve(MOCKDATA_DIR, 'als_product_master_full_HEN_20240923.out'),
//   fileType: AzureBlobContainers.RMS_ITEM_MASTER,
// });
// run(rmsItemMaster);

// const etlOptions = {
//   filesource: {
//     file: path.resolve('/var/tmp', 'als_product_master_delta_AME_20250211.out'),
//   },
//   line: rmsItemMasterConfig.line,
// };
// const etl = new ETL(etlOptions, new DefaultGenerator(rmsItemMasterConfig.output));
// run(etl);

// const etlOptions = {
//   filesource: {
//     file: path.resolve('/var/tmp', 'VIF_ITEMMASTER_LEG_102048243_22052025093031MERGED'),
//   },
//   line: goldItemMasterConfig.line,
//   destinationContainer: 'datascan-item-master',
//   etlType: 'item-master',
// };
// const etl = new ETL(etlOptions, new DefaultGenerator(goldItemMasterConfig.output));
// run(etl);

const etlOptions = {
  json: [
    {
      MESSAGEID: '',
      MAIN_BRAND: '',
      BRAND: '',
      PART_NUMBER: '1',
      BARCODE: '1',
      DESCRIPTION: '',
      DESCRIPTION_2: '',
      STYLE: '1',
      STYLE_DESCRIPTION: '',
      COLOR: '',
      COLOR_DESCRIPTION: '',
      SIZE_1: '',
      SIZE_DESCRIPTION: '',
      SIZE_2: '',
      SIZE_DESCRIPTION_2: '',
      S_PGROUP: '',
    },
  ],
  errorFilename: 'ETLFromJson',
  line: goldItemMasterConfig.line,
  destinationContainer: 'datascan-item-master',
  etlType: 'item-master',
};
const etl = new JsonETL(etlOptions, new DefaultGenerator(goldItemMasterConfig.output));
run(etl);
