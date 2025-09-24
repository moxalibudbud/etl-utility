import fs from 'fs';
import path from 'path';
import { ETL } from '../../../../etl';
import { FileGeneratorFactory } from '../../../../file-generator';
import * as config from './asn.octoplus';
import { loadIndexAsSetAsync } from '../../../../utils';

async function run() {
  try {
    const etlOptions = {
      filesource: {
        file: path.resolve('/var/tmp', 'HEN_ASN_21072025T082408.csv'),
      },
      line: config.line,
      destinationContainer: 'xxx',
      etlType: 'xxx',
    };

    const indexFile = '/var/tmp/sku-index.dat';
    const rowReferences = await getReferences(indexFile);
    const options = {
      ...config.output,
      uniqueKey: 'SKU',
      indexFile,
      rowReferences,
    };

    const PushIfExistGenerator = FileGeneratorFactory('push-if-exist');
    const etl = new ETL(etlOptions, new PushIfExistGenerator(options));

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
