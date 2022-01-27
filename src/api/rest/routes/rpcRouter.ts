import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {catchAsync} from 'src/api/rest/utils'
import {EthGetLogParams} from 'src/types'

export const rpcRouter = Router({mergeParams: true})

enum RPCMethod {
  ethGetLogs = 'eth_getLogs',
}

enum RPCErrorCode {
  unknownMethod = -32601,
  paramsNotDefined = -32700,
}

rpcRouter.post('/', catchAsync(postRpcRequest))

const wrapRpcResponse = (key: string, value: any) => {
  return {
    jsonrpc: '2.0',
    id: 1,
    [key]: value,
  }
}

export async function postRpcRequest(req: Request, res: Response, next: NextFunction) {
  const {method, params} = req.body

  if (!params || !Array.isArray(params)) {
    return res.send(
      wrapRpcResponse('error', {
        code: RPCErrorCode.paramsNotDefined,
        message: `missing value for required argument 0`,
      })
    )
  }

  switch (method) {
    case RPCMethod.ethGetLogs: {
      const data = await ethGetLogs(params[0])
      res.send(wrapRpcResponse('result', data))
      break
    }
    default: {
      res.send(
        wrapRpcResponse('error', {
          code: RPCErrorCode.unknownMethod,
          message: `the method ${method} does not exist/is not available`,
        })
      )
    }
  }
}

function ethGetLogs(params: EthGetLogParams) {
  return controllers.ethGetLogs(0, params)
}
