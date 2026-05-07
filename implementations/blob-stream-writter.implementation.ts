import { BlobServiceClient } from '@azure/storage-blob';
import { createInterface } from 'readline';
import { PassThrough } from 'stream';

const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

async function transformPipeline() {
  const containerClient = blobServiceClient.getContainerClient('my-container');

  // Step 1: Download from Azure Blob as stream
  const downloadBlobClient = containerClient.getBlobClient('input/data.csv');
  const downloadResponse = await downloadBlobClient.download();
  const downloadStream = downloadResponse.readableStreamBody;

  // Step 2: readline reads line by line
  const rl = createInterface({
    input: downloadStream,
    crlfDelay: Infinity,
  });

  // Bridge between readline output → upload input
  const passThrough = new PassThrough();

  // Step 3: Upload transformed stream to Azure Blob
  const uploadBlobClient = containerClient.getBlockBlobClient('output/transformed.csv');
  const uploadPromise = uploadBlobClient.uploadStream(
    passThrough,
    4 * 1024 * 1024, // 4MB buffer size
    20, // concurrency
    { blobHTTPHeaders: { blobContentType: 'text/csv' } },
  );

  // Wire readline → transform → passThrough
  let isFirstLine = true;
  rl.on('line', (line) => {
    const transformed = transformLine(line, isFirstLine);
    isFirstLine = false;
    passThrough.write(transformed + '\n');
  });

  rl.on('close', () => {
    passThrough.end(); // ✅ Signal upload that stream is done
  });

  rl.on('error', (err) => {
    passThrough.destroy(err);
  });

  await uploadPromise;
  console.log('Pipeline complete!');
}
