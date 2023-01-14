require('dotenv').config()
const HandlerJson = require('../artifacts/contracts/Handler.sol/Handler.json')
const ethers = require('ethers')

const PHA_ON_GOERLI = '0xB376b0Ee6d8202721838e76376e81eEc0e2FE864'
const USDC_ON_GOERLI = '0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557'
const USDC_ON_MOONBEAM = '0x8f552a71EFE5eeFc207Bf75485b356A0b3f01eC9'
const HANDLER_ON_GOERLI = '0xBf30B9BD94C584d8449fDE4fa57F46c838b62dc2'
const TEST_WORKER = '0x2d6aaDE06dcb43897aABAe543189Aae7E2a0DcE8'

/******** OperationJson definition in Rust **************
struct OperationJson {
    op_type: String,
    source_chain: String,
    dest_chain: String,
    spend_asset: Address,
    receive_asset: Address,
    dex: String,
    fee: String,
    cap: String,
    flow: String,
    impact: String,
    spend: String,
}
******************************************************/

function createRequest() {
  let operations = [
    {
      op_type: 'swap',
      source_chain: 'Ethereum',
      dest_chain: 'Ethereum',
      spend_asset: PHA_ON_GOERLI,
      receive_asset: USDC_ON_GOERLI,
      dex: 'UniswapV2',
      fee: '0',
      cap: '0',
      flow: '0',
      impact: '0',
      // Spend 100 PHA to swap USDC
      spend: '100000000000000000000',
    },
    {
      op_type: 'bridge',
      source_chain: 'Ethereum',
      dest_chain: 'Moonbeam',
      spend_asset: USDC_ON_GOERLI,
      receive_asset: USDC_ON_MOONBEAM,
      dex: '',
      fee: '0',
      cap: '0',
      flow: '0',
      impact: '0',
      // USDC has decimas 6, and assume PHA price is 0.12 USDC
      spend: '12000000',
    },
  ]
  return JSON.stringify(operations)
}

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

  // tx: 0xd0695b97986ec75f1b72a9b87946b7edc5a391b6d5bc94458403409941346f74
  let tx = await handler.deposit(
    PHA_ON_GOERLI,
    '100000000000000000000',
    '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
    TEST_WORKER,
    '0x0000000000000000000000000000000000000000000000000000000000000001',
    createRequest()
  )
  console.log(`Deposit tx: ${tx.hash}`)
}

main()
  .catch(console.error)
  .finally(() => process.exit())
