import {Request} from 'express'
import {TLogMessage} from 'zerg/dist/types'

export const buildReqInfo = (req: Request) => {
  const {body, params, query, method, url} = req
  return {
    url,
    method,
    body,
    params,
    query,
  }
}

export const getExtendedData = (logMessage: TLogMessage) => {
  if (!logMessage.extendedData) {
    return null
  }

  const {req: originReq, ...restData} = logMessage.extendedData

  if (!originReq) {
    return restData
  }

  const req = buildReqInfo(originReq)

  return {
    ...restData,
    req,
  }
}
