/*
https://www.4byte.directory/api/v1/signatures/
download method and events signatures rainbow table
*/

import nodeFetch from 'node-fetch'
import {stores} from 'src/store'
import {BytecodeSignature} from 'src/types'
import {logger} from 'src/logger'

const l = logger(module)
// store ad shard 0
const store = stores[0]

export const run = async () => {
  l.info('fetching 4byte signatures...')
  // events
  await getSignatures('https://www.4byte.directory/api/v1/event-signatures')
  // methods
  await getSignatures('https://www.4byte.directory/api/v1/signatures')
}

const getSignatures = async (url: string) => {
  const exec = async (url: string): Promise<any> => {
    const res = await nodeFetch(url).then((r) => r.json())
    l.info(`Fetched ${res.results.length} records from ${url}`)

    const promises = res.results
      .map((e: any) => {
        return {
          hash: e.hex_signature,
          signature: e.text_signature,
        }
      })
      .map((e: BytecodeSignature) => store.signature.addSignatures(e))

    await Promise.all(promises)

    if (!res.next) {
      l.info(`Done`)
      return
    }

    return exec(res.next as string)
  }

  return exec(url)
}
