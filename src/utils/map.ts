type Object = Record<string, any>;

export function mapFields(input: Object, config: Object | ((input: Object) => any)): Object {
  const result: Object = {};

  for (const [outputKey, rule] of Object.entries(config)) {
    result[outputKey] = typeof rule === 'function' ? rule(input) : input[rule];
  }

  return result;
}

export function mapWithDefault(input: Object, config: Object | ((input: Object) => any)): Object {
  const result: Object = {};

  for (const [outputKey, rule] of Object.entries(config)) {
    if (typeof rule === 'string' && rule.startsWith('[') && rule.endsWith(']')) {
      const fnBody = rule.slice(1, -1).trim();
      try {
        const fn = new Function('input', fnBody);
        result[outputKey] = fn(input);
      } catch (err) {
        console.error(`Error executing function for key "${fnBody}":`, err);
        result[outputKey] = outputKey;
      }
    } else {
      result[outputKey] = input.hasOwnProperty(rule) ? input[rule] : rule;
    }
  }

  return result;
}
