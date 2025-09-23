import path from 'path';
import { ETL } from '../../../../etl';
import { SkipIfExistGenerator } from '../../../../file-generator';
import * as config from './asn.octoplus';

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
    file: path.resolve('/var/tmp', 'HEN_ASN_21072025T082408.csv'),
  },
  line: config.line,
  destinationContainer: 'xxx',
  etlType: 'xxx',
};
const options = {
  ...config.output,
  uniqueKey: 'SKU',
  indexFile: '/Users/john/Projects/etl-utility/.devdata/sku_index.json',
};
const etl = new ETL(etlOptions, new SkipIfExistGenerator(options));
run(etl);
