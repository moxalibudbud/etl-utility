import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

// Usage example:
// const hierarcyManager = fileHierarchicalManager('/srv', 2, 7);
// const path = hierarcyManager.getHierarchicalPath('ABCDEF123');
// console.log(path); // /srv/AB/CD/EF/12/30/ABCDEF123

export const FILE_HIERARCHICAL_INDEX_DIRECTORY = '/var/tmp/file-hierarchical-index';
export const FILE_HIERARCHICAL_INDEX_FILE = '/var/tmp/file-hierarchical-index/file-index.dat';

/**
 *
 * @param basePath - Directory where the indexes will be saved. Default /var/tmp/file-hierarchical-index
 * @param charsPerLevel - Default = 2
 * @param maxLevels - Default = 7
 * @returns
 */
export function fileHierarchicalManager(
  basePath = FILE_HIERARCHICAL_INDEX_DIRECTORY,
  charsPerLevel = 2,
  maxLevels = 7
) {
  // Private variables (closure scope)
  const config = {
    basePath,
    charsPerLevel,
    maxLevels,
  };

  /**
   * Converts index to hierarchical path dynamically
   * Examples:
   * - "AB" (2 chars) -> /srv/AB/AB
   * - "ABCD" (4 chars) -> /srv/AB/CD/ABCD
   * - "ABCDEFGHIJ" (10 chars) -> /srv/AB/CD/EF/GH/IJ/KL/MN/ABCDEFGHIJ
   * - "VERYLONGINDEXNAME" -> /srv/VE/RY/LO/NG/SK/UN/AM/VERYLONGINDEXNAME
   *
   * Distributes files across multiple directory levels to avoid filesystem bottlenecks
   */
  function getHierarchicalPath(
    index: string,
    charsPerLevel = config.charsPerLevel,
    maxLevels = config.maxLevels
  ): string {
    if (index.length < charsPerLevel) {
      throw new Error(`${index} is too short. Minimum ${charsPerLevel} characters required.`);
    }

    const chars = index.split('');
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

    // Add the final file
    pathParts.push(index);

    return path.join(...pathParts);
  }

  /**
   * Create directory structure for a index (without creating the file)
   */
  function createDirectoryStructure(index: string) {
    const indexPath = getHierarchicalPath(index, config.charsPerLevel, config.maxLevels);
    const directory = path.dirname(indexPath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    return indexPath;
  }

  /**
   * Create index reference in it's hierarchical directory
   */
  async function saveIndex(index: string) {
    const indexPath = createDirectoryStructure(index);

    try {
      await fsPromises.writeFile(indexPath, '.', 'utf8');
    } catch (_) {
      console.log(_);
    }
  }

  /**
   * Check if index exists in hierarchical structure
   */
  async function checkIndexExists(index: string) {
    try {
      const indexPath = getHierarchicalPath(index, config.charsPerLevel, config.maxLevels);
      await fs.promises.access(indexPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Synchronous version for compatibility
   */
  function checkIndexExistsSync(index: string) {
    try {
      const indexPath = getHierarchicalPath(index, config.charsPerLevel, config.maxLevels);
      fs.accessSync(indexPath);
      return true;
    } catch {
      return false;
    }
  }

  // Return public API (methods that can be called from outside)
  return {
    getHierarchicalPath,
    createDirectoryStructure,
    checkIndexExists,
    checkIndexExistsSync,
    saveIndex,
  };
}
