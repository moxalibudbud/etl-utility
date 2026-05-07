import { ETL } from '../../../etl';
import { DefaultGenerator } from '../../../file-generator/default-generator';
import path from 'path';
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
    file: path.resolve('/var/tmp', 'OINV.csv'),
  },
  line: config.line,
};

const etl = new ETL(etlOptions, new DefaultGenerator({ ...config.output, metadata: { timestamp: Date.now() } }));
run(etl);
