import {withCache} from 'src/api/controllers/cache'
import {storesAPI as stores} from 'src/store'

export async function getTransactionCountLast14Days(): Promise<any | null> {
  return await withCache(
    ['getTransactionCountLast14Days', arguments],
    () => stores[0].metrics.getTransactionCountLast14Days(),
    1000 * 60 * 60 * 24
  )
}

export async function getWalletsCountLast14Days(): Promise<any> {
  const count = await withCache(
    ['getWalletsCountLast14Days'],
    () => stores[0].metrics.getWalletsCountLast14Days(),
    1000 * 60 * 60 * 1
  )

  return count
}
