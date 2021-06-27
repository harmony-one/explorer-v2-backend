import {Socket} from 'socket.io'
import http from 'http'
import express from 'express'
import {config} from 'src/config'
import {logger} from 'src/logger'
import * as controllers from 'src/api/controllers'
import {getMethods} from './utils'
import {errorToObject} from 'src/api/utils'
import cors from 'cors'

const l = logger(module)

const methodsDescription = getMethods()

const runMethod: (
  method: string,
  params: any[]
) => Promise<{event: string; response: any}> = async (method: string, params: any[]) => {
  try {
    if (method === 'methods') {
      return {event: 'Response', response: methodsDescription}
    }

    // @ts-ignore
    const f = controllers[method as string]
    if (!f) {
      throw new Error('Method unknown')
    }

    const response = await f(...params)
    return {event: `Response`, response}
  } catch (error) {
    return {event: 'Error', response: errorToObject(error)}
  }
}

export const webSocketServer = async () => {
  if (!config.api.ws.isEnabled) {
    l.debug(`WebSocket API disabled`)
    return
  }

  const api = express()
  const server = http.createServer(api)
  const io = require('socket.io')(server, {cors: {origin: '*'}})

  api.use(cors())

  io.on('connection', (socket: Socket) => {
    socket.onAny(async (event, params, callback) => {
      if (typeof callback !== 'function') {
        return
      }

      const res = await runMethod(event, params)
      callback({event: res.event, payload: JSON.stringify(res.response)})
    })
  })

  if (config.api.ws.isDemoHTMLPageEnabled) {
    l.info(
      `Console WebSocket [Socket.io] client is available at http://localhost:${config.api.ws.port}`
    )
    api.get('/', (req, res) => {
      res.sendFile(__dirname + '/index.html')
    })
  }
  const close = () => server.close()

  server.listen(config.api.ws.port, () => {
    l.info(`WebSocket API [Socket.io] listening at ws://localhost:${config.api.ws.port}`)
  })

  return close
}
