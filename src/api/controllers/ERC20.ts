import {storesAPI as stores} from 'src/store'
import {InternalTransaction, ShardID, IERC20, IERC20Balance, Address} from 'src/types/blockchain'
import {withCache} from 'src/api/controllers/cache'
import {validator} from 'src/utils/validators/validators'
import {isAddress, isShard} from 'src/utils/validators'

export async function getAllERC20(): Promise<IERC20[] | null> {
  return await withCache(
    ['getAllERC20', arguments],
    () => stores[0].erc20.getAllERC20(),
    1000 * 60 * 5
  )
}

export async function getUserERC20Balances(address: Address): Promise<IERC20Balance[] | null> {
  validator({
    address: isAddress(address),
  })

  return await withCache(
    ['getAllERC20', arguments],
    () => stores[0].erc20.getUserBalances(address),
    1000 * 60 * 5
  )
}
