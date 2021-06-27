import {Response, Request, NextFunction} from 'express'
import grpc, {ServiceError} from 'grpc'

export const catchAsync = (f: Function) => {
  return async (call: grpc.ServerUnaryCall<any>, callback: grpc.sendUnaryData<any>) => {
    try {
      await f(call, (error: ServiceError | null, value: any | null) => callback(error, value))
    } catch (err) {
      callback(
        {
          name: 'Error',
          code: grpc.status.ABORTED,
          message: err.message || err,
        },
        null
      )
    }
  }
}
