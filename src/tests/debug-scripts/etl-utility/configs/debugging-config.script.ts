import path from 'path';
import { ETL } from '../../../../etl';
import { DefaultGenerator } from '../../../../file-generator/default-generator';
import * as config from './debugging-config';

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
    file: path.resolve(__dirname, 'debugging-file.txt'),
  },
  line: config.line,
};
const etl = new ETL(etlOptions, new DefaultGenerator(config.output));
run(etl);
