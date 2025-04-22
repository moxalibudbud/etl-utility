type Object = Record<string, any>;

export function mapFields(input: Object, config: Object | ((input: Object) => any)): Object {
  const result: Object = {};

  for (const [outputKey, rule] of Object.entries(config)) {
    result[outputKey] = typeof rule === 'function' ? rule(input) : input[rule];
  }

  return result;
}

const source = { CCID: '001', INV_NO: 'INV-123' };

// const mappings = {
//   storeId: 'CCID',
//   ccid: 'CCID',
//   countId: 'INV_NO',
// };

const mappings = {
  storeId: 'CCID',
  ccid: 'CCID',
  countId: (input: Object) => `${input.INV_NO}-count`,
};

const mapped = mapFields(source, mappings);

console.log(mapped);
