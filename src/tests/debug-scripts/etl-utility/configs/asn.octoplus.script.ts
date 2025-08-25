import path from 'path';
import { ETL } from '../../../../etl';
import { DefaultGenerator } from '../../../../file-generator/default-generator';
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
const etl = new ETL(etlOptions, new DefaultGenerator(config.output));
run(etl);
