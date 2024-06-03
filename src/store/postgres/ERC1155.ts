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

  updateTokenStats = async (tokenAddress: string) => {
    const holdersCount = (await this.getHoldersCount(tokenAddress)) || '0'
    await this.query(`update erc1155 set holders=$2 where address=$1`, [tokenAddress, holdersCount])
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

  addAsset = async (token: Address, tokenID: IERC721TokenID, blockNumber: string) => {
    return this.query(
      `
            insert into erc1155_asset(token_address, token_id, block_number, need_update)
                values($1, $2, $3, true)
                on conflict(token_address, token_id)
                do update set need_update = true;
          `,
      [token, tokenID, blockNumber]
    )
  }

  setNeedUpdateBalance = async (owner: Address, tokenAddress: Address, tokenID: IERC721TokenID) => {
    await this.query(
      `
            insert into erc1155_balance(owner_address, token_address, token_id, need_update)
                values($1, $2, $3, true)
                on conflict(owner_address, token_id, token_address)
                do update set need_update = true;
          `,
      [owner, tokenAddress, tokenID]
    )

    // Update balance for all previous owners
    await this.query(
      `
      update erc1155_balance
      set need_update = true
      where token_id = $1
      and amount > 0
    `,
      [tokenID]
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

  getHoldersCount = async (tokenAddress: Address): Promise<string> => {
    const res = await this.query(
      `select count(distinct(owner_address)) from erc1155_balance where token_address=$1`,
      [tokenAddress]
    )

    return res[0] ? res[0].count : '0'
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
    const res = await this.query(
      `
        select * from erc1155_balance
        left join erc1155_asset on erc1155_balance.token_id = erc1155_asset.token_id 
        and erc1155_balance.token_address = erc1155_asset.token_address
        where erc1155_balance.owner_address=$1
    `,
      [address]
    )

    return res.map(fromSnakeToCamelResponse)
  }

  getTokenBalances = async (address: Address): Promise<IERC721Asset[]> => {
    const res = await this.query(`select * from erc1155_balance where token_address=$1`, [address])

    return res.map(fromSnakeToCamelResponse)
  }

  getTokenAssets = async (
    address: Address,
    offset: number,
    limit: number
  ): Promise<IERC721Asset[]> => {
    const res = await this.query(
      `select asset.*, balance.owner_address, balance.amount 
            from erc1155_asset asset
            left join lateral (
                 SELECT * 
                 FROM erc1155_balance b 
                 WHERE b.token_id = asset.token_id
                 AND b.amount > 0
                 LIMIT 1
            ) balance on true
            where asset.token_address=$1
            order by block_number desc
            offset $2
            limit $3`,
      [address, offset, limit]
    )

    return res.map(fromSnakeToCamelResponse)
  }

  getTokenAssetDetails = async (address: Address, tokenID: string): Promise<IERC721Asset[]> => {
    const res = await this.query(
      `select asset.*, balance.owner_address, balance.amount
            from erc1155_asset asset
            left join erc1155_balance balance
            on asset.token_id = balance.token_id 
            where asset.token_address=$1 and asset.token_id=$2`,
      [address, tokenID]
    )

    return res.map(fromSnakeToCamelResponse)
  }
}
