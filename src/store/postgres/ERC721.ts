import {IStorageERC721} from 'src/store/interface'
import {Address, BlockNumber, IERC721Asset, Filter, IERC721, IERC721TokenID} from 'src/types'
import {Query} from 'src/store/postgres/types'
import {fromSnakeToCamelResponse, generateQuery} from 'src/store/postgres/queryMapper'
import {buildSQLQuery} from 'src/store/postgres/filters'

export class PostgresStorageERC721 implements IStorageERC721 {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  addERC721 = async (erc721: IERC721) => {
    const {query, params} = generateQuery(erc721)

    return await this.query(`insert into erc721 ${query} on conflict (address) do nothing;`, params)
  }

  getERC721 = async (filter: Filter): Promise<IERC721[]> => {
    const q = buildSQLQuery(filter)
    const res = await this.query(`select * from erc721 ${q}`, [])

    return res.map(fromSnakeToCamelResponse)
  }

  getAllERC721 = async (): Promise<IERC721[]> => {
    const res = await this.query(`select * from erc721`, [])

    return res.map(fromSnakeToCamelResponse)
  }

  updateERC721 = async (erc721: IERC721) => {
    return this.query(
      `update erc721 set total_supply=$1, holders=$2, transaction_count=$3 where address=$4;`,
      [erc721.totalSupply, erc721.holders, erc721.transactionCount, erc721.address]
    )
  }

  getERC721LastSyncedBlock = async (address: Address): Promise<number> => {
    const res = await this.query(`select last_update_block_number from erc721 where address=$1;`, [
      address,
    ])

    const lastIndexedBlock = +res[0][`last_update_block_number`]
    return lastIndexedBlock || 0
  }

  setERC721LastSyncedBlock = async (address: Address, blockNumber: BlockNumber) => {
    return this.query(`update erc721 set last_update_block_number=$1 where address=$2;`, [
      blockNumber,
      address,
    ])
  }

  getERC721Assets = async (owner: Address, token: Address): Promise<IERC721Asset[]> => {
    const res = await this.query(
      `select * from erc721_asset where owner_address=$1 and token_address=$2`,
      [owner, token]
    )

    return res.map(fromSnakeToCamelResponse)
  }

  setNeedUpdateAsset = async (owner: Address, token: Address, tokenID: IERC721TokenID) => {
    return this.query(
      `
            insert into erc721_asset(owner_address, token_address, token_id, need_update) 
                values($1, $2, $3, true)
                on conflict(token_address, token_id)
                do update set need_update = true;
          `,
      [owner, token, tokenID]
    )
  }

  updateAsset = async (
    owner: Address,
    tokenAddress: Address,
    tokenURI: string,
    meta: string,
    tokenID: IERC721TokenID
  ) => {
    return this.query(
      `
          update erc721_asset set token_uri=$1, meta=$2, owner_address=$3, need_update=false 
          where token_address=$4 and token_id=$5;
          `,
      [tokenURI, meta, owner, tokenAddress, tokenID]
    )
  }

  getAssets = async (filter: Filter): Promise<IERC721Asset[]> => {
    const q = buildSQLQuery(filter)

    const res = await this.query(`select * from erc721_asset ${q}`, [])

    return res.map(fromSnakeToCamelResponse)
  }

  getUserAssets = async (address: Address): Promise<IERC721Asset[]> => {
    const res = await this.query(`select * from erc721_asset where owner_address=$1`, [address])

    return res.map(fromSnakeToCamelResponse)
  }

  getTokenAssets = async (
    address: Address,
    offset: number,
    limit: number
  ): Promise<IERC721Asset[]> => {
    const res = await this.query(
      `select * from erc721_asset where token_address=$1
           order by created_at desc
           offset $2
           limit $3`,
      [address]
    )

    return res.map(fromSnakeToCamelResponse)
  }

  getHoldersCount = async (token: Address): Promise<string> => {
    const res = await this.query(
      `select count(distinct(owner_address)) from erc721_asset where token_address=$1`,
      [token]
    )

    return res[0].count
  }
}
