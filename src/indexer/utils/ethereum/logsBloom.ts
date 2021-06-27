import * as RPCClient from 'src/indexer/rpc/client'
import {
  isBloom,
  isContractAddressInBloom,
  isInBloom,
  isTopic,
  isTopicInBloom,
  isUserEthereumAddressInBloom,
} from 'ethereum-bloom-filters'

const a = async () => {
  const block = await RPCClient.getBlockByNumber(0, 7951183)

  // @ts-ignore
  const bloom = block.block.logsBloom
  const topic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
  const address = '0xa144Bd3edaDFd4Dc09A4bdD8C255B63B620A5953'
  console.log({bloom, topic})

  console.log(
    isTopic(topic),
    isBloom(bloom),
    isTopicInBloom(bloom, topic),
    isUserEthereumAddressInBloom(bloom, address),
    isContractAddressInBloom(bloom, address)
  )
  console.log(isInBloom(bloom, topic))
}
