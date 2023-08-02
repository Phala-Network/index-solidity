const {time, loadFixture} = require('@nomicfoundation/hardhat-network-helpers')
const {anyValue} = require('@nomicfoundation/hardhat-chai-matchers/withArgs')
const {expect} = require('chai')
const {ethers} = require('hardhat')

describe('MultiCall', function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployMulticallFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, caller] = await ethers.getSigners()

    const Test = await ethers.getContractFactory('Test')
    const test = await Test.deploy()
    const MultiCall = await ethers.getContractFactory('MultiCall')
    const multicall = await MultiCall.deploy()
    const Token = await ethers.getContractFactory('ERC20PresetMinterPauser')
    const tokenA = await Token.deploy('TestTokenA', 'TTA')
    const tokenB = await Token.deploy('TestTokenA', 'TTA')

    await tokenA.mint(owner.address, '10000')
    await tokenA.mint(test.address, '10000')
    await tokenB.mint(owner.address, '10000')
    await tokenB.mint(test.address, '10000')
    await tokenA.connect(owner).approve(test.address, '1000')
    await tokenA.connect(owner).approve(test.address, '1000')
    await tokenB.connect(caller).approve(test.address, '1000')
    await tokenB.connect(caller).approve(test.address, '1000')

    // transfer some token to test account
    return {test, multicall, tokenA, tokenB, owner, caller}
  }

  describe('Multicall', function () {
    it('Multicall should work', async function () {
      const {test, multicall, tokenA, tokenB, owner, caller} =
        await loadFixture(deployMulticallFixture)

        console.log(`Test contract: ${test.address}`);
        console.log(`Multicall contract: ${multicall.address}`);
        console.log(`tokenA contract: ${tokenA.address}`);
        console.log(`tokenB contract: ${tokenB.address}`);
        console.log(`owner: ${owner.address}`);
        console.log(`caller: ${caller.address}`);

      // Construct call data
      // The call are as follows:
      // [Test.claim(), Test.swap(), Test.doNothing(), Test.bridge()]
      let callDataClaim = test.interface.encodeFunctionData('claim', [
        tokenA.address,
        '200',
      ])
      let callDataSwap = test.interface.encodeFunctionData('swap', [
        tokenA.address,
        tokenB.address,
        '10000',
      ])
      let callDataDoNothing = test.interface.encodeFunctionData('doNothing', [
        '10000',
      ])
      let callDataBridge = test.interface.encodeFunctionData('bridge', [
        tokenB.address,
        '10000',
      ])

      console.log(`callDataClaim: ${callDataClaim}`)
      console.log(`callDataSwap: ${callDataSwap}`)
      console.log(`callDataDoNothing: ${callDataDoNothing}`)
      console.log(`callDataBridge: ${callDataBridge}`)

      // Batch call
      await expect(
        multicall.connect(owner).callAndSettle([
          [
            test.address,
            callDataClaim,
            '0',
            false,

            true,
            // No need to update at first call
            '0',
            '0',
            tokenA.address,
            tokenA.address,
            // Will be ingored because this is the first call
            '0',
            '0',
          ],
          [
            test.address,
            callDataSwap,
            '0',
            false,

            true,
            '68',
            '32',
            tokenA.address,
            tokenB.address,
            // Use the claim  call output as input
            '0',
            '1',
          ],
          [
            test.address,
            callDataDoNothing,
            '0',
            false,

            false,
            '4',
            '32',
            tokenB.address,
            tokenB.address,
            // Use the swap call output as input
            '1',
            '2',
          ],
          [
            test.address,
            callDataBridge,
            '0',
            false,

            // No need to settle on last call
            false,
            '36',
            '32',
            tokenB.address,
            tokenB.address,
            // Still use the swap call output as input
            '1',
            '3',
          ],
        ])
      )
        .to.emit(test, 'Claim')
        .withArgs(tokenA.address, '200')
        .to.emit(test, 'Swap')
        .withArgs(tokenA.address, tokenB.address, '200')
        .to.emit(test, 'Nothing')
        .withArgs('100')
        .to.emit(test, 'Bridge')
        .withArgs(tokenB.address, '100')
    })
  })
})
