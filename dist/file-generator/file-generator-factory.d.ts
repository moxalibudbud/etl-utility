import { FileGeneratorValues } from '../line-data';
import { DefaultGenerator, FileIndexGenerator, PushIfExistGenerator } from '.';
export declare const FileGeneratorFactory: (fileGenerator: FileGeneratorValues) => typeof DefaultGenerator | typeof PushIfExistGenerator | typeof FileIndexGenerator;
