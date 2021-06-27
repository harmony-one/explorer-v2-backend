import {ABIManager} from 'src/indexer/indexer/contracts/utils/ABIManager'
import ERC20ABI from 'src/indexer/indexer/contracts/erc20/ERC20ABI.json'
import {IABI} from 'src/indexer/indexer/contracts/types'

export const ABI = ABIManager(ERC20ABI as IABI)
