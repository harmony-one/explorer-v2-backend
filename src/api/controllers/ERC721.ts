import {storesAPI as stores} from 'src/store'
import {InternalTransaction, ShardID, IERC20, IERC20Balance, Address} from 'src/types/blockchain'
import {withCache} from 'src/api/controllers/cache'
import {validator} from 'src/utils/validators/validators'
import {isAddress, isLimit, isOffset, isShard} from 'src/utils/validators'

export async function getAllERC721(shardID: ShardID): Promise<IERC20[] | null> {
  validator({
    shardID: isShard(shardID),
  })

  return await withCache(
    [shardID, 'getAllERC721', arguments],
    () => stores[shardID].erc721.getAllERC721(),
    1000 * 60 * 60
  )
}

export async function getUserERC721Assets(
  shardID: ShardID,
  address: Address
): Promise<IERC20Balance[] | null> {
  validator({
    shardID: isShard(shardID),
    address: isAddress(address),
  })

  return await withCache(
    [shardID, 'getUserERC721Assets', arguments],
    () => stores[shardID].erc721.getUserAssets(address),
    1000 * 60 * 60
  )
}

export async function getTokenERC721Assets(
  shardID: ShardID,
  address: Address,
  offset = 0,
  limit = 10000
): Promise<IERC20Balance[] | null> {
  validator({
    shardID: isShard(shardID),
    address: isAddress(address),
    offset: isOffset(offset),
    limit: isLimit(limit, 10000),
  })

  return await withCache(
    [shardID, 'getTokenERC721Assets', arguments],
    () => stores[shardID].erc721.getTokenAssets(address, offset, limit),
    1000 * 60 * 10
  )
}

export async function getTokenERC721AssetDetails(
  shardID: ShardID,
  address: Address,
  tokenID: string
): Promise<IERC20Balance[] | null> {
  validator({
    shardID: isShard(shardID),
    address: isAddress(address),
  })

  return await withCache(
    [shardID, 'getTokenERC721AssetDetails', arguments],
    () => stores[shardID].erc721.getTokenAssetDetails(address, tokenID),
    1000 * 60 * 10
  )
}
