const deploymentHelper = require("../utils/deploymentHelpers.js")

contract('Deployment script - Sets correct contract addresses dependencies after deployment', async accounts => {
  const [owner] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)
  
  let priceFeed
  let yusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations
  let sYETI
  let yetiToken
  let communityIssuance
  let lockupContractFactory

  before(async () => {
    const coreContracts = await deploymentHelper.deployLiquityCore()
    const YETIContracts = await deploymentHelper.deployYETIContracts(bountyAddress, lpRewardsAddress, multisig)

    priceFeed = coreContracts.priceFeedTestnet
    yusdToken = coreContracts.yusdToken
    sortedTroves = coreContracts.sortedTroves
    troveManager = coreContracts.troveManager
    activePool = coreContracts.activePool
    stabilityPool = coreContracts.stabilityPool
    defaultPool = coreContracts.defaultPool
    functionCaller = coreContracts.functionCaller
    borrowerOperations = coreContracts.borrowerOperations

    sYETI = YETIContracts.sYETI
    yetiToken = YETIContracts.yetiToken
    communityIssuance = YETIContracts.communityIssuance
    lockupContractFactory = YETIContracts.lockupContractFactory

    await deploymentHelper.connectYETIContracts(YETIContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, YETIContracts)
    await deploymentHelper.connectYETIContractsToCore(YETIContracts, coreContracts)
  })

  // @KingYeti: priceFeed no longer set in troveManager
  // it('Sets the correct PriceFeed address in TroveManager', async () => {
  //   const priceFeedAddress = priceFeed.address
  //
  //   const recordedPriceFeedAddress = await troveManager.priceFeed()
  //
  //   assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  // })

  it('Sets the correct YUSDToken address in TroveManager', async () => {
    const yusdTokenAddress = yusdToken.address

    const recordedClvTokenAddress = await troveManager.yusdToken()

    assert.equal(yusdTokenAddress, recordedClvTokenAddress)
  })

  it('Sets the correct SortedTroves address in TroveManager', async () => {
    const sortedTrovesAddress = sortedTroves.address

    const recordedSortedTrovesAddress = await troveManager.sortedTroves()

    assert.equal(sortedTrovesAddress, recordedSortedTrovesAddress)
  })

  it('Sets the correct BorrowerOperations address in TroveManager', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await troveManager.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // ActivePool in TroveM
  it('Sets the correct ActivePool address in TroveManager', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddresss = await troveManager.activePool()

    assert.equal(activePoolAddress, recordedActivePoolAddresss)
  })

  // DefaultPool in TroveM
  it('Sets the correct DefaultPool address in TroveManager', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddresss = await troveManager.defaultPool()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddresss)
  })

  // StabilityPool in TroveM
  it('Sets the correct StabilityPool address in TroveManager', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddresss = await troveManager.stabilityPool()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddresss)
  })

  // YETI Staking in TroveM
  it('Sets the correct SYETI address in TroveManager', async () => {
    const sYETIAddress = sYETI.address

    const recordedSYETIAddress = await troveManager.sYETI()
    assert.equal(sYETIAddress, recordedSYETIAddress)
  })

  // Active Pool

  it('Sets the correct StabilityPool address in ActivePool', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await activePool.stabilityPoolAddress()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })

  it('Sets the correct DefaultPool address in ActivePool', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await activePool.defaultPoolAddress()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  it('Sets the correct BorrowerOperations address in ActivePool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await activePool.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct TroveManager address in ActivePool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await activePool.troveManagerAddress()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // Stability Pool

  it('Sets the correct ActivePool address in StabilityPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await stabilityPool.activePool()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('Sets the correct BorrowerOperations address in StabilityPool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await stabilityPool.borrowerOperations()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct YUSDToken address in StabilityPool', async () => {
    const yusdTokenAddress = yusdToken.address

    const recordedClvTokenAddress = await stabilityPool.yusdToken()

    assert.equal(yusdTokenAddress, recordedClvTokenAddress)
  })

  it('Sets the correct TroveManager address in StabilityPool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await stabilityPool.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // Default Pool

  it('Sets the correct TroveManager address in DefaultPool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await defaultPool.troveManagerAddress()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  it('Sets the correct ActivePool address in DefaultPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await defaultPool.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('Sets the correct TroveManager address in SortedTroves', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await sortedTroves.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct BorrowerOperations address in SortedTroves', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await sortedTroves.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  //--- BorrowerOperations ---

  // TroveManager in BO
  it('Sets the correct TroveManager address in BorrowerOperations', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await borrowerOperations.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // @KingYeti: Price Feed no longer set in Borrower Operations
  // it('Sets the correct PriceFeed address in BorrowerOperations', async () => {
  //   const priceFeedAddress = priceFeed.address
  //
  //   const recordedPriceFeedAddress = await borrowerOperations.priceFeed()
  //   assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  // })

  // setSortedTroves in BO
  it('Sets the correct SortedTroves address in BorrowerOperations', async () => {
    const sortedTrovesAddress = sortedTroves.address

    const recordedSortedTrovesAddress = await borrowerOperations.sortedTroves()
    assert.equal(sortedTrovesAddress, recordedSortedTrovesAddress)
  })

  // setActivePool in BO
  it('Sets the correct ActivePool address in BorrowerOperations', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await borrowerOperations.activePool()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  // setDefaultPool in BO
  it('Sets the correct DefaultPool address in BorrowerOperations', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await borrowerOperations.defaultPool()
    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  // YETI Staking in BO
  it('Sets the correct SYETI address in BorrowerOperations', async () => {
    const sYETIAddress = sYETI.address

    const recordedSYETIAddress = await borrowerOperations.sYETIAddress()
    assert.equal(sYETIAddress, recordedSYETIAddress)
  })


  // --- YETI Staking ---

  // Sets YETIToken in SYETI
  it('Sets the correct YETIToken address in SYETI', async () => {
    const yetiTokenAddress = yetiToken.address

    const recordedYETITokenAddress = await sYETI.yetiToken()
    assert.equal(yetiTokenAddress, recordedYETITokenAddress)
  })

  // Sets YUSDToken in SYETI
  it('Sets the correct YUSD Token address in SYETI', async () => {
    const yusdTokenAddress = yusdToken.address

    const recordedYUSDTokenAddress = await sYETI.yusdToken()
    assert.equal(yusdTokenAddress, recordedYUSDTokenAddress)
  })


  // ---  YETIToken ---

  // Sets CI in YETIToken
  it('Sets the correct CommunityIssuance address in YETIToken', async () => {
    const communityIssuanceAddress = communityIssuance.address

    const recordedcommunityIssuanceAddress = await yetiToken.communityIssuanceAddress()
    assert.equal(communityIssuanceAddress, recordedcommunityIssuanceAddress)
  })

  // Sets SYETI in YETIToken
  it('Sets the correct SYETI address in YETIToken', async () => {
    const sYETIAddress = sYETI.address

    const recordedSYETIAddress =  await yetiToken.sYETIAddress()
    assert.equal(sYETIAddress, recordedSYETIAddress)
  })

  // Sets LCF in YETIToken
  it('Sets the correct LockupContractFactory address in YETIToken', async () => {
    const LCFAddress = lockupContractFactory.address

    const recordedLCFAddress =  await yetiToken.lockupContractFactory()
    assert.equal(LCFAddress, recordedLCFAddress)
  })

  // --- LCF  ---

  // Sets YETIToken in LockupContractFactory
  it('Sets the correct YETIToken address in LockupContractFactory', async () => {
    const yetiTokenAddress = yetiToken.address

    const recordedYETITokenAddress = await lockupContractFactory.yetiTokenAddress()
    assert.equal(yetiTokenAddress, recordedYETITokenAddress)
  })

  // --- CI ---

  // Sets YETIToken in CommunityIssuance
  it('Sets the correct YETIToken address in CommunityIssuance', async () => {
    const yetiTokenAddress = yetiToken.address

    const recordedYETITokenAddress = await communityIssuance.yetiToken()
    assert.equal(yetiTokenAddress, recordedYETITokenAddress)
  })

  it('Sets the correct StabilityPool address in CommunityIssuance', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await communityIssuance.stabilityPoolAddress()
    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })
})
