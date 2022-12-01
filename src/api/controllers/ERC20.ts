import {storesAPI as stores} from 'src/store'
import {InternalTransaction, ShardID, IERC20, IERC20Balance, Address} from 'src/types/blockchain'
import {withCache} from 'src/api/controllers/cache'
import {validator} from 'src/utils/validators/validators'
import {isAddress, isShard, isOffset, isLimit} from 'src/utils/validators'

export async function getAllERC20(shardID: ShardID): Promise<IERC20[] | null> {
  validator({
    shardID: isShard(shardID),
  })

  return await withCache(
    [shardID, 'getAllERC20', arguments],
    () => stores[shardID].erc20.getAllERC20(),
    1000 * 60 * 60
  )
}

export async function getUserERC20Balances(
  shardID: ShardID,
  address: Address
): Promise<IERC20Balance[] | null> {
  validator({
    shardID: isShard(shardID),
    address: isAddress(address),
  })

  return await withCache(
    [shardID, 'getAllERC20', arguments],
    () => stores[shardID].erc20.getUserBalances(address),
    1000 * 60 * 60
  )
}

export async function getERC20TokenHolders(
  shardID: ShardID,
  address: Address,
  limit = 100,
  offset = 0
): Promise<IERC20Balance[] | null> {
  validator({
    shardID: isShard(shardID),
    address: isAddress(address),
    offset: isOffset(offset),
    limit: isLimit(limit),
  })

  return await withCache(
    [shardID, 'getERC20TokenHolders', arguments],
    () => stores[shardID].erc20.getHolders(address, limit, offset),
    1000 * 60 * 60
  )
}
