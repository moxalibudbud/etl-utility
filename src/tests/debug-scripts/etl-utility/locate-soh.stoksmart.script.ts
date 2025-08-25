import path from 'path';
import { ETL } from '../../../etl';
import { DefaultGenerator } from '../../../file-generator';
import * as config from './configs/config.locate-soh.stoksmart';

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
    file: path.resolve('/var/tmp', 'stock_132.txt'),
  },
  line: config.line,
  destinationContainer: 'stoksmart-soh',
  etlType: 'soh',
};
const etl = new ETL(etlOptions, new DefaultGenerator(config.output));
run(etl);
