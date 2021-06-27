import grpc from 'grpc'
import path from 'path'
import {loadSync} from '@grpc/proto-loader'
import * as controllers from 'src/api/controllers'
import * as methods from 'src/api/grpc/methods'
import {catchAsync} from 'src/api/grpc/utils'

const protoFile = path.join(__dirname, 'proto', './api.proto')
import {logger} from 'src/logger'
import {config} from 'src/config'

const l = logger(module)
/*
cli
grpc_cli --protofiles=src/api/grpc/proto/api.proto call 127.0.0.1:5051 GetBlockByNumber "blockNumber: '1'"

You can then generate the types like so:
./node_modules/.bin/proto-loader-gen-types --longs=String --enums=String --defaults --oneofs --grpcLib=@grpc/grpc-js --outDir=proto/ proto/*.proto
*/

export const GRPCServer = async () => {
  if (!config.api.grpc.isEnabled) {
    l.debug(`GRPC API disabled`)
    return
  }

  l.info(`GRPC API is Work in Progress and will be finished on community demand`)
  return

  // eslint-disable-next-line
  const packageDefinition = loadSync(protoFile, {
    keepCase: true,
    longs: String,
    enums: String,
    arrays: true,
  })

  const proto = grpc.loadPackageDefinition(packageDefinition)

  const server = new grpc.Server()

  const methodsWithAsyncCatch = Object.keys(methods)
    // @ts-ignore
    .reduce((o, k) => ({...o, [k]: catchAsync(methods[k])}), {})

  // @ts-ignore
  server.addService(proto.APIService.service, methodsWithAsyncCatch)

  server.bind(`127.0.0.1:${config.api.grpc.port}`, grpc.ServerCredentials.createInsecure())
  l.info(`GRPC API listening at 127.0.0.1:${config.api.grpc.port}`)
  await server.start()
}
