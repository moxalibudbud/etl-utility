"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const replace_with_function_1 = require("../../../utils/replace-with-function");
(0, globals_1.describe)('replaceWithFunction', () => {
    (0, globals_1.describe)('no placeholder match', () => {
        (0, globals_1.it)('returns empty string unchanged', () => {
            (0, globals_1.expect)((0, replace_with_function_1.replaceWithFunction)('')).toBe('');
        });
        (0, globals_1.it)('returns string with no placeholders unchanged', () => {
            (0, globals_1.expect)((0, replace_with_function_1.replaceWithFunction)('simple_file_name.txt')).toBe('simple_file_name.txt');
        });
        (0, globals_1.it)('keeps malformed (unclosed) bracket expressions as-is', () => {
            const template = 'file_[unclosed_bracket.txt';
            (0, globals_1.expect)((0, replace_with_function_1.replaceWithFunction)(template)).toBe('file_[unclosed_bracket.txt');
        });
    });
    (0, globals_1.describe)('supported function: timestamp', () => {
        (0, globals_1.it)('replaces [timestamp] with a numeric timestamp', () => {
            const template = 'file_[timestamp].txt';
            const result = (0, replace_with_function_1.replaceWithFunction)(template);
            (0, globals_1.expect)(result).toMatch(/^file_\d+\.txt$/);
            (0, globals_1.expect)(result).not.toContain('[timestamp]');
        });
        (0, globals_1.it)('produces a value close to Date.now()', () => {
            const before = Date.now();
            const result = (0, replace_with_function_1.replaceWithFunction)('[timestamp]');
            const after = Date.now();
            const value = Number(result);
            (0, globals_1.expect)(value).toBeGreaterThanOrEqual(before);
            (0, globals_1.expect)(value).toBeLessThanOrEqual(after);
        });
    });
    (0, globals_1.describe)('supported function: dateTime', () => {
        (0, globals_1.it)('replaces [dateTime] with the default format YYYY-MM-DDTHH:mm:ssZ', () => {
            const template = 'export_[dateTime].csv';
            const result = (0, replace_with_function_1.replaceWithFunction)(template);
            (0, globals_1.expect)(result).toMatch(/^export_\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.+\.csv$/);
            (0, globals_1.expect)(result).not.toContain('[dateTime]');
        });
        (0, globals_1.it)('accepts a custom format argument', () => {
            const template = 'backup_[dateTime, YYYY-MM-DD].sql';
            const result = (0, replace_with_function_1.replaceWithFunction)(template);
            (0, globals_1.expect)(result).toMatch(/^backup_\d{4}-\d{2}-\d{2}\.sql$/);
        });
        (0, globals_1.it)('accepts both custom format and timezone arguments', () => {
            const template = 'log_[dateTime, YYYY-MM-DD HH:mm:ss, UTC].log';
            const result = (0, replace_with_function_1.replaceWithFunction)(template);
            (0, globals_1.expect)(result).toMatch(/^log_\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.log$/);
        });
        (0, globals_1.it)('supports milliseconds via SSS token', () => {
            const template = '[dateTime, YYYY-MM-DD_HH:mm:ss.SSS]';
            const result = (0, replace_with_function_1.replaceWithFunction)(template);
            (0, globals_1.expect)(result).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}:\d{2}\.\d{3}$/);
        });
        (0, globals_1.it)('trims whitespace around comma-separated arguments', () => {
            const template = '[dateTime , YYYY-MM-DD , UTC]';
            const result = (0, replace_with_function_1.replaceWithFunction)(template);
            (0, globals_1.expect)(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });
    (0, globals_1.describe)('customFunction fallback (unknown function name)', () => {
        (0, globals_1.it)('evaluates a simple property access from metadata', () => {
            const template = 'user_[return args.name].txt';
            const result = (0, replace_with_function_1.replaceWithFunction)(template, { name: 'alice' });
            (0, globals_1.expect)(result).toBe('user_alice.txt');
        });
        (0, globals_1.it)('evaluates a numeric metadata field and stringifies it', () => {
            const template = 'count_[return args.count]';
            const result = (0, replace_with_function_1.replaceWithFunction)(template, { count: 42 });
            (0, globals_1.expect)(result).toBe('count_42');
        });
        (0, globals_1.it)('evaluates a boolean metadata field', () => {
            const template = 'flag_[return args.active]';
            const result = (0, replace_with_function_1.replaceWithFunction)(template, { active: true });
            (0, globals_1.expect)(result).toBe('flag_true');
        });
        (0, globals_1.it)('evaluates a nested metadata property', () => {
            const template = '[return args.user.email]';
            const result = (0, replace_with_function_1.replaceWithFunction)(template, { user: { email: 'a@b.com' } });
            (0, globals_1.expect)(result).toBe('a@b.com');
        });
        (0, globals_1.it)('supports method invocation on metadata values', () => {
            const template = '[return args.name.toUpperCase()]';
            const result = (0, replace_with_function_1.replaceWithFunction)(template, { name: 'bob' });
            (0, globals_1.expect)(result).toBe('BOB');
        });
        (0, globals_1.it)('returns the literal string "undefined" when metadata field is missing', () => {
            const template = 'x_[return args.missing]';
            const result = (0, replace_with_function_1.replaceWithFunction)(template, { name: 'alice' });
            (0, globals_1.expect)(result).toBe('x_undefined');
        });
        (0, globals_1.it)('keeps the original placeholder when no metadata is passed and identifier is undefined', () => {
            const template = 'file_[unknownFunction].txt';
            const result = (0, replace_with_function_1.replaceWithFunction)(template);
            (0, globals_1.expect)(result).toBe('file_[unknownFunction].txt');
        });
        (0, globals_1.it)('keeps the original placeholder when the function body throws', () => {
            const template = 'file_[return args.user.email].txt';
            const result = (0, replace_with_function_1.replaceWithFunction)(template, {});
            (0, globals_1.expect)(result).toBe('file_[return args.user.email].txt');
        });
        (0, globals_1.it)('defaults metadata to an empty object when omitted', () => {
            const template = '[return Object.keys(args).length]';
            const result = (0, replace_with_function_1.replaceWithFunction)(template);
            (0, globals_1.expect)(result).toBe('0');
        });
    });
    (0, globals_1.describe)('multiple placeholders', () => {
        (0, globals_1.it)('handles multiple supported-function placeholders in one template', () => {
            const template = '[timestamp]_[dateTime, YYYY-MM-DD]_data';
            const result = (0, replace_with_function_1.replaceWithFunction)(template);
            (0, globals_1.expect)(result).toMatch(/^\d+_\d{4}-\d{2}-\d{2}_data$/);
        });
        (0, globals_1.it)('mixes supported functions, customFunction hits, and unknown placeholders', () => {
            const template = '[timestamp]_[return args.name]_[unknownFunc]_[dateTime, YYYY]';
            const result = (0, replace_with_function_1.replaceWithFunction)(template, { name: 'alice' });
            (0, globals_1.expect)(result).toMatch(/^\d+_alice_\[unknownFunc\]_\d{4}$/);
        });
    });
});
