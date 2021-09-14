import {IStorageERC1155} from 'src/store/interface'
import {
  Address,
  BlockNumber,
  IERC721Asset,
  IERC1155Asset,
  Filter,
  IERC721,
  IERC1155,
  IERC721TokenID,
} from 'src/types'
import {Query} from 'src/store/postgres/types'
import {fromSnakeToCamelResponse, generateQuery} from 'src/store/postgres/queryMapper'
import {buildSQLQuery} from 'src/store/postgres/filters'

export class PostgresStorageERC1155 implements IStorageERC1155 {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  addERC1155 = async (erc721: IERC721) => {
    const {query, params} = generateQuery(erc721)

    return await this.query(
      `insert into erc1155 ${query} on conflict (address) do nothing;`,
      params
    )
  }

  getERC1155 = async (filter: Filter): Promise<IERC721[]> => {
    const q = buildSQLQuery(filter)
    const res = await this.query(`select * from erc1155 ${q}`, [])

    return res.map(fromSnakeToCamelResponse)
  }

  getAllERC1155 = async (): Promise<IERC721[]> => {
    const res = await this.query(`select * from erc1155`, [])

    return res.map(fromSnakeToCamelResponse)
  }

  updateERC1155 = async (erc1155: IERC1155) => {
    return this.query(
      `update erc1155 set total_supply=$1, holders=$2, transaction_count=$3 where address=$4;`,
      [erc1155.totalSupply, erc1155.holders, erc1155.transactionCount, erc1155.address]
    )
  }

  getERC1155LastSyncedBlock = async (address: Address): Promise<number> => {
    const res = await this.query(`select last_update_block_number from erc1155 where address=$1;`, [
      address,
    ])

    const lastIndexedBlock = +res[0][`last_update_block_number`]
    return lastIndexedBlock || 0
  }

  setERC1155LastSyncedBlock = async (address: Address, blockNumber: BlockNumber) => {
    return this.query(`update erc1155 set last_update_block_number=$1 where address=$2;`, [
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

  setNeedUpdateAsset = async (token: Address, tokenID: IERC721TokenID) => {
    return this.query(
      `
            insert into erc1155_asset(token_address, token_id, need_update)
                values($1, $2, true)
                on conflict(token_address, token_id)
                do update set need_update = true;
          `,
      [token, tokenID]
    )
  }

  setNeedUpdateBalance = async (owner: Address, token: Address, tokenID: IERC721TokenID) => {
    return this.query(
      `
            insert into erc1155_balance(owner_address, token_address, token_id, need_update)
                values($1, $2, $3, true)
                on conflict(owner_address, token_id, token_address)
                do update set need_update = true;
          `,
      [owner, token, tokenID]
    )
  }

  getAssets = async (filter: Filter): Promise<IERC1155Asset[]> => {
    const q = buildSQLQuery(filter)

    const res = await this.query(`select * from erc1155_asset ${q}`, [])

    return res.map(fromSnakeToCamelResponse)
  }

  getBalances = async (filter: Filter): Promise<IERC721Asset[]> => {
    const q = buildSQLQuery(filter)

    const res = await this.query(`select * from erc1155_balance ${q}`, [])

    return res.map(fromSnakeToCamelResponse)
  }

  getHoldersCount = async (token: Address): Promise<string> => {
    const res = await this.query(
      `select count(distinct(owner_address)) from erc1155_balance where token_address=$1`,
      [token]
    )

    return res[0].count
  }

  updateAsset = async (
    tokenAddress: Address,
    tokenURI: string,
    meta: string,
    tokenID: IERC721TokenID
  ) => {
    return this.query(
      `
        update erc1155_asset set token_uri=$1, meta=$2, need_update=false
        where token_address=$3 and token_id=$4;
        `,
      [tokenURI, meta, tokenAddress, tokenID]
    )
  }

  updateBalance = async (
    tokenAddress: Address,
    ownerAddress: Address,
    tokenID: IERC721TokenID,
    balance: number | string
  ) => {
    return this.query(
      `
        update erc1155_balance set amount=$1, need_update=false
        where token_address=$2 and token_id=$3 and owner_address=$4;
        `,
      [balance, tokenAddress, tokenID, ownerAddress]
    )
  }

  getUserBalances = async (address: Address): Promise<IERC721Asset[]> => {
    const res = await this.query(`
        select * from erc1155_balance
        left join erc1155_asset on erc1155_balance.token_id = erc1155_asset.token_id 
        and erc1155_balance.token_address = erc1155_asset.token_address
        where erc1155_balance.owner_address=$1
    `, [address])

    return res.map(fromSnakeToCamelResponse)
  }

  getTokenBalances = async (address: Address): Promise<IERC721Asset[]> => {
    const res = await this.query(`select * from erc1155_balance where token_address=$1`, [address])

    return res.map(fromSnakeToCamelResponse)
  }

  getTokenAssets = async (address: Address): Promise<IERC721Asset[]> => {
    const res = await this.query(`select * from erc1155_asset where token_address=$1`, [address])

    return res.map(fromSnakeToCamelResponse)
  }
}
