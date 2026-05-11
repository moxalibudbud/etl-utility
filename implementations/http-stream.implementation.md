In Node.js, use the stream-json package — it handles exactly this: streaming a large JSON object and picking out array elements one at a time.

Install:

npm install stream-json
Usage:

import https from 'https'
import { parser } from 'stream-json'
import { pick } from 'stream-json/filters/Pick.js'
import { streamArray } from 'stream-json/streamers/StreamArray.js'

https.get(url, (res) => {
res
.pipe(parser())
.pipe(pick({ filter: 'lines' })) // zoom into the "lines" key
.pipe(streamArray()) // emit one array element at a time
.on('data', ({ key, value }) => {
// value is one Line object, key is its index
console.log(value.sku, value.variance)
})
.on('end', () => console.log('done'))
.on('error', console.error)
})
What happens under the hood:

parser() tokenizes the JSON stream without buffering the whole body
pick({ filter: 'lines' }) skips all other top-level fields (name, state, etc.)
streamArray() emits each element of the array as it's fully parsed
This keeps memory flat regardless of whether lines has 100 or 100k entries — you're only holding one Line object in memory at a time.

If you're using fetch instead of https.get, you can get the body as a web ReadableStream and convert it with Readable.fromWeb(res.body) before piping.
