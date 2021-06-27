import {config} from 'src/config'
import {ShardID} from 'src/types/blockchain'

// todo drop stats
const safeIncrement = (num: number) => {
  if (num + 1 >= Number.MAX_SAFE_INTEGER) {
    return 0
  }

  return num + 1
}

export class RPCUrls {
  responseTime = 0.1
  failedRequests = 0
  url = ''
  queriesCount = 0
  totalQueries = 0

  constructor(url: string) {
    this.url = url
  }

  submitStatistic = (responseTime: number, isFailed = false) => {
    this.queriesCount--
    this.responseTime = (this.responseTime + responseTime) / 2

    if (isFailed) {
      this.failedRequests = safeIncrement(this.failedRequests)
    }
  }

  // naive way to select the best rpc url
  static getURL = (shardID: ShardID) => {
    const shardUrls = urls[shardID]

    if (shardUrls.length === 1) {
      return shardUrls[0]
    }

    const best = shardUrls.sort(
      (a, b) =>
        a.responseTime +
        a.queriesCount * 2 -
        (b.responseTime + b.queriesCount * 2) -
        (b.failedRequests - a.failedRequests) * 10
    )[0]

    best.queriesCount = safeIncrement(best.queriesCount)
    best.totalQueries = safeIncrement(best.totalQueries)

    return best
  }

  static getFailedCount = (shardID: ShardID) => {
    const shardUrls = urls[shardID]
    return shardUrls.reduce((a, b) => a + b.failedRequests, 0)
  }
}

// @ts-ignore
export const urls = config.indexer.rpc.urls.map((shardUrls) =>
  shardUrls.map((url) => new RPCUrls(url))
)
