import {NextFunction, Request, Response} from 'express'
import {config} from 'src/config'

export const verifyApiKey = (req: Request, res: Response, next: NextFunction) => {
  const headerApiKey = req.headers['x-api-key'] || req.headers['rest_api_key']
  const {apiKey} = config.api.rest

  if (!apiKey || (apiKey && headerApiKey === apiKey)) {
    next()
  } else {
    res.sendStatus(403)
  }
}

export const verifyAdminApiKey = (req: Request, res: Response, next: NextFunction) => {
  const headersApiKey = req.headers['x-api-key']
  const {adminApiKey} = config.api.rest

  if (!adminApiKey || (adminApiKey && headersApiKey === adminApiKey)) {
    next()
  } else {
    res.sendStatus(403)
  }
}
