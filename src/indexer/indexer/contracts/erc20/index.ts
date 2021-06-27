import {ContractTracker} from 'src/indexer/indexer/contracts/types'
import {BlockNumber, IERC20} from 'src/types'
import {onFinish} from './onFinish'
import {addContract} from './addContract'
import {trackEvents} from './trackEvents'
import {PostgresStorage} from 'src/store/postgres'

export const ERC20Indexer: ContractTracker<IERC20> = {
  name: 'erc20',
  addContract: {
    process: addContract,
    batchSize: 10,
  },
  trackEvents: {
    process: trackEvents,
    getLastSyncedBlock: (store: PostgresStorage, token) =>
      store.erc20.getERC20LastSyncedBlock(token.address),
    setLastSyncedBlock: (store: PostgresStorage, token, blockNumber: BlockNumber) =>
      store.erc20.setERC20LastSyncedBlock(token.address, blockNumber),
    batchSize: 10000,
  },
  onFinish,
}
