import { BlobReader } from './blob-reader';
import { FileReader } from './file-reader';

export type ReadLineInterface = BlobReader | FileReader;

export enum ReadLineInterfaceType {
  Blob = 'blob',
  File = 'file',
}

export function readLineInterface(source: string, type: ReadLineInterfaceType) {
  if (type == ReadLineInterfaceType.Blob) {
    return new BlobReader(source);
  } else {
    return new FileReader(source);
  }
}
