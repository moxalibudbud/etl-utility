type Object = Record<string, any>;

export function mapFields(input: Object, config: Object | ((input: Object) => any)): Object {
  const result: Object = {};

  for (const [outputKey, rule] of Object.entries(config)) {
    result[outputKey] = typeof rule === 'function' ? rule(input) : input[rule];
  }

  return result;
}
