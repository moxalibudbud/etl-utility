export declare function hierarchicalSKUManager(basePath?: string, charsPerLevel?: number, maxLevels?: number): {
    getHierarchicalPath: (sku: string, charsPerLevel?: number, maxLevels?: number) => string;
    createDirectoryStructure: (sku: string) => string;
    checkSKUExists: (sku: string) => Promise<boolean>;
    checkSKUExistsSync: (sku: string) => boolean;
};
