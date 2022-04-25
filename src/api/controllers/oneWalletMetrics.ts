import {storesAPI as stores} from 'src/store'
import {Address} from 'src/types/blockchain'
import {withCache} from 'src/api/controllers/cache'
import nodeFetch from 'node-fetch'

export async function oneWalletGetMetrics(): Promise<any> {
  const {count, totalAmount} = await withCache(
    ['oneWalletGetBalances'],
    () => stores[0].oneWalletMetrics.getMetrics(),
    1000 * 60 * 60,
    false
  )

  return {
    count,
    totalAmount,
  }
}
