import { LineOutputOptions, LineSourceBaseOptions } from 'src/line-data';
import { ETL, JsonOutETL } from '../../../../etl';
import { DefaultGenerator } from '../../../../file-generator/default-generator';
import path from 'path';
import { JSONGenerator } from 'src/file-generator';

export const line: LineSourceBaseOptions = {
  columns: [
    'TYPE_MOUVEMENT',
    'CODE_ARTICLE',
    'MAIN_EAN',
    'CODE_PRODUCT',
    'SHORT_LABEL',
    'LONG_LABEL',
    'CODE_SEASON',
    'CODE_SUPPLIER',
    'CODE_FAMILY',
    'CODE_NGP',
    'CODE_COLOR',
    'CODE_SIZE',
    'PRIMARY_TYPE_TAG',
    'SECONDARY_TYPE_TAG',
    'SELLING_PRICE',
    'BUYING_PRICE',
    'URL_PICTURE',
    'TRACEABILITY_MODE',
    'SUPPLIER_REF',
    'END_PRODUCT',
    'QUANTITY',
    'UNIT',
    'FIDELITY_PRICE',
    'USERFIELD_1',
    'USERFIELD_2',
    'USERFIELD_3',
    'USERFIELD_4',
    'USERFIELD_5',
    'CODE_BRAND',
    'PRICE_COMPARISON_UNIT',
    'PRICE_COMPARISON_DIVIDER',
    'RANK',
  ],
  mandatoryFields: [],
  identifierMappings: {},
  outputMappings: {},
  separator: ';',
  withHeader: true,
};

export const output: LineOutputOptions = {
  filename: {
    template: 'stoksmart-item-cost.json',
  },
  template: '{"store": "[return args.metadata.store]", "sku": "{CODE_ARTICLE}", "cost": "{BUYING_PRICE}"}',
  header: '{"lines": []}',
  separator: ';',
  arrayField: 'lines',
  fileGenerator: 'json-generator',
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
    file: path.resolve('/var/tmp', 'ISKU.csv'),
  },
  line: line,
};

const etl = new JsonOutETL(etlOptions, new JSONGenerator({ ...output, metadata: { store: '8002' } }));
run(etl);
