import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { utils } from 'ethers'
import { expect } from 'chai'
import HRE, { waffle } from 'hardhat'

import { IERC20Metadata__factory, MockToken18, MockToken18__factory } from '../../../types/generated'
import { MockContract } from '@ethereum-waffle/mock-contract'

const { ethers } = HRE

const ETHER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

describe('Token18', () => {
  let user: SignerWithAddress
  let recipient: SignerWithAddress
  let token18: MockToken18
  let token: MockContract

  beforeEach(async () => {
    ;[user, recipient] = await ethers.getSigners()
    token18 = await new MockToken18__factory(user).deploy()
    token = await waffle.deployMockContract(user, IERC20Metadata__factory.abi)
  })

  describe('#ether', async () => {
    it('returns zero', async () => {
      expect(await token18.etherToken()).to.equal(ETHER)
    })
  })

  describe('#isEther', async () => {
    it('returns true', async () => {
      expect(await token18.isEther(ETHER)).to.equal(true)
    })

    it('returns false', async () => {
      expect(await token18.isEther(token.address)).to.equal(false)
    })
  })

  describe('#push', async () => {
    it('transfers tokens (12)', async () => {
      await token.mock.decimals.withArgs().returns(12)
      await token.mock.transfer.withArgs(recipient.address, utils.parseEther('100').div(1000000)).returns(true)

      await token18
        .connect(user)
        ['push(address,address,uint256)'](token.address, recipient.address, utils.parseEther('100'))
    })

    it('transfers tokens (18)', async () => {
      await token.mock.decimals.withArgs().returns(18)
      await token.mock.transfer.withArgs(recipient.address, utils.parseEther('100')).returns(true)

      await token18
        .connect(user)
        ['push(address,address,uint256)'](token.address, recipient.address, utils.parseEther('100'))
    })

    it('transfers tokens (24)', async () => {
      await token.mock.decimals.withArgs().returns(24)
      await token.mock.transfer.withArgs(recipient.address, utils.parseEther('100').mul(1000000)).returns(true)

      await token18
        .connect(user)
        ['push(address,address,uint256)'](token.address, recipient.address, utils.parseEther('100'))
    })

    it('transfers tokens (ether)', async () => {
      const recipientBefore = await recipient.getBalance()
      await user.sendTransaction({ to: token18.address, value: ethers.utils.parseEther('100') })
      await token18.connect(user)['push(address,address,uint256)'](ETHER, recipient.address, utils.parseEther('100'))
      expect(await recipient.getBalance()).to.equal(recipientBefore.add(ethers.utils.parseEther('100')))
    })

    it('transfers tokens all (12)', async () => {
      await token.mock.decimals.withArgs().returns(12)
      await token.mock.balanceOf.withArgs(token18.address).returns(utils.parseEther('100').div(1000000))
      await token.mock.transfer.withArgs(recipient.address, utils.parseEther('100').div(1000000)).returns(true)

      await token18.connect(user)['push(address,address)'](token.address, recipient.address)
    })

    it('transfers tokens all (18)', async () => {
      await token.mock.decimals.withArgs().returns(18)
      await token.mock.balanceOf.withArgs(token18.address).returns(utils.parseEther('100'))
      await token.mock.transfer.withArgs(recipient.address, utils.parseEther('100')).returns(true)

      await token18.connect(user)['push(address,address)'](token.address, recipient.address)
    })

    it('transfers tokens all (24)', async () => {
      await token.mock.decimals.withArgs().returns(24)
      await token.mock.balanceOf.withArgs(token18.address).returns(utils.parseEther('100').mul(1000000))
      await token.mock.transfer.withArgs(recipient.address, utils.parseEther('100').mul(1000000)).returns(true)

      await token18.connect(user)['push(address,address)'](token.address, recipient.address)
    })

    it('transfers tokens all (ether)', async () => {
      const recipientBefore = await recipient.getBalance()
      await user.sendTransaction({ to: token18.address, value: ethers.utils.parseEther('100') })
      await token18.connect(user)['push(address,address)'](ETHER, recipient.address)
      expect(await recipient.getBalance()).to.equal(recipientBefore.add(ethers.utils.parseEther('100')))
    })
  })

  describe('#pull', async () => {
    it('transfers tokens (12)', async () => {
      await token.mock.decimals.withArgs().returns(12)
      await token.mock.allowance.withArgs(user.address, token18.address).returns(utils.parseEther('100'))
      await token.mock.transferFrom
        .withArgs(user.address, token18.address, utils.parseEther('100').div(1000000))
        .returns(true)

      await token18.connect(user).pull(token.address, user.address, utils.parseEther('100'))
    })

    it('transfers tokens (18)', async () => {
      await token.mock.decimals.withArgs().returns(18)
      await token.mock.allowance.withArgs(user.address, token18.address).returns(utils.parseEther('100'))
      await token.mock.transferFrom.withArgs(user.address, token18.address, utils.parseEther('100')).returns(true)

      await token18.connect(user).pull(token.address, user.address, utils.parseEther('100'))
    })

    it('transfers tokens (24)', async () => {
      await token.mock.decimals.withArgs().returns(24)
      await token.mock.allowance.withArgs(user.address, token18.address).returns(utils.parseEther('100'))
      await token.mock.transferFrom
        .withArgs(user.address, token18.address, utils.parseEther('100').mul(1000000))
        .returns(true)

      await token18.connect(user).pull(token.address, user.address, utils.parseEther('100'))
    })

    it('transfers tokens (ether)', async () => {
      await expect(token18.connect(user).pull(ETHER, user.address, utils.parseEther('100'))).to.be.revertedWith(
        'Token18PullEtherError()',
      )
    })
  })

  describe('#pullTo', async () => {
    it('transfers tokens (12)', async () => {
      await token.mock.decimals.withArgs().returns(12)
      await token.mock.allowance.withArgs(user.address, recipient.address).returns(utils.parseEther('100'))
      await token.mock.transferFrom
        .withArgs(user.address, recipient.address, utils.parseEther('100').div(1000000))
        .returns(true)

      await token18.connect(user).pullTo(token.address, user.address, recipient.address, utils.parseEther('100'))
    })

    it('transfers tokens (18)', async () => {
      await token.mock.decimals.withArgs().returns(18)
      await token.mock.allowance.withArgs(user.address, recipient.address).returns(utils.parseEther('100'))
      await token.mock.transferFrom.withArgs(user.address, recipient.address, utils.parseEther('100')).returns(true)

      await token18.connect(user).pullTo(token.address, user.address, recipient.address, utils.parseEther('100'))
    })

    it('transfers tokens (24)', async () => {
      await token.mock.decimals.withArgs().returns(24)
      await token.mock.allowance.withArgs(user.address, recipient.address).returns(utils.parseEther('100'))
      await token.mock.transferFrom
        .withArgs(user.address, recipient.address, utils.parseEther('100').mul(1000000))
        .returns(true)

      await token18.connect(user).pullTo(token.address, user.address, recipient.address, utils.parseEther('100'))
    })

    it('transfers tokens (ether)', async () => {
      await expect(
        token18.connect(user).pullTo(ETHER, user.address, recipient.address, utils.parseEther('100')),
      ).to.be.revertedWith('Token18PullEtherError()')
    })
  })

  describe('#name', async () => {
    it('returns name', async () => {
      await token.mock.name.withArgs().returns('Token Name')
      expect(await token18.connect(user).name(token.address)).to.equal('Token Name')
    })

    it('returns name (ether)', async () => {
      expect(await token18.connect(user).name(ETHER)).to.equal('Ether')
    })
  })

  describe('#symbol', async () => {
    it('returns symbol', async () => {
      await token.mock.symbol.withArgs().returns('TN')
      expect(await token18.connect(user).symbol(token.address)).to.equal('TN')
    })

    it('returns symbol (ether)', async () => {
      expect(await token18.connect(user).symbol(ETHER)).to.equal('ETH')
    })
  })

  describe('#decimals', async () => {
    it('returns decimals', async () => {
      await token.mock.decimals.withArgs().returns(18)
      expect(await token18.connect(user).decimals(token.address)).to.equal(18)
    })

    it('returns decimals (ether)', async () => {
      expect(await token18.connect(user).decimals(ETHER)).to.equal(18)
    })
  })

  describe('#balanceOf', async () => {
    it('returns balanceOf', async () => {
      await token.mock.decimals.withArgs().returns(12)
      await token.mock.balanceOf.withArgs(user.address).returns(utils.parseEther('100').div(1000000))
      expect(await token18.connect(user)['balanceOf(address,address)'](token.address, user.address)).to.equal(
        utils.parseEther('100'),
      )
    })

    it('returns balanceOf', async () => {
      await token.mock.decimals.withArgs().returns(18)
      await token.mock.balanceOf.withArgs(user.address).returns(utils.parseEther('100'))
      expect(await token18.connect(user)['balanceOf(address,address)'](token.address, user.address)).to.equal(
        utils.parseEther('100'),
      )
    })

    it('returns balanceOf', async () => {
      await token.mock.decimals.withArgs().returns(24)
      await token.mock.balanceOf.withArgs(user.address).returns(utils.parseEther('100').mul(1000000))
      expect(await token18.connect(user)['balanceOf(address,address)'](token.address, user.address)).to.equal(
        utils.parseEther('100'),
      )
    })

    it('returns balanceOf (ether)', async () => {
      expect(await token18.connect(user)['balanceOf(address,address)'](ETHER, token18.address)).to.equal(
        utils.parseEther('0'),
      )
      await user.sendTransaction({ to: token18.address, value: ethers.utils.parseEther('100') })
      expect(await token18.connect(user)['balanceOf(address,address)'](ETHER, token18.address)).to.equal(
        utils.parseEther('100'),
      )
    })
  })

  describe('#balanceOf', async () => {
    it('returns balanceOf', async () => {
      await token.mock.decimals.withArgs().returns(12)
      await token.mock.balanceOf.withArgs(token18.address).returns(utils.parseEther('100').div(1000000))
      expect(await token18.connect(user)['balanceOf(address)'](token.address)).to.equal(utils.parseEther('100'))
    })

    it('returns balanceOf', async () => {
      await token.mock.decimals.withArgs().returns(18)
      await token.mock.balanceOf.withArgs(token18.address).returns(utils.parseEther('100'))
      expect(await token18.connect(user)['balanceOf(address)'](token.address)).to.equal(utils.parseEther('100'))
    })

    it('returns balanceOf', async () => {
      await token.mock.decimals.withArgs().returns(24)
      await token.mock.balanceOf.withArgs(token18.address).returns(utils.parseEther('100').mul(1000000))
      expect(await token18.connect(user)['balanceOf(address)'](token.address)).to.equal(utils.parseEther('100'))
    })

    it('returns balanceOf (ether)', async () => {
      await user.sendTransaction({ to: token18.address, value: ethers.utils.parseEther('100') })
      expect(await token18.connect(user)['balanceOf(address)'](ETHER)).to.equal(utils.parseEther('100'))
    })
  })
})
