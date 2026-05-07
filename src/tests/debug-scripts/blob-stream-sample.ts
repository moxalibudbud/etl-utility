/**
 * Sample script to test AzureBlobStreamWriter and S3StreamWriter.
 *
 * Run with:
 *   npx ts-node -r tsconfig-paths/register src/tests/debug-scripts/blob-stream-sample.ts
 *
 * Required env vars for Azure:
 *   AZURE_BLOB_STORAGE_ACCOUNT_NAME
 *   AZURE_BLOB_STORAGE_ACCOUNT_KEY
 *
 * Required env vars for S3:
 *   AWS_REGION
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 */

import 'dotenv/config';
import { AzureBlobStreamWriter } from '../../file-generator/azure-blob-stream-writer';
import { S3StreamWriter } from '../../file-generator/s3-stream-writer';

const SAMPLE_ROWS = ['store|sku|units', '1001|ABC-001|10', '1001|ABC-002|5', '1002|ABC-001|8'];

// ─── Azure ────────────────────────────────────────────────────────────────────

async function testAzureUpload() {
  console.log('\n── Azure Blob upload ──');

  const writer = new AzureBlobStreamWriter({
    containerName: 'wip', // change to your container
    blobPrefix: 'debug-scripts', // optional virtual folder
  });

  writer.filename = 'blob-stream-sample.txt';
  writer.createStream();

  for (const row of SAMPLE_ROWS) {
    writer.writeStream!.write(row + '\n');
  }

  const result = await writer.end();
  console.log('Azure upload complete:', result);

  // Uncomment to test delete:
  // await writer.delete();
  // console.log('Azure blob deleted');
}

// ─── S3 ───────────────────────────────────────────────────────────────────────

async function testS3Upload() {
  console.log('\n── S3 upload ──');

  const writer = new S3StreamWriter({
    bucket: 'my-bucket', // change to your bucket
    keyPrefix: 'debug-scripts', // optional key prefix (virtual folder)
    // region, accessKeyId, secretAccessKey fall back to env vars
  });

  writer.filename = 'blob-stream-sample.txt';
  writer.createStream();

  for (const row of SAMPLE_ROWS) {
    writer.writeStream!.write(row + '\n');
  }

  const result = await writer.end();
  console.log('S3 upload complete:', result);

  // Uncomment to test delete:
  // await writer.delete();
  // console.log('S3 object deleted');
}

// ─── Run ──────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await testAzureUpload();
  } catch (err) {
    console.error('Azure test failed:', err);
  }

  try {
    await testS3Upload();
  } catch (err) {
    console.error('S3 test failed:', err);
  }
})();
