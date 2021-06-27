import {Response, Request, NextFunction} from 'express'
import {errorToObject} from 'src/api/utils'

export const transport = (data: any, req: Request, res: Response, next: NextFunction) => {
  let error
  if (data instanceof Error) {
    if (res.statusCode < 400) {
      res.status(500)
    }
    error = errorToObject(data)
  }

  if (res.statusCode >= 400) {
    error = error || data || 'Unknown error'
    res.json({errors: Array.isArray(error) ? error : [error]})
    return
  }

  res.json(data)
}
