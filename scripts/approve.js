require('dotenv').config()
const MintableERC20Json = require('../artifacts/contracts/ERC20PresetMinterPauser.sol/ERC20PresetMinterPauser.json')
const ethers = require('ethers')

const PHA_ON_GOERLI = '0xB376b0Ee6d8202721838e76376e81eEc0e2FE864'
const HANDLER_ON_GOERLI = '0xBf30B9BD94C584d8449fDE4fa57F46c838b62dc2'

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.INFURA_GOERLI
  )
  const wallet = new ethers.Wallet(process.env.KEY, provider)

  const pha = new ethers.Contract(PHA_ON_GOERLI, MintableERC20Json.abi, wallet)
  let tx = await pha.approve(HANDLER_ON_GOERLI, '10000000000000000000000')
  console.log(`Approve tx: ${tx.hash}`)
}

main()
  .catch(console.error)
  .finally(() => process.exit())
