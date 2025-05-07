"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lineDataToJSON = lineDataToJSON;
function lineDataToJSON(fields, values) {
    const columnMap = fields.reduce((map, column, index) => {
        map[column] = values[index];
        return map;
    }, {});
    return columnMap;
}
