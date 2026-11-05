import { readFile, writeFile } from 'node:fs/promises'

// Keep catalog metadata in sync with the publisher's canonical release feed.
const source = await readFile(new URL('../../docs/pad.xml', import.meta.url), 'utf8')
const selfUrls = source.match(/<Application_XML_File_URL>[^<]*<\/Application_XML_File_URL>/g)
if (selfUrls?.length !== 1) {
  throw new Error('PAD feed must contain exactly one self URL')
}

const published = source.replace(
  selfUrls[0],
  '<Application_XML_File_URL>https://pctweaker.app/pad.xml</Application_XML_File_URL>',
)
await writeFile(new URL('../dist/pad.xml', import.meta.url), published, 'utf8')
