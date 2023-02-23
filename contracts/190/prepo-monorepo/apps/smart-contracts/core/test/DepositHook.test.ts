import chai, { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { id, parseEther } from 'ethers/lib/utils'
import { Contract } from 'ethers'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import { ZERO_ADDRESS } from 'prepo-constants'
import { depositHookFixture, smockAccountListFixture } from './fixtures/HookFixture'
import { smockDepositRecordFixture } from './fixtures/DepositRecordFixture'
import { testERC721Fixture } from './fixtures/TestERC721Fixture'
import { getSignerForContract, grantAndAcceptRole } from './utils'
import { fakeTokenSenderFixture } from './fixtures/TokenSenderFixture'
import { smockTestERC20Fixture } from './fixtures/TestERC20Fixture'
import { fakeCollateralFixture } from './fixtures/CollateralFixture'
import { DepositHook, TestERC721 } from '../typechain'

chai.use(smock.matchers)

describe('=> DepositHook', () => {
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let treasury: SignerWithAddress
  let collateralSigner: SignerWithAddress
  let depositHook: DepositHook
  let testToken: MockContract<Contract>
  let tokenSender: FakeContract<Contract>
  let allowlist: MockContract<Contract>
  let depositRecord: MockContract<Contract>
  let collateral: FakeContract<Contract>
  let firstERC721: TestERC721
  let secondERC721: TestERC721
  const TEST_GLOBAL_DEPOSIT_CAP = parseEther('50000')
  const TEST_ACCOUNT_DEPOSIT_CAP = parseEther('50')
  const TEST_AMOUNT_BEFORE_FEE = parseEther('1.01')
  const TEST_AMOUNT_AFTER_FEE = parseEther('1')

  beforeEach(async () => {
    ;[deployer, user, treasury] = await ethers.getSigners()
    testToken = await smockTestERC20Fixture('Test Token', 'TEST', 18)
    tokenSender = await fakeTokenSenderFixture(testToken.address)
    allowlist = await smockAccountListFixture()
    depositRecord = await smockDepositRecordFixture(
      TEST_GLOBAL_DEPOSIT_CAP,
      TEST_ACCOUNT_DEPOSIT_CAP
    )
    depositHook = await depositHookFixture()
    firstERC721 = await testERC721Fixture('NFT Collection 1', 'NFT1')
    secondERC721 = await testERC721Fixture('NFT Collection 2', 'NFT2')
    collateral = await fakeCollateralFixture()
    collateral.getBaseToken.returns(testToken.address)
    collateralSigner = await getSignerForContract(collateral)
    await grantAndAcceptRole(
      depositHook,
      deployer,
      deployer,
      await depositHook.SET_ACCOUNT_LIST_ROLE()
    )
    await grantAndAcceptRole(depositHook, deployer, deployer, await depositHook.SET_TREASURY_ROLE())
    await grantAndAcceptRole(
      depositHook,
      deployer,
      deployer,
      await depositHook.SET_TOKEN_SENDER_ROLE()
    )
    await grantAndAcceptRole(
      depositHook,
      deployer,
      deployer,
      await depositHook.SET_COLLATERAL_ROLE()
    )
    await grantAndAcceptRole(
      depositHook,
      deployer,
      deployer,
      await depositHook.SET_DEPOSIT_RECORD_ROLE()
    )
    await grantAndAcceptRole(
      depositHook,
      deployer,
      deployer,
      await depositHook.SET_DEPOSITS_ALLOWED_ROLE()
    )
    await grantAndAcceptRole(
      depositHook,
      deployer,
      deployer,
      await depositHook.SET_REQUIRED_SCORE_ROLE()
    )
    await grantAndAcceptRole(
      depositHook,
      deployer,
      deployer,
      await depositHook.SET_COLLECTION_SCORES_ROLE()
    )
    await grantAndAcceptRole(
      depositHook,
      deployer,
      deployer,
      await depositHook.REMOVE_COLLECTIONS_ROLE()
    )
    await grantAndAcceptRole(
      depositRecord,
      deployer,
      deployer,
      await depositRecord.SET_ALLOWED_HOOK_ROLE()
    )
    await depositRecord.connect(deployer).setAllowedHook(depositHook.address, true)
  })

  describe('initial state', () => {
    it('sets collateral to zero address', async () => {
      expect(await depositHook.getCollateral()).to.eq(ZERO_ADDRESS)
    })

    it('sets role constants to the correct hash', async () => {
      expect(await depositHook.SET_ACCOUNT_LIST_ROLE()).to.eq(
        id('DepositHook_setAccountList(IAccountList)')
      )
      expect(await depositHook.SET_TREASURY_ROLE()).to.eq(id('DepositHook_setTreasury(address)'))
      expect(await depositHook.SET_TOKEN_SENDER_ROLE()).to.eq(
        id('DepositHook_setTokenSender(ITokenSender)')
      )
      expect(await depositHook.SET_COLLATERAL_ROLE()).to.eq(
        id('DepositHook_setCollateral(address)')
      )
      expect(await depositHook.SET_DEPOSIT_RECORD_ROLE()).to.eq(
        id('DepositHook_setDepositRecord(address)')
      )
      expect(await depositHook.SET_DEPOSITS_ALLOWED_ROLE()).to.eq(
        id('DepositHook_setDepositsAllowed(bool)')
      )
      expect(await depositHook.SET_REQUIRED_SCORE_ROLE()).to.eq(
        id('DepositHook_setRequiredScore(uint256)')
      )
      expect(await depositHook.SET_COLLECTION_SCORES_ROLE()).to.eq(
        id('DepositHook_setCollectionScores(IERC721[],uint256[])')
      )
      expect(await depositHook.REMOVE_COLLECTIONS_ROLE()).to.eq(
        id('DepositHook_removeCollections(IERC721[])')
      )
    })
  })

  describe('# hook', () => {
    /**
     * Tests below use different values for TEST_AMOUNT_BEFORE_FEE and
     * TEST_AMOUNT_AFTER_FEE to ensure TEST_AMOUNT_BEFORE_FEE is ignored.
     */
    beforeEach(async () => {
      await depositHook.connect(deployer).setCollateral(collateral.address)
      await depositHook.connect(deployer).setDepositsAllowed(true)
      await depositHook.connect(deployer).setDepositRecord(depositRecord.address)
      await depositHook.connect(deployer).setAccountList(allowlist.address)
      await depositHook.connect(deployer).setTreasury(treasury.address)
      await depositHook.connect(deployer).setTokenSender(tokenSender.address)
      await testToken.connect(deployer).mint(collateral.address, TEST_GLOBAL_DEPOSIT_CAP)
      await testToken.connect(deployer).mint(user.address, TEST_GLOBAL_DEPOSIT_CAP)
      await testToken
        .connect(collateralSigner)
        .approve(depositHook.address, ethers.constants.MaxUint256)
    })

    async function setupScoresForNFTAccess(
      accountScore: number,
      requiredScore: number
    ): Promise<void> {
      // Set up required score
      await depositHook.connect(deployer).setRequiredScore(requiredScore)

      // Set up account score
      if (accountScore > 0) {
        await firstERC721.mint(user.address)
        expect(await firstERC721.balanceOf(user.address)).to.eq(1)
        await depositHook
          .connect(deployer)
          .setCollectionScores([firstERC721.address], [accountScore])
      }
    }

    it('should only usable by collateral', async () => {
      expect(await depositHook.getCollateral()).to.not.eq(user.address)

      await expect(
        depositHook.connect(user).hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
      ).to.revertedWith('msg.sender != collateral')
    })

    it('reverts if deposits not allowed', async () => {
      await depositHook.connect(deployer).setDepositsAllowed(false)
      expect(await depositHook.depositsAllowed()).to.eq(false)

      await expect(
        depositHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
      ).to.revertedWith('deposits not allowed')
    })

    it('succeeds if account on allowlist', async () => {
      allowlist.isIncluded.whenCalledWith(user.address).returns(true)
      expect(await allowlist.isIncluded(user.address)).to.eq(true)

      await depositHook
        .connect(collateralSigner)
        .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
    })

    it('succeeds if account not on allowlist, and required score = 0', async () => {
      await setupScoresForNFTAccess(0, 0)
      expect(await allowlist.isIncluded(user.address)).to.eq(false)
      expect(await depositHook.getRequiredScore()).to.eq(0)

      await depositHook
        .connect(collateralSigner)
        .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
    })

    it('reverts if account not on allowlist, required score > 0, and account score < required score', async () => {
      await setupScoresForNFTAccess(0, 1)
      expect(await allowlist.isIncluded(user.address)).to.eq(false)
      expect(await depositHook.getRequiredScore()).to.be.gt(0)
      expect(await depositHook.getAccountScore(user.address)).to.be.lt(
        await depositHook.getRequiredScore()
      )

      await expect(
        depositHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
      ).to.revertedWith('depositor not allowed')
    })

    it('succeeds if account not on allowlist, required score > 0, and account score = required score', async () => {
      await setupScoresForNFTAccess(1, 1)
      expect(await depositHook.getRequiredScore()).to.be.gt(0)
      expect(await depositHook.getAccountScore(user.address)).to.be.eq(
        await depositHook.getRequiredScore()
      )

      await depositHook
        .connect(collateralSigner)
        .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
    })

    it('succeeds if account not on allowlist, required score > 0, and account score > required score', async () => {
      await setupScoresForNFTAccess(2, 1)
      expect(await depositHook.getRequiredScore()).to.be.gt(0)
      expect(await depositHook.getAccountScore(user.address)).to.be.gt(
        await depositHook.getRequiredScore()
      )

      await depositHook
        .connect(collateralSigner)
        .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
    })

    it('calls recordDeposit() if fee = 0', async () => {
      await depositHook
        .connect(collateralSigner)
        .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_BEFORE_FEE)

      expect(depositRecord.recordDeposit).to.be.calledWith(user.address, TEST_AMOUNT_BEFORE_FEE)
    })

    it('calls recordDeposit() if fee > 0', async () => {
      await depositHook
        .connect(collateralSigner)
        .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

      expect(depositRecord.recordDeposit).to.be.calledWith(user.address, TEST_AMOUNT_AFTER_FEE)
    })

    it('transfers fee to treasury if fee > 0', async () => {
      expect(TEST_AMOUNT_BEFORE_FEE).to.not.eq(TEST_AMOUNT_AFTER_FEE)

      await depositHook
        .connect(collateralSigner)
        .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

      const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
      expect(testToken.transferFrom).to.be.calledWith(collateral.address, treasury.address, fee)
    })

    it('calls tokenSender.send() if fee > 0', async () => {
      expect(TEST_AMOUNT_BEFORE_FEE).to.not.eq(TEST_AMOUNT_AFTER_FEE)

      await depositHook
        .connect(collateralSigner)
        .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

      const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
      expect(tokenSender.send).to.be.calledWith(user.address, fee)
    })

    it("doesn't transfer fee to treasury if fee = 0", async () => {
      await depositHook
        .connect(collateralSigner)
        .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_BEFORE_FEE)

      expect(testToken.transferFrom).to.not.be.called
    })

    it("doesn't call tokenSender.send() if fee = 0", async () => {
      await depositHook
        .connect(collateralSigner)
        .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_BEFORE_FEE)

      expect(tokenSender.send).to.not.be.called
    })
  })

  describe('# setAccountList', () => {
    beforeEach(async () => {
      await grantAndAcceptRole(
        depositHook,
        deployer,
        deployer,
        await depositHook.SET_ACCOUNT_LIST_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_ACCOUNT_LIST_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).setAccountList(user.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_ACCOUNT_LIST_ROLE()}`
      )
    })

    it("doesn't revert if role holder", async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_ACCOUNT_LIST_ROLE(), deployer.address)
      ).to.eq(true)

      await expect(depositHook.connect(deployer).setAccountList(user.address))
    })
  })

  describe('# setCollateral', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_COLLATERAL_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).setCollateral(collateral.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_COLLATERAL_ROLE()}`
      )
    })

    it('should be settable to an address', async () => {
      expect(await depositHook.getCollateral()).to.eq(ZERO_ADDRESS)

      await depositHook.connect(deployer).setCollateral(collateral.address)

      expect(await depositHook.getCollateral()).to.eq(collateral.address)
    })

    it('should be settable to the zero address', async () => {
      await depositHook.connect(deployer).setCollateral(collateral.address)
      expect(await depositHook.getCollateral()).to.eq(collateral.address)

      await depositHook.connect(deployer).setCollateral(ZERO_ADDRESS)

      expect(await depositHook.getCollateral()).to.eq(ZERO_ADDRESS)
    })

    it('should be settable to the same value twice', async () => {
      expect(await depositHook.getCollateral()).to.eq(ZERO_ADDRESS)

      await depositHook.connect(deployer).setCollateral(collateral.address)

      expect(await depositHook.getCollateral()).to.eq(collateral.address)

      await depositHook.connect(deployer).setCollateral(collateral.address)

      expect(await depositHook.getCollateral()).to.eq(collateral.address)
    })

    it('emits CollateralChange', async () => {
      const tx = await depositHook.connect(deployer).setCollateral(collateral.address)

      await expect(tx).to.emit(depositHook, 'CollateralChange').withArgs(collateral.address)
    })
  })

  describe('# setDepositRecord', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_DEPOSIT_RECORD_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).setDepositRecord(depositRecord.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_DEPOSIT_RECORD_ROLE()}`
      )
    })

    it('sets to non-zero address', async () => {
      await depositHook.connect(deployer).setDepositRecord(ZERO_ADDRESS)
      expect(depositRecord.address).to.not.eq(ZERO_ADDRESS)
      expect(await depositHook.getDepositRecord()).to.not.eq(depositRecord.address)

      await depositHook.connect(deployer).setDepositRecord(depositRecord.address)

      expect(await depositHook.getDepositRecord()).to.eq(depositRecord.address)
    })

    it('sets to zero address', async () => {
      await depositHook.connect(deployer).setDepositRecord(ZERO_ADDRESS)

      expect(await depositHook.getDepositRecord()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      await depositHook.connect(deployer).setDepositRecord(ZERO_ADDRESS)
      expect(await depositHook.getDepositRecord()).to.not.eq(depositRecord.address)

      await depositHook.connect(deployer).setDepositRecord(depositRecord.address)

      expect(await depositHook.getDepositRecord()).to.eq(depositRecord.address)

      await depositHook.connect(deployer).setDepositRecord(depositRecord.address)

      expect(await depositHook.getDepositRecord()).to.eq(depositRecord.address)
    })

    it('emits DepositRecordChange', async () => {
      const tx = await depositHook.connect(deployer).setDepositRecord(depositRecord.address)

      await expect(tx).to.emit(depositHook, 'DepositRecordChange').withArgs(depositRecord.address)
    })
  })

  describe('# setDepositsAllowed', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_DEPOSITS_ALLOWED_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).setDepositsAllowed(true)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_DEPOSITS_ALLOWED_ROLE()}`
      )
    })

    it('sets to false', async () => {
      await depositHook.connect(deployer).setDepositsAllowed(true)
      expect(await depositHook.depositsAllowed()).to.not.eq(false)

      await depositHook.connect(deployer).setDepositsAllowed(false)

      expect(await depositHook.depositsAllowed()).to.eq(false)
    })

    it('sets to true', async () => {
      expect(await depositHook.depositsAllowed()).to.not.eq(true)

      await depositHook.connect(deployer).setDepositsAllowed(true)

      expect(await depositHook.depositsAllowed()).to.eq(true)
    })

    it('is idempotent', async () => {
      expect(await depositHook.depositsAllowed()).to.not.eq(true)

      await depositHook.connect(deployer).setDepositsAllowed(true)

      expect(await depositHook.depositsAllowed()).to.eq(true)

      await depositHook.connect(deployer).setDepositsAllowed(true)

      expect(await depositHook.depositsAllowed()).to.eq(true)
    })

    it('emits DepositsAllowedChange', async () => {
      const tx = await depositHook.connect(deployer).setDepositsAllowed(true)

      await expect(tx).to.emit(depositHook, 'DepositsAllowedChange').withArgs(true)
    })
  })

  describe('# setRequiredScore', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_REQUIRED_SCORE_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).setRequiredScore(0)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_REQUIRED_SCORE_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_REQUIRED_SCORE_ROLE(), deployer.address)
      ).to.eq(true)

      await depositHook.connect(deployer).setRequiredScore(0)
    })
  })

  describe('# setCollectionScores', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_COLLECTION_SCORES_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).setCollectionScores([], [])).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_COLLECTION_SCORES_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_COLLECTION_SCORES_ROLE(), deployer.address)
      ).to.eq(true)

      await depositHook
        .connect(deployer)
        .setCollectionScores([firstERC721.address], [secondERC721.address])
    })
  })

  describe('# removeCollections', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.REMOVE_COLLECTIONS_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).removeCollections([])).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.REMOVE_COLLECTIONS_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.REMOVE_COLLECTIONS_ROLE(), deployer.address)
      ).to.eq(true)

      await depositHook.connect(deployer).removeCollections([])
    })
  })

  describe('# setTreasury', () => {
    it('reverts if not role holder', async () => {
      expect(await depositHook.hasRole(await depositHook.SET_TREASURY_ROLE(), user.address)).to.eq(
        false
      )

      await expect(depositHook.connect(user).setTreasury(treasury.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_TREASURY_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_TREASURY_ROLE(), deployer.address)
      ).to.eq(true)

      await depositHook.connect(deployer).setTreasury(treasury.address)
    })
  })

  describe('# setTokenSender', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_TOKEN_SENDER_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).setTokenSender(tokenSender.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_TOKEN_SENDER_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_TOKEN_SENDER_ROLE(), deployer.address)
      ).to.eq(true)

      await depositHook.connect(deployer).setTokenSender(tokenSender.address)
    })
  })
})
