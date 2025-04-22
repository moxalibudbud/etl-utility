import { JSONObject } from './types';

type Props = {
  line: string[];
  columns: string[];
  mandatoryFields: string[];
  lineData: JSONObject;
  currentLineNumber: number;
  barcode?: string;
  isHeader?: boolean;
};

function isAlphanumeric(input: string) {
  // Regular expression to match only alphanumeric characters (letters and digits)
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  return alphanumericRegex.test(input);
}

function isValidBarcode(barcode: string) {
  return isAlphanumeric(barcode);
}

export const errorPrefix = (currentLineNumber: number | string) => `ERROR AT LINE ${currentLineNumber}:`;

export function validateLine({
  line,
  columns,
  mandatoryFields,
  lineData,
  currentLineNumber,
  barcode,
  isHeader,
}: Props): string[] {
  const errors = [];

  // Valdiate length if equal
  if (line.length !== columns.length) {
    errors.push(
      `${errorPrefix(currentLineNumber)} Expected total columns is ${columns.length} but received ${
        line.length
      } | Required columns are ${columns.toString()} but line data is ${line.toString()}`
    );
  }

  // Validate barcode
  if (!isHeader && barcode !== undefined && !isValidBarcode(barcode)) {
    errors.push(`${errorPrefix(currentLineNumber)} Invalid barcode column with value "${barcode}"`);
  }

  mandatoryFields.map((field: string) => {
    const value = lineData[field];
    if (!value) {
      errors.push(`${errorPrefix(currentLineNumber)} Invalid ${field} value of "${value}"`);
    }
  });

  return errors;
}
