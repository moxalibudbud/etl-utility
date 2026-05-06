import path from 'path';
import { ETL } from '../../../etl';
import { DefaultGenerator } from '../../../file-generator';
import * as goldItemMasterConfig from './configs/config.gold-item-master.stoksmart';

async function run(etl: any) {
  try {
    const result = await etl.process();
    console.log(result);
  } catch (error) {
    console.log(error);
  }
}

const etlOptions = {
  filesource: {
    file: path.resolve('/var/tmp', 'VIF_ITEMMASTER_LEG_102048243_22052025093031MERGED'),
  },
  line: goldItemMasterConfig.line,
  destinationContainer: 'datascan-item-master',
  etlType: 'item-master',
};
const etl = new ETL(etlOptions, new DefaultGenerator(goldItemMasterConfig.output));
run(etl);
