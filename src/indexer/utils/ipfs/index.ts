import nodeFetch from 'node-fetch'
import {config} from 'src/config'
import AbortController from 'abort-controller'

const IPFSGateway = config.indexer.IPFSGateway

export const getByIPFSHash = async (hash: string, retries = 3) => {
  const hasProtocol = hash.indexOf('http') === 0
  const url = hasProtocol ? hash : `${IPFSGateway}${hash}`

  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, 20000)

  try {
    return await nodeFetch(url, {signal: controller.signal})
      .then((r) => r.json())
      .finally(() => {
        clearTimeout(timeout)
      })
  } catch (e) {
    if (retries <= 0) {
      throw new Error(e)
    }

    setTimeout(() => getByIPFSHash(hash, retries - 1), 3000)
  }
}
