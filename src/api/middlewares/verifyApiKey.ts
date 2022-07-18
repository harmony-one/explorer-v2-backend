import {NextFunction, Request, Response} from 'express'
import {config} from 'src/config'

export const verifyApiKey = (req: Request, res: Response, next: NextFunction) => {
  const {rest_api_key: headerApiKey} = req.headers
  const {apiKey} = config.api.rest

  // If config api key is not empty, check api key in header
  if (apiKey && headerApiKey === apiKey) {
    next()
  } else {
    res.sendStatus(403)
  }
}
