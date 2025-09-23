import path from 'path';
import { ETL } from '../../../../etl';
import { FileHierarchicalIndexGenerator } from '../../../../file-generator';
import * as config from './sku-index';

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
    file: path.resolve('/var/tmp', 'I_SKU_1757595791894.csv'),
  },
  line: config.line,
  destinationContainer: 'xxx',
  etlType: 'xxx',
};
const options = {
  ...config.output,
  uniqueKey: 'CODE_ARTICLE',
  indexDir: '/var/tmp/sku-hierarchical-index',
  indexFile: '/var/tmp/sku-hierarchical-index/' + config.output.filename,
};
const fileGenerator = new FileHierarchicalIndexGenerator(options);
const etl = new ETL(etlOptions, fileGenerator);
run(etl);
