import * as readline from 'readline';
import * as fs from 'fs';

// Define the mapping configuration structure
interface ColumnMapping {
  sourceColumn: string | number; // Column name or index
  targetPath: string; // Hierarchical path like "root.id" or "lines[].sku"
  transform?: (value: any) => any; // Optional transformation function
}

interface ETLConfig {
  mappings: ColumnMapping[];
  sourceDelimiter?: string; // Default: ","
}

// Parsed path information
interface ParsedPath {
  type: 'root' | 'array';
  rootKey?: string;
  arrayKey?: string;
  arrayField?: string;
}

class JSONETLProcessor {
  private config: ETLConfig;
  private rootData: Record<string, any> = {};
  private arrayBuckets: Map<string, any[]> = new Map();

  constructor(config: ETLConfig) {
    this.config = config;
  }

  /**
   * Parse hierarchical path into structured information
   * Examples:
   * - "root.id" -> { type: 'root', rootKey: 'id' }
   * - "lines[].sku" -> { type: 'array', arrayKey: 'lines', arrayField: 'sku' }
   */
  private parsePath(path: string): ParsedPath {
    // Check if it's an array path: "arrayName[].fieldName"
    const arrayMatch = path.match(/^(\w+)\[\]\.(\w+)$/);
    if (arrayMatch) {
      return {
        type: 'array',
        arrayKey: arrayMatch[1],
        arrayField: arrayMatch[2],
      };
    }

    // Check if it's a root path: "root.fieldName"
    const rootMatch = path.match(/^root\.(\w+)$/);
    if (rootMatch) {
      return {
        type: 'root',
        rootKey: rootMatch[1],
      };
    }

    throw new Error(`Invalid path format: ${path}`);
  }

  /**
   * Extract value from a line based on source column definition
   */
  private extractValue(line: string, sourceColumn: string | number): string {
    const delimiter = this.config.sourceDelimiter || ',';
    const columns = line.split(delimiter);

    if (typeof sourceColumn === 'number') {
      return columns[sourceColumn]?.trim() || '';
    }

    // If sourceColumn is a string, assume first row has headers
    // (You'd need to handle header row separately in real implementation)
    return columns[0]?.trim() || '';
  }

  /**
   * Process a single line and accumulate data
   */
  private processLine(line: string, lineNumber: number) {
    this.config.mappings.forEach((mapping) => {
      const value = this.extractValue(line, mapping.sourceColumn);
      const transformedValue = mapping.transform ? mapping.transform(value) : value;

      const parsedPath = this.parsePath(mapping.targetPath);

      if (parsedPath.type === 'root') {
        // Root level data - typically from first line or specific lines
        if (parsedPath.rootKey) {
          this.rootData[parsedPath.rootKey] = transformedValue;
        }
      } else if (parsedPath.type === 'array') {
        // Array data - accumulate items
        if (!parsedPath.arrayKey || !parsedPath.arrayField) return;

        if (!this.arrayBuckets.has(parsedPath.arrayKey)) {
          this.arrayBuckets.set(parsedPath.arrayKey, []);
        }

        const bucket = this.arrayBuckets.get(parsedPath.arrayKey)!;

        // Find or create the current array item for this line
        let currentItem = bucket[lineNumber];
        if (!currentItem) {
          currentItem = {};
          bucket[lineNumber] = currentItem;
        }

        currentItem[parsedPath.arrayField] = transformedValue;
      }
    });
  }

  /**
   * Build the final JSON structure from accumulated data
   */
  private buildFinalJSON(): any {
    const result = { ...this.rootData };

    // Add all array buckets to the result
    this.arrayBuckets.forEach((items, key) => {
      // Filter out undefined items (from gaps in line numbers)
      result[key] = items.filter((item) => item !== undefined);
    });

    return result;
  }

  /**
   * Main ETL process
   */
  async process(inputFile: string, outputFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(inputFile);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      let lineNumber = 0;
      let hasHeader = false; // Set to true if first line is header

      rl.on('line', (line: string) => {
        // Skip empty lines
        if (!line.trim()) return;

        // Skip header row if applicable
        if (lineNumber === 0 && hasHeader) {
          lineNumber++;
          return;
        }

        try {
          this.processLine(line, lineNumber);
          lineNumber++;
        } catch (error) {
          console.error(`Error processing line ${lineNumber}:`, error);
        }
      });

      rl.on('close', () => {
        try {
          // Build final JSON structure
          const finalJSON = this.buildFinalJSON();

          // Write to output file
          fs.writeFileSync(outputFile, JSON.stringify(finalJSON, null, 2), 'utf-8');

          console.log(`Successfully processed ${lineNumber} lines`);
          console.log(`Output written to ${outputFile}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      rl.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Reset internal state for reuse
   */
  reset(): void {
    this.rootData = {};
    this.arrayBuckets.clear();
  }
}

// ============================================
// USAGE EXAMPLE
// ============================================

// Example CSV content:
// 123,Active,SKU001,5
// 123,Active,SKU002,3

const config: ETLConfig = {
  sourceDelimiter: ';',
  mappings: [
    {
      sourceColumn: 0,
      targetPath: 'root.id',
      // transform: (val) => val
    },
    {
      sourceColumn: 1,
      targetPath: 'root.status',
      transform: (val) => (val === 'Active' ? 123 : 0),
    },
    {
      sourceColumn: 2,
      targetPath: 'lines[].sku',
      transform: (val) => parseInt(val.replace('SKU', ''), 10),
    },
    {
      sourceColumn: 3,
      targetPath: 'lines[].qty',
      transform: (val) => parseInt(val, 10),
    },
  ],
};

// Create processor and run
const processor = new JSONETLProcessor(config);

// Usage
processor
  .process('/var/tmp/O_DSU.csv', 'output.json')
  .then(() => console.log('ETL completed'))
  .catch((err) => console.error('ETL failed:', err));

export { JSONETLProcessor, ETLConfig, ColumnMapping };
