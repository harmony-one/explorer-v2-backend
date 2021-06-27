import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {catchAsync} from 'src/api/rest/utils'

export const signatureRouter = Router({mergeParams: true})

signatureRouter.get('/hash/:hash', catchAsync(getLogsByBlockNumber))

export async function getLogsByBlockNumber(req: Request, res: Response, next: NextFunction) {
  const {hash} = req.params

  const signatures = await controllers.getSignaturesByHash(hash)
  next(signatures)
}
