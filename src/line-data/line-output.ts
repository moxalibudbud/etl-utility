/**
 * TODO list
 *
 * Filename = Instead of passing a function. We can pass an object options and perform the condition based on given options.
 * Examples:
 * If filname.name exist. Means client wants to use fix filename.
 * if filename.template exist. Then client wants a custom filename. If yes, following option must be pass
 * Sample template = `Item Master - {[timestamp]}` = this means [timestamp] is a built in function that generate timestamp
 * Sample template = `Item Master - {[LINE_OBJECT.output.sku]}` = this means LINE_OBJECT.output.sku is a built in function that fetch data from line source class
 */
type LineOutputBase = {
  filename: string | ((args: any) => string);
  separator: string;
  header?: string | ((args: any) => string);
  footer?: string | ((args: any) => string);
  template?: string;
};

export type LineOutputOptions = LineOutputBase;
