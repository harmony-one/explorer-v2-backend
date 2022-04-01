import {withCache} from 'src/api/controllers/cache'
import nodeFetch from 'node-fetch'

const MetricsApiUrl = 'https://api.flipsidecrypto.com'
const TxsCountUrl = `${MetricsApiUrl}/api/v2/queries/fd762b43-f90d-4585-b46c-3c9e81dfb1b0/data/latest`
const WalletsCountUrl = `${MetricsApiUrl}/api/v2/queries/dc2ff1de-ae3b-4f37-aa0a-ddc690aede4e/data/latest`

/*
 * How to get metrics url
 * 1) Go to query editor:
 *  - https://app.flipsidecrypto.com/velocity/queries/fd762b43-f90d-4585-b46c-3c9e81dfb1b0 (txs count)
 *  - https://app.flipsidecrypto.com/velocity/queries/dc2ff1de-ae3b-4f37-aa0a-ddc690aede4e (wallets count)
 *  - or create your own collection
 * 2) Change query, run it, check result
 * 3) Click on "API" button to get actual query URL
 *
 * Queries created by Metrics DAO: https://harmony-transactions.vercel.app/
 * */

const timeout = () =>
  new Promise((resolve, reject) =>
    setTimeout(() => reject(new Error('Connection timeout')), 120000)
  )
const fetch = (url: string) => nodeFetch(url).then((r) => r.json())

const getMetricsDAOTxsCount = async () => {
  const items: Array<{COUNT: number; DATE: string}> = await fetch(TxsCountUrl)
  return items
    .map(({DATE, COUNT}) => {
      return {
        timestamp: DATE.slice(0, 10),
        count: COUNT.toString(),
      }
    })
    .reverse()
}

const getMetricsDAOWalletsCount = async () => {
  const items: Array<{ACTIVE_WALLETS: number; DATE: string}> = await fetch(WalletsCountUrl)
  return items
    .map(({DATE, ACTIVE_WALLETS}) => {
      return {
        date: DATE.slice(0, 10),
        count: ACTIVE_WALLETS.toString(),
      }
    })
    .reverse()
}

export async function getTransactionCountLast14Days(): Promise<any | null> {
  return await withCache(
    ['getTransactionCountLast14Days', arguments],
    // () => stores[0].metrics.getTransactionCountLast14Days(),
    () => Promise.race([getMetricsDAOTxsCount(), timeout()]),
    1000 * 60 * 60 * 1
  )
}

export async function getWalletsCountLast14Days(): Promise<any> {
  const count = await withCache(
    ['getWalletsCountLast14Days'],
    // () => stores[0].metrics.getWalletsCountLast14Days(),
    () => Promise.race([getMetricsDAOWalletsCount(), timeout()]),
    1000 * 60 * 60 * 1
  )

  return count
}
