import { Input } from '@/components/ui/input';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
} from '@/components/ui/combobox';

// Function templates the Go core resolves at render time
// (go/template/function.go). Selecting one inserts it verbatim; the user can
// still edit the format/timezone by hand since the field is free text.
const FUNCTION_TOKENS = [
  { token: '[timestamp]', label: 'timestamp' },
  { token: '[dateTime YYYYMMDDHHmmss]', label: 'dateTime' },
] as const;

interface InsertItem {
  id: string;
  label: string;
  token: string;
}

interface InsertGroup {
  label: string;
  items: InsertItem[];
}

interface TemplatedTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Known output.metadata key names, offered as data.metadata.<key> tokens. */
  metadataKeys?: string[];
  /** Source line columns (options.line.columns), offered as bare {column}
   * tokens — resolved by the writer straight off the current row's data
   * (go/template/field.go's ReplaceWithData), so no wrapper function is needed. */
  sourceColumns?: string[];
  /** Lay the text input and the insert combobox out side by side instead of
   * stacked. Off for single free-text fields like filename. */
  twoColumn?: boolean;
}

// A free-text field that also accepts [func ...] templates — used for
// output.filename, output.footer, output.template, and anything else the
// writer renders through the same templating layer.
export function TemplatedTextField({
  value,
  onChange,
  placeholder,
  metadataKeys = [],
  sourceColumns = [],
  twoColumn = true,
}: TemplatedTextFieldProps) {
  function insertToken(token: string) {
    onChange(`${value}${token}`);
  }

  const groups: InsertGroup[] = [
    {
      label: 'Source columns',
      items: sourceColumns.map((col) => ({ id: `col-${col}`, label: col, token: `{${col}}` })),
    },
    {
      label: 'Metadata',
      items: metadataKeys.map((key) => ({
        id: `meta-${key}`,
        label: key,
        token: `[sanitizeString data.metadata.${key}]`,
      })),
    },
    {
      label: 'Functions',
      items: FUNCTION_TOKENS.map((t) => ({ id: `fn-${t.token}`, label: t.label, token: t.token })),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <div className={twoColumn ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-xs w-full"
      />
      <Combobox<InsertItem>
        items={groups}
        itemToStringLabel={(item) => item.label}
        value={null}
        onValueChange={(item) => item && insertToken(item.token)}
      >
        <ComboboxInput placeholder="insert value..." />
        <ComboboxContent>
          <ComboboxEmpty>No matches.</ComboboxEmpty>
          <ComboboxList>
            {(group: InsertGroup) => (
              <ComboboxGroup key={group.label} items={group.items}>
                <ComboboxLabel>{group.label}</ComboboxLabel>
                <ComboboxCollection>
                  {(item: InsertItem) => (
                    <ComboboxItem key={item.id} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
