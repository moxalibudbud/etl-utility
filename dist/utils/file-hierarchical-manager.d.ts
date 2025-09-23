export declare const FILE_HIERARCHICAL_INDEX_DIRECTORY = "/var/tmp/file-hierarchical-index";
export declare function fileHierarchicalManager(basePath?: string, charsPerLevel?: number, maxLevels?: number): {
    getHierarchicalPath: (index: string, charsPerLevel?: number, maxLevels?: number) => string;
    createDirectoryStructure: (index: string) => string;
    checkIndexExists: (index: string) => Promise<boolean>;
    checkIndexExistsSync: (index: string) => boolean;
    saveIndex: (index: string) => Promise<void>;
};
