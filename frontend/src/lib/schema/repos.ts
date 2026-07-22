import { makeInt01Fields } from './int01'
import type { RepoSchema, RepoSlug, FieldDef } from './types'

const MOUVEMENT_FIELD: FieldDef = {
  name: 'TYPE_MOUVEMENT',
  label: 'Action',
  type: 'enum',
  required: true,
  enumOptions: [
    { value: 'C', label: 'C — Create' },
    { value: 'M', label: 'M — Modify' },
    { value: 'S', label: 'S — Delete' },
  ],
  defaultValue: 'C',
}

const categorySchema: RepoSchema = {
  slug: 'category',
  name: 'Category',
  filePrefix: 'INT01',
  kind: 'master',
  delimiter: ';',
  fields: makeInt01Fields({ allowedTypes: ['GROUPE', 'RAYON', 'FAMILLE'] }),
}

const skuSchema: RepoSchema = {
  slug: 'sku',
  name: 'SKU',
  filePrefix: 'I_SKU',
  kind: 'master',
  delimiter: ';',
  fields: [
    MOUVEMENT_FIELD,
    { name: 'CODE_ARTICLE', label: 'SKU code', type: 'string', required: true },
    { name: 'MAIN_EAN', label: 'Main barcode (EAN)', type: 'string', required: true, notes: 'Must be globally unique per Octo+ instance' },
    { name: 'CODE_PRODUCT', label: 'Product code', type: 'string', required: false },
    { name: 'SHORT_LABEL', label: 'Short description', type: 'string', required: false },
    { name: 'LONG_LABEL', label: 'Long description', type: 'string', required: false },
    { name: 'CODE_SEASON', label: 'Season / collection', type: 'string', required: false },
    { name: 'CODE_SUPPLIER', label: 'Supplier code', type: 'string', required: false, notes: '→ INT01 FOURNISSEUR' },
    { name: 'CODE_FAMILY', label: 'Family (category)', type: 'string', required: false, notes: '→ INT01 FAMILLE' },
    { name: 'CODE_NGP', label: 'NGP code', type: 'string', required: false },
    { name: 'CODE_COLOR', label: 'Color code', type: 'string', required: false, notes: '→ INT01 COULEUR' },
    { name: 'CODE_SIZE', label: 'Size code', type: 'string', required: false, notes: '→ INT01 TAILLE' },
    { name: 'PRIMARY_TYPE_TAG', label: 'Primary RFID tag type', type: 'string', required: false },
    { name: 'SECONDARY_TYPE_TAG', label: 'Secondary RFID tag type', type: 'string', required: false },
    { name: 'SELLING_PRICE', label: 'Selling price', type: 'decimal', required: false, notes: 'Dot decimal separator' },
    { name: 'BUYING_PRICE', label: 'Buying price', type: 'decimal', required: false, notes: 'Dot decimal separator' },
    { name: 'URL_PICTURE', label: 'Picture URL', type: 'string', required: false },
    {
      name: 'TRACEABILITY_MODE',
      label: 'Traceability mode',
      type: 'enum',
      required: false,
      enumOptions: [
        { value: '', label: '— none —' },
        { value: '0', label: '0 — Off' },
        { value: 'SKU', label: 'SKU — Per SKU' },
      ],
    },
    { name: 'SUPPLIER_REF', label: 'Supplier reference', type: 'string', required: false },
    { name: 'END_PRODUCT', label: 'End product', type: 'string', required: false },
    { name: 'QUANTITY', label: 'Quantity', type: 'string', required: false },
    { name: 'UNIT', label: 'Unit', type: 'string', required: false },
    { name: 'FIDELITY_PRICE', label: 'Loyalty price', type: 'decimal', required: false },
    { name: 'USERFIELD_1', label: 'User field 1', type: 'string', required: false },
    { name: 'USERFIELD_2', label: 'User field 2', type: 'string', required: false },
    { name: 'USERFIELD_3', label: 'User field 3', type: 'string', required: false },
    { name: 'USERFIELD_4', label: 'User field 4', type: 'string', required: false },
    { name: 'USERFIELD_5', label: 'User field 5', type: 'string', required: false },
    { name: 'CODE_BRAND', label: 'Brand code', type: 'string', required: false },
    { name: 'PRICE_COMPARISON_UNIT', label: 'Price comparison unit', type: 'string', required: false },
    { name: 'PRICE_COMPARISON_DIVIDER', label: 'Price comparison divider', type: 'string', required: false },
    { name: 'RANK', label: 'Rank', type: 'string', required: false },
  ],
}

const barcodeSchema: RepoSchema = {
  slug: 'barcode',
  name: 'Barcode',
  filePrefix: 'I_CAB',
  kind: 'master',
  delimiter: ';',
  fields: [
    MOUVEMENT_FIELD,
    { name: 'CODE_ARTICLE', label: 'SKU code', type: 'string', required: true, notes: '→ I_SKU CODE_ARTICLE' },
    { name: 'TYPE_BARCODE', label: 'Barcode type', type: 'string', required: false },
    { name: 'BARCODE', label: 'Barcode value', type: 'string', required: true, notes: 'Must be unique per Octo+ instance' },
  ],
}

const suppliersSchema: RepoSchema = {
  slug: 'suppliers',
  name: 'Suppliers',
  filePrefix: 'INT01',
  kind: 'master',
  delimiter: ';',
  fields: makeInt01Fields({ lockedType: 'FOURNISSEUR' }),
}

