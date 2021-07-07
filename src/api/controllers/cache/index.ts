import LRU from 'lru-cache'
import {config} from 'src/config'
import {logger} from 'src/logger'
const l = logger(module, 'cache')

const options = {
  max: 1000 * 100,
  maxAge: 1000 * 60 * 60 * 24 * 7,
}

const pruneCheckIntervalMs = 2000

export const cache = new LRU(options)

export const withCache = async (keys: any[], f: Function, maxAge?: number) => {
  if (!config.api.isCacheEnabled) {
    return f()
  }

  const key = JSON.stringify(keys)
  const cachedRes = cache.get(key)
  if (cachedRes) {
    return cachedRes
  }

  const res = await f()

  // don't cache empty arrays
  if ((!Array.isArray(res) && res) || (Array.isArray(res) && res.length)) {
    cache.set(key, res, maxAge)
  }

  return res
}

const prune = () => {
  cache.prune()
  setTimeout(prune, pruneCheckIntervalMs)
}

if (config.api.isCacheEnabled) {
  l.info('LRU cache enabled')
  prune()
} else {
  l.debug('LRU cache disabled')
}
