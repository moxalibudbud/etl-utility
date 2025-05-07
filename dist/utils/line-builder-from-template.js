"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLineFromTemplate = buildLineFromTemplate;
function buildLineFromTemplate(line, config) {
    let output = config.template.replace(/\{(\w+)\}/g, (_, key) => {
        return line[key] != null ? line[key] : '';
    });
    return output + '\n';
}
