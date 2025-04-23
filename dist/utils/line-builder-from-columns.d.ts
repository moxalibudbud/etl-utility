type Options = {
    separator?: string;
    columns: string[];
};
export declare function buildLineFromColumns(line: Record<string, string>, options: Options): string;
export {};
