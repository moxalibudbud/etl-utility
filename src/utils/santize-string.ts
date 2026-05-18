export function sanitizeString(string: string): string {
  return string
    .replace(/\\(?!["\\/bfnrtu])/g, '\\\\') // escape bare backslashes (JSON safety)
    .replace(/[\x00-\x1F\x7F]/g, ' '); // all control chars → space
}

export function sanitizeJsonValue(value: string): string {
  return value
    .replace(/\\(?!["\\/bfnrtu])/g, '') // strip bare backslashes (not valid JSON escape sequences)
    .replace(/[\x00-\x1F\x7F]/g, ' ')   // all control chars → space
    .replace(/"/g, '\\"');               // escape double quotes so they don't break JSON structure
}
