import path from 'path';
import { ETL } from '../../../../etl';
import { FileIndexGenerator } from '../../../../file-generator';
import * as config from './sku-index';
import { loadIndexAsSetAsync } from '../../../../utils';

async function run() {
  try {
    const etlOptions = {
      filesource: {
        file: path.resolve('/var/tmp', 'xI_SKU_1757590395045.csv'),
      },
      line: config.line,
      destinationContainer: 'xxx',
      etlType: 'xxx',
    };

    const indexFile = path.resolve('/var/tmp/', config.output.filename as string);
    const rowReferences = await getReferences(indexFile);
    const options = {
      ...config.output,
      uniqueKey: 'CODE_ARTICLE',
      indexFile,
      rowReferences,
    };
    const fileGenerator = new FileIndexGenerator(options);
    const etl = new ETL(etlOptions, fileGenerator);

    const result = await etl.process();
    console.log(result);
  } catch (error) {
    console.log(error);
  }
}

async function getReferences(indexPath: string) {
  const skuIndexSet = await loadIndexAsSetAsync(indexPath);
  return skuIndexSet;
}

run();
