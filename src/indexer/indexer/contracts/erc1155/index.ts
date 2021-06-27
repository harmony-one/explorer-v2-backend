import {ContractTracker} from 'src/indexer/indexer/contracts/types'
import {BlockNumber, IERC721} from 'src/types'
import {onFinish} from './onFinish'
import {addContract} from './addContract'
import {trackEvents} from './trackEvents'
import {PostgresStorage} from 'src/store/postgres'

export const ERC1155Indexer: ContractTracker<IERC721> = {
  name: 'erc1155',
  addContract: {
    process: addContract,
    batchSize: 10,
  },
  trackEvents: {
    process: trackEvents,
    getLastSyncedBlock: (store: PostgresStorage, token) =>
      store.erc1155.getERC1155LastSyncedBlock(token.address),
    setLastSyncedBlock: async (store: PostgresStorage, token, blockNumber: BlockNumber) =>
      store.erc1155.setERC1155LastSyncedBlock(token.address, blockNumber),
    batchSize: 10000,
  },
  onFinish,
}
