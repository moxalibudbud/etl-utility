import * as fs from 'fs';
import * as path from 'path';

export function loadConfig(filename: string) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, filename), 'utf-8'));
}
