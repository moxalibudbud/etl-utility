import { AzureBlobContainers } from '@etl/core/enums';
import { ErrorReport } from '../file-generator/error-report';
import { ReadLineInterface, readLineInterface, ReadLineInterfaceType } from '../util/readline-interface-factory';
import { DatascanItemMaster } from '../file-generator/datascan-item-master';
import lineModelFactory, { ItemMasterLineModel } from '../util/line-model-factory';
import { ETLType } from '../util/etl-factory';
import { ETLResult, JSONObject, ItemMasterERPSource, ItemMasterETLLineModel, ItemMasterIdentifier } from '@utils/types';

export type DatascanItemMasterETLOptions = {
  fileType: AzureBlobContainers;
} & ({ blobURL: string; file?: never } | { file: string; blobURL?: never });

export class DatascanItemMasterETL {
  errorReportWriter: ErrorReport;
  outputFileWriter: DatascanItemMaster;
  lineReader: ReadLineInterface;

  fileSource: string;
  fileType: ItemMasterERPSource;
  valid: boolean = true;
  lineIndex = 0;
  sampleLineData?: JSONObject;
  identifiers?: ItemMasterIdentifier;

  constructor(args: DatascanItemMasterETLOptions) {
    this.fileSource = args.blobURL ?? (args.file as string);
    this.fileType = args.fileType as ItemMasterERPSource;

    this.lineReader = this.initiateReadlineInterface(args.blobURL);
    this.errorReportWriter = this.initiateErrorReportWriter();
    this.outputFileWriter = new DatascanItemMaster();
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
      const lineModel = ItemMasterLineModel[this.fileType];
      this.populate(new lineModel(chunk, { currentLineNumber: this.lineIndex, fileSource: this.fileSource }));
    } catch (error) {
      this.lineReader.readlineInterface?.emit('error', error);
    }
  }

  onCloseHandler(resolve: Function) {
    resolve({});
  }

  populate(line: ItemMasterETLLineModel) {
    line.validate();

    // Populate error report.
    if (!line.isValid) {
      this.errorReportWriter.push(line.error);
    }

    // Populate output file only if valid row and if current line is not header
    if (line.isValid && !line.isHeader) {
      this.outputFileWriter.push(line.output);
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

  setIdentifier(identifiers: ItemMasterIdentifier) {
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
    // Validation to check if file is empty or not
    if (!this.sampleLineData || !this.identifiers) {
      this.valid = false;
      this.errorReportWriter.push('Unable to get data. File content is empty or all rows are invalid');
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
      destinationContainer: AzureBlobContainers.DATASCAN_ITEM_MASTER,
      fileType: ETLType.ITEM_MASTER,
      metadata: { ...this.sampleLineData, ...this.identifiers },
    };
  }

  async process(): Promise<ETLResult | never> {
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
