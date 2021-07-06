import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {catchAsync} from 'src/api/rest/utils'

export const oneWalletMetricsRouter = Router({mergeParams: true})

oneWalletMetricsRouter.get('/metrics', catchAsync(getMetrics))

export async function getMetrics(req: Request, res: Response, next: NextFunction) {
  const txs = await controllers.oneWalletGetMetrics()
  next(txs)
}
