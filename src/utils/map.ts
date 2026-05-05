import { customFunction } from './custom-function';

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
      const functionBody = rule.slice(1, -1).trim();
      result[outputKey] = customFunction(functionBody, input, outputKey);
    } else {
      result[outputKey] = input.hasOwnProperty(rule) ? input[rule] : rule;
    }
  }

  return result;
}
