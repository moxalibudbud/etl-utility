import fs from 'fs';
import fsPromises from 'fs/promises';

/**
 * Expected content will be flat string per row.
 * The goal of this is to convert those row values into array.
 */
export function getIndexArray(content: string) {
  const indexArray = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return indexArray;
}

export function loadIndexAsArray(indexPath: string) {
  const content = fs.readFileSync(indexPath, 'utf8');
  return getIndexArray(content);
}

export async function loadIndexAsArrayAsync(indexPath: string) {
  const content = await fsPromises.readFile(indexPath, 'utf8');
  return getIndexArray(content);
}

export function loadIndexSet(indexPath: string) {
  const content = fs.readFileSync(indexPath, 'utf8');
  const array = getIndexArray(content);
  return new Set(array);
}

export async function loadIndexAsSetAsync(indexPath: string) {
  const content = await fsPromises.readFile(indexPath, 'utf8');
  const array = getIndexArray(content);
  return new Set(array);
}
