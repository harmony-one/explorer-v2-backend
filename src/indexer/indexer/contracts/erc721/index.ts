import {ContractTracker} from 'src/indexer/indexer/contracts/types'
import {BlockNumber, IERC721} from 'src/types'
import {onFinish} from './onFinish'
import {addContract} from './addContract'
import {trackEvents} from './trackEvents'
import {PostgresStorage} from 'src/store/postgres'

export const ERC721Indexer: ContractTracker<IERC721> = {
  name: 'erc721',
  addContract: {
    process: addContract,
    batchSize: 10,
  },
  trackEvents: {
    process: trackEvents,
    getLastSyncedBlock: (store: PostgresStorage, token) =>
      store.erc721.getERC721LastSyncedBlock(token.address),
    setLastSyncedBlock: (store: PostgresStorage, token, blockNumber: BlockNumber) =>
      store.erc721.setERC721LastSyncedBlock(token.address, blockNumber),
    batchSize: 10000,
  },
  onFinish,
}
