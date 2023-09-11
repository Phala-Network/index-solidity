const {time, loadFixture} = require('@nomicfoundation/hardhat-network-helpers')
const {anyValue} = require('@nomicfoundation/hardhat-chai-matchers/withArgs')
const {expect} = require('chai')
const {ethers} = require('hardhat')

describe('Handler', function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployHandlerFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, worker, user] = await ethers.getSigners()

    const Token = await ethers.getContractFactory('ERC20PresetMinterPauser')
    const token = await Token.deploy('TestToken', 'TT')
    const tokenB = await Token.deploy('TestTokenB', 'TTB')

    const Handler = await ethers.getContractFactory('Handler')
    const handler = await Handler.deploy()
    const Test = await ethers.getContractFactory('Test')
    const test = await Test.deploy()

    // transfer some token to test account
    await token.mint(owner.address, '10000')
    await token.mint(user.address, '10000')
    await token.mint(test.address, '10000')
    await tokenB.mint(owner.address, '10000')
    await tokenB.mint(test.address, '10000')

    // transfer some ETH to test
    await owner.sendTransaction({
      to: test.address,
      value: '10000',
      gasLimit: 2000000,
      gasPrice: 10000000000
    })

    return {token, handler, owner, worker, user, tokenB, test}
  }

  describe('Deposit', function () {
    it('Should revert if transfer amount is 0', async function () {
      const {handler, worker} = await loadFixture(deployHandlerFixture)

      await expect(
        handler.deposit(
          '0x0000000000000000000000000000000000000001',
          '0',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
          worker.address,
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x1234'
        )
      ).to.be.revertedWith('Zero transfer')
    })

    it('Should revert if recipient is empty', async function () {
      const {handler, worker} = await loadFixture(deployHandlerFixture)

      await expect(
        handler.deposit(
          '0x0000000000000000000000000000000000000001',
          '100',
          '0x',
          worker.address,
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x1234'
        )
      ).to.be.revertedWith('Illegal recipient data')
    })

    it('Should revert if worker address is 0', async function () {
      const {handler} = await loadFixture(deployHandlerFixture)

      await expect(
        handler.deposit(
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
      const {handler, worker} = await loadFixture(deployHandlerFixture)

      await expect(
        handler.deposit(
          '0x0000000000000000000000000000000000000001',
          '100',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
          worker.address,
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x'
        )
      ).to.be.revertedWith('Illegal task data')
    })

    it('Deposit should work', async function () {
      const {token, handler, worker, user} = await loadFixture(
        deployHandlerFixture
      )

      // User approve to handler
      token.connect(user).approve(handler.address, '10000')

      await expect(
        handler
          .connect(user)
          .deposit(
            token.address,
            '100',
            '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
            worker.address,
            '0x0000000000000000000000000000000000000000000000000000000000000001',
            '0x1234'
          )
      )
        .to.emit(handler, 'Deposited')
        .withArgs(
          user.address,
          token.address,
          '100',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'
        )
    })

    it('Deposit native should work', async function () {
      const {_token, handler, worker, user} = await loadFixture(
        deployHandlerFixture
      )

      await expect(
        handler
          .connect(user)
          .deposit(
            // address(0), default represent native token
            '0x0000000000000000000000000000000000000000',
            '100',
            '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
            worker.address,
            '0x0000000000000000000000000000000000000000000000000000000000000001',
            '0x1234',
            {
              // Pay native token
              value: '100',
            }
          )
      )
        .to.emit(handler, 'Deposited')
        .withArgs(
          user.address,
          '0x0000000000000000000000000000000000000000',
          '100',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'
        )
    })

    it('Should revert if task is already exist', async function () {
      const {token, handler, worker, user} = await loadFixture(
        deployHandlerFixture
      )

      // User approve to handler
      token.connect(user).approve(handler.address, '10000')

      await expect(
        handler
          .connect(user)
          .deposit(
            token.address,
            '100',
            '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
            worker.address,
            '0x0000000000000000000000000000000000000000000000000000000000000001',
            '0x1234'
          )
      )
        .to.emit(handler, 'Deposited')
        .withArgs(
          user.address,
          token.address,
          '100',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'
        )

      await expect(
        handler
          .connect(user)
          .deposit(
            token.address,
            '100',
            '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
            worker.address,
            '0x0000000000000000000000000000000000000000000000000000000000000001',
            '0x1234'
          )
      ).to.be.revertedWith('Duplicate task')
    })

    it('Should revert if task count exceeds limit', async function () {
      const {token, handler, worker, user} = await loadFixture(
        deployHandlerFixture
      )

      // User approve to handler
      token.connect(user).approve(handler.address, '10000')

      for (let i = 0; i < 10; i++) {
        await expect(
          handler
            .connect(user)
            .deposit(
              token.address,
              '100',
              '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
              worker.address,
              ethers.utils.hexZeroPad(i, 32),
              '0x1234'
            )
        )
          .to.emit(handler, 'Deposited')
          .withArgs(
            user.address,
            token.address,
            '100',
            '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'
          )
      }

      await expect(
        handler
          .connect(user)
          .deposit(
            token.address,
            '100',
            '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
            worker.address,
            '0x0000000000000000000000000000000000000000000000000000000000000010',
            '0x1234'
          )
      ).to.be.revertedWith('Too many tasks')
    })
  })

  describe('Claim', function () {
    it('Should revert if sender is not worker', async function () {
      const {token, handler, worker, user} = await loadFixture(
        deployHandlerFixture
      )

      // Set worker
      await handler.setWorker(worker.address)
      // User approve to handler
      token.connect(user).approve(handler.address, '10000')

      await expect(
        handler
          .connect(user)
          .deposit(
            token.address,
            '100',
            '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
            worker.address,
            '0x0000000000000000000000000000000000000000000000000000000000000001',
            '0x1234'
          )
      )
        .to.emit(handler, 'Deposited')
        .withArgs(
          user.address,
          token.address,
          '100',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'
        )

      await expect(
        handler
          .connect(user)
          .claim(
            '0x0000000000000000000000000000000000000000000000000000000000000001'
          )
      ).to.be.revertedWith('Not worker')
    })

    it('Claim last task should work', async function () {
      const {token, handler, worker, user} = await loadFixture(
        deployHandlerFixture
      )
      // Set worker
      await handler.setWorker(worker.address)
      // User approve to handler
      token.connect(user).approve(handler.address, '10000')

      await expect(
        handler
          .connect(user)
          .deposit(
            token.address,
            '100',
            '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
            worker.address,
            '0x0000000000000000000000000000000000000000000000000000000000000001',
            '0x1234'
          )
      )
        .to.emit(handler, 'Deposited')
        .withArgs(
          user.address,
          token.address,
          '100',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'
        )

      expect(await handler.getNextActivedTask(worker.address)).to.equal(
        '0x0000000000000000000000000000000000000000000000000000000000000001'
      )

      let gas = await handler.connect(worker).estimateGas.claim(
        '0x0000000000000000000000000000000000000000000000000000000000000001'
      )
      // origin: 105285
      console.log(`=====> claim gas cost: ${gas}`)

      await expect(
        handler
          .connect(worker)
          .claim(
            '0x0000000000000000000000000000000000000000000000000000000000000001'
          )
      )
        .to.emit(handler, 'Claimed')
        .withArgs(
          worker.address,
          '0x0000000000000000000000000000000000000000000000000000000000000001'
        )
      expect(await handler.getNextActivedTask(worker.address)).to.equal(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      )
    })

    it('Claim native asset deposit should work', async function () {
      const {_token, handler, worker, user} = await loadFixture(
        deployHandlerFixture
      )
      // Set worker
      await handler.setWorker(worker.address)

      await expect(
        handler
          .connect(user)
          .deposit(
            // address(0), default represent native token
            '0x0000000000000000000000000000000000000000',
            '100',
            '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
            worker.address,
            '0x0000000000000000000000000000000000000000000000000000000000000001',
            '0x1234',
            {
              value: '100',
            }
          )
      )
        .to.emit(handler, 'Deposited')
        .withArgs(
          user.address,
          '0x0000000000000000000000000000000000000000',
          '100',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'
        )

      await expect(
        handler
          .connect(worker)
          .claim(
            '0x0000000000000000000000000000000000000000000000000000000000000001'
          )
      )
        .to.emit(handler, 'Claimed')
        .withArgs(
          worker.address,
          '0x0000000000000000000000000000000000000000000000000000000000000001'
        )
    })
  })

  describe('Drop', function () {
    it('Should revert if sender is not worker', async function () {
      const {token, handler, worker, user} = await loadFixture(
        deployHandlerFixture
      )

      // Set worker
      await handler.setWorker(worker.address)
      // User approve to handler
      token.connect(user).approve(handler.address, '10000')

      await expect(
        handler
          .connect(user)
          .deposit(
            token.address,
            '100',
            '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
            worker.address,
            '0x0000000000000000000000000000000000000000000000000000000000000001',
            '0x1234'
          )
      )
        .to.emit(handler, 'Deposited')
        .withArgs(
          user.address,
          token.address,
          '100',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'
        )

      await expect(
        handler
          .connect(user)
          .drop(
            '0x0000000000000000000000000000000000000000000000000000000000000001'
          )
      ).to.be.revertedWith('Not worker')
    })

    it('Drop task should work', async function () {
      const {token, handler, worker, user} = await loadFixture(
        deployHandlerFixture
      )
      // Set worker
      await handler.setWorker(worker.address)
      // User approve to handler
      token.connect(user).approve(handler.address, '10000')

      await expect(
        handler
          .connect(user)
          .deposit(
            token.address,
            '100',
            '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
            worker.address,
            '0x0000000000000000000000000000000000000000000000000000000000000001',
            '0x1234'
          )
      )
        .to.emit(handler, 'Deposited')
        .withArgs(
          user.address,
          token.address,
          '100',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'
        )

      expect(await handler.getNextActivedTask(worker.address)).to.equal(
        '0x0000000000000000000000000000000000000000000000000000000000000001'
      )
      expect(await token.balanceOf(user.address)).to.equal('9900')

      await expect(
        handler
          .connect(worker)
          .drop(
            '0x0000000000000000000000000000000000000000000000000000000000000001'
          )
      )
        .to.emit(handler, 'Dropped')
        .withArgs(
          worker.address,
          '0x0000000000000000000000000000000000000000000000000000000000000001'
        )
      expect(await handler.getNextActivedTask(worker.address)).to.equal(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      )
      expect(await token.balanceOf(user.address)).to.equal('10000')
    })

    it('Drop native asset deposit task should work', async function () {
      const {_token, handler, worker, user} = await loadFixture(
        deployHandlerFixture
      )
      // Set worker
      await handler.setWorker(worker.address)

      await expect(
        handler
          .connect(user)
          .deposit(
            // address(0), default represent native token
            '0x0000000000000000000000000000000000000000',
            '100',
            '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
            worker.address,
            '0x0000000000000000000000000000000000000000000000000000000000000001',
            '0x1234',
            {
              value: '100'
            }
          )
      )
        .to.emit(handler, 'Deposited')
        .withArgs(
          user.address,
          '0x0000000000000000000000000000000000000000',
          '100',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'
        )

      await expect(
        handler
          .connect(worker)
          .drop(
            '0x0000000000000000000000000000000000000000000000000000000000000001'
          )
      )
        .to.emit(handler, 'Dropped')
        .withArgs(
          worker.address,
          '0x0000000000000000000000000000000000000000000000000000000000000001'
        )
      expect(await handler.getNextActivedTask(worker.address)).to.equal(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      )
    })
  })

  describe('Batch call', function () {
    it('Batchcall should work', async function () {
      const {token, handler, owner, worker, user, tokenB, test} =
        await loadFixture(deployHandlerFixture)

      // Construct call data
      // The call are as follows:
      let callDataClaimToken = test.interface.encodeFunctionData('claim', [
        token.address,
        '400',
      ])
      let callDataSwapTokenToTokenB = test.interface.encodeFunctionData('swap', [
        token.address,
        tokenB.address,
        '10000',
      ])
      let callDataSwapTokenBToNative = test.interface.encodeFunctionData('swapToNative', [
        tokenB.address,
        '10000',
      ])
      let callDataSwapNativeToTokenB = test.interface.encodeFunctionData('swapNative', [
        tokenB.address,
      ])
      let callDataDoNothing = test.interface.encodeFunctionData('doNothing', [
        '10000',
      ])
      let callDataBridge = test.interface.encodeFunctionData('bridge', [
        tokenB.address,
        '10000',
      ])

      // Set worker
      await handler.setWorker(worker.address)
      // Transfer some token to handler
      token.connect(owner).transfer(handler.address, '500')

      let arguments = [
        [
          test.address,
          callDataDoNothing,
          '0',

          false,
          // No need to update at first call
          '0',
          '0',
          '0x0000000000000000000000000000000000000000',
          token.address,
          // We don't need to spend any asset because we do claim that will be sent asset
          '0',
          token.address,
          // Will be ingored because this is the first call
          '0',
          '0',
        ],
        // Test -> Handler: 400 TT
        [
          test.address,
          callDataClaimToken,
          '0',

          true,
          // No need to update at first call
          '0',
          '0',
          '0x0000000000000000000000000000000000000000',
          token.address,
          // We don't need to spend any asset because we do claim that will be sent asset
          '0',
          token.address,
          // Will be ingored because this is the first call
          '0',
          '1',
        ],
        // Handler -> Test: 400 TT
        // Test -> Handler: 200 TTB
        [
          test.address,
          callDataSwapTokenToTokenB,
          '0',

          true,
          '68',
          '32',
          test.address,
          token.address,
          '10000',
          tokenB.address,
          // Use the claim  call output as input
          '1',
          '2',
        ],
        // Do nothing
        [
          test.address,
          callDataDoNothing,
          '0',

          false,
          '4',
          '32',
          '0x0000000000000000000000000000000000000000',
          tokenB.address,
          '10000',
          tokenB.address,
          // Use the swap call output as input
          '2',
          '3',
        ],
        // TokenB (200) -> Native (100)
        [
          test.address,
          callDataSwapTokenBToNative,
          // spend 100 wei native asset
          '0',

          true,
          '36',
          '32',
          test.address,
          tokenB.address,
          '100',
          '0x0000000000000000000000000000000000000000',
          // User first swap output as input
          '2',
          '4',
        ],
        // Native (100) -> TokenB (200)
        [
          test.address,
          callDataSwapNativeToTokenB,
          // spend 100 wei native asset
          '10000',

          true,
          '0',
          '0',
          '0x0000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000',
          '100',
          tokenB.address,
          // Use last call as input
          '4',
          '5',
        ],
        // Handler -> Test: 100 TTB
        [
          test.address,
          callDataBridge,
          '0',

          // No need to settle on last call
          false,
          '36',
          '32',
          test.address,
          tokenB.address,
          '10000',
          tokenB.address,
          // Still use the swap call output as input
          '5',
          '6',
        ],
      ]
      let gas = await handler.connect(worker).estimateGas.batchCall(arguments, {
        value: '1',
      })
      // origin: 436489
      // after remove approve: 383434
      // after change call struct data type: 388482,
      console.log(`=====> batchCall gas cost: ${gas}`)
      // Batch call
      await expect(
        handler.connect(worker).batchCall(arguments,
        {
          value: '1',
        })
      )
        .to.emit(test, 'Nothing')
        .to.emit(test, 'Claim')
        .withArgs(token.address, '400')
        .to.emit(test, 'Swap')
        .withArgs(token.address, tokenB.address, '400', '200')
        .to.emit(test, 'Nothing')
        .to.emit(test, 'SwapToNative')
        .withArgs(tokenB.address, '200', '100')
        .to.emit(test, 'SwapNative')
        .withArgs(tokenB.address, '100', '200')
        .to.emit(test, 'Bridge')
        .withArgs(tokenB.address, '200')
    })
  })
})
