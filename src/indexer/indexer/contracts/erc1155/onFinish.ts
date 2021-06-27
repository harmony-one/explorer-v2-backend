import {PostgresStorage} from 'src/store/postgres'
import {ABI} from 'src/indexer/indexer/contracts/erc1155/ABI'
import {logger} from 'src/logger'
import {Address, Filter, IERC20, IERC721TokenID} from 'src/types'
import nodeFetch from 'node-fetch'
import {normalizeAddress} from 'src/utils/normalizeAddress'
import {getByIPFSHash} from 'src/indexer/utils/ipfs/index'

const l = logger(module, 'erc1155:assets')
const {call} = ABI

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
export const updateAssets = async (store: PostgresStorage) => {
  l.info(`Updating assets`)
  let count = 0
  const tokensForUpdate = new Set<Address>()

  // since we update entries, iterator doesnt work
  while (true) {
    const assetsNeedUpdate = await store.erc1155.getAssets(filter)
    if (!assetsNeedUpdate.length) {
      break
    }
    l.info(`Updating ${assetsNeedUpdate.length} assets`)

    const promises = assetsNeedUpdate.map(
      async ({meta: metaData, tokenAddress, tokenID, tokenURI = ''}) => {
        // todo dont fetch meta if already there
        // @ts-ignore
        if (metaData && metaData.name) {
          // todo tmp line
          await store.erc1155.updateAsset(
            tokenAddress,
            tokenURI,
            metaData,
            tokenID as IERC721TokenID
          )
          return
        }

        tokensForUpdate.add(tokenAddress)

        const uri = await call('uri', [tokenID], tokenAddress)
        let meta = {} as any

        try {
          // todo validate size
          meta = await getByIPFSHash(uri)
        } catch (e) {
          l.debug(`Failed to fetch meta from ${uri} for token ${tokenAddress} ${tokenID}`)
        }

        await store.erc1155.updateAsset(tokenAddress, uri, meta, tokenID as IERC721TokenID)
      }
    )
    await Promise.all(promises)
    count += assetsNeedUpdate.length
  }

  const promises = [...tokensForUpdate.values()].map(async (token) => {
    const holders = await store.erc1155.getHoldersCount(token)

    // todo total supply
    const totalSupply = 0 // await call('totalSupply', [], token)
    // todo tx count ?

    const erc1155 = {
      holders: +holders || 0,
      totalSupply: totalSupply,
      transactionCount: 0,
      address: token,
    }

    // @ts-ignore
    return store.erc1155.updateERC1155(erc1155)
  })

  await Promise.all(promises)

  l.info(`Updated ${count} assets`)
}

export const updateBalances = async (store: PostgresStorage) => {
  l.info(`Updating balances`)
  const tokensForUpdate = new Set<Address>()
  let count = 0
  // since we update entries, iterator doesnt work
  while (true) {
    const assetsNeedUpdate = await store.erc1155.getBalances(filter)
    if (!assetsNeedUpdate.length) {
      break
    }

    // can be optimized if call a batch
    const promises = assetsNeedUpdate.map(async ({tokenAddress, tokenID, ownerAddress}) => {
      tokensForUpdate.add(tokenAddress)

      const [balance] = await call('balanceOfBatch', [[ownerAddress], [tokenID]], tokenAddress)
      count++
      return store.erc1155.updateBalance(
        tokenAddress,
        ownerAddress,
        tokenID as IERC721TokenID,
        balance
      )
    })
    await Promise.all(promises)
  }

  l.info(`Updated ${count} balances`)
}

export const onFinish = async (store: PostgresStorage) => {
  await updateAssets(store)
  await updateBalances(store)
}
