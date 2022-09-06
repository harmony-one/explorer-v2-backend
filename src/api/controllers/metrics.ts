import {withCache} from 'src/api/controllers/cache'
import nodeFetch from 'node-fetch'
import {stores} from 'src/store'

const NumberOfDays = 14

export async function getTransactionCountLast14Days(): Promise<any | null> {
  return await withCache(
    ['getTransactionCountLast14Days', arguments],
    () => stores[0].metrics.getTransactionCount(NumberOfDays),
    // () => Promise.race([getTxsCount(), timeout()]),
    1000 * 60 * 60 * 1
  )
}

export async function getWalletsCountLast14Days(): Promise<any> {
  const count = await withCache(
    ['getWalletsCountLast14Days'],
    () => stores[0].metrics.getWalletsCount(NumberOfDays),
    // () => Promise.race([getWalletsCount(), timeout()]),
    1000 * 60 * 60 * 1
  )

  return count
}
