import fs from 'fs';
import path from 'path';
const lineReader = require('line-reader');

// =============================================================================
// HIERARCHICAL DIRECTORY STRUCTURE IMPLEMENTATION
// =============================================================================

class HierarchicalSKUManager {
  constructor(basePath = '/srv', charsPerLevel = 2, maxLevels = 7) {
    this.basePath = basePath;
    this.charsPerLevel = charsPerLevel;
    this.maxLevels = maxLevels;
  }

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
  getHierarchicalPath(sku, charsPerLevel = 2, maxLevels = 7) {
    if (sku.length < charsPerLevel) {
      throw new Error(`SKU ${sku} is too short. Minimum ${charsPerLevel} characters required.`);
    }

    const chars = sku.split('');
    const pathParts = [this.basePath];

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
  createDirectoryStructure(sku) {
    const skuPath = this.getHierarchicalPath(sku, this.charsPerLevel, this.maxLevels);
    const directory = path.dirname(skuPath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    return skuPath;
  }

  /**
   * Check if SKU exists in hierarchical structure
   */
  async checkSKUExists(sku) {
    try {
      const skuPath = this.getHierarchicalPath(sku, this.charsPerLevel, this.maxLevels);
      await fs.promises.access(skuPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Synchronous version for compatibility
   */
  checkSKUExistsSync(sku) {
    try {
      const skuPath = this.getHierarchicalPath(sku, this.charsPerLevel, this.maxLevels);
      fs.accessSync(skuPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Filter SKUs from input file using hierarchical structure
   */
  async filterSKUsHierarchical(inputFile, outputFile, batchSize = 100) {
    const results = [];
    const skuList = [];

    return new Promise((resolve, reject) => {
      // First, read all SKUs
      lineReader.eachLine(inputFile, async (line, last) => {
        const sku = line.trim();
        if (sku) {
          skuList.push(sku);
        }

        if (last) {
          console.log(`Processing ${skuList.length} SKUs in batches of ${batchSize}...`);

          // Process in batches to avoid overwhelming filesystem
          for (let i = 0; i < skuList.length; i += batchSize) {
            const batch = skuList.slice(i, i + batchSize);

            const batchPromises = batch.map(async (sku) => {
              const exists = await this.checkSKUExists(sku);
              return exists ? sku : null;
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults.filter((sku) => sku !== null));

            // Progress logging
            if ((i + batchSize) % 10000 === 0) {
              console.log(`Processed ${Math.min(i + batchSize, skuList.length)} SKUs...`);
            }
          }

          // Write results
          fs.writeFileSync(outputFile, results.join('\n'));
          console.log(`Found ${results.length} existing SKUs out of ${skuList.length}`);
          resolve(results);
        }
      });
    });
  }

  /**
   * Migrate existing flat structure to hierarchical
   */
  async migrateFlatToHierarchical(flatDir) {
    console.log('Starting migration from flat to hierarchical structure...');

    const files = fs.readdirSync(flatDir);
    let migrated = 0;

    for (const file of files) {
      try {
        const oldPath = path.join(flatDir, file);
        const newPath = this.createDirectoryStructure(file);

        // Move file to new hierarchical location
        fs.renameSync(oldPath, newPath);
        migrated++;

        if (migrated % 10000 === 0) {
          console.log(`Migrated ${migrated}/${files.length} files...`);
        }
      } catch (error) {
        console.error(`Error migrating ${file}:`, error.message);
      }
    }

    console.log(`Migration complete! Migrated ${migrated} files.`);
  }
}

// =============================================================================
// INDEX-BASED IMPLEMENTATION (RECOMMENDED FOR YOUR SCALE)
// =============================================================================

class IndexBasedSKUManager {
  constructor(basePath = '/srv') {
    this.basePath = basePath;
    this.indexFile = path.join(basePath, 'sku_index.json');
    this.binaryIndexFile = path.join(basePath, 'sku_index.bin');
    this.skuSet = null;
  }

  /**
   * Build SKU index from hierarchical directory structure
   * This is a one-time operation
   */
  async buildSKUIndexFromHierarchical() {
    console.log('Building SKU index from hierarchical structure...');
    const allSKUs = new Set();
    let processed = 0;

    const walkDirectory = async (dir, depth = 0) => {
      try {
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory()) {
            await walkDirectory(itemPath, depth + 1);
          } else {
            // This is a SKU file
            allSKUs.add(item);
            processed++;

            if (processed % 100000 === 0) {
              console.log(`Processed ${processed} SKUs...`);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dir}:`, error.message);
      }
    };

    await walkDirectory(this.basePath);

    // Save as JSON for human readability
    const skuArray = Array.from(allSKUs).sort();
    fs.writeFileSync(this.indexFile, JSON.stringify(skuArray, null, 2));

    // Save as binary for faster loading (optional optimization)
    const buffer = Buffer.from(JSON.stringify(skuArray));
    fs.writeFileSync(this.binaryIndexFile, buffer);

    console.log(`Index built successfully! Found ${skuArray.length} SKUs.`);
    console.log(`Index saved to: ${this.indexFile}`);

    return skuArray;
  }

  /**
   * Build SKU index from flat directory (if you haven't migrated yet)
   */
  async buildSKUIndexFromFlat(flatDir) {
    console.log('Building SKU index from flat directory...');

    try {
      const files = fs.readdirSync(flatDir);
      const skuArray = files.sort();

      // Save index
      fs.writeFileSync(this.indexFile, JSON.stringify(skuArray, null, 2));

      console.log(`Index built from flat directory! Found ${skuArray.length} SKUs.`);
      return skuArray;
    } catch (error) {
      console.error('Error building index from flat directory:', error.message);
      throw error;
    }
  }

  /**
   * Load SKU index into memory for fast lookups
   */
  loadSKUIndex() {
    try {
      console.log('Loading SKU index...');
      const skuArray = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
      this.skuSet = new Set(skuArray);
      console.log(`Loaded ${skuArray.length} SKUs into memory.`);
      return this.skuSet;
    } catch (error) {
      console.error('Error loading SKU index:', error.message);
      throw new Error('SKU index not found. Please build index first.');
    }
  }

  /**
   * Check if SKU exists using in-memory index (O(1) lookup)
   */
  checkSKUExists(sku) {
    if (!this.skuSet) {
      throw new Error('SKU index not loaded. Call loadSKUIndex() first.');
    }
    return this.skuSet.has(sku);
  }

  /**
   * Filter SKUs using index-based approach (FAST!)
   */
  async filterSKUsWithIndex(inputFile, outputFile) {
    if (!this.skuSet) {
      this.loadSKUIndex();
    }

    const results = [];
    let processed = 0;

    return new Promise((resolve, reject) => {
      lineReader.eachLine(inputFile, (line, last) => {
        const sku = line.trim();
        if (sku && this.checkSKUExists(sku)) {
          results.push(sku);
        }

        processed++;
        if (processed % 10000 === 0) {
          console.log(`Processed ${processed} SKUs, found ${results.length} existing...`);
        }

        if (last) {
          // Write results
          fs.writeFileSync(outputFile, results.join('\n'));
          console.log(`\nFiltering complete!`);
          console.log(`Processed: ${processed} SKUs`);
          console.log(`Found: ${results.length} existing SKUs`);
          console.log(`Results saved to: ${outputFile}`);
          resolve(results);
        }
      });
    });
  }

  /**
   * Update index when new SKUs are added
   */
  async updateIndex(newSKUs) {
    if (!this.skuSet) {
      this.loadSKUIndex();
    }

    let added = 0;
    newSKUs.forEach((sku) => {
      if (!this.skuSet.has(sku)) {
        this.skuSet.add(sku);
        added++;
      }
    });

    // Save updated index
    const updatedArray = Array.from(this.skuSet).sort();
    fs.writeFileSync(this.indexFile, JSON.stringify(updatedArray, null, 2));

    console.log(`Added ${added} new SKUs to index. Total: ${updatedArray.length}`);
  }
}

// =============================================================================
// USAGE EXAMPLES WITH DYNAMIC HIERARCHY
// =============================================================================

async function example1_HierarchicalApproach() {
  // Default: 2 chars per level, max 7 levels
  const hierarchical = new HierarchicalSKUManager('/srv');

  // Custom: 3 chars per level, max 5 levels
  // const hierarchical = new HierarchicalSKUManager('/srv', 3, 5);

  // Filter 100k SKUs against 5M hierarchical structure
  await hierarchical.filterSKUsHierarchical(
    'input_skus.txt', // Your 100k SKUs
    'existing_skus.txt', // Output file
    500 // Batch size
  );
}

async function example2_IndexApproach() {
  const indexBased = new IndexBasedSKUManager('/srv');

  // One-time: Build index from your 5M SKUs
  await indexBased.buildSKUIndexFromHierarchical();

  // Fast filtering using index
  await indexBased.filterSKUsWithIndex(
    'input_skus.txt', // Your 100k SKUs
    'existing_skus.txt' // Output file
  );
}

async function example3_Migration() {
  const hierarchical = new HierarchicalSKUManager('/srv', 2, 7);

  // Migrate from flat structure to hierarchical
  await hierarchical.migrateFlatToHierarchical('/srv/flat_skus');
}

async function example4_DynamicHierarchyDemo() {
  const manager = new HierarchicalSKUManager('/srv', 2, 7);

  // Test different SKU lengths
  const testSKUs = [
    'AB', // 2 chars
    'ABCD', // 4 chars
    'ABCDEFGH', // 8 chars
    'ABCDEFGHIJKLMN', // 14 chars
    'VERYLONGSKUCODE123', // 19 chars
  ];

  testSKUs.forEach((sku) => {
    try {
      const path = manager.getHierarchicalPath(sku, 2, 7);
      console.log(`${sku} -> ${path}`);
    } catch (error) {
      console.error(`Error with ${sku}: ${error.message}`);
    }
  });
}

// Example outputs:
// AB -> /srv/AB/AB
// ABCD -> /srv/AB/CD/ABCD
// ABCDEFGH -> /srv/AB/CD/EF/GH/ABCDEFGH
// ABCDEFGHIJKLMN -> /srv/AB/CD/EF/GH/IJ/KL/MN/ABCDEFGHIJKLMN
// VERYLONGSKUCODE123 -> /srv/VE/RY/LO/NG/SK/UC/OD/VERYLONGSKUCODE123

// Export classes for use
module.exports = {
  HierarchicalSKUManager,
  IndexBasedSKUManager,
};
