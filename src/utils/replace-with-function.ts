type SupportedFunctions = (...args: any[]) => string;

function dateTime(format: string = 'YYYY-MM-DD-HHmmSS', timezone: string = 'UTC') {
  const now = new Date();
  let dateObj: Date;

  if (timezone) {
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

    // Create date object from parts
    dateObj = new Date(
      parseInt(partValues.year),
      parseInt(partValues.month) - 1, // Month is 0-indexed
      parseInt(partValues.day),
      parseInt(partValues.hour),
      parseInt(partValues.minute),
      parseInt(partValues.second)
    );
  } else {
    dateObj = now;
  }

  const formatTokens: Record<string, string> = {
    YYYY: dateObj.getFullYear().toString(),
    YY: dateObj.getFullYear().toString().slice(-2),
    MM: (dateObj.getMonth() + 1).toString().padStart(2, '0'),
    MMM: dateObj.toLocaleString('en', { month: 'short' }),
    MMMM: dateObj.toLocaleString('en', { month: 'long' }),
    DD: dateObj.getDate().toString().padStart(2, '0'),
    HH: dateObj.getHours().toString().padStart(2, '0'),
    hh: (dateObj.getHours() % 12 || 12).toString().padStart(2, '0'),
    mm: dateObj.getMinutes().toString().padStart(2, '0'),
    SS: dateObj.getSeconds().toString().padStart(2, '0'),
    A: dateObj.getHours() >= 12 ? 'PM' : 'AM',
    a: dateObj.getHours() >= 12 ? 'pm' : 'am',
  };

  let formattedDate = format;

  // Sort by length (descending) to avoid partial replacements
  const sortedTokens = Object.keys(formatTokens).sort((a, b) => b.length - a.length);

  sortedTokens.forEach((token) => {
    formattedDate = formattedDate.replace(new RegExp(token, 'g'), formatTokens[token]);
  });

  return formattedDate;
}

const supportedFunctions: Record<string, SupportedFunctions> = {
  timestamp: () => Date.now().toString(),
  dateTime,
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
  let output = template.replace(/\[([^\]]+)\]/g, (match, content) => {
    try {
      // Split by comma and trim whitespace
      const parts = content.split(',').map((part: string) => part.trim());
      const functionName = parts[0];
      const args = parts.slice(1);

      // Check if function exists
      if (supportedFunctions.hasOwnProperty(functionName)) {
        try {
          // Call function with dynamic arguments
          return supportedFunctions[functionName](...args);
        } catch (error) {
          console.error(`Error executing function '${functionName}' with args [${args.join(', ')}]:`, error);
          return match; // Keep original placeholder on error
        }
      } else {
        console.warn(`Named function '${functionName}' not found`);
        return match; // Keep original placeholder if function not found
      }
    } catch (parseError) {
      console.error(`Error parsing expression '${content}':`, parseError);
      return match; // Keep original placeholder on parse error
    }
  });

  return output;
}
