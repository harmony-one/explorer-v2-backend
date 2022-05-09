import {logger} from 'src/logger'
import {stores} from 'src/store'
import {Address} from 'src/types'
import nodeFetch from 'node-fetch'

const l = logger(module)
const interval = 1000 * 60 * 60

const RPCURL = 'https://api.s0.t.hmny.io'

export const oneWalletIndexer = () => {
  l.info('One wallet balances indexer starting...')
  loop()
}

const fetchAddressBalance = async (address: Address, retries = 5): Promise<string> => {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'hmy_getBalance',
    params: [address, 'latest'],
  }

  const payload = {
    method: 'post',
    body: JSON.stringify(body),
    headers: {'Content-Type': 'application/json'},
  }

  return nodeFetch(RPCURL, payload)
    .then((r) => r.json())
    .then((r) => r.result)
    .catch(async (err) => {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return fetchAddressBalance(address, retries - 1)
      }
      throw new Error(err)
    })
}

const getTotalAmount = async (addressList: Address[]): Promise<BigInt> => {
  const balances = await Promise.all(addressList.map(fetchAddressBalance))
  return balances.reduce((a, b) => (a += BigInt(b)), BigInt(0))
}

const sleep = (timeout: number) => new Promise((resolve) => setTimeout(resolve, timeout))

const updateBalances = async () => {
  try {
    const store = stores[0].oneWalletMetrics
    const lastUpdateDaysDiff = await store.getMetricsLastUpdateDiff()
    l.info(
      `Previous update days diff: ${lastUpdateDaysDiff}${
        lastUpdateDaysDiff === 0 ? ', skip until next day' : ''
      }`
    )
    if (lastUpdateDaysDiff > 0) {
      const addressesCount = await store.getAddressesToUpdateCount()
      if (addressesCount > 0) {
        l.info(`Starting update oneWallet addresses balance, total count: "${addressesCount}"`)
        let totalBalance = BigInt(0)
        const chunkSize = 1000 // Number of address balances to be requested in single batch
        const timeStart = Date.now()
        for (let i = 0; i < addressesCount; i += chunkSize) {
          const addresses = await store.getAddressesToUpdate(i, chunkSize)
          const balance = await getTotalAmount(addresses)
          // @ts-ignore
          totalBalance += balance
          await sleep(1000)
        }
        await store.addMetrics(addressesCount, totalBalance.toString())
        l.info(
          `Updated oneWallet addresses count = "${addressesCount}"` +
            `, total balance = "${totalBalance}"` +
            `, elapsed time ${Math.round((Date.now() - timeStart) / 1000)}s`
        )
      }
    }
  } catch (e) {
    l.error('One wallet metrics update error:', e.message || e)
  }
}

const loop = async () => {
  await updateBalances()
  setTimeout(loop, interval)
}
