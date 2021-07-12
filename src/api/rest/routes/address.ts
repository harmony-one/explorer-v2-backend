import {Response, Request, Router, NextFunction} from 'express'
import {stores} from 'src/store'
import * as controllers from 'src/api/controllers'
import {AddressTransactionType, ShardID} from 'src/types/blockchain'
import {catchAsync} from 'src/api/rest/utils'
import {FilterEntry, Filter, FilterType, FilterOrderDirection, FilterOrderBy} from 'src/types'
import {transactionRouter} from 'src/api/rest/routes/transaction'

export const addressRouter = Router({mergeParams: true})

addressRouter.get('/:address/transactions/type/:txType', catchAsync(getRelatedTransactionsByType))

export async function getRelatedTransactionsByType(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const {shardID, address, txType} = req.params
  const {offset, limit, orderBy, orderDirection, type, property, value} = req.query

  const filterEntries: FilterEntry[] = []

  if (type && value && property) {
    filterEntries.push({type, property, value} as FilterEntry)
  }

  const filter: Filter = {
    offset: (+offset! as number) || 0,
    limit: (+limit! as number) || 10,
    orderBy: (orderBy as FilterOrderBy) || 'block_number',
    orderDirection: (orderDirection as FilterOrderDirection) || 'desc',
    filters: filterEntries,
  }

  const s = +shardID as ShardID
  const block = await controllers.getRelatedTransactionsByType(
    s,
    address,
    txType as AddressTransactionType,
    filter
  )
  next(block)
}

addressRouter.get('/:address/contract', catchAsync(getContractByAddress))

export async function getContractByAddress(req: Request, res: Response, next: NextFunction) {
  const {address, shardID} = req.params
  const s = +shardID as ShardID
  const txs = await controllers.getContractsByField(s, 'address', address)
  next(txs)
}
