import { LineOutputOptions, LineSourceBaseOptions } from 'src/line-data';
import { ETL } from '../../../../etl';
import { DefaultGenerator } from '../../../../file-generator/default-generator';
import path from 'path';

export const line: LineSourceBaseOptions = {
  columns: [
    'count_id',
    'LABEL_DOC',
    'store',
    'STOCK_LOCATION',
    'DATE',
    'STATUS_DOC',
    'sku',
    'EXPECTED_QUANTITY_LINE',
    'counted',
    'GAP_QUANTITY_LINE',
    'STATUS_LINE',
    'FAMILY',
  ],
  mandatoryFields: [],
  identifierMappings: {},
  outputMappings: {},
  separator: ';',
  withHeader: true,
};

export const output: LineOutputOptions = {
  filename: {
    template: 'STK_[return args.metadata.timestamp]_{store}.dat',
  },
  header: 'FTAIL|[return args.store]|[return args.count_id]',
  template: 'FDETL|[return args.metadata.timestamp]||{sku}|{counted}||',
  footer: '\nFTAIL|',
  separator: '|',
  uniqueKey: 'sku',
};

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
  line: line,
};

const etl = new ETL(etlOptions, new DefaultGenerator({ ...output, metadata: { timestamp: Date.now() } }));
run(etl);
