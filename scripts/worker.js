require('dotenv').config()
const HandlerJson = require('../artifacts/contracts/Handler.sol/Handler.json')
const ethers = require('ethers')

const HANDLER_ON_GOERLI = '0xBf30B9BD94C584d8449fDE4fa57F46c838b62dc2'
const TEST_WORKER = '0x2d6aaDE06dcb43897aABAe543189Aae7E2a0DcE8'

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.INFURA_GOERLI
  )
  const wallet = new ethers.Wallet(process.env.KEY, provider)

  const handler = new ethers.Contract(
    HANDLER_ON_GOERLI,
    HandlerJson.abi,
    wallet
  )

  // tx: 0x2a30239d7a2babfad83f58fc42a34303f49b479114e29466edd08db3f9e25035
  let tx = await handler.setWorker(
    TEST_WORKER,
  )
  console.log(`Set worker tx: ${tx.hash}`)
}

main()
  .catch(console.error)
  .finally(() => process.exit())
