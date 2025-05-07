/**
 * This function replace tab with and limit the string to 49 characters
 * @param string
 * @returns
 */
export function sanitizeStr(string: string) {
  // Get first 49 characters
  const maxCharacterLimit = string.slice(0, 49);

  // Remove tab
  const finalValue = maxCharacterLimit.replace(/\t/g, ' ');

  return finalValue;
}
