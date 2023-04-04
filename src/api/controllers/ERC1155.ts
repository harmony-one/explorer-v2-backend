import {storesAPI as stores} from 'src/store'
import {InternalTransaction, ShardID, IERC1155, IERC20Balance, Address} from 'src/types/blockchain'
import {withCache} from 'src/api/controllers/cache'
import {validator} from 'src/utils/validators/validators'
import {isAddress, isLimit, isOffset, isShard} from 'src/utils/validators'

export async function getAllERC1155(shardID: ShardID): Promise<IERC1155[] | null> {
  validator({
    shardID: isShard(shardID),
  })

  return await withCache(
    [shardID, 'getAllERC1155', arguments],
    () => stores[shardID].erc1155.getAllERC1155(),
    1000 * 60 * 60
  )
}

export async function getUserERC1155Balances(
  shardID: ShardID,
  address: Address
): Promise<IERC20Balance[] | null> {
  validator({
    address: isAddress(address),
    shardID: isShard(shardID),
  })

  return await withCache(
    [shardID, 'getUserERC1155Balances', arguments],
    () => stores[shardID].erc1155.getUserBalances(address),
    1000 * 60 * 10
  )
}

export async function getTokenERC1155Balances(
  shardID: ShardID,
  address: Address
): Promise<IERC20Balance[] | null> {
  validator({
    shardID: isShard(shardID),
    address: isAddress(address),
  })

  return await withCache(
    [shardID, 'getTokenERC1155Balances', arguments],
    () => stores[shardID].erc1155.getTokenBalances(address),
    1000 * 60 * 10
  )
}

export async function getTokenERC1155Assets(
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
    [shardID, 'getTokenERC1155Assets', arguments],
    () => stores[shardID].erc1155.getTokenAssets(address, offset, limit),
    1000 * 30
  )
}

export async function getTokenERC1155AssetDetails(
  shardID: ShardID,
  address: Address,
  tokenID: string
): Promise<IERC20Balance[] | null> {
  validator({
    shardID: isShard(shardID),
    address: isAddress(address),
  })

  return await withCache(
    [shardID, 'getTokenERC1155Assets', arguments],
    () => stores[shardID].erc1155.getTokenAssetDetails(address, tokenID),
    1000 * 10
  )
}
