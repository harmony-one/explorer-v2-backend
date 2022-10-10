// Etherscan-compatible api controller

import {withCache} from 'src/api/controllers/cache'
import {transport} from 'src/indexer/rpc/transport'

export enum ProxyActions {
  ethGasPrice = 'eth_gasPrice',
}

export async function getGasPrice() {
  return await withCache(
    ['getGasPrice', arguments],
    async () => {
      const data = await transport(0, 'hmy_gasPrice', [])
      return data
    },
    1000 * 60
  )
}
