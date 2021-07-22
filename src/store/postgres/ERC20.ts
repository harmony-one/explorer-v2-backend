import {IStorageERC20} from 'src/store/interface'
import {Address, BlockNumber, Contract, Filter, IERC20, IERC20Balance} from 'src/types'
import {Query} from 'src/store/postgres/types'
import {fromSnakeToCamelResponse, generateQuery} from 'src/store/postgres/queryMapper'
import {buildSQLQuery} from 'src/store/postgres/filters'

export class PostgresStorageERC20 implements IStorageERC20 {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  addERC20 = async (erc20: IERC20) => {
    const {query, params} = generateQuery(erc20)

    return await this.query(`insert into erc20 ${query} on conflict (address) do nothing;`, params)
  }

  getERC20 = async (filter: Filter): Promise<IERC20[]> => {
    const q = buildSQLQuery(filter)
    const res = await this.query(`select * from erc20 ${q}`, [])

    return res.map(fromSnakeToCamelResponse)
  }

  getAllERC20 = async (): Promise<IERC20[]> => {
    const res = await this.query(`select * from erc20`, [])

    return res.map(fromSnakeToCamelResponse)
  }

  updateERC20 = async (erc20: IERC20) => {
    return this.query(
      `update erc20 set total_supply=$1, circulating_supply=$5, holders=$2, transaction_count=$3 where address=$4;`,
      [
        erc20.totalSupply,
        erc20.holders,
        erc20.transactionCount,
        erc20.address,
        erc20.circulatingSupply,
      ]
    )
  }

  getERC20LastSyncedBlock = async (address: Address): Promise<number> => {
    const res = await this.query(`select last_update_block_number from erc20 where address=$1;`, [
      address,
    ])

    const lastIndexedBlock = +res[0][`last_update_block_number`]
    return lastIndexedBlock || 0
  }

  setERC20LastSyncedBlock = async (address: Address, blockNumber: BlockNumber) => {
    return this.query(`update erc20 set last_update_block_number=$1 where address=$2;`, [
      blockNumber,
      address,
    ])
  }

  getERC20Balance = async (owner: Address, token: Address): Promise<string | null> => {
    const res = await this.query(
      `select balance from erc20_balance where owner_address=$1 and token_address=$2`,
      [owner, token]
    )

    return res[0] || null
  }

  getERC20CirculatingSupply = async (token: Address): Promise<string | null> => {
    const res = await this.query(`select sum(balance) from erc20_balance where token_address=$1`, [
      token,
    ])

    return res[0].sum || '0'
  }

  setNeedUpdateBalance = async (owner: Address, token: Address) => {
    return this.query(
      `
            insert into erc20_balance(owner_address, token_address, need_update) values($1, $2, true)
                on conflict(owner_address, token_address)
                do update set need_update = true;
          `,
      [owner, token]
    )
  }

  updateBalance = async (owner: Address, token: Address, balance: string) => {
    return this.query(
      `
          update erc20_balance set balance=$1, need_update=false where owner_address=$2 and token_address=$3;
          `,
      [balance, owner, token]
    )
  }

  getBalances = async (filter: Filter): Promise<IERC20Balance[]> => {
    const q = buildSQLQuery(filter)

    const res = await this.query(`select * from erc20_balance ${q}`, [])

    return res.map(fromSnakeToCamelResponse)
  }

  getUserBalances = async (address: Address): Promise<IERC20Balance[]> => {
    const res = await this.query(
      `select * from erc20_balance where owner_address=$1 and balance > 0`,
      [address]
    )

    return res.map(fromSnakeToCamelResponse)
  }

  getHoldersCount = async (token: Address): Promise<string> => {
    const res = await this.query(
      `select count(*) from erc20_balance where token_address=$1 and balance > 0`,
      [token]
    )

    return res[0].count
  }

  getHolders = async (token: Address, limit = 100, offset = 0): Promise<IERC20Balance[]> => {
    const res = await this.query(
      `select * from erc20_balance where token_address=$3 and balance > 0 order by balance desc limit $1 offset $2`,
      [limit, offset, token]
    )

    return res.map(fromSnakeToCamelResponse)
  }
}
