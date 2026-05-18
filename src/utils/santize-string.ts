export function sanitizeString(string: string): string {
  return string
    .replace(/\\(?!["\\/bfnrtu])/g, '\\\\') // escape bare backslashes (JSON safety)
    .replace(/[\x00-\x1F\x7F]/g, ' '); // all control chars → space
}
