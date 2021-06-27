import nodeFetch from 'node-fetch'
import {RPCETHMethod, RPCHarmonyMethod} from 'types/blockchain'
import AbortController from 'abort-controller'
import {logger} from 'src/logger'
import {config} from 'src/config'
import {RPCUrls} from '../../RPCUrls'
import {ShardID} from 'src/types/blockchain'
import {logTime} from 'src/utils/logTime'
import {RPCErrorPrefix} from 'src/indexer/rpc/transport/constants'

const l = logger(module)

const defaultFetchTimeout = 10000
const defaultRetries = 5
const increaseTimeout = (retry: number) => defaultFetchTimeout

export const HTTPTransport = async (
  shardID: ShardID,
  method: RPCETHMethod | RPCHarmonyMethod,
  params: any[]
): Promise<any> => {
  const exec = async (
    shardID: ShardID,
    method: RPCETHMethod | RPCHarmonyMethod,
    params: any[],
    retry = defaultRetries
  ): Promise<any> => {
    try {
      return await fetchWithoutRetry(shardID, method, params, increaseTimeout(retry))
    } catch (err) {
      const isRCPErrorResponse = err.message.indexOf(RPCErrorPrefix) !== -1

      const retriesLeft = retry - 1
      if (retriesLeft < 1 || isRCPErrorResponse) {
        l.warn(`"${method}" failed in ${defaultRetries} attempts`, {
          err,
          shardID,
          params,
        })
        throw new Error(err)
      }

      // l.debug(`Retrying... ${retriesLeft}/${defaultRetries}`)
      return exec(shardID, method, params, retriesLeft)
    }
  }

  return exec(shardID, method, params, defaultRetries)
}

const fetchWithoutRetry = (
  shardID: ShardID,
  method: RPCETHMethod | RPCHarmonyMethod,
  params: any[],
  timeout = defaultFetchTimeout
) => {
  const timePassed = logTime()
  const rpc = RPCUrls.getURL(shardID)

  const body = {
    jsonrpc: '2.0',
    id: 1,
    method,
    params,
  }
  // l.debug(`fetch ${rpc.url} "${method}"`, {params})

  const controller = new AbortController()
  const timeoutID = setTimeout(() => {
    controller.abort()
  }, timeout)

  const payload = {
    method: 'post',
    body: JSON.stringify(body),
    headers: {'Content-Type': 'application/json'},
    signal: controller.signal,
  }

  return nodeFetch(rpc.url, payload)
    .then((res) => res.json())
    .then((res) => {
      if (res.result) {
        return res.result
      }
      if (res.error) {
        throw new Error(RPCErrorPrefix + ': ' + JSON.stringify(res.error))
      }
      throw new Error('No response data')
    })
    .then((result) => {
      rpc.submitStatistic(timePassed().val, false)
      return result
    })
    .catch((err) => {
      rpc.submitStatistic(defaultFetchTimeout, true)
      /*
      l.debug(`Failed to fetch ${rpc.url} ${method}`, {
        err: err.message || err,
        params,
      })
      */

      throw new Error(err)
    })
    .finally(() => {
      // l.debug(`fetch ${rpc.url} "${method}" took ${timePassed()}`)
      clearTimeout(timeoutID)
    })
}
