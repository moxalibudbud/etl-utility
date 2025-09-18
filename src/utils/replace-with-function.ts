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

// Usage examples:
// console.log('Default format:', supportedFunctions.formatDateTime());
// console.log('Custom format:', supportedFunctions.formatDateTime('YYYY-MMM-DD HH:mm:SS'));
// console.log('With timezone (UTC):', supportedFunctions.formatDateTime('YYYY-MM-DD HH:mm:SS', 'UTC'));
console.log('With timezone (Asia/Tokyo):', supportedFunctions.dateTime('YYYYMMDDHHmmSS', 'Asia/Dubai'));
// console.log('European format:', supportedFunctions.formatDateTime('DD/MM/YYYY HH:mm'));
// console.log('US format:', supportedFunctions.formatDateTime('MM/DD/YYYY hh:mm:SS A'));
// console.log('ISO-like format:', supportedFunctions.formatDateTime('YYYY-MM-DDTHH:mm:SS'));
