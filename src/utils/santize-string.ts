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

export function sanitizeJsonStr(string: string): string {
  return string.replace(/\\(?!["\\/bfnrtu])/g, '\\\\').replace(/[\x00-\x1F\x7F]/g, (c) => {
    switch (c) {
      case '\n':
        return '\\n';
      case '\r':
        return '\\r';
      case '\t':
        return '\\t';
      case '\b':
        return '\\b';
      case '\f':
        return '\\f';
      default:
        return '';
    }
  });
}
