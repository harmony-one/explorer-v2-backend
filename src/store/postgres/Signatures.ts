import {IStorageSignature} from 'src/store/interface'
import {BytecodeSignatureHash, BytecodeSignature} from 'src/types/blockchain'

import {Query} from 'src/store/postgres/types'
import {generateQuery} from 'src/store/postgres/queryMapper'

export class PostgresStorageSignature implements IStorageSignature {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  addSignatures = async (signature: BytecodeSignature): Promise<any> => {
    const {query, params} = generateQuery(signature)
    return await this.query(
      `insert into signatures ${query} on conflict (hash, signature) do nothing;`,
      params
    )
  }

  getSignaturesByHash = async (
    hash: BytecodeSignatureHash
  ): Promise<BytecodeSignature[] | null> => {
    const res = await this.query(`select * from signatures where hash=$1;`, [hash])

    return res as BytecodeSignature[]
  }
}
