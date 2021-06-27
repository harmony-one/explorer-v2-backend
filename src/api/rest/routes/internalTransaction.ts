import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {ShardID} from 'src/types/blockchain'
import {catchAsync} from 'src/api/rest/utils'

export const internalTransactionRouter = Router({mergeParams: true})

internalTransactionRouter.get(
  '/block/number/:blockNumber',
  catchAsync(getInternalTransactionsByBlockNumber)
)

export async function getInternalTransactionsByBlockNumber(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const {blockNumber, shardID} = req.params
  const s = +shardID as ShardID
  const txs = await controllers.getInternalTransactionsByField(s, 'block_number', +blockNumber)
  next(txs)
}

internalTransactionRouter.get(
  '/block/hash/:blockHash',
  catchAsync(getInternalTransactionsByBlockHash)
)

export async function getInternalTransactionsByBlockHash(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const {blockHash, shardID} = req.params
  const s = +shardID as ShardID
  const txs = await controllers.getInternalTransactionsByField(s, 'block_hash', blockHash)
  next(txs)
}

internalTransactionRouter.get(
  '/transaction/hash/:txHash',
  catchAsync(getInternalTransactionsByTransactionHash)
)

export async function getInternalTransactionsByTransactionHash(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const {txHash, shardID} = req.params
  const s = +shardID as ShardID
  const txs = await controllers.getInternalTransactionsByField(s, 'transaction_hash', txHash)
  next(txs)
}

internalTransactionRouter.get('/count', catchAsync(getCount))

export async function getCount(req: Request, res: Response, next: NextFunction) {
  const {shardID} = req.params
  const s = +shardID as ShardID
  const block = await controllers.getCount(s, 'internalTransactions')
  next(block)
}
