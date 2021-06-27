import {IABI} from 'src/indexer/indexer/contracts/types'
import {ByteCode, Address} from 'src/types'

import Web3 from 'web3'
import * as RPCClient from 'src/indexer/rpc/client'

const web3 = new Web3()

export const ABIManager = (abi: IABI) => {
  const entries = abi
    .filter(({type}) => ['function', 'event'].includes(type))
    .map((e) => {
      let signature = ''
      if (e.type === 'function') {
        signature = web3.eth.abi.encodeFunctionSignature(e)
      } else if (e.type === 'event') {
        signature = web3.eth.abi.encodeEventSignature(e)
      }

      if (e.type === 'function' && !e.outputs) {
        throw new Error(`ABI outputs definition expected for function "${e.name}"`)
      }

      return {
        name: e.name,
        type: e.type,
        signature,
        signatureWithout0x: signature.slice(2),
        outputs: e.outputs ? e.outputs.map((e) => e.type) : [],
        inputs: e.inputs,
      }
    })

  const getEntryByName = (name: string) => entries.find((e) => e.name === name)

  const hasAllSignatures = (names: string[], hexData: ByteCode) =>
    names.reduce((acc, name) => {
      const entry = getEntryByName(name)
      if (!entry || !entry.signatureWithout0x) {
        return false
      }

      return hexData.indexOf(entry.signatureWithout0x) !== -1 && acc
    }, true)

  const decodeLog = (inputName: string, data: ByteCode, topics: string[]) => {
    const event = abi.find((e) => e.name === inputName)
    if (!event) {
      throw new Error(`No input for event "${inputName}"`)
    }

    return web3.eth.abi.decodeLog(event.inputs, data, topics)
  }

  const call = async (methodName: string, params: any[], address: Address) => {
    const entry = getEntryByName(methodName)

    if (!entry || entry.type !== 'function') {
      throw new Error(`${methodName} not found`)
    }
    const inputs = web3.eth.abi.encodeParameters(entry.inputs || [], params)

    const response = await RPCClient.call(0, {
      to: address,
      data: entry.signature + inputs.slice(2),
    })

    return web3.eth.abi.decodeParameters(entry.outputs, response)['0']
  }

  const callAll = (address: Address, methodsNames: string[]) => {
    return Promise.all(
      methodsNames.map(async (methodName) => {
        const entry = getEntryByName(methodName)
        if (!entry || entry.type !== 'function') {
          throw new Error(`${methodName} not found`)
        }

        const response = await RPCClient.call(0, {
          to: address,
          data: entry.signature,
        })

        const result = web3.eth.abi.decodeParameters(entry.outputs, response)['0']
        return {[entry.name]: result}
      })
    ).then((r) => r.reduce((a, b) => ({...a, ...b}), {}))
  }

  return {
    abi: entries,
    getEntryByName,
    hasAllSignatures,
    call,
    callAll,
    decodeLog,
  }
}
