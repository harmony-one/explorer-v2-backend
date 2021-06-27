import {WebSocketRPC} from './WebSocketRPC'
import {RPCETHMethod, RPCHarmonyMethod, ShardID} from 'src/types/blockchain'
import {config} from 'src/config'
import {urls, RPCUrls} from 'src/indexer/rpc/RPCUrls'

const lazyConnection = (shardID: ShardID, url: string) => {
  let connection: WebSocketRPC | null = null
  return {
    getConnection: () => connection,
    connect: () => (connection = new WebSocketRPC(shardID as ShardID, url)),
  }
}

const connections =
  config.indexer.rpc.transport === 'ws'
    ? config.indexer.rpc.urls.map((list, shardID) =>
        list.map((url) => lazyConnection(shardID as ShardID, url))
      )
    : []

const getConnectionIndex = (shardID: ShardID) => {
  const {url} = RPCUrls.getURL(shardID)
  return config.indexer.rpc.urls[shardID].indexOf(url)
}

export const WSTransport = (
  shardID: ShardID,
  method: RPCETHMethod | RPCHarmonyMethod,
  params: any[]
) => {
  const c = connections[shardID][getConnectionIndex(shardID)]

  if (c.getConnection() === null) {
    c.connect()
  }

  return c.getConnection()!.call(method, params)
}
