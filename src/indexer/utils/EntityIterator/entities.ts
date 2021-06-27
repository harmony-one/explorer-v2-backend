import {
  Address2Transaction,
  Contract,
  IERC20,
  IERC20Balance,
  IERC721,
  IERC1155,
  InternalTransaction,
  Log,
} from 'src/types'
import {listByBlockNumber, EntityQueryCallback, listByOffset, withEqual} from './executors'
import {stores} from 'src/store'

export type ContractIndexerTaskEntities = 'erc20' | 'erc721' | 'erc1155'
export type EntityIteratorEntities =
  | 'contracts'
  | 'internalTransactions'
  | 'logs'
  | 'logsAll'
  | 'erc20BalancesNeedUpdate'
  | ContractIndexerTaskEntities

// only shard #0
const store = stores[0]

export const entityQueries: Record<EntityIteratorEntities, EntityQueryCallback> = {
  logs: listByBlockNumber<Log>(store.log.getLogs, [withEqual('address')]),
  logsAll: listByBlockNumber<Log>(store.log.getLogs),
  internalTransactions: listByBlockNumber<InternalTransaction>(
    store.internalTransaction.getInternalTransactions
  ),
  contracts: listByBlockNumber<Contract>(store.contract.getContracts),
  erc20: listByOffset<IERC20>(store.erc20.getERC20),
  erc721: listByOffset<IERC721>(store.erc721.getERC721),
  erc1155: listByOffset<IERC1155>(store.erc1155.getERC1155),
  erc20BalancesNeedUpdate: listByOffset<IERC20Balance>(store.erc20.getBalances, [
    withEqual('needUpdate'),
  ]),
}
