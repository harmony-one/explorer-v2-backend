import {ABIManager} from 'src/indexer/indexer/contracts/utils/ABIManager'
import ERC1155ABI from 'src/indexer/indexer/contracts/erc1155/ERC1155ABI.json'
import {IABI} from 'src/indexer/indexer/contracts/types'
import {ShardID} from 'src/types'

export const ABIFactory = (shardID: ShardID) => ABIManager(shardID, ERC1155ABI as IABI)
