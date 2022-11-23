import {ABIManager} from 'src/indexer/indexer/contracts/utils/ABIManager'
import ERC20ABI from 'src/indexer/indexer/contracts/erc20/ERC20ABI.json'
import {IABI} from 'src/indexer/indexer/contracts/types'
import {ShardID} from 'src/types'

export const ABIFactory = (shardID: ShardID) => ABIManager(shardID, ERC20ABI as IABI)
