declare const config: {
    line: {
        columns: string[];
        mandatoryFields: never[];
        identifierMappings: {};
        outputMappings: {
            'root.TaskID': string;
            'root.Status': string;
            'Lines[].Date': string;
            'Lines[].Quantity': string;
            'Lines[].SKU': string;
            'Lines[].Location': string;
            'Lines[].Received': string;
        };
        separator: string;
        withHeader: boolean;
    };
    output: {
        filename: {
            template: string;
        };
        template: string;
        header: string;
        separator: string;
        arrayField: string;
        dataset_type: string;
        fileGenerator: string;
    };
};
export default config;
