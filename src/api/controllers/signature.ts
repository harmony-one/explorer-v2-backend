import {stores} from 'src/store'
import {
  BytecodeSignature,
  BytecodeSignatureHash,
  InternalTransaction,
  ShardID,
  Transaction,
} from 'src/types/blockchain'
import {validator} from 'src/utils/validators/validators'
import {is64CharHexSignature} from 'src/utils/validators'

import {withCache} from 'src/api/controllers/cache'

export async function getSignaturesByHash(
  hash: BytecodeSignatureHash
): Promise<BytecodeSignature[] | null> {
  validator({
    hash: is64CharHexSignature(hash),
  })

  return await withCache(
    ['getSignaturesByHash', arguments],
    () => stores[0].signature.getSignaturesByHash(hash),
    1000
  )
}
