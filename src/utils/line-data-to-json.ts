export function lineDataToJSON(fields: string[], values: any[]): Record<string, string> {
  const columnMap = fields.reduce((map, column, index) => {
    map[column] = values[index];
    return map;
  }, {} as Record<string, string>);

  return columnMap;
}
