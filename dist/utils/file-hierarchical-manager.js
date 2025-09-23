"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILE_HIERARCHICAL_INDEX_DIRECTORY = void 0;
exports.fileHierarchicalManager = fileHierarchicalManager;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const promises_1 = tslib_1.__importDefault(require("fs/promises"));
const path_1 = tslib_1.__importDefault(require("path"));
exports.FILE_HIERARCHICAL_INDEX_DIRECTORY = '/var/tmp/file-hierarchical-index';
function fileHierarchicalManager(basePath = exports.FILE_HIERARCHICAL_INDEX_DIRECTORY, charsPerLevel = 2, maxLevels = 7) {
    const config = {
        basePath,
        charsPerLevel,
        maxLevels,
    };
    function getHierarchicalPath(index, charsPerLevel = config.charsPerLevel, maxLevels = config.maxLevels) {
        if (index.length < charsPerLevel) {
            throw new Error(`${index} is too short. Minimum ${charsPerLevel} characters required.`);
        }
        const chars = index.split('');
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
        pathParts.push(index);
        return path_1.default.join(...pathParts);
    }
    function createDirectoryStructure(index) {
        const indexPath = getHierarchicalPath(index, config.charsPerLevel, config.maxLevels);
        const directory = path_1.default.dirname(indexPath);
        if (!fs_1.default.existsSync(directory)) {
            fs_1.default.mkdirSync(directory, { recursive: true });
        }
        return indexPath;
    }
    function saveIndex(index) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const indexPath = createDirectoryStructure(index);
            try {
                yield promises_1.default.writeFile(indexPath, '.', 'utf8');
            }
            catch (_) {
                console.log(_);
            }
        });
    }
    function checkIndexExists(index) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                const indexPath = getHierarchicalPath(index, config.charsPerLevel, config.maxLevels);
                yield fs_1.default.promises.access(indexPath);
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    function checkIndexExistsSync(index) {
        try {
            const indexPath = getHierarchicalPath(index, config.charsPerLevel, config.maxLevels);
            fs_1.default.accessSync(indexPath);
            return true;
        }
        catch (_a) {
            return false;
        }
    }
    return {
        getHierarchicalPath,
        createDirectoryStructure,
        checkIndexExists,
        checkIndexExistsSync,
        saveIndex,
    };
}
