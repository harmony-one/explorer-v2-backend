import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {ShardID} from 'src/types/blockchain'
import {catchAsync} from 'src/api/rest/utils'

export const logsRouter = Router({mergeParams: true})

logsRouter.get('/block/number/:blockNumber', catchAsync(getLogsByBlockNumber))

export async function getLogsByBlockNumber(req: Request, res: Response, next: NextFunction) {
  const {blockNumber, shardID} = req.params
  const s = +shardID as ShardID
  const txs = await controllers.getLogsByField(s, 'block_number', +blockNumber)
  next(txs)
}

logsRouter.get('/block/hash/:blockHash', catchAsync(getLogsByBlockHash))

export async function getLogsByBlockHash(req: Request, res: Response, next: NextFunction) {
  const {blockHash, shardID} = req.params
  const s = +shardID as ShardID
  const txs = await controllers.getLogsByField(s, 'block_hash', blockHash)
  next(txs)
}

logsRouter.get('/transaction/hash/:txHash', catchAsync(getLogsByTransactionHash))

export async function getLogsByTransactionHash(req: Request, res: Response, next: NextFunction) {
  const {txHash, shardID} = req.params
  const s = +shardID as ShardID
  const txs = await controllers.getLogsByField(s, 'transaction_hash', txHash)
  next(txs)
}

logsRouter.get('/count', catchAsync(getCount))

export async function getCount(req: Request, res: Response, next: NextFunction) {
  const {shardID} = req.params
  const s = +shardID as ShardID
  const block = await controllers.getCount(s, 'logs')
  next(block)
}
