import { FileGeneratorValues } from '../line-data';
import { DefaultGenerator } from './default-generator';
import { PushIfExistGenerator } from './push-if-exist';
import { FileIndexGenerator } from './file-index-generator';
import { JSONGenerator } from './json-generator';
export declare function FileGeneratorFactory(fileGenerator: 'push-if-exist'): typeof PushIfExistGenerator;
export declare function FileGeneratorFactory(fileGenerator: 'json-generator'): typeof JSONGenerator;
export declare function FileGeneratorFactory(fileGenerator: 'file-index-generator'): typeof FileIndexGenerator;
export declare function FileGeneratorFactory(fileGenerator?: FileGeneratorValues): typeof DefaultGenerator;
