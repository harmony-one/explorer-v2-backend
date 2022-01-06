import {Response, Request, Router, NextFunction} from 'express'
import * as controllers from 'src/api/controllers'
import {catchAsync} from 'src/api/rest/utils'

export const rpcRouter = Router({mergeParams: true})

enum RPCMethod {
  traceBlock = 'trace_block',
}

enum RPCErrorCode {
  unknownMethod = -32601,
  paramsNotDefined = -32700,
}

rpcRouter.post('/', catchAsync(postRpcRequest))

const wrapRpcResponse = (method: RPCMethod, key: string, value: any) => {
  return {
    jsonrpc: '2.0',
    id: 1,
    method,
    [key]: value,
  }
}

export async function postRpcRequest(req: Request, res: Response, next: NextFunction) {
  const {method, params} = req.body

  if (!params || !Array.isArray(params)) {
    return res.send(
      wrapRpcResponse(method, 'error', {
        code: RPCErrorCode.paramsNotDefined,
        message: `missing value for required argument 0`,
      })
    )
  }

  switch (method) {
    case RPCMethod.traceBlock: {
      const txs = await getTraceBlock(params[0])
      res.send(wrapRpcResponse(method, 'result', txs))
      break
    }
    default: {
      res.send(
        wrapRpcResponse(method, 'error', {
          code: RPCErrorCode.unknownMethod,
          message: `the method ${method} does not exist/is not available`,
        })
      )
    }
  }
}

function getTraceBlock(blockHexNumber: string) {
  return controllers.getTraceBlock(0, blockHexNumber)
}
