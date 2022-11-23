import {PostgresStorage} from 'src/store/postgres'
import {ABIFactory} from 'src/indexer/indexer/contracts/erc721/ABI'
import {logger} from 'src/logger'
import {Address, Filter, IERC20, IERC721TokenID} from 'src/types'
import nodeFetch from 'node-fetch'
import {normalizeAddress} from 'src/utils/normalizeAddress'

const l = logger(module, 'erc721:assets')

const filter: Filter = {
  limit: 10,
  offset: 0,
  filters: [
    {
      property: 'needUpdate',
      type: 'eq',
      value: 'true',
    },
  ],
}
// update balances
export const onFinish = async (store: PostgresStorage) => {
  const {call} = ABIFactory(store.shardID)

  l.info(`Updating assets`)
  let count = 0
  const tokensForUpdate = new Set<Address>()

  // since we update entries, iterator doesnt work
  while (true) {
    const assetsNeedUpdate = await store.erc721.getAssets(filter)
    if (!assetsNeedUpdate.length) {
      break
    }

    const promises = assetsNeedUpdate.map(async ({tokenAddress, tokenID, meta: metaData}) => {
      tokensForUpdate.add(tokenAddress)

      // todo dont fetch uri if already there
      const uri = await call('tokenURI', [tokenID], tokenAddress)

      const owner = await call('ownerOf', [tokenID], tokenAddress).then(normalizeAddress)
      let meta = {} as any

      // dont fetch meta if already there
      if (!metaData || Object.keys(metaData).length == 0) {
        try {
          // todo validate size
          meta = await nodeFetch(uri).then((r) => r.json())
        } catch (e) {
          // l.warn(`Failed to fetch meta from ${uri} for token ${tokenAddress} ${tokenID}`)
        }
      } else {
        // meta already there
      }

      return store.erc721.updateAsset(owner!, tokenAddress, uri, meta, tokenID as IERC721TokenID)
    })
    await Promise.all(promises)
    count += assetsNeedUpdate.length
  }

  const promises = [...tokensForUpdate.values()].map(async (token) => {
    const holders = await store.erc721.getHoldersCount(token)
    const totalSupply = await call('totalSupply', [], token)
    // todo tx count ?

    const erc721 = {
      holders: +holders || 0,
      totalSupply: totalSupply,
      transactionCount: 0,
      address: token,
    }

    // @ts-ignore
    return store.erc721.updateERC721(erc721)
  })

  await Promise.all(promises)

  l.info(`Updated ${count} assets`)
}
