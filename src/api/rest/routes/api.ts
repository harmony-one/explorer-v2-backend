import {NextFunction, Request, Response, Router} from 'express'
import {catchAsync} from 'src/api/rest/utils'
import {ProxyActions, getGasPrice} from 'src/api/controllers/rpcProxy'

export const apiRouter = Router({mergeParams: true})

apiRouter.get('/', catchAsync(getApi))

const wrapSuccessfulResponse = (value: string) => {
  return {
    jsonrpc: '2.0',
    id: 1,
    result: value,
  }
}

const wrapErrorResponse = (message: string) => {
  return {
    status: 0,
    result: message,
  }
}

export async function getApi(req: Request, res: Response, next: NextFunction) {
  const {module, action} = req.query

  if (module === 'proxy') {
    try {
      switch (action) {
        case ProxyActions.ethGasPrice: {
          const data = await getGasPrice()
          return res.send(wrapSuccessfulResponse(data))
        }
        default:
          return res.send(wrapErrorResponse('Error! Missing Or invalid Action name'))
      }
    } catch (e) {
      return res.send(wrapErrorResponse(e.message || 'Unknown error'))
    }
  }

  res.send(wrapErrorResponse('Error! Missing Or invalid Module name'))
}
