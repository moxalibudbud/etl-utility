import path from 'path';
import { JsonOutETL } from '../../../../etl';
import { JSONGenerator } from '../../../../file-generator/json-generator';
import * as config from './octoplus.po_receiving.cin7';

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
    file: path.resolve('/var/tmp', 'O_DSU.csv'),
  },
  line: config.line,
};
const etl = new JsonOutETL(etlOptions, new JSONGenerator(config.output));
run(etl);
