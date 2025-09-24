import { SourceLine } from './source-line';
export type FileGeneratorValues = 'default-generator' | 'push-if-exist' | 'file-index-generator';
type LineOutputBase = {
    filename: string | ((line: SourceLine) => string) | {
        template: string;
    };
    separator: string;
    header?: string | ((line: SourceLine) => string);
    footer?: string | (() => string);
    template?: string | ((line: SourceLine) => string);
    uniqueKey?: string;
    indexFile?: string;
    rowReferences?: Set<string | number>;
    fileGenerator?: FileGeneratorValues;
};
export type LineOutputOptions = LineOutputBase;
export {};
