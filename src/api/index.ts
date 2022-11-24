import {RESTServer} from 'src/api/rest/server'
import {GRPCServer} from 'src/api/grpc/server'
import {webSocketServer} from 'src/api/webSocket/server'
import {config} from 'src/config'
import {logger} from 'src/logger'
import {warmUpCache} from 'src/api/controllers/cache/warmUpCache'
const l = logger(module)

export const api = async () => {
  l.info(`API starting... Shards[${config.api.shards.join(', ')}]`)

  await warmUpCache()
  await RESTServer()
  // await GRPCServer()
  await webSocketServer()
}
