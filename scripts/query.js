require('dotenv').config()
const HandlerJson = require('../artifacts/contracts/Handler.sol/Handler.json')
const ethers = require('ethers')

const HANDLER_ON_GOERLI = '0xbEA1C40ecf9c4603ec25264860B9b6623Ff733F5'
const TEST_WORKER = '0xf60dB2d02af3f650798b59CB6D453b78f2C1BC90'

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.INFURA_GOERLI
  )

  const handler = new ethers.Contract(
    HANDLER_ON_GOERLI,
    HandlerJson.abi,
    provider
  )

  let request_id = await handler.getLastActivedRequest(TEST_WORKER)
  let deposit_info = await handler.getRequestData(request_id)
  console.log(`Last deposit info: ${JSON.stringify(deposit_info, null, 2)}`)
  console.log(`Last active request: ${deposit_info.request}`)
}

main()
  .catch(console.error)
  .finally(() => process.exit())
