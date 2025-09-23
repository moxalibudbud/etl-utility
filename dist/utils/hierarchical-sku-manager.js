"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hierarchicalSKUManager = hierarchicalSKUManager;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
function hierarchicalSKUManager(basePath = '/var/tmp', charsPerLevel = 2, maxLevels = 7) {
    const config = {
        basePath,
        charsPerLevel,
        maxLevels,
    };
    function getHierarchicalPath(sku, charsPerLevel = config.charsPerLevel, maxLevels = config.maxLevels) {
        if (sku.length < charsPerLevel) {
            throw new Error(`SKU ${sku} is too short. Minimum ${charsPerLevel} characters required.`);
        }
        const chars = sku.split('');
        const pathParts = [config.basePath];
        let currentIndex = 0;
        let levelsCreated = 0;
        while (currentIndex < chars.length && levelsCreated < maxLevels) {
            const levelChars = chars.slice(currentIndex, currentIndex + charsPerLevel);
            if (levelChars.length < charsPerLevel) {
                while (levelChars.length < charsPerLevel) {
                    levelChars.push('0');
                }
            }
            pathParts.push(levelChars.join(''));
            currentIndex += charsPerLevel;
            levelsCreated++;
        }
        pathParts.push(sku);
        return path_1.default.join(...pathParts);
    }
    function createDirectoryStructure(sku) {
        const skuPath = getHierarchicalPath(sku, config.charsPerLevel, config.maxLevels);
        const directory = path_1.default.dirname(skuPath);
        if (!fs_1.default.existsSync(directory)) {
            fs_1.default.mkdirSync(directory, { recursive: true });
        }
        return skuPath;
    }
    function checkSKUExists(sku) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                const skuPath = getHierarchicalPath(sku, config.charsPerLevel, config.maxLevels);
                yield fs_1.default.promises.access(skuPath);
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    function checkSKUExistsSync(sku) {
        try {
            const skuPath = getHierarchicalPath(sku, config.charsPerLevel, config.maxLevels);
            fs_1.default.accessSync(skuPath);
            return true;
        }
        catch (_a) {
            return false;
        }
    }
    return {
        getHierarchicalPath,
        createDirectoryStructure,
        checkSKUExists,
        checkSKUExistsSync,
    };
}
