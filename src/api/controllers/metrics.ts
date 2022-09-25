import {withCache} from 'src/api/controllers/cache'
import nodeFetch from 'node-fetch'
import {stores} from 'src/store'

const DefaultLimit = 14

export async function getTransactionCountLast14Days(limit = DefaultLimit): Promise<any | null> {
  return await withCache(
    ['getTransactionCountLast14Days', arguments],
    () => stores[0].metrics.getTransactionCount(limit),
    // () => Promise.race([getTxsCount(), timeout()]),
    1000 * 60 * 60 * 1
  )
}

export async function getWalletsCountLast14Days(limit = DefaultLimit): Promise<any> {
  const count = await withCache(
    ['getWalletsCountLast14Days', arguments],
    () => stores[0].metrics.getWalletsCount(limit),
    // () => Promise.race([getWalletsCount(), timeout()]),
    1000 * 60 * 60 * 1
  )

  return count
}
