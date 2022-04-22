import {storesAPI as stores} from 'src/store'
import {Address} from 'src/types/blockchain'
import {withCache} from 'src/api/controllers/cache'
import nodeFetch from 'node-fetch'

export async function oneWalletGetMetrics(): Promise<any> {
  const addressList = await withCache(
    ['oneWalletGetMetrics'],
    () => stores[0].oneWalletMetrics.getWallets(),
    1000 * 60 * 60 * 23,
    false
  )

  const count = addressList.length
  const totalAmount = await withCache(
    ['oneWalletGetBalances'],
    () => getTotalAmount(addressList),
    1000 * 60 * 60 * 23,
    false
  )

  return {
    count,
    totalAmount,
  }
}

const RPCURL = 'https://api.s0.t.hmny.io'
const getTotalAmount = async (addressList: Address[]) => {
  const fetchBalance = async (address: Address, retries = 5): Promise<string> => {
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
          return fetchBalance(address, retries - 1)
        }

        throw new Error(err)
      })
  }

  const balances = await Promise.all(addressList.map(fetchBalance))
  const totalAmount = balances.reduce((a, b) => (a += BigInt(b)), BigInt(0))

  return totalAmount.toString()
}
