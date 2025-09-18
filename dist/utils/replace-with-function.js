"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceWithFunction = replaceWithFunction;
function dateTime(format = 'YYYY-MM-DD-HHmmSS', timezone = 'UTC') {
    const now = new Date();
    let dateObj;
    if (timezone) {
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
        dateObj = new Date(parseInt(partValues.year), parseInt(partValues.month) - 1, parseInt(partValues.day), parseInt(partValues.hour), parseInt(partValues.minute), parseInt(partValues.second));
    }
    else {
        dateObj = now;
    }
    const formatTokens = {
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
