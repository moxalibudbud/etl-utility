type SupportedFunctions = () => string;

const supportedFunctions: Record<string, SupportedFunctions> = {
  timestamp: () => Date.now().toString(),
  // withTimestamp: () => Date.now().toString(),
  // timestamp: () => Date.now().toString(),
  // date: () => new Date().toISOString().split('T')[0], // YYYY-MM-DD
  // time: () => new Date().toTimeString().split(' ')[0].replace(/:/g, '-'), // HH-MM-SS
  // uuid: () => generateUUID(),
  // random: () => Math.random().toString(36).substring(2, 8),
  // year: () => new Date().getFullYear().toString(),
  // month: () => (new Date().getMonth() + 1).toString().padStart(2, '0'),
  // day: () => new Date().getDate().toString().padStart(2, '0'),
  // hour: () => new Date().getHours().toString().padStart(2, '0'),
  // minute: () => new Date().getMinutes().toString().padStart(2, '0'),
  // second: () => new Date().getSeconds().toString().padStart(2, '0'),
  // dateTime: () => new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5), // YYYY-MM-DD_HH-MM-SS
};

/**
 * Reusable function to replace a custom expression syntax based on the given defined function name.
 *
 * Sample input:
 * sample_string_[timestamp]
 *
 * Sample output:
 * sample_string_001929292192191
 */
export function replaceWithFunction(template: string): string {
  let output = template.replace(/\[(\w+)\]/g, (match, functionName) => {
    if (supportedFunctions.hasOwnProperty(functionName)) {
      try {
        return supportedFunctions[functionName]();
      } catch (error) {
        console.error(`Error executing function '${functionName}':`, error);
        return match; // Keep original placeholder on error
      }
    } else {
      console.warn(`Named function '${functionName}' not found`);
      return match; // Keep original placeholder if function not found
    }
  });

  return output;
}
