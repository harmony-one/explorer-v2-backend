import {ABIManager} from 'src/indexer/indexer/contracts/utils/ABIManager'
import ERC721ABI from 'src/indexer/indexer/contracts/erc721/ERC721ABI.json'
import {IABI} from 'src/indexer/indexer/contracts/types'

export const ABI = ABIManager(ERC721ABI as IABI)
