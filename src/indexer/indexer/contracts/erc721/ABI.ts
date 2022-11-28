import {ABIManager} from 'src/indexer/indexer/contracts/utils/ABIManager'
import ERC721ABI from 'src/indexer/indexer/contracts/erc721/ERC721ABI.json'
import {IABI} from 'src/indexer/indexer/contracts/types'
import {ShardID} from 'src/types'

export const ABIFactory = (shardID: ShardID) => ABIManager(shardID, ERC721ABI as IABI)
