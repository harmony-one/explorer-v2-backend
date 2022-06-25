import {storesAPI as stores} from 'src/store'
import {InternalTransaction, ShardID, IERC20, IERC20Balance, Address} from 'src/types/blockchain'
import {withCache} from 'src/api/controllers/cache'
import {validator} from 'src/utils/validators/validators'
import {isAddress, isShard} from 'src/utils/validators'

export async function getAllERC721(): Promise<IERC20[] | null> {
  return await withCache(
    ['getAllERC721', arguments],
    () => stores[0].erc721.getAllERC721(),
    1000 * 60 * 5
  )
}

export async function getUserERC721Assets(address: Address): Promise<IERC20Balance[] | null> {
  validator({
    address: isAddress(address),
  })

  return await withCache(
    ['getUserERC721Assets', arguments],
    () => stores[0].erc721.getUserAssets(address),
    1000 * 2
  )
}

export async function getTokenERC721Assets(address: Address): Promise<IERC20Balance[] | null> {
  validator({
    address: isAddress(address),
  })

  return await withCache(
    ['getTokenERC721Assets', arguments],
    () => stores[0].erc721.getTokenAssets(address),
    1000 * 2
  )
}
