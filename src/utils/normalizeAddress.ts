import {Address} from 'src/types'
import {fromBech32} from '@harmony-js/crypto'
export const normalizeAddress = (address: Address) => {
  if (!address) {
    return null
  }
  // hex
  if (address[0] === '0' && address[1] === 'x') {
    return address.toLowerCase()
  }

  return fromBech32(address).toLowerCase()
}
