import { customFunction } from './custom-function';
import { replaceWithFunction } from './replace-with-function';

type Object = Record<string, any>;

export function mapFields(input: Object, config: Object | ((input: Object) => any)): Object {
  const result: Object = {};

  for (const [outputKey, stringTemplate] of Object.entries(config)) {
    result[outputKey] = typeof stringTemplate === 'function' ? stringTemplate(input) : input[stringTemplate];
  }

  return result;
}

export function mapWithDefault(input: Object, config: Object): Object {
  const result: Object = {};

  // If config is empty, return input as default value
  if (!Object.keys(config).length) {
    return input;
  }

  for (const [outputKey, stringTemplate] of Object.entries(config)) {
    if (typeof stringTemplate === 'string' && stringTemplate.startsWith('[') && stringTemplate.endsWith(']')) {
      result[outputKey] = replaceWithFunction(stringTemplate, input);
    } else {
      result[outputKey] = input.hasOwnProperty(stringTemplate) ? input[stringTemplate] : stringTemplate;
    }
  }

  return result;
}
