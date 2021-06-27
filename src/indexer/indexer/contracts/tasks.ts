import {ContractTracker} from 'src/indexer/indexer/contracts/types'
import {ERC20Indexer} from 'src/indexer/indexer/contracts/erc20'
import {ERC721Indexer} from 'src/indexer/indexer/contracts/erc721'
import {ERC1155Indexer} from 'src/indexer/indexer/contracts/erc1155'

import {config} from 'src/config'
export const tasks: ContractTracker<any>[] = [
  ERC20Indexer,
  ERC721Indexer,
  ERC1155Indexer,
].filter(({name}) => config.indexer.trackContractTypes.includes(name))
