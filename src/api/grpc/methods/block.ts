import grpc from 'grpc'
import * as controllers from 'src/api/controllers'
import {ShardID} from 'src/types/blockchain'

// grpc doesnt send type default values
export const GetBlockByNumber = async (
  call: grpc.ServerUnaryCall<any>,
  callback: grpc.sendUnaryData<any>
) => {
  const {blockNumber = 0, shardID = 0} = call.request
  const block = await controllers.getBlockByNumber(+shardID as ShardID, +blockNumber)
  callback(null, block)
}

export const GetBlockByHash = async (
  call: grpc.ServerUnaryCall<any>,
  callback: grpc.sendUnaryData<any>
) => {
  const {blockHash, shardID = 0} = call.request
  const block = await controllers.getBlockByHash(+shardID as ShardID, blockHash)
  callback(null, block)
}
