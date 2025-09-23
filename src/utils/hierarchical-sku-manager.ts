import fs from 'fs';
import path from 'path';

// Usage example:
// const skuManager = createHierarchicalSKUManager('/srv', 2, 7);
// const path = skuManager.getHierarchicalPath('ABCDEF123');
// console.log(path); // /srv/AB/CD/EF/12/30/ABCDEF123

export function hierarchicalSKUManager(basePath = '/var/tmp', charsPerLevel = 2, maxLevels = 7) {
  // Private variables (closure scope)
  const config = {
    basePath,
    charsPerLevel,
    maxLevels,
  };

  /**
   * Converts SKU to hierarchical path dynamically
   * Examples:
   * - "AB" (2 chars) -> /srv/AB/AB
   * - "ABCD" (4 chars) -> /srv/AB/CD/ABCD
   * - "ABCDEFGHIJ" (10 chars) -> /srv/AB/CD/EF/GH/IJ/KL/MN/ABCDEFGHIJ
   * - "VERYLONGSKUNAME" -> /srv/VE/RY/LO/NG/SK/UN/AM/VERYLONGSKUNAME
   *
   * Distributes files across multiple directory levels to avoid filesystem bottlenecks
   */
  function getHierarchicalPath(
    sku: string,
    charsPerLevel = config.charsPerLevel,
    maxLevels = config.maxLevels
  ): string {
    if (sku.length < charsPerLevel) {
      throw new Error(`SKU ${sku} is too short. Minimum ${charsPerLevel} characters required.`);
    }

    const chars = sku.split('');
    const pathParts = [config.basePath];

    // Create directory levels up to maxLevels
    let currentIndex = 0;
    let levelsCreated = 0;

    while (currentIndex < chars.length && levelsCreated < maxLevels) {
      const levelChars = chars.slice(currentIndex, currentIndex + charsPerLevel);

      // If we don't have enough characters for a full level, pad or use what we have
      if (levelChars.length < charsPerLevel) {
        // Option 1: Pad with zeros
        while (levelChars.length < charsPerLevel) {
          levelChars.push('0');
        }
        // Option 2: Just use what we have (uncomment this instead if preferred)
        // pathParts.push(levelChars.join(''));
        // break;
      }

      pathParts.push(levelChars.join(''));
      currentIndex += charsPerLevel;
      levelsCreated++;
    }

    // Add the final SKU file
    pathParts.push(sku);

    return path.join(...pathParts);
  }

  /**
   * Create directory structure for a SKU (without creating the file)
   */
  function createDirectoryStructure(sku: string) {
    const skuPath = getHierarchicalPath(sku, config.charsPerLevel, config.maxLevels);
    const directory = path.dirname(skuPath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    return skuPath;
  }

  /**
   * Check if SKU exists in hierarchical structure
   */
  async function checkSKUExists(sku: string) {
    try {
      const skuPath = getHierarchicalPath(sku, config.charsPerLevel, config.maxLevels);
      await fs.promises.access(skuPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Synchronous version for compatibility
   */
  function checkSKUExistsSync(sku: string) {
    try {
      const skuPath = getHierarchicalPath(sku, config.charsPerLevel, config.maxLevels);
      fs.accessSync(skuPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get configuration values
   */
  // function getConfig() {
  //   return { ...config }; // Return a copy to prevent external modification
  // }

  /**
   * Update configuration values
   */
  // function updateConfig(newBasePath, newCharsPerLevel, newMaxLevels) {
  //   if (newBasePath !== undefined) config.basePath = newBasePath;
  //   if (newCharsPerLevel !== undefined) config.charsPerLevel = newCharsPerLevel;
  //   if (newMaxLevels !== undefined) config.maxLevels = newMaxLevels;
  // }

  // Return public API (methods that can be called from outside)
  return {
    getHierarchicalPath,
    createDirectoryStructure,
    checkSKUExists,
    checkSKUExistsSync,
    // getConfig,
    // updateConfig,
  };
}
