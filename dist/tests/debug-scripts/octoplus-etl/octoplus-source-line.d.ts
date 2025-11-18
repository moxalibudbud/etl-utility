import { SourceLineBase } from '../../../line-data/source-line-base';
import { OctoplusLineOptions } from './octoplus-etl';
type Options = OctoplusLineOptions & {
    currentLineNumber: number;
};
export declare class OctoplusSourceLine extends SourceLineBase {
    constructor(line: string, options: Options);
    get output(): {
        [x: string]: any;
    };
}
export {};
