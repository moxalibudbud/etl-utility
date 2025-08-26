import path from 'path';
import { ETL } from '../../../../etl';
import { DefaultGenerator } from '../../../../file-generator/default-generator';
import * as config from './item-sku.octoplus';

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
    file: path.resolve('/var/tmp', 'HEN_Prod_06082025003256.csv'),
  },
  line: config.line,
};
const etl = new ETL(etlOptions, new DefaultGenerator(config.output));
run(etl);
