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

    return {token, handler, owner, worker, user, tokenB, test}
  }

  describe('Deposit', function () {
    it('Should revert if token address is 0', async function () {
      const {handler, worker} = await loadFixture(deployHandlerFixture)

      await expect(
        handler.deposit(
          '0x0000000000000000000000000000000000000000',
          '100',
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
          worker.address,
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x1234'
        )
      ).to.be.revertedWith('Illegal token address')
    })

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
          ''
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
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
          '0x1234'
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
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
          '0x1234'
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
            '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
            '0x1234'
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
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
          '0x1234'
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
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
          '0x1234'
        )

      expect(await handler.getLastActivedTask(worker.address)).to.equal(
        '0x0000000000000000000000000000000000000000000000000000000000000001'
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
      expect(await handler.getLastActivedTask(worker.address)).to.equal(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
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
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
          '0x1234'
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
          '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
          '0x1234'
        )

      expect(await handler.getLastActivedTask(worker.address)).to.equal(
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
      expect(await handler.getLastActivedTask(worker.address)).to.equal(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      )
      expect(await token.balanceOf(user.address)).to.equal('10000')
    })
  })

  // Test contract: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
  // Handler contract: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
  // token contract: 0x5FbDB2315678afecb367f032d93F642f64180aa3
  // tokenB contract: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
  // owner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  // callDataClaim: 0xaad3ec960000000000000000000000005fbdb2315678afecb367f032d93f642f64180aa300000000000000000000000000000000000000000000000000000000000000c8
  // callDataTokenApprove: 0x095ea7b3000000000000000000000000cf7ed3acca5a467e9e704c703e8d87f634fb0fc90000000000000000000000000000000000000000000000000000000000002710
  // callDataSwap: 0xdf791e500000000000000000000000005fbdb2315678afecb367f032d93f642f64180aa3000000000000000000000000e7f1725e7734ce288f8367e1bb143e90bb3f05120000000000000000000000000000000000000000000000000000000000002710
  // callDataDoNothing: 0xdce1d5ba0000000000000000000000000000000000000000000000000000000000002710
  // callDataTokenBApprove: 0x095ea7b3000000000000000000000000cf7ed3acca5a467e9e704c703e8d87f634fb0fc90000000000000000000000000000000000000000000000000000000000002710
  // callDataBridge: 0xc3de453d000000000000000000000000e7f1725e7734ce288f8367e1bb143e90bb3f05120000000000000000000000000000000000000000000000000000000000002710
  // ===> Start execute call:  0
  // ===> Ready to execute call
  // ---> claim:  0x5fbdb2315678afecb367f032d93f642f64180aa3 200
  // ---> claim details: 0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0 0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9 10000
  // ---> claim done
  // ===> Execute result:  true
  // ===> Return data:
  // 0x
  // ===> Call 0 been settled:  200
  // ===> Start execute call:  1
  // ===> Update settleAmount to calldata from offset:  200
  // ===> Calldata before update:
  // 0x095ea7b3000000000000000000000000cf7ed3acca5a467e9e704c703e8d87f634fb0fc90000000000000000000000000000000000000000000000000000000000002710
  // ===> Calldata after update:
  // 0x095ea7b3000000000000000000000000cf7ed3acca5a467e9e704c703e8d87f634fb0fc900000000000000000000000000000000000000000000000000000000000000c8
  // ===> Ready to execute call
  // ===> Execute result:  true
  // ===> Return data:
  // 0x0000000000000000000000000000000000000000000000000000000000000001
  // ===> Start execute call:  2
  // ===> Update settleAmount to calldata from offset:  200
  // ===> Calldata before update:
  // 0xdf791e500000000000000000000000005fbdb2315678afecb367f032d93f642f64180aa3000000000000000000000000e7f1725e7734ce288f8367e1bb143e90bb3f05120000000000000000000000000000000000000000000000000000000000002710
  // ===> Calldata after update:
  // 0xdf791e500000000000000000000000005fbdb2315678afecb367f032d93f642f64180aa3000000000000000000000000e7f1725e7734ce288f8367e1bb143e90bb3f051200000000000000000000000000000000000000000000000000000000000000c8
  // ===> Ready to execute call
  // ---> swap:  0x5fbdb2315678afecb367f032d93f642f64180aa3 0xe7f1725e7734ce288f8367e1bb143e90bb3f0512 200
  // ---> swap done
  // ===> Execute result:  true
  // ===> Return data:
  // 0x
  // ===> Call 2 been settled:  100
  // ===> Start execute call:  3
  // ===> Update settleAmount to calldata from offset:  100
  // ===> Calldata before update:
  // 0xdce1d5ba0000000000000000000000000000000000000000000000000000000000002710
  // ===> Calldata after update:
  // 0xdce1d5ba0000000000000000000000000000000000000000000000000000000000000064
  // ===> Ready to execute call
  // ===> Execute result:  true
  // ===> Return data:
  // 0x
  // ===> Start execute call:  4
  // ===> Update settleAmount to calldata from offset:  100
  // ===> Calldata before update:
  // 0x095ea7b3000000000000000000000000cf7ed3acca5a467e9e704c703e8d87f634fb0fc90000000000000000000000000000000000000000000000000000000000002710
  // ===> Calldata after update:
  // 0x095ea7b3000000000000000000000000cf7ed3acca5a467e9e704c703e8d87f634fb0fc90000000000000000000000000000000000000000000000000000000000000064
  // ===> Ready to execute call
  // ===> Execute result:  true
  // ===> Return data:
  // 0x0000000000000000000000000000000000000000000000000000000000000001
  // ===> Start execute call:  5
  // ===> Update settleAmount to calldata from offset:  100
  // ===> Calldata before update:
  // 0xc3de453d000000000000000000000000e7f1725e7734ce288f8367e1bb143e90bb3f05120000000000000000000000000000000000000000000000000000000000002710
  // ===> Calldata after update:
  // 0xc3de453d000000000000000000000000e7f1725e7734ce288f8367e1bb143e90bb3f05120000000000000000000000000000000000000000000000000000000000000064
  // ===> Ready to execute call
  // ---> bridge:  0xe7f1725e7734ce288f8367e1bb143e90bb3f0512 100
  // ---> bridge done
  // ===> Execute result:  true
  // ===> Return data:
  // 0x
  describe('Batch call', function () {
    it('Batchcall should work', async function () {
      const {token, handler, owner, worker, user, tokenB, test} =
        await loadFixture(deployHandlerFixture)

      console.log(`Test contract: ${test.address}`)
      console.log(`Handler contract: ${handler.address}`)
      console.log(`token contract: ${token.address}`)
      console.log(`tokenB contract: ${tokenB.address}`)
      console.log(`owner: ${owner.address}`)

      // Construct call data
      // The call are as follows:
      // [Test.claim(), TokenA.Approve(), Test.swap(), Test.doNothing(), TokenB.approve(), Test.bridge()]
      let callDataClaim = test.interface.encodeFunctionData('claim', [
        token.address,
        '200',
      ])
      let callDataTokenApprove = token.interface.encodeFunctionData('approve', [
        test.address,
        '10000',
      ])
      let callDataSwap = test.interface.encodeFunctionData('swap', [
        token.address,
        tokenB.address,
        '10000',
      ])
      let callDataDoNothing = test.interface.encodeFunctionData('doNothing', [
        '10000',
      ])
      let callDataTokenBApprove = tokenB.interface.encodeFunctionData(
        'approve',
        [test.address, '10000']
      )
      let callDataBridge = test.interface.encodeFunctionData('bridge', [
        tokenB.address,
        '10000',
      ])

      console.log(`callDataClaim: ${callDataClaim}`)
      console.log(`callDataTokenApprove: ${callDataTokenApprove}`)
      console.log(`callDataSwap: ${callDataSwap}`)
      console.log(`callDataDoNothing: ${callDataDoNothing}`)
      console.log(`callDataTokenBApprove: ${callDataTokenBApprove}`)
      console.log(`callDataBridge: ${callDataBridge}`)

      // Set worker
      await handler.setWorker(worker.address)
      // Transfer some token to handler
      token.connect(owner).transfer(handler.address, '500')

      // Batch call
      await expect(
        handler.connect(worker).batchCall([
          // Test -> Handler: 200 TT
          [
            test.address,
            callDataClaim,
            '0',

            true,
            // No need to update at first call
            '0',
            '0',
            token.address,
            // We don't need to spend any asset because we do claim that will be sent asset
            '0',
            token.address,
            // Will be ingored because this is the first call
            '0',
            '0',
          ],
          // Token(Handler).approve(Test, 200 TT)
          [
            token.address,
            callDataTokenApprove,
            '0',

            false,
            '36',
            '32',
            token.address,
            '10000',
            token.address,
            // Use the claim  call output as input
            '0',
            '1',
          ],
          // Handler -> Test: 200 TT
          // Test -> Handler: 100 TTB
          [
            test.address,
            callDataSwap,
            '0',

            true,
            '68',
            '32',
            token.address,
            '10000',
            tokenB.address,
            // Use the claim  call output as input
            '0',
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
            tokenB.address,
            '10000',
            tokenB.address,
            // Use the swap call output as input
            '2',
            '3',
          ],
          // TokenB(Hanler).approve(Test, 100 TTB)
          [
            tokenB.address,
            callDataTokenBApprove,
            '0',

            false,
            '36',
            '32',
            tokenB.address,
            '10000',
            tokenB.address,
            // Use the swap  call output as input
            '2',
            '4',
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
            tokenB.address,
            '10000',
            tokenB.address,
            // Still use the swap call output as input
            '2',
            '5',
          ],
        ])
      )
        .to.emit(test, 'Claim')
        .withArgs(token.address, '200')
        .to.emit(test, 'Swap')
        .withArgs(token.address, tokenB.address, '200', '100')
        .to.emit(test, 'Nothing')
        .withArgs('100')
        .to.emit(test, 'Bridge')
        .withArgs(tokenB.address, '100')
    })
  })
})
