import { ErrorReport } from '../file-generator/error-report';
import { ReadLineInterface } from '../file-reader/readline-interface-factory';
import { ETLResult, JSONObject, NestedRecord } from '../types';
import { JSONSourceLine, LineSourceBaseOptions } from '../line-data';
import { FlatFileBaseLazy, FlatFileBaseLazyMethods } from '../file-generator/flat-file-base-lazy';

type ETLOptions = {
  line: LineSourceBaseOptions;
  json: NestedRecord[];
  errorFilename: string;

  // True = Reject the entire validation if atleast one row is invalid. Else, just skip
  // False/undefined = Just skip the invalid row in the output (default)
  rejectOnInvalidRow?: boolean;
};

export class JsonETL {
  outputFileWriter: FlatFileBaseLazy & FlatFileBaseLazyMethods;
  errorReportWriter: ErrorReport;
  lineReader?: ReadLineInterface;

  fileSource?: string;
  json = [];
  valid: boolean = true;
  lineIndex = 0;
  sampleLineData?: JSONObject;
  identifiers?: JSONObject;
  options: ETLOptions;

  constructor(args: ETLOptions, outputFileWriter: FlatFileBaseLazy & FlatFileBaseLazyMethods) {
    this.options = args;
    this.errorReportWriter = this.initiateErrorReportWriter();
    this.outputFileWriter = outputFileWriter;
  }

  initiateErrorReportWriter() {
    return new ErrorReport({ filename: this.options.errorFilename });
  }

  onLineHandler(json: JSONObject) {
    this.lineIndex++;

    const options = {
      ...this.options.line,
      currentLineNumber: this.lineIndex,
    };

    const lineModel = new JSONSourceLine(json, options);
    this.populate(lineModel);
  }

  populate(line: JSONSourceLine) {
    line.validate();

    // Populate error report.
    if (!line.isValid) {
      this.errorReportWriter.push(line.error);
    }

    // Populate output file only if valid row and if current line is not header
    if (line.isValid && !line.isHeader) {
      this.outputFileWriter.push(line);
    }

    // Set sample line data and identifiers if not yet set
    if ((!this.sampleLineData || !this.identifiers) && line.isValid && !line.isHeader) {
      this.setSampleLineData(line.jsonLine);
      this.setIdentifier(line.identifiers);
    }
  }

  setSampleLineData(args: JSONObject) {
    this.sampleLineData = args;
  }

  setIdentifier(identifiers: JSONObject) {
    this.identifiers = identifiers;
  }

  async processLines() {
    for (const element of this.options.json) {
      this.onLineHandler(element);
    }
  }

  async forceCleanUp() {
    // Gracefully end all streams
    await this.outputFileWriter.end();
    await this.errorReportWriter.end();

    // Delete error file from local folder if there is no error
    await this.errorReportWriter.delete();

    // Delete output file from local folder if invalid
    await this.outputFileWriter.delete();
  }

  async cleanUp() {
    // Gracefully end all streams
    await this.outputFileWriter.end();
    await this.errorReportWriter.end();

    // Delete error file from local folder if there is no error
    if (this.errorReportWriter.invalidRows === 0) {
      await this.errorReportWriter.delete();
    }

    // Delete output file from local folder if invalid
    if (!this.valid) {
      await this.outputFileWriter.delete();
    }
  }

  validateFinalResult() {
    if (!this.sampleLineData || !this.identifiers) {
      this.valid = false;
      this.errorReportWriter.push('Unable to get data. File content is empty');
    } else if (this.options.rejectOnInvalidRow && !!this.errorReportWriter.invalidRows) {
      this.valid = false;
    }
  }

  getResult(): ETLResult {
    return {
      valid: this.valid,
      withErrors: !!this.errorReportWriter.invalidRows,
      totalErrors: this.errorReportWriter.invalidRows,
      localOutputFile: this.outputFileWriter.filepath,
      localOutputFilename: this.outputFileWriter.filename as string,
      localErrorReportFile: this.errorReportWriter.filepath,
      localErrorReportFilename: this.errorReportWriter.filename,
      metadata: { ...this.sampleLineData, ...this.identifiers },
    };
  }

  async process() {
    try {
      await this.processLines();
      this.validateFinalResult();
      await this.cleanUp();
      return this.getResult();
    } catch (error) {
      this.forceCleanUp();
      throw error;
    }
  }
}
