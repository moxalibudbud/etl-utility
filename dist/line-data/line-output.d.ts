import { SourceLine } from './source-line';
type LineOutputBase = {
    filename: string | ((line: SourceLine) => string) | {
        template: string;
    };
    separator: string;
    header?: string | ((line: SourceLine) => string);
    footer?: string | (() => string);
    template?: string | ((line: SourceLine) => string);
    uniqueKey?: string;
};
export type LineOutputOptions = LineOutputBase;
export {};
