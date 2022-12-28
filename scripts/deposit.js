require('dotenv').config()
const HandlerJson = require('../artifacts/contracts/Handler.sol/Handler.json')
const ethers = require('ethers')

const PHA_ON_GOERLI = '0xB376b0Ee6d8202721838e76376e81eEc0e2FE864'
const USDC_ON_GOERLI = '0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557'
const USDC_ON_MOONBEAM = '0x8f552a71EFE5eeFc207Bf75485b356A0b3f01eC9'
const HANDLER_ON_GOERLI = '0xbEA1C40ecf9c4603ec25264860B9b6623Ff733F5'
const TEST_WORKER = '0xf60dB2d02af3f650798b59CB6D453b78f2C1BC90'

function createRequest() {
    let request = [{
        'type': 'swap',
        'data': {
            'spend_asset': PHA_ON_GOERLI,
            'receive_asset': USDC_ON_GOERLI,
            'chain': 'Ethereum',
            'dex': 'UniswapV2',
            'cap': 0,
            'flow': 0,
            'impact': 0,
            'b0': null,
            'b1': null,
            // Spend 100 PHA to swap USDC
            'spend': '100000000000000000000'
        }
    }, {
        'type': 'bridge',
        'data': {
            'from': USDC_ON_GOERLI,
            'source_chain': 'Ethereum',
            'to': USDC_ON_MOONBEAM,
            'dest_chain': 'Moonbeam',
            'fee': 0,
            'cap': 0,
            'flow': 0,
            'b0': null,
            'b1': null,
            // USDC has decimas 6, and assume PHA price is 0.12 USDC
            'amount': '12000000'
        }
    }]
    return JSON.stringify(request)
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

  // tx: 0x075d27a64fbb000ed76ae9515e0feef842043ab20ee14e64ba06457540f31335
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
