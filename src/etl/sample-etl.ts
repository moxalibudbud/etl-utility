import { AzureBlobContainers } from '@etl/core/enums';
import { ErrorReport } from '../file-generator/error-report';
import { ReadLineInterface, readLineInterface, ReadLineInterfaceType } from '../file-reader/readline-interface-factory';
// import { RmsCountFile, SiocsCountFile } from '../file-generator/count-file';
import { ETLType } from '../util/etl-factory';
import { countFileReaderFactory } from '../util/line-model-factory';
import {
  ETLResult,
  JSONObject,
  CountFileETLOutputFileWriter,
  CountFileDestinationContainers,
  CountFileETLOptions,
  CountFileETLLineModel,
  CountFileIdentifier,
} from '@utils/types';
import { LineData } from '../line-data';
import { LineBaseOptions } from '../line-data/line-base';
import { FlatFileBaseLazy } from '../file-generator/flat-file-base-lazy';

type ETLOptions = {
  line: LineBaseOptions;
  etl: { blobURL: string; file?: never } | { file: string; blobURL?: never };
};

export class SampleETL {
  outputFileWriter: FlatFileBaseLazy;
  errorReportWriter: ErrorReport;
  lineReader: ReadLineInterface;

  fileSource: string;
  // destinationContainer: CountFileDestinationContainers;
  // fileType: AzureBlobContainers.DATASCAN_COUNT_FILE;
  valid: boolean = true;
  lineIndex = 0;
  sampleLineData?: JSONObject;
  identifiers?: CountFileIdentifier;
  options: ETLOptions;

  constructor(args: ETLOptions, outputFileWriter: FlatFileBaseLazy) {
    this.options = args;
    this.fileSource = args.etl.blobURL ?? (args.etl.file as string);
    // this.destinationContainer = args.destinationContainer;
    // this.fileType = args.fileType;

    this.lineReader = this.initiateReadlineInterface(args.etl.blobURL);
    this.errorReportWriter = this.initiateErrorReportWriter();
    this.outputFileWriter = outputFileWriter;
  }

  initiateReadlineInterface(blobUrl?: string | undefined) {
    const lineReaderType: ReadLineInterfaceType = blobUrl ? ReadLineInterfaceType.Blob : ReadLineInterfaceType.File;
    return readLineInterface(this.fileSource, lineReaderType);
  }

  initiateErrorReportWriter() {
    if (!this.lineReader) throw new Error('lineReader needs to instantiate first to generate error report writer');
    return new ErrorReport({ filename: this.lineReader.filename });
  }

  onLineHandler(chunk: string) {
    try {
      this.lineIndex++;

      // const lineModel = countFileReaderFactory[this.fileType];
      // this.populate(new lineModel(chunk, { currentLineNumber: this.lineIndex }));
      const options = {
        currentLineNumber: this.lineIndex,
        ...this.options.line,
      };

      const lineModel = new LineData(chunk, options);
      this.populate(lineModel);
    } catch (error) {
      this.lineReader.readlineInterface?.emit('error', error);
    }
  }

  onCloseHandler(resolve: Function) {
    resolve({});

    if (this.outputFileWriter instanceof RmsCountFile || this.outputFileWriter instanceof SiocsCountFile) {
      this.outputFileWriter.pushFooter(this.lineIndex);
    }
  }

  populate(line: CountFileETLLineModel) {
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

  setIdentifier(identifiers: CountFileIdentifier) {
    this.identifiers = identifiers;
  }

  async processLines() {
    return new Promise((resolve, reject) => {
      try {
        this.lineReader.readlineInterface?.on('line', this.onLineHandler.bind(this));
        this.lineReader.readlineInterface?.on('close', () => this.onCloseHandler(resolve));
        this.lineReader.readlineInterface?.on('error', (e) => reject(e));
      } catch (e) {
        reject(e);
      }
    });
  }

  async cleanUp() {
    // Gracefully end all streams
    await this.outputFileWriter.end();
    await this.errorReportWriter.end();
    this.lineReader.cleanUpPreviousListeners();

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
    const withErrors = !!this.errorReportWriter.invalidRows;

    if (!this.sampleLineData || !this.identifiers || withErrors) {
      this.valid = false;
      this.errorReportWriter.push('Unable to get data. File content is empty or some rows are invalid');
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
      // destinationContainer: this.destinationContainer,
      destinationContainer: 'na',
      fileType: ETLType.COUNT_FILE,
      metadata: { ...this.sampleLineData, ...this.identifiers },
    };
  }

  async process() {
    try {
      await this.lineReader.initiateInterface();
      await this.processLines();
      this.validateFinalResult();
      await this.cleanUp();
      return this.getResult();
    } catch (error) {
      throw error;
    }
  }
}
