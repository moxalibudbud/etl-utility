"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceWithFunction = replaceWithFunction;
function dateTime(format = 'YYYY-MM-DDTHH:mm:ssZ', timezone = 'UTC') {
    const now = new Date();
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
    const partValues = {};
    parts.forEach((part) => {
        partValues[part.type] = part.value;
    });
    const ms = now.getMilliseconds();
    const formatTokens = {
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
        SS: partValues.second,
        A: parseInt(partValues.hour) >= 12 ? 'PM' : 'AM',
        a: parseInt(partValues.hour) >= 12 ? 'pm' : 'am',
        Z: timezone === 'UTC' ? 'Z' : '',
    };
    let formattedDate = format;
    const sortedTokens = Object.keys(formatTokens).sort((a, b) => b.length - a.length);
    sortedTokens.forEach((token) => {
        formattedDate = formattedDate.replace(new RegExp(token, 'g'), formatTokens[token]);
    });
    return formattedDate;
}
const supportedFunctions = {
    timestamp: () => Date.now().toString(),
    dateTime,
};
function replaceWithFunction(template) {
    let output = template.replace(/\[([^\]]+)\]/g, (match, content) => {
        try {
            const parts = content.split(',').map((part) => part.trim());
            const functionName = parts[0];
            const args = parts.slice(1);
            if (supportedFunctions.hasOwnProperty(functionName)) {
                try {
                    return supportedFunctions[functionName](...args);
                }
                catch (error) {
                    console.error(`Error executing function '${functionName}' with args [${args.join(', ')}]:`, error);
                    return match;
                }
            }
            else {
                console.warn(`Named function '${functionName}' not found`);
                return match;
            }
        }
        catch (parseError) {
            console.error(`Error parsing expression '${content}':`, parseError);
            return match;
        }
    });
    return output;
}
