import { FileGeneratorValues } from '../line-data';
import { DefaultGenerator } from './default-generator';
import { PushIfExistGenerator } from './push-if-exist';
import { FileIndexGenerator } from './file-index-generator';

export function FileGeneratorFactory(fileGenerator: 'push-if-exist'): typeof PushIfExistGenerator;
export function FileGeneratorFactory(fileGenerator: 'file-index-generator'): typeof FileIndexGenerator;
export function FileGeneratorFactory(fileGenerator?: FileGeneratorValues): typeof DefaultGenerator;
export function FileGeneratorFactory(fileGenerator?: FileGeneratorValues) {
  if (fileGenerator === 'push-if-exist') {
    return PushIfExistGenerator;
  } else if (fileGenerator === 'file-index-generator') {
    return FileIndexGenerator;
  } else {
    return DefaultGenerator;
  }
}
