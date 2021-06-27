import {AWSError} from 'aws-sdk'
import {DecryptResponse} from 'aws-sdk/clients/kms'

const fs = require('fs')
const aws = require('aws-sdk')

const filteredSymbols = ['=', ' ']
const trimSpaces = (s: string) => {
  return s
    .split('')
    .filter((l) => !filteredSymbols.includes(l))
    .join('')
}

const parseValue = (s: string, v: string) => {
  return trimSpaces(s.split(v)[1].split('\n')[0])
}

export const run = async () => {
  try {
    const config = fs.readFileSync(process.env.AWS_SDK_CONFIG_REGION).toString()
    const credential = fs.readFileSync(process.env.AWS_SDK_CONFIG_CREDENTIAL).toString()

    const region = parseValue(config, 'region')
    const accessKeyId = parseValue(credential, 'aws_access_key_id')
    const secretAccessKey = parseValue(credential, 'aws_secret_access_key')

    const kms = new aws.KMS({
      accessKeyId,
      secretAccessKey,
      region,
    })

    const secretPath = process.env.AWS_SDK_CONFIG_ENCRYPTED_FILE
    const encryptedSecret = fs.readFileSync(secretPath)
    const params = {
      CiphertextBlob: encryptedSecret,
    }

    return await new Promise((resolve, reject) => {
      kms.decrypt(params, (err: AWSError, data: DecryptResponse) => {
        if (err) {
          reject(err)
          return
        }

        const decrypted = (data['Plaintext'] || '').toString()
        resolve(decrypted)
      })
    })
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
