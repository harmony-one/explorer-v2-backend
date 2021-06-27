import {withCache} from 'src/api/controllers/cache'
import {storesAPI as stores} from 'src/store'

export async function getTransactionCountLast14Days(): Promise<any | null> {
  return await withCache(
    ['getTransactionCountLast14Days', arguments],
    () => stores[0].metrics.getTransactionCountLast14Days(),
    1000 * 60 * 60 * 24
  )
}
