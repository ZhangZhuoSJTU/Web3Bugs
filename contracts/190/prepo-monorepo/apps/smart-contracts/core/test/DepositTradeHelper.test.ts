import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { formatBytes32String, id, parseEther, parseUnits } from 'ethers/lib/utils'
import { BigNumber, Contract } from 'ethers'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import { utils } from 'prepo-hardhat'
import { JUNK_ADDRESS } from 'prepo-constants'
import { getPermitFromSignature } from './utils'
import { Core } from './harness/core'
import { depositTradeHelperFixture } from './fixtures/DepositTradeHelperFixture'
import { fakeSwapRouterFixture } from './fixtures/UniswapFixtures'
import { DepositTradeHelper } from '../typechain'
import { OffChainTradeParamsStruct, PermitStruct } from '../typechain/DepositTradeHelper'

const { getLastTimestamp, setNextTimestamp } = utils

chai.use(smock.matchers)

describe('=> DepositTradeHelper', () => {
  let core: Core
  let swapRouter: FakeContract<Contract>
  let depositTradeHelper: DepositTradeHelper
  let deployer: SignerWithAddress
  let user: SignerWithAddress

  const junkPermit = <PermitStruct>{
    deadline: 0,
    v: 0,
    r: formatBytes32String('JUNK_DATA'),
    s: formatBytes32String('JUNK_DATA'),
  }

  const junkTradeParams = <OffChainTradeParamsStruct>{
    tokenOut: JUNK_ADDRESS,
    deadline: 0,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  }

  beforeEach(async () => {
    core = await Core.Instance.init(ethers, true)
    ;[deployer, user] = core.accounts
    swapRouter = await fakeSwapRouterFixture()
    depositTradeHelper = await depositTradeHelperFixture(
      core.collateral.address,
      swapRouter.address
    )
  })

  describe('initial state', () => {
    it('sets collateral from constructor', async () => {
      expect(await depositTradeHelper.getCollateral()).to.eq(core.collateral.address)
    })

    it('sets base token from collateral', async () => {
      expect(await depositTradeHelper.getBaseToken()).to.eq(core.baseToken.address)
    })

    it('sets swap router from constructor', async () => {
      expect(await depositTradeHelper.getSwapRouter()).to.eq(swapRouter.address)
    })

    it('gives collateral contract unlimited base token approval', async () => {
      expect(
        await core.baseToken.allowance(depositTradeHelper.address, core.collateral.address)
      ).to.eq(ethers.constants.MaxUint256)
    })

    it('gives swap router unlimited collateral approval', async () => {
      expect(await core.collateral.allowance(depositTradeHelper.address, swapRouter.address)).to.eq(
        ethers.constants.MaxUint256
      )
    })
  })

  describe('# depositAndTrade', () => {
    let baseToken: MockContract
    let collateral: MockContract
    let depositHook: MockContract
    const baseTokenToDeposit = parseEther('1')
    beforeEach(async () => {
      baseToken = core.baseToken as MockContract
      collateral = core.collateral as MockContract
      depositHook = core.collateral.depositHook as MockContract
      await baseToken.mint(user.address, baseTokenToDeposit)
      depositHook.hook.returns()
    })

    it('reverts if insufficient base token approval', async () => {
      expect(await baseToken.allowance(user.address, depositTradeHelper.address)).to.be.lt(
        baseTokenToDeposit
      )

      await expect(
        depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, junkPermit, junkPermit, junkTradeParams)
      ).revertedWith('ERC20: insufficient allowance')
    })

    it('reverts if insufficient collateral approval', async () => {
      // Can just statically call for expected amount instead of rewriting calculation logic
      await baseToken.connect(user).approve(collateral.address, baseTokenToDeposit)
      const expectedCT = await collateral
        .connect(user)
        .callStatic.deposit(user.address, baseTokenToDeposit)
      await baseToken.connect(user).approve(collateral.address, 0)
      await baseToken.connect(user).approve(depositTradeHelper.address, baseTokenToDeposit)
      expect(await collateral.allowance(user.address, depositTradeHelper.address)).to.be.lt(
        expectedCT
      )

      await expect(
        depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, junkPermit, junkPermit, junkTradeParams)
      ).revertedWith('ERC20: insufficient allowance')
    })

    describe('permit testing', () => {
      it('ignores base token approval if deadline = 0', async () => {
        await baseToken.connect(user).approve(depositTradeHelper.address, baseTokenToDeposit)
        expect(junkPermit.deadline).to.eq(0)
        const timestampToSignFor = (await getLastTimestamp(ethers.provider)) + 5
        const collateralPermit = await getPermitFromSignature(
          collateral,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          timestampToSignFor
        )
        await setNextTimestamp(ethers.provider, timestampToSignFor)

        const tx = await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, junkPermit, collateralPermit, junkTradeParams)

        expect(tx).to.not.emit(core.baseToken, 'Approval')
        expect(await core.baseToken.allowance(user.address, depositTradeHelper.address)).to.eq(0)
      })

      it('ignores collateral approval if deadline = 0', async () => {
        await collateral.connect(user).approve(depositTradeHelper.address, baseTokenToDeposit)
        expect(junkPermit.deadline).to.eq(0)
        const timestampToSignFor = (await getLastTimestamp(ethers.provider)) + 5
        const baseTokenPermit = await getPermitFromSignature(
          baseToken,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          timestampToSignFor
        )
        await setNextTimestamp(ethers.provider, timestampToSignFor)

        const tx = await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, baseTokenPermit, junkPermit, junkTradeParams)

        expect(tx).to.not.emit(core.collateral, 'Approval')
        expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).to.eq(0)
      })

      it('ignores both permits if deadlines = 0', async () => {
        await baseToken.connect(user).approve(depositTradeHelper.address, baseTokenToDeposit)
        await collateral.connect(user).approve(depositTradeHelper.address, baseTokenToDeposit)
        expect(junkPermit.deadline).to.eq(0)

        const tx = await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, junkPermit, junkPermit, junkTradeParams)

        expect(tx).to.not.emit(core.baseToken, 'Approval')
        expect(tx).to.not.emit(core.collateral, 'Approval')
        expect(await core.baseToken.allowance(user.address, depositTradeHelper.address)).to.eq(0)
        expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).to.eq(0)
      })

      it('processes base token approval permit from user', async () => {
        await collateral.connect(user).approve(depositTradeHelper.address, baseTokenToDeposit)
        expect(await core.baseToken.allowance(user.address, depositTradeHelper.address)).to.eq(0)
        const timestampToSignFor = (await getLastTimestamp(ethers.provider)) + 5
        const baseTokenPermit = await getPermitFromSignature(
          baseToken,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          timestampToSignFor
        )
        await setNextTimestamp(ethers.provider, timestampToSignFor)

        await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, baseTokenPermit, junkPermit, junkTradeParams)

        expect(await core.baseToken.allowance(user.address, depositTradeHelper.address)).to.eq(
          ethers.constants.MaxUint256
        )
      })

      it('processes collateral approval permit from user', async () => {
        await baseToken.connect(user).approve(depositTradeHelper.address, baseTokenToDeposit)
        expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).to.eq(0)
        const timestampToSignFor = (await getLastTimestamp(ethers.provider)) + 5
        const collateralPermit = await getPermitFromSignature(
          collateral,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          timestampToSignFor
        )
        await setNextTimestamp(ethers.provider, timestampToSignFor)

        await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, junkPermit, collateralPermit, junkTradeParams)

        expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).to.eq(
          ethers.constants.MaxUint256
        )
      })

      it('processes both permits', async () => {
        expect(await core.baseToken.allowance(user.address, depositTradeHelper.address)).to.eq(0)
        expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).to.eq(0)
        const timestampToSignFor = (await getLastTimestamp(ethers.provider)) + 5
        const baseTokenPermit = await getPermitFromSignature(
          baseToken,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          timestampToSignFor
        )
        const collateralPermit = await getPermitFromSignature(
          collateral,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          timestampToSignFor
        )
        await setNextTimestamp(ethers.provider, timestampToSignFor)

        await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, baseTokenPermit, collateralPermit, junkTradeParams)

        expect(await core.baseToken.allowance(user.address, depositTradeHelper.address)).to.eq(
          ethers.constants.MaxUint256
        )
        expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).to.eq(
          ethers.constants.MaxUint256
        )
      })
    })

    describe('if all permits provided', () => {
      let baseTokenPermit: PermitStruct
      let collateralPermit: PermitStruct
      let timestampToSignFor: number
      beforeEach(async () => {
        timestampToSignFor = (await getLastTimestamp(ethers.provider)) + 5
        baseTokenPermit = await getPermitFromSignature(
          baseToken,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          timestampToSignFor
        )
        collateralPermit = await getPermitFromSignature(
          collateral,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          timestampToSignFor
        )
      })

      it('reverts if insufficient base token', async () => {
        const userBTBalanceBefore = await baseToken.balanceOf(user.address)
        await setNextTimestamp(ethers.provider, timestampToSignFor)

        await expect(
          depositTradeHelper
            .connect(user)
            .depositAndTrade(
              userBTBalanceBefore.add(1),
              baseTokenPermit,
              collateralPermit,
              junkTradeParams
            )
        ).revertedWith('ERC20: transfer amount exceeds balance')
      })

      it('takes `baseTokenAmount` from user prior to minting Collateral', async () => {
        const userBTBalanceBefore = await baseToken.balanceOf(user.address)
        await setNextTimestamp(ethers.provider, timestampToSignFor)

        await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, baseTokenPermit, collateralPermit, junkTradeParams)

        expect(await baseToken.balanceOf(user.address)).to.be.eq(
          userBTBalanceBefore.sub(baseTokenToDeposit)
        )
        expect(baseToken.transferFrom.atCall(0)).calledWith(
          user.address,
          depositTradeHelper.address,
          baseTokenToDeposit
        )
        expect(baseToken.transferFrom).calledBefore(collateral.deposit)
      })

      it('mints Collateral to user prior to transferring back', async () => {
        await setNextTimestamp(ethers.provider, timestampToSignFor)

        await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, baseTokenPermit, collateralPermit, junkTradeParams)

        expect(collateral.deposit.atCall(0)).calledWith(user.address, baseTokenToDeposit)
        expect(collateral.deposit).calledBefore(collateral.transferFrom)
      })

      it('transfers newly minted Collateral back prior to calling swap', async () => {
        await setNextTimestamp(ethers.provider, timestampToSignFor)

        await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, baseTokenPermit, collateralPermit, junkTradeParams)

        expect(collateral.transferFrom.atCall(0)).calledWith(
          user.address,
          depositTradeHelper.address,
          baseTokenToDeposit
        )
        expect(collateral.transferFrom).calledBefore(swapRouter.exactInputSingle)
      })

      it('calls swap router with correct parameters', async () => {
        await baseToken.connect(user).approve(collateral.address, baseTokenToDeposit)
        const expectedCT = await collateral
          .connect(user)
          .callStatic.deposit(user.address, baseTokenToDeposit)
        const nonZeroTradeParams = <OffChainTradeParamsStruct>{
          tokenOut: baseToken.address,
          deadline: baseTokenPermit.deadline,
          amountOutMinimum: parseEther('1'),
          sqrtPriceLimitX96: parseEther('2'),
        }
        await setNextTimestamp(ethers.provider, timestampToSignFor)

        await depositTradeHelper
          .connect(user)
          .depositAndTrade(
            baseTokenToDeposit,
            baseTokenPermit,
            collateralPermit,
            nonZeroTradeParams
          )

        const swapRouterCallArgs = swapRouter.exactInputSingle
          .atCall(0)
          .callHistory[0].args[0].slice(0, 8)
        const correctSwapArgs = [
          collateral.address,
          baseToken.address,
          await depositTradeHelper.POOL_FEE_TIER(),
          user.address,
          BigNumber.from(baseTokenPermit.deadline),
          expectedCT,
          parseEther('1'),
          parseEther('2'),
        ]
        swapRouterCallArgs.forEach((arg, i) => {
          expect(arg).to.eq(correctSwapArgs[i])
        })
      })
    })

    afterEach(() => {
      depositHook.hook.reset()
      baseToken.transferFrom.reset()
      collateral.deposit.reset()
      collateral.transferFrom.reset()
      swapRouter.exactInputSingle.reset()
    })
  })
})
