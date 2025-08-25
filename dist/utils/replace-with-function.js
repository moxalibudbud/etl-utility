"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceWithFunction = replaceWithFunction;
const supportedFunctions = {
    timestamp: () => Date.now().toString(),
};
function replaceWithFunction(template) {
    let output = template.replace(/\[(\w+)\]/g, (match, functionName) => {
        if (supportedFunctions.hasOwnProperty(functionName)) {
            try {
                return supportedFunctions[functionName]();
            }
            catch (error) {
                console.error(`Error executing function '${functionName}':`, error);
                return match;
            }
        }
        else {
            console.warn(`Named function '${functionName}' not found`);
            return match;
        }
    });
    return output;
}
