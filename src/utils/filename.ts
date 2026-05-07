import { Filename, JSONObject } from '../types';
import { SourceLine } from '../line-data';
import { replaceWithFunction } from './replace-with-function';
import { replaceWithMap } from './replace-with-map';

export function setFilename(filename: Filename, ops: { line: SourceLine; metadata: JSONObject }) {
  if (typeof filename === 'object' && filename !== null) {
    const metadata = { ...ops.line.allData, metadata: ops.metadata };
    return replaceWithFunction(replaceWithMap(filename.template, ops.line.jsonLine), metadata);
  }

  return filename;
}
