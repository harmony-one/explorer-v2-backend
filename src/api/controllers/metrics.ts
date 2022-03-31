import {withCache} from 'src/api/controllers/cache'
import nodeFetch from 'node-fetch'

const MetricsApiUrl = 'https://api.flipsidecrypto.com'

const timeout = () =>
  new Promise((resolve, reject) => setTimeout(() => reject(new Error('Connection timeout')), 20000))
const fetch = (url: string) => nodeFetch(url).then((r) => r.json())

const getMetricsDAOTxsCount = async (daysCount = 14) => {
  const items: Array<{COUNT: string; DATE: string}> = await fetch(
    `${MetricsApiUrl}/api/v2/queries/8b1f7226-995c-4091-acc6-84a7f70b9833/data/latest`
  )
  return items
    .map(({DATE, COUNT}) => {
      return {
        timestamp: DATE.slice(0, 10),
        count: COUNT.toString(),
      }
    })
    .slice(-(daysCount + 1))
}

const getMetricsDAOWalletsCount = async (daysCount = 14) => {
  const items: Array<{ACTIVE_WALLETS: string; DATE: string}> = await fetch(
    `${MetricsApiUrl}/api/v2/queries/532a5af5-7dc5-4446-be20-ff83a5f32d45/data/latest`
  )
  return items
    .map(({DATE, ACTIVE_WALLETS}) => {
      return {
        date: DATE.slice(0, 10),
        count: ACTIVE_WALLETS.toString(),
      }
    })
    .slice(-(daysCount + 1))
}

export async function getTransactionCountLast14Days(): Promise<any | null> {
  return await withCache(
    ['getTransactionCountLast14Days', arguments],
    // () => stores[0].metrics.getTransactionCountLast14Days(),
    () => Promise.race([getMetricsDAOTxsCount(14), timeout()]),
    1000 * 60 * 60 * 1
  )
}

export async function getWalletsCountLast14Days(): Promise<any> {
  const count = await withCache(
    ['getWalletsCountLast14Days'],
    // () => stores[0].metrics.getWalletsCountLast14Days(),
    () => Promise.race([getMetricsDAOWalletsCount(14), timeout()]),
    1000 * 60 * 60 * 1
  )

  return count
}
