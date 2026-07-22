import type { FieldDef, EnumOption } from './types'

export const ALL_TYPE_ATTRIBUT_OPTIONS: EnumOption[] = [
  { value: 'GROUPE', label: 'GROUPE — Category level 1' },
  { value: 'RAYON', label: 'RAYON — Category level 2' },
  { value: 'FAMILLE', label: 'FAMILLE — Category level 3' },
  { value: 'COULEUR', label: 'COULEUR — Color' },
  { value: 'TAILLE', label: 'TAILLE — Size' },
  { value: 'FOURNISSEUR', label: 'FOURNISSEUR — Supplier' },
  { value: 'Store', label: 'Store — Store (parent)' },
  { value: 'Store_level_2', label: 'Store_level_2 — Sub-location' },
  { value: 'Store_level_3', label: 'Store_level_3 — Area' },
]

const PARENT_FIELDS: FieldDef[] = [
  {
    name: 'TYPE_ATTRIBUT_PARENT',
    label: 'Parent type',
    type: 'enum',
    required: false,
    maxLength: 100,
    enumOptions: ALL_TYPE_ATTRIBUT_OPTIONS,
    notes: 'Must be paired with Parent code (both or neither)',
  },
  {
    name: 'CODE_ATTRIBUT_PARENT',
    label: 'Parent code',
    type: 'string',
    required: false,
    maxLength: 100,
    notes: 'Must be paired with Parent type (both or neither)',
  },
]

/**
 * Build INT01 field list.
 * Pass lockedType to lock TYPE_ATTRIBUT to a fixed value (Suppliers, Color, Size).
 * Pass allowedTypes to constrain the enum to a subset (Category, Stores) — user must choose.
 */
export function makeInt01Fields(options?: {
  lockedType?: string
  allowedTypes?: string[]
}): FieldDef[] {
  const { lockedType, allowedTypes } = options ?? {}

  const enumOptions = allowedTypes
    ? ALL_TYPE_ATTRIBUT_OPTIONS.filter((o) => allowedTypes.includes(o.value))
    : ALL_TYPE_ATTRIBUT_OPTIONS

  const typeField: FieldDef = lockedType
    ? {
        name: 'TYPE_ATTRIBUT',
        label: 'Attribute type',
        type: 'enum',
        required: true,
        locked: lockedType,
        enumOptions,
        notes: `Fixed for this repository: ${lockedType}`,
      }
    : {
        name: 'TYPE_ATTRIBUT',
        label: 'Attribute type',
        type: 'enum',
        required: true,
        enumOptions,
      }

  return [
    typeField,
    {
      name: 'CODE_ATTRIBUT',
      label: 'Code',
      type: 'string',
      required: true,
      maxLength: 100,
      notes: 'Unique per TYPE_ATTRIBUT. Can include spaces and special characters.',
    },
    {
      name: 'LIBELLE_ATTRIBUT',
      label: 'Label',
      type: 'string',
      required: true,
      maxLength: 100,
    },
    ...PARENT_FIELDS,
  ]
}
