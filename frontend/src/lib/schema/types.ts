export type FieldType = 'string' | 'integer' | 'decimal' | 'date' | 'boolean' | 'enum'

export interface EnumOption {
  value: string
  label: string
}

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  required: boolean
  maxLength?: number
  enumOptions?: EnumOption[]
  locked?: string
  defaultValue?: string
  notes?: string
}

export type RepoSlug =
  | 'category'
  | 'sku'
  | 'barcode'
  | 'suppliers'
  | 'stores'
  | 'stock'
  | 'delivery-notice'
  | 'bulk-printing'

export type RepoKind = 'master' | 'transactional'

export interface RepoSchema {
  slug: RepoSlug
  name: string
  filePrefix: string
  kind: RepoKind
  delimiter: ';'
  fields: FieldDef[]
}
