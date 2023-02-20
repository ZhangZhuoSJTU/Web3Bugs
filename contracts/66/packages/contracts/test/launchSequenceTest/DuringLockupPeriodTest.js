const LockupContract = artifacts.require("./LockupContract.sol")
const LockupContractFactory = artifacts.require("./LockupContractFactory.sol")
const deploymentHelper = require("../../utils/deploymentHelpers.js")

const { TestHelper: th, TimeValues: timeValues } = require("../../utils/testHelpers.js")
const { dec, toBN, assertRevert, ZERO_ADDRESS } = th

contract('During the initial lockup period', async accounts => {
  const [
    liquityAG,
    teamMember_1,
    teamMember_2,
    teamMember_3,
    investor_1,
    investor_2,
    investor_3,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I
  ] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  const SECONDS_IN_ONE_MONTH = timeValues.SECONDS_IN_ONE_MONTH
  const SECONDS_IN_364_DAYS = timeValues.SECONDS_IN_ONE_DAY * 364

  let YETIContracts
  let coreContracts

  // LCs for team members on vesting schedules
  let LC_T1
  let LC_T2
  let LC_T3

  // LCs for investors
  let LC_I1
  let LC_I2
  let LC_I3

  // 1e24 = 1 million tokens with 18 decimal digits
  const teamMemberInitialEntitlement_1 = dec(1, 24)
  const teamMemberInitialEntitlement_2 = dec(2, 24)
  const teamMemberInitialEntitlement_3 = dec(3, 24)
  const investorInitialEntitlement_1 = dec(4, 24)
  const investorInitialEntitlement_2 = dec(5, 24)
  const investorInitialEntitlement_3 = dec(6, 24)

  const YETIEntitlement_A = dec(1, 24)
  const YETIEntitlement_B = dec(2, 24)
  const YETIEntitlement_C = dec(3, 24)
  const YETIEntitlement_D = dec(4, 24)
  const YETIEntitlement_E = dec(5, 24)

  let oneYearFromSystemDeployment
  let twoYearsFromSystemDeployment

  beforeEach(async () => {
    // Deploy all contracts from the first account
    coreContracts = await deploymentHelper.deployLiquityCore()
    YETIContracts = await deploymentHelper.deployYETITesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)

    sYETI = YETIContracts.sYETI
    yetiToken = YETIContracts.yetiToken
    communityIssuance = YETIContracts.communityIssuance
    lockupContractFactory = YETIContracts.lockupContractFactory

    await deploymentHelper.connectYETIContracts(YETIContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, YETIContracts)
    await deploymentHelper.connectYETIContractsToCore(YETIContracts, coreContracts)

    oneYearFromSystemDeployment = await th.getTimeFromSystemDeployment(yetiToken, web3, timeValues.SECONDS_IN_ONE_YEAR)
    const secondsInTwoYears = toBN(timeValues.SECONDS_IN_ONE_YEAR).mul(toBN('2'))
    twoYearsFromSystemDeployment = await th.getTimeFromSystemDeployment(yetiToken, web3, secondsInTwoYears)

    // Deploy 3 LCs for team members on vesting schedules
    const deployedLCtx_T1 = await lockupContractFactory.deployLockupContract(teamMember_1, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T2 = await lockupContractFactory.deployLockupContract(teamMember_2, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T3 = await lockupContractFactory.deployLockupContract(teamMember_3, oneYearFromSystemDeployment, { from: liquityAG })

    // Deploy 3 LCs for investors
    const deployedLCtx_I1 = await lockupContractFactory.deployLockupContract(investor_1, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I2 = await lockupContractFactory.deployLockupContract(investor_2, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I3 = await lockupContractFactory.deployLockupContract(investor_3, oneYearFromSystemDeployment, { from: liquityAG })

    // LCs for team members on vesting schedules
    LC_T1 = await th.getLCFromDeploymentTx(deployedLCtx_T1)
    LC_T2 = await th.getLCFromDeploymentTx(deployedLCtx_T2)
    LC_T3 = await th.getLCFromDeploymentTx(deployedLCtx_T3)

    // LCs for investors
    LC_I1 = await th.getLCFromDeploymentTx(deployedLCtx_I1)
    LC_I2 = await th.getLCFromDeploymentTx(deployedLCtx_I2)
    LC_I3 = await th.getLCFromDeploymentTx(deployedLCtx_I3)

    // Multisig transfers initial YETI entitlements to LCs
    await yetiToken.transfer(LC_T1.address, teamMemberInitialEntitlement_1, { from: multisig })
    await yetiToken.transfer(LC_T2.address, teamMemberInitialEntitlement_2, { from: multisig })
    await yetiToken.transfer(LC_T3.address, teamMemberInitialEntitlement_3, { from: multisig })

    await yetiToken.transfer(LC_I1.address, investorInitialEntitlement_1, { from: multisig })
    await yetiToken.transfer(LC_I2.address, investorInitialEntitlement_2, { from: multisig })
    await yetiToken.transfer(LC_I3.address, investorInitialEntitlement_3, { from: multisig })

    // Fast forward time 364 days, so that still less than 1 year since launch has passed
    await th.fastForwardTime(SECONDS_IN_364_DAYS, web3.currentProvider)
  })

  describe('YETI transfer during first year after YETI deployment', async accounts => {
    // --- Liquity AG transfer restriction, 1st year ---
    it("Liquity multisig can not transfer YETI to a LC that was deployed directly", async () => {
      // Liquity multisig deploys LC_A
      const LC_A = await LockupContract.new(yetiToken.address, A, oneYearFromSystemDeployment, { from: multisig })

      // Account F deploys LC_B
      const LC_B = await LockupContract.new(yetiToken.address, B, oneYearFromSystemDeployment, { from: F })

      // YETI deployer deploys LC_C
      const LC_C = await LockupContract.new(yetiToken.address, A, oneYearFromSystemDeployment, { from: liquityAG })

      // Liquity multisig attempts YETI transfer to LC_A
      try {
        const YETItransferTx_A = await yetiToken.transfer(LC_A.address, dec(1, 18), { from: multisig })
        assert.isFalse(YETItransferTx_A.receipt.status)
      } catch (error) {
        assert.include(error.message, "YETIToken: recipient must be a LockupContract registered in the Factory")
      }

      // Liquity multisig attempts YETI transfer to LC_B
      try {
        const YETItransferTx_B = await yetiToken.transfer(LC_B.address, dec(1, 18), { from: multisig })
        assert.isFalse(YETItransferTx_B.receipt.status)
      } catch (error) {
        assert.include(error.message, "YETIToken: recipient must be a LockupContract registered in the Factory")
      }

      try {
        const YETItransferTx_C = await yetiToken.transfer(LC_C.address, dec(1, 18), { from: multisig })
        assert.isFalse(YETItransferTx_C.receipt.status)
      } catch (error) {
        assert.include(error.message, "YETIToken: recipient must be a LockupContract registered in the Factory")
      }
    })

    it("Liquity multisig can not transfer to an EOA or Liquity system contracts", async () => {
      // Multisig attempts YETI transfer to EOAs
      const YETItransferTxPromise_1 = yetiToken.transfer(A, dec(1, 18), { from: multisig })
      const YETItransferTxPromise_2 = yetiToken.transfer(B, dec(1, 18), { from: multisig })
      await assertRevert(YETItransferTxPromise_1)
      await assertRevert(YETItransferTxPromise_2)

      // Multisig attempts YETI transfer to core Liquity contracts
      for (const contract of Object.keys(coreContracts)) {
        const YETItransferTxPromise = yetiToken.transfer(coreContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(YETItransferTxPromise, "YETIToken: recipient must be a LockupContract registered in the Factory")
      }

      // Multisig attempts YETI transfer to YETI contracts (excluding LCs)
      for (const contract of Object.keys(YETIContracts)) {
        const YETItransferTxPromise = yetiToken.transfer(YETIContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(YETItransferTxPromise, "YETIToken: recipient must be a LockupContract registered in the Factory")
      }
    })

    // --- Liquity AG approval restriction, 1st year ---
    it("Liquity multisig can not approve any EOA or Liquity system contract to spend their YETI", async () => {
      // Multisig attempts to approve EOAs to spend YETI
      const YETIApproveTxPromise_1 = yetiToken.approve(A, dec(1, 18), { from: multisig })
      const YETIApproveTxPromise_2 = yetiToken.approve(B, dec(1, 18), { from: multisig })
      await assertRevert(YETIApproveTxPromise_1, "YETIToken: caller must not be the multisig")
      await assertRevert(YETIApproveTxPromise_2, "YETIToken: caller must not be the multisig")

      // Multisig attempts to approve Liquity contracts to spend YETI
      for (const contract of Object.keys(coreContracts)) {
        const YETIApproveTxPromise = yetiToken.approve(coreContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(YETIApproveTxPromise, "YETIToken: caller must not be the multisig")
      }

      // Multisig attempts to approve YETI contracts to spend YETI (excluding LCs)
      for (const contract of Object.keys(YETIContracts)) {
        const YETIApproveTxPromise = yetiToken.approve(YETIContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(YETIApproveTxPromise, "YETIToken: caller must not be the multisig")
      }
    })

    // --- Liquity AG increaseAllowance restriction, 1st year ---
    it("Liquity multisig can not increaseAllowance for any EOA or Liquity contract", async () => {
      // Multisig attempts to approve EOAs to spend YETI
      const YETIIncreaseAllowanceTxPromise_1 = yetiToken.increaseAllowance(A, dec(1, 18), { from: multisig })
      const YETIIncreaseAllowanceTxPromise_2 = yetiToken.increaseAllowance(B, dec(1, 18), { from: multisig })
      await assertRevert(YETIIncreaseAllowanceTxPromise_1, "YETIToken: caller must not be the multisig")
      await assertRevert(YETIIncreaseAllowanceTxPromise_2, "YETIToken: caller must not be the multisig")

      // Multisig attempts to approve Liquity contracts to spend YETI
      for (const contract of Object.keys(coreContracts)) {
        const YETIIncreaseAllowanceTxPromise = yetiToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(YETIIncreaseAllowanceTxPromise, "YETIToken: caller must not be the multisig")
      }

      // Multisig attempts to approve YETI contracts to spend YETI (excluding LCs)
      for (const contract of Object.keys(YETIContracts)) {
        const YETIIncreaseAllowanceTxPromise = yetiToken.increaseAllowance(YETIContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(YETIIncreaseAllowanceTxPromise, "YETIToken: caller must not be the multisig")
      }
    })

    // --- Liquity AG decreaseAllowance restriction, 1st year ---
    it("Liquity multisig can not decreaseAllowance for any EOA or Liquity contract", async () => {
      // Multisig attempts to decreaseAllowance on EOAs 
      const YETIDecreaseAllowanceTxPromise_1 = yetiToken.decreaseAllowance(A, dec(1, 18), { from: multisig })
      const YETIDecreaseAllowanceTxPromise_2 = yetiToken.decreaseAllowance(B, dec(1, 18), { from: multisig })
      await assertRevert(YETIDecreaseAllowanceTxPromise_1, "YETIToken: caller must not be the multisig")
      await assertRevert(YETIDecreaseAllowanceTxPromise_2, "YETIToken: caller must not be the multisig")

      // Multisig attempts to decrease allowance on Liquity contracts
      for (const contract of Object.keys(coreContracts)) {
        const YETIDecreaseAllowanceTxPromise = yetiToken.decreaseAllowance(coreContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(YETIDecreaseAllowanceTxPromise, "YETIToken: caller must not be the multisig")
      }

      // Multisig attempts to decrease allowance on YETI contracts (excluding LCs)
      for (const contract of Object.keys(YETIContracts)) {
        const YETIDecreaseAllowanceTxPromise = yetiToken.decreaseAllowance(YETIContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(YETIDecreaseAllowanceTxPromise, "YETIToken: caller must not be the multisig")
      }
    })

    // --- Liquity multisig transferFrom restriction, 1st year ---
    it("Liquity multisig can not be the sender in a transferFrom() call", async () => {
      // EOAs attempt to use multisig as sender in a transferFrom()
      const YETItransferFromTxPromise_1 = yetiToken.transferFrom(multisig, A, dec(1, 18), { from: A })
      const YETItransferFromTxPromise_2 = yetiToken.transferFrom(multisig, C, dec(1, 18), { from: B })
      await assertRevert(YETItransferFromTxPromise_1, "YETIToken: sender must not be the multisig")
      await assertRevert(YETItransferFromTxPromise_2, "YETIToken: sender must not be the multisig")
    })

    //  --- staking, 1st year ---
    it("Liquity multisig can not stake their YETI in the staking contract", async () => {
      const SYETITxPromise_1 = sYETI.mint(dec(1, 18), { from: multisig })
      await assertRevert(SYETITxPromise_1, "YETIToken: sender must not be the multisig")
    })

    // --- Anyone else ---

    it("Anyone (other than Liquity multisig) can transfer YETI to LCs deployed by anyone through the Factory", async () => {
      // Start D, E, F with some YETI
      await yetiToken.unprotectedMint(D, dec(1, 24))
      await yetiToken.unprotectedMint(E, dec(2, 24))
      await yetiToken.unprotectedMint(F, dec(3, 24))

      // H, I, and Liquity AG deploy lockup contracts with A, B, C as beneficiaries, respectively
      const deployedLCtx_A = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: H })
      const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: I })
      const deployedLCtx_C = await lockupContractFactory.deployLockupContract(C, oneYearFromSystemDeployment, { from: multisig })

      // Grab contract addresses from deployment tx events
      const LCAddress_A = await th.getLCAddressFromDeploymentTx(deployedLCtx_A)
      const LCAddress_B = await th.getLCAddressFromDeploymentTx(deployedLCtx_B)
      const LCAddress_C = await th.getLCAddressFromDeploymentTx(deployedLCtx_C)

      // Check balances of LCs are 0
      assert.equal(await yetiToken.balanceOf(LCAddress_A), '0')
      assert.equal(await yetiToken.balanceOf(LCAddress_B), '0')
      assert.equal(await yetiToken.balanceOf(LCAddress_C), '0')

      // D, E, F transfer YETI to LCs
      await yetiToken.transfer(LCAddress_A, dec(1, 24), { from: D })
      await yetiToken.transfer(LCAddress_B, dec(2, 24), { from: E })
      await yetiToken.transfer(LCAddress_C, dec(3, 24), { from: F })

      // Check balances of LCs has increased
      assert.equal(await yetiToken.balanceOf(LCAddress_A), dec(1, 24))
      assert.equal(await yetiToken.balanceOf(LCAddress_B), dec(2, 24))
      assert.equal(await yetiToken.balanceOf(LCAddress_C), dec(3, 24))
    })

    it("Anyone (other than Liquity multisig) can transfer YETI to LCs deployed by anyone directly", async () => {
      // Start D, E, F with some YETI
      await yetiToken.unprotectedMint(D, dec(1, 24))
      await yetiToken.unprotectedMint(E, dec(2, 24))
      await yetiToken.unprotectedMint(F, dec(3, 24))

      // H, I, LiqAG deploy lockup contracts with A, B, C as beneficiaries, respectively
      const LC_A = await LockupContract.new(yetiToken.address, A, oneYearFromSystemDeployment, { from: H })
      const LC_B = await LockupContract.new(yetiToken.address, B, oneYearFromSystemDeployment, { from: I })
      const LC_C = await LockupContract.new(yetiToken.address, C, oneYearFromSystemDeployment, { from: multisig })

      // Check balances of LCs are 0
      assert.equal(await yetiToken.balanceOf(LC_A.address), '0')
      assert.equal(await yetiToken.balanceOf(LC_B.address), '0')
      assert.equal(await yetiToken.balanceOf(LC_C.address), '0')

      // D, E, F transfer YETI to LCs
      await yetiToken.transfer(LC_A.address, dec(1, 24), { from: D })
      await yetiToken.transfer(LC_B.address, dec(2, 24), { from: E })
      await yetiToken.transfer(LC_C.address, dec(3, 24), { from: F })

      // Check balances of LCs has increased
      assert.equal(await yetiToken.balanceOf(LC_A.address), dec(1, 24))
      assert.equal(await yetiToken.balanceOf(LC_B.address), dec(2, 24))
      assert.equal(await yetiToken.balanceOf(LC_C.address), dec(3, 24))
    })

    it("Anyone (other than liquity multisig) can transfer to an EOA", async () => {
      // Start D, E, F with some YETI
      await yetiToken.unprotectedMint(D, dec(1, 24))
      await yetiToken.unprotectedMint(E, dec(2, 24))
      await yetiToken.unprotectedMint(F, dec(3, 24))

      // YETI holders transfer to other transfer to EOAs
      const YETItransferTx_1 = await yetiToken.transfer(A, dec(1, 18), { from: D })
      const YETItransferTx_2 = await yetiToken.transfer(B, dec(1, 18), { from: E })
      const YETItransferTx_3 = await yetiToken.transfer(multisig, dec(1, 18), { from: F })

      assert.isTrue(YETItransferTx_1.receipt.status)
      assert.isTrue(YETItransferTx_2.receipt.status)
      assert.isTrue(YETItransferTx_3.receipt.status)
    })

    it("Anyone (other than liquity multisig) can approve any EOA or to spend their YETI", async () => {
      // EOAs approve EOAs to spend YETI
      const YETIapproveTx_1 = await yetiToken.approve(A, dec(1, 18), { from: F })
      const YETIapproveTx_2 = await yetiToken.approve(B, dec(1, 18), { from: G })
      await assert.isTrue(YETIapproveTx_1.receipt.status)
      await assert.isTrue(YETIapproveTx_2.receipt.status)
    })

    it("Anyone (other than liquity multisig) can increaseAllowance for any EOA or Liquity contract", async () => {
      // Anyone can increaseAllowance of EOAs to spend YETI
      const YETIIncreaseAllowanceTx_1 = await yetiToken.increaseAllowance(A, dec(1, 18), { from: F })
      const YETIIncreaseAllowanceTx_2 = await yetiToken.increaseAllowance(B, dec(1, 18), { from: G })
      await assert.isTrue(YETIIncreaseAllowanceTx_1.receipt.status)
      await assert.isTrue(YETIIncreaseAllowanceTx_2.receipt.status)

      // Increase allowance of core Liquity contracts
      for (const contract of Object.keys(coreContracts)) {
        const YETIIncreaseAllowanceTx = await yetiToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(YETIIncreaseAllowanceTx.receipt.status)
      }

      // Increase allowance of YETI contracts
      for (const contract of Object.keys(YETIContracts)) {
        const YETIIncreaseAllowanceTx = await yetiToken.increaseAllowance(YETIContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(YETIIncreaseAllowanceTx.receipt.status)
      }
    })

    it("Anyone (other than liquity multisig) can decreaseAllowance for any EOA or Liquity contract", async () => {
      //First, increase allowance of A, B and coreContracts and YETI contracts
      const YETIIncreaseAllowanceTx_1 = await yetiToken.increaseAllowance(A, dec(1, 18), { from: F })
      const YETIIncreaseAllowanceTx_2 = await yetiToken.increaseAllowance(B, dec(1, 18), { from: G })
      await assert.isTrue(YETIIncreaseAllowanceTx_1.receipt.status)
      await assert.isTrue(YETIIncreaseAllowanceTx_2.receipt.status)

      for (const contract of Object.keys(coreContracts)) {
        const YETItransferTx = await yetiToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(YETItransferTx.receipt.status)
      }

      for (const contract of Object.keys(YETIContracts)) {
        const YETItransferTx = await yetiToken.increaseAllowance(YETIContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(YETItransferTx.receipt.status)
      }

      // Decrease allowance of A, B
      const YETIDecreaseAllowanceTx_1 = await yetiToken.decreaseAllowance(A, dec(1, 18), { from: F })
      const YETIDecreaseAllowanceTx_2 = await yetiToken.decreaseAllowance(B, dec(1, 18), { from: G })
      await assert.isTrue(YETIDecreaseAllowanceTx_1.receipt.status)
      await assert.isTrue(YETIDecreaseAllowanceTx_2.receipt.status)

      // Decrease allowance of core contracts
      for (const contract of Object.keys(coreContracts)) {
        const YETIDecreaseAllowanceTx = await yetiToken.decreaseAllowance(coreContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(YETIDecreaseAllowanceTx.receipt.status)
      }

      // Decrease allowance of YETI contracts
      for (const contract of Object.keys(YETIContracts)) {
        const YETIDecreaseAllowanceTx = await yetiToken.decreaseAllowance(YETIContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(YETIDecreaseAllowanceTx.receipt.status)
      }
    })

    it("Anyone (other than liquity multisig) can be the sender in a transferFrom() call", async () => {
      // Fund A, B
      await yetiToken.unprotectedMint(A, dec(1, 18))
      await yetiToken.unprotectedMint(B, dec(1, 18))

      // A, B approve F, G
      await yetiToken.approve(F, dec(1, 18), { from: A })
      await yetiToken.approve(G, dec(1, 18), { from: B })

      const YETItransferFromTx_1 = await yetiToken.transferFrom(A, F, dec(1, 18), { from: F })
      const YETItransferFromTx_2 = await yetiToken.transferFrom(B, C, dec(1, 18), { from: G })
      await assert.isTrue(YETItransferFromTx_1.receipt.status)
      await assert.isTrue(YETItransferFromTx_2.receipt.status)
    })

    it("Anyone (other than liquity AG) can stake their YETI in the staking contract", async () => {
      // Fund F
      await yetiToken.unprotectedMint(F, dec(1, 18))

      const SYETITx_1 = await sYETI.mint(dec(1, 18), { from: F })
      await assert.isTrue(SYETITx_1.receipt.status)
    })

  })
  // --- LCF ---

  describe('Lockup Contract Factory negative tests', async accounts => {
    it("deployLockupContract(): reverts when YETI token address is not set", async () => {
      // Fund F
      await yetiToken.unprotectedMint(F, dec(20, 24))

      // deploy new LCF
      const LCFNew = await LockupContractFactory.new()

      // Check YETIToken address not registered
      const registeredYETITokenAddr = await LCFNew.yetiTokenAddress()
      assert.equal(registeredYETITokenAddr, ZERO_ADDRESS)

      const tx = LCFNew.deployLockupContract(A, oneYearFromSystemDeployment, { from: F })
      await assertRevert(tx)
    })
  })

  // --- LCs ---
  describe('Transferring YETI to LCs', async accounts => {
    it("Liquity multisig can transfer YETI (vesting) to lockup contracts they deployed", async () => {
      const initialYETIBalanceOfLC_T1 = await yetiToken.balanceOf(LC_T1.address)
      const initialYETIBalanceOfLC_T2 = await yetiToken.balanceOf(LC_T2.address)
      const initialYETIBalanceOfLC_T3 = await yetiToken.balanceOf(LC_T3.address)

      // Check initial LC balances == entitlements
      assert.equal(initialYETIBalanceOfLC_T1, teamMemberInitialEntitlement_1)
      assert.equal(initialYETIBalanceOfLC_T2, teamMemberInitialEntitlement_2)
      assert.equal(initialYETIBalanceOfLC_T3, teamMemberInitialEntitlement_3)

      // One month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Liquity multisig transfers vesting amount
      await yetiToken.transfer(LC_T1.address, dec(1, 24), { from: multisig })
      await yetiToken.transfer(LC_T2.address, dec(1, 24), { from: multisig })
      await yetiToken.transfer(LC_T3.address, dec(1, 24), { from: multisig })

      // Get new LC YETI balances
      const YETIBalanceOfLC_T1_1 = await yetiToken.balanceOf(LC_T1.address)
      const YETIBalanceOfLC_T2_1 = await yetiToken.balanceOf(LC_T2.address)
      const YETIBalanceOfLC_T3_1 = await yetiToken.balanceOf(LC_T3.address)

      // // Check team member LC balances have increased 
      assert.isTrue(YETIBalanceOfLC_T1_1.eq(th.toBN(initialYETIBalanceOfLC_T1).add(th.toBN(dec(1, 24)))))
      assert.isTrue(YETIBalanceOfLC_T2_1.eq(th.toBN(initialYETIBalanceOfLC_T2).add(th.toBN(dec(1, 24)))))
      assert.isTrue(YETIBalanceOfLC_T3_1.eq(th.toBN(initialYETIBalanceOfLC_T3).add(th.toBN(dec(1, 24)))))

      // Another month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Liquity multisig transfers vesting amount
      await yetiToken.transfer(LC_T1.address, dec(1, 24), { from: multisig })
      await yetiToken.transfer(LC_T2.address, dec(1, 24), { from: multisig })
      await yetiToken.transfer(LC_T3.address, dec(1, 24), { from: multisig })

      // Get new LC YETI balances
      const YETIBalanceOfLC_T1_2 = await yetiToken.balanceOf(LC_T1.address)
      const YETIBalanceOfLC_T2_2 = await yetiToken.balanceOf(LC_T2.address)
      const YETIBalanceOfLC_T3_2 = await yetiToken.balanceOf(LC_T3.address)

      // Check team member LC balances have increased again
      assert.isTrue(YETIBalanceOfLC_T1_2.eq(YETIBalanceOfLC_T1_1.add(th.toBN(dec(1, 24)))))
      assert.isTrue(YETIBalanceOfLC_T2_2.eq(YETIBalanceOfLC_T2_1.add(th.toBN(dec(1, 24)))))
      assert.isTrue(YETIBalanceOfLC_T3_2.eq(YETIBalanceOfLC_T3_1.add(th.toBN(dec(1, 24)))))
    })

    it("Liquity multisig can transfer YETI to lockup contracts deployed by anyone", async () => {
      // A, B, C each deploy a lockup contract with themself as beneficiary
      const deployedLCtx_A = await lockupContractFactory.deployLockupContract(A, twoYearsFromSystemDeployment, { from: A })
      const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, twoYearsFromSystemDeployment, { from: B })
      const deployedLCtx_C = await lockupContractFactory.deployLockupContract(C, twoYearsFromSystemDeployment, { from: C })

      // LCs for team members on vesting schedules
      const LC_A = await th.getLCFromDeploymentTx(deployedLCtx_A)
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)
      const LC_C = await th.getLCFromDeploymentTx(deployedLCtx_C)

      // Check balances of LCs are 0
      assert.equal(await yetiToken.balanceOf(LC_A.address), '0')
      assert.equal(await yetiToken.balanceOf(LC_B.address), '0')
      assert.equal(await yetiToken.balanceOf(LC_C.address), '0')

      // One month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Liquity multisig transfers YETI to LCs deployed by other accounts
      await yetiToken.transfer(LC_A.address, dec(1, 24), { from: multisig })
      await yetiToken.transfer(LC_B.address, dec(2, 24), { from: multisig })
      await yetiToken.transfer(LC_C.address, dec(3, 24), { from: multisig })

      // Check balances of LCs have increased
      assert.equal(await yetiToken.balanceOf(LC_A.address), dec(1, 24))
      assert.equal(await yetiToken.balanceOf(LC_B.address), dec(2, 24))
      assert.equal(await yetiToken.balanceOf(LC_C.address), dec(3, 24))
    })
  })

  describe('Deploying new LCs', async accounts => {
    it("YETI Deployer can deploy LCs through the Factory", async () => {
      // YETI deployer deploys LCs
      const LCDeploymentTx_A = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_B = await lockupContractFactory.deployLockupContract(B, twoYearsFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_C = await lockupContractFactory.deployLockupContract(C, '9595995999999900000023423234', { from: liquityAG })

      assert.isTrue(LCDeploymentTx_A.receipt.status)
      assert.isTrue(LCDeploymentTx_B.receipt.status)
      assert.isTrue(LCDeploymentTx_C.receipt.status)
    })

    it("Liquity multisig can deploy LCs through the Factory", async () => {
      // YETI deployer deploys LCs
      const LCDeploymentTx_A = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: multisig })
      const LCDeploymentTx_B = await lockupContractFactory.deployLockupContract(B, twoYearsFromSystemDeployment, { from: multisig })
      const LCDeploymentTx_C = await lockupContractFactory.deployLockupContract(C, '9595995999999900000023423234', { from: multisig })

      assert.isTrue(LCDeploymentTx_A.receipt.status)
      assert.isTrue(LCDeploymentTx_B.receipt.status)
      assert.isTrue(LCDeploymentTx_C.receipt.status)
    })

    it("Anyone can deploy LCs through the Factory", async () => {
      // Various EOAs deploy LCs
      const LCDeploymentTx_1 = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: teamMember_1 })
      const LCDeploymentTx_2 = await lockupContractFactory.deployLockupContract(C, twoYearsFromSystemDeployment, { from: investor_2 })
      const LCDeploymentTx_3 = await lockupContractFactory.deployLockupContract(liquityAG, '9595995999999900000023423234', { from: A })
      const LCDeploymentTx_4 = await lockupContractFactory.deployLockupContract(D, twoYearsFromSystemDeployment, { from: B })

      assert.isTrue(LCDeploymentTx_1.receipt.status)
      assert.isTrue(LCDeploymentTx_2.receipt.status)
      assert.isTrue(LCDeploymentTx_3.receipt.status)
      assert.isTrue(LCDeploymentTx_4.receipt.status)
    })

    it("YETI Deployer can deploy LCs directly", async () => {
      // YETI deployer deploys LCs
      const LC_A = await LockupContract.new(yetiToken.address, A, oneYearFromSystemDeployment, { from: liquityAG })
      const LC_A_txReceipt = await web3.eth.getTransactionReceipt(LC_A.transactionHash)

      const LC_B = await LockupContract.new(yetiToken.address, B, twoYearsFromSystemDeployment, { from: liquityAG })
      const LC_B_txReceipt = await web3.eth.getTransactionReceipt(LC_B.transactionHash)

      const LC_C = await LockupContract.new(yetiToken.address, C, twoYearsFromSystemDeployment, { from: liquityAG })
      const LC_C_txReceipt = await web3.eth.getTransactionReceipt(LC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(LC_A_txReceipt.status)
      assert.isTrue(LC_B_txReceipt.status)
      assert.isTrue(LC_C_txReceipt.status)
    })

    it("Liquity multisig can deploy LCs directly", async () => {
      // YETI deployer deploys LCs
      const LC_A = await LockupContract.new(yetiToken.address, A, oneYearFromSystemDeployment, { from: multisig })
      const LC_A_txReceipt = await web3.eth.getTransactionReceipt(LC_A.transactionHash)

      const LC_B = await LockupContract.new(yetiToken.address, B, twoYearsFromSystemDeployment, { from: multisig })
      const LC_B_txReceipt = await web3.eth.getTransactionReceipt(LC_B.transactionHash)

      const LC_C = await LockupContract.new(yetiToken.address, C, twoYearsFromSystemDeployment, { from: multisig })
      const LC_C_txReceipt = await web3.eth.getTransactionReceipt(LC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(LC_A_txReceipt.status)
      assert.isTrue(LC_B_txReceipt.status)
      assert.isTrue(LC_C_txReceipt.status)
    })

    it("Anyone can deploy LCs directly", async () => {
      // Various EOAs deploy LCs
      const LC_A = await LockupContract.new(yetiToken.address, A, oneYearFromSystemDeployment, { from: D })
      const LC_A_txReceipt = await web3.eth.getTransactionReceipt(LC_A.transactionHash)

      const LC_B = await LockupContract.new(yetiToken.address, B, twoYearsFromSystemDeployment, { from: E })
      const LC_B_txReceipt = await web3.eth.getTransactionReceipt(LC_B.transactionHash)

      const LC_C = await LockupContract.new(yetiToken.address, C, twoYearsFromSystemDeployment, { from: F })
      const LC_C_txReceipt = await web3.eth.getTransactionReceipt(LC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(LC_A_txReceipt.status)
      assert.isTrue(LC_B_txReceipt.status)
      assert.isTrue(LC_C_txReceipt.status)
    })

    it("Anyone can deploy LCs with unlockTime = one year from deployment, directly and through factory", async () => {
      // Deploy directly
      const LC_1 = await LockupContract.new(yetiToken.address, A, oneYearFromSystemDeployment, { from: D })
      const LCTxReceipt_1 = await web3.eth.getTransactionReceipt(LC_1.transactionHash)

      const LC_2 = await LockupContract.new(yetiToken.address, B, oneYearFromSystemDeployment, { from: liquityAG })
      const LCTxReceipt_2 = await web3.eth.getTransactionReceipt(LC_2.transactionHash)

      const LC_3 = await LockupContract.new(yetiToken.address, C, oneYearFromSystemDeployment, { from: multisig })
      const LCTxReceipt_3 = await web3.eth.getTransactionReceipt(LC_2.transactionHash)

      // Deploy through factory
      const LCDeploymentTx_4 = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: E })
      const LCDeploymentTx_5 = await lockupContractFactory.deployLockupContract(C, twoYearsFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_6 = await lockupContractFactory.deployLockupContract(D, twoYearsFromSystemDeployment, { from: multisig })

      // Check deployments succeeded
      assert.isTrue(LCTxReceipt_1.status)
      assert.isTrue(LCTxReceipt_2.status)
      assert.isTrue(LCTxReceipt_3.status)
      assert.isTrue(LCDeploymentTx_4.receipt.status)
      assert.isTrue(LCDeploymentTx_5.receipt.status)
      assert.isTrue(LCDeploymentTx_6.receipt.status)
    })

    it("Anyone can deploy LCs with unlockTime > one year from deployment, directly and through factory", async () => {
      const justOverOneYear = oneYearFromSystemDeployment.add(toBN('1'))
      const _17YearsFromDeployment = oneYearFromSystemDeployment.add(toBN(timeValues.SECONDS_IN_ONE_YEAR).mul(toBN('2')))
      
      // Deploy directly
      const LC_1 = await LockupContract.new(yetiToken.address, A, twoYearsFromSystemDeployment, { from: D })
      const LCTxReceipt_1 = await web3.eth.getTransactionReceipt(LC_1.transactionHash)

      const LC_2 = await LockupContract.new(yetiToken.address, B, justOverOneYear, { from: multisig })
      const LCTxReceipt_2 = await web3.eth.getTransactionReceipt(LC_2.transactionHash)

      const LC_3 = await LockupContract.new(yetiToken.address, E, _17YearsFromDeployment, { from: E })
      const LCTxReceipt_3 = await web3.eth.getTransactionReceipt(LC_3.transactionHash)

      // Deploy through factory
      const LCDeploymentTx_4 = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: E })
      const LCDeploymentTx_5 = await lockupContractFactory.deployLockupContract(C, twoYearsFromSystemDeployment, { from: multisig })
      const LCDeploymentTx_6 = await lockupContractFactory.deployLockupContract(D, twoYearsFromSystemDeployment, { from: teamMember_2 })

      // Check deployments succeeded
      assert.isTrue(LCTxReceipt_1.status)
      assert.isTrue(LCTxReceipt_2.status)
      assert.isTrue(LCTxReceipt_3.status)
      assert.isTrue(LCDeploymentTx_4.receipt.status)
      assert.isTrue(LCDeploymentTx_5.receipt.status)
      assert.isTrue(LCDeploymentTx_6.receipt.status)
    })

    it("No one can deploy LCs with unlockTime < one year from deployment, directly or through factory", async () => {
      const justUnderOneYear = oneYearFromSystemDeployment.sub(toBN('1'))
     
      // Attempt to deploy directly
      const directDeploymentTxPromise_1 = LockupContract.new(yetiToken.address, A, justUnderOneYear, { from: D })
      const directDeploymentTxPromise_2 = LockupContract.new(yetiToken.address, B, '43200', { from: multisig })
      const directDeploymentTxPromise_3 =  LockupContract.new(yetiToken.address, E, '354534', { from: E })
  
      // Attempt to deploy through factory
      const factoryDploymentTxPromise_1 = lockupContractFactory.deployLockupContract(A, justUnderOneYear, { from: E })
      const factoryDploymentTxPromise_2 = lockupContractFactory.deployLockupContract(C, '43200', { from: multisig })
      const factoryDploymentTxPromise_3 = lockupContractFactory.deployLockupContract(D, '354534', { from: teamMember_2 })

      // Check deployments reverted
      await assertRevert(directDeploymentTxPromise_1, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(directDeploymentTxPromise_2, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(directDeploymentTxPromise_3, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(factoryDploymentTxPromise_1, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(factoryDploymentTxPromise_2, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(factoryDploymentTxPromise_3, "LockupContract: unlock time must be at least one year after system deployment")
    })


    describe('Withdrawal Attempts on LCs before unlockTime has passed ', async accounts => {
      it("Liquity multisig can't withdraw from a funded LC they deployed for another beneficiary through the Factory before the unlockTime", async () => {

        // Check currentTime < unlockTime
        const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
        const unlockTime = await LC_T1.unlockTime()
        assert.isTrue(currentTime.lt(unlockTime))

        // Liquity multisig attempts withdrawal from LC they deployed through the Factory
        try {
          const withdrawalAttempt = await LC_T1.withdrawYETI({ from: multisig })
          assert.isFalse(withdrawalAttempt.receipt.status)
        } catch (error) {
          assert.include(error.message, "LockupContract: caller is not the beneficiary")
        }
      })

      it("Liquity multisig can't withdraw from a funded LC that someone else deployed before the unlockTime", async () => {
        // Account D deploys a new LC via the Factory
        const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: D })
        const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

        //YETI multisig fund the newly deployed LCs
        await yetiToken.transfer(LC_B.address, dec(2, 18), { from: multisig })

        // Check currentTime < unlockTime
        const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
        const unlockTime = await LC_B.unlockTime()
        assert.isTrue(currentTime.lt(unlockTime))

        // Liquity multisig attempts withdrawal from LCs
        try {
          const withdrawalAttempt_B = await LC_B.withdrawYETI({ from: multisig })
          assert.isFalse(withdrawalAttempt_B.receipt.status)
        } catch (error) {
          assert.include(error.message, "LockupContract: caller is not the beneficiary")
        }
      })

      it("Beneficiary can't withdraw from their funded LC before the unlockTime", async () => {
        // Account D deploys a new LC via the Factory
        const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: D })
        const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

        // Liquity multisig funds contracts
        await yetiToken.transfer(LC_B.address, dec(2, 18), { from: multisig })

        // Check currentTime < unlockTime
        const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
        const unlockTime = await LC_B.unlockTime()
        assert.isTrue(currentTime.lt(unlockTime))

        /* Beneficiaries of all LCS - team, investor, and newly created LCs - 
        attempt to withdraw from their respective funded contracts */
        const LCs = [
          LC_T1,
          LC_T2,
          LC_T3,
          LC_I1,
          LC_I2,
          LC_T3,
          LC_B
        ]

        for (LC of LCs) {
          try {
            const beneficiary = await LC.beneficiary()
            const withdrawalAttempt = await LC.withdrawYETI({ from: beneficiary })
            assert.isFalse(withdrawalAttempt.receipt.status)
          } catch (error) {
            assert.include(error.message, "LockupContract: The lockup duration must have passed")
          }
        }
      })

      it("No one can withdraw from a beneficiary's funded LC before the unlockTime", async () => {
        // Account D deploys a new LC via the Factory
        const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: D })
        const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

        // Liquity multisig funds contract
        await yetiToken.transfer(LC_B.address, dec(2, 18), { from: multisig })

        // Check currentTime < unlockTime
        const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
        const unlockTime = await LC_B.unlockTime()
        assert.isTrue(currentTime.lt(unlockTime))

        const variousEOAs = [teamMember_2, liquityAG, multisig, investor_1, A, C, D, E]

        // Several EOAs attempt to withdraw from LC deployed by D
        for (account of variousEOAs) {
          try {
            const withdrawalAttempt = await LC_B.withdrawYETI({ from: account })
            assert.isFalse(withdrawalAttempt.receipt.status)
          } catch (error) {
            assert.include(error.message, "LockupContract: caller is not the beneficiary")
          }
        }

        // Several EOAs attempt to withdraw from LC_T1 deployed by YETI deployer
        for (account of variousEOAs) {
          try {
            const withdrawalAttempt = await LC_T1.withdrawYETI({ from: account })
            assert.isFalse(withdrawalAttempt.receipt.status)
          } catch (error) {
            assert.include(error.message, "LockupContract: caller is not the beneficiary")
          }
        }
      })
    })
  })
})