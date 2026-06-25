import { ETL } from '../../../etl';
import { DefaultGenerator, AzureBlobStreamWriter, AzureBlobStreamWriterOptions } from '../../../file-generator/';
import { loadConfig } from './helpers';

const { config } = loadConfig('./siocs-count-file.json');

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
    // file: path.resolve('/var/tmp', 'OINV.csv'),
    blobURL: 'https://alshayastaging.blob.core.windows.net/wip/OINV.csv',
  },
  line: config.line,
};

const options: AzureBlobStreamWriterOptions = {
  containerName: 'wip',
  ...config.output,
  metadata: { timestamp: Date.now() },
};

const etl = new ETL(etlOptions, new AzureBlobStreamWriter(options));
run(etl);
