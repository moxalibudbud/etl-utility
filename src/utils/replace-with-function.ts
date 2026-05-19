import { customFunction } from './custom-function';
import { sanitizeString, removeWhiteSpaces } from './santize-string';

type SupportedFunctions = (...args: any[]) => string;
type ReplaceWithFunctionMetadata = {
  metadata?: Record<string, any>; // Concrete metadata field
  [key: string]: any; // Any other custom fields
};

function dateTime(format: string = 'YYYY-MM-DDTHH:mm:ssZ', timezone: string = 'UTC') {
  const now = new Date();

  // Use Intl.DateTimeFormat to get date components in the specified timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const partValues: { [key: string]: string } = {};
  parts.forEach((part) => {
    partValues[part.type] = part.value;
  });

  // Get milliseconds from the original date
  const ms = now.getMilliseconds();

  const formatTokens: Record<string, string> = {
    YYYY: partValues.year,
    YY: partValues.year.slice(-2),
    MM: partValues.month,
    MMM: new Date(now).toLocaleString('en', { month: 'short', timeZone: timezone }),
    MMMM: new Date(now).toLocaleString('en', { month: 'long', timeZone: timezone }),
    DD: partValues.day,
    HH: partValues.hour,
    hh: (parseInt(partValues.hour) % 12 || 12).toString().padStart(2, '0'),
    mm: partValues.minute,
    ss: partValues.second,
    SSS: ms.toString().padStart(3, '0'),
    SS: partValues.second, // Keep for backward compatibility
    A: parseInt(partValues.hour) >= 12 ? 'PM' : 'AM',
    a: parseInt(partValues.hour) >= 12 ? 'pm' : 'am',
    Z: timezone === 'UTC' ? 'Z' : '', // Simplified - could be enhanced with offset calculation
  };

  let formattedDate = format;

  // Sort by length (descending) to avoid partial replacements
  const sortedTokens = Object.keys(formatTokens).sort((a, b) => b.length - a.length);

  sortedTokens.forEach((token) => {
    formattedDate = formattedDate.replace(new RegExp(token, 'g'), formatTokens[token]);
  });

  return formattedDate;
}

function resolvePath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce((current, key) => (current != null ? (current as Record<string, unknown>)[key] : undefined), obj);
}

const supportedFunctions: Record<string, SupportedFunctions> = {
  timestamp: () => Date.now().toString(),
  dateTime,
  sanitizeString,
  removeWhiteSpaces,
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
export function replaceWithFunction(template: string, metadata: ReplaceWithFunctionMetadata = {}): string {
  let output = template.replace(/\[([^\]]+)\]/g, (match, content) => {
    try {
      const parts = content.split(/\s+/).filter(Boolean);
      const functionName = parts[0];
      const args = parts.slice(1).map((arg: string) => {
        if (arg.startsWith('data.')) {
          const path = arg.slice('data.'.length);
          return resolvePath(metadata, path) ?? arg;
        }
        return arg;
      });

      // Check if function exists
      if (supportedFunctions.hasOwnProperty(functionName)) {
        try {
          // Call function with dynamic arguments
          const value = supportedFunctions[functionName](...args);
          return value;
        } catch (error) {
          console.error(`Error executing function '${functionName}' with args [${args.join(', ')}]:`, error);
          return match; // Keep original placeholder on error
        }
      } else {
        const value = customFunction(content, metadata, match);
        return value;
      }
    } catch (parseError) {
      console.error(`Error parsing expression '${content}':`, parseError);
      return match; // Keep original placeholder on parse error
    }
  });

  return output;
}
