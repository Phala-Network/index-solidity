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
    const Handler = await ethers.getContractFactory('Handler')
    const handler = await Handler.deploy()

    // transfer some token to test account
    await token.mint(owner.address, '10000')
    await token.mint(user.address, '10000')
    return {token, handler, owner, worker, user}
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

    it('Claim multiple tasks should work', async function () {
      const {token, handler, worker, user} = await loadFixture(
        deployHandlerFixture
      )
      // Set worker
      await handler.setWorker(worker.address)
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

      expect((await handler.getActivedTasks(worker.address)).length).to.equal(
        10
      )

      await handler.connect(worker).claimAll()
      expect((await handler.getActivedTasks(worker.address)).length).to.equal(0)
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
})
