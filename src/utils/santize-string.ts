export function sanitizeString(string: string): string {
  return string
    .replace(/\\\\|\\(?!["\\/bfnrtu])/g, (m) => m.length === 2 ? m : '\\\\') // escape bare backslashes; consume \\ as an atomic unit so valid pairs are never split
    .replace(/[\x00-\x1F\x7F]/g, ' '); // all control chars → space
}

export function removeWhiteSpaces(value: string): string {
  return value.replace(/\s+/g, '');
}

export function sanitizeJsonValue(value: string): string {
  return value
    .replace(/\\\\|\\(?!["\\/bfnrtu])/g, (m) => m.length === 2 ? m : '') // strip bare backslashes; consume \\ as an atomic unit so valid pairs are never split
    .replace(/[\x00-\x1F\x7F]/g, ' ')   // all control chars → space
    .replace(/"/g, '\\"');               // escape double quotes so they don't break JSON structure
}