const storesSchema: RepoSchema = {
  slug: 'stores',
  name: 'Stores',
  filePrefix: 'INT01',
  kind: 'master',
  delimiter: ';',
  fields: makeInt01Fields({ allowedTypes: ['Store', 'Store_level_2', 'Store_level_3'] }),
}

const stockSchema: RepoSchema = {
  slug: 'stock',
  name: 'Stock on-hand',
  filePrefix: 'INT04',
  kind: 'master',
  delimiter: ';',
  fields: [
    {
      name: 'TYPE_MOVEMENT',
      label: 'Action',
      type: 'enum',
      required: true,
      enumOptions: [
        { value: 'C', label: 'C — Create' },
        { value: 'M', label: 'M — Modify' },
        { value: 'S', label: 'S — Delete' },
      ],
      defaultValue: 'M',
      notes: 'Spelling: TYPE_MOVEMENT (not TYPE_MOUVEMENT)',
    },
    { name: 'SKU', label: 'SKU code', type: 'string', required: true, notes: '→ I_SKU CODE_ARTICLE' },
    { name: 'LOCATION', label: 'Store / location', type: 'string', required: true, notes: '→ INT01 Store code. Must match exactly (including spaces).' },
    { name: 'EXPECTED_QUANTITY', label: 'Expected quantity', type: 'integer', required: true, notes: 'Can be negative (stock correction)' },
  ],
}

const deliveryNoticeSchema: RepoSchema = {
  slug: 'delivery-notice',
  name: 'Delivery notice',
  filePrefix: 'I_DSU',
  kind: 'transactional',
  delimiter: ';',
  fields: [
    { name: 'EXTERNAL_DOC_REFERENCE', label: 'Document reference', type: 'string', required: true, notes: 'Unique per delivery document (e.g. UUID)' },
    { name: 'EXTERNAL_ORDER_REFERENCE', label: 'PO number', type: 'string', required: true },
    { name: 'USER_REASON', label: 'Delivery type', type: 'string', required: true, defaultValue: 'PO', notes: 'Typically "PO"' },
    { name: 'CODE_SUPPLIER', label: 'Supplier code', type: 'string', required: true, notes: '→ INT01 FOURNISSEUR' },
    { name: 'TRACKING_NUMBER', label: 'Tracking / receiving number', type: 'string', required: true },
    { name: 'LOCATION_TO', label: 'Destination store', type: 'string', required: true, notes: '→ INT01 Store code. Must match exactly.' },
    { name: 'DELIVERY_AREA', label: 'Delivery area', type: 'string', required: false, locked: '', notes: 'Not used — always empty' },
    {
      name: 'IS_OVERSUPPLY',
      label: 'Oversupply flag',
      type: 'enum',
      required: true,
      defaultValue: '0',
      enumOptions: [
        { value: '0', label: '0 — No' },
        { value: '1', label: '1 — Yes' },
      ],
    },
    { name: 'PARCEL_QUANTITY', label: 'Number of parcels', type: 'integer', required: true, defaultValue: '1' },
    { name: 'DELIVERY_DATE', label: 'Expected delivery date', type: 'date', required: true, notes: 'Format: YYYYMMDD' },
    { name: 'EXTERNAL_LINE_REFERENCE', label: 'Line reference', type: 'string', required: true, notes: 'Unique per line (e.g. UUID)' },
    { name: 'CODE_ARTICLE', label: 'SKU code', type: 'string', required: true, notes: '→ I_SKU CODE_ARTICLE' },
    { name: 'EXPECTED_QUANTITY', label: 'Expected line quantity', type: 'integer', required: true },
    { name: 'PARCEL', label: 'Parcel / receiving ref', type: 'string', required: true, notes: 'Typically same as Tracking number' },
    { name: 'PALLET', label: 'Pallet', type: 'string', required: false, locked: '', notes: 'Not used — always empty' },
    { name: 'STATUS', label: 'Initial status', type: 'string', required: true, defaultValue: 'to_check', notes: 'Typically "to_check"' },
  ],
}

const bulkPrintingSchema: RepoSchema = {
  slug: 'bulk-printing',
  name: 'Bulk printing',
  filePrefix: 'INT05',
  kind: 'transactional',
  delimiter: ';',
  fields: [
    { name: 'TYPE_DOCUMENT', label: 'Document type', type: 'string', required: true, locked: 'print_query_warehouse' },
    { name: 'LOC_DEP', label: 'Printer location', type: 'string', required: true, notes: '→ INT01 Store code' },
    { name: 'LOC_DEST', label: 'Destination location', type: 'string', required: false, locked: '', notes: 'Not used — always empty' },
    { name: 'N_COLIS', label: 'Print reference', type: 'string', required: true },
    { name: 'CODE_ARTICLE', label: 'SKU code', type: 'string', required: true, notes: '→ I_SKU CODE_ARTICLE' },
    { name: 'QTE_STOCK', label: 'Label quantity', type: 'integer', required: true, notes: 'Minimum 1' },
    { name: 'REF_EXTERNE', label: 'External reference', type: 'string', required: true },
  ],
}

export const REPO_SCHEMAS: Record<RepoSlug, RepoSchema> = {
  category: categorySchema,
  sku: skuSchema,
  barcode: barcodeSchema,
  suppliers: suppliersSchema,
  stores: storesSchema,
  stock: stockSchema,
  'delivery-notice': deliveryNoticeSchema,
  'bulk-printing': bulkPrintingSchema,
}

export function getRepoSchema(slug: string): RepoSchema | undefined {
  return REPO_SCHEMAS[slug as RepoSlug]
}
