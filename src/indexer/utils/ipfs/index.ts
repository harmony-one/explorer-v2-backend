import nodeFetch from 'node-fetch'
import {config} from 'src/config'
import AbortController from 'abort-controller'

const IPFSGateway = config.indexer.IPFSGateway

class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export const getByIPFSHash = async (hash: string, retries = 3) => {
  const hasProtocol = hash.indexOf('http') === 0
  const url = hasProtocol ? hash : `${IPFSGateway}${hash}`

  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, 10000)

  for (let i = 0; i < retries; i++) {
    try {
      const res = await nodeFetch(url, {signal: controller.signal})
      const data = await res.json()
      if (typeof data === 'object') {
        if (Object.keys(data).find((key) => key.includes('error'))) {
          throw new ValidationError(`${url}: wrong metadata format`)
        }
      }
      clearTimeout(timeout)
      return data
    } catch (e) {
      if (i + 1 >= retries || e.name === 'ValidationError') {
        throw new Error(e)
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
}
