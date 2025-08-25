/**
 * Reusable function to replace a custom expression syntax based on the given defined function name.
 * This implementation is inspired by https://mustache.github.io/
 * Though we can use that instead since it's zero-dep
 *
 * Sample input:
 * sample_string_{name}
 *
 * Sample output:
 * sample_string_john
 */
export function replaceWithMap(template: string, data: Record<string, string>): string {
  let output = template.replace(/\{(\w+)\}/g, (_, key) => {
    return data[key] != null ? data[key] : '';
  });

  return output;
}
