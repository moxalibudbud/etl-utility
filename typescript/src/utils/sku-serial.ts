// Encode SKU and serial number into bracketed format
function encodeMetadata(sku: string, serial: string) {
  return `[${sku}][${serial}]`;
}

// Decode bracketed format back into SKU and serial
function decodeMetadata(input: string) {
  const values: string[] = [];
  let start = -1;

  for (let i = 0; i < input.length; i++) {
    if (input[i] === '[') {
      start = i + 1;
    } else if (input[i] === ']' && start !== -1) {
      let value = input.slice(start, i);
      values.push(value);
      start = -1;
    }
  }

  return {
    sku: values[0] || input,
    serial: values[1] || input,
    isSerialized: !!values[1],
  };
}

export function skuSerial(...args: string[]) {
  return {
    decode: () => decodeMetadata(args[0]),
    encode: () => encodeMetadata(args[0], args[1]),
  };
}
