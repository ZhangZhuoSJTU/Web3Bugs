const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")


const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const assertRevert = th.assertRevert
const toBN = th.toBN
const dec = th.dec

contract('Deploying the YETI contracts: LCF, CI, SYETI, and YETIToken ', async accounts => {
  const [liquityAG, A, B] = accounts;
  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let YETIContracts

  const oneMillion = toBN(1000000)
  const digits = toBN(1e18)
  const thirtyTwo = toBN(32)
  const expectedCISupplyCap = thirtyTwo.mul(oneMillion).mul(digits)

  beforeEach(async () => {
    // Deploy all contracts from the first account
    YETIContracts = await deploymentHelper.deployYETIContracts(bountyAddress, lpRewardsAddress, multisig)
    await deploymentHelper.connectYETIContracts(YETIContracts)

    sYETI = YETIContracts.sYETI
    yetiToken = YETIContracts.yetiToken
    communityIssuance = YETIContracts.communityIssuance
    lockupContractFactory = YETIContracts.lockupContractFactory

    //YETI Staking and CommunityIssuance have not yet had their setters called, so are not yet
    // connected to the rest of the system
  })


  describe('CommunityIssuance deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await communityIssuance.owner()

      assert.equal(liquityAG, storedDeployerAddress)
    })
  })

  describe('SYETI deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await sYETI.owner()

      assert.equal(liquityAG, storedDeployerAddress)
    })
  })

  describe('YETIToken deployment', async accounts => {
    it("Stores the multisig's address", async () => {
      const storedMultisigAddress = await yetiToken.multisigAddress()

      assert.equal(multisig, storedMultisigAddress)
    })

    it("Stores the CommunityIssuance address", async () => {
      const storedCIAddress = await yetiToken.communityIssuanceAddress()

      assert.equal(communityIssuance.address, storedCIAddress)
    })

    it("Stores the LockupContractFactory address", async () => {
      const storedLCFAddress = await yetiToken.lockupContractFactory()

      assert.equal(lockupContractFactory.address, storedLCFAddress)
    })

    it("Mints the correct YETI amount to the multisig's address: (64.66 million)", async () => {
      const multisigYETIEntitlement = await yetiToken.balanceOf(multisig)

     const twentyThreeSixes = "6".repeat(23)
      const expectedMultisigEntitlement = "64".concat(twentyThreeSixes).concat("7")
      assert.equal(multisigYETIEntitlement, expectedMultisigEntitlement)
    })

    it("Mints the correct YETI amount to the CommunityIssuance contract address: 32 million", async () => {
      const communityYETIEntitlement = await yetiToken.balanceOf(communityIssuance.address)
      // 32 million as 18-digit decimal
      const _32Million = dec(32, 24)

      assert.equal(communityYETIEntitlement, _32Million)
    })

    it("Mints the correct YETI amount to the bountyAddress EOA: 2 million", async () => {
      const bountyAddressBal = await yetiToken.balanceOf(bountyAddress)
      // 2 million as 18-digit decimal
      const _2Million = dec(2, 24)

      assert.equal(bountyAddressBal, _2Million)
    })

    it("Mints the correct YETI amount to the lpRewardsAddress EOA: 1.33 million", async () => {
      const lpRewardsAddressBal = await yetiToken.balanceOf(lpRewardsAddress)
      // 1.3 million as 18-digit decimal
      const _1pt33Million = "1".concat("3".repeat(24))

      assert.equal(lpRewardsAddressBal, _1pt33Million)
    })
  })

  describe('Community Issuance deployment', async accounts => {
    it("Stores the deployer's address", async () => {

      const storedDeployerAddress = await communityIssuance.owner()

      assert.equal(storedDeployerAddress, liquityAG)
    })

    it("Has a supply cap of 32 million", async () => {
      const supplyCap = await communityIssuance.YETISupplyCap()

      assert.isTrue(expectedCISupplyCap.eq(supplyCap))
    })

    it("Liquity AG can set addresses if CI's YETI balance is equal or greater than 32 million ", async () => {
      const YETIBalance = await yetiToken.balanceOf(communityIssuance.address)
      assert.isTrue(YETIBalance.eq(expectedCISupplyCap))

      // Deploy core contracts, just to get the Stability Pool address
      const coreContracts = await deploymentHelper.deployLiquityCore()

      const tx = await communityIssuance.setAddresses(
        yetiToken.address,
        coreContracts.stabilityPool.address,
        { from: liquityAG }
      );
      assert.isTrue(tx.receipt.status)
    })

    it("Liquity AG can't set addresses if CI's YETI balance is < 32 million ", async () => {
      const newCI = await CommunityIssuance.new()

      const YETIBalance = await yetiToken.balanceOf(newCI.address)
      assert.equal(YETIBalance, '0')

      // Deploy core contracts, just to get the Stability Pool address
      const coreContracts = await deploymentHelper.deployLiquityCore()

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await yetiToken.transfer(newCI.address, '31999999999999999999999999', {from: multisig}) // 1e-18 less than CI expects (32 million)

      try {
        const tx = await newCI.setAddresses(
          yetiToken.address,
          coreContracts.stabilityPool.address,
          { from: liquityAG }
        );
      
        // Check it gives the expected error message for a failed Solidity 'assert'
      } catch (err) {
        assert.include(err.message, "invalid opcode")
      }
    })
  })

  describe('Connecting YETIToken to LCF, CI and SYETI', async accounts => {
    it('sets the correct YETIToken address in SYETI', async () => {
      // Deploy core contracts and set the YETIToken address in the CI and SYETI
      const coreContracts = await deploymentHelper.deployLiquityCore()
      await deploymentHelper.connectYETIContractsToCore(YETIContracts, coreContracts)

      const yetiTokenAddress = yetiToken.address

      const recordedYETITokenAddress = await sYETI.yetiToken()
      assert.equal(yetiTokenAddress, recordedYETITokenAddress)
    })

    it('sets the correct YETIToken address in LockupContractFactory', async () => {
      const yetiTokenAddress = yetiToken.address

      const recordedYETITokenAddress = await lockupContractFactory.yetiTokenAddress()
      assert.equal(yetiTokenAddress, recordedYETITokenAddress)
    })

    it('sets the correct YETIToken address in CommunityIssuance', async () => {
      // Deploy core contracts and set the YETIToken address in the CI and SYETI
      const coreContracts = await deploymentHelper.deployLiquityCore()
      await deploymentHelper.connectYETIContractsToCore(YETIContracts, coreContracts)

      const yetiTokenAddress = yetiToken.address

      const recordedYETITokenAddress = await communityIssuance.yetiToken()
      assert.equal(yetiTokenAddress, recordedYETITokenAddress)
    })
  })
})
