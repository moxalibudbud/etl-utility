import type { Config } from './types'

// Sample Config standing in for the wizard's output, until the form and
// /api/infer endpoints exist. Exercises both destination types and all three
// outputMappings src kinds (column / literal / function) so the display
// components below have something worth rendering.
export const mockConfig: Config = {
  source: {
    type: 'local',
    path: '/var/tmp/incoming/products.csv',
  },
  output: {
    type: 'azure-blob',
    url: 'https://acct.blob.core.windows.net/exports/daily',
    fileGenerator: 'default-generator',
    filename: 'products_[dateTime YYYY-MM-DD].csv',
    separator: ';',
    header: 'SKU;BARCODE;NAME;PRICE;CURRENCY;EXPORTED_AT',
    footer: '',
    template: '',
    arrayField: '',
    uniqueKey: '',
    metadata: { pipeline: 'nightly-sync', owner: 'catalog-team' },
    options: { errorReport: true },
  },
  options: {
    line: {
      columns: ['sku', 'barcode', 'name', 'price', 'stock'],
      separator: ',',
      withHeader: true,
      mandatoryFields: ['sku', 'barcode'],
      outputMappings: [
        { out: 'SKU', src: 'sku' },
        { out: 'BARCODE', src: 'barcode' },
        { out: 'NAME', src: 'name' },
        { out: 'PRICE', src: 'price' },
        { out: 'CURRENCY', src: 'EUR' },
        { out: 'EXPORTED_AT', src: '[timestamp]' },
      ],
      identifierMappings: [{ out: 'sku', src: 'sku' }],
    },
    rejectOnInvalidRow: false,
  },
}
