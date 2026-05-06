import path from 'path';
import { LineOutputOptions, LineSourceBaseOptions } from 'src/line-data';
import { ETL } from '../../../../etl';
import { DefaultGenerator, JSONGenerator } from '../../../../file-generator';

export const line: LineSourceBaseOptions = {
  columns: ['store', 'sku', 'units', 'ERP', 'countID'],
  mandatoryFields: [],
  identifierMappings: {},
  outputMappings: {
    TYPE_MOUVEMENT: 'M',
    CODE_ARTICLE: 'sku',
    MAIN_EAN: 'ProductId',
    CODE_PRODUCT: '',
    SHORT_LABEL: 'Description',
    LONG_LABEL: '',
    CODE_SEASON: 'SeasonCode',
    CODE_SUPPLIER: '',
    CODE_FAMILY: 'CategoryId',
    CODE_NGP: '',
    CODE_COLOR: 'ColorCode',
    CODE_SIZE: 'SizeCode',
    PRIMARY_TYPE_TAG: '',
    SECONDARY_TYPE_TAG: '',
    SELLING_PRICE: '',
    BUYING_PRICE: '',
    URL_PICTURE: '',
    TRACEABILITY_MODE: '',
    SUPPLIER_REF: '',
    END_PRODUCT: '',
    QUANTITY: '',
    UNIT: '',
    FIDELITY_PRICE: '',
    USERFIELD_1: '',
    USERFIELD_2: '',
    USERFIELD_3: '',
    USERFIELD_4: '',
    USERFIELD_5: '',
    CODE_BRAND: '',
    PRICE_COMPARISON_UNIT: '',
    PRICE_COMPARISON_DIVIDER: '',
    RANK: '',
  },
  separator: '\t',
  withHeader: true,
};

export const output: LineOutputOptions = {
  filename: {
    template: 'I_SKU_[timestamp].csv',
  },
  header:
    'TYPE_MOUVEMENT;CODE_ARTICLE;MAIN_EAN;CODE_PRODUCT;SHORT_LABEL;LONG_LABEL;CODE_SEASON;CODE_SUPPLIER;CODE_FAMILY;CODE_NGP;CODE_COLOR;CODE_SIZE;PRIMARY_TYPE_TAG;SECONDARY_TYPE_TAG;SELLING_PRICE;BUYING_PRICE;URL_PICTURE;TRACEABILITY_MODE;SUPPLIER_REF;END_PRODUCT;QUANTITY;UNIT;FIDELITY_PRICE;USERFIELD_1;USERFIELD_2;USERFIELD_3;USERFIELD_4;USERFIELD_5;CODE_BRAND;PRICE_COMPARISON_UNIT;PRICE_COMPARISON_DIVIDER;RANK\n',
  // footer: 'sample footer',
  // header: (args: SourceLine) => generatorOptions.columns.join(generatorOptions.separator) + '\n',
  // footer: 'sample footer',
  separator: ';',
  uniqueKey: 'sku',
  // template: 'false;{BARCODE};{PART_NUMBER};{DESCRIPTION};g',
};

async function run(etl: any) {
  try {
    const result = await etl.process();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(error);
  }
}

const etlOptions = {
  filesource: {
    // file: path.resolve('/var/tmp', 'ISKU.csv'),
    blobURL:
      'https://alshayastaging.blob.core.windows.net/wip/COUNTRY_Final Count File_RC1-3029-WES_9080_20241231201010.txt',
  },
  line: line,
};

const etl = new ETL(etlOptions, new DefaultGenerator({ ...output, metadata: { store: '8002' } }));
run(etl);
