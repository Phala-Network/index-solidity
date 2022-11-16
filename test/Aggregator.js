const {time, loadFixture} = require('@nomicfoundation/hardhat-network-helpers')
const {anyValue} = require('@nomicfoundation/hardhat-chai-matchers/withArgs')
const {expect} = require('chai')

describe('Aggregator', function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployAggregatorFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, user] = await ethers.getSigners()

    const Token = await ethers.getContractFactory('ERC20PresetMinterPauser')
    const token = await Token.deploy('TestToken', 'TT')
    const Aggregator = await ethers.getContractFactory('Aggregator')
    const aggregator = await Aggregator.deploy()

    // transfer some token to test account
    await token.mint(owner.address, '10000')
    await token.mint(user.address, '10000')
    return {token, aggregator, owner, user}
  }

  describe('Deposit', function () {
    it('Should revert if token address is 0', async function () {
      const {aggregator} = await loadFixture(deployAggregatorFixture)

      await expect(
        aggregator.deposit(
          '0x0000000000000000000000000000000000000000',
          '100',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
          '0x86a6b23bFAA35E3605bdA8C091d3Ca52b7e985F8',
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x1234'
        )
      ).to.be.revertedWith('Illegal token address')
    })

    it('Should revert if transfer amount is 0', async function () {
      const {aggregator} = await loadFixture(deployAggregatorFixture)

      await expect(
        aggregator.deposit(
          '0x0000000000000000000000000000000000000001',
          '0',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
          '0x86a6b23bFAA35E3605bdA8C091d3Ca52b7e985F8',
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x1234'
        )
      ).to.be.revertedWith('Zero transfer')
    })

    it('Should revert if recipient is empty', async function () {
      const {aggregator} = await loadFixture(deployAggregatorFixture)

      await expect(
        aggregator.deposit(
          '0x0000000000000000000000000000000000000001',
          '100',
          '0x',
          '0x86a6b23bFAA35E3605bdA8C091d3Ca52b7e985F8',
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x1234'
        )
      ).to.be.revertedWith('Illegal recipient data')
    })

    it('Should revert if worker address is 0', async function () {
      const {aggregator} = await loadFixture(deployAggregatorFixture)

      await expect(
        aggregator.deposit(
          '0x0000000000000000000000000000000000000001',
          '100',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
          '0x0000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x1234'
        )
      ).to.be.revertedWith('Illegal worker address')
    })

    it('Should revert if task data is empty', async function () {
      const {aggregator} = await loadFixture(deployAggregatorFixture)

      await expect(
        aggregator.deposit(
          '0x0000000000000000000000000000000000000001',
          '100',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
          '0x86a6b23bFAA35E3605bdA8C091d3Ca52b7e985F8',
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x'
        )
      ).to.be.revertedWith('Illegal task data')
    })

    it('Should work', async function () {
      const {token, aggregator, user} = await loadFixture(
        deployAggregatorFixture
      )

      // User approve to aggregator
      token.connect(user).approve(aggregator.address, '10000')

      await expect(
        aggregator
          .connect(user)
          .deposit(
            token.address,
            '100',
            '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
            '0x86a6b23bFAA35E3605bdA8C091d3Ca52b7e985F8',
            '0x0000000000000000000000000000000000000000000000000000000000000001',
            '0x1234'
          )
      )
        .to.emit(aggregator, 'Deposited')
        .withArgs(
          user.address,
          token.address,
          '100',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
          '0x1234'
        )
    })
  })
})
