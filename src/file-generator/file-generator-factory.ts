import { FileGeneratorValues } from '../line-data';
import { DefaultGenerator, FileIndexGenerator, PushIfExistGenerator } from '.';

export const FileGeneratorFactory = (fileGenerator: FileGeneratorValues) => {
  if (fileGenerator === 'push-if-exist') {
    return PushIfExistGenerator;
  } else if (fileGenerator === 'file-index-generator') {
    return FileIndexGenerator;
  } else {
    return DefaultGenerator;
  }
};
