import {logger} from 'src/logger'
import {IStorageContract} from 'src/store/interface'
import {
  Contract,
  Filter,
  Transaction,
  ContractQueryField,
  ContractQueryValue,
  ContractEvent,
} from 'src/types'
import {Query} from 'src/store/postgres/types'
import {fromSnakeToCamelResponse, generateQuery} from 'src/store/postgres/queryMapper'
import {buildSQLQuery} from 'src/store/postgres/filters'

export class PostgresStorageContract implements IStorageContract {
  query: Query

  constructor(query: Query) {
    this.query = query
  }

  addContract = async (contract: Contract) => {
    const {query, params} = generateQuery(contract)
    return await this.query(`insert into contracts ${query} on conflict do nothing;`, params)
  }

  getContracts = async (filter: Filter): Promise<Contract[]> => {
    const q = buildSQLQuery(filter)
    const res = await this.query(`select * from contracts ${q}`, [])

    return res.map(fromSnakeToCamelResponse)
  }

  getContractByField = async (
    field: ContractQueryField,
    value: ContractQueryValue
  ): Promise<Transaction[]> => {
    const res = await this.query(`select * from contracts where ${field}=$1;`, [value])
    return res.map(fromSnakeToCamelResponse)
  }

  addContractEvent = (event: ContractEvent) => {
    return this.query(
      `insert into contract_events (block_number, transaction_type, event_type, transaction_index, transaction_hash, log_index, address, "from", "to", value)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            on conflict do nothing;`,
      [
        event.blockNumber,
        event.transactionType,
        event.eventType,
        event.transactionIndex,
        event.transactionHash,
        event.logIndex,
        event.address,
        event.from,
        event.to,
        event.value,
      ]
    )
  }

  addContractEventsBatch = (events: ContractEvent[]) => {
    const paramsNumber = 10
    const valuesList = events
      .map(
        (e, eventIndex) =>
          '(' +
          Array(paramsNumber)
            .fill(null)
            .map((n, index) => '$' + (index + eventIndex * paramsNumber + 1))
            .join(', ') +
          ')'
      )
      .join(',')
    const paramsList = events.flatMap((event) => {
      return [
        event.blockNumber,
        event.transactionType,
        event.eventType,
        event.transactionIndex,
        event.transactionHash,
        event.logIndex,
        event.address,
        event.from,
        event.to,
        event.value,
      ]
    })
    return this.query(
      `insert into contract_events (block_number, transaction_type, event_type, transaction_index, transaction_hash, log_index, address, "from", "to", value)
            values ${valuesList}
            on conflict do nothing;`,
      paramsList
    )
  }
}
